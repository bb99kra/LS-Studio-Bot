const fs = require('fs');
const { 
  Client,
  Events, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN || (fs.existsSync('./token.local.js') ? require('./token.local.js').TOKEN : 'YOUR_BOT_TOKEN_HERE');
const NGUYEN_SMP_GUILD_ID = "1462028925046620265";
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
  try {
    console.log(`🤖 Logged in as ${client.user.tag}! Làm lại toàn bộ văn phong tự nhiên, chuẩn game thủ dev...`);

  // Helper xóa tin bot cũ và đăng tin mới
  async function refreshChannel(channel, fn) {
    if (!channel) return;
    try {
      const messages = await channel.messages.fetch({ limit: 15 });
      for (const [id, msg] of messages) {
        if (msg.author.id === client.user.id) await msg.delete().catch(() => {});
      }
      await fn(channel);
      console.log(`   ✅ Làm sạch văn phong: ${channel.name}`);
    } catch (e) {
      console.error(`   ❌ Lỗi kênh ${channel.name}:`, e.message);
    }
  }

  // ========================================================
  // 1. NGUYEN SMP (GỌN GÀNG, TỰ NHIÊN, KHÔNG TÂN BỐC AI)
  // ========================================================
  console.log("🏰 Đang cập nhật Nguyen SMP...");
  const nguyenGuild = await client.guilds.fetch(NGUYEN_SMP_GUILD_ID);
  const nguyenChannels = await nguyenGuild.channels.fetch();

  // Kênh Hợp Tác / LS Studio
  await refreshChannel(nguyenChannels.find(c => c && c.name.includes("hợp-tác") || c.name.includes("hợᴘ・táᴄ")), async (ch) => {
    const embed = new EmbedBuilder()
      .setColor("#FF4500")
      .setTitle("🤝 LS STUDIO - SHOP PLUGIN CỦA ADMIN")
      .setDescription(
        "Chào anh em, **LS STUDIO** là nhóm làm plugin riêng của Admin.\n\n" +
        "Bên mình chuyên tự viết các plugin chống hack (chống Freecam, chặn Hack Client Meteor/Liquid, chống crash server) và nhận code plugin theo ý tưởng cho anh em nào mở server Minecraft.\n\n" +
        "Anh em nào có nhu cầu mua plugin hoặc cần làm plugin riêng thì ghé qua Discord ủng hộ mình nhé!"
      )
      .addFields(
        { name: "👑 Dev", value: "Nguyendzvn", inline: true },
        { name: "🔗 Discord", value: "https://discord.gg/2r2DdYcxPE", inline: true }
      )
      .setFooter({ text: "LS Studio • Plugin Minecraft" });

    const btn = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('👉 Vào Discord LS STUDIO')
        .setStyle(ButtonStyle.Link)
        .setURL('https://discord.gg/2r2DdYcxPE')
    );

    await ch.send({ embeds: [embed], components: [btn] });
  });

  // Kênh Luật
  await refreshChannel(nguyenChannels.get("1462038175772971174"), async (ch) => {
    const embed = new EmbedBuilder()
      .setColor("#FF3D00")
      .setTitle("📜 NỘI QUY NGUYEN SMP")
      .setDescription("Vào chơi anh em tuân thủ vài luật cơ bản này để tránh bị ăn ban nhé:")
      .addFields(
        {
          name: "1. Cấm Hack / Cheat",
          value: "• Cấm dùng tất cả các loại hack client (Meteor, Wurst, LiquidBounce...), Freecam, X-Ray, Baritone.\n• Phát hiện hack = Ban thẳng tay không giải thích nhiều."
        },
        {
          name: "2. Không Phá Nhà (Grief) Vô Cớ",
          value: "• Tôn trọng công sức xây dựng của người khác, không cố tình đập phá lung tung."
        },
        {
          name: "3. Nói Chuyện Lịch Sự",
          value: "• Không spam chat, chửi bới xúc phạm nhau hay gửi link bậy bạ. Muốn 'var' nhau thì vào game solo PvP công bằng."
        },
        {
          name: "4. Mua Bán Tự Do",
          value: "• Member tự do trade và trao đổi item với nhau, Admin không bán đồ can thiệp vào game."
        }
      )
      .setFooter({ text: "Nguyen SMP" });

    await ch.send({ embeds: [embed] });
  });

  // Kênh IP
  await refreshChannel(nguyenChannels.find(c => c && c.name.includes("ip-kết-nối")), async (ch) => {
    const embed = new EmbedBuilder()
      .setColor("#00E5FF")
      .setTitle("🌐 THÔNG TIN VÀO SERVER NGUYEN SMP")
      .setDescription(
        "🎮 **Địa chỉ kết nối:**\n" +
        "• **IP Server:** `fusion.pikamc.vn:26111`\n" +
        "• **Phiên bản:** `1.20.x - 1.21.x` (PC Java)\n" +
        "• Server mở 24/7, anh em cứ rảnh là vào chơi nhé!"
      )
      .setFooter({ text: "Nguyen SMP 1.21+" });

    await ch.send({ embeds: [embed] });
  });

  // Kênh Donate
  await refreshChannel(nguyenChannels.get("1536021323766042754"), async (ch) => {
    const embed = new EmbedBuilder()
      .setColor("#FFD600")
      .setTitle("💸 ỦNG HỘ SERVER (DONATE)")
      .setDescription(
        "Anh em chơi thấy vui, muốn ủng hộ chút kinh phí để duy trì tiền thuê máy chủ thì có thể donate qua đây nhé:\n\n" +
        "🏦 **Ngân hàng:** MBBank\n" +
        "🔢 **STK:** `844515133333`\n" +
        "👤 **Tên:** `VAN HUU PHAM NGUYEN`\n" +
        "📝 **Nội dung:** `SMP <Tên Ingame>`\n\n" +
        "Cảm ơn sự ủng hộ của tất cả anh em!"
      )
      .setFooter({ text: "Nguyen SMP" });

    await ch.send({ embeds: [embed] });
  });

  // Kênh Ticket Hỗ Trợ
  await refreshChannel(nguyenChannels.get("1498374824752451886"), async (ch) => {
    const embed = new EmbedBuilder()
      .setColor("#3D5AFE")
      .setTitle("🎟️ HỖ TRỢ NGƯỜI CHƠI")
      .setDescription(
        "Anh em bị kẹt tài khoản, lỗi game hay phát hiện người chơi khác hack thì nhắn vào đây hoặc mở ticket để Admin vào xử lý nhé!"
      );
    await ch.send({ embeds: [embed] });
  });


  // ========================================================
  // 2. LS STUDIO (CHÂN THỰC, ĐÚNG CHẤT DEV BÁN PLUGIN)
  // ========================================================
  console.log("🛡️ Đang cập nhật LS STUDIO...");
  const lsGuild = await client.guilds.fetch(LS_STUDIO_GUILD_ID);
  const lsChannels = await lsGuild.channels.fetch();

  // Thông báo chào mừng
  await refreshChannel(lsChannels.find(c => c && c.name.includes("thông-báo")), async (ch) => {
    const embed = new EmbedBuilder()
      .setColor("#FF4500")
      .setTitle("🚀 CHÀO MỪNG ĐẾN VỚI LS STUDIO")
      .setDescription(
        "Chào anh em! **LS STUDIO** chuyên tự code các **Plugin Minecraft & Giải Pháp Chống Hack (Anti-Cheat)** nhẹ mượt, chạy tốt trên Spigot, Paper và Folia.\n\n" +
        "🛠️ **Bên mình chuyên làm:**\n" +
        "• Plugin chống hack: Chặn Freecam, chặn Hack Client (Meteor, Liquid...), chống crash server.\n" +
        "• Nhận code plugin riêng theo yêu cầu của anh em.\n" +
        "• Tối ưu server, fix lỗi tụt TPS, port plugin sang Folia."
      )
      .addFields(
        { name: "📦 Xem Plugin", value: `<#${lsChannels.find(c => c.name.includes('danh-sách-plugin'))?.id}>`, inline: true },
        { name: "💰 Bảng Giá", value: `<#${lsChannels.find(c => c.name.includes('bảng-giá-dịch-vụ'))?.id}>`, inline: true },
        { name: "🛒 Mua Hàng", value: `<#${lsChannels.find(c => c.name.includes('mua-plugin'))?.id}>`, inline: true }
      )
      .setFooter({ text: "LS STUDIO • Minecraft Plugins by Nguyendzvn" });

    await ch.send({ embeds: [embed] });
  });

  // Danh sách plugin
  await refreshChannel(lsChannels.find(c => c && c.name.includes("danh-sách-plugin")), async (ch) => {
    const embed = new EmbedBuilder()
      .setColor("#00E676")
      .setTitle("💎 CÁC PLUGIN HIỆN CÓ CỦA LS STUDIO")
      .setDescription("Tất cả plugin đều do bên mình tự code, tối ưu async nhẹ nhàng cho Paper/Purpur/Folia 1.18 - 1.21+:")
      .addFields(
        {
          name: "👁️ 1. LS-AntiFreeCam (Chống Freecam / ESP / X-Ray)",
          value: "• Ẩn quặng và rương đồ khi bị che khuất, khắc chế triệt để Freecam, Chest ESP, Baritone đào tự động.\n• **Giá:** `150.000 VNĐ`"
        },
        {
          name: "🚫 2. LS-AntiClient (Chặn Hack Client)",
          value: "• Nhận diện và kick/ban các client hack như Meteor, LiquidBounce, Aristois, Wurst, Fabric Cheats...\n• **Giá:** `180.000 VNĐ`"
        },
        {
          name: "⚡ 3. LS-PacketGuard (Chống Crash Server)",
          value: "• Lọc packet dị thường, chặn các tool crash server (NBT exploit, book crash, slot crash).\n• **Giá:** `120.000 VNĐ`"
        },
        {
          name: "🤖 4. LS-AntiBot (Chống Spam Bot Login)",
          value: "• Chặn flood bot net, lọc IP proxy/VPN xấu làm lag cổng server.\n• **Giá:** `100.000 VNĐ`"
        },
        {
          name: "👑 5. Gói Trọn Bộ (Full 4 Plugin Trên)",
          value: "• Mua trọn bộ cả 4 plugin trên tiết kiệm hơn.\n• **Giá:** `390.000 VNĐ`"
        }
      )
      .setFooter({ text: "Cần mua gói nào anh em cứ vào kênh #mua-plugin mở ticket nhé!" });

    await ch.send({ embeds: [embed] });
  });

  // Bảng giá
  await refreshChannel(lsChannels.find(c => c && c.name.includes("bảng-giá-dịch-vụ")), async (ch) => {
    const embed = new EmbedBuilder()
      .setColor("#FFD600")
      .setTitle("💰 BẢNG GIÁ DỊCH VỤ LS STUDIO")
      .setDescription("Giá cả rõ ràng, hỗ trợ fix lỗi và cập nhật định kỳ:")
      .addFields(
        {
          name: "📦 1. Plugin Có Sẵn",
          value: "• Chống Freecam/ESP: `150k`\n• Chặn Hack Client: `180k`\n• Chống Crash Server: `120k`\n• Chống Bot Login: `100k`\n• Trọn bộ 4in1: `390k`"
        },
        {
          name: "🛠️ 2. Nhận Code Plugin Theo Yêu Cầu",
          value: "• Plugin tiện ích, lệnh nhỏ, GUI: `50k - 150k`\n• Hệ thống gameplay, event riêng: `200k - 500k`\n• Dự án lớn hơn: Thỏa thuận theo độ khó"
        },
        {
          name: "🛡️ 3. Cam Kết Hỗ Trợ",
          value: "• Hỗ trợ cấu hình cài đặt vào server.\n• Khi client hack ra bản mới tìm được cách bypass, bên mình sẽ update bản vá lỗi miễn phí cho anh em."
        },
        {
          name: "💳 4. Thanh Toán",
          value: "• Quét mã VietQR MBBank tự động hoặc chuyển khoản trực tiếp."
        }
      )
      .setFooter({ text: "Giao dịch an toàn qua Ticket tại Server!" });

    await ch.send({ embeds: [embed] });
  });

  // Demo Server
  await refreshChannel(lsChannels.find(c => c && c.name.includes("server-test-demo")), async (ch) => {
    const embed = new EmbedBuilder()
      .setColor("#9C27B0")
      .setTitle("🌐 SERVER TEST THỰC TẾ: NGUYEN SMP")
      .setDescription(
        "Anh em muốn test thử độ mượt và hiệu quả bắt hack thực tế thì vào server Nguyen SMP chơi thử nhé:\n\n" +
        "• **IP Server:** `fusion.pikamc.vn:26111`\n" +
        "• **Phiên bản:** `1.21+` (Java)\n" +
        "• Server đang chạy thực tế 24/7 với hệ thống plugin Anti của LS Studio."
      )
      .addFields(
        { name: "🔗 Discord Nguyen SMP", value: "https://discord.gg/vjFkC6cRdj" }
      )
      .setFooter({ text: "LS STUDIO x Nguyen SMP" });

    const btnSmp = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('👉 Vào Discord Nguyen SMP')
        .setStyle(ButtonStyle.Link)
        .setURL('https://discord.gg/vjFkC6cRdj')
    );

    await ch.send({ embeds: [embed], components: [btnSmp] });
  });

  // Luật LS Studio
  await refreshChannel(lsChannels.find(c => c && c.name.includes("luật-và-chính-sách")), async (ch) => {
    const embed = new EmbedBuilder()
      .setColor("#FF4500")
      .setTitle("📜 QUY ĐỊNH MUA PLUGIN - LS STUDIO")
      .setDescription("Anh em mua plugin đọc qua vài quy định ngắn gọn này nhé:")
      .addFields(
        {
          name: "1. Bản Quyền Plugin",
          value: "• Plugin mua về dùng cho server của anh em. Vui lòng không share bậy bạ, leak công khai hay bán lại."
        },
        {
          name: "2. Hỗ Trợ & Bảo Hành",
          value: "• Hỗ trợ hướng dẫn cài đặt và cấu hình.\n• Nếu có lỗi bug phát sinh hoặc bị bypass, bên mình sẽ fix và cập nhật miễn phí."
        },
        {
          name: "3. Đặt Code Plugin Riêng",
          value: "• Trao đổi ý tưởng -> Thống nhất giá và thời gian -> Cọc 50% -> Code và test trên server demo -> Bàn giao full file."
        }
      )
      .setFooter({ text: "LS STUDIO" });

    await ch.send({ embeds: [embed] });
  });

  console.log("🎉 ĐÃ LÀM SẠCH VĂN PHONG 100% TRÊN CẢ 2 SERVER!");

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
