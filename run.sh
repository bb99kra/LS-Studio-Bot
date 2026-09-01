#!/usr/bin/env bash
# Script chạy trực tiếp LS Studio Bot (Foreground)
# Tối ưu hóa bộ nhớ cho môi trường hosting container (RAM limit 100MB)

set -e

# Tự động nhận diện thư mục chứa script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

echo "🚀 Đang khởi động LS Studio Bot từ $SCRIPT_DIR..."

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Lỗi: Node.js chưa được cài đặt hoặc không nằm trong PATH!"
  exit 1
fi

# Chạy bot với cờ giới hạn heap V8 80MB (phù hợp với Discloud 100MB RAM)
# Sử dụng exec để thay thế tiến trình shell, tiết kiệm RAM và chuyển tiếp tín hiệu POSIX (SIGTERM/SIGINT)
exec node --max-old-space-size=80 bot.js "$@"
