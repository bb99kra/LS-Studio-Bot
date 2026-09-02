const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { 
  Client,
  Events, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} = require('discord.js');

const tokenLocalPath = path.join(__dirname, 'token.local.js');
const localConfig = fs.existsSync(tokenLocalPath) ? require(tokenLocalPath) : {};
const TOKEN = process.env.DISCORD_TOKEN || localConfig.TOKEN || localConfig.DISCORD_TOKEN || '';

const NGUYEN_SMP_GUILD_ID = "1462028925046620265";
const LS_STUDIO_GUILD_ID = process.env.GUILD_ID || (typeof localConfig !== "undefined" && localConfig.GUILD_ID) || "1542476657825419334";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

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
  console.log(`🤖 Logged in as ${client.user.tag}! Decorating partner systems on both servers...`);

  try {
    // 1. POST EMBED ĐỐI TÁC TRÊN SERVER NGUYEN SMP
    const nguyenGuild = await client.guilds.fetch(NGUYEN_SMP_GUILD_ID);
    const nguyenChannels = await nguyenGuild.channels.fetch();
    const partnerChannel = nguyenChannels.find(c => c && (c.name.includes("hợᴘ・táᴄ") || c.name.includes("hop-tac") || c.name.includes("partner")));

    const { createComponentsV2Message, isComponentsV2Available } = require('./bot');

    if (partnerChannel) {
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

      const v2Partner = createComponentsV2Message({
        accentColor: 0xFF3D00,
        title: "🛡️ ĐỐI TÁC CÔNG NGHỆ & BẢO MẬT ĐỘC QUYỀN: LS STUDIO",
        description:
          "🌟 **THÔNG BÁO HỢP TÁC CHIẾN LƯỢC TRONG HỆ SINH THÁI** 🌟\n\n" +
          "Chào toàn thể các cư dân của **Nguyen SMP**! Để mang đến một sân chơi **công bằng, mượt mà và an toàn 100%**, chúng tôi trân trọng giới thiệu **LS STUDIO** — Đơn vị bảo trợ công nghệ và cung cấp giải pháp Anti-Cheat độc quyền cho máy chủ của chúng ta!\n\n" +
          "🔥 **HỆ THỐNG BẢO VỆ TẠI NGUYEN SMP BỞI LS STUDIO:**\n" +
          "• 🚫 **LS-AntiClient:** Tự động phát hiện và chặn đứng 100% các bản Hacked Client (*Meteor, LiquidBounce, Aristois, Wurst...*)\n" +
          "• 👁️ **LS-AntiFreeCam & Anti-ESP:** Khắc chế hoàn toàn hack soi rương, soi quặng X-Ray và Baritone đào tự động.\n" +
          "• ⚡ **LS-AntiCrash & Packet Shield:** Giữ vững **20.0 TPS** mượt mà, chống mọi hình thức phá hoại server.\n\n" +
          "👑 **BẠN LÀ CHỦ SERVER MINECRAFT & MUỐN SỞ HỮU PLUGIN XỊN?**\n" +
          "Hãy ghé thăm **LS STUDIO** để mua Plugin Anti hoặc đặt code Plugin riêng theo yêu cầu với ưu đãi độc quyền!",
        fields: [
          { name: "👑 Founder / Lead Dev", value: "Nguyendzvn", inline: true },
          { name: "⚡ Nền Tảng Hỗ Trợ", value: "Paper / Purpur / Folia", inline: true },
          { name: "💎 Discord Chính Thức", value: "https://discord.gg/2r2DdYcxPE", inline: false }
        ],
        footer: { text: "Nguyen SMP x LS STUDIO • Đồng Hành Cùng Phát Triển", iconURL: client.user.displayAvatarURL() },
        timestamp: true,
        actionRows: [btnRow]
      });

      await partnerChannel.send(v2Partner.toClassic());
      console.log("✅ Đã đăng Embed đối tác LS STUDIO lên Nguyen SMP!");
      await sleep(500);
    }

    // 2. CẬP NHẬT KÊNH DEMO & ĐỐI TÁC TRÊN SERVER LS STUDIO
    const lsGuild = await client.guilds.fetch(LS_STUDIO_GUILD_ID);
    const lsChannels = await lsGuild.channels.fetch();
    const demoChannel = lsChannels.find(c => c && c.name.includes("server-test-demo"));

    if (demoChannel) {
      // Xóa tin nhắn cũ của bot
      const oldMsgs = await demoChannel.messages.fetch({ limit: 10 });
      for (const [id, msg] of oldMsgs) {
        if (msg.author.id === client.user.id) {
          await msg.delete().catch(() => {});
          await sleep(250);
        }
      }

      const btnSmp = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('🎮 Tham Gia Discord Nguyen SMP')
          .setStyle(ButtonStyle.Link)
          .setURL('https://discord.gg/vjFkC6cRdj')
      );

      const v2Demo = createComponentsV2Message({
        accentColor: 0x9C27B0,
        title: "🌐 MÁY CHỦ THỰC CHIẾN & ĐỐI TÁC CHIẾN LƯỢC: NGUYEN SMP",
        description:
          "Bạn muốn kiểm chứng độ mượt mà và hiệu quả bắt hack thực tế của các Plugin LS Studio trong một máy chủ đang hoạt động đông người?\n\n" +
          "🎮 **MÁY CHỦ ĐỐI TÁC: NGUYEN SMP (Survival MultiPlayer)**\n" +
          "• **Địa chỉ IP Server:** `fusion.pikamc.vn:26111`\n" +
          "• **Phiên bản:** `1.21+` (PC Java Edition)\n" +
          "• **Tình trạng:** Đang vận hành chính thức 24/7 với hệ thống Anti-Cheat & Packet Shield độc quyền của LS Studio.\n\n" +
          "⚔️ **Trải nghiệm thực tế:**\n" +
          "Vào chơi sinh tồn, trải nghiệm PvP cực mượt không lag và tận mắt thấy hệ thống Anti ngăn chặn triệt để Freecam / X-Ray / Hack Client!",
        fields: [
          { name: "🔗 Tham Gia Discord Nguyen SMP", value: "https://discord.gg/vjFkC6cRdj" }
        ],
        footer: "LS STUDIO • Giải Pháp Plugin & Bảo Mật Thực Chiến",
        timestamp: true,
        actionRows: [btnSmp]
      });

      await demoChannel.send(v2Demo.toClassic());
      console.log("✅ Đã cập nhật Embed đối tác Nguyen SMP lên LS STUDIO!");
    }

    console.log("🎉 DECOR HOÀN TẤT TRÊN CẢ 2 SERVER!");
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
