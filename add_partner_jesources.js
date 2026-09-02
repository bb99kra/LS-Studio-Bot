const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { 
  Client, 
  Events,
  GatewayIntentBits, 
  ChannelType, 
  PermissionsBitField, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} = require('discord.js');

const tokenLocalPath = path.join(__dirname, 'token.local.js');
const localConfig = fs.existsSync(tokenLocalPath) ? require(tokenLocalPath) : {};
const TOKEN = process.env.DISCORD_TOKEN || localConfig.TOKEN || localConfig.DISCORD_TOKEN || '';

const LS_STUDIO_GUILD_ID = process.env.GUILD_ID || localConfig.GUILD_ID || "1542476657825419334";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
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

let isExiting = false;
async function cleanupAndExit(code = 0) {
  if (isExiting) return;
  isExiting = true;
  clearTimeout(watchdog);
  try {
    await client.destroy();
  } catch {}
  process.exit(code);
}

process.on('SIGINT', async () => {
  console.log('🛑 [SIGINT] Đang dừng tiến trình...');
  await cleanupAndExit(0);
});
process.on('SIGTERM', async () => {
  console.log('🛑 [SIGTERM] Đang dừng tiến trình...');
  await cleanupAndExit(0);
});
process.on('SIGHUP', async () => {
  console.log('🛑 [SIGHUP] Đang dừng tiến trình...');
  await cleanupAndExit(0);
});

process.on('unhandledRejection', async (reason) => {
  console.error('❌ Lỗi không kiểm soát (Unhandled Rejection):', reason);
  await cleanupAndExit(1);
});

process.on('uncaughtException', async (err) => {
  console.error('❌ Lỗi ngoại lệ chưa bắt (Uncaught Exception):', err);
  await cleanupAndExit(1);
});

client.once(Events.ClientReady, async () => {
  console.log(`🤖 Logged in as ${client.user.tag}! Đang thêm đối tác JESOURCES...`);

  try {
    const makeJesourcesEmbed = () => {
      return new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("🤝 ĐỐI TÁC CHÍNH THỨC: JESOURCES")
        .setDescription(
          "🎉 **LS STUDIO TRÂN TRỌNG GIỚI THIỆU ĐỐI TÁC HỢP TÁC CHIẾN LƯỢC** 🎉\n\n" +
          "👑 **Đại Diện / Founder:** <@1422862826174681160>\n" +
          "🔗 **Link Tham Gia:** https://discord.gg/936aQH5j8D\n\n" +
          "📖 **GIỚI THIỆU VỀ JESOURCES:**\n" +
          "• 📚 **Cộng đồng:** Chia sẻ kiến thức, kinh nghiệm và tài nguyên hữu ích.\n" +
          "• 🎮 **Hoạt động chủ yếu:** Sân chơi gắn kết giữa **Minecraft** và **Discord**.\n" +
          "• 💡 **Môi trường:** Trao đổi - Hỗ trợ - Học hỏi - Kết nối cùng tất cả các thành viên.\n\n" +
          "🎯 **ĐỊNH HƯỚNG PHÁT TRIỂN:**\n" +
          "✨ **Hòa Đồng • Yên Bình • Sạch Sẽ • Gắn Kết!**\n\n" +
          "> *JESOURCES là một cộng đồng được xây dựng lên nhằm để mọi người giao lưu, chia sẻ và phát triển trong một môi trường văn minh, thân thiện và tích cực nhất.*"
        )
        .addFields(
          { name: "👑 Founder", value: "<@1422862826174681160>", inline: true },
          { name: "🌐 Chủ Đề", value: "Minecraft & Discord", inline: true },
          { name: "🔗 Discord", value: "https://discord.gg/936aQH5j8D", inline: false }
        )
        .setFooter({ text: "LS STUDIO x JESOURCES • Đồng Hành & Cùng Phát Triển", iconURL: client.user.displayAvatarURL() })
        .setTimestamp();
    };

    const makeJesourcesButtons = () => {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('🚀 Tham Gia Discord JESOURCES')
          .setStyle(ButtonStyle.Link)
          .setURL('https://discord.gg/936aQH5j8D'),
        new ButtonBuilder()
          .setLabel('💎 Ghé Thăm LS STUDIO')
          .setStyle(ButtonStyle.Link)
          .setURL('https://discord.gg/2r2DdYcxPE')
      );
    };

    // 1. CẬP NHẬT / TẠO KÊNH TRÊN LS STUDIO
    const lsGuild = await client.guilds.fetch(LS_STUDIO_GUILD_ID);
    const lsChannels = await lsGuild.channels.fetch();

    let chPartnerLS = lsChannels.find(c => c && (c.name.includes("đối-tác") || c.name.includes("doi-tac") || c.name.includes("partner") || c.name.includes("hợp-tác")));

    if (!chPartnerLS) {
      const catInfo = lsChannels.find(c => c && c.type === ChannelType.GuildCategory && c.name.includes("THÔNG TIN"));
      chPartnerLS = await lsGuild.channels.create({
        name: "🤝・đối-tác-partner",
        type: ChannelType.GuildText,
        parent: catInfo ? catInfo.id : null,
        permissionOverwrites: [
          {
            id: lsGuild.roles.everyone.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
            deny: [PermissionsBitField.Flags.SendMessages]
          }
        ]
      });
      console.log("✅ Đã tạo kênh mới trên LS STUDIO: #🤝・đối-tác-partner");
    }

    // Gửi tin nhắn Partner lên LS STUDIO
    await chPartnerLS.send({ 
      content: "📢 **THÔNG BÁO ĐỐI TÁC MỚI / NEW PARTNER ANNOUNCEMENT** • <@1422862826174681160>",
      embeds: [makeJesourcesEmbed()], 
      components: [makeJesourcesButtons()] 
    });
    console.log("✅ Đã đăng thông báo Partner JESOURCES lên LS STUDIO!");

    console.log("🎉 ĐÃ HOÀN TẤT THÊM PARTNER JESOURCES TRÊN LS STUDIO 100%!");
    await cleanupAndExit(0);
  } catch (err) {
    console.error("❌ Lỗi:", err.message || err);
    await cleanupAndExit(1);
  }
});

if (!TOKEN || TOKEN === 'YOUR_BOT_TOKEN_HERE' || TOKEN.trim() === '') {
  console.error('❌ Lỗi: DISCORD_TOKEN chưa được thiết lập trong .env hoặc token.local.js!');
  process.exit(1);
}

client.login(TOKEN).catch(async (err) => {
  console.error("❌ [ERROR] Lỗi đăng nhập Discord:", err.message || err);
  await cleanupAndExit(1);
});
