const fs = require('fs');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN || (fs.existsSync('./token.local.js') ? require('./token.local.js').TOKEN : 'YOUR_BOT_TOKEN_HERE');
const LS_STUDIO_GUILD_ID = "1542476657825419334";

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

client.once('clientReady', async () => {
  try {
    const guild = await client.guilds.fetch(LS_STUDIO_GUILD_ID);
    const channels = await guild.channels.fetch();

    const chTb = channels.get("1542479120036794418");
    if (chTb) {
      const msgs = await chTb.messages.fetch({ limit: 10 });
      for (const [mId, msg] of msgs) {
        if (msg.author.id === client.user.id) await msg.delete().catch(() => {});
      }

      const chAc = channels.find(c => c.name.includes("ls-anticheat"));
      const chFc = channels.find(c => c.name.includes("ls-antifreecam"));
      const chClient = channels.find(c => c.name.includes("ls-anticlient"));
      const chGc = channels.find(c => c.name.includes("ls-giftcode"));
      const chCombo = channels.find(c => c.name.includes("combo-anti"));
      const chMod = channels.find(c => c.name.includes("mod-custom-java"));
      const chPrice = channels.find(c => c.name.includes("bảng-giá"));
      const chBuy = channels.find(c => c.name.includes("mua-plugin"));

      const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("🚀 CHÀO MỪNG ĐẾN VỚI LS STUDIO")
        .setDescription(
          "Chào anh em! **LS STUDIO** chuyên tự code các **Plugin Minecraft, Hệ Thống Chống Hack và Mod Custom cho Minecraft Java** nhẹ mượt, chạy tốt trên Paper, Purpur và Folia 1.16 đến 1.21+.\n\n" +
          "🛠️ **DANH SÁCH KÊNH SẢN PHẨM RIÊNG:**\n" +
          `• 🛡️ AntiCheat Đa Năng: <#${chAc?.id}>\n` +
          `• 👁️ Chống Freecam và X-Ray: <#${chFc?.id}>\n` +
          `• 🚫 Chặn Hacked Client: <#${chClient?.id}>\n` +
          `• 🎁 Quà Tặng GiftCode: <#${chGc?.id}>\n` +
          `• 👑 Combo Tiết Kiệm: <#${chCombo?.id}>\n` +
          `• 🧩 Mod Custom Java: <#${chMod?.id}>\n` +
          `• 💰 Bảng Giá Tổng Hợp: <#${chPrice?.id}>\n` +
          `• 🛒 Mở Ticket Đặt Hàng: <#${chBuy?.id}>`
        )
        .setFooter({ text: "LS STUDIO • Lead Developer: Nguyendzvn" });

      await chTb.send({ embeds: [embed] });
      console.log("✅ Đã cập nhật lại kênh #thông-báo!");
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
});

client.login(TOKEN);
