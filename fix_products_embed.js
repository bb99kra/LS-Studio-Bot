const fs = require('fs');
const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder 
} = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN || (fs.existsSync('./token.local.js') ? require('./token.local.js').TOKEN : 'YOUR_BOT_TOKEN_HERE');
const LS_STUDIO_GUILD_ID = "1542476657825419334";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.once('clientReady', async () => {
  try {
    const guild = await client.guilds.fetch(LS_STUDIO_GUILD_ID);
    const ch = await guild.channels.fetch("1542479128534716438");

    if (ch) {
      const messages = await ch.messages.fetch({ limit: 15 });
      for (const [id, msg] of messages) {
        if (msg.author.id === client.user.id) await msg.delete().catch(() => {});
      }

      const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("💎 CÁC SẢN PHẨM & DỊCH VỤ - LS STUDIO")
        .setDescription(
          "Toàn bộ Plugin & Mod do LS Studio tự phát triển, tối ưu async nhẹ mượt và hỗ trợ lâu dài:"
        )
        .addFields(
          {
            name: "🛡️ 1. LS-AntiCheat (Full Module)",
            value: 
              "• **🧱 Check WallHit:** Chống đánh xuyên tường, xuyên block, chống đánh xuyên **Mạng Nhện (Cobweb)**, cửa, kính.\n" +
              "• **⚔️ Check PvP & Utility:** AutoPotion, AutoFish, AutoEat, ShieldHit (vừa giơ khiên vừa chém), ShieldSprint, ShieldInstantTap.\n" +
              "• **🎒 Check Inventory (A, B, C, D, F):**\n" +
              "  - **Type A:** Thống kê Click Heuristic & Kurtosis/Skewness (AutoClicker).\n" +
              "  - **Type B:** InvMove / InvSprint (Chống mở túi đồ khi đang đi/chạy).\n" +
              "  - **Type C:** InvHit (Chống vừa mở túi đồ vừa chém người).\n" +
              "  - **Type D:** InvRotate (Chống vừa mở túi đồ vừa lia chuột).\n" +
              "  - **Type F:** FastClick, MultiInteraction (click nhiều slot), PerfectExit.\n" +
              "• **📡 Check BadPacket:** NoSwing/Forcefield, EqualRotations, PerfectRotation (Aimbot), IllegalPitch.\n" +
              "• **🎭 Fake Info & Obfuscator:** DamageIndicators Spoof (máu ảo chống hack soi máu), Max Health, EnchantmentHider, DurabilityHider.\n" +
              "• **Hỗ trợ:** Paper / Purpur / Folia (1.16 - 1.21+)\n" +
              "• **Giá:** `30.000 VNĐ`"
          },
          {
            name: "👁️ 2. LS-AntiFreeCam & Obfuscator",
            value: 
              "• **Tính năng:** Ẩn quặng quý và rương đồ khi ngoài tầm nhìn, khắc chế triệt để Freecam, Chest ESP, Baritone đào tự động.\n" +
              "• **Hỗ trợ:** Paper / Purpur / Folia (1.16 - 1.21+)\n" +
              "• **Giá:** `59.000 VNĐ`"
          },
          {
            name: "🚫 3. LS-AntiClient & BrandShield",
            value: 
              "• **Tính năng:** Phân tích packet nhận diện và chặn các client hack phổ biến (Meteor, LiquidBounce, Aristois, Wurst, Fabric Cheats...).\n" +
              "• **Hỗ trợ:** Paper / Purpur / Folia (1.16 - 1.21+)\n" +
              "• **Giá:** `99.000 VNĐ`"
          },
          {
            name: "🎁 4. LS-GiftCode & Rewards",
            value: 
              "• **Tính năng:** Tạo Giftcode tân thủ, code event, code đền bù; giới hạn lượt nhập; phát item/tiền Vault tự động; lưu async MySQL/SQLite.\n" +
              "• **Hỗ trợ:** Paper / Purpur / Folia (1.16 - 1.21+)\n" +
              "• **Giá:** `30.000 VNĐ`"
          },
          {
            name: "👑 5. Combo 2 Plugin Chống Hack (AntiFreeCam + AntiClient)",
            value: 
              "• **Tính năng:** Sở hữu trọn bộ 2 giải pháp bảo vệ cốt lõi cho server với giá ưu đãi tiết kiệm.\n" +
              "• **Hỗ trợ:** Paper / Purpur / Folia (1.16 - 1.21+)\n" +
              "• **Giá Combo:** `129.000 VNĐ`"
          },
          {
            name: "🧩 6. Dịch Vụ Lập Trình MOD Custom (CHỈ MINECRAFT JAVA)",
            value: 
              "• **Nền tảng:** Forge / Fabric / NeoForge / Quilt (1.16 - 1.21+)\n" +
              "• **Nhận làm:** Tùy theo tính năng của khách hàng yêu cầu.\n" +
              "• ⚠️ **Lưu ý:** *Chỉ nhận làm cho Minecraft Java Edition (PC), không nhận Bedrock/PE.*\n" +
              "• **Giá:** `Thỏa thuận theo ý tưởng`"
          }
        )
        .setFooter({ text: "Mở Ticket tại #🛒・mua-plugin để đặt mua và nhận file ngay!" });

      await ch.send({ embeds: [embed] });
      console.log("✅ Kênh 💎・sản-phẩm-plugin đã cập nhật hoàn hảo!");
    }
    process.exit(0);
  } catch (err) {
    console.error("❌ Lỗi:", err);
    process.exit(1);
  }
});

client.login(TOKEN);
