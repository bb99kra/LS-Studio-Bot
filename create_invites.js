const fs = require('fs');
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN || (fs.existsSync('./token.local.js') ? require('./token.local.js').TOKEN : 'YOUR_BOT_TOKEN_HERE');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('clientReady', async () => {
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
  process.exit(0);
});

client.login(TOKEN);
