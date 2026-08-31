require('dotenv').config({ path: path.join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

/**
 * Searches for an existing file from a list of candidate paths.
 * @param {string[]} candidates
 * @returns {string|null}
 */
function findCandidateFile(candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const resolved = path.resolve(candidate);
      if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
        return resolved;
      }
    } catch {
      // Ignore filesystem access errors during path probing
    }
  }
  return null;
}

/**
 * Determines a suitable writable output directory.
 * @param {string|null} customDir
 * @returns {string}
 */
function resolveOutputDir(customDir) {
  if (customDir) {
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
 * @param {string} filePath
 * @returns {{ png: PNG, buffer: Buffer }}
 */
function readPngSafe(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`Tệp hình ảnh không tồn tại: ${filePath}`);
  }

  const stats = fs.statSync(filePath);
  if (stats.size === 0) {
    throw new Error(`Tệp hình ảnh rỗng (0 bytes): ${filePath}`);
  }

  const buffer = fs.readFileSync(filePath);
  let png;
  try {
    png = PNG.sync.read(buffer);
  } catch (err) {
    throw new Error(`Không thể giải mã PNG từ "${filePath}": ${err.message}`);
  }

  if (!png || png.width <= 0 || png.height <= 0 || !png.data || png.data.length < png.width * png.height * 4) {
    throw new Error(`Dữ liệu PNG không hợp lệ hoặc kích thước lỗi (${png?.width}x${png?.height}) trong: ${filePath}`);
  }

  return { png, buffer };
}

/**
 * Safely encodes and writes a PNG to disk, ensuring directory existence.
 * @param {string} filePath
 * @param {PNG} pngInstance
 */
function writePngSafe(filePath, pngInstance) {
  if (!filePath || !pngInstance) {
    throw new Error('Đường dẫn tệp hoặc đối tượng PNG không hợp lệ.');
  }

  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  const buffer = PNG.sync.write(pngInstance);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

/**
 * Resizes a PNG image using Bilinear Interpolation with coordinate clamping.
 * @param {PNG} src - Source PNG
 * @param {number} targetW - Target width (> 0)
 * @param {number} targetH - Target height (> 0)
 * @returns {PNG}
 */
function resizePNG(src, targetW, targetH) {
  if (!src || src.width <= 0 || src.height <= 0) {
    throw new Error('Ảnh nguồn không hợp lệ để resize.');
  }

  const tw = Math.max(1, Math.round(targetW));
  const th = Math.max(1, Math.round(targetH));
  const dst = new PNG({ width: tw, height: th });

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

      const idx00 = (src.width * cy0 + cx0) << 2;
      const idx10 = (src.width * cy0 + cx1) << 2;
      const idx01 = (src.width * cy1 + cx0) << 2;
      const idx11 = (src.width * cy1 + cx1) << 2;

      const w00 = (1 - dx) * (1 - dy);
      const w10 = dx * (1 - dy);
      const w01 = (1 - dx) * dy;
      const w11 = dx * dy;

      const dstIdx = (tw * y + x) << 2;

      for (let c = 0; c < 4; c++) {
        const val =
          w00 * src.data[idx00 + c] +
          w10 * src.data[idx10 + c] +
          w01 * src.data[idx01 + c] +
          w11 * src.data[idx11 + c];
        dst.data[dstIdx + c] = Math.round(Math.max(0, Math.min(255, val)));
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
  if (!src || src.width <= 0 || src.height <= 0) {
    throw new Error('Ảnh logo không hợp lệ.');
  }

  const cw = Math.max(1, Math.round(canvasW));
  const ch = Math.max(1, Math.round(canvasH));
  const dst = new PNG({ width: cw, height: ch });

  const bgR = Math.max(0, Math.min(255, bgColor[0] || 0));
  const bgG = Math.max(0, Math.min(255, bgColor[1] || 0));
  const bgB = Math.max(0, Math.min(255, bgColor[2] || 0));
  const bgA = Math.max(0, Math.min(255, bgColor[3] !== undefined ? bgColor[3] : 0));

  // Initialize canvas background
  for (let i = 0; i < cw * ch; i++) {
    const idx = i << 2;
    dst.data[idx] = bgR;
    dst.data[idx + 1] = bgG;
    dst.data[idx + 2] = bgB;
    dst.data[idx + 3] = bgA;
  }

  // Calculate scaled dimensions to preserve aspect ratio
  const safePadding = Math.max(0.01, Math.min(1.0, paddingRatio));
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

      const srcIdx = (scaledW * y + x) << 2;
      const dstIdx = (cw * targetY + targetX) << 2;

      const srcAlpha = resized.data[srcIdx + 3] / 255;
      if (srcAlpha <= 0) continue;

      const dstAlpha = dst.data[dstIdx + 3] / 255;
      const outAlpha = srcAlpha + dstAlpha * (1 - srcAlpha);

      if (outAlpha > 0) {
        dst.data[dstIdx] = Math.round(
          (resized.data[srcIdx] * srcAlpha + dst.data[dstIdx] * dstAlpha * (1 - srcAlpha)) / outAlpha
        );
        dst.data[dstIdx + 1] = Math.round(
          (resized.data[srcIdx + 1] * srcAlpha + dst.data[dstIdx + 1] * dstAlpha * (1 - srcAlpha)) / outAlpha
        );
        dst.data[dstIdx + 2] = Math.round(
          (resized.data[srcIdx + 2] * srcAlpha + dst.data[dstIdx + 2] * dstAlpha * (1 - srcAlpha)) / outAlpha
        );
        dst.data[dstIdx + 3] = Math.round(Math.min(255, outAlpha * 255));
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
};
