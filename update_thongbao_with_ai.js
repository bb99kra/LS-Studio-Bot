const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Client,
  Events, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const tokenLocalPath = path.join(__dirname, 'token.local.js');
const localConfig = fs.existsSync(tokenLocalPath) ? require(tokenLocalPath) : {};
const TOKEN = process.env.DISCORD_TOKEN || localConfig.TOKEN || localConfig.DISCORD_TOKEN || '';
const LS_STUDIO_GUILD_ID = process.env.GUILD_ID || (typeof localConfig !== "undefined" && localConfig.GUILD_ID) || "1542476657825419334";

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

// Helper: Pacing delay to prevent Discord 429 Rate Limits
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  try {
    const guild = await client.guilds.fetch(LS_STUDIO_GUILD_ID).catch(err => {
      console.error(`❌ [ERROR] Không thể fetch Guild (${LS_STUDIO_GUILD_ID}):`, err.message || err);
      return null;
    });
    if (!guild) {
      console.error(`❌ [ERROR] Không tìm thấy Guild (${LS_STUDIO_GUILD_ID}) hoặc Bot chưa tham gia.`);
      return await cleanupAndExit(1);
    }
    const channels = await guild.channels.fetch();

    const chTb = channels.find(c => c && c.name.includes("thông-báo"));
    if (chTb) {
      const msgs = await chTb.messages.fetch({ limit: 10 });
      for (const [mId, msg] of msgs) {
      if (msg.author.id === client.user.id) {
        await msg.delete().catch(() => {});
        await sleep(250);
      }
    }

      const chAc = channels.find(c => c && c.name === "🛡️・ls-anticheat");
      const chFc = channels.find(c => c && c.name === "👁️・ls-antifreecam");
      const chClient = channels.find(c => c && c.name === "🚫・ls-anticlient");
      const chGc = channels.find(c => c && c.name === "🎁・ls-giftcode");
      const chCombo = channels.find(c => c && c.name === "👑・combo-anti");
      const chMod = channels.find(c => c && c.name === "🧩・mod-custom-java");

      const chClaudeApi = channels.find(c => c && c.name === "🧠・api-claude-100m");
      const chCodexApi = channels.find(c => c && c.name === "⚡・api-codex-100m");
      const chClaudeAcc = channels.find(c => c && c.name === "🔮・acc-claude-max20");
      const chGptPlus = channels.find(c => c && c.name === "🟢・acc-chatgpt-plus");
      const chMonica = channels.find(c => c && c.name === "🟣・acc-monica-pro");
      const chGptOffer = channels.find(c => c && c.name === "📧・acc-chatgpt-offer");

      const chPrice = channels.find(c => c && c.name.includes("bảng-giá"));
      const chBuy = channels.find(c => c && c.name.includes("mua-plugin"));

      const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("🚀 CHÀO MỪNG ĐẾN VỚI LS STUDIO / WELCOME TO LS STUDIO")
        .setDescription(
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Chào anh em! **LS STUDIO** chuyên cung cấp các giải pháp **Plugin Minecraft, Anti-Cheat, Mod Custom Java** và các **Dịch Vụ AI / API Key Premium** chính hãng với giá tốt nhất!\n\n" +
          "📦 **DANH MỤC PLUGIN MINECRAFT:**\n" +
          `• 🛡️ AntiCheat & Addon Cart: <#${chAc?.id}>\n` +
          `• 👁️ Chống Freecam & X-Ray: <#${chFc?.id}>\n` +
          `• 🚫 Chặn Hacked Client: <#${chClient?.id}>\n` +
          `• 🎁 Quà Tặng GiftCode: <#${chGc?.id}>\n` +
          `• 👑 Combo 2 Plugin Anti: <#${chCombo?.id}>\n` +
          `• 🧩 Lập Trình Mod Java: <#${chMod?.id}>\n\n` +
          "🤖 **DANH MỤC DỊCH VỤ AI & API KEY:**\n" +
          `• 🧠 API Key Claude 100M: <#${chClaudeApi?.id}>\n` +
          `• ⚡ API Key Codex 100M: <#${chCodexApi?.id}>\n` +
          `• 🔮 Acc Claude Max 20: <#${chClaudeAcc?.id}>\n` +
          `• 🟢 Acc ChatGPT Plus: <#${chGptPlus?.id}>\n` +
          `• 🟣 Acc Monica AI Pro: <#${chMonica?.id}>\n` +
          `• 📧 Acc Gmail Nhận Offer: <#${chGptOffer?.id}>\n\n` +
          `💰 Bảng Giá Tổng Hợp: <#${chPrice?.id}>\n` +
          `🛒 Mở Ticket Đặt Hàng: <#${chBuy?.id}>`
        )
        .setFooter({ text: "LS STUDIO • Lead Developer: Nguyendzvn" });

      await chTb.send({ embeds: [embed] });
      console.log("✅ Đã cập nhật lại kênh #thông-báo đầy đủ link từng kênh riêng biệt!");
    }
    await cleanupAndExit(0);
  } catch (err) {
    console.error("❌ [ERROR] Lỗi thực thi:", err.message || err);
    await cleanupAndExit(1);
  }
});

if (!TOKEN || TOKEN === 'YOUR_BOT_TOKEN_HERE' || TOKEN.trim() === '') {
  console.error('❌ Lỗi: DISCORD_TOKEN chưa được thiết lập trong .env hoặc token.local.js!');
  process.exit(1);
}

client.login(TOKEN).catch(async (err) => {
  console.error("❌ [ERROR] Lỗi thực thi:", err.message || err);
    await cleanupAndExit(1);
});
