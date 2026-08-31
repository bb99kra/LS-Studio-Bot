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
  console.log(`🤖 Logged in as ${client.user.tag}! Cập nhật lại kênh...`);

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
          .setLabel("🛒 Mở Ticket Đặt Mua / Buy Ticket")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("ticket_pricing")
          .setLabel("💰 Bảng Giá / Price List")
          .setStyle(ButtonStyle.Secondary)
      );
    }

    // 1. KÊNH #🛡️・ls-anticheat
    const chAc = channels.find(c => c && c.name.includes("ls-anticheat"));
    await refreshChannel(chAc, async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("🛡️ LS-ANTICHEAT • BEHAVIOR, WALLHIT & CART SECURITY")
        .setDescription(
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "Giải pháp chống gian lận toàn diện, tối ưu nhẹ mượt cho Paper, Purpur, Folia 1.16 đến 1.21+.\n\n" +
          "• **Giá bản gốc:** `30.000 VNĐ` • Bản quyền vĩnh viễn\n" +
          "• **Addon Anti-Macro Cart:** `20.000 VNĐ / Tháng` • Gói bảo vệ phương tiện nâng cao\n" +
          "• **Nền tảng hỗ trợ:** Paper, Purpur, Folia 1.16 đến 1.21+\n\n" +
          "⚔️ **TÍNH NĂNG BẢN GỐC (30K):**\n" +
          "• **Chống WallHit & Raytrace:** Chặn Killaura đánh xuyên tường, xuyên block chắn, đặc biệt chặn triệt để hack đánh xuyên **Mạng Nhện Cobweb**, cửa và kính.\n" +
          "• **Chống gian lận PvP:** Chặn tự động ăn thức ăn siêu tốc, chặn auto câu cá AFK, chặn auto ném và uống potion tức thì khi tụt máu.\n" +
          "• **Chống macro khiên:** Chặn vừa giơ khiên vừa chém, vừa che khiên vừa chạy nước rút, chặn click bật tắt khiên 0ms.\n" +
          "• **Kiểm tra kho đồ (Inventory A-F):** Chặn vừa mở hòm đồ vừa đi lại, chém nhau hoặc lia chuột. Tóm gọn AutoClicker bằng thuật toán phân tích độ lệch chuẩn.\n" +
          "• **Bắt BadPacket:** Phát hiện đánh không vung tay NoSwing, Killaura Forcefield, Aimbot khóa góc nhìn máy móc.\n" +
          "• **Fake Info chống soi đồ:** Giả lập máu ảo làm sai lệch mod hiển thị máu, giấu bùa phù phép và độ bền giáp thật.\n\n" +
          "🛒 **TÍNH NĂNG ADDON ANTI-MACRO CART (20K/THÁNG):**\n" +
          "• **Chặn Macro Tốc Độ:** Chặn đứng hack/macro lợi dụng Minecart và Thuyền (Boat) để di chuyển với tốc độ bất thường xuyên địa hình.\n" +
          "• **Chống Bug Bất Tử:** Khắc chế triệt để lỗi bất tử khi spam liên tục lên/xuống xe mỏ (Invulnerability Cart Glitch).\n" +
          "• **Chống Lag Server:** Chống spam packet Mount/Dismount gây tụt TPS hoặc dịch chuyển xuyên vật thể.\n\n" +
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
          "• **Anti-Macro Cart Addon:** Blocks Minecart/Boat macro speed exploits, invulnerability glitch, and mount/dismount packet spam."
        )
        .setFooter({ text: "LS STUDIO • Hỗ trợ nhiệt tình / Worldwide Support" });

      await ch.send({ embeds: [embed], components: [makeActionButtons()] });
    });

    // 2. KÊNH #🚀・cập-nhật-changelog
    const chLogs = channels.find(c => c && c.name.includes("cập-nhật-changelog"));
    await refreshChannel(chLogs, async (ch) => {
      const embed = new EmbedBuilder()
        .setColor("#00E676")
        .setTitle("🚀 BẢN CẬP NHẬT MỚI: RA MẮT ADDON ANTI-MACRO CART!")
        .setDescription(
          "🇻🇳 **TIẾNG VIỆT:**\n" +
          "LS STUDIO chính thức phát hành bản cập nhật mới nhất cho hệ sinh thái **LS-AntiCheat**:\n\n" +
          "✨ **Các tính năng mới:**\n" +
          "• 🚂 **Ra mắt Addon Anti-Macro Cart (20k/tháng):**\n" +
          "  - Chặn đứng hack/macro lợi dụng Minecart và Thuyền (Boat) để di chuyển với tốc độ bất thường.\n" +
          "  - Chống triệt để bug bất tử khi liên tục lên xuống xe mỏ (Invulnerability Cart Glitch).\n" +
          "  - Chống spam packet Mount/Dismount gây lag máy chủ hoặc dịch chuyển xuyên vật thể.\n" +
          "• 🛡️ **Nâng cấp LS-AntiCheat gốc (30k vĩnh viễn):** Tối ưu thuật toán bắt WallHit xuyên mạng nhện Cobweb và Inventory A-F mượt mà 0% false positive.\n\n" +
          "────────────────────────────────────────\n" +
          "🇺🇸 **ENGLISH:**\n" +
          "LS STUDIO officially releases the latest update for **LS-AntiCheat**:\n\n" +
          "✨ **What's New:**\n" +
          "• 🚂 **Anti-Macro Cart Addon Release ($1.00/Month):** Complete protection against Minecart/Boat macro speed exploits, invulnerability glitches, and packet spam.\n" +
          "• 🛡️ **Core AntiCheat Performance Update:** Improved Raytracing accuracy for Cobweb WallHit checks and zero false positives."
        )
        .setFooter({ text: "LS STUDIO • Version 2026.08 Update" })
        .setTimestamp();

      await ch.send({ embeds: [embed] });
    });

    console.log("🎉 ĐÃ HOÀN TẤT CẬP NHẬT ĐỒNG BỘ 100%!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Lỗi:", err);
    process.exit(1);
  }
});

client.login(TOKEN);
