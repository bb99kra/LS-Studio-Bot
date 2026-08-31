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
  console.log(`🤖 Logged in as ${client.user.tag}! Thêm Addon Anti-Macro Cart (20k/tháng)...`);

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

    // 1. CẬP NHẬT KÊNH #🛡️・ls-anticheat
    const chAc = channels.find(c => c && c.name.includes("ls-anticheat"));
    await refreshChannel(chAc, async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("🛡️ LS-ANTICHEAT • BEHAVIOR, WALLHIT & CART SECURITY")
        .setDescription(
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Giải pháp chống gian lận đa năng, tối ưu nhẹ mượt cho Paper, Purpur, Folia 1.16 đến 1.21+.\n\n" +
          "• **Giá bản gốc:** `30.000 VNĐ` • Vĩnh viễn\n" +
          "• **Addon Anti-Macro Cart:** `20.000 VNĐ / Tháng` • Gói nâng cao chống lạm dụng xe mỏ\n" +
          "• **Nền tảng hỗ trợ:** Paper, Purpur, Folia 1.16 đến 1.21+\n\n" +
          "⚔️ **Tính năng cốt lõi:**\n" +
          "• **Chống WallHit & Raytrace:** Chặn Killaura đánh xuyên tường, xuyên block, đặc biệt chặn hack đánh xuyên **Mạng Nhện Cobweb**, cửa và kính.\n" +
          "• **Chống gian lận PvP:** Chặn tự động ăn thức ăn, tự động câu cá AFK, tự động ném và uống potion tức thì.\n" +
          "• **Chống macro khiên:** Chặn vừa giơ khiên vừa chém, vừa che khiên vừa chạy nước rút, click bật tắt khiên 0ms.\n" +
          "• **Kiểm tra kho đồ (Inventory A-F):** Chặn vừa mở hòm đồ vừa đi lại, chém nhau hoặc lia chuột. Tóm AutoClicker bằng thuật toán thống kê.\n" +
          "• **Bắt BadPacket:** Phát hiện NoSwing, Killaura Forcefield, Aimbot khóa góc nhìn.\n" +
          "• **Fake Info:** Giả lập máu ảo, giấu bùa phù phép và độ bền giáp thật.\n\n" +
          "🛒 **TÍNH NĂNG ADDON ANTI-MACRO CART (20K/THÁNG):**\n" +
          "• Chặn đứng hack/macro lợi dụng Minecart và Thuyền (Boat) để di chuyển với tốc độ bất thường.\n" +
          "• Chống bug bất tử khi liên tục lên xuống xe mỏ (Invulnerability Cart Glitch).\n" +
          "• Chống spam packet Mount/Dismount gây lag máy chủ hoặc dịch chuyển xuyên vật thể.\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "Advanced behavioral anti-cheat and wall-hit security engine for Paper, Purpur, Folia 1.16 to 1.21+.\n\n" +
          "• **Core Plugin:** `30.000 VNĐ` (~`$1.50 USD`) • Lifetime\n" +
          "• **Anti-Macro Cart Addon:** `20.000 VNĐ / Month` (~`$1.00 USD / Mo`)\n\n" +
          "🛡️ **Core Features:**\n" +
          "• **WallHit & Raytrace:** Blocks attacks through cobwebs, walls, doors, glass.\n" +
          "• **PvP & Utility:** Blocks AutoEat, AutoFish AFK, AutoPotion, Shield macro.\n" +
          "• **Inventory A-F:** Prevents moving/fighting with open GUI. Heuristic autoclicker detection.\n" +
          "• **BadPacket & Spoofing:** NoSwing, Forcefield, Aimbot detection, fake health spoof.\n" +
          "• **Anti-Macro Cart Addon:** Blocks Minecart/Boat macro speed exploits, invulnerability glitches, and mount/dismount packet spam."
        )
        .setFooter({ text: "LS STUDIO • Hỗ trợ nhiệt tình / Worldwide Support" });

      await ch.send({ embeds: [embed], components: [makeActionButtons()] });
    });

    // 2. CẬP NHẬT KÊNH #💰・bảng-giá
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
              "• 🛡️ **LS-AntiCheat (Bản Gốc):** `30.000 VNĐ` • `~$1.50 USD`\n" +
              "• 🛒 **Addon Anti-Macro Cart:** `20.000 VNĐ / Tháng` • `~$1.00 USD / Mo`\n" +
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

    console.log("🎉 ĐÃ CẬP NHẬT ADDON ANTI-MACRO CART THÀNH CÔNG 100%!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Lỗi:", err);
    process.exit(1);
  }
});

client.login(TOKEN);
