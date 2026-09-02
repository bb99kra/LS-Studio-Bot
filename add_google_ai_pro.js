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
  console.log(`🤖 Logged in as ${client.user.tag}! Đang thêm kênh Google AI Pro...`);

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

    const catAI = channels.find(c => c && c.type === ChannelType.GuildCategory && c.name.includes("DỊCH VỤ AI"));

    // 1. TẠO KÊNH #🚀・acc-google-ai-pro
    let chGoogle = channels.find(c => c && c.name === "🚀・acc-google-ai-pro");
    if (!chGoogle) {
      chGoogle = await guild.channels.create({
        name: "🚀・acc-google-ai-pro",
        type: ChannelType.GuildText,
        parent: catAI ? catAI.id : null,
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
      console.log("✅ Đã tạo kênh: #🚀・acc-google-ai-pro");
    }

    // Xóa tin nhắn cũ
    const msgs = await chGoogle.messages.fetch({ limit: 10 });
    for (const [mId, msg] of msgs) {
      if (msg.author.id === client.user.id) {
        await msg.delete().catch(() => {});
        await sleep(250);
      }
    }

    const embed = new EmbedBuilder()
      .setColor("#4285F4")
      .setTitle("🚀 TÀI KHOẢN GOOGLE AI PRO • GEMINI ADVANCED 2TB (1 THÁNG)")
      .setDescription(
        "🇻🇳 **TIẾNG VIỆT:**\n" +
        "Gói tài khoản Google AI Pro (Google One AI Premium) bản quyền chính hãng với sức mạnh từ mô hình Gemini Advanced mới nhất của Google:\n\n" +
        "• **Giá bán:** `79.000 VNĐ` • `~$3.00 USD`\n" +
        "• **Thời hạn:** 30 Ngày\n\n" +
        "🌟 **Đặc quyền & Tính năng cao cấp:**\n" +
        "• **Mô hình Gemini Advanced:** Truy cập model Gemini Pro thế hệ mới với bộ nhớ ngữ cảnh cực khủng lên đến **2 Triệu Token** (đọc hiểu toàn bộ sách, video dài, kho dữ liệu lớn).\n" +
        "• **Kèm 2TB Dung lượng Google One Cloud:** Lưu trữ hình ảnh, video chất lượng gốc và tài liệu thoải mái trên Google Drive, Gmail, Google Photos.\n" +
        "• **Tích hợp sâu Google Workspace:** Hỗ trợ viết văn bản tự động trong Google Docs, tạo bảng tính Sheets và tóm tắt Email trong Gmail.\n" +
        "• **Tạo ảnh Imagen 3:** Sinh ảnh nghệ thuật độ phân giải siêu nét từ câu lệnh.\n" +
        "• Bảo hành trọn gói 1 đổi 1 suốt 30 ngày.\n\n" +
        "────────────────────────────────────────\n" +
        "🇺🇸 **ENGLISH:**\n" +
        "Official Google AI Pro Account (Google One AI Premium) with 2TB Cloud Storage:\n\n" +
        "• **Price:** `79.000 VNĐ` • `~$3.00 USD`\n" +
        "• **Duration:** 30 Days\n\n" +
        "🌟 **Premium Features:**\n" +
        "• **Gemini Advanced Access:** 2 Million token context window for large codebase & document analysis.\n" +
        "• **2TB Google One Storage:** Secure cloud backup for Google Drive, Photos, and Gmail.\n" +
        "• **Deep Workspace Integration:** AI writing assistant in Docs, Gmail, Sheets, and Slides.\n" +
        "• **Imagen 3 Generator:** Ultra-high definition photorealistic AI image generation.\n" +
        "• 30-Day Full Replacement Warranty."
      )
      .setFooter({ text: "LS STUDIO • Bảo hành 1 đổi 1 trọn 30 ngày / 30-Day Warranty" });

    const buyBtn = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_buy")
        .setLabel("🛒 Mở Ticket Đặt Mua / Buy Ticket")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("ticket_pricing")
        .setLabel("💰 Bảng Giá / Price List")
        .setStyle(ButtonStyle.Secondary)
    );

    await chGoogle.send({ embeds: [embed], components: [buyBtn] });
    console.log("✅ Đã đăng bài vào: #🚀・acc-google-ai-pro");

    // 2. CẬP NHẬT KÊNH #💰・bảng-giá
    const chPrice = channels.find(c => c && c.name.includes("bảng-giá"));
    if (chPrice) {
      const pMsgs = await chPrice.messages.fetch({ limit: 10 });
      for (const [mId, msg] of pMsgs) {
        if (msg.author.id === client.user.id) {
          await msg.delete().catch(() => {});
          await sleep(250);
        }
      }

      const priceEmbed = new EmbedBuilder()
        .setColor("#FEE75C")
        .setTitle("💰 BẢNG GIÁ DỊCH VỤ / PRICE LIST - LS STUDIO")
        .setDescription(
          "Bảng giá công khai minh bạch cho toàn bộ Plugin Minecraft, Mod Java & Dịch vụ AI:\n" +
          "*Transparent pricing for Minecraft Plugins, Mods & AI Premium Services:*"
        )
        .addFields(
          {
            name: "📦 1. Plugin Minecraft (Paper / Purpur / Folia 1.16 - 1.21+)",
            value: 
              "• 🛡️ **LS-AntiCheat (Bản Gốc):** `30.000 VNĐ` • `~$1.50 USD`\n" +
              "• 🛒 **Addon Anti-Macro Cart:** `20.000 VNĐ / Tháng` • `~$1.00 USD / Mo`\n" +
              "• 🎁 **LS-GiftCode:** `30.000 VNĐ` • `~$1.50 USD`\n" +
              "• 👁️ **LS-AntiFreeCam:** `59.000 VNĐ` • `~$2.50 USD`\n" +
              "• 🚫 **LS-AntiClient:** `99.000 VNĐ` • `~$4.00 USD`\n" +
              "• 👑 **Combo 2 Plugin Anti:** `129.000 VNĐ` • `~$5.50 USD`\n" +
              "• 🧩 **Lập Trình Mod Java & Plugin Riêng:** Thỏa thuận theo yêu cầu"
          },
          {
            name: "🔑 2. API Key AI (Cursor / Cline / Coding / Bot Discord)",
            value: 
              "• ⚡ **API Key Claude 100M Token (3 Ngày):** `4.25$` (~`109.000 VNĐ`)\n" +
              "• 💻 **API Key Codex 100M Token (3 Ngày):** `3.25$` (~`85.000 VNĐ`)"
          },
          {
            name: "💎 3. Tài Khoản AI Premium & Cloud Storage",
            value: 
              "• 🚀 **Acc Google AI Pro 2TB (1 Tháng):** `79.000 VNĐ` • `~$3.00 USD`\n" +
              "• 👑 **Acc Claude Max 20 (1 Tháng):** `89.000 VNĐ` • `~$3.50 USD`\n" +
              "• ⭐ **Acc ChatGPT Plus (1 Tháng):** `169.000 VNĐ` • `~$6.80 USD`\n" +
              "• ✨ **Acc Monica AI Pro Model Claude (3 Ngày):** `49.000 VNĐ` • `~$2.00 USD`\n" +
              "• 🎁 **Acc ChatGPT New Gmail (Nhận Offer):** `5.000 VNĐ` • `~$0.20 USD` *(Cần thẻ PayPal)*"
          },
          {
            name: "💳 4. Thanh Toán / Payment Methods",
            value: 
              "• 🇻🇳 **Việt Nam:** MBBank Quân Đội • STK `844515133333` • Tên **VAN HUU PHAM NGUYEN**\n" +
              "• 🌐 **Global:** PayPal / Crypto / Card (Mở Ticket để lấy link thanh toán)"
          }
        )
        .setFooter({ text: "Giao dịch an toàn 24/7 qua Ticket tại LS STUDIO" });

      await chPrice.send({ embeds: [priceEmbed], components: [buyBtn] });
      console.log("✅ Đã cập nhật lại kênh #bảng-giá!");
    }

    // 3. CẬP NHẬT KÊNH #📢・thông-báo
    const chTb = channels.find(c => c && c.name.includes("thông-báo"));
    if (chTb) {
      const tbMsgs = await chTb.messages.fetch({ limit: 10 });
      for (const [mId, msg] of tbMsgs) {
        if (msg.author.id === client.user.id) {
          await msg.delete().catch(() => {});
          await sleep(250);
        }
      }

      const chAc = channels.find(c => c && c.name === "🛡️・ls-anticheat");
      const chFc = channels.find(c => c && c.name === "👁️・ls-antifreecam");
      const chClient = channels.find(c => c && c.name === "🚫・ls-anticlient");
      const chGc = channels.find(c => c && c.name === "🎁・ls-giftcode");
      const chCombo = channels.find(c => c && c.name === "👑・combo-anti");
      const chMod = channels.find(c => c && c.name === "🧩・mod-custom-java");

      const chClaudeApi = channels.find(c => c && c.name === "⚡・api-claude-100m");
      const chCodexApi = channels.find(c => c && c.name === "💻・api-codex-100m");
      const chGoogleAcc = chGoogle;
      const chClaudeAcc = channels.find(c => c && c.name === "👑・acc-claude-max20");
      const chGptPlus = channels.find(c => c && c.name === "⭐・acc-chatgpt-plus");
      const chMonica = channels.find(c => c && c.name === "✨・acc-monica-pro");
      const chGptOffer = channels.find(c => c && c.name === "🎁・acc-chatgpt-offer");

      const chBuy = channels.find(c => c && c.name.includes("mua-plugin"));

      const tbEmbed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("🚀 CHÀO MỪNG ĐẾN VỚI LS STUDIO / WELCOME TO LS STUDIO")
        .setDescription(
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Chào anh em! **LS STUDIO** chuyên cung cấp các giải pháp **Plugin Minecraft, Anti-Cheat, Mod Custom Java** và **Dịch Vụ AI / API Key Premium** chính hãng với giá tốt nhất!\n\n" +
          "📦 **DANH MỤC PLUGIN MINECRAFT:**\n" +
          `• 🛡️ AntiCheat & Addon Cart: <#${chAc?.id}>\n` +
          `• 👁️ Chống Freecam & X-Ray: <#${chFc?.id}>\n` +
          `• 🚫 Chặn Hacked Client: <#${chClient?.id}>\n` +
          `• 🎁 Quà Tặng GiftCode: <#${chGc?.id}>\n` +
          `• 👑 Combo 2 Plugin Anti: <#${chCombo?.id}>\n` +
          `• 🧩 Lập Trình Mod Java: <#${chMod?.id}>\n\n` +
          "🤖 **DANH MỤC DỊCH VỤ AI & API KEY:**\n" +
          `• 🚀 Acc Google AI Pro 2TB: <#${chGoogleAcc?.id}>\n` +
          `• ⚡ API Key Claude 100M: <#${chClaudeApi?.id}>\n` +
          `• 💻 API Key Codex 100M: <#${chCodexApi?.id}>\n` +
          `• 👑 Acc Claude Max 20: <#${chClaudeAcc?.id}>\n` +
          `• ⭐ Acc ChatGPT Plus: <#${chGptPlus?.id}>\n` +
          `• ✨ Acc Monica AI Pro: <#${chMonica?.id}>\n` +
          `• 🎁 Acc Gmail Nhận Offer: <#${chGptOffer?.id}>\n\n` +
          `💰 Bảng Giá Tổng Hợp: <#${chPrice?.id}>\n` +
          `🛒 Mở Ticket Đặt Hàng: <#${chBuy?.id}>`
        )
        .setFooter({ text: "LS STUDIO • Lead Developer: Nguyendzvn" });

      await chTb.send({ embeds: [tbEmbed] });
      console.log("✅ Đã cập nhật lại kênh #thông-báo!");
    }

    console.log("🎉 ĐÃ HOÀN TẤT THÊM GOOGLE AI PRO XONG 100%!");
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
