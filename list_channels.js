const fs = require('fs');
const { Client, GatewayIntentBits } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN || (fs.existsSync('./token.local.js') ? require('./token.local.js').TOKEN : 'YOUR_BOT_TOKEN_HERE');
const LS_STUDIO_GUILD_ID = "1542476657825419334";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', async () => {
  try {
    const guild = await client.guilds.fetch(LS_STUDIO_GUILD_ID);
    const channels = await guild.channels.fetch();

    console.log("=== DANH SÁCH DANH MỤC VÀ KÊNH ===");
    for (const [id, ch] of channels) {
      if (ch.type === 4) { // Category
        console.log(`\n📁 CATEGORY: ${ch.name} (${ch.id})`);
        const children = channels.filter(c => c.parentId === ch.id);
        for (const [cId, child] of children) {
          console.log(`   - #${child.name} (${child.id})`);
        }
      }
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
});

client.login(TOKEN);
