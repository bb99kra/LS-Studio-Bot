const fs = require('fs');
const { Client,
  Events, GatewayIntentBits, ChannelType } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN || (fs.existsSync('./token.local.js') ? require('./token.local.js').TOKEN : 'YOUR_BOT_TOKEN_HERE');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
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
  try {
    console.log(`🤖 Logged in as ${client.user.tag}`);

  for (const [guildId, guild] of client.guilds.cache) {
    console.log(`🏰 Server: ${guild.name} (${guild.id})`);
    try {
      const channels = await guild.channels.fetch();
      const textCh = channels.find(c => c && c.type === ChannelType.GuildText);
      if (textCh) {
        const invite = await textCh.createInvite({ maxAge: 0, maxUses: 0, reason: "Cross-partner link" });
        console.log(`   🔗 Permanent Invite: ${invite.url}`);
      }
    } catch (e) {
      console.warn(`   ! Cannot create invite: ${e.message}`);
    }
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
