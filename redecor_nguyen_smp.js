const fs = require('fs');
const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ChannelType
} = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN || (fs.existsSync('./token.local.js') ? require('./token.local.js').TOKEN : 'YOUR_BOT_TOKEN_HERE');
const NGUYEN_SMP_GUILD_ID = "1462028925046620265";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.once('clientReady', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}! Re-decorating Nguyen SMP...`);

  try {
    const guild = await client.guilds.fetch(NGUYEN_SMP_GUILD_ID);
    const channels = await guild.channels.fetch();

    console.log(`🏰 Transforming ${guild.name}...`);

    // 1. CẬP NHẬT TÊN VÀ PHÂN LOẠI CATEGORIES
    const catInfo = channels.get("1503038475866476694");
    if (catInfo) await catInfo.setName("📌 ━━━ THÔNG TIN SMP ━━━").catch(console.error);

    const catCommunity = channels.get("1462028925944336587");
    if (catCommunity) await catCommunity.setName("💬 ━━━ SẢNH SINH TỒN ━━━").catch(console.error);

    const catLogs = channels.get("1504408794451673158");
    if (catLogs) await catLogs.setName("📊 ━━━ HỆ THỐNG & LOGS ━━━").catch(console.error);

    const catVoice = channels.get("1462028925944336590");
    if (catVoice) await catVoice.setName("🔊 ━━━ KÊNH ĐÀM THOẠI ━━━").catch(console.error);

    // Tạo thêm Category Cửa Hàng & Hỗ Trợ nếu chưa có
    let catShop = channels.find(c => c && c.type === ChannelType.GuildCategory && c.name.includes("CỬA HÀNG"));
    if (!catShop) {
      catShop = await guild.channels.create({
        name: "🛒 ━━━ CỬA HÀNG & HỖ TRỢ ━━━",
        type: ChannelType.GuildCategory
      });
    }

    // 2. CHUẨN HÓA TÊN KÊNH
    const renameMap = {
      "1462037958906478673": "📢・thông-báo-smp",
      "1462038175772971174": "📜・luật-máy-chủ",
      "1506965111745679420": "🤝・hợp-tác-đối-tác",
      "1510238533795713194": "🎁・sự-kiện-event",
      "1504407345587814491": "💬・trò-chuyện-chung",
      "1504407413195800648": "📸・ảnh-và-clip-mc",
      "1535608476745863238": "💡・góp-ý-máy-chủ",
      "1462610707530125423": "❓・hỏi-đáp-tân-thủ",
      "1515061672316895394": "🤖・lệnh-bot-game",
      "1465707346650202122": "🔥・chat-tự-do-toxic",
      "1536021323766042754": "💸・cửa-hàng-donate",
      "1498374824752451886": "🎟️・mở-ticket-hỗ-trợ",
      "1504409191643877536": "🌿・server-logs",
      "1506962482923831366": "🖥️・console-trạng-thái",
      "1462028925944336591": "🔊・Sảnh Chờ Sinh Tồn",
      "1465706489510367326": "🎮・Voice Chơi Game 1",
      "1465706621534470347": "🎮・Voice Chơi Game 2",
      "1465707066961166490": "🎮・Voice Chơi Game 3",
      "1465706552265805884": "🎧・Nghe Nhạc & Treo Voice",
      "1462028925944336592": "💤・Phòng Treo AFK"
    };

    for (const [chId, newName] of Object.entries(renameMap)) {
      const ch = channels.get(chId);
      if (ch) {
        try {
          await ch.setName(newName);
          console.log(`   + Renamed: ${newName}`);
        } catch (e) {
          console.warn(`   ! Error renaming ${chId}: ${e.message}`);
        }
      }
    }

    // Di chuyển kênh shop và ticket vào Category Shop
    const chSell = channels.get("1536021323766042754");
    if (chSell && catShop) await chSell.setParent(catShop.id).catch(() => {});

    const chTicket = channels.get("1498374824752451886");
    if (chTicket && catShop) await chTicket.setParent(catShop.id).catch(() => {});

    // Kiểm tra kênh IP kết nối nếu chưa có thì tạo
    let chIp = channels.find(c => c && c.name.includes("ip-kết-nối") || c.name.includes("ip-server"));
    if (!chIp && catInfo) {
      chIp = await guild.channels.create({
        name: "🌐・ip-kết-nối-game",
        type: ChannelType.GuildText,
        parent: catInfo.id,
        topic: "Thông tin IP kết nối và cổng vào máy chủ Nguyen SMP"
      });
    }

    console.log("📝 Đang đăng các Embeds thiết kế mới siêu đẹp...");

    // 1. EMBED LUẬT MÁY CHỦ
    const chRules = channels.get("1462038175772971174");
    if (chRules) {
      const embedRules = new EmbedBuilder()
        .setColor("#FF3D00")
        .setTitle("📜 NỘI QUY MÁY CHỦ - NGUYEN SMP")
        .setDescription(
          "Chào mừng bạn gia nhập đại gia đình **Nguyen SMP**! Hãy cùng nhau xây dựng một cộng đồng sinh tồn văn minh, vui vẻ và bền vững bằng cách tuân thủ các quy định dưới đây:"
        )
        .addFields(
          {
            name: "1️⃣ Chống Gian Lận & Hack/Cheat",
            value: "• **Nghiêm cấm 100%** sử dụng các bản Hack Client (Meteor, LiquidBounce, Aristois...), Freecam, X-Ray, Auto-Mine, Fly, Speed.\n• Máy chủ được trang bị hệ thống **Anti-Cheat độc quyền bởi LS STUDIO** — Vi phạm sẽ bị Ban tự động vĩnh viễn!"
          },
          {
            name: "2️⃣ Quy Định Sinh Tồn & PvP",
            value: "• Tôn trọng công trình của người chơi khác. Không cố tình phá hoại (Grief) vô cớ.\n• Muốn PvP / War phân định thắng thua hãy hẹn nhau tại khu vực Arena hoặc thoả thuận trước."
          },
          {
            name: "3️⃣ Văn Hóa Ứng Xử & Giao Tiếp",
            value: "• Hòa đồng, lịch sự, tôn trọng các thành viên và Admin.\n• Không spam chat, chửi bới xúc phạm gia đình, không gửi link độc hại/scam.\n• Muốn 'var' nhau hãy lên voice hoặc vào game solo công bằng!"
          },
          {
            name: "4️⃣ Kinh Tế & Giao Dịch",
            value: "• Admin không can thiệp vào thị trường tự do. Member tự do trade, đấu giá và trao đổi item với nhau."
          }
        )
        .setFooter({ text: "Nguyen SMP • Sân Chơi Sinh Tồn Đỉnh Cao", iconURL: guild.iconURL() })
        .setTimestamp();

      await chRules.send({ embeds: [embedRules] });
    }

    // 2. EMBED IP KẾT NỐI
    if (chIp) {
      const embedIp = new EmbedBuilder()
        .setColor("#00E5FF")
        .setTitle("🌐 THÔNG TIN KẾT NỐI - NGUYEN SMP")
        .setDescription(
          "🎮 **Máy chủ Minecraft Survival SMP 1.21+** chính thức mở cửa chào đón tất cả anh em game thủ!\n\n" +
          "🕹️ **ĐỊA CHỈ KẾT NỐI MÁY CHỦ:**\n" +
          "• **IP Server:** `fusion.pikamc.vn:26111`\n" +
          "• **Phiên bản:** `1.20.x - 1.21.x` (PC Java Edition)\n" +
          "• **Tình trạng:** `ONLINE 24/7` - Mượt mà không lag!\n\n" +
          "🛡️ **BẢO MẬT & CÔNG NGHỆ:**\n" +
          "Được vận hành trên nền tảng Paper/Purpur và bảo vệ 24/7 bởi hệ thống **Anti-Cheat LS STUDIO**!"
        )
        .addFields(
          { name: "💬 Kênh Chat Giao Lưu", value: `<#1504407345587814491>`, inline: true },
          { name: "🎟️ Báo Lỗi / Hỗ Trợ", value: `<#1498374824752451886>`, inline: true }
        )
        .setFooter({ text: "Chúc anh em chơi game vui vẻ tại Nguyen SMP!" });

      await chIp.send({ embeds: [embedIp] });
    }

    // 3. EMBED DONATE & CỬA HÀNG
    if (chSell) {
      const embedDonate = new EmbedBuilder()
        .setColor("#FFD600")
        .setTitle("💸 CỬA HÀNG DONATE & ỦNG HỘ MÁY CHỦ")
        .setDescription(
          "Mọi khoản đóng góp của bạn đều được dùng 100% vào việc **chi trả tiền thuê máy chủ, nâng cấp RAM/CPU và duy trì hệ thống Anti-Cheat** cho Nguyen SMP hoạt động lâu dài!\n\n" +
          "🌟 **QUYỀN LỢI KHI DONATE:**\n" +
          "• Nhận Role **VIP / Sponsor** nổi bật trong Discord & trong Game.\n" +
          "• Danh hiệu (Tag) độc quyền, hiệu ứng hạt thời trang (Cosmetics) không gây mất cân bằng game.\n\n" +
          "💳 **THÔNG TIN DONATE:**\n" +
          "• **Ngân Hàng:** MBBank\n" +
          "• **STK:** `844515133333`\n" +
          "• **Chủ TK:** `VAN HUU PHAM NGUYEN`\n" +
          "• **Nội dung:** `SMP <Tên Ingame>`"
        )
        .setFooter({ text: "Cảm ơn tất cả anh em đã luôn đồng hành cùng Nguyen SMP!" });

      await chSell.send({ embeds: [embedDonate] });
    }

    // 4. EMBED TICKET HỖ TRỢ
    if (chTicket) {
      const embedTicket = new EmbedBuilder()
        .setColor("#3D5AFE")
        .setTitle("🎟️ TRUNG TÂM HỖ TRỢ NGƯỜI CHƠI - NGUYEN SMP")
        .setDescription(
          "Gặp lỗi kẹt tài khoản? Bị mất đồ do lỗi hệ thống? Hoặc muốn tố cáo người chơi gian lận hack/cheat?\n\n" +
          "👉 Hãy nhắn trực tiếp yêu cầu hoặc mở ticket tại đây để Admin hỗ trợ xử lý ngay nhé!"
        );

      await chTicket.send({ embeds: [embedTicket] });
    }

    console.log("🎉 RE-DECOR NGUYEN SMP HOÀN TẤT 100%!");
    process.exit(0);

  } catch (error) {
    console.error("❌ Lỗi re-decor:", error);
    process.exit(1);
  }
});

client.login(TOKEN);
