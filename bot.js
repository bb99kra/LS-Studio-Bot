const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const crypto = require('crypto');
const axios = require('axios');
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActivityType,
  REST,
  Routes,
  SlashCommandBuilder,
  Events,
  AttachmentBuilder,
  Options
} = require('discord.js');

// =========================================================================
// 0. CẤU HÌNH HỆ THỐNG & BIẾN MÔI TRƯỜNG
// =========================================================================
const tokenLocalPath = path.join(__dirname, 'token.local.js');
const TOKEN = process.env.DISCORD_TOKEN || (fs.existsSync(tokenLocalPath) ? require(tokenLocalPath).TOKEN : '');
const GUILD_ID = process.env.GUILD_ID || "1542476657825419334";

// CẤU HÌNH NGÂN HÀNG MBBANK
const BANK_CONFIG = Object.freeze({
  BANK_ID: "MB",
  ACCOUNT_NO: "844515133333",
  ACCOUNT_NAME: "VAN HUU PHAM NGUYEN"
});

// Pool theo dõi mã đơn hàng trong RAM chống trùng lặp (Collision Guard) & chống duyệt trùng (Idempotency)
const activeOrderCodes = new Map(); // orderCode -> { createdAt: number, pkgKey?: string, buyerId?: string }
const processingApprovals = new Set(); // orderCode đang trong tiến trình duyệt
const approvedOrderCodes = new Set(); // orderCode đã duyệt thành công

// Regex chuẩn nhận diện & bóc tách mã đơn hàng (hỗ trợ LS1234, LS123456, LS-123456, LS 123456)
const ORDER_CODE_REGEX = /\b(LS[\s-_]?[0-9A-Z]{4,8})\b/i;

// Sinh mã đơn hàng ngẫu nhiên chuẩn e-commerce, cryptographically secure và chống trùng lặp tuyệt đối
function generateUniqueOrderCode() {
  let code = '';
  let attempts = 0;
  
  do {
    // Tạo 6 chữ số ngẫu nhiên bằng crypto.randomBytes (100000 -> 999999)
    const randomBytes = crypto.randomBytes(4);
    const num = (randomBytes.readUInt32BE(0) % 900000) + 100000;
    code = `LS${num}`;
    attempts++;
  } while (activeOrderCodes.has(code) && attempts < 50);

  // Lưu mã vào memory pool
  activeOrderCodes.set(code, { createdAt: Date.now() });
  return code;
}

// Alias tương thích ngược
function generateOrderCode() {
  return generateUniqueOrderCode();
}

// Bóc tách và chuẩn hóa mã đơn hàng từ nội dung tin nhắn hoặc SMS/Banking webhook
function extractOrderCode(text) {
  if (!text || typeof text !== 'string') return null;
  const match = text.match(ORDER_CODE_REGEX);
  return match ? match[1].replace(/[\s-_]/g, '').toUpperCase() : null;
}

// Kiểm tra mã đơn có đúng cấu trúc LS + 4-8 ký tự số/chữ hay không
function isValidOrderCode(code) {
  if (!code || typeof code !== 'string') return false;
  return /^LS[0-9A-Z]{4,8}$/i.test(code.trim().replace(/[\s-_]/g, ''));
}

/**
 * Chuẩn hóa chuỗi text dùng cho nội dung chuyển khoản VietQR / Banking Memo
 * - Loại bỏ dấu tiếng Việt (Unicode NFD)
 * - Loại bỏ ký tự đặc biệt, emoji, newline
 * - Chỉ giữ chữ cái A-Z, số 0-9 và dấu cách
 * - Chuyển sang chữ in hoa
 * - Cắt ngắn tối đa maxLength ký tự theo chuẩn VietQR / NAPAS
 */
function sanitizeVietQRText(text, maxLength = 25) {
  if (!text || typeof text !== 'string') return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Bỏ dấu tiếng Việt
    .replace(/[đĐ]/g, 'D')           // Chuyển đ/Đ thành D
    .replace(/[^a-zA-Z0-9 ]/g, ' ')   // Ký tự đặc biệt & emoji -> khoảng trắng
    .replace(/\s+/g, ' ')            // Gộp khoảng trắng liên tiếp
    .trim()
    .toUpperCase()
    .slice(0, maxLength);
}

// Định dạng tiền tệ VND chuẩn Việt Nam
function formatVND(amount) {
  const num = Number(amount) || 0;
  return `${num.toLocaleString('vi-VN')} VNĐ`;
}

// Định dạng tiền tệ USD chuẩn quốc tế (2 chữ số thập phân)
function formatUSD(amount) {
  const num = Number(amount) || 0;
  return `$${num.toFixed(2)} USD`;
}

// Client HTTP chuyên dụng cho VietQR & Banking với timeout 5s và giới hạn kích thước 5MB
const paymentHttpClient = axios.create({
  timeout: 5000,
  maxContentLength: 5 * 1024 * 1024,
  maxBodyLength: 5 * 1024 * 1024,
  headers: {
    'User-Agent': 'LS-Studio-DiscordBot/1.0 (Banking/VietQR Client)'
  }
});

// Xây dựng URL VietQR chuẩn RFC 3986 với URLSearchParams và sanitize an toàn
function generateVietQRUrl({ bankId, accountNo, template = 'compact2', amount = null, addInfo = null, accountName = null } = {}) {
  const cleanBank = encodeURIComponent((bankId || BANK_CONFIG.BANK_ID || 'MB').trim().replace(/[^a-zA-Z0-9]/g, ''));
  const cleanAcc = encodeURIComponent((accountNo || BANK_CONFIG.ACCOUNT_NO || '').trim().replace(/[^a-zA-Z0-9]/g, ''));
  const cleanTemplate = encodeURIComponent((template || 'compact2').trim().replace(/[^a-zA-Z0-9]/g, ''));

  const baseUrl = `https://img.vietqr.io/image/${cleanBank}-${cleanAcc}-${cleanTemplate}.png`;
  const params = new URLSearchParams();

  if (amount !== null && amount !== undefined && Number(amount) > 0) {
    params.append('amount', Math.round(Number(amount)).toString());
  }
  if (addInfo) {
    const sanitizedMemo = sanitizeVietQRText(String(addInfo), 25);
    if (sanitizedMemo) {
      params.append('addInfo', sanitizedMemo);
    }
  }
  const name = sanitizeVietQRText(accountName || BANK_CONFIG.ACCOUNT_NAME || '', 50);
  if (name) {
    params.append('accountName', name);
  }

  const queryStr = params.toString();
  return queryStr ? `${baseUrl}?${queryStr}` : baseUrl;
}

// Tải ảnh QR buffer trực tiếp qua Axios với cơ chế bắt lỗi an toàn & xác thực định dạng ảnh
async function fetchVietQRBuffer(qrUrl) {
  try {
    const res = await paymentHttpClient.get(qrUrl, { 
      responseType: 'arraybuffer',
      validateStatus: (status) => status === 200
    });

    const contentType = res.headers['content-type'] || res.headers['Content-Type'] || '';
    
    // Kiểm tra content-type bắt buộc phải là image (tránh nhận nhầm HTML/JSON error từ CDN)
    if (contentType && !contentType.startsWith('image/')) {
      console.warn(`⚠️ [VietQR Warning] Phản hồi từ ${qrUrl} không phải ảnh (${contentType}). Chuyển sang fallback URL.`);
      return null;
    }

    // Kiểm tra kích thước tối thiểu (ảnh PNG QR hợp lệ thường > 500 bytes)
    if (res.data && res.data.length >= 500) {
      return Buffer.from(res.data);
    } else {
      console.warn(`⚠️ [VietQR Warning] Dữ liệu ảnh quá nhỏ (${res.data?.length || 0} bytes).`);
    }
  } catch (err) {
    console.warn(`⚠️ [VietQR Network Warning] Không thể tải buffer từ ${qrUrl} (${err.message}). Tự động fallback sang Direct URL.`);
  }
  return null;
}



// DANH SÁCH GÓI SẢN PHẨM & DỊCH VỤ (BILINGUAL CONFIG: MINECRAFT + AI SERVICES)
const PACKAGES = {
  // 1. MINECRAFT PLUGINS & MODS
  "ls_anticheat": {
    name_vi: "LS-AntiCheat • WallHit, Inventory A-F, PvP, FakeInfo",
    name_en: "LS-AntiCheat • WallHit, Inv Checks, Combat & Spoof",
    price_vnd: 30000,
    price_usd: 1.5,
    desc_vi: "WallHit xuyên mạng nhện/tường, InvMove/Stats click, AutoEat/Fish/Potion/Shield, Fake Máu",
    desc_en: "Anti-WallHit through cobwebs/walls, Inventory checks, AutoEat/Potion, Health spoof"
  },
  "addon_macro_cart": {
    name_vi: "Addon Anti-Macro Cart • Chống Macro Xe Mỏ & Thuyền (20k/Tháng)",
    name_en: "Anti-Macro Cart Addon • Minecart & Boat Exploit Protection ($1.00/Mo)",
    price_vnd: 20000,
    price_usd: 1.0,
    desc_vi: "Chặn đứng hack/macro lợi dụng Minecart và Thuyền (Boat) di chuyển tốc độ bất thường",
    desc_en: "Blocks Minecart and Boat macro speed exploits across terrains"
  },
  "anti_freecam": {
    name_vi: "LS-AntiFreeCam & Obfuscator • Chống Freecam và X-Ray",
    name_en: "LS-AntiFreeCam & Obfuscator • Anti Freecam & X-Ray",
    price_vnd: 59000,
    price_usd: 2.5,
    desc_vi: "Khắc chế Freecam Mod, Baritone đào tự động, Chest ESP, X-Ray",
    desc_en: "Blocks Freecam Mod, Baritone auto-mining, Chest ESP, X-Ray"
  },
  "anti_client": {
    name_vi: "LS-AntiClient & BrandShield • Chặn Hacked Client",
    name_en: "LS-AntiClient & BrandShield • Client Brand Blocker",
    price_vnd: 99000,
    price_usd: 4.0,
    desc_vi: "Chặn Meteor, LiquidBounce, Aristois, Fabric Cheats",
    desc_en: "Blocks Meteor, LiquidBounce, Aristois, Fabric Cheats"
  },
  "ls_giftcode": {
    name_vi: "LS-GiftCode & Rewards • Hệ Thống Mã Quà Tặng",
    name_en: "LS-GiftCode & Rewards • Gift Code Reward System",
    price_vnd: 30000,
    price_usd: 1.5,
    desc_vi: "Tạo Giftcode tân thủ, sự kiện, giới hạn lượt nhập, lưu async",
    desc_en: "Custom gift codes, player claim limits, expiry timers, async DB"
  },
  "combo_suite": {
    name_vi: "Combo 2 Plugin Anti • AntiFreeCam + AntiClient",
    name_en: "Combo 2 Anti Plugins • AntiFreeCam + AntiClient",
    price_vnd: 129000,
    price_usd: 5.5,
    desc_vi: "Sở hữu cả 2 giải pháp bảo vệ cốt lõi cho server với giá ưu đãi",
    desc_en: "Get both core security solutions for your server at a discounted bundle price"
  },
  "custom_mod": {
    name_vi: "Đặt Làm Mod Custom Cho Minecraft Java",
    name_en: "Custom Minecraft Java Mod Development",
    price_vnd: 0,
    price_usd: 0,
    desc_vi: "Forge, Fabric, NeoForge 1.16 đến 1.21+ • Tùy theo tính năng yêu cầu",
    desc_en: "Forge, Fabric, NeoForge 1.16 - 1.21+ • Built to your specifications"
  },
  "custom_dev": {
    name_vi: "Đặt Làm Plugin Riêng Theo Ý Tưởng",
    name_en: "Custom Minecraft Plugin Development",
    price_vnd: 0,
    price_usd: 0,
    desc_vi: "Trao đổi ý tưởng tính năng độc quyền cho Server của bạn",
    desc_en: "Discuss and build exclusive custom features for your server"
  },

  // 2. DỊCH VỤ AI & API KEY
  "acc_gemini_family_18m": {
    name_vi: "Acc Gemini Family Nâng Chính Chủ (18 Tháng)",
    name_en: "Gemini Family Upgrade on Your Main Account (18 Months)",
    price_vnd: 35000,
    price_usd: 1.5,
    desc_vi: "Nâng trực tiếp trên Gmail chính chủ 18 tháng, Gemini Advanced 2M Token, Google One 2TB Cloud",
    desc_en: "Direct upgrade on your main Gmail for 18 months, Gemini Advanced 2M Token, 2TB Cloud"
  },
  "link_gemini_pro_18m": {
    name_vi: "Link Kích Hoạt Gemini Pro 18M",
    name_en: "Gemini Pro 18M Activation Link",
    price_vnd: 49000,
    price_usd: 2.0,
    desc_vi: "Link nâng cấp trực tiếp vào tài khoản Google, bảo hành kích hoạt lần đầu",
    desc_en: "Direct activation link for your Google account, guaranteed first activation"
  },
  "acc_google_ai_pro_1m": {
    name_vi: "Tài Khoản Google AI Pro Chính Chủ (1 Tháng)",
    name_en: "Google AI Pro Official Account (1 Month)",
    price_vnd: 89000,
    price_usd: 3.5,
    desc_vi: "Acc Google AI Pro chính chủ, Gemini Advanced 2M Token, 2TB Cloud",
    desc_en: "Official Google AI Pro account, Gemini Advanced 2M Token, 2TB Cloud"
  },
  "api_claude_100m": {
    name_vi: "API Key Claude 100M Token • Fable 5, Opus 5, Sonnet 5 (3 Ngày)",
    name_en: "Claude API Key 100M Tokens • Fable 5, Opus 5, Sonnet 5 (3 Days)",
    price_vnd: 109000,
    price_usd: 4.25,
    desc_vi: "100M Token Claude 5 (Fable/Opus/Sonnet) chuyên Cursor, Cline, Agentic Coding",
    desc_en: "100M Tokens for Claude 5 (Fable 5, Opus 5, Sonnet 5) for Cursor & Cline"
  },
  "api_codex_100m": {
    name_vi: "API Key Codex 100M Token • GPT-5.6 Sol (3 Ngày)",
    name_en: "Codex API Key 100M Tokens • GPT-5.6 Sol (3 Days)",
    price_vnd: 85000,
    price_usd: 3.25,
    desc_vi: "100M Token OpenAI Codex nền tảng GPT-5.6 Sol chuyên sâu logic & thuật toán",
    desc_en: "100M Tokens OpenAI Codex powered by GPT-5.6 Sol for advanced coding"
  },
  "acc_claude_max20": {
    name_vi: "Tài Khoản Claude Max 20 • Fable 5, Opus 5 & Sonnet 5 (1 Tháng)",
    name_en: "Claude Max 20 Account • Full Claude 5 Models (1 Month)",
    price_vnd: 89000,
    price_usd: 3.5,
    desc_vi: "Hạn mức cao Max 20, dùng thoải mái Claude Sonnet 5, Opus 5 và Fable 5",
    desc_en: "High quota Max 20, full access to Claude 5 models for 30 days"
  },
  "acc_chatgpt_plus": {
    name_vi: "Tài Khoản ChatGPT Plus • GPT-5.6 Sol (1 Tháng)",
    name_en: "ChatGPT Plus Account • GPT-5.6 Sol (1 Month)",
    price_vnd: 169000,
    price_usd: 6.8,
    desc_vi: "Trọn bộ GPT-5.6 Sol Flagship, DALL-E, Voice Chat, Canvas 2.0, bảo hành 1 tháng",
    desc_en: "Full GPT-5.6 Sol Flagship, DALL-E, Voice Chat, Canvas with 30-day warranty"
  },
  "acc_monica_pro_3d": {
    name_vi: "Tài Khoản Monica AI Pro • Claude 5 & GPT-5.6 (3 Ngày)",
    name_en: "Monica AI Pro Account • Claude 5 & GPT-5.6 (3 Days)",
    price_vnd: 49000,
    price_usd: 2.0,
    desc_vi: "Sử dụng đồng thời Claude Sonnet 5, Opus 5, GPT-5.6 Sol và Gemini 2.5 Pro",
    desc_en: "Simultaneous access to Claude 5, GPT-5.6 Sol, and Gemini 2.5 Pro"
  },
  "acc_chatgpt_offer": {
    name_vi: "Tài Khoản ChatGPT New Gmail • Nhận Offer GPT-5.6",
    name_en: "ChatGPT Fresh Gmail Account for GPT-5.6 Offer",
    price_vnd: 5000,
    price_usd: 0.2,
    desc_vi: "Gmail mới dùng kích hoạt gói Offer/Trial GPT-5.6 (Cần thẻ PayPal)",
    desc_en: "Fresh Gmail for activating GPT-5.6 trial offer (PayPal card required)"
  }
};

// DANH SÁCH BÍ DANH & GÓI SẢN PHẨM CŨ (DEPRECATED PACKAGE ALIASES & FALLBACKS)
const DEPRECATED_PACKAGE_ALIASES = Object.freeze({
  "anti_macro": "addon_macro_cart",
  "anti_macro_cart": "addon_macro_cart",
  "combo_anti": "combo_suite",
  "combo_2_anti": "combo_suite",
  "acc_monica_pro": "acc_monica_pro_3d",
  "monica_pro": "acc_monica_pro_3d",
  "claude_100m": "api_claude_100m",
  "api_claude": "api_claude_100m",
  "codex_100m": "api_codex_100m",
  "api_codex": "api_codex_100m",
  "claude_max20": "acc_claude_max20",
  "chatgpt_plus": "acc_chatgpt_plus",
  "chatgpt_offer": "acc_chatgpt_offer",
  "gemini_family": "acc_gemini_family_18m",
  "acc_gemini_family": "acc_gemini_family_18m",
  "gemini_pro": "link_gemini_pro_18m",
  "link_gemini_pro": "link_gemini_pro_18m",
  "google_ai_pro": "acc_google_ai_pro_1m",
  "acc_google_ai_pro": "acc_google_ai_pro_1m",
  "giftcode": "ls_giftcode",
  "anticheat": "ls_anticheat",
  "antifreecam": "anti_freecam",
  "anticlient": "anti_client"
});

// Tra cứu gói dịch vụ an toàn chống crash và hỗ trợ bí danh legacy
function getPackage(key) {
  if (!key || typeof key !== 'string') return null;
  const normalizedKey = key.trim().toLowerCase();
  if (PACKAGES[normalizedKey]) return PACKAGES[normalizedKey];
  const alias = DEPRECATED_PACKAGE_ALIASES[normalizedKey];
  if (alias && PACKAGES[alias]) return PACKAGES[alias];
  return null;
}

// Helper: Kiểm tra quyền Quản trị / Staff an toàn chống lỗi type hoặc cache
function isStaffMember(member) {
  if (!member) return false;
  if (member.permissions?.has?.(PermissionsBitField.Flags.Administrator) ||
      member.permissions?.has?.(PermissionsBitField.Flags.ManageGuild) ||
      member.permissions?.has?.(PermissionsBitField.Flags.ManageRoles) ||
      member.permissions?.has?.(PermissionsBitField.Flags.ManageMessages) ||
      member.permissions?.has?.(PermissionsBitField.Flags.MentionEveryone)) {
    return true;
  }
  const rolesList = member.roles?.cache ? Array.from(member.roles.cache.values()) : (Array.isArray(member.roles) ? member.roles : []);
  return rolesList.some(r => 
    r && r.name && (
      r.name.includes("Staff") || 
      r.name.includes("Developer") || 
      r.name.includes("Founder") || 
      r.name.includes("Admin")
    )
  );
}

// =========================================================================
// 1. GLOBAL ERROR HANDLING & PROCESS CRASH GUARDS
// =========================================================================
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ [Anti-Crash] Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (error, origin) => {
  console.error('⚠️ [Anti-Crash] Uncaught Exception:', error, 'Origin:', origin);
});

process.on('uncaughtExceptionMonitor', (error, origin) => {
  console.error('⚠️ [Anti-Crash Monitor] Exception Detected:', error, 'Origin:', origin);
});

// =========================================================================
// 2. CLIENT INITIALIZATION & INTENTS
// =========================================================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ],
  sweepers: {
    ...Options.DefaultSweeperSettings,
    messages: {
      interval: 300, // Quét dọn message cache mỗi 5 phút
      lifetime: 900  // Loại bỏ tin nhắn cũ hơn 15 phút khỏi RAM
    },
    users: {
      interval: 3600, // Quét dọn user cache không hoạt động mỗi 1 giờ
      filter: () => user => user.id !== client.user?.id
    }
  },
  makeCache: Options.cacheWithLimits({
    ...Options.DefaultMakeCacheSettings,
    MessageManager: 50,      // Tối đa 50 tin nhắn trên mỗi channel trong RAM
    GuildMemberManager: 200, // Giới hạn cache member
    PresenceManager: 0       // Không lưu cache presence không cần thiết
  })
});

// Bắt các sự kiện lỗi từ Discord Client
client.on(Events.Error, (error) => {
  console.error('❌ [Discord Client Error]:', error);
});

client.on(Events.Warn, (info) => {
  console.warn('⚠️ [Discord Client Warning]:', info);
});

client.on(Events.ShardError, (error, shardId) => {
  console.error(`❌ [Discord Shard ${shardId} Error]:`, error);
});

// =========================================================================
// 3. SLASH COMMANDS REGISTRATION & CLIENT READY
// =========================================================================
const commands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Kiểm tra độ trễ của Bot LS Studio / Check Bot Latency'),
  new SlashCommandBuilder()
    .setName('khachhang')
    .setDescription('Cấp role Khách Hàng cho người vừa mua Plugin/Mod/AI (Staff Only)')
    .addUserOption(opt => 
      opt.setName('user')
        .setDescription('Thành viên đã mua hàng / Customer')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName('stk')
    .setDescription('Lấy thông tin tài khoản ngân hàng MBBank / Bank Information'),
  new SlashCommandBuilder()
    .setName('transcript')
    .setDescription('Xuất file nhật ký tin nhắn của kênh ticket hiện tại (Staff Only)')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName('feedback')
    .setDescription('Gửi nhận xét & đánh giá chất lượng dịch vụ / Send Feedback')
].map(cmd => cmd.toJSON());

async function registerCommands(clientId) {
  if (!TOKEN || TOKEN === 'YOUR_BOT_TOKEN_HERE') {
    console.warn('⚠️ Chưa cấu hình DISCORD_TOKEN hợp lệ. Bỏ qua đăng ký Slash Commands.');
    return;
  }
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    console.log('🔄 Đang đồng bộ Slash Commands...');
    if (GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(clientId, GUILD_ID),
        { body: commands }
      );
      console.log(`✅ Guild Slash Commands đã sẵn sàng cho Guild ID: ${GUILD_ID}!`);
    } else {
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands }
      );
      console.log('✅ Global Slash Commands đã sẵn sàng!');
    }
  } catch (error) {
    console.error('❌ Lỗi đăng ký Slash Commands:', error);
  }
}

// Presence Rotation List & Timer Handle
const ACTIVITIES = [
  { name: 'LS STUDIO • Plugins & AI Services ⚡', type: ActivityType.Watching },
  { name: '🛒 /stk • MBBank VietQR 24/7', type: ActivityType.Playing },
  { name: '🛡️ LS-AntiCheat & AI Accounts', type: ActivityType.Listening },
  { name: '💬 Tickets & Customer Support', type: ActivityType.Watching }
];

let activityInterval = null;

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`🤖 LS STUDIO BOT ONLINE: ${readyClient.user.tag}`);

  // Thiết lập trạng thái hoạt động xoay tua (Presence Rotation)
  let activityIndex = 0;
  const updateActivity = () => {
    try {
      const act = ACTIVITIES[activityIndex];
      readyClient.user.setPresence({
        activities: [act],
        status: 'online'
      });
      activityIndex = (activityIndex + 1) % ACTIVITIES.length;
    } catch (err) {
      console.error('Lỗi cập nhật Presence:', err);
    }
  };

  updateActivity();
  if (activityInterval) clearInterval(activityInterval);
  activityInterval = setInterval(updateActivity, 25000).unref();

  await registerCommands(readyClient.user.id);
});

// =========================================================================
// 4. TÍNH NĂNG AUTOMOD: BẢO VỆ MÁY CHỦ, CHỐNG INVITE SPAM & PING @EVERYONE
// =========================================================================

/**
 * Chuẩn hóa chuỗi văn bản phòng chống spam & obfuscation:
 * 1. NFKC Unicode normalization (chuyển các ký tự fullwidth như ｄｉｓｃｏｒｄ thành discord)
 * 2. Loại bỏ các ký tự ẩn, zero-width, invisible formatters, control characters
 */
function normalizeAntiSpamText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u2060-\u206F\u0000-\u001F\u007F-\u009F\u00AD\u180E]/g, '');
}

/**
 * Xóa tin nhắn an toàn, kiểm tra quyền hạn và bắt các lỗi API Discord phổ biến
 * (Unknown Message, Missing Permissions, Unknown Channel) mà không làm crash ứng dụng.
 */
async function safeDeleteMessage(msg) {
  if (!msg) return false;
  try {
    if (typeof msg.deletable === 'boolean' && !msg.deletable) {
      return false;
    }
    await msg.delete();
    return true;
  } catch (err) {
    const ignoredCodes = [10008, 50013, 10003, 50001]; // Unknown Message, Missing Permissions, Unknown Channel, Missing Access
    if (err && ignoredCodes.includes(err.code)) {
      return false;
    }
    console.warn(`⚠️ [AutoMod SafeDelete] Không thể xóa tin nhắn: ${err.message}`);
    return false;
  }
}

/**
 * Nhận diện chính xác link mời Discord (hỗ trợ discord.gg, discord.com/invite, discordapp.com/invite,
 * discord.me, discord.io, discord.li, dsc.gg, invite.gg, chữ hoa, zero-width chars, khoảng cách, phân cách đặc biệt).
 */
function containsDiscordInvite(rawContent) {
  if (!rawContent || typeof rawContent !== 'string') return false;

  const cleaned = normalizeAntiSpamText(rawContent);

  // 1. Regex trên chuỗi thông thường (hỗ trợ khoảng trắng xen kẽ quanh dấu chấm, gạch chéo, ngoặc)
  const patternWithSpaces = /(?:https?:\/\/)?(?:www\s*[\.\(\[\{]\s*)?(?:discord\s*(?:app)?\s*[\.\(\[\{]\s*(?:gg|com\s*[\/\\]+\s*(?:invite|servers)|io|me|li)|(?:discord|invite|dsc)\s*[\.\(\[\{]\s*gg)\s*[\/\\]+\s*[a-zA-Z0-9_\-\+]+/i;
  if (patternWithSpaces.test(cleaned)) return true;

  // 2. Regex sau khi loại bỏ khoảng trắng và chuyển dấu cách / dot giả lập
  const noSpaces = cleaned.replace(/\s+/g, '').replace(/[\(\[\{]dot[\)\]\}]/gi, '.').replace(/[\(\[\{]\.[\)\]\}]/g, '.');
  const directPattern = /(?:https?:\/\/)?(?:www\.)?(?:discord(?:app)?\.(?:gg|com\/(?:invite|servers)|io|me|li)|(?:discord|invite|dsc)\.gg)\/[a-zA-Z0-9_\-\+]+/i;
  if (directPattern.test(noSpaces)) return true;

  // 3. Bắt các dạng rút gọn hoặc vanity URL không có scheme
  const barePattern = /\b(?:discord(?:app)?\.(?:gg|com\/(?:invite|servers)|io|me|li)|(?:discord|invite|dsc)\.gg)\/[a-zA-Z0-9_\-\+]+/i;
  if (barePattern.test(noSpaces)) return true;

  return false;
}

/**
 * Nhận diện ping @everyone / @here trái phép mà KHÔNG gây false positive:
 * - Bỏ qua code block (```...```) và inline code (`...`)
 * - Bỏ qua escaped mention (\@everyone, \@here)
 * - Bỏ qua địa chỉ email (admin@everyone.com, contact@here.org)
 * - Xử lý zero-width bypass và NFKC unicode normalization
 */
function containsEveryonePing(message) {
  // Nếu Discord API xác nhận tin nhắn thực sự kích hoạt ping everyone/here
  if (message.mentions && message.mentions.everyone) {
    return true;
  }

  if (!message.content || typeof message.content !== 'string') return false;

  let text = normalizeAntiSpamText(message.content);

  // Loại bỏ code block (```...```) và inline code (`...`)
  text = text.replace(/```[\s\S]*?```/g, ' ');
  text = text.replace(/`[^`]*?`/g, ' ');

  // Loại bỏ escaped mention (\@everyone, \@here)
  text = text.replace(/\\@everyone/gi, ' ');
  text = text.replace(/\\@here/gi, ' ');

  // Bắt @everyone hoặc @here đứng độc lập (không thuộc email hoặc từ ghép)
  const everyoneRegex = /(?<![\w@])@(everyone|here)(?![\w\.])/i;
  return everyoneRegex.test(text);
}

client.on(Events.MessageCreate, async (message) => {
  try {
    if (!message.guild || message.author.bot) return;

    // Lấy thông tin member (tự fetch nếu cache chưa có)
    const member = message.member || await message.guild.members.fetch(message.author.id).catch(() => null);
    if (!member) return;

    // Kiểm tra quyền Staff / Admin / Quản trị
    const isStaff = isStaffMember(member);

    // Quyền của bot trong channel hiện tại
    const botMember = message.guild.members.me || await message.guild.members.fetchMe().catch(() => null);
    const perms = message.channel.permissionsFor ? message.channel.permissionsFor(botMember) : null;
    const canSendEmbed = !perms || perms.has([
      PermissionsBitField.Flags.SendMessages,
      PermissionsBitField.Flags.EmbedLinks
    ]);

    // 1. Chặn và Timeout 5 phút nếu tự ý ping @everyone / @here
    if (!isStaff && containsEveryonePing(message)) {
      await safeDeleteMessage(message);

      if (member.moderatable) {
        await member.timeout(5 * 60 * 1000, 'Tự ý ping @everyone / @here trái phép (AutoMod)').catch(err => {
          console.warn(`⚠️ [AutoMod Timeout Warning] Không thể timeout user ${message.author.id}: ${err.message}`);
        });
      }

      if (canSendEmbed) {
        const warnEmbed = new EmbedBuilder()
          .setColor('#ED4245')
          .setTitle('⚠️ CẢNH BÁO TỰ ĐỘNG / AUTO MODERATION')
          .setDescription(
            `🚫 <@${message.author.id}> đã bị **khóa chat (Mute) 5 phút** do tự ý ping \`@everyone\` hoặc \`@here\` trái phép!\n\n` +
            `*User <@${message.author.id}> has been timed out for **5 minutes** for unauthorized \`@everyone\` / \`@here\` mention.*`
          )
          .setFooter({ text: 'LS STUDIO Security & Anti-Spam System' })
          .setTimestamp();

        const sent = await message.channel.send({ embeds: [warnEmbed] }).catch(() => null);
        if (sent) {
          setTimeout(() => safeDeleteMessage(sent).catch(() => {}), 10000).unref();
        }
      }
      return;
    }

    // 2. Chặn link mời Discord của máy chủ khác
    if (!isStaff && containsDiscordInvite(message.content)) {
      await safeDeleteMessage(message);

      if (canSendEmbed) {
        const inviteWarnEmbed = new EmbedBuilder()
          .setColor('#FF9800')
          .setTitle('🚫 CHẶN QUẢNG CÁO / ANTI-INVITE LINK')
          .setDescription(
            `⚠️ <@${message.author.id}> vui lòng không gửi link mời Discord của máy chủ khác!\n\n` +
            `*Discord invite links are strictly prohibited in this server.*`
          )
          .setFooter({ text: 'LS STUDIO Anti-Ad System' })
          .setTimestamp();

        const sent = await message.channel.send({ embeds: [inviteWarnEmbed] }).catch(() => null);
        if (sent) {
          setTimeout(() => safeDeleteMessage(sent).catch(() => {}), 7000).unref();
        }
      }
      return;
    }

  } catch (err) {
    console.error('Lỗi AutoMod messageCreate:', err);
  }
});

// =========================================================================
// 5. EVENT: CHÀO MỪNG THÀNH VIÊN MỚI (BILINGUAL)
// =========================================================================
client.on(Events.GuildMemberAdd, async (member) => {
  try {
    const memberRole = member.guild.roles.cache.find(r => r.name.includes("Thành Viên"));
    if (memberRole) {
      const botMember = member.guild.members.me || await member.guild.members.fetchMe().catch(() => null);
      if (botMember && botMember.permissions.has(PermissionsBitField.Flags.ManageRoles) && botMember.roles.highest.position > memberRole.position) {
        await member.roles.add(memberRole).catch((err) => {
          console.warn(`⚠️ [guildMemberAdd] Không thể tự động cấp role Thành Viên: ${err.message}`);
        });
      }
    }

    const welcomeChannel = member.guild.channels.cache.find(ch => ch.name.includes("chào-mừng") || ch.name.includes("welcome"));
    if (welcomeChannel) {
      const botMember = member.guild.members.me || await member.guild.members.fetchMe().catch(() => null);
      const canSend = !botMember || welcomeChannel.permissionsFor(botMember)?.has([
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.EmbedLinks
      ]);

      if (canSend) {
        const chRules = member.guild.channels.cache.find(c => c.name.includes("luật-lệ"));
        const chPrice = member.guild.channels.cache.find(c => c.name.includes("bảng-giá"));
        const chBuy = member.guild.channels.cache.find(c => c.name.includes("mua-plugin"));

        const welcomeEmbed = new EmbedBuilder()
          .setColor("#5865F2")
          .setTitle("🎉 CHÀO MỪNG / WELCOME TO LS STUDIO!")
          .setDescription(
            `👋 Chào mừng <@${member.id}> (**${member.user.tag}**) đã đến với **LS STUDIO**!\n` +
            `*Welcome <@${member.id}> to LS STUDIO! Plugins, Java Mods & AI Services.*\n\n` +
            `• 📜 Quy định / Rules: ${chRules ? `<#${chRules.id}>` : '#luật-lệ'}\n` +
            `• 💰 Bảng giá / Price List: ${chPrice ? `<#${chPrice.id}>` : '#bảng-giá'}\n` +
            `• 🛒 Mua hàng & Hỗ trợ / Buy & Support: ${chBuy ? `<#${chBuy.id}>` : '#mua-plugin'}\n\n` +
            `👥 Bạn là thành viên thứ **#${member.guild.memberCount}** của Server!`
          )
          .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
          .setFooter({ text: "LS STUDIO • Minecraft Plugins & AI Services" })
          .setTimestamp();

        await welcomeChannel.send({ content: `Chào mừng / Welcome <@${member.id}>! 🎉`, embeds: [welcomeEmbed] }).catch(() => {});
      }
    }
  } catch (err) {
    console.error("Lỗi khi đón thành viên mới:", err);
  }
});

// =========================================================================
// 6. EVENT: TẠM BIỆT THÀNH VIÊN RỜI SERVER
// =========================================================================
client.on(Events.GuildMemberRemove, async (member) => {
  try {
    const goodbyeChannel = member.guild.channels.cache.find(ch => ch.name.includes("tạm-biệt") || ch.name.includes("goodbye"));
    if (goodbyeChannel) {
      const botMember = member.guild.members.me || await member.guild.members.fetchMe().catch(() => null);
      const canSend = !botMember || goodbyeChannel.permissionsFor(botMember)?.has([
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.EmbedLinks
      ]);

      if (canSend) {
        const goodbyeEmbed = new EmbedBuilder()
          .setColor("#ED4245")
          .setTitle("👋 TẠM BIỆT / GOODBYE!")
          .setDescription(
            `Thành viên **${member.user.tag}** (<@${member.id}>) đã rời khỏi **LS STUDIO**.\n` +
            `*User ${member.user.tag} has left the server. Thank you for your time with us!*\n\n` +
            `📉 Hiện tại Server còn **${member.guild.memberCount}** thành viên.`
          )
          .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
          .setFooter({ text: "LS STUDIO" })
          .setTimestamp();

        await goodbyeChannel.send({ embeds: [goodbyeEmbed] }).catch(() => {});
      }
    }
  } catch (err) {
    console.error("Lỗi khi tạm biệt thành viên:", err);
  }
});

// =========================================================================
// 🔒 BẢO VỆ CONCURRENCY, RATE LIMIT & CHỐNG RÒ RỈ BỘ NHỚ (MEMORY LEAKS)
// =========================================================================
/**
 * Cấu trúc Map tự động hết hạn (TTL) và tương thích ngược với Set (.add, .has, .delete)
 * Chống rò rỉ bộ nhớ và chống deadlock vĩnh viễn khi tạo Ticket
 */
class ExpiringLockMap extends Map {
  constructor(ttlMs = 30000) {
    super();
    this.ttlMs = ttlMs;
  }
  add(key) {
    this.set(key, Date.now());
    return this;
  }
  has(key) {
    if (!super.has(key)) return false;
    const time = super.get(key);
    if (Date.now() - time > this.ttlMs) {
      super.delete(key);
      return false;
    }
    return true;
  }
}

const ticketCreationLocks = new ExpiringLockMap(30000);
const userCooldowns = new Map();

function getRateLimitRemaining(userId, cooldownMs = 5000) {
  const now = Date.now();
  const lastTime = userCooldowns.get(userId) || 0;
  if (now - lastTime < cooldownMs) {
    return Math.ceil((cooldownMs - (now - lastTime)) / 1000);
  }

  // Bảo vệ giới hạn dung lượng bộ nhớ (Max 5,000 entries) chống memory explosion khi bị spam
  if (userCooldowns.size > 5000) {
    for (const [id, time] of userCooldowns.entries()) {
      if (now - time > 60000) {
        userCooldowns.delete(id);
      }
    }
    if (userCooldowns.size > 5000) {
      const oldestKeys = Array.from(userCooldowns.keys()).slice(0, 1000);
      for (const k of oldestKeys) userCooldowns.delete(k);
    }
  }

  userCooldowns.set(userId, now);
  return 0;
}

// Định kỳ dọn dẹp các mục cooldown, locks & mã đơn hàng đã hết hạn để tránh rò rỉ bộ nhớ (Memory Leak Prevention)
let cleanupInterval = setInterval(() => {
  const now = Date.now();
  // 1. Dọn dẹp cooldowns quá hạn
  for (const [userId, time] of userCooldowns.entries()) {
    if (now - time > 60000) {
      userCooldowns.delete(userId);
    }
  }

  // 2. Dọn dẹp các lock tạo ticket bị treo quá TTL (30s)
  for (const [userId, lockTime] of ticketCreationLocks.entries()) {
    if (now - lockTime > ticketCreationLocks.ttlMs) {
      ticketCreationLocks.delete(userId);
    }
  }

  // 3. Dọn dẹp mã đơn hàng cũ hơn 48 giờ
  const ORDER_TTL = 48 * 60 * 60 * 1000;
  for (const [code, data] of activeOrderCodes.entries()) {
    if (now - (data.createdAt || 0) > ORDER_TTL) {
      activeOrderCodes.delete(code);
    }
  }
}, 5 * 60 * 1000).unref();

// Helper: Xuất bản ghi nhật ký tin nhắn toàn diện với phân trang (Comprehensive Transcript Generator with Pagination)
async function generateTranscript(channel, closeReason = null) {
  try {
    if (!channel || !channel.isTextBased()) {
      return `Lỗi: Kênh không hợp lệ hoặc không hỗ trợ đọc tin nhắn.`;
    }

    // 1. Phân trang lấy toàn bộ lịch sử tin nhắn mà không làm phình message cache (cache: false)
    const allMessages = [];
    let lastId = null;
    const MAX_MESSAGES = 5000; // Ngưỡng an toàn chống quá tải bộ nhớ khi ticket cực dài

    while (allMessages.length < MAX_MESSAGES) {
      const options = { limit: 100, cache: false };
      if (lastId) {
        options.before = lastId;
      }
      const fetched = await channel.messages.fetch(options).catch(err => {
        console.error(`Lỗi fetch tin nhắn khi tạo transcript tại kênh #${channel.name}:`, err);
        return null;
      });

      if (!fetched || fetched.size === 0) break;

      allMessages.push(...fetched.values());
      lastId = fetched.lastKey();

      // Nếu số tin nhắn lấy về < 100 thì đã đến tin nhắn đầu tiên của kênh
      if (fetched.size < 100) break;
    }

    // Sắp xếp tin nhắn theo thứ tự thời gian từ cũ nhất -> mới nhất (Chronological order)
    const sorted = allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    // Thu thập danh sách người tham gia hội thoại (Distinct Participants)
    const participantMap = new Map();
    for (const msg of sorted) {
      if (msg.author) {
        participantMap.set(msg.author.id, `${msg.author.tag || msg.author.username} (${msg.author.id})${msg.author.bot ? ' [BOT]' : ''}`);
      } else if (msg.webhookId) {
        participantMap.set(msg.webhookId, `Webhook [ID: ${msg.webhookId}]`);
      }
    }
    const participantsList = Array.from(participantMap.values()).join('\n  • ') || 'Không có';

    const nowStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const firstMsgTime = sorted.length > 0 
      ? new Date(sorted[0].createdTimestamp).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) 
      : 'N/A';
    const lastMsgTime = sorted.length > 0 
      ? new Date(sorted[sorted.length - 1].createdTimestamp).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) 
      : 'N/A';

    let transcript = `================================================================================\n`;
    transcript += `LS STUDIO - TICKET TRANSCRIPT / NHẬT KÝ HỘI THOẠI TICKET\n`;
    transcript += `================================================================================\n`;
    transcript += `Máy chủ / Guild: ${channel.guild?.name || 'N/A'} (${channel.guildId || 'N/A'})\n`;
    transcript += `Kênh / Channel: #${channel.name} (${channel.id})\n`;
    transcript += `Danh mục / Category: ${channel.parent?.name || 'N/A'}\n`;
    transcript += `Chủ đề / Topic: ${channel.topic || 'N/A'}\n`;
    if (closeReason) {
      transcript += `Lý do đóng / Close Reason: ${closeReason}\n`;
    }
    transcript += `Thời gian xuất / Exported At: ${nowStr} (UTC+7)\n`;
    transcript += `Khoảng thời gian / Time Range: ${firstMsgTime} -> ${lastMsgTime}\n`;
    transcript += `Tổng số tin nhắn / Total Messages: ${sorted.length}\n`;
    transcript += `Thành viên tham gia / Participants:\n  • ${participantsList}\n`;
    transcript += `================================================================================\n\n`;

    for (const msg of sorted) {
      const timeStr = new Date(msg.createdTimestamp).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      
      // Fallback an toàn cho Author (khi author bị xóa, null hoặc là Webhook)
      const authorTag = msg.author 
        ? (msg.author.tag || msg.author.username || 'User') 
        : (msg.webhookId ? `Webhook [${msg.webhookId}]` : 'Deleted User / Người dùng đã xóa');
      const authorId = msg.author ? msg.author.id : (msg.webhookId || 'N/A');
      const isBot = msg.author ? msg.author.bot : Boolean(msg.webhookId);
      const isSystem = Boolean(msg.system);

      let badge = '';
      if (isSystem) badge = ' [SYSTEM / HỆ THỐNG]';
      else if (isBot) badge = ' [BOT]';

      const editedInfo = msg.editedTimestamp 
        ? ` (Đã sửa / Edited: ${new Date(msg.editedTimestamp).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })})` 
        : '';
      const pinnedInfo = msg.pinned ? ' 📌[PINNED]' : '';

      transcript += `[${timeStr}] ${authorTag} (${authorId})${badge}${pinnedInfo}${editedInfo}:\n`;

      // 1. Phản hồi tin nhắn khác (Reply Reference)
      if (msg.reference && msg.reference.messageId) {
        transcript += `  ↳ [Trả lời tin nhắn / Replying to Msg ID: ${msg.reference.messageId}]\n`;
      }

      // 2. Tin nhắn hệ thống (System Messages)
      if (msg.system) {
        transcript += `  [Hệ thống / System]: Tin nhắn hệ thống Discord (${msg.type})\n`;
      }

      // 3. Nội dung văn bản (Content)
      if (msg.content) {
        transcript += `  ${msg.content.split('\n').join('\n  ')}\n`;
      }

      // 4. Nhãn dán (Stickers)
      if (msg.stickers && msg.stickers.size > 0) {
        for (const [, sticker] of msg.stickers) {
          const stickerUrl = sticker.url || `https://media.discordapp.net/stickers/${sticker.id}.png`;
          transcript += `  [Nhãn dán / Sticker]: ${sticker.name} (${stickerUrl})\n`;
        }
      }

      // 5. Tệp đính kèm (Attachments)
      if (msg.attachments && msg.attachments.size > 0) {
        for (const [, att] of msg.attachments) {
          const sizeStr = att.size ? ` (${(att.size / 1024).toFixed(1)} KB)` : '';
          const typeStr = att.contentType ? ` [${att.contentType}]` : '';
          transcript += `  [Đính kèm / Attachment]: ${att.name || 'file'}${typeStr}${sizeStr} -> ${att.url}\n`;
        }
      }

      // 6. Embeds (Khung nội dung nâng cao)
      if (msg.embeds && msg.embeds.length > 0) {
        for (let i = 0; i < msg.embeds.length; i++) {
          const embed = msg.embeds[i];
          const embedIndex = msg.embeds.length > 1 ? ` #${i + 1}` : '';
          transcript += `  [Embed${embedIndex}]:\n`;
          if (embed.author?.name) {
            transcript += `    • Tác giả / Author: ${embed.author.name}\n`;
          }
          if (embed.title) {
            transcript += `    • Tiêu đề / Title: ${embed.title}${embed.url ? ` (${embed.url})` : ''}\n`;
          }
          if (embed.description) {
            transcript += `    • Nội dung / Description:\n      ${embed.description.split('\n').join('\n      ')}\n`;
          }
          if (embed.fields && embed.fields.length > 0) {
            for (const field of embed.fields) {
              transcript += `    • Trường / Field [${field.name}]: ${String(field.value).split('\n').join(' ')}\n`;
            }
          }
          if (embed.image?.url) {
            transcript += `    • Ảnh lớn / Image: ${embed.image.url}\n`;
          }
          if (embed.thumbnail?.url) {
            transcript += `    • Ảnh nhỏ / Thumbnail: ${embed.thumbnail.url}\n`;
          }
          if (embed.footer?.text) {
            transcript += `    • Chân trang / Footer: ${embed.footer.text}\n`;
          }
        }
      }

      // 7. Cảm xúc / Tương tác (Reactions)
      if (msg.reactions && msg.reactions.cache.size > 0) {
        const reactList = [];
        for (const [, reaction] of msg.reactions.cache) {
          const emojiName = reaction.emoji.name || 'emoji';
          reactList.push(`${emojiName} (${reaction.count})`);
        }
        if (reactList.length > 0) {
          transcript += `  [Cảm xúc / Reactions]: ${reactList.join(', ')}\n`;
        }
      }

      transcript += `\n`;
    }

    transcript += `================================================================================\n`;
    transcript += `KẾT THÚC NHẬT KÝ / END OF TRANSCRIPT - LS STUDIO SYSTEM\n`;
    transcript += `================================================================================\n`;

    // Giải phóng bộ nhớ mảng và Map sau khi đã tạo xong chuỗi transcript
    allMessages.length = 0;
    participantMap.clear();

    return transcript;
  } catch (err) {
    console.error("Lỗi tạo transcript:", err);
    return `Lỗi khi xuất transcript: ${err.message}`;
  }
}

// Helper: Sinh Menu chọn gói theo ngôn ngữ
function buildPackageSelectMenu(userId, lang = 'vi') {
  const isEn = lang === 'en';
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`select_package_${lang}_${userId}`)
    .setPlaceholder(isEn ? '👉 Click here to select a Plugin or AI Service...' : '👉 Bấm vào đây để chọn Plugin hoặc Dịch Vụ AI bạn muốn mua...');

  menu.addOptions(
    // Plugin Minecraft
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'LS-AntiCheat • $1.50 (30.000 VNĐ)' : 'LS-AntiCheat • 30.000 VNĐ')
      .setDescription(isEn ? 'WallHit, Inv checks, AutoEat/Potion/Fish, Health spoof' : 'WallHit xuyên web/tường, Inv A-F, AutoEat/Fish/Potion, Fake Máu')
      .setValue('ls_anticheat')
      .setEmoji('🛡️'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Addon Anti-Macro Cart • $1.00/Mo (20.000 VNĐ/Tháng)' : 'Addon Anti-Macro Cart • 20.000 VNĐ / Tháng')
      .setDescription(isEn ? 'Minecart/Boat macro speed exploits protection' : 'Chống hack/macro xe mỏ và thuyền di chuyển siêu tốc')
      .setValue('addon_macro_cart')
      .setEmoji('🛒'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'LS-AntiFreeCam & Obfuscator • $2.50 (59.000 VNĐ)' : 'LS-AntiFreeCam & Obfuscator • 59.000 VNĐ')
      .setDescription(isEn ? 'Blocks Freecam Mod, Baritone auto-mining, Chest ESP, X-Ray' : 'Chống Freecam, Baritone đào tự động, Chest ESP, X-Ray')
      .setValue('anti_freecam')
      .setEmoji('👁️'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'LS-AntiClient & BrandShield • $4.00 (99.000 VNĐ)' : 'LS-AntiClient & BrandShield • 99.000 VNĐ')
      .setDescription(isEn ? 'Blocks Meteor, LiquidBounce, Aristois, Fabric Cheats' : 'Chặn Meteor, LiquidBounce, Aristois, Fabric Cheats')
      .setValue('anti_client')
      .setEmoji('🚫'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'LS-GiftCode & Rewards • $1.50 (30.000 VNĐ)' : 'LS-GiftCode & Rewards • 30.000 VNĐ')
      .setDescription(isEn ? 'Custom gift codes, limit claims, expiry timer, async DB' : 'Hệ thống tạo mã quà tặng tân thủ/sự kiện, giới hạn lượt nhập')
      .setValue('ls_giftcode')
      .setEmoji('🎁'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Combo 2 Anti Plugins • $5.50 (129.000 VNĐ)' : 'Combo 2 Plugin Anti • 129.000 VNĐ')
      .setDescription(isEn ? 'Get AntiFreeCam + AntiClient with a discount bundle' : 'Sở hữu cả LS-AntiFreeCam + LS-AntiClient với giá ưu đãi')
      .setValue('combo_suite')
      .setEmoji('👑'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Custom Java Mod Development' : 'Đặt Làm Mod Custom Cho Minecraft Java')
      .setDescription(isEn ? 'Forge / Fabric / NeoForge 1.16 - 1.21+ built to order' : 'Forge/Fabric/NeoForge 1.16 - 1.21+ • Tùy theo tính năng yêu cầu')
      .setValue('custom_mod')
      .setEmoji('🧩'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Custom Plugin Development' : 'Đặt Làm Plugin Riêng Theo Ý Tưởng')
      .setDescription(isEn ? 'Discuss and build custom server plugins with Developer' : 'Trao đổi tính năng độc quyền trực tiếp với Developer')
      .setValue('custom_dev')
      .setEmoji('📝'),

    // Dịch vụ AI
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Gemini Family Main Account (18 Mo) • $1.50 (35.000 VNĐ)' : 'Acc Gemini Family Nâng Chính Chủ (18 Tháng) • 35.000 VNĐ')
      .setDescription(isEn ? 'Direct 18-month upgrade on your Gmail, 2TB Cloud' : 'Nâng chính chủ Gmail 18 tháng, Gemini Advanced, 2TB Cloud')
      .setValue('acc_gemini_family_18m')
      .setEmoji('🌟'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Gemini Pro 18M Activation Link • $2.00 (49.000 VNĐ)' : 'Link Kích Hoạt Gemini Pro 18M • 49.000 VNĐ')
      .setDescription(isEn ? 'Direct upgrade link for your Google account' : 'Link nâng cấp trực tiếp vào tài khoản Google, bảo hành lần đầu')
      .setValue('link_gemini_pro_18m')
      .setEmoji('🚀'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Google AI Pro Account (1 Mo) • $3.50 (89.000 VNĐ)' : 'Tài Khoản Google AI Pro Chính Chủ (1 Tháng) • 89.000 VNĐ')
      .setDescription(isEn ? 'Gemini Advanced 2M Context, 2TB Google One Cloud' : 'Acc Google AI Pro chính chủ, Gemini Advanced 2M, 2TB Cloud')
      .setValue('acc_google_ai_pro_1m')
      .setEmoji('🚀'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Claude 5 API Key 100M • $4.25 (109.000 VNĐ)' : 'API Key Claude 100M Token • 109.000 VNĐ')
      .setDescription(isEn ? '100M Tokens Claude Fable 5, Opus 5, Sonnet 5 (3 days)' : '100 Triệu Token Claude Fable 5, Opus 5, Sonnet 5 dùng 3 ngày')
      .setValue('api_claude_100m')
      .setEmoji('⚡'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Codex GPT-5.6 API 100M • $3.25 (85.000 VNĐ)' : 'API Key Codex GPT-5.6 • 85.000 VNĐ')
      .setDescription(isEn ? '100M Tokens OpenAI Codex GPT-5.6 Sol (3 days)' : '100 Triệu Token Codex GPT-5.6 Sol chuyên lập trình dùng 3 ngày')
      .setValue('api_codex_100m')
      .setEmoji('💻'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Claude Max 20 Account (1 Mo) • $3.50 (89.000 VNĐ)' : 'Tài Khoản Claude Max 20 • 89.000 VNĐ (1 Tháng)')
      .setDescription(isEn ? 'Full access to Claude Sonnet 5, Opus 5, Fable 5 for 30d' : 'Hạn mức cao Max 20, dùng Claude Fable 5, Opus 5, Sonnet 5')
      .setValue('acc_claude_max20')
      .setEmoji('👑'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'ChatGPT Plus GPT-5.6 (1 Mo) • $6.80 (169.000 VNĐ)' : 'Tài Khoản ChatGPT Plus • 169.000 VNĐ (1 Tháng)')
      .setDescription(isEn ? 'Full GPT-5.6 Sol, DALL-E, Voice Chat with 30-day warranty' : 'GPT-5.6 Sol, DALL-E 3, Voice Chat, Canvas 2.0, bảo hành 1 tháng')
      .setValue('acc_chatgpt_plus')
      .setEmoji('⭐'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Monica AI Pro Claude 5 (3 Days) • $2.00 (49.000 VNĐ)' : 'Tài Khoản Monica AI Pro Claude 5 • 49.000 VNĐ')
      .setDescription(isEn ? 'Claude Sonnet 5, Opus 5, GPT-5.6 Sol, Gemini 2.5 Pro' : 'Gói Pro 3 ngày có Claude 5, GPT-5.6 Sol, Gemini 2.5 Pro')
      .setValue('acc_monica_pro_3d')
      .setEmoji('✨'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'ChatGPT Fresh Gmail for Offer • $0.20 (5.000 VNĐ)' : 'Tài Khoản ChatGPT New Gmail • 5.000 VNĐ')
      .setDescription(isEn ? 'Fresh Gmail to activate GPT-5.6 offer/trial' : 'Gmail mới dùng nhận Offer GPT-5.6 Sol (Cần thẻ PayPal)')
      .setValue('acc_chatgpt_offer')
      .setEmoji('🎁')
  );

  return menu;
}

// =========================================================================
// 7. XỬ LÝ INTERACTIONS (BUTTON, SELECT MENU, SLASH COMMANDS)
// =========================================================================
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // 0. AUTOCOMPLETE INTERACTIONS (Xử lý gợi ý tự động an toàn)
    if (interaction.isAutocomplete()) {
      await interaction.respond([]).catch(() => {});
      return;
    }

    // 1. SLASH COMMANDS
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;

      // /ping
      if (commandName === 'ping') {
        const wsPing = client.ws.ping;
        const apiLatency = Math.max(0, Date.now() - interaction.createdTimestamp);
        return interaction.reply({ 
          content: `🏓 Pong! WebSocket: \`${wsPing}ms\` | API Latency: \`${apiLatency}ms\``, 
          ephemeral: true 
        });
      }

      // /stk
      if (commandName === 'stk') {
        await interaction.deferReply();
        const qrUrl = generateVietQRUrl({ template: 'compact2' });
        const qrBuffer = await fetchVietQRBuffer(qrUrl);

        const embedStk = new EmbedBuilder()
          .setColor("#00E676")
          .setTitle("💳 THÔNG TIN THANH TOÁN / PAYMENT INFORMATION")
          .setDescription(
            `🏦 **Ngân hàng / Bank:** MBBank (Ngân Hàng Quân Đội VN)\n` +
            `🔢 **Số tài khoản / Account Number:** \`${BANK_CONFIG.ACCOUNT_NO}\`\n` +
            `👤 **Chủ tài khoản / Account Holder:** **${BANK_CONFIG.ACCOUNT_NAME}**\n\n` +
            `*Khách hàng Việt Nam có thể quét mã VietQR bên dưới để thanh toán siêu tốc 24/7.*\n` +
            `*International customers: Please open a Ticket for PayPal / International payment methods.*`
          )
          .setFooter({ text: "LS STUDIO • Payment System 24/7" });

        const btnRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('🔗 Mở mã VietQR / Open QR')
            .setStyle(ButtonStyle.Link)
            .setURL(qrUrl)
        );

        if (qrBuffer) {
          const attachment = new AttachmentBuilder(qrBuffer, { name: 'vietqr_stk.png' });
          embedStk.setImage('attachment://vietqr_stk.png');
          return interaction.editReply({ embeds: [embedStk], files: [attachment], components: [btnRow] });
        } else {
          embedStk.setImage(qrUrl);
          embedStk.addFields({
            name: "⚠️ Lưu Ý Quét Mã / QR Preview Notice",
            value: "Nếu ảnh QR không tải được do đường truyền, bạn có thể bấm nút **[🔗 Mở mã VietQR]** bên dưới hoặc chuyển khoản theo số tài khoản ở trên.\n*If QR preview fails to load, please click the button below or copy bank details manually.*"
          });
          return interaction.editReply({ embeds: [embedStk], components: [btnRow] });
        }
      }

      // /khachhang (Staff Only)
      if (commandName === 'khachhang') {
        if (!interaction.inGuild() || !interaction.guild) {
          return interaction.reply({ 
            content: "❌ Lệnh này chỉ có thể sử dụng bên trong máy chủ Discord!", 
            ephemeral: true 
          });
        }

        // Kiểm tra quyền Staff / Admin
        const isStaff = isStaffMember(interaction.member);

        if (!isStaff) {
          return interaction.reply({ 
            content: "❌ Bạn không có quyền sử dụng lệnh này! (Dành riêng cho Staff/Admin) / Staff Only!", 
            ephemeral: true 
          });
        }

        const targetUser = interaction.options.getUser('user', true);
        if (targetUser.bot) {
          return interaction.reply({ 
            content: "❌ Không thể cấp role Khách Hàng cho tài khoản Bot!", 
            ephemeral: true 
          });
        }

        // Hoãn phản hồi (deferReply) để chống 3-second timeout khi gọi API Discord
        await interaction.deferReply({ ephemeral: false });

        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (!member) {
          return interaction.editReply({ 
            content: "❌ Không tìm thấy thành viên này trong server / Member not found in server!" 
          });
        }
        
        let customerRole = interaction.guild.roles.cache.find(r => r.name.includes("Khách Hàng"));
        if (!customerRole) {
          const fetchedRoles = await interaction.guild.roles.fetch().catch(() => null);
          customerRole = fetchedRoles?.find(r => r.name.includes("Khách Hàng"));
        }

        if (!customerRole) {
          return interaction.editReply({ 
            content: "❌ Không tìm thấy role Khách Hàng trên máy chủ / Customer role not found!" 
          });
        }

        if (member.roles.cache.has(customerRole.id)) {
          return interaction.editReply({
            content: `⚠️ Thành viên <@${member.id}> đã sở hữu role **${customerRole.name}** trước đó rồi!`
          });
        }

        const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe().catch(() => null);
        if (!botMember || !botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
          return interaction.editReply({ 
            content: "❌ Bot thiếu quyền `Manage Roles` (Quản Lý Vai Trò) để cấp role cho thành viên!" 
          });
        }

        // Kiểm tra thứ bậc Role của Role Khách Hàng so với Bot
        if (customerRole.position >= botMember.roles.highest.position) {
          return interaction.editReply({ 
            content: `❌ Role **${customerRole.name}** có vị trí cao hơn hoặc ngang bằng với Role cao nhất của Bot trong Server Settings (Role Hierarchy)!` 
          });
        }

        // Kiểm tra nếu mục tiêu là Server Owner (Bot không thể sửa role của Server Owner)
        if (interaction.guild.ownerId === member.id) {
          return interaction.editReply({
            content: "❌ Không thể chỉnh sửa role của Chủ Sở Hữu Máy Chủ (Server Owner)!"
          });
        }

        // Kiểm tra thứ bậc Role của thành viên mục tiêu so với Bot
        if (member.roles.highest.position >= botMember.roles.highest.position) {
          return interaction.editReply({
            content: `❌ Không thể cấp role cho <@${member.id}> vì thành viên này có thứ bậc Role cao hơn hoặc ngang bằng với Bot trong Server Settings!`
          });
        }

        try {
          await member.roles.add(customerRole, `Cấp role Khách Hàng bởi ${interaction.user.tag} (${interaction.user.id})`);
        } catch (roleErr) {
          console.error("❌ Lỗi khi add role cho member:", roleErr);
          return interaction.editReply({
            content: `❌ Không thể cấp role do lỗi phân quyền Discord: \`${roleErr.message}\`. Vui lòng kiểm tra lại thứ bậc Role trong Server Settings!`
          });
        }

        const chDownload = interaction.guild.channels.cache.find(c => c.name.includes("tải-plugin"));
        const successEmbed = new EmbedBuilder()
          .setColor("#00E676")
          .setTitle("🎉 CẤP ROLE KHÁCH HÀNG THÀNH CÔNG / ROLE ASSIGNED!")
          .setDescription(
            `Đã cấp role <@&${customerRole.id}> cho <@${member.id}> bởi <@${interaction.user.id}>.\n` +
            `*Role granted to <@${member.id}>. You can now access VIP downloads at ${chDownload ? `<#${chDownload.id}>` : 'VIP channel'}!*`
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [successEmbed] });
      }

      // /transcript (Staff Only - Xuất transcript kênh ticket trực tiếp)
      if (commandName === 'transcript') {
        if (!interaction.inGuild() || !interaction.guild) {
          return interaction.reply({ 
            content: "❌ Lệnh này chỉ có thể sử dụng bên trong máy chủ Discord!", 
            ephemeral: true 
          });
        }

        const isStaff = isStaffMember(interaction.member);

        if (!isStaff) {
          return interaction.reply({ 
            content: "❌ Bạn không có quyền sử dụng lệnh này! (Dành riêng cho Staff/Admin) / Staff Only!", 
            ephemeral: true 
          });
        }

        await interaction.deferReply({ ephemeral: true });

        const channel = interaction.channel;
        const transcriptText = await generateTranscript(channel);
        const transcriptBuffer = Buffer.from(transcriptText, 'utf-8');
        const fileName = `transcript-${channel.name}.txt`;
        const attachment = new AttachmentBuilder(transcriptBuffer, { name: fileName });

        const exportEmbed = new EmbedBuilder()
          .setColor("#00E676")
          .setTitle("📑 XUẤT NHẬT KÝ TICKET THÀNH CÔNG / TRANSCRIPT EXPORTED")
          .setDescription(
            `• **Kênh / Channel:** <#${channel.id}> (\`${channel.name}\`)\n` +
            `• **Người thực hiện:** <@${interaction.user.id}>\n` +
            `• **Dung lượng file:** \`${(transcriptBuffer.length / 1024).toFixed(1)} KB\`\n` +
            `• **Thời gian:** <t:${Math.floor(Date.now() / 1000)}:F>`
          )
          .setFooter({ text: "LS STUDIO Audit & Security" })
          .setTimestamp();

        return interaction.editReply({ embeds: [exportEmbed], files: [attachment] });
      }

      // Fallback cho Slash Command chưa hỗ trợ
      return interaction.reply({ 
        content: "❌ Lệnh không xác định hoặc chưa được hỗ trợ!", 
        ephemeral: true 
      });
    }

    // 2. BUTTON INTERACTIONS
    if (interaction.isButton()) {
      const { customId, user, guild } = interaction;

      // Nút Xem Bảng Giá
      if (customId === 'ticket_pricing') {
        const chPricing = guild?.channels.cache.find(c => c.name.includes('bảng-giá'));
        return interaction.reply({
          content: `💰 Bảng giá chi tiết / Price List: ${chPricing ? `<#${chPricing.id}>` : '#bảng-giá'}`,
          ephemeral: true
        });
      }

      // Nút chuyển ngôn ngữ trong Ticket
      if (customId.startsWith('switch_lang_')) {
        const parts = customId.split('_');
        const targetLang = parts[2] || 'vi'; // 'vi' or 'en'
        const isEn = targetLang === 'en';
        const ticketOwnerId = parts[3] || user.id;

        const menuRow = new ActionRowBuilder().addComponents(buildPackageSelectMenu(ticketOwnerId, targetLang));
        const langSwitchRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`switch_lang_vi_${ticketOwnerId}`)
            .setLabel('🇻🇳 Tiếng Việt')
            .setStyle(isEn ? ButtonStyle.Secondary : ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`switch_lang_en_${ticketOwnerId}`)
            .setLabel('🇺🇸 English')
            .setStyle(isEn ? ButtonStyle.Primary : ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('btn_close_ticket')
            .setLabel(isEn ? '🔒 Close Ticket' : '🔒 Đóng Ticket')
            .setStyle(ButtonStyle.Danger)
        );

        const embed = new EmbedBuilder()
          .setColor("#00E676")
          .setTitle(isEn ? "🛒 ORDER & SUPPORT CENTER - LS STUDIO" : "🛒 TRUNG TÂM THANH TOÁN & ĐẶT HÀNG - LS STUDIO")
          .setDescription(
            isEn 
              ? `👋 Hello <@${ticketOwnerId}>! Welcome to **LS STUDIO**.\n\n` +
                `👇 **Please select a Plugin or AI Service from the dropdown menu below**:\n` +
                `• Premade Plugins & AI Services ➔ Automatic VietQR / Instant Order Invoice!\n` +
                `• Custom Mod / Custom Plugin ➔ Discuss directly with our Developer to get a quote!\n\n` +
                `🌐 *If you are an international buyer and need PayPal / Crypto or English support, let our staff know right here!*`
              : `👋 Chào <@${ticketOwnerId}>! Cảm ơn bạn đã lựa chọn dịch vụ từ **LS STUDIO**.\n\n` +
                `👇 **Vui lòng chọn Plugin hoặc Dịch Vụ AI bạn muốn đặt từ Menu bên dưới**:\n` +
                `• Mua Plugin & Dịch vụ AI có sẵn ➔ Tự tạo mã **VietQR MBBank** để bạn quét thanh toán siêu tốc!\n` +
                `• Đặt làm **Mod Custom Java 1.16+** hoặc **Plugin riêng 1.16+** ➔ Trao đổi trực tiếp ý tưởng với Developer để nhận báo giá chi tiết!`
          )
          .setFooter({ text: isEn ? "Staff will assist and deliver your files right here!" : "Sau khi chuyển khoản, Staff sẽ duyệt và giao file ngay tại đây!" })
          .setTimestamp();

        return interaction.update({ embeds: [embed], components: [menuRow, langSwitchRow] });
      }

      // Nút Mở Ticket Mua Hàng / Support / Custom Dev
      if (customId === 'ticket_buy' || customId === 'ticket_support' || customId === 'ticket_custom') {
        if (!guild) {
          return interaction.reply({ content: "❌ Thao tác này chỉ thực hiện được trong máy chủ!", ephemeral: true });
        }

        // 1. Kiểm tra Rate Limit
        const cooldownRemaining = getRateLimitRemaining(user.id, 5000);
        if (cooldownRemaining > 0) {
          return interaction.reply({
            content: `⏳ Bạn thao tác quá nhanh! Vui lòng đợi **${cooldownRemaining} giây** trước khi mở ticket tiếp theo.\n*Please wait **${cooldownRemaining}s** before opening another ticket.*`,
            ephemeral: true
          });
        }

        // 2. Kiểm tra Concurrency Lock
        if (ticketCreationLocks.has(user.id)) {
          return interaction.reply({
            content: "⏳ Hệ thống đang tạo ticket cho bạn, vui lòng không bấm liên tục!\n*Ticket is being created, please wait...*",
            ephemeral: true
          });
        }

        ticketCreationLocks.add(user.id);
        await interaction.deferReply({ ephemeral: true });

        try {
          // 2.1 Kiểm tra quyền ManageChannels của Bot
          const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
          if (!botMember || !botMember.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return interaction.editReply({
              content: "❌ Bot thiếu quyền `Manage Channels` (Quản Lý Kênh) để tạo Ticket! Vui lòng liên hệ Quản trị viên cấp quyền cho Bot."
            });
          }

          // 3. Kiểm tra Duplicate Ticket: Quét các channel còn tồn tại xem user đã có ticket chưa (bằng topic)
          const existingTicket = guild.channels.cache.find(c => 
            c && 
            !c.deleted &&
            c.type === ChannelType.GuildText &&
            c.topic && c.topic.includes(`(${user.id})`)
          );

          if (existingTicket) {
            return interaction.editReply({
              content: `⚠️ Bạn đã có một ticket đang mở tại / You already have an open ticket at: <#${existingTicket.id}>.`
            });
          }

          let ticketType = "🛒-mua";
          let isBuyTicket = customId === 'ticket_buy';

          if (customId === 'ticket_support') {
            ticketType = "🛠️-support";
          } else if (customId === 'ticket_custom') {
            ticketType = "📝-custom";
          }

          // Xử lý tên kênh an toàn chống ký tự đặc biệt / rỗng
          const sanitizedUsername = user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
          const userSuffix = user.id.slice(-4);
          const safeName = sanitizedUsername.length >= 2 ? `${sanitizedUsername}-${userSuffix}` : `user-${userSuffix}`;
          const channelName = `${ticketType}-${safeName}`;

          // Tìm danh mục Ticket (Hỗ trợ match linh hoạt 'MUA HÀNG & HỖ TRỢ')
          const ticketCat = guild.channels.cache.find(c => 
            c &&
            !c.deleted &&
            c.type === ChannelType.GuildCategory && 
            (
              (c.name.includes("MUA HÀNG") && c.name.includes("HỖ TRỢ")) ||
              c.name.includes("MUA HÀNG") ||
              c.name.includes("HỖ TRỢ") ||
              c.name.toLowerCase().includes("ticket")
            )
          );

          // Lấy tất cả các Role Staff / Developer / Founder / Admin
          const staffRoles = guild.roles.cache.filter(r => 
            r.name.includes("Staff") || 
            r.name.includes("Developer") || 
            r.name.includes("Founder") ||
            r.name.includes("Admin")
          );

          const overwrites = [
            {
              id: guild.roles.everyone.id,
              deny: [PermissionsBitField.Flags.ViewChannel]
            },
            {
              id: user.id,
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
              id: client.user?.id || (botMember ? botMember.id : client.application?.id),
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ManageChannels,
                PermissionsBitField.Flags.ManageMessages,
                PermissionsBitField.Flags.EmbedLinks,
                PermissionsBitField.Flags.AttachFiles,
                PermissionsBitField.Flags.ReadMessageHistory,
                PermissionsBitField.Flags.AddReactions
              ]
            }
          ];

          staffRoles.forEach(role => {
            overwrites.push({
              id: role.id,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.AttachFiles,
                PermissionsBitField.Flags.EmbedLinks,
                PermissionsBitField.Flags.ReadMessageHistory,
                PermissionsBitField.Flags.ManageMessages,
                PermissionsBitField.Flags.AddReactions
              ]
            });
          });

          const ticketChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: ticketCat ? ticketCat.id : null,
            topic: `Ticket của @${user.tag} (${user.id}) • Type: ${customId}`,
            permissionOverwrites: overwrites
          });

          const staffMentionString = staffRoles.size > 0 
            ? Array.from(staffRoles.values()).map(r => `<@&${r.id}>`).join(' ')
            : "";

          if (isBuyTicket) {
            const menuRow = new ActionRowBuilder().addComponents(buildPackageSelectMenu(user.id, 'vi'));

            const langSwitchRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`switch_lang_vi_${user.id}`)
                .setLabel('🇻🇳 Tiếng Việt')
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId(`switch_lang_en_${user.id}`)
                .setLabel('🇺🇸 English')
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId('btn_close_ticket')
                .setLabel('🔒 Đóng / Close')
                .setStyle(ButtonStyle.Danger)
            );

            const introEmbed = new EmbedBuilder()
              .setColor("#00E676")
              .setTitle("🛒 TRUNG TÂM THANH TOÁN & ĐẶT HÀNG / ORDER CENTER")
              .setDescription(
                `👋 Chào <@${user.id}>! Cảm ơn bạn đã lựa chọn dịch vụ từ **LS STUDIO**.\n` +
                `*Welcome <@${user.id}>! Thank you for choosing LS STUDIO.*\n\n` +
                `👇 **Vui lòng chọn Plugin hoặc Dịch Vụ AI từ Menu bên dưới**:\n` +
                `*Please select a package or AI service from the dropdown menu below:*\n\n` +
                `• 🇻🇳 **Tiếng Việt:** Quét mã VietQR MBBank tự động 24/7.\n` +
                `• 🇺🇸 **English:** Switch to English for PayPal / Global payment options!`
              )
              .setFooter({ text: "Staff sẽ hỗ trợ và giao file trực tiếp tại đây! / Staff will assist you here!" })
              .setTimestamp();

            await ticketChannel.send({
              content: `<@${user.id}> ${staffMentionString}`,
              embeds: [introEmbed],
              components: [menuRow, langSwitchRow]
            });

          } else {
            const supportEmbed = new EmbedBuilder()
              .setColor(customId === 'ticket_support' ? "#3D5AFE" : "#FF4500")
              .setTitle(customId === 'ticket_support' ? "🛠️ TICKET HỖ TRỢ KỸ THUẬT / TECH SUPPORT" : "📝 TICKET ĐẶT LÀM PLUGIN HOẶC MOD / CUSTOM DEV")
              .setDescription(
                `👋 Chào / Hello <@${user.id}>!\n\n` +
                (customId === 'ticket_support' 
                  ? "🇻🇳 **Tiếng Việt:** Vui lòng mô tả chi tiết lỗi phát sinh, phiên bản server (Paper/Purpur/Folia 1.16+) hoặc đính kèm file log lỗi (`latest.log`) để Dev hỗ trợ xử lý ngay!\n\n" +
                    "🇺🇸 **English:** Please describe your issue, server software (Paper/Purpur/Folia 1.16+), or attach your crash log (`latest.log`) for quick assistance!"
                  : "🇻🇳 **Tiếng Việt:** Vui lòng mô tả chi tiết ý tưởng Plugin hoặc Mod (Forge/Fabric Java 1.16+), các tính năng mong muốn, thời hạn và ngân sách dự kiến của bạn!\n\n" +
                    "🇺🇸 **English:** Please describe your Plugin or Mod idea (Forge/Fabric Java 1.16+), required features, expected delivery deadline and budget!")
              )
              .setTimestamp();

            const btnRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('btn_close_ticket')
                .setLabel('🔒 Đóng Ticket / Close')
                .setStyle(ButtonStyle.Danger)
            );

            await ticketChannel.send({
              content: `<@${user.id}> ${staffMentionString}`,
              embeds: [supportEmbed],
              components: [btnRow]
            });
          }

          return interaction.editReply({
            content: `✅ Ticket của bạn đã sẵn sàng tại / Your ticket is ready at: <#${ticketChannel.id}>`
          });

        } catch (ticketErr) {
          console.error("Lỗi khởi tạo Ticket:", ticketErr);
          if (ticketErr.code === 30005) {
            return interaction.editReply({
              content: "❌ Danh mục Ticket đã đạt giới hạn tối đa (50 kênh của Discord)! Vui lòng liên hệ Admin đóng bớt các ticket cũ."
            });
          } else if (ticketErr.code === 30013) {
            return interaction.editReply({
              content: "❌ Máy chủ đã đạt giới hạn tối đa số lượng kênh của Discord (500 kênh)! Vui lòng liên hệ Admin."
            });
          } else if (ticketErr.code === 50013) {
            return interaction.editReply({
              content: "❌ Bot thiếu quyền phân quyền Discord (`Manage Channels` hoặc `Manage Roles`) để tạo kênh ticket!"
            });
          }
          return interaction.editReply({
            content: `❌ Không thể tạo Ticket do lỗi hệ thống: \`${ticketErr.message}\`. Vui lòng liên hệ Admin!`
          });
        } finally {
          ticketCreationLocks.delete(user.id);
        }
      }

      // Nút Duyệt Tiền & Giao File (Dành cho Staff/Admin)
      if (customId.startsWith('approve_')) {
        const parts = customId.split('_');
        if (parts.length < 4) {
          return interaction.reply({
            content: "❌ Dữ liệu nút duyệt không hợp lệ! / Invalid approve button payload.",
            ephemeral: true
          });
        }
        const rawOrderCode = parts[1];
        const buyerId = parts[2];
        const pkgKey = parts.slice(3).join('_');

        // 1. Kiểm tra định dạng mã đơn hàng
        if (!isValidOrderCode(rawOrderCode)) {
          return interaction.reply({
            content: `❌ Mã đơn hàng \`${rawOrderCode}\` không đúng định dạng! / Invalid order code format.`,
            ephemeral: true
          });
        }
        const orderCode = rawOrderCode.replace(/[\s-_]/g, '').toUpperCase();

        // 2. Kiểm tra định dạng Snowflake Discord ID của Buyer
        if (!/^\d{17,20}$/.test(buyerId)) {
          return interaction.reply({
            content: "❌ ID khách hàng không hợp lệ! / Invalid buyer ID format.",
            ephemeral: true
          });
        }

        // 3. Kiểm tra và tra cứu thông tin gói sản phẩm (hỗ trợ bí danh legacy & fallback an toàn)
        let pkg = getPackage(pkgKey);
        if (!pkg) {
          pkg = {
            name_vi: `Sản phẩm / Dịch vụ (${pkgKey})`,
            name_en: `Product / Service (${pkgKey})`,
            price_vnd: 0,
            price_usd: 0,
            desc_vi: "Gói sản phẩm hoặc dịch vụ tùy chỉnh",
            desc_en: "Custom product or order"
          };
        }

        // 4. Kiểm tra quyền Staff / Admin
        const isStaff = isStaffMember(interaction.member);

        if (!isStaff) {
          return interaction.reply({
            content: "❌ Chỉ có Quản Trị Viên / Staff mới có quyền duyệt đơn hàng này! / Staff only action!",
            ephemeral: true
          });
        }

        // 5. Chống race condition & duyệt trùng (Concurrency & Idempotency Guard)
        if (processingApprovals.has(orderCode) || approvedOrderCodes.has(orderCode)) {
          return interaction.reply({
            content: `⚠️ Đơn hàng **\`${orderCode}\`** đã được xác nhận hoặc đang được một Staff khác xử lý!\n*This order is already approved or being processed.*`,
            ephemeral: true
          });
        }

        processingApprovals.add(orderCode);

        try {
          const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('approved_done')
              .setLabel('✅ Đã Duyệt & Giao Hàng / Approved')
              .setStyle(ButtonStyle.Success)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId('btn_close_ticket')
              .setLabel('🔒 Đóng Ticket / Close')
              .setStyle(ButtonStyle.Danger)
          );

          // Phản hồi ngay lập tức để chống 3-second timeout và chặn bấm đúp nút (race condition)
          await interaction.update({ components: [disabledRow] }).catch(err => {
            console.warn("⚠️ Không thể update components nút duyệt:", err.message);
          });

          const buyerMember = await guild.members.fetch(buyerId).catch(() => null);
          let customerRole = guild.roles.cache.find(r => r.name.includes("Khách Hàng"));
          if (!customerRole) {
            const fetchedRoles = await guild.roles.fetch().catch(() => null);
            customerRole = fetchedRoles?.find(r => r.name.includes("Khách Hàng"));
          }

          let roleStatusText = "";
          if (!buyerMember) {
            roleStatusText = "⚠️ Khách hàng đã rời khỏi máy chủ (không thể cấp role tự động).";
          } else if (!customerRole) {
            roleStatusText = "⚠️ Không tìm thấy role Khách Hàng trên máy chủ.";
          } else if (buyerMember.roles.cache.has(customerRole.id)) {
            roleStatusText = `• Khách hàng đã sở hữu role <@&${customerRole.id}> trước đó.`;
          } else {
            const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
            if (!botMember || !botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
              roleStatusText = "⚠️ Bot thiếu quyền `Manage Roles` để cấp role tự động.";
            } else if (customerRole.position >= botMember.roles.highest.position) {
              roleStatusText = `⚠️ Role **${customerRole.name}** có vị trí cao hơn hoặc bằng Role của Bot trong Server Settings (Role Hierarchy).`;
            } else if (guild.ownerId === buyerMember.id) {
              roleStatusText = "ℹ️ Khách hàng là Chủ sở hữu máy chủ (Server Owner).";
            } else if (buyerMember.roles.highest.position >= botMember.roles.highest.position) {
              roleStatusText = "⚠️ Khách hàng có thứ bậc Role cao hơn hoặc ngang bằng Bot trong Server Settings.";
            } else {
              try {
                await buyerMember.roles.add(customerRole, `Duyệt đơn hàng ${orderCode} bởi ${interaction.user.tag}`);
                roleStatusText = `• Đã cấp Role **<@&${customerRole.id}>** cho khách hàng.`;
              } catch (rErr) {
                console.warn(`⚠️ [Approve Role Add Warning] Không thể cấp role cho buyer ${buyerId}: ${rErr.message}`);
                roleStatusText = `⚠️ Lỗi phân quyền khi cấp role: \`${rErr.message}\`.`;
              }
            }
          }

          const successEmbed = new EmbedBuilder()
            .setColor("#00E676")
            .setTitle("🎉 XÁC NHẬN THANH TOÁN THÀNH CÔNG / PAYMENT APPROVED!")
            .setDescription(
              `✅ Đơn hàng **\`${orderCode}\`** đã được <@${interaction.user.id}> xác nhận tiền về tài khoản!\n\n` +
              `👤 **Khách hàng / Customer:** <@${buyerId}> ${buyerMember ? '' : '*(Đã rời server)*'}\n` +
              `📦 **Sản phẩm / Product:** **${pkg.name_vi}**\n` +
              `💰 **Số tiền / Amount:** \`${formatVND(pkg.price_vnd)}\` (~${formatUSD(pkg.price_usd)})\n\n` +
              `👑 **Quyền lợi & Trạng thái / Status:**\n` +
              `${roleStatusText}\n` +
              `• Staff sẽ gửi File / Link / API Key / Tài khoản trực tiếp ngay tại Ticket này!\n\n` +
              `💬 *Cảm ơn bạn đã tin tưởng và sử dụng dịch vụ của LS STUDIO!*`
            )
            .setFooter({ text: "LS STUDIO • Thank you for your purchase!", iconURL: client.user ? client.user.displayAvatarURL({ size: 256 }) : undefined })
            .setTimestamp();

          await interaction.channel.send({ embeds: [successEmbed] }).catch(err => {
            console.error("⚠️ Không thể gửi tin nhắn xác nhận vào channel:", err.message);
          });

          const logChannel = guild?.channels.cache.find(c => 
            c.isTextBased() && (
              c.name.includes("nhật-ký-giao-dịch") || 
              c.name.includes("nhật-ký")
            )
          );
          if (logChannel) {
            const logEmbed = new EmbedBuilder()
              .setColor("#00E676")
              .setTitle("📊 GIAO DỊCH THÀNH CÔNG / TRANSACTION SUCCESS")
              .setDescription(
                `• **Mã đơn / Order:** \`${orderCode}\`\n` +
                `• **Khách hàng / Customer:** <@${buyerId}> (\`${buyerId}\`)${buyerMember ? '' : ' *(Đã rời server)*'}\n` +
                `• **Sản phẩm / Product:** ${pkg.name_vi}\n` +
                `• **Số tiền / Amount:** \`${formatVND(pkg.price_vnd)}\` (~${formatUSD(pkg.price_usd)})\n` +
                `• **Trạng thái Role:** ${roleStatusText.replace(/• /g, '')}\n` +
                `• **Người duyệt / Approved by:** <@${interaction.user.id}>\n` +
                `• **Thời gian / Time:** <t:${Math.floor(Date.now() / 1000)}:F>`
              )
              .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] }).catch(err => {
              console.error("❌ Lỗi gửi log giao dịch:", err);
            });
          }

          // Ghi nhận đơn hàng đã duyệt thành công
          approvedOrderCodes.add(orderCode);

        } finally {
          processingApprovals.delete(orderCode);
        }
        return;
      }

      // Nút Yêu Cầu Đóng Ticket (Hiện hộp thoại xác nhận)
      if (customId === 'btn_close_ticket') {
        const isTicketChannel = interaction.channel?.name?.includes('mua') ||
                                interaction.channel?.name?.includes('support') ||
                                interaction.channel?.name?.includes('custom') ||
                                interaction.channel?.name?.includes('ticket') ||
                                interaction.channel?.topic?.includes('Ticket của') ||
                                interaction.channel?.parent?.name?.includes('MUA HÀNG') ||
                                interaction.channel?.parent?.name?.includes('HỖ TRỢ');

        if (!isTicketChannel) {
          return interaction.reply({ 
            content: "⚠️ Nút này chỉ có thể sử dụng bên trong các kênh Ticket!", 
            ephemeral: true 
          });
        }

        const confirmEmbed = new EmbedBuilder()
          .setColor("#FFA000")
          .setTitle("⚠️ XÁC NHẬN ĐÓNG TICKET / CLOSE CONFIRMATION")
          .setDescription(
            `Bạn có chắc chắn muốn đóng ticket **#${interaction.channel.name}** không?\n\n` +
            `• Toàn bộ tin nhắn (Transcript) sẽ được tạo và lưu trữ tự động vào kênh quản trị.\n` +
            `• Kênh chat này sẽ bị **xóa vĩnh viễn** sau khi xác nhận.\n\n` +
            `*Are you sure you want to close this ticket? A transcript file will be generated and saved to admin logs.*`
          )
          .setFooter({ text: "LS STUDIO Ticket Security" });

        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('confirm_close_ticket')
            .setLabel('🔴 Xác Nhận Đóng / Confirm Close')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('cancel_close_ticket')
            .setLabel('⚪ Hủy Bỏ / Cancel')
            .setStyle(ButtonStyle.Secondary)
        );

        return interaction.reply({ embeds: [confirmEmbed], components: [confirmRow] });
      }

      // Nút Hủy Đóng Ticket
      if (customId === 'cancel_close_ticket') {
        const cancelEmbed = new EmbedBuilder()
          .setColor("#4CAF50")
          .setDescription("✅ **Đã hủy thao tác đóng ticket.** Bạn có thể tiếp tục trao đổi với Staff!\n*Ticket close cancelled. You can continue chatting.*");

        return interaction.update({ embeds: [cancelEmbed], components: [] });
      }

      // Nút Xác Nhận Đóng Ticket (Tạo transcript, gửi log và xóa kênh)
      if (customId === 'confirm_close_ticket') {
        const closingEmbed = new EmbedBuilder()
          .setColor("#ED4245")
          .setTitle("🔒 ĐANG ĐÓNG TICKET & LƯU TRANSCRIPT...")
          .setDescription("Đang tổng hợp toàn bộ tin nhắn và lưu trữ nhật ký hội thoại. Kênh sẽ tự động xóa sau 5 giây...\n*Generating full transcript and closing ticket. Channel will be deleted in 5 seconds...*");

        await interaction.update({ embeds: [closingEmbed], components: [] });

        const channel = interaction.channel;
        const transcriptText = await generateTranscript(channel);
        const transcriptBuffer = Buffer.from(transcriptText, 'utf-8');
        const fileName = `transcript-${channel.name}.txt`;

        // Trích xuất ID người mở ticket từ Topic
        const openerMatch = channel.topic ? channel.topic.match(/\((\d{17,20})\)/) : null;
        const openerId = openerMatch ? openerMatch[1] : null;

        // 1. Gửi Transcript qua tin nhắn riêng (DM) cho người mở ticket (Bắt lỗi an toàn khi user chặn DM / tắt DM)
        let dmSent = false;
        let dmStatusNote = "Không tìm thấy thông tin người mở trong topic";
        if (openerId) {
          try {
            const openerUser = await client.users.fetch(openerId).catch(() => null);
            if (openerUser) {
              const dmEmbed = new EmbedBuilder()
                .setColor("#5865F2")
                .setTitle("📑 BẢN LƯU NHẬT KÝ TICKET - LS STUDIO")
                .setDescription(
                  `👋 Chào <@${openerId}>!\n\n` +
                  `Ticket **#${channel.name}** của bạn tại **LS STUDIO** đã được đóng bởi <@${user.id}>.\n` +
                  `Đính kèm bên dưới là toàn bộ lịch sử tin nhắn (Transcript) để bạn tiện theo dõi và tra cứu khi cần.\n\n` +
                  `*Thank you for contacting LS STUDIO! Your ticket transcript is attached below.*`
                )
                .setFooter({ text: "LS STUDIO • Hỗ Trợ 24/7" })
                .setTimestamp();

              const dmAttachment = new AttachmentBuilder(transcriptBuffer, { name: fileName });

              await openerUser.send({ embeds: [dmEmbed], files: [dmAttachment] });
              dmSent = true;
              dmStatusNote = "✅ Đã gửi bản sao qua DM thành công";
            } else {
              dmStatusNote = "⚠️ Không tìm thấy tài khoản người dùng trên Discord";
            }
          } catch (dmErr) {
            dmSent = false;
            if (dmErr.code === 50007) {
              dmStatusNote = "⚠️ Khách tắt nhận DM từ server hoặc chặn Bot (Code 50007)";
            } else {
              dmStatusNote = `⚠️ Lỗi gửi DM: ${dmErr.message || 'Không xác định'}`;
            }
            console.warn(`⚠️ [Transcript DM] Không thể gửi DM cho user ${openerId}: ${dmStatusNote}`);
          }
        }

        // 2. Gửi Transcript về kênh Quản Trị / Log Channel (Xử lý an toàn khi thiếu kênh hoặc thiếu quyền)
        try {
          let logChannel = guild?.channels.cache.find(c => 
            c.isTextBased() && (
              c.name.includes("nhật-ký-giao-dịch") || 
              c.name.includes("nhật-ký") ||
              c.name.includes("ticket-log") ||
              c.name.includes("transcripts") ||
              c.name.includes("log")
            )
          );

          if (!logChannel && guild) {
            const fetchedChannels = await guild.channels.fetch().catch(() => null);
            if (fetchedChannels) {
              logChannel = fetchedChannels.find(c => 
                c && c.isTextBased() && (
                  c.name.includes("nhật-ký-giao-dịch") || 
                  c.name.includes("nhật-ký") ||
                  c.name.includes("ticket-log") ||
                  c.name.includes("transcripts") ||
                  c.name.includes("log")
                )
              );
            }
          }

          if (logChannel) {
            const botMember = guild.members.me || (client.user ? await guild.members.fetch(client.user.id).catch(() => null) : null);
            const permissions = botMember ? logChannel.permissionsFor(botMember) : null;

            const canView = !permissions || permissions.has(PermissionsBitField.Flags.ViewChannel);
            const canSend = !permissions || permissions.has(PermissionsBitField.Flags.SendMessages);
            const canAttach = !permissions || permissions.has(PermissionsBitField.Flags.AttachFiles);
            const canEmbed = !permissions || permissions.has(PermissionsBitField.Flags.EmbedLinks);

            if (!canView || !canSend) {
              console.error(`❌ [Log Channel] Bot thiếu quyền ViewChannel hoặc SendMessages trong #${logChannel.name}`);
            } else {
              const logEmbed = new EmbedBuilder()
                .setColor("#FF5252")
                .setTitle("📑 NHẬT KÝ ĐÓNG TICKET / TICKET TRANSCRIPT LOG")
                .addFields(
                  { name: "📁 Kênh / Channel", value: `\`${channel.name}\` (\`${channel.id}\`)`, inline: true },
                  { name: "👤 Người mở / Opener", value: openerId ? `<@${openerId}> (\`${openerId}\`)` : "N/A", inline: true },
                  { name: "🔒 Người đóng / Closed By", value: `<@${user.id}> (\`${user.id}\`)`, inline: true },
                  { name: "⏰ Thời gian / Time", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                  { name: "📨 Trạng thái gửi DM Khách", value: dmStatusNote, inline: false }
                )
                .setFooter({ text: "LS STUDIO Ticket Security & Audit" })
                .setTimestamp();

              const files = [];
              if (canAttach) {
                files.push(new AttachmentBuilder(transcriptBuffer, { name: fileName }));
              } else {
                logEmbed.addFields({ name: "⚠️ Quyền đính kèm", value: "Bot thiếu quyền `AttachFiles` để gửi kèm file transcript." });
              }

              if (canEmbed) {
                await logChannel.send({ embeds: [logEmbed], files }).catch(err => {
                  console.error("❌ Lỗi gửi log transcript có embed:", err);
                });
              } else {
                await logChannel.send({
                  content: `📑 **NHẬT KÝ ĐÓNG TICKET**\n• Kênh: \`${channel.name}\`\n• Người mở: <@${openerId || 'N/A'}>\n• Người đóng: <@${user.id}>\n• DM Khách: ${dmStatusNote}`,
                  files
                }).catch(err => {
                  console.error("❌ Lỗi gửi log transcript dạng text:", err);
                });
              }
            }
          } else {
            console.warn(`⚠️ [Transcript Warning] Không tìm thấy kênh nhật ký (nhật-ký-giao-dịch) trên server ${guild?.name}`);
          }
        } catch (logErr) {
          console.error("❌ Lỗi xử lý gửi transcript về log channel:", logErr);
        }

        // 3. Xóa kênh sau 5 giây an toàn & giải phóng bộ nhớ cache
        setTimeout(async () => {
          try {
            const ch = await guild?.channels.fetch(channel.id).catch(() => null);
            if (ch && ch.deletable) {
              ch.messages?.cache?.clear();
              await ch.delete(`Ticket closed by ${user.tag} (${user.id})`).catch(delErr => {
                if (delErr.code !== 10003) {
                  console.error("❌ Lỗi xóa kênh ticket sau khi lưu transcript:", delErr);
                }
              });
            }
          } catch (e) {
            if (e.code !== 10003) {
              console.error("❌ Lỗi xóa kênh ticket sau khi lưu transcript:", e);
            }
          }
        }, 5000).unref();

        return;
      }
    }

    // 3. SELECT MENU (CHỌN GÓI MUA - VIỆT NAM HOẶC ENGLISH)
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith('select_package_')) {
        const parts = interaction.customId.split('_');
        const lang = parts[2] || 'vi'; // 'vi' or 'en'
        const isEn = lang === 'en';
        const ticketOwnerId = parts[3] || interaction.user.id;
        const selectedKey = interaction.values[0];
        const pkg = getPackage(selectedKey);

        if (!pkg) {
          return interaction.reply({
            content: isEn 
              ? "❌ The selected package is deprecated or no longer available. Please select from the updated menu!" 
              : "❌ Gói sản phẩm không tồn tại hoặc đã được cập nhật. Vui lòng chọn lại gói từ menu!",
            ephemeral: true
          });
        }

        // Kiểm tra quyền tương tác: Phải là chủ Ticket hoặc Staff
        const isStaff = isStaffMember(interaction.member);

        if (interaction.user.id !== ticketOwnerId && !isStaff) {
          return interaction.reply({
            content: "❌ Bạn không phải là chủ sở hữu của Ticket này! / You are not the owner of this ticket!",
            ephemeral: true
          });
        }

        // Xử lý gói Custom Mod hoặc Custom Plugin
        if (pkg.price_vnd === 0) {
          const isMod = selectedKey === 'custom_mod';
          const customEmbed = new EmbedBuilder()
            .setColor(isMod ? "#9C27B0" : "#FF4500")
            .setTitle(isEn 
              ? (isMod ? "🧩 CUSTOM MINECRAFT JAVA MOD DEVELOPMENT" : "📝 CUSTOM PLUGIN DEVELOPMENT")
              : (isMod ? "🧩 ĐẶT LÀM MOD CUSTOM CHO MINECRAFT JAVA" : "📝 ĐẶT LẬP TRÌNH PLUGIN THEO Ý TƯỞNG"))
            .setDescription(
              isEn 
                ? (isMod 
                    ? `You selected: **${pkg.name_en}**\n\n` +
                      `👉 **How to order a Custom Minecraft Java Mod:**\n` +
                      `1. **Supported platforms:** Forge, Fabric, NeoForge, Quilt (1.16 to 1.21+ Java Edition PC).\n` +
                      `2. Send your detailed mod idea and requested features right here in this ticket.\n` +
                      `3. Our Lead Developer will review, discuss, and provide a clear quote & estimated delivery date!\n\n` +
                      `⚠️ *Note: We only build mods for Minecraft Java Edition on PC, Bedrock/PE is not supported.*`
                    : `You selected: **${pkg.name_en}**\n\n` +
                      `👉 **Next steps:**\n` +
                      `1. Please describe your plugin idea, commands, features and server version in detail.\n` +
                      `2. Our Developer will provide a price quote and delivery timeline.\n` +
                      `3. Once agreed, you can send payment via Bank/PayPal to begin development!`)
                : (isMod 
                    ? `Bạn đã chọn: **${pkg.name_vi}**\n\n` +
                      `👉 **Quy trình đặt làm Mod Minecraft Java:**\n` +
                      `1. **Nền tảng hỗ trợ:** Forge, Fabric, NeoForge, Quilt (1.16 đến 1.21+ Java Edition PC).\n` +
                      `2. Hãy nhắn chi tiết ý tưởng Mod và các tính năng bạn yêu cầu tại đây.\n` +
                      `3. Developer của **LS STUDIO** sẽ đọc yêu cầu, tư vấn và báo giá + thời hạn bàn giao!\n\n` +
                      `⚠️ *Lưu ý: Bên mình chỉ nhận làm Mod cho Minecraft Java Edition trên PC, không nhận Bedrock PE.*`
                    : `Bạn đã chọn: **${pkg.name_vi}**\n\n` +
                      `👉 **Các bước tiếp theo:**\n` +
                      `1. Hãy nhắn chi tiết ý tưởng plugin của bạn tại đây.\n` +
                      `2. Developer của **LS STUDIO** sẽ đọc yêu cầu, báo giá và thời gian hoàn thành.\n` +
                      `3. Khi thống nhất, Dev sẽ gửi mã QR MBBank để bạn đặt cọc 50% và bắt đầu tiến hành code!`)
            )
            .setFooter({ text: "LS STUDIO • Uy Tín - Đúng Hẹn - Tối Ưu" })
            .setTimestamp();

          const btnClose = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('btn_close_ticket')
              .setLabel(isEn ? '🔒 Close Ticket' : '🔒 Đóng Ticket')
              .setStyle(ButtonStyle.Danger)
          );

          return interaction.reply({ embeds: [customEmbed], components: [btnClose] });
        }

        await interaction.deferReply();

        const orderCode = generateUniqueOrderCode();
        activeOrderCodes.set(orderCode, {
          createdAt: Date.now(),
          pkgKey: selectedKey,
          buyerId: ticketOwnerId
        });

        const qrUrl = generateVietQRUrl({
          template: 'compact2',
          amount: pkg.price_vnd,
          addInfo: orderCode
        });

        const qrBuffer = await fetchVietQRBuffer(qrUrl);

        const invoiceEmbed = new EmbedBuilder()
          .setColor("#00E676")
          .setTitle(isEn ? `💳 PAYMENT INVOICE: ${orderCode}` : `💳 HÓA ĐƠN THANH TOÁN: ${orderCode}`)
          .setDescription(
            isEn 
              ? `You selected: **${pkg.name_en}**\n\n` +
                `💰 **Amount Due:** \`${formatVND(pkg.price_vnd)}\` (~**${formatUSD(pkg.price_usd)}**)\n` +
                `🏦 **Bank:** **MBBank Vietnam**\n` +
                `🔢 **Account No:** \`${BANK_CONFIG.ACCOUNT_NO}\`\n` +
                `👤 **Account Name:** **${BANK_CONFIG.ACCOUNT_NAME}**\n` +
                `📝 **Transfer Memo / Note:** **\`${orderCode}\`** *(Required)*\n\n` +
                `📱 **Payment Options:**\n` +
                `• **Vietnam Banking / MoMo:** Scan the VietQR code below for instant transfer.\n` +
                `• **International Customers (PayPal / Crypto / Card):** Please message staff in this ticket to receive payment instructions!\n` +
                `• Once transferred, staff will approve and deliver your files / API Key / Account immediately!`
              : `Quý khách đã chọn: **${pkg.name_vi}**\n\n` +
                `💰 **Số tiền cần thanh toán:** \`${formatVND(pkg.price_vnd)}\` (~${formatUSD(pkg.price_usd)})\n` +
                `🏦 **Ngân hàng:** **MBBank (Ngân Hàng Quân Đội)**\n` +
                `🔢 **Số tài khoản:** \`${BANK_CONFIG.ACCOUNT_NO}\`\n` +
                `👤 **Chủ tài khoản:** **${BANK_CONFIG.ACCOUNT_NAME}**\n` +
                `📝 **Nội dung chuyển khoản:** **\`${orderCode}\`** *(Bắt buộc ghi đúng)*\n\n` +
                `📱 **Hướng dẫn quét mã nhanh:**\n` +
                `• Mở App **MBBank** hoặc bất kỳ ứng dụng ngân hàng / MoMo nào trên điện thoại.\n` +
                `• Quét mã QR bên dưới -> Số tiền và nội dung sẽ tự động điền chính xác 100%!\n` +
                `• Chuyển khoản xong, vui lòng đợi Staff bấm duyệt để nhận File / Key / Tài khoản ngay tại đây!`
          )
          .setFooter({ text: `Order ID: ${orderCode} • LS STUDIO Payment System` })
          .setTimestamp();

        const actionRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`approve_${orderCode}_${ticketOwnerId}_${selectedKey}`)
            .setLabel(isEn ? '✅ Approve & Deliver (Staff Only)' : '✅ Duyệt Tiền & Giao Hàng (Staff Only)')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setLabel(isEn ? '🔗 Open VietQR Link' : '🔗 Mở mã VietQR')
            .setStyle(ButtonStyle.Link)
            .setURL(qrUrl),
          new ButtonBuilder()
            .setCustomId('btn_close_ticket')
            .setLabel(isEn ? '🔒 Close Ticket' : '🔒 Đóng Ticket')
            .setStyle(ButtonStyle.Danger)
        );

        if (qrBuffer) {
          const attachment = new AttachmentBuilder(qrBuffer, { name: `vietqr_${orderCode}.png` });
          invoiceEmbed.setImage(`attachment://vietqr_${orderCode}.png`);
          return interaction.editReply({ embeds: [invoiceEmbed], files: [attachment], components: [actionRow] });
        } else {
          invoiceEmbed.setImage(qrUrl);
          invoiceEmbed.addFields({
            name: isEn ? "⚠️ QR Image Notice" : "⚠️ Lưu Ý Quét Mã QR",
            value: isEn
              ? "If QR image is loading slowly, please click **[🔗 Open VietQR Link]** or transfer manually using the bank account info above."
              : "Nếu ảnh QR tải chậm hoặc không hiện trên Discord, bạn hãy bấm nút **[🔗 Mở mã VietQR]** hoặc chuyển khoản theo số tài khoản và nội dung ở trên nhé!"
          });
          return interaction.editReply({ embeds: [invoiceEmbed], components: [actionRow] });
        }
      }
    }

  } catch (error) {
    console.error("❌ Lỗi tương tác bot:", error);
    try {
      if (interaction.isAutocomplete?.()) return;
      const errorMsg = { 
        content: "❌ Đã có lỗi xảy ra khi xử lý yêu cầu! Vui lòng thử lại sau.", 
        ephemeral: true 
      };
      if (interaction.deferred && !interaction.replied) {
        await interaction.editReply(errorMsg).catch(() => {});
      } else if (interaction.replied) {
        await interaction.followUp(errorMsg).catch(() => {});
      } else {
        await interaction.reply(errorMsg).catch(() => {});
      }
    } catch (err) {
      // Bỏ qua lỗi phụ nếu interaction đã đóng
    }
  }
});

// =========================================================================
// 8. PROCESS GRACEFUL SHUTDOWN & CLEANUP
// =========================================================================
function handleGracefulShutdown(signal) {
  console.log(`🛑 [Graceful Shutdown] Nhận tín hiệu ${signal}. Đang dọn dẹp tài nguyên và ngắt kết nối an toàn...`);
  if (activityInterval) {
    clearInterval(activityInterval);
    activityInterval = null;
  }
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
  ticketCreationLocks.clear();
  userCooldowns.clear();
  client.destroy();
  console.log('✅ Đã giải phóng bộ nhớ, ngắt kết nối Discord và thoát tiến trình sạch sẽ.');
  process.exit(0);
}

process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));

// =========================================================================
// 9. BOT LOGIN & MODULE EXPORTS
// =========================================================================
if (require.main === module) {
  if (!TOKEN || TOKEN === 'YOUR_BOT_TOKEN_HERE') {
    console.error("❌ [LỖI KHỞI ĐỘNG]: DISCORD_TOKEN chưa được cung cấp trong biến môi trường hoặc token.local.js!");
  } else {
    client.login(TOKEN).catch((err) => {
      console.error("❌ [LỖI ĐĂNG NHẬP DISCORD]:", err.message);
    });
  }
}

module.exports = {
  isStaffMember,
  client,
  PACKAGES,
  DEPRECATED_PACKAGE_ALIASES,
  BANK_CONFIG,
  ORDER_CODE_REGEX,
  generateOrderCode,
  generateUniqueOrderCode,
  extractOrderCode,
  isValidOrderCode,
  sanitizeVietQRText,
  formatVND,
  formatUSD,
  paymentHttpClient,
  generateVietQRUrl,
  fetchVietQRBuffer,
  getPackage,
  getRateLimitRemaining,
  generateTranscript,
  buildPackageSelectMenu,
  ticketCreationLocks,
  userCooldowns,
  activeOrderCodes,
  processingApprovals,
  approvedOrderCodes,
  handleGracefulShutdown
};

