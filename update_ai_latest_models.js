const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { 
  Client,
  Events, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} = require('discord.js');

const tokenLocalPath = path.join(__dirname, 'token.local.js');
const localConfig = fs.existsSync(tokenLocalPath) ? require(tokenLocalPath) : {};
const TOKEN = process.env.DISCORD_TOKEN || localConfig.TOKEN || localConfig.DISCORD_TOKEN || '';
const LS_STUDIO_GUILD_ID = process.env.GUILD_ID || (typeof localConfig !== "undefined" && localConfig.GUILD_ID) || "1542476657825419334";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// Helper: Pacing delay to prevent Discord 429 Rate Limits
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Watchdog timeout to prevent script hanging indefinitely
const WATCHDOG_TIMEOUT_MS = 30000;
const watchdog = setTimeout(async () => {
  console.error(`⏱️ [WATCHDOG] Quá thời gian thực thi (${WATCHDOG_TIMEOUT_MS / 1000}s). Tự động hủy kết nối Discord và dừng tiến trình.`);
  try {
    await client.destroy();
  } catch {}
  process.exit(1);
}, WATCHDOG_TIMEOUT_MS);
if (watchdog.unref) watchdog.unref();

client.on(Events.Error, (err) => {
  console.error('❌ Lỗi Discord Client:', err.message || err);
});

let isExiting = false;
async function cleanupAndExit(code = 0) {
  if (isExiting) return;
  isExiting = true;
  clearTimeout(watchdog);
  try {
    await client.destroy();
  } catch {}
  process.exit(code);
}

process.on('SIGINT', async () => {
  console.log('🛑 [SIGINT] Đang dừng tiến trình...');
  await cleanupAndExit(0);
});
process.on('SIGTERM', async () => {
  console.log('🛑 [SIGTERM] Đang dừng tiến trình...');
  await cleanupAndExit(0);
});
process.on('SIGHUP', async () => {
  console.log('🛑 [SIGHUP] Đang dừng tiến trình...');
  await cleanupAndExit(0);
});

process.on('unhandledRejection', async (reason) => {
  console.error('❌ Lỗi không kiểm soát (Unhandled Rejection):', reason);
  await cleanupAndExit(1);
});

process.on('uncaughtException', async (err) => {
  console.error('❌ Lỗi ngoại lệ chưa bắt (Uncaught Exception):', err);
  await cleanupAndExit(1);
});


client.once(Events.ClientReady, async () => {
  console.log(`🤖 Logged in as ${client.user.tag}! Cập nhật thông tin Model mới nhất: Claude Fable 5, Opus 5, Sonnet 5 & GPT-5.6 Sol...`);

  try {
    const guild = await client.guilds.fetch(LS_STUDIO_GUILD_ID).catch(err => {
      console.error(`❌ [ERROR] Không thể fetch Guild (${LS_STUDIO_GUILD_ID}):`, err.message || err);
      return null;
    });
    if (!guild) {
      console.error(`❌ [ERROR] Không tìm thấy Guild (${LS_STUDIO_GUILD_ID}) hoặc Bot chưa tham gia.`);
      return await cleanupAndExit(1);
    }
    const channels = await guild.channels.fetch();

    async function refreshChannel(ch, fn) {
      if (!ch) return;
      try {
        const messages = await ch.messages.fetch({ limit: 15 });
        for (const [mId, msg] of msgs) {
      if (msg.author.id === client.user.id) {
        await msg.delete().catch(() => {});
        await sleep(250);
      }
    }
        await fn(ch);
        console.log(`   ✅ Cập nhật kênh: #${ch.name}`);
      } catch (e) {
        console.error(`   ❌ Lỗi kênh ${ch.name}:`, e.message);
      }
    }

    function makeActionButtons() {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_buy")
          .setLabel("🛒 Mở Ticket Đặt Mua / Buy Ticket")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("ticket_pricing")
          .setLabel("💰 Bảng Giá / Price List")
          .setStyle(ButtonStyle.Secondary)
      );
    }

    // 1. KÊNH #🧠・api-claude-100m
    const chClaudeApi = channels.find(c => c && c.name === "🧠・api-claude-100m");
    await refreshChannel(chClaudeApi, async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#D97706")
        .setTitle("🧠 API KEY CLAUDE 100M TOKEN • FABLE 5, OPUS 5, SONNET 5 (3 NGÀY)")
        .setDescription(
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Gói API Key Claude thế hệ 5 mới nhất từ Anthropic, hỗ trợ đầy đủ các model đỉnh cao chuyên dụng cho lập trình tự động (Agentic Coding), Cursor, Cline, Roo Code, Aider và Bot Discord:\n\n" +
          "• **Giá bán:** `4.25$` • `109.000 VNĐ`\n" +
          "• **Hạn mức:** 100 Triệu Token Claude thế hệ mới\n" +
          "• **Thời hạn:** 3 Ngày kể từ khi kích hoạt\n\n" +
          "🌟 **Hỗ trợ trọn bộ Model mới nhất:**\n" +
          "• **Claude Fable 5 (Mythos-Class):** Model cao cấp chuyên tự động lập kế hoạch, điều phối sub-agents và tự sửa lỗi code đa tác vụ.\n" +
          "• **Claude Opus 5 (Flagship Reasoning):** Đỉnh cao suy luận logic phức tạp và xử lý bộ nhớ dài hạn với chi phí token tối ưu.\n" +
          "• **Claude Sonnet 5 (Workhorse):** Tốc độ phản hồi tức thì, tuân thủ cấu trúc code nghiêm ngặt, không bị đứng giữa chừng.\n" +
          "• Tốc độ cao, không nghẽn rate limit, bảo hành Key trọn thời gian dùng.\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "Latest Anthropic Claude 5 Generation API Key for Autonomous Agentic Coding, Cursor, Cline, Roo Code & AI Agents:\n\n" +
          "• **Price:** `$4.25 USD` • `109.000 VNĐ`\n" +
          "• **Quota:** 100M Tokens across all Claude 5 models\n" +
          "• **Validity:** 3 Days from activation\n\n" +
          "🌟 **Supported Models:**\n" +
          "• **Claude Fable 5 (Mythos-Class):** Autonomous knowledge work, sub-agent delegation, and multi-step verification.\n" +
          "• **Claude Opus 5 (Flagship):** Advanced logical reasoning, agentic coding, and long-term memory management.\n" +
          "• **Claude Sonnet 5:** Lightning-fast workhorse model for production-grade coding tasks."
        )
        .setFooter({ text: "LS STUDIO • Bảo hành Key sống đúng thời hạn / Full Warranty" });

      await ch.send({ embeds: [embed], components: [makeActionButtons()] });
    });

    // 2. KÊNH #⚡・api-codex-100m
    const chCodexApi = channels.find(c => c && c.name === "⚡・api-codex-100m");
    await refreshChannel(chCodexApi, async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#10A37F")
        .setTitle("⚡ API KEY OPENAI CODEX 100M TOKEN • GPT-5.6 SOL (3 NGÀY)")
        .setDescription(
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Gói API Key OpenAI Codex nâng cấp chạy trên nền tảng **GPT-5.6 Sol**, chuyên trị các dự án phần mềm quy mô lớn, tái cấu trúc mã nguồn và giải thuật toán phức tạp:\n\n" +
          "• **Giá bán:** `3.25$` • `85.000 VNĐ`\n" +
          "• **Hạn mức:** 100 Triệu Token OpenAI Codex\n" +
          "• **Thời hạn:** 3 Ngày kể từ khi kích hoạt\n\n" +
          "⚡ **Đặc điểm nổi bật:**\n" +
          "• Tích hợp sức mạnh của **GPT-5.6 Sol (Flagship)** và **GPT-5.6 Terra**.\n" +
          "• Tối ưu hóa sâu cho Codex CLI, VS Code Extension và các Agent lập trình đám mây.\n" +
          "• Bảo hành Key sống 100% trong 3 ngày.\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "OpenAI Codex API Key powered by the **GPT-5.6 Sol** flagship reasoning engine:\n\n" +
          "• **Price:** `$3.25 USD` • `85.000 VNĐ`\n" +
          "• **Quota:** 100M Tokens for Codex / GPT-5.6 ecosystem\n" +
          "• **Validity:** 3 Days from activation\n" +
          "• Optimized for Codex CLI, IDE extensions, and cloud coding workflows."
        )
        .setFooter({ text: "LS STUDIO • Bảo hành Key sống đúng thời hạn / Full Warranty" });

      await ch.send({ embeds: [embed], components: [makeActionButtons()] });
    });

    // 3. KÊNH #🔮・acc-claude-max20
    const chClaudeAcc = channels.find(c => c && c.name === "🔮・acc-claude-max20");
    await refreshChannel(chClaudeAcc, async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#9333EA")
        .setTitle("🔮 TÀI KHOẢN CLAUDE MAX 20 • FABLE 5, OPUS 5 & SONNET 5 (1 THÁNG)")
        .setDescription(
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Tài khoản Claude bản quyền hạn mức cao Max 20, truy cập đầy đủ toàn bộ dàn model thế hệ 5 mới nhất của Anthropic:\n\n" +
          "• **Giá bán:** `89.000 VNĐ` • `~$3.50 USD`\n" +
          "• **Thời hạn:** 30 Ngày\n\n" +
          "✨ **Quyền lợi tài khoản:**\n" +
          "• Sử dụng thả ga **Claude Sonnet 5**, **Claude Opus 5** và **Claude Fable 5** với quota tin nhắn cực cao.\n" +
          "• Xử lý tài liệu dung lượng lớn, đọc hiểu dự án code toàn diện và làm việc liên tục cả tháng.\n" +
          "• Hỗ trợ đăng nhập nhanh chóng, bảo hành 1 đổi 1 suốt 30 ngày.\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "Official Claude Max 20 Account with full access to Claude 5 Series:\n\n" +
          "• **Price:** `89.000 VNĐ` • `~$3.50 USD`\n" +
          "• **Duration:** 30 Days\n" +
          "• High message limits for Claude Sonnet 5, Opus 5, and Fable 5. 30-day warranty."
        )
        .setFooter({ text: "LS STUDIO • Đổi mới ngay nếu phát sinh sự cố / 30-day Warranty" });

      await ch.send({ embeds: [embed], components: [makeActionButtons()] });
    });

    // 4. KÊNH #🟢・acc-chatgpt-plus
    const chGptPlus = channels.find(c => c && c.name === "🟢・acc-chatgpt-plus");
    await refreshChannel(chGptPlus, async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#16A34A")
        .setTitle("🟢 TÀI KHOẢN CHATGPT PLUS • GPT-5.6 SOL (1 THÁNG)")
        .setDescription(
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Tài khoản ChatGPT Plus chính chủ với model đầu bảng **GPT-5.6 (Sol)** mới nhất từ OpenAI:\n\n" +
          "• **Giá bán:** `169.000 VNĐ` • `~$6.80 USD`\n" +
          "• **Thời hạn:** 30 Ngày\n\n" +
          "🌟 **Tính năng bao gồm:**\n" +
          "• Truy cập không giới hạn model **GPT-5.6 Sol** suy luận logic đỉnh cao cho code, nghiên cứu và phân tích số liệu.\n" +
          "• Tạo ảnh chân thực với DALL-E 3, trò chuyện âm thanh Voice Chat thời gian thực mượt mà.\n" +
          "• Không gian làm việc Canvas 2.0 và phân tích file dữ liệu chuyên sâu.\n" +
          "• Bảo hành đổi mới nếu gặp lỗi trong suốt 1 tháng.\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "Official ChatGPT Plus Account featuring the new **GPT-5.6 Sol** flagship reasoning model:\n\n" +
          "• **Price:** `169.000 VNĐ` • `~$6.80 USD`\n" +
          "• **Duration:** 30 Days\n" +
          "• Full access to GPT-5.6 Sol, Next-Gen Image Generation, Real-Time Voice Chat, and Canvas 2.0."
        )
        .setFooter({ text: "LS STUDIO • Bảo hành 1 tháng / 1-Month Warranty" });

      await ch.send({ embeds: [embed], components: [makeActionButtons()] });
    });

    // 5. KÊNH #🟣・acc-monica-pro
    const chMonica = channels.find(c => c && c.name === "🟣・acc-monica-pro");
    await refreshChannel(chMonica, async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#A855F7")
        .setTitle("🟣 TÀI KHOẢN MONICA AI PRO • CLAUDE 5 & GPT-5.6 (3 NGÀY)")
        .setDescription(
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Tài khoản Monica AI Pro tích hợp sẵn tất cả các model tân tiến nhất: **Claude Sonnet 5**, **Claude Opus 5**, **GPT-5.6 Sol** và **Gemini 2.5 Pro**:\n\n" +
          "• **Giá bán:** `49.000 VNĐ` • `~$2.00 USD`\n" +
          "• **Thời hạn:** 3 Ngày\n\n" +
          "💡 **Tính năng nổi bật:**\n" +
          "• Đổi qua lại giữa Claude 5 và GPT-5.6 Sol cực kỳ mượt mà chỉ bằng 1 nút bấm.\n" +
          "• Extension hỗ trợ duyệt web, tóm tắt video YouTube và viết code tiện lợi.\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "Monica AI Pro Account with Claude 5 & GPT-5.6 Sol Models:\n\n" +
          "• **Price:** `49.000 VNĐ` • `~$2.00 USD`\n" +
          "• **Duration:** 3 Days\n" +
          "• All-in-one access to Claude Sonnet 5, Opus 5, GPT-5.6 Sol, and Gemini 2.5 Pro."
        )
        .setFooter({ text: "LS STUDIO • Hỗ trợ nhiệt tình / Full Support" });

      await ch.send({ embeds: [embed], components: [makeActionButtons()] });
    });

    // 6. KÊNH #📧・acc-chatgpt-offer
    const chGptOffer = channels.find(c => c && c.name === "📧・acc-chatgpt-offer");
    await refreshChannel(chGptOffer, async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#6B7280")
        .setTitle("📧 TÀI KHOẢN CHATGPT NEW GMAIL • NHẬN OFFER GPT-5.6")
        .setDescription(
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Tài khoản Gmail mới tinh chưa từng đăng ký OpenAI, dùng để tự nhận các gói ưu đãi dùng thử GPT-5.6 Sol:\n\n" +
          "• **Giá bán:** `5.000 VNĐ` • `~$0.20 USD`\n" +
          "• ⚠️ **Lưu ý quan trọng:** Khách hàng cần chuẩn bị sẵn thẻ thanh toán PayPal để tự kích hoạt gói Offer của OpenAI.\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "Fresh Gmail account dedicated for activating ChatGPT GPT-5.6 Trial & Offer promotions:\n\n" +
          "• **Price:** `5.000 VNĐ` • `~$0.20 USD`\n" +
          "• ⚠️ **Notice:** A valid PayPal payment card is required on your end to activate the trial promotion."
        )
        .setFooter({ text: "LS STUDIO • Hỗ trợ nhiệt tình / Full Support" });

      await ch.send({ embeds: [embed], components: [makeActionButtons()] });
    });

    console.log("🎉 ĐÃ CẬP NHẬT TOÀN BỘ THÔNG TIN MODEL MỚI NHẤT XONG 100%!");
    await cleanupAndExit(0);
  } catch (err) {
    console.error("❌ [ERROR] Lỗi thực thi:", err.message || err);
    await cleanupAndExit(1);
  }
});

if (!TOKEN || TOKEN === 'YOUR_BOT_TOKEN_HERE' || TOKEN.trim() === '') {
  console.error('❌ Lỗi: DISCORD_TOKEN chưa được thiết lập trong .env hoặc token.local.js!');
  process.exit(1);
}

client.login(TOKEN).catch(async (err) => {
  console.error("❌ [ERROR] Lỗi thực thi:", err.message || err);
    await cleanupAndExit(1);
});
