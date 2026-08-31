const path = require('path');
const fs = require('fs');
const { Client, Events, GatewayIntentBits } = require('discord.js');

const tokenLocalPath = path.join(__dirname, 'token.local.js');
const TOKEN = process.env.DISCORD_TOKEN || (fs.existsSync(tokenLocalPath) ? require(tokenLocalPath).TOKEN : 'YOUR_BOT_TOKEN_HERE');
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
  try {
    const guild = await client.guilds.fetch(LS_STUDIO_GUILD_ID);
    const candidatePaths = [
      '/sdcard/Download/discord_logo_dark_1024.png',
      path.join(__dirname, 'output', 'discord_logo_dark_1024.png'),
      path.join(__dirname, 'output', 'ls_studio_logo_bg_1024.png'),
      path.join(__dirname, 'discord_logo_dark_1024.png'),
      path.join(__dirname, 'ls_studio_logo_bg_1024.png')
    ];
    const iconPath = candidatePaths.find(p => fs.existsSync(p));
    if (!iconPath) {
      throw new Error(`Không tìm thấy file icon tại các đường dẫn: ${candidatePaths.join(', ')}`);
    }
    const imgBuf = fs.readFileSync(iconPath);
    const base64Icon = `data:image/png;base64,${imgBuf.toString('base64')}`;

    await guild.setIcon(base64Icon, "Cập nhật Logo LS STUDIO chính thức");
    clearTimeout(watchdog);
    console.log(`✅ Đã tự động cập nhật Avatar/Logo cho Server Discord ${guild.name}!`);
    try {
      await client.destroy();
    } catch {}
    process.exit(0);
  } catch (err) {
    clearTimeout(watchdog);
    console.error("❌ Không thể cập nhật server icon:", err.message || err);
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
