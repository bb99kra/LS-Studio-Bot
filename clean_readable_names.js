const fs = require('fs');
const { Client,
  Events, GatewayIntentBits } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN || (fs.existsSync('./token.local.js') ? require('./token.local.js').TOKEN : 'YOUR_BOT_TOKEN_HERE');
const LS_STUDIO_GUILD_ID = "1542476657825419334";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

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
  console.log(`🤖 Logged in as ${client.user.tag}! Đổi tên kênh to rõ ràng, chuẩn tiếng Việt...`);

  try {
    const guild = await client.guilds.fetch(LS_STUDIO_GUILD_ID);
    const channels = await guild.channels.fetch();

    // 1. TÊN DANH MỤC TO RÕ RÀNG
    const catMap = {
      "1542479115917987952": "📌 ━━━ THÔNG TIN ━━━",
      "1542479126697476196": "🛒 ━━━ CỬA HÀNG LS ━━━",
      "1542479136789106708": "🎫 ━━━ HỖ TRỢ & MUA HÀNG ━━━",
      "1542479144384729109": "💬 ━━━ SẢNH GIAO LƯU ━━━",
      "1542479154891722782": "👑 ━━━ KHÁCH HÀNG VIP ━━━",
      "1542479160914477108": "🔒 ━━━ BAN QUẢN TRỊ ━━━",
      "1542479168628072468": "🔊 ━━━ KÊNH THOẠI ━━━"
    };

    for (const [id, name] of Object.entries(catMap)) {
      const cat = channels.get(id);
      if (cat) await cat.setName(name).catch(console.error);
    }

    // 2. TÊN KÊNH CHUẨN, TO RÕ RÀNG, KHÔNG DÙNG KÝ TỰ DỊ
    const channelMap = {
      "1542479117880922183": "📜・luật-lệ",
      "1542479120036794418": "📢・thông-báo",
      "1542479122645917769": "🚀・cập-nhật-changelog",
      "1542479124462047303": "🎁・giveaway-sự-kiện",
      "1542479128534716438": "💎・sản-phẩm-plugin",
      "1542479130900172910": "💰・bảng-giá",
      "1542479132758384650": "🌐・server-test-demo",
      "1542479134683435040": "⭐・đánh-giá-uy-tín",
      "1542479138839986227": "🛒・mua-plugin",
      "1542479140534616124": "🛠️・hỗ-trợ-kỹ-thuật",
      "1542479142845546507": "📝・đặt-làm-plugin",
      "1542479146834206761": "💬・trò-chuyện-chung",
      "1542479148340092988": "💡・góp-ý-ý-tưởng",
      "1542479150798078113": "📸・khoe-server-mc",
      "1542479152681328690": "🤖・lệnh-bot",
      "1542479157236211835": "📦・tải-plugin-updates",
      "1542479158947487781": "💬・chat-khách-hàng",
      "1542479163183730708": "📊・nhật-ký-giao-dịch",
      "1542479164886749275": "💬・nội-bộ-staff",
      "1542479170137886870": "🔊・Phòng Chờ Giao Lưu",
      "1542479172083916830": "🛠️・Hỗ Trợ 1-1",
      "1542479173749178428": "🎮・Voice Chơi Game"
    };

    for (const [id, name] of Object.entries(channelMap)) {
      const ch = channels.get(id);
      if (ch) {
        await ch.setName(name).catch(console.error);
        console.log(`   + Renamed: ${name}`);
      }
    }

    console.log("🎉 ĐÃ ĐỔI TÊN TO RÕ RÀNG XONG 100%!");
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
