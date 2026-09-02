const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { 
  Client, 
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
const TOKEN = process.env.DISCORD_TOKEN || localConfig.TOKEN || '';
const LS_STUDIO_GUILD_ID = "1542476657825419334";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

client.once('ready', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}! Bắt đầu thêm gói Acc Discord Veri Mail + SĐT...`);

  try {
    const guild = await client.guilds.fetch(LS_STUDIO_GUILD_ID);
    const channels = await guild.channels.fetch();

    // 1. TÌM CATEGORY: 🎁 ━━━ NITRO & GIẢI TRÍ ━━━
    let catEntertainment = channels.find(c => c && c.type === ChannelType.GuildCategory && (c.name.includes("NITRO") || c.name.includes("GIẢI TRÍ")));
    if (!catEntertainment) {
      catEntertainment = await guild.channels.create({
        name: "🎁 ━━━ NITRO & GIẢI TRÍ ━━━",
        type: ChannelType.GuildCategory
      });
    }

    // 2. TẠO KÊNH: #💬・acc-discord-ver-mail-sdt
    const channelName = "💬・acc-discord-ver-mail-sdt";
    let ch = channels.find(c => c && c.name === channelName);
    if (!ch) {
      ch = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: catEntertainment.id,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
            deny: [PermissionsBitField.Flags.SendMessages]
          }
        ]
      });
      console.log(`✅ Đã tạo kênh mới: #${channelName}`);
    } else {
      if (ch.parentId !== catEntertainment.id) {
        await ch.setParent(catEntertainment.id).catch(() => {});
      }
    }

    // Xóa tin cũ của bot trong kênh nếu có
    const msgs = await ch.messages.fetch({ limit: 10 }).catch(() => new Map());
    for (const [id, msg] of msgs) {
      if (msg.author.id === client.user.id) {
        await msg.delete().catch(() => {});
        await sleep(200);
      }
    }

    // Đăng Embed chi tiết gói Discord Veri
    const embedDiscord = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle("💬 TÀI KHOẢN DISCORD VERIFIED FULL (EMAIL + SĐT) • 7.000 VNĐ")
      .setDescription(
        "🇻🇳 **TIẾNG VIỆT:**\n" +
        "Cung cấp tài khoản Discord clone chất lượng cao, đã xác minh đầy đủ cả **Email** và **Số Điện Thoại (Phone Number)**:\n\n" +
        "• **Giá bán:** `7.000 VNĐ` • `~$0.30 USD` / 1 Tài Khoản\n" +
        "• **Thông tin định dạng bàn giao:** `Email:Password:Token` (Kèm Cookie / Mail Pass nếu có)\n" +
        "• **Ưu điểm & Tính năng vượt trội:**\n" +
        "  - ✅ **Đã xác thực Email 100%:** Nhận mã và khôi phục an toàn.\n" +
        "  - 📱 **Đã xác thực Số Điện Thoại (SĐT) sạch:** Vượt qua mọi cổng bảo vệ (Verification Gate / Phone Required) của các server khắt khe nhất.\n" +
        "  - 🛡️ **Bao trâu & Hạn chế Checkpoint:** Acc được nuôi trên IP sạch, độ ổn định cực cao.\n" +
        "  - ⚡ **Sử dụng đa mục đích:** Dùng làm acc phụ, seeding server, thử nghiệm bot, chạy tool hoặc dùng lâu dài.\n" +
        "• **Chính sách bảo hành:** Bảo hành 1 đổi 1 nếu lỗi sai mật khẩu hoặc bị checkpoint trong lần đăng nhập đầu tiên.\n\n" +
        "────────────────────────────────────────\n" +
        "🇺🇸 **ENGLISH:**\n" +
        "**Full Verified Discord Account (Email + Phone Verified):**\n" +
        "• **Price:** `7.000 VNĐ` • `~$0.30 USD` per account\n" +
        "• Delivered Format: `Email:Password:Token`\n" +
        "• 100% Verified with clean Email & Real Phone Number.\n" +
        "• Easily bypasses server phone verification gates.\n" +
        "• Instant 1-to-1 replacement for first-login issues."
      )
      .setFooter({ text: "LS STUDIO • Giao dịch tự động an toàn qua Ticket" })
      .setTimestamp();

    await ch.send({ embeds: [embedDiscord], components: [makeActionButtons()] });
    console.log(`✅ Đã đăng bài vào kênh #${channelName}`);

    // 3. CẬP NHẬT KÊNH #💰・bảng-giá
    const chPrice = channels.find(c => c && c.name.includes("bảng-giá"));
    if (chPrice) {
      const pMsgs = await chPrice.messages.fetch({ limit: 10 }).catch(() => new Map());
      for (const [id, msg] of pMsgs) {
        if (msg.author.id === client.user.id) {
          await msg.delete().catch(() => {});
          await sleep(200);
        }
      }

      const priceEmbed = new EmbedBuilder()
        .setColor("#FEE75C")
        .setTitle("💰 BẢNG GIÁ DỊCH VỤ / PRICE LIST - LS STUDIO")
        .setDescription(
          "Bảng giá niêm yết chính thức cho toàn bộ Plugin Minecraft, Dịch Vụ AI & Giải Trí Premium:\n" +
          "*Official transparent pricing for Minecraft Plugins, AI Services & Premium Entertainment:*"
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
            name: "🎁 4. Dịch Vụ Nitro & Giải Trí (Mới Ra Mắt / New Releases)",
            value: 
              "• 💬 **Acc Discord Veri Mail + SĐT (Full Xác Minh):** `7.000 VNĐ` • `~$0.30 USD`\n" +
              "• 🚀 **Gói 2 Boost Server Discord Nitro (1 Tháng):** `20.000 VNĐ` • `~$0.80 USD`\n" +
              "• 📺 **Tài Khoản YouTube Premium (1 Tháng):** `25.000 VNĐ` • `~$1.00 USD`\n" +
              "• 🍿 **Tài Khoản Netflix Premium Ultra HD 4K (1 Tuần):** `20.000 VNĐ` • `~$0.80 USD`"
          },
          {
            name: "💳 5. Phương Thức Thanh Toán / Payment Methods",
            value: 
              "• 🇻🇳 **Việt Nam:** MBBank Quân Đội • STK `844515133333` • Tên **VAN HUU PHAM NGUYEN**\n" +
              "• 🌐 **Global:** PayPal / Crypto / Card (Mở Ticket để lấy link thanh toán)"
          }
        )
        .setFooter({ text: "Giao dịch an toàn 24/7 qua Ticket tại LS STUDIO" });

      await chPrice.send({ embeds: [priceEmbed], components: [makeActionButtons()] });
      console.log("✅ Đã cập nhật lại kênh #bảng-giá với gói Acc Discord Veri 7k!");
    }

    console.log("🎉 HOÀN TẤT THÊM GÓI ACC DISCORD VERI MAIL + SĐT 100%!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Lỗi:", err);
    process.exit(1);
  }
});

client.login(TOKEN);
