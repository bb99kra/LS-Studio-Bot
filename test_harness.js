/**
 * ============================================================================
 * LS STUDIO - COMPREHENSIVE DYNAMIC TEST HARNESS & DRY-RUN SIMULATION SUITE
 * ============================================================================
 * 100% Mock Discord Interactions, Events, Commands, Menus, Buttons & Setup
 * ============================================================================
 */

const {
  client: botClient,
  PACKAGES,
  BANK_CONFIG,
  ORDER_CODE_REGEX,
  generateOrderCode,
  extractOrderCode,
  isValidOrderCode,
  formatVND,
  formatUSD,
  generateVietQRUrl,
  fetchVietQRBuffer,
  getPackage,
  getRateLimitRemaining,
  generateTranscript,
  buildPackageSelectMenu,
  ticketCreationLocks,
  userCooldowns,
  isStaffMember
} = require('./bot.js');

const { runServerSetup } = require('./setup_server.js');
const { PermissionsBitField, ChannelType, ButtonStyle, Events, Collection } = require('discord.js');

// ============================================================================
// TEST RUNNER INFRASTRUCTURE
// ============================================================================
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const testResults = [];
const unhandledErrors = [];

process.on('unhandledRejection', (reason) => {
  unhandledErrors.push({ type: 'unhandledRejection', reason: reason?.stack || reason });
  console.error('❌ [TEST HARNESS] Captured Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  unhandledErrors.push({ type: 'uncaughtException', error: err?.stack || err });
  console.error('❌ [TEST HARNESS] Captured Uncaught Exception:', err);
});

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Assertion Failed [${message}]: Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

async function waitForInteraction(interaction, timeoutMs = 2000) {
  const start = Date.now();
  while (!interaction._state.replied && Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, 10));
  }
  await new Promise(r => setTimeout(r, 50));
}

async function runTest(suiteName, testName, fn) {
  totalTests++;
  process.stdout.write(`  ⏳ Running: ${testName}... `);
  try {
    await fn();
    passedTests++;
    testResults.push({ suite: suiteName, name: testName, status: 'PASS' });
    console.log(`\x1b[32m✔ PASS\x1b[0m`);
  } catch (err) {
    failedTests++;
    testResults.push({ suite: suiteName, name: testName, status: 'FAIL', error: err.message });
    console.log(`\x1b[31m✖ FAIL\x1b[0m\n      Error: ${err.message}`);
  }
}

// ============================================================================
// MOCK FACTORIES
// ============================================================================
function createMockUser({ id = null, username = 'testuser', tag = 'testuser#0001', bot = false } = {}) {
  const uid = id || '10' + Math.floor(1000000000000000 + Math.random() * 9000000000000000).toString();
  return {
    id: uid,
    username,
    tag,
    bot,
    send: async (payload) => ({ id: 'dm_msg_' + Date.now(), payload }),
    displayAvatarURL: (opts) => `https://cdn.discordapp.com/avatars/${uid}/avatar.png?size=${opts?.size || 128}`
  };
}

function createMockRole({ id = null, name = 'Thành Viên', position = 1, permissions = new PermissionsBitField(0n) } = {}) {
  const rid = id || '20' + Math.floor(1000000000000000 + Math.random() * 9000000000000000).toString();
  return {
    id: rid,
    name,
    position,
    permissions: permissions instanceof PermissionsBitField ? permissions : new PermissionsBitField(permissions),
    edit: async (data) => Object.assign({ id: rid, name, position, permissions }, data)
  };
}

function createMockGuildMember({
  id = null,
  user = null,
  roles = [],
  permissions = new PermissionsBitField(0n),
  moderatable = true,
  guild = null
} = {}) {
  const memberUser = user || createMockUser({ id });
  const mid = memberUser.id;
  const roleMap = new Collection();
  roles.forEach(r => roleMap.set(r.id, r));

  const member = {
    id: mid,
    user: memberUser,
    moderatable,
    permissions: permissions instanceof PermissionsBitField ? permissions : new PermissionsBitField(permissions),
    roles: {
      cache: roleMap,
      highest: roles.length > 0 ? roles.reduce((prev, curr) => (curr.position > prev.position ? curr : prev), roles[0]) : { position: 0 },
      add: async (role) => {
        roleMap.set(role.id, role);
        member.roles.highest = Array.from(roleMap.values()).reduce((prev, curr) => (curr.position > prev.position ? curr : prev), role);
        return member;
      },
      remove: async (role) => {
        roleMap.delete(role.id);
        return member;
      }
    },
    timeout: async (durationMs, reason) => {
      member.timedOutUntil = Date.now() + durationMs;
      member.timeoutReason = reason;
      return member;
    },
    guild: guild
  };
  return member;
}

function createMockChannel({
  id = null,
  name = 'general',
  type = ChannelType.GuildText,
  topic = '',
  parent = null,
  guild = null,
  messages = []
} = {}) {
  const cid = id || '30' + Math.floor(1000000000000000 + Math.random() * 9000000000000000).toString();
  const messageMap = new Collection();
  messages.forEach(m => messageMap.set(m.id, m));

  const channel = {
    id: cid,
    name,
    type,
    topic,
    parentId: parent?.id || null,
    parent: parent,
    guild,
    isTextBased: () => type === ChannelType.GuildText || type === ChannelType.GuildAnnouncement,
    permissionsFor: (member) => new PermissionsBitField([
      PermissionsBitField.Flags.ViewChannel,
      PermissionsBitField.Flags.SendMessages,
      PermissionsBitField.Flags.EmbedLinks,
      PermissionsBitField.Flags.AttachFiles,
      PermissionsBitField.Flags.ManageMessages,
      PermissionsBitField.Flags.ReadMessageHistory
    ]),
    messages: {
      fetch: async (opts) => messageMap,
      cache: messageMap
    },
    permissionOverwrites: {
      set: async (overwrites) => { channel.overwrites = overwrites; return channel; }
    },
    send: async (payload) => {
      const msgId = 'msg_' + Math.random().toString(36).substring(2, 9);
      const newMsg = {
        id: msgId,
        channel,
        content: payload.content || '',
        embeds: payload.embeds || [],
        components: payload.components || [],
        files: payload.files || [],
        createdTimestamp: Date.now(),
        author: { id: 'bot_id', tag: 'LS Studio Bot#0001', bot: true },
        delete: async () => { messageMap.delete(msgId); return newMsg; }
      };
      messageMap.set(msgId, newMsg);
      return newMsg;
    },
    delete: async (reason) => {
      channel.deleted = true;
      channel.deleteReason = reason;
      if (guild?.channels?.cache) {
        guild.channels.cache.delete(channel.id);
      }
      return channel;
    },
    edit: async (data) => {
      Object.assign(channel, data);
      return channel;
    },
    deletable: true
  };

  if (guild?.channels?.cache) {
    guild.channels.cache.set(cid, channel);
  }

  return channel;
}

function createMockGuild({ id = '1542476657825419334', name = 'LS STUDIO TEST SERVER' } = {}) {
  const roleMap = new Collection();
  const channelMap = new Collection();
  const memberMap = new Collection();

  const everyoneRole = createMockRole({ id, name: '@everyone', position: 0 });
  roleMap.set(everyoneRole.id, everyoneRole);

  const guild = {
    id,
    name,
    memberCount: 42,
    roles: {
      everyone: everyoneRole,
      cache: roleMap,
      fetch: async () => roleMap,
      create: async (data) => {
        const newRole = createMockRole({
          id: '20' + Math.floor(1000000000000000 + Math.random() * 9000000000000000).toString(),
          name: data.name,
          color: data.color,
          position: roleMap.size + 1,
          permissions: data.permissions || new PermissionsBitField(0n)
        });
        roleMap.set(newRole.id, newRole);
        return newRole;
      }
    },
    channels: {
      cache: channelMap,
      fetch: async () => channelMap,
      create: async (data) => {
        const newChannel = createMockChannel({
          name: data.name,
          type: data.type,
          topic: data.topic || '',
          parent: data.parent ? channelMap.get(data.parent) || { id: data.parent } : null,
          guild
        });
        return newChannel;
      }
    },
    members: {
      cache: memberMap,
      fetch: async (userId) => memberMap.get(userId) || null,
      fetchMe: async () => guild.members.me,
      me: null
    }
  };

  const botUser = createMockUser({ id: '109999999999999999', username: 'LS Studio Bot', tag: 'LS Studio Bot#0001', bot: true });
  const botRole = createMockRole({ id: '209999999999999999', name: '🤖・Bot Hệ Thống', position: 99, permissions: new PermissionsBitField([PermissionsBitField.Flags.Administrator, PermissionsBitField.Flags.ManageRoles, PermissionsBitField.Flags.ManageChannels]) });
  roleMap.set(botRole.id, botRole);
  const botMember = createMockMemberWithRole(botUser, [botRole], guild);
  guild.members.me = botMember;
  memberMap.set(botUser.id, botMember);

  return guild;
}

function createMockMemberWithRole(user, roles, guild) {
  const member = createMockGuildMember({
    id: user.id,
    user,
    roles,
    guild,
    permissions: roles.reduce((prev, r) => prev.add(r.permissions), new PermissionsBitField(0n))
  });
  return member;
}

function createMockInteraction({
  type = 'command',
  commandName = 'ping',
  customId = '',
  values = [],
  user = null,
  member = null,
  guild = null,
  channel = null,
  options = {}
} = {}) {
  const mockUser = user || createMockUser();
  const mockGuild = guild || createMockGuild();
  const mockChannel = channel || createMockChannel({ guild: mockGuild });
  const mockMember = member || createMockGuildMember({ id: mockUser.id, user: mockUser, guild: mockGuild });

  const state = {
    replied: false,
    deferred: false,
    ephemeral: false,
    replyPayload: null,
    editReplyPayload: null,
    updatePayload: null,
    followUpPayload: null,
    respondedAutocomplete: []
  };

  const interaction = {
    id: 'int_' + Math.random().toString(36).substring(2, 9),
    commandName,
    customId,
    values,
    user: mockUser,
    member: mockMember,
    guild: mockGuild,
    channel: mockChannel,
    client: botClient,
    createdTimestamp: Date.now() - 50,
    inGuild: () => !!mockGuild,
    isChatInputCommand: () => type === 'command',
    isButton: () => type === 'button',
    isStringSelectMenu: () => type === 'select',
    isAutocomplete: () => type === 'autocomplete',
    get replied() { return state.replied; },
    get deferred() { return state.deferred; },
    options: {
      getUser: (name, required) => options[name] || null,
      getString: (name, required) => options[name] || null,
      getInteger: (name, required) => options[name] || null
    },
    reply: async (payload) => {
      if (state.replied) throw new Error("Interaction already replied!");
      state.replied = true;
      state.ephemeral = !!payload?.ephemeral;
      state.replyPayload = payload;
      return payload;
    },
    deferReply: async (opts) => {
      if (state.deferred) throw new Error("Interaction already deferred!");
      state.deferred = true;
      state.ephemeral = !!opts?.ephemeral;
      return true;
    },
    editReply: async (payload) => {
      state.replied = true;
      state.editReplyPayload = payload;
      return payload;
    },
    update: async (payload) => {
      state.replied = true;
      state.updatePayload = payload;
      return payload;
    },
    followUp: async (payload) => {
      state.followUpPayload = payload;
      return payload;
    },
    respond: async (choices) => {
      state.respondedAutocomplete = choices;
      return choices;
    },
    _state: state
  };

  return interaction;
}

botClient.users = {
  fetch: async (id) => createMockUser({ id })
};

// ============================================================================
// MAIN TEST SUITES
// ============================================================================
async function runAllTests() {
  console.log("================================================================================");
  console.log("🧪 STARTING LS STUDIO DISCORD BOT & SETUP DRY-RUN TEST SUITE");
  console.log("================================================================================");

  // SUITE 1
  console.log("\n📦 [SUITE 1: Helper Functions & Unit Tests]");

  await runTest("Suite 1", "generateOrderCode format validation", async () => {
    const code = generateOrderCode();
    assert(typeof code === 'string', "Must be a string");
    assert(/^LS\d{6}$/.test(code), `Order code must match ^LS\\d{6}$, got: ${code}`);
  });

  await runTest("Suite 1", "extractOrderCode regex handling", async () => {
    assertEqual(extractOrderCode("Thanh toan don LS123456 thanh cong"), "LS123456", "Standard LS123456");
    assertEqual(extractOrderCode("Don hang LS-654321 nhe"), "LS654321", "Hyphenated LS-654321");
    assertEqual(extractOrderCode("Code ls_998877 duyet giup"), "LS998877", "Underscore ls_998877");
    assertEqual(extractOrderCode("Khong co ma don"), null, "No order code");
    assertEqual(extractOrderCode(null), null, "Null input");
  });

  await runTest("Suite 1", "isValidOrderCode validation", async () => {
    assert(isValidOrderCode("LS123456"), "LS123456 is valid");
    assert(isValidOrderCode("LSABCD"), "LSABCD is valid");
    assert(!isValidOrderCode("123456"), "Missing LS prefix is invalid");
    assert(!isValidOrderCode(""), "Empty string is invalid");
    assert(!isValidOrderCode(null), "Null is invalid");
  });

  await runTest("Suite 1", "formatVND & formatUSD formatting", async () => {
    assert(formatVND(30000).includes("30.000"), "formatVND standard");
    assertEqual(formatUSD(1.5), "$1.50 USD", "formatUSD standard");
    assertEqual(formatVND(0), "0 VNĐ", "formatVND zero");
    assertEqual(formatUSD(0), "$0.00 USD", "formatUSD zero");
    assertEqual(formatVND(null), "0 VNĐ", "formatVND null fallback");
  });

  await runTest("Suite 1", "generateVietQRUrl generation", async () => {
    const url = generateVietQRUrl({
      bankId: 'MB',
      accountNo: '844515133333',
      template: 'compact2',
      amount: 30000,
      addInfo: 'LS123456',
      accountName: 'VAN HUU PHAM NGUYEN'
    });
    assert(url.includes("https://img.vietqr.io/image/MB-844515133333-compact2.png"), "Base URL correct");
    assert(url.includes("amount=30000"), "Amount param included");
    assert(url.includes("addInfo=LS123456"), "addInfo param included");
  });

  await runTest("Suite 1", "fetchVietQRBuffer fallback behavior", async () => {
    const res = await fetchVietQRBuffer("https://invalid-non-existent-vietqr-domain-xyz.com/qr.png");
    assertEqual(res, null, "Should return null on network failure instead of crashing");
  });

  await runTest("Suite 1", "getPackage lookup & catalog integrity", async () => {
    const pkg = getPackage("ls_anticheat");
    assert(pkg !== null, "ls_anticheat must exist");
    assertEqual(pkg.price_vnd, 30000, "ls_anticheat price 30000");

    const allKeys = Object.keys(PACKAGES);
    assert(allKeys.length >= 15, `Catalog must have at least 15 packages, found ${allKeys.length}`);

    assertEqual(getPackage("non_existent_key"), null, "Invalid key returns null");
    assertEqual(getPackage(null), null, "Null key returns null");
  });

  await runTest("Suite 1", "getRateLimitRemaining cooldown calculation", async () => {
    const testUid = "100000000000000099";
    userCooldowns.delete(testUid);
    const rem1 = getRateLimitRemaining(testUid, 5000);
    assertEqual(rem1, 0, "First check should not be on cooldown");

    const rem2 = getRateLimitRemaining(testUid, 5000);
    assert(rem2 > 0 && rem2 <= 5, `Second immediate check should return >0 cooldown, got ${rem2}`);
  });

  await runTest("Suite 1", "buildPackageSelectMenu option counts and limits", async () => {
    const menuVi = buildPackageSelectMenu("100000000000000123", 'vi');
    const menuEn = buildPackageSelectMenu("100000000000000123", 'en');
    assert(menuVi.options.length <= 25, "Select menu options must not exceed Discord 25 limit");
    assert(menuVi.options.length >= 15, "Select menu must have all 15 catalog items");
    assertEqual(menuVi.data.custom_id, "select_package_vi_100000000000000123", "Custom ID format matches");
    assertEqual(menuEn.data.custom_id, "select_package_en_100000000000000123", "English Custom ID format matches");
  });

  // SUITE 2
  console.log("\n🛡️ [SUITE 2: AutoMod & Guild Event Simulation]");

  await runTest("Suite 2", "AutoMod: Normal chat message pass-through", async () => {
    const guild = createMockGuild();
    const user = createMockUser();
    const member = createMockGuildMember({ id: user.id, user, guild });
    const channel = createMockChannel({ guild });

    let deleted = false;
    const msg = {
      guild,
      author: user,
      member,
      channel,
      content: "Xin chao tat ca anh em LS Studio!",
      mentions: { everyone: false },
      delete: async () => { deleted = true; }
    };

    botClient.emit(Events.MessageCreate, msg);
    await new Promise(r => setTimeout(r, 50));
    assertEqual(deleted, false, "Normal message must NOT be deleted");
  });

  await runTest("Suite 2", "AutoMod: Normal user pinging @everyone triggers 5m mute & deletion", async () => {
    const guild = createMockGuild();
    const user = createMockUser();
    const member = createMockGuildMember({ id: user.id, user, guild, moderatable: true });
    const channel = createMockChannel({ guild });

    let deleted = false;
    let timedOut = false;
    member.timeout = async (ms, reason) => {
      timedOut = true;
      assertEqual(ms, 5 * 60 * 1000, "Timeout must be 5 minutes (300,000ms)");
    };

    const msg = {
      guild,
      author: user,
      member,
      channel,
      content: "Hello @everyone vao day xem nao!",
      mentions: { everyone: true },
      delete: async () => { deleted = true; }
    };

    botClient.emit(Events.MessageCreate, msg);
    await new Promise(r => setTimeout(r, 50));
    assertEqual(deleted, true, "Message containing @everyone must be deleted");
    assertEqual(timedOut, true, "Member must be timed out");
  });

  await runTest("Suite 2", "AutoMod: Staff pinging @everyone is allowed without punishment", async () => {
    const guild = createMockGuild();
    const staffRole = createMockRole({ name: "👑・Founder / Lead Dev", permissions: new PermissionsBitField([PermissionsBitField.Flags.Administrator]) });
    guild.roles.cache.set(staffRole.id, staffRole);

    const staffUser = createMockUser();
    const staffMember = createMockMemberWithRole(staffUser, [staffRole], guild);
    const channel = createMockChannel({ guild });

    let deleted = false;
    let timedOut = false;
    staffMember.timeout = async () => { timedOut = true; };

    const msg = {
      guild,
      author: staffUser,
      member: staffMember,
      channel,
      content: "Thong bao quan trong @everyone!",
      mentions: { everyone: true },
      delete: async () => { deleted = true; }
    };

    botClient.emit(Events.MessageCreate, msg);
    await new Promise(r => setTimeout(r, 50));
    assertEqual(deleted, false, "Staff message must NOT be deleted");
    assertEqual(timedOut, false, "Staff member must NOT be timed out");
  });

  await runTest("Suite 2", "AutoMod: Discord Invite Link blocked for normal users", async () => {
    const guild = createMockGuild();
    const user = createMockUser();
    const member = createMockGuildMember({ id: user.id, user, guild });
    const channel = createMockChannel({ guild });

    let deleted = false;
    const msg = {
      guild,
      author: user,
      member,
      channel,
      content: "Vao server cua minh nhe: https://discord.gg/abcdef123",
      mentions: { everyone: false },
      delete: async () => { deleted = true; }
    };

    botClient.emit(Events.MessageCreate, msg);
    await new Promise(r => setTimeout(r, 50));
    assertEqual(deleted, true, "Invite link message must be deleted");
  });

  await runTest("Suite 2", "AutoMod: Edge cases (empty message, bot author, null content)", async () => {
    const guild = createMockGuild();
    const botUser = createMockUser({ bot: true });
    const botMember = createMockGuildMember({ id: botUser.id, user: botUser, guild });
    const channel = createMockChannel({ guild });

    let deleted = false;
    botClient.emit(Events.MessageCreate, {
      guild,
      author: botUser,
      member: botMember,
      channel,
      content: "Bot message",
      delete: async () => { deleted = true; }
    });
    await new Promise(r => setTimeout(r, 50));
    assertEqual(deleted, false, "Bot message ignored");

    const user = createMockUser();
    const member = createMockGuildMember({ id: user.id, user, guild });
    botClient.emit(Events.MessageCreate, {
      guild,
      author: user,
      member,
      channel,
      content: null,
      delete: async () => { deleted = true; }
    });
    await new Promise(r => setTimeout(r, 50));
    assertEqual(deleted, false, "Null content handled safely");
  });

  await runTest("Suite 2", "GuildMemberAdd: Welcome message & role auto-assignment", async () => {
    const guild = createMockGuild();
    const memberRole = createMockRole({ name: "👥・Thành Viên" });
    guild.roles.cache.set(memberRole.id, memberRole);

    const welcomeChannel = createMockChannel({ name: "chào-mừng", guild });

    const user = createMockUser({ username: 'alex', tag: 'alex#1234' });
    const member = createMockGuildMember({ id: user.id, user, guild });

    let roleAdded = false;
    member.roles.add = async (r) => {
      if (r.id === memberRole.id) roleAdded = true;
      return member;
    };

    botClient.emit(Events.GuildMemberAdd, member);
    await new Promise(r => setTimeout(r, 50));
    assertEqual(roleAdded, true, "Thành Viên role must be automatically added to new member");
    assert(welcomeChannel.messages.cache.size > 0, "Welcome channel must receive welcome message");
  });

  await runTest("Suite 2", "GuildMemberRemove: Goodbye message sent", async () => {
    const guild = createMockGuild();
    const goodbyeChannel = createMockChannel({ name: "tạm-biệt", guild });

    const user = createMockUser({ username: 'bob', tag: 'bob#5678' });
    const member = createMockGuildMember({ id: user.id, user, guild });

    botClient.emit(Events.GuildMemberRemove, member);
    await new Promise(r => setTimeout(r, 50));
    assert(goodbyeChannel.messages.cache.size > 0, "Goodbye channel must receive message");
  });

  // SUITE 3
  console.log("\n⚡ [SUITE 3: Slash Commands]");

  await runTest("Suite 3", "/ping command response", async () => {
    const interaction = createMockInteraction({ type: 'command', commandName: 'ping' });
    botClient.ws = { ping: 45 };

    botClient.emit(Events.InteractionCreate, interaction);
    await waitForInteraction(interaction);

    assert(interaction._state.replied, "Must reply to /ping");
    assert(interaction._state.ephemeral, "/ping must be ephemeral");
    assert(interaction._state.replyPayload.content.includes("Pong!"), "Content contains Pong!");
  });

  await runTest("Suite 3", "/stk payment command response", async () => {
    const interaction = createMockInteraction({ type: 'command', commandName: 'stk' });

    botClient.emit(Events.InteractionCreate, interaction);
    await waitForInteraction(interaction);

    assert(interaction._state.deferred, "Must deferReply on /stk");
    assert(interaction._state.editReplyPayload !== null, "Must editReply with embed");
    const embed = interaction._state.editReplyPayload.embeds[0];
    assert(embed.data.title.includes("THÔNG TIN THANH TOÁN"), "Title must contain payment info");
    assert(embed.data.description.includes(BANK_CONFIG.ACCOUNT_NO), "Must include MBBank account number");
  });

  await runTest("Suite 3", "/khachhang: Non-staff permission rejection", async () => {
    const guild = createMockGuild();
    const normalUser = createMockUser();
    const normalMember = createMockGuildMember({ id: normalUser.id, user: normalUser, guild });
    const targetUser = createMockUser();

    const interaction = createMockInteraction({
      type: 'command',
      commandName: 'khachhang',
      user: normalUser,
      member: normalMember,
      guild,
      options: { user: targetUser }
    });

    botClient.emit(Events.InteractionCreate, interaction);
    await waitForInteraction(interaction);

    assert(interaction._state.replied, "Must reply");
    assert(interaction._state.replyPayload.content.includes("không có quyền"), "Must reject non-staff");
  });

  await runTest("Suite 3", "/khachhang: Staff grant role successfully", async () => {
    const guild = createMockGuild();
    const staffRole = createMockRole({ name: "👑・Founder / Lead Dev", position: 100, permissions: new PermissionsBitField([PermissionsBitField.Flags.Administrator]) });
    const customerRole = createMockRole({ name: "🛒・Khách Hàng (Buyer)", position: 10 });
    guild.roles.cache.set(staffRole.id, staffRole);
    guild.roles.cache.set(customerRole.id, customerRole);

    const staffUser = createMockUser();
    const staffMember = createMockMemberWithRole(staffUser, [staffRole], guild);

    const targetUser = createMockUser({ username: 'happy_buyer' });
    const targetMember = createMockGuildMember({ id: targetUser.id, user: targetUser, guild });
    guild.members.cache.set(targetUser.id, targetMember);

    const interaction = createMockInteraction({
      type: 'command',
      commandName: 'khachhang',
      user: staffUser,
      member: staffMember,
      guild,
      options: { user: targetUser }
    });

    botClient.emit(Events.InteractionCreate, interaction);
    await waitForInteraction(interaction);

    assert(interaction._state.deferred, "Must deferReply");
    assert(targetMember.roles.cache.has(customerRole.id), "Customer role must be assigned to target member");
    assert(interaction._state.editReplyPayload.embeds[0].data.title.includes("THÀNH CÔNG"), "Success embed returned");
  });

  await runTest("Suite 3", "/khachhang: Target is bot rejection", async () => {
    const guild = createMockGuild();
    const staffRole = createMockRole({ name: "👑・Founder / Lead Dev", permissions: new PermissionsBitField([PermissionsBitField.Flags.Administrator]) });
    guild.roles.cache.set(staffRole.id, staffRole);
    const staffUser = createMockUser();
    const staffMember = createMockMemberWithRole(staffUser, [staffRole], guild);
    const botTarget = createMockUser({ bot: true });

    const interaction = createMockInteraction({
      type: 'command',
      commandName: 'khachhang',
      user: staffUser,
      member: staffMember,
      guild,
      options: { user: botTarget }
    });

    botClient.emit(Events.InteractionCreate, interaction);
    await waitForInteraction(interaction);

    assert(interaction._state.replyPayload.content.includes("Không thể cấp role Khách Hàng cho tài khoản Bot"), "Bot target rejected");
  });

  await runTest("Suite 3", "Autocomplete interaction safety", async () => {
    const interaction = createMockInteraction({ type: 'autocomplete' });
    botClient.emit(Events.InteractionCreate, interaction);
    await new Promise(r => setTimeout(r, 50));
    assertEqual(Array.isArray(interaction._state.respondedAutocomplete), true, "Autocomplete must respond with array");
  });

  // SUITE 4
  console.log("\n🔘 [SUITE 4: Button Interactions]");

  await runTest("Suite 4", "Button: ticket_pricing", async () => {
    const guild = createMockGuild();
    const chPrice = createMockChannel({ name: "bảng-giá", guild });

    const interaction = createMockInteraction({ type: 'button', customId: 'ticket_pricing', guild });
    botClient.emit(Events.InteractionCreate, interaction);
    await waitForInteraction(interaction);

    assert(interaction._state.replied, "Must reply");
    assert(interaction._state.replyPayload.content.includes(chPrice.id), "Must link to pricing channel");
  });

  await runTest("Suite 4", "Button: switch_lang_vi & switch_lang_en", async () => {
    const user = createMockUser();
    const interactionVi = createMockInteraction({ type: 'button', customId: `switch_lang_vi_${user.id}`, user });
    botClient.emit(Events.InteractionCreate, interactionVi);
    await waitForInteraction(interactionVi);

    assert(interactionVi._state.updatePayload !== null, "Must update message for VI");
    assert(interactionVi._state.updatePayload.embeds[0].data.title.includes("TRUNG TÂM THANH TOÁN"), "VI embed title");

    const interactionEn = createMockInteraction({ type: 'button', customId: `switch_lang_en_${user.id}`, user });
    botClient.emit(Events.InteractionCreate, interactionEn);
    await waitForInteraction(interactionEn);

    assert(interactionEn._state.updatePayload !== null, "Must update message for EN");
    assert(interactionEn._state.updatePayload.embeds[0].data.title.includes("ORDER & SUPPORT CENTER"), "EN embed title");
  });

  await runTest("Suite 4", "Button: ticket_buy channel creation with permissions & rate limit", async () => {
    const guild = createMockGuild();
    const user = createMockUser({ username: 'johndoe' });
    userCooldowns.delete(user.id);
    ticketCreationLocks.delete(user.id);

    const interaction = createMockInteraction({ type: 'button', customId: 'ticket_buy', user, guild });
    botClient.emit(Events.InteractionCreate, interaction);
    await waitForInteraction(interaction);

    assert(interaction._state.deferred, "Must deferReply");
    assert(interaction._state.editReplyPayload !== null, "editReplyPayload must not be null");
    assert(interaction._state.editReplyPayload.content.includes("Ticket của bạn đã sẵn sàng"), "Ticket creation success message");

    const createdCh = Array.from(guild.channels.cache.values()).find(c => c.name.includes("mua-johndoe") || c.name.includes("mua-"));
    assert(createdCh !== undefined, "Ticket channel must be created in guild");
    assert(createdCh.topic.includes(user.id), "Ticket topic must contain user ID");

    // Immediate second click -> rate limited
    const interaction2 = createMockInteraction({ type: 'button', customId: 'ticket_buy', user, guild });
    botClient.emit(Events.InteractionCreate, interaction2);
    await waitForInteraction(interaction2);

    assert(interaction2._state.replyPayload.content.includes("quá nhanh"), "Must be rate-limited on immediate second click");
  });

  await runTest("Suite 4", "Button: approve_ order verification and customer role grant", async () => {
    const guild = createMockGuild();
    const staffRole = createMockRole({ name: "🛡️・Staff / Support", permissions: new PermissionsBitField([PermissionsBitField.Flags.Administrator]) });
    const customerRole = createMockRole({ name: "🛒・Khách Hàng (Buyer)" });
    guild.roles.cache.set(staffRole.id, staffRole);
    guild.roles.cache.set(customerRole.id, customerRole);

    const logCh = createMockChannel({ name: "nhật-ký-giao-dịch", guild });

    const staffUser = createMockUser();
    const staffMember = createMockMemberWithRole(staffUser, [staffRole], guild);

    const buyerUser = createMockUser({ username: 'gamer123' });
    const buyerMember = createMockGuildMember({ id: buyerUser.id, user: buyerUser, guild });
    guild.members.cache.set(buyerUser.id, buyerMember);

    const channel = createMockChannel({ name: "🛒-mua-gamer123", guild });
    const customId = `approve_LS123456_${buyerUser.id}_ls_anticheat`;

    const interaction = createMockInteraction({
      type: 'button',
      customId,
      user: staffUser,
      member: staffMember,
      guild,
      channel
    });

    botClient.emit(Events.InteractionCreate, interaction);
    await waitForInteraction(interaction);

    assert(interaction._state.updatePayload !== null, "Must update approve button state");
    assert(buyerMember.roles.cache.has(customerRole.id), "Buyer must receive Customer role");
    assert(channel.messages.cache.size > 0, "Receipt embed must be sent to ticket channel");
    assert(logCh.messages.cache.size > 0, "Transaction log must be recorded");
  });

  await runTest("Suite 4", "Button: Ticket close flow (btn_close_ticket, cancel_close_ticket, confirm_close_ticket)", async () => {
    const guild = createMockGuild();
    const user = createMockUser();
    const logCh = createMockChannel({ name: "nhật-ký-giao-dịch", guild });

    const ticketChannel = createMockChannel({
      name: "mua-user-1234",
      topic: `Ticket của @user_closer (${user.id}) • Type: ticket_buy`,
      guild
    });

    const intClose = createMockInteraction({ type: 'button', customId: 'btn_close_ticket', user, guild, channel: ticketChannel });
    botClient.emit(Events.InteractionCreate, intClose);
    await waitForInteraction(intClose);
    assert(intClose._state.replyPayload.embeds[0].data.title.includes("XÁC NHẬN ĐÓNG TICKET"), "Confirmation prompt rendered");

    const intCancel = createMockInteraction({ type: 'button', customId: 'cancel_close_ticket', user, guild, channel: ticketChannel });
    botClient.emit(Events.InteractionCreate, intCancel);
    await waitForInteraction(intCancel);
    assert(intCancel._state.updatePayload.embeds[0].data.description.includes("Đã hủy thao tác đóng ticket"), "Cancellation confirmed");

    const intConfirm = createMockInteraction({ type: 'button', customId: 'confirm_close_ticket', user, guild, channel: ticketChannel });
    botClient.emit(Events.InteractionCreate, intConfirm);
    await waitForInteraction(intConfirm);
    await new Promise(r => setTimeout(r, 100)); // Allow background transcript & log sending to complete

    assert(intConfirm._state.updatePayload.embeds[0].data.title.includes("ĐANG ĐÓNG TICKET"), "Closing status rendered");
    assert(logCh.messages.cache.size > 0, "Log channel must receive transcript archive");
  });

  // SUITE 5
  console.log("\n📋 [SUITE 5: Select Menu Package Invoices (15 Items)]");

  const packageKeys = Object.keys(PACKAGES);
  for (const pkgKey of packageKeys) {
    const pkg = PACKAGES[pkgKey];
    await runTest("Suite 5", `Select package: ${pkgKey} (${pkg.price_vnd} VNĐ)`, async () => {
      const guild = createMockGuild();
      const user = createMockUser();
      const channel = createMockChannel({ name: "ticket-1", guild });

      const customId = `select_package_vi_${user.id}`;
      const interaction = createMockInteraction({
        type: 'select',
        customId,
        values: [pkgKey],
        user,
        guild,
        channel
      });

      botClient.emit(Events.InteractionCreate, interaction);
      await waitForInteraction(interaction);

      if (pkg.price_vnd === 0) {
        assert(interaction._state.replied, "Must reply to custom dev request");
        assert(interaction._state.replyPayload.embeds[0].data.title.includes("ĐẶT"), "Custom request title");
      } else {
        assert(interaction._state.deferred, "Must deferReply for invoice generation");
        assert(interaction._state.editReplyPayload !== null, "Must editReply with invoice embed");
        const embed = interaction._state.editReplyPayload.embeds[0];
        assert(embed.data.title.includes("HÓA ĐƠN THANH TOÁN"), "Invoice title");
        assert(embed.data.description.includes(formatVND(pkg.price_vnd)), "Description must contain VND price");
      }
    });
  }

  await runTest("Suite 5", "Select Menu: Unauthorized user blocked from selecting", async () => {
    const guild = createMockGuild();
    const ownerUser = createMockUser();
    const intruderUser = createMockUser();
    const intruderMember = createMockGuildMember({ id: intruderUser.id, user: intruderUser, guild });

    const customId = `select_package_vi_${ownerUser.id}`;
    const interaction = createMockInteraction({
      type: 'select',
      customId,
      values: ['ls_anticheat'],
      user: intruderUser,
      member: intruderMember,
      guild
    });

    botClient.emit(Events.InteractionCreate, interaction);
    await waitForInteraction(interaction);

    assert(interaction._state.replied, "Must reply");
    assert(interaction._state.replyPayload.content.includes("không phải là chủ sở hữu"), "Intruder blocked from selecting");
  });

  // SUITE 6
  console.log("\n🏗️ [SUITE 6: Server Setup Dry-Run (setup_server.js)]");

  await runTest("Suite 6", "Full server structure generation & role sync", async () => {
    const mockGuild = createMockGuild();
    const mockClient = {
      user: createMockUser({ username: 'LS Studio Bot', tag: 'LS Studio Bot#0001', bot: true }),
      guilds: {
        fetch: async (id) => mockGuild
      }
    };

    const setupResult = await runServerSetup(mockClient, mockGuild.id);
    assertEqual(setupResult.success, true, "Setup returned success");

    const roles = Array.from(mockGuild.roles.cache.values()).map(r => r.name);
    assert(roles.includes("👑・Founder / Lead Dev"), "Founder role exists");
    assert(roles.includes("🛠️・Developer"), "Dev role exists");
    assert(roles.includes("🛡️・Staff / Support"), "Staff role exists");
    assert(roles.includes("💎・VIP Customer"), "VIP role exists");
    assert(roles.includes("🛒・Khách Hàng (Buyer)"), "Khách Hàng role exists");
    assert(roles.includes("🤝・Đối Tác (Partner)"), "Đối Tác role exists");
    assert(roles.includes("👥・Thành Viên"), "Thành Viên role exists");
    assert(roles.includes("🤖・Bot Hệ Thống"), "Bot role exists");

    const channels = Array.from(mockGuild.channels.cache.values());
    const channelNames = channels.map(c => c.name);

    assert(channelNames.some(n => n.includes("THÔNG TIN")), "THÔNG TIN category exists");
    assert(channelNames.some(n => n.includes("CỬA HÀNG LS") || n.includes("LS STORE")), "LS STORE category exists");
    assert(channelNames.some(n => n.includes("HỖ TRỢ & MUA HÀNG") || n.includes("MUA HÀNG & HỖ TRỢ")), "HỖ TRỢ & MUA HÀNG category exists");
    assert(channelNames.some(n => n.includes("SẢNH GIAO LƯU") || n.includes("CỘNG ĐỒNG")), "CỘNG ĐỒNG category exists");
    assert(channelNames.some(n => n.includes("KHÁCH HÀNG VIP")), "KHÁCH HÀNG VIP category exists");
    assert(channelNames.some(n => n.includes("BAN QUẢN TRỊ")), "BAN QUẢN TRỊ category exists");
    assert(channelNames.some(n => n.includes("KÊNH THOẠI")), "KÊNH THOẠI category exists");

    assert(channelNames.some(n => n.includes("luật")), "Luật channel exists");
    assert(channelNames.some(n => n.includes("thông-báo")), "Thông báo channel exists");
    assert(channelNames.some(n => n.includes("sản-phẩm-plugin") || n.includes("danh-sách-plugin")), "Plugin list channel exists");
    assert(channelNames.some(n => n.includes("bảng-giá")), "Pricing channel exists");
    assert(channelNames.some(n => n.includes("mua-plugin")), "Buy plugin ticket channel exists");
    assert(channelNames.some(n => n.includes("hỗ-trợ-kỹ-thuật")), "Tech support ticket channel exists");
    assert(channelNames.some(n => n.includes("đặt-làm-plugin") || n.includes("đặt-custom-plugin") || n.includes("đặt-code-plugin-riêng")), "Custom dev ticket channel exists");
  });

  // SUITE 7
  console.log("\n🛡️ [SUITE 7: Anti-Crash & Unhandled Exception Audit]");

  await runTest("Suite 7", "Zero unhandled promise rejections & exceptions during run", async () => {
    assertEqual(unhandledErrors.length, 0, `Must have 0 unhandled errors, got: ${JSON.stringify(unhandledErrors)}`);
  });

  // SUMMARY
  console.log("\n================================================================================");
  console.log("📊 TEST HARNESS EXECUTION SUMMARY REPORT");
  console.log("================================================================================");
  console.log(`Total Tests Run:     ${totalTests}`);
  console.log(`Passed Tests:        \x1b[32m${passedTests}\x1b[0m`);
  console.log(`Failed Tests:        \x1b[31m${failedTests}\x1b[0m`);
  console.log(`Unhandled Errors:    ${unhandledErrors.length === 0 ? '\x1b[32m0\x1b[0m' : '\x1b[31m' + unhandledErrors.length + '\x1b[0m'}`);
  console.log("================================================================================");

  if (failedTests > 0 || unhandledErrors.length > 0) {
    process.exit(1);
  } else {
    console.log("🎉 ALL TESTS PASSED WITH 100% SUCCESS RATE!");
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error("❌ Fatal Test Runner Error:", err);
  process.exit(1);
});
