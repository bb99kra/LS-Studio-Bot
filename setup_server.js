require('dotenv').config();
const fs = require('fs');
const path = require('path');
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

const tokenLocalPath = path.join(__dirname, 'token.local.js');
const localConfig = fs.existsSync(tokenLocalPath) ? require(tokenLocalPath) : {};
const TOKEN = process.env.DISCORD_TOKEN || localConfig.TOKEN || localConfig.DISCORD_TOKEN || '';
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

/**
 * Helper: Bọc hàm REST Discord API với cơ chế tự động Retry, Exponential Backoff & Jitter
 * Bóc tách chính xác retry_after từ mọi định dạng lỗi Discord.js v14 và HTTP 429 REST API
 * @param {Function} fn - Async function gọi Discord API
 * @param {number} retries - Số lần thử lại tối đa (mặc định 5)
 * @param {number} delayMs - Độ trễ cơ sở ban đầu (ms)
 */
async function safeApiCall(fn, retries = 5, delayMs = 1000) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await fn();
      await sleep(250); // Khoảng nghỉ an toàn giữa các request
      return result;
    } catch (error) {
      lastError = error;
      const isRateLimit = 
        error?.status === 429 || 
        error?.code === 429 || 
        error?.code === 'RATE_LIMIT' || 
        error?.name === 'RateLimitError' || 
        (error?.message && typeof error.message === 'string' && error.message.toLowerCase().includes('rate limit'));

      if (isRateLimit) {
        let retryAfterMs = 0;

        // 1. Kiểm tra error.retryAfter (Discord.js RateLimitError / DiscordAPIError)
        if (typeof error.retryAfter === 'number' && error.retryAfter > 0) {
          retryAfterMs = error.retryAfter > 500 ? error.retryAfter : Math.round(error.retryAfter * 1000);
        }
        // 2. Kiểm tra error.rawError?.retry_after (Discord REST API payload)
        else if (typeof error.rawError?.retry_after === 'number' && error.rawError.retry_after > 0) {
          const val = error.rawError.retry_after;
          retryAfterMs = val > 500 ? val : Math.round(val * 1000);
        }
        // 3. Kiểm tra error.data?.retry_after hoặc error.response?.data?.retry_after
        else if (typeof error.data?.retry_after === 'number' && error.data.retry_after > 0) {
          const val = error.data.retry_after;
          retryAfterMs = val > 500 ? val : Math.round(val * 1000);
        } else if (typeof error.response?.data?.retry_after === 'number' && error.response.data.retry_after > 0) {
          const val = error.response.data.retry_after;
          retryAfterMs = val > 500 ? val : Math.round(val * 1000);
        }
        // 4. Kiểm tra error.timeToReset (Discord.js REST)
        else if (typeof error.timeToReset === 'number' && error.timeToReset > 0) {
          retryAfterMs = error.timeToReset;
        }
        // 5. Kiểm tra HTTP Response Headers: 'retry-after'
        else if (error.headers || error.response?.headers) {
          const headers = error.headers || error.response.headers;
          const headerVal = typeof headers.get === 'function' ? headers.get('retry-after') : headers['retry-after'];
          if (headerVal && !isNaN(Number(headerVal))) {
            const num = Number(headerVal);
            retryAfterMs = num > 500 ? num : Math.round(num * 1000);
          }
        }

        // Nếu không trích xuất được retry_after cụ thể, áp dụng Exponential Backoff + Jitter
        if (!retryAfterMs || retryAfterMs <= 0) {
          retryAfterMs = Math.round(delayMs * Math.pow(2, attempt - 1) + Math.random() * 500);
        } else {
          retryAfterMs += 500; // Thêm buffer 500ms an toàn tránh chạm sát biên rate limit
        }

        if (attempt === retries) {
          console.warn(`   ⏳ Rate limit detected (429) ở lần thử cuối (${attempt}/${retries}). Chờ ${retryAfterMs}ms trước khi thử lại lần chót...`);
        } else {
          console.warn(`   ⏳ Rate limit detected (429). Chờ ${retryAfterMs}ms trước khi thử lại (Lần ${attempt}/${retries})...`);
        }
        await sleep(retryAfterMs);
      } else if (attempt === retries) {
        throw error;
      } else {
        // Lỗi tạm thời mạng hoặc 5xx Discord API (500, 502, 503, 504, ECONNRESET, ETIMEDOUT)
        const backoffMs = Math.round(delayMs * Math.pow(1.5, attempt - 1) + Math.random() * 200);
        console.warn(`   ⚠️ Warning API call failed (Lần ${attempt}/${retries}): ${error.message}. Đang thử lại sau ${backoffMs}ms...`);
        await sleep(backoffMs);
      }
    }
  }
  throw lastError || new Error(`safeApiCall: Exceeded maximum retries (${retries})`);
}

/**
 * Helper: Kiểm tra hai tập hợp thuộc tính Role có hoàn toàn trùng khớp hay không
 */
function areRolePropsEqual(role, rDef) {
  if (!role || !rDef) return false;
  if (rDef.color) {
    const roleHex = (role.hexColor || '').toLowerCase();
    const targetHex = rDef.color.toLowerCase();
    if (roleHex !== targetHex) return false;
  }
  if (rDef.hoist !== undefined && role.hoist !== !!rDef.hoist) return false;
  if (rDef.mentionable !== undefined && role.mentionable !== !!rDef.mentionable) return false;
  if (rDef.permissions !== undefined) {
    const targetBits = new PermissionsBitField(rDef.permissions).bitfield;
    const roleBits = role.permissions instanceof PermissionsBitField ? role.permissions.bitfield : new PermissionsBitField(role.permissions || 0n).bitfield;
    if (targetBits !== roleBits) return false;
  }
  return true;
}

/**
 * Helper: Chuẩn hóa mảng Overwrites thành Map để so sánh chính xác theo bitfield
 */
function normalizeOverwrites(overwrites) {
  if (!Array.isArray(overwrites)) return new Map();
  const map = new Map();
  for (const ow of overwrites) {
    if (!ow || !ow.id) continue;
    const allowBit = new PermissionsBitField(ow.allow || 0n).bitfield;
    const denyBit = new PermissionsBitField(ow.deny || 0n).bitfield;
    map.set(String(ow.id), {
      id: String(ow.id),
      allow: allowBit,
      deny: denyBit,
      type: ow.type !== undefined ? ow.type : undefined
    });
  }
  return map;
}

/**
 * Helper: So sánh quyền hạn (permissionOverwrites) giữa kênh hiện có và cấu hình mong muốn
 */
function areOverwritesEqual(currentOverwritesManager, desiredOverwrites) {
  if (!currentOverwritesManager || !currentOverwritesManager.cache) return false;
  const desiredMap = normalizeOverwrites(desiredOverwrites);
  const cache = currentOverwritesManager.cache;

  if (cache.size !== desiredMap.size) return false;

  for (const [id, desired] of desiredMap.entries()) {
    const existing = cache.get(id);
    if (!existing) return false;
    const existingAllow = existing.allow instanceof PermissionsBitField ? existing.allow.bitfield : new PermissionsBitField(existing.allow || 0n).bitfield;
    const existingDeny = existing.deny instanceof PermissionsBitField ? existing.deny.bitfield : new PermissionsBitField(existing.deny || 0n).bitfield;
    if (existingAllow !== desired.allow || existingDeny !== desired.deny) {
      return false;
    }
    if (desired.type !== undefined && existing.type !== undefined && existing.type !== desired.type) {
      return false;
    }
  }
  return true;
}

/**
 * Helper: Kiểm tra xem Embeds và Buttons của tin nhắn có trùng khớp với payload mới không (Idempotent Embeds)
 */
function areEmbedsAndComponentsEqual(existingMsg, newPayload) {
  if (!existingMsg) return false;
  
  const existingContent = (existingMsg.content || '').trim();
  const newContent = (newPayload.content || '').trim();
  if (existingContent !== newContent) return false;

  const existingEmbeds = existingMsg.embeds || [];
  const newEmbeds = (newPayload.embeds || []).map(e => (typeof e?.toJSON === 'function' ? e.toJSON() : e));
  if (existingEmbeds.length !== newEmbeds.length) return false;

  for (let i = 0; i < newEmbeds.length; i++) {
    const eExist = typeof existingEmbeds[i]?.toJSON === 'function' ? existingEmbeds[i].toJSON() : existingEmbeds[i];
    const eNew = newEmbeds[i];
    if ((eExist?.title || '') !== (eNew?.title || '')) return false;
    if ((eExist?.description || '') !== (eNew?.description || '')) return false;
    const existFields = eExist?.fields || [];
    const newFields = eNew?.fields || [];
    if (existFields.length !== newFields.length) return false;
    for (let f = 0; f < newFields.length; f++) {
      if (existFields[f]?.name !== newFields[f]?.name || existFields[f]?.value !== newFields[f]?.value) {
        return false;
      }
    }
  }

  const existingComponents = existingMsg.components || [];
  const newComponents = (newPayload.components || []).map(c => (typeof c?.toJSON === 'function' ? c.toJSON() : c));
  if (existingComponents.length !== newComponents.length) return false;

  for (let r = 0; r < newComponents.length; r++) {
    const cExist = typeof existingComponents[r]?.toJSON === 'function' ? existingComponents[r].toJSON() : existingComponents[r];
    const cNew = newComponents[r];
    const compExist = cExist?.components || [];
    const compNew = cNew?.components || [];
    if (compExist.length !== compNew.length) return false;
    for (let b = 0; b < compNew.length; b++) {
      const bExistId = compExist[b]?.custom_id || compExist[b]?.customId;
      const bNewId = compNew[b]?.custom_id || compNew[b]?.customId;
      if (bExistId !== bNewId) return false;
      if (compExist[b]?.label !== compNew[b]?.label) return false;
      if (compExist[b]?.style !== compNew[b]?.style) return false;
    }
  }

  return true;
}

/**
 * Helper: Đồng bộ vị trí (Position Ordering) của toàn bộ Categories và Channels trong máy chủ
 */
async function syncChannelAndCategoryPositions(guild, botMember, categoryOrderList, channelOrderMap) {
  if (!botMember || !botMember.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
    console.warn("   ⚠️ Bot thiếu quyền ManageChannels để sắp xếp thứ tự danh mục và kênh.");
    return;
  }

  const updates = [];

  // 1. Kiểm tra vị trí Categories (đặt liên tiếp từ 0..N)
  categoryOrderList.forEach((cat, index) => {
    if (cat && cat.position !== index) {
      updates.push({
        channel: cat.id,
        position: index
      });
    }
  });

  // 2. Kiểm tra vị trí Channels trong từng Category
  for (const [catId, channels] of channelOrderMap.entries()) {
    channels.forEach((ch, index) => {
      if (ch) {
        const posMismatch = ch.position !== index;
        const parentMismatch = ch.parentId !== catId;
        if (posMismatch || parentMismatch) {
          updates.push({
            channel: ch.id,
            position: index,
            parent: catId
          });
        }
      }
    });
  }

  if (updates.length === 0) {
    console.log("   ✅ Thứ tự Categories & Channels đã đồng bộ chuẩn xác (không cần di chuyển)!");
    return;
  }

  console.log(`   🔄 Đang đồng bộ vị trí cho ${updates.length} kênh/danh mục...`);
  if (typeof guild.channels.setPositions === 'function') {
    try {
      await safeApiCall(() => guild.channels.setPositions(updates));
      console.log("   ✅ Đã đồng bộ vị trí toàn bộ Categories & Channels thành công!");
    } catch (err) {
      console.warn(`   ! guild.channels.setPositions gặp lỗi: ${err.message}. Đang thử cập nhật từng kênh...`);
      for (const up of updates) {
        const targetCh = guild.channels.cache?.get(up.channel);
        if (targetCh && typeof targetCh.setPosition === 'function') {
          await safeApiCall(() => targetCh.setPosition(up.position)).catch(() => {});
        }
      }
    }
  } else {
    for (const up of updates) {
      const targetCh = guild.channels.cache?.get(up.channel);
      if (targetCh && typeof targetCh.setPosition === 'function') {
        await safeApiCall(() => targetCh.setPosition(up.position)).catch(() => {});
      }
    }
    console.log("   ✅ Đã cập nhật vị trí các kênh theo thứ tự chuẩn!");
  }
}

async function runServerSetup(clientInstance = client, targetGuildId = GUILD_ID) {
  const readyUser = clientInstance.user || { tag: 'Bot', id: 'bot_id' };
  console.log(`🤖 Logged in as ${readyUser.tag}! Bắt đầu khởi tạo/đồng bộ hệ thống Server LS STUDIO...`);

  try {
    const guild = await safeApiCall(() => clientInstance.guilds.fetch(targetGuildId));
    if (!guild) {
      console.error("❌ Guild không tồn tại hoặc Bot chưa tham gia Guild!");
      throw new Error(`Guild không tồn tại hoặc Bot chưa tham gia Guild: ${targetGuildId}`);
    }

    console.log(`🏰 Target Server: ${guild.name} (${guild.id})`);

    // =========================================================================
    // 0. PRE-FLIGHT PERMISSION CHECK (KIỂM TRA QUYỀN HẠN CỦA BOT)
    // =========================================================================
    console.log("🔍 Đang kiểm tra quyền hạn của Bot (Pre-flight Permission Check)...");
    const botMember = guild.members.me || await safeApiCall(() => guild.members.fetch(readyUser.id)).catch(() => null);
    
    if (!botMember) {
      console.error("❌ Không thể lấy thông tin Bot Member trong Guild!");
      throw new Error(`Không thể lấy thông tin Bot Member cho id: ${readyUser.id}`);
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
        // 1. Kiểm tra nếu là Managed / Integration Role (Bot Role, Booster Role...)
        if (role.managed) {
          console.log(`   ℹ️ Role đã tồn tại nhưng là Managed Role (tích hợp/bot): ${rDef.name} (Bỏ qua chỉnh sửa)`);
        } else if (botMember.permissions.has(PermissionsBitField.Flags.ManageRoles) && role.position < botMember.roles.highest.position) {
          // 2. Chống gọi API edit thừa thãi nếu thuộc tính role đã khớp chuẩn
          const colorMatch = !rDef.color || (role.hexColor && role.hexColor.toLowerCase() === rDef.color.toLowerCase());
          const hoistMatch = role.hoist === rDef.hoist;
          const mentionableMatch = role.mentionable === rDef.mentionable;
          const permissionsMatch = Array.isArray(rDef.permissions)
            ? (rDef.permissions.length === 0 ? role.permissions.bitfield === 0n : role.permissions.has(rDef.permissions))
            : true;

          const needsUpdate = !colorMatch || !hoistMatch || !mentionableMatch || !permissionsMatch;

          if (!needsUpdate) {
            console.log(`   ✓ Role đã tồn tại (thuộc tính đã chuẩn, không cần gọi API edit): ${rDef.name}`);
          } else {
            try {
              role = await safeApiCall(() => role.edit({
                color: rDef.color,
                hoist: rDef.hoist,
                mentionable: rDef.mentionable,
                permissions: rDef.permissions
              }));
              console.log(`   ✓ Role đã tồn tại (đã đồng bộ thuộc tính): ${rDef.name}`);
            } catch (e) {
              console.log(`   ✓ Role đã tồn tại: ${rDef.name} (Bỏ qua đồng bộ: ${e.message})`);
            }
          }
        } else {
          console.log(`   ✓ Role đã tồn tại (Hierarchy cao hơn/ngang Bot hoặc thiếu quyền): ${rDef.name}`);
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

    // =========================================================================
    // 1.1 THIẾT LẬP THỨ BẬC ROLES (ROLE HIERARCHY POSITIONING)
    // =========================================================================
    if (botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      try {
        const manageableRoles = [];
        for (const rDef of roleDefs) {
          const r = rolesMap[rDef.name];
          // Bỏ qua managed roles, @everyone và các role có position >= bot
          if (r && !r.managed && r.id !== guild.id && r.position < botMember.roles.highest.position) {
            manageableRoles.push(r);
          }
        }

        if (manageableRoles.length > 1 && typeof guild.roles.setPositions === 'function') {
          // roleDefs được định nghĩa từ cao nhất (index 0) xuống thấp nhất
          // Vị trí cao nhất bot có thể gán an toàn là botMember.roles.highest.position - 1
          const maxPosition = Math.max(1, botMember.roles.highest.position - 1);
          const positionUpdates = manageableRoles.map((role, idx) => ({
            role: role.id,
            position: Math.max(1, maxPosition - idx)
          }));
          await safeApiCall(() => guild.roles.setPositions(positionUpdates));
          console.log("   ✅ Đã sắp xếp và đồng bộ vị trí thứ bậc Roles (Role Hierarchy) chuẩn xác!");
        }
      } catch (posErr) {
        console.warn(`   ⚠️ Không thể đồng bộ vị trí Role Hierarchy: ${posErr.message}`);
      }
    }

    const everyoneRole = guild.roles?.everyone || (guild.roles?.cache ? (guild.roles.cache.get(guild.id) || guild.roles.cache.find(r => r.name === '@everyone')) : null) || { id: guild.id, name: '@everyone' };
    const everyoneRoleId = everyoneRole?.id || guild.id;
    const customerRole = rolesMap["🛒・Khách Hàng (Buyer)"];
    const vipRole = rolesMap["💎・VIP Customer"];
    const staffRole = rolesMap["🛡️・Staff / Support"];
    const devRole = rolesMap["🛠️・Developer"];
    const founderRole = rolesMap["👑・Founder / Lead Dev"];
    const botUser = readyUser;

    // Fetch toàn bộ channel hiện tại để kiểm tra trùng lặp
    console.log("\n📁 Đang kiểm tra danh mục và kênh hiện có...");
    let currentChannels = await safeApiCall(() => guild.channels.fetch());

    // Helper: Tạo hoặc Lấy Category (Idempotent - kiểm tra Overwrites trước khi cập nhật)
    async function getOrCreateCategory(name, overwrites = []) {
      let cat = currentChannels.find(c => c && c.type === ChannelType.GuildCategory && c.name === name);
      if (cat) {
        console.log(`   📁 Category đã tồn tại: ${name}`);
        if (overwrites && overwrites.length > 0 && botMember.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
          if (!areOverwritesEqual(cat.permissionOverwrites, overwrites)) {
            await safeApiCall(() => cat.permissionOverwrites.set(overwrites)).catch(err => {
              console.warn(`   ! Không thể cập nhật quyền category ${name}: ${err.message}`);
            });
            console.log(`   🔄 Đã cập nhật quyền hạn Category: ${name}`);
          }
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

    // Helper: Tạo hoặc Lấy Text Channel (Idempotent - kiểm tra Topic, Parent và Overwrites)
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
            console.log(`   🔄 Đã cập nhật thuộc tính Text Channel: #${name}`);
          }
          if (customOverwrites && customOverwrites.length > 0 && botMember.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            if (!areOverwritesEqual(ch.permissionOverwrites, customOverwrites)) {
              await safeApiCall(() => ch.permissionOverwrites.set(customOverwrites));
              console.log(`   🔄 Đã cập nhật quyền hạn Text Channel: #${name}`);
            }
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

    // Helper: Tạo hoặc Lấy Voice Channel (Idempotent - hỗ trợ userLimit, bitrate, customOverwrites)
    async function getOrCreateVoiceChannel(name, parentCategory, options = {}) {
      const customOverwrites = options.customOverwrites || null;
      const userLimit = options.userLimit !== undefined ? options.userLimit : undefined;
      const bitrate = options.bitrate !== undefined ? options.bitrate : undefined;
      const rtcRegion = options.rtcRegion !== undefined ? options.rtcRegion : undefined;

      let ch = currentChannels.find(c => 
        c && 
        c.type === ChannelType.GuildVoice && 
        c.name === name && 
        (parentCategory ? c.parentId === parentCategory.id : true)
      );

      if (ch) {
        console.log(`   🔊 Voice Channel đã tồn tại: ${name}`);
        try {
          const updateData = {};
          if (parentCategory && ch.parentId !== parentCategory.id) updateData.parent = parentCategory.id;
          if (userLimit !== undefined && ch.userLimit !== userLimit) updateData.userLimit = userLimit;
          if (bitrate !== undefined && ch.bitrate !== bitrate) updateData.bitrate = bitrate;
          if (rtcRegion !== undefined && ch.rtcRegion !== rtcRegion) updateData.rtcRegion = rtcRegion;

          if (Object.keys(updateData).length > 0 && botMember.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            await safeApiCall(() => ch.edit(updateData));
            console.log(`   🔄 Đã cập nhật thuộc tính Voice Channel: ${name}`);
          }

          if (customOverwrites && customOverwrites.length > 0 && botMember.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            if (!areOverwritesEqual(ch.permissionOverwrites, customOverwrites)) {
              await safeApiCall(() => ch.permissionOverwrites.set(customOverwrites));
              console.log(`   🔄 Đã cập nhật quyền hạn Voice Channel: ${name}`);
            }
          }
        } catch (e) {
          console.warn(`   ! Không thể update voice channel ${name}: ${e.message}`);
        }
        return ch;
      }

      const createOptions = {
        name: name,
        type: ChannelType.GuildVoice,
        parent: parentCategory ? parentCategory.id : undefined,
        userLimit: userLimit !== undefined ? userLimit : undefined,
        bitrate: bitrate !== undefined ? bitrate : undefined,
        rtcRegion: rtcRegion !== undefined ? rtcRegion : undefined,
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

    // Helper: Đăng hoặc Cập nhật Embeds sạch sẽ (Idempotent - tránh duplicate và flicker)
    async function publishOrRefreshEmbed(channel, messagePayload) {
      if (!channel || !channel.isTextBased()) return null;
      try {
        const messages = await safeApiCall(() => channel.messages.fetch({ limit: 10 }));
        const botMessages = messages.filter(m => m.author.id === botUser.id);
        
        // Xóa tin nhắn cũ của bot để làm mới giao diện
        for (const msg of botMessages.values()) {
          await safeApiCall(() => msg.delete()).catch(() => {});
        }

        const sent = await safeApiCall(() => channel.send(messagePayload));
        console.log(`   ✅ Đã đăng Embed thành công vào: #${channel.name}`);
        return sent;
      } catch (err) {
        console.error(`   ❌ Lỗi khi đăng Embed vào #${channel.name}:`, err.message);
        return null;
      }
    }

    // -------------------------------------------------------------------------
    // 1. DANH MỤC: 📌 ━━━ THÔNG TIN ━━━
    // -------------------------------------------------------------------------
    const infoOverwrites = [
      {
        id: everyoneRoleId,
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
    if (devRole) {
      infoOverwrites.push({
        id: devRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.EmbedLinks,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      });
    }
    if (founderRole) {
      infoOverwrites.push({
        id: founderRole.id,
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
        id: everyoneRoleId,
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
    if (devRole) {
      storeOverwrites.push({
        id: devRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.EmbedLinks,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      });
    }
    if (founderRole) {
      storeOverwrites.push({
        id: founderRole.id,
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
        id: everyoneRoleId,
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
    if (devRole) {
      vouchOverwrites.push({
        id: devRole.id,
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
    if (founderRole) {
      vouchOverwrites.push({
        id: founderRole.id,
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
        id: everyoneRoleId,
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
    if (devRole) {
      supportOverwrites.push({
        id: devRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.EmbedLinks,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      });
    }
    if (founderRole) {
      supportOverwrites.push({
        id: founderRole.id,
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
        id: everyoneRoleId,
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
    if (devRole) {
      communityOverwrites.push({
        id: devRole.id,
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
    if (founderRole) {
      communityOverwrites.push({
        id: founderRole.id,
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
        id: everyoneRoleId,
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
    if (devRole) {
      vipCatOverwrites.push({
        id: devRole.id,
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
    if (founderRole) {
      vipCatOverwrites.push({
        id: founderRole.id,
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

    // Kênh tải file: Chỉ Staff, Dev, Founder và Bot được gửi file, Khách & VIP chỉ được đọc
    const downloadOverwrites = [
      {
        id: everyoneRoleId,
        deny: [
          PermissionsBitField.Flags.ViewChannel,
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
    if (devRole) {
      downloadOverwrites.push({
        id: devRole.id,
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
    if (founderRole) {
      downloadOverwrites.push({
        id: founderRole.id,
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

    // Kênh chat Khách Hàng: Cả Khách, VIP, Dev và Staff đều được chat
    const vipChatOverwrites = [
      {
        id: everyoneRoleId,
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
    if (devRole) {
      vipChatOverwrites.push({
        id: devRole.id,
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
    if (founderRole) {
      vipChatOverwrites.push({
        id: founderRole.id,
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
        id: everyoneRoleId,
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

    // Kênh Nhật Ký Giao Dịch & Transcript: Chỉ Bot và Founder ghi tin nhắn, Staff & Dev chỉ đọc
    const logOverwrites = [
      {
        id: everyoneRoleId,
        deny: [
          PermissionsBitField.Flags.ViewChannel,
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
          PermissionsBitField.Flags.ManageChannels,
          PermissionsBitField.Flags.ManageMessages,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      }
    ];
    if (staffRole) {
      logOverwrites.push({
        id: staffRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.EmbedLinks,
          PermissionsBitField.Flags.AttachFiles
        ],
        deny: [
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.CreatePublicThreads,
          PermissionsBitField.Flags.CreatePrivateThreads,
          PermissionsBitField.Flags.SendMessagesInThreads
        ]
      });
    }
    if (devRole) {
      logOverwrites.push({
        id: devRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.EmbedLinks,
          PermissionsBitField.Flags.AttachFiles
        ],
        deny: [
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.CreatePublicThreads,
          PermissionsBitField.Flags.CreatePrivateThreads,
          PermissionsBitField.Flags.SendMessagesInThreads
        ]
      });
    }
    if (founderRole) {
      logOverwrites.push({
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

    const chLog = await getOrCreateTextChannel("📊・nhật-ký-giao-dịch", catAdmin, "Lịch sử mua hàng, giao dịch và ticket transcript", logOverwrites);
    const chStaffInternal = await getOrCreateTextChannel("💬・nội-bộ-staff", catAdmin, "Kênh trao đổi nội bộ đội ngũ phát triển và quản lý");

    // -------------------------------------------------------------------------
    // 7. DANH MỤC: 🔊 ━━━ KÊNH THOẠI ━━━
    // -------------------------------------------------------------------------
    const voiceCatOverwrites = [
      {
        id: everyoneRoleId,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.Connect,
          PermissionsBitField.Flags.Speak,
          PermissionsBitField.Flags.Stream,
          PermissionsBitField.Flags.UseVAD
        ]
      },
      {
        id: botUser.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.Connect,
          PermissionsBitField.Flags.Speak,
          PermissionsBitField.Flags.Stream,
          PermissionsBitField.Flags.ManageChannels,
          PermissionsBitField.Flags.MuteMembers,
          PermissionsBitField.Flags.DeafenMembers,
          PermissionsBitField.Flags.MoveMembers
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
          PermissionsBitField.Flags.Stream,
          PermissionsBitField.Flags.UseVAD,
          PermissionsBitField.Flags.MuteMembers,
          PermissionsBitField.Flags.DeafenMembers,
          PermissionsBitField.Flags.MoveMembers,
          PermissionsBitField.Flags.PrioritySpeaker
        ]
      });
    }
    if (devRole) {
      voiceCatOverwrites.push({
        id: devRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.Connect,
          PermissionsBitField.Flags.Speak,
          PermissionsBitField.Flags.Stream,
          PermissionsBitField.Flags.UseVAD,
          PermissionsBitField.Flags.MuteMembers,
          PermissionsBitField.Flags.DeafenMembers,
          PermissionsBitField.Flags.MoveMembers,
          PermissionsBitField.Flags.PrioritySpeaker
        ]
      });
    }
    if (founderRole) {
      voiceCatOverwrites.push({
        id: founderRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.Connect,
          PermissionsBitField.Flags.Speak,
          PermissionsBitField.Flags.Stream,
          PermissionsBitField.Flags.UseVAD,
          PermissionsBitField.Flags.MuteMembers,
          PermissionsBitField.Flags.DeafenMembers,
          PermissionsBitField.Flags.MoveMembers,
          PermissionsBitField.Flags.PrioritySpeaker
        ]
      });
    }

    const catVoice = await getOrCreateCategory("🔊 ━━━ KÊNH THOẠI ━━━", voiceCatOverwrites);

    const vcWaiting = await getOrCreateVoiceChannel("🔊・Phòng Chờ Giao Lưu", catVoice, { userLimit: 0 });
    const vcTech11 = await getOrCreateVoiceChannel("🛠️・Hỗ Trợ Kỹ Thuật 1-1", catVoice, { userLimit: 2 });
    const vcGaming = await getOrCreateVoiceChannel("🎮・Voice Gaming", catVoice, { userLimit: 10 });

    // =========================================================================
    // 2.8 ĐỒNG BỘ VỊ TRÍ THỨ TỰ TOÀN BỘ CATEGORIES & CHANNELS (POSITION ORDERING)
    // =========================================================================
    console.log("\n📐 Đang kiểm tra và đồng bộ vị trí thứ tự (Position Ordering) Categories & Channels...");
    const categoryOrderList = [catInfo, catStore, catSupport, catCommunity, catVIP, catAdmin, catVoice];
    const channelOrderMap = new Map();
    channelOrderMap.set(catInfo.id, [chWelcome, chGoodbye, chRules, chAnnounce, chChangelog, chGiveaway]);
    channelOrderMap.set(catStore.id, [chPlugins, chPricing, chDemo, chVouch]);
    channelOrderMap.set(catSupport.id, [chOrderTicket, chTechTicket, chCustomTicket]);
    channelOrderMap.set(catCommunity.id, [chChat, chSuggestions, chShowcase, chBotCommands]);
    channelOrderMap.set(catVIP.id, [chDownloads, chVipChat]);
    channelOrderMap.set(catAdmin.id, [chLog, chStaffInternal]);
    channelOrderMap.set(catVoice.id, [vcWaiting, vcTech11, vcGaming]);

    await syncChannelAndCategoryPositions(guild, botMember, categoryOrderList, channelOrderMap);

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
      .setTitle("💎 DANH SÁCH SẢN PHẨM & DỊCH VỤ - LS STUDIO")
      .setDescription("Tất cả các Plugin tại LS Studio đều được tối ưu hóa hiệu năng cao, hỗ trợ đa phiên bản từ `1.16.x -> 1.21.x` và tương thích 100% với Paper/Purpur/Folia.")
      .addFields(
        {
          name: "🛡️ 1. LS-AntiCheat & Behavior Security",
          value: "• **Tính năng:** Bắt WallHit (xuyên mạng nhện/tường), InvMove A-F, AutoEat/Fish/Potion, Fake Máu.\n• **Hỗ trợ:** Paper / Purpur / Folia (1.16 - 1.21+)\n• **Giá:** `30.000 VNĐ` (~$1.50)"
        },
        {
          name: "🛒 2. Addon Anti-Macro Cart & Boat",
          value: "• **Tính năng:** Chặn đứng hack/macro lợi dụng Minecart và Thuyền di chuyển tốc độ bất thường.\n• **Hỗ trợ:** Paper / Purpur / Folia (1.16 - 1.21+)\n• **Giá:** `20.000 VNĐ / Tháng` (~$1.00/Mo)"
        },
        {
          name: "👁️ 3. LS-AntiFreeCam & Obfuscator",
          value: "• **Tính năng:** Ẩn quặng quý và rương đồ khi ngoài tầm nhìn, khắc chế triệt để Freecam, Chest ESP, Baritone đào tự động.\n• **Hỗ trợ:** Paper / Purpur / Folia (1.16 - 1.21+)\n• **Giá:** `59.000 VNĐ` (~$2.50)"
        },
        {
          name: "🚫 4. LS-AntiClient & BrandShield",
          value: "• **Tính năng:** Nhận diện và chặn client hack (Meteor, LiquidBounce, Aristois, Fabric Cheats...).\n• **Hỗ trợ:** Paper / Purpur / Folia (1.16 - 1.21+)\n• **Giá:** `99.000 VNĐ` (~$4.00)"
        },
        {
          name: "🎁 5. LS-GiftCode & Rewards",
          value: "• **Tính năng:** Hệ thống giftcode tân thủ, code sự kiện, giới hạn lượt nhập, lưu async MySQL/SQLite.\n• **Hỗ trợ:** Paper / Purpur / Folia (1.16 - 1.21+)\n• **Giá:** `30.000 VNĐ` (~$1.50)"
        },
        {
          name: "👑 6. Combo Trọn Bộ Bảo Vệ (AntiFreeCam + AntiClient)",
          value: "• Sở hữu trọn bộ cả 2 giải pháp bảo vệ cốt lõi cho server với giá ưu đãi tiết kiệm.\n• **Giá Combo:** `129.000 VNĐ` (~$5.50)"
        },
        {
          name: "🧩 7. Lập Trình Mod Custom Cho Minecraft Java",
          value: "• **Tính năng:** Forge, Fabric, NeoForge 1.16 đến 1.21+ Java PC theo yêu cầu.\n• **Giá:** Thỏa thuận theo tính năng"
        },
        {
          name: "📝 8. Lập Trình Plugin Riêng Theo Ý Tưởng (Custom Dev)",
          value: "• **Tính năng:** Trao đổi ý tưởng tính năng độc quyền trực tiếp với Developer.\n• **Giá:** Thỏa thuận theo độ phức tạp"
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
          name: "📦 1. Plugin Minecraft (Paper / Purpur / Folia 1.16 - 1.21+)",
          value: 
            "• 🛡️ **LS-AntiCheat (Bản Gốc):** `30.000 VNĐ` • `~$1.50 USD`\n" +
            "• 🛒 **Addon Anti-Macro Cart:** `20.000 VNĐ / Tháng` • `~$1.00 USD / Mo`\n" +
            "• 🎁 **LS-GiftCode:** `30.000 VNĐ` • `~$1.50 USD`\n" +
            "• 👁️ **LS-AntiFreeCam:** `59.000 VNĐ` • `~$2.50 USD`\n" +
            "• 🚫 **LS-AntiClient:** `99.000 VNĐ` • `~$4.00 USD`\n" +
            "• 👑 **Combo 2 Plugin Anti:** `129.000 VNĐ` • `~$5.50 USD`\n" +
            "• Miễn phí update trọn đời các bản vá lỗi."
        },
        {
          name: "🔑 2. API Key AI (Cursor / Cline / Coding / Bot Discord)",
          value: 
            "• ⚡ **API Key Claude 100M Token (3 Ngày):** `109.000 VNĐ` • `~$4.25 USD`\n" +
            "• 💻 **API Key Codex 100M Token (3 Ngày):** `85.000 VNĐ` • `~$3.25 USD`"
        },
        {
          name: "💎 3. Tài Khoản & Link AI Premium",
          value: 
            "• 🌟 **Acc Gemini Family Nâng Chính Chủ (18 Tháng):** `35.000 VNĐ` • `~$1.50 USD`\n" +
            "• 🚀 **Link Kích Hoạt Gemini Pro 18M:** `49.000 VNĐ` • `~$2.00 USD`\n" +
            "• 🚀 **Acc Google AI Pro Chính Chủ (1 Tháng):** `89.000 VNĐ` • `~$3.50 USD`\n" +
            "• 👑 **Acc Claude Max 20 (1 Tháng):** `89.000 VNĐ` • `~$3.50 USD`\n" +
            "• ⭐ **Acc ChatGPT Plus (1 Tháng):** `169.000 VNĐ` • `~$6.80 USD`\n" +
            "• ✨ **Acc Monica AI Pro Model Claude (3 Ngày):** `49.000 VNĐ` • `~$2.00 USD`\n" +
            "• 🎁 **Acc ChatGPT New Gmail (Nhận Offer):** `5.000 VNĐ` • `~$0.20 USD` *(Cần thẻ PayPal)*"
        },
        {
          name: "🛠️ 4. Lập Trình Plugin & Mod Java Custom",
          value: 
            "• **Cỡ Nhỏ (Tiện ích, lệnh, GUI, fix bug):** `50.000đ - 150.000đ` • `~$2 - $6 USD`\n" +
            "• **Cỡ Trung (Tính năng gameplay mới, event, mini-system):** `200.000đ - 500.000đ` • `~$8 - $20 USD`\n" +
            "• **Cỡ Lớn (Hệ thống RPG tổng thể, Minigame độc quyền):** `Thỏa thuận`\n" +
            "• **Mod Java Custom (Forge/Fabric/NeoForge):** `Thỏa thuận theo tính năng`"
        },
        {
          name: "💳 5. Phương Thức Thanh Toán Hỗ Trợ",
          value: 
            "• 🏦 **Chuyển Khoản Ngân Hàng (VietQR 24/7):** MBBank - `844515133333` (VAN HUU PHAM NGUYEN)\n" +
            "• 📱 **Ví Điện Tử MoMo / Thẻ Cào:** Hỗ trợ linh hoạt\n" +
            "• 🌐 **PayPal / Crypto / Card:** Dành cho khách hàng quốc tế qua Ticket"
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

  let isExiting = false;
async function cleanupAndExit(code = 0) {
  if (isExiting) return;
  isExiting = true;
    clearTimeout(watchdog);
    try { await client.destroy(); } catch {}
    process.exit(code);
  }

  process.on('SIGINT', async () => {
    console.log('🛑 [SIGINT] Đang dừng tiến trình setup server...');
    await cleanupAndExit(0);
  });
  process.on('SIGTERM', async () => {
    console.log('🛑 [SIGTERM] Đang dừng tiến trình setup server...');
    await cleanupAndExit(0);
  });
  process.on('SIGHUP', async () => {
    console.log('🛑 [SIGHUP] Đang dừng tiến trình setup server...');
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

  client.once(Events.ClientReady, async (readyClient) => {
    try {
      await runServerSetup(client, GUILD_ID);
      await cleanupAndExit(0);
    } catch (err) {
      console.error('❌ Lỗi setup server:', err.message || err);
      await cleanupAndExit(1);
    }
  });

  if (!TOKEN || TOKEN === 'YOUR_BOT_TOKEN_HERE' || TOKEN.trim() === '') {
  console.error('❌ Lỗi: DISCORD_TOKEN chưa được thiết lập trong .env hoặc token.local.js!');
  process.exit(1);
}

client.login(TOKEN).catch(async (err) => {
    console.error('❌ Đăng nhập Discord thất bại:', err.message || err);
    await cleanupAndExit(1);
  });
}

module.exports = {
  client,
  GUILD_ID,
  runServerSetup,
  safeApiCall,
  sleep
};
