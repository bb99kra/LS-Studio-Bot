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
  console.log(`🤖 Logged in as ${client.user.tag}! Bắt đầu thiết lập gian hàng CapCut Pro...`);

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

    // 2. TẠO KÊNH: #🎬・capcut-pro-chính-hãng
    const channelName = "🎬・capcut-pro-chính-hãng";
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

    // Xóa tin nhắn cũ của bot
    const msgs = await ch.messages.fetch({ limit: 10 }).catch(() => new Map());
    for (const [id, msg] of msgs) {
      if (msg.author.id === client.user.id) {
        await msg.delete().catch(() => {});
        await sleep(200);
      }
    }

    // Đăng Embed chi tiết các gói CapCut Pro
    const embedCapcut = new EmbedBuilder()
      .setColor("#00F0FF")
      .setTitle("🎬 TÀI KHOẢN CAPCUT PRO CHÍNH HÃNG • CÁ NHÂN & GÓI TEAM 2TB CLOUD")
      .setDescription(
        "🇻🇳 **TIẾNG VIỆT:**\n" +
        "Biến mọi video của bạn trở nên chuyên nghiệp, bắt trend TikTok/YouTube với **CapCut Pro bản quyền**:\n\n" +
        "📋 **BẢNG GIÁ CÁC GÓI CAPCUT PRO:**\n" +
        "• ⚡ **Gói Cá Nhân (3 Ngày):** `14.000 VNĐ` • `~$0.60 USD` *(Trải nghiệm làm video ngắn)*\n" +
        "• 🌟 **Gói Cá Nhân (14 Ngày):** `39.000 VNĐ` • `~$1.60 USD`\n" +
        "• 🔥 **Gói Cá Nhân (1 Tháng):** `75.000 VNĐ` • `~$3.00 USD` *(Gói phổ biến nhất)*\n" +
        "• 💎 **Gói Cá Nhân (3 Tháng):** `200.000 VNĐ` • `~$8.00 USD` *(Tiết kiệm 25k)*\n" +
        "• 👑 **Gói Cá Nhân (6 Tháng):** `390.000 VNĐ` • `~$15.50 USD` *(Siêu tiết kiệm 60k)*\n" +
        "• 👥 **Gói Team 1 Tháng (Kèm 2TB Cloud):** `100.000 VNĐ` • `~$4.00 USD`\n\n" +
        "✨ **ĐẶC QUYỀN KHI NÂNG CẤP CAPCUT PRO:**\n" +
        "  - 🚫 **Xóa sạch 100% Watermark (Logo CapCut)** ở cuối video.\n" +
        "  - 🎥 **Xuất video chất lượng cao:** Hỗ trợ 2K, 4K sắc nét 60 FPS không giảm chất lượng.\n" +
        "  - 🪄 **Công cụ AI thông minh:** Tự động tạo phụ đề (Auto Captions), xóa phông nền (Cutout), làm nét khuôn mặt, tăng tốc AI chuyển động.\n" +
        "  - 🎨 **Kho hiệu ứng VIP đồ sộ:** Hàng triệu bộ lọc, chuyển cảnh, sticker và âm thanh bản quyền độc quyền dành riêng cho Pro.\n" +
        "  - 💻 **Đa nền tảng:** Sử dụng đồng thời trên Windows, macOS, iPhone/iPad, Android.\n" +
        "  - ☁️ **Gói Team 2TB:** Cực khủng cho nhóm làm video, dựng phim lưu trữ project thoải mái.\n" +
        "• **Chính sách bảo hành:** Bảo hành 1 đổi 1 trọn thời gian sử dụng cam kết.\n\n" +
        "────────────────────────────────────────\n" +
        "🇺🇸 **ENGLISH:**\n" +
        "**Official CapCut Pro Accounts & Team 2TB Cloud Upgrades:**\n" +
        "• **Personal (3 Days):** `14.000 VNĐ` • `~$0.60 USD`\n" +
        "• **Personal (14 Days):** `39.000 VNĐ` • `~$1.60 USD`\n" +
        "• **Personal (1 Month):** `75.000 VNĐ` • `~$3.00 USD`\n" +
        "• **Personal (3 Months):** `200.000 VNĐ` • `~$8.00 USD`\n" +
        "• **Personal (6 Months):** `390.000 VNĐ` • `~$15.50 USD`\n" +
        "• **Team Pack (1 Month + 2TB Cloud):** `100.000 VNĐ` • `~$4.00 USD`\n" +
        "• Full Pro features unlocked: No watermark, 4K 60fps export, VIP filters, AI captions, PC & Mobile support with 1-to-1 warranty."
      )
      .setFooter({ text: "LS STUDIO • Giao dịch tự động an toàn qua Ticket" })
      .setTimestamp();

    await ch.send({ embeds: [embedCapcut], components: [makeActionButtons()] });
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
              "• ✨ **Acc Monica AI Pro Model Claude (3 Ngày):** `49.000 VNĐ` • `~$2.00 USD`"
          },
          {
            name: "🎁 4. Dịch Vụ Nitro, Giải Trí & CapCut Pro",
            value: 
              "• 🎬 **CapCut Pro Cá Nhân (3 Ngày):** `14.000 VNĐ` • `~$0.60 USD`\n" +
              "• 🎬 **CapCut Pro Cá Nhân (14 Ngày):** `39.000 VNĐ` • `~$1.60 USD`\n" +
              "• 🎬 **CapCut Pro Cá Nhân (1 Tháng):** `75.000 VNĐ` • `~$3.00 USD`\n" +
              "• 🎬 **CapCut Pro Cá Nhân (3 Tháng):** `200.000 VNĐ` • `~$8.00 USD`\n" +
              "• 🎬 **CapCut Pro Cá Nhân (6 Tháng):** `390.000 VNĐ` • `~$15.50 USD`\n" +
              "• 👥 **CapCut Pro Gói Team 2TB Cloud (1 Tháng):** `100.000 VNĐ` • `~$4.00 USD`\n" +
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
      console.log("✅ Đã cập nhật lại kênh #bảng-giá với đầy đủ 6 gói CapCut Pro!");
    }

    console.log("🎉 HOÀN TẤT THIẾT LẬP GIAN HÀNG CAPCUT PRO 100%!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Lỗi:", err);
    process.exit(1);
  }
});

client.login(TOKEN);
