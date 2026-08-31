const fs = require('fs');
const { 
  Client,
  Events, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN || (fs.existsSync('./token.local.js') ? require('./token.local.js').TOKEN : 'YOUR_BOT_TOKEN_HERE');

const NGUYEN_SMP_GUILD_ID = "1462028925046620265";
const LS_STUDIO_GUILD_ID = "1542476657825419334";

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

process.on('unhandledRejection', async (reason) => {
  clearTimeout(watchdog);
  console.error('❌ Lỗi không kiểm soát (Unhandled Rejection):', reason);
  try {
    await client.destroy();
  } catch {}
  process.exit(1);
});


client.once(Events.ClientReady, async () => {
  console.log(`🤖 Logged in as ${client.user.tag}! Decorating partner systems on both servers...`);

  try {
    // 1. POST EMBED ĐỐI TÁC TRÊN SERVER NGUYEN SMP
    const nguyenGuild = await client.guilds.fetch(NGUYEN_SMP_GUILD_ID);
    const nguyenChannels = await nguyenGuild.channels.fetch();
    const partnerChannel = nguyenChannels.find(c => c && c.name.includes("hợᴘ・táᴄ") || c.name.includes("hop-tac") || c.name.includes("partner"));

    if (partnerChannel) {
      const partnerEmbed = new EmbedBuilder()
        .setColor("#FF3D00")
        .setTitle("🛡️ ĐỐI TÁC CÔNG NGHỆ & BẢO MẬT ĐỘC QUYỀN: LS STUDIO")
        .setDescription(
          "🌟 **THÔNG BÁO HỢP TÁC CHIẾN LƯỢC TRONG HỆ SINH THÁI** 🌟\n\n" +
          "Chào toàn thể các cư dân của **Nguyen SMP**! Để mang đến một sân chơi **công bằng, mượt mà và an toàn 100%**, chúng tôi trân trọng giới thiệu **LS STUDIO** — Đơn vị bảo trợ công nghệ và cung cấp giải pháp Anti-Cheat độc quyền cho máy chủ của chúng ta!\n\n" +
          "🔥 **HỆ THỐNG BẢO VỆ TẠI NGUYEN SMP BỞI LS STUDIO:**\n" +
          "• 🚫 **LS-AntiClient:** Tự động phát hiện và chặn đứng 100% các bản Hacked Client (*Meteor, LiquidBounce, Aristois, Wurst...*)\n" +
          "• 👁️ **LS-AntiFreeCam & Anti-ESP:** Khắc chế hoàn toàn hack soi rương, soi quặng X-Ray và Baritone đào tự động.\n" +
          "• ⚡ **LS-AntiCrash & Packet Shield:** Giữ vững **20.0 TPS** mượt mà, chống mọi hình thức phá hoại server.\n\n" +
          "👑 **BẠN LÀ CHỦ SERVER MINECRAFT & MUỐN SỞ HỮU PLUGIN XỊN?**\n" +
          "Hãy ghé thăm **LS STUDIO** để mua Plugin Anti hoặc đặt code Plugin riêng theo yêu cầu với ưu đãi độc quyền!"
        )
        .addFields(
          { name: "👑 Founder / Lead Dev", value: "Nguyendzvn", inline: true },
          { name: "⚡ Nền Tảng Hỗ Trợ", value: "Paper / Purpur / Folia", inline: true },
          { name: "💎 Discord Chính Thức", value: "https://discord.gg/2r2DdYcxPE", inline: false }
        )
        .setFooter({ text: "Nguyen SMP x LS STUDIO • Đồng Hành Cùng Phát Triển", iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

      const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('🛒 Ghé Thăm Discord LS STUDIO')
          .setStyle(ButtonStyle.Link)
          .setURL('https://discord.gg/2r2DdYcxPE'),
        new ButtonBuilder()
          .setLabel('🛡️ Xem Hệ Sinh Thái Anti-Cheat')
          .setStyle(ButtonStyle.Link)
          .setURL('https://discord.gg/2r2DdYcxPE')
      );

      await partnerChannel.send({ embeds: [partnerEmbed], components: [btnRow] });
      console.log("✅ Đã đăng Embed đối tác LS STUDIO lên Nguyen SMP!");
    }

    // 2. CẬP NHẬT KÊNH DEMO & ĐỐI TÁC TRÊN SERVER LS STUDIO
    const lsGuild = await client.guilds.fetch(LS_STUDIO_GUILD_ID);
    const lsChannels = await lsGuild.channels.fetch();
    const demoChannel = lsChannels.find(c => c && c.name.includes("server-test-demo"));

    if (demoChannel) {
      // Xóa tin nhắn cũ của bot
      const oldMsgs = await demoChannel.messages.fetch({ limit: 10 });
      for (const [id, msg] of oldMsgs) {
        if (msg.author.id === client.user.id) await msg.delete().catch(() => {});
      }

      const demoEmbed = new EmbedBuilder()
        .setColor("#9C27B0")
        .setTitle("🌐 MÁY CHỦ THỰC CHIẾN & ĐỐI TÁC CHIẾN LƯỢC: NGUYEN SMP")
        .setDescription(
          "Bạn muốn kiểm chứng độ mượt mà và hiệu quả bắt hack thực tế của các Plugin LS Studio trong một máy chủ đang hoạt động đông người?\n\n" +
          "🎮 **MÁY CHỦ ĐỐI TÁC: NGUYEN SMP (Survival MultiPlayer)**\n" +
          "• **Địa chỉ IP Server:** `fusion.pikamc.vn:26111`\n" +
          "• **Phiên bản:** `1.21+` (PC Java Edition)\n" +
          "• **Tình trạng:** Đang vận hành chính thức 24/7 với hệ thống Anti-Cheat & Packet Shield độc quyền của LS Studio.\n\n" +
          "⚔️ **Trải nghiệm thực tế:**\n" +
          "Vào chơi sinh tồn, trải nghiệm PvP cực mượt không lag và tận mắt thấy hệ thống Anti ngăn chặn triệt để Freecam / X-Ray / Hack Client!"
        )
        .addFields(
          { name: "🔗 Tham Gia Discord Nguyen SMP", value: "https://discord.gg/vjFkC6cRdj" }
        )
        .setFooter({ text: "LS STUDIO • Giải Pháp Plugin & Bảo Mật Thực Chiến" })
        .setTimestamp();

      const btnSmp = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('🎮 Tham Gia Discord Nguyen SMP')
          .setStyle(ButtonStyle.Link)
          .setURL('https://discord.gg/vjFkC6cRdj')
      );

      await demoChannel.send({ embeds: [demoEmbed], components: [btnSmp] });
      console.log("✅ Đã cập nhật Embed đối tác Nguyen SMP lên LS STUDIO!");
    }

    console.log("🎉 DECOR HOÀN TẤT TRÊN CẢ 2 SERVER!");
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
