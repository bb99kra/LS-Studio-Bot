const fs = require('fs');
const { 
  Client,
  Events, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN || (fs.existsSync('./token.local.js') ? require('./token.local.js').TOKEN : 'YOUR_BOT_TOKEN_HERE');
const LS_STUDIO_GUILD_ID = "1542476657825419334";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// Watchdog timeout to prevent script hanging indefinitely
const WATCHDOG_TIMEOUT_MS = 60000;
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
  console.log(`🤖 Logged in as ${client.user.tag}! Re-decorating LS STUDIO in ONIC/OpenlayMC style...`);

  try {
    const guild = await client.guilds.fetch(LS_STUDIO_GUILD_ID);
    const channels = await guild.channels.fetch();

    console.log(`🏰 Transforming ${guild.name}...`);

    // 1. CẬP NHẬT TÊN CATEGORIES (PHONG CÁCH ONIC / OPENLAYMC)
    const catMap = {
      "1542479115917987952": "╭・📌 ᴛʜôɴɢ ᴛɪɴ",
      "1542479126697476196": "╭・🛒 ʟs sᴛᴏʀᴇ",
      "1542479136789106708": "╭・🎫 ᴛɪᴄᴋᴇᴛ & ʜỗ ᴛʀợ",
      "1542479144384729109": "╭・💬 ɢɪᴀᴏ ʟưᴜ",
      "1542479154891722782": "╭・👑 ᴋʜáᴄʜ ʜàɴɢ ᴠɪᴘ",
      "1542479160914477108": "╭・🔒 ǫᴜảɴ ᴛʀị",
      "1542479168628072468": "╭・🔊 ᴋêɴʜ ᴛʜᴏạɪ"
    };

    for (const [id, name] of Object.entries(catMap)) {
      const cat = channels.get(id);
      if (cat) {
        await cat.setName(name).catch(console.error);
        console.log(`   + Category: ${name}`);
      }
    }

    // 2. CẬP NHẬT TÊN CHANNELS (SMALL CAPS TYPOGRAPHY)
    const channelMap = {
      "1542479117880922183": "📜ᵎʟᴜậᴛ-ʟệ",
      "1542479120036794418": "📢ᵎᴛʜôɴɢ-ʙáᴏ",
      "1542479122645917769": "🚀ᵎᴄʜᴀɴɢᴇʟᴏɢ",
      "1542479124462047303": "🎁ᵎɢɪᴠᴇᴀᴡᴀʏ",
      "1542479128534716438": "💎ᵎsảɴ-ᴘʜẩᴍ",
      "1542479130900172910": "💰ᵎʙảɴɢ-ɢɪá",
      "1542479132758384650": "🌐ᵎsᴇʀᴠᴇʀ-ᴛᴇsᴛ",
      "1542479134683435040": "⭐ᵎᴠᴏᴜᴄʜ-ᴜʏ-ᴛíɴ",
      "1542479138839986227": "🛒ᵎᴍᴜᴀ-ᴘʟᴜɢɪɴ",
      "1542479140534616124": "🛠️ᵎʜỗ-ᴛʀợ-ᴋỹ-ᴛʜᴜậᴛ",
      "1542479142845546507": "📝ᵎᴄᴜsᴛᴏᴍ-ᴘʟᴜɢɪɴ",
      "1542479146834206761": "💬ᵎᴄʜᴀᴛ-ᴛự-ᴅᴏ",
      "1542479148340092988": "💡ᵎɢóᴘ-ý",
      "1542479150798078113": "📸ᵎᴋʜᴏᴇ-sᴇʀᴠᴇʀ",
      "1542479152681328690": "🤖ᵎʟệɴʜ-ʙᴏᴛ",
      "1542479157236211835": "📦ᵎᴛảɪ-ᴘʟᴜɢɪɴ",
      "1542479158947487781": "💬ᵎᴄʜᴀᴛ-ᴋʜáᴄʜ-ʜàɴɢ",
      "1542479163183730708": "📊ᵎɴʜậᴛ-ᴋý-ɢɪᴀᴏ-ᴅịᴄʜ",
      "1542479164886749275": "💬ᵎɴộɪ-ʙộ-sᴛᴀғғ",
      "1542479170137886870": "🔊・Phòng Chờ",
      "1542479172083916830": "🛠️・Hỗ Trợ 1-1",
      "1542479173749178428": "🎮・Voice Gaming"
    };

    for (const [id, name] of Object.entries(channelMap)) {
      const ch = channels.get(id);
      if (ch) {
        await ch.setName(name).catch(console.error);
        console.log(`   + Channel: ${name}`);
      }
    }

    // Helper refresh channel messages
    async function refreshChannel(channel, fn) {
      if (!channel) return;
      try {
        const messages = await channel.messages.fetch({ limit: 15 });
        for (const [id, msg] of messages) {
          if (msg.author.id === client.user.id) await msg.delete().catch(() => {});
        }
        await fn(channel);
        console.log(`   ✅ Embed updated: ${channel.name}`);
      } catch (e) {
        console.error(`   ❌ Error on ${channel.name}:`, e.message);
      }
    }

    console.log("🎨 Đang đăng các Embeds thiết kế tối giản, sang xịn chuẩn Studio lớn...");

    // 1. KÊNH THÔNG BÁO (📢ᵎᴛʜôɴɢ-ʙáᴏ)
    await refreshChannel(channels.get("1542479120036794418"), async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("✦ LS STUDIO • MINECRAFT DEVELOPMENT ✦")
        .setDescription(
          "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
          "👋 Chào mừng bạn đến với **LS STUDIO**!\n\n" +
          "Bên mình chuyên phát triển và tối ưu các **Plugin Minecraft & Hệ thống Anti-Cheat (Packet Level)** dành cho Spigot, Paper, Purpur và Folia.\n\n" +
          "▸ **Dịch Vụ Cung Cấp:**\n" +
          "• Plugin Anti-Cheat tự code (Chống Freecam, Chặn Hack Client, Chống Crash)\n" +
          "• Nhận lập trình Plugin độc quyền theo yêu cầu (Custom Dev)\n" +
          "• Tối ưu hiệu năng, fix lỗi lag TPS, port đa luồng Folia\n" +
          "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        )
        .addFields(
          { name: "💎 Sản Phẩm", value: `<#1542479128534716438>`, inline: true },
          { name: "💰 Bảng Giá", value: `<#1542479130900172910>`, inline: true },
          { name: "🛒 Mua Hàng", value: `<#1542479138839986227>`, inline: true }
        )
        .setFooter({ text: "LS STUDIO • Lead Developer: Nguyendzvn" });

      await ch.send({ embeds: [embed] });
    });

    // 2. KÊNH SẢN PHẨM (💎ᵎsảɴ-ᴘʜẩᴍ)
    await refreshChannel(channels.get("1542479128534716438"), async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("✦ DANH SÁCH SẢN PHẨM PLUGIN ✦")
        .setDescription(
          "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
          "Toàn bộ Plugin được viết bất đồng bộ (Async) trên nền tảng Packet, đảm bảo máy chủ luôn giữ **20.0 TPS**.\n" +
          "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        )
        .addFields(
          {
            name: "👁️ LS-AntiFreeCam & Obfuscator",
            value: "▸ **Tính năng:** Ẩn quặng và rương khi ngoài góc nhìn, trị triệt để Freecam, Chest ESP, Baritone.\n▸ **Hỗ trợ:** 1.18 - 1.21+ (Paper / Folia)\n▸ **Giá:** `150.000 VNĐ`"
          },
          {
            name: "🚫 LS-AntiClient & BrandShield",
            value: "▸ **Tính năng:** Nhận diện và chặn các client hack phổ biến (Meteor, LiquidBounce, Aristois, Wurst...).\n▸ **Hỗ trợ:** 1.18 - 1.21+\n▸ **Giá:** `180.000 VNĐ`"
          },
          {
            name: "⚡ LS-PacketGuard & AntiCrash",
            value: "▸ **Tính năng:** Lọc packet dị thường, chặn 100% các công cụ crash server (NBT exploit, book crash, slot crash).\n▸ **Giá:** `120.000 VNĐ`"
          },
          {
            name: "🤖 LS-AntiBot & ConnectionShield",
            value: "▸ **Tính năng:** Chặn spam login bot net, lọc IP proxy/VPN bẩn làm nghẽn server.\n▸ **Giá:** `100.000 VNĐ`"
          },
          {
            name: "👑 LS-TotalSecurity (Trọn Bộ 4 Module)",
            value: "▸ **Bao gồm:** Cả 4 plugin trên tích hợp trong 1 bản build tối ưu.\n▸ **Giá Trọn Gói:** `390.000 VNĐ` *(Tiết kiệm 30%)*"
          }
        )
        .setFooter({ text: "Mở Ticket tại #🛒ᵎmua-plugin để được hỗ trợ giao dịch!" });

      await ch.send({ embeds: [embed] });
    });

    // 3. KÊNH BẢNG GIÁ (💰ᵎʙảɴɢ-ɢɪá)
    await refreshChannel(channels.get("1542479130900172910"), async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#FEE75C")
        .setTitle("✦ BẢNG GIÁ & PHƯƠNG THỨC THANH TOÁN ✦")
        .setDescription(
          "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
          "▸ **1. Plugin Đóng Gói Sẵn:**\n" +
          "• LS-AntiFreeCam: `150.000đ`\n" +
          "• LS-AntiClient: `180.000đ`\n" +
          "• LS-PacketGuard (AntiCrash): `120.000đ`\n" +
          "• LS-AntiBot: `100.000đ`\n" +
          "• Full Combo 4 Module: `390.000đ`\n\n" +
          "▸ **2. Nhận Code Plugin Theo Yêu Cầu:**\n" +
          "• Plugin nhỏ (lệnh, GUI, tiện ích): `50k - 150k`\n" +
          "• Plugin vừa (gameplay, event, anti-dupe): `200k - 500k`\n" +
          "• Hệ thống lớn: Thỏa thuận theo độ phức tạp\n\n" +
          "▸ **3. Cam Kết & Bảo Hành:**\n" +
          "• Miễn phí fix lỗi bug và cập nhật vá bypass định kỳ.\n" +
          "• Hỗ trợ cấu hình trực tiếp vào server.\n\n" +
          "▸ **4. Cổng Thanh Toán:**\n" +
          "• MBBank: `844515133333` (VAN HUU PHAM NGUYEN) - Quét mã VietQR tự động 24/7\n" +
          "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        )
        .setFooter({ text: "Giao dịch an toàn qua Ticket tại LS STUDIO" });

      await ch.send({ embeds: [embed] });
    });

    // 4. KÊNH MUA PLUGIN (🛒ᵎᴍᴜᴀ-ᴘʟᴜɢɪɴ)
    await refreshChannel(channels.get("1542479138839986227"), async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#57F287")
        .setTitle("✦ MUA PLUGIN & MỞ TICKET ✦")
        .setDescription(
          "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
          "Bạn muốn mua Plugin Anti-Cheat hoặc cần đặt làm Plugin riêng?\n\n" +
          "👉 Nhấn nút **[🛒 Mua Plugin / Mở Ticket]** bên dưới để tạo kênh giao dịch riêng tư.\n" +
          "Hệ thống sẽ tạo mã **VietQR MBBank** kèm số tiền chính xác để bạn thanh toán nhanh trong 3 giây!\n" +
          "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        )
        .setFooter({ text: "LS STUDIO • Hệ thống thanh toán VietQR tự động" });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_buy')
          .setLabel('🛒 Mua Plugin / Mở Ticket')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('ticket_pricing')
          .setLabel('💰 Xem Bảng Giá')
          .setStyle(ButtonStyle.Secondary)
      );

      await ch.send({ embeds: [embed], components: [row] });
    });

    // 5. KÊNH SERVER TEST DEMO (🌐ᵎsᴇʀᴠᴇʀ-ᴛᴇsᴛ)
    await refreshChannel(channels.get("1542479132758384650"), async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#EB459E")
        .setTitle("✦ MÁY CHỦ THỰC CHIẾN: NGUYEN SMP ✦")
        .setDescription(
          "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
          "Trải nghiệm thực tế độ mượt mà của các Plugin Anti do LS Studio phát triển:\n\n" +
          "🎮 **Thông Tin Máy Chủ:**\n" +
          "• **IP:** `fusion.pikamc.vn:26111`\n" +
          "• **Phiên bản:** `1.21+` (Java Edition)\n" +
          "• Đang vận hành chính thức 24/7 với hệ thống Anti của LS Studio.\n" +
          "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        )
        .addFields(
          { name: "🔗 Discord Nguyen SMP", value: "https://discord.gg/vjFkC6cRdj" }
        )
        .setFooter({ text: "LS STUDIO x Nguyen SMP" });

      const btn = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('👉 Vào Discord Nguyen SMP')
          .setStyle(ButtonStyle.Link)
          .setURL('https://discord.gg/vjFkC6cRdj')
      );

      await ch.send({ embeds: [embed], components: [btn] });
    });

    // 6. KÊNH LUẬT (📜ᵎʟᴜậᴛ-ʟệ)
    await refreshChannel(channels.get("1542479117880922183"), async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#ED4245")
        .setTitle("✦ ĐIỀU KHOẢN & BẢN QUYỀN PLUGIN ✦")
        .setDescription(
          "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
          "▸ **1. Giấy Phép Sử Dụng:**\n" +
          "• Plugin mua về dùng cho server của bạn. Không share công khai, leak file hoặc bán lại.\n\n" +
          "▸ **2. Hỗ Trợ & Cập Nhật:**\n" +
          "• Hỗ trợ hướng dẫn cấu hình chi tiết.\n" +
          "• Cập nhật bản vá lỗi miễn phí khi có hack bypass mới.\n\n" +
          "▸ **3. Đặt Code Plugin Riêng:**\n" +
          "• Trao đổi ý tưởng ➔ Báo giá & hẹn ngày bàn giao ➔ Cọc 50% ➔ Test trên server demo ➔ Thanh toán 50% còn lại và nhận full file jar.\n" +
          "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        )
        .setFooter({ text: "LS STUDIO" });

      await ch.send({ embeds: [embed] });
    });

    console.log("🎉 DECOR HOÀN TẤT THEO PHONG CÁCH STUDIO LỚN 100%!");
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
