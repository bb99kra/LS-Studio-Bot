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
    const chPrice = channels.find(c => c && c.name.includes("bảng-giá"));

    if (chPrice) {
      const messages = await chPrice.messages.fetch({ limit: 15 });
      for (const [mId, msg] of msgs) {
      if (msg.author.id === client.user.id) {
        await msg.delete().catch(() => {});
        await sleep(250);
      }
    }

      const embed = new EmbedBuilder()
        .setColor("#FEE75C")
        .setTitle("💰 BẢNG GIÁ DỊCH VỤ / PRICE LIST - LS STUDIO")
        .setDescription(
          "Bảng giá công khai minh bạch cho toàn bộ Plugin Minecraft, Mod Java & Dịch vụ AI:\n" +
          "*Transparent pricing for Minecraft Plugins, Mods & AI Premium Services:*"
        )
        .addFields(
          {
            name: "📦 1. Plugin Minecraft (Paper / Purpur / Folia 1.16 - 1.21+)",
            value: 
              "• 🛡️ **LS-AntiCheat (Bản Gốc):** `30.000 VNĐ` • `~$1.50 USD`\n" +
              "• 🛒 **Addon Anti-Macro Cart:** `20.000 VNĐ / Tháng` • `~$1.00 USD / Mo`\n" +
              "• 🎁 **LS-GiftCode:** `30.000 VNĐ` • `~$1.50 USD`\n" +
              "• 👁️ **LS-AntiFreeCam:** `59.000 VNĐ` • `~$2.50 USD`\n" +
              "• 🚫 **LS-AntiClient:** `99.000 VNĐ` • `~$4.00 USD`\n" +
              "• 👑 **Combo 2 Plugin Anti:** `129.000 VNĐ` • `~$5.50 USD`\n" +
              "• 🧩 **Lập Trình Mod Java & Plugin Riêng:** Thỏa thuận theo yêu cầu"
          },
          {
            name: "🔑 2. API Key AI (Cursor / Cline / Coding / Bot Discord)",
            value: 
              "• 🧠 **API Key Claude 100M Token (3 Ngày):** `4.25$` (~`109.000 VNĐ`)\n" +
              "• ⚡ **API Key Codex 100M Token (3 Ngày):** `3.25$` (~`85.000 VNĐ`)"
          },
          {
            name: "💎 3. Tài Khoản AI Premium & Offer",
            value: 
              "• 🔮 **Acc Claude Max 20 (1 Tháng):** `89.000 VNĐ` • `~$3.50 USD`\n" +
              "• 🟢 **Acc ChatGPT Plus (1 Tháng):** `169.000 VNĐ` • `~$6.80 USD`\n" +
              "• 🟣 **Acc Monica AI Pro Model Claude (3 Ngày):** `49.000 VNĐ` • `~$2.00 USD`\n" +
              "• 📧 **Acc ChatGPT New Gmail (Nhận Offer):** `5.000 VNĐ` • `~$0.20 USD` *(Cần thẻ PayPal)*"
          },
          {
            name: "💳 4. Thanh Toán / Payment Methods",
            value: 
              "• 🇻🇳 **Việt Nam:** MBBank Quân Đội • STK `844515133333` • Tên **VAN HUU PHAM NGUYEN**\n" +
              "• 🌐 **Global:** PayPal / Crypto / Card (Mở Ticket để lấy link thanh toán)"
          }
        )
        .setFooter({ text: "Giao dịch an toàn 24/7 qua Ticket tại LS STUDIO" });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_buy")
          .setLabel("🛒 Mở Ticket Đặt Mua / Buy Ticket")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("ticket_pricing")
          .setLabel("💰 Bảng Giá / Price List")
          .setStyle(ButtonStyle.Secondary)
      );

      await chPrice.send({ embeds: [embed], components: [row] });
      console.log("✅ Đã cập nhật lại bảng giá tổng hợp đầy đủ mục AI!");
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
