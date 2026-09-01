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
  console.log(`🤖 Logged in as ${client.user.tag}! Bắt đầu chia từng kênh riêng biệt không dùng ngoặc đơn...`);

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

    const catStore = channels.get("1542479126697476196");

    // Xóa kênh gộp cũ nếu có
    const oldGenericCh = channels.get("1542479128534716438");
    if (oldGenericCh) {
      await oldGenericCh.delete().catch(() => {});
      console.log("🗑️ Đã xóa kênh gộp cũ #sản-phẩm-plugin");
    }

    // Danh sách các kênh sản phẩm cần có
    const productChannelsConfig = [
      {
        name: "🛡️・ls-anticheat",
        title: "🛡️ LS-ANTICHEAT",
        price: "30.000 VNĐ",
        color: "#5865F2",
        pkgKey: "ls_anticheat",
        desc: 
          "Giải pháp chống gian lận đa năng, tối ưu nhẹ mượt cho mọi lối chơi Survival, Factions, Towny, Skyblock.\n\n" +
          "• **Giá bán:** 30.000 VNĐ\n" +
          "• **Nền tảng hỗ trợ:** Paper, Purpur, Folia 1.16 đến 1.21+\n\n" +
          "⚔️ **TÍNH NĂNG CHI TIẾT:**\n" +
          "• **Chống WallHit & Raytrace:** Chặn đứng Killaura đánh xuyên tường, xuyên block chắn, đặc biệt chặn triệt để hack đánh xuyên **Mạng Nhện Cobweb**, cửa và kính.\n" +
          "• **Chống gian lận PvP:** Chặn tự động ăn thức ăn siêu tốc, chặn auto câu cá AFK, chặn auto ném và uống potion tức thì khi tụt máu.\n" +
          "• **Chống macro khiên:** Chặn vừa giơ khiên vừa chém, vừa che khiên vừa chạy nước rút, chặn click bật tắt khiên 0ms.\n" +
          "• **Kiểm tra kho đồ:** Chặn vừa mở hòm đồ vừa đi lại, chém nhau hoặc lia chuột. Tóm gọn AutoClicker bằng thuật toán phân tích độ lệch chuẩn.\n" +
          "• **Bắt BadPacket:** Phát hiện đánh không vung tay NoSwing, Killaura Forcefield, Aimbot khóa góc nhìn máy móc.\n" +
          "• **Fake Info chống soi đồ:** Giả lập máu ảo làm sai lệch mod hiển thị máu, giấu bùa phù phép và độ bền giáp thật."
      },
      {
        name: "👁️・ls-antifreecam",
        title: "👁️ LS-ANTIFREECAM & OBFUSCATOR",
        price: "59.000 VNĐ",
        color: "#00E5FF",
        pkgKey: "anti_freecam",
        desc: 
          "Khắc chế hoàn toàn Freecam Mod, Baritone đào tự động, Chest ESP và X-Ray.\n\n" +
          "• **Giá bán:** 59.000 VNĐ\n" +
          "• **Nền tảng hỗ trợ:** Paper, Purpur, Folia 1.16 đến 1.21+\n\n" +
          "💎 **TÍNH NĂNG CHI TIẾT:**\n" +
          "• **Ẩn Rương & Block quý:** Ẩn toàn bộ quặng quý, rương đồ, Shulker Box khi nằm ngoài tầm nhìn thực tế của người chơi.\n" +
          "• **Chống Baritone & Bot đào:** Khiến Baritone và bot tự động đào hầm không thể định vị được vị trí quặng kim cương hay rương ngầm.\n" +
          "• **Xử lý bất đồng bộ:** Tối ưu hóa triệt để, không gây tụt TPS ngay cả khi server có hàng trăm người online cùng lúc."
      },
      {
        name: "🚫・ls-anticlient",
        title: "🚫 LS-ANTICLIENT & BRANDSHIELD",
        price: "99.000 VNĐ",
        color: "#ED4245",
        pkgKey: "anti_client",
        desc: 
          "Hệ thống nhận diện và chặn đứng các Hacked Client phổ biến ngay từ cổng vào.\n\n" +
          "• **Giá bán:** 99.000 VNĐ\n" +
          "• **Nền tảng hỗ trợ:** Paper, Purpur, Folia 1.16 đến 1.21+\n\n" +
          "🛡️ **TÍNH NĂNG CHI TIẾT:**\n" +
          "• **Chặn Client Hack:** Tự động phân tích Client Brand và Packet để chặn Meteor, LiquidBounce, Aristois, Wurst, Fabric Cheats.\n" +
          "• **Chống giả mạo:** Ngăn chặn các bản mod đổi tên brand giả danh Vanilla để vượt rào.\n" +
          "• **Hành động linh hoạt:** Tự động Kick, Cảnh báo Staff hoặc ghi log vi phạm rõ ràng."
      },
      {
        name: "🎁・ls-giftcode",
        title: "🎁 LS-GIFTCODE & REWARDS",
        price: "30.000 VNĐ",
        color: "#FEE75C",
        pkgKey: "ls_giftcode",
        desc: 
          "Hệ thống tạo mã code quà tặng chuyên nghiệp dành cho Server Minecraft.\n\n" +
          "• **Giá bán:** 30.000 VNĐ\n" +
          "• **Nền tảng hỗ trợ:** Paper, Purpur, Folia 1.16 đến 1.21+\n\n" +
          "📦 **TÍNH NĂNG CHI TIẾT:**\n" +
          "• **Tạo mã linh hoạt:** Tạo Giftcode tân thủ, code sự kiện, code đền bù bảo trì không giới hạn.\n" +
          "• **Giới hạn & Hạn dùng:** Đặt số lượt nhập cho từng người chơi hoặc toàn server, hẹn giờ hết hạn code tự động.\n" +
          "• **Phần thưởng phong phú:** Tự phát Item có lore và enchant, tiền Vault, chạy lệnh Console tự động.\n" +
          "• **Lưu trữ nhẹ nhàng:** Hỗ trợ MySQL và SQLite lưu trữ async cực nhẹ."
      },
      {
        name: "👑・combo-anti",
        title: "👑 COMBO TRỌN BỘ 2 PLUGIN ANTI",
        price: "129.000 VNĐ",
        color: "#FF73FA",
        pkgKey: "combo_suite",
        desc: 
          "Sở hữu trọn bộ 2 giải pháp bảo vệ cốt lõi cho server với giá ưu đãi tiết kiệm nhất.\n\n" +
          "• **Giá Combo:** 129.000 VNĐ • Tiết kiệm 29.000 VNĐ so với mua lẻ\n" +
          "• **Nền tảng hỗ trợ:** Paper, Purpur, Folia 1.16 đến 1.21+\n\n" +
          "🌟 **BAO GỒM:**\n" +
          "1. **LS-AntiFreeCam & Obfuscator:** Chống soi rương, soi quặng, khắc chế Baritone đào tự động.\n" +
          "2. **LS-AntiClient & BrandShield:** Nhận diện và chặn đứng hack client Meteor, LiquidBounce, Aristois..."
      },
      {
        name: "🧩・mod-custom-java",
        title: "🧩 DỊCH VỤ LẬP TRÌNH MOD CUSTOM CHO MINECRAFT JAVA",
        price: "Thỏa thuận theo ý tưởng",
        color: "#9C27B0",
        pkgKey: "custom_mod",
        desc: 
          "Nhận thiết kế và lập trình Mod độc quyền theo đúng tính năng bạn yêu cầu.\n\n" +
          "• **Nền tảng hỗ trợ:** Forge, Fabric, NeoForge, Quilt từ phiên bản 1.16 đến 1.21+\n" +
          "• **Phạm vi nhận làm:** Tùy theo tính năng khách hàng yêu cầu.\n" +
          "• **Lưu ý:** Chỉ nhận làm cho Minecraft Java Edition trên máy tính PC, không nhận bản Bedrock PE.\n\n" +
          "🛠️ **CÁC HẠNG MỤC PHỔ BIẾN:**\n" +
          "• Vũ khí, dụng cụ, áo giáp tùy chỉnh kèm hiệu ứng kỹ năng riêng.\n" +
          "• Khối block, cây trồng, quặng mới.\n" +
          "• Quái vật, sinh vật, Boss mới với hoạt ảnh chuyển động riêng.\n" +
          "• Giao diện Menu, kho đồ tùy biến.\n" +
          "• Mod cơ chế gameplay độc quyền cho Server hoặc Modpack."
      }
    ];

    // Tạo từng kênh và đăng bài viết
    for (const p of productChannelsConfig) {
      let ch = channels.find(c => c && c.name === p.name);
      if (!ch) {
        ch = await guild.channels.create({
          name: p.name,
          type: ChannelType.GuildText,
          parent: catStore ? catStore.id : null,
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
        console.log(`✅ Đã tạo kênh mới: #${ch.name}`);
      }

      // Xóa tin nhắn cũ của bot
      const msgs = await ch.messages.fetch({ limit: 10 });
      for (const [mId, msg] of msgs) {
      if (msg.author.id === client.user.id) {
        await msg.delete().catch(() => {});
        await sleep(250);
      }
    }

      const embed = new EmbedBuilder()
        .setColor(p.color)
        .setTitle(p.title)
        .setDescription(p.desc)
        .setFooter({ text: "LS STUDIO • Hỗ trợ nhiệt tình, bảo hành cập nhật lâu dài" });

      const buyBtn = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_buy")
          .setLabel("🛒 Mở Ticket Đặt Mua Ngay")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("ticket_pricing")
          .setLabel("💰 Xem Bảng Giá Tổng Hợp")
          .setStyle(ButtonStyle.Secondary)
      );

      await ch.send({ embeds: [embed], components: [buyBtn] });
      console.log(`   + Đã đăng bài vào: #${ch.name}`);
    }

    // Cập nhật lại Bảng Giá không có ngoặc đơn
    const pricingCh = channels.find(c => c && c.name.includes("bảng-giá"));
    if (pricingCh) {
      const msgs = await pricingCh.messages.fetch({ limit: 10 });
      for (const [mId, msg] of msgs) {
      if (msg.author.id === client.user.id) {
        await msg.delete().catch(() => {});
        await sleep(250);
      }
    }

      const priceEmbed = new EmbedBuilder()
        .setColor("#FEE75C")
        .setTitle("💰 BẢNG GIÁ DỊCH VỤ LS STUDIO")
        .setDescription("Bảng giá công khai minh bạch, hỗ trợ bảo hành và cập nhật tận tình:")
        .addFields(
          {
            name: "📦 1. Plugin Có Sẵn • Paper, Purpur, Folia 1.16 đến 1.21+",
            value: 
              "• 🛡️ **LS-AntiCheat:** `30.000 VNĐ`\n" +
              "• 🎁 **LS-GiftCode:** `30.000 VNĐ`\n" +
              "• 👁️ **LS-AntiFreeCam:** `59.000 VNĐ`\n" +
              "• 🚫 **LS-AntiClient:** `99.000 VNĐ`\n" +
              "• 👑 **Combo 2 Plugin Anti:** `129.000 VNĐ`"
          },
          {
            name: "🛠️ 2. Lập Trình Plugin Riêng Theo Yêu Cầu",
            value: 
              "• Hỗ trợ tối ưu mượt mà cho Paper, Purpur, Folia 1.16 đến 1.21+\n" +
              "• Plugin tiện ích, lệnh, giao diện: `50k - 150k`\n" +
              "• Gameplay hoặc hệ thống tính năng riêng: `200k - 500k`\n" +
              "• Dự án lớn: Thỏa thuận theo độ phức tạp"
          },
          {
            name: "🧩 3. Lập Trình Mod Custom Cho Minecraft Java",
            value: 
              "• Nền tảng: Forge, Fabric, NeoForge 1.16 đến 1.21+ Java PC\n" +
              "• Hạng mục: Tùy theo tính năng khách hàng yêu cầu\n" +
              "• Báo giá: Trao đổi ý tưởng trực tiếp trong Ticket để Dev báo giá và thời gian hoàn thành"
          },
          {
            name: "💳 4. Thông Tin Thanh Toán",
            value: 
              "• Ngân hàng: **MBBank Quân Đội**\n" +
              "• Số tài khoản: `844515133333`\n" +
              "• Tên chủ tài khoản: **VAN HUU PHAM NGUYEN**\n" +
              "• Quét mã VietQR tự động qua Ticket để nhận file ngay"
          }
        )
        .setFooter({ text: "Giao dịch an toàn qua Ticket tại LS STUDIO" });

      await pricingCh.send({ embeds: [priceEmbed] });
      console.log("✅ Đã cập nhật lại kênh #bảng-giá!");
    }

    console.log("🎉 ĐÃ HOÀN TẤT CHIA TỪNG KÊNH RIÊNG VÀ XÓA BỎ DẤU NGOẶC ĐƠN 100%!");
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
