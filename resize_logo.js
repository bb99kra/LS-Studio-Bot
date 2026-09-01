const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { PNG } = require('pngjs');

// Safety limits for memory management (optimized for memory-constrained environments e.g., 80-100MB Node heaps)
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB max input file size
const MAX_IMAGE_DIMENSION = 4096; // 4096px max width / height
const MAX_TOTAL_PIXELS = 4096 * 4096; // 16,777,216 max pixels (~67MB RGBA buffer)
const MIN_PNG_FILE_SIZE = 29; // 8 bytes signature + 12 bytes IHDR chunk wrapper + 9 bytes min IHDR payload

/**
 * Searches for an existing file from a list of candidate paths.
 * Safely probes filesystem without leaking descriptors.
 * @param {string[]} candidates
 * @returns {string|null}
 */
function findCandidateFile(candidates) {
  if (!Array.isArray(candidates)) return null;
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'string') continue;
    try {
      const resolved = path.resolve(candidate);
      if (fs.existsSync(resolved)) {
        const stats = fs.statSync(resolved);
        if (stats.isFile() && stats.size > 0 && stats.size <= MAX_FILE_SIZE_BYTES) {
          return resolved;
        }
      }
    } catch {
      // Ignore filesystem access errors during path probing
    }
  }
  return null;
}

/**
 * Determines a suitable writable output directory.
 * @param {string|null} [customDir]
 * @returns {string}
 */
function resolveOutputDir(customDir) {
  if (customDir && typeof customDir === 'string') {
    const resolved = path.resolve(customDir);
    fs.mkdirSync(resolved, { recursive: true });
    return resolved;
  }

  // Check environment variable
  if (process.env.MEDIA_OUTPUT_DIR) {
    const resolved = path.resolve(process.env.MEDIA_OUTPUT_DIR);
    fs.mkdirSync(resolved, { recursive: true });
    return resolved;
  }

  // If running in Termux/Android and /sdcard/Download is available & writable
  const sdcard = '/sdcard/Download';
  try {
    if (fs.existsSync(sdcard)) {
      fs.accessSync(sdcard, fs.constants.W_OK);
      return sdcard;
    }
  } catch {
    // Fallback to local output directory
  }

  const defaultDir = path.resolve(__dirname, 'output');
  fs.mkdirSync(defaultDir, { recursive: true });
  return defaultDir;
}

/**
 * Safely reads and decodes a PNG file with dimension and size validation.
 * Protected against decompression bombs and corrupted streams.
 * @param {string} filePath
 * @returns {{ png: PNG, buffer: Buffer }}
 */
function readPngSafe(filePath) {
  if (!filePath || typeof filePath !== 'string' || !fs.existsSync(filePath)) {
    throw new Error(`Tệp hình ảnh không tồn tại: ${filePath}`);
  }

  let stats;
  try {
    stats = fs.statSync(filePath);
  } catch (err) {
    throw new Error(`Không thể đọc thông tin tệp "${filePath}": ${err.message}`);
  }

  if (!stats.isFile()) {
    throw new Error(`Đường dẫn không phải là tệp thông thường: ${filePath}`);
  }

  if (stats.size === 0) {
    throw new Error(`Tệp hình ảnh rỗng (0 bytes): ${filePath}`);
  }

  if (stats.size > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
    throw new Error(`Dung lượng tệp "${filePath}" (${sizeMb} MB) vượt quá giới hạn an toàn (${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB).`);
  }

  let buffer;
  try {
    buffer = fs.readFileSync(filePath);
  } catch (err) {
    throw new Error(`Không thể đọc dữ liệu tệp "${filePath}": ${err.message}`);
  }

  if (buffer.length < MIN_PNG_FILE_SIZE) {
    throw new Error(`Tệp quá nhỏ để là ảnh PNG hợp lệ (${buffer.length} bytes, yêu cầu tối thiểu ${MIN_PNG_FILE_SIZE} bytes): ${filePath}`);
  }

  // Verify PNG signature: 89 50 4E 47 0D 0A 1A 0A
  const isPngHeader =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A;

  if (!isPngHeader) {
    throw new Error(`Tệp không có định dạng PNG hợp lệ (sai PNG signature header): ${filePath}`);
  }

  // Pre-parse IHDR chunk to prevent PNG decompression bombs (OOM) before decoding
  const chunkType = buffer.subarray(12, 16).toString('ascii');
  if (chunkType !== 'IHDR') {
    throw new Error(`Tệp PNG không hợp lệ (chunk đầu tiên phải là IHDR, nhận được "${chunkType}"): ${filePath}`);
  }

  const ihdrWidth = buffer.readUInt32BE(16);
  const ihdrHeight = buffer.readUInt32BE(20);

  if (!Number.isSafeInteger(ihdrWidth) || !Number.isSafeInteger(ihdrHeight) || ihdrWidth <= 0 || ihdrHeight <= 0) {
    throw new Error(`Kích thước ảnh PNG trong IHDR không hợp lệ (${ihdrWidth}x${ihdrHeight}) trong: ${filePath}`);
  }

  if (ihdrWidth > MAX_IMAGE_DIMENSION || ihdrHeight > MAX_IMAGE_DIMENSION) {
    throw new Error(`Kích thước ảnh PNG (${ihdrWidth}x${ihdrHeight}) vượt quá giới hạn tối đa cho phép (${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION}): ${filePath}`);
  }

  if (ihdrWidth * ihdrHeight > MAX_TOTAL_PIXELS) {
    throw new Error(`Tổng số điểm ảnh (${(ihdrWidth * ihdrHeight).toLocaleString()} pixels) vượt quá giới hạn an toàn (${MAX_TOTAL_PIXELS.toLocaleString()} pixels) để tránh tràn bộ nhớ: ${filePath}`);
  }

  let png;
  try {
    png = PNG.sync.read(buffer);
  } catch (err) {
    throw new Error(`Không thể giải mã dữ liệu PNG từ "${filePath}" (ảnh có thể bị lỗi, hỏng chunk hoặc dữ liệu nén bị cắt xén): ${err.message}`);
  }

  if (
    !png ||
    !Number.isInteger(png.width) ||
    !Number.isInteger(png.height) ||
    png.width <= 0 ||
    png.height <= 0 ||
    !Buffer.isBuffer(png.data) ||
    png.data.length !== png.width * png.height * 4
  ) {
    throw new Error(`Dữ liệu PNG sau giải mã không hợp lệ hoặc kích thước dữ liệu lỗi (${png?.width}x${png?.height}) trong: ${filePath}`);
  }

  return { png, buffer };
}

/**
 * Safely encodes and writes a PNG to disk, ensuring directory existence and safe error handling.
 * @param {string} filePath
 * @param {PNG} pngInstance
 * @param {object} [options={}]
 * @returns {string}
 */
function writePngSafe(filePath, pngInstance, options = {}) {
  if (!filePath || typeof filePath !== 'string' || !pngInstance) {
    throw new Error('Đường dẫn tệp hoặc đối tượng PNG không hợp lệ.');
  }

  if (
    !Number.isInteger(pngInstance.width) ||
    !Number.isInteger(pngInstance.height) ||
    pngInstance.width <= 0 ||
    pngInstance.height <= 0 ||
    pngInstance.width > MAX_IMAGE_DIMENSION ||
    pngInstance.height > MAX_IMAGE_DIMENSION ||
    !Buffer.isBuffer(pngInstance.data) ||
    pngInstance.data.length !== pngInstance.width * pngInstance.height * 4
  ) {
    throw new Error(`Đối tượng PNG không hợp lệ để ghi (${pngInstance?.width}x${pngInstance?.height}).`);
  }

  const dir = path.dirname(filePath);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    throw new Error(`Không thể tạo thư mục lưu trữ "${dir}": ${err.message}`);
  }

  let buffer;
  try {
    buffer = PNG.sync.write(pngInstance, options);
  } catch (err) {
    throw new Error(`Lỗi mã hóa PNG khi xuất tệp "${filePath}": ${err.message}`);
  }

  try {
    fs.writeFileSync(filePath, buffer);
  } catch (err) {
    throw new Error(`Không thể ghi tệp ảnh ra đĩa "${filePath}": ${err.message}`);
  }

  return filePath;
}

/**
 * Resizes a PNG image using Bilinear Interpolation with alpha-premultiplied precision.
 * @param {PNG} src - Source PNG
 * @param {number} targetW - Target width (> 0)
 * @param {number} targetH - Target height (> 0)
 * @returns {PNG}
 */
function resizePNG(src, targetW, targetH) {
  if (!src || !Number.isInteger(src.width) || !Number.isInteger(src.height) || src.width <= 0 || src.height <= 0 || !Buffer.isBuffer(src.data)) {
    throw new Error('Ảnh nguồn không hợp lệ để resize.');
  }

  const tw = Number.isFinite(targetW) && targetW > 0 ? Math.max(1, Math.round(targetW)) : 0;
  const th = Number.isFinite(targetH) && targetH > 0 ? Math.max(1, Math.round(targetH)) : 0;

  if (tw <= 0 || th <= 0 || tw > MAX_IMAGE_DIMENSION || th > MAX_IMAGE_DIMENSION || (tw * th) > MAX_TOTAL_PIXELS) {
    throw new Error(`Kích thước đích không hợp lệ hoặc vượt ngưỡng an toàn (${targetW}x${targetH}). Tối đa ${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION}.`);
  }

  const dst = new PNG({ width: tw, height: th });

  // Direct fast copy if dimensions match exactly
  if (tw === src.width && th === src.height) {
    src.data.copy(dst.data);
    return dst;
  }

  const xRatio = src.width / tw;
  const yRatio = src.height / th;

  for (let y = 0; y < th; y++) {
    const srcY = (y + 0.5) * yRatio - 0.5;
    const y0 = Math.floor(srcY);
    const y1 = y0 + 1;
    const dy = Math.max(0, Math.min(1, srcY - y0));

    const cy0 = Math.max(0, Math.min(src.height - 1, y0));
    const cy1 = Math.max(0, Math.min(src.height - 1, y1));

    for (let x = 0; x < tw; x++) {
      const srcX = (x + 0.5) * xRatio - 0.5;
      const x0 = Math.floor(srcX);
      const x1 = x0 + 1;
      const dx = Math.max(0, Math.min(1, srcX - x0));

      const cx0 = Math.max(0, Math.min(src.width - 1, x0));
      const cx1 = Math.max(0, Math.min(src.width - 1, x1));

      const idx00 = (src.width * cy0 + cx0) * 4;
      const idx10 = (src.width * cy0 + cx1) * 4;
      const idx01 = (src.width * cy1 + cx0) * 4;
      const idx11 = (src.width * cy1 + cx1) * 4;

      const w00 = (1 - dx) * (1 - dy);
      const w10 = dx * (1 - dy);
      const w01 = (1 - dx) * dy;
      const w11 = dx * dy;

      const dstIdx = (tw * y + x) * 4;

      // Sample alphas
      const a00 = src.data[idx00 + 3] / 255;
      const a10 = src.data[idx10 + 3] / 255;
      const a01 = src.data[idx01 + 3] / 255;
      const a11 = src.data[idx11 + 3] / 255;

      const outA = w00 * a00 + w10 * a10 + w01 * a01 + w11 * a11;

      if (outA > 0.0001) {
        for (let c = 0; c < 3; c++) {
          const premulC =
            w00 * src.data[idx00 + c] * a00 +
            w10 * src.data[idx10 + c] * a10 +
            w01 * src.data[idx01 + c] * a01 +
            w11 * src.data[idx11 + c] * a11;
          dst.data[dstIdx + c] = Math.round(Math.max(0, Math.min(255, premulC / outA)));
        }
        dst.data[dstIdx + 3] = Math.round(Math.max(0, Math.min(255, outA * 255)));
      } else {
        dst.data[dstIdx] = 0;
        dst.data[dstIdx + 1] = 0;
        dst.data[dstIdx + 2] = 0;
        dst.data[dstIdx + 3] = 0;
      }
    }
  }

  return dst;
}

/**
 * Places a resized logo on a canvas with padding and alpha blending.
 * @param {PNG} src - Source logo PNG
 * @param {number} canvasW - Canvas width
 * @param {number} canvasH - Canvas height
 * @param {number} [paddingRatio=0.85] - Proportion of canvas to fill
 * @param {number[]} [bgColor=[0, 0, 0, 0]] - Background RGBA [0-255]
 * @returns {PNG}
 */
function placeOnCanvas(src, canvasW, canvasH, paddingRatio = 0.85, bgColor = [0, 0, 0, 0]) {
  if (!src || !Number.isInteger(src.width) || !Number.isInteger(src.height) || src.width <= 0 || src.height <= 0 || !Buffer.isBuffer(src.data)) {
    throw new Error('Ảnh logo không hợp lệ.');
  }

  const cw = Number.isFinite(canvasW) && canvasW > 0 ? Math.max(1, Math.round(canvasW)) : 0;
  const ch = Number.isFinite(canvasH) && canvasH > 0 ? Math.max(1, Math.round(canvasH)) : 0;

  if (cw <= 0 || ch <= 0 || cw > MAX_IMAGE_DIMENSION || ch > MAX_IMAGE_DIMENSION || (cw * ch) > MAX_TOTAL_PIXELS) {
    throw new Error(`Kích thước canvas không hợp lệ hoặc vượt ngưỡng an toàn (${canvasW}x${canvasH}). Tối đa ${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION}.`);
  }

  const dst = new PNG({ width: cw, height: ch });

  const bgR = Array.isArray(bgColor) && Number.isFinite(bgColor[0]) ? Math.max(0, Math.min(255, Math.round(bgColor[0]))) : 0;
  const bgG = Array.isArray(bgColor) && Number.isFinite(bgColor[1]) ? Math.max(0, Math.min(255, Math.round(bgColor[1]))) : 0;
  const bgB = Array.isArray(bgColor) && Number.isFinite(bgColor[2]) ? Math.max(0, Math.min(255, Math.round(bgColor[2]))) : 0;
  const bgA = Array.isArray(bgColor) && Number.isFinite(bgColor[3]) ? Math.max(0, Math.min(255, Math.round(bgColor[3]))) : 0;

  // Initialize canvas background if not transparent black
  if (bgR !== 0 || bgG !== 0 || bgB !== 0 || bgA !== 0) {
    const totalPixels = cw * ch;
    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      dst.data[idx] = bgR;
      dst.data[idx + 1] = bgG;
      dst.data[idx + 2] = bgB;
      dst.data[idx + 3] = bgA;
    }
  }

  // Calculate scaled dimensions to preserve aspect ratio
  const safePadding = typeof paddingRatio === 'number' && Number.isFinite(paddingRatio)
    ? Math.max(0.01, Math.min(1.0, logoPaddingRatioSafe(paddingRatio)))
    : 0.85;

  function logoPaddingRatioSafe(val) {
    return Math.max(0.01, Math.min(1.0, val));
  }

  const maxW = cw * safePadding;
  const maxH = ch * safePadding;
  const scale = Math.min(maxW / src.width, maxH / src.height);

  const scaledW = Math.max(1, Math.min(cw, Math.round(src.width * scale)));
  const scaledH = Math.max(1, Math.min(ch, Math.round(src.height * scale)));

  const resized = resizePNG(src, scaledW, scaledH);

  const offsetX = Math.max(0, Math.floor((cw - scaledW) / 2));
  const offsetY = Math.max(0, Math.floor((ch - scaledH) / 2));

  // Porter-Duff source-over alpha blending
  for (let y = 0; y < scaledH; y++) {
    const targetY = y + offsetY;
    if (targetY >= ch) continue;

    for (let x = 0; x < scaledW; x++) {
      const targetX = x + offsetX;
      if (targetX >= cw) continue;

      const srcIdx = (scaledW * y + x) * 4;
      const dstIdx = (cw * targetY + targetX) * 4;

      const srcAlpha = resized.data[srcIdx + 3] / 255;
      if (srcAlpha <= 0) continue;

      const dstAlpha = dst.data[dstIdx + 3] / 255;

      if (srcAlpha >= 1.0) {
        // Fast path for fully opaque pixel
        dst.data[dstIdx] = resized.data[srcIdx];
        dst.data[dstIdx + 1] = resized.data[srcIdx + 1];
        dst.data[dstIdx + 2] = resized.data[srcIdx + 2];
        dst.data[dstIdx + 3] = 255;
      } else {
        const invSrcAlpha = 1 - srcAlpha;
        const outAlpha = srcAlpha + dstAlpha * invSrcAlpha;

        if (outAlpha > 0) {
          dst.data[dstIdx] = Math.round(
            Math.max(0, Math.min(255, (resized.data[srcIdx] * srcAlpha + dst.data[dstIdx] * dstAlpha * invSrcAlpha) / outAlpha))
          );
          dst.data[dstIdx + 1] = Math.round(
            Math.max(0, Math.min(255, (resized.data[srcIdx + 1] * srcAlpha + dst.data[dstIdx + 1] * dstAlpha * invSrcAlpha) / outAlpha))
          );
          dst.data[dstIdx + 2] = Math.round(
            Math.max(0, Math.min(255, (resized.data[srcIdx + 2] * srcAlpha + dst.data[dstIdx + 2] * dstAlpha * invSrcAlpha) / outAlpha))
          );
          dst.data[dstIdx + 3] = Math.round(Math.max(0, Math.min(255, outAlpha * 255)));
        }
      }
    }
  }

  return dst;
}

/**
 * Generates all standard icon and banner variants.
 * @param {PNG} srcPng
 * @param {string} outDir
 * @returns {Array<{ name: string, path: string, width: number, height: number }>}
 */
function generateAllVariants(srcPng, outDir) {
  const configs = [
    {
      name: 'Minecraft Server Icon',
      file: 'server-icon.png',
      w: 64,
      h: 64,
      padding: 0.95,
      bg: [0, 0, 0, 0],
    },
    {
      name: 'Discord Logo 512x512 (Transparent)',
      file: 'discord_logo_512x512.png',
      w: 512,
      h: 512,
      padding: 0.85,
      bg: [0, 0, 0, 0],
    },
    {
      name: 'Discord Logo 1024x1024 (Transparent)',
      file: 'discord_logo_1024x1024.png',
      w: 1024,
      h: 1024,
      padding: 0.85,
      bg: [0, 0, 0, 0],
    },
    {
      name: 'Discord Logo Dark 1024x1024',
      file: 'discord_logo_dark_1024.png',
      w: 1024,
      h: 1024,
      padding: 0.80,
      bg: [26, 28, 35, 255],
    },
    {
      name: 'Discord Banner 960x540',
      file: 'discord_banner_960x540.png',
      w: 960,
      h: 540,
      padding: 0.80,
      bg: [18, 19, 24, 255],
    },
  ];

  const results = [];
  for (const cfg of configs) {
    const canvas = placeOnCanvas(srcPng, cfg.w, cfg.h, cfg.padding, cfg.bg);
    const destPath = path.join(outDir, cfg.file);
    writePngSafe(destPath, canvas);
    results.push({ name: cfg.name, path: destPath, width: cfg.w, height: cfg.h });
  }

  return results;
}

// Standalone CLI execution
function main() {
  const customSrc = process.argv[2];
  const customOut = process.argv[3];

  const candidates = [
    customSrc,
    process.env.LOGO_SRC_PATH,
    path.join(__dirname, 'image.png'),
    path.join(__dirname, 'logo.png'),
    path.join(__dirname, 'assets', 'image.png'),
    path.join(__dirname, 'assets', 'logo.png'),
    '/sdcard/Download/image.png',
  ];

  const srcPath = findCandidateFile(candidates);
  if (!srcPath) {
    console.error('❌ Không tìm thấy file logo nguồn!');
    console.error('Các đường dẫn đã kiểm tra:');
    candidates.filter(Boolean).forEach((c) => console.error(`  - ${c}`));
    console.error('\nHướng dẫn: Đặt file ảnh "image.png" tại thư mục gốc bot hoặc truyền đường dẫn: node resize_logo.js <đường_dẫn_ảnh>');
    process.exit(1);
  }

  console.log(`🔍 Đang xử lý logo: ${srcPath}`);
  try {
    const { png: srcPng } = readPngSafe(srcPath);
    console.log(`📐 Kích thước gốc: ${srcPng.width}x${srcPng.height}`);

    const outDir = resolveOutputDir(customOut);
    console.log(`📁 Thư mục xuất: ${outDir}`);

    const results = generateAllVariants(srcPng, outDir);
    console.log('\n✨ Đã tạo thành công các biến thể:');
    for (const item of results) {
      console.log(`  ✅ [${item.width}x${item.height}] ${item.name} -> ${item.path}`);
    }
  } catch (err) {
    console.error('❌ Lỗi trong quá trình xử lý ảnh:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  findCandidateFile,
  resolveOutputDir,
  readPngSafe,
  writePngSafe,
  resizePNG,
  placeOnCanvas,
  generateAllVariants,
  MAX_FILE_SIZE_BYTES,
  MAX_IMAGE_DIMENSION,
  MAX_TOTAL_PIXELS,
  MIN_PNG_FILE_SIZE,
};
