const fs = require('fs');
const { Client,
  Events, GatewayIntentBits, ChannelType } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN || (fs.existsSync('./token.local.js') ? require('./token.local.js').TOKEN : 'YOUR_BOT_TOKEN_HERE');
const NGUYEN_SMP_GUILD_ID = "1462028925046620265";

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
    const guild = await client.guilds.fetch(NGUYEN_SMP_GUILD_ID);
  console.log(`🏰 Inspecting ${guild.name}...`);

  const channels = await guild.channels.fetch();
  const sorted = Array.from(channels.values())
    .filter(Boolean)
    .sort((a, b) => (a.position || 0) - (b.position || 0));

  for (const c of sorted) {
    const parentName = c.parent ? c.parent.name : "NO CATEGORY";
    console.log(`[${c.type}] ${c.name} (Parent: ${parentName}, ID: ${c.id})`);
  }

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
