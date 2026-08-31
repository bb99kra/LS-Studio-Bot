const fs = require('fs');
const { 
  Client,
  Events, 
  GatewayIntentBits, 
  PermissionsBitField, 
  ChannelType 
} = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN || (fs.existsSync('./token.local.js') ? require('./token.local.js').TOKEN : 'YOUR_BOT_TOKEN_HERE');
const LS_STUDIO_GUILD_ID = "1542476657825419334";

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
  console.log(`🤖 Logged in as ${client.user.tag}! Creating welcome and goodbye channels...`);

  try {
    const guild = await client.guilds.fetch(LS_STUDIO_GUILD_ID);
    const channels = await guild.channels.fetch();

    const catInfo = channels.find(c => c && c.type === ChannelType.GuildCategory && c.name.includes("THÔNG TIN"));

    // Check or create chào-mừng
    let chWelcome = channels.find(c => c && c.name.includes("chào-mừng") || c.name.includes("welcome"));
    if (!chWelcome) {
      chWelcome = await guild.channels.create({
        name: "👋・chào-mừng",
        type: ChannelType.GuildText,
        parent: catInfo ? catInfo.id : null,
        position: 0,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
            deny: [PermissionsBitField.Flags.SendMessages]
          }
        ]
      });
      console.log(`✅ Created ${chWelcome.name}`);
    }

    // Check or create tạm-biệt
    let chGoodbye = channels.find(c => c && c.name.includes("tạm-biệt") || c.name.includes("goodbye"));
    if (!chGoodbye) {
      chGoodbye = await guild.channels.create({
        name: "🚪・tạm-biệt",
        type: ChannelType.GuildText,
        parent: catInfo ? catInfo.id : null,
        position: 1,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
            deny: [PermissionsBitField.Flags.SendMessages]
          }
        ]
      });
      console.log(`✅ Created ${chGoodbye.name}`);
    }

    console.log("🎉 Xong kênh chào mừng và tạm biệt!");
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
