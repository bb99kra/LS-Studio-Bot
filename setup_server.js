require('dotenv').config();
const fs = require('fs');
const { 
  Client, 
  GatewayIntentBits, 
  PermissionsBitField, 
  ChannelType, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  Events
} = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN || (fs.existsSync('./token.local.js') ? require('./token.local.js').TOKEN : '');
const GUILD_ID = process.env.GUILD_ID || "1542476657825419334";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

// Helper: Tạm dừng để tránh Discord HTTP 429 Rate Limit
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper: Bọc hàm REST với cơ chế tự động Retry khi gặp Rate Limit (429)
async function safeApiCall(fn, retries = 3, delayMs = 1000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await fn();
      await sleep(250); // Khoảng nghỉ an toàn giữa các request
      return result;
    } catch (error) {
      if (error.status === 429 || error.code === 429 || (error.message && error.message.includes('rate limit'))) {
        const retryAfter = (error.rawError?.retry_after ? error.rawError.retry_after * 1000 : delayMs * attempt) + 500;
        console.warn(`   ⏳ Rate limit detected. Chờ ${retryAfter}ms trước khi thử lại (Lần ${attempt}/${retries})...`);
        await sleep(retryAfter);
      } else if (attempt === retries) {
        throw error;
      } else {
        console.warn(`   ⚠️ Warning API call failed (Lần ${attempt}/${retries}): ${error.message}. Đang thử lại...`);
        await sleep(delayMs);
      }
    }
  }
}

async function runServerSetup(clientInstance = client, targetGuildId = GUILD_ID) {
  const readyUser = clientInstance.user || { tag: 'Bot', id: 'bot_id' };
  console.log(`🤖 Logged in as ${readyUser.tag}! Bắt đầu khởi tạo/đồng bộ hệ thống Server LS STUDIO...`);

  try {
    const guild = await safeApiCall(() => clientInstance.guilds.fetch(targetGuildId));
    if (!guild) {
      console.error("❌ Guild không tồn tại hoặc Bot chưa tham gia Guild!");
      clearTimeout(watchdog);
      try { await client.destroy(); } catch {}
      process.exit(1);
    }

    console.log(`🏰 Target Server: ${guild.name} (${guild.id})`);

    // =========================================================================
    // 0. PRE-FLIGHT PERMISSION CHECK (KIỂM TRA QUYỀN HẠN CỦA BOT)
    // =========================================================================
    console.log("🔍 Đang kiểm tra quyền hạn của Bot (Pre-flight Permission Check)...");
    const botMember = guild.members.me || await safeApiCall(() => guild.members.fetch(readyUser.id)).catch(() => null);
    
    if (!botMember) {
      console.error("❌ Không thể lấy thông tin Bot Member trong Guild!");
      clearTimeout(watchdog);
      try { await client.destroy(); } catch {}
      process.exit(1);
    }

    const requiredPermissions = [
      { flag: PermissionsBitField.Flags.ManageChannels, name: "ManageChannels (Quản Lý Kênh)" },
      { flag: PermissionsBitField.Flags.ManageRoles, name: "ManageRoles (Quản Lý Vai Trò)" },
      { flag: PermissionsBitField.Flags.ViewChannel, name: "ViewChannel (Xem Kênh)" },
      { flag: PermissionsBitField.Flags.SendMessages, name: "SendMessages (Gửi Tin Nhắn)" },
      { flag: PermissionsBitField.Flags.EmbedLinks, name: "EmbedLinks (Chèn Liên Kết/Embeds)" },
      { flag: PermissionsBitField.Flags.AttachFiles, name: "AttachFiles (Đính Kèm Tệp)" },
      { flag: PermissionsBitField.Flags.ManageMessages, name: "ManageMessages (Quản Lý Tin Nhắn)" },
      { flag: PermissionsBitField.Flags.ReadMessageHistory, name: "ReadMessageHistory (Đọc Lịch Sử Tin Nhắn)" }
    ];

    const missingPermissions = requiredPermissions.filter(p => !botMember.permissions.has(p.flag));
    if (missingPermissions.length > 0) {
      console.warn("⚠️ [CẢNH BÁO PHÂN QUYỀN]: Bot đang thiếu các quyền sau trên máy chủ:");
      missingPermissions.forEach(p => console.warn(`   - ❌ ${p.name}`));
      console.warn("👉 Vui lòng kéo Role của Bot lên cao và cấp quyền Administrator hoặc các quyền trên trong Server Settings!");
    } else {
      console.log("✅ Phân quyền của Bot đầy đủ và hợp lệ!");
    }

    // =========================================================================
    // 1. ĐỒNG BỘ & TẠO ROLES (IDEMPOTENT - CHỐNG TRÙNG LẶP & XỬ LÝ HIERARCHY)
    // =========================================================================
    console.log("\n👑 Đang đồng bộ và khởi tạo Roles...");
    const existingRoles = await safeApiCall(() => guild.roles.fetch());

    // Định nghĩa Role từ quyền cao xuống thấp
    const roleDefs = [
      { 
        name: "👑・Founder / Lead Dev", 
        color: "#FF4500", 
        hoist: true, 
        mentionable: true, 
        permissions: [PermissionsBitField.Flags.Administrator] 
      },
      { 
        name: "🛠️・Developer", 
        color: "#00E5FF", 
        hoist: true, 
        mentionable: true, 
        permissions: [
          PermissionsBitField.Flags.ManageChannels, 
          PermissionsBitField.Flags.ManageMessages, 
          PermissionsBitField.Flags.MuteMembers, 
          PermissionsBitField.Flags.DeafenMembers,
          PermissionsBitField.Flags.KickMembers
        ] 
      },
      { 
        name: "🛡️・Staff / Support", 
        color: "#3D5AFE", 
        hoist: true, 
        mentionable: true, 
        permissions: [
          PermissionsBitField.Flags.ManageMessages, 
          PermissionsBitField.Flags.KickMembers,
          PermissionsBitField.Flags.MuteMembers
        ] 
      },
      { 
        name: "💎・VIP Customer", 
        color: "#E040FB", 
        hoist: true, 
        mentionable: true, 
        permissions: [] 
      },
      { 
        name: "🛒・Khách Hàng (Buyer)", 
        color: "#00E676", 
        hoist: true, 
        mentionable: true, 
        permissions: [] 
      },
      { 
        name: "🤝・Đối Tác (Partner)", 
        color: "#FFD600", 
        hoist: true, 
        mentionable: true, 
        permissions: [] 
      },
      { 
        name: "👥・Thành Viên", 
        color: "#90A4AE", 
        hoist: true, 
        mentionable: false, 
        permissions: [] 
      },
      { 
        name: "🤖・Bot Hệ Thống", 
        color: "#78909C", 
        hoist: true, 
        mentionable: false, 
        permissions: [] 
      },
      { 
        name: "🔔・Ping Plugin Updates", 
        color: "#00B0FF", 
        hoist: false, 
        mentionable: true, 
        permissions: [] 
      },
      { 
        name: "🎁・Ping Giveaway & Event", 
        color: "#FF9100", 
        hoist: false, 
        mentionable: true, 
        permissions: [] 
      }
    ];

    const rolesMap = {};

    for (const rDef of roleDefs) {
      let role = existingRoles.find(r => r.name === rDef.name);
      if (role) {
        // Cập nhật thuộc tính role nếu bot có thứ bậc cao hơn
        if (botMember.permissions.has(PermissionsBitField.Flags.ManageRoles) && role.position < botMember.roles.highest.position) {
          try {
            role = await safeApiCall(() => role.edit({
              color: rDef.color,
              hoist: rDef.hoist,
              mentionable: rDef.mentionable,
              permissions: rDef.permissions
            }));
            console.log(`   ✓ Role đã tồn tại (đã đồng bộ): ${rDef.name}`);
          } catch (e) {
            console.log(`   ✓ Role đã tồn tại: ${rDef.name} (Bỏ qua đồng bộ: ${e.message})`);
          }
        } else {
          console.log(`   ✓ Role đã tồn tại (Hierarchy cao hơn/ngang Bot): ${rDef.name}`);
        }
      } else {
        if (botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
          role = await safeApiCall(() => guild.roles.create({
            name: rDef.name,
            color: rDef.color,
            hoist: rDef.hoist,
            mentionable: rDef.mentionable,
            permissions: rDef.permissions,
            reason: "LS Studio Setup - Role Hierarchy"
          }));
          console.log(`   + Đã tạo role mới: ${rDef.name}`);
        } else {
          console.warn(`   ⚠️ Không thể tạo role ${rDef.name} do bot thiếu quyền ManageRoles`);
        }
      }
      if (role) rolesMap[rDef.name] = role;
    }

    const everyoneRole = guild.roles.everyone;
    const customerRole = rolesMap["🛒・Khách Hàng (Buyer)"];
    const vipRole = rolesMap["💎・VIP Customer"];
    const staffRole = rolesMap["🛡️・Staff / Support"];
    const devRole = rolesMap["🛠️・Developer"];
    const founderRole = rolesMap["👑・Founder / Lead Dev"];
    const botUser = readyUser;

    // Fetch toàn bộ channel hiện tại để kiểm tra trùng lặp
    console.log("\n📁 Đang kiểm tra danh mục và kênh hiện có...");
    let currentChannels = await safeApiCall(() => guild.channels.fetch());

    // Helper: Tạo hoặc Lấy Category (Idempotent)
    async function getOrCreateCategory(name, overwrites = []) {
      let cat = currentChannels.find(c => c && c.type === ChannelType.GuildCategory && c.name === name);
      if (cat) {
        console.log(`   📁 Category đã tồn tại: ${name}`);
        if (overwrites && overwrites.length > 0 && botMember.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
          await safeApiCall(() => cat.permissionOverwrites.set(overwrites)).catch(err => {
            console.warn(`   ! Không thể cập nhật quyền category ${name}: ${err.message}`);
          });
        }
        return cat;
      }

      cat = await safeApiCall(() => guild.channels.create({
        name: name,
        type: ChannelType.GuildCategory,
        permissionOverwrites: overwrites,
        reason: "LS Studio Setup - Category Creation"
      }));
      console.log(`   + Đã tạo Category mới: ${name}`);
      currentChannels.set(cat.id, cat);
      return cat;
    }

    // Helper: Tạo hoặc Lấy Text Channel (Idempotent)
    async function getOrCreateTextChannel(name, parentCategory, topic = "", customOverwrites = null) {
      let ch = currentChannels.find(c => 
        c && 
        c.type === ChannelType.GuildText && 
        c.name === name && 
        (parentCategory ? c.parentId === parentCategory.id : true)
      );

      if (ch) {
        console.log(`   📄 Text Channel đã tồn tại: #${name}`);
        try {
          const updateData = {};
          if (topic && ch.topic !== topic) updateData.topic = topic;
          if (parentCategory && ch.parentId !== parentCategory.id) updateData.parent = parentCategory.id;
          if (Object.keys(updateData).length > 0 && botMember.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            await safeApiCall(() => ch.edit(updateData));
          }
          if (customOverwrites && customOverwrites.length > 0 && botMember.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            await safeApiCall(() => ch.permissionOverwrites.set(customOverwrites));
          }
        } catch (e) {
          console.warn(`   ! Không thể update channel #${name}: ${e.message}`);
        }
        return ch;
      }

      const createOptions = {
        name: name,
        type: ChannelType.GuildText,
        parent: parentCategory ? parentCategory.id : undefined,
        topic: topic || undefined,
        reason: "LS Studio Setup - Channel Creation"
      };

      if (customOverwrites && customOverwrites.length > 0) {
        createOptions.permissionOverwrites = customOverwrites;
      }

      ch = await safeApiCall(() => guild.channels.create(createOptions));
      console.log(`   + Đã tạo Text Channel mới: #${name}`);
      currentChannels.set(ch.id, ch);
      return ch;
    }

    // Helper: Tạo hoặc Lấy Voice Channel (Idempotent)
    async function getOrCreateVoiceChannel(name, parentCategory, customOverwrites = null) {
      let ch = currentChannels.find(c => 
        c && 
        c.type === ChannelType.GuildVoice && 
        c.name === name && 
        (parentCategory ? c.parentId === parentCategory.id : true)
      );

      if (ch) {
        console.log(`   🔊 Voice Channel đã tồn tại: ${name}`);
        return ch;
      }

      const createOptions = {
        name: name,
        type: ChannelType.GuildVoice,
        parent: parentCategory ? parentCategory.id : undefined,
        reason: "LS Studio Setup - Voice Channel Creation"
      };

      if (customOverwrites && customOverwrites.length > 0) {
        createOptions.permissionOverwrites = customOverwrites;
      }

      ch = await safeApiCall(() => guild.channels.create(createOptions));
      console.log(`   + Đã tạo Voice Channel mới: ${name}`);
      currentChannels.set(ch.id, ch);
      return ch;
    }

    // Helper: Đăng hoặc Cập nhật Embeds sạch sẽ (tránh duplicate tin nhắn khi chạy lại nhiều lần)
    async function publishOrRefreshEmbed(channel, messagePayload) {
      if (!channel || !channel.isTextBased()) return null;
      try {
        const messages = await safeApiCall(() => channel.messages.fetch({ limit: 10 }));
        const botMessages = messages.filter(m => m.author.id === botUser.id);
        
        // Xóa tin nhắn cũ của bot để làm mới
        for (const [id, msg] of botMessages) {
          await safeApiCall(() => msg.delete()).catch(() => {});
        }

        const sent = await safeApiCall(() => channel.send(messagePayload));
        console.log(`   ✅ Đã đăng Embed thành công vào: #${channel.name}`);
        return sent;
      } catch (err) {
        console.error(`   ❌ Lỗi khi gửi Embed vào #${channel.name}:`, err.message);
        return null;
      }
    }

    // =========================================================================
    // 2. KHỞI TẠO CATEGORIES VÀ CHANNELS VỚI BITFIELD OVERWRITES CHUẨN DISCORD.JS V14
    // =========================================================================
    console.log("\n🏗️ Bắt đầu xây dựng danh mục và các kênh...");

    // -------------------------------------------------------------------------
    // 1. DANH MỤC: 📌 ━━━ THÔNG TIN ━━━
    // -------------------------------------------------------------------------
    const infoOverwrites = [
      {
        id: everyoneRole.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
        deny: [
          PermissionsBitField.Flags.SendMessages, 
          PermissionsBitField.Flags.AddReactions, 
          PermissionsBitField.Flags.CreatePublicThreads,
          PermissionsBitField.Flags.CreatePrivateThreads,
          PermissionsBitField.Flags.SendMessagesInThreads
        ]
      },
      {
        id: botUser.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.EmbedLinks,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.ManageMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.ManageChannels
        ]
      }
    ];
    if (staffRole) {
      infoOverwrites.push({
        id: staffRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.EmbedLinks,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      });
    }

    const catInfo = await getOrCreateCategory("📌 ━━━ THÔNG TIN ━━━", infoOverwrites);

    const chWelcome = await getOrCreateTextChannel("👋・chào-mừng", catInfo, "Kênh tự động chào đón thành viên mới gia nhập LS Studio");
    const chGoodbye = await getOrCreateTextChannel("🚪・tạm-biệt", catInfo, "Nhật ký tạm biệt thành viên");
    const chRules = await getOrCreateTextChannel("📜・luật-lệ", catInfo, "Nội quy máy chủ & Chính sách bảo hành dịch vụ LS Studio");
    const chAnnounce = await getOrCreateTextChannel("📢・thông-báo", catInfo, "Thông báo chính thức từ ban quản trị LS Studio");
    const chChangelog = await getOrCreateTextChannel("🚀・cập-nhật-changelog", catInfo, "Nhật ký cập nhật tính năng mới của các Plugin");
    const chGiveaway = await getOrCreateTextChannel("🎁・giveaway-sự-kiện", catInfo, "Sự kiện khuyến mãi & Giveaway bản quyền Plugin");

    // -------------------------------------------------------------------------
    // 2. DANH MỤC: 🛒 ━━━ CỬA HÀNG LS ━━━
    // -------------------------------------------------------------------------
    const storeOverwrites = [
      {
        id: everyoneRole.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
        deny: [
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.CreatePublicThreads,
          PermissionsBitField.Flags.CreatePrivateThreads,
          PermissionsBitField.Flags.SendMessagesInThreads
        ]
      },
      {
        id: botUser.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.EmbedLinks,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.ManageMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.ManageChannels
        ]
      }
    ];
    if (staffRole) {
      storeOverwrites.push({
        id: staffRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.EmbedLinks,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      });
    }

    const catStore = await getOrCreateCategory("🛒 ━━━ CỬA HÀNG LS ━━━", storeOverwrites);

    const chPlugins = await getOrCreateTextChannel("💎・sản-phẩm-plugin", catStore, "Showcase các sản phẩm Plugin chất lượng cao của LS Studio");
    const chPricing = await getOrCreateTextChannel("💰・bảng-giá", catStore, "Bảng giá Plugin có sẵn & Dịch vụ nhận Custom Plugin theo yêu cầu");
    const chDemo = await getOrCreateTextChannel("🌐・server-test-demo", catStore, "Địa chỉ IP Server Minecraft & Đối tác Nguyen SMP để trải nghiệm trực tiếp");
    
    // Kênh Vouch cho phép @everyone gửi phản hồi
    const vouchOverwrites = [
      {
        id: everyoneRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.EmbedLinks,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AddReactions
        ]
      },
      {
        id: botUser.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.EmbedLinks,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.ManageMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.ManageChannels
        ]
      }
    ];
    if (staffRole) {
      vouchOverwrites.push({
        id: staffRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.EmbedLinks,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.ManageMessages,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      });
    }
    const chVouch = await getOrCreateTextChannel("⭐・đánh-giá-uy-tín", catStore, "Nơi khách hàng gửi đánh giá uy tín sau khi giao dịch", vouchOverwrites);

    // -------------------------------------------------------------------------
    // 3. DANH MỤC: 🎫 ━━━ HỖ TRỢ & MUA HÀNG ━━━
    // -------------------------------------------------------------------------
    const supportOverwrites = [
      {
        id: everyoneRole.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
        deny: [
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.CreatePublicThreads,
          PermissionsBitField.Flags.CreatePrivateThreads,
          PermissionsBitField.Flags.SendMessagesInThreads
        ]
      },
      {
        id: botUser.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ManageChannels,
          PermissionsBitField.Flags.EmbedLinks,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.ManageMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AddReactions
        ]
      }
    ];
    if (staffRole) {
      supportOverwrites.push({
        id: staffRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.EmbedLinks,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      });
    }

    const catSupport = await getOrCreateCategory("🎫 ━━━ HỖ TRỢ & MUA HÀNG ━━━", supportOverwrites);

    const chOrderTicket = await getOrCreateTextChannel("🛒・mua-plugin", catSupport, "Nhấn nút để mở Ticket mua plugin hoặc đặt làm plugin theo yêu cầu");
    const chTechTicket = await getOrCreateTextChannel("🛠️・hỗ-trợ-kỹ-thuật", catSupport, "Nhấn nút để mở Ticket yêu cầu hỗ trợ lỗi, cài đặt, tương thích Paper/Folia");
    const chCustomTicket = await getOrCreateTextChannel("📝・đặt-làm-plugin", catSupport, "Nhấn nút để mở Ticket trao đổi dự án Plugin độc quyền theo ý tưởng");

    // -------------------------------------------------------------------------
    // 4. DANH MỤC: 💬 ━━━ SẢNH GIAO LƯU ━━━
    // -------------------------------------------------------------------------
    const communityOverwrites = [
      {
        id: everyoneRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel, 
          PermissionsBitField.Flags.SendMessages, 
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.EmbedLinks,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.AddReactions
        ]
      },
      {
        id: botUser.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.EmbedLinks,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.ManageMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.ManageChannels
        ]
      }
    ];
    if (staffRole) {
      communityOverwrites.push({
        id: staffRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.EmbedLinks,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.ManageMessages,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      });
    }

    const catCommunity = await getOrCreateCategory("💬 ━━━ SẢNH GIAO LƯU ━━━", communityOverwrites);

    const chChat = await getOrCreateTextChannel("💬・trò-chuyện-chung", catCommunity, "Giao lưu, trò chuyện tự do cùng các Dev và Admin Server Minecraft khác");
    const chSuggestions = await getOrCreateTextChannel("💡・góp-ý-ý-tưởng", catCommunity, "Đóng góp ý tưởng tính năng bạn muốn xuất hiện trong các Plugin");
    const chShowcase = await getOrCreateTextChannel("📸・khoe-server-mc", catCommunity, "Nơi khoe máy chủ Minecraft của bạn đang dùng plugin LS Studio");
    const chBotCommands = await getOrCreateTextChannel("🤖・lệnh-bot", catCommunity, "Kênh sử dụng các lệnh bot");

    // -------------------------------------------------------------------------
    // 5. DANH MỤC: 👑 ━━━ KHÁCH HÀNG VIP ━━━
    // -------------------------------------------------------------------------
    const vipCatOverwrites = [
      {
        id: everyoneRole.id,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: botUser.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.EmbedLinks,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.ManageChannels,
          PermissionsBitField.Flags.ManageMessages,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      }
    ];
    if (customerRole) {
      vipCatOverwrites.push({
        id: customerRole.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory]
      });
    }
    if (vipRole) {
      vipCatOverwrites.push({
        id: vipRole.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory]
      });
    }
    if (staffRole) {
      vipCatOverwrites.push({
        id: staffRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel, 
          PermissionsBitField.Flags.SendMessages, 
          PermissionsBitField.Flags.EmbedLinks, 
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.ManageMessages
        ]
      });
    }

    const catVIP = await getOrCreateCategory("👑 ━━━ KHÁCH HÀNG VIP ━━━", vipCatOverwrites);

    // Kênh tải file: Chỉ Staff và Bot được gửi file, Khách & VIP chỉ được đọc
    const downloadOverwrites = [
      {
        id: everyoneRole.id,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: botUser.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.EmbedLinks,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.ManageMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.ManageChannels
        ]
      }
    ];
    if (customerRole) {
      downloadOverwrites.push({
        id: customerRole.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
        deny: [
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.CreatePublicThreads,
          PermissionsBitField.Flags.CreatePrivateThreads,
          PermissionsBitField.Flags.SendMessagesInThreads
        ]
      });
    }
    if (vipRole) {
      downloadOverwrites.push({
        id: vipRole.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
        deny: [
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.CreatePublicThreads,
          PermissionsBitField.Flags.CreatePrivateThreads,
          PermissionsBitField.Flags.SendMessagesInThreads
        ]
      });
    }
    if (staffRole) {
      downloadOverwrites.push({
        id: staffRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel, 
          PermissionsBitField.Flags.SendMessages, 
          PermissionsBitField.Flags.AttachFiles, 
          PermissionsBitField.Flags.EmbedLinks, 
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.ManageMessages
        ]
      });
    }

    const chDownloads = await getOrCreateTextChannel("📦・tải-plugin-updates", catVIP, "Khu vực nhận file .jar chính thức và bản vá lỗi mới nhất cho Khách Hàng", downloadOverwrites);

    // Kênh chat Khách Hàng: Cả Khách, VIP và Staff đều được chat
    const vipChatOverwrites = [
      {
        id: everyoneRole.id,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: botUser.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.EmbedLinks,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.ManageMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.ManageChannels
        ]
      }
    ];
    if (customerRole) {
      vipChatOverwrites.push({
        id: customerRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel, 
          PermissionsBitField.Flags.SendMessages, 
          PermissionsBitField.Flags.AttachFiles, 
          PermissionsBitField.Flags.EmbedLinks, 
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AddReactions
        ]
      });
    }
    if (vipRole) {
      vipChatOverwrites.push({
        id: vipRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel, 
          PermissionsBitField.Flags.SendMessages, 
          PermissionsBitField.Flags.AttachFiles, 
          PermissionsBitField.Flags.EmbedLinks, 
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AddReactions
        ]
      });
    }
    if (staffRole) {
      vipChatOverwrites.push({
        id: staffRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel, 
          PermissionsBitField.Flags.SendMessages, 
          PermissionsBitField.Flags.AttachFiles, 
          PermissionsBitField.Flags.EmbedLinks, 
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.ManageMessages
        ]
      });
    }

    const chVipChat = await getOrCreateTextChannel("💬・chat-khách-hàng", catVIP, "Kênh chat ưu tiên và hỗ trợ riêng tư dành cho Khách Hàng đã mua Plugin", vipChatOverwrites);

    // -------------------------------------------------------------------------
    // 6. DANH MỤC: 🔒 ━━━ BAN QUẢN TRỊ ━━━ (STAFF & DEV ONLY)
    // -------------------------------------------------------------------------
    const adminOverwrites = [
      {
        id: everyoneRole.id,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: botUser.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.EmbedLinks,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.ManageChannels,
          PermissionsBitField.Flags.ManageMessages,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      }
    ];
    if (staffRole) {
      adminOverwrites.push({
        id: staffRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel, 
          PermissionsBitField.Flags.SendMessages, 
          PermissionsBitField.Flags.ReadMessageHistory, 
          PermissionsBitField.Flags.EmbedLinks, 
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.ManageMessages
        ]
      });
    }
    if (devRole) {
      adminOverwrites.push({
        id: devRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel, 
          PermissionsBitField.Flags.SendMessages, 
          PermissionsBitField.Flags.ReadMessageHistory, 
          PermissionsBitField.Flags.EmbedLinks, 
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.ManageMessages
        ]
      });
    }
    if (founderRole) {
      adminOverwrites.push({
        id: founderRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel, 
          PermissionsBitField.Flags.SendMessages, 
          PermissionsBitField.Flags.ReadMessageHistory, 
          PermissionsBitField.Flags.EmbedLinks, 
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.ManageMessages
        ]
      });
    }

    const catAdmin = await getOrCreateCategory("🔒 ━━━ BAN QUẢN TRỊ ━━━", adminOverwrites);

    await getOrCreateTextChannel("📊・nhật-ký-giao-dịch", catAdmin, "Lịch sử mua hàng, giao dịch và ticket transcript");
    await getOrCreateTextChannel("💬・nội-bộ-staff", catAdmin, "Kênh trao đổi nội bộ đội ngũ phát triển và quản lý");

    // -------------------------------------------------------------------------
    // 7. DANH MỤC: 🔊 ━━━ KÊNH THOẠI ━━━
    // -------------------------------------------------------------------------
    const voiceCatOverwrites = [
      {
        id: everyoneRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.Connect,
          PermissionsBitField.Flags.Speak
        ]
      },
      {
        id: botUser.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.Connect,
          PermissionsBitField.Flags.Speak,
          PermissionsBitField.Flags.ManageChannels
        ]
      }
    ];
    if (staffRole) {
      voiceCatOverwrites.push({
        id: staffRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.Connect,
          PermissionsBitField.Flags.Speak,
          PermissionsBitField.Flags.MuteMembers,
          PermissionsBitField.Flags.DeafenMembers,
          PermissionsBitField.Flags.MoveMembers
        ]
      });
    }

    const catVoice = await getOrCreateCategory("🔊 ━━━ KÊNH THOẠI ━━━", voiceCatOverwrites);

    await getOrCreateVoiceChannel("🔊・Phòng Chờ Giao Lưu", catVoice);
    await getOrCreateVoiceChannel("🛠️・Hỗ Trợ Kỹ Thuật 1-1", catVoice);
    await getOrCreateVoiceChannel("🎮・Voice Gaming", catVoice);

    console.log("✨ Toàn bộ Channels & Categories đã được đồng bộ chuẩn đẹp!");

    // =========================================================================
    // 3. ĐĂNG VÀ LÀM MỚI CÁC EMBED THÔNG BÁO, BẢNG GIÁ & TICKETS
    // =========================================================================
    console.log("\n📝 Bắt đầu đăng tải các Embeds giao diện...");

    // Helper tạo nút chung
    const makeTicketButtons = () => new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_buy')
        .setLabel('🛒 Mua Plugin / Mở Ticket')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('ticket_pricing')
        .setLabel('💰 Xem Bảng Giá')
        .setStyle(ButtonStyle.Secondary)
    );

    // 1. Embed Luật & Chính Sách
    const embedRules = new EmbedBuilder()
      .setColor("#FF4500")
      .setTitle("📜 QUY ĐỊNH & ĐIỀU KHOẢN DỊCH VỤ - LS STUDIO")
      .setDescription("Chào mừng bạn đến với **LS STUDIO** — Nơi cung cấp các giải pháp & Plugin Minecraft chất lượng cao. Vui lòng đọc kỹ các quy định sau đây:")
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
      .setFooter({ text: "LS STUDIO • Uy Tín - Chất Lượng - Tối Ưu Tột Đỉnh", iconURL: readyUser.displayAvatarURL() })
      .setTimestamp();

    await publishOrRefreshEmbed(chRules, { embeds: [embedRules] });

    // 2. Embed Thông Báo Chào Mừng
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
      .setFooter({ text: "LS STUDIO • Minecraft Developer Suite", iconURL: readyUser.displayAvatarURL() });

    await publishOrRefreshEmbed(chAnnounce, { embeds: [embedWelcome] });

    // 3. Embed Danh Sách Plugin Tiêu Biểu
    const embedPlugins = new EmbedBuilder()
      .setColor("#00E676")
      .setTitle("💎 DANH SÁCH PLUGIN TIÊU BIỂU - LS STUDIO")
      .setDescription("Tất cả các Plugin tại LS Studio đều được tối ưu hóa hiệu năng cao, hỗ trợ đa phiên bản từ `1.16.x -> 1.21.x` và tương thích 100% với Paper/Folia.")
      .addFields(
        {
          name: "🛡️ 1. LS-AntiCheat & Behavior Security",
          value: "• **Tính năng:** Bắt WallHit (xuyên mạng nhện/tường), InvMove A-F, AutoEat/Fish/Potion, Fake Máu.\n• **Hỗ trợ:** Paper / Purpur / Folia (1.16 - 1.21+)\n• **Giá:** `30.000 VNĐ` (~$1.50)"
        },
        {
          name: "👁️ 2. LS-AntiFreeCam & Obfuscator",
          value: "• **Tính năng:** Ẩn quặng quý và rương đồ khi ngoài tầm nhìn, khắc chế triệt để Freecam, Chest ESP, Baritone đào tự động.\n• **Hỗ trợ:** Paper / Purpur / Folia (1.16 - 1.21+)\n• **Giá:** `59.000 VNĐ` (~$2.50)"
        },
        {
          name: "🚫 3. LS-AntiClient & BrandShield",
          value: "• **Tính năng:** Nhận diện và chặn client hack (Meteor, LiquidBounce, Aristois, Fabric Cheats...).\n• **Hỗ trợ:** Paper / Purpur / Folia (1.16 - 1.21+)\n• **Giá:** `99.000 VNĐ` (~$4.00)"
        },
        {
          name: "🎁 4. LS-GiftCode & Rewards",
          value: "• **Tính năng:** Hệ thống giftcode tân thủ, code sự kiện, giới hạn lượt nhập, lưu async MySQL/SQLite.\n• **Hỗ trợ:** Paper / Purpur / Folia (1.16 - 1.21+)\n• **Giá:** `30.000 VNĐ` (~$1.50)"
        },
        {
          name: "👑 5. Combo Trọn Bộ Bảo Vệ (AntiFreeCam + AntiClient)",
          value: "• Sở hữu trọn bộ cả 2 giải pháp bảo vệ cốt lõi cho server với giá ưu đãi tiết kiệm.\n• **Giá Combo:** `129.000 VNĐ` (~$5.50)"
        }
      )
      .setFooter({ text: "Mở Ticket tại kênh #mua-plugin để đặt mua và nhận file ngay!" });

    await publishOrRefreshEmbed(chPlugins, { embeds: [embedPlugins], components: [makeTicketButtons()] });

    // 4. Embed Bảng Giá & Dịch Vụ
    const embedPricing = new EmbedBuilder()
      .setColor("#FFD600")
      .setTitle("💰 BẢNG GIÁ DỊCH VỤ CHÍNH THỨC - LS STUDIO")
      .setDescription("Bảng giá minh bạch, cam kết không phát sinh chi phí ẩn. Hỗ trợ bảo hành và cập nhật trọn đời.")
      .addFields(
        {
          name: "📦 1. Plugin Đóng Gói Sẵn (Pre-made Plugins)",
          value: "• **LS-AntiCheat:** `30.000đ`\n• **LS-AntiFreeCam:** `59.000đ`\n• **LS-AntiClient:** `99.000đ`\n• **LS-GiftCode:** `30.000đ`\n• **Combo Anti (FreeCam + Client):** `129.000đ`\n• Miễn phí update trọn đời các bản vá lỗi."
        },
        {
          name: "🛠️ 2. Lập Trình Plugin & Mod Theo Ý Tưởng (Custom Dev)",
          value: "• **Cỡ Nhỏ (Tiện ích, lệnh, GUI, fix bug):** `50.000đ - 150.000đ`\n• **Cỡ Trung (Tính năng gameplay mới, event, mini-system):** `200.000đ - 500.000đ`\n• **Cỡ Lớn (Hệ thống RPG tổng thể, Minigame độc quyền):** `Thỏa thuận`\n• **Mod Java Custom (Forge/Fabric/NeoForge):** `Thỏa thuận theo tính năng`"
        },
        {
          name: "⚡ 3. Dịch Vụ Tối Ưu & Sửa Lỗi Server",
          value: "• Fix lỗi TPS tụt, phân tích Spark / Timings, dọn dẹp cấu hình: `50.000đ - 100.000đ`\n• Port plugin cũ sang tương thích **Folia Multithreading**: `Thỏa thuận`"
        },
        {
          name: "💳 4. Phương Thức Thanh Toán Hỗ Trợ",
          value: "• 🏦 **Chuyển Khoản Ngân Hàng (VietQR 24/7):** MBBank - `844515133333` (VAN HUU PHAM NGUYEN)\n• 📱 **Ví Điện Tử MoMo / Thẻ Cào:** Hỗ trợ linh hoạt\n• 🌐 **PayPal / Crypto:** Dành cho khách hàng quốc tế qua Ticket"
        }
      )
      .setFooter({ text: "Mọi giao dịch chỉ thực hiện qua Ticket chính thức tại Discord LS Studio!" });

    await publishOrRefreshEmbed(chPricing, { embeds: [embedPricing], components: [makeTicketButtons()] });

    // 5. Embed Server Demo & Đối Tác
    const embedDemo = new EmbedBuilder()
      .setColor("#9C27B0")
      .setTitle("🌐 MÁY CHỦ THỰC CHIẾN & ĐỐI TÁC CHIẾN LƯỢC: NGUYEN SMP")
      .setDescription(
        "Bạn muốn kiểm chứng độ mượt mà và hiệu quả bắt hack thực tế của các Plugin LS Studio trong một máy chủ đang hoạt động đông người?\n\n" +
        "🎮 **MÁY CHỦ ĐỐI TÁC: NGUYEN SMP (Survival MultiPlayer)**\n" +
        "• **Địa chỉ IP Server:** `fusion.pikamc.vn:26111`\n" +
        "• **Phiên bản:** `1.21+` (PC Java Edition)\n" +
        "• **Tình trạng:** Đang vận hành chính thức 24/7 với hệ thống Anti-Cheat & Packet Shield độc quyền của LS Studio.\n\n" +
        "⚔️ **Trải nghiệm thực tế:**\n" +
        "Vào chơi sinh tồn, trải nghiệm PvP cực mượt không lag và tận mắt thấy hệ thống Anti ngăn chặn triệt để Freecam / X-Ray / Hack Client!"
      )
      .addFields(
        { name: "🔗 Tham Gia Discord Nguyen SMP", value: "https://discord.gg/vjFkC6cRdj" }
      )
      .setFooter({ text: "LS STUDIO • Giải Pháp Plugin & Bảo Mật Thực Chiến" })
      .setTimestamp();

    const btnSmp = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('🎮 Tham Gia Discord Nguyen SMP')
        .setStyle(ButtonStyle.Link)
        .setURL('https://discord.gg/vjFkC6cRdj')
    );

    await publishOrRefreshEmbed(chDemo, { embeds: [embedDemo], components: [btnSmp] });

    // 6. Ticket Mua Hàng với Button
    const embedOrder = new EmbedBuilder()
      .setColor("#00E676")
      .setTitle("🛒 TRUNG TÂM ĐẶT MUA PLUGIN - LS STUDIO")
      .setDescription(
        "Bạn đã chọn được Plugin ưng ý hoặc cần tư vấn phương thức thanh toán?\n\n" +
        "👉 **Cách thức giao dịch:**\n" +
        "1. Nhấn vào nút **[🛒 Mua Plugin / Mở Ticket]** bên dưới.\n" +
        "2. Một kênh chat riêng tư sẽ được tạo tự động cho bạn và Staff.\n" +
        "3. Chọn sản phẩm từ menu thả xuống -> Quét mã VietQR MBBank tự động -> Nhận file `.jar` và role Khách Hàng ngay lập tức!\n\n" +
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

    await publishOrRefreshEmbed(chOrderTicket, { embeds: [embedOrder], components: [rowOrder] });

    // 7. Ticket Hỗ Trợ Kỹ Thuật
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

    await publishOrRefreshEmbed(chTechTicket, { embeds: [embedTech], components: [rowTech] });

    // 8. Ticket Đặt Custom Plugin
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

    await publishOrRefreshEmbed(chCustomTicket, { embeds: [embedCustom], components: [rowCustom] });

    console.log("\n🎉 LS STUDIO SERVER SETUP HOÀN TẤT 100% VÀ KHÔNG GẶP LỖI!");
    return { success: true };

  } catch (error) {
    console.error("❌ Lỗi nghiêm trọng trong quá trình setup:", error);
    throw error;
  }
}

if (require.main === module) {
  if (!TOKEN || TOKEN === 'YOUR_BOT_TOKEN_HERE') {
    console.error('❌ Lỗi: Chưa cung cấp Discord Bot Token. Vui lòng thiết lập DISCORD_TOKEN trong file .env hoặc token.local.js');
    process.exit(1);
  }

  const WATCHDOG_TIMEOUT_MS = 180000;
  const watchdog = setTimeout(async () => {
    console.error(`⏱️ [WATCHDOG] Quá thời gian thực thi (${WATCHDOG_TIMEOUT_MS / 1000}s). Tự động hủy kết nối Discord và dừng tiến trình.`);
    try { await client.destroy(); } catch {}
    process.exit(1);
  }, WATCHDOG_TIMEOUT_MS);
  if (watchdog.unref) watchdog.unref();

  client.on(Events.Error, (err) => {
    console.error('❌ Lỗi Discord Client:', err.message || err);
  });

  process.on('unhandledRejection', async (reason) => {
    clearTimeout(watchdog);
    console.error('❌ Lỗi không kiểm soát (Unhandled Rejection):', reason);
    try { await client.destroy(); } catch {}
    process.exit(1);
  });

  client.once(Events.ClientReady, async (readyClient) => {
    try {
      await runServerSetup(client, GUILD_ID);
      clearTimeout(watchdog);
      try { await client.destroy(); } catch {}
      process.exit(0);
    } catch (err) {
      clearTimeout(watchdog);
      try { await client.destroy(); } catch {}
      process.exit(1);
    }
  });

  client.login(TOKEN).catch((err) => {
    clearTimeout(watchdog);
    console.error('❌ Đăng nhập Discord thất bại:', err.message || err);
    process.exit(1);
  });
}

module.exports = {
  client,
  GUILD_ID,
  runServerSetup
};
