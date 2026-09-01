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
 * Searches for an existing file from candidate paths.
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
      // Ignore filesystem probe error
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

  if (process.env.MEDIA_OUTPUT_DIR) {
    const resolved = path.resolve(process.env.MEDIA_OUTPUT_DIR);
    fs.mkdirSync(resolved, { recursive: true });
    return resolved;
  }

  const sdcard = '/sdcard/Download';
  try {
    if (fs.existsSync(sdcard)) {
      fs.accessSync(sdcard, fs.constants.W_OK);
      return sdcard;
    }
  } catch {
    // Fallback to local
  }

  const defaultDir = path.resolve(__dirname, 'output');
  fs.mkdirSync(defaultDir, { recursive: true });
  return defaultDir;
}

/**
 * Safely reads and validates a PNG file with dimension limits and decompression bomb protection.
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
 * Safely writes a PNG instance to disk with directory check and error handling.
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
 * Protected against buffer overruns and memory exhaustion.
 * @param {PNG} src
 * @param {number} targetW
 * @param {number} targetH
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
 * Center-crops and scales background to target aspect ratio and size.
 * @param {PNG} bg - Source background
 * @param {number} targetW - Target width
 * @param {number} targetH - Target height
 * @returns {PNG}
 */
function cropAndScaleBG(bg, targetW, targetH) {
  if (!bg || !Number.isInteger(bg.width) || !Number.isInteger(bg.height) || bg.width <= 0 || bg.height <= 0 || !Buffer.isBuffer(bg.data)) {
    throw new Error('Ảnh nền không hợp lệ.');
  }

  const tw = Number.isFinite(targetW) && targetW > 0 ? Math.max(1, Math.round(targetW)) : 0;
  const th = Number.isFinite(targetH) && targetH > 0 ? Math.max(1, Math.round(targetH)) : 0;

  if (tw <= 0 || th <= 0 || tw > MAX_IMAGE_DIMENSION || th > MAX_IMAGE_DIMENSION || (tw * th) > MAX_TOTAL_PIXELS) {
    throw new Error(`Kích thước đích không hợp lệ (${targetW}x${targetH}).`);
  }

  const targetAspect = tw / th;
  const bgAspect = bg.width / bg.height;

  let cropW, cropH, cropX, cropY;

  if (bgAspect > targetAspect) {
    // Background is wider than target aspect ratio -> crop horizontal edges
    cropH = bg.height;
    cropW = Math.max(1, Math.min(bg.width, Math.round(bg.height * targetAspect)));
    cropX = Math.max(0, Math.min(bg.width - cropW, Math.floor((bg.width - cropW) / 2)));
    cropY = 0;
  } else {
    // Background is taller than or equal to target aspect ratio -> crop vertical edges
    cropW = bg.width;
    cropH = Math.max(1, Math.min(bg.height, Math.round(bg.width / targetAspect)));
    cropX = 0;
    cropY = Math.max(0, Math.min(bg.height - cropH, Math.floor((bg.height - cropH) / 2)));
  }

  // Extract cropped region using fast row-by-row buffer copying with safety bounds
  const cropped = new PNG({ width: cropW, height: cropH });
  for (let y = 0; y < cropH; y++) {
    const srcY = y + cropY;
    if (srcY >= bg.height) continue;

    const srcRowStart = (bg.width * srcY + cropX) * 4;
    const srcRowEnd = srcRowStart + (cropW * 4);
    const dstRowStart = (cropW * y) * 4;

    if (srcRowEnd <= bg.data.length && dstRowStart + (cropW * 4) <= cropped.data.length) {
      bg.data.copy(cropped.data, dstRowStart, srcRowStart, srcRowEnd);
    }
  }

  return resizePNG(cropped, tw, th);
}

/**
 * Composites a logo onto a background image with darkening and alpha blending.
 * @param {PNG} bgPng - Background PNG
 * @param {PNG} logoPng - Logo PNG
 * @param {number} targetW - Canvas width
 * @param {number} targetH - Canvas height
 * @param {number} [logoPaddingRatio=0.85] - Proportion of canvas to occupy
 * @param {number} [darkenBgAlpha=0.15] - Subtle darkening factor (0.0 to 1.0)
 * @returns {PNG}
 */
function createComposite(bgPng, logoPng, targetW, targetH, logoPaddingRatio = 0.85, darkenBgAlpha = 0.15) {
  if (!bgPng || !Number.isInteger(bgPng.width) || !Number.isInteger(bgPng.height) || bgPng.width <= 0 || bgPng.height <= 0 || !Buffer.isBuffer(bgPng.data)) {
    throw new Error('Ảnh nền không hợp lệ.');
  }
  if (!logoPng || !Number.isInteger(logoPng.width) || !Number.isInteger(logoPng.height) || logoPng.width <= 0 || logoPng.height <= 0 || !Buffer.isBuffer(logoPng.data)) {
    throw new Error('Ảnh logo không hợp lệ.');
  }

  const tw = Number.isFinite(targetW) && targetW > 0 ? Math.max(1, Math.round(targetW)) : 0;
  const th = Number.isFinite(targetH) && targetH > 0 ? Math.max(1, Math.round(targetH)) : 0;

  if (tw <= 0 || th <= 0 || tw > MAX_IMAGE_DIMENSION || th > MAX_IMAGE_DIMENSION || (tw * th) > MAX_TOTAL_PIXELS) {
    throw new Error(`Kích thước canvas không hợp lệ (${targetW}x${targetH}).`);
  }

  const canvas = cropAndScaleBG(bgPng, tw, th);

  // Subtle darkening so logo stands out
  const safeDarken = typeof darkenBgAlpha === 'number' && Number.isFinite(darkenBgAlpha)
    ? Math.max(0, Math.min(1.0, darkenBgAlpha))
    : 0.15;

  if (safeDarken > 0) {
    const factor = 1 - safeDarken;
    const totalPixels = tw * th;
    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      canvas.data[idx] = Math.round(canvas.data[idx] * factor);
      canvas.data[idx + 1] = Math.round(canvas.data[idx + 1] * factor);
      canvas.data[idx + 2] = Math.round(canvas.data[idx + 2] * factor);
    }
  }

  // Scale logo preserving aspect ratio
  const safePadding = typeof logoPaddingRatio === 'number' && Number.isFinite(logoPaddingRatio)
    ? Math.max(0.01, Math.min(1.0, logoPaddingRatio))
    : 0.85;

  const maxW = tw * safePadding;
  const maxH = th * safePadding;
  const scale = Math.min(maxW / logoPng.width, maxH / logoPng.height);

  const scaledW = Math.max(1, Math.min(tw, Math.round(logoPng.width * scale)));
  const scaledH = Math.max(1, Math.min(th, Math.round(logoPng.height * scale)));

  const resizedLogo = resizePNG(logoPng, scaledW, scaledH);

  const offsetX = Math.max(0, Math.floor((tw - scaledW) / 2));
  const offsetY = Math.max(0, Math.floor((th - scaledH) / 2));

  // Porter-Duff source-over alpha blending
  for (let y = 0; y < scaledH; y++) {
    const targetY = y + offsetY;
    if (targetY >= th) continue;

    for (let x = 0; x < scaledW; x++) {
      const targetX = x + offsetX;
      if (targetX >= tw) continue;

      const srcIdx = (scaledW * y + x) * 4;
      const dstIdx = (tw * targetY + targetX) * 4;

      const srcAlpha = resizedLogo.data[srcIdx + 3] / 255;
      if (srcAlpha <= 0) continue;

      const dstAlpha = canvas.data[dstIdx + 3] / 255;

      if (srcAlpha >= 1.0) {
        // Fast path for fully opaque pixel
        canvas.data[dstIdx] = resizedLogo.data[srcIdx];
        canvas.data[dstIdx + 1] = resizedLogo.data[srcIdx + 1];
        canvas.data[dstIdx + 2] = resizedLogo.data[srcIdx + 2];
        canvas.data[dstIdx + 3] = 255;
      } else {
        const invSrcAlpha = 1 - srcAlpha;
        const outAlpha = srcAlpha + dstAlpha * invSrcAlpha;

        if (outAlpha > 0) {
          canvas.data[dstIdx] = Math.round(
            Math.max(0, Math.min(255, (resizedLogo.data[srcIdx] * srcAlpha + canvas.data[dstIdx] * dstAlpha * invSrcAlpha) / outAlpha))
          );
          canvas.data[dstIdx + 1] = Math.round(
            Math.max(0, Math.min(255, (resizedLogo.data[srcIdx + 1] * srcAlpha + canvas.data[dstIdx + 1] * dstAlpha * invSrcAlpha) / outAlpha))
          );
          canvas.data[dstIdx + 2] = Math.round(
            Math.max(0, Math.min(255, (resizedLogo.data[srcIdx + 2] * srcAlpha + canvas.data[dstIdx + 2] * dstAlpha * invSrcAlpha) / outAlpha))
          );
          canvas.data[dstIdx + 3] = Math.round(Math.max(0, Math.min(255, outAlpha * 255)));
        }
      }
    }
  }

  return canvas;
}

/**
 * Generates standard composite variants for Discord and Minecraft.
 * @param {PNG} bgPng
 * @param {PNG} logoPng
 * @param {string} outDir
 * @returns {Array<{ name: string, path: string, width: number, height: number }>}
 */
function generateCompositeVariants(bgPng, logoPng, outDir) {
  const configs = [
    {
      name: 'Discord Logo with Background 1024x1024',
      file: 'ls_studio_logo_bg_1024.png',
      w: 1024,
      h: 1024,
      padding: 0.85,
      darken: 0.15,
    },
    {
      name: 'Discord Logo with Background 512x512',
      file: 'ls_studio_logo_bg_512.png',
      w: 512,
      h: 512,
      padding: 0.85,
      darken: 0.15,
    },
    {
      name: 'Minecraft Server Icon (64x64)',
      file: 'server-icon.png',
      w: 64,
      h: 64,
      padding: 0.95,
      darken: 0.10,
    },
    {
      name: 'Discord Banner 960x540',
      file: 'ls_studio_banner_bg_960x540.png',
      w: 960,
      h: 540,
      padding: 0.75,
      darken: 0.20,
    },
  ];

  const results = [];
  for (const cfg of configs) {
    const canvas = createComposite(bgPng, logoPng, cfg.w, cfg.h, cfg.padding, cfg.darken);
    const destPath = path.join(outDir, cfg.file);
    writePngSafe(destPath, canvas);
    results.push({ name: cfg.name, path: destPath, width: cfg.w, height: cfg.h });
  }

  return results;
}

// Standalone CLI execution
function main() {
  const customBg = process.argv[2];
  const customLogo = process.argv[3];
  const customOut = process.argv[4];

  const bgCandidates = [
    customBg,
    process.env.BG_SRC_PATH,
    path.join(__dirname, 'bg.png'),
    path.join(__dirname, 'background.png'),
    path.join(__dirname, '2023_5_29_638209995180335593_frame-218.png'),
    path.join(__dirname, 'assets', 'bg.png'),
    path.join(__dirname, 'assets', 'background.png'),
    '/sdcard/Download/2023_5_29_638209995180335593_frame-218.png',
  ];

  const logoCandidates = [
    customLogo,
    process.env.LOGO_SRC_PATH,
    path.join(__dirname, 'image.png'),
    path.join(__dirname, 'logo.png'),
    path.join(__dirname, 'assets', 'image.png'),
    path.join(__dirname, 'assets', 'logo.png'),
    '/sdcard/Download/image.png',
  ];

  const bgPath = findCandidateFile(bgCandidates);
  const logoPath = findCandidateFile(logoCandidates);

  if (!bgPath) {
    console.error('❌ Không tìm thấy file hình nền (Background)!');
    console.error('Các đường dẫn đã kiểm tra:');
    bgCandidates.filter(Boolean).forEach((c) => console.error(`  - ${c}`));
    console.error('\nHướng dẫn: Đặt file "bg.png" tại thư mục bot hoặc truyền: node composite_bg.js <đường_dẫn_bg> <đường_dẫn_logo>');
    process.exit(1);
  }

  if (!logoPath) {
    console.error('❌ Không tìm thấy file logo nguồn!');
    console.error('Các đường dẫn đã kiểm tra:');
    logoCandidates.filter(Boolean).forEach((c) => console.error(`  - ${c}`));
    console.error('\nHướng dẫn: Đặt file "image.png" tại thư mục bot hoặc truyền: node composite_bg.js <đường_dẫn_bg> <đường_dẫn_logo>');
    process.exit(1);
  }

  console.log(`🖼️  Background: ${bgPath}`);
  console.log(`🎨 Logo: ${logoPath}`);

  try {
    const { png: bgPng } = readPngSafe(bgPath);
    const { png: logoPng } = readPngSafe(logoPath);

    console.log(`📐 Kích thước Background: ${bgPng.width}x${bgPng.height}, Logo: ${logoPng.width}x${logoPng.height}`);

    const outDir = resolveOutputDir(customOut);
    console.log(`📁 Thư mục xuất: ${outDir}`);

    const results = generateCompositeVariants(bgPng, logoPng, outDir);
    console.log('\n✨ Đã tạo thành công các biến thể composite:');
    for (const item of results) {
      console.log(`  ✅ [${item.width}x${item.height}] ${item.name} -> ${item.path}`);
    }
  } catch (err) {
    console.error('❌ Lỗi trong quá trình tạo composite:', err.message);
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
  cropAndScaleBG,
  createComposite,
  generateCompositeVariants,
  MAX_FILE_SIZE_BYTES,
  MAX_IMAGE_DIMENSION,
  MAX_TOTAL_PIXELS,
  MIN_PNG_FILE_SIZE,
};
