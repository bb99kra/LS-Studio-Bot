const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { 
  Client,
  Events, 
  GatewayIntentBits, 
  EmbedBuilder 
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
  console.log(`🤖 Logged in as ${client.user.tag}! Đồng bộ phiên bản Mod lên 1.16 - 1.21+...`);

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

    async function refreshChannel(channel, fn) {
      if (!channel) {
        console.warn("⚠️ [WARN] Không tìm thấy channel cần cập nhật.");
        return;
      }
      try {
        const messages = await channel.messages.fetch({ limit: 15 }).catch(() => new Map());
        for (const [id, msg] of messages) {
          if (msg.author.id === client.user.id) {
            await msg.delete().catch(() => {});
            await sleep(250);
          }
        }
        await fn(channel);
        await sleep(500);
        console.log(`   ✅ Cập nhật thành công: #${channel.name}`);
      } catch (e) {
        console.error(`   ❌ Lỗi kênh ${channel.name || 'Unknown'}:`, e.message);
      }
    }

    // 1. KÊNH SẢN PHẨM PLUGIN & MOD
    await refreshChannel(channels.get("1542479128534716438"), async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("💎 CÁC SẢN PHẨM & DỊCH VỤ - LS STUDIO")
        .setDescription(
          "Toàn bộ Plugin & Mod do LS Studio tự phát triển, tối ưu async nhẹ mượt và hỗ trợ lâu dài:"
        )
        .addFields(
          {
            name: "👁️ 1. LS-AntiFreeCam & Obfuscator (Plugin)",
            value: 
              "• **Tính năng:** Ẩn quặng quý và rương đồ khi ngoài tầm nhìn, khắc chế triệt để Freecam, Chest ESP, Baritone đào tự động.\n" +
              "• **Hỗ trợ:** Paper / Purpur / Folia (1.16 - 1.21+)\n" +
              "• **Giá:** `150.000 VNĐ`"
          },
          {
            name: "🚫 2. LS-AntiClient & BrandShield (Plugin)",
            value: 
              "• **Tính năng:** Phân tích packet nhận diện và chặn các client hack phổ biến (Meteor, LiquidBounce, Aristois, Wurst, Fabric Cheats...).\n" +
              "• **Hỗ trợ:** Paper / Purpur / Folia (1.16 - 1.21+)\n" +
              "• **Giá:** `180.000 VNĐ`"
          },
          {
            name: "🎁 3. LS-GiftCode & Rewards (Plugin)",
            value: 
              "• **Tính năng:** Tạo Giftcode tân thủ, code event, code đền bù; giới hạn lượt nhập; phát item/tiền Vault tự động; lưu async MySQL/SQLite.\n" +
              "• **Hỗ trợ:** Paper / Purpur / Folia (1.16 - 1.21+)\n" +
              "• **Giá:** `30.000 VNĐ`"
          },
          {
            name: "👑 4. Combo 2 Plugin Anti (AntiFreeCam + AntiClient)",
            value: 
              "• **Tính năng:** Sở hữu trọn bộ 2 giải pháp bảo vệ cốt lõi cho server với giá ưu đãi.\n" +
              "• **Hỗ trợ:** Paper / Purpur / Folia (1.16 - 1.21+)\n" +
              "• **Giá Combo:** `290.000 VNĐ`"
          },
          {
            name: "🧩 5. Dịch Vụ Lập Trình MOD Custom (CHỈ MINECRAFT JAVA)",
            value: 
              "• **Nền tảng:** Forge / Fabric / NeoForge / Quilt (1.16 - 1.21+)\n" +
              "• **Nhận làm:** Tùy theo tính năng của khách hàng yêu cầu.\n" +
              "• ⚠️ **Lưu ý:** *Chỉ nhận làm cho Minecraft Java Edition (PC), không nhận Bedrock/PE.*\n" +
              "• **Giá:** `Thỏa thuận theo ý tưởng`"
          }
        )
        .setFooter({ text: "Mở Ticket tại #🛒・mua-plugin để đặt mua và trao đổi dự án!" });

      await ch.send({ embeds: [embed] });
    });

    // 2. KÊNH BẢNG GIÁ
    await refreshChannel(channels.get("1542479130900172910"), async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#FEE75C")
        .setTitle("💰 BẢNG GIÁ DỊCH VỤ LS STUDIO")
        .setDescription("Bảng giá minh bạch, hỗ trợ bảo hành và cập nhật tận tình:")
        .addFields(
          {
            name: "📦 1. Plugin Đóng Gói Sẵn (Hỗ trợ Paper / Purpur / Folia 1.16 - 1.21+)",
            value: 
              "• 👁️ **LS-AntiFreeCam:** `150.000đ`\n" +
              "• 🚫 **LS-AntiClient:** `180.000đ`\n" +
              "• 🎁 **LS-GiftCode:** `30.000đ`\n" +
              "• 👑 **Combo 2 Plugin Anti:** `290.000đ`"
          },
          {
            name: "🛠️ 2. Nhận Code Plugin Theo Yêu Cầu (Custom Plugin)",
            value: 
              "• Hỗ trợ tối ưu cho Paper / Purpur / Folia (1.16 - 1.21+)\n" +
              "• Plugin nhỏ (lệnh, GUI, tiện ích): `50k - 150k`\n" +
              "• Hệ thống gameplay, minigame riêng: `200k - 500k`\n" +
              "• Dự án lớn: Thỏa thuận theo độ khó"
          },
          {
            name: "🧩 3. Nhận Code MOD Custom (CHỈ JAVA EDITION)",
            value: 
              "• **Nền tảng:** Forge, Fabric, NeoForge (1.16 - 1.21+ PC Java)\n" +
              "• **Hạng mục:** Tùy theo tính năng của khách hàng yêu cầu.\n" +
              "• **Báo giá:** Trao đổi ý tưởng trực tiếp trong Ticket để Dev báo giá & thời gian hoàn thành."
          },
          {
            name: "💳 4. Thông Tin Thanh Toán",
            value: "• **Ngân hàng:** MBBank\n• **STK:** `844515133333`\n• **Tên:** `VAN HUU PHAM NGUYEN`\n• Quét mã VietQR tự động qua Ticket để nhận file ngay!"
          }
        )
        .setFooter({ text: "Giao dịch an toàn qua Ticket tại LS STUDIO" });

      await ch.send({ embeds: [embed] });
    });

    // 3. KÊNH THÔNG BÁO
    await refreshChannel(channels.get("1542479120036794418"), async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("🚀 CHÀO MỪNG ĐẾN VỚI LS STUDIO")
        .setDescription(
          "Chào anh em! **LS STUDIO** chuyên tự code các **Plugin Minecraft, Hệ Thống Chống Hack (Anti-Cheat) & Dịch Vụ Mod Custom (Chỉ Java Edition)**.\n\n" +
          "🛠️ **DỊCH VỤ CỦA CHÚNG TÔI:**\n" +
          "• 🛡️ **Plugin Minecraft:** Hỗ trợ chuẩn **Paper / Purpur / Folia (1.16 - 1.21+)**.\n" +
          "• 🧩 **Mod Custom Java:** Hỗ trợ **Forge / Fabric / NeoForge / Quilt (1.16 - 1.21+)**.\n" +
          "• ⚡ Nhận lập trình Plugin & Mod riêng theo tính năng yêu cầu của anh em."
        )
        .addFields(
          { name: "💎 Sản Phẩm", value: `<#1542479128534716438>`, inline: true },
          { name: "💰 Bảng Giá", value: `<#1542479130900172910>`, inline: true },
          { name: "🛒 Mua Hàng", value: `<#1542479138839986227>`, inline: true }
        )
        .setFooter({ text: "LS STUDIO • Lead Developer: Nguyendzvn" });

      await ch.send({ embeds: [embed] });
    });

    console.log("🎉 ĐÃ ĐỒNG BỘ TOÀN BỘ MOD VÀ PLUGIN LÊN 1.16 - 1.21+!");
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
