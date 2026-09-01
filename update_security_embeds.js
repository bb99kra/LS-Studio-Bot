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
const GUILD_ID = "1542476657825419334";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// Helper: Pacing delay to prevent Discord 429 Rate Limits
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  console.log(`🤖 Logged in as ${client.user.tag}! Cập nhật nội dung chuyên về Anti-Cheat / Anti-Client...`);

  try {
    const guild = await client.guilds.fetch(GUILD_ID).catch(err => {
      console.error(`❌ [ERROR] Không thể fetch Guild (${GUILD_ID}):`, err.message || err);
      return null;
    });
    if (!guild) {
      console.error(`❌ [ERROR] Không tìm thấy Guild (${GUILD_ID}) hoặc Bot chưa tham gia.`);
      return await cleanupAndExit(1);
    }
    const channels = await guild.channels.fetch();

    // Helper xóa tin nhắn cũ của bot trong kênh để đăng embed mới
    async function refreshChannelMessages(chName, createEmbedsFn) {
      const channel = channels.find(c => c && c.name.includes(chName));
      if (!channel) {
        console.warn(`! Không tìm thấy kênh ${chName}`);
        return;
      }
      try {
        const messages = await channel.messages.fetch({ limit: 20 });
        for (const [id, msg] of messages) {
          if (msg.author.id === client.user.id) {
            await msg.delete();
          }
        }
        await createEmbedsFn(channel);
        console.log(`✅ Đã cập nhật nội dung kênh: ${channel.name}`);
      } catch (err) {
        console.error(`❌ Lỗi khi cập nhật kênh ${chName}:`, err.message);
      }
    }

    // 1. KÊNH THÔNG BÁO
    await refreshChannelMessages("thông-báo", async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#FF3D00")
        .setTitle("🛡️ CHÀO MỪNG ĐẾN VỚI LS STUDIO - SECURITY & ANTI-CHEAT SOLUTIONS!")
        .setDescription(
          "👋 Chào toàn thể các Chủ Server & Quản Trị Viên Minecraft!\n\n" +
          "**LS STUDIO** là đơn vị chuyên nghiên cứu và phát triển các **Giải Pháp Bảo Mật, Anti-Cheat & Anti-Client Chuyên Sâu** hàng đầu cho máy chủ Minecraft (Spigot / Paper / Purpur / Folia).\n\n" +
          "🔥 **THẾ MẠNH & CÔNG NGHỆ CỦA LS STUDIO:**\n" +
          "• 🚫 **Anti-Client / Mod Detection:** Nhận diện và chặn đứng các Hacked Client phổ biến (*Meteor, LiquidBounce, Aristois, Wurst, Sigma, v.v.*) ngay từ tầng Packet.\n" +
          "• 👁️ **Anti-Freecam & Anti-ESP Độc Quyền:** Thuật toán Raytracing và Occlusion Culling ngăn chặn triệt để hack Freecam, soi rương/khoáng sản X-Ray và ESP người chơi.\n" +
          "• ⚡ **Anti-Crash & Exploit Protection:** Chặn 100% các hình thức gửi gói tin Crash Server, NBT Exploit, Book Crash, Spam Payload, Click Window Crash.\n" +
          "• 🤖 **Anti-Bot & Proxy Blocker:** Hệ thống Captcha nhẹ nhàng, chặn spam login bot và lọc IP VPN/Proxy xấu.\n" +
          "• 🚀 **Tối Ưu Packet Tột Đỉnh:** Thuật toán kiểm tra Asynchronous, không gây tụt TPS / giật lag server kể cả khi có 100+ người chơi online cùng lúc!"
        )
        .addFields(
          { name: "🛡️ Xem Sản Phẩm Anti", value: `<#${channels.find(c => c.name.includes('danh-sách-plugin'))?.id}>`, inline: true },
          { name: "💰 Xem Bảng Giá", value: `<#${channels.find(c => c.name.includes('bảng-giá-dịch-vụ'))?.id}>`, inline: true },
          { name: "🛒 Mua & Đặt Hàng", value: `<#${channels.find(c => c.name.includes('mua-plugin'))?.id}>`, inline: true }
        )
        .setFooter({ text: "LS STUDIO • Bảo Vệ Toàn Diện Cho Máy Chủ Của Bạn", iconURL: client.user.displayAvatarURL() });

      await ch.send({ embeds: [embed] });
    });

    // 2. KÊNH DANH SÁCH PLUGIN (SHOWCASE ANTI)
    await refreshChannelMessages("danh-sách-plugin", async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#00E676")
        .setTitle("🛡️ HỆ SINH THÁI PLUGIN ANTI & BẢO MẬT - LS STUDIO")
        .setDescription("Tất cả các Plugin Anti của LS Studio đều được viết trên nền tảng **Packet ProtocolLib / PacketEvents**, kiểm tra bất đồng bộ (Async) giúp Server giữ vững **20.0 TPS**.")
        .addFields(
          {
            name: "👁️ 1. LS-AntiFreeCam & Obfuscator (Chống Freecam / ESP / X-Ray)",
            value: 
              "• **Tính năng:** Thuật toán ẩn hoàn toàn Entity, Rương đồ (TileEntity) và Block khoáng sản khi bị che khuất hoặc ngoài góc nhìn của Player.\n" +
              "• **Khắc chế triệt để:** Freecam Mod, Baritone Auto-Mine, Chest ESP, Player ESP, Tracers.\n" +
              "• **Ưu điểm:** Cực nhẹ, không tốn RAM như Orebfuscator truyền thống.\n" +
              "• **Hỗ trợ:** Spigot / Paper / Purpur / Folia (1.16 - 1.21+)\n" +
              "• **Giá:** `150.000 VNĐ`"
          },
          {
            name: "🚫 2. LS-AntiClient & BrandShield (Chặn Hacked Client & Mod Cấm)",
            value: 
              "• **Tính năng:** Phân tích cấu trúc Packet bắt tay (Handshake), Payload kênh ẩn (Custom Payload Channels), giả lập môi trường Vanilla.\n" +
              "• **Khắc chế:** Tự động phát hiện và Kick / Ban các client như Meteor, LiquidBounce, Aristois, Wurst, Fabric Hacks, MiniMap có Entity Radar.\n" +
              "• **Tùy chỉnh:** Cho phép tạo White-list client hợp lệ (Lunar, Badlion, Feather, Vanilla).\n" +
              "• **Giá:** `180.000 VNĐ`"
          },
          {
            name: "⚡ 3. LS-PacketGuard & AntiCrash (Tường Lửa Chống Crash / Exploit)",
            value: 
              "• **Tính năng:** Giới hạn tốc độ Packet (Rate-Limiter), lọc sạch các packet rác mang kích thước dị thường (Malformed NBT, Invalid Slot, Oversized Book, Place Block Spam).\n" +
              "• **Khắc chế:** 100% các công cụ Crash Server phổ biến trên GitHub/YouTube.\n" +
              "• **Giá:** `120.000 VNĐ`"
          },
          {
            name: "🤖 4. LS-AntiBot & ConnectionShield (Chống Spam Bot Login)",
            value: 
              "• **Tính năng:** Kiểm tra kết nối đa tầng, lọc IP Proxy/VPN, xác thực chuyển động nhẹ trước khi cho phép vào thế giới.\n" +
              "• **Khắc chế:** Đợt tấn công Bot Net, Bot Flooder làm nghẽn cổng Server.\n" +
              "• **Giá:** `100.000 VNĐ`"
          },
          {
            name: "👑 5. [GÓI TRỌN BỘ] LS-TotalSecurity Suite",
            value: 
              "• Bao gồm toàn bộ 4 Module Anti trên tích hợp chung vào 1 Plugin duy nhất.\n" +
              "• Tặng kèm bộ Config tối ưu sẵn + Hỗ trợ setup trực tiếp vào server.\n" +
              "• **Giá Trọn Gói:** `390.000 VNĐ` *(Tiết kiệm hơn 30%)*"
          }
        )
        .setFooter({ text: "Muốn test thử hãy vào kênh #server-test-demo hoặc mở Ticket tại #mua-plugin!" });

      await ch.send({ embeds: [embed] });
    });

    // 3. KÊNH BẢNG GIÁ DỊCH VỤ
    await refreshChannelMessages("bảng-giá-dịch-vụ", async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#FFD600")
        .setTitle("💰 BẢNG GIÁ DỊCH VỤ ANTI & BẢO MẬT - LS STUDIO")
        .setDescription("Chính sách giá rõ ràng, hỗ trợ cập nhật thuật toán vá lỗi bypass định kỳ miễn phí.")
        .addFields(
          {
            name: "📦 1. Bảng Giá Các Gói Anti-Cheat Đóng Gói Sẵn",
            value: 
              "• 👁️ **LS-AntiFreeCam & ESP:** `150.000đ`\n" +
              "• 🚫 **LS-AntiClient / Mod Detection:** `180.000đ`\n" +
              "• ⚡ **LS-AntiCrash / PacketShield:** `120.000đ`\n" +
              "• 🤖 **LS-AntiBot & Proxy:** `100.000đ`\n" +
              "• 👑 **LS-TotalSecurity (Full Suite 4in1):** `390.000đ`"
          },
          {
            name: "🛠️ 2. Dịch Vụ Viết Check Anti Riêng Theo Yêu Cầu (Custom Anti-Check)",
            value: 
              "• **Fix Bypass / Thêm Check Hack Cụ Thể:** `50.000đ - 150.000đ`\n" +
              "• **Viết Anti-Dupe / Anti-Exploit Độc Quyền Cho Server RPG/Faction:** `150.000đ - 300.000đ`\n" +
              "• **Audit Bảo Mật & Quét Lỗ Hổng Toàn Diện Cho Server:** `100.000đ - 200.000đ`"
          },
          {
            name: "🛡️ 3. Chính Sách Bảo Hành & Cam Kết",
            value: 
              "• **Bảo hành False Positive:** Cam kết hỗ trợ tinh chỉnh config hoặc code để người chơi hợp lệ (Legit) không bao giờ bị bắt nhầm.\n" +
              "• **Update Bypass:** Khi có phiên bản Hacked Client mới tìm ra cách bypass, LS Studio sẽ phát hành bản vá cập nhật hoàn toàn miễn phí cho khách hàng!"
          },
          {
            name: "💳 4. Cổng Thanh Toán Hỗ Trợ",
            value: "• 🏦 **Chuyển Khoản Ngân Hàng (VietQR 24/7):** Nhận diện nhanh\n• 📱 **Ví MoMo:** Tiện lợi\n• 🌐 **Thẻ Cào Điện Thoại**"
          }
        )
        .setFooter({ text: "Giao dịch an toàn qua Ticket chính thức tại Server LS Studio!" });

      await ch.send({ embeds: [embed] });
    });

    // 4. KÊNH SERVER TEST DEMO
    await refreshChannelMessages("server-test-demo", async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#9C27B0")
        .setTitle("🌐 MÁY CHỦ THỬ NGHIỆM ANTI (DEMO SERVER)")
        .setDescription(
          "Bạn muốn tự tay test thử khả năng chặn hack của LS Studio trước khi mua?\n\n" +
          "🕹️ **Thông tin kết nối Server Test:**\n" +
          "• **Địa chỉ IP:** `kinetic.pikamc.vn:25565`\n" +
          "• **Phiên bản:** `1.20.x - 1.21.x`\n\n" +
          "⚔️ **Bạn có thể mang bất kỳ Client Hack nào vào test:**\n" +
          "• Bật **Freecam / Baritone** -> Xem có nhìn xuyên thấu rương/block được không.\n" +
          "• Bật **Meteor / LiquidBounce** -> Xem hệ thống Brand & Packet Shield xử lý.\n" +
          "• Gửi **Packet Crash / Exploit** -> Kiểm tra độ ổn định của Server.\n\n" +
          "💬 *Nếu cần kích hoạt các chế độ test đặc biệt, hãy liên hệ Dev qua kênh Ticket nhé!*"
        );

      await ch.send({ embeds: [embed] });
    });

    // 5. KÊNH LUẬT & CHÍNH SÁCH
    await refreshChannelMessages("luật-và-chính-sách", async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#FF4500")
        .setTitle("📜 QUY ĐỊNH & CAM KẾT DỊCH VỤ ANTI - LS STUDIO")
        .setDescription("Để đảm bảo quyền lợi và sự minh bạch cao nhất cho cả hai bên, vui lòng đọc kỹ các điều khoản sau:")
        .addFields(
          { 
            name: "1️⃣ Bản Quyền & Giấy Phép Sử Dụng (License)", 
            value: "• Mỗi bản Plugin Anti được cấp phép sử dụng cho server của người mua.\n• Nghiêm cấm hành vi chia sẻ, leak công khai, share cho server đối thủ hoặc decompile mã nguồn.\n• Vi phạm sẽ bị thu hồi quyền cập nhật và khóa Key sử dụng vĩnh viễn."
          },
          { 
            name: "2️⃣ Cam Kết Về Tỉ Lệ Bắt Chuẩn & False Positives", 
            value: "• LS Studio luôn hướng đến tiêu chí: **Chặn đứng Hack nhưng không ảnh hưởng đến trải nghiệm của người chơi bình thường (Legit)**.\n• Nếu phát hiện bất kỳ trường hợp nào người chơi thường bị kick nhầm, Dev sẽ hỗ trợ fix ngay trong vòng 24h."
          },
          { 
            name: "3️⃣ Hỗ Trợ Tương Thích & Đa Luồng (Paper / Purpur / Folia)", 
            value: "• Toàn bộ code Anti được tối ưu Asynchronous và tương thích hoàn toàn với kiến trúc đa luồng của **Folia**."
          }
        )
        .setFooter({ text: "LS STUDIO • Giải Pháp Chống Hack Hàng Đầu Cho Minecraft", iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

      await ch.send({ embeds: [embed] });
    });

    // 6. KÊNH MUA HÀNG (TICKET BUY)
    await refreshChannelMessages("mua-plugin", async (ch) => {
      const embedOrder = new EmbedBuilder()
        .setColor("#00E676")
        .setTitle("🛒 TRUNG TÂM ĐẶT MUA PLUGIN ANTI - LS STUDIO")
        .setDescription(
          "Bạn muốn trang bị giải pháp bảo mật tối tân để bảo vệ máy chủ khỏi Hacked Client, Freecam và Crash?\n\n" +
          "👉 **Quy trình mua hàng siêu tốc:**\n" +
          "1. Nhấn vào nút **[🛒 Mua Plugin / Mở Ticket]** bên dưới.\n" +
          "2. Chọn gói Anti hoặc Module bạn cần mua.\n" +
          "3. Quét mã VietQR thanh toán -> Nhận ngay file `.jar`, hướng dẫn cài đặt & Role Khách Hàng!\n\n" +
          "⚡ *Đội ngũ Developer luôn sẵn sàng hỗ trợ bạn cấu hình trực tiếp vào server!*"
        );

      const rowOrder = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_buy')
          .setLabel('🛒 Mua Plugin / Mở Ticket')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('ticket_pricing')
          .setLabel('💰 Xem Bảng Giá')
          .setStyle(ButtonStyle.Secondary)
      );

      await ch.send({ embeds: [embedOrder], components: [rowOrder] });
    });

    console.log("🎉 ĐÃ CẬP NHẬT XONG TOÀN BỘ NỘI DUNG CHUYÊN VỀ PLUGIN ANTI!");
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
