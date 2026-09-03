const path = require('path');
const fs = require('fs');
const http = require('http');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const crypto = require('crypto');
const axios = require('axios');
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  ChannelType,
  OverwriteType,
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
  RESTEvents,
  Routes,
  SlashCommandBuilder,
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  ApplicationIntegrationType,
  InteractionContextType,
  Events,
  AttachmentBuilder,
  Options
} = require('discord.js');

const {
  ComponentType,
  MessageFlags,
  SeparatorSpacingSize,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ThumbnailBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  FileBuilder,
  resolveColor,
  convertAccentColor,
  createComponentPayload,
  createDualModePayload,
  convertLegacyToComponentsV2,
  convertComponentsV2ToLegacy,
  isComponentsV2Payload,
} = require('./components_v2.js');

// =========================================================================
// 0. CẤU HÌNH HỆ THỐNG & BIẾN MÔI TRƯỜNG
// =========================================================================
const tokenLocalPath = path.join(__dirname, 'token.local.js');
const localConfig = fs.existsSync(tokenLocalPath) ? require(tokenLocalPath) : {};
const TOKEN = process.env.DISCORD_TOKEN || localConfig.TOKEN || localConfig.DISCORD_TOKEN || '';
const GUILD_ID = process.env.GUILD_ID || "1542476657825419334";

// CỔNG HTTP HEALTH CHECK PHỤC VỤ RENDER / KOYEB 24/7
let discordLoginStatus = 'pending';
let discordLoginError = null;

const HEALTH_PORT = process.env.PORT || process.env.HEALTH_PORT || null;
if (HEALTH_PORT) {
  const healthServer = http.createServer(async (req, res) => {
    if (req.url === '/test-discord') {
      try {
        const r = await fetch('https://discord.com/api/v10/gateway/bot', {
          headers: { Authorization: 'Bot ' + TOKEN }
        });
        const json = await r.json();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ httpStatus: r.status, data: json }, null, 2));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ error: err.message, stack: err.stack }, null, 2));
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      status: 'online',
      uptimeSeconds: Math.floor(process.uptime()),
      loginStatus: discordLoginStatus,
      loginError: discordLoginError,
      tokenLength: TOKEN ? TOKEN.length : 0,
      tokenPrefix: TOKEN ? TOKEN.slice(0, 10) : 'none',
      tokenSuffix: TOKEN ? TOKEN.slice(-6) : 'none',
      discordReady: client.isReady(),
      botTag: client.user ? client.user.tag : null,
      guildCount: client.guilds.cache.size,
      wsPing: client.ws.ping,
      nodeVersion: process.version,
      ramUsageMB: (process.memoryUsage().rss / 1024 / 1024).toFixed(1)
    }, null, 2));
  });
  healthServer.listen(HEALTH_PORT, '0.0.0.0', () => {
    console.log(`🌐 [Render/Cloud Health Server] Đang lắng nghe trên cổng ${HEALTH_PORT} (HTTP 200 OK)`);
  });
}

// CẤU HÌNH NGÂN HÀNG MBBANK (Hỗ trợ cấu hình động qua Biến môi trường)
const BANK_CONFIG = Object.freeze({
  BANK_ID: (process.env.BANK_ID || "MB").trim().toUpperCase(),
  ACCOUNT_NO: (process.env.BANK_ACCOUNT_NO || process.env.BANK_ACCOUNT || "844515133333").trim(),
  ACCOUNT_NAME: (process.env.BANK_ACCOUNT_NAME || process.env.ACCOUNT_NAME || "VAN HUU PHAM NGUYEN").trim().toUpperCase()
});

/**
 * Kiểm tra tính hợp lệ của cấu hình ngân hàng BANK_CONFIG
 * @param {Object} config - Cấu hình ngân hàng cần kiểm tra
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateBankConfig(config = BANK_CONFIG) {
  if (!config || typeof config !== 'object') {
    return { valid: false, reason: 'BANK_CONFIG phải là một Object hợp lệ.' };
  }
  const bankId = config.BANK_ID ? String(config.BANK_ID).trim() : '';
  const accountNo = config.ACCOUNT_NO ? String(config.ACCOUNT_NO).trim() : '';
  const accountName = config.ACCOUNT_NAME ? String(config.ACCOUNT_NAME).trim() : '';

  if (!bankId || !/^[A-Za-z0-9]{2,10}$/.test(bankId)) {
    return { valid: false, reason: `Mã ngân hàng (BANK_ID) không hợp lệ: "${bankId}". Yêu cầu 2-10 ký tự chữ/số.` };
  }
  if (!accountNo || !/^[A-Za-z0-9]{6,25}$/.test(accountNo)) {
    return { valid: false, reason: `Số tài khoản (ACCOUNT_NO) không hợp lệ: "${accountNo}". Yêu cầu 6-25 ký tự chữ/số.` };
  }
  if (!accountName || accountName.length < 2) {
    return { valid: false, reason: `Tên chủ tài khoản (ACCOUNT_NAME) không được để trống: "${accountName}".` };
  }
  return { valid: true };
}

// Kiểm tra cấu hình ngân hàng ngay khi khởi động
const _initialBankValidation = validateBankConfig(BANK_CONFIG);
if (!_initialBankValidation.valid) {
  console.warn(`⚠️ [BANK_CONFIG Warning] ${_initialBankValidation.reason}`);
}

// =========================================================================
// 0.05 QUYỀN HẠN BOT, TÍNH TOÁN BITFIELD & APP DIRECTORY DISCOVERY METADATA
// =========================================================================

/**
 * Danh sách 7 quyền hạn cốt lõi của Bot LS Studio theo tài liệu Discord Developer
 * (SendMessages, EmbedLinks, AttachFiles, ManageRoles, ManageChannels, ReadMessageHistory, UseExternalEmojis)
 */
const REQUIRED_BOT_PERMISSIONS = Object.freeze([
  PermissionsBitField.Flags.SendMessages,
  PermissionsBitField.Flags.EmbedLinks,
  PermissionsBitField.Flags.AttachFiles,
  PermissionsBitField.Flags.ManageRoles,
  PermissionsBitField.Flags.ManageChannels,
  PermissionsBitField.Flags.ReadMessageHistory,
  PermissionsBitField.Flags.UseExternalEmojis
]);

/**
 * Metadata thông tin sẵn sàng cho App Directory & Discovery theo tiêu chuẩn Discord
 */
const APP_DIRECTORY_METADATA = Object.freeze({
  BOT_NAME: 'LS Studio Bot',
  BOT_DESCRIPTION: (process.env.BOT_DESCRIPTION || 'LS STUDIO Bot - Hỗ trợ thanh toán VietQR tự động 24/7, quản lý đơn hàng, bán Plugin/Mod Minecraft và AI Gateway siêu tốc.').trim(),
  SUPPORT_SERVER_URL: (process.env.SUPPORT_SERVER_URL || 'https://discord.gg/lsstudio').trim(),
  TERMS_OF_SERVICE_URL: (process.env.TERMS_OF_SERVICE_URL || 'https://lsstudio.vn/terms').trim(),
  PRIVACY_POLICY_URL: (process.env.PRIVACY_POLICY_URL || 'https://lsstudio.vn/privacy').trim(),
  WEBSITE_URL: (process.env.WEBSITE_URL || 'https://lsstudio.vn').trim(),
  TAGS: Object.freeze(['minecraft', 'plugins', 'anticheat', 'tickets', 'payment'])
});

/**
 * Tính toán Permission Bitfield từ danh sách quyền hạn Discord
 * @param {Array<bigint|string|number>|bigint|number} permissions - Danh sách hoặc bitfield quyền hạn
 * @returns {{ bitfield: bigint, bitfieldString: string, bitfieldNumber: number, permissions: string[], has: (perm: bigint|string|number) => boolean }}
 */
function calculatePermissionsBitfield(permissions = REQUIRED_BOT_PERMISSIONS) {
  let pbf;
  try {
    pbf = new PermissionsBitField(permissions);
  } catch (err) {
    pbf = new PermissionsBitField(0n);
  }
  return {
    bitfield: pbf.bitfield,
    bitfieldString: pbf.bitfield.toString(),
    bitfieldNumber: Number(pbf.bitfield),
    permissions: pbf.toArray(),
    has: (permission) => {
      try {
        return pbf.has(permission);
      } catch {
        return false;
      }
    }
  };
}

/**
 * Kiểm tra tính hợp lệ & mức độ sẵn sàng cho App Directory & Discovery theo tiêu chuẩn Discord
 * @param {Object} metadata - Metadata cần kiểm tra (mặc định APP_DIRECTORY_METADATA)
 * @returns {{ ready: boolean, score: number, maxScore: number, checks: Array<{ name: string, passed: boolean, message: string }> }}
 */
function validateAppDirectoryReadiness(metadata = APP_DIRECTORY_METADATA) {
  const checks = [];
  let score = 0;
  const maxScore = 5;

  // 1. Kiểm tra mô tả Bot (10 - 400 ký tự)
  const desc = metadata?.BOT_DESCRIPTION || '';
  const descPassed = typeof desc === 'string' && desc.length >= 10 && desc.length <= 400;
  checks.push({
    name: 'Bot Description',
    passed: descPassed,
    message: descPassed 
      ? `Hợp lệ (${desc.length}/400 ký tự)` 
      : `Không hợp lệ: Yêu cầu từ 10 đến 400 ký tự (Hiện tại: ${desc.length})`
  });
  if (descPassed) score++;

  // 2. Kiểm tra Link Support Server (Community Discord URL)
  const supportUrl = metadata?.SUPPORT_SERVER_URL || '';
  const supportPassed = typeof supportUrl === 'string' && /^(https?:\/\/)?(www\.)?(discord\.(gg|com\/invite)|dsc\.gg)\/[a-zA-Z0-9_\-\+]+$/i.test(supportUrl);
  checks.push({
    name: 'Support Server Link',
    passed: supportPassed,
    message: supportPassed 
      ? `Hợp lệ (${supportUrl})` 
      : `Không hợp lệ: Cần là URL Discord Invite hợp lệ (discord.gg/...)`
  });
  if (supportPassed) score++;

  // 3. Kiểm tra Link Terms of Service (HTTPS URL)
  const tosUrl = metadata?.TERMS_OF_SERVICE_URL || '';
  const tosPassed = typeof tosUrl === 'string' && /^https:\/\/[^\s$.?#].[^\s]*$/i.test(tosUrl);
  checks.push({
    name: 'Terms of Service URL',
    passed: tosPassed,
    message: tosPassed 
      ? `Hợp lệ (${tosUrl})` 
      : `Không hợp lệ: Yêu cầu URL HTTPS công khai`
  });
  if (tosPassed) score++;

  // 4. Kiểm tra Link Privacy Policy (HTTPS URL)
  const privacyUrl = metadata?.PRIVACY_POLICY_URL || '';
  const privacyPassed = typeof privacyUrl === 'string' && /^https:\/\/[^\s$.?#].[^\s]*$/i.test(privacyUrl);
  checks.push({
    name: 'Privacy Policy URL',
    passed: privacyPassed,
    message: privacyPassed 
      ? `Hợp lệ (${privacyUrl})` 
      : `Không hợp lệ: Yêu cầu URL HTTPS công khai`
  });
  if (privacyPassed) score++;

  // 5. Kiểm tra Tags danh mục (1 - 5 tags, mỗi tag 2 - 20 ký tự)
  const tags = metadata?.TAGS || [];
  const tagsPassed = Array.isArray(tags) && tags.length >= 1 && tags.length <= 5 && tags.every(t => typeof t === 'string' && t.length >= 2 && t.length <= 20);
  checks.push({
    name: 'Discovery Tags',
    passed: tagsPassed,
    message: tagsPassed 
      ? `Hợp lệ (${tags.length}/5 tags: ${tags.join(', ')})` 
      : `Không hợp lệ: Yêu cầu 1-5 tags, mỗi tag 2-20 ký tự`
  });
  if (tagsPassed) score++;

  return {
    ready: score === maxScore,
    score,
    maxScore,
    checks
  };
}

/**
 * Tạo link mời OAuth2 Discord Bot với Permissions Bitfield và Installation Context chuẩn
 * @param {Object} [options] - Tùy chọn cấu hình OAuth2
 * @param {string} [options.clientId] - Client ID của Bot
 * @param {Array<bigint|string|number>|bigint|number} [options.permissions] - Quyền hạn cần yêu cầu
 * @param {Array<string>} [options.scopes] - Danh sách OAuth2 Scopes
 * @param {number} [options.integrationType] - 0: GUILD_INSTALL, 1: USER_INSTALL
 * @param {string} [options.redirectUri] - Redirect URI tùy chọn
 * @param {string} [options.state] - State CSRF tùy chọn
 * @returns {string} URL mời Bot OAuth2 hoàn chỉnh
 */
function generateOAuth2Invite(options = {}) {
  const cid = options.clientId || process.env.CLIENT_ID || process.env.DISCORD_CLIENT_ID || (client?.user?.id) || '1214041776483471391';
  const perms = options.permissions !== undefined ? options.permissions : REQUIRED_BOT_PERMISSIONS;
  const bitfield = calculatePermissionsBitfield(perms).bitfieldString;
  const scopes = Array.isArray(options.scopes) && options.scopes.length > 0 
    ? options.scopes 
    : ['bot', 'applications.commands'];
  
  const url = new URL('https://discord.com/oauth2/authorize');
  url.searchParams.set('client_id', cid);
  url.searchParams.set('permissions', bitfield);
  url.searchParams.set('scope', scopes.join(' '));
  
  if (options.integrationType !== undefined && (options.integrationType === 0 || options.integrationType === 1)) {
    url.searchParams.set('integration_type', String(options.integrationType));
  }
  if (options.redirectUri) {
    url.searchParams.set('redirect_uri', options.redirectUri);
    url.searchParams.set('response_type', 'code');
  }
  if (options.state) {
    url.searchParams.set('state', options.state);
  }

  return url.toString();
}

// =========================================================================
// 0.1 CẤU TRÚC DỮ LIỆU EXPIRING LOCK MAP (AUTO-TTL & CONCURRENCY GUARD)
// =========================================================================
/**
 * Cấu trúc Map tự động hết hạn (TTL) và tương thích ngược với Set (.add, .has, .delete)
 * Chống rò rỉ bộ nhớ, chống deadlock và bảo vệ tài nguyên trên Discloud 100MB RAM
 */
class ExpiringLockMap extends Map {
  constructor(ttlMs = 30000, maxSize = 1000) {
    super();
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;
  }
  add(key) {
    if (this.size >= this.maxSize) {
      this.pruneExpired();
      if (this.size >= this.maxSize) {
        const oldest = this.keys().next().value;
        if (oldest !== undefined) this.delete(oldest);
      }
    }
    this.set(key, Date.now());
    return this;
  }
  has(key) {
    if (!super.has(key)) return false;
    const time = super.get(key);
    if (typeof time === 'number' && Date.now() - time > this.ttlMs) {
      super.delete(key);
      return false;
    }
    return true;
  }
  get(key) {
    if (!super.has(key)) return undefined;
    const time = super.get(key);
    if (typeof time === 'number' && Date.now() - time > this.ttlMs) {
      super.delete(key);
      return undefined;
    }
    return time;
  }
  pruneExpired(now = Date.now()) {
    for (const [k, time] of super.entries()) {
      if (typeof time === 'number' && now - time > this.ttlMs) {
        super.delete(k);
      }
    }
  }
}

// Giới hạn dung lượng bộ nhớ RAM Discloud (100MB RAM Optimization)
const MAX_ACTIVE_ORDERS = 10000;
const MAX_APPROVED_ORDERS = 1000;

// Pool theo dõi mã đơn hàng trong RAM chống trùng lặp (Collision Guard) & chống duyệt trùng (Idempotency)
const activeOrderCodes = new Map(); // orderCode -> { createdAt: number, pkgKey?: string, buyerId?: string, guildId?: string }
const processingApprovals = new ExpiringLockMap(60000, 200); // orderCode đang trong tiến trình duyệt (TTL 60s)
const approvedOrderCodes = new Set(); // orderCode đã duyệt thành công

// Regex chuẩn nhận diện & bóc tách mã đơn hàng (hỗ trợ LS123456, LS-123456, LS 123456, MB_LS123456, DON_HANG_LS123456)
// Sử dụng lookaround boundaries thay vì \b để không bị nuốt bởi dấu gạch dưới (_) trong tên hệ thống / webhook
const ORDER_CODE_REGEX = /(?<![a-zA-Z0-9])(LS[\s\-_]?[0-9A-Z]{6})(?![a-zA-Z0-9])/i;

// Sinh mã đơn hàng ngẫu nhiên chuẩn e-commerce, cryptographically secure (crypto.randomBytes), triệt tiêu modulo bias và chống trùng lặp tuyệt đối
function generateUniqueOrderCode() {
  let code = '';
  let attempts = 0;
  const isColliding = (c) => activeOrderCodes.has(c) || approvedOrderCodes.has(c) || processingApprovals.has(c);

  // 1. Thử sinh mã 6 chữ số (100000 -> 999999) bằng crypto.randomBytes với kỹ thuật Rejection Sampling (Zero Modulo Bias)
  const range = 900000;
  const maxValid = 0xFFFFFFFF - (0xFFFFFFFF % range); // 4,294,500,000

  do {
    let rand;
    do {
      rand = crypto.randomBytes(4).readUInt32BE(0);
    } while (rand >= maxValid);

    const num = 100000 + (rand % range);
    code = `LS${num}`;
    attempts++;
  } while (isColliding(code) && attempts < 50);

  // 2. Nếu sau 50 lần phát hiện trùng (xác suất < 1/10^30), fallback sang mã 6 ký tự Hex có entropy cao và lặp đảm bảo ZERO COLLISION tuyệt đối
  while (isColliding(code)) {
    const highEntropyHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    code = `LS${highEntropyHex}`;
  }

  // Quản lý bộ nhớ: Giới hạn dung lượng activeOrderCodes (FIFO eviction)
  if (activeOrderCodes.size >= MAX_ACTIVE_ORDERS) {
    const oldestKey = activeOrderCodes.keys().next().value;
    if (oldestKey !== undefined) activeOrderCodes.delete(oldestKey);
  }

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
  if (text === null || text === undefined || typeof text === 'boolean' || typeof text === 'symbol') return null;
  const str = typeof text === 'string' ? text : String(text);
  const input = str.length > 10000 ? str.slice(0, 10000) : str;
  const match = input.match(ORDER_CODE_REGEX);
  return match ? sanitizeOrderCode(match[1]) : null;
}

// Kiểm tra mã đơn có đúng cấu trúc LS + 6 ký tự số/chữ hay không
function isValidOrderCode(code) {
  if (code === null || code === undefined || typeof code === 'boolean' || typeof code === 'symbol') return false;
  const str = typeof code === 'string' ? code : String(code);
  if (str.length > 50) return false;
  const cleaned = str
    .replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u2066-\u2069\x00-\x1F\x7F-\x9F]/g, '')
    .trim()
    .replace(/[\s\-_]/g, '')
    .toUpperCase();
  return /^LS[0-9A-Z]{6}$/.test(cleaned);
}

/**
 * Kiểm tra xem mức giá có phải là dạng báo giá thỏa thuận (0 VNĐ / Custom Dev / Mod / Non-numeric) hay không
 * @param {number|string|bigint|null|undefined} amount 
 * @returns {boolean}
 */
function isNegotiatedPrice(amount) {
  if (amount === null || amount === undefined || typeof amount === 'boolean' || typeof amount === 'symbol') return true;
  if (typeof amount === 'object') return true;
  let num;
  if (typeof amount === 'number') {
    num = amount;
  } else if (typeof amount === 'bigint') {
    return amount <= 0n;
  } else if (typeof amount === 'string') {
    const raw = amount.trim();
    if (!raw) return true;
    let cleaned = raw.replace(/[₫đĐ\$\s_]|vnd|vnđ|usd/gi, '');
    if (!cleaned) return true;
    if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
      cleaned = cleaned.replace(/\./g, '');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
    num = Number(cleaned);
  } else {
    return true;
  }
  return !Number.isFinite(num) || num <= 0;
}

/**
 * Chuẩn hóa chuỗi text dùng cho nội dung chuyển khoản VietQR / Banking Memo theo chuẩn NAPAS 247 / VietQR
 * - Chuẩn hóa Unicode NFKC và loại bỏ dấu tiếng Việt (Unicode NFD)
 * - Chuyển đổi các ký tự đặc biệt đ/Đ -> D, ø/Ø -> O, æ/Æ -> AE, ß -> SS, ł/Ł -> L
 * - Loại bỏ ký tự điều khiển, BiDi overrides, zero-width chars, emoji, dấu câu
 * - Chỉ giữ lại chữ cái A-Z, số 0-9 và khoảng trắng đơn
 * - Chuyển toàn bộ sang chữ in hoa
 * - Cắt ngắn tối đa maxLength (giới hạn cứng không quá 50 ký tự theo chuẩn Napas Tag 62 Subtag 08)
 * - Trim loại bỏ triệt để trailing whitespace sau khi cắt lát
 * @param {string|number|bigint} text - Chuỗi văn bản cần chuẩn hóa
 * @param {number} maxLength - Độ dài tối đa (Mặc định 50 ký tự, giới hạn tối đa 50)
 * @returns {string}
 */
function sanitizeVietQRText(text, maxLength = 50) {
  if (text === null || text === undefined || typeof text === 'boolean' || typeof text === 'symbol') return '';
  if (typeof text !== 'string' && typeof text !== 'number' && typeof text !== 'bigint') return '';
  const rawStr = String(text);
  const str = rawStr.length > 500 ? rawStr.slice(0, 500) : rawStr;
  if (!str.trim()) return '';
  
  const parsedMax = typeof maxLength === 'number' && Number.isFinite(maxLength) && maxLength > 0 ? Math.floor(maxLength) : 50;
  const safeMaxLen = Math.min(Math.max(1, parsedMax), 50);

  return str
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u2066-\u2069\x00-\x1F\x7F-\x9F]/g, '')
    .replace(/[đĐðÐ]/g, 'D')
    .replace(/[łŁ]/g, 'L')
    .replace(/[øØ]/g, 'O')
    .replace(/[æÆ]/g, 'AE')
    .replace(/ß/g, 'SS')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Bỏ dấu tiếng Việt
    .replace(/[^a-zA-Z0-9 ]/g, ' ')   // Ký tự đặc biệt & emoji -> khoảng trắng
    .replace(/\s+/g, ' ')            // Gộp khoảng trắng liên tiếp
    .trim()
    .toUpperCase()
    .slice(0, safeMaxLen)
    .trim();
}

/**
 * Chuẩn hóa và làm sạch tên khách hàng / tên hiển thị Discord
 * Chống Discord markdown breakout, mass mention (@everyone/@here/<@&), zero-width chars, BiDi overrides
 * @param {string} name 
 * @param {number} maxLength 
 * @param {string} fallback 
 * @returns {string}
 */
function sanitizeCustomerName(name, maxLength = 32, fallback = 'Khách Hàng') {
  if (name === null || name === undefined) return fallback;
  const rawStr = typeof name === 'string' ? name : String(name);
  const str = rawStr.length > 500 ? rawStr.slice(0, 500) : rawStr;
  const cleaned = str
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u2066-\u2069\x00-\x1F\x7F-\x9F]/g, '')
    .replace(/@everyone/gi, '@ everyone')
    .replace(/@here/gi, '@ here')
    .replace(/<@[!&]?\d+>/g, '')
    .replace(/<#\d+>/g, '')
    .replace(/[`*~_|>\\#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const maxLen = typeof maxLength === 'number' && maxLength > 0 ? maxLength : 32;
  return cleaned ? cleaned.slice(0, maxLen) : fallback;
}

/**
 * Chuẩn hóa mã đơn hàng, loại bỏ ký tự lạ, khoảng trắng, gạch nối, BiDi overrides
 * @param {string|number} rawCode 
 * @returns {string|null}
 */
function sanitizeOrderCode(rawCode) {
  if (rawCode === null || rawCode === undefined || typeof rawCode === 'boolean' || typeof rawCode === 'symbol') return null;
  const rawStr = typeof rawCode === 'string' ? rawCode : String(rawCode);
  const str = rawStr.length > 50 ? rawStr.slice(0, 50) : rawStr;
  const cleaned = str
    .replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u2066-\u2069\x00-\x1F\x7F-\x9F]/g, '')
    .trim()
    .replace(/[\s\-_]/g, '')
    .toUpperCase();
  return isValidOrderCode(cleaned) ? cleaned : null;
}

/**
 * Chuẩn hóa và làm sạch chuỗi văn bản inline từ modal input:
 * - Thay thế backtick bằng dấu nháy đơn
 * - Thay thế newline bằng khoảng trắng
 * - Tránh mention injection (@everyone / @here)
 * - Cắt ngắn theo maxLength và áp dụng fallback nếu rỗng
 */
function sanitizeModalInlineText(text, maxLength = 100, fallback = '') {
  if (text === null || text === undefined) return fallback;
  const rawStr = typeof text === 'string' ? text : String(text);
  let str = rawStr.length > 2000 ? rawStr.slice(0, 2000) : rawStr;
  if (!str.trim()) return fallback;
  str = str.replace(/`/g, "'");
  str = str.replace(/\r?\n|\r/g, ' ');
  str = str.replace(/@(everyone|here|[!&]?[0-9]{15,20})/gi, '@ $1');
  str = str.replace(/\s+/g, ' ').trim();
  if (maxLength && str.length > maxLength) {
    str = str.slice(0, maxLength).trim();
  }
  return str || fallback;
}

/**
 * Chuẩn hóa và làm sạch chuỗi code block từ modal input:
 * - Thoát chuỗi 3 dấu backticks thành 3 dấu nháy đơn để tránh phá vỡ cú pháp code block
 * - Tránh mention injection
 * - Cắt ngắn theo maxLength và áp dụng fallback nếu rỗng
 */
function sanitizeModalCodeBlockText(text, maxLength = 1024, fallback = '') {
  if (text === null || text === undefined) return fallback;
  const rawStr = typeof text === 'string' ? text : String(text);
  let str = rawStr.length > 10000 ? rawStr.slice(0, 10000) : rawStr;
  if (!str.trim()) return fallback;
  str = str.replace(/```/g, "'''");
  str = str.replace(/@(everyone|here)/gi, '@ $1');
  if (maxLength && str.length > maxLength) {
    str = str.slice(0, maxLength);
  }
  return str || fallback;
}

/**
 * Chuẩn hóa và làm sạch mô tả kênh (Channel Topic) của Discord (Tối đa 1024 ký tự)
 */
function sanitizeDiscordChannelTopic(text, maxLength = 1024) {
  if (text === null || text === undefined) return '';
  const rawStr = typeof text === 'string' ? text : String(text);
  let str = rawStr.length > 4000 ? rawStr.slice(0, 4000) : rawStr;
  str = str.replace(/```/g, "'''").trim();
  if (str.length > maxLength) {
    str = str.slice(0, maxLength);
  }
  return str;
}

/**
 * Loại bỏ các ký tự điều khiển nguy hiểm (ANSI escapes, BiDi overrides, carriage return injection, zero-width, non-printable control chars)
 * khỏi nội dung transcript để chống terminal injection, log spoofing & visual tampering.
 * @param {string} text - Văn bản cần làm sạch
 * @returns {string} Văn bản an toàn
 */
function sanitizeTranscriptControlChars(text) {
  if (text === null || text === undefined) return '';
  const rawStr = typeof text === 'string' ? text : String(text);
  const str = rawStr.length > 50000 ? rawStr.slice(0, 50000) : rawStr;
  return str
    // 1. Chuẩn hóa ký tự xuống dòng (\r\n, \r, \u2028, \u2029, \u0085 NEL) thành \n chuẩn
    // Chống Carriage Return Injection (\r) ghi đè dòng trước trên terminal/cat logs
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u2028\u2029\u0085]/g, '\n')
    // 2. Loại bỏ mã màu và chuỗi thoát lệnh ANSI (CSI, OSC, DCS, ST sequences) chống terminal injection
    .replace(/\x1B(?:\][^\x07\x1B]*?(?:\x07|\x1B\\|$)|\[[0-?]*[ -/]*[@-~]|[P^_][^\x1B]*?(?:\x1B\\|$)|[@-Z\\-_])/g, '')
    // 3. Loại bỏ ký tự Unicode BiDi Override & directional marks (chống Trojan Source / visual spoofing / RTL overrides)
    .replace(/[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069\u202F\u08E2]/g, '')
    // 4. Loại bỏ ký tự tàng hình / zero-width space / BOM / Annotation Controls / Soft Hyphen
    .replace(/[\u180E\u200B-\u200D\u2060\uFEFF\uFFF9-\uFFFB\u00AD]/g, '')
    // 5. Loại bỏ Unicode Tag Characters & Variation Selector exploits (chống ẩn mã/spoofing)
    .replace(/[\uFE00-\uFE0F]/g, '')
    .replace(/[\uDB40][\uDC00-\uDDEF]/g, '')
    // 6. Loại bỏ ký tự điều khiển không in được (giữ lại \t 0x09 và \n 0x0A)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
}

/**
 * Làm sạch và chuẩn hóa tiêu đề/trường 1 dòng trong Transcript (loại bỏ newlines chống CRLF injection)
 * @param {string} text - Văn bản trường
 * @param {number} maxLen - Giới hạn độ dài
 * @returns {string} Văn bản 1 dòng an toàn
 */
function sanitizeSingleLineHeader(text, maxLen = 300) {
  if (text === null || text === undefined) return 'N/A';
  let str = sanitizeTranscriptControlChars(text);
  str = str.replace(/[\r\n\u2028\u2029\u0085]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (maxLen && str.length > maxLen) {
    str = str.slice(0, maxLen).trim();
  }
  return str || 'N/A';
}

/**
 * Làm sạch liên kết URL trong Transcript chống CRLF injection và khoảng trắng/ký tự điều khiển
 * @param {string} url - Chuỗi URL
 * @param {number} maxLen - Giới hạn độ dài
 * @returns {string} URL an toàn
 */
function sanitizeUrlForTranscript(url, maxLen = 1000) {
  if (!url || typeof url !== 'string') return '';
  let str = sanitizeTranscriptControlChars(url)
    .replace(/[\r\n\s\x00-\x1F\x7F-\x9F]+/g, '')
    .trim();
  if (maxLen && str.length > maxLen) {
    str = str.slice(0, maxLen);
  }
  return str;
}

/**
 * Làm sạch văn bản khi đưa vào Discord Embed (chống phá vỡ codeblock, mass mention @everyone/@here/<@&)
 * @param {string} text - Văn bản người dùng nhập
 * @param {number} maxLen - Giới hạn độ dài (mặc định 1000 ký tự cho embed field)
 * @returns {string} Văn bản an toàn cho Discord Embed
 */
function sanitizeMarkdownForEmbed(text, maxLen = 1000) {
  if (text === null || text === undefined) return '';
  let str = sanitizeTranscriptControlChars(text);
  str = str
    // Thoát backtick chống phá vỡ cú pháp code block / inline code
    .replace(/`/g, "'")
    // Vô hiệu hóa mention injection (@everyone, @here, role pings, user pings)
    .replace(/@(everyone|here)/gi, '@\u200b$1')
    .replace(/<@&(\d+)>/g, '<@\u200b&$1>')
    .replace(/<@!?(\d+)>/g, '<@\u200b$1>')
    .trim();
  if (maxLen && str.length > maxLen) {
    str = str.slice(0, maxLen).trim();
  }
  return str;
}

/**
 * Che dấu (mask/redact) các dữ liệu nhạy cảm như Bot Token, Webhook Secret, Passwords, API Keys,
 * DB connection strings, Credit Cards, Banking OTPs khỏi Transcript để bảo vệ quyền riêng tư.
 * @param {string} text - Nội dung tin nhắn
 * @returns {string} Nội dung đã được lọc thông tin nhạy cảm
 */
function redactSensitiveData(text) {
  if (!text || typeof text !== 'string') return text || '';
  const input = text.length > 50000 ? text.slice(0, 50000) : text;
  return input
    // 1. Discord Bot Token & MFA tokens (Hỗ trợ token modern với HMAC 27-45 ký tự base64url)
    .replace(/\b(?:[a-zA-Z0-9_-]{24,32}\.[a-zA-Z0-9_-]{6,8}\.[a-zA-Z0-9_-]{27,45}|mfa\.[a-zA-Z0-9_-]{60,100})\b/g, '***[REDACTED_DISCORD_TOKEN]***')
    // 2. Discord Webhook URL with secret token: https://discord.com/api/webhooks/12345/abcdef...
    .replace(/(https?:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/)[A-Za-z0-9_-]+/gi, '$1***[REDACTED_WEBHOOK_TOKEN]***')
    // 3. AI API Keys (OpenAI sk-proj/sk-admin/sk-svcacct/sk-, Claude/Anthropic sk-ant-, Gemini AIza, Groq gsk_, HuggingFace hf_, Perplexity pplx-)
    .replace(/\b(?:sk-(?:proj-|admin-|svcacct-)[a-zA-Z0-9_-]{32,160}|sk-[a-zA-Z0-9]{20,64})\b/g, '***[REDACTED_API_KEY]***')
    .replace(/\bsk-ant-(?:api\d\d-|sid\d\d-)?[a-zA-Z0-9_-]{20,120}\b/g, '***[REDACTED_API_KEY]***')
    .replace(/\b(AIza[0-9A-Za-z_-]{35})\b/g, '***[REDACTED_API_KEY]***')
    .replace(/\b(gsk_[a-zA-Z0-9_-]{40,70})\b/g, '***[REDACTED_API_KEY]***')
    .replace(/\b(hf_[a-zA-Z0-9]{34,40})\b/g, '***[REDACTED_API_KEY]***')
    .replace(/\b(pplx-[a-zA-Z0-9]{40,})\b/g, '***[REDACTED_API_KEY]***')
    // 4. GitHub Tokens (ghp_, gho_, ghu_, ghs_, ghr_, ghb_, ghe_, github_pat_)
    .replace(/\b(?:ghp|gho|ghu|ghs|ghr|ghb|ghe)_[a-zA-Z0-9]{30,60}\b/g, '***[REDACTED_GITHUB_TOKEN]***')
    .replace(/\bgithub_pat_[a-zA-Z0-9_]{30,100}\b/g, '***[REDACTED_GITHUB_TOKEN]***')
    // 5. Cloud, AWS & Payment Keys
    .replace(/\b(?:AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16}\b/g, '***[REDACTED_AWS_KEY]***')
    .replace(/(?<=\b(?:aws_secret_access_key|aws_secret_key|secret_access_key|secret_key|aws_key)\s*[:=]\s*)[A-Za-z0-9\/+=]{40}\b/gi, '***[REDACTED_AWS_KEY]***')
    .replace(/(?<=\b(?:aws_session_token|session_token)\s*[:=]\s*)[A-Za-z0-9\/+=]{100,}\b/gi, '***[REDACTED_AWS_KEY]***')
    .replace(/\b(?:sk_live|rk_live|pk_live|sk_test|pk_test)_[0-9a-zA-Z]{24,34}\b/g, '***[REDACTED_STRIPE_KEY]***')
    // 6. Database Connection Strings (PostgreSQL, MySQL, MongoDB, Redis passwords)
    .replace(/\b((?:postgres(?:ql)?|mongodb(?:\+srv)?|mysql|redis(?:s)?):\/\/[^\s:@]+:)[^\s@]+(@[^\s\/]+)/gi, '$1***[REDACTED_DB_PASSWORD]***$2')
    // 7. URL Credentials (http://user:pass@host)
    .replace(/(https?:\/\/[^\s:@/]+:)[^\s@/]+(@[^\s\/]+)/gi, '$1***[REDACTED_URL_PASSWORD]***$2')
    // 8. Generic Bearer & Authorization Tokens
    .replace(/(?<=\b(?:bearer|authorization\s*:\s*bearer)\s+)[a-zA-Z0-9_.\-~+/]{20,}/gi, '***[REDACTED_TOKEN]***')
    // 9. Private RSA / OpenSSH / PGP / EC Keys
    .replace(/-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/gi, '[REDACTED_PRIVATE_KEY]')
    // 10. Credit / Debit & Napas Bank Cards (Visa, Mastercard, Napas 9704, Amex, Discover 13-19 digits)
    .replace(/\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|2[2-7][0-9]{14}|9704[0-9]{12,15}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12}|(?:[0-9]{4}[ -]){3}[0-9]{4}|3[47][0-9]{2}[ -][0-9]{6}[ -][0-9]{5})\b/g, '[REDACTED_CARD_NUMBER]')
    // 11. CVV / CVC Security Codes
    .replace(/(?<=\b(?:cvv|cvc|cvv2|cvc2)\s*[:=]\s*)\d{3,4}\b/gi, '[REDACTED_CVV]')
    // 12. Banking OTP & Verification Codes
    .replace(/(?<=\b(?:otp|mã\s*otp|mã\s*xác\s*thực|mã\s*xác\s*minh)\s*[:=]?\s*)\d{4,8}\b/gi, '[REDACTED_OTP]')
    // 13. Bank Account Numbers (STK ngân hàng Việt Nam)
    .replace(/(?<=\b(?:stk|số\s*tài\s*khoản|so\s*tai\s*khoan|bank\s*account)\s*[:=]?\s*)\d{6,18}\b/gi, '[REDACTED_BANK_ACCOUNT]')
    // 14. Passwords & Sensitive Fields (Tiếng Việt & English)
    .replace(/(?<=\b(?:password|passwd|pass|matkhau|mật\s*khẩu|mk|api[_-]?secret|client[_-]?secret|db_pass|database_password|app_password)\s*(?:[:=]|là\s*[:=]?)\s*)(['"]?)([^'"\s\n]+)\1/gi, '[REDACTED_SECRET]');
}

// Định dạng tiền tệ VND chuẩn Việt Nam (Làm tròn số nguyên, phân tách hàng nghìn dấu chấm, chống -0 VNĐ, NaN, Huge Integers & Non-numeric)
function formatVND(amount) {
  if (amount === null || amount === undefined || typeof amount === 'boolean' || typeof amount === 'symbol') return '0 VNĐ';
  if (typeof amount === 'object' && !Array.isArray(amount) && !(amount instanceof Number)) return '0 VNĐ';
  if (Array.isArray(amount) || typeof amount === 'function') return '0 VNĐ';

  // 1. Xử lý BigInt trực tiếp để bảo toàn 100% độ chính xác tuyệt đối cho số nguyên cực lớn
  if (typeof amount === 'bigint') {
    if (amount === 0n) return '0 VNĐ';
    const isNegative = amount < 0n;
    const absVal = isNegative ? -amount : amount;
    const formatted = new Intl.NumberFormat('vi-VN').format(absVal);
    return isNegative ? `-${formatted} VNĐ` : `${formatted} VNĐ`;
  }

  // 2. Xử lý chuỗi (String input)
  if (typeof amount === 'string') {
    const raw = amount.trim();
    if (!raw) return '0 VNĐ';
    let cleaned = raw.replace(/[₫đĐ\s_]|vnd|vnđ/gi, '');
    if (!cleaned) return '0 VNĐ';

    // Nhận diện dấu phân cách hàng nghìn kiểu Việt Nam: 30.000 hoặc 1.000.000
    if (/^-?\d{1,3}(\.\d{3})+$/.test(cleaned)) {
      cleaned = cleaned.replace(/\./g, '');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }

    // Nếu là chuỗi số nguyên thuần túy (có thể kèm dấu âm)
    if (/^-?\d+$/.test(cleaned)) {
      try {
        const big = BigInt(cleaned);
        if (big === 0n) return '0 VNĐ';
        const isNegative = big < 0n;
        const absVal = isNegative ? -big : big;
        const formatted = new Intl.NumberFormat('vi-VN').format(absVal);
        return isNegative ? `-${formatted} VNĐ` : `${formatted} VNĐ`;
      } catch {
        // Fallback sang Number nếu BigInt lỗi cú pháp
      }
    }

    const num = Number(cleaned);
    if (!Number.isFinite(num)) return '0 VNĐ';
    const rounded = Math.round(num);
    if (rounded === 0 || Object.is(rounded, -0)) return '0 VNĐ';
    const absVal = Math.abs(rounded);
    const formatted = new Intl.NumberFormat('vi-VN').format(absVal);
    return rounded < 0 ? `-${formatted} VNĐ` : `${formatted} VNĐ`;
  }

  // 3. Xử lý kiểu số (Number input)
  if (typeof amount === 'number') {
    if (!Number.isFinite(amount)) return '0 VNĐ';
    if (amount === 0 || Object.is(amount, -0)) return '0 VNĐ';

    const rounded = Math.round(amount);
    if (rounded === 0 || Object.is(rounded, -0)) return '0 VNĐ';

    // Nếu vượt quá giới hạn an toàn Number.MAX_SAFE_INTEGER, chuyển sang BigInt
    if (Math.abs(rounded) > Number.MAX_SAFE_INTEGER) {
      try {
        const big = BigInt(Math.trunc(amount));
        const isNegative = big < 0n;
        const absVal = isNegative ? -big : big;
        const formatted = new Intl.NumberFormat('vi-VN').format(absVal);
        return isNegative ? `-${formatted} VNĐ` : `${formatted} VNĐ`;
      } catch {}
    }

    const absVal = Math.abs(rounded);
    const formatted = new Intl.NumberFormat('vi-VN').format(absVal);
    return rounded < 0 ? `-${formatted} VNĐ` : `${formatted} VNĐ`;
  }

  return '0 VNĐ';
}

// Định dạng tiền tệ USD chuẩn quốc tế (2 chữ số thập phân, phân tách hàng nghìn en-US, chống -$0.00 USD, NaN, Huge Numbers & Non-numeric)
function formatUSD(amount) {
  if (amount === null || amount === undefined || typeof amount === 'boolean' || typeof amount === 'symbol') return '$0.00 USD';
  if (typeof amount === 'object' && !Array.isArray(amount) && !(amount instanceof Number)) return '$0.00 USD';
  if (Array.isArray(amount) || typeof amount === 'function') return '$0.00 USD';

  // 1. Xử lý BigInt trực tiếp với định dạng 2 chữ số thập phân (.00)
  if (typeof amount === 'bigint') {
    if (amount === 0n) return '$0.00 USD';
    const isNegative = amount < 0n;
    const absVal = isNegative ? -amount : amount;
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(absVal);
    return isNegative ? `-$${formatted} USD` : `$${formatted} USD`;
  }

  // 2. Xử lý chuỗi (String input)
  if (typeof amount === 'string') {
    const raw = amount.trim();
    if (!raw) return '$0.00 USD';
    let cleaned = raw.replace(/[\$\s_]|usd/gi, '');
    if (!cleaned) return '$0.00 USD';

    // Nếu là chuỗi số nguyên thuần túy (không có phần thập phân)
    if (/^-?\d+$/.test(cleaned)) {
      try {
        const big = BigInt(cleaned);
        if (big === 0n) return '$0.00 USD';
        const isNegative = big < 0n;
        const absVal = isNegative ? -big : big;
        const formatted = new Intl.NumberFormat('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(absVal);
        return isNegative ? `-$${formatted} USD` : `$${formatted} USD`;
      } catch {}
    }

    // Bỏ dấu phẩy phân cách hàng nghìn kiểu US
    cleaned = cleaned.replace(/,/g, '');
    const num = Number(cleaned);
    if (!Number.isFinite(num)) return '$0.00 USD';

    const absVal = Math.abs(num);
    // Nếu giá trị làm tròn ở 2 chữ số thập phân bằng 0 (ví dụ -0.001 hoặc 0.004)
    if (Math.round(absVal * 100) === 0 || Object.is(num, -0)) {
      return '$0.00 USD';
    }

    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(absVal);

    return num < 0 ? `-$${formatted} USD` : `$${formatted} USD`;
  }

  // 3. Xử lý kiểu số (Number input)
  if (typeof amount === 'number') {
    if (!Number.isFinite(amount)) return '$0.00 USD';
    if (amount === 0 || Object.is(amount, -0)) return '$0.00 USD';

    const absVal = Math.abs(amount);
    if (Math.round(absVal * 100) === 0) {
      return '$0.00 USD';
    }

    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(absVal);

    return amount < 0 ? `-$${formatted} USD` : `$${formatted} USD`;
  }

  return '$0.00 USD';
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

// Cache lưu trữ Buffer ảnh VietQR trong RAM để tái sử dụng, giảm thiểu request HTTP và tăng tốc độ phản hồi
const vietQRBufferCache = new Map(); // qrUrl -> { buffer: Buffer, cachedAt: number, size: number }
const VIETQR_CACHE_TTL = 10 * 60 * 1000; // 10 phút TTL
const VIETQR_CACHE_MAX_SIZE = 100; // Tối đa 100 ảnh QR trong bộ nhớ RAM
const VIETQR_CACHE_MAX_BYTES = 15 * 1024 * 1024; // Giới hạn 15MB RAM cho cache QR (Discloud 100MB Watchdog)

// Deduplication map cho các request HTTP đang xử lý dở (In-flight request coalescing)
const pendingVietQRRequests = new Map(); // qrUrl -> Promise<Buffer|null>

// Negative cache per-URL (chống spam request liên tục vào cùng một URL lỗi)
const failedVietQRUrls = new Map(); // qrUrl -> { failedAt: number, reason: string }
const VIETQR_FAILURE_TTL = 30 * 1000; // 30 giây cooldown nếu URL hỏng
const VIETQR_FAILED_MAX_SIZE = 100; // Tối đa 100 URL lỗi trong RAM chống tràn bộ nhớ

// =========================================================================
// VIETQR GATEWAY CIRCUIT BREAKER (BẢO VỆ CỔNG THANH TOÁN KHI BẢO TRÌ/OFFLINE)
// =========================================================================
const vietQRCircuitBreaker = {
  state: 'CLOSED', // 'CLOSED' (hoạt động bình thường), 'OPEN' (ngắt mạch / bảo trì), 'HALF_OPEN' (thử nghiệm canary)
  consecutiveFailures: 0,
  failureThreshold: 3, // 3 lỗi liên tiếp từ gateway sẽ kích hoạt ngắt mạch fail-fast
  cooldownMs: 30000, // 30s thử lại (cooldown window)
  lastFailureTime: 0,
  lastStateChange: Date.now(),
  lastErrorReason: '',

  canRequest() {
    if (this.state === 'CLOSED') return true;
    const now = Date.now();
    if (this.state === 'OPEN') {
      if (now - this.lastFailureTime >= this.cooldownMs) {
        this.state = 'HALF_OPEN';
        this.lastStateChange = now;
        console.log('🔄 [VietQR Circuit Breaker] Hết thời gian cooldown. Chuyển sang HALF_OPEN để gửi canary probe kiểm tra gateway.');
        return true; // Cho phép 1 request thử nghiệm đi qua
      }
      return false; // Fail-fast ngay lập tức, không gửi request HTTP tốn 5s timeout khi gateway đang bảo trì
    }
    // HALF_OPEN: cho phép canary probe
    return true;
  },

  recordSuccess() {
    if (this.state !== 'CLOSED' || this.consecutiveFailures > 0) {
      console.log(`✅ [VietQR Circuit Breaker] Cổng VietQR đã phục hồi bình thường! (State: ${this.state} -> CLOSED)`);
    }
    this.consecutiveFailures = 0;
    this.state = 'CLOSED';
    this.lastErrorReason = '';
    this.lastStateChange = Date.now();
  },

  recordFailure(reason) {
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();
    this.lastErrorReason = String(reason || 'Unknown gateway error');

    if (this.state === 'HALF_OPEN') {
      // Canary probe thất bại -> Quay lại OPEN và tính lại cooldown
      this.state = 'OPEN';
      this.lastStateChange = Date.now();
      console.warn(`⚠️ [VietQR Circuit Breaker] Canary probe thất bại (${this.lastErrorReason}). Tiếp tục OPEN trong ${this.cooldownMs / 1000}s.`);
    } else if (this.consecutiveFailures >= this.failureThreshold && this.state === 'CLOSED') {
      this.state = 'OPEN';
      this.lastStateChange = Date.now();
      console.warn(`⚠️ [VietQR Circuit Breaker] Phát hiện ${this.consecutiveFailures} lỗi gateway liên tiếp (${this.lastErrorReason}). Kích hoạt OPEN (fail-fast) trong ${this.cooldownMs / 1000}s.`);
    }
  },

  reset() {
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
    this.lastFailureTime = 0;
    this.lastErrorReason = '';
    this.lastStateChange = Date.now();
  }
};

function getVietQRCacheStats() {
  let totalBytes = 0;
  for (const item of vietQRBufferCache.values()) {
    totalBytes += (item.size || item.buffer?.length || 0);
  }
  return {
    size: vietQRBufferCache.size,
    maxSize: VIETQR_CACHE_MAX_SIZE,
    totalBytes,
    maxBytes: VIETQR_CACHE_MAX_BYTES,
    ttlMs: VIETQR_CACHE_TTL,
    pendingRequests: pendingVietQRRequests.size,
    failedUrlsCount: failedVietQRUrls.size,
    circuitBreaker: {
      state: vietQRCircuitBreaker.state,
      consecutiveFailures: vietQRCircuitBreaker.consecutiveFailures,
      cooldownMs: vietQRCircuitBreaker.cooldownMs,
      lastFailureTime: vietQRCircuitBreaker.lastFailureTime,
      lastErrorReason: vietQRCircuitBreaker.lastErrorReason
    }
  };
}

function clearVietQRCache() {
  vietQRBufferCache.clear();
  pendingVietQRRequests.clear();
  failedVietQRUrls.clear();
  vietQRCircuitBreaker.reset();
}

// Aliases cho tên chuẩn
const getVietQRBufferCacheStats = getVietQRCacheStats;
const clearVietQRBufferCache = clearVietQRCache;

// Helper: Lưu negative cache có giới hạn kích thước chống rò rỉ RAM
function recordFailedVietQRUrl(url, reason) {
  if (!url) return;
  if (failedVietQRUrls.size >= VIETQR_FAILED_MAX_SIZE) {
    const oldestKey = failedVietQRUrls.keys().next().value;
    if (oldestKey !== undefined) failedVietQRUrls.delete(oldestKey);
  }
  failedVietQRUrls.set(url, { failedAt: Date.now(), reason: String(reason || 'Unknown error') });
}

// Xây dựng URL VietQR chuẩn RFC 3986 với URLSearchParams, %20 encoding thay vì +, sanitize an toàn
function generateVietQRUrl({ bankId, accountNo, template = 'compact2', amount = null, addInfo = null, accountName = null } = {}) {
  const bankRaw = (bankId || BANK_CONFIG.BANK_ID || 'MB').trim().replace(/[^a-zA-Z0-9]/g, '');
  const cleanBank = encodeURIComponent(bankRaw || 'MB');

  const accRaw = (accountNo || BANK_CONFIG.ACCOUNT_NO || '').trim().replace(/[^a-zA-Z0-9]/g, '');
  const cleanAcc = encodeURIComponent(accRaw || (BANK_CONFIG.ACCOUNT_NO || '').trim().replace(/[^a-zA-Z0-9]/g, ''));

  const templateRaw = (template || 'compact2').trim().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const cleanTemplate = encodeURIComponent(templateRaw || 'compact2');

  const baseUrl = `https://img.vietqr.io/image/${cleanBank}-${cleanAcc}-${cleanTemplate}.png`;
  const params = new URLSearchParams();

  // Chỉ thêm tham số amount nếu số tiền > 0 và hợp lệ (tự động bỏ qua đối với 0 VND / báo giá thỏa thuận / non-numeric)
  if (amount !== null && amount !== undefined && !isNegotiatedPrice(amount)) {
    let parsedAmount = null;
    if (typeof amount === 'number' && Number.isFinite(amount) && amount > 0) {
      parsedAmount = Math.round(amount);
    } else if (typeof amount === 'bigint' && amount > 0n) {
      parsedAmount = amount.toString();
    } else if (typeof amount === 'string') {
      let cleaned = amount.trim().replace(/[₫đĐ\$\s_]|vnd|vnđ|usd/gi, '');
      if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
        cleaned = cleaned.replace(/\./g, '');
      } else {
        cleaned = cleaned.replace(/,/g, '');
      }
      const n = Number(cleaned);
      if (Number.isFinite(n) && n > 0) {
        parsedAmount = Math.round(n);
      }
    }
    if (parsedAmount !== null && Number(parsedAmount) > 0 && Number(parsedAmount) <= 9999999999999) {
      params.append('amount', String(parsedAmount));
    }
  }

  if (addInfo) {
    const sanitizedMemo = sanitizeVietQRText(String(addInfo), 50);
    if (sanitizedMemo) {
      params.append('addInfo', sanitizedMemo);
    }
  }

  const name = sanitizeVietQRText(String(accountName || BANK_CONFIG.ACCOUNT_NAME || ''), 50);
  if (name) {
    params.append('accountName', name);
  }

  // Chuyển dấu '+' thành '%20' theo chuẩn RFC 3986 / VietQR spec để tương thích 100% với VietQR Image Gateway
  const queryStr = params.toString().replace(/\+/g, '%20');
  return queryStr ? `${baseUrl}?${queryStr}` : baseUrl;
}

// Tải ảnh QR buffer trực tiếp qua Axios với cơ chế bắt lỗi an toàn, cache RAM & xác thực định dạng ảnh
async function fetchVietQRBuffer(qrUrl) {
  if (!qrUrl || typeof qrUrl !== 'string' || !qrUrl.startsWith('http')) {
    return null;
  }

  // 1. Kiểm tra Cache RAM trước (kèm LRU position refresh)
  const cached = vietQRBufferCache.get(qrUrl);
  if (cached) {
    if (Date.now() - (cached.cachedAt || 0) < VIETQR_CACHE_TTL && Buffer.isBuffer(cached.buffer)) {
      // LRU refresh: Xóa và gán lại để đưa lên vị trí mới nhất (MRU)
      vietQRBufferCache.delete(qrUrl);
      vietQRBufferCache.set(qrUrl, cached);
      return cached.buffer;
    }
    vietQRBufferCache.delete(qrUrl);
  }

  // 2. Kiểm tra Circuit Breaker toàn cục của Gateway
  if (!vietQRCircuitBreaker.canRequest()) {
    // Fail-fast ngay lập tức, không gửi request HTTP tốn 5s timeout khi gateway đang bảo trì/offline
    return null;
  }

  // 3. Kiểm tra Negative Cache theo từng URL cụ thể
  const failed = failedVietQRUrls.get(qrUrl);
  if (failed) {
    if (Date.now() - (failed.failedAt || 0) < VIETQR_FAILURE_TTL) {
      return null;
    }
    failedVietQRUrls.delete(qrUrl);
  }

  // 4. In-flight Request Deduplication: Chia sẻ cùng Promise nếu request cho qrUrl này đang bay
  if (pendingVietQRRequests.has(qrUrl)) {
    return pendingVietQRRequests.get(qrUrl);
  }

  const fetchPromise = (async () => {
    try {
      const res = await paymentHttpClient.get(qrUrl, { 
        responseType: 'arraybuffer',
        validateStatus: (status) => status === 200
      });

      const contentType = String(res.headers['content-type'] || res.headers['Content-Type'] || '').toLowerCase();
      
      // Kiểm tra content-type bắt buộc phải là image (tránh nhận nhầm HTML/JSON error từ CDN)
      if (contentType && !contentType.startsWith('image/')) {
        console.warn(`⚠️ [VietQR Warning] Phản hồi từ ${qrUrl} không phải ảnh (${contentType}). Chuyển sang fallback URL.`);
        recordFailedVietQRUrl(qrUrl, `Invalid contentType: ${contentType}`);
        vietQRCircuitBreaker.recordFailure(`Invalid contentType: ${contentType}`);
        return null;
      }

      if (!res.data || res.data.length < 500) {
        console.warn(`⚠️ [VietQR Warning] Dữ liệu ảnh quá nhỏ (${res.data?.length || 0} bytes).`);
        recordFailedVietQRUrl(qrUrl, 'Payload too small');
        vietQRCircuitBreaker.recordFailure('Payload too small');
        return null;
      }

      const buffer = Buffer.from(res.data);

      // Kiểm tra Magic Bytes tiêu chuẩn của ảnh (PNG, JPEG, GIF, WebP)
      const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
      const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
      const isGif = buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46;
      const isWebp = buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';

      if (!isPng && !isJpeg && !isGif && !isWebp) {
        console.warn(`⚠️ [VietQR Warning] Định dạng Magic Bytes không phải ảnh từ ${qrUrl}. Có thể là HTML error page trả về status 200.`);
        recordFailedVietQRUrl(qrUrl, 'Invalid magic bytes');
        vietQRCircuitBreaker.recordFailure('Invalid magic bytes');
        return null;
      }

      // Giao dịch HTTP thành công -> Báo thành công cho Circuit Breaker
      vietQRCircuitBreaker.recordSuccess();
      failedVietQRUrls.delete(qrUrl);

      // Lưu vào Cache RAM với LRU Eviction & Memory Byte Guard
      if (vietQRBufferCache.has(qrUrl)) {
        vietQRBufferCache.delete(qrUrl);
      }

      while (vietQRBufferCache.size >= VIETQR_CACHE_MAX_SIZE) {
        const oldestKey = vietQRBufferCache.keys().next().value;
        if (oldestKey !== undefined) vietQRBufferCache.delete(oldestKey);
        else break;
      }

      let currentTotalBytes = buffer.length;
      for (const item of vietQRBufferCache.values()) {
        currentTotalBytes += (item.size || 0);
      }
      while (currentTotalBytes > VIETQR_CACHE_MAX_BYTES && vietQRBufferCache.size > 0) {
        const oldestKey = vietQRBufferCache.keys().next().value;
        if (oldestKey !== undefined) {
          const item = vietQRBufferCache.get(oldestKey);
          currentTotalBytes -= (item?.size || 0);
          vietQRBufferCache.delete(oldestKey);
        } else break;
      }

      vietQRBufferCache.set(qrUrl, {
        buffer,
        cachedAt: Date.now(),
        size: buffer.length
      });

      return buffer;
    } catch (err) {
      console.warn(`⚠️ [VietQR Network Warning] Không thể tải buffer từ ${qrUrl} (${err.message}). Tự động fallback sang Direct URL.`);
      recordFailedVietQRUrl(qrUrl, err.message);
      vietQRCircuitBreaker.recordFailure(err.message);
      return null;
    } finally {
      pendingVietQRRequests.delete(qrUrl);
    }
  })();

  pendingVietQRRequests.set(qrUrl, fetchPromise);
  return fetchPromise;
}



// DANH SÁCH GÓI SẢN PHẨM & DỊCH VỤ (BILINGUAL CONFIG: MINECRAFT + AI SERVICES)
const PACKAGES = {
  // 1. MINECRAFT PLUGINS & MODS
  "ls_anticheat": {
    name_vi: "LS-AntiCheat • WallHit, Inventory A-F, PvP, FakeInfo",
    name_en: "LS-AntiCheat • WallHit, Inv Checks, Combat & Spoof",
    price_vnd: 30000,
    price_usd: 1.5,
    desc_vi: "WallHit xuyên mạng nhện/tường, Inv A-F, AutoEat/Fish/Potion/Shield, Fake Máu",
    desc_en: "Anti-WallHit through cobwebs/walls, Inventory checks, AutoEat/Potion, Health spoof"
  },
  "addon_macro_cart": {
    name_vi: "Addon Anti-Macro Cart • Chống Macro Xe Mỏ & Thuyền (20.000 VNĐ/Tháng)",
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
  },

  // 3. DỊCH VỤ NITRO & TÀI KHOẢN GIẢI TRÍ
  "boost_nitro_2x": {
    name_vi: "Gói 2 Boost Server Discord Nitro (1 Tháng)",
    name_en: "Discord Server 2 Boosts Package (1 Month)",
    price_vnd: 20000,
    price_usd: 0.8,
    desc_vi: "Cấp 2 Boost tăng cấp độ server, mở khóa Avatar động, Banner, 720p 60fps & 128kbps Audio",
    desc_en: "2 Server Boosts to level up your Discord server, unlock animated icon & audio"
  },
  "acc_youtube_premium_1m": {
    name_vi: "Tài Khoản YouTube Premium (1 Tháng)",
    name_en: "YouTube Premium Account (1 Month)",
    price_vnd: 25000,
    price_usd: 1.0,
    desc_vi: "Xem video không quảng cáo, phát trong nền, nghe nhạc YouTube Music Premium chất lượng cao",
    desc_en: "Ad-free videos, background playback, high quality YouTube Music Premium"
  },
  "acc_netflix_1w": {
    name_vi: "Tài Khoản Netflix Premium (1 Tuần)",
    name_en: "Netflix Premium Account (1 Week)",
    price_vnd: 20000,
    price_usd: 0.8,
    desc_vi: "Xem phim Ultra HD 4K trên TV, điện thoại, máy tính, bảo hành trọn 1 tuần",
    desc_en: "Ultra HD 4K streaming on TV, phone, PC with full 1-week warranty"
  },
  "acc_discord_ver_mail_sdt": {
    name_vi: "Tài Khoản Discord Veri Mail + SĐT",
    name_en: "Discord Account (Email + Phone Verified)",
    price_vnd: 7000,
    price_usd: 0.3,
    desc_vi: "Acc Discord đã xác minh đầy đủ Email và Số điện thoại (SĐT), bao trâu, dùng ổn định",
    desc_en: "Fully verified Discord account with Email & Phone number, clean & ready to use"
  },

  // 4. CAPCUT PRO (CÁ NHÂN & TEAM 2TB)
  "capcut_pro_3d": {
    name_vi: "CapCut Pro Cá Nhân (3 Ngày)",
    name_en: "CapCut Pro Personal (3 Days)",
    price_vnd: 14000,
    price_usd: 0.6,
    desc_vi: "Tài khoản CapCut Pro cá nhân 3 ngày mở khóa toàn bộ tính năng Pro, xóa watermark, xuất 4K",
    desc_en: "3-Day CapCut Pro personal account, full Pro features, no watermark, 4K export"
  },
  "capcut_pro_14d": {
    name_vi: "CapCut Pro Cá Nhân (14 Ngày)",
    name_en: "CapCut Pro Personal (14 Days)",
    price_vnd: 39000,
    price_usd: 1.6,
    desc_vi: "Tài khoản CapCut Pro cá nhân 14 ngày, hiệu ứng VIP, kho nhạc bản quyền, AI phụ đề tự động",
    desc_en: "14-Day CapCut Pro personal account, VIP effects, licensed music, auto AI captions"
  },
  "capcut_pro_1m": {
    name_vi: "CapCut Pro Cá Nhân (1 Tháng)",
    name_en: "CapCut Pro Personal (1 Month)",
    price_vnd: 75000,
    price_usd: 3.0,
    desc_vi: "Tài khoản CapCut Pro cá nhân 1 tháng (30 ngày), dùng PC và Mobile, bảo hành trọn 30 ngày",
    desc_en: "1-Month CapCut Pro personal account for PC & Mobile, full 30-day warranty"
  },
  "capcut_pro_3m": {
    name_vi: "CapCut Pro Cá Nhân (3 Tháng)",
    name_en: "CapCut Pro Personal (3 Months)",
    price_vnd: 200000,
    price_usd: 8.0,
    desc_vi: "Tài khoản CapCut Pro cá nhân 3 tháng tiết kiệm, bảo hành 1 đổi 1 suốt 90 ngày",
    desc_en: "3-Month CapCut Pro personal account, 90-day 1-to-1 replacement warranty"
  },
  "capcut_pro_6m": {
    name_vi: "CapCut Pro Cá Nhân (6 Tháng)",
    name_en: "CapCut Pro Personal (6 Months)",
    price_vnd: 390000,
    price_usd: 15.5,
    desc_vi: "Gói CapCut Pro cá nhân 6 tháng (180 ngày) giá siêu ưu đãi, ổn định lâu dài",
    desc_en: "6-Month CapCut Pro personal account (180 days) best value, long-term stability"
  },
  "capcut_pro_team_1m": {
    name_vi: "CapCut Pro Gói Team 2TB Cloud (1 Tháng)",
    name_en: "CapCut Pro Team 2TB Cloud (1 Month)",
    price_vnd: 100000,
    price_usd: 4.0,
    desc_vi: "Nâng cấp CapCut Pro nhóm/team, kèm 2TB Cloud lưu trữ project video dung lượng khủng",
    desc_en: "CapCut Pro Team package with 2TB high-speed cloud storage for video projects"
  },

  // 5. BẢN QUYỀN WINDOWS & OFFICE
  "key_windows_pro": {
    name_vi: "Key Bản Quyền Windows 10 / 11 Pro Vĩnh Viễn",
    name_en: "Windows 10 / 11 Pro Lifetime License Key",
    price_vnd: 35000,
    price_usd: 1.5,
    desc_vi: "Key kích hoạt bản quyền vĩnh viễn Win 10/11 Pro, update thoải mái, kích hoạt trực tiếp",
    desc_en: "Lifetime retail license key for Windows 10/11 Pro, direct online activation"
  },
  "key_office_pro_plus": {
    name_vi: "Key Bản Quyền Office 2021 / 2024 Pro Plus Vĩnh Viễn",
    name_en: "Office 2021 / 2024 Pro Plus Lifetime License Key",
    price_vnd: 39000,
    price_usd: 1.6,
    desc_vi: "Key kích hoạt vĩnh viễn Word, Excel, PowerPoint, Outlook, OneNote bản Pro Plus",
    desc_en: "Lifetime retail key for Word, Excel, PowerPoint, Outlook, OneNote Pro Plus"
  },
  "acc_office_365_1m": {
    name_vi: "Microsoft 365 Chính Chủ (1 Tháng)",
    name_en: "Microsoft 365 Official Account Upgrade (1 Month)",
    price_vnd: 45000,
    price_usd: 1.8,
    desc_vi: "Nâng cấp chính chủ tài khoản Microsoft, kèm 1TB OneDrive Cloud và full Office",
    desc_en: "Official upgrade on your Microsoft account, 1TB OneDrive cloud & full Office apps"
  },
  "acc_office_365_12m": {
    name_vi: "Microsoft 365 Chính Chủ (12 Tháng)",
    name_en: "Microsoft 365 Official Account Upgrade (12 Months)",
    price_vnd: 269000,
    price_usd: 10.8,
    desc_vi: "Gói 1 năm Microsoft 365 Family nâng chính chủ, kèm 1TB OneDrive lưu trữ an toàn",
    desc_en: "1-Year Microsoft 365 Family upgrade, full desktop apps & 1TB OneDrive"
  },
  "key_vmware_pro": {
    name_vi: "Key VMware Workstation Pro Vĩnh Viễn",
    name_en: "VMware Workstation Pro Lifetime Key",
    price_vnd: 39000,
    price_usd: 1.6,
    desc_vi: "Key kích hoạt phần mềm máy ảo VMware Workstation Pro vĩnh viễn",
    desc_en: "Lifetime activation license key for VMware Workstation Pro"
  },

  // 6. THIẾT KẾ ĐỒ HỌA & VIDEO
  "acc_canva_pro_1y": {
    name_vi: "Tài Khoản Canva Pro / Edu (1 Năm)",
    name_en: "Canva Pro / Edu Account (1 Year)",
    price_vnd: 69000,
    price_usd: 2.8,
    desc_vi: "Mở khóa 100M+ mẫu thiết kế, hình ảnh Pro, công cụ AI Magic, xóa phông nền 1 click",
    desc_en: "Unlock 100M+ templates, Pro stock, AI Magic Studio, 1-click background remover"
  },
  "acc_adobe_photography": {
    name_vi: "Adobe Photoshop + Lightroom (1 Tháng)",
    name_en: "Adobe Photoshop + Lightroom Plan (1 Month)",
    price_vnd: 99000,
    price_usd: 4.0,
    desc_vi: "Bộ công cụ chỉnh sửa ảnh chuyên nghiệp Photoshop, Lightroom, Camera Raw bản quyền",
    desc_en: "Official Photoshop & Lightroom photography plan, generative AI fill included"
  },
  "acc_adobe_full_app": {
    name_vi: "Adobe Full App (Photoshop, Premiere, Illustrator) (1 Tháng)",
    name_en: "Adobe Creative Cloud Full Apps (1 Month)",
    price_vnd: 149000,
    price_usd: 6.0,
    desc_vi: "Trọn bộ hơn 20 ứng dụng Adobe: Photoshop, Premiere Pro, Illustrator, After Effects",
    desc_en: "Full suite of 20+ Adobe creative desktop apps including Premiere Pro & After Effects"
  },
  "acc_meitu_vip_7d": {
    name_vi: "Tài Khoản Meitu VIP (7 Ngày)",
    name_en: "Meitu VIP Account (7 Days)",
    price_vnd: 29000,
    price_usd: 1.2,
    desc_vi: "Mở khóa toàn bộ filter VIP, làm đẹp chân dung AI, chỉnh ảnh sắc nét",
    desc_en: "Full VIP portrait filters, AI body & face tuning tools"
  },
  "acc_photoroom_pro_7d": {
    name_vi: "Tài Khoản Photoroom Pro (7 Ngày)",
    name_en: "Photoroom Pro Account (7 Days)",
    price_vnd: 29000,
    price_usd: 1.2,
    desc_vi: "Công cụ cắt ghép ảnh sản phẩm bán hàng, xóa phông AI studio chuyên nghiệp",
    desc_en: "AI product photography cutout and professional studio backgrounds"
  },

  // 7. MẠNG RIÊNG ẢO VPN
  "key_hma_vpn_30d": {
    name_vi: "Key HMA VPN (30 Ngày - 5 Thiết Bị)",
    name_en: "HMA VPN License Key (30 Days - 5 Devices)",
    price_vnd: 35000,
    price_usd: 1.5,
    desc_vi: "VPN hơn 190 quốc gia, tốc độ cao, đổi IP siêu mượt cho game thủ và dân MMO",
    desc_en: "High-speed VPN with servers in 190+ countries, multi-device support"
  },
  "acc_nord_vpn_30d": {
    name_vi: "Tài Khoản NordVPN (30 Ngày)",
    name_en: "NordVPN Premium Account (30 Days)",
    price_vnd: 25000,
    price_usd: 1.0,
    desc_vi: "Bảo mật quân đội, tốc độ tải cực nhanh, chống rò rỉ DNS và IP",
    desc_en: "Military-grade encryption, ultra fast speed, DNS leak protection"
  },
  "acc_pia_vpn_7d": {
    name_vi: "Tài Khoản PIA VPN (4-7 Ngày - 5 Thiết Bị)",
    name_en: "Private Internet Access (PIA) VPN (7 Days)",
    price_vnd: 25000,
    price_usd: 1.0,
    desc_vi: "Bảo mật ẩn danh tuyệt đối, 5 thiết bị dùng đồng thời",
    desc_en: "Zero-logs policy VPN with high privacy and 5 simultaneous connections"
  },
  "acc_express_vpn_3d": {
    name_vi: "Tài Khoản ExpressVPN (3 Ngày - 8 Thiết Bị)",
    name_en: "ExpressVPN Account (3 Days - 8 Devices)",
    price_vnd: 15000,
    price_usd: 0.6,
    desc_vi: "VPN hàng đầu thế giới, ping thấp chơi game nước ngoài",
    desc_en: "Top tier low-ping gaming & streaming VPN across 8 devices"
  },

  // 8. ÂM NHẠC & GIẢI TRÍ
  "acc_spotify_premium_3m": {
    name_vi: "Spotify Premium 3 Tháng (Add Family)",
    name_en: "Spotify Premium 3 Months (Family Invite)",
    price_vnd: 139000,
    price_usd: 5.6,
    desc_vi: "Nghe nhạc không quảng cáo, chất lượng Lossless 320kbps, bảo hành trọn 3 tháng",
    desc_en: "Ad-free streaming, high-bitrate music playback, full 90-day warranty"
  },
  "acc_spotify_trial_3m": {
    name_vi: "Spotify Premium 3 Tháng (Trial)",
    name_en: "Spotify Premium 3 Months (Trial Account)",
    price_vnd: 79000,
    price_usd: 3.2,
    desc_vi: "Tài khoản Spotify Premium 3 tháng trải nghiệm giá rẻ",
    desc_en: "3-Month budget Spotify Premium trial account"
  },

  // 9. DISCORD CỔ (AGED DISCORD)
  "acc_discord_aged_2018_2025": {
    name_vi: "Acc Discord Cổ Random (2018 - 2025)",
    name_en: "Aged Discord Account (2018 - 2025)",
    price_vnd: 49000,
    price_usd: 2.0,
    desc_vi: "Acc Discord tạo lâu năm, độ uy tín cực cao, chống ăn gậy checkpoint",
    desc_en: "Aged Discord account (2018-2025), highly trusted, spam-filter resistant"
  },
  "acc_discord_aged_2016_2019": {
    name_vi: "Acc Discord Cổ Siêu Trâu (2016 - 2019)",
    name_en: "Prime Aged Discord Account (2016 - 2019)",
    price_vnd: 65000,
    price_usd: 2.6,
    desc_vi: "Acc Discord cổ 2016-2019 tạo từ thời kỳ đầu, cực trâu và hiếm",
    desc_en: "Prime vintage Discord account (2016-2019), rare and battle-tested"
  },

  // 10. HỌC TẬP & HỌP TRỰC TUYẾN
  "acc_zoom_pro_1m": {
    name_vi: "Bản Quyền Zoom Pro Không Giới Hạn (1 Tháng)",
    name_en: "Zoom Pro Unlimited Meeting Account (1 Month)",
    price_vnd: 119000,
    price_usd: 4.8,
    desc_vi: "Họp online không giới hạn 40 phút, phòng tới 100-300 người, ghi hình Cloud",
    desc_en: "Unlimited meeting duration, up to 100-300 participants, cloud recording"
  },
  "acc_google_meet_1m": {
    name_vi: "Gói Google Meet Không Giới Hạn (1 Tháng)",
    name_en: "Google Meet Unlimited Calls (1 Month)",
    price_vnd: 79000,
    price_usd: 3.2,
    desc_vi: "Gọi video Google Meet chất lượng cao không lo bị ngắt quãng giới hạn 60 phút",
    desc_en: "Unlimited Google Meet video conference calls without 60-minute cutoff"
  },
  "acc_turnitin_1m": {
    name_vi: "Tài Khoản Turnitin Check Đạo Văn (1 Tháng)",
    name_en: "Turnitin Plagiarism Checker Account (1 Month)",
    price_vnd: 199000,
    price_usd: 8.0,
    desc_vi: "Kiểm tra đạo văn luận văn, bài tập, báo cáo nghiên cứu không lưu kho dữ liệu",
    desc_en: "Academic plagiarism and similarity checking without repository storage"
  }
};

// DANH SÁCH BÍ DANH & GÓI SẢN PHẨM CŨ (DEPRECATED PACKAGE ALIASES & FALLBACKS)
const DEPRECATED_PACKAGE_ALIASES = Object.freeze({
  "custom_plugin": "custom_dev",
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
  "nitro_boost": "boost_nitro_2x",
  "boost_nitro": "boost_nitro_2x",
  "2_boost": "boost_nitro_2x",
  "boost": "boost_nitro_2x",
  "youtube_premium": "acc_youtube_premium_1m",
  "yt_premium": "acc_youtube_premium_1m",
  "acc_youtube": "acc_youtube_premium_1m",
  "youtube": "acc_youtube_premium_1m",
  "netflix": "acc_netflix_1w",
  "acc_netflix": "acc_netflix_1w",
  "netflix_1w": "acc_netflix_1w",
  "acc_discord": "acc_discord_ver_mail_sdt",
  "discord_veri": "acc_discord_ver_mail_sdt",
  "discord_ver_mail": "acc_discord_ver_mail_sdt",
  "discord_phone": "acc_discord_ver_mail_sdt",
  "acc_discord_7k": "acc_discord_ver_mail_sdt",
  "capcut": "capcut_pro_1m",
  "capcut_pro": "capcut_pro_1m",
  "capcut_1m": "capcut_pro_1m",
  "capcut_3d": "capcut_pro_3d",
  "capcut_14d": "capcut_pro_14d",
  "capcut_3m": "capcut_pro_3m",
  "capcut_6m": "capcut_pro_6m",
  "capcut_team": "capcut_pro_team_1m",
  "capcut_2tb": "capcut_pro_team_1m",
  "windows": "key_windows_pro",
  "win_pro": "key_windows_pro",
  "windows_pro": "key_windows_pro",
  "win11": "key_windows_pro",
  "win10": "key_windows_pro",
  "office": "key_office_pro_plus",
  "office_pro": "key_office_pro_plus",
  "office_2024": "key_office_pro_plus",
  "office_2021": "key_office_pro_plus",
  "office_365": "acc_office_365_1m",
  "office365": "acc_office_365_1m",
  "office_365_12m": "acc_office_365_12m",
  "canva": "acc_canva_pro_1y",
  "canva_pro": "acc_canva_pro_1y",
  "adobe": "acc_adobe_photography",
  "photoshop": "acc_adobe_photography",
  "adobe_full": "acc_adobe_full_app",
  "hma_vpn": "key_hma_vpn_30d",
  "hma": "key_hma_vpn_30d",
  "nord_vpn": "acc_nord_vpn_30d",
  "nord": "acc_nord_vpn_30d",
  "spotify": "acc_spotify_premium_3m",
  "spotify_family": "acc_spotify_premium_3m",
  "discord_co": "acc_discord_aged_2018_2025",
  "discord_aged": "acc_discord_aged_2018_2025",
  "zoom": "acc_zoom_pro_1m",
  "zoom_pro": "acc_zoom_pro_1m",
  "google_meet": "acc_google_meet_1m",
  "turnitin": "acc_turnitin_1m",
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
/**
 * Gateway Intents Audit & Validation:
 * - GatewayIntentBits.Guilds (Non-Privileged): Cần thiết cho cấu trúc Guild, Kênh, Role, Ticket.
 * - GatewayIntentBits.GuildMessages (Non-Privileged): Cần thiết cho MessageCreate & MessageUpdate (AutoMod).
 * - GatewayIntentBits.GuildMembers (Privileged): Cần thiết cho GuildMemberAdd (Chào mừng + Tự cấp role) & GuildMemberRemove (Tạm biệt).
 * - GatewayIntentBits.MessageContent (Privileged): Cần thiết cho AutoMod (quét link mời Discord & chống ping @everyone/@here).
 * 
 * Lưu ý: Các Privileged Intents (GuildMembers, MessageContent) BẮT BUỘC phải được bật trong
 * Discord Developer Portal (Applications -> Bot -> Privileged Gateway Intents).
 */
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
      lifetime: 600  // Loại bỏ tin nhắn cũ hơn 10 phút khỏi RAM
    },
    users: {
      interval: 1800, // Quét dọn user cache không hoạt động mỗi 30 phút
      filter: () => user => user.id !== client.user?.id
    },
    guildMembers: {
      interval: 1800,
      filter: () => member => member.id !== client.user?.id
    },
    threads: {
      interval: 1800,
      lifetime: 900
    },
    threadMembers: {
      interval: 1800,
      filter: () => () => true
    }
  },
  makeCache: Options.cacheWithLimits({
    ...Options.DefaultMakeCacheSettings,
    MessageManager: 25,              // Tối đa 25 tin nhắn trên mỗi channel trong RAM
    GuildMemberManager: 50,          // Giới hạn cache member tối đa 50 trong RAM
    PresenceManager: 0,              // Tắt cache presence không dùng
    ReactionManager: 0,              // Tắt cache reaction
    ReactionUserManager: 0,          // Tắt cache reaction user
    VoiceStateManager: 0,            // Tắt cache voice state
    GuildBanManager: 0,              // Tắt cache ban
    GuildInviteManager: 0,           // Tắt cache invites
    GuildStickerManager: 0,          // Tắt cache stickers
    GuildScheduledEventManager: 0,   // Tắt cache scheduled events
    StageInstanceManager: 0,         // Tắt cache stage
    ThreadManager: 0,                // Tắt cache threads
    ThreadMemberManager: 0,          // Tắt cache thread members
    AutoModerationRuleManager: 0,    // Tắt cache auto mod rules
    ApplicationCommandManager: 0,    // Tắt cache application command objects
    BaseGuildEmojiManager: 0         // Tắt cache emojis
  })
});

// =========================================================================
// 2.1. DISCORD REST EVENTS, RATE LIMIT MONITORING & HEADER PARSING
// =========================================================================

// Telemetry & metrics cho REST API Rate-Limit
const restRateLimitMetrics = {
  rateLimitHits: 0,
  globalRateLimitHits: 0,
  invalidRequestWarnings: 0,
  lastRateLimitRoute: null,
  lastTimeToResetMs: 0,
  lastHitAt: null
};

function getRestRateLimitMetrics() {
  return {
    ...restRateLimitMetrics,
    timestamp: Date.now()
  };
}

/**
 * Phân tích và trích xuất thông tin chi tiết từ các HTTP Headers chuẩn của Discord REST API:
 * - X-RateLimit-Limit: Số request tối đa trong bucket window
 * - X-RateLimit-Remaining: Số request còn lại trước khi bị 429
 * - X-RateLimit-Reset: Thời điểm reset bucket (Epoch timestamp in seconds)
 * - X-RateLimit-Reset-After: Thời gian còn lại tính bằng giây (độ chính xác mili-giây dạng float)
 * - X-RateLimit-Bucket: Khóa định danh duy nhất của bucket
 * - X-RateLimit-Global: Cờ báo hiệu bị Rate Limit toàn cục (Global)
 * - X-RateLimit-Scope: Phạm vi giới hạn ('user', 'global', 'shared')
 * - Retry-After: Thời gian chờ thử lại khi gặp mã HTTP 429
 */
function parseDiscordRateLimitHeaders(rawHeaders) {
  if (!rawHeaders || typeof rawHeaders !== 'object') {
    return {
      limit: null,
      remaining: null,
      reset: null,
      resetAfter: null,
      bucket: null,
      global: false,
      scope: 'route',
      retryAfter: 0,
      retryAfterMs: 0,
      isRateLimited: false,
      resetsAt: null
    };
  }

  const normalized = {};
  if (typeof rawHeaders.get === 'function') {
    for (const key of ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset', 'x-ratelimit-reset-after', 'x-ratelimit-bucket', 'x-ratelimit-global', 'x-ratelimit-scope', 'retry-after']) {
      const val = rawHeaders.get(key);
      if (val !== null && val !== undefined) normalized[key] = val;
    }
  } else {
    for (const [k, v] of Object.entries(rawHeaders)) {
      if (k && typeof k === 'string') {
        normalized[k.toLowerCase()] = v;
      }
    }
  }

  const rawLimit = normalized['x-ratelimit-limit'];
  const rawRemaining = normalized['x-ratelimit-remaining'];
  const rawReset = normalized['x-ratelimit-reset'];
  const rawResetAfter = normalized['x-ratelimit-reset-after'];
  const rawBucket = normalized['x-ratelimit-bucket'];
  const rawGlobal = normalized['x-ratelimit-global'];
  const rawScope = normalized['x-ratelimit-scope'];
  const rawRetryAfter = normalized['retry-after'];

  const limit = rawLimit !== undefined ? parseInt(rawLimit, 10) : null;
  const remaining = rawRemaining !== undefined ? parseInt(rawRemaining, 10) : null;
  const reset = rawReset !== undefined ? parseFloat(rawReset) : null;
  const resetAfter = rawResetAfter !== undefined ? parseFloat(rawResetAfter) : null;
  const bucket = typeof rawBucket === 'string' && rawBucket.trim() !== '' ? rawBucket.trim() : null;
  const isGlobal = rawGlobal === 'true' || rawGlobal === true || rawGlobal === '1' || rawGlobal === 1;
  const scope = typeof rawScope === 'string' && rawScope.trim() !== '' ? rawScope.trim() : (isGlobal ? 'global' : 'route');
  const retryAfterNum = rawRetryAfter !== undefined ? parseFloat(rawRetryAfter) : null;
  const hasExplicitRetryAfter = retryAfterNum !== null && !isNaN(retryAfterNum) && retryAfterNum > 0;

  const isRateLimited = (remaining !== null && remaining === 0) || hasExplicitRetryAfter;

  const effectiveRetryAfterSec = hasExplicitRetryAfter
    ? retryAfterNum
    : (isRateLimited && resetAfter !== null && !isNaN(resetAfter) ? resetAfter : 0);

  const retryAfterMs = Math.max(0, Math.round(effectiveRetryAfterSec * 1000));

  let resetsAt = null;
  if (reset !== null && !isNaN(reset) && reset > 0) {
    resetsAt = new Date(Math.round(reset * 1000));
  } else if (resetAfter !== null && !isNaN(resetAfter) && resetAfter > 0) {
    resetsAt = new Date(Date.now() + Math.round(resetAfter * 1000));
  }

  return {
    limit: !isNaN(limit) ? limit : null,
    remaining: !isNaN(remaining) ? remaining : null,
    reset: !isNaN(reset) ? reset : null,
    resetAfter: !isNaN(resetAfter) ? resetAfter : null,
    bucket,
    global: isGlobal,
    scope,
    retryAfter: effectiveRetryAfterSec,
    retryAfterMs,
    isRateLimited,
    resetsAt
  };
}

/**
 * Tính toán thời gian chờ Backoff (Exponential Backoff + Full Jitter) phòng chống thundering herd
 */
function calculateRateLimitBackoff(retryAfterSec = 0, attempt = 1, options = {}) {
  const minDelayMs = options.minDelayMs || 100;
  const maxDelayMs = options.maxDelayMs || 30000;
  const jitterMaxMs = options.jitterMaxMs || 250;

  let baseDelayMs;
  if (typeof retryAfterSec === 'number' && retryAfterSec > 0) {
    baseDelayMs = retryAfterSec * 1000;
  } else {
    baseDelayMs = Math.pow(2, Math.max(1, attempt)) * 250;
  }

  const jitter = Math.random() * jitterMaxMs;
  const totalDelay = Math.round(baseDelayMs + jitter);
  return Math.min(maxDelayMs, Math.max(minDelayMs, totalDelay));
}

// Lắng nghe sự kiện rateLimited trên client.rest để giám sát chi tiết rate-limit của Discord API
client.rest.on(RESTEvents.RateLimited, (rateLimitData) => {
  const {
    timeToReset = 0,
    limit = 0,
    method = 'UNKNOWN',
    route = 'UNKNOWN',
    url = '',
    global: isGlobal = false,
    majorParameter = ''
  } = rateLimitData || {};

  restRateLimitMetrics.rateLimitHits++;
  if (isGlobal) restRateLimitMetrics.globalRateLimitHits++;
  restRateLimitMetrics.lastRateLimitRoute = route !== 'UNKNOWN' ? route : (url || 'UNKNOWN');
  restRateLimitMetrics.lastTimeToResetMs = timeToReset;
  restRateLimitMetrics.lastHitAt = Date.now();

  const routeOrUrl = route !== 'UNKNOWN' ? route : (url || 'UNKNOWN');
  console.warn(
    `⏳ [REST Rate Limit Hit] ${isGlobal ? '🌐 GLOBAL' : '📍 ROUTE'} | ` +
    `Method: ${String(method).toUpperCase()} | Route: ${routeOrUrl} | ` +
    `Retry-After: ${timeToReset}ms | Bucket Limit: ${limit} | MajorParam: ${majorParameter || 'N/A'}`
  );
});

// Giám sát các yêu cầu không hợp lệ có nguy cơ bị Cloudflare tạm khóa IP (10,000 invalid requests / 10 phút)
client.rest.on(RESTEvents.InvalidRequestWarning, (warningData) => {
  const { count = 0, remainingTime = 0 } = warningData || {};
  restRateLimitMetrics.invalidRequestWarnings = count;
  console.warn(
    `⚠️ [REST Invalid Request Warning] Phát hiện ${count} yêu cầu không hợp lệ (401/403/429). ` +
    `Thời gian reset: ${remainingTime}ms (Cảnh báo nguy cơ Cloudflare IP Block nếu vượt ngưỡng)`
  );
});

// =========================================================================
// 2.2. DISCORD GATEWAY RESILIENCE, ERROR CODES & LIFECYCLE HANDLERS
// =========================================================================

/**
 * Bảng tra cứu chuẩn toàn bộ mã lỗi đóng kết nối Discord Gateway (Gateway Close Event Codes):
 * Tham chiếu tài liệu chính thức: https://docs.discord.com/developers/docs/topics/gateway#disconnections
 */
const GATEWAY_CLOSE_CODES = Object.freeze({
  4000: Object.freeze({
    code: 4000,
    name: 'UNKNOWN_ERROR',
    reconnectable: true,
    fatal: false,
    action: 'RESUME_OR_RECONNECT',
    descriptionVi: 'Lỗi không xác định từ Discord Gateway. Tự động kết nối lại hoặc Resume phiên làm việc.',
    descriptionEn: 'Unknown error occurred on Discord Gateway. Auto-reconnecting or resuming session.'
  }),
  4001: Object.freeze({
    code: 4001,
    name: 'UNKNOWN_OPCODE',
    reconnectable: true,
    fatal: false,
    action: 'RECONNECT',
    descriptionVi: 'Opcode Gateway không hợp lệ. Khởi tạo lại kết nối WebSocket.',
    descriptionEn: 'Invalid Gateway opcode sent. Reconnecting WebSocket.'
  }),
  4002: Object.freeze({
    code: 4002,
    name: 'DECODE_ERROR',
    reconnectable: true,
    fatal: false,
    action: 'RECONNECT',
    descriptionVi: 'Không thể giải mã payload gửi tới Gateway. Khởi tạo lại kết nối.',
    descriptionEn: 'Invalid payload encoding sent to Gateway. Reconnecting WebSocket.'
  }),
  4003: Object.freeze({
    code: 4003,
    name: 'NOT_AUTHENTICATED',
    reconnectable: true,
    fatal: false,
    action: 'RECONNECT',
    descriptionVi: 'Gửi payload trước khi xác thực Identify. Thực hiện kết nối và xác thực lại.',
    descriptionEn: 'Payload sent prior to Identify handshake. Re-authenticating.'
  }),
  4004: Object.freeze({
    code: 4004,
    name: 'AUTHENTICATION_FAILED',
    reconnectable: false,
    fatal: true,
    action: 'HALT_AND_FIX_TOKEN',
    descriptionVi: 'Discord Token không hợp lệ hoặc đã bị thu hồi! Dừng kết nối lại ngay lập tức.',
    descriptionEn: 'Authentication failed. Invalid bot token provided! Halting reconnect attempts.'
  }),
  4005: Object.freeze({
    code: 4005,
    name: 'ALREADY_AUTHENTICATED',
    reconnectable: true,
    fatal: false,
    action: 'RECONNECT',
    descriptionVi: 'Đã gửi payload xác thực Identify khi đã đăng nhập. Reset kết nối.',
    descriptionEn: 'Already authenticated. Resetting session connection.'
  }),
  4007: Object.freeze({
    code: 4007,
    name: 'INVALID_SEQ',
    reconnectable: true,
    fatal: false,
    action: 'RECONNECT_NEW_SESSION',
    descriptionVi: 'Sequence number gửi khi Resume không hợp lệ. Phục hồi thất bại, bắt đầu phiên mới (Identify).',
    descriptionEn: 'Invalid resume sequence. Session resume failed, starting fresh session.'
  }),
  4008: Object.freeze({
    code: 4008,
    name: 'RATE_LIMITED',
    reconnectable: true,
    fatal: false,
    action: 'BACKOFF_AND_RECONNECT',
    descriptionVi: 'Vượt quá giới hạn gửi payload Gateway (120 payload/phút). Chờ exponential backoff.',
    descriptionEn: 'Gateway rate limit exceeded. Backing off before reconnecting.'
  }),
  4009: Object.freeze({
    code: 4009,
    name: 'SESSION_TIMED_OUT',
    reconnectable: true,
    fatal: false,
    action: 'RECONNECT_NEW_SESSION',
    descriptionVi: 'Phiên kết nối Gateway đã hết hạn (Session Timed Out). Khởi tạo phiên mới.',
    descriptionEn: 'Gateway session timed out. Starting fresh session.'
  }),
  4010: Object.freeze({
    code: 4010,
    name: 'INVALID_SHARD',
    reconnectable: false,
    fatal: true,
    action: 'FIX_SHARD_CONFIG',
    descriptionVi: 'Cấu hình Shard ID hoặc Shard Count không hợp lệ. Dừng kết nối lại.',
    descriptionEn: 'Invalid shard configuration sent during Identify. Halting reconnects.'
  }),
  4011: Object.freeze({
    code: 4011,
    name: 'SHARDING_REQUIRED',
    reconnectable: false,
    fatal: true,
    action: 'ENABLE_SHARDING',
    descriptionVi: 'Bot tham gia trên 2500 máy chủ, bắt buộc bật Sharding! Dừng kết nối lại.',
    descriptionEn: 'Sharding required (>2500 guilds). Halting reconnects.'
  }),
  4012: Object.freeze({
    code: 4012,
    name: 'INVALID_API_VERSION',
    reconnectable: false,
    fatal: true,
    action: 'UPDATE_API_VERSION',
    descriptionVi: 'Phiên bản Gateway API không hợp lệ. Cần cập nhật discord.js hoặc cấu hình API.',
    descriptionEn: 'Invalid Gateway API version specified.'
  }),
  4013: Object.freeze({
    code: 4013,
    name: 'INVALID_INTENTS',
    reconnectable: false,
    fatal: true,
    action: 'FIX_INTENTS',
    descriptionVi: 'Bitfield Gateway Intents không hợp lệ. Cần sửa intents trong Client options.',
    descriptionEn: 'Invalid Gateway Intents bitfield specified.'
  }),
  4014: Object.freeze({
    code: 4014,
    name: 'DISALLOWED_INTENTS',
    reconnectable: false,
    fatal: true,
    action: 'ENABLE_PRIVILEGED_INTENTS',
    descriptionVi: 'Intents đặc quyền (GuildMembers/MessageContent/Presence) chưa được bật trong Developer Portal!',
    descriptionEn: 'Disallowed Privileged Intents. Enable in Discord Developer Portal.'
  })
});

/**
 * Phân loại và giải mã mã đóng kết nối Discord Gateway / WebSocket
 */
function classifyGatewayCloseCode(code) {
  const numericCode = Number(code) || 0;
  if (GATEWAY_CLOSE_CODES[numericCode]) {
    return {
      ...GATEWAY_CLOSE_CODES[numericCode],
      isDiscordGatewayCode: true,
      isStandardWsCode: false
    };
  }

  // Xử lý các mã WebSocket tiêu chuẩn (RFC 6455)
  if (numericCode === 1000) {
    return {
      code: 1000,
      name: 'NORMAL_CLOSURE',
      reconnectable: true,
      fatal: false,
      action: 'RECONNECT',
      descriptionVi: 'Đóng kết nối bình thường (Normal Closure).',
      descriptionEn: 'Normal WebSocket closure. Can reconnect if needed.',
      isDiscordGatewayCode: false,
      isStandardWsCode: true
    };
  }
  if (numericCode === 1001) {
    return {
      code: 1001,
      name: 'GOING_AWAY',
      reconnectable: true,
      fatal: false,
      action: 'RESUME_OR_RECONNECT',
      descriptionVi: 'Máy chủ hoặc client đóng kết nối (Going Away).',
      descriptionEn: 'Endpoint is going away (server restart/sleep). Auto-reconnecting.',
      isDiscordGatewayCode: false,
      isStandardWsCode: true
    };
  }
  if (numericCode === 1006) {
    return {
      code: 1006,
      name: 'ABNORMAL_CLOSURE',
      reconnectable: true,
      fatal: false,
      action: 'RESUME_OR_RECONNECT',
      descriptionVi: 'Ngắt kết nối mạng bất thường (Mất kết nối Internet/TCP reset).',
      descriptionEn: 'Abnormal closure (network drop/TCP reset). Auto-resuming session.',
      isDiscordGatewayCode: false,
      isStandardWsCode: true
    };
  }

  const isFatal = [4004, 4010, 4011, 4012, 4013, 4014].includes(numericCode);
  return {
    code: numericCode,
    name: 'UNCLASSIFIED_CLOSE_CODE',
    reconnectable: !isFatal,
    fatal: isFatal,
    action: isFatal ? 'HALT' : 'RECONNECT',
    descriptionVi: `Mã đóng kết nối chưa phân loại (${numericCode}).`,
    descriptionEn: `Unclassified close code (${numericCode}).`,
    isDiscordGatewayCode: numericCode >= 4000 && numericCode < 5000,
    isStandardWsCode: numericCode < 4000
  };
}

// Bảng theo dõi trạng thái sức khỏe Gateway (Gateway Health & Diagnostics)
const gatewayHealthMetrics = {
  connectCount: 0,
  disconnectCount: 0,
  reconnectCount: 0,
  resumeCount: 0,
  errorCount: 0,
  sessionInvalidatedCount: 0,
  lastDisconnectCode: null,
  lastDisconnectReason: null,
  lastDisconnectAt: null,
  lastResumeAt: null,
  lastReplayedEvents: 0,
  lastReadyAt: null,
  readyCount: 0
};

function getGatewayHealthMetrics(targetClient = client) {
  const ping = targetClient?.ws?.ping ?? -1;
  const status = targetClient?.ws?.status ?? -1;
  return {
    ...gatewayHealthMetrics,
    currentPingMs: ping,
    wsStatus: status,
    isOnline: status === 0,
    timestamp: Date.now()
  };
}

// Bắt các sự kiện lỗi và cảnh báo từ Discord Client
client.on(Events.Error, (error) => {
  gatewayHealthMetrics.errorCount++;
  console.error('❌ [Discord Client Error]:', error);
});

client.on(Events.Warn, (info) => {
  console.warn('⚠️ [Discord Client Warning]:', info);
});

client.on(Events.ShardError, (error, shardId) => {
  gatewayHealthMetrics.errorCount++;
  console.error(`❌ [Discord Shard ${shardId} Error]:`, error);
});

// Xử lý khi Shard WebSocket bị ngắt kết nối và giải mã mã đóng kết nối (Gateway Close Codes)
client.on(Events.ShardDisconnect, (event, shardId) => {
  const code = event?.code || 0;
  const reason = event?.reason || 'No reason provided';
  const classified = classifyGatewayCloseCode(code);

  gatewayHealthMetrics.disconnectCount++;
  gatewayHealthMetrics.lastDisconnectCode = code;
  gatewayHealthMetrics.lastDisconnectReason = reason;
  gatewayHealthMetrics.lastDisconnectAt = Date.now();

  if (classified.fatal) {
    console.error(
      `💥 [CRITICAL SHARD DISCONNECT] Shard ${shardId} đóng kết nối với mã FATAL ${code} (${classified.name}): ${reason}\n` +
      `   👉 Hành động yêu cầu: ${classified.action} | VI: ${classified.descriptionVi} | EN: ${classified.descriptionEn}`
    );
  } else {
    console.warn(
      `🔌 [Discord Shard ${shardId} Disconnected] WebSocket closed with code ${code} (${classified.name}): ${reason}\n` +
      `   👉 Hành động: ${classified.action} (Reconnectable: ${classified.reconnectable}) | ${classified.descriptionVi}`
    );
  }
});

// Ghi nhận tiến trình kết nối lại WebSocket
client.on(Events.ShardReconnecting, (shardId) => {
  gatewayHealthMetrics.reconnectCount++;
  console.log(`🔄 [Discord Shard ${shardId} Reconnecting] Đang kết nối lại Discord Gateway WebSocket...`);
});

// Ghi nhận khi Shard phục hồi phiên làm việc thành công (Session Resume)
client.on(Events.ShardResume, (shardId, replayedEvents) => {
  gatewayHealthMetrics.resumeCount++;
  gatewayHealthMetrics.lastResumeAt = Date.now();
  gatewayHealthMetrics.lastReplayedEvents = replayedEvents || 0;
  console.log(`✅ [Discord Shard ${shardId} Resumed] Kết nối Gateway đã khôi phục thành công (Replayed ${replayedEvents} events).`);
});

// Ghi nhận khi Shard đã sẵn sàng
client.on(Events.ShardReady, (shardId, unavailableGuilds) => {
  gatewayHealthMetrics.readyCount++;
  gatewayHealthMetrics.lastReadyAt = Date.now();
  const unavailCount = unavailableGuilds ? unavailableGuilds.size : 0;
  console.log(`🚀 [Discord Shard ${shardId} Ready] Shard đã sẵn sàng hoạt động${unavailCount > 0 ? ` (${unavailCount} guilds unavailable)` : ''}.`);
});

// Ghi nhận khi phiên làm việc bị vô hiệu hóa
client.on(Events.Invalidated, () => {
  gatewayHealthMetrics.sessionInvalidatedCount++;
  console.error('❌ [Discord Session Invalidated] Phiên kết nối Gateway đã bị vô hiệu hóa. Yêu cầu khởi tạo phiên mới (Re-identify).');
});

// =========================================================================
// 3. SLASH COMMANDS REGISTRATION & CLIENT READY
// =========================================================================
const commands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Kiểm tra độ trễ của Bot LS Studio / Check Bot Latency')
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel),
  new SlashCommandBuilder()
    .setName('khachhang')
    .setDescription('Cấp role Khách Hàng cho người vừa mua Plugin/Mod/AI (Staff Only)')
    .addUserOption(opt => 
      opt.setName('user')
        .setDescription('Thành viên đã mua hàng / Customer')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),
  new SlashCommandBuilder()
    .setName('stk')
    .setDescription('Lấy thông tin tài khoản ngân hàng MBBank / Bank Information')
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel),
  new SlashCommandBuilder()
    .setName('transcript')
    .setDescription('Xuất file nhật ký tin nhắn của kênh ticket hiện tại (Staff Only)')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),
  new SlashCommandBuilder()
    .setName('feedback')
    .setDescription('Gửi nhận xét & đánh giá chất lượng dịch vụ / Send Feedback')
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel),
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Xem hướng dẫn sử dụng và danh sách lệnh Bot LS Studio / Bot Help Guide')
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel),
  new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Lấy link mời Bot, tính toán Permissions Bitfield & OAuth2 Discovery')
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel),
  new SlashCommandBuilder()
    .setName('clearmessages')
    .setDescription('Xóa số lượng tin nhắn trong kênh (1-100) (Staff Only) / Clear Messages')
    .addIntegerOption(opt =>
      opt.setName('amount')
        .setDescription('Số lượng tin nhắn cần xóa (1-100) / Amount of messages to delete')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),
  new SlashCommandBuilder()
    .setName('kiemtra')
    .setDescription('Tra cứu mã đơn hàng hoặc kiểm tra quyền hạn thành viên / Check status')
    .addStringOption(opt =>
      opt.setName('code')
        .setDescription('Mã đơn hàng cần kiểm tra (ví dụ: LS123456) / Order Code')
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Thành viên cần kiểm tra role & quyền lợi / Member to check')
        .setRequired(false)
    )
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel),

  // 2. CONTEXT MENU COMMANDS (User & Message Context Menus)
  new ContextMenuCommandBuilder()
    .setName('Tra cứu khách hàng / User Info')
    .setType(ApplicationCommandType.User)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel),
  new ContextMenuCommandBuilder()
    .setName('Báo cáo hỗ trợ / Report Support')
    .setType(ApplicationCommandType.Message)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
].map(cmd => cmd.toJSON());

async function registerCommands(clientId) {
  if (!TOKEN || TOKEN === 'YOUR_BOT_TOKEN_HERE') {
    console.warn('⚠️ Chưa cấu hình DISCORD_TOKEN hợp lệ. Bỏ qua đăng ký Slash Commands.');
    return;
  }
  try {
    console.log('🔄 Đang đồng bộ Slash Commands...');
    if (GUILD_ID) {
      await client.rest.put(
        Routes.applicationGuildCommands(clientId, GUILD_ID),
        { body: commands }
      );
      console.log(`✅ Guild Slash Commands đã sẵn sàng cho Guild ID: ${GUILD_ID}!`);
    } else {
      await client.rest.put(
        Routes.applicationCommands(clientId),
        { body: commands }
      );
      console.log('✅ Global Slash Commands đã sẵn sàng!');
    }
  } catch (error) {
    console.error('❌ Lỗi đăng ký Slash Commands:', error);
  }
}

// =========================================================================
// 3.1. DYNAMIC ACTIVITY PRESENCE ROTATION & BILINGUAL STATUS
// =========================================================================
const ACTIVITIES = Object.freeze([
  Object.freeze({
    name: 'LS STUDIO • Plugins & AI Services ⚡',
    type: ActivityType.Watching,
    state: 'Dịch vụ Minecraft & AI bản quyền 24/7 / Official Store'
  }),
  Object.freeze({
    name: '🛒 /stk • MBBank VietQR 24/7',
    type: ActivityType.Playing,
    state: 'Nạp tiền tự động qua VietQR / Auto Instant Payment'
  }),
  Object.freeze({
    name: '🛡️ LS-AntiCheat • Top Security & Speed',
    type: ActivityType.Competing,
    state: 'Bảo vệ máy chủ tối đa / High Performance Security'
  }),
  Object.freeze({
    name: '💬 /help • 24/7 Bilingual Customer Support',
    type: ActivityType.Listening,
    state: 'Hỗ trợ kỹ thuật & giải đáp thắc mắc / Help & Inquiries'
  }),
  Object.freeze({
    name: '⚡ /kiemtra • Order Status & VIP Rank',
    type: ActivityType.Watching,
    state: 'Tra cứu đơn hàng & quyền lợi thành viên / Check Orders'
  }),
  Object.freeze({
    name: '💎 LS Studio VIP Club',
    type: ActivityType.Custom,
    state: 'Giao hàng tự động & Hỗ trợ trọn đời / Auto Delivery'
  })
]);

let activityInterval = null;
let currentActivityIndex = 0;

/**
 * Cập nhật trạng thái xoay tua (Presence Rotation) cho Bot
 */
function rotateBotActivity(targetClient = client, forcedIndex = null) {
  try {
    if (!targetClient?.user || typeof targetClient.user.setPresence !== 'function') {
      return { success: false, reason: 'Client or client.user not ready' };
    }
    const idx = forcedIndex !== null && !isNaN(forcedIndex)
      ? Math.abs(Math.floor(forcedIndex)) % ACTIVITIES.length
      : currentActivityIndex;

    const act = ACTIVITIES[idx];
    const presencePayload = {
      activities: [{
        name: act.name,
        type: act.type,
        ...(act.state ? { state: act.state } : {})
      }],
      status: 'online'
    };

    targetClient.user.setPresence(presencePayload);
    currentActivityIndex = (idx + 1) % ACTIVITIES.length;
    return { success: true, index: idx, activity: act, presence: presencePayload };
  } catch (err) {
    console.error('⚠️ [Presence Error] Lỗi cập nhật Presence:', err.message || err);
    return { success: false, error: err };
  }
}

/**
 * Bắt đầu chu trình xoay tua Presence tự động
 */
function startActivityRotation(targetClient = client, intervalMs = 25000) {
  stopActivityRotation();
  rotateBotActivity(targetClient);
  activityInterval = setInterval(() => {
    rotateBotActivity(targetClient);
  }, intervalMs);
  if (activityInterval?.unref) {
    activityInterval.unref();
  }
  return activityInterval;
}

/**
 * Dừng chu trình xoay tua Presence
 */
function stopActivityRotation() {
  if (activityInterval) {
    clearInterval(activityInterval);
    activityInterval = null;
  }
}

function getCurrentActivityIndex() {
  return currentActivityIndex;
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`🤖 LS STUDIO BOT ONLINE: ${readyClient.user.tag}`);
  gatewayHealthMetrics.readyCount++;
  gatewayHealthMetrics.lastReadyAt = Date.now();

  // Thiết lập trạng thái hoạt động xoay tua (Presence Rotation)
  startActivityRotation(readyClient, 25000);

  await registerCommands(readyClient.user.id);
});

// =========================================================================
// 4. TÍNH NĂNG AUTOMOD: BẢO VỆ MÁY CHỦ, CHỐNG INVITE SPAM & PING @EVERYONE
// =========================================================================

// Bảng tra cứu ký tự Homoglyphs (Cyrillic, Greek, Armenian, IPA, Lookalikes)
const HOMOGLYPH_MAP = Object.freeze({
  // a
  'а': 'a', 'α': 'a', 'ӓ': 'a', 'ӑ': 'a', 'ā': 'a', 'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a', 'ą': 'a',
  // b
  'в': 'b', 'ь': 'b', 'ъ': 'b', 'β': 'b', 'ɓ': 'b', 'ḃ': 'b', 'ḅ': 'b',
  // c
  'с': 'c', 'ƈ': 'c', 'ɕ': 'c', 'ç': 'c', 'ć': 'c', 'ĉ': 'c', 'ċ': 'c', 'č': 'c', 'ϲ': 'c', 'ᴄ': 'c',
  // d
  'ԁ': 'd', 'ԃ': 'd', 'ɗ': 'd', 'đ': 'd', 'ď': 'd', 'ḋ': 'd', 'ḍ': 'd', 'ḏ': 'd', 'ð': 'd',
  // e
  'е': 'e', 'ё': 'e', 'ε': 'e', 'ϵ': 'e', 'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e', 'ē': 'e', 'ĕ': 'e', 'ė': 'e', 'ę': 'e', 'ě': 'e', 'ẹ': 'e', 'ẻ': 'e', 'ẽ': 'e',
  // g
  'ɡ': 'g', 'ɢ': 'g', 'ԍ': 'g', 'ǥ': 'g', 'ɠ': 'g', 'ğ': 'g', 'ġ': 'g', 'ģ': 'g', 'ǧ': 'g', 'ǵ': 'g',
  // h
  'һ': 'h', 'հ': 'h', 'ĥ': 'h', 'ħ': 'h', 'ḣ': 'h', 'ḥ': 'h', 'ḧ': 'h',
  // i
  'і': 'i', 'ї': 'i', 'ι': 'i', 'ı': 'i', 'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i', 'ī': 'i', 'ĭ': 'i', 'į': 'i', 'ǐ': 'i', 'ỉ': 'i', 'ị': 'i', 'ɪ': 'i',
  // j
  'ј': 'j', 'ȷ': 'j', 'ĵ': 'j', 'ǰ': 'j',
  // k
  'к': 'k', 'κ': 'k', 'ķ': 'k', 'ǩ': 'k', 'ḳ': 'k', 'ḵ': 'k',
  // l
  'ℓ': 'l', 'ł': 'l', 'ĺ': 'l', 'ļ': 'l', 'ľ': 'l', 'ŀ': 'l', 'ḷ': 'l', 'ḻ': 'l',
  // m
  'м': 'm', 'ḿ': 'm', 'ṁ': 'm', 'ṃ': 'm',
  // n
  'п': 'n', 'ո': 'n', 'ñ': 'n', 'ń': 'n', 'ņ': 'n', 'ň': 'n', 'ŋ': 'n', 'ṅ': 'n', 'ṇ': 'n', 'ṉ': 'n',
  // o
  'о': 'o', 'ο': 'o', 'օ': 'o', 'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o', 'ō': 'o', 'ŏ': 'o', 'ő': 'o', 'ǒ': 'o', 'ơ': 'o', 'ọ': 'o', 'ỏ': 'o', 'ø': 'o', 'ǿ': 'o', 'ɵ': 'o', 'ᴏ': 'o',
  // p
  'р': 'p', 'ρ': 'p', 'ƥ': 'p', 'ṕ': 'p', 'ṗ': 'p',
  // q
  'ԛ': 'q', 'ɋ': 'q', 'զ': 'q',
  // r
  'г': 'r', 'ѓ': 'r', 'ґ': 'r', 'ŕ': 'r', 'ŗ': 'r', 'ř': 'r', 'ṙ': 'r', 'ṛ': 'r', 'ɼ': 'r', 'ɾ': 'r', 'ʀ': 'r',
  // s
  'ѕ': 's', 'ʂ': 's', 'ś': 's', 'ŝ': 's', 'ş': 's', 'š': 's', 'ș': 's', 'ṡ': 's', 'ṣ': 's', 'ꜱ': 's',
  // t
  'т': 't', 'τ': 't', 'ţ': 't', 'ť': 't', 'ț': 't', 'ṫ': 't', 'ṭ': 't', 'ṯ': 't',
  // u
  'υ': 'u', 'μ': 'u', 'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u', 'ũ': 'u', 'ū': 'u', 'ŭ': 'u', 'ů': 'u', 'ű': 'u', 'ų': 'u', 'ư': 'u', 'ụ': 'u', 'ủ': 'u',
  // v
  'ѵ': 'v', 'ν': 'v', 'ṽ': 'v', 'ṿ': 'v',
  // w
  'ш': 'w', 'щ': 'w', 'ŵ': 'w', 'ẁ': 'w', 'ẃ': 'w', 'ẅ': 'w', 'ẇ': 'w', 'ẉ': 'w',
  // x
  'х': 'x', 'χ': 'x', 'ẋ': 'x', 'ẍ': 'x',
  // y
  'у': 'y', 'ý': 'y', 'ÿ': 'y', 'ŷ': 'y', 'ẏ': 'y', 'ỳ': 'y', 'ỵ': 'y', 'ỷ': 'y', 'ỹ': 'y', 'γ': 'y',
  // z
  'ź': 'z', 'ż': 'z', 'ž': 'z', 'ẑ': 'z', 'ẓ': 'z', 'ẕ': 'z'
});

const HOMOGLYPH_REGEX = new RegExp(Object.keys(HOMOGLYPH_MAP).join('|'), 'gi');

/**
 * Chuẩn hóa chuỗi văn bản phòng chống spam, obfuscation & homoglyphs:
 * 1. NFKC Unicode normalization (chuyển math bold/italic, fullwidth thành ký tự chuẩn)
 * 2. Thay thế homoglyphs (Cyrillic, Greek, Armenian, Lookalikes) sang Latin tương ứng
 * 3. NFD decomposition và loại bỏ combining diacritics
 * 4. Loại bỏ các ký tự ẩn, zero-width, formatting controls
 */
function normalizeAntiSpamText(text) {
  if (!text || typeof text !== 'string') return '';
  const input = text.length > 10000 ? text.slice(0, 10000) : text;
  
  let normalized = input.normalize('NFKC');

  normalized = normalized.replace(HOMOGLYPH_REGEX, (matched) => {
    const lower = matched.toLowerCase();
    return HOMOGLYPH_MAP[lower] || matched;
  });

  normalized = normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Dot homoglyphs: U+2024, U+FF0E, U+2027, U+2022, U+00B7, U+2219, U+FE52, U+3002
  normalized = normalized.replace(/[\u2024\uFF0E\u2027\u2022\u00B7\u2219\uFE52\u3002]/g, '.');

  // Slash homoglyphs: U+FF0F, U+2044, U+2215, U+29F8, U+29F9, U+FF3C, backslash
  normalized = normalized.replace(/[\uFF0F\u2044\u2215\u29F8\u29F9\uFF3C\\]/g, '/');

  normalized = normalized.replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u2060-\u206F\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u00AD\u180E]/g, '');

  return normalized;
}

/**
 * Trích xuất toàn bộ URL và nội dung ẩn trong Markdown Masked Links [text](url), <url>, v.v.
 */
function extractAllLinkTargets(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];
  const input = rawText.length > 10000 ? rawText.slice(0, 10000) : rawText;
  const targets = [input];

  // Bóc tách Markdown Masked Links: [label](url) hoặc [label](<url>)
  const markdownLinkRegex = /\[([^\]]*)\]\(\s*<?([^\s>)]+)>?\s*(?:"[^"]*")?\)/gi;
  let match;
  let count = 0;
  while ((match = markdownLinkRegex.exec(input)) !== null && count < 10) {
    if (match[1]) targets.push(match[1]); // Visible anchor text
    if (match[2]) targets.push(match[2]); // Hidden URL target
    count++;
  }

  // Bóc tách URL trong dấu <url>
  const angleBracketRegex = /<\s*(https?:\/\/[^\s>]+|[a-zA-Z0-9_\-]+(?:\.[a-zA-Z0-9_\-]+)*\.[a-zA-Z]{2,}\/[^\s>]+)\s*>/gi;
  count = 0;
  while ((match = angleBracketRegex.exec(input)) !== null && count < 10) {
    if (match[1]) targets.push(match[1]);
    count++;
  }

  return targets;
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
 * discord.me, discord.io, discord.li, discord.link, dsc.gg, invite.gg, dis.gd,
 * bao gồm homoglyph spoofing, spoiler tags ||, markdown masked links, code blocks, backticks, dot-obfuscation).
 */
function containsDiscordInvite(rawContent) {
  if (!rawContent || typeof rawContent !== 'string') return false;
  const input = rawContent.length > 10000 ? rawContent.slice(0, 10000) : rawContent;

  const targetTexts = extractAllLinkTargets(input);

  const invitePatternStandard = /(?:https?:\/\/)?(?:www\s*[\.\(\[\{]\s*)?(?:(?:discord\s*(?:app)?\s*[\.\(\[\{]\s*(?:gg|com\s*[\/\\]+\s*(?:invite|servers)|io|me|li|link|gift))|(?:dsc|invite)\s*[\.\(\[\{]\s*gg|dis\s*[\.\(\[\{]\s*gd)\s*[\/\\]+\s*[a-zA-Z0-9_\-\+]+/i;
  
  const invitePatternStripped = /(?:https?:\/\/)?(?:www\.)?(?:(?:discord(?:app)?(?:\.(?:gg|com\/(?:invite|servers)|io|me|li|link|gift)|\/(?:invite|servers|channels)))|(?:dsc|invite)\.gg|dis\.gd)(?:\/[a-zA-Z0-9_\-\+]+)?/i;

  for (const item of targetTexts) {
    const normalized = normalizeAntiSpamText(item);

    // 1. Kiểm tra trực tiếp trên chuỗi đã chuẩn hóa homoglyphs & unicode
    if (invitePatternStandard.test(normalized)) {
      return true;
    }

    // 2. Kiểm tra trên chuỗi sau khi loại bỏ spoiler tags '||', backticks '`', quotes, và spaces
    const stripped = normalized
      .replace(/\|\|/g, '')                          // Loại bỏ spoiler markers
      .replace(/[`*~_]/g, '')                        // Loại bỏ markdown formatters (backticks, bold, italic, strikethrough)
      .replace(/[\(\[\{]\s*dot\s*[\)\]\}]/gi, '.')  // (dot), [dot], {dot} -> .
      .replace(/[\(\[\{]\s*\.\s*[\)\]\}]/g, '.')    // (.), [.], {.} -> .
      .replace(/[\(\[\{]\s*slash\s*[\)\]\}]/gi, '/')// (slash), [slash] -> /
      .replace(/[\(\[\{]\s*\/\s*[\)\]\}]/g, '/')    // (/), [/], {/} -> /
      .replace(/[\[\]\(\)\{\}]/g, '')               // Loại bỏ ngoặc bao quanh từ
      .replace(/\s+/g, '');                          // Bỏ toàn bộ khoảng trắng

    if (invitePatternStripped.test(stripped)) {
      return true;
    }
  }

  return false;
}

/**
 * Nhận diện ping @everyone / @here trái phép mà KHÔNG gây false positive:
 * - Bỏ qua code block (```...```) và inline code (`...`)
 * - Bỏ qua escaped mention (\@everyone, \@here)
 * - Bỏ qua địa chỉ email (admin@everyone.com, contact@here.org)
 * - Bỏ qua URL link chứa @everyone/@here
 * - Bắt triệt để spoiler bypass (@||everyone||, @every||one), homoglyphs (@еveryone), zero-width
 */
function containsEveryonePing(message) {
  if (!message) return false;

  // Nếu Discord API xác nhận tin nhắn thực sự kích hoạt ping everyone/here
  if (typeof message === 'object' && message.mentions && message.mentions.everyone) {
    return true;
  }

  let text = typeof message === 'string' ? message : message.content;
  if (!text || typeof text !== 'string') return false;

  if (text.length > 10000) {
    text = text.slice(0, 10000);
  }

  // 1. Loại bỏ code block (```...```) và inline code (`...`) TRƯỚC KHI normalize (Phòng chống false positive trong code)
  text = text.replace(/```[\s\S]*?(?:```|$)/g, ' ');
  text = text.replace(/`[^`\n]*?`/g, ' ');

  // 2. Loại bỏ escaped mention (\@everyone, \@here)
  text = text.replace(/\\@everyone/gi, ' ');
  text = text.replace(/\\@here/gi, ' ');

  // 3. Chuẩn hóa chống spam & homoglyphs
  text = normalizeAntiSpamText(text);

  // 4. Loại bỏ spoiler tags '||' và các ký tự phân tách nằm giữa '@' và 'everyone/here'
  const cleanedMentions = text.replace(/@\s*[\|*~_]*\s*([a-zA-Z]+)/g, (match, word) => {
    return '@' + word;
  }).replace(/\|\|/g, '');

  // 5. Bắt @everyone hoặc @here đứng độc lập (không thuộc email, username trong URL, hay từ ghép)
  const everyoneRegex = /(?<![\w@])@(everyone|here)(?![\w\.])/i;
  return everyoneRegex.test(cleanedMentions);
}

/**
 * Bộ xử lý AutoMod tập trung cho cả tin nhắn mới và tin nhắn chỉnh sửa
 */
async function handleAutoMod(message) {
  if (!message || !message.guild || message.author?.bot) return;

  // Fetch full message nếu là partial
  if (message.partial) {
    try {
      message = await message.fetch();
    } catch {
      return;
    }
  }

  // Lấy thông tin member (tự fetch nếu cache chưa có)
  const member = message.member || await message.guild.members.fetch(message.author.id).catch(() => null);
  if (!member) return;

  // Kiểm tra quyền Staff / Admin / Quản trị
  const isStaff = isStaffMember(member);
  if (isStaff) return;

  // Quyền của bot trong channel hiện tại
  const botMember = message.guild.members.me || await message.guild.members.fetchMe().catch(() => null);
  const perms = message.channel.permissionsFor ? message.channel.permissionsFor(botMember) : null;
  const canSendEmbed = !perms || perms.has([
    PermissionsBitField.Flags.SendMessages,
    PermissionsBitField.Flags.EmbedLinks
  ]);

  // 1. Chặn và Timeout 5 phút nếu tự ý ping @everyone / @here
  if (containsEveryonePing(message)) {
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
  if (containsDiscordInvite(message.content)) {
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
}

client.on(Events.MessageCreate, async (message) => {
  try {
    await handleAutoMod(message);
  } catch (err) {
    console.error('Lỗi AutoMod messageCreate:', err);
  }
});

client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  try {
    await handleAutoMod(newMessage);
  } catch (err) {
    console.error('Lỗi AutoMod messageUpdate:', err);
  }
});

// =========================================================================
// 5. EVENT: CHÀO MỪNG THÀNH VIÊN MỚI (BILINGUAL)
// =========================================================================
client.on(Events.GuildMemberAdd, async (member) => {
  try {
    let memberRole = member.guild.roles.cache.find(r => r.name.includes("Thành Viên") && !r.managed) ||
                     member.guild.roles.cache.find(r => r.name.includes("Thành Viên"));
    if (!memberRole) {
      const fetchedRoles = await member.guild.roles.fetch().catch(() => null);
      memberRole = fetchedRoles?.find(r => r.name.includes("Thành Viên") && !r.managed) ||
                   fetchedRoles?.find(r => r.name.includes("Thành Viên"));
    }
    if (memberRole && !memberRole.managed && memberRole.id !== member.guild.id) {
      const alreadyHasRole = member.roles?.cache ? member.roles.cache.has(memberRole.id) : false;
      if (!alreadyHasRole) {
        const botMember = member.guild.members.me || await member.guild.members.fetchMe().catch(() => null);
        if (
          botMember && 
          botMember.permissions.has(PermissionsBitField.Flags.ManageRoles) && 
          botMember.roles.highest.position > memberRole.position &&
          member.guild.ownerId !== member.id &&
          member.roles.highest.position < botMember.roles.highest.position
        ) {
          await member.roles.add(memberRole).catch((err) => {
            console.warn(`⚠️ [guildMemberAdd] Không thể tự động cấp role Thành Viên: ${err.message}`);
          });
        }
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

const ticketCreationLocks = new ExpiringLockMap(30000, 500);
const closingTicketChannels = new ExpiringLockMap(60000, 200); // Kênh ticket đang trong tiến trình đóng & xuất transcript (TTL 60s, Auto-expiry)
const userCooldowns = new Map();
const MAX_USER_COOLDOWNS = 1000;

/**
 * Tính thời gian cooldown/rate limit còn lại
 * Hỗ trợ phân vùng linh hoạt theo Guild và User (guildId:userId) để chống can thiệp chéo giữa các máy chủ (Cross-Guild Interference)
 * @param {string} targetOrGuildId - Guild ID hoặc key nhận diện
 * @param {string|number} userIdOrCooldown - User ID (nếu truyền guildId) hoặc Cooldown Ms
 * @param {number} maybeCooldownMs - Cooldown Ms (nếu truyền guildId và userId)
 * @returns {number} Số giây cooldown còn lại (0 nếu đã hết hạn hoặc được phép thực hiện)
 */
function getRateLimitRemaining(targetOrGuildId, userIdOrCooldown = 5000, maybeCooldownMs = 5000) {
  let key;
  let cooldownMs;
  if (typeof userIdOrCooldown === 'string' && /^\d{16,21}$/.test(userIdOrCooldown)) {
    key = userIdOrCooldown;
    cooldownMs = typeof maybeCooldownMs === 'number' && maybeCooldownMs > 0 ? maybeCooldownMs : 5000;
  } else if (typeof targetOrGuildId === 'string' && /^\d{16,21}$/.test(targetOrGuildId)) {
    key = targetOrGuildId;
    cooldownMs = typeof userIdOrCooldown === 'number' && userIdOrCooldown > 0 ? userIdOrCooldown : 5000;
  } else if (typeof userIdOrCooldown === 'string') {
    key = `${targetOrGuildId || 'DM'}:${userIdOrCooldown}`;
    cooldownMs = typeof maybeCooldownMs === 'number' && maybeCooldownMs > 0 ? maybeCooldownMs : 5000;
  } else {
    key = String(targetOrGuildId || 'global');
    cooldownMs = typeof userIdOrCooldown === 'number' && userIdOrCooldown > 0 ? userIdOrCooldown : 5000;
  }

  const now = Date.now();
  const lastTime = userCooldowns.get(key) || 0;
  if (now - lastTime < cooldownMs) {
    return Math.ceil((cooldownMs - (now - lastTime)) / 1000);
  }

  // Bảo vệ giới hạn dung lượng bộ nhớ (Max 1,000 entries) tối ưu cho Discloud 100MB RAM
  if (userCooldowns.size >= MAX_USER_COOLDOWNS) {
    for (const [k, time] of userCooldowns.entries()) {
      if (now - time > 60000) {
        userCooldowns.delete(k);
      }
    }
    if (userCooldowns.size >= MAX_USER_COOLDOWNS) {
      const oldestKeys = Array.from(userCooldowns.keys()).slice(0, 200);
      for (const k of oldestKeys) userCooldowns.delete(k);
    }
  }

  userCooldowns.set(key, now);
  return 0;
}

/**
 * Dọn dẹp cache bộ nhớ chủ động và giải phóng RAM cho Discloud 100MB limit
 * @param {'soft'|'hard'|'critical'} level - Mức độ dọn dẹp cache
 */
function flushMemoryCaches(level = 'soft') {
  const now = Date.now();
  
  // 1. Dọn dẹp VietQR buffers
  if (level === 'hard' || level === 'critical') {
    vietQRBufferCache.clear();
    failedVietQRUrls.clear();
    pendingVietQRRequests.clear();
  } else {
    for (const [url, item] of vietQRBufferCache.entries()) {
      if (now - (item.cachedAt || 0) > 3 * 60 * 1000) {
        vietQRBufferCache.delete(url);
      }
    }
  }

  // 2. Dọn dẹp tin nhắn trong cache của các kênh Discord
  if (client?.channels?.cache) {
    for (const channel of client.channels.cache.values()) {
      if (channel?.messages?.cache) {
        channel.messages.cache.clear();
      }
    }
  }

  // 3. Dọn dẹp Member Cache khi chạm ngưỡng Critical
  if ((level === 'hard' || level === 'critical') && client?.guilds?.cache) {
    for (const guild of client.guilds.cache.values()) {
      if (guild?.members?.cache) {
        for (const [id] of guild.members.cache.entries()) {
          if (id !== client.user?.id) {
            guild.members.cache.delete(id);
          }
        }
      }
    }
  }

  // 4. Kích hoạt V8 Garbage Collection nếu cờ --expose-gc khả dụng
  if (global.gc) {
    try {
      global.gc();
    } catch (_) {}
  }
}

/**
 * Lấy thông số chi tiết về RAM footprint và số lượng phần tử trong các cấu trúc bộ nhớ
 */
function getMemoryFootprint() {
  const mem = process.memoryUsage();
  return {
    rssMB: +(mem.rss / 1024 / 1024).toFixed(2),
    heapTotalMB: +(mem.heapTotal / 1024 / 1024).toFixed(2),
    heapUsedMB: +(mem.heapUsed / 1024 / 1024).toFixed(2),
    externalMB: +(mem.external / 1024 / 1024).toFixed(2),
    arrayBuffersMB: +(mem.arrayBuffers / 1024 / 1024).toFixed(2),
    collections: {
      activeOrders: activeOrderCodes.size,
      approvedOrders: approvedOrderCodes.size,
      processingApprovals: processingApprovals.size,
      ticketLocks: ticketCreationLocks.size,
      closingTickets: closingTicketChannels.size,
      userCooldowns: userCooldowns.size,
      vietQRCache: vietQRBufferCache.size,
      failedVietQR: failedVietQRUrls.size,
      pendingRequests: pendingVietQRRequests.size
    }
  };
}

// Định kỳ dọn dẹp các mục cooldown, locks & mã đơn hàng đã hết hạn để tránh rò rỉ bộ nhớ (Discloud 100MB Watchdog)
let cleanupInterval = setInterval(() => {
  const now = Date.now();
  
  // 1. Dọn dẹp user cooldowns quá hạn (>60s)
  for (const [key, time] of userCooldowns.entries()) {
    if (now - time > 60000) {
      userCooldowns.delete(key);
    }
  }

  // 2. Dọn dẹp lock tạo ticket, ticket closing & processing approvals quá hạn TTL
  ticketCreationLocks.pruneExpired(now);
  closingTicketChannels.pruneExpired(now);
  processingApprovals.pruneExpired(now);

  // 3. Dọn dẹp mã đơn hàng cũ hơn 24 giờ & giới hạn dung lượng Map
  const ORDER_TTL = 24 * 60 * 60 * 1000;
  for (const [code, data] of activeOrderCodes.entries()) {
    if (now - (data.createdAt || 0) > ORDER_TTL) {
      activeOrderCodes.delete(code);
    }
  }
  if (activeOrderCodes.size > MAX_ACTIVE_ORDERS) {
    const toRemove = Array.from(activeOrderCodes.keys()).slice(0, 200);
    for (const c of toRemove) activeOrderCodes.delete(c);
  }

  // 4. Giới hạn approvedOrderCodes chống rò rỉ RAM dài hạn (Discloud 100MB RAM Guard)
  if (approvedOrderCodes.size > MAX_APPROVED_ORDERS) {
    const toRemove = Array.from(approvedOrderCodes).slice(0, 100);
    for (const c of toRemove) approvedOrderCodes.delete(c);
  }

  // 5. Dọn dẹp cache ảnh VietQR & negative failure cache quá hạn
  for (const [url, item] of vietQRBufferCache.entries()) {
    if (now - (item.cachedAt || 0) > VIETQR_CACHE_TTL) {
      vietQRBufferCache.delete(url);
    }
  }
  for (const [url, item] of failedVietQRUrls.entries()) {
    if (now - (item.failedAt || 0) > VIETQR_FAILURE_TTL) {
      failedVietQRUrls.delete(url);
    }
  }

  // 6. Two-Tier Discloud 100MB RAM Watchdog & Auto-Garbage Collection
  const mem = process.memoryUsage();
  const rssMB = +(mem.rss / 1024 / 1024).toFixed(1);
  const heapUsedMB = +(mem.heapUsed / 1024 / 1024).toFixed(1);

  if (mem.rss >= 80 * 1024 * 1024) {
    console.warn(`🚨 [Discloud 100MB RAM Guard] Critical RSS Memory: ${rssMB}MB (Heap: ${heapUsedMB}MB). Đang kích hoạt Hard Cache Flush & GC...`);
    flushMemoryCaches('critical');
  } else if (mem.rss >= 65 * 1024 * 1024) {
    console.warn(`⚠️ [Discloud 100MB RAM Guard] High RSS Memory: ${rssMB}MB (Heap: ${heapUsedMB}MB). Đang kích hoạt Soft Cache Flush...`);
    flushMemoryCaches('soft');
  }
}, 60 * 1000);
if (cleanupInterval?.unref) cleanupInterval.unref();

// =========================================================================
// 5. HELPER: XỬ LÝ TIMEZONE, TRÍCH XUẤT TRANSCRIPT & GIỚI HẠN FILE KÍCH THƯỚC LỚN
// =========================================================================

/**
 * Định dạng thời gian theo múi giờ chuẩn Việt Nam (UTC+7 / Asia/Ho_Chi_Minh)
 * Hoạt động độc lập và xác định (deterministic) không phụ thuộc vào dữ liệu ICU hệ điều hành
 * @param {number|Date|string} timestampOrDate - Timestamp mili-giây, Date instance hoặc chuỗi ISO
 * @param {boolean} includeTimezone - Có kèm hậu tố "(UTC+7)" hay không
 * @returns {string} Chuỗi thời gian định dạng DD/MM/YYYY HH:mm:ss hoặc 'N/A' nếu không hợp lệ
 */
function formatVNTime(timestampOrDate, includeTimezone = false) {
  if (timestampOrDate === null || timestampOrDate === undefined) return 'N/A';
  
  let dateObj;
  if (timestampOrDate instanceof Date) {
    dateObj = timestampOrDate;
  } else if (typeof timestampOrDate === 'number' || typeof timestampOrDate === 'string') {
    dateObj = new Date(timestampOrDate);
  } else {
    return 'N/A';
  }

  const timeVal = dateObj.getTime();
  if (isNaN(timeVal)) return 'N/A';

  // Cộng 7 giờ (7 * 3600 * 1000 ms) để chuyển sang múi giờ UTC+7
  const vnDate = new Date(timeVal + 7 * 60 * 60 * 1000);
  const day = String(vnDate.getUTCDate()).padStart(2, '0');
  const month = String(vnDate.getUTCMonth() + 1).padStart(2, '0');
  const year = vnDate.getUTCFullYear();
  const hours = String(vnDate.getUTCHours()).padStart(2, '0');
  const minutes = String(vnDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(vnDate.getUTCSeconds()).padStart(2, '0');

  const formatted = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  return includeTimezone ? `${formatted} (UTC+7)` : formatted;
}

/**
 * Trích xuất toàn bộ dữ liệu giàu thông tin của tin nhắn thành plain object nhẹ nhàng
 * Giúp giải phóng ngay lập tức các đối tượng Discord.js Message instance phức tạp khỏi RAM
 * @param {import('discord.js').Message} msg - Discord.js Message instance
 * @returns {Object} Plain object chứa toàn bộ chi tiết tin nhắn
 */
function extractTranscriptMessageData(msg) {
  if (!msg) return null;

  // 1. Thông tin tác giả & Webhook (Sanitized & Redacted)
  const authorData = msg.author ? {
    id: msg.author.id,
    tag: sanitizeSingleLineHeader(msg.author.tag || msg.author.username || 'User', 100),
    username: sanitizeSingleLineHeader(msg.author.username || 'User', 100),
    bot: Boolean(msg.author.bot)
  } : {
    id: msg.webhookId || 'N/A',
    tag: msg.webhookId ? `Webhook [${sanitizeSingleLineHeader(msg.webhookId, 50)}]` : 'Deleted User',
    username: msg.webhookId ? `Webhook [${sanitizeSingleLineHeader(msg.webhookId, 50)}]` : 'Deleted User',
    bot: Boolean(msg.webhookId)
  };

  // 2. Tệp đính kèm (Attachments)
  const attachments = [];
  if (msg.attachments && typeof msg.attachments.forEach === 'function') {
    msg.attachments.forEach((att) => {
      let sizeFormatted = '0 B';
      if (att.size) {
        if (att.size >= 1024 * 1024) {
          sizeFormatted = `${(att.size / (1024 * 1024)).toFixed(1)} MB`;
        } else if (att.size >= 1024) {
          sizeFormatted = `${(att.size / 1024).toFixed(1)} KB`;
        } else {
          sizeFormatted = `${att.size} B`;
        }
      }
      attachments.push({
        id: att.id,
        name: sanitizeSingleLineHeader(att.name || 'file', 150),
        size: att.size || 0,
        sizeFormatted,
        contentType: sanitizeSingleLineHeader(att.contentType || 'application/octet-stream', 100),
        url: sanitizeTranscriptControlChars(att.url || ''),
        width: att.width || null,
        height: att.height || null,
        description: att.description ? sanitizeTranscriptControlChars(redactSensitiveData(att.description)) : null
      });
    });
  }

  // 3. Khung nội dung nâng cao (Embeds)
  const embeds = [];
  if (Array.isArray(msg.embeds)) {
    for (const emb of msg.embeds) {
      embeds.push({
        title: emb.title ? sanitizeTranscriptControlChars(redactSensitiveData(emb.title)) : null,
        url: emb.url ? sanitizeTranscriptControlChars(emb.url) : null,
        description: emb.description ? sanitizeTranscriptControlChars(redactSensitiveData(emb.description)) : null,
        author: emb.author ? { 
          name: sanitizeSingleLineHeader(redactSensitiveData(emb.author.name || ''), 150), 
          url: emb.author.url ? sanitizeTranscriptControlChars(emb.author.url) : null 
        } : null,
        fields: Array.isArray(emb.fields) ? emb.fields.map(f => ({ 
          name: sanitizeSingleLineHeader(redactSensitiveData(f.name || ''), 150), 
          value: sanitizeTranscriptControlChars(redactSensitiveData(String(f.value || ''))), 
          inline: Boolean(f.inline) 
        })) : [],
        image: emb.image ? { url: sanitizeTranscriptControlChars(emb.image.url || '') } : null,
        thumbnail: emb.thumbnail ? { url: sanitizeTranscriptControlChars(emb.thumbnail.url || '') } : null,
        video: emb.video ? { url: sanitizeTranscriptControlChars(emb.video.url || '') } : null,
        footer: emb.footer ? { text: sanitizeSingleLineHeader(redactSensitiveData(emb.footer.text || ''), 200) } : null,
        timestamp: emb.timestamp || null
      });
    }
  }

  // 4. Nhãn dán (Stickers)
  const stickers = [];
  if (msg.stickers && typeof msg.stickers.forEach === 'function') {
    msg.stickers.forEach((stk) => {
      stickers.push({
        id: stk.id,
        name: sanitizeSingleLineHeader(stk.name || 'Sticker', 100),
        url: stk.url || `https://media.discordapp.net/stickers/${stk.id}.png`
      });
    });
  }

  // 5. Cảm xúc (Reactions)
  const reactions = [];
  if (msg.reactions?.cache && typeof msg.reactions.cache.forEach === 'function') {
    msg.reactions.cache.forEach((r) => {
      reactions.push({
        emoji: sanitizeSingleLineHeader(r.emoji?.name || 'emoji', 50),
        count: r.count || 1
      });
    });
  }

  // 6. Bình chọn (Poll)
  let poll = null;
  if (msg.poll) {
    const answers = [];
    if (msg.poll.answers && typeof msg.poll.answers.forEach === 'function') {
      msg.poll.answers.forEach((ans) => {
        answers.push({
          text: sanitizeSingleLineHeader(redactSensitiveData(ans.text || ans.pollMedia?.text || 'Tùy chọn'), 200),
          voteCount: ans.voteCount || 0
        });
      });
    }
    poll = {
      question: sanitizeSingleLineHeader(redactSensitiveData(msg.poll.question?.text || 'Cuộc thăm dò'), 250),
      answers
    };
  }

  // Raw content sanitized and redacted
  const rawContent = typeof msg.content === 'string' ? msg.content : '';
  const sanitizedContent = sanitizeTranscriptControlChars(redactSensitiveData(rawContent));

  return {
    id: msg.id,
    createdTimestamp: msg.createdTimestamp || Date.now(),
    editedTimestamp: msg.editedTimestamp || null,
    pinned: Boolean(msg.pinned),
    system: Boolean(msg.system),
    type: msg.type,
    authorTag: authorData.tag,
    authorId: authorData.id,
    isBot: authorData.bot,
    content: sanitizedContent,
    replyMessageId: msg.reference?.messageId || null,
    attachments,
    embeds,
    stickers,
    reactions,
    poll
  };
}

/**
 * Tạo nội dung văn bản Transcript với phân trang tin nhắn và định dạng chi tiết
 * Sử dụng phân trang an toàn (limit: 100, cache: false) lên tới 5000 tin nhắn
 * @param {import('discord.js').TextChannel} channel - Kênh cần trích xuất transcript
 * @param {string|null} closeReason - Lý do đóng ticket (nếu có)
 * @returns {Promise<string>} Chuỗi văn bản transcript hoàn chỉnh
 */
async function generateTranscript(channel, closeReason = null) {
  try {
    if (!channel || !channel.isTextBased()) {
      return `Lỗi: Kênh không hợp lệ hoặc không hỗ trợ đọc tin nhắn.`;
    }

    // 1. Phân trang lấy tin nhắn với { cache: false }
    const lightweightMessages = [];
    let lastId = null;
    const MAX_MESSAGES = 5000;

    while (lightweightMessages.length < MAX_MESSAGES) {
      const options = { limit: 100, cache: false };
      if (lastId) options.before = lastId;

      const fetched = await channel.messages.fetch(options).catch(err => {
        console.error(`Lỗi fetch tin nhắn khi tạo transcript tại kênh #${channel.name}:`, err);
        return null;
      });

      if (!fetched || fetched.size === 0) break;

      // Trích xuất ngay lập tức plain object để giải phóng Message instances khỏi RAM
      fetched.forEach((m) => {
        const item = extractTranscriptMessageData(m);
        if (item) lightweightMessages.push(item);
      });

      if (fetched.size < 100) break;
      const lastKey = typeof fetched.lastKey === 'function' ? fetched.lastKey() : (fetched.last?.()?.id || null);
      if (!lastKey || lastKey === lastId) break;
      lastId = lastKey;
    }

    // Sắp xếp theo thứ tự thời gian từ cũ nhất -> mới nhất (Chronological order)
    lightweightMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    // Thu thập danh sách người tham gia (Distinct Participants) và số lượng tin nhắn
    const participantMap = new Map();
    let userMsgCount = 0;
    let botMsgCount = 0;
    let systemMsgCount = 0;
    let totalAttachmentsCount = 0;

    for (const msg of lightweightMessages) {
      if (msg.system) systemMsgCount++;
      else if (msg.isBot) botMsgCount++;
      else userMsgCount++;

      totalAttachmentsCount += (msg.attachments?.length || 0);

      if (msg.authorId && msg.authorId !== 'N/A') {
        const existing = participantMap.get(msg.authorId) || {
          tag: msg.authorTag,
          id: msg.authorId,
          isBot: msg.isBot,
          count: 0
        };
        existing.count++;
        participantMap.set(msg.authorId, existing);
      }
    }

    const participantsList = Array.from(participantMap.values())
      .map(p => `${p.tag} (${p.id})${p.isBot ? ' [BOT]' : ''} - ${p.count} tin nhắn`)
      .join('\n  • ') || 'Không có';

    const nowFormatted = formatVNTime(Date.now(), true);
    const firstMsgTime = lightweightMessages.length > 0 ? formatVNTime(lightweightMessages[0].createdTimestamp) : 'N/A';
    const lastMsgTime = lightweightMessages.length > 0 ? formatVNTime(lightweightMessages[lightweightMessages.length - 1].createdTimestamp) : 'N/A';

    // Tính thời gian tồn tại của kênh / Ticket Lifetime
    let channelCreatedAt = 'N/A';
    let ticketDurationStr = 'N/A';
    try {
      const createdSnowflakeMs = Number((BigInt(channel.id) >> 22n) + 1420070400000n);
      channelCreatedAt = formatVNTime(createdSnowflakeMs);
      const durationMs = Math.max(0, Date.now() - createdSnowflakeMs);
      const durMinutes = Math.floor(durationMs / 60000);
      const durHours = Math.floor(durMinutes / 60);
      const durDays = Math.floor(durHours / 24);
      if (durDays > 0) {
        ticketDurationStr = `${durDays} ngày ${durHours % 24} giờ ${durMinutes % 60} phút`;
      } else if (durHours > 0) {
        ticketDurationStr = `${durHours} giờ ${durMinutes % 60} phút`;
      } else {
        ticketDurationStr = `${durMinutes} phút ${Math.floor((durationMs % 60000) / 1000)} giây`;
      }
    } catch (_) {}

    // Sanitize metadata fields
    const safeGuildName = sanitizeSingleLineHeader(channel.guild?.name || 'N/A', 100);
    const safeGuildId = sanitizeSingleLineHeader(channel.guildId || channel.guild?.id || 'N/A', 30);
    const safeChannelName = sanitizeSingleLineHeader(channel.name || 'N/A', 100);
    const safeChannelId = sanitizeSingleLineHeader(channel.id || 'N/A', 30);
    const safeCategoryName = sanitizeSingleLineHeader(channel.parent?.name || 'N/A', 100);
    const safeTopic = sanitizeSingleLineHeader(redactSensitiveData(channel.topic || 'N/A'), 250);
    const safeReason = closeReason ? sanitizeSingleLineHeader(redactSensitiveData(closeReason), 300) : null;

    let transcript = `================================================================================\n`;
    transcript += `LS STUDIO - TICKET TRANSCRIPT / NHẬT KÝ HỘI THOẠI TICKET\n`;
    transcript += `================================================================================\n`;
    transcript += `Máy chủ / Guild       : ${safeGuildName} (${safeGuildId})\n`;
    transcript += `Kênh / Channel        : #${safeChannelName} (${safeChannelId})\n`;
    transcript += `Danh mục / Category   : ${safeCategoryName}\n`;
    transcript += `Chủ đề / Topic        : ${safeTopic}\n`;
    transcript += `Thời điểm tạo ticket  : ${channelCreatedAt}\n`;
    if (safeReason) {
      transcript += `Lý do đóng / Reason   : ${safeReason}\n`;
    }
    transcript += `Thời gian xuất / Time : ${nowFormatted}\n`;
    transcript += `Thời gian tồn tại     : ${ticketDurationStr}\n`;
    transcript += `Khoảng thời gian      : ${firstMsgTime} -> ${lastMsgTime}\n`;
    transcript += `Tổng số tin nhắn / Total Messages: ${lightweightMessages.length} (Khách/Staff: ${userMsgCount} | Bot: ${botMsgCount} | Hệ thống: ${systemMsgCount})\n`;
    transcript += `Tổng tệp đính kèm     : ${totalAttachmentsCount}\n`;
    transcript += `Thành viên tham gia   :\n  • ${participantsList}\n`;
    transcript += `================================================================================\n\n`;

    for (const msg of lightweightMessages) {
      const timeStr = formatVNTime(msg.createdTimestamp);
      let badge = '';
      if (msg.system) badge = ' [SYSTEM / HỆ THỐNG]';
      else if (msg.isBot) badge = ' [BOT]';

      const editedInfo = msg.editedTimestamp ? ` (Đã sửa: ${formatVNTime(msg.editedTimestamp)})` : '';
      const pinnedInfo = msg.pinned ? ' 📌[PINNED]' : '';

      transcript += `[${timeStr}] ${msg.authorTag} (${msg.authorId})${badge}${pinnedInfo}${editedInfo}:\n`;

      // 1. Phản hồi tin nhắn (Reply Reference)
      if (msg.replyMessageId) {
        transcript += `  ↳ [Trả lời tin nhắn / Replying to Msg ID: ${msg.replyMessageId}]\n`;
      }

      // 2. Tin nhắn hệ thống (System)
      if (msg.system) {
        transcript += `  [Hệ thống / System]: Tin nhắn hệ thống Discord (${msg.type})\n`;
      }

      // 3. Nội dung văn bản (Content)
      if (msg.content) {
        transcript += `  ${msg.content.split('\n').join('\n  ')}\n`;
      }

      // 4. Nhãn dán (Stickers)
      if (msg.stickers.length > 0) {
        for (const stk of msg.stickers) {
          transcript += `  [Nhãn dán / Sticker]: ${stk.name} (${stk.url})\n`;
        }
      }

      // 5. Tệp đính kèm (Attachments)
      if (msg.attachments.length > 0) {
        for (const att of msg.attachments) {
          const dimStr = att.width && att.height ? ` [${att.width}x${att.height}]` : '';
          const descStr = att.description ? ` (Mô tả: "${att.description}")` : '';
          transcript += `  [Đính kèm / Attachment]: ${att.name} [${att.contentType}] (${att.sizeFormatted})${dimStr}${descStr} -> ${att.url}\n`;
        }
      }

      // 6. Embeds
      if (msg.embeds.length > 0) {
        for (let i = 0; i < msg.embeds.length; i++) {
          const emb = msg.embeds[i];
          const embIdx = msg.embeds.length > 1 ? ` #${i + 1}` : '';
          transcript += `  [Embed${embIdx}]:\n`;
          if (emb.author?.name) transcript += `    • Tác giả: ${emb.author.name}\n`;
          if (emb.title) transcript += `    • Tiêu đề: ${emb.title}${emb.url ? ` (${emb.url})` : ''}\n`;
          if (emb.description) transcript += `    • Nội dung:\n      ${emb.description.split('\n').join('\n      ')}\n`;
          if (emb.fields.length > 0) {
            for (const f of emb.fields) {
              transcript += `    • Trường [${f.name}]: ${String(f.value).split('\n').join(' ')}\n`;
            }
          }
          if (emb.image?.url) transcript += `    • Ảnh lớn: ${emb.image.url}\n`;
          if (emb.thumbnail?.url) transcript += `    • Ảnh thu nhỏ: ${emb.thumbnail.url}\n`;
          if (emb.footer?.text) transcript += `    • Chân trang: ${emb.footer.text}\n`;
          if (emb.timestamp) transcript += `    • Mốc thời gian: ${formatVNTime(emb.timestamp)}\n`;
        }
      }

      // 7. Bình chọn (Poll)
      if (msg.poll) {
        transcript += `  [Bình chọn / Poll]: ${msg.poll.question}\n`;
        for (const ans of msg.poll.answers) {
          transcript += `    • ${ans.text} (${ans.voteCount} phiếu)\n`;
        }
      }

      // 8. Cảm xúc (Reactions)
      if (msg.reactions.length > 0) {
        const reacts = msg.reactions.map(r => `${r.emoji} (${r.count})`).join(', ');
        transcript += `  [Cảm xúc / Reactions]: ${reacts}\n`;
      }

      transcript += `\n`;
    }

    transcript += `================================================================================\n`;
    transcript += `KẾT THÚC NHẬT KÝ / END OF TRANSCRIPT - LS STUDIO SYSTEM\n`;
    transcript += `================================================================================\n`;

    // Giải phóng bộ nhớ mảng
    lightweightMessages.length = 0;
    participantMap.clear();

    return transcript;
  } catch (err) {
    console.error("Lỗi tạo transcript:", err);
    return `Lỗi khi xuất transcript: ${err.message}`;
  }
}

/**
 * Kiểm tra kích thước transcript và tạo AttachmentBuilder an toàn chống lỗi 413 (Payload Too Large)
 * Nếu file vượt quá 7.5 MB (ngưỡng an toàn của giới hạn 8MB Discord), tự động chia thành nhiều file phần.
 * Nếu số phần vượt quá 10 (giới hạn file đính kèm Discord per message), tự động cắt bớt an toàn.
 * @param {string} transcriptText - Nội dung văn bản transcript
 * @param {string} baseFileName - Tên tệp cơ sở (ví dụ: transcript-mua-plugin.txt)
 * @returns {{ attachments: import('discord.js').AttachmentBuilder[], summaryAttachment: import('discord.js').AttachmentBuilder|null, totalBytes: number, partsCount: number, isSplit: boolean, isTrimmed: boolean, summaryGenerated: boolean, baseFileName: string }}
 */
function createTranscriptAttachments(transcriptText, baseFileName = 'transcript.txt') {
  const safeText = typeof transcriptText === 'string' ? transcriptText : String(transcriptText || '');
  const fullBuffer = Buffer.from(safeText, 'utf-8');
  const totalBytes = fullBuffer.byteLength;
  const SAFE_CHUNK_BYTES = Math.floor(7.5 * 1024 * 1024); // 7.5 MB safe chunk threshold (< 8 MB Discord limit)

  // Tên tệp an toàn (loại bỏ ký tự lạ)
  const cleanBaseName = (baseFileName || 'transcript.txt').replace(/[^a-zA-Z0-9._-]/g, '_');
  const rawExt = cleanBaseName.includes('.') ? cleanBaseName.substring(cleanBaseName.lastIndexOf('.')) : '.txt';
  const rawBase = cleanBaseName.includes('.') ? cleanBaseName.substring(0, cleanBaseName.lastIndexOf('.')) : cleanBaseName;

  // Trường hợp 1: File nhỏ hơn hoặc bằng 7.5 MB -> Đính kèm 1 file duy nhất
  if (totalBytes <= SAFE_CHUNK_BYTES) {
    const attachment = new AttachmentBuilder(fullBuffer, { name: cleanBaseName });
    return {
      attachments: [attachment],
      summaryAttachment: null,
      totalBytes,
      partsCount: 1,
      isSplit: false,
      isTrimmed: false,
      summaryGenerated: false,
      baseFileName: cleanBaseName
    };
  }

  // Trường hợp 2: File lớn hơn 7.5 MB -> Phân tách an toàn theo dòng / buffer slice
  const lines = safeText.split('\n');
  const stringChunks = [];
  let currentChunkLines = [];
  let currentChunkBytes = 0;

  for (let line of lines) {
    const lineByteLength = Buffer.byteLength(line, 'utf-8') + 1; // +1 cho ký tự newline

    // Xử lý trường hợp dòng đơn siêu dài (> SAFE_CHUNK_BYTES)
    if (lineByteLength > SAFE_CHUNK_BYTES) {
      if (currentChunkLines.length > 0) {
        stringChunks.push(currentChunkLines.join('\n'));
        currentChunkLines = [];
        currentChunkBytes = 0;
      }
      const lineBuf = Buffer.from(line, 'utf-8');
      for (let offset = 0; offset < lineBuf.length; offset += SAFE_CHUNK_BYTES) {
        const subBuf = lineBuf.subarray(offset, Math.min(offset + SAFE_CHUNK_BYTES, lineBuf.length));
        stringChunks.push(subBuf.toString('utf-8'));
      }
      continue;
    }

    if (currentChunkBytes + lineByteLength > SAFE_CHUNK_BYTES && currentChunkLines.length > 0) {
      stringChunks.push(currentChunkLines.join('\n'));
      currentChunkLines = [line];
      currentChunkBytes = lineByteLength;
    } else {
      currentChunkLines.push(line);
      currentChunkBytes += lineByteLength;
    }
  }
  if (currentChunkLines.length > 0) {
    stringChunks.push(currentChunkLines.join('\n'));
  }

  const MAX_DISCORD_FILES = 10;
  const totalParts = stringChunks.length;
  const isTrimmed = totalParts > MAX_DISCORD_FILES;
  const maxPartsToSend = Math.min(totalParts, MAX_DISCORD_FILES);
  const attachments = [];

  for (let i = 0; i < maxPartsToSend; i++) {
    const partNum = i + 1;
    const partBuffer = Buffer.from(stringChunks[i], 'utf-8');
    const partFileName = `${rawBase}-part${partNum}-of-${totalParts}${rawExt}`;
    attachments.push(new AttachmentBuilder(partBuffer, { name: partFileName }));
  }

  return {
    attachments,
    summaryAttachment: null,
    totalBytes,
    partsCount: totalParts,
    isSplit: true,
    isTrimmed,
    summaryGenerated: false,
    baseFileName: cleanBaseName
  };
}

/**
 * Xử lý quy trình đóng ticket tập trung, lưu trữ transcript, gửi DM và ghi nhật ký quản trị
 * @param {Object} params
 * @param {import('discord.js').TextChannel} params.channel - Kênh ticket
 * @param {import('discord.js').Guild} params.guild - Máy chủ
 * @param {import('discord.js').User} params.closerUser - Người thực hiện đóng ticket
 * @param {string|null} params.closeReason - Lý do đóng ticket
 * @returns {Promise<boolean>}
 */
async function executeTicketClosure({ channel, guild, closerUser, closeReason = null }) {
  if (!channel || !channel.isTextBased() || !channel.id) return false;

  // Chống race condition: không đóng trùng kênh ticket đang xử lý
  if (closingTicketChannels.has(channel.id)) {
    return false;
  }
  closingTicketChannels.add(channel.id);

  try {
    const transcriptText = await generateTranscript(channel, closeReason);
    const baseFileName = `transcript-${channel.name}.txt`;
    const attachmentResult = createTranscriptAttachments(transcriptText, baseFileName);

    // 1. Trích xuất ID người mở ticket từ Topic hoặc Overwrites hoặc Tin nhắn đầu tiên
    let openerId = null;
    if (channel.topic) {
      const openerMatch = channel.topic.match(/\((\d{17,20})\)/) || channel.topic.match(/\b(\d{17,20})\b/);
      if (openerMatch) openerId = openerMatch[1];
    }
    if (!openerId && channel.permissionOverwrites?.cache) {
      // Tìm member overwrite không phải bot và không phải người đóng
      const memberOverwrite = channel.permissionOverwrites.cache.find(po => 
        po.type === 1 && po.id !== client.user?.id && po.id !== closerUser.id
      );
      if (memberOverwrite) openerId = memberOverwrite.id;
    }

    // 2. Gửi Transcript qua tin nhắn riêng (DM) cho người mở ticket (Bắt lỗi an toàn khi user tắt/chặn DM)
    let dmStatusNote = "Không tìm thấy thông tin người mở ticket";
    if (openerId) {
      try {
        const openerUser = await client.users.fetch(openerId).catch(() => null);
        if (openerUser) {
          const sizeFormatted = attachmentResult.totalBytes >= 1024 * 1024
            ? `${(attachmentResult.totalBytes / (1024 * 1024)).toFixed(2)} MB`
            : `${(attachmentResult.totalBytes / 1024).toFixed(1)} KB`;

          const safeCloserTag = sanitizeSingleLineHeader(closerUser.tag || closerUser.username, 50);
          const safeReasonDisplay = closeReason ? sanitizeMarkdownForEmbed(closeReason, 300) : null;

          const dmEmbed = new EmbedBuilder()
            .setColor("#5865F2")
            .setTitle("📑 BẢN LƯU NHẬT KÝ TICKET - LS STUDIO")
            .setDescription(
              `👋 Chào <@${openerId}>!\n\n` +
              `Ticket **#${sanitizeMarkdownForEmbed(channel.name, 50)}** của bạn tại **LS STUDIO** đã được đóng bởi <@${closerUser.id}> (\`${safeCloserTag}\`).\n` +
              (safeReasonDisplay ? `📝 **Lý do đóng / Ghi chú:** \`${safeReasonDisplay}\`\n` : '') +
              `📦 **Kích thước bản lưu:** \`${sizeFormatted}\`${attachmentResult.isSplit ? ` (Được chia làm ${attachmentResult.partsCount} tệp)` : ''}\n\n` +
              `Đính kèm bên dưới là toàn bộ lịch sử tin nhắn (Transcript) để bạn tiện theo dõi và tra cứu khi cần.\n\n` +
              `*Thank you for contacting LS STUDIO! Your ticket transcript is attached below.*`
            )
            .setFooter({ text: "LS STUDIO • Hỗ Trợ 24/7" })
            .setTimestamp();

          if (attachmentResult.isSplit) {
            // Gửi tin nhắn chính kèm Summary và Phần 1
            const primaryFiles = [attachmentResult.summaryAttachment, attachmentResult.attachments[0]].filter(Boolean);
            await openerUser.send({ embeds: [dmEmbed], files: primaryFiles }).catch(err => {
              throw err;
            });
            // Gửi các phần còn lại theo từng tin nhắn riêng lẻ chống 413 Payload Too Large
            for (let i = 1; i < attachmentResult.attachments.length; i++) {
              await openerUser.send({ files: [attachmentResult.attachments[i]] }).catch(() => {});
            }
          } else {
            await openerUser.send({ embeds: [dmEmbed], files: attachmentResult.attachments }).catch(err => {
              throw err;
            });
          }
          dmStatusNote = "✅ Đã gửi bản sao qua DM thành công";
        } else {
          dmStatusNote = "⚠️ Không tìm thấy tài khoản người dùng trên Discord";
        }
      } catch (dmErr) {
        if (dmErr.code === 50007) {
          dmStatusNote = "⚠️ Khách tắt nhận DM từ server hoặc chặn Bot (Code 50007)";
        } else {
          dmStatusNote = `⚠️ Lỗi gửi DM: ${dmErr.message || 'Không xác định'}`;
        }
        console.warn(`⚠️ [Transcript DM] Không thể gửi DM cho user ${openerId}: ${dmStatusNote}`);
      }
    }

    // 3. Gửi Transcript về kênh Quản Trị / Log Channel
    try {
      const configLogChannelId = process.env.LOG_CHANNEL_ID || process.env.TICKET_LOG_CHANNEL_ID || process.env.TRANSCRIPT_LOG_CHANNEL_ID;
      let logChannel = null;
      if (configLogChannelId && guild) {
        logChannel = guild.channels.cache.get(configLogChannelId) || await guild.channels.fetch(configLogChannelId).catch(() => null);
      }

      if (!logChannel && guild) {
        const isLogName = (name) => {
          const n = (name || '').toLowerCase();
          return n.includes("nhật-ký-giao-dịch") ||
                 n.includes("ticket-log") ||
                 n.includes("ticket-transcript") ||
                 n.includes("transcripts") ||
                 n.includes("transcript") ||
                 n.includes("nhật-ký") ||
                 n === "log" || n === "logs" ||
                 n.startsWith("log-") || n.endsWith("-log") || n.endsWith("-logs");
        };

        logChannel = guild.channels.cache.find(c => c.isTextBased() && isLogName(c.name));
        if (!logChannel) {
          const fetchedChannels = await guild.channels.fetch().catch(() => null);
          if (fetchedChannels) {
            logChannel = fetchedChannels.find(c => c && c.isTextBased() && isLogName(c.name));
          }
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
          const sizeFormatted = attachmentResult.totalBytes >= 1024 * 1024
            ? `${(attachmentResult.totalBytes / (1024 * 1024)).toFixed(2)} MB`
            : `${(attachmentResult.totalBytes / 1024).toFixed(1)} KB`;

          const safeCloserTag = sanitizeSingleLineHeader(closerUser.tag || closerUser.username, 50);
          const safeReasonDisplay = closeReason ? sanitizeMarkdownForEmbed(closeReason, 1000) : null;

          const logEmbed = new EmbedBuilder()
            .setColor("#FF5252")
            .setTitle("📑 NHẬT KÝ ĐÓNG TICKET / TICKET TRANSCRIPT LOG")
            .addFields(
              { name: "📁 Kênh / Channel", value: `\`${sanitizeMarkdownForEmbed(channel.name, 50)}\` (\`${channel.id}\`)`, inline: true },
              { name: "👤 Người mở / Opener", value: openerId ? `<@${openerId}> (\`${openerId}\`)` : "N/A", inline: true },
              { name: "🔒 Người đóng / Closed By", value: `<@${closerUser.id}> (\`${safeCloserTag}\`)`, inline: true },
              ...(safeReasonDisplay ? [{ name: "📝 Lý do đóng / Reason", value: safeReasonDisplay, inline: false }] : []),
              { name: "⏰ Thời gian / Time", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
              { name: "📦 Dung lượng / Size", value: `\`${sizeFormatted}\`${attachmentResult.isSplit ? ` (${attachmentResult.partsCount} tệp)` : ''}`, inline: true },
              { name: "📨 Trạng thái gửi DM Khách", value: dmStatusNote, inline: false }
            )
            .setFooter({ text: "LS STUDIO Ticket Security & Audit" })
            .setTimestamp();

          if (!canAttach) {
            logEmbed.addFields({ name: "⚠️ Quyền đính kèm", value: "Bot thiếu quyền `AttachFiles` để gửi kèm file transcript." });
          }

          if (canEmbed) {
            if (canAttach && attachmentResult.isSplit) {
              const primaryFiles = [attachmentResult.summaryAttachment, attachmentResult.attachments[0]].filter(Boolean);
              await logChannel.send({ embeds: [logEmbed], files: primaryFiles }).catch(err => {
                console.error("❌ Lỗi gửi log transcript có embed:", err);
              });
              for (let i = 1; i < attachmentResult.attachments.length; i++) {
                await logChannel.send({ files: [attachmentResult.attachments[i]] }).catch(() => {});
              }
            } else {
              const filesToSend = canAttach ? attachmentResult.attachments : [];
              await logChannel.send({ embeds: [logEmbed], files: filesToSend }).catch(err => {
                console.error("❌ Lỗi gửi log transcript có embed:", err);
              });
            }
          } else {
            const textContent = `📑 **NHẬT KÝ ĐÓNG TICKET**\n• Kênh: \`${sanitizeMarkdownForEmbed(channel.name, 50)}\`\n• Người mở: <@${openerId || 'N/A'}>\n• Người đóng: <@${closerUser.id}>\n• Lý do: ${safeReasonDisplay || 'N/A'}\n• DM Khách: ${dmStatusNote}`;
            if (canAttach && attachmentResult.isSplit) {
              const primaryFiles = [attachmentResult.summaryAttachment, attachmentResult.attachments[0]].filter(Boolean);
              await logChannel.send({ content: textContent, files: primaryFiles }).catch(err => {
                console.error("❌ Lỗi gửi log transcript dạng text:", err);
              });
              for (let i = 1; i < attachmentResult.attachments.length; i++) {
                await logChannel.send({ files: [attachmentResult.attachments[i]] }).catch(() => {});
              }
            } else {
              const filesToSend = canAttach ? attachmentResult.attachments : [];
              await logChannel.send({ content: textContent, files: filesToSend }).catch(err => {
                console.error("❌ Lỗi gửi log transcript dạng text:", err);
              });
            }
          }
        }
      } else {
        console.warn(`⚠️ [Transcript Audit Warning] Không tìm thấy kênh nhật ký (nhật-ký-giao-dịch) trên server ${guild?.name || 'N/A'}.`);
        console.info(`📋 [Emergency Audit Log] Ticket #${channel.name} (${channel.id}) closed by ${closerUser.id}. Opener: ${openerId || 'N/A'}. DM: ${dmStatusNote}. Size: ${(attachmentResult.totalBytes / 1024).toFixed(1)} KB`);
      }
    } catch (logErr) {
      console.error("❌ Lỗi xử lý gửi transcript về log channel:", logErr);
    }

    // 4. Xóa kênh sau 5 giây an toàn & giải phóng bộ nhớ cache
    setTimeout(async () => {
      try {
        const ch = await guild?.channels.fetch(channel.id).catch(() => null);
        if (ch && ch.deletable) {
          ch.messages?.cache?.clear();
          await ch.delete(`Ticket closed by ${closerUser.tag || closerUser.username} (${closerUser.id})`).catch(delErr => {
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

    return true;
  } finally {
    // Giữ lock 10s cho tới khi channel bị xóa hoàn toàn
    setTimeout(() => {
      closingTicketChannels.delete(channel.id);
    }, 10000).unref();
  }
}

// Helper: Sinh Menu chọn gói theo ngôn ngữ
// Helper: Sinh Menu 1 (Plugin Minecraft & Dịch Vụ AI)
function buildPackageSelectMenu(userId, lang = 'vi') {
  const isEn = lang === 'en';
  const placeholderText = isEn 
    ? '🎮 [Menu 1] Select Minecraft Plugins & AI Services...' 
    : '🎮 [Menu 1] Chọn Plugin Minecraft & Dịch Vụ AI...';

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`select_package_${lang}_${userId}`.slice(0, 100))
    .setPlaceholder(placeholderText.slice(0, 150));

  menu.addOptions(
    // Plugin Minecraft
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'LS-AntiCheat • $1.50 (30.000 VNĐ)' : 'LS-AntiCheat • 30.000 VNĐ')
      .setDescription(isEn ? 'WallHit, Inv checks, AutoEat/Potion/Fish, Health spoof' : 'WallHit xuyên mạng nhện/tường, Inv A-F, AutoEat/Fish/Potion, Fake Máu')
      .setValue('ls_anticheat')
      .setEmoji('🛡️'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Addon Anti-Macro Cart • $1.00/Mo (20.000 VNĐ/Tháng)' : 'Addon Anti-Macro Cart • 20.000 VNĐ/Tháng')
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
      .setLabel(isEn ? 'Custom Plugin & Mod Development' : 'Đặt Làm Plugin & Mod Java Custom')
      .setDescription(isEn ? 'Discuss and build custom server plugins/mods with Dev' : 'Trao đổi ý tưởng làm Plugin & Mod Java theo yêu cầu')
      .setValue('custom_dev')
      .setEmoji('📝'),

    // Dịch vụ AI
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Gemini Family Main Account (18 Mo) • $1.50 (35.000 VNĐ)' : 'Acc Gemini Family Nâng Chính Chủ (18 Tháng) • 35.000 VNĐ')
      .setDescription(isEn ? 'Direct 18-month upgrade on your Gmail, 2TB Cloud' : 'Nâng chính chủ Gmail 18 tháng, Gemini Advanced, 2TB Cloud')
      .setValue('acc_gemini_family_18m')
      .setEmoji('🌟'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Gemini Pro Activation Link (18 Mo) • $2.00 (49.000 VNĐ)' : 'Link Kích Hoạt Gemini Pro (18 Tháng) • 49.000 VNĐ')
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
      .setLabel(isEn ? 'Claude Max 20 Account (1 Mo) • $3.50 (89.000 VNĐ)' : 'Tài Khoản Claude Max 20 (1 Tháng) • 89.000 VNĐ')
      .setDescription(isEn ? 'Full access to Claude Sonnet 5, Opus 5, Fable 5 for 30d' : 'Hạn mức cao Max 20, dùng Claude Fable 5, Opus 5, Sonnet 5')
      .setValue('acc_claude_max20')
      .setEmoji('👑'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'ChatGPT Plus GPT-5.6 (1 Mo) • $6.80 (169.000 VNĐ)' : 'Tài Khoản ChatGPT Plus GPT-5.6 (1 Tháng) • 169.000 VNĐ')
      .setDescription(isEn ? 'Full GPT-5.6 Sol, DALL-E, Voice Chat with 30-day warranty' : 'GPT-5.6 Sol, DALL-E 3, Voice Chat, Canvas 2.0, bảo hành 1 tháng')
      .setValue('acc_chatgpt_plus')
      .setEmoji('⭐'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Monica AI Pro Claude 5 (3 Days) • $2.00 (49.000 VNĐ)' : 'Tài Khoản Monica AI Pro Claude 5 (3 Ngày) • 49.000 VNĐ')
      .setDescription(isEn ? 'Claude Sonnet 5, Opus 5, GPT-5.6 Sol, Gemini 2.5 Pro' : 'Gói Pro 3 ngày có Claude 5, GPT-5.6 Sol, Gemini 2.5 Pro')
      .setValue('acc_monica_pro_3d')
      .setEmoji('✨')
  );

  return menu;
}

// Helper: Sinh Menu 2 (CapCut, Nitro, YouTube, Netflix, Discord, Windows, Office, VPN, Spotify, Zoom)
function buildPackageSelectMenu2(userId, lang = 'vi') {
  const isEn = lang === 'en';
  const placeholderText = isEn 
    ? '🎁 [Menu 2] CapCut, Windows, Office, VPN, Media & MMO...' 
    : '🎁 [Menu 2] CapCut, Windows, Office, VPN, Giải Trí & MMO...';

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`select_package_${lang}_${userId}_2`.slice(0, 100))
    .setPlaceholder(placeholderText.slice(0, 150));

  menu.addOptions(
    // CapCut Pro (6)
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'CapCut Pro (3 Days) • $0.60 (14.000 VNĐ)' : 'CapCut Pro Cá Nhân (3 Ngày) • 14.000 VNĐ')
      .setDescription(isEn ? 'Full Pro features, no watermark, 4K export' : 'Mở khóa tính năng Pro 3 ngày, xóa logo watermark, xuất 4K')
      .setValue('capcut_pro_3d')
      .setEmoji('🎬'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'CapCut Pro (14 Days) • $1.60 (39.000 VNĐ)' : 'CapCut Pro Cá Nhân (14 Ngày) • 39.000 VNĐ')
      .setDescription(isEn ? 'VIP effects, licensed music, auto AI captions' : 'Gói 14 ngày, hiệu ứng VIP, kho nhạc bản quyền, phụ đề AI')
      .setValue('capcut_pro_14d')
      .setEmoji('🎬'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'CapCut Pro (1 Mo) • $3.00 (75.000 VNĐ)' : 'CapCut Pro Cá Nhân (1 Tháng) • 75.000 VNĐ')
      .setDescription(isEn ? 'Full 30-day personal account, PC & Mobile' : 'CapCut Pro cá nhân 1 tháng dùng PC & Mobile, bảo hành 30 ngày')
      .setValue('capcut_pro_1m')
      .setEmoji('🎬'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'CapCut Pro (3 Mo) • $8.00 (200.000 VNĐ)' : 'CapCut Pro Cá Nhân (3 Tháng) • 200.000 VNĐ')
      .setDescription(isEn ? '3-Month personal pack, 90-day 1:1 replacement' : 'Gói 3 tháng tiết kiệm, bảo hành 1 đổi 1 suốt 90 ngày')
      .setValue('capcut_pro_3m')
      .setEmoji('🎬'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'CapCut Pro (6 Mo) • $15.50 (390.000 VNĐ)' : 'CapCut Pro Cá Nhân (6 Tháng) • 390.000 VNĐ')
      .setDescription(isEn ? '6-Month personal pack (180 days), best value' : 'Gói 6 tháng siêu ưu đãi, dùng ổn định 180 ngày')
      .setValue('capcut_pro_6m')
      .setEmoji('🎬'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'CapCut Pro Team 2TB (1 Mo) • $4.00 (100.000 VNĐ)' : 'CapCut Pro Team 2TB Cloud (1 Tháng) • 100.000 VNĐ')
      .setDescription(isEn ? 'Team upgrade with 2TB high-speed cloud storage' : 'Nâng cấp CapCut Pro nhóm/team kèm 2TB Cloud lưu trữ video')
      .setValue('capcut_pro_team_1m')
      .setEmoji('👥'),

    // Nitro & Media (4)
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? '2 Discord Server Boosts • $0.80 (20.000 VNĐ)' : '2 Boost Server Discord Nitro • 20.000 VNĐ')
      .setDescription(isEn ? '2 Boosts for your server, unlock animated icon & perks' : '2 Boost mở khóa avatar động, âm thanh 128kbps, banner')
      .setValue('boost_nitro_2x')
      .setEmoji('🚀'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'YouTube Premium (1 Mo) • $1.00 (25.000 VNĐ)' : 'Tài Khoản YouTube Premium (1 Tháng) • 25.000 VNĐ')
      .setDescription(isEn ? 'Ad-free videos, background play, YouTube Music' : 'Xem không quảng cáo, chạy nền, YouTube Music bản quyền')
      .setValue('acc_youtube_premium_1m')
      .setEmoji('📺'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Netflix Premium (1 Week) • $0.80 (20.000 VNĐ)' : 'Tài Khoản Netflix Premium (1 Tuần) • 20.000 VNĐ')
      .setDescription(isEn ? 'Ultra HD 4K streaming with 1-week full warranty' : 'Xem phim Ultra HD 4K mọi thiết bị, bảo hành trọn 1 tuần')
      .setValue('acc_netflix_1w')
      .setEmoji('🍿'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Spotify Premium (3 Mo Family) • $5.60 (139.000 VNĐ)' : 'Spotify Premium 3 Tháng (Add Family) • 139.000 VNĐ')
      .setDescription(isEn ? 'Ad-free streaming, 320kbps audio, 3-month warranty' : 'Nghe nhạc Lossless 320kbps không quảng cáo, bảo hành 3 tháng')
      .setValue('acc_spotify_premium_3m')
      .setEmoji('🎵'),

    // Discord Accounts (3)
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Discord Verified Account • $0.30 (7.000 VNĐ)' : 'Acc Discord Veri Mail + SĐT • 7.000 VNĐ')
      .setDescription(isEn ? 'Email + Phone number verified, clean & ready' : 'Đã xác minh đầy đủ Email và SĐT, bao trâu dùng ổn định')
      .setValue('acc_discord_ver_mail_sdt')
      .setEmoji('💬'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Aged Discord Account (2018-2025) • $2.00 (49.000 VNĐ)' : 'Acc Discord Cổ (2018 - 2025) • 49.000 VNĐ')
      .setDescription(isEn ? 'Aged Discord account, highly trusted' : 'Acc Discord tạo lâu năm, chống checkpoint cực tốt')
      .setValue('acc_discord_aged_2018_2025')
      .setEmoji('📜'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Prime Aged Discord (2016-2019) • $2.60 (65.000 VNĐ)' : 'Acc Discord Cổ Siêu Trâu (2016 - 2019) • 65.000 VNĐ')
      .setDescription(isEn ? 'Prime vintage Discord account, battle-tested' : 'Acc Discord cổ từ 2016-2019, cực hiếm và trâu')
      .setValue('acc_discord_aged_2016_2019')
      .setEmoji('🏛️'),

    // Windows & Office (4)
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Windows 10/11 Pro Key • $1.50 (35.000 VNĐ)' : 'Key Windows 10/11 Pro Vĩnh Viễn • 35.000 VNĐ')
      .setDescription(isEn ? 'Lifetime retail activation key for Win 10/11 Pro' : 'Key kích hoạt vĩnh viễn Win 10/11 Pro, update thoải mái')
      .setValue('key_windows_pro')
      .setEmoji('💻'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Office 2024 Pro Plus Key • $1.60 (39.000 VNĐ)' : 'Key Office 2021/2024 Pro Plus • 39.000 VNĐ')
      .setDescription(isEn ? 'Lifetime key for Word, Excel, PowerPoint Pro Plus' : 'Key vĩnh viễn Word, Excel, PowerPoint, Outlook bản Pro Plus')
      .setValue('key_office_pro_plus')
      .setEmoji('📑'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Microsoft 365 (1 Mo) • $1.80 (45.000 VNĐ)' : 'Microsoft 365 Chính Chủ (1 Tháng) • 45.000 VNĐ')
      .setDescription(isEn ? 'Official personal account upgrade, 1TB OneDrive' : 'Nâng chính chủ Microsoft, full ứng dụng Office + 1TB Cloud')
      .setValue('acc_office_365_1m')
      .setEmoji('☁️'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Microsoft 365 (12 Mo) • $10.80 (269.000 VNĐ)' : 'Microsoft 365 Chính Chủ (1 Năm) • 269.000 VNĐ')
      .setDescription(isEn ? '1-Year official upgrade, 1TB OneDrive cloud' : 'Gói 1 năm Microsoft 365 Family nâng chính chủ, 1TB OneDrive')
      .setValue('acc_office_365_12m')
      .setEmoji('👑'),

    // Đồ Họa & Thiết Kế (3)
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Canva Pro / Edu (1 Year) • $2.80 (69.000 VNĐ)' : 'Tài Khoản Canva Pro / Edu (1 Năm) • 69.000 VNĐ')
      .setDescription(isEn ? 'Full Pro templates, Magic AI tools, 1-click cutout' : 'Mở khóa kho mẫu Pro, công cụ Magic AI, xóa phông 1 click')
      .setValue('acc_canva_pro_1y')
      .setEmoji('🎨'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Adobe Photoshop + Lightroom (1 Mo) • $4.00 (99.000 VNĐ)' : 'Adobe Photoshop + Lightroom (1 Tháng) • 99.000 VNĐ')
      .setDescription(isEn ? 'Official photography plan, generative AI fill' : 'Bản quyền Photoshop + Lightroom, tính năng Generative AI')
      .setValue('acc_adobe_photography')
      .setEmoji('🖌️'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Adobe Full App (20+ Apps) • $6.00 (149.000 VNĐ)' : 'Adobe Full App (Pts, Pr, Ai, Ae) • 149.000 VNĐ')
      .setDescription(isEn ? 'Full 20+ Creative Cloud apps for 1 month' : 'Trọn bộ 20+ app Adobe: Photoshop, Premiere, After Effects')
      .setValue('acc_adobe_full_app')
      .setEmoji('💎'),

    // VPN (2)
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'HMA VPN (30 Days - 5 Devices) • $1.50 (35.000 VNĐ)' : 'Key HMA VPN (30 Ngày - 5 Máy) • 35.000 VNĐ')
      .setDescription(isEn ? '190+ countries, high speed, multi-device' : 'VPN 190+ quốc gia, đổi IP siêu nhanh cho game thủ và MMO')
      .setValue('key_hma_vpn_30d')
      .setEmoji('🛡️'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'NordVPN (30 Days) • $1.00 (25.000 VNĐ)' : 'Tài Khoản NordVPN (30 Ngày) • 25.000 VNĐ')
      .setDescription(isEn ? 'Military-grade encryption, ultra fast speed' : 'Bảo mật quân đội, tốc độ tải cực nhanh, chống rò rỉ IP')
      .setValue('acc_nord_vpn_30d')
      .setEmoji('⚡'),

    // Học tập & Họp (3)
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Zoom Pro Unlimited (1 Mo) • $4.80 (119.000 VNĐ)' : 'Zoom Pro Không Giới Hạn (1 Tháng) • 119.000 VNĐ')
      .setDescription(isEn ? 'No 40-minute limit, 100-300 participants, cloud rec' : 'Bỏ giới hạn 40 phút, phòng 100-300 người, ghi hình Cloud')
      .setValue('acc_zoom_pro_1m')
      .setEmoji('📹'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Google Meet Unlimited (1 Mo) • $3.20 (79.000 VNĐ)' : 'Google Meet Không Giới Hạn (1 Tháng) • 79.000 VNĐ')
      .setDescription(isEn ? 'Unlimited conference calls without 60-min cutoff' : 'Gọi video Google Meet không lo ngắt quãng giới hạn 60 phút')
      .setValue('acc_google_meet_1m')
      .setEmoji('📞'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Turnitin Plagiarism (1 Mo) • $8.00 (199.000 VNĐ)' : 'Tài Khoản Turnitin Check Đạo Văn (1 Tháng) • 199.000 VNĐ')
      .setDescription(isEn ? 'Plagiarism check without repository storage' : 'Check đạo văn luận văn/bài tập, không lưu kho dữ liệu')
      .setValue('acc_turnitin_1m')
      .setEmoji('📚')
  );

  return menu;
}

// Helper: Sinh 2 ActionRow chứa cả Menu 1 và Menu 2 cho Ticket
function buildPackageSelectMenuRows(userId, lang = 'vi') {
  return [
    new ActionRowBuilder().addComponents(buildPackageSelectMenu(userId, lang)),
    new ActionRowBuilder().addComponents(buildPackageSelectMenu2(userId, lang))
  ];
}

// Helper: Khởi tạo kênh Ticket an toàn với đầy đủ phân quyền, kiểm tra trùng lặp và phục hồi lỗi giới hạn kênh Discord
async function createTicketChannel({ guild, user, ticketType = '🛒-mua', customTopic = null }) {
  if (!guild) {
    throw new Error("Không tìm thấy thông tin máy chủ Discord (Guild)! / Guild not found.");
  }

  // 1. Kiểm tra giới hạn 500 kênh tối đa của Guild (Discord Guild Channel Limit)
  const totalGuildChannels = guild.channels?.cache ? guild.channels.cache.size : 0;
  if (totalGuildChannels >= 500) {
    const limitErr = new Error("Máy chủ đã đạt giới hạn tối đa 500 kênh của Discord! Vui lòng liên hệ Quản trị viên xóa bớt các kênh cũ.");
    limitErr.code = 30013;
    throw limitErr;
  }

  // 2. Kiểm tra quyền ManageChannels của Bot
  const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
  if (!botMember || !botMember.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
    throw new Error("Bot thiếu quyền `Manage Channels` (Quản Lý Kênh) để tạo Ticket! Vui lòng liên hệ Quản trị viên cấp quyền.");
  }

  // 3. Kiểm tra Duplicate Ticket: Quét các channel còn tồn tại xem user đã có ticket chưa (bằng topic)
  const existingTicket = guild.channels.cache.find(c => 
    c && 
    !c.deleted &&
    c.type === ChannelType.GuildText &&
    c.topic && c.topic.includes(`(${user.id})`)
  );

  if (existingTicket) {
    return { existingTicket, ticketChannel: null, staffMentionString: "" };
  }

  // 4. Xử lý tên kênh an toàn chống ký tự đặc biệt / rỗng
  const sanitizedUsername = (user.username || 'user').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
  const userSuffix = user.id.slice(-4);
  const safeName = sanitizedUsername.length >= 2 ? `${sanitizedUsername}-${userSuffix}` : `user-${userSuffix}`;
  const channelName = `${ticketType}-${safeName}`;

  // 5. Tìm danh mục Ticket và kiểm tra giới hạn 50 kênh / category (Discord Category Limit)
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

  let targetParentId = null;
  if (ticketCat) {
    const catChildCount = guild.channels.cache.filter(c => c && !c.deleted && c.parentId === ticketCat.id).size;
    if (catChildCount < 50) {
      targetParentId = ticketCat.id;
    } else {
      console.warn(`⚠️ [Category Limit] Danh mục "${ticketCat.name}" đã đạt 50 kênh! Tìm kiếm danh mục ticket khác còn chỗ...`);
      const altCat = guild.channels.cache.find(c =>
        c && !c.deleted && c.id !== ticketCat.id && c.type === ChannelType.GuildCategory &&
        (c.name.includes("MUA HÀNG") || c.name.includes("HỖ TRỢ") || c.name.toLowerCase().includes("ticket")) &&
        guild.channels.cache.filter(ch => ch && !ch.deleted && ch.parentId === c.id).size < 50
      );
      if (altCat) {
        targetParentId = altCat.id;
      } else {
        console.warn(`⚠️ [Category Limit] Không còn danh mục Ticket nào dưới 50 kênh. Tự động fallback tạo ticket ở root level (không parent).`);
        targetParentId = null;
      }
    }
  }

  // 6. Lấy tất cả các Role Staff / Developer / Founder / Admin
  let staffRoles = guild.roles.cache.filter(r => 
    r && r.name && !r.managed && r.id !== guild.id && (
      r.name.includes("Staff") || 
      r.name.includes("Developer") || 
      r.name.includes("Founder") || 
      r.name.includes("Admin")
    )
  );

  if (staffRoles.size === 0) {
    const fetchedRoles = await guild.roles.fetch().catch(() => null);
    if (fetchedRoles) {
      staffRoles = fetchedRoles.filter(r => 
        r && r.name && !r.managed && r.id !== guild.id && (
          r.name.includes("Staff") || 
          r.name.includes("Developer") || 
          r.name.includes("Founder") || 
          r.name.includes("Admin")
        )
      );
    }
  }

  const everyoneRoleId = guild.roles?.everyone?.id || guild.roles?.cache?.get(guild.id)?.id || guild.id;
  const botUserId = client.user?.id || (botMember ? botMember.id : client.application?.id) || 'bot_id';
  const targetUserId = user?.id || 'user_id';

  const overwrites = [
    {
      id: everyoneRoleId,
      type: OverwriteType.Role,
      deny: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory
      ]
    },
    {
      id: targetUserId,
      type: OverwriteType.Member,
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
      id: botUserId,
      type: OverwriteType.Member,
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
      type: OverwriteType.Role,
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

  const safeUsername = sanitizeCustomerName(user?.tag || user?.username, 32, 'user');
  const topic = sanitizeDiscordChannelTopic(customTopic || `Ticket của @${safeUsername} (${user?.id || 'id'}) • Type: ${ticketType}`);

  let ticketChannel;
  try {
    ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: targetParentId,
      topic: topic,
      permissionOverwrites: overwrites,
      reason: `LS Studio - Ticket created for ${user?.tag || user?.id}`
    });
  } catch (createErr) {
    // Tự động phục hồi khi category bị vượt quá 50 kênh từ phía Discord API (Code 30005)
    if (createErr.code === 30005 && targetParentId) {
      console.warn(`⚠️ [Channel Limit Recovery] Discord trả về lỗi 30005 (Category 50 limit). Tự động fallback tạo ticket ở root level không có parent.`);
      ticketChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: null,
        topic: topic,
        permissionOverwrites: overwrites,
        reason: `LS Studio - Ticket created for ${user?.tag || user?.id} (Fallback root level)`
      });
    } else {
      throw createErr;
    }
  }

  const staffMentionString = staffRoles.size > 0 
    ? Array.from(staffRoles.values()).map(r => `<@&${r.id}>`).join(' ')
    : "";

  return { existingTicket: null, ticketChannel, staffMentionString, staffRoles };
}

// Helper: Khởi tạo Modal Đặt Làm Plugin / Mod Custom (Đáp ứng 100% Discord Modal Specs)
function createCustomOrderModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_custom_order')
    .setTitle('📝 Đặt Làm Plugin & Mod Custom'); // 32 ký tự <= 45

  const row1 = new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId('custom_project_type')
      .setLabel('Loại sản phẩm (Plugin / Mod Java / Khác)') // 41 ký tự <= 45
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('VD: Plugin Spigot/Paper, Mod Forge/Fabric...') // 45 ký tự <= 100
      .setRequired(true)
      .setMaxLength(50)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId('custom_version')
      .setLabel('Phiên bản Minecraft / Nền tảng server') // 39 ký tự <= 45
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('VD: Paper 1.20.4, Fabric 1.21, Purpur 1.16.5') // 45 ký tự <= 100
      .setRequired(true)
      .setMaxLength(50)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId('custom_features')
      .setLabel('Mô tả tính năng & cơ chế yêu cầu') // 34 ký tự <= 45
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Mô tả chi tiết các lệnh, quyền hạn (permissions) và chức năng mong muốn...') // 77 ký tự <= 100
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(1500)
  );

  const row4 = new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId('custom_budget_deadline')
      .setLabel('Ngân sách dự kiến & Thời hạn mong muốn') // 39 ký tự <= 45
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('VD: 200.000 - 500.000 VNĐ, trong 3 ngày...') // 43 ký tự <= 100
      .setRequired(false)
      .setMaxLength(100)
  );

  const row5 = new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId('custom_contact')
      .setLabel('Ghi chú thêm hoặc Liên hệ khác') // 31 ký tự <= 45
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Zalo / Facebook / Telegram hoặc ghi chú...') // 44 ký tự <= 100
      .setRequired(false)
      .setMaxLength(100)
  );

  modal.addComponents(row1, row2, row3, row4, row5);
  return modal;
}

// Helper: Khởi tạo Modal Yêu Cầu Hỗ Trợ Kỹ Thuật (Support Ticket Modal)
function createSupportTicketModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_support_ticket')
    .setTitle('🛠️ Yêu Cầu Hỗ Trợ Kỹ Thuật'); // 27 ký tự <= 45

  const row1 = new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId('support_issue_title')
      .setLabel('Tóm tắt vấn đề / Tiêu đề lỗi') // 31 ký tự <= 45
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('VD: Lỗi không nhận lệnh, crash server, config lỗi...') // 54 ký tự <= 100
      .setRequired(true)
      .setMaxLength(100)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId('support_server_env')
      .setLabel('Phiên bản Server & Môi trường chạy') // 36 ký tự <= 45
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('VD: Paper 1.20.4, Java 17, Purpur 1.16.5...') // 43 ký tự <= 100
      .setRequired(true)
      .setMaxLength(50)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId('support_description')
      .setLabel('Mô tả chi tiết lỗi & Log (Stacktrace)') // 39 ký tự <= 45
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Mô tả cách tái hiện lỗi, paste đoạn log lỗi hoặc link mclo.gs / hastebin...') // 77 ký tự <= 100
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(1500)
  );

  modal.addComponents(row1, row2, row3);
  return modal;
}

// Helper: Khởi tạo Modal Đóng Ticket Kèm Lý Do (Close Ticket with Reason Modal)
function createCloseTicketReasonModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_close_ticket_reason')
    .setTitle('🔒 Đóng Ticket Kèm Lý Do'); // 25 ký tự <= 45

  const row1 = new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId('close_reason')
      .setLabel('Lý do đóng ticket / Ghi chú bàn giao') // 38 ký tự <= 45
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('VD: Đã hoàn tất hỗ trợ và giao file cho khách hàng...') // 54 ký tự <= 100
      .setRequired(true)
      .setMinLength(3)
      .setMaxLength(500)
  );

  modal.addComponents(row1);
  return modal;
}

// Helper: Khởi tạo Modal Gửi Đánh Giá Dịch Vụ (Feedback & Review Modal)
function createFeedbackModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_feedback')
    .setTitle('⭐ Đánh Giá Dịch Vụ - LS STUDIO'); // 33 ký tự <= 45

  const row1 = new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId('feedback_rating')
      .setLabel('Đánh giá chất lượng (1 đến 5 sao)') // 35 ký tự <= 45
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Nhập số sao (Ví dụ: 5 hoặc ⭐⭐⭐⭐⭐)') // 38 ký tự <= 100
      .setRequired(true)
      .setMaxLength(15)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId('feedback_comment')
      .setLabel('Nhận xét & Trải nghiệm của bạn') // 32 ký tự <= 45
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Chia sẻ cảm nghĩ, độ hài lòng hoặc đề xuất cải tiến...')
      .setRequired(false)
      .setMaxLength(1000)
  );

  modal.addComponents(row1, row2);
  return modal;
}

// =========================================================================
// 6.1 DISCORD COMPONENTS V2 BUILDERS & HELPER ENGINE (DUAL-MODE & FALLBACK)
// =========================================================================

/**
 * Kiểm tra xem môi trường hiện tại có hỗ trợ Discord Components V2 hay không
 */
function isComponentsV2Available() {
  return typeof ContainerBuilder === 'function' && 
         typeof SectionBuilder === 'function' && 
         typeof TextDisplayBuilder === 'function' && 
         typeof SeparatorBuilder === 'function';
}

/**
 * Helper tạo Message Payload theo chuẩn Discord Components V2 với ContainerBuilder,
 * Sections, TextDisplay, Separators, ActionRows và hỗ trợ Dual-Mode / Graceful Fallback sang Classic Embeds.
 * 
 * @param {Object} options - Cấu hình nội dung tin nhắn
 * @param {number|string} [options.accentColor=0x00E676] - Màu viền accent của Container (Hex hoặc Số)
 * @param {string} [options.title] - Tiêu đề chính của Container
 * @param {string} [options.description] - Nội dung mô tả chính
 * @param {string} [options.thumbnailUrl] - URL ảnh thu nhỏ (Accessory Thumbnail)
 * @param {Array<Object|SectionBuilder>} [options.sections=[]] - Danh sách Sections (nội dung + nút accessory / thumbnail)
 * @param {Array<Object>} [options.fields=[]] - Danh sách các trường thông tin { name, value, inline, accessory }
 * @param {Array<ActionRowBuilder>} [options.actionRows=[]] - Danh sách ActionRows (Buttons, Select Menus)
 * @param {Array<any>} [options.customComponents=[]] - Các component tùy biến bổ sung (Separators, TextDisplays, ...)
 * @param {string|Object} [options.footer] - Nội dung footer (Text / Icon)
 * @param {boolean|Date|number} [options.timestamp=false] - Hiển thị timestamp
 * @param {boolean} [options.ephemeral=false] - Cờ tin nhắn riêng tư (Ephemeral)
 * @param {Array<AttachmentBuilder|Object>} [options.files=[]] - Danh sách tệp đính kèm
 * @param {boolean} [options.enableComponentsV2=true] - Bật/tắt chế độ Components V2
 * @param {boolean} [options.divider=true] - Có hiển thị separator gạch ngang phân cách sau header hay không
 * @returns {Object} Discord Message Payload Object (Hỗ trợ .toClassic() và .toV2())
 */
function createComponentsV2Message(options = {}) {
  const {
    accentColor = 0x00E676,
    title,
    description,
    sections = [],
    fields = [],
    actionRows = [],
    customComponents = [],
    thumbnailUrl,
    footer,
    timestamp = false,
    ephemeral = false,
    files = [],
    enableComponentsV2 = true,
    divider = true
  } = options;

  const colorNum = typeof accentColor === 'string'
    ? parseInt(accentColor.replace('#', ''), 16)
    : (accentColor || 0x5865F2);

  // 1. TẠO CLASSIC FALLBACK EMBED + ACTION ROWS
  const fallbackEmbed = new EmbedBuilder().setColor(colorNum);

  if (title) fallbackEmbed.setTitle(title);
  if (description) fallbackEmbed.setDescription(description);
  if (thumbnailUrl) fallbackEmbed.setThumbnail(thumbnailUrl);
  if (Array.isArray(fields) && fields.length > 0) {
    fallbackEmbed.addFields(
      fields.map(f => ({
        name: f.name || 'Thông tin',
        value: f.value || 'N/A',
        inline: Boolean(f.inline)
      }))
    );
  }
  if (footer) {
    fallbackEmbed.setFooter(typeof footer === 'string' ? { text: footer } : footer);
  }
  if (timestamp) {
    if (typeof timestamp === 'number' || timestamp instanceof Date) {
      fallbackEmbed.setTimestamp(timestamp);
    } else {
      fallbackEmbed.setTimestamp();
    }
  }

  const classicPayload = {
    embeds: [fallbackEmbed],
    components: Array.isArray(actionRows) ? actionRows : [],
    files: Array.isArray(files) ? files : [],
    ephemeral: Boolean(ephemeral)
  };

  // Nếu Components V2 không khả dụng hoặc bị tắt, trả về Classic Payload ngay lập tức
  if (!enableComponentsV2 || !isComponentsV2Available()) {
    return {
      ...classicPayload,
      isComponentsV2: false,
      toClassic: () => classicPayload,
      toV2: () => null
    };
  }

  try {
    // 2. KHỞI TẠO CONTAINER BUILDER (DISCORD COMPONENTS V2)
    const container = new ContainerBuilder();
    container.setAccentColor(colorNum);

    // 2.1 Tiêu đề & Thumbnail Accessory / TextDisplay Header
    if (title && thumbnailUrl) {
      const headerSection = new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## ${title}${description ? '\n\n' + description : ''}`)
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnailUrl));
      container.addSectionComponents(headerSection);
    } else {
      if (title) {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}`));
      }
      if (description) {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(description));
      }
    }

    // 2.2 Separator phân cách sau Header nếu có nội dung tiếp theo
    if ((title || description) && (sections.length > 0 || fields.length > 0 || actionRows.length > 0 || customComponents.length > 0)) {
      if (divider) {
        container.addSeparatorComponents(
          new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize?.Small || 1)
        );
      }
    }

    // 2.3 Xử lý các Sections
    for (const sec of sections) {
      if (sec instanceof SectionBuilder) {
        container.addSectionComponents(sec);
      } else if (typeof sec === 'object' && sec !== null) {
        const secBuilder = new SectionBuilder();
        const content = sec.content || sec.text || sec.description || '';
        if (content) {
          secBuilder.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
        }
        if (sec.button instanceof ButtonBuilder) {
          secBuilder.setButtonAccessory(sec.button);
        } else if (sec.thumbnail) {
          secBuilder.setThumbnailAccessory(
            typeof sec.thumbnail === 'string' ? new ThumbnailBuilder().setURL(sec.thumbnail) : sec.thumbnail
          );
        }
        container.addSectionComponents(secBuilder);
      }
    }

    // 2.4 Xử lý các Fields (chuyển thành Section hoặc TextDisplay)
    for (const f of fields) {
      if (!f) continue;
      if (f.accessory) {
        const sec = new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`**${f.name}**\n${f.value}`)
          );
        if (f.accessory instanceof ButtonBuilder) {
          sec.setButtonAccessory(f.accessory);
        } else if (f.accessory instanceof ThumbnailBuilder) {
          sec.setThumbnailAccessory(f.accessory);
        }
        container.addSectionComponents(sec);
      } else {
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**${f.name}**\n${f.value}`)
        );
      }
    }

    // 2.5 Xử lý Custom Components (Separators, TextDisplays, MediaGalleries, etc.)
    for (const comp of customComponents) {
      if (!comp) continue;
      if (comp instanceof SeparatorBuilder) {
        container.addSeparatorComponents(comp);
      } else if (comp instanceof TextDisplayBuilder) {
        container.addTextDisplayComponents(comp);
      } else if (comp instanceof SectionBuilder) {
        container.addSectionComponents(comp);
      } else if (comp instanceof ActionRowBuilder) {
        container.addActionRowComponents(comp);
      }
    }

    // 2.6 Xử lý Action Rows (Buttons & SelectMenus bên trong Container)
    for (const row of actionRows) {
      if (row instanceof ActionRowBuilder) {
        container.addActionRowComponents(row);
      }
    }

    // 2.7 Footer & Timestamp
    if (footer || timestamp) {
      container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize?.Small || 1)
      );
      let footerText = footer?.text || (typeof footer === 'string' ? footer : '');
      if (timestamp) {
        const tsSec = typeof timestamp === 'number' 
          ? Math.floor(timestamp / 1000) 
          : (timestamp instanceof Date ? Math.floor(timestamp.getTime() / 1000) : Math.floor(Date.now() / 1000));
        const timeStr = `<t:${tsSec}:R>`;
        footerText = footerText ? `${footerText} • ${timeStr}` : timeStr;
      }
      if (footerText) {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`*${footerText}*`));
      }
    }

    let flags = MessageFlags.IsComponentsV2;
    if (ephemeral) {
      flags |= MessageFlags.Ephemeral;
    }

    const v2Payload = {
      flags,
      ephemeral: Boolean(ephemeral),
      components: [container],
      files: Array.isArray(files) ? files : []
    };

    return {
      ...classicPayload,
      isComponentsV2: false,
      toClassic: () => classicPayload,
      toV2: () => v2Payload
    };

  } catch (buildErr) {
    console.warn(`⚠️ [createComponentsV2Message Fallback] Lỗi dựng Components V2, tự động fallback sang Embed:`, buildErr.message);
    return {
      ...classicPayload,
      isComponentsV2: false,
      toClassic: () => classicPayload,
      toV2: () => null
    };
  }
}

/**
 * Gửi tin nhắn vào kênh TextChannel an toàn tuyệt đối, tự động sử dụng Classic Embeds
 * và có fallback đa tầng chống lỗi Discord API 50035 hoặc kênh bị hạn chế.
 * 
 * @param {TextChannel|ThreadChannel|DMChannel} channel - Kênh Discord cần gửi tin
 * @param {Object|string} options - Nội dung tin nhắn hoặc đối tượng createComponentsV2Message
 * @returns {Promise<Message|null>}
 */
async function safeChannelSend(channel, options) {
  if (!channel || typeof channel.send !== 'function') return null;
  try {
    let payload = options;
    if (typeof payload === 'string') {
      payload = { content: payload };
    } else if (payload && typeof payload.toClassic === 'function') {
      payload = payload.toClassic();
    } else if (payload && payload.isComponentsV2 && typeof payload.toClassic === 'function') {
      payload = payload.toClassic();
    }

    return await channel.send(payload);
  } catch (sendErr) {
    console.warn(`⚠️ [safeChannelSend Warning] Lỗi gửi tin vào kênh ${channel.name || channel.id}:`, sendErr.message);
    // Thử fallback gửi dạng Classic Embed hoặc Text thuần túy nếu payload phức tạp bị từ chối
    if (options && typeof options === 'object') {
      try {
        if (typeof options.toClassic === 'function') {
          return await channel.send(options.toClassic());
        }
        if (options.content) {
          return await channel.send({ content: options.content, components: options.components || [] });
        }
      } catch (fallbackErr) {
        console.error(`❌ [safeChannelSend Fallback Error] Kênh ${channel.name || channel.id}:`, fallbackErr.message);
      }
    }
    return null;
  }
}

// =========================================================================
// 6.2 SAFE INTERACTION HELPERS (ZERO-CRASH RESPONSE FALLBACKS & ERROR CODES)
// =========================================================================

const IGNORABLE_INTERACTION_ERROR_CODES = new Set([
  10062, // Unknown interaction (expired 3s/15m)
  40060, // Interaction has already been acknowledged
  10008, // Unknown message
  10003, // Unknown channel (channel deleted)
  10015, // Unknown webhook
  10004, // Unknown guild
  10009, // Unknown member
  50027, // Invalid Webhook Token
  50001, // Missing Access
  50013, // Missing Permissions
  50007, // Cannot send messages to this user
  50006, // Cannot send an empty message
  50035  // Invalid Form Body
]);

/**
 * Kiểm tra xem một interaction đã hết hạn token 15 phút của Discord API hay chưa
 * Discord interaction tokens chỉ có hiệu lực tối đa 15 phút (900,000 ms).
 */
function isInteractionExpired(interaction) {
  if (!interaction || !interaction.createdTimestamp) return false;
  // Giới hạn 15 phút (900,000 ms). Trừ hao độ trễ mạng còn 14.8 phút (888,000 ms).
  return (Date.now() - interaction.createdTimestamp) >= 14.8 * 60 * 1000;
}

/**
 * Kiểm tra xem một lỗi Discord API có phải là lỗi tương tác hết hạn / kênh đã bị xóa hay không
 */
function isIgnorableInteractionError(err) {
  if (!err) return false;
  if (err.code && IGNORABLE_INTERACTION_ERROR_CODES.has(err.code)) return true;
  const msg = String(err.message || '').toLowerCase();
  return (
    msg.includes('unknown interaction') ||
    msg.includes('already been acknowledged') ||
    msg.includes('unknown channel') ||
    msg.includes('unknown message') ||
    msg.includes('unknown webhook') ||
    msg.includes('unknown guild') ||
    msg.includes('unknown member') ||
    msg.includes('invalid webhook token') ||
    msg.includes('missing access') ||
    msg.includes('missing permissions') ||
    msg.includes('cannot send messages to this user') ||
    msg.includes('cannot send an empty message') ||
    msg.includes('invalid form body') ||
    msg.includes('request aborted') ||
    msg.includes('aborted')
  );
}

/**
 * Phản hồi interaction an toàn tuyệt đối chống race condition và không bao giờ throw error
 * Tích hợp Components V2, cờ Ephemeral tự động và Seamless Graceful Fallback sang Classic Embed.
 */
async function safeReply(interaction, options) {
  if (!interaction || interaction.isAutocomplete?.()) return null;
  try {
    let payload = typeof options === 'string' ? { content: options } : { ...options };

    // Tự động kết hợp cờ Ephemeral và Components V2
    if (payload.ephemeral) {
      if (typeof payload.flags === 'number') {
        payload.flags |= MessageFlags.Ephemeral;
      }
    }

    const isV2 = Boolean(
      (typeof payload.flags === 'number' && (payload.flags & MessageFlags.IsComponentsV2) !== 0) ||
      payload.isComponentsV2 ||
      (Array.isArray(payload.components) && payload.components[0] instanceof ContainerBuilder)
    );

    // Đảm bảo payload không rỗng khi gửi qua REST API (trừ Components V2 không cần content rác)
    if (!isV2 && !payload.content && (!payload.embeds || payload.embeds.length === 0) && (!payload.files || payload.files.length === 0)) {
      if (payload.components && payload.components.length > 0) {
        payload.content = ' ';
      }
    }

    // 0. Kiểm tra interaction token đã hết hạn 15 phút chưa
    if (isInteractionExpired(interaction)) {
      if (!payload.ephemeral && interaction.channel && typeof interaction.channel.send === 'function') {
        try {
          return await interaction.channel.send(payload);
        } catch (_) {
          return null;
        }
      }
      return null;
    }

    const isDeferred = Boolean(interaction.deferred || interaction._state?.deferred);
    const isReplied = Boolean(interaction.replied || interaction._state?.replied);

    // 1. Đã defer nhưng chưa reply -> editReply
    if (isDeferred && !isReplied) {
      try {
        return await interaction.editReply(payload);
      } catch (editErr) {
        if (editErr?.code === 40060) {
          try {
            return await interaction.followUp(payload);
          } catch (_) {
            return null;
          }
        }
        // Fallback tự động sang Classic Embed nếu Discord API từ chối Components V2
        if (isV2 && typeof payload.toClassic === 'function' && (editErr?.code === 50035 || editErr?.status === 400)) {
          console.warn(`⚠️ [safeReply Fallback] Discord từ chối V2 payload (${editErr.message}), tự động fallback sang Classic Embed.`);
          return await safeReply(interaction, payload.toClassic());
        }
        if (editErr?.code === 10062 || editErr?.code === 10015) {
          if (!payload.ephemeral && interaction.channel && typeof interaction.channel.send === 'function') {
            try {
              return await interaction.channel.send(payload);
            } catch (_) {}
          }
          return null;
        }
        if (isIgnorableInteractionError(editErr)) return null;
        try {
          return await interaction.followUp(payload);
        } catch (followErr) {
          if (!isIgnorableInteractionError(followErr)) {
            console.warn(`⚠️ [safeReply followUp Fallback Error] ${followErr.message}`);
          }
          return null;
        }
      }
    }

    // 2. Đã reply (hoặc đã defer + editReply trước đó)
    if (isReplied) {
      try {
        return await interaction.followUp(payload);
      } catch (followErr) {
        if (isV2 && typeof payload.toClassic === 'function' && (followErr?.code === 50035 || followErr?.status === 400)) {
          console.warn(`⚠️ [safeFollowUp Fallback] Discord từ chối V2 payload (${followErr.message}), tự động fallback sang Classic Embed.`);
          return await safeReply(interaction, payload.toClassic());
        }
        if (followErr?.code === 10062 || followErr?.code === 10015) {
          if (!payload.ephemeral && interaction.channel && typeof interaction.channel.send === 'function') {
            try {
              return await interaction.channel.send(payload);
            } catch (_) {}
          }
          return null;
        }
        if (isIgnorableInteractionError(followErr)) return null;
        try {
          return await interaction.editReply(payload);
        } catch (_) {
          return null;
        }
      }
    }

    // 3. Chưa acknowledge -> reply bình thường
    try {
      return await interaction.reply(payload);
    } catch (replyErr) {
      // Fallback tự động sang Classic Embed nếu Discord API từ chối Components V2
      if (isV2 && typeof payload.toClassic === 'function' && (replyErr?.code === 50035 || replyErr?.status === 400)) {
        console.warn(`⚠️ [safeReply Fallback] Discord từ chối V2 payload (${replyErr.message}), tự động fallback sang Classic Embed.`);
        return await safeReply(interaction, payload.toClassic());
      }
      // 40060: Đã được acknowledge bởi tác vụ khác / race condition -> fallback editReply hoặc followUp
      if (replyErr?.code === 40060) {
        try {
          return await interaction.editReply(payload);
        } catch (_) {
          try {
            return await interaction.followUp(payload);
          } catch (_) {
            return null;
          }
        }
      }
      // 10062 / 10015: Unknown interaction / webhook (timeout 3s hoặc token không tồn tại)
      if (replyErr?.code === 10062 || replyErr?.code === 10015) {
        if (!payload.ephemeral && interaction.channel && typeof interaction.channel.send === 'function') {
          try {
            return await interaction.channel.send(payload);
          } catch (_) {}
        }
        return null;
      }
      if (isIgnorableInteractionError(replyErr)) return null;
      console.warn(`⚠️ [safeReply Warning] ${replyErr.message}`);
      return null;
    }
  } catch (err) {
    if (!isIgnorableInteractionError(err)) {
      console.warn(`⚠️ [safeReply Error] ${err.message}`);
    }
    return null;
  }
}

/**
 * Hoãn phản hồi an toàn (deferReply) chống 3-second timeout và không làm crash nếu interaction đã acknowledge
 */
async function safeDeferReply(interaction, options = {}) {
  if (!interaction || interaction.isAutocomplete?.()) return false;
  if (interaction.deferred || interaction.replied) return true;
  if (isInteractionExpired(interaction)) return false;
  try {
    await interaction.deferReply(options);
    return true;
  } catch (err) {
    if (isIgnorableInteractionError(err)) return false;
    console.warn(`⚠️ [safeDeferReply Warning] ${err.message}`);
    return false;
  }
}

/**
 * Hoãn cập nhật component an toàn (deferUpdate) chống 3-second timeout
 */
async function safeDeferUpdate(interaction) {
  if (!interaction || interaction.isAutocomplete?.()) return false;
  if (interaction.deferred || interaction.replied) return true;
  if (isInteractionExpired(interaction)) return false;
  try {
    if (typeof interaction.deferUpdate === 'function') {
      await interaction.deferUpdate();
      return true;
    }
    return false;
  } catch (err) {
    if (isIgnorableInteractionError(err)) return false;
    console.warn(`⚠️ [safeDeferUpdate Warning] ${err.message}`);
    return false;
  }
}

/**
 * Chỉnh sửa phản hồi đã hoãn an toàn (editReply)
 */
async function safeEditReply(interaction, options) {
  if (!interaction || interaction.isAutocomplete?.()) return null;
  let payload = typeof options === 'string' ? { content: options } : { ...options };
  if (payload.ephemeral && typeof payload.flags === 'number') {
    payload.flags |= MessageFlags.Ephemeral;
  }
  const isV2 = Boolean(
    (typeof payload.flags === 'number' && (payload.flags & MessageFlags.IsComponentsV2) !== 0) ||
    payload.isComponentsV2 ||
    (Array.isArray(payload.components) && payload.components[0] instanceof ContainerBuilder)
  );

  if (isInteractionExpired(interaction)) {
    if (!payload.ephemeral && interaction.channel && typeof interaction.channel.send === 'function') {
      try {
        return await interaction.channel.send(payload);
      } catch (_) {}
    }
    return null;
  }
  try {
    return await interaction.editReply(payload);
  } catch (err) {
    if (isV2 && typeof payload.toClassic === 'function' && (err?.code === 50035 || err?.status === 400)) {
      console.warn(`⚠️ [safeEditReply Fallback] Discord từ chối V2 payload (${err.message}), fallback sang Classic Embed.`);
      return await safeEditReply(interaction, payload.toClassic());
    }
    if (err?.code === 10062 || err?.code === 10015) {
      if (!payload.ephemeral && interaction.channel && typeof interaction.channel.send === 'function') {
        try {
          return await interaction.channel.send(payload);
        } catch (_) {}
      }
      return null;
    }
    if (isIgnorableInteractionError(err)) return null;
    console.warn(`⚠️ [safeEditReply Warning] ${err.message}`);
    return null;
  }
}

/**
 * Gửi tin nhắn tiếp theo an toàn (followUp)
 */
async function safeFollowUp(interaction, options) {
  if (!interaction || interaction.isAutocomplete?.()) return null;
  let payload = typeof options === 'string' ? { content: options } : { ...options };
  if (payload.ephemeral && typeof payload.flags === 'number') {
    payload.flags |= MessageFlags.Ephemeral;
  }
  const isV2 = Boolean(
    (typeof payload.flags === 'number' && (payload.flags & MessageFlags.IsComponentsV2) !== 0) ||
    payload.isComponentsV2 ||
    (Array.isArray(payload.components) && payload.components[0] instanceof ContainerBuilder)
  );

  if (isInteractionExpired(interaction)) {
    if (!payload.ephemeral && interaction.channel && typeof interaction.channel.send === 'function') {
      try {
        return await interaction.channel.send(payload);
      } catch (_) {}
    }
    return null;
  }
  try {
    return await interaction.followUp(payload);
  } catch (err) {
    if (isV2 && typeof payload.toClassic === 'function' && (err?.code === 50035 || err?.status === 400)) {
      console.warn(`⚠️ [safeFollowUp Fallback] Discord từ chối V2 payload (${err.message}), fallback sang Classic Embed.`);
      return await safeFollowUp(interaction, payload.toClassic());
    }
    if (err?.code === 10062 || err?.code === 10015) {
      if (!payload.ephemeral && interaction.channel && typeof interaction.channel.send === 'function') {
        try {
          return await interaction.channel.send(payload);
        } catch (_) {}
      }
      return null;
    }
    if (isIgnorableInteractionError(err)) return null;
    console.warn(`⚠️ [safeFollowUp Warning] ${err.message}`);
    return null;
  }
}

/**
 * Cập nhật component interaction an toàn (update) chống crash
 * Tự động chuyển sang editReply nếu interaction đã deferred hoặc replied (chống lỗi 40060)
 */
async function safeUpdate(interaction, options) {
  if (!interaction || interaction.isAutocomplete?.()) return null;
  if (isInteractionExpired(interaction)) return null;
  let payload = typeof options === 'string' ? { content: options } : { ...options };
  if (payload.ephemeral && typeof payload.flags === 'number') {
    payload.flags |= MessageFlags.Ephemeral;
  }
  const isV2 = Boolean(
    (typeof payload.flags === 'number' && (payload.flags & MessageFlags.IsComponentsV2) !== 0) ||
    payload.isComponentsV2 ||
    (Array.isArray(payload.components) && payload.components[0] instanceof ContainerBuilder)
  );

  try {
    if (interaction.deferred || interaction.replied) {
      return await safeEditReply(interaction, payload);
    }
    if (typeof interaction.update === 'function') {
      return await interaction.update(payload);
    }
    return await safeReply(interaction, payload);
  } catch (err) {
    if (isV2 && typeof payload.toClassic === 'function' && (err?.code === 50035 || err?.status === 400)) {
      console.warn(`⚠️ [safeUpdate Fallback] Discord từ chối V2 update (${err.message}), fallback sang Classic Embed.`);
      return await safeUpdate(interaction, payload.toClassic());
    }
    if (err?.code === 40060) {
      return await safeEditReply(interaction, payload);
    }
    if (isIgnorableInteractionError(err)) return null;
    return await safeReply(interaction, payload);
  }
}

/**
 * Mở modal an toàn (showModal) chống lỗi interaction already replied
 * Discord API yêu cầu showModal phải là phản hồi ban đầu (chưa deferReply/reply) và còn hạn
 */
async function safeShowModal(interaction, modal) {
  if (!interaction || !modal) return false;
  if (isInteractionExpired(interaction)) {
    console.warn("⚠️ [safeShowModal] Không thể showModal trên interaction đã hết hạn (15m).");
    return false;
  }
  if (interaction.replied || interaction.deferred) {
    console.warn("⚠️ [safeShowModal] Không thể showModal trên interaction đã replied/deferred.");
    return false;
  }
  try {
    await interaction.showModal(modal);
    return true;
  } catch (err) {
    if (isIgnorableInteractionError(err)) return false;
    console.warn(`⚠️ [safeShowModal Error] ${err.message}`);
    return false;
  }
}

// =========================================================================
// 7. XỬ LÝ INTERACTIONS (BUTTON, SELECT MENU, SLASH COMMANDS, MODALS)
// =========================================================================
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // 0. AUTOCOMPLETE INTERACTIONS (Xử lý gợi ý tự động an toàn)
    if (interaction.isAutocomplete?.()) {
      try {
        const focusedOption = typeof interaction.options?.getFocused === 'function' 
          ? interaction.options.getFocused(true) 
          : null;
        if (focusedOption && focusedOption.name === 'code') {
          const input = (focusedOption.value || '').trim().toUpperCase();
          const suggestions = [];

          // 1. Tìm trong activeOrderCodes
          for (const [code, info] of activeOrderCodes.entries()) {
            if (!input || code.includes(input)) {
              const pkgName = info?.pkgKey ? (getPackage(info.pkgKey)?.name || info.pkgKey) : 'Đơn hàng';
              suggestions.push({
                name: `[Chờ TT] ${code} - ${pkgName}`.slice(0, 100),
                value: code
              });
              if (suggestions.length >= 10) break;
            }
          }

          // 2. Tìm trong approvedOrderCodes
          for (const code of approvedOrderCodes.values()) {
            if (suggestions.length >= 25) break;
            if (!input || code.includes(input)) {
              suggestions.push({
                name: `[Đã Duyệt] ${code}`.slice(0, 100),
                value: code
              });
            }
          }

          await interaction.respond(suggestions.slice(0, 25)).catch(() => {});
          return;
        }
      } catch {}
      await interaction.respond([]).catch(() => {});
      return;
    }

    // 1. CONTEXT MENU COMMANDS (User & Message Context Menus)
    if (interaction.isUserContextMenuCommand?.()) {
      const cooldownRemaining = getRateLimitRemaining(interaction.guildId, interaction.user.id, 3000);
      if (cooldownRemaining > 0) {
        return safeReply(interaction, {
          content: `⏳ Bạn thao tác quá nhanh! Vui lòng đợi **${cooldownRemaining} giây** trước khi dùng lệnh tiếp theo.`,
          ephemeral: true
        });
      }

      const targetUser = interaction.targetUser || interaction.options?.getUser?.('user');
      if (!targetUser) {
        return safeReply(interaction, {
          content: "❌ Không tìm thấy thông tin người dùng được chọn!",
          ephemeral: true
        });
      }

      // Kiểm tra nếu mục tiêu là Bot
      if (targetUser.bot) {
        const embedBot = new EmbedBuilder()
          .setColor('#9E9E9E')
          .setTitle(`🤖 THÔNG TIN BOT: ${targetUser.tag || targetUser.username}`)
          .setThumbnail(typeof targetUser.displayAvatarURL === 'function' ? targetUser.displayAvatarURL({ dynamic: true }) : null)
          .setDescription(
            `• **Tài khoản:** <@${targetUser.id}> (\`${targetUser.id}\`)\n` +
            `• **Loại tài khoản:** 🤖 Discord Bot / Ứng dụng tích hợp\n` +
            `• **Ngày tạo bot:** <t:${Math.floor((targetUser.createdTimestamp || Date.now()) / 1000)}:F> (<t:${Math.floor((targetUser.createdTimestamp || Date.now()) / 1000)}:R>)\n` +
            `• **Ghi chú:** Không áp dụng tra cứu đơn hàng & quyền lợi khách hàng cho tài khoản Bot.`
          )
          .setFooter({ text: 'LS STUDIO • Member & Bot Verification' })
          .setTimestamp();
        return safeReply(interaction, { embeds: [embedBot], ephemeral: true });
      }

      let member = interaction.targetMember || null;
      if (!member && interaction.guild) {
        member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      }

      const isCustomer = member?.roles?.cache ? member.roles.cache.some(r => r.name.includes("Khách Hàng")) : false;
      const isVIP = member?.roles?.cache ? member.roles.cache.some(r => r.name.includes("VIP")) : false;
      const isStaff = member ? isStaffMember(member) : false;
      const highestRole = member?.roles?.highest;

      // Tìm đơn hàng liên quan của user trong activeOrderCodes
      const userOrders = [];
      for (const [code, info] of activeOrderCodes.entries()) {
        if (info?.buyerId === targetUser.id) {
          const isApproved = approvedOrderCodes.has(code);
          const isProcessing = processingApprovals.has(code);
          const pkg = info?.pkgKey ? getPackage(info.pkgKey) : null;
          let st = '⏳ Chờ TT';
          if (isApproved) st = '✅ Đã duyệt';
          else if (isProcessing) st = '🔄 Đang duyệt';
          userOrders.push(`• \`${code}\`: **${st}** (${pkg?.name || 'Gói tùy chọn'})`);
        }
      }

      const embedUser = new EmbedBuilder()
        .setColor(isVIP ? '#E040FB' : (isCustomer ? '#00E676' : (isStaff ? '#FFD700' : '#00E5FF')))
        .setTitle(`👤 THÔNG TIN KHÁCH HÀNG: ${targetUser.tag || targetUser.username}`)
        .setThumbnail(typeof targetUser.displayAvatarURL === 'function' ? targetUser.displayAvatarURL({ dynamic: true }) : null)
        .setDescription(
          `• **Thành viên:** <@${targetUser.id}> (\`${targetUser.id}\`)\n` +
          (highestRole ? `• **Vai trò cao nhất:** <@&${highestRole.id}>\n` : '') +
          `• **Khách hàng (Buyer):** ${isCustomer ? '✅ Đã kích hoạt' : '❌ Chưa có'}\n` +
          `• **VIP Customer:** ${isVIP ? '💎 Đã kích hoạt' : '❌ Chưa có'}\n` +
          `• **Ban Quản Trị (Staff):** ${isStaff ? '🛡️ Có' : '❌ Không'}\n` +
          `• **Tạo tài khoản Discord:** <t:${Math.floor((targetUser.createdTimestamp || Date.now()) / 1000)}:F> (<t:${Math.floor((targetUser.createdTimestamp || Date.now()) / 1000)}:R>)\n` +
          (member?.joinedTimestamp ? `• **Tham gia server:** <t:${Math.floor(member.joinedTimestamp / 1000)}:F> (<t:${Math.floor(member.joinedTimestamp / 1000)}:R>)\n` : '') +
          `\n**📦 ĐƠN HÀNG TRONG PHIÊN:**\n` +
          (userOrders.length > 0 ? userOrders.slice(0, 5).join('\n') : '• *Không có đơn hàng nào ghi nhận trong phiên hiện tại.*')
        )
        .setFooter({ text: 'LS STUDIO • Customer Verification' })
        .setTimestamp();

      return safeReply(interaction, { embeds: [embedUser], ephemeral: true });
    }

    if (interaction.isMessageContextMenuCommand?.()) {
      const cooldownRemaining = getRateLimitRemaining(interaction.guildId, interaction.user.id, 4000);
      if (cooldownRemaining > 0) {
        return safeReply(interaction, {
          content: `⏳ Bạn thao tác quá nhanh! Vui lòng đợi **${cooldownRemaining} giây** trước khi gửi báo cáo tiếp theo.`,
          ephemeral: true
        });
      }

      const targetMsg = interaction.targetMessage;
      if (!targetMsg) {
        return safeReply(interaction, {
          content: "❌ Không tìm thấy thông tin tin nhắn được chọn để báo cáo!",
          ephemeral: true
        });
      }

      // Chuyển tiếp báo cáo vào kênh nội bộ staff nếu có
      if (interaction.guild?.channels?.cache) {
        const staffChannel = interaction.guild.channels.cache.find(c => 
          c.name && (
            c.name.includes('nội-bộ-staff') || 
            c.name.includes('nhật-ký') || 
            c.name.includes('mod-log') ||
            c.name.includes('báo-cáo')
          )
        );
        if (staffChannel && typeof staffChannel.send === 'function') {
          const reportEmbed = new EmbedBuilder()
            .setColor('#FF3D00')
            .setTitle('🚨 BÁO CÁO TIN NHẮN / MESSAGE REPORT')
            .setDescription(
              `• **Người báo cáo:** <@${interaction.user.id}> (\`${interaction.user.tag || interaction.user.username}\`)\n` +
              `• **Tác giả tin nhắn:** ${targetMsg.author ? `<@${targetMsg.author.id}> (\`${targetMsg.author.tag || targetMsg.author.username}\`)` : 'Không rõ'}\n` +
              `• **Kênh:** <#${targetMsg.channelId || interaction.channelId}>\n` +
              (targetMsg.url ? `• **Liên kết:** [🔗 Nhảy đến tin nhắn](${targetMsg.url})\n` : '') +
              `• **Thời gian gửi:** <t:${Math.floor((targetMsg.createdTimestamp || Date.now()) / 1000)}:F>\n\n` +
              `**💬 NỘI DUNG TIN NHẮN ĐƯỢC BÁO CÁO:**\n` +
              `> ${sanitizeMarkdownForEmbed(redactSensitiveData(targetMsg.content || '*[Tin nhắn trống hoặc chỉ có file/embed]*'), 1000)}`
            )
            .setFooter({ text: `Report ID: ${interaction.id}` })
            .setTimestamp();

          await staffChannel.send({ embeds: [reportEmbed] }).catch(() => {});
        }
      }

      const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_support')
          .setLabel('🛠️ Mở Ticket Hỗ Trợ / Open Ticket')
          .setStyle(ButtonStyle.Primary)
      );

      const ackEmbed = new EmbedBuilder()
        .setColor('#00E676')
        .setTitle('✅ ĐÃ GỬI BÁO CÁO THÀNH CÔNG / REPORT SUBMITTED')
        .setDescription(
          `Cảm ơn bạn <@${interaction.user.id}>! Báo cáo về tin nhắn của ${targetMsg.author ? `<@${targetMsg.author.id}>` : 'thành viên'} đã được chuyển đến **Ban Quản Trị LS STUDIO** để xem xét và xử lý.\n\n` +
          `• **Mã báo cáo:** \`RPT-${interaction.id.slice(-6).toUpperCase()}\`\n` +
          `• **Nội dung:** \`${sanitizeMarkdownForEmbed(redactSensitiveData(targetMsg.content || '*[Đính kèm/Embed]*'), 100)}\`\n\n` +
          `*Nếu bạn cần trao đổi trực tiếp hoặc hỗ trợ kỹ thuật, vui lòng bấm nút **[🛠️ Mở Ticket Hỗ Trợ]** bên dưới để tạo phiên làm việc riêng.*`
        )
        .setFooter({ text: 'LS STUDIO • Fast Support & Security 24/7' })
        .setTimestamp();

      return safeReply(interaction, { embeds: [ackEmbed], components: [btnRow], ephemeral: true });
    }

    // 2. SLASH COMMANDS
    if (interaction.isChatInputCommand?.()) {
      const { commandName } = interaction;

      // /ping
      if (commandName === 'ping') {
        const cooldownRemaining = getRateLimitRemaining(interaction.guildId, interaction.user.id, 3000);
        if (cooldownRemaining > 0) {
          return safeReply(interaction, {
            content: `⏳ Bạn thao tác quá nhanh! Vui lòng đợi **${cooldownRemaining} giây** trước khi dùng lệnh tiếp theo.`,
            ephemeral: true
          });
        }
        const wsPing = client.ws?.ping ?? 0;
        const apiLatency = Math.max(0, Date.now() - interaction.createdTimestamp);
        return safeReply(interaction, { 
          content: `🏓 Pong! WebSocket: \`${wsPing}ms\` | API Latency: \`${apiLatency}ms\``, 
          ephemeral: true 
        });
      }

      // /stk
      if (commandName === 'stk') {
        const cooldownRemaining = getRateLimitRemaining(interaction.guildId, interaction.user.id, 4000);
        if (cooldownRemaining > 0) {
          return safeReply(interaction, {
            content: `⏳ Bạn thao tác quá nhanh! Vui lòng đợi **${cooldownRemaining} giây** trước khi dùng lệnh tiếp theo.`,
            ephemeral: true
          });
        }
        await safeDeferReply(interaction);
        const qrUrl = generateVietQRUrl({ template: 'compact2' });
        const qrBuffer = await fetchVietQRBuffer(qrUrl);

        const embedStk = new EmbedBuilder()
          .setColor("#00E676")
          .setTitle("💳 THÔNG TIN THANH TOÁN / PAYMENT INFORMATION")
          .setDescription(
            `🏦 **Ngân hàng / Bank:** MBBank (Ngân Hàng TMCP Quân Đội)\n` +
            `🏷️ **Mã ngân hàng / BIN:** \`MB\` / \`970422\`\n` +
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
          const v2Msg = createComponentsV2Message({
            accentColor: 0x00E676,
            title: "💳 THÔNG TIN THANH TOÁN / PAYMENT INFORMATION",
            description:
              `🏦 **Ngân hàng / Bank:** MBBank (Ngân Hàng TMCP Quân Đội)\n` +
              `🏷️ **Mã ngân hàng / BIN:** \`MB\` / \`970422\`\n` +
              `🔢 **Số tài khoản / Account Number:** \`${BANK_CONFIG.ACCOUNT_NO}\`\n` +
              `👤 **Chủ tài khoản / Account Holder:** **${BANK_CONFIG.ACCOUNT_NAME}**\n\n` +
              `*Khách hàng Việt Nam có thể quét mã VietQR bên dưới để thanh toán siêu tốc 24/7.*\n` +
              `*International customers: Please open a Ticket for PayPal / International payment methods.*`,
            footer: "LS STUDIO • Payment System 24/7",
            actionRows: [btnRow],
            files: [attachment]
          });
          if (v2Msg.toClassic()?.embeds?.[0]) {
            v2Msg.toClassic().embeds[0].setImage('attachment://vietqr_stk.png');
          }
          return safeReply(interaction, v2Msg);
        } else {
          const v2Msg = createComponentsV2Message({
            accentColor: 0xFFA500,
            title: "💳 THÔNG TIN THANH TOÁN / PAYMENT INFORMATION",
            description:
              `🏦 **Ngân hàng / Bank:** MBBank (Ngân Hàng TMCP Quân Đội)\n` +
              `🏷️ **Mã ngân hàng / BIN:** \`MB\` / \`970422\`\n` +
              `🔢 **Số tài khoản / Account Number:** \`${BANK_CONFIG.ACCOUNT_NO}\`\n` +
              `👤 **Chủ tài khoản / Account Holder:** **${BANK_CONFIG.ACCOUNT_NAME}**\n\n` +
              `⚠️ *Cổng tạo ảnh VietQR tự động tạm thời phản hồi chậm hoặc đang bảo trì. Quý khách vui lòng chuyển khoản thủ công theo thông tin bên dưới hoặc bấm nút **[🔗 Mở mã VietQR / Open QR]** bên dưới.*\n` +
              `*International customers: Please open a Ticket for PayPal / International payment methods.*`,
            fields: [
              {
                name: "⚠️ CỔNG TẠO MÃ QR TẠM THỜI BẢO TRÌ / VIETQR OFFLINE",
                value: "Cổng kết nối tạo ảnh VietQR tự động tạm thời phản hồi chậm hoặc đang bảo trì đường truyền.\n**Hệ thống Ngân hàng 24/7 vẫn nhận tiền bình thường 100%!** Quý khách có thể chuyển khoản thủ công liên ngân hàng Napas 24/7 theo thông tin dưới đây:"
              },
              {
                name: "📋 THÔNG TIN CHUYỂN KHOẢN THỦ CÔNG (MANUAL TRANSFER)",
                value:
                  `🏦 **Ngân hàng / Bank:** \`MBBank (Ngân Hàng TMCP Quân Đội - MB)\`\n` +
                  `🏷️ **Mã ngân hàng / BIN:** \`MB\` (\`970422\`)\n` +
                  `🔢 **Số tài khoản / Account No:** \`${BANK_CONFIG.ACCOUNT_NO}\`\n` +
                  `👤 **Chủ tài khoản / Account Name:** \`${BANK_CONFIG.ACCOUNT_NAME}\`\n` +
                  `📝 **Nội dung / Memo:** \`LSSTUDIO\` hoặc \`Tên Discord của bạn\`\n` +
                  `💡 *Gợi ý: Quý khách chạm/click vào số tài khoản ở trên để copy nhanh.*`
              }
            ],
            footer: "LS STUDIO • Payment System 24/7",
            actionRows: [btnRow]
          });
          return safeReply(interaction, v2Msg);
        }
      }

      // /khachhang (Staff Only)
      if (commandName === 'khachhang') {
        if (!interaction.inGuild?.() || !interaction.guild) {
          return safeReply(interaction, { 
            content: "❌ Lệnh này chỉ có thể sử dụng bên trong máy chủ Discord!", 
            ephemeral: true 
          });
        }

        // Kiểm tra quyền Staff / Admin
        const isStaff = isStaffMember(interaction.member);

        if (!isStaff) {
          return safeReply(interaction, { 
            content: "❌ Bạn không có quyền sử dụng lệnh này! (Dành riêng cho Staff/Admin) / Staff Only!", 
            ephemeral: true 
          });
        }

        const targetUser = interaction.options.getUser('user', true);
        if (targetUser.bot) {
          return safeReply(interaction, { 
            content: "❌ Không thể cấp role Khách Hàng cho tài khoản Bot!", 
            ephemeral: true 
          });
        }

        // Hoãn phản hồi (deferReply) để chống 3-second timeout khi gọi API Discord
        await safeDeferReply(interaction, { ephemeral: false });

        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (!member) {
          return safeReply(interaction, { 
            content: "❌ Không tìm thấy thành viên này trong server / Member not found in server!" 
          });
        }
        
        let customerRole = interaction.guild.roles.cache.find(r => r.name.includes("Khách Hàng") && !r.managed) ||
                           interaction.guild.roles.cache.find(r => r.name.includes("Khách Hàng"));
        if (!customerRole) {
          const fetchedRoles = await interaction.guild.roles.fetch().catch(() => null);
          customerRole = fetchedRoles?.find(r => r.name.includes("Khách Hàng") && !r.managed) ||
                         fetchedRoles?.find(r => r.name.includes("Khách Hàng"));
        }

        if (!customerRole) {
          return safeReply(interaction, { 
            content: "❌ Không tìm thấy role Khách Hàng trên máy chủ / Customer role not found!" 
          });
        }

        // 1. Kiểm tra nếu role là Managed / Integration Role
        if (customerRole.managed) {
          return safeReply(interaction, {
            content: `❌ Role **${customerRole.name}** là Role Quản lý / Tích hợp tự động (Managed/Integration Role) của Discord, không thể gán thủ công!`
          });
        }

        // 2. Kiểm tra Role @everyone
        if (customerRole.id === interaction.guild.id) {
          return safeReply(interaction, {
            content: "❌ Không thể gán role `@everyone` cho thành viên!"
          });
        }

        // 3. Kiểm tra Redundant Role Assignment
        if (member.roles?.cache ? member.roles.cache.has(customerRole.id) : false) {
          return safeReply(interaction, {
            content: `⚠️ Thành viên <@${member.id}> đã sở hữu role **${customerRole.name}** trước đó rồi!`
          });
        }

        const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe().catch(() => null);
        if (!botMember || !botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
          return safeReply(interaction, { 
            content: "❌ Bot thiếu quyền `Manage Roles` (Quản Lý Vai Trò) để cấp role cho thành viên!" 
          });
        }

        // 4. Kiểm tra thứ bậc Role của Role Khách Hàng so với Bot
        if (customerRole.position >= botMember.roles.highest.position) {
          return safeReply(interaction, { 
            content: `❌ Role **${customerRole.name}** có vị trí cao hơn hoặc ngang bằng với Role cao nhất của Bot trong Server Settings (Role Hierarchy)! Vui lòng kéo Role của Bot lên trên Role này.` 
          });
        }

        // 5. Kiểm tra nếu mục tiêu là Server Owner (Bot không thể sửa role của Server Owner)
        if (interaction.guild.ownerId === member.id) {
          return safeReply(interaction, {
            content: "❌ Không thể chỉnh sửa role của Chủ Sở Hữu Máy Chủ (Server Owner)!"
          });
        }

        // 6. Kiểm tra thứ bậc Role của thành viên mục tiêu so với Bot
        if (member.roles.highest.position >= botMember.roles.highest.position) {
          return safeReply(interaction, { 
            content: `❌ Không thể cấp role cho <@${member.id}> vì thành viên này có thứ bậc Role cao hơn hoặc ngang bằng với Bot trong Server Settings!` 
          });
        }

        try {
          await member.roles.add(customerRole, `Cấp role Khách Hàng bởi ${interaction.user.tag} (${interaction.user.id})`);
        } catch (roleErr) {
          console.error("❌ Lỗi khi add role cho member:", roleErr);
          return safeReply(interaction, {
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

        return safeReply(interaction, { embeds: [successEmbed] });
      }

      // /transcript (Staff Only - Xuất transcript kênh ticket trực tiếp)
      if (commandName === 'transcript') {
        if (!interaction.inGuild?.() || !interaction.guild) {
          return safeReply(interaction, { 
            content: "❌ Lệnh này chỉ có thể sử dụng bên trong máy chủ Discord!", 
            ephemeral: true 
          });
        }

        const isStaff = isStaffMember(interaction.member);

        if (!isStaff) {
          return safeReply(interaction, { 
            content: "❌ Bạn không có quyền sử dụng lệnh này! (Dành riêng cho Staff/Admin) / Staff Only!", 
            ephemeral: true 
          });
        }

        await safeDeferReply(interaction, { ephemeral: true });

        const channel = interaction.channel;
        if (!channel || !channel.isTextBased()) {
          return safeReply(interaction, {
            content: "❌ Kênh này không hỗ trợ xuất transcript!",
            ephemeral: true
          });
        }

        const transcriptText = await generateTranscript(channel);
        const fileName = `transcript-${channel.name}.txt`;
        const attachmentResult = createTranscriptAttachments(transcriptText, fileName);

        const sizeFormatted = attachmentResult.totalBytes >= 1024 * 1024
          ? `${(attachmentResult.totalBytes / (1024 * 1024)).toFixed(2)} MB`
          : `${(attachmentResult.totalBytes / 1024).toFixed(1)} KB`;

        const exportEmbed = new EmbedBuilder()
          .setColor("#00E676")
          .setTitle("📑 XUẤT NHẬT KÝ TICKET THÀNH CÔNG / TRANSCRIPT EXPORTED")
          .setDescription(
            `• **Kênh / Channel:** <#${channel.id}> (\`${sanitizeMarkdownForEmbed(channel.name, 50)}\`)\n` +
            `• **Người thực hiện:** <@${interaction.user.id}>\n` +
            `• **Dung lượng file:** \`${sizeFormatted}\`${attachmentResult.isSplit ? ` (${attachmentResult.partsCount} tệp)` : ''}\n` +
            `• **Thời gian:** <t:${Math.floor(Date.now() / 1000)}:F>`
          )
          .setFooter({ text: "LS STUDIO Audit & Security" })
          .setTimestamp();

        if (attachmentResult.isSplit) {
          const primaryFiles = [attachmentResult.summaryAttachment, attachmentResult.attachments[0]].filter(Boolean);
          await safeReply(interaction, { embeds: [exportEmbed], files: primaryFiles, ephemeral: true });
          for (let i = 1; i < attachmentResult.attachments.length; i++) {
            await safeFollowUp(interaction, { files: [attachmentResult.attachments[i]], ephemeral: true });
          }
          return;
        }

        return safeReply(interaction, { embeds: [exportEmbed], files: attachmentResult.attachments, ephemeral: true });
      }

      // /feedback (Mở Modal gửi nhận xét & đánh giá dịch vụ)
      if (commandName === 'feedback') {
        const feedbackModal = createFeedbackModal();
        return safeShowModal(interaction, feedbackModal);
      }

      // /help (Xem hướng dẫn sử dụng và danh sách lệnh Bot)
      if (commandName === 'help') {
        const cooldownRemaining = getRateLimitRemaining(interaction.guildId, interaction.user.id, 3000);
        if (cooldownRemaining > 0) {
          return safeReply(interaction, {
            content: `⏳ Bạn thao tác quá nhanh! Vui lòng đợi **${cooldownRemaining} giây** trước khi dùng lệnh tiếp theo.`,
            ephemeral: true
          });
        }

        const readiness = validateAppDirectoryReadiness();
        const v2Help = createComponentsV2Message({
          accentColor: 0x00E676,
          title: '📖 HƯỚNG DẪN SỬ DỤNG BOT & LỆNH / LS STUDIO HELP GUIDE',
          description:
            `Chào mừng bạn đến với **LS STUDIO**! Dưới đây là danh sách các lệnh Slash Command khả dụng:\n\n` +
            `**🌐 LỆNH DÀNH CHO THÀNH VIÊN (PUBLIC COMMANDS):**\n` +
            `• \`/help\` — Xem menu hướng dẫn và danh sách lệnh bot này.\n` +
            `• \`/invite\` — Lấy link mời Bot, tính toán Permissions Bitfield & OAuth2 Discovery.\n` +
            `• \`/ping\` — Kiểm tra độ trễ WebSocket và API latency của bot.\n` +
            `• \`/stk\` — Nhận thông tin tài khoản ngân hàng MBBank & mã VietQR 24/7.\n` +
            `• \`/feedback\` — Mở biểu mẫu gửi đánh giá, xếp hạng sao & góp ý dịch vụ.\n` +
            `• \`/kiemtra\` — Tra cứu tình trạng mã đơn hàng hoặc kiểm tra role thành viên.\n\n` +
            `**👑 LỆNH DÀNH CHO BAN QUẢN TRỊ (STAFF / ADMIN ONLY):**\n` +
            `• \`/khachhang\` \`@user\` — Cấp role Khách Hàng (Buyer) cho người mua.\n` +
            `• \`/transcript\` — Xuất tệp nhật ký tin nhắn kênh ticket hiện tại.\n` +
            `• \`/clearmessages\` \`amount\` — Xóa nhanh số lượng tin nhắn trong kênh (1-100).\n\n` +
            `**🖱️ CONTEXT MENU APPS (CHUỘT PHẢI / APPS MENU):**\n` +
            `• **User App:** \`Tra cứu khách hàng / User Info\` — Tra cứu nhanh role, quyền VIP & đơn hàng của thành viên.\n` +
            `• **Message App:** \`Báo cáo hỗ trợ / Report Support\` — Báo cáo tin nhắn nhanh đến Staff & mở ticket hỗ trợ.\n\n` +
            `**🔍 DISCOVERY & HỖ TRỢ CHÍNH THỨC:**\n` +
            `• **Mô tả:** ${APP_DIRECTORY_METADATA.BOT_DESCRIPTION}\n` +
            `• **Máy chủ hỗ trợ:** [Support Server](${APP_DIRECTORY_METADATA.SUPPORT_SERVER_URL})\n` +
            `• **Điều khoản & Bảo mật:** [Terms of Service](${APP_DIRECTORY_METADATA.TERMS_OF_SERVICE_URL}) • [Privacy Policy](${APP_DIRECTORY_METADATA.PRIVACY_POLICY_URL})\n` +
            `• **App Directory Readiness:** ${readiness.ready ? '✅ Đã sẵn sàng công khai' : '⚠️ Đang cập nhật'}\n\n` +
            `*Quý khách cần hỗ trợ hoặc mua plugin vui lòng mở ticket tại các kênh bán hàng!*`,
          footer: 'LS STUDIO • Minecraft & AI Solutions 24/7',
          timestamp: true,
          ephemeral: true
        });

        return safeReply(interaction, v2Help);
      }

      // /invite (Tạo link mời Bot, Bitfield Calculator & App Directory Discovery)
      if (commandName === 'invite') {
        const cooldownRemaining = getRateLimitRemaining(interaction.guildId, interaction.user.id, 3000);
        if (cooldownRemaining > 0) {
          return safeReply(interaction, {
            content: `⏳ Bạn thao tác quá nhanh! Vui lòng đợi **${cooldownRemaining} giây** trước khi dùng lệnh tiếp theo.`,
            ephemeral: true
          });
        }

        const clientId = client?.user?.id || process.env.CLIENT_ID || process.env.DISCORD_CLIENT_ID || '1214041776483471391';
        const bitfieldData = calculatePermissionsBitfield(REQUIRED_BOT_PERMISSIONS);
        const guildInviteUrl = generateOAuth2Invite({ clientId, integrationType: 0 });
        const userInstallInviteUrl = generateOAuth2Invite({ clientId, integrationType: 1, scopes: ['applications.commands'] });
        const readiness = validateAppDirectoryReadiness();

        const btnRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('🏰 Mời vào Server (Guild Install)')
            .setStyle(ButtonStyle.Link)
            .setURL(guildInviteUrl),
          new ButtonBuilder()
            .setLabel('👤 Cài vào Tài Khoản (User Install)')
            .setStyle(ButtonStyle.Link)
            .setURL(userInstallInviteUrl),
          new ButtonBuilder()
            .setLabel('💬 Support Server')
            .setStyle(ButtonStyle.Link)
            .setURL(APP_DIRECTORY_METADATA.SUPPORT_SERVER_URL)
        );

        const v2Invite = createComponentsV2Message({
          accentColor: 0x00E676,
          title: '🤖 MỜI BOT LS STUDIO & THÔNG TIN OAUTH2 DISCOVERY',
          description:
            `Cảm ơn bạn đã tin tưởng và sử dụng **LS STUDIO Bot**!\n` +
            `Dưới đây là liên kết mời Bot chính thức, thông số phân quyền Bitfield và kiểm tra tính sẵn sàng App Directory:\n\n` +
            `**📋 THÔNG SỐ OAUTH2 & PERMISSIONS BITFIELD:**\n` +
            `• **Client ID:** \`${clientId}\`\n` +
            `• **Permission Bitfield (Integer):** \`${bitfieldData.bitfieldString}\`\n` +
            `• **Scopes yêu cầu:** \`bot\`, \`applications.commands\`\n` +
            `• **Các quyền hạn cốt lõi:**\n` +
            `  - 💬 \`SendMessages\` (Gửi tin nhắn)\n` +
            `  - 🔗 \`EmbedLinks\` (Gửi nhúng Embed)\n` +
            `  - 📁 \`AttachFiles\` (Đính kèm tệp / QR)\n` +
            `  - 🛡️ \`ManageRoles\` (Cấp vai trò tự động)\n` +
            `  - 📁 \`ManageChannels\` (Tạo kênh Ticket)\n` +
            `  - 📜 \`ReadMessageHistory\` (Đọc lịch sử tin nhắn)\n` +
            `  - 😀 \`UseExternalEmojis\` (Sử dụng biểu cảm ngoài)\n\n` +
            `**🚀 HỖ TRỢ INSTALLATION CONTEXTS (MODERN DISCORD SPECS):**\n` +
            `• 🏰 **Guild Install (Server):** [Thêm vào Máy Chủ](${guildInviteUrl})\n` +
            `• 👤 **User Install (Tài khoản):** [Cài vào Tài Khoản](${userInstallInviteUrl})\n\n` +
            `**🔍 APP DIRECTORY & DISCOVERY STATUS:**\n` +
            `• **Trạng thái:** ${readiness.ready ? '✅ **Đạt chuẩn Discovery (100% Ready)**' : `⚠️ **Cần hoàn thiện (${readiness.score}/${readiness.maxScore})**`}\n` +
            `• **Support Server:** [Tham gia hỗ trợ](${APP_DIRECTORY_METADATA.SUPPORT_SERVER_URL})\n` +
            `• **Chính sách & Điều khoản:** [Terms](${APP_DIRECTORY_METADATA.TERMS_OF_SERVICE_URL}) • [Privacy](${APP_DIRECTORY_METADATA.PRIVACY_POLICY_URL})`,
          footer: 'LS STUDIO • OAuth2 & Permissions Bitfield Engine',
          timestamp: true,
          ephemeral: true,
          actionRows: [btnRow]
        });

        return safeReply(interaction, v2Invite);
      }

      // /clearmessages (Staff Only - Xóa hàng loạt tin nhắn)
      if (commandName === 'clearmessages') {
        if (!interaction.inGuild?.() || !interaction.guild) {
          return safeReply(interaction, { 
            content: "❌ Lệnh này chỉ có thể sử dụng bên trong máy chủ Discord!", 
            ephemeral: true 
          });
        }

        const isStaff = isStaffMember(interaction.member);
        if (!isStaff) {
          return safeReply(interaction, { 
            content: "❌ Bạn không có quyền sử dụng lệnh này! (Dành riêng cho Staff/Admin) / Staff Only!", 
            ephemeral: true 
          });
        }

        const amount = interaction.options.getInteger('amount', true);
        if (!amount || amount < 1 || amount > 100) {
          return safeReply(interaction, { 
            content: "❌ Số lượng tin nhắn cần xóa phải từ 1 đến 100!", 
            ephemeral: true 
          });
        }

        const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe().catch(() => null);
        if (!botMember || !botMember.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
          return safeReply(interaction, { 
            content: "❌ Bot thiếu quyền `Manage Messages` (Quản Lý Tin Nhắn) để thực hiện lệnh này!", 
            ephemeral: true 
          });
        }

        const channel = interaction.channel;
        if (!channel || typeof channel.bulkDelete !== 'function') {
          return safeReply(interaction, { 
            content: "❌ Kênh này không hỗ trợ xóa hàng loạt tin nhắn!", 
            ephemeral: true 
          });
        }

        await safeDeferReply(interaction, { ephemeral: true });

        try {
          const deletedMessages = await channel.bulkDelete(amount, true);
          const deletedCount = deletedMessages?.size ?? amount;
          return safeReply(interaction, {
            content: `🧹 Đã xóa thành công **${deletedCount}** tin nhắn trong kênh! *(Tin nhắn quá 14 ngày không thể xóa hàng loạt theo quy định của Discord)*`,
            ephemeral: true
          });
        } catch (bulkErr) {
          console.error("❌ Lỗi khi bulkDelete:", bulkErr);
          return safeReply(interaction, {
            content: `❌ Không thể xóa tin nhắn: \`${bulkErr.message}\``,
            ephemeral: true
          });
        }
      }

      // /kiemtra (Tra cứu mã đơn hàng hoặc kiểm tra role thành viên)
      if (commandName === 'kiemtra') {
        const cooldownRemaining = getRateLimitRemaining(interaction.guildId, interaction.user.id, 3000);
        if (cooldownRemaining > 0) {
          return safeReply(interaction, {
            content: `⏳ Bạn thao tác quá nhanh! Vui lòng đợi **${cooldownRemaining} giây** trước khi dùng lệnh tiếp theo.`,
            ephemeral: true
          });
        }

        const rawCode = interaction.options.getString('code');
        const targetUser = interaction.options.getUser('user');

        // Case 1: Tra cứu theo mã đơn hàng
        if (rawCode) {
          const cleanCode = sanitizeOrderCode(rawCode);
          if (!cleanCode) {
            return safeReply(interaction, {
              content: `❌ Mã đơn hàng \`${rawCode}\` không đúng định dạng! (Định dạng chuẩn: \`LS\` + 6 ký tự, ví dụ: \`LS123456\`)`,
              ephemeral: true
            });
          }

          const isActive = activeOrderCodes.has(cleanCode);
          const isApproved = approvedOrderCodes.has(cleanCode);
          const isProcessing = processingApprovals.has(cleanCode);
          const orderInfo = activeOrderCodes.get(cleanCode);

          let statusText = '❓ Không tìm thấy trong phiên hiện tại / Not Found';
          let statusColor = 0x9E9E9E;

          if (isApproved) {
            statusText = '✅ **ĐÃ DUYỆT THÀNH CÔNG** (Giao dịch hoàn tất)';
            statusColor = 0x00E676;
          } else if (isProcessing) {
            statusText = '🔄 **ĐANG DUYỆT THANH TOÁN** (Staff đang xử lý)';
            statusColor = 0xFFB300;
          } else if (isActive) {
            statusText = '⏳ **CHỜ THANH TOÁN** (Đơn hàng đang mở)';
            statusColor = 0x00E5FF;
          }

          const pkgData = orderInfo?.pkgKey ? getPackage(orderInfo.pkgKey) : null;
          const v2Order = createComponentsV2Message({
            accentColor: statusColor,
            title: `📦 TRA CỨU ĐƠN HÀNG: \`${cleanCode}\``,
            description:
              `• **Mã đơn hàng:** \`${cleanCode}\`\n` +
              `• **Trạng thái:** ${statusText}\n` +
              (pkgData ? `• **Sản phẩm:** **${pkgData.name}**\n• **Giá tiền:** \`${formatVND(pkgData.priceVND)}\` / \`${formatUSD(pkgData.priceUSD)}\`\n` : '') +
              (orderInfo?.createdAt ? `• **Thời gian tạo:** <t:${Math.floor(orderInfo.createdAt / 1000)}:R>\n` : '') +
              (orderInfo?.buyerId ? `• **Người mua:** <@${orderInfo.buyerId}>\n` : ''),
            footer: 'LS STUDIO Order Verification',
            timestamp: true,
            ephemeral: true
          });

          return safeReply(interaction, v2Order);
        }

        // Case 2: Kiểm tra theo User hoặc chính người gọi lệnh
        const userToCheck = targetUser || interaction.user;

        if (interaction.guild) {
          const member = await interaction.guild.members.fetch(userToCheck.id).catch(() => null);
          if (!member) {
            return safeReply(interaction, {
              content: `❌ Không tìm thấy thành viên <@${userToCheck.id}> trong máy chủ!`,
              ephemeral: true
            });
          }

          const isCustomer = member.roles.cache.some(r => r.name.includes("Khách Hàng"));
          const isVIP = member.roles.cache.some(r => r.name.includes("VIP"));
          const isStaff = isStaffMember(member);
          const highestRole = member.roles.highest;

          const v2User = createComponentsV2Message({
            accentColor: isVIP ? 0xE040FB : (isCustomer ? 0x00E676 : 0x00E5FF),
            title: `👤 THÔNG TIN THÀNH VIÊN: ${member.user.tag}`,
            thumbnailUrl: member.user.displayAvatarURL({ dynamic: true }),
            description:
              `• **Thành viên:** <@${member.id}> (\`${member.id}\`)\n` +
              `• **Vai trò cao nhất:** <@&${highestRole.id}>\n` +
              `• **Khách hàng (Buyer):** ${isCustomer ? '✅ Đã kích hoạt' : '❌ Chưa có'}\n` +
              `• **VIP Customer:** ${isVIP ? '💎 Đã kích hoạt' : '❌ Chưa có'}\n` +
              `• **Ban Quản Trị (Staff):** ${isStaff ? '🛡️ Có' : '❌ Không'}\n` +
              `• **Ngày tham gia server:** <t:${Math.floor((member.joinedTimestamp || Date.now()) / 1000)}:F> (<t:${Math.floor((member.joinedTimestamp || Date.now()) / 1000)}:R>)`,
            footer: 'LS STUDIO Member Verification',
            timestamp: true,
            ephemeral: true
          });

          return safeReply(interaction, v2User);
        }

        return safeReply(interaction, {
          content: `👤 Bạn là <@${userToCheck.id}> (\`${userToCheck.tag}\`). Dùng lệnh này trong server để xem chi tiết vai trò!`,
          ephemeral: true
        });
      }

      // Fallback cho Slash Command chưa hỗ trợ
      return safeReply(interaction, { 
        content: "❌ Lệnh không xác định hoặc chưa được hỗ trợ!", 
        ephemeral: true 
      });
    }

    // 2. BUTTON INTERACTIONS
    if (interaction.isButton?.()) {
      const { customId, user, guild } = interaction;

      // Nút Xem Bảng Giá
      if (customId === 'ticket_pricing') {
        if (!guild) {
          return safeReply(interaction, { content: "❌ Thao tác này chỉ thực hiện được trong máy chủ!", ephemeral: true });
        }
        const chPricing = guild.channels.cache.find(c => c.name.includes('bảng-giá'));
        return safeReply(interaction, {
          content: `💰 Bảng giá chi tiết / Price List: ${chPricing ? `<#${chPricing.id}>` : '#bảng-giá'}`,
          ephemeral: true
        });
      }

      // Nút chuyển ngôn ngữ trong Ticket
      if (customId.startsWith('switch_lang_')) {
        if (!guild) {
          return safeReply(interaction, { content: "❌ Thao tác này chỉ thực hiện được trong máy chủ!", ephemeral: true });
        }
        const parts = customId.split('_');
        const targetLang = parts[2] || 'vi'; // 'vi' or 'en'
        const isEn = targetLang === 'en';
        const ticketOwnerId = parts[3] || user.id;

        const menuRows = buildPackageSelectMenuRows(ticketOwnerId, targetLang);
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

        const v2Lang = createComponentsV2Message({
          accentColor: 0x00E676,
          title: isEn ? "🛒 ORDER & SUPPORT CENTER - LS STUDIO" : "🛒 TRUNG TÂM THANH TOÁN & ĐẶT HÀNG - LS STUDIO",
          description:
            isEn 
              ? `👋 Hello <@${ticketOwnerId}>! Welcome to **LS STUDIO**.\n\n` +
                `👇 **Please select a product from the dropdown menus below**:\n` +
                `• **Menu 1:** Minecraft Plugins & AI Services (Gemini, Claude, ChatGPT, Codex)\n` +
                `• **Menu 2:** CapCut Pro, Windows, Office 365, VPN, Spotify & Entertainment\n\n` +
                `🌐 *If you are an international buyer and need PayPal / Crypto or English support, let our staff know right here!*`
              : `👋 Chào <@${ticketOwnerId}>! Cảm ơn bạn đã lựa chọn dịch vụ từ **LS STUDIO**.\n\n` +
                `👇 **Vui lòng chọn sản phẩm bạn muốn đặt từ 2 Menu bên dưới**:\n` +
                `• **Menu 1:** Plugin Minecraft & Dịch Vụ AI (Gemini, Claude, ChatGPT, Codex)\n` +
                `• **Menu 2:** CapCut Pro, Windows, Office 365, VPN, Spotify & Giải Trí\n\n` +
                `• Đặt mua sản phẩm có sẵn ➔ Tự tạo mã **VietQR MBBank** quét thanh toán siêu tốc!\n` +
                `• Đặt làm **Mod & Plugin riêng** ➔ Trao đổi trực tiếp ý tưởng với Developer để nhận báo giá!`,
          footer: isEn ? "Staff will assist and deliver your files right here!" : "Sau khi chuyển khoản, Staff sẽ duyệt và giao file ngay tại đây!",
          timestamp: true,
          actionRows: [...menuRows, langSwitchRow]
        });

        return safeUpdate(interaction, v2Lang);
      }

      // Nút Mở Modal Yêu Cầu Custom Dev (Plugin / Mod Java / AI Service)
      if (customId === 'ticket_custom' || customId === 'btn_open_custom_modal') {
        if (!guild) {
          return safeReply(interaction, { content: "❌ Thao tác này chỉ thực hiện được trong máy chủ!", ephemeral: true });
        }
        const cooldownRemaining = getRateLimitRemaining(guild.id, user.id, 5000);
        if (cooldownRemaining > 0) {
          return safeReply(interaction, {
            content: `⏳ Bạn thao tác quá nhanh! Vui lòng đợi **${cooldownRemaining} giây** trước khi mở form tiếp theo.\n*Please wait **${cooldownRemaining}s** before opening form.*`,
            ephemeral: true
          });
        }
        const modal = createCustomOrderModal();
        return safeShowModal(interaction, modal);
      }

      // Nút Mở Modal Hỗ Trợ Kỹ Thuật (Tech Support Modal)
      if (customId === 'ticket_support') {
        if (!guild) {
          return safeReply(interaction, { content: "❌ Thao tác này chỉ thực hiện được trong máy chủ!", ephemeral: true });
        }
        const cooldownRemaining = getRateLimitRemaining(guild.id, user.id, 5000);
        if (cooldownRemaining > 0) {
          return safeReply(interaction, {
            content: `⏳ Bạn thao tác quá nhanh! Vui lòng đợi **${cooldownRemaining} giây** trước khi mở form tiếp theo.\n*Please wait **${cooldownRemaining}s** before opening form.*`,
            ephemeral: true
          });
        }
        const modal = createSupportTicketModal();
        return safeShowModal(interaction, modal);
      }

      // Nút Mở Modal Đóng Kèm Lý Do
      if (customId === 'btn_close_with_reason') {
        if (!guild) {
          return safeReply(interaction, { content: "❌ Thao tác này chỉ thực hiện được trong máy chủ!", ephemeral: true });
        }
        const modal = createCloseTicketReasonModal();
        return safeShowModal(interaction, modal);
      }

      // Nút Mở Modal Gửi Nhận Xét & Đánh Giá
      if (customId === 'btn_ticket_feedback') {
        const modal = createFeedbackModal();
        return safeShowModal(interaction, modal);
      }

      // Nút Mở Ticket Mua Hàng (Select Menu Dropdown)
      if (customId === 'ticket_buy') {
        if (!guild) {
          return safeReply(interaction, { content: "❌ Thao tác này chỉ thực hiện được trong máy chủ!", ephemeral: true });
        }

        // 1. Kiểm tra Rate Limit phân vùng theo guild:userId
        const cooldownRemaining = getRateLimitRemaining(guild.id, user.id, 5000);
        if (cooldownRemaining > 0) {
          return safeReply(interaction, {
            content: `⏳ Bạn thao tác quá nhanh! Vui lòng đợi **${cooldownRemaining} giây** trước khi mở ticket tiếp theo.\n*Please wait **${cooldownRemaining}s** before opening another ticket.*`,
            ephemeral: true
          });
        }

        // 2. Kiểm tra Concurrency Lock phân vùng theo guild:userId
        const lockKey = `${guild.id}:${user.id}`;
        if (ticketCreationLocks.has(lockKey) || ticketCreationLocks.has(user.id)) {
          return safeReply(interaction, {
            content: "⏳ Hệ thống đang tạo ticket cho bạn, vui lòng không bấm liên tục!\n*Ticket is being created, please wait...*",
            ephemeral: true
          });
        }

        ticketCreationLocks.add(lockKey);
        ticketCreationLocks.add(user.id);

        try {
          await safeDeferReply(interaction, { ephemeral: true });
          const { existingTicket, ticketChannel, staffMentionString } = await createTicketChannel({
            guild,
            user,
            ticketType: '🛒-mua',
            customTopic: `Ticket của @${user.tag || user.username} (${user.id}) • Type: ticket_buy`
          });

          if (existingTicket) {
            return safeReply(interaction, {
              content: `⚠️ Bạn đã có một ticket đang mở tại / You already have an open ticket at: <#${existingTicket.id}>.`
            });
          }

          const menuRows = buildPackageSelectMenuRows(user.id, 'vi');

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

          const v2Intro = createComponentsV2Message({
            accentColor: 0x00E676,
            title: "🛒 TRUNG TÂM THANH TOÁN & ĐẶT HÀNG / ORDER CENTER",
            description:
              `👋 Chào <@${user.id}>! Cảm ơn bạn đã lựa chọn dịch vụ từ **LS STUDIO**.\n` +
              `*Welcome <@${user.id}>! Thank you for choosing LS STUDIO.*\n\n` +
              `👇 **Vui lòng chọn sản phẩm từ 2 Menu bên dưới**:\n` +
              `• **Menu 1:** Plugin Minecraft & Dịch Vụ AI (Gemini, Claude, ChatGPT, Codex)\n` +
              `• **Menu 2:** CapCut Pro, Windows, Office 365, VPN, Spotify & Giải Trí\n\n` +
              `• 🇻🇳 **Tiếng Việt:** Quét mã VietQR MBBank tự động 24/7.\n` +
              `• 🇺🇸 **English:** Switch to English for PayPal / Global payment options!`,
            footer: "Staff sẽ hỗ trợ và giao file trực tiếp tại đây! / Staff will assist you here!",
            timestamp: true,
            actionRows: [...menuRows, langSwitchRow]
          });

          const introPayload = typeof v2Intro?.toClassic === 'function' ? v2Intro.toClassic() : v2Intro;
          await ticketChannel.send({
            content: `<@${user.id}> ${staffMentionString}`,
            embeds: introPayload.embeds || [],
            components: introPayload.components || [],
            files: introPayload.files || []
          }).catch(async (err) => {
            console.error("❌ Lỗi gửi intro embed vào ticket channel:", err);
            try {
              await ticketChannel.send({
                content: `<@${user.id}> ${staffMentionString}\n**🛒 TRUNG TÂM THANH TOÁN & ĐẶT HÀNG LS STUDIO**\n*Vui lòng chọn sản phẩm từ Menu bên dưới:*`,
                components: [...menuRows, langSwitchRow]
              });
            } catch (fallbackErr) {
              console.error("❌ Lỗi gửi tin nhắn fallback vào ticket:", fallbackErr);
            }
          });

          return safeReply(interaction, {
            content: `✅ Ticket của bạn đã sẵn sàng tại / Your ticket is ready at: <#${ticketChannel.id}>`
          });

        } catch (ticketErr) {
          console.error("Lỗi khởi tạo Ticket:", ticketErr);
          if (ticketErr.code === 30005) {
            return safeReply(interaction, {
              content: "❌ Danh mục Ticket đã đạt giới hạn tối đa (50 kênh của Discord)! Vui lòng liên hệ Admin đóng bớt các ticket cũ."
            });
          } else if (ticketErr.code === 30013) {
            return safeReply(interaction, {
              content: "❌ Máy chủ đã đạt giới hạn tối đa số lượng kênh của Discord (500 kênh)! Vui lòng liên hệ Admin."
            });
          } else if (ticketErr.code === 50013) {
            return safeReply(interaction, {
              content: "❌ Bot thiếu quyền phân quyền Discord (`Manage Channels` hoặc `Manage Roles`) để tạo kênh ticket!"
            });
          }
          return safeReply(interaction, {
            content: `❌ Không thể tạo Ticket do lỗi hệ thống: \`${ticketErr.message}\`. Vui lòng liên hệ Admin!`
          });
        } finally {
          ticketCreationLocks.delete(lockKey);
          ticketCreationLocks.delete(user.id);
        }
      }

      // Nút Duyệt Tiền & Giao File (Dành cho Staff/Admin)
      if (customId.startsWith('approve_')) {
        if (!guild) {
          return safeReply(interaction, {
            content: "❌ Thao tác này chỉ thực hiện được trong máy chủ!",
            ephemeral: true
          });
        }
        const parts = customId.split('_');
        if (parts.length < 4) {
          return safeReply(interaction, {
            content: "❌ Dữ liệu nút duyệt không hợp lệ! / Invalid approve button payload.",
            ephemeral: true
          });
        }
        const rawOrderCode = parts[1];
        const buyerId = parts[2];
        const pkgKey = parts.slice(3).join('_');

        // 1. Kiểm tra và làm sạch định dạng mã đơn hàng
        const orderCode = sanitizeOrderCode(rawOrderCode);
        if (!orderCode) {
          return safeReply(interaction, {
            content: `❌ Mã đơn hàng \`${rawOrderCode}\` không đúng định dạng! / Invalid order code format.`,
            ephemeral: true
          });
        }

        // 2. Kiểm tra định dạng Snowflake Discord ID của Buyer
        if (!/^\d{17,20}$/.test(buyerId)) {
          return safeReply(interaction, {
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
          return safeReply(interaction, {
            content: "❌ Chỉ có Quản Trị Viên / Staff mới có quyền duyệt đơn hàng này! / Staff only action!",
            ephemeral: true
          });
        }

        // 5. Chống race condition & duyệt trùng (Concurrency & Idempotency Guard)
        if (processingApprovals.has(orderCode) || approvedOrderCodes.has(orderCode)) {
          return safeReply(interaction, {
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
          await safeUpdate(interaction, { components: [disabledRow] });

          const buyerMember = await guild.members.fetch(buyerId).catch(() => null);
          let customerRole = guild.roles.cache.find(r => r.name.includes("Khách Hàng") && !r.managed) ||
                             guild.roles.cache.find(r => r.name.includes("Khách Hàng"));
          if (!customerRole) {
            const fetchedRoles = await guild.roles.fetch().catch(() => null);
            customerRole = fetchedRoles?.find(r => r.name.includes("Khách Hàng") && !r.managed) ||
                           fetchedRoles?.find(r => r.name.includes("Khách Hàng"));
          }

          let roleStatusText = "";
          if (!buyerMember) {
            roleStatusText = "⚠️ Khách hàng đã rời khỏi máy chủ (không thể cấp role tự động).";
          } else if (!customerRole) {
            roleStatusText = "⚠️ Không tìm thấy role Khách Hàng trên máy chủ.";
          } else if (customerRole.managed) {
            roleStatusText = `⚠️ Role **${customerRole.name}** là Role Quản lý / Tích hợp tự động (Managed Role), không thể gán tự động.`;
          } else if (customerRole.id === guild.id) {
            roleStatusText = "⚠️ Không thể gán role `@everyone` cho thành viên.";
          } else if (buyerMember.roles?.cache ? buyerMember.roles.cache.has(customerRole.id) : false) {
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
                const sanitizedStaffTag = sanitizeCustomerName(interaction.user.tag || interaction.user.username, 32, 'Staff');
                await buyerMember.roles.add(customerRole, `Duyệt đơn hàng ${orderCode} bởi ${sanitizedStaffTag}`);
                roleStatusText = `• Đã cấp Role **<@&${customerRole.id}>** cho khách hàng.`;
              } catch (rErr) {
                console.warn(`⚠️ [Approve Role Add Warning] Không thể cấp role cho buyer ${buyerId}: ${rErr.message}`);
                roleStatusText = `⚠️ Lỗi phân quyền khi cấp role: \`${rErr.message}\`.`;
              }
            }
          }

          const sanitizedBuyerName = sanitizeCustomerName(buyerMember ? (buyerMember.displayName || buyerMember.user?.username) : 'Khách Hàng', 32);

          const priceDisplayVi = isNegotiatedPrice(pkg.price_vnd)
            ? '`Thỏa thuận / Negotiated`'
            : `\`${formatVND(pkg.price_vnd)}\` (~${formatUSD(pkg.price_usd)})`;

          const v2Success = createComponentsV2Message({
            accentColor: 0x00E676,
            title: "🎉 XÁC NHẬN THANH TOÁN THÀNH CÔNG / PAYMENT APPROVED!",
            description:
              `✅ Đơn hàng **\`${orderCode}\`** đã được <@${interaction.user.id}> xác nhận tiền về tài khoản!\n\n` +
              `👤 **Khách hàng / Customer:** <@${buyerId}> (${sanitizedBuyerName}) ${buyerMember ? '' : '*(Đã rời server)*'}\n` +
              `📦 **Sản phẩm / Product:** **${pkg.name_vi}**\n` +
              `💰 **Số tiền / Amount:** ${priceDisplayVi}\n\n` +
              `👑 **Quyền lợi & Trạng thái / Status:**\n` +
              `${roleStatusText}\n` +
              `• Staff sẽ gửi File / Link / API Key / Tài khoản trực tiếp ngay tại Ticket này!\n\n` +
              `💬 *Cảm ơn bạn đã tin tưởng và sử dụng dịch vụ của LS STUDIO!*`,
            footer: { text: "LS STUDIO • Thank you for your purchase!", iconURL: client.user ? client.user.displayAvatarURL({ size: 256 }) : undefined },
            timestamp: true
          });

          const successPayload = typeof v2Success?.toClassic === 'function' ? v2Success.toClassic() : v2Success;
          await safeChannelSend(interaction.channel, successPayload);

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
                `• **Khách hàng / Customer:** <@${buyerId}> (\`${sanitizedBuyerName}\` - \`${buyerId}\`)${buyerMember ? '' : ' *(Đã rời server)*'}\n` +
                `• **Sản phẩm / Product:** ${pkg.name_vi}\n` +
                `• **Số tiền / Amount:** ${priceDisplayVi}\n` +
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
        if (!guild) {
          return safeReply(interaction, { content: "❌ Thao tác này chỉ thực hiện được trong máy chủ!", ephemeral: true });
        }
        const isTicketChannel = interaction.channel?.name?.includes('mua') ||
                                interaction.channel?.name?.includes('support') ||
                                interaction.channel?.name?.includes('custom') ||
                                interaction.channel?.name?.includes('ticket') ||
                                interaction.channel?.topic?.includes('Ticket của') ||
                                interaction.channel?.parent?.name?.includes('MUA HÀNG') ||
                                interaction.channel?.parent?.name?.includes('HỖ TRỢ');

        if (!isTicketChannel) {
          return safeReply(interaction, { 
            content: "⚠️ Nút này chỉ có thể sử dụng bên trong các kênh Ticket!", 
            ephemeral: true 
          });
        }

        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('confirm_close_ticket')
            .setLabel('🔴 Xác Nhận Đóng / Confirm Close')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('btn_close_with_reason')
            .setLabel('📝 Đóng Kèm Lý Do / Close with Reason')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('cancel_close_ticket')
            .setLabel('⚪ Hủy Bỏ / Cancel')
            .setStyle(ButtonStyle.Secondary)
        );

        const v2Confirm = createComponentsV2Message({
          accentColor: 0xFFA000,
          title: "⚠️ XÁC NHẬN ĐÓNG TICKET / CLOSE CONFIRMATION",
          description:
            `Bạn có chắc chắn muốn đóng ticket **#${interaction.channel.name}** không?\n\n` +
            `• Toàn bộ tin nhắn (Transcript) sẽ được tạo và lưu trữ tự động vào kênh quản trị.\n` +
            `• Kênh chat này sẽ bị **xóa vĩnh viễn** sau khi xác nhận.\n\n` +
            `*Are you sure you want to close this ticket? A transcript file will be generated and saved to admin logs.*`,
          footer: "LS STUDIO Ticket Security",
          actionRows: [confirmRow]
        });

        return safeReply(interaction, v2Confirm);
      }

      // Nút Hủy Đóng Ticket
      if (customId === 'cancel_close_ticket') {
        if (!guild) {
          return safeReply(interaction, { content: "❌ Thao tác này chỉ thực hiện được trong máy chủ!", ephemeral: true });
        }
        const v2Cancel = createComponentsV2Message({
          accentColor: 0x4CAF50,
          description: "✅ **Đã hủy thao tác đóng ticket.** Bạn có thể tiếp tục trao đổi với Staff!\n*Ticket close cancelled. You can continue chatting.*",
          actionRows: []
        });

        return safeUpdate(interaction, v2Cancel);
      }

      // Nút Xác Nhận Đóng Ticket (Tạo transcript, gửi log và xóa kênh qua executeTicketClosure)
      if (customId === 'confirm_close_ticket') {
        if (!guild) {
          return safeReply(interaction, { content: "❌ Thao tác này chỉ thực hiện được trong máy chủ!", ephemeral: true });
        }
        const channel = interaction.channel;
        if (!channel || !channel.isTextBased()) {
          return safeReply(interaction, { content: "❌ Không thể thực hiện thao tác trên kênh này!", ephemeral: true });
        }

        if (closingTicketChannels.has(channel.id)) {
          return safeReply(interaction, { content: "⏳ Kênh ticket này đang trong tiến trình đóng & lưu transcript...", ephemeral: true });
        }

        const v2Closing = createComponentsV2Message({
          accentColor: 0xED4245,
          title: "🔒 ĐANG ĐÓNG TICKET & LƯU TRANSCRIPT...",
          description: "Đang tổng hợp toàn bộ tin nhắn và lưu trữ nhật ký hội thoại. Kênh sẽ tự động xóa sau 5 giây...\n*Generating full transcript and closing ticket. Channel will be deleted in 5 seconds...*",
          actionRows: []
        });

        await safeUpdate(interaction, v2Closing);
        await executeTicketClosure({ channel, guild, closerUser: user, closeReason: null });
        return;
      }
    }

    // 3. SELECT MENU (CHỌN GÓI MUA - VIỆT NAM HOẶC ENGLISH)
    if (interaction.isStringSelectMenu?.()) {
      if (interaction.customId.startsWith('select_package_')) {
        const { guild, user } = interaction;
        if (!guild) {
          return safeReply(interaction, { content: "❌ Thao tác này chỉ thực hiện được trong máy chủ!", ephemeral: true });
        }
        const parts = interaction.customId.split('_');
        const lang = parts[2] || 'vi'; // 'vi' or 'en'
        const isEn = lang === 'en';
        const ticketOwnerId = parts[3] || user.id;
        const selectedKey = interaction.values[0];
        const pkg = getPackage(selectedKey);

        if (!pkg) {
          return safeReply(interaction, {
            content: isEn 
              ? "❌ The selected package is deprecated or no longer available. Please select from the updated menu!" 
              : "❌ Gói sản phẩm không tồn tại hoặc đã được cập nhật. Vui lòng chọn lại gói từ menu!",
            ephemeral: true
          });
        }

        // Kiểm tra quyền tương tác: Phải là chủ Ticket hoặc Staff
        const isStaff = isStaffMember(interaction.member);

        if (user.id !== ticketOwnerId && !isStaff) {
          return safeReply(interaction, {
            content: "❌ Bạn không phải là chủ sở hữu của Ticket này! / You are not the owner of this ticket!",
            ephemeral: true
          });
        }

        // Xử lý gói Custom Mod hoặc Custom Plugin (Báo giá thỏa thuận)
        if (isNegotiatedPrice(pkg.price_vnd)) {
          const isMod = selectedKey === 'custom_mod';
          const btnClose = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('btn_open_custom_modal')
              .setLabel(isEn ? '📝 Fill Requirements Form' : '📝 Điền Form Yêu Cầu Chi Tiết')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId('btn_close_ticket')
              .setLabel(isEn ? '🔒 Close Ticket' : '🔒 Đóng Ticket')
              .setStyle(ButtonStyle.Danger)
          );

          const v2Custom = createComponentsV2Message({
            accentColor: isMod ? 0x9C27B0 : 0xFF4500,
            title: isEn 
              ? (isMod ? "🧩 CUSTOM MINECRAFT JAVA MOD DEVELOPMENT" : "📝 CUSTOM PLUGIN DEVELOPMENT")
              : (isMod ? "🧩 ĐẶT LÀM MOD CUSTOM CHO MINECRAFT JAVA" : "📝 ĐẶT LẬP TRÌNH PLUGIN THEO Ý TƯỞNG"),
            description:
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
                      `3. Khi thống nhất, Dev sẽ gửi mã QR MBBank để bạn đặt cọc 50% và bắt đầu tiến hành code!`),
            footer: "LS STUDIO • Uy Tín - Đúng Hẹn - Tối Ưu",
            timestamp: true,
            actionRows: [btnClose]
          });

          return safeReply(interaction, v2Custom);
        }

        await safeDeferReply(interaction);

        // Tái sử dụng mã đơn hàng đang hoạt động của phiên ticket này (nếu có trong 30 phút) theo guild để tối ưu cache ảnh QR khi đổi gói
        let orderCode = null;
        for (const [code, data] of activeOrderCodes.entries()) {
          if (data.buyerId === ticketOwnerId && (!data.guildId || data.guildId === guild.id) && !approvedOrderCodes.has(code) && (Date.now() - (data.createdAt || 0) < 30 * 60 * 1000)) {
            orderCode = code;
            data.pkgKey = selectedKey;
            data.guildId = guild.id;
            break;
          }
        }

        if (!orderCode) {
          orderCode = generateUniqueOrderCode();
          activeOrderCodes.set(orderCode, {
            createdAt: Date.now(),
            pkgKey: selectedKey,
            buyerId: ticketOwnerId,
            guildId: guild.id
          });
        }

        const qrUrl = generateVietQRUrl({
          template: 'compact2',
          amount: pkg.price_vnd,
          addInfo: orderCode
        });

        const qrBuffer = await fetchVietQRBuffer(qrUrl);

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
          const v2Invoice = createComponentsV2Message({
            accentColor: 0x00E676,
            title: isEn ? `💳 PAYMENT INVOICE: ${orderCode}` : `💳 HÓA ĐƠN THANH TOÁN: ${orderCode}`,
            description:
              isEn 
                ? `You selected: **${pkg.name_en}**\n\n` +
                  `💰 **Amount Due:** \`${formatVND(pkg.price_vnd)}\` (~**${formatUSD(pkg.price_usd)}**)\n` +
                  `🏦 **Bank:** **MBBank Vietnam (BIN: 970422)**\n` +
                  `🔢 **Account No:** \`${BANK_CONFIG.ACCOUNT_NO}\`\n` +
                  `👤 **Account Name:** **${BANK_CONFIG.ACCOUNT_NAME}**\n` +
                  `📝 **Transfer Memo / Note:** **\`${orderCode}\`** *(Required)*\n\n` +
                  `📱 **Payment Options:**\n` +
                  `• **Vietnam Banking / MoMo:** Scan the VietQR code below for instant transfer.\n` +
                  `• **International Customers (PayPal / Crypto / Card):** Please message staff in this ticket to receive payment instructions!\n` +
                  `• Once transferred, staff will approve and deliver your files / API Key / Account immediately!`
                : `Quý khách đã chọn: **${pkg.name_vi}**\n\n` +
                  `💰 **Số tiền cần thanh toán:** \`${formatVND(pkg.price_vnd)}\` (~${formatUSD(pkg.price_usd)})\n` +
                  `🏦 **Ngân hàng:** **MBBank (Ngân Hàng TMCP Quân Đội - BIN: 970422)**\n` +
                  `🔢 **Số tài khoản:** \`${BANK_CONFIG.ACCOUNT_NO}\`\n` +
                  `👤 **Chủ tài khoản:** **${BANK_CONFIG.ACCOUNT_NAME}**\n` +
                  `📝 **Nội dung chuyển khoản:** **\`${orderCode}\`** *(Bắt buộc ghi đúng)*\n\n` +
                  `📱 **Hướng dẫn quét mã nhanh:**\n` +
                  `• Mở App **MBBank** hoặc bất kỳ ứng dụng ngân hàng / MoMo nào trên điện thoại.\n` +
                  `• Quét mã QR bên dưới -> Số tiền và nội dung sẽ tự động điền chính xác 100%!\n` +
                  `• Chuyển khoản xong, vui lòng đợi Staff bấm duyệt để nhận File / Key / Tài khoản ngay tại đây!`,
            footer: `Order ID: ${orderCode} • LS STUDIO Payment System`,
            timestamp: true,
            actionRows: [actionRow],
            files: [attachment]
          });
          if (v2Invoice.toClassic()?.embeds?.[0]) {
            v2Invoice.toClassic().embeds[0].setImage(`attachment://vietqr_${orderCode}.png`);
          }
          return safeReply(interaction, v2Invoice);
        } else {
          const v2Invoice = createComponentsV2Message({
            accentColor: 0xFFA500,
            title: isEn ? `💳 PAYMENT INVOICE: ${orderCode}` : `💳 HÓA ĐƠN THANH TOÁN: ${orderCode}`,
            description:
              isEn 
                ? `You selected: **${pkg.name_en}**\n\n` +
                  `💰 **Amount Due:** \`${formatVND(pkg.price_vnd)}\` (~**${formatUSD(pkg.price_usd)}**)\n` +
                  `🏦 **Bank:** **MBBank Vietnam (MB / BIN: 970422)**\n` +
                  `🔢 **Account No:** \`${BANK_CONFIG.ACCOUNT_NO}\`\n` +
                  `👤 **Account Name:** **${BANK_CONFIG.ACCOUNT_NAME}**\n` +
                  `📝 **Transfer Memo / Note:** **\`${orderCode}\`** *(Required)*\n\n` +
                  `📱 **Payment Options (VietQR Image Offline):**\n` +
                  `• **Vietnam Banking 24/7:** Automatic QR image server is temporarily offline, but **Bank Transfers are 100% operational**! Please transfer manually using the details below or click **[🔗 Open VietQR Link]**.\n` +
                  `• **International Customers (PayPal / Crypto / Card):** Please message staff in this ticket to receive payment instructions!\n` +
                  `• Once transferred, staff will approve and deliver your files / API Key / Account immediately!`
                : `Quý khách đã chọn: **${pkg.name_vi}**\n\n` +
                  `💰 **Số tiền cần thanh toán:** \`${formatVND(pkg.price_vnd)}\` (~${formatUSD(pkg.price_usd)})\n` +
                  `🏦 **Ngân hàng:** **MBBank (Ngân Hàng TMCP Quân Đội - MB / BIN: 970422)**\n` +
                  `🔢 **Số tài khoản:** \`${BANK_CONFIG.ACCOUNT_NO}\`\n` +
                  `👤 **Chủ tài khoản:** **${BANK_CONFIG.ACCOUNT_NAME}**\n` +
                  `📝 **Nội dung chuyển khoản:** **\`${orderCode}\`** *(Bắt buộc ghi đúng)*\n\n` +
                  `📱 **Hướng dẫn chuyển khoản thủ công (Khi mã QR bảo trì):**\n` +
                  `• Cổng tạo ảnh QR tự động tạm thời phản hồi chậm, nhưng **Hệ thống Ngân hàng 24/7 vẫn nhận tiền bình thường 100%**!\n` +
                  `• Mở App **MBBank** hoặc bất kỳ ứng dụng ngân hàng / MoMo nào trên điện thoại.\n` +
                  `• Chọn chuyển tiền liên ngân hàng 24/7 đến MBBank -> Nhập STK \`${BANK_CONFIG.ACCOUNT_NO}\`, Số tiền \`${formatVND(pkg.price_vnd)}\`, và Nội dung \`${orderCode}\`.\n` +
                  `• Chuyển khoản xong, vui lòng đợi Staff bấm duyệt để nhận File / Key / Tài khoản ngay tại đây!`,
            fields: [
              {
                name: isEn 
                  ? "⚠️ VIETQR GATEWAY TEMPORARILY OFFLINE / BẢO TRÌ MÃ QR" 
                  : "⚠️ CỔNG TẠO ẢNH VIETQR TẠM THỜI BẢO TRÌ / OFFLINE NOTICE",
                value: isEn
                  ? "The automatic VietQR image gateway is temporarily offline or experiencing high traffic.\n**Banking transfers are 100% operational!** Please use the manual transfer details below or click **[🔗 Open VietQR Link]**."
                  : "Cổng tạo ảnh VietQR tự động tạm thời phản hồi chậm hoặc đang bảo trì đường truyền.\n**Hệ thống Ngân hàng 24/7 vẫn hoạt động bình thường!** Quý khách vui lòng chuyển khoản thủ công theo thông tin bên dưới hoặc bấm nút **[🔗 Mở mã VietQR]**:"
              },
              {
                name: isEn ? "📋 MANUAL TRANSFER INSTRUCTIONS" : "📋 HƯỚNG DẪN CHUYỂN KHOẢN THỦ CÔNG",
                value: isEn
                  ? `🏦 **Bank:** \`MBBank (Military Commercial Joint Stock Bank - BIN: 970422)\`\n` +
                    `🔢 **Account No:** \`${BANK_CONFIG.ACCOUNT_NO}\`\n` +
                    `👤 **Account Name:** \`${BANK_CONFIG.ACCOUNT_NAME}\`\n` +
                    `💰 **Amount Due:** \`${formatVND(pkg.price_vnd)}\` (~${formatUSD(pkg.price_usd)})\n` +
                    `📝 **Required Memo / Note:** \`${orderCode}\`\n\n` +
                    `👉 *Tap/click on Account No or Memo above to copy instantly!*`
                  : `🏦 **Ngân hàng:** \`MBBank (Ngân Hàng TMCP Quân Đội - BIN: 970422)\`\n` +
                    `🔢 **Số tài khoản:** \`${BANK_CONFIG.ACCOUNT_NO}\`\n` +
                    `👤 **Chủ tài khoản:** \`${BANK_CONFIG.ACCOUNT_NAME}\`\n` +
                    `💰 **Số tiền chính xác:** \`${formatVND(pkg.price_vnd)}\` (~${formatUSD(pkg.price_usd)})\n` +
                    `📝 **Nội dung bắt buộc:** \`${orderCode}\`\n\n` +
                    `👉 *Quý khách chạm/click vào Số tài khoản hoặc Mã đơn để sao chép nhanh!*`
              }
            ],
            footer: `Order ID: ${orderCode} • LS STUDIO Payment System`,
            timestamp: true,
            actionRows: [actionRow]
          });
          return safeReply(interaction, v2Invoice);
        }
      }
    }

    // 4. MODAL SUBMISSIONS (XỬ LÝ BIỂU MẪU NHẬP LIỆU CHUẨN DISCORD SPECS)
    if (interaction.isModalSubmit?.()) {
      const { customId, user, guild } = interaction;

      // 4.1 Modal Đặt Làm Plugin / Mod Custom (modal_custom_order)
      if (customId === 'modal_custom_order') {
        if (!guild) {
          return safeReply(interaction, { 
            content: "❌ Biểu mẫu này chỉ có thể xử lý bên trong máy chủ Discord!", 
            ephemeral: true 
          });
        }

        // Bóc tách text inputs an toàn qua interaction.fields.getTextInputValue và làm sạch dữ liệu
        const projectType = sanitizeModalInlineText(interaction.fields.getTextInputValue('custom_project_type'), 50, 'Custom Plugin/Mod');
        const version = sanitizeModalInlineText(interaction.fields.getTextInputValue('custom_version'), 50, 'Paper/Purpur 1.20+');
        const features = sanitizeModalCodeBlockText(interaction.fields.getTextInputValue('custom_features'), 1500, 'N/A');
        const budgetDeadline = sanitizeModalInlineText(interaction.fields.getTextInputValue('custom_budget_deadline'), 100, 'Thỏa thuận / Flexible');
        const contact = sanitizeModalInlineText(interaction.fields.getTextInputValue('custom_contact'), 100, 'Trực tiếp tại ticket Discord');

        // 1. Chống race condition phân vùng theo guild:userId
        const lockKey = `${guild.id}:${user.id}`;
        if (ticketCreationLocks.has(lockKey) || ticketCreationLocks.has(user.id)) {
          return safeReply(interaction, {
            content: "⏳ Hệ thống đang xử lý yêu cầu của bạn, vui lòng đợi trong giây lát!\n*Your request is being processed, please wait...*",
            ephemeral: true
          });
        }
        ticketCreationLocks.add(lockKey);
        ticketCreationLocks.add(user.id);

        try {
          // Hoãn phản hồi (deferReply) chống 3-second timeout vì tạo kênh và thiết lập phân quyền mất 1-2s
          await safeDeferReply(interaction, { ephemeral: true });

          // Nếu người dùng đang submit từ bên trong một kênh ticket đã có
          const isInExistingTicket = interaction.channel?.topic?.includes(`(${user.id})`);
          if (isInExistingTicket) {
            const v2Detail = createComponentsV2Message({
              accentColor: 0xFF4500,
              title: "📝 THÔNG TIN YÊU CẦU ĐẶT CODE (CUSTOM DEV)",
              description:
                `Khách hàng <@${user.id}> vừa cập nhật form thông tin chi tiết:\n\n` +
                `• 📦 **Loại sản phẩm:** \`${projectType}\`\n` +
                `• ⚙️ **Phiên bản & Nền tảng:** \`${version}\`\n` +
                `• 💰 **Ngân sách & Thời hạn:** \`${budgetDeadline}\`\n` +
                `• 📞 **Ghi chú / Liên hệ:** \`${contact}\`\n\n` +
                `📋 **Chi tiết tính năng yêu cầu:**\n` +
                `\`\`\`text\n${features}\n\`\`\``,
              footer: "LS STUDIO • Lead Developer sẽ phản hồi và báo giá sớm nhất!",
              timestamp: true
            });

            const detailPayload = typeof v2Detail?.toClassic === 'function' ? v2Detail.toClassic() : v2Detail;
            await safeChannelSend(interaction.channel, detailPayload);

            // Cập nhật topic kênh kèm tóm tắt yêu cầu
            try {
              const newTopic = sanitizeDiscordChannelTopic(`Ticket của @${user.tag || user.username} (${user.id}) • Type: custom_dev • Spec: ${projectType}`);
              await interaction.channel.setTopic(newTopic).catch(() => {});
            } catch (_) {}

            return safeReply(interaction, {
              content: "✅ Đã cập nhật yêu cầu và gửi thông tin vào kênh Ticket thành công! Lead Developer sẽ phản hồi ngay tại đây."
            });
          }

          // Nếu submit từ panel kênh chung -> Khởi tạo ticket custom mới
          const { existingTicket, ticketChannel, staffMentionString } = await createTicketChannel({
            guild,
            user,
            ticketType: '📝-custom',
            customTopic: `Ticket Custom của @${user.tag || user.username} (${user.id}) • Type: custom_dev • Spec: ${projectType}`
          });

          if (existingTicket) {
            return safeReply(interaction, {
              content: `⚠️ Bạn đã có một ticket đang mở tại: <#${existingTicket.id}>.`
            });
          }

          const btnRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('btn_ticket_feedback')
              .setLabel('⭐ Đánh Giá / Feedback')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId('btn_close_ticket')
              .setLabel('🔒 Đóng Ticket / Close')
              .setStyle(ButtonStyle.Danger)
          );

          const v2Order = createComponentsV2Message({
            accentColor: 0xFF4500,
            title: "📝 PHIẾU ĐẶT LÀM PLUGIN / MOD CUSTOM - LS STUDIO",
            description:
              `👋 Chào <@${user.id}>! Cảm ơn bạn đã gửi thông tin yêu cầu đặt làm dự án riêng.\n\n` +
              `📦 **Loại sản phẩm:** \`${projectType}\`\n` +
              `⚙️ **Phiên bản / Môi trường:** \`${version}\`\n` +
              `💰 **Ngân sách & Thời hạn dự kiến:** \`${budgetDeadline}\`\n` +
              `📞 **Ghi chú / Liên hệ khác:** \`${contact}\`\n\n` +
              `📋 **Mô tả tính năng & gameplay yêu cầu:**\n` +
              `\`\`\`text\n${features}\n\`\`\`\n` +
              `*Lead Developer của LS STUDIO sẽ xem xét yêu cầu và trao đổi báo giá trực tiếp tại đây!*`,
            footer: "LS STUDIO • Uy Tín - Đúng Hẹn - Tối Ưu",
            timestamp: true,
            actionRows: [btnRow]
          });

          const v2Payload = typeof v2Order?.toClassic === 'function' ? v2Order.toClassic() : v2Order;
          await ticketChannel.send({
            content: `<@${user.id}> ${staffMentionString}`,
            embeds: v2Payload.embeds || [],
            components: v2Payload.components || [],
            files: v2Payload.files || []
          }).catch(async () => {
            try {
              await ticketChannel.send({
                content: `<@${user.id}> ${staffMentionString}\n**📝 PHIẾU ĐẶT LÀM PLUGIN / MOD CUSTOM - LS STUDIO**`,
                components: [btnRow]
              });
            } catch (_) {}
          });

          return safeReply(interaction, {
            content: `✅ Ticket đặt làm Custom của bạn đã sẵn sàng tại: <#${ticketChannel.id}>`
          });

        } catch (err) {
          console.error("❌ Lỗi xử lý submit modal custom order:", err);
          if (err.code === 30005) {
            return safeReply(interaction, {
              content: "❌ Danh mục Ticket đã đạt giới hạn tối đa (50 kênh của Discord)! Vui lòng liên hệ Admin đóng bớt các ticket cũ."
            });
          } else if (err.code === 30013) {
            return safeReply(interaction, {
              content: "❌ Máy chủ đã đạt giới hạn tối đa số lượng kênh của Discord (500 kênh)! Vui lòng liên hệ Admin."
            });
          } else if (err.code === 50013) {
            return safeReply(interaction, {
              content: "❌ Bot thiếu quyền phân quyền Discord (`Manage Channels` hoặc `Manage Roles`) để tạo kênh ticket!"
            });
          }
          return safeReply(interaction, {
            content: `❌ Không thể tạo Ticket do lỗi: \`${err.message}\`. Vui lòng liên hệ Admin!`
          });
        } finally {
          ticketCreationLocks.delete(lockKey);
          ticketCreationLocks.delete(user.id);
        }
      }

      // 4.2 Modal Yêu Cầu Hỗ Trợ Kỹ Thuật (modal_support_ticket)
      if (customId === 'modal_support_ticket') {
        if (!guild) {
          return safeReply(interaction, { 
            content: "❌ Biểu mẫu này chỉ có thể xử lý bên trong máy chủ Discord!", 
            ephemeral: true 
          });
        }

        const issueTitle = sanitizeModalInlineText(interaction.fields.getTextInputValue('support_issue_title'), 100, 'Hỗ trợ kỹ thuật');
        const serverEnv = sanitizeModalInlineText(interaction.fields.getTextInputValue('support_server_env'), 50, 'Paper/Purpur');
        const description = sanitizeModalCodeBlockText(interaction.fields.getTextInputValue('support_description'), 1500, 'N/A');

        // 1. Chống race condition phân vùng theo guild:userId
        const lockKey = `${guild.id}:${user.id}`;
        if (ticketCreationLocks.has(lockKey) || ticketCreationLocks.has(user.id)) {
          return safeReply(interaction, {
            content: "⏳ Hệ thống đang xử lý yêu cầu của bạn, vui lòng đợi trong giây lát!\n*Your request is being processed, please wait...*",
            ephemeral: true
          });
        }
        ticketCreationLocks.add(lockKey);
        ticketCreationLocks.add(user.id);

        try {
          // Hoãn phản hồi (deferReply) chống 3-second timeout
          await safeDeferReply(interaction, { ephemeral: true });

          // Nếu người dùng đang submit từ bên trong một kênh ticket đã có
          const isInExistingTicket = interaction.channel?.topic?.includes(`(${user.id})`);
          if (isInExistingTicket) {
            const v2Detail = createComponentsV2Message({
              accentColor: 0x3D5AFE,
              title: "🛠️ CẬP NHẬT THÔNG TIN LỖI / TECH SUPPORT",
              description:
                `Khách hàng <@${user.id}> vừa cập nhật chi tiết vấn đề:\n\n` +
                `• 📌 **Tiêu đề lỗi:** \`${issueTitle}\`\n` +
                `• ⚙️ **Môi trường & Phiên bản:** \`${serverEnv}\`\n\n` +
                `📋 **Chi tiết mô tả & Log:**\n` +
                `\`\`\`text\n${description}\n\`\`\``,
              footer: "LS STUDIO Support Team",
              timestamp: true
            });

            const detailPayload = typeof v2Detail?.toClassic === 'function' ? v2Detail.toClassic() : v2Detail;
            await safeChannelSend(interaction.channel, detailPayload);
            return safeReply(interaction, {
              content: "✅ Đã gửi chi tiết lỗi vào kênh Ticket thành công! Kỹ thuật viên sẽ hỗ trợ ngay."
            });
          }

          // Tạo ticket hỗ trợ mới
          const { existingTicket, ticketChannel, staffMentionString } = await createTicketChannel({
            guild,
            user,
            ticketType: '🛠️-support',
            customTopic: `Ticket Support của @${user.tag || user.username} (${user.id}) • Issue: ${issueTitle.slice(0, 30)}`
          });

          if (existingTicket) {
            return safeReply(interaction, {
              content: `⚠️ Bạn đã có một ticket đang mở tại: <#${existingTicket.id}>.`
            });
          }

          const btnRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('btn_close_ticket')
              .setLabel('🔒 Đóng Ticket / Close')
              .setStyle(ButtonStyle.Danger)
          );

          const v2Support = createComponentsV2Message({
            accentColor: 0x3D5AFE,
            title: "🛠️ PHIẾU HỖ TRỢ KỸ THUẬT - LS STUDIO",
            description:
              `👋 Chào <@${user.id}>! Đội ngũ Kỹ Thuật đã tiếp nhận yêu cầu hỗ trợ của bạn.\n\n` +
              `📌 **Tiêu đề vấn đề:** \`${issueTitle}\`\n` +
              `⚙️ **Môi trường & Phiên bản:** \`${serverEnv}\`\n\n` +
              `📋 **Mô tả chi tiết & Log lỗi:**\n` +
              `\`\`\`text\n${description}\n\`\`\`\n` +
              `*Bạn có thể đính kèm thêm file log (\`latest.log\`) hoặc chụp ảnh màn hình trực tiếp tại kênh này.*`,
            footer: "LS STUDIO Support Team • Hỗ Trợ 24/7",
            timestamp: true,
            actionRows: [btnRow]
          });

          const v2SupportPayload = typeof v2Support?.toClassic === 'function' ? v2Support.toClassic() : v2Support;
          await ticketChannel.send({
            content: `<@${user.id}> ${staffMentionString}`,
            embeds: v2SupportPayload.embeds || [],
            components: v2SupportPayload.components || [],
            files: v2SupportPayload.files || []
          }).catch(async () => {
            try {
              await ticketChannel.send({
                content: `<@${user.id}> ${staffMentionString}\n**🛠️ PHIẾU HỖ TRỢ KỸ THUẬT - LS STUDIO**`,
                components: [btnRow]
              });
            } catch (_) {}
          });

          return safeReply(interaction, {
            content: `✅ Ticket hỗ trợ kỹ thuật của bạn đã sẵn sàng tại: <#${ticketChannel.id}>`
          });

        } catch (err) {
          console.error("❌ Lỗi xử lý submit modal support:", err);
          if (err.code === 30005) {
            return safeReply(interaction, {
              content: "❌ Danh mục Ticket đã đạt giới hạn tối đa (50 kênh của Discord)! Vui lòng liên hệ Admin đóng bớt các ticket cũ."
            });
          } else if (err.code === 30013) {
            return safeReply(interaction, {
              content: "❌ Máy chủ đã đạt giới hạn tối đa số lượng kênh của Discord (500 kênh)! Vui lòng liên hệ Admin."
            });
          } else if (err.code === 50013) {
            return safeReply(interaction, {
              content: "❌ Bot thiếu quyền phân quyền Discord (`Manage Channels` hoặc `Manage Roles`) để tạo kênh ticket!"
            });
          }
          return safeReply(interaction, {
            content: `❌ Không thể tạo Ticket do lỗi: \`${err.message}\`. Vui lòng liên hệ Admin!`
          });
        } finally {
          ticketCreationLocks.delete(lockKey);
          ticketCreationLocks.delete(user.id);
        }
      }

      // 4.3 Modal Đóng Ticket Kèm Lý Do (modal_close_ticket_reason)
      if (customId === 'modal_close_ticket_reason') {
        if (!guild) {
          return safeReply(interaction, { 
            content: "❌ Biểu mẫu này chỉ có thể xử lý bên trong máy chủ Discord!", 
            ephemeral: true 
          });
        }

        const closeReason = sanitizeModalInlineText(interaction.fields.getTextInputValue('close_reason'), 500, 'Không có lý do cụ thể');

        const channel = interaction.channel;
        if (!channel || !channel.isTextBased()) {
          return safeReply(interaction, { content: "❌ Không thể thực hiện thao tác trên kênh này!", ephemeral: true });
        }

        if (closingTicketChannels.has(channel.id)) {
          return safeReply(interaction, { content: "⏳ Kênh ticket này đang trong tiến trình đóng và lưu transcript...", ephemeral: true });
        }

        await safeDeferReply(interaction, { ephemeral: true });

        const v2Closing = createComponentsV2Message({
          accentColor: 0xED4245,
          title: "🔒 ĐANG ĐÓNG TICKET & LƯU TRANSCRIPT...",
          description:
            `Ticket đang được đóng bởi <@${user.id}>.\n` +
            `📝 **Lý do / Ghi chú:** \`${closeReason}\`\n\n` +
            `Đang tạo file nhật ký hội thoại (Transcript) và lưu trữ. Kênh sẽ tự động xóa sau 5 giây...`
        });

        const closingPayload = typeof v2Closing?.toClassic === 'function' ? v2Closing.toClassic() : v2Closing;
        await safeChannelSend(channel, closingPayload);
        await safeReply(interaction, {
          content: "✅ Đã ghi nhận lý do và tiến hành đóng ticket lưu trữ transcript thành công!"
        });

        await executeTicketClosure({ channel, guild, closerUser: user, closeReason });
        return;
      }

      // 4.4 Modal Gửi Đánh Giá Dịch Vụ (modal_feedback)
      if (customId === 'modal_feedback') {
        const rating = sanitizeModalInlineText(interaction.fields.getTextInputValue('feedback_rating'), 15, '5 sao ⭐⭐⭐⭐⭐');
        const comment = sanitizeModalCodeBlockText(interaction.fields.getTextInputValue('feedback_comment'), 1000, 'Không có nhận xét');

        await safeDeferReply(interaction, { ephemeral: true });

        const safeUserTag = sanitizeCustomerName(user.tag || user.username, 32, 'Khách Hàng');

        const v2Feedback = createComponentsV2Message({
          accentColor: 0xFFD700,
          title: "⭐ ĐÁNH GIÁ DỊCH VỤ MỚI / CUSTOMER FEEDBACK",
          description:
            `👤 **Khách hàng:** <@${user.id}> (\`${safeUserTag}\`)\n` +
            `🌟 **Đánh giá:** **${rating}**\n\n` +
            `💬 **Nhận xét & Trải nghiệm:**\n` +
            `\`\`\`text\n${comment}\n\`\`\``,
          footer: "LS STUDIO • Customer Feedback System",
          timestamp: true
        });

        // Gửi vào kênh đánh giá hoặc log (hỗ trợ cả khi gửi từ DM hoặc Guild)
        try {
          const targetGuild = guild || (GUILD_ID ? client.guilds.cache.get(GUILD_ID) : null) || client.guilds.cache.first();
          if (targetGuild) {
            let fbChannel = targetGuild.channels.cache.find(c => 
              c.isTextBased() && (
                c.name.includes("đánh-giá") ||
                c.name.includes("nhận-xét") ||
                c.name.includes("feedback") ||
                c.name.includes("nhật-ký-giao-dịch") ||
                c.name.includes("nhật-ký")
              )
            );

            if (!fbChannel) {
              const fetched = await targetGuild.channels.fetch().catch(() => null);
              if (fetched) {
                fbChannel = fetched.find(c => 
                  c && c.isTextBased() && (
                    c.name.includes("đánh-giá") ||
                    c.name.includes("nhận-xét") ||
                    c.name.includes("feedback") ||
                    c.name.includes("nhật-ký-giao-dịch") ||
                    c.name.includes("nhật-ký")
                  )
                );
              }
            }

            if (fbChannel) {
              const fbPayload = typeof v2Feedback?.toClassic === 'function' ? v2Feedback.toClassic() : v2Feedback;
              await safeChannelSend(fbChannel, fbPayload);
            }
          }
        } catch (fbErr) {
          console.error("❌ Lỗi tìm kênh gửi feedback:", fbErr);
        }

        return safeReply(interaction, {
          content: "🌟 Cảm ơn bạn rất nhiều đã dành thời gian gửi đánh giá quý báu cho **LS STUDIO**! Chúc bạn có trải nghiệm tuyệt vời! / Thank you for your feedback!"
        });
      }
    }

  } catch (error) {
    if (!isIgnorableInteractionError(error)) {
      console.error("❌ Lỗi tương tác bot:", error);
    }
    await safeReply(interaction, { 
      content: "❌ Đã có lỗi xảy ra khi xử lý yêu cầu! Vui lòng thử lại sau.", 
      ephemeral: true 
    });
  }
});

// =========================================================================
// 8. PROCESS GRACEFUL SHUTDOWN & CLEANUP
// =========================================================================
function handleGracefulShutdown(signal) {
  console.log(`🛑 [Graceful Shutdown] Nhận tín hiệu ${signal}. Đang dọn dẹp tài nguyên và ngắt kết nối an toàn...`);
  stopActivityRotation();
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
  ticketCreationLocks.clear();
  closingTicketChannels.clear();
  processingApprovals.clear();
  approvedOrderCodes.clear();
  activeOrderCodes.clear();
  userCooldowns.clear();
  vietQRBufferCache.clear();
  failedVietQRUrls.clear();
  pendingVietQRRequests.clear();

  if (client && typeof client.destroy === 'function') {
    try {
      client.destroy();
    } catch (_) {}
  }

  if (global.gc) {
    try {
      global.gc();
    } catch (_) {}
  }

  console.log('✅ Đã giải phóng bộ nhớ, ngắt kết nối Discord và thoát tiến trình sạch sẽ.');
  process.exit(0);
}

process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGHUP', () => handleGracefulShutdown('SIGHUP'));

// =========================================================================
// 9. BOT LOGIN & MODULE EXPORTS
// =========================================================================
if (!TOKEN || TOKEN === 'YOUR_BOT_TOKEN_HERE' || TOKEN.trim() === '') {
  discordLoginStatus = 'missing_token';
  console.error("❌ [LỖI KHỞI ĐỘNG]: DISCORD_TOKEN chưa được cung cấp trong biến môi trường hoặc token.local.js!");
} else {
  discordLoginStatus = 'logging_in';
  console.log(`🔑 [Discord Gateway] Đang đăng nhập Bot (Token length: ${TOKEN.length}, prefix: ${TOKEN.slice(0, 10)}...)...`);
  client.login(TOKEN)
    .then(() => {
      discordLoginStatus = 'success';
      console.log('✅ client.login thành công!');
    })
    .catch((err) => {
      discordLoginStatus = 'error: ' + err.message;
      discordLoginError = err.stack || err.message;
      console.error("❌ [LỖI ĐĂNG NHẬP DISCORD]:", err);
    });
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
  sanitizeCustomerName,
  sanitizeOrderCode,
  sanitizeModalInlineText,
  sanitizeModalCodeBlockText,
  sanitizeDiscordChannelTopic,
  formatVND,
  formatUSD,
  isNegotiatedPrice,
  paymentHttpClient,
  generateVietQRUrl,
  fetchVietQRBuffer,
  getPackage,
  getRateLimitRemaining,
  formatVNTime,
  sanitizeTranscriptControlChars,
  sanitizeSingleLineHeader,
  sanitizeMarkdownForEmbed,
  extractTranscriptMessageData,
  generateTranscript,
  createTranscriptAttachments,
  executeTicketClosure,
  buildPackageSelectMenu,
  createCustomOrderModal,
  createSupportTicketModal,
  createCloseTicketReasonModal,
  createFeedbackModal,
  createTicketChannel,
  ExpiringLockMap,
  ticketCreationLocks,
  closingTicketChannels,
  userCooldowns,
  activeOrderCodes,
  processingApprovals,
  approvedOrderCodes,
  normalizeAntiSpamText,
  extractAllLinkTargets,
  containsDiscordInvite,
  containsEveryonePing,
  redactSensitiveData,
  vietQRBufferCache,
  failedVietQRUrls,
  pendingVietQRRequests,
  vietQRCircuitBreaker,
  clearVietQRCache,
  getVietQRCacheStats,
  flushMemoryCaches,
  getMemoryFootprint,
  MAX_ACTIVE_ORDERS,
  MAX_APPROVED_ORDERS,
  MAX_USER_COOLDOWNS,
  VIETQR_FAILED_MAX_SIZE,
  safeDeleteMessage,
  handleAutoMod,
  IGNORABLE_INTERACTION_ERROR_CODES,
  isIgnorableInteractionError,
  isInteractionExpired,
  createComponentsV2Message,
  isComponentsV2Available,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ThumbnailBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SeparatorSpacingSize,
  ComponentType,
  MessageFlags,
  safeReply,
  safeChannelSend,
  safeDeferReply,
  safeDeferUpdate,
  safeEditReply,
  safeFollowUp,
  safeUpdate,
  safeShowModal,
  commands,
  registerCommands,
  REQUIRED_BOT_PERMISSIONS,
  APP_DIRECTORY_METADATA,
  calculatePermissionsBitfield,
  validateAppDirectoryReadiness,
  generateOAuth2Invite,
  handleGracefulShutdown,
  // Gateway Lifecycle, Activity Presence & REST API Resilience
  GATEWAY_CLOSE_CODES,
  classifyGatewayCloseCode,
  gatewayHealthMetrics,
  getGatewayHealthMetrics,
  ACTIVITIES,
  rotateBotActivity,
  startActivityRotation,
  stopActivityRotation,
  getCurrentActivityIndex,
  parseDiscordRateLimitHeaders,
  calculateRateLimitBackoff,
  restRateLimitMetrics,
  getRestRateLimitMetrics
};

