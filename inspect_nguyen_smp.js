const fs = require('fs');
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN || (fs.existsSync('./token.local.js') ? require('./token.local.js').TOKEN : 'YOUR_BOT_TOKEN_HERE');
const NGUYEN_SMP_GUILD_ID = "1462028925046620265";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', async () => {
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

  process.exit(0);
});

client.login(TOKEN);
