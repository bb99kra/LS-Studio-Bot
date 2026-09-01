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
  ButtonStyle,
  ChannelType
} = require('discord.js');

const tokenLocalPath = path.join(__dirname, 'token.local.js');
const localConfig = fs.existsSync(tokenLocalPath) ? require(tokenLocalPath) : {};
const TOKEN = process.env.DISCORD_TOKEN || localConfig.TOKEN || localConfig.DISCORD_TOKEN || '';
const NGUYEN_SMP_GUILD_ID = "1462028925046620265";

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
  console.log(`🤖 Logged in as ${client.user.tag}! Re-decorating Nguyen SMP...`);

  try {
    const guild = await client.guilds.fetch(NGUYEN_SMP_GUILD_ID).catch(err => {
      console.error(`❌ [ERROR] Không thể fetch Guild (${NGUYEN_SMP_GUILD_ID}):`, err.message || err);
      return null;
    });
    if (!guild) {
      console.error(`❌ [ERROR] Không tìm thấy Guild (${NGUYEN_SMP_GUILD_ID}) hoặc Bot chưa tham gia.`);
      return await cleanupAndExit(1);
    }
    const channels = await guild.channels.fetch();

    console.log(`🏰 Transforming ${guild.name}...`);

    // 1. CẬP NHẬT TÊN VÀ PHÂN LOẠI CATEGORIES
    const catInfo = channels.get("1503038475866476694");
    if (catInfo) {
      await catInfo.setName("📌 ━━━ THÔNG TIN SMP ━━━").catch(console.error);
      await sleep(350);
    }

    const catCommunity = channels.get("1462028925944336587");
    if (catCommunity) {
      await catCommunity.setName("💬 ━━━ SẢNH SINH TỒN ━━━").catch(console.error);
      await sleep(350);
    }

    const catLogs = channels.get("1504408794451673158");
    if (catLogs) {
      await catLogs.setName("📊 ━━━ HỆ THỐNG & LOGS ━━━").catch(console.error);
      await sleep(350);
    }

    const catVoice = channels.get("1462028925944336590");
    if (catVoice) {
      await catVoice.setName("🔊 ━━━ KÊNH ĐÀM THOẠI ━━━").catch(console.error);
      await sleep(350);
    }

    // Tạo thêm Category Cửa Hàng & Hỗ Trợ nếu chưa có
    let catShop = channels.find(c => c && c.type === ChannelType.GuildCategory && c.name.includes("CỬA HÀNG"));
    if (!catShop) {
      catShop = await guild.channels.create({
        name: "🛒 ━━━ CỬA HÀNG & HỖ TRỢ ━━━",
        type: ChannelType.GuildCategory
      });
      await sleep(350);
    }

    // 2. CHUẨN HÓA TÊN KÊNH
    const renameMap = {
      "1462037958906478673": "📢・thông-báo-smp",
      "1462038175772971174": "📜・luật-máy-chủ",
      "1506965111745679420": "🤝・hợp-tác-đối-tác",
      "1510238533795713194": "🎁・sự-kiện-event",
      "1504407345587814491": "💬・trò-chuyện-chung",
      "1504407413195800648": "📸・ảnh-và-clip-mc",
      "1535608476745863238": "💡・góp-ý-máy-chủ",
      "1462610707530125423": "❓・hỏi-đáp-tân-thủ",
      "1515061672316895394": "🤖・lệnh-bot-game",
      "1465707346650202122": "🔥・chat-tự-do-toxic",
      "1536021323766042754": "💸・cửa-hàng-donate",
      "1498374824752451886": "🎟️・mở-ticket-hỗ-trợ",
      "1504409191643877536": "🌿・server-logs",
      "1506962482923831366": "🖥️・console-trạng-thái",
      "1462028925944336591": "🔊・Sảnh Chờ Sinh Tồn",
      "1465706489510367326": "🎮・Voice Chơi Game 1",
      "1465706621534470347": "🎮・Voice Chơi Game 2",
      "1465707066961166490": "🎮・Voice Chơi Game 3",
      "1465706552265805884": "🎧・Nghe Nhạc & Treo Voice",
      "1462028925944336592": "💤・Phòng Treo AFK"
    };

    for (const [chId, newName] of Object.entries(renameMap)) {
      const ch = channels.get(chId);
      if (ch) {
        try {
          await ch.setName(newName);
          console.log(`   + Renamed: ${newName}`);
        } catch (e) {
          console.warn(`   ! Error renaming ${chId}: ${e.message}`);
        }
        await sleep(350);
      }
    }

    // Di chuyển kênh shop và ticket vào Category Shop
    const chSell = channels.get("1536021323766042754");
    if (chSell && catShop) {
      await chSell.setParent(catShop.id).catch(() => {});
      await sleep(350);
    }

    const chTicket = channels.get("1498374824752451886");
    if (chTicket && catShop) {
      await chTicket.setParent(catShop.id).catch(() => {});
      await sleep(350);
    }

    // Kiểm tra kênh IP kết nối nếu chưa có thì tạo
    let chIp = channels.find(c => c && (c.name.includes("ip-kết-nối") || c.name.includes("ip-server")));
    if (!chIp && catInfo) {
      chIp = await guild.channels.create({
        name: "🌐・ip-kết-nối-game",
        type: ChannelType.GuildText,
        parent: catInfo.id,
        topic: "Thông tin IP kết nối và cổng vào máy chủ Nguyen SMP"
      });
      await sleep(350);
    }

    console.log("📝 Đang đăng các Embeds thiết kế mới siêu đẹp...");

    // 1. EMBED LUẬT MÁY CHỦ
    const chRules = channels.get("1462038175772971174");
    if (chRules) {
      const embedRules = new EmbedBuilder()
        .setColor("#FF3D00")
        .setTitle("📜 NỘI QUY MÁY CHỦ - NGUYEN SMP")
        .setDescription(
          "Chào mừng bạn gia nhập đại gia đình **Nguyen SMP**! Hãy cùng nhau xây dựng một cộng đồng sinh tồn văn minh, vui vẻ và bền vững bằng cách tuân thủ các quy định dưới đây:"
        )
        .addFields(
          {
            name: "1️⃣ Chống Gian Lận & Hack/Cheat",
            value: "• **Nghiêm cấm 100%** sử dụng các bản Hack Client (Meteor, LiquidBounce, Aristois...), Freecam, X-Ray, Auto-Mine, Fly, Speed.\n• Máy chủ được trang bị hệ thống **Anti-Cheat độc quyền bởi LS STUDIO** — Vi phạm sẽ bị Ban tự động vĩnh viễn!"
          },
          {
            name: "2️⃣ Quy Định Sinh Tồn & PvP",
            value: "• Tôn trọng công trình của người chơi khác. Không cố tình phá hoại (Grief) vô cớ.\n• Muốn PvP / War phân định thắng thua hãy hẹn nhau tại khu vực Arena hoặc thoả thuận trước."
          },
          {
            name: "3️⃣ Văn Hóa Ứng Xử & Giao Tiếp",
            value: "• Hòa đồng, lịch sự, tôn trọng các thành viên và Admin.\n• Không spam chat, chửi bới xúc phạm gia đình, không gửi link độc hại/scam.\n• Muốn 'var' nhau hãy lên voice hoặc vào game solo công bằng!"
          },
          {
            name: "4️⃣ Kinh Tế & Giao Dịch",
            value: "• Admin không can thiệp vào thị trường tự do. Member tự do trade, đấu giá và trao đổi item với nhau."
          }
        )
        .setFooter({ text: "Nguyen SMP • Sân Chơi Sinh Tồn Đỉnh Cao", iconURL: guild.iconURL() })
        .setTimestamp();

      await chRules.send({ embeds: [embedRules] });
      await sleep(350);
    }

    // 2. EMBED IP KẾT NỐI
    if (chIp) {
      const embedIp = new EmbedBuilder()
        .setColor("#00E5FF")
        .setTitle("🌐 THÔNG TIN KẾT NỐI - NGUYEN SMP")
        .setDescription(
          "🎮 **Máy chủ Minecraft Survival SMP 1.21+** chính thức mở cửa chào đón tất cả anh em game thủ!\n\n" +
          "🕹️ **ĐỊA CHỈ KẾT NỐI MÁY CHỦ:**\n" +
          "• **IP Server:** `fusion.pikamc.vn:26111`\n" +
          "• **Phiên bản:** `1.20.x - 1.21.x` (PC Java Edition)\n" +
          "• **Tình trạng:** `ONLINE 24/7` - Mượt mà không lag!\n\n" +
          "🛡️ **BẢO MẬT & CÔNG NGHỆ:**\n" +
          "Được vận hành trên nền tảng Paper/Purpur và bảo vệ 24/7 bởi hệ thống **Anti-Cheat LS STUDIO**!"
        )
        .addFields(
          { name: "💬 Kênh Chat Giao Lưu", value: `<#1504407345587814491>`, inline: true },
          { name: "🎟️ Báo Lỗi / Hỗ Trợ", value: `<#1498374824752451886>`, inline: true }
        )
        .setFooter({ text: "Chúc anh em chơi game vui vẻ tại Nguyen SMP!" });

      await chIp.send({ embeds: [embedIp] });
      await sleep(350);
    }

    // 3. EMBED DONATE & CỬA HÀNG
    if (chSell) {
      const embedDonate = new EmbedBuilder()
        .setColor("#FFD600")
        .setTitle("💸 CỬA HÀNG DONATE & ỦNG HỘ MÁY CHỦ")
        .setDescription(
          "Mọi khoản đóng góp của bạn đều được dùng 100% vào việc **chi trả tiền thuê máy chủ, nâng cấp RAM/CPU và duy trì hệ thống Anti-Cheat** cho Nguyen SMP hoạt động lâu dài!\n\n" +
          "🌟 **QUYỀN LỢI KHI DONATE:**\n" +
          "• Nhận Role **VIP / Sponsor** nổi bật trong Discord & trong Game.\n" +
          "• Danh hiệu (Tag) độc quyền, hiệu ứng hạt thời trang (Cosmetics) không gây mất cân bằng game.\n\n" +
          "💳 **THÔNG TIN DONATE:**\n" +
          "• **Ngân Hàng:** MBBank\n" +
          "• **STK:** `844515133333`\n" +
          "• **Chủ TK:** `VAN HUU PHAM NGUYEN`\n" +
          "• **Nội dung:** `SMP <Tên Ingame>`"
        )
        .setFooter({ text: "Cảm ơn tất cả anh em đã luôn đồng hành cùng Nguyen SMP!" });

      await chSell.send({ embeds: [embedDonate] });
      await sleep(350);
    }

    // 4. EMBED TICKET HỖ TRỢ
    if (chTicket) {
      const embedTicket = new EmbedBuilder()
        .setColor("#3D5AFE")
        .setTitle("🎟️ TRUNG TÂM HỖ TRỢ NGƯỜI CHƠI - NGUYEN SMP")
        .setDescription(
          "Gặp lỗi kẹt tài khoản? Bị mất đồ do lỗi hệ thống? Hoặc muốn tố cáo người chơi gian lận hack/cheat?\n\n" +
          "👉 Hãy nhắn trực tiếp yêu cầu hoặc mở ticket tại đây để Admin hỗ trợ xử lý ngay nhé!"
        );

      await chTicket.send({ embeds: [embedTicket] });
      await sleep(350);
    }

    console.log("🎉 RE-DECOR NGUYEN SMP HOÀN TẤT 100%!");
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
