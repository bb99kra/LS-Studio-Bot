const fs = require('fs');
const { 
  Client,
  Events, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN || (fs.existsSync('./token.local.js') ? require('./token.local.js').TOKEN : 'YOUR_BOT_TOKEN_HERE');
const LS_STUDIO_GUILD_ID = "1542476657825419334";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

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

process.on('unhandledRejection', async (reason) => {
  clearTimeout(watchdog);
  console.error('❌ Lỗi không kiểm soát (Unhandled Rejection):', reason);
  try {
    await client.destroy();
  } catch {}
  process.exit(1);
});


client.once(Events.ClientReady, async () => {
  console.log(`🤖 Logged in as ${client.user.tag}! Đang cập nhật gói Gemini Family 18 Tháng...`);

  try {
    const guild = await client.guilds.fetch(LS_STUDIO_GUILD_ID);
    const channels = await guild.channels.fetch();

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

    // 1. CẬP NHẬT KÊNH #🚀・acc-google-ai-pro
    const chGoogle = channels.find(c => c && c.name === "🚀・acc-google-ai-pro");
    if (chGoogle) {
      const msgs = await chGoogle.messages.fetch({ limit: 10 });
      for (const [mId, msg] of msgs) {
        if (msg.author.id === client.user.id) await msg.delete().catch(() => {});
      }

      const embed = new EmbedBuilder()
        .setColor("#4285F4")
        .setTitle("🚀 TÀI KHOẢN & GÓI NÂNG CẤP GOOGLE AI PRO • GEMINI FAMILY 18 THÁNG")
        .setDescription(
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Cung cấp các gói tài khoản, link kích hoạt và gói nâng cấp Google AI Pro (Gemini Advanced) chính hãng với mức giá siêu ưu đãi:\n\n" +
          "• **1. Gói Nâng Cấp Gemini Family Chính Chủ (18 Tháng):**\n" +
          "  - **Giá bán:** `35.000 VNĐ` • `~$1.50 USD`\n" +
          "  - **Hình thức:** Nâng trực tiếp trên Gmail chính chủ của bạn qua nhóm Google Family.\n" +
          "  - **Thời hạn:** 18 Tháng sử dụng Gemini Advanced + 2TB Google One Cloud dung lượng cao.\n" +
          "  - **Bảo hành:** Kích hoạt thành công 100% & hỗ trợ trọn gói suốt quá trình sử dụng.\n\n" +
          "• **2. Link Kích Hoạt Gemini Pro 18M:**\n" +
          "  - **Giá bán:** `49.000 VNĐ` • `~$2.00 USD`\n" +
          "  - Nhận link nâng cấp trực tiếp vào tài khoản Google cá nhân.\n" +
          "  - **Bảo hành:** Kích hoạt thành công lần đầu 100%.\n\n" +
          "• **3. Tài Khoản Google AI Pro Tạo Sẵn (Gói 1 Tháng):**\n" +
          "  - **Giá bán:** `89.000 VNĐ` • `~$3.50 USD`\n" +
          "  - Tài khoản tạo sẵn chính chủ, kèm Google One AI Premium và Gemini Advanced.\n" +
          "  - **Bảo hành:** Đăng nhập thành công lần đầu 100%.\n\n" +
          "🌟 **Tính năng nổi bật:**\n" +
          "• Bộ nhớ ngữ cảnh siêu khủng lên đến **2 Triệu Token** đọc hiểu codebase và tài liệu lớn.\n" +
          "• Tích hợp trực tiếp vào Google Docs, Gmail, Sheets, Slides hỗ trợ làm việc tự động.\n" +
          "• Tạo ảnh siêu thực độ phân giải cao với Imagen 3.\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "Official Google AI Pro & Gemini Family Upgrades with Full Warranty:\n\n" +
          "• **1. Gemini Family Upgrade on Main Account (18 Months):** `35.000 VNĐ` • `~$1.50 USD`\n" +
          "  - Direct 18-month upgrade on your personal Gmail with Gemini Advanced & 2TB Cloud.\n\n" +
          "• **2. Gemini Pro 18M Activation Link:** `49.000 VNĐ` • `~$2.00 USD`\n" +
          "  - Direct upgrade link for personal Google account. Guaranteed first-time activation.\n\n" +
          "• **3. Official Google AI Pro Account (1 Month):** `89.000 VNĐ` • `~$3.50 USD`\n" +
          "  - Pre-activated dedicated account with Gemini Advanced & Google One AI Premium."
        )
        .setFooter({ text: "LS STUDIO • Giao hàng tự động qua Ticket / Instant Ticket Delivery" });

      await chGoogle.send({ embeds: [embed], components: [makeActionButtons()] });
      console.log("✅ Đã cập nhật lại kênh: #🚀・acc-google-ai-pro");
    }

    // 2. CẬP NHẬT KÊNH #💰・bảng-giá
    const chPrice = channels.find(c => c && c.name.includes("bảng-giá"));
    if (chPrice) {
      const pMsgs = await chPrice.messages.fetch({ limit: 10 });
      for (const [mId, msg] of pMsgs) {
        if (msg.author.id === client.user.id) await msg.delete().catch(() => {});
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
            name: "💎 3. Tài Khoản & Link AI Premium",
            value: 
              "• 🌟 **Acc Gemini Family Nâng Chính Chủ (18 Tháng):** `35.000 VNĐ` • `~$1.50 USD`\n" +
              "• 🚀 **Link Kích Hoạt Gemini Pro 18M:** `49.000 VNĐ` • `~$2.00 USD`\n" +
              "• 🚀 **Acc Google AI Pro Chính Chủ (1 Tháng):** `89.000 VNĐ` • `~$3.50 USD`\n" +
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

      await chPrice.send({ embeds: [priceEmbed], components: [makeActionButtons()] });
      console.log("✅ Đã cập nhật lại kênh #bảng-giá!");
    }

    console.log("🎉 ĐÃ CẬP NHẬT GÓI GEMINI FAMILY 18 THÁNG XONG 100%!");
    clearTimeout(watchdog);
    try {
      await client.destroy();
    } catch {}
    process.exit(0);
  } catch (err) {
    clearTimeout(watchdog);
    console.error("❌ Lỗi:", err.message || err);
    try {
      await client.destroy();
    } catch {}
    process.exit(1);
  }
});

client.login(TOKEN).catch(async (err) => {
  clearTimeout(watchdog);
  console.error('❌ Đăng nhập Discord thất bại:', err.message || err);
  try {
    await client.destroy();
  } catch {}
  process.exit(1);
});
