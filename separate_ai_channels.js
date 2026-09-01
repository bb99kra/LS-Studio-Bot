const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { 
  Client, 
  Events,
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
const TOKEN = process.env.DISCORD_TOKEN || localConfig.TOKEN || localConfig.DISCORD_TOKEN || '';
const LS_STUDIO_GUILD_ID = process.env.GUILD_ID || (typeof localConfig !== "undefined" && localConfig.GUILD_ID) || "1542476657825419334";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// Helper: Pacing delay to prevent Discord 429 Rate Limits
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Watchdog timeout to prevent script hanging indefinitely
const WATCHDOG_TIMEOUT_MS = 60000;
const watchdog = setTimeout(async () => {
  console.error(`⏱️ [WATCHDOG] Quá thời gian thực thi (${WATCHDOG_TIMEOUT_MS / 1000}s). Tự động hủy kết nối Discord và dừng tiến trình.`);
  try { await client.destroy(); } catch {}
  process.exit(1);
}, WATCHDOG_TIMEOUT_MS);
if (watchdog.unref) watchdog.unref();

client.on(Events.Error, (err) => {
  console.error('❌ Lỗi Discord Client:', err.message || err);
});

let isExiting = false;
async function cleanupAndExit(code = 0) {
  if (isExiting) return;
  isExiting = true;
  clearTimeout(watchdog);
  try { await client.destroy(); } catch {}
  process.exit(code);
}

process.on('SIGINT', async () => {
  console.log('🛑 [SIGINT] Đang dừng tiến trình...');
  await cleanupAndExit(0);
});
process.on('SIGTERM', async () => {
  console.log('🛑 [SIGTERM] Đang dừng tiến trình...');
  await cleanupAndExit(0);
});
process.on('SIGHUP', async () => {
  console.log('🛑 [SIGHUP] Đang dừng tiến trình...');
  await cleanupAndExit(0);
});

process.on('unhandledRejection', async (reason) => {
  console.error('❌ Lỗi không kiểm soát (Unhandled Rejection):', reason);
  await cleanupAndExit(1);
});

process.on('uncaughtException', async (err) => {
  console.error('❌ Lỗi ngoại lệ chưa bắt (Uncaught Exception):', err);
  await cleanupAndExit(1);
});

client.once(Events.ClientReady, async () => {
  console.log(`🤖 Logged in as ${client.user.tag}! Đang chia riêng từng kênh cho từng dịch vụ AI...`);

  try {
    const guild = await client.guilds.fetch(LS_STUDIO_GUILD_ID).catch(err => {
      console.error(`❌ [ERROR] Không thể fetch Guild (${LS_STUDIO_GUILD_ID}):`, err.message || err);
      return null;
    });
    if (!guild) {
      console.error(`❌ [ERROR] Không tìm thấy Guild (${LS_STUDIO_GUILD_ID}) hoặc Bot chưa tham gia.`);
      return await cleanupAndExit(1);
    }
    const channels = await guild.channels.fetch();

    // 1. TÌM CATEGORY: 🤖 ━━━ DỊCH VỤ AI & API KEY ━━━
    let catAI = channels.find(c => c && c.type === ChannelType.GuildCategory && c.name.includes("DỊCH VỤ AI"));
    if (!catAI) {
      catAI = await guild.channels.create({
        name: "🤖 ━━━ DỊCH VỤ AI & API KEY ━━━",
        type: ChannelType.GuildCategory
      });
    }

    // Xóa 2 kênh gộp cũ nếu còn
    const oldCh1 = channels.find(c => c && c.name === "🔑・api-key-ai");
    const oldCh2 = channels.find(c => c && c.name === "💎・tai-khoan-ai-premium");
    if (oldCh1) await oldCh1.delete().catch(() => {});
    if (oldCh2) await oldCh2.delete().catch(() => {});

    // Danh sách 7 kênh sản phẩm AI riêng biệt
    const aiProductsConfig = [
      {
        name: "🚀・acc-google-ai-pro",
        title: "🚀 TÀI KHOẢN & GÓI NÂNG CẤP GOOGLE AI PRO • GEMINI FAMILY 18 THÁNG",
        color: "#4285F4",
        desc:
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Cung cấp các gói tài khoản, link kích hoạt và gói nâng cấp Google AI Pro (Gemini Advanced) chính hãng với mức giá siêu ưu đãi:\n\n" +
          "• **1. Gói Nâng Cấp Gemini Family Chính Chủ (18 Tháng):**\n" +
          "  - **Giá bán:** `35.000 VNĐ` • `~$1.50 USD`\n" +
          "  - **Hình thức:** Nâng trực tiếp trên Gmail chính chủ của bạn qua nhóm Google Family.\n" +
          "  - **Thời hạn:** 18 Tháng sử dụng Gemini Advanced + 2TB Google One Cloud dung lượng cao.\n" +
          "  - **Bảo hành:** Kích hoạt thành công 100% & hỗ trợ trọn gói suốt quá trình sử dụng.\n\n" +
          "• **2. Link Kích Hoạt Gemini Pro 18M:**\n" +
          "  - **Giá bán:** `49.000 VNĐ` • `~$2.00 USD`\n" +
          "  - Nhận link nâng cấp trực tiếp vào tài khoản Google cá nhân.\n" +
          "  - **Bảo hành:** Kích hoạt thành công lần đầu 100%.\n\n" +
          "• **3. Tài Khoản Google AI Pro Chính Chủ (Gói 1 Tháng):**\n" +
          "  - **Giá bán:** `89.000 VNĐ` • `~$3.50 USD`\n" +
          "  - Tài khoản chính chủ, kèm Google One AI Premium và Gemini Advanced 2M Context.\n" +
          "  - **Bảo hành:** Đăng nhập thành công lần đầu 100%.\n\n" +
          "🌟 **Tính năng nổi bật:**\n" +
          "• Bộ nhớ ngữ cảnh siêu khủng lên đến **2 Triệu Token** đọc hiểu codebase và tài liệu lớn.\n" +
          "• Tích hợp trực tiếp vào Google Docs, Gmail, Sheets, Slides hỗ trợ làm việc tự động.\n" +
          "• Tạo ảnh siêu thực độ phân giải cao với Imagen 3.\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "Official Google AI Pro & Gemini Family Upgrades with Full Warranty:\n\n" +
          "• **1. Gemini Family Upgrade on Main Account (18 Months):** `35.000 VNĐ` • `~$1.50 USD`\n" +
          "  - Direct 18-month upgrade on your personal Gmail with Gemini Advanced & 2TB Cloud.\n\n" +
          "• **2. Gemini Pro 18M Activation Link:** `49.000 VNĐ` • `~$2.00 USD`\n" +
          "  - Direct upgrade link for personal Google account. Guaranteed first-time activation.\n\n" +
          "• **3. Official Google AI Pro Account (1 Month):** `89.000 VNĐ` • `~$3.50 USD`\n" +
          "  - Dedicated account with Gemini Advanced 2M Context & Google One AI Premium."
      },
      {
        name: "🧠・api-claude-100m",
        title: "🧠 API KEY CLAUDE 100M TOKEN • FABLE 5, OPUS 5, SONNET 5 (3 NGÀY)",
        color: "#D97706",
        desc:
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Gói API Key Claude thế hệ 5 mới nhất từ Anthropic, hỗ trợ đầy đủ các model đỉnh cao chuyên dụng cho lập trình tự động (Agentic Coding), Cursor, Cline, Roo Code, Aider và Bot Discord:\n\n" +
          "• **Giá bán:** `109.000 VNĐ` • `~$4.25 USD`\n" +
          "• **Hạn mức:** 100 Triệu Token Claude thế hệ mới\n" +
          "• **Thời hạn:** 3 Ngày kể từ khi kích hoạt\n\n" +
          "🌟 **Hỗ trợ trọn bộ Model mới nhất:**\n" +
          "• **Claude Fable 5 (Mythos-Class):** Model cao cấp chuyên tự động lập kế hoạch, điều phối sub-agents và tự sửa lỗi code đa tác vụ.\n" +
          "• **Claude Opus 5 (Flagship Reasoning):** Đỉnh cao suy luận logic phức tạp và xử lý bộ nhớ dài hạn với chi phí token tối ưu.\n" +
          "• **Claude Sonnet 5 (Workhorse):** Tốc độ phản hồi tức thì, tuân thủ cấu trúc code nghiêm ngặt, không bị đứng giữa chừng.\n" +
          "• Tốc độ cao, không nghẽn rate limit, bảo hành Key trọn thời gian dùng.\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "Latest Anthropic Claude 5 Generation API Key for Autonomous Agentic Coding, Cursor, Cline, Roo Code & AI Agents:\n\n" +
          "• **Price:** `$4.25 USD` • `109.000 VNĐ`\n" +
          "• **Quota:** 100M Tokens across all Claude 5 models\n" +
          "• **Validity:** 3 Days from activation\n\n" +
          "🌟 **Supported Models:**\n" +
          "• **Claude Fable 5 (Mythos-Class):** Autonomous knowledge work, sub-agent delegation, and multi-step verification.\n" +
          "• **Claude Opus 5 (Flagship):** Advanced logical reasoning, agentic coding, and long-term memory management.\n" +
          "• **Claude Sonnet 5:** Lightning-fast workhorse model for production-grade coding tasks."
      },
      {
        name: "⚡・api-codex-100m",
        title: "⚡ API KEY OPENAI CODEX 100M TOKEN • GPT-5.6 SOL (3 NGÀY)",
        color: "#10A37F",
        desc:
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Gói API Key OpenAI Codex nâng cấp chạy trên nền tảng **GPT-5.6 Sol**, chuyên trị các dự án phần mềm quy mô lớn, tái cấu trúc mã nguồn và giải thuật toán phức tạp:\n\n" +
          "• **Giá bán:** `85.000 VNĐ` • `~$3.25 USD`\n" +
          "• **Hạn mức:** 100 Triệu Token OpenAI Codex\n" +
          "• **Thời hạn:** 3 Ngày kể từ khi kích hoạt\n\n" +
          "⚡ **Đặc điểm nổi bật:**\n" +
          "• Tích hợp sức mạnh của **GPT-5.6 Sol (Flagship)** và **GPT-5.6 Terra**.\n" +
          "• Tối ưu hóa sâu cho Codex CLI, VS Code Extension và các Agent lập trình đám mây.\n" +
          "• Bảo hành Key sống 100% trong 3 ngày.\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "OpenAI Codex API Key powered by the **GPT-5.6 Sol** flagship reasoning engine:\n\n" +
          "• **Price:** `$3.25 USD` • `85.000 VNĐ`\n" +
          "• **Quota:** 100M Tokens for Codex / GPT-5.6 ecosystem\n" +
          "• **Validity:** 3 Days from activation\n" +
          "• Optimized for Codex CLI, IDE extensions, and cloud coding workflows."
      },
      {
        name: "🔮・acc-claude-max20",
        title: "🔮 TÀI KHOẢN CLAUDE MAX 20 • FABLE 5, OPUS 5 & SONNET 5 (1 THÁNG)",
        color: "#9333EA",
        desc:
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Tài khoản Claude bản quyền hạn mức cao Max 20, truy cập đầy đủ toàn bộ dàn model thế hệ 5 mới nhất của Anthropic:\n\n" +
          "• **Giá bán:** `89.000 VNĐ` • `~$3.50 USD`\n" +
          "• **Thời hạn:** 30 Ngày\n\n" +
          "✨ **Quyền lợi tài khoản:**\n" +
          "• Sử dụng thả ga **Claude Sonnet 5**, **Claude Opus 5** và **Claude Fable 5** với quota tin nhắn cực cao.\n" +
          "• Xử lý tài liệu dung lượng lớn, đọc hiểu dự án code toàn diện và làm việc liên tục cả tháng.\n" +
          "• Hỗ trợ đăng nhập nhanh chóng, bảo hành 1 đổi 1 suốt 30 ngày.\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "Official Claude Max 20 Account with full access to Claude 5 Series:\n\n" +
          "• **Price:** `89.000 VNĐ` • `~$3.50 USD`\n" +
          "• **Duration:** 30 Days\n" +
          "• High message limits for Claude Sonnet 5, Opus 5, and Fable 5. 30-day warranty."
      },
      {
        name: "🟢・acc-chatgpt-plus",
        title: "🟢 TÀI KHOẢN CHATGPT PLUS • GPT-5.6 SOL (1 THÁNG)",
        color: "#16A34A",
        desc:
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Tài khoản ChatGPT Plus chính chủ với model đầu bảng **GPT-5.6 (Sol)** mới nhất từ OpenAI:\n\n" +
          "• **Giá bán:** `169.000 VNĐ` • `~$6.80 USD`\n" +
          "• **Thời hạn:** 30 Ngày\n\n" +
          "🌟 **Tính năng bao gồm:**\n" +
          "• Truy cập không giới hạn model **GPT-5.6 Sol** suy luận logic đỉnh cao cho code, nghiên cứu và phân tích số liệu.\n" +
          "• Tạo ảnh chân thực với DALL-E 3, trò chuyện âm thanh Voice Chat thời gian thực mượt mà.\n" +
          "• Không gian làm việc Canvas 2.0 và phân tích file dữ liệu chuyên sâu.\n" +
          "• Bảo hành đổi mới nếu gặp lỗi trong suốt 1 tháng.\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "Official ChatGPT Plus Account featuring the new **GPT-5.6 Sol** flagship reasoning model:\n\n" +
          "• **Price:** `169.000 VNĐ` • `~$6.80 USD`\n" +
          "• **Duration:** 30 Days\n" +
          "• Full access to GPT-5.6 Sol, Next-Gen Image Generation, Real-Time Voice Chat, and Canvas 2.0."
      },
      {
        name: "🟣・acc-monica-pro",
        title: "🟣 TÀI KHOẢN MONICA AI PRO • CLAUDE 5 & GPT-5.6 (3 NGÀY)",
        color: "#A855F7",
        desc:
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Tài khoản Monica AI Pro tích hợp sẵn tất cả các model tân tiến nhất: **Claude Sonnet 5**, **Claude Opus 5**, **GPT-5.6 Sol** và **Gemini 2.5 Pro**:\n\n" +
          "• **Giá bán:** `49.000 VNĐ` • `~$2.00 USD`\n" +
          "• **Thời hạn:** 3 Ngày\n\n" +
          "💡 **Tính năng nổi bật:**\n" +
          "• Đổi qua lại giữa Claude 5 và GPT-5.6 Sol cực kỳ mượt mà chỉ bằng 1 nút bấm.\n" +
          "• Extension hỗ trợ duyệt web, tóm tắt video YouTube và viết code tiện lợi.\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "Monica AI Pro Account with Claude 5 & GPT-5.6 Sol Models:\n\n" +
          "• **Price:** `49.000 VNĐ` • `~$2.00 USD`\n" +
          "• **Duration:** 3 Days\n" +
          "• All-in-one access to Claude Sonnet 5, Opus 5, GPT-5.6 Sol, and Gemini 2.5 Pro."
      },
      {
        name: "📧・acc-chatgpt-offer",
        title: "📧 TÀI KHOẢN CHATGPT NEW GMAIL • NHẬN OFFER GPT-5.6",
        color: "#6B7280",
        desc:
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Tài khoản Gmail mới tinh chưa từng đăng ký OpenAI, dùng để tự nhận các gói ưu đãi Offer hoặc Trial GPT-5.6:\n\n" +
          "• **Giá bán:** `5.000 VNĐ` • `~$0.20 USD`\n" +
          "• ⚠️ **Lưu ý quan trọng:** Khách hàng cần chuẩn bị sẵn thẻ thanh toán PayPal để tự kích hoạt gói Offer của OpenAI.\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "Fresh & clean Gmail account dedicated for activating ChatGPT Offer / Trial promotions:\n\n" +
          "• **Price:** `5.000 VNĐ` • `~$0.20 USD`\n" +
          "• ⚠️ **Notice:** A valid PayPal payment card is required on your end to activate the trial promotion."
      }
    ];

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

    // Tạo từng kênh và đăng bài viết
    for (const p of aiProductsConfig) {
      let ch = channels.find(c => c && c.name === p.name);
      if (!ch) {
        ch = await guild.channels.create({
          name: p.name,
          type: ChannelType.GuildText,
          parent: catAI.id,
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
              deny: [
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.CreatePublicThreads,
                PermissionsBitField.Flags.CreatePrivateThreads,
                PermissionsBitField.Flags.SendMessagesInThreads
              ]
            }
          ]
        });
        console.log(`✅ Đã tạo kênh: #${ch.name}`);
        await sleep(350);
      }

      // Xóa tin nhắn cũ của bot
      const msgs = await ch.messages.fetch({ limit: 10 });
      for (const [mId, msg] of msgs) {
        if (msg.author.id === client.user.id) {
          await msg.delete().catch(() => {});
          await sleep(250);
        }
      }

      const embed = new EmbedBuilder()
        .setColor(p.color)
        .setTitle(p.title)
        .setDescription(p.desc)
        .setFooter({ text: "LS STUDIO • Hỗ trợ bảo hành uy tín / Full Warranty Support" });

      await ch.send({ embeds: [embed], components: [makeActionButtons()] });
      console.log(`   + Đã đăng bài vào: #${ch.name}`);
      await sleep(350);
    }

    console.log("🎉 ĐÃ CHIA XONG TẤT CẢ 7 KÊNH RIÊNG BIỆT CHO DỊCH VỤ AI 100%!");
    await cleanupAndExit(0);
  } catch (err) {
    console.error("❌ Lỗi:", err.message || err);
    await cleanupAndExit(1);
  }
});

if (!TOKEN || TOKEN === 'YOUR_BOT_TOKEN_HERE' || TOKEN.trim() === '') {
  console.error('❌ Lỗi: DISCORD_TOKEN chưa được thiết lập trong .env hoặc token.local.js!');
  process.exit(1);
}

client.login(TOKEN).catch(async (err) => {
  console.error('❌ Đăng nhập Discord thất bại:', err.message || err);
  await cleanupAndExit(1);
});
