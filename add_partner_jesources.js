const fs = require('fs');
const { 
  Client, 
  GatewayIntentBits, 
  ChannelType, 
  PermissionsBitField, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN || (fs.existsSync('./token.local.js') ? require('./token.local.js').TOKEN : 'YOUR_BOT_TOKEN_HERE');

const LS_STUDIO_GUILD_ID = "1542476657825419334";
const NGUYEN_SMP_GUILD_ID = "1462028925046620265";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.once('clientReady', async () => {
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

    // 2. CHỈ ĐĂNG TRÊN LS STUDIO
    console.log("🎉 ĐÃ HOÀN TẤT THÊM PARTNER JESOURCES TRÊN LS STUDIO 100%!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Lỗi:", err);
    process.exit(1);
  }
});

client.login(TOKEN);
