const fs = require('fs');
const { 
  Client, 
  GatewayIntentBits, 
  PermissionsBitField, 
  ChannelType 
} = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN || (fs.existsSync('./token.local.js') ? require('./token.local.js').TOKEN : 'YOUR_BOT_TOKEN_HERE');
const LS_STUDIO_GUILD_ID = "1542476657825419334";

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('clientReady', async () => {
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
    process.exit(0);
  } catch (err) {
    console.error("❌ Lỗi:", err);
    process.exit(1);
  }
});

client.login(TOKEN);
