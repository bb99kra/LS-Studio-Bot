const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { 
  Client, 
  GatewayIntentBits, 
  ChannelType, 
  PermissionsBitField, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} = require('discord.js');

const tokenLocalPath = path.join(__dirname, 'token.local.js');
const localConfig = fs.existsSync(tokenLocalPath) ? require(tokenLocalPath) : {};
const TOKEN = process.env.DISCORD_TOKEN || localConfig.TOKEN || '';
const LS_STUDIO_GUILD_ID = "1542476657825419334";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function makeActionButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_buy")
      .setLabel("🛒 Mở Ticket Đặt Mua / Buy Ticket")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("ticket_pricing")
      .setLabel("💰 Bảng Giá / Price List")
      .setStyle(ButtonStyle.Secondary)
  );
}

client.once('ready', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}! Bắt đầu khởi tạo toàn bộ kho hàng MMO...`);

  try {
    const guild = await client.guilds.fetch(LS_STUDIO_GUILD_ID);
    const channels = await guild.channels.fetch();

    // 1. TÌM HOẶC TẠO CATEGORY BẢN QUYỀN WINDOWS & OFFICE
    let catWinOffice = channels.find(c => c && c.type === ChannelType.GuildCategory && (c.name.includes("WINDOWS") || c.name.includes("OFFICE")));
    if (!catWinOffice) {
      catWinOffice = await guild.channels.create({
        name: "💻 ━━━ BẢN QUYỀN WINDOWS & OFFICE ━━━",
        type: ChannelType.GuildCategory
      });
      console.log("✅ Đã tạo Category mới: 💻 ━━━ BẢN QUYỀN WINDOWS & OFFICE ━━━");
    }

    // 2. TÌM CATEGORY NITRO & GIẢI TRÍ
    let catEntertainment = channels.find(c => c && c.type === ChannelType.GuildCategory && (c.name.includes("NITRO") || c.name.includes("GIẢI TRÍ")));
    if (!catEntertainment) {
      catEntertainment = await guild.channels.create({
        name: "🎁 ━━━ NITRO & GIẢI TRÍ ━━━",
        type: ChannelType.GuildCategory
      });
    }

    // Helper: Tạo kênh và đăng Embed
    async function setupChannel(catId, channelName, embedData) {
      let ch = channels.find(c => c && c.name === channelName);
      if (!ch) {
        ch = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: catId,
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
              deny: [PermissionsBitField.Flags.SendMessages]
            }
          ]
        });
        console.log(`✅ Đã tạo kênh mới: #${channelName}`);
      } else {
        if (ch.parentId !== catId) {
          await ch.setParent(catId).catch(() => {});
        }
      }

      const msgs = await ch.messages.fetch({ limit: 10 }).catch(() => new Map());
      for (const [id, msg] of msgs) {
        if (msg.author.id === client.user.id) {
          await msg.delete().catch(() => {});
          await sleep(200);
        }
      }

      await ch.send({ embeds: [embedData], components: [makeActionButtons()] });
      console.log(`✅ Đã đăng bài vào kênh #${channelName}`);
      return ch;
    }

    // A. KÊNH 1: #💻・windows-10-11-pro
    const embedWin = new EmbedBuilder()
      .setColor("#0078D7")
      .setTitle("💻 KEY BẢN QUYỀN WINDOWS 10 / 11 PRO VĨNH VIỄN • 35.000 VNĐ")
      .setDescription(
        "🇻🇳 **TIẾNG VIỆT:**\n" +
        "Kích hoạt Windows bản quyền chính hãng vĩnh viễn, sạch sẽ, không lo virus bẻ khóa:\n\n" +
        "• **Giá bán:** `35.000 VNĐ` • `~$1.50 USD` / 1 Key (Kích hoạt 1 PC)\n" +
        "• **Loại Key:** Key Retail kích hoạt trực tiếp trong Settings Windows.\n" +
        "• **Quyền lợi & Tính năng:**\n" +
        "  - 🌟 **Bản quyền vĩnh viễn:** Cài lại Win vẫn tự động nhận lại bản quyền số (Digital License).\n" +
        "  - 🛡️ Cập nhật Windows Update thoải mái, không sợ bị nhả key.\n" +
        "  - ⚡ Mở khóa toàn bộ tính năng: BitLocker, Hyper-V, Remote Desktop, Sandbox.\n" +
        "• **Bảo hành:** Kích hoạt thành công 100%, 1 đổi 1 nếu key lỗi.\n\n" +
        "────────────────────────────────────────\n" +
        "🇺🇸 **ENGLISH:**\n" +
        "**Windows 10 / 11 Pro Lifetime Retail Key:** `35.000 VNĐ` • `~$1.50 USD`\n" +
        "• Direct digital activation in Windows Settings. 100% genuine retail key.\n" +
        "• Lifetime license tied to your hardware with full Windows Updates."
      )
      .setFooter({ text: "LS STUDIO • Giao dịch tự động an toàn qua Ticket" })
      .setTimestamp();
    await setupChannel(catWinOffice.id, "💻・windows-10-11-pro", embedWin);

    // B. KÊNH 2: #📑・office-2024-pro-plus
    const embedOffice = new EmbedBuilder()
      .setColor("#D83B01")
      .setTitle("📑 KEY BẢN QUYỀN OFFICE 2021 / 2024 PRO PLUS VĨNH VIỄN • 39.000 VNĐ")
      .setDescription(
        "🇻🇳 **TIẾNG VIỆT:**\n" +
        "Sở hữu bộ ứng dụng tin học văn phòng đỉnh cao Microsoft Office bản Pro Plus mới nhất:\n\n" +
        "• **Giá bán:** `39.000 VNĐ` • `~$1.60 USD` / 1 Key (Bản quyền trọn đời)\n" +
        "• **Trọn bộ ứng dụng:** Word, Excel, PowerPoint, Outlook, OneNote, Access, Publisher.\n" +
        "• **Ưu điểm vượt trội:**\n" +
        "  - ⚡ Kích hoạt vĩnh viễn, không phải trả phí duy trì hàng tháng/hàng năm.\n" +
        "  - 🔒 Bản cài đặt chuẩn sạch từ máy chủ Microsoft, không dùng tool bẻ khóa.\n" +
        "• **Bảo hành:** Bảo hành kích hoạt thành công 100%.\n\n" +
        "────────────────────────────────────────\n" +
        "🇺🇸 **ENGLISH:**\n" +
        "**Office 2021 / 2024 Pro Plus Lifetime Key:** `39.000 VNĐ` • `~$1.60 USD`\n" +
        "• Full suite of Word, Excel, PowerPoint, Outlook, Access. Permanent activation."
      )
      .setFooter({ text: "LS STUDIO • Giao dịch tự động an toàn qua Ticket" })
      .setTimestamp();
    await setupChannel(catWinOffice.id, "📑・office-2024-pro-plus", embedOffice);

    // C. KÊNH 3: #☁️・microsoft-365-chính-chủ
    const embed365 = new EmbedBuilder()
      .setColor("#EB3C00")
      .setTitle("☁️ MICROSOFT 365 FAMILY NÂNG CHÍNH CHỦ • 1TB ONEDRIVE CLOUD")
      .setDescription(
        "🇻🇳 **TIẾNG VIỆT:**\n" +
        "Nâng cấp trực tiếp trên tài khoản Microsoft cá nhân của bạn, kèm dung lượng Cloud cực khủng:\n\n" +
        "• **1. Gói 1 Tháng:** `45.000 VNĐ` • `~$1.80 USD`\n" +
        "• **2. Gói 12 Tháng (1 Năm):** `269.000 VNĐ` • `~$10.80 USD` *(Tiết kiệm cực lớn)*\n" +
        "• **Quyền lợi & Tính năng:**\n" +
        "  - ☁️ **1TB (1.000GB) OneDrive Cloud:** Sao lưu ảnh, video, dữ liệu an toàn tốc độ cao.\n" +
        "  - 💻 Cài đặt bản quyền trên tối đa **5 thiết bị** đồng thời (Windows, Mac, iPhone, Android).\n" +
        "  - 🪄 Luôn cập nhật những tính năng AI và giao diện mới nhất của Microsoft 365.\n" +
        "• **Bảo hành:** Bảo hành trọn thời hạn gói sử dụng.\n\n" +
        "────────────────────────────────────────\n" +
        "🇺🇸 **ENGLISH:**\n" +
        "**Microsoft 365 Official Account Upgrade with 1TB OneDrive:**\n" +
        "• **1 Month:** `45.000 VNĐ` • `~$1.80 USD` | **12 Months:** `269.000 VNĐ` • `~$10.80 USD`\n" +
        "• Direct upgrade on your personal Microsoft account with 1TB OneDrive cloud."
      )
      .setFooter({ text: "LS STUDIO • Giao dịch tự động an toàn qua Ticket" })
      .setTimestamp();
    await setupChannel(catWinOffice.id, "☁️・microsoft-365-chính-chủ", embed365);

    // D. KÊNH 4: #🎨・canva-adobe-đồ-họa
    const embedDesign = new EmbedBuilder()
      .setColor("#FF3366")
      .setTitle("🎨 TÀI KHOẢN CANVA PRO & BẢN QUYỀN ADOBE CREATIVE CLOUD")
      .setDescription(
        "🇻🇳 **TIẾNG VIỆT:**\n" +
        "Công cụ thiết kế đồ họa đỉnh cao dành cho Designer, Content Creator và học sinh/sinh viên:\n\n" +
        "• 🌟 **Canva Edu / Pro (1 Năm):** `69.000 VNĐ` • `~$2.80 USD`\n" +
        "  - Mở khóa 100M+ mẫu ảnh, kho nhạc, font chữ Pro, công cụ Magic AI xóa phông 1 click.\n\n" +
        "• 🖌️ **Adobe Photoshop + Lightroom (1 Tháng):** `99.000 VNĐ` • `~$4.00 USD`\n" +
        "  - Bản quyền chính hãng, kèm tính năng AI Generative Fill (xóa/thêm chi tiết bằng AI).\n\n" +
        "• 👑 **Adobe Full App (20+ Ứng Dụng - 1 Tháng):** `149.000 VNĐ` • `~$6.00 USD`\n" +
        "  - Trọn bộ Photoshop, Premiere Pro, After Effects, Illustrator, InDesign, Audition.\n\n" +
        "• 📱 **App Sống Ảo & Chỉnh Ảnh Nhanh (7 Ngày):**\n" +
        "  - **Meitu VIP:** `29.000 VNĐ` • `~$1.20 USD` *(Làm đẹp chân dung, filter VIP)*\n" +
        "  - **Photoroom Pro:** `29.000 VNĐ` • `~$1.20 USD` *(Cắt ghép ảnh sản phẩm thương mại)*\n\n" +
        "────────────────────────────────────────\n" +
        "🇺🇸 **ENGLISH:**\n" +
        "**Canva Pro & Adobe Creative Cloud Official Upgrades:**\n" +
        "• Canva Pro 1 Year: `69.000 VNĐ` | Adobe Photography 1M: `99.000 VNĐ` | Adobe Full Apps 1M: `149.000 VNĐ`"
      )
      .setFooter({ text: "LS STUDIO • Giao dịch tự động an toàn qua Ticket" })
      .setTimestamp();
    await setupChannel(catEntertainment.id, "🎨・canva-adobe-đồ-họa", embedDesign);

    // E. KÊNH 5: #🛡️・vpn-bảo-mật-hma-nord
    const embedVPN = new EmbedBuilder()
      .setColor("#00C9A7")
      .setTitle("🛡️ MẠNG RIÊNG ẢO VPN TỐC ĐỘ CAO • HMA & NORDVPN")
      .setDescription(
        "🇻🇳 **TIẾNG VIỆT:**\n" +
        "Bảo vệ danh tính, fake IP vượt rào cản địa lý, tối ưu đường truyền chơi game quốc tế:\n\n" +
        "• ⚡ **Key HMA VPN (30 Ngày - Dùng 5 Thiết Bị):** `35.000 VNĐ` • `~$1.50 USD`\n" +
        "  - Key kích hoạt chính hãng, hơn 190 quốc gia và 290 địa điểm, đổi IP trong 1 giây.\n\n" +
        "• 🚀 **Tài Khoản NordVPN (30 Ngày):** `25.000 VNĐ` • `~$1.00 USD`\n" +
        "  - Tốc độ cực nhanh, mã hóa cấp quân sự, chống rò rỉ DNS/IP.\n\n" +
        "• 🌐 **Gói Trải Nghiệm Ngắn Hạn:**\n" +
        "  - **PIA VPN (4-7 Ngày - 5 Máy):** `25.000 VNĐ` • `~$1.00 USD`\n" +
        "  - **ExpressVPN (3 Ngày - 8 Máy):** `15.000 VNĐ` • `~$0.60 USD`\n\n" +
        "────────────────────────────────────────\n" +
        "🇺🇸 **ENGLISH:**\n" +
        "**High-Speed Premium VPN Licenses:**\n" +
        "• HMA VPN 30 Days (5 Devices): `35.000 VNĐ` | NordVPN 30 Days: `25.000 VNĐ`"
      )
      .setFooter({ text: "LS STUDIO • Giao dịch tự động an toàn qua Ticket" })
      .setTimestamp();
    await setupChannel(catEntertainment.id, "🛡️・vpn-bảo-mật-hma-nord", embedVPN);

    // F. KÊNH 6: #🎵・spotify-premium
    const embedSpotify = new EmbedBuilder()
      .setColor("#1DB954")
      .setTitle("🎵 TÀI KHOẢN SPOTIFY PREMIUM 3 THÁNG KHÔNG QUẢNG CÁO")
      .setDescription(
        "🇻🇳 **TIẾNG VIỆT:**\n" +
        "Thưởng thức âm nhạc đỉnh cao không giới hạn với tài khoản Spotify Premium:\n\n" +
        "• 🌟 **Gói 3 Tháng (Add Family Ổn Định):** `139.000 VNĐ` • `~$5.60 USD`\n" +
        "  - Thêm trực tiếp vào nhóm Family, bảo hành trọn vẹn suốt 90 ngày sử dụng.\n\n" +
        "• ⚡ **Gói 3 Tháng (Trial Tiết Kiệm):** `79.000 VNĐ` • `~$3.20 USD`\n" +
        "  - Dành cho tài khoản chưa từng dùng gói Premium hoặc tài khoản tạo mới.\n\n" +
        "• **Tính năng nổi bật:** Nghe nhạc không bị chèn quảng cáo, bỏ qua bài hát không giới hạn, âm thanh Lossless 320kbps cực hay, tải nhạc nghe offline.\n\n" +
        "────────────────────────────────────────\n" +
        "🇺🇸 **ENGLISH:**\n" +
        "**Spotify Premium 3 Months Account:**\n" +
        "• Family Upgrade: `139.000 VNĐ` | Trial Account: `79.000 VNĐ`\n" +
        "• Ad-free streaming, 320kbps audio quality with full warranty."
      )
      .setFooter({ text: "LS STUDIO • Giao dịch tự động an toàn qua Ticket" })
      .setTimestamp();
    await setupChannel(catEntertainment.id, "🎵・spotify-premium", embedSpotify);

    // G. KÊNH 7: #📚・zoom-meet-học-tập
    const embedStudy = new EmbedBuilder()
      .setColor("#2D8CFF")
      .setTitle("📚 BẢN QUYỀN ZOOM PRO, GOOGLE MEET & CHECK ĐẠO VĂN TURNITIN")
      .setDescription(
        "🇻🇳 **TIẾNG VIỆT:**\n" +
        "Bộ giải pháp phục vụ học tập, giảng dạy trực tuyến và nghiên cứu luận văn:\n\n" +
        "• 📹 **Zoom Pro Không Giới Hạn (1 Tháng):** `119.000 VNĐ` • `~$4.80 USD`\n" +
        "  - Bỏ hoàn toàn giới hạn 40 phút, phòng họp 100-300 người, ghi hình Cloud.\n\n" +
        "• 📞 **Google Meet Không Giới Hạn (1 Tháng):** `79.000 VNĐ` • `~$3.20 USD`\n" +
        "  - Gọi video nhóm thoải mái không lo bị ngắt quãng 60 phút.\n\n" +
        "• 📝 **Tài Khoản Turnitin Check Đạo Văn (1 Tháng):** `199.000 VNĐ` • `~$8.00 USD`\n" +
        "  - Kiểm tra tỷ lệ trùng lặp luận văn, bài báo khoa học, cam kết không lưu kho dữ liệu.\n\n" +
        "────────────────────────────────────────\n" +
        "🇺🇸 **ENGLISH:**\n" +
        "**Online Meeting & Academic Tools:**\n" +
        "• Zoom Pro (1 Month): `119.000 VNĐ` | Google Meet (1 Month): `79.000 VNĐ` | Turnitin (1 Month): `199.000 VNĐ`"
      )
      .setFooter({ text: "LS STUDIO • Giao dịch tự động an toàn qua Ticket" })
      .setTimestamp();
    await setupChannel(catEntertainment.id, "📚・zoom-meet-học-tập", embedStudy);

    // H. KÊNH 8: #📜・acc-discord-cổ
    const embedDiscordAged = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle("📜 TÀI KHOẢN DISCORD CỔ (AGED DISCORD ACCOUNTS 2016 - 2025)")
      .setDescription(
        "🇻🇳 **TIẾNG VIỆT:**\n" +
        "Tài khoản Discord năm tạo cổ siêu trâu, độ uy tín cực cao dành cho dân MMO, Airdrop & Admin:\n\n" +
        "• 🏛️ **Discord Cổ Siêu Trâu (Tạo 2016 - 2019):** `65.000 VNĐ` • `~$2.60 USD`\n" +
        "  - Acc tạo từ thời kỳ đầu của Discord, siêu hiếm, cực kỳ trâu, hạn chế tối đa checkpoint.\n\n" +
        "• 📜 **Discord Cổ Random (Tạo 2018 - 2025):** `49.000 VNĐ` • `~$2.00 USD`\n" +
        "  - Acc đã qua năm tháng, độ trust cao gấp nhiều lần acc mới tạo.\n\n" +
        "• 💬 **Acc Discord Veri Mail + SĐT (Mới):** `7.000 VNĐ` • `~$0.30 USD`\n" +
        "• **Bảo hành:** Đăng nhập thành công lần đầu 100%, 1 đổi 1 nếu lỗi credential.\n\n" +
        "────────────────────────────────────────\n" +
        "🇺🇸 **ENGLISH:**\n" +
        "**Aged Discord Accounts (2016 - 2025):**\n" +
        "• Vintage 2016-2019: `65.000 VNĐ` | Aged 2018-2025: `49.000 VNĐ` | Fresh Full Veri: `7.000 VNĐ`"
      )
      .setFooter({ text: "LS STUDIO • Giao dịch tự động an toàn qua Ticket" })
      .setTimestamp();
    await setupChannel(catEntertainment.id, "📜・acc-discord-cổ", embedDiscordAged);

    // 3. CẬP NHẬT KÊNH #💰・bảng-giá TOÀN DIỆN
    const chPrice = channels.find(c => c && c.name.includes("bảng-giá"));
    if (chPrice) {
      const pMsgs = await chPrice.messages.fetch({ limit: 10 }).catch(() => new Map());
      for (const [id, msg] of pMsgs) {
        if (msg.author.id === client.user.id) {
          await msg.delete().catch(() => {});
          await sleep(200);
        }
      }

      const priceEmbed = new EmbedBuilder()
        .setColor("#FEE75C")
        .setTitle("💰 BẢNG GIÁ DỊCH VỤ TỔNG HỢP / OFFICIAL PRICE LIST - LS STUDIO")
        .setDescription(
          "Bảng giá niêm yết chính thức minh bạch cho toàn bộ dịch vụ tại **LS STUDIO**:\n" +
          "*Official transparent pricing catalog for all products & premium services:*"
        )
        .addFields(
          {
            name: "📦 1. Plugin Minecraft (Paper / Purpur / Folia 1.16 - 1.21+)",
            value: 
              "• 🛡️ **LS-AntiCheat (Bản Gốc):** `30.000 VNĐ` • `~$1.50 USD`\n" +
              "• 🛒 **Addon Anti-Macro Cart:** `20.000 VNĐ / Tháng` • `~$1.00 USD / Mo`\n" +
              "• 🎁 **LS-GiftCode:** `30.000 VNĐ` • `~$1.50 USD`\n" +
              "• 👁️ **LS-AntiFreeCam:** `59.000 VNĐ` • `~$2.50 USD`\n" +
              "• 🚫 **LS-AntiClient:** `99.000 VNĐ` • `~$4.00 USD`\n" +
              "• 👑 **Combo 2 Plugin Anti:** `129.000 VNĐ` • `~$5.50 USD`\n" +
              "• 🧩 **Lập Trình Mod Java & Plugin Riêng:** Thỏa thuận theo yêu cầu"
          },
          {
            name: "🤖 2. Dịch Vụ AI & API Key (Cursor / Cline / Coding)",
            value: 
              "• ⚡ **API Key Claude 100M Token (3 Ngày):** `109.000 VNĐ` • `~$4.25 USD`\n" +
              "• 💻 **API Key Codex GPT-5.6 100M (3 Ngày):** `85.000 VNĐ` • `~$3.25 USD`\n" +
              "• 🌟 **Acc Gemini Family Nâng Chính Chủ (18 Tháng):** `35.000 VNĐ` • `~$1.50 USD`\n" +
              "• 🚀 **Link Kích Hoạt Gemini Pro 18M:** `49.000 VNĐ` • `~$2.00 USD`\n" +
              "• 🚀 **Acc Google AI Pro Chính Chủ (1 Tháng):** `89.000 VNĐ` • `~$3.50 USD`\n" +
              "• 👑 **Acc Claude Max 20 (1 Tháng):** `89.000 VNĐ` • `~$3.50 USD`\n" +
              "• ⭐ **Acc ChatGPT Plus (1 Tháng):** `169.000 VNĐ` • `~$6.80 USD`\n" +
              "• ✨ **Acc Monica AI Pro Model Claude (3 Ngày):** `49.000 VNĐ` • `~$2.00 USD`"
          },
          {
            name: "🎬 3. CapCut Pro Bản Quyền (Cá Nhân & Team 2TB)",
            value: 
              "• ⚡ **Cá Nhân (3 Ngày):** `14.000 VNĐ` • `~$0.60 USD`\n" +
              "• 🌟 **Cá Nhân (14 Ngày):** `39.000 VNĐ` • `~$1.60 USD`\n" +
              "• 🔥 **Cá Nhân (1 Tháng):** `75.000 VNĐ` • `~$3.00 USD`\n" +
              "• 💎 **Cá Nhân (3 Tháng):** `200.000 VNĐ` • `~$8.00 USD`\n" +
              "• 👑 **Cá Nhân (6 Tháng):** `390.000 VNĐ` • `~$15.50 USD`\n" +
              "• 👥 **Gói Team 1 Tháng (Kèm 2TB Cloud):** `100.000 VNĐ` • `~$4.00 USD`"
          },
          {
            name: "💻 4. Bản Quyền Windows, Office & Công Cụ PC",
            value: 
              "• 💻 **Key Windows 10 / 11 Pro (Vĩnh Viễn):** `35.000 VNĐ` • `~$1.50 USD`\n" +
              "• 📑 **Key Office 2021 / 2024 Pro Plus (Vĩnh Viễn):** `39.000 VNĐ` • `~$1.60 USD`\n" +
              "• ☁️ **Microsoft 365 Chính Chủ (1 Tháng):** `45.000 VNĐ` • `~$1.80 USD`\n" +
              "• ☁️ **Microsoft 365 Chính Chủ (1 Năm - 12 Tháng):** `269.000 VNĐ` • `~$10.80 USD`\n" +
              "• 🖥️ **Key VMware Workstation Pro:** `39.000 VNĐ` • `~$1.60 USD`"
          },
          {
            name: "🎨 5. Đồ Họa, VPN, Âm Nhạc & Giải Trí MMO",
            value: 
              "• 🎨 **Canva Pro / Edu (1 Năm):** `69.000 VNĐ` • `~$2.80 USD`\n" +
              "• 🖌️ **Adobe Photoshop + Lightroom (1 Tháng):** `99.000 VNĐ` • `~$4.00 USD`\n" +
              "• 💎 **Adobe Full App (Photoshop/Premiere/Ai) (1 Tháng):** `149.000 VNĐ` • `~$6.00 USD`\n" +
              "• 🛡️ **Key HMA VPN (30 Ngày - 5 Máy):** `35.000 VNĐ` • `~$1.50 USD`\n" +
              "• ⚡ **Acc NordVPN (30 Ngày):** `25.000 VNĐ` • `~$1.00 USD`\n" +
              "• 🎵 **Spotify Premium 3 Tháng (Add Family):** `139.000 VNĐ` • `~$5.60 USD`\n" +
              "• 🚀 **2 Boost Server Discord Nitro (1 Tháng):** `20.000 VNĐ` • `~$0.80 USD`\n" +
              "• 📺 **YouTube Premium (1 Tháng):** `25.000 VNĐ` • `~$1.00 USD`\n" +
              "• 🍿 **Netflix Premium Ultra HD 4K (1 Tuần):** `20.000 VNĐ` • `~$0.80 USD`\n" +
              "• 💬 **Acc Discord Veri Mail + SĐT:** `7.000 VNĐ` • `~$0.30 USD`\n" +
              "• 📜 **Acc Discord Cổ (2018-2025):** `49.000 VNĐ` | **(2016-2019):** `65.000 VNĐ`\n" +
              "• 📹 **Zoom Pro (1 Tháng):** `119.000 VNĐ` | **Google Meet:** `79.000 VNĐ` | **Turnitin:** `199.000 VNĐ`"
          },
          {
            name: "💳 6. Phương Thức Thanh Toán / Payment Methods",
            value: 
              "• 🇻🇳 **Việt Nam:** MBBank Quân Đội • STK `844515133333` • Tên **VAN HUU PHAM NGUYEN**\n" +
              "• 🌐 **Global:** PayPal / Crypto / Card (Mở Ticket để lấy link thanh toán)"
          }
        )
        .setFooter({ text: "Giao dịch an toàn 24/7 qua Ticket tại LS STUDIO" });

      await chPrice.send({ embeds: [priceEmbed], components: [makeActionButtons()] });
      console.log("✅ Đã cập nhật lại kênh #bảng-giá với toàn bộ danh mục!");
    }

    console.log("🎉 HOÀN TẤT THIẾT LẬP FULL KHO HÀNG MMO 100%!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Lỗi:", err);
    process.exit(1);
  }
});

client.login(TOKEN);
