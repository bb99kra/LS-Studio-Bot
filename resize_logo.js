const fs = require('fs');
const { PNG } = require('pngjs');

const srcPath = '/sdcard/Download/image.png';
const srcData = fs.readFileSync(srcPath);
const srcPng = PNG.sync.read(srcData);

console.log(`Original image: ${srcPng.width}x${srcPng.height}`);

// Helper: Bilinear interpolation resize
function resizePNG(src, targetW, targetH) {
  const dst = new PNG({ width: targetW, height: targetH });
  const xRatio = src.width / targetW;
  const yRatio = src.height / targetH;

  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      const px = Math.floor(x * xRatio);
      const py = Math.floor(y * yRatio);
      const srcIdx = (src.width * py + px) << 2;
      const dstIdx = (targetW * y + x) << 2;

      dst.data[dstIdx] = src.data[srcIdx];         // R
      dst.data[dstIdx + 1] = src.data[srcIdx + 1]; // G
      dst.data[dstIdx + 2] = src.data[srcIdx + 2]; // B
      dst.data[dstIdx + 3] = src.data[srcIdx + 3]; // A
    }
  }
  return dst;
}

// Helper: Place resized logo inside a square/target canvas with centered padding
function placeOnCanvas(src, canvasW, canvasH, paddingRatio = 0.85, bgColor = [0, 0, 0, 0]) {
  const dst = new PNG({ width: canvasW, height: canvasH });

  // Fill background
  for (let i = 0; i < canvasW * canvasH; i++) {
    const idx = i << 2;
    dst.data[idx] = bgColor[0];
    dst.data[idx + 1] = bgColor[1];
    dst.data[idx + 2] = bgColor[2];
    dst.data[idx + 3] = bgColor[3];
  }

  // Calculate scaled dimensions to preserve aspect ratio
  const maxW = canvasW * paddingRatio;
  const maxH = canvasH * paddingRatio;
  const scale = Math.min(maxW / src.width, maxH / src.height);

  const scaledW = Math.round(src.width * scale);
  const scaledH = Math.round(src.height * scale);

  const resized = resizePNG(src, scaledW, scaledH);

  // Position at center
  const offsetX = Math.floor((canvasW - scaledW) / 2);
  const offsetY = Math.floor((canvasH - scaledH) / 2);

  for (let y = 0; y < scaledH; y++) {
    for (let x = 0; x < scaledW; x++) {
      const srcIdx = (scaledW * y + x) << 2;
      const dstIdx = (canvasW * (y + offsetY) + (x + offsetX)) << 2;

      const alpha = resized.data[srcIdx + 3] / 255;
      if (alpha > 0) {
        // Alpha blend over background
        const bgAlpha = dst.data[dstIdx + 3] / 255;
        const outAlpha = alpha + bgAlpha * (1 - alpha);

        if (outAlpha > 0) {
          dst.data[dstIdx] = Math.round((resized.data[srcIdx] * alpha + dst.data[dstIdx] * bgAlpha * (1 - alpha)) / outAlpha);
          dst.data[dstIdx + 1] = Math.round((resized.data[srcIdx + 1] * alpha + dst.data[dstIdx + 1] * bgAlpha * (1 - alpha)) / outAlpha);
          dst.data[dstIdx + 2] = Math.round((resized.data[srcIdx + 2] * alpha + dst.data[dstIdx + 2] * bgAlpha * (1 - alpha)) / outAlpha);
          dst.data[dstIdx + 3] = Math.round(outAlpha * 255);
        }
      }
    }
  }

  return dst;
}

// 1. MINECRAFT SERVER ICON (64x64) - Transparent
const mcIcon = placeOnCanvas(srcPng, 64, 64, 0.95);
fs.writeFileSync('/sdcard/Download/server-icon.png', PNG.sync.write(mcIcon));
console.log('✅ Generated /sdcard/Download/server-icon.png (64x64)');

// 2. DISCORD LOGO (512x512) - Transparent
const discord512 = placeOnCanvas(srcPng, 512, 512, 0.85);
fs.writeFileSync('/sdcard/Download/discord_logo_512x512.png', PNG.sync.write(discord512));
console.log('✅ Generated /sdcard/Download/discord_logo_512x512.png (512x512)');

// 3. DISCORD LOGO (1024x1024) - Transparent
const discord1024 = placeOnCanvas(srcPng, 1024, 1024, 0.85);
fs.writeFileSync('/sdcard/Download/discord_logo_1024x1024.png', PNG.sync.write(discord1024));
console.log('✅ Generated /sdcard/Download/discord_logo_1024x1024.png (1024x1024)');

// 4. DISCORD LOGO WITH DARK BACKGROUND (1024x1024) - Nền tối Discord sang xịn
const discordDark = placeOnCanvas(srcPng, 1024, 1024, 0.80, [26, 28, 35, 255]);
fs.writeFileSync('/sdcard/Download/discord_logo_dark_1024.png', PNG.sync.write(discordDark));
console.log('✅ Generated /sdcard/Download/discord_logo_dark_1024.png (1024x1024 with dark theme bg)');

// 5. DISCORD BANNER (960x540) - 16:9
const banner = placeOnCanvas(srcPng, 960, 540, 0.80, [18, 19, 24, 255]);
fs.writeFileSync('/sdcard/Download/discord_banner_960x540.png', PNG.sync.write(banner));
console.log('✅ Generated /sdcard/Download/discord_banner_960x540.png (960x540)');

