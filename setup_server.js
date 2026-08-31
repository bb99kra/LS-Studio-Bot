const fs = require('fs');
const { 
  Client, 
  GatewayIntentBits, 
  PermissionsBitField, 
  ChannelType, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN || (fs.existsSync('./token.local.js') ? require('./token.local.js').TOKEN : 'YOUR_BOT_TOKEN_HERE');
const GUILD_ID = "1542476657825419334";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}! Starting LS STUDIO server setup...`);

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    if (!guild) {
      console.error("❌ Guild not found!");
      process.exit(1);
    }

    console.log(`🏰 Target Server: ${guild.name} (${guild.id})`);

    // 1. Dọn dẹp các channel cũ không cần thiết (tránh trùng lặp)
    console.log("🧹 Cleaning old default channels...");
    const oldChannels = await guild.channels.fetch();
    for (const [id, ch] of oldChannels) {
      if (ch) {
        try {
          await ch.delete("LS Studio Server Re-Architecture");
          console.log(`   - Deleted old channel: ${ch.name}`);
        } catch (e) {
          console.warn(`   ! Could not delete channel ${ch.name}: ${e.message}`);
        }
      }
    }

    // 2. Tạo Roles
    console.log("👑 Creating stylized Roles...");
    const roleDefs = [
      { name: "👑・Founder / Lead Dev", color: "#FF4500", hoist: true, mentionable: true, permissions: [PermissionsBitField.Flags.Administrator] },
      { name: "🛠️・Developer", color: "#00E5FF", hoist: true, mentionable: true, permissions: [PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.ManageMessages, PermissionsBitField.Flags.MuteMembers, PermissionsBitField.Flags.DeafenMembers] },
      { name: "🛡️・Staff / Support", color: "#3D5AFE", hoist: true, mentionable: true, permissions: [PermissionsBitField.Flags.ManageMessages, PermissionsBitField.Flags.KickMembers] },
      { name: "💎・VIP Customer", color: "#E040FB", hoist: true, mentionable: true, permissions: [] },
      { name: "🛒・Khách Hàng (Buyer)", color: "#00E676", hoist: true, mentionable: true, permissions: [] },
      { name: "🤝・Đối Tác (Partner)", color: "#FFD600", hoist: true, mentionable: true, permissions: [] },
      { name: "👥・Thành Viên", color: "#90A4AE", hoist: true, mentionable: false, permissions: [] },
      { name: "🤖・Bot Hệ Thống", color: "#78909C", hoist: true, mentionable: false, permissions: [] },
      { name: "🔔・Ping Plugin Updates", color: "#00B0FF", hoist: false, mentionable: true, permissions: [] },
      { name: "🎁・Ping Giveaway & Event", color: "#FF9100", hoist: false, mentionable: true, permissions: [] },
    ];

    const createdRoles = {};
    for (const rDef of roleDefs) {
      const existing = guild.roles.cache.find(r => r.name === rDef.name);
      if (existing) {
        createdRoles[rDef.name] = existing;
        console.log(`   + Role exists: ${rDef.name}`);
      } else {
        const role = await guild.roles.create({
          name: rDef.name,
          color: rDef.color,
          hoist: rDef.hoist,
          mentionable: rDef.mentionable,
          permissions: rDef.permissions,
          reason: "LS Studio Setup"
        });
        createdRoles[rDef.name] = role;
        console.log(`   + Created role: ${rDef.name}`);
      }
    }

    const everyoneRole = guild.roles.everyone;
    const customerRole = createdRoles["🛒・Khách Hàng (Buyer)"];
    const vipRole = createdRoles["💎・VIP Customer"];
    const staffRole = createdRoles["🛡️・Staff / Support"];
    const devRole = createdRoles["🛠️・Developer"];
    const founderRole = createdRoles["👑・Founder / Lead Dev"];

    async function createCategory(name, overwrites = []) {
      return await guild.channels.create({
        name: name,
        type: ChannelType.GuildCategory,
        permissionOverwrites: overwrites
      });
    }

    async function createTextChannel(name, parent, topic = "", overwrites = []) {
      return await guild.channels.create({
        name: name,
        type: ChannelType.GuildText,
        parent: parent.id,
        topic: topic,
        permissionOverwrites: overwrites
      });
    }

    async function createVoiceChannel(name, parent, overwrites = []) {
      return await guild.channels.create({
        name: name,
        type: ChannelType.GuildVoice,
        parent: parent.id,
        permissionOverwrites: overwrites
      });
    }

    console.log("📁 Building Categories and Channels...");

    // 1. THÔNG TIN
    const catInfo = await createCategory("📌 ━━━ THÔNG TIN ━━━", [
      {
        id: everyoneRole.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
        deny: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AddReactions, PermissionsBitField.Flags.CreatePublicThreads]
      },
      {
        id: staffRole.id,
        allow: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.EmbedLinks, PermissionsBitField.Flags.AttachFiles]
      }
    ]);

    const chRules = await createTextChannel("📜・luật-và-chính-sách", catInfo, "Nội quy máy chủ & Chính sách bảo hành dịch vụ LS Studio");
    const chAnnounce = await createTextChannel("📢・thông-báo", catInfo, "Thông báo chính thức từ ban quản trị LS Studio");
    const chChangelog = await createTextChannel("🚀・update-changelog", catInfo, "Nhật ký cập nhật tính năng mới của các Plugin");
    const chGiveaway = await createTextChannel("🎁・ưu-đãi-giveaway", catInfo, "Sự kiện khuyến mãi & Giveaway bản quyền Plugin");

    // 2. LS STORE
    const catStore = await createCategory("🛒 ━━━ LS STORE ━━━", [
      {
        id: everyoneRole.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
        deny: [PermissionsBitField.Flags.SendMessages]
      },
      {
        id: staffRole.id,
        allow: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.EmbedLinks, PermissionsBitField.Flags.AttachFiles]
      }
    ]);

    const chPlugins = await createTextChannel("💎・danh-sách-plugin", catStore, "Showcase các sản phẩm Plugin chất lượng cao của LS Studio");
    const chPricing = await createTextChannel("💰・bảng-giá-dịch-vụ", catStore, "Bảng giá Plugin có sẵn & Dịch vụ nhận Custom Plugin theo yêu cầu");
    const chDemo = await createTextChannel("🌐・server-test-demo", catStore, "Địa chỉ IP Server Minecraft để trải nghiệm trực tiếp tính năng Plugin");
    const chVouch = await createTextChannel("⭐・đánh-giá-vouch", catStore, "Nơi khách hàng gửi đánh giá uy tín sau khi giao dịch", [
      {
        id: everyoneRole.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles, PermissionsBitField.Flags.ReadMessageHistory]
      }
    ]);

    // 3. MUA HÀNG & HỖ TRỢ (TICKETS)
    const catSupport = await createCategory("🎫 ━━━ MUA HÀNG & HỖ TRỢ ━━━", [
      {
        id: everyoneRole.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
        deny: [PermissionsBitField.Flags.SendMessages]
      }
    ]);

    const chOrderTicket = await createTextChannel("🛒・mua-plugin", catSupport, "Nhấn nút để mở Ticket mua plugin hoặc đặt làm plugin theo yêu cầu");
    const chTechTicket = await createTextChannel("🛠️・hỗ-trợ-kỹ-thuật", catSupport, "Nhấn nút để mở Ticket yêu cầu hỗ trợ lỗi, cài đặt, tương thích Paper/Folia");
    const chCustomTicket = await createTextChannel("📝・đặt-code-plugin-riêng", catSupport, "Nhấn nút để mở Ticket trao đổi dự án Plugin độc quyền theo ý tưởng");

    // 4. CỘNG ĐỒNG
    const catCommunity = await createCategory("💬 ━━━ CỘNG ĐỒNG ━━━", [
      {
        id: everyoneRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel, 
          PermissionsBitField.Flags.SendMessages, 
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.EmbedLinks,
          PermissionsBitField.Flags.AttachFiles
        ]
      }
    ]);

    const chChat = await createTextChannel("💬・trò-chuyện", catCommunity, "Giao lưu, trò chuyện tự do cùng các Dev và Admin Server Minecraft khác");
    const chSuggestions = await createTextChannel("💡・góp-ý-tính-năng", catCommunity, "Đóng góp ý tưởng tính năng bạn muốn xuất hiện trong các Plugin");
    const chShowcase = await createTextChannel("🎮・khoe-server-mc", catCommunity, "Nơi khoe máy chủ Minecraft của bạn đang dùng plugin LS Studio");
    const chBotCommands = await createTextChannel("🤖・lệnh-bot", catCommunity, "Kênh sử dụng các lệnh bot");

    // 5. KHÁCH HÀNG VIP
    const catVIP = await createCategory("👑 ━━━ KHÁCH HÀNG VIP ━━━", [
      {
        id: everyoneRole.id,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: customerRole.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory]
      },
      {
        id: vipRole.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory]
      },
      {
        id: staffRole.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
      }
    ]);

    const chDownloads = await createTextChannel("📦・tải-plugin-updates", catVIP, "Khu vực nhận file .jar chính thức và bản vá lỗi mới nhất cho Khách Hàng", [
      {
        id: everyoneRole.id,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: customerRole.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
        deny: [PermissionsBitField.Flags.SendMessages]
      },
      {
        id: staffRole.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles]
      }
    ]);

    const chVipChat = await createTextChannel("💬・khu-vực-khách-hàng", catVIP, "Kênh chat ưu tiên và hỗ trợ riêng tư dành cho Khách Hàng đã mua Plugin", [
      {
        id: everyoneRole.id,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: customerRole.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles]
      }
    ]);

    // 6. QUẢN TRỊ (STAFF ONLY)
    const catAdmin = await createCategory("🔒 ━━━ BAN QUẢN TRỊ ━━━", [
      {
        id: everyoneRole.id,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: staffRole.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
      }
    ]);

    await createTextChannel("📊・nhật-ký-giao-dịch", catAdmin, "Lịch sử mua hàng, giao dịch và ticket transcript");
    await createTextChannel("💬・nội-bộ-staff", catAdmin, "Kênh trao đổi nội bộ đội ngũ phát triển và quản lý");

    // 7. KÊNH THOẠI
    const catVoice = await createCategory("🔊 ━━━ KÊNH THOẠI ━━━");
    await createVoiceChannel("🔊・Phòng Chờ Giao Lưu", catVoice);
    await createVoiceChannel("🛠️・Hỗ Trợ Kỹ Thuật 1-1", catVoice);
    await createVoiceChannel("🎮・Voice Gaming", catVoice);

    console.log("✨ Channels & Categories created successfully!");

    // 8. ĐĂNG CÁC EMBED THÔNG BÁO & BẢNG GIÁ
    console.log("📝 Publishing professional Embeds...");

    // Embed 1: Luật & Chính Sách
    const embedRules = new EmbedBuilder()
      .setColor("#FF4500")
      .setTitle("📜 QUY ĐỊNH & ĐIỀU KHOẢN DỊCH VỤ - LS STUDIO")
      .setDescription("Chào mừng bạn đến với **LS STUDIO** — Nơi cung cấp các giải pháp & Plugin Minecraft hàng đầu. Vui lòng đọc kỹ các quy định sau đây:")
      .addFields(
        { 
          name: "1️⃣ Quyền Sở Hữu & Bản Quyền Plugin", 
          value: "• Tất cả các plugin được phân phối độc quyền bởi **LS STUDIO**.\n• **Nghiêm cấm** hành vi share, leak, thương mại hóa lại (resell) hoặc decompile khi chưa có sự đồng ý bằng văn bản.\n• Vi phạm sẽ bị thu hồi giấy phép sử dụng (License Key) và cấm vĩnh viễn khỏi hệ thống."
        },
        { 
          name: "2️⃣ Chính Sách Bảo Hành & Cập Nhật", 
          value: "• **Bảo hành trọn đời:** Hỗ trợ sửa các lỗi phát sinh (bugs) hoàn toàn miễn phí.\n• **Cập nhật:** Cam kết tương thích các bản Minecraft mới nhất (Spigot / Paper / Purpur / Folia).\n• Hỗ trợ cấu hình (config) và tối ưu hiệu năng tận tình 1-1."
        },
        { 
          name: "3️⃣ Quy Trình Đặt Làm Plugin Riêng (Custom Dev)", 
          value: "• Khách hàng nêu ý tưởng chi tiết -> LS Studio báo giá & thời gian hoàn thành.\n• Đặt cọc 50% trước khi triển khai -> Tiến hành code -> Demo kiểm thử trên Server Test -> Thanh toán 50% còn lại và nhận full source/file jar."
        },
        { 
          name: "4️⃣ Văn Hóa Cộng Đồng", 
          value: "• Tôn trọng các thành viên và đội ngũ hỗ trợ.\n• Không spam, chửi tục, quảng cáo không xin phép hoặc gây mất trật tự."
        }
      )
      .setFooter({ text: "LS STUDIO • Uy Tín - Chất Lượng - Tối Ưu Tột Đỉnh", iconURL: client.user.displayAvatarURL() })
      .setTimestamp();

    await chRules.send({ embeds: [embedRules] });

    // Embed 2: Thông Báo Chào Mừng
    const embedWelcome = new EmbedBuilder()
      .setColor("#00E5FF")
      .setTitle("🚀 CHÀO MỪNG BẠN ĐẾN VỚI LS STUDIO!")
      .setDescription(
        "👋 Chào toàn thể anh em Dev & Chủ Server Minecraft!\n\n" +
        "**LS STUDIO** được thành lập với mục tiêu mang đến những **Plugin Minecraft chất lượng cao, tối ưu tuyệt đối, không lag và dễ dàng tùy biến nhất** cho cộng đồng Minecraft Việt Nam.\n\n" +
        "🔥 **DỊCH VỤ CỦA CHÚNG TÔI:**\n" +
        "• 📦 Bán các Plugin Premium tối ưu sẵn cho Survival, Skyblock, Factions, RPG, Prison...\n" +
        "• 🛠️ Nhận Lập Trình Plugin Riêng (Custom Plugin) theo 100% ý tưởng của bạn.\n" +
        "• ⚡ Hỗ trợ Port & Tối ưu hóa Plugin cho hệ sinh thái đa luồng **Folia / Paper**.\n" +
        "• 🔧 Cung cấp dịch vụ setup server, chống crash, fix packet lag chuyên nghiệp."
      )
      .addFields(
        { name: "📌 Danh Sách Plugin", value: `<#${chPlugins.id}>`, inline: true },
        { name: "💰 Bảng Giá Dịch Vụ", value: `<#${chPricing.id}>`, inline: true },
        { name: "🛒 Mua Hàng & Hỗ Trợ", value: `<#${chOrderTicket.id}>`, inline: true }
      )
      .setFooter({ text: "LS STUDIO • Minecraft Developer Suite", iconURL: client.user.displayAvatarURL() });

    await chAnnounce.send({ embeds: [embedWelcome] });

    // Embed 3: Danh sách Plugin mẫu
    const embedPlugins = new EmbedBuilder()
      .setColor("#00E676")
      .setTitle("💎 DANH SÁCH PLUGIN TIÊU BIỂU - LS STUDIO")
      .setDescription("Tất cả các Plugin tại LS Studio đều được tối ưu hóa hiệu năng cao, hỗ trợ đa phiên bản từ `1.16.x -> 1.21.x` và tương thích 100% với Paper/Folia.")
      .addFields(
        {
          name: "⚔️ 1. LS-CustomItems & Skills (Vũ Khí & Kỹ Năng Đột Phá)",
          value: "• Hệ thống vũ khí custom, ngọc khảm, chiêu thức kỹ năng đẹp mắt không lag.\n• Hỗ trợ cấu hình GUI trực quan, tương thích MythicMobs & MMOItems.\n• **Hỗ trợ:** Spigot / Paper / Purpur / Folia (1.18 - 1.21+)\n• **Giá:** `150.000 VNĐ`"
        },
        {
          name: "💰 2. LS-EconomySuite (Kinh Tế Siêu Nhẹ & Chợ Đen)",
          value: "• Tích hợp Vault, hỗ trợ ngân hàng ảo, giao dịch P2P an toàn, chợ đen realtime.\n• Chống triệt để các lỗi dupe tiền/vật phẩm, lưu async MySQL/SQLite cực nhẹ.\n• **Giá:** `100.000 VNĐ`"
        },
        {
          name: "🛡️ 3. LS-AntiCrash & PacketShield (Tường Lửa Server)",
          value: "• Chặn đứng 100% các hình thức gửi packet spam, crash server, nbt exploit.\n• Tự động tối ưu chunk load và AI quái vật khi TPS giảm dưới 18.\n• **Giá:** `200.000 VNĐ`"
        }
      )
      .setFooter({ text: "Để đặt mua hoặc yêu cầu tính năng riêng, hãy mở ticket tại kênh #mua-plugin!" });

    await chPlugins.send({ embeds: [embedPlugins] });

    // Embed 4: Bảng Giá & Dịch Vụ
    const embedPricing = new EmbedBuilder()
      .setColor("#FFD600")
      .setTitle("💰 BẢNG GIÁ DỊCH VỤ CHÍNH THỨC - LS STUDIO")
      .setDescription("Bảng giá minh bạch, cam kết không phát sinh chi phí ẩn. Hỗ trợ bảo hành và cập nhật trọn đời.")
      .addFields(
        {
          name: "📦 1. Plugin Đóng Gói Sẵn (Pre-made Plugins)",
          value: "• Giá dao động: **50.000đ - 300.000đ / plugin**\n• Nhận ngay file `.jar` hoàn chỉnh + File `config.yml` tiếng Việt chuẩn đẹp.\n• Miễn phí update trọn đời các bản vá lỗi."
        },
        {
          name: "🛠️ 2. Lập Trình Plugin Theo Ý Tưởng Riêng (Custom Dev)",
          value: "• **Cỡ Nhỏ (Tiện ích, lệnh, GUI, fix bug):** `50.000đ - 150.000đ`\n• **Cỡ Trung (Tính năng gameplay mới, event, mini-system):** `200.000đ - 500.000đ`\n• **Cỡ Lớn (Hệ thống RPG tổng thể, Minigame độc quyền):** `Thỏa thuận`"
        },
        {
          name: "⚡ 3. Dịch Vụ Tối Ưu & Sửa Lỗi Server",
          value: "• Fix lỗi TPS tụt, phân tích Spark / Timings, dọn dẹp cấu hình: `50.000đ - 100.000đ`\n• Port plugin cũ sang tương thích **Folia Multithreading**: `Thỏa thuận`"
        },
        {
          name: "💳 4. Phương Thức Thanh Toán Hỗ Trợ",
          value: "• 🏦 **Chuyển Khoản Ngân Hàng (VietQR 24/7):** MBBank, Vietcombank, TPBank, Techcombank, v.v.\n• 📱 **Ví Điện Tử MoMo:** Nhanh chóng, tiện lợi\n• 🌐 **Thẻ Cào Điện Thoại:** Hỗ trợ qua cổng gạch thẻ"
        }
      )
      .setFooter({ text: "Mọi giao dịch chỉ thực hiện qua Ticket chính thức tại Discord LS Studio!" });

    await chPricing.send({ embeds: [embedPricing] });

    // Embed 5: Server Demo
    const embedDemo = new EmbedBuilder()
      .setColor("#9C27B0")
      .setTitle("🌐 MÁY CHỦ THỬ NGHIỆM TÍNH NĂNG (DEMO SERVER)")
      .setDescription(
        "Bạn muốn tự tay trải nghiệm độ mượt mà và tính năng độc đáo trước khi mua?\n\n" +
        "🕹️ **Thông tin kết nối Server Test:**\n" +
        "• **Địa chỉ IP:** `kinetic.pikamc.vn:25565`\n" +
        "• **Phiên bản hỗ trợ:** `1.20.x - 1.21.x` (PC Java Edition)\n" +
        "• **Hướng dẫn:** Vào server gõ `/ls test` hoặc xem bảng hướng dẫn tại sảnh chờ!\n\n" +
        "💬 *Nếu server đang bảo trì hoặc cần mở tính năng đặc biệt để test, hãy liên hệ Staff qua Ticket nhé!*"
      );

    await chDemo.send({ embeds: [embedDemo] });

    // Embed 6: Ticket Mua Hàng với Button
    const embedOrder = new EmbedBuilder()
      .setColor("#00E676")
      .setTitle("🛒 TRUNG TÂM ĐẶT MUA PLUGIN - LS STUDIO")
      .setDescription(
        "Bạn đã chọn được Plugin ưng ý hoặc cần tư vấn phương thức thanh toán?\n\n" +
        "👉 **Cách thức giao dịch:**\n" +
        "1. Nhấn vào nút **[🛒 Mua Plugin / Mở Ticket]** bên dưới.\n" +
        "2. Một kênh chat riêng tư sẽ được tạo tự động cho bạn và Staff.\n" +
        "3. Nêu tên Plugin bạn muốn mua -> Nhận mã thanh toán QR -> Nhận file `.jar` và role Khách Hàng ngay lập tức!\n\n" +
        "⚡ *Giao dịch tự động, bảo mật và an toàn 100%!*"
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

    await chOrderTicket.send({ embeds: [embedOrder], components: [rowOrder] });

    // Embed 7: Ticket Hỗ Trợ Kỹ Thuật
    const embedTech = new EmbedBuilder()
      .setColor("#3D5AFE")
      .setTitle("🛠️ TRUNG TÂM HỖ TRỢ KỸ THUẬT & BÁO LỖI")
      .setDescription(
        "Gặp khó khăn khi cài đặt Plugin? Phát hiện lỗi bug cần fix gấp?\n\n" +
        "👉 Nhấn vào nút **[🛠️ Mở Ticket Hỗ Trợ]** bên dưới để nhận trợ giúp 1-1 từ Developer của LS Studio!\n\n" +
        "📋 *Vui lòng chuẩn bị sẵn thông tin phiên bản Server (Paper/Purpur/Folia) và file log lỗi (`latest.log` hoặc timings/spark) để được xử lý nhanh nhất.*"
      );

    const rowTech = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_support')
        .setLabel('🛠️ Mở Ticket Hỗ Trợ')
        .setStyle(ButtonStyle.Primary)
    );

    await chTechTicket.send({ embeds: [embedTech], components: [rowTech] });

    // Embed 8: Ticket Đặt Custom Plugin
    const embedCustom = new EmbedBuilder()
      .setColor("#FF4500")
      .setTitle("📝 ĐẶT LÀM PLUGIN RIÊNG THEO YÊU CẦU (CUSTOM DEV)")
      .setDescription(
        "Bạn có một ý tưởng cơ chế gameplay mới lạ nhưng chưa có plugin nào trên thị trường đáp ứng được?\n\n" +
        "👉 Nhấn vào nút **[📝 Gửi Yêu Cầu Code Plugin]** bên dưới!\n\n" +
        "✨ **Cam kết từ LS STUDIO:**\n" +
        "• Code sạch, tối ưu tài nguyên, không gây lag CPU/RAM.\n" +
        "• Đầy đủ config tùy biến dễ hiểu, hỗ trợ MiniMessage / Hex Color / PlaceholderAPI.\n" +
        "• Bàn giao đúng hẹn kèm hướng dẫn sử dụng chi tiết."
      );

    const rowCustom = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_custom')
        .setLabel('📝 Gửi Yêu Cầu Code Plugin')
        .setStyle(ButtonStyle.Danger)
    );

    await chCustomTicket.send({ embeds: [embedCustom], components: [rowCustom] });

    console.log("🎉 LS STUDIO SERVER SETUP COMPLETED 100% SUCCESFULLY!");
    process.exit(0);

  } catch (error) {
    console.error("❌ Error during setup:", error);
    process.exit(1);
  }
});

client.login(TOKEN);
