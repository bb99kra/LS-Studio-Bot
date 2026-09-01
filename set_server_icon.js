const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Client, Events, GatewayIntentBits } = require('discord.js');

const tokenLocalPath = path.join(__dirname, 'token.local.js');
const localConfig = fs.existsSync(tokenLocalPath) ? require(tokenLocalPath) : {};
const TOKEN = process.env.DISCORD_TOKEN || localConfig.TOKEN || localConfig.DISCORD_TOKEN || '';
const LS_STUDIO_GUILD_ID = process.env.GUILD_ID || "1542476657825419334";

// Discord REST API limit: 10MB (10,485,760 bytes)
const DISCORD_MAX_ICON_SIZE_BYTES = 10 * 1024 * 1024;
const MIN_ICON_SIZE_BYTES = 16;

/**
 * Searches for a valid, non-empty image file from candidates.
 * Safely validates file size to avoid loading huge files into memory.
 * @param {string[]} candidates
 * @returns {string|null}
 */
function findIconFile(candidates) {
  if (!Array.isArray(candidates)) return null;
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'string') continue;
    try {
      const resolved = path.resolve(candidate);
      if (fs.existsSync(resolved)) {
        const stats = fs.statSync(resolved);
        if (stats.isFile() && stats.size >= MIN_ICON_SIZE_BYTES && stats.size <= DISCORD_MAX_ICON_SIZE_BYTES) {
          return resolved;
        }
      }
    } catch {
      // Ignore probing errors
    }
  }
  return null;
}

/**
 * Detects image MIME type from magic header bytes or file extension.
 * Supports PNG, JPEG, GIF, WebP.
 * @param {Buffer} buffer
 * @param {string} [filePath]
 * @returns {string|null}
 */
function detectImageMimeType(buffer, filePath = '') {
  if (Buffer.isBuffer(buffer) && buffer.length >= 4) {
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4E &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0D &&
      buffer[5] === 0x0A &&
      buffer[6] === 0x1A &&
      buffer[7] === 0x0A
    ) {
      return 'image/png';
    }

    // JPEG: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return 'image/jpeg';
    }

    // GIF: GIF87a or GIF89a
    if (
      buffer.length >= 6 &&
      buffer[0] === 0x47 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x38 &&
      (buffer[4] === 0x37 || buffer[4] === 0x39) &&
      buffer[5] === 0x61
    ) {
      return 'image/gif';
    }

    // WebP: RIFF....WEBP
    if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return 'image/webp';
    }
  }

  // Fallback to file extension only if buffer is non-empty
  if (filePath && typeof filePath === 'string') {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.png') return 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.gif') return 'image/gif';
    if (ext === '.webp') return 'image/webp';
  }

  return null;
}

/**
 * Validates an image buffer for Discord setIcon compliance.
 * Checks size limits and verifies header signatures to prevent corrupt uploads.
 * @param {Buffer} buffer
 * @param {string} [filePath]
 * @returns {{ valid: boolean, size: number, mimeType: string }}
 */
function validateIconBuffer(buffer, filePath = '') {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Dữ liệu ảnh rỗng hoặc không phải là Buffer hợp lệ.');
  }

  if (buffer.length < MIN_ICON_SIZE_BYTES) {
    throw new Error(`Dữ liệu ảnh quá nhỏ (${buffer.length} bytes, yêu cầu tối thiểu ${MIN_ICON_SIZE_BYTES} bytes), không phải tệp ảnh hợp lệ.`);
  }

  if (buffer.length > DISCORD_MAX_ICON_SIZE_BYTES) {
    const sizeMb = (buffer.length / (1024 * 1024)).toFixed(2);
    throw new Error(`Dung lượng ảnh (${sizeMb} MB) vượt quá giới hạn 10MB của Discord.`);
  }

  const mimeType = detectImageMimeType(buffer, filePath);
  if (!mimeType) {
    throw new Error(`Định dạng tệp không được Discord hỗ trợ hoặc tệp ảnh bị hỏng. Chỉ hỗ trợ PNG, JPEG, GIF, WebP: ${filePath || 'Buffer'}`);
  }

  return { valid: true, size: buffer.length, mimeType };
}

/**
 * Formats image buffer into Discord Data URI string.
 * @param {Buffer} buffer
 * @param {string} [mimeType='image/png']
 * @returns {string}
 */
function formatDataUri(buffer, mimeType = 'image/png') {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Dữ liệu không phải là Buffer hợp lệ hoặc Buffer rỗng.');
  }
  const safeMime = typeof mimeType === 'string' && mimeType.startsWith('image/') ? mimeType : 'image/png';
  return `data:${safeMime};base64,${buffer.toString('base64')}`;
}

/**
 * Updates a Discord Guild's icon with pre-read bounds checks and comprehensive error handling.
 * @param {Client} client
 * @param {string} guildId
 * @param {string|Buffer} iconSource - File path or image Buffer
 * @param {string} [reason='Cập nhật Logo LS STUDIO chính thức']
 * @returns {Promise<import('discord.js').Guild>}
 */
async function updateGuildIcon(client, guildId, iconSource, reason = 'Cập nhật Logo LS STUDIO chính thức') {
  if (!client || !guildId) {
    throw new Error('Client hoặc Guild ID không hợp lệ.');
  }

  let imgBuf;
  let filePath = '';

  if (typeof iconSource === 'string') {
    filePath = iconSource;
    if (!fs.existsSync(filePath)) {
      throw new Error(`Tệp icon không tồn tại: ${filePath}`);
    }

    let stats;
    try {
      stats = fs.statSync(filePath);
    } catch (err) {
      throw new Error(`Không thể kiểm tra thông tin tệp "${filePath}": ${err.message}`);
    }

    if (!stats.isFile()) {
      throw new Error(`Đường dẫn icon không phải là tệp: ${filePath}`);
    }

    if (stats.size === 0) {
      throw new Error(`Tệp icon rỗng (0 bytes): ${filePath}`);
    }

    if (stats.size > DISCORD_MAX_ICON_SIZE_BYTES) {
      const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
      throw new Error(`Dung lượng tệp "${filePath}" (${sizeMb} MB) vượt quá giới hạn 10MB của Discord. Không đọc vào bộ nhớ để chống tràn RAM.`);
    }

    try {
      imgBuf = fs.readFileSync(filePath);
    } catch (err) {
      throw new Error(`Không thể đọc tệp icon "${filePath}": ${err.message}`);
    }
  } else if (Buffer.isBuffer(iconSource)) {
    imgBuf = iconSource;
  } else {
    throw new Error('iconSource phải là đường dẫn tệp (string) hoặc Buffer.');
  }

  const { mimeType } = validateIconBuffer(imgBuf, filePath);
  const dataUri = formatDataUri(imgBuf, mimeType);

  let guild;
  try {
    guild = await client.guilds.fetch(guildId);
  } catch (err) {
    throw new Error(`Không thể tìm thấy Guild Discord (${guildId}): ${err.message}`);
  }

  if (!guild) {
    throw new Error(`Không tìm thấy Guild với ID: ${guildId}`);
  }

  try {
    await guild.setIcon(dataUri, reason);
  } catch (err) {
    throw new Error(`Discord API từ chối cập nhật server icon: ${err.message}`);
  }

  return guild;
}

// Standalone execution
if (require.main === module) {
  if (!TOKEN || TOKEN === 'YOUR_BOT_TOKEN_HERE') {
    console.error('❌ DISCORD_TOKEN chưa được thiết lập trong .env hoặc token.local.js!');
    process.exit(1);
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Helper: Pacing delay to prevent Discord 429 Rate Limits
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Watchdog timeout to prevent script hanging indefinitely
  const WATCHDOG_TIMEOUT_MS = 30000;
  const watchdog = setTimeout(async () => {
    console.error(`⏱️ [WATCHDOG] Quá thời gian thực thi (${WATCHDOG_TIMEOUT_MS / 1000}s). Tự động hủy kết nối Discord và dừng tiến trình.`);
    await cleanupAndExit(1);
  }, WATCHDOG_TIMEOUT_MS);
  if (watchdog.unref) watchdog.unref();

  client.on(Events.Error, (err) => {
    console.error('❌ Lỗi Discord Client:', err.message || err);
  });

  let isCleaningUp = false;
  let isExiting = false;
async function cleanupAndExit(code = 0) {
  if (isExiting) return;
  isExiting = true;
    if (isCleaningUp) return;
    isCleaningUp = true;
    clearTimeout(watchdog);
    if (client) {
      try {
        await client.destroy();
      } catch {
        // Suppress destroy errors during exit
      }
    }
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
    try {
      const customPath = process.argv[2];
      const candidatePaths = [
        customPath,
        process.env.ICON_SRC_PATH,
        process.env.SERVER_ICON_PATH,
        '/sdcard/Download/discord_logo_dark_1024.png',
        path.join(__dirname, 'output', 'discord_logo_dark_1024.png'),
        path.join(__dirname, 'output', 'ls_studio_logo_bg_1024.png'),
        path.join(__dirname, 'discord_logo_dark_1024.png'),
        path.join(__dirname, 'ls_studio_logo_bg_1024.png'),
        path.join(__dirname, 'output', 'server-icon.png'),
        path.join(__dirname, 'image.png'),
        path.join(__dirname, 'logo.png')
      ];

      const iconPath = findIconFile(candidatePaths);
      if (!iconPath) {
        throw new Error(`Không tìm thấy file icon hợp lệ tại các đường dẫn:\n${candidatePaths.filter(Boolean).map(p => `  - ${p}`).join('\n')}`);
      }

      console.log(`🖼️  Đang sử dụng icon từ: ${iconPath}`);
      const guild = await updateGuildIcon(client, LS_STUDIO_GUILD_ID, iconPath, "Cập nhật Logo LS STUDIO chính thức");

      console.log(`✅ Đã tự động cập nhật Avatar/Logo cho Server Discord ${guild.name} (${guild.id})!`);
      await cleanupAndExit(0);
    } catch (err) {
      console.error("❌ Không thể cập nhật server icon:", err.message || err);
      await cleanupAndExit(1);
    }
  });

  client.login(TOKEN).catch(async (err) => {
    console.error('❌ Đăng nhập Discord thất bại:', err.message || err);
    await cleanupAndExit(1);
  });
}

module.exports = {
  findIconFile,
  detectImageMimeType,
  validateIconBuffer,
  formatDataUri,
  updateGuildIcon,
  DISCORD_MAX_ICON_SIZE_BYTES,
  MIN_ICON_SIZE_BYTES,
};
