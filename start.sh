#!/usr/bin/env bash
cd /data/data/com.termux/files/home/LS_Studio_Bot
pkill -f "node bot.js" 2>/dev/null || true
nohup node bot.js > /data/data/com.termux/files/home/LS_Studio_Bot/bot.log 2>&1 &
echo "✅ LS Studio Bot đã khởi động ngầm thành công! PID: $!"
