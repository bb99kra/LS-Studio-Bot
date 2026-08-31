const fs = require('fs');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN || (fs.existsSync('./token.local.js') ? require('./token.local.js').TOKEN : 'YOUR_BOT_TOKEN_HERE');
const LS_STUDIO_GUILD_ID = "1542476657825419334";

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

client.once('clientReady', async () => {
  try {
    const guild = await client.guilds.fetch(LS_STUDIO_GUILD_ID);
    const channels = await guild.channels.fetch();

    const chTb = channels.find(c => c && c.name.includes("thông-báo"));
    if (chTb) {
      const msgs = await chTb.messages.fetch({ limit: 10 });
      for (const [mId, msg] of msgs) {
        if (msg.author.id === client.user.id) await msg.delete().catch(() => {});
      }

      const chAc = channels.find(c => c && c.name === "🛡️・ls-anticheat");
      const chFc = channels.find(c => c && c.name === "👁️・ls-antifreecam");
      const chClient = channels.find(c => c && c.name === "🚫・ls-anticlient");
      const chGc = channels.find(c => c && c.name === "🎁・ls-giftcode");
      const chCombo = channels.find(c => c && c.name === "👑・combo-anti");
      const chMod = channels.find(c => c && c.name === "🧩・mod-custom-java");

      const chClaudeApi = channels.find(c => c && c.name === "⚡・api-claude-100m");
      const chCodexApi = channels.find(c => c && c.name === "💻・api-codex-100m");
      const chClaudeAcc = channels.find(c => c && c.name === "👑・acc-claude-max20");
      const chGptPlus = channels.find(c => c && c.name === "⭐・acc-chatgpt-plus");
      const chMonica = channels.find(c => c && c.name === "✨・acc-monica-pro");
      const chGptOffer = channels.find(c => c && c.name === "🎁・acc-chatgpt-offer");

      const chPrice = channels.find(c => c && c.name.includes("bảng-giá"));
      const chBuy = channels.find(c => c && c.name.includes("mua-plugin"));

      const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("🚀 CHÀO MỪNG ĐẾN VỚI LS STUDIO / WELCOME TO LS STUDIO")
        .setDescription(
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Chào anh em! **LS STUDIO** chuyên cung cấp các giải pháp **Plugin Minecraft, Anti-Cheat, Mod Custom Java** và **Dịch Vụ AI / API Key Premium** chính hãng với giá tốt nhất!\n\n" +
          "📦 **DANH MỤC PLUGIN MINECRAFT:**\n" +
          `• 🛡️ AntiCheat & Addon Cart: <#${chAc?.id}>\n` +
          `• 👁️ Chống Freecam & X-Ray: <#${chFc?.id}>\n` +
          `• 🚫 Chặn Hacked Client: <#${chClient?.id}>\n` +
          `• 🎁 Quà Tặng GiftCode: <#${chGc?.id}>\n` +
          `• 👑 Combo 2 Plugin Anti: <#${chCombo?.id}>\n` +
          `• 🧩 Lập Trình Mod Java: <#${chMod?.id}>\n\n` +
          "🤖 **DANH MỤC DỊCH VỤ AI & API KEY:**\n" +
          `• ⚡ API Key Claude 100M: <#${chClaudeApi?.id}>\n` +
          `• 💻 API Key Codex 100M: <#${chCodexApi?.id}>\n` +
          `• 👑 Acc Claude Max 20: <#${chClaudeAcc?.id}>\n` +
          `• ⭐ Acc ChatGPT Plus: <#${chGptPlus?.id}>\n` +
          `• ✨ Acc Monica AI Pro: <#${chMonica?.id}>\n` +
          `• 🎁 Acc Gmail Nhận Offer: <#${chGptOffer?.id}>\n\n` +
          `💰 Bảng Giá Tổng Hợp: <#${chPrice?.id}>\n` +
          `🛒 Mở Ticket Đặt Hàng: <#${chBuy?.id}>`
        )
        .setFooter({ text: "LS STUDIO • Lead Developer: Nguyendzvn" });

      await chTb.send({ embeds: [embed] });
      console.log("✅ Đã cập nhật lại kênh #thông-báo với icon mới sang xịn!");
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
});

client.login(TOKEN);
