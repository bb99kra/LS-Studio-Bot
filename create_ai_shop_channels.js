const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { 
  Client, 
  Events,
  GatewayIntentBits, 
  ChannelType, 
  PermissionsBitField, 
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
const WATCHDOG_TIMEOUT_MS = 60000;
const watchdog = setTimeout(async () => {
  console.error(`⏱️ [WATCHDOG] Quá thời gian thực thi (${WATCHDOG_TIMEOUT_MS / 1000}s). Tự động hủy kết nối Discord và dừng tiến trình.`);
  try { await client.destroy(); } catch {}
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
  try { await client.destroy(); } catch {}
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
  console.log(`🤖 Logged in as ${client.user.tag}! Đang tạo danh mục Shop AI & API Key...`);

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

    // 1. TẠO CATEGORY: 🤖 ━━━ DỊCH VỤ AI & API KEY ━━━
    let catAI = channels.find(c => c && c.type === ChannelType.GuildCategory && c.name.includes("DỊCH VỤ AI"));
    if (!catAI) {
      catAI = await guild.channels.create({
        name: "🤖 ━━━ DỊCH VỤ AI & API KEY ━━━",
        type: ChannelType.GuildCategory
      });
      console.log("✅ Đã tạo Category mới: 🤖 ━━━ DỊCH VỤ AI & API KEY ━━━");
    }

    async function getOrCreateChannel(name) {
      let ch = channels.find(c => c && c.name === name);
      if (!ch) {
        ch = await guild.channels.create({
          name: name,
          type: ChannelType.GuildText,
          parent: catAI.id,
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
              deny: [
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.CreatePublicThreads,
                PermissionsBitField.Flags.CreatePrivateThreads,
                PermissionsBitField.Flags.SendMessagesInThreads
              ]
            }
          ]
        });
        console.log(`✅ Đã tạo kênh: #${ch.name}`);
      }
      return ch;
    }

    async function refreshChannel(ch, fn) {
      if (!ch) return;
      try {
        const messages = await ch.messages.fetch({ limit: 15 });
        for (const [mId, msg] of messages) {
      if (msg.author.id === client.user.id) {
        await msg.delete().catch(() => {});
        await sleep(250);
      }
    }
        await fn(ch);
        console.log(`   ✅ Cập nhật nội dung: #${ch.name}`);
      } catch (e) {
        console.error(`   ❌ Lỗi kênh ${ch.name}:`, e.message);
      }
    }

    function makeActionButtons() {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_buy")
          .setLabel("🛒 Mở Ticket Mua Hàng / Buy Ticket")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("ticket_pricing")
          .setLabel("💰 Bảng Giá Tổng Hợp / Price List")
          .setStyle(ButtonStyle.Secondary)
      );
    }

    // 2. KÊNH #🔑・api-key-ai
    const chApiKey = await getOrCreateChannel("🔑・api-key-ai");
    await refreshChannel(chApiKey, async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#00E676")
        .setTitle("🔑 DỊCH VỤ API KEY AI CHUYÊN CODING & CHAT - LS STUDIO")
        .setDescription(
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Cung cấp các gói API Key tốc độ cao, dùng tốt cho Cursor, Cline, Roo Code, VS Code, Bot Discord và Web App:\n\n" +
          "• **1. API Key Claude 100M Token (Hạn Dùng 3 Ngày):**\n" +
          "  - **Giá bán:** `109.000 VNĐ` • `~$4.25 USD`\n" +
          "  - **Hạn mức:** 100 Triệu Token Claude Fable 5, Opus 5 & Sonnet 5 siêu thông minh.\n" +
          "  - Tốc độ phản hồi cực nhanh, không lo bị nghẽn rate limit.\n\n" +
          "• **2. API Key OpenAI Codex 100M Token (Hạn Dùng 3 Ngày):**\n" +
          "  - **Giá bán:** `85.000 VNĐ` • `~$3.25 USD`\n" +
          "  - **Hạn mức:** 100 Triệu Token GPT-5.6 Sol chuyên sâu code và xử lý thuật toán.\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "High-speed AI API Keys for Coding, Cursor, Cline, Bot Development & Automation:\n\n" +
          "• **1. Claude API Key 100M Tokens (3 Days Validity):**\n" +
          "  - **Price:** `$4.25 USD` • `109.000 VNĐ`\n" +
          "  - 100M Tokens for Claude Fable 5, Opus 5 & Sonnet 5 models.\n\n" +
          "• **2. OpenAI Codex API Key 100M Tokens (3 Days Validity):**\n" +
          "  - **Price:** `$3.25 USD` • `85.000 VNĐ`\n" +
          "  - 100M Tokens powered by GPT-5.6 Sol for coding & programming tasks."
        )
        .setFooter({ text: "LS STUDIO • Bảo hành Key sống đúng thời hạn / Full Warranty" });

      await ch.send({ embeds: [embed], components: [makeActionButtons()] });
    });

    // 3. KÊNH #💎・tai-khoan-ai-premium
    const chAcc = await getOrCreateChannel("💎・tai-khoan-ai-premium");
    await refreshChannel(chAcc, async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#FF73FA")
        .setTitle("💎 TÀI KHOẢN AI PREMIUM CHÍNH CHỦ & GIÁ RẺ - LS STUDIO")
        .setDescription(
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Bán các loại tài khoản AI bản quyền, ổn định, hỗ trợ bảo hành tận tình:\n\n" +
          "• **1. Gói Nâng Cấp Gemini Family Chính Chủ (18 Tháng):**\n" +
          "  - **Giá bán:** `35.000 VNĐ` • `~$1.50 USD`\n" +
          "  - Nâng chính chủ Gmail 18 tháng, Gemini Advanced 2M Context + 2TB Cloud.\n\n" +
          "• **2. Tài Khoản Claude Max 20 (Gói 1 Tháng):**\n" +
          "  - **Giá bán:** `89.000 VNĐ` • `~$3.50 USD`\n" +
          "  - Hạn mức cao Max 20, truy cập đầy đủ Claude Sonnet 5, Opus 5 & Fable 5 cả tháng.\n\n" +
          "• **3. Tài Khoản ChatGPT Plus (Gói 1 Tháng):**\n" +
          "  - **Giá bán:** `169.000 VNĐ` • `~$6.80 USD`\n" +
          "  - Sử dụng full tính năng GPT-5.6 Sol, DALL-E 3 tạo ảnh, Voice Chat, Canvas 2.0.\n\n" +
          "• **4. Tài Khoản Monica AI Pro Model Claude 5 & GPT-5.6 (Gói 3 Ngày):**\n" +
          "  - **Giá bán:** `49.000 VNĐ` • `~$2.00 USD`\n" +
          "  - Truy cập đồng thời Claude 5, GPT-5.6 Sol và Gemini 2.5 Pro siêu tiện lợi.\n\n" +
          "• **5. Tài Khoản ChatGPT New Gmail (Dùng Để Nhận Offer):**\n" +
          "  - **Giá bán:** `5.000 VNĐ` • `~$0.20 USD`\n" +
          "  - ⚠️ *Lưu ý: Khách hàng cần có thẻ PayPal để tự kích hoạt gói Offer/Trial GPT-5.6.*\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "Official & Premium AI Accounts with Full Warranty Support:\n\n" +
          "• **1. Gemini Family Main Account (18 Months):** `35.000 VNĐ` • `~$1.50 USD`\n" +
          "• **2. Claude Max 20 Account (1 Month):** `89.000 VNĐ` • `~$3.50 USD`\n" +
          "• **3. ChatGPT Plus Account (1 Month):** `169.000 VNĐ` • `~$6.80 USD`\n" +
          "• **4. Monica AI Pro Account (3 Days):** `49.000 VNĐ` • `~$2.00 USD`\n" +
          "• **5. ChatGPT Fresh Gmail for Offers:** `5.000 VNĐ` • `~$0.20 USD` • *PayPal card required for offer activation.*"
        )
        .setFooter({ text: "LS STUDIO • Đổi mới ngay nếu lỗi / Instant Replacement on Issue" });

      await ch.send({ embeds: [embed], components: [makeActionButtons()] });
    });

    console.log("🎉 ĐÃ HOÀN TẤT TẠO KÊNH SHOP AI & ĐĂNG BÀI XONG 100%!");
    await cleanupAndExit(0);
  } catch (err) {
    console.error("❌ Lỗi:", err.message || err);
    await cleanupAndExit(1);
  }
});

if (!TOKEN || TOKEN === 'YOUR_BOT_TOKEN_HERE' || TOKEN.trim() === '') {
  console.error('❌ Lỗi: DISCORD_TOKEN chưa được thiết lập trong .env hoặc token.local.js!');
  process.exit(1);
}

client.login(TOKEN).catch(async (err) => {
  console.error('❌ Đăng nhập Discord thất bại:', err.message || err);
  await cleanupAndExit(1);
});
