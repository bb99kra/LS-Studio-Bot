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
  console.log(`🤖 Logged in as ${client.user.tag}! Cập nhật LS-GiftCode vào danh sách sản phẩm & bảng giá...`);

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

    // 1. KÊNH SẢN PHẨM PLUGIN
    await refreshChannel(channels.get("1542479128534716438"), async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("💎 CÁC SẢN PHẨM PLUGIN - LS STUDIO")
        .setDescription(
          "Toàn bộ Plugin được bên mình tự viết và tối ưu async nhẹ nhàng cho Paper / Purpur / Folia 1.18 - 1.21+:"
        )
        .addFields(
          {
            name: "👁️ 1. LS-AntiFreeCam & Obfuscator",
            value: "• **Tính năng:** Ẩn quặng quý và rương đồ khi ngoài tầm nhìn, khắc chế triệt để Freecam, Chest ESP, Baritone đào tự động.\n• **Hỗ trợ:** Paper / Purpur / Folia (1.18 - 1.21+)\n• **Giá:** `150.000 VNĐ`"
          },
          {
            name: "🚫 2. LS-AntiClient & BrandShield",
            value: "• **Tính năng:** Phân tích packet nhận diện và chặn các client hack phổ biến (Meteor, LiquidBounce, Aristois, Wurst, Fabric Cheats...).\n• **Hỗ trợ:** Paper / Purpur / Folia (1.18 - 1.21+)\n• **Giá:** `180.000 VNĐ`"
          },
          {
            name: "🎁 3. LS-GiftCode & Rewards (Hệ Thống Mã Quà Tặng)",
            value: "• **Tính năng:** Tạo Giftcode tân thủ, code event, code đền bù; giới hạn lượt nhập theo từng người chơi hoặc toàn server; hẹn giờ hết hạn; phát item/tiền Vault/lệnh console tự động; lưu async MySQL/SQLite cực nhẹ.\n• **Hỗ trợ:** Spigot / Paper / Purpur / Folia (1.16 - 1.21+)\n• **Giá:** `100.000 VNĐ`"
          },
          {
            name: "👑 4. Combo 2 Plugin Anti (AntiFreeCam + AntiClient)",
            value: "• Sở hữu cả 2 giải pháp bảo vệ cốt lõi cho server với giá ưu đãi tiết kiệm.\n• **Giá Combo:** `290.000 VNĐ`"
          }
        )
        .setFooter({ text: "Mở Ticket tại #🛒・mua-plugin để đặt mua và nhận file ngay!" });

      await ch.send({ embeds: [embed] });
    });

    // 2. KÊNH BẢNG GIÁ
    await refreshChannel(channels.get("1542479130900172910"), async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#FEE75C")
        .setTitle("💰 BẢNG GIÁ DỊCH VỤ LS STUDIO")
        .setDescription("Bảng giá công khai, hỗ trợ fix lỗi và cập nhật định kỳ:")
        .addFields(
          {
            name: "📦 1. Plugin Có Sẵn",
            value: 
              "• 👁️ **LS-AntiFreeCam:** `150.000đ`\n" +
              "• 🚫 **LS-AntiClient:** `180.000đ`\n" +
              "• 🎁 **LS-GiftCode:** `100.000đ`\n" +
              "• 👑 **Combo 2 Plugin Anti:** `290.000đ`"
          },
          {
            name: "🛠️ 2. Nhận Code Plugin Theo Yêu Cầu (Custom Dev)",
            value: "• Plugin nhỏ (lệnh, GUI, tiện ích): `50k - 150k`\n• Hệ thống gameplay, minigame riêng: `200k - 500k`\n• Dự án lớn: Thỏa thuận theo độ khó"
          },
          {
            name: "🛡️ 3. Chính Sách Bảo Hành & Cập Nhật",
            value: "• Hỗ trợ hướng dẫn cấu hình chi tiết.\n• Miễn phí fix lỗi bug và cập nhật phiên bản mới."
          },
          {
            name: "💳 4. Thông Tin Thanh Toán",
            value: "• **Ngân hàng:** MBBank\n• **STK:** `844515133333`\n• **Tên:** `VAN HUU PHAM NGUYEN`\n• Quét mã VietQR tự động qua Ticket để nhận file ngay!"
          }
        )
        .setFooter({ text: "Giao dịch an toàn qua Ticket tại LS STUDIO" });

      await ch.send({ embeds: [embed] });
    });

    console.log("🎉 ĐÃ THÊM LS-GIFTCODE XONG 100%!");
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
