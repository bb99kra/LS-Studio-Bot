const fs = require('fs');
const { 
  Client,
  Events, 
  GatewayIntentBits, 
  EmbedBuilder 
} = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN || (fs.existsSync('./token.local.js') ? require('./token.local.js').TOKEN : 'YOUR_BOT_TOKEN_HERE');
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
  console.log(`🤖 Logged in as ${client.user.tag}! Cập nhật mô tả nhận làm Mod custom...`);

  try {
    const guild = await client.guilds.fetch(LS_STUDIO_GUILD_ID);
    const channels = await guild.channels.fetch();

    async function refreshChannel(channel, fn) {
      if (!channel) return;
      try {
        const messages = await channel.messages.fetch({ limit: 15 });
        for (const [id, msg] of messages) {
          if (msg.author.id === client.user.id) await msg.delete().catch(() => {});
        }
        await fn(channel);
        console.log(`   ✅ Cập nhật thành công: ${channel.name}`);
      } catch (e) {
        console.error(`   ❌ Lỗi kênh ${channel.name}:`, e.message);
      }
    }

    // 1. KÊNH SẢN PHẨM PLUGIN & MOD
    await refreshChannel(channels.get("1542479128534716438"), async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("💎 CÁC SẢN PHẨM & DỊCH VỤ - LS STUDIO")
        .setDescription(
          "Toàn bộ sản phẩm đều do LS Studio tự phát triển, hỗ trợ tối ưu và cập nhật định kỳ:"
        )
        .addFields(
          {
            name: "👁️ 1. LS-AntiFreeCam & Obfuscator (Plugin)",
            value: "• **Tính năng:** Ẩn quặng quý và rương đồ khi ngoài tầm nhìn, khắc chế triệt để Freecam, Chest ESP, Baritone đào tự động.\n• **Hỗ trợ:** Paper / Purpur / Folia (1.18 - 1.21+)\n• **Giá:** `150.000 VNĐ`"
          },
          {
            name: "🚫 2. LS-AntiClient & BrandShield (Plugin)",
            value: "• **Tính năng:** Phân tích packet nhận diện và chặn các client hack phổ biến (Meteor, LiquidBounce, Aristois, Wurst, Fabric Cheats...).\n• **Hỗ trợ:** Paper / Purpur / Folia (1.18 - 1.21+)\n• **Giá:** `180.000 VNĐ`"
          },
          {
            name: "🎁 3. LS-GiftCode & Rewards (Plugin)",
            value: "• **Tính năng:** Tạo Giftcode tân thủ, code event, code đền bù; giới hạn lượt nhập; phát item/tiền Vault tự động; lưu async MySQL/SQLite.\n• **Hỗ trợ:** Spigot / Paper / Purpur / Folia (1.16 - 1.21+)\n• **Giá:** `30.000 VNĐ`"
          },
          {
            name: "👑 4. Combo 2 Plugin Anti (AntiFreeCam + AntiClient)",
            value: "• Sở hữu trọn bộ 2 giải pháp bảo vệ cốt lõi cho server với giá ưu đãi.\n• **Giá Combo:** `290.000 VNĐ`"
          },
          {
            name: "🧩 5. Dịch Vụ Lập Trình MOD Custom (CHỈ MINECRAFT JAVA)",
            value: 
              "• **Nền tảng:** Forge / Fabric / NeoForge / Quilt (1.12.2 -> 1.21+)\n" +
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
            name: "📦 1. Plugin Đóng Gói Sẵn",
            value: 
              "• 👁️ **LS-AntiFreeCam:** `150.000đ`\n" +
              "• 🚫 **LS-AntiClient:** `180.000đ`\n" +
              "• 🎁 **LS-GiftCode:** `30.000đ`\n" +
              "• 👑 **Combo 2 Plugin Anti:** `290.000đ`"
          },
          {
            name: "🛠️ 2. Nhận Code Plugin Theo Yêu Cầu (Custom Plugin)",
            value: 
              "• Plugin nhỏ (lệnh, GUI, tiện ích): `50k - 150k`\n" +
              "• Hệ thống gameplay, minigame riêng: `200k - 500k`\n" +
              "• Dự án lớn: Thỏa thuận theo độ khó"
          },
          {
            name: "🧩 3. Nhận Code MOD Custom (CHỈ JAVA EDITION)",
            value: 
              "• **Nền tảng:** Forge, Fabric, NeoForge (PC Java)\n" +
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

    console.log("🎉 ĐÃ CẬP NHẬT MÔ TẢ THEO YÊU CẦU XONG 100%!");
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
