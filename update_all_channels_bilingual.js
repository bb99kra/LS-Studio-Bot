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
  console.log(`🤖 Logged in as ${client.user.tag}! Cập nhật toàn bộ các kênh sang Song Ngữ VI & EN chuẩn đẹp...`);

  try {
    const guild = await client.guilds.fetch(LS_STUDIO_GUILD_ID);
    const channels = await guild.channels.fetch();

    async function refreshChannel(channel, fn) {
      if (!channel) return;
      try {
        const messages = await channel.messages.fetch({ limit: 15 });
        for (const [id, msg] of messages) {
          if (msg.author.id === client.user.id) await msg.delete().catch(() => {});
        }
        await fn(channel);
        console.log(`   ✅ Cập nhật kênh: #${channel.name}`);
      } catch (e) {
        console.error(`   ❌ Lỗi kênh ${channel.name}:`, e.message);
      }
    }

    // Helper tạo nút Mua + Bảng Giá
    function makeActionButtons() {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_buy")
          .setLabel("🛒 Mở Ticket Mua Hàng / Buy Ticket")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("ticket_pricing")
          .setLabel("💰 Bảng Giá / Price List")
          .setStyle(ButtonStyle.Secondary)
      );
    }

    // ==========================================
    // 1. KÊNH SẢN PHẨM: #🛡️・ls-anticheat
    // ==========================================
    const chAc = channels.find(c => c && c.name.includes("ls-anticheat"));
    await refreshChannel(chAc, async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("🛡️ LS-ANTICHEAT • BEHAVIOR & WALLHIT SECURITY")
        .setDescription(
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Giải pháp chống gian lận đa năng, tối ưu nhẹ mượt cho Paper, Purpur, Folia 1.16 đến 1.21+.\n\n" +
          "• **Giá bán:** `30.000 VNĐ` • **Price:** `~$1.50 USD`\n" +
          "• **Nền tảng hỗ trợ:** Paper, Purpur, Folia 1.16 đến 1.21+\n\n" +
          "⚔️ **Tính năng nổi bật:**\n" +
          "• **Chống WallHit & Raytrace:** Chặn đứng Killaura đánh xuyên tường, xuyên block chắn, đặc biệt chặn triệt để hack đánh xuyên **Mạng Nhện Cobweb**, cửa và kính.\n" +
          "• **Chống gian lận PvP:** Chặn tự động ăn thức ăn siêu tốc, chặn auto câu cá AFK, chặn auto ném và uống potion tức thì khi tụt máu.\n" +
          "• **Chống macro khiên:** Chặn vừa giơ khiên vừa chém, vừa che khiên vừa chạy nước rút, chặn click bật tắt khiên 0ms.\n" +
          "• **Kiểm tra kho đồ (Inventory A-F):** Chặn vừa mở hòm đồ vừa đi lại, chém nhau hoặc lia chuột. Tóm gọn AutoClicker bằng thuật toán phân tích độ lệch chuẩn.\n" +
          "• **Bắt BadPacket:** Phát hiện đánh không vung tay NoSwing, Killaura Forcefield, Aimbot khóa góc nhìn máy móc.\n" +
          "• **Fake Info chống soi đồ:** Giả lập máu ảo làm sai lệch mod hiển thị máu, giấu bùa phù phép và độ bền giáp thật.\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "Advanced behavioral anti-cheat and wall-hit security engine for Paper, Purpur, Folia 1.16 to 1.21+.\n\n" +
          "🛡️ **Core Features:**\n" +
          "• **WallHit & Raytrace Check:** Prevents attacking through blocks, walls, doors, glass, and especially **Cobwebs Line-of-Sight**.\n" +
          "• **PvP & Utility Checks:** Blocks AutoEat, AutoFish AFK bots, and AutoPotion instant healing.\n" +
          "• **Shield Checks:** Blocks attacking while shielding, sprinting while shielding, and instant shield macros.\n" +
          "• **Inventory Checks (Type A-F):** Prevents moving, fighting, or rotating camera while inventory is open. Statistical heuristic detection for AutoClickers.\n" +
          "• **BadPacket Checks:** Detects NoSwing animation exploits, Forcefield, and robotic Aimbot rotations.\n" +
          "• **Item & Health Obfuscation:** Fake health spoofing against DamageIndicator mods, hidden enchants and armor durability."
        )
        .setFooter({ text: "LS STUDIO • Hỗ trợ nhiệt tình / Worldwide Support" });

      await ch.send({ embeds: [embed], components: [makeActionButtons()] });
    });

    // ==========================================
    // 2. KÊNH SẢN PHẨM: #👁️・ls-antifreecam
    // ==========================================
    const chFc = channels.find(c => c && c.name.includes("ls-antifreecam"));
    await refreshChannel(chFc, async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#00E5FF")
        .setTitle("👁️ LS-ANTIFREECAM & OBFUSCATOR")
        .setDescription(
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Khắc chế hoàn toàn Freecam Mod, Baritone đào tự động, Chest ESP và X-Ray.\n\n" +
          "• **Giá bán:** `59.000 VNĐ` • **Price:** `~$2.50 USD`\n" +
          "• **Nền tảng hỗ trợ:** Paper, Purpur, Folia 1.16 đến 1.21+\n\n" +
          "💎 **Tính năng nổi bật:**\n" +
          "• **Ẩn Rương & Quặng quý:** Ẩn toàn bộ quặng quý, rương đồ, Shulker Box khi nằm ngoài tầm nhìn thực tế của người chơi.\n" +
          "• **Chống Baritone & Bot đào:** Khiến Baritone và bot tự động đào hầm không thể định vị được vị trí quặng kim cương hay rương ngầm.\n" +
          "• **Xử lý bất đồng bộ:** Tối ưu hóa triệt để, không gây tụt TPS ngay cả khi server có hàng trăm người online cùng lúc.\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "Complete solution against Freecam Mod, Baritone Auto-Mining, Chest ESP, and X-Ray.\n\n" +
          "💎 **Core Features:**\n" +
          "• **Container & Ore Obfuscation:** Hides valuable ores, chests, and shulker boxes outside player line-of-sight.\n" +
          "• **Anti Baritone & Mining Bots:** Renders Baritone and auto-mining scripts blind to hidden ores and loot.\n" +
          "• **Async Optimization:** Highly optimized async engine ensuring solid 20 TPS even under heavy player load."
        )
        .setFooter({ text: "LS STUDIO • Hỗ trợ nhiệt tình / Worldwide Support" });

      await ch.send({ embeds: [embed], components: [makeActionButtons()] });
    });

    // ==========================================
    // 3. KÊNH SẢN PHẨM: #🚫・ls-anticlient
    // ==========================================
    const chClient = channels.find(c => c && c.name.includes("ls-anticlient"));
    await refreshChannel(chClient, async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#ED4245")
        .setTitle("🚫 LS-ANTICLIENT & BRANDSHIELD")
        .setDescription(
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Hệ thống nhận diện và chặn đứng các Hacked Client phổ biến ngay từ cổng vào.\n\n" +
          "• **Giá bán:** `99.000 VNĐ` • **Price:** `~$4.00 USD`\n" +
          "• **Nền tảng hỗ trợ:** Paper, Purpur, Folia 1.16 đến 1.21+\n\n" +
          "🛡️ **Tính năng nổi bật:**\n" +
          "• **Chặn Client Hack:** Tự động phân tích Client Brand và Packet để chặn Meteor, LiquidBounce, Aristois, Fabric Cheats.\n" +
          "• **Chống giả mạo:** Ngăn chặn các bản mod đổi tên brand giả danh Vanilla để vượt rào.\n" +
          "• **Hành động linh hoạt:** Tự động Kick, Cảnh báo Staff hoặc ghi log vi phạm rõ ràng.\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "Smart packet & client brand analyzer to block popular hacked clients upon connection.\n\n" +
          "🛡️ **Core Features:**\n" +
          "• **Hacked Client Blocker:** Identifies and blocks Meteor, LiquidBounce, Aristois, Fabric Cheat clients.\n" +
          "• **Anti-Spoofing:** Detects and denies spoofed vanilla brand packets.\n" +
          "• **Flexible Actions:** Automatic kick, staff alerts, or silent violation logging."
        )
        .setFooter({ text: "LS STUDIO • Hỗ trợ nhiệt tình / Worldwide Support" });

      await ch.send({ embeds: [embed], components: [makeActionButtons()] });
    });

    // ==========================================
    // 4. KÊNH SẢN PHẨM: #🎁・ls-giftcode
    // ==========================================
    const chGc = channels.find(c => c && c.name.includes("ls-giftcode"));
    await refreshChannel(chGc, async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#FEE75C")
        .setTitle("🎁 LS-GIFTCODE & REWARDS")
        .setDescription(
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Hệ thống tạo mã code quà tặng chuyên nghiệp dành cho Server Minecraft.\n\n" +
          "• **Giá bán:** `30.000 VNĐ` • **Price:** `~$1.50 USD`\n" +
          "• **Nền tảng hỗ trợ:** Paper, Purpur, Folia 1.16 đến 1.21+\n\n" +
          "📦 **Tính năng nổi bật:**\n" +
          "• **Tạo mã linh hoạt:** Tạo Giftcode tân thủ, code sự kiện, code đền bù bảo trì không giới hạn.\n" +
          "• **Giới hạn & Hạn dùng:** Đặt số lượt nhập cho từng người chơi hoặc toàn server, hẹn giờ hết hạn code tự động.\n" +
          "• **Phần thưởng phong phú:** Tự phát Item có lore và enchant, tiền Vault, chạy lệnh Console tự động.\n" +
          "• **Lưu trữ nhẹ nhàng:** Hỗ trợ MySQL và SQLite lưu trữ async cực nhẹ.\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "Professional gift code & reward redeem system for Minecraft servers.\n\n" +
          "📦 **Core Features:**\n" +
          "• **Flexible Code Creation:** Create unlimited starter packs, event codes, and compensation codes.\n" +
          "• **Usage Limits & Expiration:** Set per-player or global claim limits with automated expiry timers.\n" +
          "• **Diverse Rewards:** Supports custom items, Vault economy money, and automatic console commands.\n" +
          "• **Lightweight Database:** Fully async MySQL & SQLite data storage."
        )
        .setFooter({ text: "LS STUDIO • Hỗ trợ nhiệt tình / Worldwide Support" });

      await ch.send({ embeds: [embed], components: [makeActionButtons()] });
    });

    // ==========================================
    // 5. KÊNH SẢN PHẨM: #👑・combo-anti
    // ==========================================
    const chCombo = channels.find(c => c && c.name.includes("combo-anti"));
    await refreshChannel(chCombo, async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#FF73FA")
        .setTitle("👑 COMBO TRỌN BỘ 2 PLUGIN ANTI")
        .setDescription(
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Sở hữu trọn bộ 2 giải pháp bảo vệ cốt lõi cho server với giá ưu đãi tiết kiệm nhất.\n\n" +
          "• **Giá Combo:** `129.000 VNĐ` • Tiết kiệm 29.000 VNĐ so với mua lẻ\n" +
          "• **Combo Price:** `~$5.50 USD` • Save $1.50 compared to separate purchases\n" +
          "• **Nền tảng hỗ trợ:** Paper, Purpur, Folia 1.16 đến 1.21+\n\n" +
          "🌟 **Bao gồm:**\n" +
          "1. **LS-AntiFreeCam & Obfuscator:** Chống soi rương, soi quặng, khắc chế Baritone đào tự động.\n" +
          "2. **LS-AntiClient & BrandShield:** Nhận diện và chặn đứng hack client Meteor, LiquidBounce, Aristois...\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "Get both essential server security solutions at an exclusive discounted bundle price.\n\n" +
          "🌟 **Includes:**\n" +
          "1. **LS-AntiFreeCam & Obfuscator:** Complete anti-xray, chest esp, and anti-baritone mining.\n" +
          "2. **LS-AntiClient & BrandShield:** Instant detection and denial for Meteor, LiquidBounce, Aristois..."
        )
        .setFooter({ text: "LS STUDIO • Hỗ trợ nhiệt tình / Worldwide Support" });

      await ch.send({ embeds: [embed], components: [makeActionButtons()] });
    });

    // ==========================================
    // 6. KÊNH SẢN PHẨM: #🧩・mod-custom-java
    // ==========================================
    const chMod = channels.find(c => c && c.name.includes("mod-custom-java"));
    await refreshChannel(chMod, async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#9C27B0")
        .setTitle("🧩 DỊCH VỤ LẬP TRÌNH MOD CUSTOM CHO MINECRAFT JAVA")
        .setDescription(
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Nhận thiết kế và lập trình Mod độc quyền theo đúng tính năng bạn yêu cầu.\n\n" +
          "• **Nền tảng hỗ trợ:** Forge, Fabric, NeoForge, Quilt từ phiên bản 1.16 đến 1.21+\n" +
          "• **Phạm vi nhận làm:** Tùy theo tính năng khách hàng yêu cầu.\n" +
          "• **Lưu ý:** Chỉ nhận làm cho Minecraft Java Edition trên máy tính PC, không nhận bản Bedrock PE.\n" +
          "• **Giá:** Thỏa thuận theo ý tưởng trực tiếp trong Ticket.\n\n" +
          "🛠️ **Các hạng mục phổ biến:**\n" +
          "• Vũ khí, dụng cụ, áo giáp tùy chỉnh kèm hiệu ứng kỹ năng riêng.\n" +
          "• Khối block, cây trồng, quặng mới.\n" +
          "• Quái vật, sinh vật, Boss mới với hoạt ảnh chuyển động riêng.\n" +
          "• Giao diện Menu, kho đồ tùy biến.\n" +
          "• Mod cơ chế gameplay độc quyền cho Server hoặc Modpack.\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "Custom Minecraft Java Mod Development built exactly to your specifications.\n\n" +
          "• **Supported Platforms:** Forge, Fabric, NeoForge, Quilt (1.16 to 1.21+ Java PC).\n" +
          "• **Scope:** Any custom feature, mechanics, or items you require.\n" +
          "• **Notice:** PC Java Edition only (Bedrock/PE is not supported).\n" +
          "• **Price:** Negotiable based on project complexity.\n\n" +
          "🛠️ **Popular Categories:**\n" +
          "• Custom weapons, tools, armor sets with unique skill effects.\n" +
          "• Custom blocks, ores, crops, and world generation.\n" +
          "• Custom mobs, entities, and animated bosses.\n" +
          "• Custom GUI menus, HUDs, and inventory screens.\n" +
          "• Exclusive gameplay mechanics for servers and modpacks."
        )
        .setFooter({ text: "LS STUDIO • Hỗ trợ nhiệt tình / Worldwide Support" });

      await ch.send({ embeds: [embed], components: [makeActionButtons()] });
    });

    // ==========================================
    // 7. KÊNH BẢNG GIÁ: #💰・bảng-giá
    // ==========================================
    const chPrice = channels.find(c => c && c.name.includes("bảng-giá"));
    await refreshChannel(chPrice, async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#FEE75C")
        .setTitle("💰 BẢNG GIÁ DỊCH VỤ / PRICE LIST - LS STUDIO")
        .setDescription(
          "Bảng giá công khai minh bạch, hỗ trợ bảo hành và cập nhật tận tình:\n" +
          "*Transparent pricing with continuous updates and dedicated developer support:*"
        )
        .addFields(
          {
            name: "📦 1. Plugin Có Sẵn • Paper / Purpur / Folia 1.16 - 1.21+",
            value: 
              "• 🛡️ **LS-AntiCheat:** `30.000 VNĐ` • `~$1.50 USD`\n" +
              "• 🎁 **LS-GiftCode:** `30.000 VNĐ` • `~$1.50 USD`\n" +
              "• 👁️ **LS-AntiFreeCam:** `59.000 VNĐ` • `~$2.50 USD`\n" +
              "• 🚫 **LS-AntiClient:** `99.000 VNĐ` • `~$4.00 USD`\n" +
              "• 👑 **Combo 2 Plugin Anti:** `129.000 VNĐ` • `~$5.50 USD`"
          },
          {
            name: "🛠️ 2. Lập Trình Plugin Riêng / Custom Plugin Dev",
            value: 
              "• Hỗ trợ tối ưu cho Paper, Purpur, Folia 1.16 đến 1.21+\n" +
              "• Plugin tiện ích, lệnh, giao diện: `50k - 150k` • `~$2 - $6 USD`\n" +
              "• Hệ thống gameplay, minigame riêng: `200k - 500k` • `~$8 - $20 USD`\n" +
              "• Dự án lớn: Thỏa thuận theo độ phức tạp / Negotiable"
          },
          {
            name: "🧩 3. Lập Trình Mod Custom Cho Java / Custom Java Mod Dev",
            value: 
              "• Nền tảng: Forge, Fabric, NeoForge 1.16 đến 1.21+ Java PC\n" +
              "• Hạng mục: Tùy theo tính năng khách hàng yêu cầu / Custom specs\n" +
              "• Báo giá: Trao đổi ý tưởng trong Ticket để nhận báo giá chi tiết"
          },
          {
            name: "💳 4. Thanh Toán / Payment Methods",
            value: 
              "• 🇻🇳 **Việt Nam:** MBBank Quân Đội • STK `844515133333` • Tên **VAN HUU PHAM NGUYEN**\n" +
              "• 🌐 **Global:** PayPal / Crypto / Card (Open ticket for payment link)"
          }
        )
        .setFooter({ text: "Giao dịch an toàn qua Ticket tại LS STUDIO / Secure Ticket Transactions" });

      await ch.send({ embeds: [embed], components: [makeActionButtons()] });
    });

    // ==========================================
    // 8. KÊNH THÔNG BÁO: #📢・thông-báo
    // ==========================================
    const chTb = channels.find(c => c && c.name.includes("thông-báo"));
    await refreshChannel(chTb, async (ch) => {
      const chBuy = channels.find(c => c && c.name.includes("mua-plugin"));
      const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("🚀 CHÀO MỪNG ĐẾN VỚI LS STUDIO / WELCOME TO LS STUDIO")
        .setDescription(
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Chào anh em! **LS STUDIO** chuyên tự phát triển các **Plugin Minecraft, Hệ Thống Chống Hack và Mod Custom cho Minecraft Java** tối ưu mượt mà cho Paper, Purpur và Folia 1.16 đến 1.21+.\n\n" +
          "🛠️ **Danh mục sản phẩm:**\n" +
          `• 🛡️ AntiCheat Đa Năng: <#${chAc?.id}>\n` +
          `• 👁️ Chống Freecam và X-Ray: <#${chFc?.id}>\n` +
          `• 🚫 Chặn Hacked Client: <#${chClient?.id}>\n` +
          `• 🎁 Quà Tặng GiftCode: <#${chGc?.id}>\n` +
          `• 👑 Combo Tiết Kiệm: <#${chCombo?.id}>\n` +
          `• 🧩 Mod Custom Java: <#${chMod?.id}>\n` +
          `• 💰 Bảng Giá Tổng Hợp: <#${chPrice?.id}>\n` +
          `• 🛒 Mở Ticket Đặt Hàng: <#${chBuy?.id}>\n\n` +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "Welcome to **LS STUDIO**! We specialize in developing high-performance **Minecraft Plugins, Anti-Cheat solutions, and Custom Java Mods** for Paper, Purpur, and Folia 1.16 to 1.21+.\n\n" +
          "Browse our channels above or open a ticket at <#" + chBuy?.id + "> to place an order!"
        )
        .setFooter({ text: "LS STUDIO • Lead Developer: Nguyendzvn" });

      await ch.send({ embeds: [embed], components: [makeActionButtons()] });
    });

    // ==========================================
    // 9. KÊNH LUẬT LỆ: #📜・luật-lệ
    // ==========================================
    const chRules = channels.find(c => c && c.name.includes("luật-lệ"));
    await refreshChannel(chRules, async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("📜 QUY ĐỊNH MÁY CHỦ / SERVER RULES - LS STUDIO")
        .setDescription(
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "1. Tôn trọng tất cả các thành viên và ban quản trị.\n" +
          "2. Không spam, quảng cáo server hoặc gửi link độc hại.\n" +
          "3. Không phát tán (leak) các sản phẩm độc quyền của LS Studio.\n" +
          "4. Giao dịch mua bán chỉ diễn ra tại hệ thống Ticket chính thức của Studio.\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "1. Be respectful to all members and staff.\n" +
          "2. No spamming, advertising other servers, or posting malicious links.\n" +
          "3. Do not leak or redistribute exclusive LS Studio plugins and mods.\n" +
          "4. All purchases and orders must be conducted inside official Tickets."
        )
        .setFooter({ text: "LS STUDIO • Tuân thủ quy định để xây dựng cộng đồng văn minh" });

      await ch.send({ embeds: [embed] });
    });

    // ==========================================
    // 10. KÊNH MUA PLUGIN: #🛒・mua-plugin
    // ==========================================
    const chBuy = channels.find(c => c && c.name.includes("mua-plugin"));
    await refreshChannel(chBuy, async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#00E676")
        .setTitle("🛒 TRUNG TÂM MUA HÀNG / ORDER CENTER - LS STUDIO")
        .setDescription(
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Bấm vào nút **Mở Ticket Đặt Mua** bên dưới để tạo kênh mua hàng riêng tư.\n" +
          "• Hệ thống tự động tạo mã **VietQR MBBank** để thanh toán siêu tốc 24/7.\n" +
          "• Sau khi chuyển khoản, Staff sẽ duyệt và giao file ngay trong Ticket!\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "Click the **Buy Ticket / Open Order** button below to create your private ticket.\n" +
          "• Supports **VietQR Bank Transfer** or **PayPal / Global Payment**.\n" +
          "• Our staff will assist you and deliver your files directly in the ticket!"
        )
        .setFooter({ text: "LS STUDIO • Hỗ trợ 24/7 / Available 24/7" });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_buy")
          .setLabel("🛒 Mở Ticket Đặt Mua / Buy Ticket")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("ticket_pricing")
          .setLabel("💰 Xem Bảng Giá / Price List")
          .setStyle(ButtonStyle.Secondary)
      );

      await ch.send({ embeds: [embed], components: [row] });
    });

    // ==========================================
    // 11. KÊNH HỖ TRỢ KỸ THUẬT: #🛠️・hỗ-trợ-kỹ-thuật
    // ==========================================
    const chSupport = channels.find(c => c && c.name.includes("hỗ-trợ-kỹ-thuật"));
    await refreshChannel(chSupport, async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#3D5AFE")
        .setTitle("🛠️ HỖ TRỢ KỸ THUẬT / TECH SUPPORT - LS STUDIO")
        .setDescription(
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Nếu bạn gặp lỗi trong quá trình sử dụng Plugin/Mod hoặc cần hỗ trợ config, hãy bấm nút bên dưới để mở Ticket hỗ trợ kỹ thuật 1-1 với Developer!\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "If you encounter bugs, compatibility errors, or need configuration help, click below to open a 1-on-1 Tech Support Ticket with our Lead Developer!"
        )
        .setFooter({ text: "LS STUDIO • Hỗ trợ tận tình / Dedicated Support" });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_support")
          .setLabel("🛠️ Mở Ticket Hỗ Trợ / Open Support Ticket")
          .setStyle(ButtonStyle.Primary)
      );

      await ch.send({ embeds: [embed], components: [row] });
    });

    // ==========================================
    // 12. KÊNH ĐẶT LÀM PLUGIN: #📝・đặt-làm-plugin
    // ==========================================
    const chCustom = channels.find(c => c && c.name.includes("đặt-làm-plugin"));
    await refreshChannel(chCustom, async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#FF4500")
        .setTitle("📝 ĐẶT LÀM PLUGIN & MOD RIÊNG / CUSTOM DEV - LS STUDIO")
        .setDescription(
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Bạn có ý tưởng Plugin hoặc Mod độc quyền cho server của mình? Bấm nút bên dưới để trao đổi chi tiết ý tưởng, nhận báo giá và thời gian hoàn thành từ Developer!\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "Have a unique Plugin or Java Mod idea for your server? Click below to discuss your custom project, get a quotation, and timeline directly from our Developer!"
        )
        .setFooter({ text: "LS STUDIO • Cam kết đúng hẹn, tối ưu mượt mà" });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_custom")
          .setLabel("📝 Mở Ticket Đặt Làm Riêng / Custom Order")
          .setStyle(ButtonStyle.Danger)
      );

      await ch.send({ embeds: [embed], components: [row] });
    });

    // ==========================================
    // 13. KÊNH SERVER TEST DEMO: #🌐・server-test-demo
    // ==========================================
    const chDemo = channels.find(c => c && c.name.includes("server-test-demo"));
    await refreshChannel(chDemo, async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#00E5FF")
        .setTitle("🌐 SERVER TRẢI NGHIỆM THỰC TẾ / LIVE DEMO SERVER")
        .setDescription(
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Mời anh em vào trực tiếp server đối tác **Nguyen SMP** để test thực tế độ mượt và hiệu quả của các Plugin Anti-Cheat từ LS STUDIO:\n\n" +
          "• 🎮 **Tên Server:** Nguyen SMP Survival\n" +
          "• 📡 **IP Máy Chủ:** `fusion.pikamc.vn:26111`\n" +
          "• ⚡ **Phiên bản:** `1.21+`\n" +
          "• 🔗 **Discord Server:** https://discord.gg/vjFkC6cRdj\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "Join our partner live server **Nguyen SMP** to experience LS STUDIO anti-cheat plugins and performance in action:\n\n" +
          "• 🎮 **Server Name:** Nguyen SMP Survival\n" +
          "• 📡 **Server IP:** `fusion.pikamc.vn:26111`\n" +
          "• ⚡ **Version:** `1.21+`\n" +
          "• 🔗 **Discord Invite:** https://discord.gg/vjFkC6cRdj"
        )
        .setFooter({ text: "LS STUDIO & Nguyen SMP • Đối tác chiến lược / Strategic Partners" });

      await ch.send({ embeds: [embed] });
    });

    console.log("🎉 ĐÃ CẬP NHẬT TOÀN BỘ 13 KÊNH SANG SONG NGỮ VI & EN HOÀN TẤT 100%!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Lỗi:", err);
    process.exit(1);
  }
});

client.login(TOKEN);
