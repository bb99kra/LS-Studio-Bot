#!/usr/bin/env bash
# Script chạy trực tiếp LS Studio Bot (Foreground)

set -e

# Tự động nhận diện thư mục chứa script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

echo "🚀 Đang khởi động LS Studio Bot từ $SCRIPT_DIR..."
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Lỗi: Node.js chưa được cài đặt hoặc không nằm trong PATH!"
  exit 1
fi

node bot.js
