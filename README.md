# 🏰 LS STUDIO - DISCORD BOT & SHOP SYSTEM

Hệ thống Bot và Cấu trúc Server Discord chuyên nghiệp dành cho **LS STUDIO** (Minecraft Plugin Development & AI Services).

---

## 📂 Danh mục & Kênh đã được thiết lập tự động:

1. **📌 ━━━ THÔNG TIN ━━━**
   - `📜・luật-và-chính-sách`: Quy định bản quyền, chính sách bảo hành & quy trình đặt code.
   - `📢・thông-báo`: Thông báo chính thức & giới thiệu dịch vụ.
   - `🚀・update-changelog`: Nhật ký cập nhật phiên bản các Plugin.
   - `🎁・ưu-đãi-giveaway`: Sự kiện khuyến mãi & tặng quà.

2. **🛒 ━━━ LS STORE ━━━**
   - `💎・danh-sách-plugin`: Showcase sản phẩm, tính năng, hỗ trợ Paper/Folia, giá bán.
   - `💰・bảng-giá-dịch-vụ`: Bảng giá chi tiết & thông tin thanh toán VietQR / MoMo.
   - `🌐・server-test-demo`: Địa chỉ IP và hướng dẫn vào test plugin trực tiếp.
   - `⭐・đánh-giá-vouch`: Kênh khách hàng để lại review và vouch uy tín.

3. **🎫 ━━━ MUA HÀNG & HỖ TRỢ ━━━**
   - `🛒・mua-plugin`: Nút bấm mở Ticket mua hàng riêng tư.
   - `🛠️・hỗ-trợ-kỹ-thuật`: Nút bấm mở Ticket hỗ trợ kỹ thuật, fix bug, config.
   - `📝・đặt-code-plugin-riêng`: Nút bấm mở Ticket đặt làm plugin độc quyền.

4. **💬 ━━━ CỘNG ĐỒNG ━━━**
   - `💬・trò-chuyện`: Chat giao lưu chung.
   - `💡・góp-ý-tính-năng`: Nơi đóng góp ý tưởng cho plugin mới.
   - `🎮・khoe-server-mc`: Nơi khoe máy chủ Minecraft đang dùng plugin LS Studio.
   - `🤖・lệnh-bot`: Dùng lệnh bot.

5. **👑 ━━━ KHÁCH HÀNG VIP ━━━** (Chỉ role Khách Hàng & VIP thấy)
   - `📦・tải-plugin-updates`: Nhận link tải file `.jar` và bản vá lỗi.
   - `💬・khu-vực-khách-hàng`: Kênh chat ưu tiên và hỗ trợ 1-1.

6. **🔒 ━━━ BAN QUẢN TRỊ ━━━** (Staff Only)
   - `📊・nhật-ký-giao-dịch`: Lưu lại lịch sử đóng mở ticket.
   - `💬・nội-bộ-staff`: Kênh trao đổi nội bộ ban quản trị.

---

## ⚡ Các lệnh Slash Commands của Bot:
- `/ping`: Kiểm tra độ trễ (latency) của Bot.
- `/stk`: Lấy thông tin thanh toán MBBank và mã VietQR thanh toán 24/7.
- `/khachhang @user`: Cấp role **Khách Hàng** cho người vừa mua plugin để cấp quyền vào khu vực VIP tải file `.jar`.

---

## 🚀 Hướng dẫn khởi chạy & Triển khai:

### 1. Cài đặt dependencies:
```bash
npm install
```

### 2. Cấu hình Biến môi trường & Token:
Sao chép file mẫu `.env.example` thành `.env` và điền Token của bạn:
```bash
cp .env.example .env
```
Nội dung file `.env`:
```env
DISCORD_TOKEN=your_discord_bot_token_here
GUILD_ID=1542476657825419334
DISCLOUD_TOKEN=your_discloud_token_here
```
*(Hoặc sử dụng `token.local.js` làm cơ chế fallback cục bộ - cả hai file đều đã được bảo vệ trong `.gitignore`)*.

### 3. Chạy Bot:
- **Chạy trực tiếp (Foreground / Local / VPS / Termux):**
  ```bash
  npm start
  # hoặc
  ./run.sh
  ```

- **Chạy ngầm (Background với nohup trên Linux / Termux):**
  ```bash
  ./start.sh
  ```
  *(Log sẽ được ghi tự động vào file `bot.log` cùng thư mục).*

### 4. Công cụ kiểm tra (Inspection Utilities):
- Kiểm tra danh sách kênh Server LS Studio:
  ```bash
  npm run inspect:ls
  ```
- Kiểm tra danh sách kênh Server Nguyen SMP:
  ```bash
  npm run inspect:nguyen
  ```

### 5. Kiểm thử & Dry-Run Test Suite (Test Harness):
- Chạy toàn bộ 47+ kịch bản test (AutoMod, Events, Slash Commands, Buttons, Select Menus, Setup Server Dry-run):
  ```bash
  npm test
  # hoặc
  node test_harness.js
  ```

### 6. Triển khai lên Discloud (Cloud Hosting):
- File cấu hình: `discloud.config`
- Commit mã nguồn lên Discloud:
  ```bash
  npm run discloud:commit [duong_dan_file_zip]
  ```
