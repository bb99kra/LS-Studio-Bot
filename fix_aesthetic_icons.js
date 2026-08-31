const fs = require('fs');
const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN || (fs.existsSync('./token.local.js') ? require('./token.local.js').TOKEN : 'YOUR_BOT_TOKEN_HERE');
const LS_STUDIO_GUILD_ID = "1542476657825419334";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.once('clientReady', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}! Đổi icon sang phong cách tối giản, sang xịn mịn...`);

  try {
    const guild = await client.guilds.fetch(LS_STUDIO_GUILD_ID);
    const channels = await guild.channels.fetch();

    const channelMap = [
      {
        oldNameSearch: "api-claude",
        newName: "⚡・api-claude-100m",
        title: "⚡ API KEY CLAUDE 100M TOKEN • FABLE 5, OPUS 5, SONNET 5",
        color: "#D97706",
        desc:
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "API Key Claude thế hệ 5 chính hãng tốc độ cao, chuyên dụng cho Agentic Coding, Cursor, Cline, Roo Code, Aider và Bot Discord:\n\n" +
          "• **Giá bán:** `4.25$` • `109.000 VNĐ`\n" +
          "• **Hạn mức:** 100 Triệu Token Claude thế hệ mới\n" +
          "• **Thời hạn:** 3 Ngày\n\n" +
          "🌟 **Hỗ trợ đầy đủ Model thế hệ 5:**\n" +
          "• **Claude Fable 5 (Mythos):** Tự động lập kế hoạch đa bước, điều phối sub-agents và tự sửa lỗi code.\n" +
          "• **Claude Opus 5 (Flagship):** Đỉnh cao suy luận logic phức tạp và xử lý bộ nhớ dài hạn.\n" +
          "• **Claude Sonnet 5:** Tốc độ phản hồi tức thì, tuân thủ chuẩn cấu trúc code nghiêm ngặt.\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "Anthropic Claude 5 API Key for Autonomous Coding, Cursor & Cline:\n\n" +
          "• **Price:** `$4.25 USD` • `109.000 VNĐ`\n" +
          "• **Quota:** 100M Tokens for Claude Fable 5, Opus 5 & Sonnet 5\n" +
          "• **Validity:** 3 Days from activation"
      },
      {
        oldNameSearch: "api-codex",
        newName: "💻・api-codex-100m",
        title: "💻 API KEY OPENAI CODEX 100M TOKEN • GPT-5.6 SOL",
        color: "#10A37F",
        desc:
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Gói API Key OpenAI Codex chuyên sâu giải thuật toán, tái cấu trúc mã nguồn và lập trình tự động:\n\n" +
          "• **Giá bán:** `3.25$` • `85.000 VNĐ`\n" +
          "• **Hạn mức:** 100 Triệu Token OpenAI Codex\n" +
          "• **Thời hạn:** 3 Ngày\n\n" +
          "⚡ **Đặc điểm nổi bật:**\n" +
          "• Tích hợp sức mạnh của **GPT-5.6 Sol (Flagship)** và **GPT-5.6 Terra**.\n" +
          "• Tối ưu hóa sâu cho Codex CLI, VS Code Extension và Agent lập trình đám mây.\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "OpenAI Codex API Key powered by **GPT-5.6 Sol** reasoning engine:\n\n" +
          "• **Price:** `$3.25 USD` • `85.000 VNĐ`\n" +
          "• **Quota:** 100M Tokens for Codex & GPT-5.6\n" +
          "• **Validity:** 3 Days from activation"
      },
      {
        oldNameSearch: "acc-claude",
        newName: "👑・acc-claude-max20",
        title: "👑 TÀI KHOẢN CLAUDE MAX 20 • 1 THÁNG",
        color: "#9333EA",
        desc:
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Tài khoản Claude bản quyền hạn mức cao Max 20, truy cập đầy đủ dàn model thế hệ 5:\n\n" +
          "• **Giá bán:** `89.000 VNĐ` • `~$3.50 USD`\n" +
          "• **Thời hạn:** 30 Ngày\n\n" +
          "✨ **Quyền lợi tài khoản:**\n" +
          "• Sử dụng thoải mái **Claude Sonnet 5**, **Claude Opus 5** và **Claude Fable 5** với quota tin nhắn cực cao.\n" +
          "• Đọc file dung lượng lớn, hỗ trợ viết code và phân tích dữ liệu chuyên nghiệp.\n" +
          "• Bảo hành 1 đổi 1 suốt 30 ngày.\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "Official Claude Max 20 Account with full Claude 5 access:\n\n" +
          "• **Price:** `89.000 VNĐ` • `~$3.50 USD`\n" +
          "• **Duration:** 30 Days\n" +
          "• High message limits for Claude Sonnet 5, Opus 5, and Fable 5."
      },
      {
        oldNameSearch: "acc-chatgpt-plus",
        newName: "⭐・acc-chatgpt-plus",
        title: "⭐ TÀI KHOẢN CHATGPT PLUS • 1 THÁNG",
        color: "#16A34A",
        desc:
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Tài khoản ChatGPT Plus chính chủ với model đầu bảng **GPT-5.6 (Sol)** từ OpenAI:\n\n" +
          "• **Giá bán:** `169.000 VNĐ` • `~$6.80 USD`\n" +
          "• **Thời hạn:** 30 Ngày\n\n" +
          "🌟 **Tính năng bao gồm:**\n" +
          "• Truy cập model **GPT-5.6 Sol** suy luận logic đỉnh cao cho code và nghiên cứu.\n" +
          "• Tạo ảnh DALL-E 3, Voice Chat giọng nói tự nhiên, không gian Canvas 2.0.\n" +
          "• Bảo hành đổi mới trong suốt 1 tháng.\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "Official ChatGPT Plus Account with **GPT-5.6 Sol**:\n\n" +
          "• **Price:** `169.000 VNĐ` • `~$6.80 USD`\n" +
          "• **Duration:** 30 Days\n" +
          "• Full GPT-5.6 Sol access, DALL-E 3, Voice Chat, and Canvas 2.0."
      },
      {
        oldNameSearch: "acc-monica",
        newName: "✨・acc-monica-pro",
        title: "✨ TÀI KHOẢN MONICA AI PRO • CLAUDE 5 & GPT-5.6",
        color: "#A855F7",
        desc:
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Tài khoản Monica AI Pro tích hợp sẵn **Claude Sonnet 5**, **Claude Opus 5**, **GPT-5.6 Sol** và **Gemini 2.5 Pro**:\n\n" +
          "• **Giá bán:** `49.000 VNĐ` • `~$2.00 USD`\n" +
          "• **Thời hạn:** 3 Ngày\n\n" +
          "💡 **Tính năng nổi bật:**\n" +
          "• Chuyển đổi linh hoạt giữa Claude 5 và GPT-5.6 Sol chỉ với 1 cú click.\n" +
          "• Extension duyệt web, tóm tắt video và hỗ trợ lập trình tiện lợi.\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "Monica AI Pro Account with Claude 5 & GPT-5.6 Sol:\n\n" +
          "• **Price:** `49.000 VNĐ` • `~$2.00 USD`\n" +
          "• **Duration:** 3 Days\n" +
          "• Access Claude Sonnet 5, Opus 5, GPT-5.6 Sol & Gemini 2.5 Pro in one workspace."
      },
      {
        oldNameSearch: "acc-chatgpt-offer",
        newName: "🎁・acc-chatgpt-offer",
        title: "🎁 TÀI KHOẢN CHATGPT NEW GMAIL • NHẬN OFFER GPT-5.6",
        color: "#6B7280",
        desc:
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Tài khoản Gmail mới tinh chưa từng đăng ký OpenAI, dùng để tự nhận các gói ưu đãi dùng thử GPT-5.6 Sol:\n\n" +
          "• **Giá bán:** `5.000 VNĐ` • `~$0.20 USD`\n" +
          "• ⚠️ **Lưu ý quan trọng:** Khách hàng cần chuẩn bị sẵn thẻ thanh toán PayPal để tự kích hoạt gói Offer của OpenAI.\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "Fresh Gmail account for activating ChatGPT GPT-5.6 Trial & Offer promotions:\n\n" +
          "• **Price:** `5.000 VNĐ` • `~$0.20 USD`\n" +
          "• ⚠️ **Notice:** A valid PayPal payment card is required on your end."
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

    for (const item of channelMap) {
      let ch = channels.find(c => c && c.name.includes(item.oldNameSearch));
      if (ch) {
        if (ch.name !== item.newName) {
          await ch.setName(item.newName);
          console.log(`🔄 Đã đổi tên kênh: #${ch.name} -> #${item.newName}`);
        }

        const msgs = await ch.messages.fetch({ limit: 10 });
        for (const [mId, msg] of msgs) {
          if (msg.author.id === client.user.id) await msg.delete().catch(() => {});
        }

        const embed = new EmbedBuilder()
          .setColor(item.color)
          .setTitle(item.title)
          .setDescription(item.desc)
          .setFooter({ text: "LS STUDIO • Hỗ trợ bảo hành uy tín / Full Warranty Support" });

        await ch.send({ embeds: [embed], components: [makeActionButtons()] });
        console.log(`✅ Đã cập nhật embed kênh: #${item.newName}`);
      }
    }

    console.log("🎉 ĐÃ HOÀN TẤT ĐỔI SANG ICON XỊN SÒ 100%!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Lỗi:", err);
    process.exit(1);
  }
});

client.login(TOKEN);
