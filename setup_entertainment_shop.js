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
  console.log(`🤖 Logged in as ${client.user.tag}! Bắt đầu thêm các gói Nitro, YouTube, Netflix...`);

  try {
    const guild = await client.guilds.fetch(LS_STUDIO_GUILD_ID);
    const channels = await guild.channels.fetch();

    // 1. TÌM HOẶC TẠO CATEGORY: 🎁 ━━━ NITRO & GIẢI TRÍ ━━━
    let catEntertainment = channels.find(c => c && c.type === ChannelType.GuildCategory && (c.name.includes("NITRO") || c.name.includes("GIẢI TRÍ")));
    if (!catEntertainment) {
      catEntertainment = await guild.channels.create({
        name: "🎁 ━━━ NITRO & GIẢI TRÍ ━━━",
        type: ChannelType.GuildCategory
      });
      console.log("✅ Đã tạo Category mới: 🎁 ━━━ NITRO & GIẢI TRÍ ━━━");
    }

    // Helper: Tạo kênh sản phẩm an toàn và đăng embed
    async function setupProductChannel(channelName, embedData) {
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

      await ch.send({ embeds: [embedData], components: [makeActionButtons()] });
      console.log(`✅ Đã đăng bài vào kênh #${channelName}`);
      return ch;
    }

    // A. KÊNH 1: 🚀・boost-nitro-server
    const embedNitro = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle("🚀 DỊCH VỤ 2 BOOST SERVER DISCORD NITRO • 20.000 VNĐ")
      .setDescription(
        "🇻🇳 **TIẾNG VIỆT:**\n" +
        "Nâng cấp máy chủ Discord của bạn lên tầm cao mới với gói **2 Boost Server Nitro** giá rẻ nhất thị trường:\n\n" +
        "• **Giá bán:** `20.000 VNĐ` • `~$0.80 USD` (Gói 2 Boost)\n" +
        "• **Thời hạn:** 1 Tháng (30 Ngày) duy trì ổn định 100%.\n" +
        "• **Quyền lợi mở khóa khi Server đạt Level 1:**\n" +
        "  - 🌟 **Mở khóa Avatar Động (Animated GIF Icon)** cho máy chủ.\n" +
        "  - 🎨 **Mở khóa Banner Lời Mời (Invite Splash)** và tùy chỉnh thẩm mỹ.\n" +
        "  - 🎙️ Nâng cao chất lượng âm thanh Voice lên **128 Kbps** trong trẻo.\n" +
        "  - 📹 Chất lượng Live Stream / Chia sẻ màn hình **720p 60FPS** siêu mượt.\n" +
        "  - 😃 Tăng thêm **50 ô Custom Emoji** và **24 ô Sticker** độc quyền.\n" +
        "• **Bảo hành:** Bảo hành trọn gói 30 ngày, 1 đổi 1 nếu tụt boost.\n\n" +
        "────────────────────────────────────────\n" +
        "🇺🇸 **ENGLISH:**\n" +
        "**2 Discord Server Boosts Package (1 Month):**\n" +
        "• **Price:** `20.000 VNĐ` • `~$0.80 USD`\n" +
        "• Unlocks Level 1 perks: Animated Server Icon, Invite Splash, 128 Kbps Audio, 720p 60fps Stream & +50 Custom Emojis.\n" +
        "• Full 30-day warranty with instant 1-to-1 replacement."
      )
      .setFooter({ text: "LS STUDIO • Giao dịch tự động an toàn qua Ticket" })
      .setTimestamp();

    await setupProductChannel("🚀・boost-nitro-server", embedNitro);

    // B. KÊNH 2: 📺・youtube-premium
    const embedYoutube = new EmbedBuilder()
      .setColor("#FF0000")
      .setTitle("📺 TÀI KHOẢN YOUTUBE PREMIUM CHÍNH HÃNG • 25.000 VNĐ / THÁNG")
      .setDescription(
        "🇻🇳 **TIẾNG VIỆT:**\n" +
        "Trải nghiệm xem video đỉnh cao không lo quảng cáo phiền toái với **YouTube Premium 1 Tháng**:\n\n" +
        "• **Giá bán:** `25.000 VNĐ` • `~$1.00 USD`\n" +
        "• **Thời hạn:** 1 Tháng (30 Ngày).\n" +
        "• **Quyền lợi & Tính năng vượt trội:**\n" +
        "  - 🚫 **Chặn 100% quảng cáo:** Xem liền mạch mọi video trên điện thoại, TV, máy tính.\n" +
        "  - 📱 **Phát trong nền (Background Play):** Vừa nghe podcast/nhạc vừa lướt web hoặc tắt màn hình điện thoại.\n" +
        "  - 📥 **Tải ngoại tuyến (Offline Download):** Tải video chất lượng Full HD / 4K xem không cần mạng.\n" +
        "  - 🎵 **Kèm YouTube Music Premium:** Nghe hàng triệu bài hát bản quyền chất lượng âm thanh 320kbps.\n" +
        "• **Bảo hành:** Bảo hành 1 đổi 1 trọn vẹn 30 ngày sử dụng.\n\n" +
        "────────────────────────────────────────\n" +
        "🇺🇸 **ENGLISH:**\n" +
        "**YouTube Premium Official Account (1 Month):**\n" +
        "• **Price:** `25.000 VNĐ` • `~$1.00 USD`\n" +
        "• 100% Ad-free streaming, Background play, Offline downloads & YouTube Music Premium.\n" +
        "• Full 30-day warranty with 24/7 ticket support."
      )
      .setFooter({ text: "LS STUDIO • Giao dịch tự động an toàn qua Ticket" })
      .setTimestamp();

    await setupProductChannel("📺・youtube-premium", embedYoutube);

    // C. KÊNH 3: 🍿・netflix-premium
    const embedNetflix = new EmbedBuilder()
      .setColor("#E50914")
      .setTitle("🍿 TÀI KHOẢN NETFLIX PREMIUM ULTRA HD 4K • 20.000 VNĐ / TUẦN")
      .setDescription(
        "🇻🇳 **TIẾNG VIỆT:**\n" +
        "Thưởng thức kho phim chiếu rạp và series đình đám thế giới với **Netflix Premium 1 Tuần**:\n\n" +
        "• **Giá bán:** `20.000 VNĐ` • `~$0.80 USD` (Gói 1 Tuần)\n" +
        "• **Thời hạn:** 1 Tuần (7 Ngày) dùng thả ga.\n" +
        "• **Quyền lợi & Tính năng đỉnh cao:**\n" +
        "  - 🎬 **Chất lượng Ultra HD 4K + HDR:** Hình ảnh sắc nét, âm thanh vòm Dolby Atmos sống động.\n" +
        "  - 📺 **Đa nền tảng:** Đăng nhập mượt mà trên Smart TV, Điện thoại (iOS/Android), Laptop, PC.\n" +
        "  - 🌐 **Vietsub chuẩn:** Đầy đủ phụ đề Tiếng Việt và thuyết minh chất lượng cao.\n" +
        "  - 🔒 **Profile riêng tư:** Có mã PIN bảo mật, lưu lịch sử xem phim cá nhân riêng biệt.\n" +
        "• **Bảo hành:** Bảo hành 1 đổi 1 trọn 7 ngày nếu tài khoản gặp sự cố.\n\n" +
        "────────────────────────────────────────\n" +
        "🇺🇸 **ENGLISH:**\n" +
        "**Netflix Premium Ultra HD 4K Account (1 Week):**\n" +
        "• **Price:** `20.000 VNĐ` • `~$0.80 USD`\n" +
        "• Ultra HD 4K + HDR, Dolby Atmos audio, Multi-device support (TV, Mobile, PC).\n" +
        "• Full 7-day warranty with dedicated private profile."
      )
      .setFooter({ text: "LS STUDIO • Giao dịch tự động an toàn qua Ticket" })
      .setTimestamp();

    await setupProductChannel("🍿・netflix-premium", embedNetflix);

    // 2. CẬP NHẬT KÊNH #💰・bảng-giá
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
      console.log("✅ Đã cập nhật lại kênh #bảng-giá với đầy đủ Nitro, YouTube & Netflix!");
    }

    console.log("🎉 HOÀN TẤT THIẾT LẬP CỬA HÀNG NITRO & GIẢI TRÍ 100%!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Lỗi:", err);
    process.exit(1);
  }
});

client.login(TOKEN);
