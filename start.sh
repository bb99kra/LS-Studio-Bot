#!/usr/bin/env bash
# Script chạy ngầm LS Studio Bot (Background với nohup)
# Tối ưu hóa bộ nhớ cho môi trường hosting container (RAM limit 100MB)

# Tự động nhận diện thư mục chứa script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

LOG_FILE="$SCRIPT_DIR/bot.log"

echo "🔄 Đang dừng các tiến trình bot cũ nếu có..."
pkill -f "node.*bot\.js" 2>/dev/null || true

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Lỗi: Node.js chưa được cài đặt hoặc không nằm trong PATH!"
  exit 1
fi

echo "🚀 Đang khởi động LS Studio Bot ngầm (RAM limit: 80MB V8 Heap)..."
echo "=== [$(date '+%Y-%m-%d %H:%M:%S')] Khởi động LS Studio Bot ===" >> "$LOG_FILE"

nohup node --max-old-space-size=80 bot.js >> "$LOG_FILE" 2>&1 &
BOT_PID=$!

# Kiểm tra xác thực tiến trình đã khởi động thành công
sleep 1
if kill -0 "$BOT_PID" 2>/dev/null; then
  echo "✅ LS Studio Bot đã khởi động ngầm thành công!"
  echo "📌 PID: $BOT_PID"
  echo "📄 Log file: $LOG_FILE"
  echo "💡 Xem log trực tiếp: tail -f \"$LOG_FILE\""
else
  echo "❌ Khởi động bot thất bại! Kiểm tra nhật ký lỗi trong $LOG_FILE:"
  tail -n 15 "$LOG_FILE" 2>/dev/null || true
  exit 1
fi

