const fs = require('fs');
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

const TOKEN = process.env.DISCORD_TOKEN || (fs.existsSync('./token.local.js') ? require('./token.local.js').TOKEN : 'YOUR_BOT_TOKEN_HERE');
const LS_STUDIO_GUILD_ID = "1542476657825419334";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.once('clientReady', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}! Đang chia riêng từng kênh cho từng dịch vụ AI...`);

  try {
    const guild = await client.guilds.fetch(LS_STUDIO_GUILD_ID);
    const channels = await guild.channels.fetch();

    // 1. TÌM CATEGORY: 🤖 ━━━ DỊCH VỤ AI & API KEY ━━━
    let catAI = channels.find(c => c && c.type === ChannelType.GuildCategory && c.name.includes("DỊCH VỤ AI"));
    if (!catAI) {
      catAI = await guild.channels.create({
        name: "🤖 ━━━ DỊCH VỤ AI & API KEY ━━━",
        type: ChannelType.GuildCategory
      });
    }

    // Xóa 2 kênh gộp cũ
    const oldCh1 = channels.find(c => c && c.name === "🔑・api-key-ai");
    const oldCh2 = channels.find(c => c && c.name === "💎・tai-khoan-ai-premium");
    if (oldCh1) await oldCh1.delete().catch(() => {});
    if (oldCh2) await oldCh2.delete().catch(() => {});

    // Danh sách 6 kênh sản phẩm AI riêng biệt
    const aiProductsConfig = [
      {
        name: "🧠・api-claude-100m",
        title: "🧠 API KEY CLAUDE 100M TOKEN • 3 NGÀY",
        color: "#D97706",
        desc:
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "API Key Claude chính hãng tốc độ cao, hỗ trợ hoàn hảo cho Cursor, Cline, Roo Code, VS Code và Bot Discord.\n\n" +
          "• **Giá bán:** `4.25$` • `109.000 VNĐ`\n" +
          "• **Hạn mức sử dụng:** 100 Triệu Token Claude 3.5 Sonnet và Opus\n" +
          "• **Thời hạn:** 3 Ngày kể từ khi kích hoạt\n\n" +
          "⚡ **Đặc điểm nổi bật:**\n" +
          "• Tốc độ phản hồi tức thì, không bị bóp băng thông hay delay.\n" +
          "• Phù hợp cho lập trình viên cần hoàn thiện dự án code nhanh trong vài ngày.\n" +
          "• Bảo hành Key sống đúng thời hạn cam kết.\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "High-speed Official Claude API Key for Cursor, Cline, Roo Code, VS Code & Bots:\n\n" +
          "• **Price:** `$4.25 USD` • `109.000 VNĐ`\n" +
          "• **Quota:** 100M Tokens for Claude 3.5 Sonnet and Opus models\n" +
          "• **Validity:** 3 Days from activation\n" +
          "• Instant response times, zero throttling, full warranty support."
      },
      {
        name: "⚡・api-codex-100m",
        title: "⚡ API KEY OPENAI CODEX 100M TOKEN • 3 NGÀY",
        color: "#10A37F",
        desc:
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Gói API Key OpenAI Codex chuyên sâu về phân tích logic, refactor code và giải thuật toán.\n\n" +
          "• **Giá bán:** `3.25$` • `85.000 VNĐ`\n" +
          "• **Hạn mức sử dụng:** 100 Triệu Token OpenAI Codex\n" +
          "• **Thời hạn:** 3 Ngày kể từ khi kích hoạt\n\n" +
          "⚡ **Đặc điểm nổi bật:**\n" +
          "• Chuyên phục vụ tác vụ sinh code, debug logic và tự động hóa hệ thống.\n" +
          "• Kết nối mượt mà với mọi IDE và Plugin mở rộng.\n" +
          "• Bảo hành Key 1-1 trong suốt thời gian sử dụng.\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "OpenAI Codex API Key specialized for code generation, logic analysis, and debugging:\n\n" +
          "• **Price:** `$3.25 USD` • `85.000 VNĐ`\n" +
          "• **Quota:** 100M Tokens Codex model\n" +
          "• **Validity:** 3 Days from activation\n" +
          "• Seamless connection to all IDEs and tools."
      },
      {
        name: "🔮・acc-claude-max20",
        title: "🔮 TÀI KHOẢN CLAUDE MAX 20 • 1 THÁNG",
        color: "#9333EA",
        desc:
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Tài khoản Claude bản quyền hạn mức cao Max 20, truy cập đầy đủ trí tuệ nhân tạo hàng đầu thế giới.\n\n" +
          "• **Giá bán:** `89.000 VNĐ` • `~$3.50 USD`\n" +
          "• **Thời hạn:** 30 Ngày\n\n" +
          "✨ **Quyền lợi tài khoản:**\n" +
          "• Sử dụng model Claude 3.5 Sonnet đỉnh cao không lo giới hạn tin nhắn thấp.\n" +
          "• Khả năng đọc file tài liệu, viết code và phân tích dữ liệu chuyên nghiệp.\n" +
          "• Hỗ trợ đăng nhập dễ dàng, bảo hành toàn bộ thời gian sử dụng.\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "Official Claude Account with high quota Max 20 tier:\n\n" +
          "• **Price:** `89.000 VNĐ` • `~$3.50 USD`\n" +
          "• **Duration:** 30 Days\n" +
          "• High messaging limits for Claude 3.5 Sonnet, document reading, and advanced coding."
      },
      {
        name: "🟢・acc-chatgpt-plus",
        title: "🟢 TÀI KHOẢN CHATGPT PLUS • 1 THÁNG",
        color: "#16A34A",
        desc:
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Tài khoản ChatGPT Plus chính chủ với trọn bộ công nghệ tiên tiến nhất từ OpenAI.\n\n" +
          "• **Giá bán:** `169.000 VNĐ` • `~$6.80 USD`\n" +
          "• **Thời hạn:** 30 Ngày\n\n" +
          "🌟 **Tính năng bao gồm:**\n" +
          "• Trải nghiệm GPT-4o tốc độ cao, nhận diện hình ảnh và trò chuyện giọng nói Voice Chat tự nhiên.\n" +
          "• Trình vẽ tranh DALL-E 3 độ phân giải cao theo mọi mô tả.\n" +
          "• Tính năng Canvas viết tài liệu và phân tích file số liệu nâng cao.\n" +
          "• Bảo hành đổi mới nếu phát sinh lỗi.\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "Official ChatGPT Plus Account with full premium feature suite:\n\n" +
          "• **Price:** `169.000 VNĐ` • `~$6.80 USD`\n" +
          "• **Duration:** 30 Days\n" +
          "• Full GPT-4o access, DALL-E 3 Image Generation, Voice Chat, Canvas and Advanced Data Analysis."
      },
      {
        name: "🟣・acc-monica-pro",
        title: "🟣 TÀI KHOẢN MONICA AI PRO CÓ MODEL CLAUDE • 3 NGÀY",
        color: "#A855F7",
        desc:
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Tài khoản Monica AI Pro tích hợp sẵn Claude 3.5 Sonnet, GPT-4o và Gemini 1.5 Pro trong cùng một giao diện.\n\n" +
          "• **Giá bán:** `49.000 VNĐ` • `~$2.00 USD`\n" +
          "• **Thời hạn:** 3 Ngày\n\n" +
          "💡 **Tính năng nổi bật:**\n" +
          "• Chuyển đổi linh hoạt giữa Claude 3.5 Sonnet, GPT-4o và Gemini Pro chỉ với 1 cú click.\n" +
          "• Tích hợp tiện ích mở rộng trên trình duyệt web cực kỳ tiện lợi khi làm việc và học tập.\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "Monica AI Pro Account featuring Claude 3.5 Sonnet & GPT-4o Models:\n\n" +
          "• **Price:** `49.000 VNĐ` • `~$2.00 USD`\n" +
          "• **Duration:** 3 Days\n" +
          "• Instant access to Claude 3.5 Sonnet, GPT-4o, and Gemini 1.5 Pro in a unified workspace."
      },
      {
        name: "📧・acc-chatgpt-offer",
        title: "📧 TÀI KHOẢN CHATGPT NEW GMAIL • NHẬN OFFER",
        color: "#6B7280",
        desc:
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Tài khoản Gmail mới tinh chưa từng đăng ký OpenAI, dùng để tự nhận các gói ưu đãi Offer hoặc Trial.\n\n" +
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
              deny: [PermissionsBitField.Flags.SendMessages]
            }
          ]
        });
        console.log(`✅ Đã tạo kênh: #${ch.name}`);
      }

      // Xóa tin nhắn cũ của bot
      const msgs = await ch.messages.fetch({ limit: 10 });
      for (const [mId, msg] of msgs) {
        if (msg.author.id === client.user.id) await msg.delete().catch(() => {});
      }

      const embed = new EmbedBuilder()
        .setColor(p.color)
        .setTitle(p.title)
        .setDescription(p.desc)
        .setFooter({ text: "LS STUDIO • Hỗ trợ bảo hành uy tín / Full Warranty Support" });

      await ch.send({ embeds: [embed], components: [makeActionButtons()] });
      console.log(`   + Đã đăng bài vào: #${ch.name}`);
    }

    console.log("🎉 ĐÃ CHIA XONG TẤT CẢ 6 KÊNH RIÊNG BIỆT CHO DỊCH VỤ AI 100%!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Lỗi:", err);
    process.exit(1);
  }
});

client.login(TOKEN);
