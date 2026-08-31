const fs = require('fs');
const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN || (fs.existsSync('./token.local.js') ? require('./token.local.js').TOKEN : 'YOUR_BOT_TOKEN_HERE');
const LS_STUDIO_GUILD_ID = "1542476657825419334";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.once('clientReady', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}! Gỡ bỏ Wurst khỏi LS-AntiClient và cập nhật song ngữ...`);

  try {
    const guild = await client.guilds.fetch(LS_STUDIO_GUILD_ID);
    const channels = await guild.channels.fetch();

    // 1. CẬP NHẬT KÊNH #🚫・ls-anticlient
    const chClient = channels.find(c => c && c.name.includes("ls-anticlient"));
    if (chClient) {
      const msgs = await chClient.messages.fetch({ limit: 10 });
      for (const [id, msg] of msgs) {
        if (msg.author.id === client.user.id) await msg.delete().catch(() => {});
      }

      const embed = new EmbedBuilder()
        .setColor("#ED4245")
        .setTitle("🚫 LS-ANTICLIENT & BRANDSHIELD")
        .setDescription(
          "Hệ thống nhận diện và chặn đứng các Hacked Client phổ biến ngay từ cổng vào.\n\n" +
          "• **Giá bán:** 99.000 VNĐ • **Price:** ~$4 USD\n" +
          "• **Nền tảng hỗ trợ:** Paper, Purpur, Folia 1.16 đến 1.21+\n\n" +
          "🛡️ **TÍNH NĂNG CHI TIẾT / FEATURES:**\n" +
          "• **Chặn Client Hack:** Tự động phân tích Client Brand và Packet để chặn Meteor, LiquidBounce, Aristois, Fabric Cheats.\n" +
          "• **Chống giả mạo:** Ngăn chặn các bản mod đổi tên brand giả danh Vanilla để vượt rào.\n" +
          "• **Hành động linh hoạt:** Tự động Kick, Cảnh báo Staff hoặc ghi log vi phạm rõ ràng."
        )
        .setFooter({ text: "LS STUDIO • Hỗ trợ nhiệt tình, bảo hành cập nhật lâu dài" });

      const buyBtn = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_buy")
          .setLabel("🛒 Mở Ticket Đặt Mua / Buy Now")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("ticket_pricing")
          .setLabel("💰 Bảng Giá / Price List")
          .setStyle(ButtonStyle.Secondary)
      );

      await chClient.send({ embeds: [embed], components: [buyBtn] });
      console.log("✅ Đã cập nhật kênh #🚫・ls-anticlient (đã gỡ Wurst)!");
    }

    // 2. CẬP NHẬT KÊNH #👑・combo-anti
    const chCombo = channels.find(c => c && c.name.includes("combo-anti"));
    if (chCombo) {
      const msgs = await chCombo.messages.fetch({ limit: 10 });
      for (const [id, msg] of msgs) {
        if (msg.author.id === client.user.id) await msg.delete().catch(() => {});
      }

      const embed = new EmbedBuilder()
        .setColor("#FF73FA")
        .setTitle("👑 COMBO TRỌN BỘ 2 PLUGIN ANTI")
        .setDescription(
          "Sở hữu trọn bộ 2 giải pháp bảo vệ cốt lõi cho server với giá ưu đãi tiết kiệm nhất.\n\n" +
          "• **Giá Combo:** 129.000 VNĐ • Tiết kiệm 29.000 VNĐ so với mua lẻ\n" +
          "• **Price:** ~$5.5 USD • Save $1.5 compared to separate purchases\n" +
          "• **Nền tảng hỗ trợ:** Paper, Purpur, Folia 1.16 đến 1.21+\n\n" +
          "🌟 **BAO GỒM / INCLUDES:**\n" +
          "1. **LS-AntiFreeCam & Obfuscator:** Chống soi rương, soi quặng, khắc chế Baritone đào tự động.\n" +
          "2. **LS-AntiClient & BrandShield:** Nhận diện và chặn đứng hack client Meteor, LiquidBounce, Aristois..."
        )
        .setFooter({ text: "LS STUDIO • Hỗ trợ nhiệt tình, bảo hành cập nhật lâu dài" });

      const buyBtn = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_buy")
          .setLabel("🛒 Mở Ticket Đặt Mua / Buy Now")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("ticket_pricing")
          .setLabel("💰 Bảng Giá / Price List")
          .setStyle(ButtonStyle.Secondary)
      );

      await chCombo.send({ embeds: [embed], components: [buyBtn] });
      console.log("✅ Đã cập nhật kênh #👑・combo-anti (đã gỡ Wurst)!");
    }

    process.exit(0);
  } catch (err) {
    console.error("❌ Lỗi:", err);
    process.exit(1);
  }
});

client.login(TOKEN);
