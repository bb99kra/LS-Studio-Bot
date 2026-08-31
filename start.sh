#!/usr/bin/env bash
# Script chạy ngầm LS Studio Bot (Background với nohup)

# Tự động nhận diện thư mục chứa script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

LOG_FILE="$SCRIPT_DIR/bot.log"

echo "🔄 Đang dừng các tiến trình bot cũ nếu có..."
pkill -f "node bot.js" 2>/dev/null || true

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Lỗi: Node.js chưa được cài đặt hoặc không nằm trong PATH!"
  exit 1
fi

echo "🚀 Đang khởi động LS Studio Bot ngầm..."
nohup node bot.js > "$LOG_FILE" 2>&1 &
BOT_PID=$!

echo "✅ LS Studio Bot đã khởi động ngầm thành công!"
echo "📌 PID: $BOT_PID"
echo "📄 Log file: $LOG_FILE"
