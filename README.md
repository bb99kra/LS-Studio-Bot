# 🏰 LS STUDIO - DISCORD BOT & SHOP MANAGEMENT SYSTEM

Hệ thống Discord Bot toàn diện và bộ công cụ tự động hóa cấu trúc Server chuyên nghiệp dành riêng cho **LS STUDIO** (Minecraft Plugin & AI Solutions Ecosystem).

---

## 📑 MỤC LỤC
1. [Tính Năng Nổi Bật](#-tính-năng-nổi-bật)
2. [Cấu Trúc Dự Án](#-cấu-trúc-dự-án)
3. [Cấu Hình Môi Trường & Bảo Mật](#-cấu-hình-môi-trường--bảo-mật)
4. [Hướng Dẫn Khởi Chạy Chi Tiết](#-hướng-dẫn-khởi-chạy-chi-tiết)
   - [4.1. Khởi chạy Bot Chính (`bot.js`)](#41-khởi-chạy-bot-chính-botjs)
   - [4.2. Khởi tạo & Cấu hình Server Tự Động (`setup_server.js`)](#42-khởi-tạo--cấu-hình-server-tự-động-setup_serverjs)
   - [4.3. Chạy Bộ Kiểm Thử Tự Động (`test_harness.js`)](#43-chạy-bộ-kiểm-thử-tự-động-test_harnessjs)
5. [Danh Sách Các Standalone Updaters & Utilities](#-danh-sách-các-standalone-updaters--utilities)
6. [Slash Commands & Hệ Thống Tương Tác](#-slash-commands--hệ-thống-tương-tác)
7. [Triển Khai Đám Mây (Discloud / VPS / Linux)](#-triển-khai-đám-mây-discloud--vps--linux)

---

## 🌟 Tính Năng Nổi Bật

- 🛡️ **AutoMod Đa Tầng:** Tự động lọc từ cấm thô tục, quét link scam/phishing, chặn spam Discord Invite và cô lập tin nhắn vi phạm.
- 🎫 **Hệ Thống Ticket Tương Tác:** Mua Plugin, Hỗ trợ kỹ thuật 1-1, Đặt làm Custom Plugin/Mod, Giao dịch AI API Key với modal form chi tiết.
- 💳 **Tích Hợp Thanh Toán Tự Động:** Tạo mã VietQR động theo đơn hàng, cấu hình tài khoản ngân hàng MBBank quân đội chính chủ.
- 📝 **Transcript & Audit Log:** Tự động xuất lịch sử chat ticket sang HTML/Text khi đóng ticket, lưu trữ minh bạch vào kênh nhật ký ban quản trị.
- 🚀 **Kiến Trúc Rate-Limit An Toàn:** Cơ chế Exponential Backoff, jitter, watchdog timeout và delay pacing (250ms - 350ms) chống hoàn toàn lỗi Discord HTTP 429.
- 🧪 **Offline Test Harness (47+ Tests):** Kiểm thử toàn diện 100% logic bot không cần token Discord thật hay kết nối mạng bên ngoài.

---

## 📂 Cấu Trúc Dự Án

```
bot discord LSstudio/
├── bot.js                                # Điểm vào chính của Bot Discord 24/7
├── setup_server.js                       # Kịch bản tự động hóa xây dựng server từ A-Z
├── test_harness.js                       # Bộ kiểm thử offline toàn diện (47+ scenarios)
├── test_transcript_audit.js              # Kiểm thử chuyên sâu hệ thống transcript & audit
├── .env.example                          # Template cấu hình biến môi trường mẫu
├── .gitignore                            # Danh sách loại trừ file nhạy cảm & bí mật
├── discloud.config                       # File cấu hình triển khai Discloud
├── run.sh / start.sh                     # Script hỗ trợ chạy foreground/background trên Linux
│
├── [Standalone Updaters & Decorators]
│   ├── clean_readable_names.js           # Chuẩn hóa tên kênh rõ ràng, dễ đọc
│   ├── create_welcome_goodbye.js         # Khởi tạo kênh chào mừng thành viên mới
│   ├── create_ai_shop_channels.js        # Tạo danh mục & phân nhánh kênh bán AI
│   ├── decor_partner.js                  # Cập nhật banner & kênh đối tác liên kết
│   ├── decor_studio_onic_style.js        # Phong cách trang trí Typography Small Caps
│   ├── fix_aesthetic_icons.js            # Tối ưu hóa icon nhận diện thương hiệu
│   ├── fix_products_embed.js             # Sửa chữa và chuẩn hóa Embed sản phẩm
│   ├── inspect_channels.js               # Kiểm tra và liệt kê ID danh mục/kênh
│   ├── redecor_nguyen_smp.js             # Cấu hình & trang trí Server đối tác Nguyen SMP
│   ├── reorganize_separate_plugin_channels.js # Phân chia các kênh Plugin riêng biệt
│   ├── remove_cart_invuln_features.js    # Cập nhật lại tính năng và bảng giá
│   ├── separate_ai_channels.js           # Phân tách 7 kênh chuyên dụng dịch vụ AI
│   ├── update_ai_latest_models.js        # Cập nhật danh mục Model AI thế hệ 5
│   ├── update_all_channels_bilingual.js  # Chuyển đổi giao diện song ngữ Việt - Anh
│   ├── update_price_with_ai.js           # Cập nhật bảng giá tích hợp AI & Plugin
│   └── update_security_embeds.js         # Cập nhật bảng tính năng bảo mật chuyên sâu
```

---

## 🔐 Cấu Hình Môi Trường & Bảo Mật

Dự án tuân thủ nghiêm ngặt nguyên tắc **Không Rò Rỉ Bí Mật (Zero Secret Leaks)**. Mọi token, khóa bí mật đều được cách ly khỏi git repository thông qua [.gitignore](file:///c:/Users/Nguyen%20Minh%20Nhut/Desktop/bot%20discord%20LSstudio/.gitignore).

### 1. Tạo file cấu hình `.env`
Sao chép từ file mẫu [.env.example](file:///c:/Users/Nguyen%20Minh%20Nhut/Desktop/bot%20discord%20LSstudio/.env.example):
```bash
cp .env.example .env
```

### 2. Thiết lập các thông số trong `.env`:
```env
# [BẮT BUỘC] Token Bot lấy từ Discord Developer Portal
DISCORD_TOKEN=your_discord_bot_token_here

# [BẮT BUỘC] ID Server Discord chính (LS STUDIO)
GUILD_ID=1542476657825419334

# [TÙY CHỌN] Token triển khai nền tảng Discloud
DISCLOUD_TOKEN=your_discloud_token_here
```

> 💡 **Cơ chế Fallback:** Dự án hỗ trợ fallback cục bộ qua file `token.local.js` nếu không sử dụng biến môi trường hệ thống. Cả 2 cách tiếp cận đều được mã hóa và bỏ qua trong git.

---

## 🚀 Hướng Dẫn Khởi Chạy Chi Tiết

### 1. Cài đặt thư viện dependencies:
```bash
npm install
```

---

### 4.1. Khởi chạy Bot Chính (`bot.js`)

File [bot.js](file:///c:/Users/Nguyen%20Minh%20Nhut/Desktop/bot%20discord%20LSstudio/bot.js) là chương trình cốt lõi chạy 24/7 của máy chủ, quản trị toàn bộ tương tác người dùng, mở ticket, kiểm duyệt tin nhắn và thông báo.

#### Lệnh khởi chạy:
```bash
# Cách 1: Sử dụng NPM Script (Khuyên dùng)
npm start

# Cách 2: Gọi trực tiếp qua Node.js
node bot.js
```

#### Các tác vụ tự động khi bot khởi động:
1. Đăng ký tự động các **Slash Commands** (`/ping`, `/stk`, `/khachhang`, `/mua`) lên Guild.
2. Thiết lập bộ lắng nghe sự kiện: Tin nhắn mới (AutoMod), Tương tác nút bấm (Buttons), Danh sách thả xuống (Select Menus), Modal Forms.
3. Kích hoạt trình quét lỗi không đồng bộ và giám sát kết nối Gateway.

---

### 4.2. Khởi tạo & Cấu hình Server Tự Động (`setup_server.js`)

File [setup_server.js](file:///c:/Users/Nguyen%20Minh%20Nhut/Desktop/bot%20discord%20LSstudio/setup_server.js) là công cụ khởi tạo cấu trúc toàn diện từ con số 0:
- Tự động tạo phân quyền Role: **👑 Founder / Lead Dev**, **🛠️ Admin / Staff**, **💎 Khách Hàng VIP**, **🤖 Bot Quản Trị**.
- Tạo toàn bộ danh mục (Categories) và các kênh chức năng với Permission Overwrites chuẩn bảo mật.
- Đăng tải toàn bộ hệ thống Embeds, Banner hướng dẫn, Menu bảng giá và các nút bấm mua hàng.
- Tích hợp công nghệ **Safe API Call** chống Discord Rate Limit với Exponential Backoff.

#### Lệnh thực thi:
```bash
# Cách 1: Sử dụng NPM Script
npm run setup

# Cách 2: Chạy trực tiếp
node setup_server.js
```

> ⚠️ **Lưu ý:** Chỉ cần chạy script này **1 lần** khi thiết lập server mới hoặc khi muốn tái cấu trúc toàn bộ kênh.

---

### 4.3. Chạy Bộ Kiểm Thử Tự Động (`test_harness.js`)

File [test_harness.js](file:///c:/Users/Nguyen%20Minh%20Nhut/Desktop/bot%20discord%20LSstudio/test_harness.js) là bộ khung kiểm thử chuyên sâu (Test Harness) độc lập:
- Kiểm tra cú pháp, cấu trúc và logic mà **không cần token Discord thật**.
- Giả lập (Mock) hoàn toàn Discord Client, Guilds, Channels, Messages, và API REST Calls.
- Chạy 47+ kịch bản test:
  1. *Security Audit*: Quét mã nguồn ngăn ngừa rò rỉ token/secret.
  2. *AutoMod Filter*: Kiểm tra từ khóa cấm, link spam, regex invite.
  3. *Slash Commands*: Kiểm tra phản hồi lệnh `/ping`, `/stk`, `/khachhang`.
  4. *Interaction Handlers*: Kiểm tra xử lý button `ticket_buy`, `ticket_pricing`, select menus.
  5. *Safe API Rate Limiting*: Kiểm tra cơ chế retry, pacing và exponential backoff.
  6. *Setup Server Dry-run*: Mô phỏng toàn bộ tiến trình tạo vai trò và kênh.

#### Lệnh chạy Test Suite:
```bash
# Cách 1: Chạy test tiêu chuẩn
npm test

# Cách 2: Chạy trực tiếp file kiểm thử
node test_harness.js

# Cách 3: Chạy kiểm thử audit transcript
node test_transcript_audit.js
```

---

## 🛠️ Danh Sách Các Standalone Updaters & Utilities

Khi cần cập nhật nhanh một phần cụ thể của server mà không muốn setup lại toàn bộ, bạn có thể sử dụng các script chuyên biệt (đã được tối ưu tốc độ và có độ trễ an toàn):

| Tên File | Mục Đích Sử Dụng | Lệnh Chạy |
|---|---|---|
| [inspect_channels.js](file:///c:/Users/Nguyen%20Minh%20Nhut/Desktop/bot%20discord%20LSstudio/inspect_channels.js) | Liệt kê toàn bộ ID danh mục & kênh của server | `node inspect_channels.js` |
| [clean_readable_names.js](file:///c:/Users/Nguyen%20Minh%20Nhut/Desktop/bot%20discord%20LSstudio/clean_readable_names.js) | Chuẩn hóa font chữ & emoji kênh sang dạng rõ nét | `node clean_readable_names.js` |
| [create_welcome_goodbye.js](file:///c:/Users/Nguyen%20Minh%20Nhut/Desktop/bot%20discord%20LSstudio/create_welcome_goodbye.js) | Tạo kênh chào mừng thành viên & chia tay | `node create_welcome_goodbye.js` |
| [separate_ai_channels.js](file:///c:/Users/Nguyen%20Minh%20Nhut/Desktop/bot%20discord%20LSstudio/separate_ai_channels.js) | Khởi tạo 7 kênh chuyên biệt cho dịch vụ AI | `node separate_ai_channels.js` |
| [reorganize_separate_plugin_channels.js](file:///c:/Users/Nguyen%20Minh%20Nhut/Desktop/bot%20discord%20LSstudio/reorganize_separate_plugin_channels.js) | Tách riêng từng kênh cho từng Plugin Minecraft | `node reorganize_separate_plugin_channels.js` |
| [update_security_embeds.js](file:///c:/Users/Nguyen%20Minh%20Nhut/Desktop/bot%20discord%20LSstudio/update_security_embeds.js) | Cập nhật các embed chuyên sâu tính năng Anti | `node update_security_embeds.js` |
| [decor_partner.js](file:///c:/Users/Nguyen%20Minh%20Nhut/Desktop/bot%20discord%20LSstudio/decor_partner.js) | Cập nhật Embed đối tác liên kết 2 chiều | `node decor_partner.js` |
| [redecor_nguyen_smp.js](file:///c:/Users/Nguyen%20Minh%20Nhut/Desktop/bot%20discord%20LSstudio/redecor_nguyen_smp.js) | Đồng bộ giao diện sang server đối tác Nguyen SMP | `node redecor_nguyen_smp.js` |

---

## ⚡ Slash Commands & Hệ Thống Tương Tác

| Lệnh Slash | Quyền Hạn | Mô Tả Chức Năng |
|---|---|---|
| `/ping` | Mọi người | Kiểm tra độ trễ của Bot và Discord WebSocket Gateway |
| `/stk` | Mọi người | Hiển thị thông tin tài khoản ngân hàng & mã VietQR thanh toán 24/7 |
| `/khachhang` | Quản trị viên | Cấp role Khách Hàng VIP cho thành viên sau khi hoàn tất mua hàng |
| `/mua` | Mọi người | Mở nhanh menu đặt mua sản phẩm & dịch vụ |

---

## ☁️ Triển Khai Đám Mây (Discloud / VPS / Linux)

### 1. Triển khai Discloud:
File cấu hình [discloud.config](file:///c:/Users/Nguyen%20Minh%20Nhut/Desktop/bot%20discord%20LSstudio/discloud.config) đã được thiết lập sẵn:
```ini
ID=lsstudio
TYPE=bot
MAIN=bot.js
NAME=LS Studio Bot
RAM=100
AUTORESTART=true
VERSION=latest
APT=tools
```
Đẩy code lên Discloud:
```bash
npm run discloud:commit [duong_dan_file_zip]
```

### 2. Chạy nền trên Linux / VPS / Termux:
```bash
# Cấp quyền thực thi
chmod +x run.sh start.sh

# Chạy ngầm với nohup (tự động xuất log vào bot.log)
./start.sh

# Kiểm tra log thời gian thực
tail -f bot.log
```

---

## 🛡️ Cam Kết Chất Lượng Code

- **Clean Code & Zero Warning:** 100% file JavaScript trong dự án đều vượt qua kiểm tra cú pháp nghiêm ngặt (`node -c`).
- **Anti-Crash & Robust Exception Handling:** Bắt tất cả sự kiện `unhandledRejection` và `uncaughtException` đảm bảo bot luôn trực tuyến 24/7 không bao giờ sập nguồn bất ngờ.
