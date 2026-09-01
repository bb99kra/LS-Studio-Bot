const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const axios = require('axios');
const FormData = require('form-data');

// =========================================================================
// WATCHDOG & ERROR EVENT GUARDS
// =========================================================================
const WATCHDOG_TIMEOUT_MS = 90000; // 90 giây tối đa cho việc upload zip
const watchdog = setTimeout(() => {
  console.error(`⏱️ [WATCHDOG] Quá thời gian commit lên Discloud (${WATCHDOG_TIMEOUT_MS / 1000}s). Tự động dừng tiến trình.`);
  process.exit(1);
}, WATCHDOG_TIMEOUT_MS);
if (watchdog.unref) watchdog.unref();

process.on('uncaughtException', (err) => {
  clearTimeout(watchdog);
  console.error('❌ Lỗi ngoại lệ chưa bắt (Uncaught Exception):', err?.stack || err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  clearTimeout(watchdog);
  console.error('❌ Lỗi Promise chưa kiểm soát (Unhandled Rejection):', reason?.stack || reason);
  process.exit(1);
});

process.on('SIGINT', () => {
  clearTimeout(watchdog);
  console.log('🛑 [SIGINT] Đang dừng tiến trình commit...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  clearTimeout(watchdog);
  console.log('🛑 [SIGTERM] Đang dừng tiến trình commit...');
  process.exit(0);
});

process.on('SIGHUP', () => {
  clearTimeout(watchdog);
  console.log('🛑 [SIGHUP] Đang dừng tiến trình commit...');
  process.exit(0);
});

// =========================================================================
// HELPER: VALIDATE ZIP FILE (EXISTS, SIZE, MAGIC BYTES)
// =========================================================================
function validateZipFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { valid: false, reason: 'File không tồn tại' };
  }

  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch (err) {
    return { valid: false, reason: `Không thể đọc thông tin file: ${err.message}` };
  }

  if (!stat.isFile()) {
    return { valid: false, reason: 'Đường dẫn không phải là một file hợp lệ' };
  }

  if (stat.size === 0) {
    return { valid: false, reason: 'File zip rỗng (0 bytes)' };
  }

  const MAX_ZIP_SIZE = 100 * 1024 * 1024; // 100MB (Discloud max package upload limit)
  if (stat.size > MAX_ZIP_SIZE) {
    return { valid: false, reason: `Dung lượng file (${(stat.size / 1024 / 1024).toFixed(2)}MB) vượt quá giới hạn 100MB của Discloud` };
  }

  // Kiểm tra ZIP Magic Bytes (PK\x03\x04 hoặc PK\x05\x06 hoặc PK\x07\x08)
  try {
    const fd = fs.openSync(filePath, 'r');
    const headerBuffer = Buffer.alloc(4);
    fs.readSync(fd, headerBuffer, 0, 4, 0);
    fs.closeSync(fd);

    const isZip = headerBuffer[0] === 0x50 && headerBuffer[1] === 0x4B &&
      ((headerBuffer[2] === 0x03 && headerBuffer[3] === 0x04) ||
       (headerBuffer[2] === 0x05 && headerBuffer[3] === 0x06) ||
       (headerBuffer[2] === 0x07 && headerBuffer[3] === 0x08));

    if (!isZip) {
      return { valid: false, reason: 'File không đúng định dạng ZIP chuẩn (Magic bytes PK.. không khớp)' };
    }
  } catch (err) {
    return { valid: false, reason: `Lỗi khi kiểm tra định dạng ZIP: ${err.message}` };
  }

  return { valid: true, sizeBytes: stat.size };
}

// =========================================================================
// MAIN COMMIT FUNCTION
// =========================================================================
async function commit() {
  const tokenLocalPath = path.join(__dirname, 'token.local.js');
  const localConfig = fs.existsSync(tokenLocalPath) ? require(tokenLocalPath) : {};

  const token = process.env.DISCLOUD_TOKEN || localConfig.DISCLOUD_TOKEN || null;
  const appId = process.env.DISCLOUD_APP_ID || localConfig.DISCLOUD_APP_ID || '1787827063185';

  const invalidTokens = ['YOUR_DISCLOUD_TOKEN', 'your_discloud_token_here', ''];
  if (!token || invalidTokens.includes(token.trim())) {
    clearTimeout(watchdog);
    console.error('❌ Lỗi: Chưa cung cấp Discloud API Token hợp lệ.');
    console.error('💡 Vui lòng thiết lập DISCLOUD_TOKEN trong file .env hoặc token.local.js');
    process.exit(1);
  }

  // Danh sách các đường dẫn ứng viên theo thứ tự ưu tiên
  const candidatePaths = [
    process.argv[2],
    process.env.DISCLOUD_ZIP_PATH,
    path.resolve(__dirname, 'LS_Studio_Bot_247.zip'),
    path.resolve(__dirname, 'LSStudioBot.zip'),
    '/sdcard/Download/LS_Studio_Bot_247.zip'
  ].filter(Boolean);

  let zipPath = null;
  let zipValidation = null;

  for (const p of candidatePaths) {
    const check = validateZipFile(p);
    if (check.valid) {
      zipPath = p;
      zipValidation = check;
      break;
    }
  }

  if (!zipPath) {
    clearTimeout(watchdog);
    console.error('❌ Lỗi: Không tìm thấy file ZIP hợp lệ để commit lên Discloud!');
    console.error('📋 Danh sách đường dẫn đã quét:');
    for (const p of candidatePaths) {
      const res = validateZipFile(p);
      console.error(`  - ${p} => [${res.reason}]`);
    }
    console.error('\n💡 Hướng dẫn: Đóng gói project thành file zip và chạy:');
    console.error('   node commit_discloud.js /duong/dan/LS_Studio_Bot_247.zip');
    process.exit(1);
  }

  const sizeMB = (zipValidation.sizeBytes / 1024 / 1024).toFixed(2);
  console.log(`📦 Đã xác thực file ZIP: ${zipPath} (${sizeMB} MB, Magic bytes OK)`);
  console.log(`🚀 Đang commit tới Discloud App ID: ${appId}...`);

  const form = new FormData();
  const fileStream = fs.createReadStream(zipPath);
  
  fileStream.on('error', (streamErr) => {
    clearTimeout(watchdog);
    console.error(`❌ Lỗi đọc file stream từ ${zipPath}:`, streamErr.message);
    process.exit(1);
  });

  form.append('file', fileStream);

  try {
    const res = await axios.put(`https://api.discloud.app/v2/app/${appId}/commit`, form, {
      headers: {
        'api-token': token,
        ...form.getHeaders()
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 60000
    });

    clearTimeout(watchdog);

    if (res.data && res.data.status === 'error') {
      console.error(`❌ Discloud trả về thông báo lỗi:`, res.data.message || res.data);
      process.exit(1);
    }

    console.log('✅ Commit thành công lên Discloud!');
    console.log('📄 Phản hồi từ Discloud API:');
    console.log(JSON.stringify(res.data, null, 2));
    process.exit(0);
  } catch (err) {
    clearTimeout(watchdog);
    console.error('❌ Commit thất bại!');
    
    if (err.response) {
      const status = err.response.status;
      console.error(`Mã lỗi HTTP: ${status} (${err.response.statusText || 'Error'})`);
      
      if (status === 401) {
        console.error('👉 Nguyên nhân: DISCLOUD_TOKEN không chính xác hoặc đã hết hạn.');
      } else if (status === 404) {
        console.error(`👉 Nguyên nhân: Không tìm thấy ứng dụng Discloud với App ID "${appId}".`);
      } else if (status === 413) {
        console.error('👉 Nguyên nhân: Dung lượng file ZIP vượt quá giới hạn tải lên của Discloud.');
      } else if (status === 429) {
        console.error('👉 Nguyên nhân: Vượt quá giới hạn gọi API Discloud (Rate Limit). Vui lòng thử lại sau.');
      }
      
      console.error('Chi tiết phản hồi:', JSON.stringify(err.response.data, null, 2));
    } else if (err.code === 'ECONNABORTED') {
      console.error('⏱️ Hết thời gian chờ kết nối (Timeout 60s) khi tải file lên Discloud.');
    } else {
      console.error('Lỗi kết nối mạng:', err.message);
    }
    process.exit(1);
  }
}

// Chạy hàm commit
commit();

