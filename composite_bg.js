require('dotenv').config({ path: path.join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

/**
 * Searches for an existing file from candidate paths.
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
      // Ignore filesystem probe error
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
 * Safely reads and validates a PNG file.
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
 * Safely writes a PNG instance to disk.
 * @param {string} filePath
 * @param {PNG} pngInstance
 * @returns {string}
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
 * Resizes a PNG image using Bilinear Interpolation with clamping.
 * @param {PNG} src
 * @param {number} targetW
 * @param {number} targetH
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
 * Center-crops and scales background to target aspect ratio and size.
 * @param {PNG} bg - Source background
 * @param {number} targetW - Target width
 * @param {number} targetH - Target height
 * @returns {PNG}
 */
function cropAndScaleBG(bg, targetW, targetH) {
  if (!bg || bg.width <= 0 || bg.height <= 0) {
    throw new Error('Ảnh nền không hợp lệ.');
  }

  const tw = Math.max(1, Math.round(targetW));
  const th = Math.max(1, Math.round(targetH));
  const targetAspect = tw / th;
  const bgAspect = bg.width / bg.height;

  let cropW, cropH, cropX, cropY;

  if (bgAspect > targetAspect) {
    cropH = bg.height;
    cropW = Math.max(1, Math.min(bg.width, Math.round(bg.height * targetAspect)));
    cropX = Math.max(0, Math.min(bg.width - cropW, Math.floor((bg.width - cropW) / 2)));
    cropY = 0;
  } else {
    cropW = bg.width;
    cropH = Math.max(1, Math.min(bg.height, Math.round(bg.width / targetAspect)));
    cropX = 0;
    cropY = Math.max(0, Math.min(bg.height - cropH, Math.floor((bg.height - cropH) / 2)));
  }

  // Extract cropped region
  const cropped = new PNG({ width: cropW, height: cropH });
  for (let y = 0; y < cropH; y++) {
    const srcY = y + cropY;
    if (srcY >= bg.height) continue;

    for (let x = 0; x < cropW; x++) {
      const srcX = x + cropX;
      if (srcX >= bg.width) continue;

      const srcIdx = (bg.width * srcY + srcX) << 2;
      const dstIdx = (cropW * y + x) << 2;

      cropped.data[dstIdx] = bg.data[srcIdx];
      cropped.data[dstIdx + 1] = bg.data[srcIdx + 1];
      cropped.data[dstIdx + 2] = bg.data[srcIdx + 2];
      cropped.data[dstIdx + 3] = bg.data[srcIdx + 3];
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
  if (!bgPng || bgPng.width <= 0 || bgPng.height <= 0) {
    throw new Error('Ảnh nền không hợp lệ.');
  }
  if (!logoPng || logoPng.width <= 0 || logoPng.height <= 0) {
    throw new Error('Ảnh logo không hợp lệ.');
  }

  const tw = Math.max(1, Math.round(targetW));
  const th = Math.max(1, Math.round(targetH));

  const canvas = cropAndScaleBG(bgPng, tw, th);

  // Subtle darkening so logo stands out
  if (darkenBgAlpha > 0) {
    const factor = Math.max(0, Math.min(1, 1 - darkenBgAlpha));
    for (let i = 0; i < tw * th; i++) {
      const idx = i << 2;
      canvas.data[idx] = Math.round(canvas.data[idx] * factor);
      canvas.data[idx + 1] = Math.round(canvas.data[idx + 1] * factor);
      canvas.data[idx + 2] = Math.round(canvas.data[idx + 2] * factor);
    }
  }

  // Scale logo
  const safePadding = Math.max(0.01, Math.min(1.0, logoPaddingRatio));
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

      const srcIdx = (scaledW * y + x) << 2;
      const dstIdx = (tw * targetY + targetX) << 2;

      const srcAlpha = resizedLogo.data[srcIdx + 3] / 255;
      if (srcAlpha <= 0) continue;

      const dstAlpha = canvas.data[dstIdx + 3] / 255;
      const outAlpha = srcAlpha + dstAlpha * (1 - srcAlpha);

      if (outAlpha > 0) {
        canvas.data[dstIdx] = Math.round(
          (resizedLogo.data[srcIdx] * srcAlpha + canvas.data[dstIdx] * dstAlpha * (1 - srcAlpha)) / outAlpha
        );
        canvas.data[dstIdx + 1] = Math.round(
          (resizedLogo.data[srcIdx + 1] * srcAlpha + canvas.data[dstIdx + 1] * dstAlpha * (1 - srcAlpha)) / outAlpha
        );
        canvas.data[dstIdx + 2] = Math.round(
          (resizedLogo.data[srcIdx + 2] * srcAlpha + canvas.data[dstIdx + 2] * dstAlpha * (1 - srcAlpha)) / outAlpha
        );
        canvas.data[dstIdx + 3] = Math.round(Math.min(255, outAlpha * 255));
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
};
