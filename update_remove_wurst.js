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
  console.log(`🤖 Logged in as ${client.user.tag}! Gỡ bỏ Wurst khỏi LS-AntiClient và cập nhật song ngữ...`);

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

    // 1. CẬP NHẬT KÊNH #🚫・ls-anticlient
    const chClient = channels.find(c => c && c.name.includes("ls-anticlient"));
    if (chClient) {
      const msgs = await chClient.messages.fetch({ limit: 10 });
      for (const [mId, msg] of msgs) {
      if (msg.author.id === client.user.id) {
        await msg.delete().catch(() => {});
        await sleep(250);
      }
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
      for (const [mId, msg] of msgs) {
      if (msg.author.id === client.user.id) {
        await msg.delete().catch(() => {});
        await sleep(250);
      }
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
