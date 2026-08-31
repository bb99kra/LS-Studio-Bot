require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const WATCHDOG_TIMEOUT_MS = 60000;
const watchdog = setTimeout(() => {
  console.error(`⏱️ [WATCHDOG] Quá thời gian commit lên Discloud (${WATCHDOG_TIMEOUT_MS / 1000}s). Tự động dừng tiến trình.`);
  process.exit(1);
}, WATCHDOG_TIMEOUT_MS);
if (watchdog.unref) watchdog.unref();

process.on('unhandledRejection', (reason) => {
  clearTimeout(watchdog);
  console.error('❌ Lỗi không kiểm soát (Unhandled Rejection):', reason);
  process.exit(1);
});

async function commit() {
  const token = process.env.DISCLOUD_TOKEN || (fs.existsSync('./token.local.js') ? require('./token.local.js').DISCLOUD_TOKEN : null);
  const appId = process.env.DISCLOUD_APP_ID || '1787827063185';

  if (!token || token === 'YOUR_DISCLOUD_TOKEN') {
    clearTimeout(watchdog);
    console.error('❌ Lỗi: Chưa cung cấp Discloud API Token. Vui lòng thiết lập DISCLOUD_TOKEN trong biến môi trường hoặc token.local.js');
    process.exit(1);
  }

  // Tìm kiếm file zip theo thứ tự ưu tiên
  const candidatePaths = [
    process.argv[2],
    process.env.DISCLOUD_ZIP_PATH,
    path.resolve(__dirname, 'LS_Studio_Bot_247.zip'),
    path.resolve(__dirname, 'LSStudioBot.zip'),
    '/sdcard/Download/LS_Studio_Bot_247.zip'
  ].filter(Boolean);

  let zipPath = null;
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      zipPath = p;
      break;
    }
  }

  if (!zipPath) {
    clearTimeout(watchdog);
    console.error('❌ Lỗi: Không tìm thấy file zip để commit lên Discloud!');
    console.error('Đã kiểm tra các đường dẫn sau:');
    candidatePaths.forEach(p => console.error(`  - ${p}`));
    console.error('\n💡 Hướng dẫn: Chạy lệnh với đường dẫn file zip, ví dụ:');
    console.error('   node commit_discloud.js /duong/dan/file.zip');
    process.exit(1);
  }

  console.log(`📦 Đang chuẩn bị tải lên file: ${zipPath}`);
  console.log(`🚀 Đang commit tới Discloud App ID: ${appId}...`);

  const form = new FormData();
  form.append('file', fs.createReadStream(zipPath));

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
    console.log('✅ Commit thành công lên Discloud!');
    console.log('📄 Phản hồi từ Discloud:', JSON.stringify(res.data, null, 2));
    process.exit(0);
  } catch (err) {
    clearTimeout(watchdog);
    console.error('❌ Commit thất bại!');
    if (err.response) {
      console.error(`Mã lỗi HTTP: ${err.response.status}`);
      console.error('Dữ liệu lỗi:', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error('Lỗi kết nối:', err.message);
    }
    process.exit(1);
  }
}

commit();
