const fs = require('fs');
const { 
  Client, 
  GatewayIntentBits, 
  PermissionsBitField, 
  ChannelType, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  StringSelectMenuBuilder, 
  StringSelectMenuOptionBuilder, 
  ActivityType, 
  REST, 
  Routes, 
  SlashCommandBuilder 
} = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN || (fs.existsSync('./token.local.js') ? require('./token.local.js').TOKEN : 'YOUR_BOT_TOKEN_HERE');
const GUILD_ID = "1542476657825419334";

// CẤU HÌNH NGÂN HÀNG MBBANK
const BANK_CONFIG = {
  BANK_ID: "MB",
  ACCOUNT_NO: "844515133333",
  ACCOUNT_NAME: "VAN HUU PHAM NGUYEN"
};

// DANH SÁCH GÓI SẢN PHẨM & DỊCH VỤ (BILINGUAL CONFIG: MINECRAFT + AI SERVICES)
const PACKAGES = {
  // 1. MINECRAFT PLUGINS & MODS
  "ls_anticheat": {
    name_vi: "LS-AntiCheat • WallHit, Inventory A-F, PvP, FakeInfo",
    name_en: "LS-AntiCheat • WallHit, Inv Checks, Combat & Spoof",
    price_vnd: 30000,
    price_usd: 1.5,
    desc_vi: "WallHit xuyên mạng nhện/tường, InvMove/Stats click, AutoEat/Fish/Potion/Shield, Fake Máu",
    desc_en: "Anti-WallHit through cobwebs/walls, Inventory checks, AutoEat/Potion, Health spoof"
  },
  "addon_macro_cart": {
    name_vi: "Addon Anti-Macro Cart • Chống Macro Xe Mỏ & Thuyền (20k/Tháng)",
    name_en: "Anti-Macro Cart Addon • Minecart & Boat Exploit Protection ($1.00/Mo)",
    price_vnd: 20000,
    price_usd: 1.0,
    desc_vi: "Chặn đứng hack/macro lợi dụng Minecart và Thuyền (Boat) di chuyển tốc độ bất thường",
    desc_en: "Blocks Minecart and Boat macro speed exploits across terrains"
  },
  "anti_freecam": {
    name_vi: "LS-AntiFreeCam & Obfuscator • Chống Freecam và X-Ray",
    name_en: "LS-AntiFreeCam & Obfuscator • Anti Freecam & X-Ray",
    price_vnd: 59000,
    price_usd: 2.5,
    desc_vi: "Khắc chế Freecam Mod, Baritone đào tự động, Chest ESP, X-Ray",
    desc_en: "Blocks Freecam Mod, Baritone auto-mining, Chest ESP, X-Ray"
  },
  "anti_client": {
    name_vi: "LS-AntiClient & BrandShield • Chặn Hacked Client",
    name_en: "LS-AntiClient & BrandShield • Client Brand Blocker",
    price_vnd: 99000,
    price_usd: 4.0,
    desc_vi: "Chặn Meteor, LiquidBounce, Aristois, Fabric Cheats",
    desc_en: "Blocks Meteor, LiquidBounce, Aristois, Fabric Cheats"
  },
  "ls_giftcode": {
    name_vi: "LS-GiftCode & Rewards • Hệ Thống Mã Quà Tặng",
    name_en: "LS-GiftCode & Rewards • Gift Code Reward System",
    price_vnd: 30000,
    price_usd: 1.5,
    desc_vi: "Tạo Giftcode tân thủ, sự kiện, giới hạn lượt nhập, lưu async",
    desc_en: "Custom gift codes, player claim limits, expiry timers, async DB"
  },
  "combo_suite": {
    name_vi: "Combo 2 Plugin Anti • AntiFreeCam + AntiClient",
    name_en: "Combo 2 Anti Plugins • AntiFreeCam + AntiClient",
    price_vnd: 129000,
    price_usd: 5.5,
    desc_vi: "Sở hữu cả 2 giải pháp bảo vệ cốt lõi cho server với giá ưu đãi",
    desc_en: "Get both core security solutions for your server at a discounted bundle price"
  },
  "custom_mod": {
    name_vi: "Đặt Làm Mod Custom Cho Minecraft Java",
    name_en: "Custom Minecraft Java Mod Development",
    price_vnd: 0,
    price_usd: 0,
    desc_vi: "Forge, Fabric, NeoForge 1.16 đến 1.21+ • Tùy theo tính năng yêu cầu",
    desc_en: "Forge, Fabric, NeoForge 1.16 - 1.21+ • Built to your specifications"
  },
  "custom_dev": {
    name_vi: "Đặt Làm Plugin Riêng Theo Ý Tưởng",
    name_en: "Custom Minecraft Plugin Development",
    price_vnd: 0,
    price_usd: 0,
    desc_vi: "Trao đổi ý tưởng tính năng độc quyền cho Server của bạn",
    desc_en: "Discuss and build exclusive custom features for your server"
  },

  // 2. DỊCH VỤ AI & API KEY
  "acc_gemini_family_18m": {
    name_vi: "Acc Gemini Family Nâng Chính Chủ (18 Tháng)",
    name_en: "Gemini Family Upgrade on Your Main Account (18 Months)",
    price_vnd: 35000,
    price_usd: 1.5,
    desc_vi: "Nâng trực tiếp trên Gmail chính chủ 18 tháng, Gemini Advanced 2M Token, Google One 2TB Cloud",
    desc_en: "Direct upgrade on your main Gmail for 18 months, Gemini Advanced 2M Token, 2TB Cloud"
  },
  "link_gemini_pro_18m": {
    name_vi: "Link Kích Hoạt Gemini Pro 18M",
    name_en: "Gemini Pro 18M Activation Link",
    price_vnd: 49000,
    price_usd: 2.0,
    desc_vi: "Link nâng cấp trực tiếp vào tài khoản Google, bảo hành kích hoạt lần đầu",
    desc_en: "Direct activation link for your Google account, guaranteed first activation"
  },
  "acc_google_ai_pro_1m": {
    name_vi: "Tài Khoản Google AI Pro Chính Chủ (1 Tháng)",
    name_en: "Google AI Pro Official Account (1 Month)",
    price_vnd: 89000,
    price_usd: 3.5,
    desc_vi: "Acc Google AI Pro chính chủ, Gemini Advanced 2M Token, 2TB Cloud",
    desc_en: "Official Google AI Pro account, Gemini Advanced 2M Token, 2TB Cloud"
  },
  "api_claude_100m": {
    name_vi: "API Key Claude 100M Token • Fable 5, Opus 5, Sonnet 5 (3 Ngày)",
    name_en: "Claude API Key 100M Tokens • Fable 5, Opus 5, Sonnet 5 (3 Days)",
    price_vnd: 109000,
    price_usd: 4.25,
    desc_vi: "100M Token Claude 5 (Fable/Opus/Sonnet) chuyên Cursor, Cline, Agentic Coding",
    desc_en: "100M Tokens for Claude 5 (Fable 5, Opus 5, Sonnet 5) for Cursor & Cline"
  },
  "api_codex_100m": {
    name_vi: "API Key Codex 100M Token • GPT-5.6 Sol (3 Ngày)",
    name_en: "Codex API Key 100M Tokens • GPT-5.6 Sol (3 Days)",
    price_vnd: 85000,
    price_usd: 3.25,
    desc_vi: "100M Token OpenAI Codex nền tảng GPT-5.6 Sol chuyên sâu logic & thuật toán",
    desc_en: "100M Tokens OpenAI Codex powered by GPT-5.6 Sol for advanced coding"
  },
  "acc_claude_max20": {
    name_vi: "Tài Khoản Claude Max 20 • Fable 5, Opus 5 & Sonnet 5 (1 Tháng)",
    name_en: "Claude Max 20 Account • Full Claude 5 Models (1 Month)",
    price_vnd: 89000,
    price_usd: 3.5,
    desc_vi: "Hạn mức cao Max 20, dùng thoải mái Claude Sonnet 5, Opus 5 và Fable 5",
    desc_en: "High quota Max 20, full access to Claude 5 models for 30 days"
  },
  "acc_chatgpt_plus": {
    name_vi: "Tài Khoản ChatGPT Plus • GPT-5.6 Sol (1 Tháng)",
    name_en: "ChatGPT Plus Account • GPT-5.6 Sol (1 Month)",
    price_vnd: 169000,
    price_usd: 6.8,
    desc_vi: "Trọn bộ GPT-5.6 Sol Flagship, DALL-E, Voice Chat, Canvas 2.0, bảo hành 1 tháng",
    desc_en: "Full GPT-5.6 Sol Flagship, DALL-E, Voice Chat, Canvas with 30-day warranty"
  },
  "acc_monica_pro_3d": {
    name_vi: "Tài Khoản Monica AI Pro • Claude 5 & GPT-5.6 (3 Ngày)",
    name_en: "Monica AI Pro Account • Claude 5 & GPT-5.6 (3 Days)",
    price_vnd: 49000,
    price_usd: 2.0,
    desc_vi: "Sử dụng đồng thời Claude Sonnet 5, Opus 5, GPT-5.6 Sol và Gemini 2.5 Pro",
    desc_en: "Simultaneous access to Claude 5, GPT-5.6 Sol, and Gemini 2.5 Pro"
  },
  "acc_chatgpt_offer": {
    name_vi: "Tài Khoản ChatGPT New Gmail • Nhận Offer GPT-5.6",
    name_en: "ChatGPT Fresh Gmail Account for GPT-5.6 Offer",
    price_vnd: 5000,
    price_usd: 0.2,
    desc_vi: "Gmail mới dùng kích hoạt gói Offer/Trial GPT-5.6 (Cần thẻ PayPal)",
    desc_en: "Fresh Gmail for activating GPT-5.6 trial offer (PayPal card required)"
  }
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

// Slash Commands
const commands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Kiểm tra độ trễ của Bot LS Studio / Check Bot Latency'),
  new SlashCommandBuilder()
    .setName('khachhang')
    .setDescription('Cấp role Khách Hàng cho người vừa mua Plugin/Mod/AI (Staff Only)')
    .addUserOption(opt => opt.setName('user').setDescription('Thành viên đã mua hàng / Customer').setRequired(true)),
  new SlashCommandBuilder()
    .setName('stk')
    .setDescription('Lấy thông tin tài khoản ngân hàng MBBank / Bank Information')
].map(cmd => cmd.toJSON());

async function registerCommands(clientId) {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    console.log('🔄 Đang đồng bộ Slash Commands...');
    await rest.put(
      Routes.applicationGuildCommands(clientId, GUILD_ID),
      { body: commands }
    );
    console.log('✅ Slash Commands đã sẵn sàng!');
  } catch (error) {
    console.error('❌ Lỗi đăng ký Slash Commands:', error);
  }
}

client.once('clientReady', async () => {
  console.log(`🤖 LS STUDIO BOT ONLINE: ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: 'LS STUDIO • Plugins & AI Services ⚡', type: ActivityType.Watching }],
    status: 'online'
  });

  await registerCommands(client.user.id);
});

// =========================================================================
// 🛡️ TÍNH NĂNG AUTOMOD: AUTO MUTE 5 PHÚT KHI PING @EVERYONE & CHẶN LINK INVITE
// =========================================================================
client.on('messageCreate', async (message) => {
  try {
    if (!message.guild || message.author.bot) return;

    const isStaff = message.member?.permissions.has(PermissionsBitField.Flags.Administrator) ||
                    message.member?.roles.cache.some(r => 
                      r.name.includes("Staff") || 
                      r.name.includes("Developer") || 
                      r.name.includes("Founder") ||
                      r.name.includes("Admin")
                    );

    // 1. Chặn và Mute 5 phút nếu tự ý ping @everyone / @here
    if (!isStaff && (message.mentions.everyone || message.content.includes('@everyone') || message.content.includes('@here'))) {
      await message.delete().catch(() => {});

      if (message.member && message.member.moderatable) {
        await message.member.timeout(5 * 60 * 1000, 'Tự ý ping @everyone / @here trái phép').catch(console.error);
      }

      const warnEmbed = new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle('⚠️ CẢNH BÁO TỰ ĐỘNG / AUTO MODERATION')
        .setDescription(
          `🚫 <@${message.author.id}> đã bị **khóa chat (Mute) 5 phút** do tự ý ping \`@everyone\` hoặc \`@here\` trái phép!\n\n` +
          `*User <@${message.author.id}> has been timed out for **5 minutes** for unauthorized \`@everyone\` / \`@here\` mention.*`
        )
        .setFooter({ text: 'LS STUDIO Security & Anti-Spam System' })
        .setTimestamp();

      const sent = await message.channel.send({ embeds: [warnEmbed] });
      setTimeout(() => sent.delete().catch(() => {}), 10000);
      return;
    }

    // 2. Chặn link mời Discord khác
    const discordInviteRegex = /(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\/[a-zA-Z0-9_-]+/gi;
    if (!isStaff && discordInviteRegex.test(message.content)) {
      await message.delete().catch(() => {});

      const inviteWarnEmbed = new EmbedBuilder()
        .setColor('#FF9800')
        .setTitle('🚫 CHẶN QUẢNG CÁO / ANTI-INVITE LINK')
        .setDescription(
          `⚠️ <@${message.author.id}> vui lòng không gửi link mời Discord của máy chủ khác!\n\n` +
          `*Discord invite links are strictly prohibited in this server.*`
        )
        .setFooter({ text: 'LS STUDIO Anti-Ad System' })
        .setTimestamp();

      const sent = await message.channel.send({ embeds: [inviteWarnEmbed] });
      setTimeout(() => sent.delete().catch(() => {}), 7000);
      return;
    }

  } catch (err) {
    console.error('Lỗi AutoMod messageCreate:', err);
  }
});

// =========================================================================
// 1. EVENT: CHÀO MỪNG THÀNH VIÊN MỚI (BILINGUAL)
// =========================================================================
client.on('guildMemberAdd', async (member) => {
  try {
    const memberRole = member.guild.roles.cache.find(r => r.name.includes("Thành Viên"));
    if (memberRole) {
      await member.roles.add(memberRole).catch(() => {});
    }

    const welcomeChannel = member.guild.channels.cache.find(ch => ch.name.includes("chào-mừng") || ch.name.includes("welcome"));
    if (welcomeChannel) {
      const chRules = member.guild.channels.cache.find(c => c.name.includes("luật-lệ"));
      const chPrice = member.guild.channels.cache.find(c => c.name.includes("bảng-giá"));
      const chBuy = member.guild.channels.cache.find(c => c.name.includes("mua-plugin"));

      const welcomeEmbed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("🎉 CHÀO MỪNG / WELCOME TO LS STUDIO!")
        .setDescription(
          `👋 Chào mừng <@${member.id}> (**${member.user.tag}**) đã đến với **LS STUDIO**!\n` +
          `*Welcome <@${member.id}> to LS STUDIO! Plugins, Java Mods & AI Services.*\n\n` +
          `• 📜 Quy định / Rules: <#${chRules?.id}>\n` +
          `• 💰 Bảng giá / Price List: <#${chPrice?.id}>\n` +
          `• 🛒 Mua hàng & Hỗ trợ / Buy & Support: <#${chBuy?.id}>\n\n` +
          `👥 Bạn là thành viên thứ **#${member.guild.memberCount}** của Server!`
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .setFooter({ text: "LS STUDIO • Minecraft Plugins & AI Services" })
        .setTimestamp();

      await welcomeChannel.send({ content: `Chào mừng / Welcome <@${member.id}>! 🎉`, embeds: [welcomeEmbed] });
    }
  } catch (err) {
    console.error("Lỗi khi đón thành viên mới:", err);
  }
});

// =========================================================================
// 2. EVENT: TẠM BIỆT THÀNH VIÊN RỜI SERVER
// =========================================================================
client.on('guildMemberRemove', async (member) => {
  try {
    const goodbyeChannel = member.guild.channels.cache.find(ch => ch.name.includes("tạm-biệt") || ch.name.includes("goodbye"));
    if (goodbyeChannel) {
      const goodbyeEmbed = new EmbedBuilder()
        .setColor("#ED4245")
        .setTitle("👋 TẠM BIỆT / GOODBYE!")
        .setDescription(
          `Thành viên **${member.user.tag}** (<@${member.id}>) đã rời khỏi **LS STUDIO**.\n` +
          `*User ${member.user.tag} has left the server. Thank you for your time with us!*\n\n` +
          `📉 Hiện tại Server còn **${member.guild.memberCount}** thành viên.`
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .setFooter({ text: "LS STUDIO" })
        .setTimestamp();

      await goodbyeChannel.send({ embeds: [goodbyeEmbed] });
    }
  } catch (err) {
    console.error("Lỗi khi tạm biệt thành viên:", err);
  }
});

// Helper: Sinh Menu chọn gói theo ngôn ngữ
function buildPackageSelectMenu(userId, lang = 'vi') {
  const isEn = lang === 'en';
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`select_package_${lang}_${userId}`)
    .setPlaceholder(isEn ? '👉 Click here to select a Plugin or AI Service...' : '👉 Bấm vào đây để chọn Plugin hoặc Dịch Vụ AI bạn muốn mua...');

  menu.addOptions(
    // Plugin Minecraft
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'LS-AntiCheat • $1.50 (30.000 VNĐ)' : 'LS-AntiCheat • 30.000 VNĐ')
      .setDescription(isEn ? 'WallHit, Inv checks, AutoEat/Potion/Fish, Health spoof' : 'WallHit xuyên web/tường, Inv A-F, AutoEat/Fish/Potion, Fake Máu')
      .setValue('ls_anticheat')
      .setEmoji('🛡️'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Addon Anti-Macro Cart • $1.00/Mo (20.000 VNĐ/Tháng)' : 'Addon Anti-Macro Cart • 20.000 VNĐ / Tháng')
      .setDescription(isEn ? 'Minecart/Boat macro speed exploits protection' : 'Chống hack/macro xe mỏ và thuyền di chuyển siêu tốc')
      .setValue('addon_macro_cart')
      .setEmoji('🛒'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'LS-AntiFreeCam & Obfuscator • $2.50 (59.000 VNĐ)' : 'LS-AntiFreeCam & Obfuscator • 59.000 VNĐ')
      .setDescription(isEn ? 'Blocks Freecam Mod, Baritone auto-mining, Chest ESP, X-Ray' : 'Chống Freecam, Baritone đào tự động, Chest ESP, X-Ray')
      .setValue('anti_freecam')
      .setEmoji('👁️'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'LS-AntiClient & BrandShield • $4.00 (99.000 VNĐ)' : 'LS-AntiClient & BrandShield • 99.000 VNĐ')
      .setDescription(isEn ? 'Blocks Meteor, LiquidBounce, Aristois, Fabric Cheats' : 'Chặn Meteor, LiquidBounce, Aristois, Fabric Cheats')
      .setValue('anti_client')
      .setEmoji('🚫'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'LS-GiftCode & Rewards • $1.50 (30.000 VNĐ)' : 'LS-GiftCode & Rewards • 30.000 VNĐ')
      .setDescription(isEn ? 'Custom gift codes, limit claims, expiry timer, async DB' : 'Hệ thống tạo mã quà tặng tân thủ/sự kiện, giới hạn lượt nhập')
      .setValue('ls_giftcode')
      .setEmoji('🎁'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Combo 2 Anti Plugins • $5.50 (129.000 VNĐ)' : 'Combo 2 Plugin Anti • 129.000 VNĐ')
      .setDescription(isEn ? 'Get AntiFreeCam + AntiClient with a discount bundle' : 'Sở hữu cả LS-AntiFreeCam + LS-AntiClient với giá ưu đãi')
      .setValue('combo_suite')
      .setEmoji('👑'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Custom Java Mod Development' : 'Đặt Làm Mod Custom Cho Minecraft Java')
      .setDescription(isEn ? 'Forge / Fabric / NeoForge 1.16 - 1.21+ built to order' : 'Forge/Fabric/NeoForge 1.16 - 1.21+ • Tùy theo tính năng yêu cầu')
      .setValue('custom_mod')
      .setEmoji('🧩'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Custom Plugin Development' : 'Đặt Làm Plugin Riêng Theo Ý Tưởng')
      .setDescription(isEn ? 'Discuss and build custom server plugins with Developer' : 'Trao đổi tính năng độc quyền trực tiếp với Developer')
      .setValue('custom_dev')
      .setEmoji('📝'),

    // Dịch vụ AI
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Gemini Family Main Account (18 Mo) • $1.50 (35.000 VNĐ)' : 'Acc Gemini Family Nâng Chính Chủ (18 Tháng) • 35.000 VNĐ')
      .setDescription(isEn ? 'Direct 18-month upgrade on your Gmail, 2TB Cloud' : 'Nâng chính chủ Gmail 18 tháng, Gemini Advanced, 2TB Cloud')
      .setValue('acc_gemini_family_18m')
      .setEmoji('🌟'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Gemini Pro 18M Activation Link • $2.00 (49.000 VNĐ)' : 'Link Kích Hoạt Gemini Pro 18M • 49.000 VNĐ')
      .setDescription(isEn ? 'Direct upgrade link for your Google account' : 'Link nâng cấp trực tiếp vào tài khoản Google, bảo hành lần đầu')
      .setValue('link_gemini_pro_18m')
      .setEmoji('🚀'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Google AI Pro Account (1 Mo) • $3.50 (89.000 VNĐ)' : 'Tài Khoản Google AI Pro Chính Chủ • 89.000 VNĐ')
      .setDescription(isEn ? 'Gemini Advanced 2M Context, 2TB Google One Cloud' : 'Acc Google AI Pro chính chủ, Gemini Advanced 2M, 2TB Cloud')
      .setValue('acc_google_ai_pro_1m')
      .setEmoji('🚀'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Claude 5 API Key 100M • $4.25 (109.000 VNĐ)' : 'API Key Claude 100M Token • 109.000 VNĐ (4.25$)')
      .setDescription(isEn ? '100M Tokens Claude Fable 5, Opus 5, Sonnet 5 (3 days)' : '100 Triệu Token Claude Fable 5, Opus 5, Sonnet 5 dùng 3 ngày')
      .setValue('api_claude_100m')
      .setEmoji('⚡'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Codex GPT-5.6 API 100M • $3.25 (85.000 VNĐ)' : 'API Key Codex GPT-5.6 • 85.000 VNĐ (3.25$)')
      .setDescription(isEn ? '100M Tokens OpenAI Codex GPT-5.6 Sol (3 days)' : '100 Triệu Token Codex GPT-5.6 Sol chuyên lập trình dùng 3 ngày')
      .setValue('api_codex_100m')
      .setEmoji('💻'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Claude Max 20 Account (1 Mo) • $3.50 (89.000 VNĐ)' : 'Tài Khoản Claude Max 20 • 89.000 VNĐ (1 Tháng)')
      .setDescription(isEn ? 'Full access to Claude Sonnet 5, Opus 5, Fable 5 for 30d' : 'Hạn mức cao Max 20, dùng Claude Fable 5, Opus 5, Sonnet 5')
      .setValue('acc_claude_max20')
      .setEmoji('👑'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'ChatGPT Plus GPT-5.6 (1 Mo) • $6.80 (169.000 VNĐ)' : 'Tài Khoản ChatGPT Plus • 169.000 VNĐ (1 Tháng)')
      .setDescription(isEn ? 'Full GPT-5.6 Sol, DALL-E, Voice Chat with 30-day warranty' : 'GPT-5.6 Sol, DALL-E 3, Voice Chat, Canvas 2.0, bảo hành 1 tháng')
      .setValue('acc_chatgpt_plus')
      .setEmoji('⭐'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'Monica AI Pro Claude 5 (3 Days) • $2.00 (49.000 VNĐ)' : 'Tài Khoản Monica AI Pro Claude 5 • 49.000 VNĐ')
      .setDescription(isEn ? 'Claude Sonnet 5, Opus 5, GPT-5.6 Sol, Gemini 2.5 Pro' : 'Gói Pro 3 ngày có Claude 5, GPT-5.6 Sol, Gemini 2.5 Pro')
      .setValue('acc_monica_pro_3d')
      .setEmoji('✨'),
    new StringSelectMenuOptionBuilder()
      .setLabel(isEn ? 'ChatGPT Fresh Gmail for Offer • $0.20 (5.000 VNĐ)' : 'Tài Khoản ChatGPT New Gmail • 5.000 VNĐ')
      .setDescription(isEn ? 'Fresh Gmail to activate GPT-5.6 offer/trial' : 'Gmail mới dùng nhận Offer GPT-5.6 Sol (Cần thẻ PayPal)')
      .setValue('acc_chatgpt_offer')
      .setEmoji('🎁')
  );

  return menu;
}

// =========================================================================
// 3. XỬ LÝ INTERACTIONS (BUTTON, SELECT MENU, SLASH COMMANDS)
// =========================================================================
client.on('interactionCreate', async (interaction) => {
  try {
    // 1. SLASH COMMANDS
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;

      if (commandName === 'ping') {
        return interaction.reply({ content: `🏓 Pong! Bot latency: \`${client.ws.ping}ms\``, ephemeral: true });
      }

      if (commandName === 'stk') {
        const qrUrl = `https://img.vietqr.io/image/${BANK_CONFIG.BANK_ID}-${BANK_CONFIG.ACCOUNT_NO}-compact2.png?accountName=${encodeURIComponent(BANK_CONFIG.ACCOUNT_NAME)}`;
        const embedStk = new EmbedBuilder()
          .setColor("#00E676")
          .setTitle("💳 THÔNG TIN THANH TOÁN / PAYMENT INFORMATION")
          .setDescription(
            `🏦 **Ngân hàng / Bank:** MBBank (Ngân Hàng Quân Đội VN)\n` +
            `🔢 **Số tài khoản / Account Number:** \`${BANK_CONFIG.ACCOUNT_NO}\`\n` +
            `👤 **Chủ tài khoản / Account Holder:** **${BANK_CONFIG.ACCOUNT_NAME}**\n\n` +
            `*Khách hàng Việt Nam có thể quét mã VietQR bên dưới để thanh toán siêu tốc 24/7.*\n` +
            `*International customers: Please open a Ticket for PayPal / International payment methods.*`
          )
          .setImage(qrUrl)
          .setFooter({ text: "LS STUDIO • Payment System 24/7" });
        return interaction.reply({ embeds: [embedStk] });
      }

      if (commandName === 'khachhang') {
        const targetUser = interaction.options.getUser('user');
        const member = await interaction.guild.members.fetch(targetUser.id);
        
        const customerRole = interaction.guild.roles.cache.find(r => r.name.includes("Khách Hàng"));
        if (!customerRole) {
          return interaction.reply({ content: "❌ Không tìm thấy role Khách Hàng / Customer role not found!", ephemeral: true });
        }

        await member.roles.add(customerRole);

        const successEmbed = new EmbedBuilder()
          .setColor("#00E676")
          .setTitle("🎉 CẤP ROLE KHÁCH HÀNG THÀNH CÔNG / ROLE ASSIGNED!")
          .setDescription(
            `Đã cấp role <@&${customerRole.id}> cho <@${member.id}>.\n` +
            `*Role granted to <@${member.id}>. You can now access VIP downloads at <#${interaction.guild.channels.cache.find(c => c.name.includes("tải-plugin"))?.id}>!*`
          )
          .setTimestamp();

        return interaction.reply({ embeds: [successEmbed] });
      }
    }

    // 2. BUTTON INTERACTIONS
    if (interaction.isButton()) {
      const { customId, user, guild } = interaction;

      // Nút Xem Bảng Giá
      if (customId === 'ticket_pricing') {
        const chPricing = guild.channels.cache.find(c => c.name.includes('bảng-giá'));
        return interaction.reply({
          content: `💰 Bảng giá chi tiết / Price List: <#${chPricing?.id}>`,
          ephemeral: true
        });
      }

      // Nút chuyển ngôn ngữ trong Ticket
      if (customId.startsWith('switch_lang_')) {
        const parts = customId.split('_');
        const targetLang = parts[2]; // 'vi' or 'en'
        const isEn = targetLang === 'en';

        const menuRow = new ActionRowBuilder().addComponents(buildPackageSelectMenu(user.id, targetLang));
        const langSwitchRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`switch_lang_vi_${user.id}`)
            .setLabel('🇻🇳 Tiếng Việt')
            .setStyle(isEn ? ButtonStyle.Secondary : ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`switch_lang_en_${user.id}`)
            .setLabel('🇺🇸 English')
            .setStyle(isEn ? ButtonStyle.Primary : ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('btn_close_ticket')
            .setLabel(isEn ? '🔒 Close Ticket' : '🔒 Đóng Ticket')
            .setStyle(ButtonStyle.Danger)
        );

        const embed = new EmbedBuilder()
          .setColor("#00E676")
          .setTitle(isEn ? "🛒 ORDER & SUPPORT CENTER - LS STUDIO" : "🛒 TRUNG TÂM THANH TOÁN & ĐẶT HÀNG - LS STUDIO")
          .setDescription(
            isEn 
              ? `👋 Hello <@${user.id}>! Welcome to **LS STUDIO**.\n\n` +
                `👇 **Please select a Plugin or AI Service from the dropdown menu below**:\n` +
                `• Premade Plugins & AI Services ➔ Automatic VietQR / Instant Order Invoice!\n` +
                `• Custom Mod / Custom Plugin ➔ Discuss directly with our Developer to get a quote!\n\n` +
                `🌐 *If you are an international buyer and need PayPal / Crypto or English support, let our staff know right here!*`
              : `👋 Chào <@${user.id}>! Cảm ơn bạn đã lựa chọn dịch vụ từ **LS STUDIO**.\n\n` +
                `👇 **Vui lòng chọn Plugin hoặc Dịch Vụ AI bạn muốn đặt từ Menu bên dưới**:\n` +
                `• Mua Plugin & Dịch vụ AI có sẵn ➔ Tự tạo mã **VietQR MBBank** để bạn quét thanh toán siêu tốc!\n` +
                `• Đặt làm **Mod Custom Java 1.16+** hoặc **Plugin riêng 1.16+** ➔ Trao đổi trực tiếp ý tưởng với Developer để nhận báo giá chi tiết!`
          )
          .setFooter({ text: isEn ? "Staff will assist and deliver your files right here!" : "Sau khi chuyển khoản, Staff sẽ duyệt và giao file ngay tại đây!" })
          .setTimestamp();

        return interaction.update({ embeds: [embed], components: [menuRow, langSwitchRow] });
      }

      // Nút Mở Ticket Mua Hàng
      if (customId === 'ticket_buy' || customId === 'ticket_support' || customId === 'ticket_custom') {
        await interaction.deferReply({ ephemeral: true });

        let ticketType = "🛒-mua";
        let isBuyTicket = customId === 'ticket_buy';

        if (customId === 'ticket_support') {
          ticketType = "🛠️-support";
        } else if (customId === 'ticket_custom') {
          ticketType = "📝-custom";
        }

        const channelName = `${ticketType}-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        const existingChannel = guild.channels.cache.find(c => c.name === channelName);

        if (existingChannel) {
          return interaction.editReply({
            content: `⚠️ Bạn đã có một ticket đang mở tại / You already have an open ticket at: <#${existingChannel.id}>.`
          });
        }

        const ticketCat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.includes("HỖ TRỢ & MUA HÀNG"));
        const staffRole = guild.roles.cache.find(r => r.name.includes("Staff") || r.name.includes("Developer") || r.name.includes("Founder"));

        const overwrites = [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.AttachFiles,
              PermissionsBitField.Flags.EmbedLinks,
              PermissionsBitField.Flags.ReadMessageHistory
            ]
          },
          {
            id: client.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ManageChannels,
              PermissionsBitField.Flags.EmbedLinks
            ]
          }
        ];

        if (staffRole) {
          overwrites.push({
            id: staffRole.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.AttachFiles,
              PermissionsBitField.Flags.EmbedLinks,
              PermissionsBitField.Flags.ReadMessageHistory
            ]
          });
        }

        const ticketChannel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: ticketCat ? ticketCat.id : null,
          topic: `Ticket của @${user.tag} (${user.id})`,
          permissionOverwrites: overwrites
        });

        if (isBuyTicket) {
          const menuRow = new ActionRowBuilder().addComponents(buildPackageSelectMenu(user.id, 'vi'));

          const langSwitchRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`switch_lang_vi_${user.id}`)
              .setLabel('🇻🇳 Tiếng Việt')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId(`switch_lang_en_${user.id}`)
              .setLabel('🇺🇸 English')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId('btn_close_ticket')
              .setLabel('🔒 Đóng / Close')
              .setStyle(ButtonStyle.Danger)
          );

          const introEmbed = new EmbedBuilder()
            .setColor("#00E676")
            .setTitle("🛒 TRUNG TÂM THANH TOÁN & ĐẶT HÀNG / ORDER CENTER")
            .setDescription(
              `👋 Chào <@${user.id}>! Cảm ơn bạn đã lựa chọn dịch vụ từ **LS STUDIO**.\n` +
              `*Welcome <@${user.id}>! Thank you for choosing LS STUDIO.*\n\n` +
              `👇 **Vui lòng chọn Plugin hoặc Dịch Vụ AI từ Menu bên dưới**:\n` +
              `*Please select a package or AI service from the dropdown menu below:*\n\n` +
              `• 🇻🇳 **Tiếng Việt:** Quét mã VietQR MBBank tự động 24/7.\n` +
              `• 🇺🇸 **English:** Switch to English for PayPal / Global payment options!`
            )
            .setFooter({ text: "Staff sẽ hỗ trợ và giao file trực tiếp tại đây! / Staff will assist you here!" })
            .setTimestamp();

          await ticketChannel.send({
            content: `<@${user.id}> ${staffRole ? `<@&${staffRole.id}>` : ""}`,
            embeds: [introEmbed],
            components: [menuRow, langSwitchRow]
          });

        } else {
          const supportEmbed = new EmbedBuilder()
            .setColor(customId === 'ticket_support' ? "#3D5AFE" : "#FF4500")
            .setTitle(customId === 'ticket_support' ? "🛠️ TICKET HỖ TRỢ KỸ THUẬT / TECH SUPPORT" : "📝 TICKET ĐẶT LÀM PLUGIN HOẶC MOD / CUSTOM DEV")
            .setDescription(
              `👋 Chào / Hello <@${user.id}>!\n\n` +
              (customId === 'ticket_support' 
                ? "🇻🇳 **Tiếng Việt:** Vui lòng mô tả chi tiết lỗi phát sinh, phiên bản server (Paper/Purpur/Folia 1.16+) hoặc đính kèm file log lỗi (`latest.log`) để Dev hỗ trợ xử lý ngay!\n\n" +
                  "🇺🇸 **English:** Please describe your issue, server software (Paper/Purpur/Folia 1.16+), or attach your crash log (`latest.log`) for quick assistance!"
                : "🇻🇳 **Tiếng Việt:** Vui lòng mô tả chi tiết ý tưởng Plugin hoặc Mod (Forge/Fabric Java 1.16+), các tính năng mong muốn, thời hạn và ngân sách dự kiến của bạn!\n\n" +
                  "🇺🇸 **English:** Please describe your Plugin or Mod idea (Forge/Fabric Java 1.16+), required features, expected delivery deadline and budget!")
            )
            .setTimestamp();

          const btnRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('btn_close_ticket')
              .setLabel('🔒 Đóng Ticket / Close')
              .setStyle(ButtonStyle.Danger)
          );

          await ticketChannel.send({
            content: `<@${user.id}> ${staffRole ? `<@&${staffRole.id}>` : ""}`,
            embeds: [supportEmbed],
            components: [btnRow]
          });
        }

        return interaction.editReply({
          content: `✅ Ticket của bạn đã sẵn sàng tại / Your ticket is ready at: <#${ticketChannel.id}>`
        });
      }

      // Nút Duyệt Tiền & Giao File (Dành cho Staff/Admin)
      if (customId.startsWith('approve_')) {
        const parts = customId.split('_');
        const orderCode = parts[1];
        const buyerId = parts[2];
        const pkgKey = parts.slice(3).join('_');

        const isStaff = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
                        interaction.member.roles.cache.some(r => r.name.includes("Staff") || r.name.includes("Developer") || r.name.includes("Founder"));

        if (!isStaff) {
          return interaction.reply({
            content: "❌ Chỉ có Quản Trị Viên mới có quyền duyệt đơn hàng này! / Staff only action!",
            ephemeral: true
          });
        }

        const pkg = PACKAGES[pkgKey] || { name_vi: "Sản phẩm / Dịch vụ", price_vnd: 0, price_usd: 0 };
        const buyerMember = await guild.members.fetch(buyerId).catch(() => null);
        const customerRole = guild.roles.cache.find(r => r.name.includes("Khách Hàng"));

        if (buyerMember && customerRole) {
          await buyerMember.roles.add(customerRole).catch(console.error);
        }

        const successEmbed = new EmbedBuilder()
          .setColor("#00E676")
          .setTitle("🎉 XÁC NHẬN THANH TOÁN THÀNH CÔNG / PAYMENT APPROVED!")
          .setDescription(
            `✅ Đơn hàng **\`${orderCode}\`** đã được <@${interaction.user.id}> xác nhận tiền về tài khoản!\n\n` +
            `👤 **Khách hàng / Customer:** <@${buyerId}>\n` +
            `📦 **Sản phẩm / Product:** **${pkg.name_vi}**\n` +
            `💰 **Số tiền / Amount:** \`${pkg.price_vnd.toLocaleString('vi-VN')} VNĐ\` (~$${pkg.price_usd} USD)\n\n` +
            `👑 **Quyền lợi đã kích hoạt / Benefits Activated:**\n` +
            `• Đã cấp Role **<@&${customerRole?.id}>** cho khách hàng.\n` +
            `• Staff sẽ gửi File / Link / API Key / Tài khoản trực tiếp ngay tại Ticket này!\n\n` +
            `💬 *Cảm ơn bạn đã tin tưởng và sử dụng dịch vụ của LS STUDIO!*`
          )
          .setFooter({ text: "LS STUDIO • Thank you for your purchase!", iconURL: client.user.displayAvatarURL() })
          .setTimestamp();

        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('approved_done')
            .setLabel('✅ Đã Duyệt & Giao Hàng / Approved')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('btn_close_ticket')
            .setLabel('🔒 Đóng Ticket / Close')
            .setStyle(ButtonStyle.Danger)
        );

        await interaction.update({ components: [disabledRow] });
        await interaction.channel.send({ embeds: [successEmbed] });

        const logChannel = guild.channels.cache.find(c => c.name.includes("nhật-ký-giao-dịch"));
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor("#00E676")
            .setTitle("📊 GIAO DỊCH THÀNH CÔNG / TRANSACTION SUCCESS")
            .setDescription(
              `• **Mã đơn / Order:** \`${orderCode}\`\n` +
              `• **Khách hàng / Customer:** <@${buyerId}> (${buyerId})\n` +
              `• **Sản phẩm / Product:** ${pkg.name_vi}\n` +
              `• **Số tiền / Amount:** \`${pkg.price_vnd.toLocaleString('vi-VN')} VNĐ\` (~$${pkg.price_usd} USD)\n` +
              `• **Người duyệt / Approved by:** <@${interaction.user.id}>\n` +
              `• **Thời gian / Time:** <t:${Math.floor(Date.now() / 1000)}:F>`
            )
            .setTimestamp();
          await logChannel.send({ embeds: [logEmbed] });
        }
        return;
      }

      // Nút Đóng Ticket
      if (customId === 'btn_close_ticket') {
        const closeEmbed = new EmbedBuilder()
          .setColor("#FF5252")
          .setTitle("🔒 ĐÓNG TICKET / CLOSE TICKET")
          .setDescription(`Ticket này đã được đóng bởi <@${interaction.user.id}>.\nKênh sẽ được xóa sau ít giây / Channel will be deleted shortly...`);

        await interaction.reply({ embeds: [closeEmbed] });

        const logChannel = guild.channels.cache.find(c => c.name.includes("nhật-ký-giao-dịch"));
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor("#9E9E9E")
            .setTitle("📊 NHẬT KÝ ĐÓNG TICKET / TICKET CLOSED")
            .setDescription(`• **Kênh / Channel:** \`${interaction.channel.name}\`\n• **Người đóng / Closed by:** <@${user.id}>\n• **Thời gian / Time:** <t:${Math.floor(Date.now() / 1000)}:F>`)
            .setTimestamp();
          await logChannel.send({ embeds: [logEmbed] });
        }

        setTimeout(async () => {
          try {
            await interaction.channel.delete("Ticket closed manually");
          } catch (e) {
            console.error("Lỗi xóa kênh ticket:", e);
          }
        }, 3000);
      }
    }

    // 3. SELECT MENU (CHỌN GÓI MUA - VIỆT NAM HOẶC ENGLISH)
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith('select_package_')) {
        const parts = interaction.customId.split('_');
        const lang = parts[2]; // 'vi' or 'en'
        const isEn = lang === 'en';
        const selectedKey = interaction.values[0];
        const pkg = PACKAGES[selectedKey];

        if (!pkg) return;

        // Xử lý gói Custom Mod hoặc Custom Plugin
        if (pkg.price_vnd === 0) {
          const isMod = selectedKey === 'custom_mod';
          const customEmbed = new EmbedBuilder()
            .setColor(isMod ? "#9C27B0" : "#FF4500")
            .setTitle(isEn 
              ? (isMod ? "🧩 CUSTOM MINECRAFT JAVA MOD DEVELOPMENT" : "📝 CUSTOM PLUGIN DEVELOPMENT")
              : (isMod ? "🧩 ĐẶT LÀM MOD CUSTOM CHO MINECRAFT JAVA" : "📝 ĐẶT LẬP TRÌNH PLUGIN THEO Ý TƯỞNG"))
            .setDescription(
              isEn 
                ? (isMod 
                    ? `You selected: **${pkg.name_en}**\n\n` +
                      `👉 **How to order a Custom Minecraft Java Mod:**\n` +
                      `1. **Supported platforms:** Forge, Fabric, NeoForge, Quilt (1.16 to 1.21+ Java Edition PC).\n` +
                      `2. Send your detailed mod idea and requested features right here in this ticket.\n` +
                      `3. Our Lead Developer will review, discuss, and provide a clear quote & estimated delivery date!\n\n` +
                      `⚠️ *Note: We only build mods for Minecraft Java Edition on PC, Bedrock/PE is not supported.*`
                    : `You selected: **${pkg.name_en}**\n\n` +
                      `👉 **Next steps:**\n` +
                      `1. Please describe your plugin idea, commands, features and server version in detail.\n` +
                      `2. Our Developer will provide a price quote and delivery timeline.\n` +
                      `3. Once agreed, you can send payment via Bank/PayPal to begin development!`)
                : (isMod 
                    ? `Bạn đã chọn: **${pkg.name_vi}**\n\n` +
                      `👉 **Quy trình đặt làm Mod Minecraft Java:**\n` +
                      `1. **Nền tảng hỗ trợ:** Forge, Fabric, NeoForge, Quilt (1.16 đến 1.21+ Java Edition PC).\n` +
                      `2. Hãy nhắn chi tiết ý tưởng Mod và các tính năng bạn yêu cầu tại đây.\n` +
                      `3. Developer của **LS STUDIO** sẽ đọc yêu cầu, tư vấn và báo giá + thời hạn bàn giao!\n\n` +
                      `⚠️ *Lưu ý: Bên mình chỉ nhận làm Mod cho Minecraft Java Edition trên PC, không nhận Bedrock PE.*`
                    : `Bạn đã chọn: **${pkg.name_vi}**\n\n` +
                      `👉 **Các bước tiếp theo:**\n` +
                      `1. Hãy nhắn chi tiết ý tưởng plugin của bạn tại đây.\n` +
                      `2. Developer của **LS STUDIO** sẽ đọc yêu cầu, báo giá và thời gian hoàn thành.\n` +
                      `3. Khi thống nhất, Dev sẽ gửi mã QR MBBank để bạn đặt cọc 50% và bắt đầu tiến hành code!`)
            )
            .setFooter({ text: "LS STUDIO • Uy Tín - Đúng Hẹn - Tối Ưu" })
            .setTimestamp();

          const btnClose = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('btn_close_ticket')
              .setLabel(isEn ? '🔒 Close Ticket' : '🔒 Đóng Ticket')
              .setStyle(ButtonStyle.Danger)
          );

          return interaction.reply({ embeds: [customEmbed], components: [btnClose] });
        }

        const orderCode = `LS${Math.floor(1000 + Math.random() * 9000)}`;
        const qrUrl = `https://img.vietqr.io/image/${BANK_CONFIG.BANK_ID}-${BANK_CONFIG.ACCOUNT_NO}-compact2.png?amount=${pkg.price_vnd}&addInfo=${orderCode}&accountName=${encodeURIComponent(BANK_CONFIG.ACCOUNT_NAME)}`;

        const invoiceEmbed = new EmbedBuilder()
          .setColor("#00E676")
          .setTitle(isEn ? `💳 PAYMENT INVOICE: ${orderCode}` : `💳 HÓA ĐƠN THANH TOÁN: ${orderCode}`)
          .setDescription(
            isEn 
              ? `You selected: **${pkg.name_en}**\n\n` +
                `💰 **Amount Due:** \`${pkg.price_vnd.toLocaleString('vi-VN')} VNĐ\` (~**$${pkg.price_usd} USD**)\n` +
                `🏦 **Bank:** **MBBank Vietnam**\n` +
                `🔢 **Account No:** \`${BANK_CONFIG.ACCOUNT_NO}\`\n` +
                `👤 **Account Name:** **${BANK_CONFIG.ACCOUNT_NAME}**\n` +
                `📝 **Transfer Memo / Note:** **\`${orderCode}\`** *(Required)*\n\n` +
                `📱 **Payment Options:**\n` +
                `• **Vietnam Banking / MoMo:** Scan the VietQR code below for instant transfer.\n` +
                `• **International Customers (PayPal / Crypto / Card):** Please message staff in this ticket to receive payment instructions!\n` +
                `• Once transferred, staff will approve and deliver your files / API Key / Account immediately!`
              : `Quý khách đã chọn: **${pkg.name_vi}**\n\n` +
                `💰 **Số tiền cần thanh toán:** \`${pkg.price_vnd.toLocaleString('vi-VN')} VNĐ\` (~$${pkg.price_usd} USD)\n` +
                `🏦 **Ngân hàng:** **MBBank (Ngân Hàng Quân Đội)**\n` +
                `🔢 **Số tài khoản:** \`${BANK_CONFIG.ACCOUNT_NO}\`\n` +
                `👤 **Chủ tài khoản:** **${BANK_CONFIG.ACCOUNT_NAME}**\n` +
                `📝 **Nội dung chuyển khoản:** **\`${orderCode}\`** *(Bắt buộc ghi đúng)*\n\n` +
                `📱 **Hướng dẫn quét mã nhanh:**\n` +
                `• Mở App **MBBank** hoặc bất kỳ ứng dụng ngân hàng / MoMo nào trên điện thoại.\n` +
                `• Quét mã QR bên dưới -> Số tiền và nội dung sẽ tự động điền chính xác 100%!\n` +
                `• Chuyển khoản xong, vui lòng đợi Staff bấm duyệt để nhận File / Key / Tài khoản ngay tại đây!`
          )
          .setImage(qrUrl)
          .setFooter({ text: `Order ID: ${orderCode} • LS STUDIO Payment System` })
          .setTimestamp();

        const actionRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`approve_${orderCode}_${interaction.user.id}_${selectedKey}`)
            .setLabel(isEn ? '✅ Approve & Deliver (Staff Only)' : '✅ Duyệt Tiền & Giao Hàng (Staff Only)')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('btn_close_ticket')
            .setLabel(isEn ? '🔒 Close Ticket' : '🔒 Đóng Ticket')
            .setStyle(ButtonStyle.Danger)
        );

        return interaction.reply({ embeds: [invoiceEmbed], components: [actionRow] });
      }
    }

  } catch (error) {
    console.error("Lỗi tương tác bot:", error);
  }
});

client.login(TOKEN);
