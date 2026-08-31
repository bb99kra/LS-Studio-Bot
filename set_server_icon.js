const fs = require('fs');
const { Client, GatewayIntentBits } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN || (fs.existsSync('./token.local.js') ? require('./token.local.js').TOKEN : 'YOUR_BOT_TOKEN_HERE');
const LS_STUDIO_GUILD_ID = "1542476657825419334";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', async () => {
  try {
    const guild = await client.guilds.fetch(LS_STUDIO_GUILD_ID);
    const imgBuf = fs.readFileSync('/sdcard/Download/discord_logo_dark_1024.png');
    const base64Icon = `data:image/png;base64,${imgBuf.toString('base64')}`;

    await guild.setIcon(base64Icon, "Cập nhật Logo LS STUDIO chính thức");
    console.log(`✅ Đã tự động cập nhật Avatar/Logo cho Server Discord ${guild.name}!`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Không thể cập nhật server icon:", err.message);
    process.exit(1);
  }
});

client.login(TOKEN);
