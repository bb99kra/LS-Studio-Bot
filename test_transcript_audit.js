const {
  formatVNTime,
  sanitizeTranscriptControlChars,
  sanitizeSingleLineHeader,
  redactSensitiveData,
  sanitizeMarkdownForEmbed,
  extractTranscriptMessageData,
  generateTranscript,
  createTranscriptAttachments,
  executeTicketClosure
} = require('./bot.js');

const { Collection, PermissionsBitField, AttachmentBuilder } = require('discord.js');

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion Failed: ${message}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Assertion Failed [${message}]: Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

async function runTest(name, fn) {
  process.stdout.write(`⏳ Running: ${name}... `);
  try {
    await fn();
    console.log(`\x1b[32m✔ PASS\x1b[0m`);
  } catch (err) {
    console.log(`\x1b[31m✖ FAIL\x1b[0m\n      Error: ${err.message}`);
    throw err;
  }
}

async function main() {
  console.log("================================================================================");
  console.log("🔒 RUNNING TRANSCRIPT & TICKET LOGGING SECURITY TEST SUITE");
  console.log("================================================================================\n");

  // TEST 1: Control character & ANSI sequence sanitization
  await runTest("1.1 Sanitize ANSI escape sequences, BiDi overrides, and non-printable control chars", () => {
    const maliciousInput = "Hello \x1b[31;1mRed Alert\x1b[0m \u202Ereversed text\u200B\x00\x08\x1F\x7F normal \n next line \t tab";
    const cleaned = sanitizeTranscriptControlChars(maliciousInput);
    assert(!cleaned.includes("\x1b[31;1m"), "ANSI stripped");
    assert(!cleaned.includes("\u202E"), "BiDi override stripped");
    assert(!cleaned.includes("\u200B"), "Zero-width space stripped");
    assert(!cleaned.includes("\x00"), "Null byte stripped");
    assert(cleaned.includes("Hello Red Alert reversed text normal \n next line \t tab"), "Preserved content & valid whitespace");
  });

  // TEST 2: Single line header sanitization against CRLF injection
  await runTest("1.2 Header CRLF injection prevention", () => {
    const headerInput = "Header Name \r\n================================\nINJECTED FAKE HEADER: LS STUDIO";
    const sanitized = sanitizeSingleLineHeader(headerInput, 100);
    assert(!sanitized.includes("\n"), "Newlines stripped");
    assert(!sanitized.includes("\r"), "Carriage returns stripped");
    assert(sanitized.includes("Header Name ================================ INJECTED FAKE HEADER: LS STUDIO"), "Single line formatted");
  });

  // TEST 3: Customer Privacy & Sensitive Data Redaction
  await runTest("2.1 Redact Discord bot tokens, API keys, GitHub tokens, AWS keys, passwords", () => {
    const mockDiscordToken = ["MTA4NTI0", "NzY2NTc4MjU0MTkzMw"].join('') + '.' + ["G12345", "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789"].join('.');
    const mockOpenAIKey = "sk-" + "proj-1234567890abcdef1234567890abcdef12345678";
    const mockGoogleKey = "AIzaSy" + "D1234567890abcdefghijklmnopqrstuv";
    const mockGithubToken = "ghp_" + "1234567890abcdefghijklmnopqrstuvwxyz12";
    const mockAwsKey = "AKIA" + "IOSFODNN7EXAMPLE";
    const textWithSecrets = [
      `Here is my bot token: ${mockDiscordToken}`,
      `OpenAI Key: ${mockOpenAIKey}`,
      `Google API Key: ${mockGoogleKey}`,
      `GitHub Token: ${mockGithubToken}`,
      `AWS Key: ${mockAwsKey}`,
      "Webhook URL: https://discord.com/api/webhooks/123456789/SuperSecretWebhookToken123456789",
      "Private Key:\n-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0...\n-----END RSA PRIVATE KEY-----",
      "My password: SecretPassword123!"
    ].join('\n');

    const redacted = redactSensitiveData(textWithSecrets);
    assert(redacted.includes("[REDACTED_DISCORD_TOKEN]"), "Discord token redacted");
    assert(redacted.includes("[REDACTED_API_KEY]"), "API key redacted");
    assert(redacted.includes("[REDACTED_GITHUB_TOKEN]"), "GitHub token redacted");
    assert(redacted.includes("[REDACTED_AWS_KEY]"), "AWS key redacted");
    assert(redacted.includes("[REDACTED_WEBHOOK_"), "Webhook secret redacted");
    assert(redacted.includes("[REDACTED_PRIVATE_KEY]"), "Private key redacted");
    assert(redacted.includes("[REDACTED_SECRET]"), "Password redacted");
    assert(!redacted.includes("SuperSecretWebhookToken123456789"), "Webhook token not leaked");
    assert(!redacted.includes("SecretPassword123!"), "Password not leaked");
  });

  // TEST 4: Oversized transcript chunking (>8MB Discord limit)
  await runTest("3.1 createTranscriptAttachments with normal size (<= 7MB)", () => {
    const normalText = "This is a normal ticket transcript.\nLine 2\nLine 3";
    const res = createTranscriptAttachments(normalText, "transcript-ticket-123.txt");
    assertEqual(res.isSplit, false, "Single part");
    assertEqual(res.partsCount, 1, "1 file");
    assertEqual(res.attachments.length, 1, "1 attachment");
    assertEqual(res.attachments[0].name, "transcript-ticket-123.txt", "Filename preserved");
  });

  await runTest("3.2 createTranscriptAttachments with oversized text (> 7MB)", () => {
    // Generate ~15MB of text
    const sampleLine = "This is message line in a huge ticket conversation with Vietnamese tiếng Việt có dấu và emoji 🔒.\n";
    const repeatCount = Math.ceil((15 * 1024 * 1024) / Buffer.byteLength(sampleLine, 'utf-8'));
    const largeText = sampleLine.repeat(repeatCount);

    const res = createTranscriptAttachments(largeText, "transcript-huge-ticket.txt");
    assertEqual(res.isSplit, true, "Is split into parts");
    assert(res.partsCount >= 2 && res.partsCount <= 10, `Split into ${res.partsCount} valid parts`);
    assertEqual(res.attachments.length, res.partsCount, "All attachments created");

    for (let i = 0; i < res.attachments.length; i++) {
      const att = res.attachments[i];
      assert(att.name.includes(`part${i + 1}-of-${res.partsCount}`), `Part filename formatted: ${att.name}`);
      const buf = att.attachment;
      assert(buf.byteLength <= 7.5 * 1024 * 1024, `Attachment ${i + 1} size (${buf.byteLength} bytes) <= 7.5MB limit`);
      // Verify valid UTF-8
      const str = buf.toString('utf-8');
      assert(!str.includes("\uFFFD"), `Attachment ${i + 1} has valid UTF-8 without byte corruption`);
    }
  });

  // TEST 5: Embed Markdown & Mention Sanitization
  await runTest("4.1 sanitizeMarkdownForEmbed prevents @everyone and code block breaks", () => {
    const dangerousInput = "`closeReason` with @everyone and @here and <@&123456789> and ``backticks``";
    const sanitized = sanitizeMarkdownForEmbed(dangerousInput, 200);
    assert(!sanitized.includes("@everyone"), "@everyone neutralized");
    assert(!sanitized.includes("@here"), "@here neutralized");
    assert(!sanitized.includes("<@&"), "Role ping neutralized");
    assert(!sanitized.includes("`"), "Backticks neutralized");
  });

  // TEST 6: Complete Audit Trail in generateTranscript
  await runTest("5.1 generateTranscript produces complete audit trail headers & metadata", async () => {
    const mockChannel = {
      id: "123456789012345678",
      name: "mua-plugin-1234",
      topic: "Ticket của @Customer#1234 (987654321098765432) • Type: 🛒-mua",
      guild: { id: "112233445566778899", name: "LS STUDIO GUILD" },
      guildId: "112233445566778899",
      parent: { name: "MUA HÀNG" },
      isTextBased: () => true,
      messages: {
        fetch: async () => new Collection([
          ["m1", {
            id: "m1",
            content: "Chào shop, tôi muốn mua plugin LS-AntiCheat với token test sk-123456789012345678901234",
            createdTimestamp: 1700000000000,
            author: { id: "987654321098765432", tag: "Customer#1234", username: "Customer", bot: false },
            attachments: new Collection(),
            embeds: [],
            stickers: new Collection(),
            reactions: { cache: new Collection() }
          }],
          ["m2", {
            id: "m2",
            content: "Chào bạn! Đây là hoá đơn đơn hàng:",
            createdTimestamp: 1700000060000,
            author: { id: "111222333444555666", tag: "Staff#0001", username: "Staff", bot: false },
            attachments: new Collection([
              ["att1", { id: "att1", name: "invoice.pdf", size: 102400, contentType: "application/pdf", url: "https://cdn.discordapp.com/invoice.pdf" }]
            ]),
            embeds: [],
            stickers: new Collection(),
            reactions: { cache: new Collection([["✅", { emoji: { name: "✅" }, count: 1 }]]) }
          }]
        ])
      }
    };

    const transcript = await generateTranscript(mockChannel, "Giao dịch hoàn tất");
    assert(transcript.includes("LS STUDIO - TICKET TRANSCRIPT"), "Header banner");
    assert(transcript.includes("Máy chủ / Guild"), "Guild info");
    assert(transcript.includes("Kênh / Channel"), "Channel info");
    assert(transcript.includes("Chủ đề / Topic"), "Topic info");
    assert(transcript.includes("Lý do đóng / Reason"), "Close reason");
    assert(transcript.includes("Tổng số tin nhắn / Total Messages: 2"), "Total messages count");
    assert(transcript.includes("[REDACTED_API_KEY]"), "Token in message was redacted");
    assert(!transcript.includes("sk-123456789012345678901234"), "Raw secret key not in transcript");
    assert(transcript.includes("invoice.pdf"), "Attachment included");
    assert(transcript.includes("KẾT THÚC NHẬT KÝ / END OF TRANSCRIPT"), "End banner");
  });

  console.log("\n================================================================================");
  console.log("🎉 ALL TRANSCRIPT & AUDIT SECURITY TESTS PASSED 100%!");
  console.log("================================================================================");
}

main().catch(err => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
