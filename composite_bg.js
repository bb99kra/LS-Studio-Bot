const fs = require('fs');
const { PNG } = require('pngjs');

const bgPath = '/sdcard/Download/2023_5_29_638209995180335593_frame-218.png';
const logoPath = '/sdcard/Download/image.png';

const bgPng = PNG.sync.read(fs.readFileSync(bgPath));
const logoPng = PNG.sync.read(fs.readFileSync(logoPath));

console.log(`Background: ${bgPng.width}x${bgPng.height}, Logo: ${logoPng.width}x${logoPng.height}`);

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

      dst.data[dstIdx] = src.data[srcIdx];
      dst.data[dstIdx + 1] = src.data[srcIdx + 1];
      dst.data[dstIdx + 2] = src.data[srcIdx + 2];
      dst.data[dstIdx + 3] = src.data[srcIdx + 3];
    }
  }
  return dst;
}

// Crop and scale background to exact canvas (center crop)
function cropAndScaleBG(bg, targetW, targetH) {
  const targetAspect = targetW / targetH;
  const bgAspect = bg.width / bg.height;

  let cropW, cropH, cropX, cropY;

  if (bgAspect > targetAspect) {
    cropH = bg.height;
    cropW = Math.round(bg.height * targetAspect);
    cropX = Math.floor((bg.width - cropW) / 2);
    cropY = 0;
  } else {
    cropW = bg.width;
    cropH = Math.round(bg.width / targetAspect);
    cropX = 0;
    cropY = Math.floor((bg.height - cropH) / 2);
  }

  // Extract cropped region
  const cropped = new PNG({ width: cropW, height: cropH });
  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      const srcIdx = (bg.width * (y + cropY) + (x + cropX)) << 2;
      const dstIdx = (cropW * y + x) << 2;
      cropped.data[dstIdx] = bg.data[srcIdx];
      cropped.data[dstIdx + 1] = bg.data[srcIdx + 1];
      cropped.data[dstIdx + 2] = bg.data[srcIdx + 2];
      cropped.data[dstIdx + 3] = bg.data[srcIdx + 3];
    }
  }

  return resizePNG(cropped, targetW, targetH);
}

// Composite logo on background
function createComposite(targetW, targetH, logoPaddingRatio = 0.85, darkenBgAlpha = 0.15) {
  const canvas = cropAndScaleBG(bgPng, targetW, targetH);

  // Optional subtle darkening so logo stands out
  if (darkenBgAlpha > 0) {
    for (let i = 0; i < targetW * targetH; i++) {
      const idx = i << 2;
      canvas.data[idx] = Math.round(canvas.data[idx] * (1 - darkenBgAlpha));
      canvas.data[idx + 1] = Math.round(canvas.data[idx + 1] * (1 - darkenBgAlpha));
      canvas.data[idx + 2] = Math.round(canvas.data[idx + 2] * (1 - darkenBgAlpha));
    }
  }

  // Scale logo
  const maxW = targetW * logoPaddingRatio;
  const maxH = targetH * logoPaddingRatio;
  const scale = Math.min(maxW / logoPng.width, maxH / logoPng.height);

  const scaledW = Math.round(logoPng.width * scale);
  const scaledH = Math.round(logoPng.height * scale);

  const resizedLogo = resizePNG(logoPng, scaledW, scaledH);

  const offsetX = Math.floor((targetW - scaledW) / 2);
  const offsetY = Math.floor((targetH - scaledH) / 2);

  // Blend logo over background with subtle shadow
  for (let y = 0; y < scaledH; y++) {
    for (let x = 0; x < scaledW; x++) {
      const srcIdx = (scaledW * y + x) << 2;
      const dstIdx = (targetW * (y + offsetY) + (x + offsetX)) << 2;

      const alpha = resizedLogo.data[srcIdx + 3] / 255;
      if (alpha > 0) {
        const bgR = canvas.data[dstIdx];
        const bgG = canvas.data[dstIdx + 1];
        const bgB = canvas.data[dstIdx + 2];

        canvas.data[dstIdx] = Math.round(resizedLogo.data[srcIdx] * alpha + bgR * (1 - alpha));
        canvas.data[dstIdx + 1] = Math.round(resizedLogo.data[srcIdx + 1] * alpha + bgG * (1 - alpha));
        canvas.data[dstIdx + 2] = Math.round(resizedLogo.data[srcIdx + 2] * alpha + bgB * (1 - alpha));
      }
    }
  }

  return canvas;
}

// 1. Discord 1024x1024
const discord1024 = createComposite(1024, 1024, 0.85);
fs.writeFileSync('/sdcard/Download/ls_studio_logo_bg_1024.png', PNG.sync.write(discord1024));
console.log('✅ Generated /sdcard/Download/ls_studio_logo_bg_1024.png (1024x1024)');

// 2. Discord 512x512
const discord512 = createComposite(512, 512, 0.85);
fs.writeFileSync('/sdcard/Download/ls_studio_logo_bg_512.png', PNG.sync.write(discord512));
console.log('✅ Generated /sdcard/Download/ls_studio_logo_bg_512.png (512x512)');

// 3. Minecraft server-icon.png (64x64)
const mcIcon = createComposite(64, 64, 0.95);
fs.writeFileSync('/sdcard/Download/server-icon.png', PNG.sync.write(mcIcon));
console.log('✅ Generated /sdcard/Download/server-icon.png (64x64)');

// 4. Discord Banner (960x540)
const banner = createComposite(960, 540, 0.75);
fs.writeFileSync('/sdcard/Download/ls_studio_banner_bg_960x540.png', PNG.sync.write(banner));
console.log('✅ Generated /sdcard/Download/ls_studio_banner_bg_960x540.png (960x540)');

