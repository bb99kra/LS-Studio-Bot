const fs = require('fs');
const { 
  Client, 
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

client.once('clientReady', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}! Cập nhật chi tiết đúng file Sakayori Store...`);

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
        .setTitle("🚀 TÀI KHOẢN & LINK GOOGLE AI PRO • GEMINI PRO")
        .setDescription(
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Cung cấp gói tài khoản và link kích hoạt Google AI Pro (Gemini Pro) bản quyền với 2 phiên bản linh hoạt:\n\n" +
          "• **1. Link Kích Hoạt Gemini Pro 18M:**\n" +
          "  - **Giá bán:** `49.000 VNĐ` • `~$2.00 USD`\n" +
          "  - Nhận link nâng cấp trực tiếp vào tài khoản Google của bạn.\n" +
          "  - **Bảo hành:** Kích hoạt thành công lần đầu 100%.\n\n" +
          "• **2. Tài Khoản Google AI Pro Chính Chủ (Gói 1 Tháng):**\n" +
          "  - **Giá bán:** `89.000 VNĐ` • `~$3.50 USD`\n" +
          "  - Tài khoản tạo sẵn chính chủ, kèm quyền lợi Google One AI Premium và Gemini Advanced.\n" +
          "  - **Bảo hành:** Đăng nhập thành công lần đầu 100%.\n\n" +
          "🌟 **Tính năng nổi bật:**\n" +
          "• Bộ nhớ ngữ cảnh khủng lên đến **2 Triệu Token** đọc hiểu file code và tài liệu cực lớn.\n" +
          "• Tích hợp trực tiếp vào Google Docs, Gmail, Sheets, Slides hỗ trợ làm việc tự động.\n" +
          "• Tạo ảnh siêu thực độ phân giải cao với Imagen 3.\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "Google AI Pro & Gemini Pro Upgrade Links with Full Activation Warranty:\n\n" +
          "• **1. Gemini Pro 18M Activation Link:** `49.000 VNĐ` • `~$2.00 USD`\n" +
          "  - Direct upgrade link for your personal Google account. Guaranteed first-time activation.\n\n" +
          "• **2. Official Google AI Pro Account (1 Month):** `89.000 VNĐ` • `~$3.50 USD`\n" +
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

    console.log("🎉 ĐÃ CẬP NHẬT XONG 100%!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Lỗi:", err);
    process.exit(1);
  }
});

client.login(TOKEN);
