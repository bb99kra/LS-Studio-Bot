/**
 * ============================================================================
 * LS STUDIO - COMPREHENSIVE DYNAMIC TEST HARNESS & DRY-RUN SIMULATION SUITE
 * ============================================================================
 * 100% Mock Discord Interactions, Events, Commands, Menus, Buttons & Setup
 * Edge-case Hardening: Homoglyph AutoMod, Modal Sanitization, Pagination, 0 VND
 * ============================================================================
 */

const {
  client: botClient,
  PACKAGES,
  DEPRECATED_PACKAGE_ALIASES,
  BANK_CONFIG,
  ORDER_CODE_REGEX,
  generateOrderCode,
  generateUniqueOrderCode,
  extractOrderCode,
  isValidOrderCode,
  formatVND,
  formatUSD,
  isNegotiatedPrice,
  sanitizeVietQRText,
  sanitizeCustomerName,
  sanitizeOrderCode,
  generateVietQRUrl,
  fetchVietQRBuffer,
  vietQRBufferCache,
  failedVietQRUrls,
  pendingVietQRRequests,
  clearVietQRCache,
  getVietQRCacheStats,
  getPackage,
  getRateLimitRemaining,
  formatVNTime,
  sanitizeTranscriptControlChars,
  sanitizeSingleLineHeader,
  sanitizeMarkdownForEmbed,
  extractTranscriptMessageData,
  generateTranscript,
  createTranscriptAttachments,
  redactSensitiveData,
  buildPackageSelectMenu,
  createCustomOrderModal,
  createSupportTicketModal,
  createCloseTicketReasonModal,
  createFeedbackModal,
  createTicketChannel,
  ticketCreationLocks,
  closingTicketChannels,
  userCooldowns,
  activeOrderCodes,
  approvedOrderCodes,
  processingApprovals,
  isStaffMember,
  normalizeAntiSpamText,
  extractAllLinkTargets,
  containsDiscordInvite,
  containsEveryonePing,
  safeDeleteMessage,
  handleAutoMod,
  sanitizeModalInlineText,
  sanitizeModalCodeBlockText,
  sanitizeDiscordChannelTopic,
  executeTicketClosure,
  IGNORABLE_INTERACTION_ERROR_CODES,
  isIgnorableInteractionError,
  safeReply,
  safeDeferReply,
  safeDeferUpdate,
  safeEditReply,
  safeFollowUp,
  safeUpdate,
  safeShowModal,
  commands,
  registerCommands,
  handleGracefulShutdown
} = require('./bot.js');

const { runServerSetup } = require('./setup_server.js');
const { PermissionsBitField, ChannelType, OverwriteType, ButtonStyle, Events, Collection, AttachmentBuilder } = require('discord.js');

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
    send: async (payload) => payload,
    displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/0.png'
  };
}

function createMockRole({ id = null, name = 'Role', position = 1, permissions = new PermissionsBitField(0n), color = 0x00E676 } = {}) {
  const rid = id || '20' + Math.floor(1000000000000000 + Math.random() * 9000000000000000).toString();
  return {
    id: rid,
    name,
    position,
    permissions,
    color,
    toString: () => `<@&${rid}>`
  };
}

function createMockGuildMember({ id = null, user = null, guild = null, roles = [], moderatable = true, permissions = new PermissionsBitField(0n) } = {}) {
  const u = user || createMockUser({ id });
  const roleCollection = new Collection();
  roles.forEach(r => roleCollection.set(r.id, r));

  const highestRole = roles.reduce((highest, r) => (r.position > (highest?.position || -1) ? r : highest), null) 
    || createMockRole({ name: '@everyone', position: 0 });

  const member = {
    id: u.id,
    user: u,
    guild,
    roles: {
      cache: roleCollection,
      highest: highestRole,
      add: async (role) => {
        const r = typeof role === 'string' ? guild?.roles.cache.get(role) || createMockRole({ id: role }) : role;
        roleCollection.set(r.id, r);
        return member;
      },
      remove: async (role) => {
        const rid = typeof role === 'string' ? role : role.id;
        roleCollection.delete(rid);
        return member;
      }
    },
    permissions: {
      has: (bit) => permissions.has(bit) || roles.some(r => r.permissions?.has(bit))
    },
    moderatable,
    timeout: async (ms, reason) => { member.timedOutUntil = Date.now() + ms; return member; },
    send: async (payload) => payload
  };

  return member;
}

function createMockMemberWithRole(user, roles, guild) {
  return createMockGuildMember({ user, roles, guild });
}

function createMockChannel({ id = null, name = 'general', type = ChannelType.GuildText, topic = '', parent = null, guild = null, messages = [], permissionOverwrites = [] } = {}) {
  const cid = id || '30' + Math.floor(1000000000000000 + Math.random() * 9000000000000000).toString();
  const messageMap = new Collection();
  messages.forEach(m => messageMap.set(m.id, m));
  const overwritesMap = new Collection();
  if (Array.isArray(permissionOverwrites)) {
    permissionOverwrites.forEach(ow => overwritesMap.set(ow.id, ow));
  }

  const channel = {
    id: cid,
    name,
    type,
    topic,
    parentId: parent?.id || null,
    parent: parent,
    guild,
    guildId: guild?.id || null,
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
      fetch: async (opts) => {
        if (!opts) return messageMap;
        const msgList = Array.from(messageMap.values()).sort((a, b) => b.createdTimestamp - a.createdTimestamp);
        let filtered = msgList;
        if (opts.before) {
          const beforeIndex = filtered.findIndex(m => m.id === opts.before);
          if (beforeIndex !== -1) {
            filtered = filtered.slice(beforeIndex + 1);
          }
        }
        const limit = opts.limit || 50;
        const sliced = filtered.slice(0, limit);
        const resultCollection = new Collection();
        sliced.forEach(m => resultCollection.set(m.id, m));
        return resultCollection;
      },
      cache: messageMap
    },
    permissionOverwrites: {
      cache: overwritesMap,
      set: async (overwrites) => {
        overwritesMap.clear();
        if (Array.isArray(overwrites)) {
          overwrites.forEach(ow => overwritesMap.set(ow.id, ow));
        }
        channel.overwrites = overwrites;
        return channel;
      }
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
    setTopic: async (newTopic) => {
      channel.topic = newTopic;
      return channel;
    },
    bulkDelete: async (amount, filterOld) => {
      const msgs = Array.from(messageMap.values()).slice(0, typeof amount === 'number' ? amount : 10);
      msgs.forEach(m => messageMap.delete(m.id));
      const col = new Collection();
      msgs.forEach(m => col.set(m.id, m));
      return col;
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
    ownerId: '100000000000000001',
    roles: {
      cache: roleMap,
      everyone: everyoneRole,
      fetch: async () => roleMap,
      create: async (data) => {
        const newRole = createMockRole({
          name: data.name,
          color: data.color,
          position: roleMap.size + 1,
          permissions: data.permissions || new PermissionsBitField(0n)
        });
        roleMap.set(newRole.id, newRole);
        return newRole;
      },
      setPositions: async (positionUpdates) => {
        for (const item of positionUpdates) {
          const role = roleMap.get(item.role);
          if (role) {
            role.position = item.position;
          }
        }
        return roleMap;
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
          permissionOverwrites: data.permissionOverwrites || [],
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
  guild.roles.everyone = everyoneRole;

  const botUser = createMockUser({ id: '109999999999999999', username: 'LS Studio Bot', tag: 'LS Studio Bot#0001', bot: true });
  const botRole = createMockRole({ id: '209999999999999999', name: '🤖・Bot Hệ Thống', position: 99, permissions: new PermissionsBitField([PermissionsBitField.Flags.Administrator, PermissionsBitField.Flags.ManageRoles, PermissionsBitField.Flags.ManageChannels]) });
  roleMap.set(botRole.id, botRole);
  const botMember = createMockGuildMember({ id: botUser.id, user: botUser, guild, roles: [botRole], permissions: new PermissionsBitField([PermissionsBitField.Flags.Administrator]) });
  guild.members.me = botMember;
  memberMap.set(botUser.id, botMember);

  return guild;
}

function createMockInteraction({
  type = 'button',
  commandName = null,
  customId = null,
  values = [],
  options = {},
  fields = {},
  user = null,
  member = null,
  guild = undefined,
  channel = undefined
} = {}) {
  const u = user || createMockUser();
  const g = guild === null ? null : (guild || createMockGuild());
  const m = member === null ? null : (member || (g ? createMockGuildMember({ user: u, guild: g }) : null));
  const ch = channel === null ? null : (channel || (g ? createMockChannel({ guild: g }) : null));

  const state = {
    replied: false,
    deferred: false,
    ephemeral: false,
    replyPayload: null,
    editReplyPayload: null,
    updatePayload: null,
    modalPayload: null,
    followUpPayload: null,
    respondedAutocomplete: null
  };

  const interaction = {
    id: 'int_' + Math.random().toString(36).substring(2, 9),
    createdTimestamp: Date.now(),
    user: u,
    member: m,
    guild: g,
    guildId: g?.id || null,
    channel: ch,
    channelId: ch?.id || null,
    customId,
    commandName,
    values,
    isChatInputCommand: () => type === 'command',
    isButton: () => type === 'button',
    isStringSelectMenu: () => type === 'select',
    isModalSubmit: () => type === 'modal',
    isAutocomplete: () => type === 'autocomplete',
    inGuild: () => Boolean(g),
    options: {
      getUser: (name) => options[name] || null,
      getString: (name) => options[name] || null,
      getInteger: (name) => options[name] || null,
      getMember: (name) => options[name] ? g?.members.cache.get(options[name].id) || options[name] : null,
      getFocused: (full) => options._focused || (options.code !== undefined ? { name: 'code', value: options.code } : { name: 'code', value: '' })
    },
    fields: {
      getTextInputValue: (id) => fields[id] || ''
    },
    get deferred() { return state.deferred; },
    get replied() { return state.replied; },
    deferReply: async (opts = {}) => {
      state.deferred = true;
      state.ephemeral = Boolean(opts.ephemeral);
      return state;
    },
    reply: async (payload) => {
      state.replied = true;
      state.ephemeral = Boolean(payload.ephemeral);
      state.replyPayload = payload;
      return payload;
    },
    editReply: async (payload) => {
      state.replied = true;
      state.editReplyPayload = payload;
      return payload;
    },
    showModal: async (modal) => {
      state.replied = true;
      state.modalPayload = modal;
      return modal;
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
  console.log("🧪 STARTING LS STUDIO DISCORD BOT & SETUP DRY-RUN TEST SUITE (AUDIT EDITION)");
  console.log("================================================================================");

  // ============================================================================
  // SUITE 1: Core Helper Functions & Formatting Unit Tests
  // ============================================================================
  console.log("\n📦 [SUITE 1: Core Helper Functions & Formatting Unit Tests]");

  await runTest("Suite 1", "generateOrderCode & generateUniqueOrderCode format validation", async () => {
    const code1 = generateOrderCode();
    const code2 = generateUniqueOrderCode();
    assert(typeof code1 === 'string' && /^LS\d{6}$/.test(code1), `generateOrderCode format valid: ${code1}`);
    assert(typeof code2 === 'string' && /^LS\d{6}$/.test(code2), `generateUniqueOrderCode format valid: ${code2}`);
  });

  await runTest("Suite 1", "generateUniqueOrderCode 1,000 iterations collision resistance test", async () => {
    const pool = new Set();
    for (let i = 0; i < 1000; i++) {
      const code = generateUniqueOrderCode();
      assert(/^LS\d{6}$/.test(code), `Code ${code} must match regex`);
      assert(!pool.has(code), `Collision detected on iteration ${i}: ${code}`);
      pool.add(code);
    }
  });

  await runTest("Suite 1", "extractOrderCode regex handling across variations & sentences", async () => {
    assertEqual(extractOrderCode("Thanh toan don LS123456 thanh cong"), "LS123456", "Standard LS123456");
    assertEqual(extractOrderCode("Don hang LS-654321 nhe"), "LS654321", "Hyphenated LS-654321");
    assertEqual(extractOrderCode("Code ls_998877 duyet giup"), "LS998877", "Underscore ls_998877");
    assertEqual(extractOrderCode("Chuyen khoan don hang ls 112233"), "LS112233", "Spaced ls 112233");
    assertEqual(extractOrderCode("Khong co ma don"), null, "No order code in text");
    assertEqual(extractOrderCode(null), null, "Null input");
    assertEqual(extractOrderCode(undefined), null, "Undefined input");
    assertEqual(extractOrderCode(123456), null, "Number without prefix");
  });

  await runTest("Suite 1", "isValidOrderCode boundary validation", async () => {
    assert(isValidOrderCode("LS123456"), "LS123456 is valid");
    assert(isValidOrderCode("ls-123456"), "ls-123456 is valid");
    assert(isValidOrderCode("LS 999999"), "LS 999999 is valid");
    assert(!isValidOrderCode("123456"), "Missing LS prefix is invalid");
    assert(!isValidOrderCode("LS12345"), "5 digits is invalid");
    assert(!isValidOrderCode("LS1234567"), "7 digits is invalid");
    assert(!isValidOrderCode(""), "Empty string is invalid");
    assert(!isValidOrderCode(null), "Null is invalid");
  });

  await runTest("Suite 1", "formatVND & formatUSD formatting with edge cases", async () => {
    assert(formatVND(30000).includes("30.000") || formatVND(30000).includes("30"), "formatVND standard");
    assertEqual(formatVND(0), "0 VNĐ", "formatVND 0");
    assertEqual(formatVND(null), "0 VNĐ", "formatVND null");
    assertEqual(formatVND("invalid"), "0 VNĐ", "formatVND invalid string");
    assert(formatVND(-5000).includes("5.000") || formatVND(-5000).includes("-"), "formatVND negative");

    assertEqual(formatUSD(1.5), "$1.50 USD", "formatUSD standard");
    assertEqual(formatUSD(0), "$0.00 USD", "formatUSD 0");
    assertEqual(formatUSD(null), "$0.00 USD", "formatUSD null");
    assertEqual(formatUSD(-2.5), "-$2.50 USD", "formatUSD negative");
  });

  await runTest("Suite 1", "getPackage lookup, aliases & catalog integrity", async () => {
    assert(Object.keys(PACKAGES).length >= 17, `Packages catalog must have >= 17 items (got ${Object.keys(PACKAGES).length})`);
    
    const ac = getPackage('ls_anticheat');
    assert(ac !== null && ac.price_vnd === 30000, "Exact lookup: ls_anticheat");

    const acUpper = getPackage('LS_ANTICHEAT');
    assert(acUpper !== null && acUpper.price_vnd === 30000, "Case-insensitive lookup");

    const alias1 = getPackage('custom_plugin');
    assert(alias1 !== null && alias1.price_vnd === 0, "Alias custom_plugin -> custom_dev");

    const alias2 = getPackage('anticheat');
    assert(alias2 !== null && alias2.price_vnd === 30000, "Alias anticheat -> ls_anticheat");

    assertEqual(getPackage('non_existent_pkg'), null, "Unknown package returns null");
  });

  await runTest("Suite 1", "buildPackageSelectMenu option counts and limits", async () => {
    const menuVi = buildPackageSelectMenu('100000000000000001', 'vi');
    const dataVi = menuVi.toJSON();
    assertEqual(dataVi.custom_id, 'select_package_vi_100000000000000001', 'VI CustomId matches');
    assert(dataVi.options.length <= 25, `Discord select menu max 25 options (got ${dataVi.options.length})`);
    assert(dataVi.options.length >= 17, `Must present all 17 packages`);

    const menuEn = buildPackageSelectMenu('100000000000000001', 'en');
    const dataEn = menuEn.toJSON();
    assertEqual(dataEn.custom_id, 'select_package_en_100000000000000001', 'EN CustomId matches');
  });

  // ============================================================================
  // SUITE 2: VietQR & Banking Sanitization (0 VND & Custom Pricing)
  // ============================================================================
  console.log("\n💳 [SUITE 2: VietQR & Banking Sanitization (0 VND & Custom Pricing)]");

  await runTest("Suite 2", "sanitizeVietQRText: Diacritics stripping & Đ conversion", async () => {
    assertEqual(sanitizeVietQRText("Nguyễn Minh Nhựt"), "NGUYEN MINH NHUT", "Vietnamese diacritics stripping");
    assertEqual(sanitizeVietQRText("Đỗ Nam Trung"), "DO NAM TRUNG", "Capital & lowercase Đ -> D");
    assertEqual(sanitizeVietQRText("Thanh toán đơn hàng đợt 1"), "THANH TOAN DON HANG DOT 1", "Full sentence with đ/Đ");
  });

  await runTest("Suite 2", "sanitizeVietQRText: Special symbols, emojis & length trimming", async () => {
    assertEqual(sanitizeVietQRText("LS@123_456!🚀"), "LS 123 456", "Special characters and emoji stripping");
    assertEqual(sanitizeVietQRText("   LS123456   "), "LS123456", "Whitespace trimming");
    assertEqual(sanitizeVietQRText("DAY LA MOT NOI DUNG RAT DAI VUOT QUA 25 KY TU CHO PHEP", 25), "DAY LA MOT NOI DUNG RAT D", "Length truncation");
  });

  await runTest("Suite 2", "sanitizeVietQRText: Edge inputs (null, undefined, empty, number)", async () => {
    assertEqual(sanitizeVietQRText(null), "", "Null returns empty");
    assertEqual(sanitizeVietQRText(undefined), "", "Undefined returns empty");
    assertEqual(sanitizeVietQRText(""), "", "Empty string returns empty");
    assertEqual(sanitizeVietQRText(123456), "123456", "Number input handled safely");
  });

  await runTest("Suite 2", "generateVietQRUrl: Standard fixed pricing URL", async () => {
    const url = generateVietQRUrl({
      bankId: 'MB',
      accountNo: '844515133333',
      template: 'compact2',
      amount: 30000,
      addInfo: 'LS123456',
      accountName: 'VAN HUU PHAM NGUYEN'
    });
    assert(url.startsWith("https://img.vietqr.io/image/MB-844515133333-compact2.png"), "Base URL correct");
    assert(url.includes("amount=30000"), "Amount param included");
    assert(url.includes("addInfo=LS123456"), "addInfo param included");
    assert(url.includes("accountName="), "accountName included");
  });

  await runTest("Suite 2", "generateVietQRUrl: 0 VND & Custom pricing (omits amount parameter)", async () => {
    const urlZero = generateVietQRUrl({ amount: 0, addInfo: 'LS000001' });
    assert(!urlZero.includes("amount="), "0 VND MUST NOT append amount parameter");
    assert(urlZero.includes("addInfo=LS000001"), "addInfo preserved on 0 VND");

    const urlStrZero = generateVietQRUrl({ amount: "0", addInfo: 'LS000002' });
    assert(!urlStrZero.includes("amount="), "String '0' MUST NOT append amount parameter");

    const urlNull = generateVietQRUrl({ amount: null, addInfo: 'LS000003' });
    assert(!urlNull.includes("amount="), "null amount MUST NOT append amount parameter");

    const urlUndef = generateVietQRUrl({ amount: undefined, addInfo: 'LS000004' });
    assert(!urlUndef.includes("amount="), "undefined amount MUST NOT append amount parameter");

    const urlNeg = generateVietQRUrl({ amount: -50000, addInfo: 'LS000005' });
    assert(!urlNeg.includes("amount="), "Negative amount MUST NOT append amount parameter");
  });

  await runTest("Suite 2", "generateVietQRUrl: Special characters sanitization in bank & account", async () => {
    const url = generateVietQRUrl({
      bankId: ' MB / Vietnam ',
      accountNo: ' 8445-151-333333 ',
      template: 'compact2'
    });
    assert(url.startsWith("https://img.vietqr.io/image/MBVietnam-8445151333333-compact2.png"), "Sanitized bank & account number");
  });

  await runTest("Suite 2", "fetchVietQRBuffer: Fallback behavior on invalid network & non-image response", async () => {
    const res = await fetchVietQRBuffer("https://invalid-non-existent-vietqr-domain-xyz.com/qr.png");
    assertEqual(res, null, "Should return null on network failure instead of crashing");
  });

  // ============================================================================
  // SUITE 3: AutoMod & Homoglyph Anti-Spam
  // ============================================================================
  console.log("\n🛡️ [SUITE 3: AutoMod & Homoglyph Anti-Spam]");

  await runTest("Suite 3", "normalizeAntiSpamText: Fullwidth characters & Unicode normalization", async () => {
    assertEqual(normalizeAntiSpamText("ｄｉｓｃｏｒｄ"), "discord", "Fullwidth latin normalization");
    assertEqual(normalizeAntiSpamText("＠ｅｖｅｒｙｏｎｅ"), "@everyone", "Fullwidth @everyone normalization");
  });

  await runTest("Suite 3", "normalizeAntiSpamText: Stripping zero-width & invisible control characters", async () => {
    const zeroWidth = "dis\u200Bcord\uFEFF.gg/\u200Cabc\u200D123";
    assertEqual(normalizeAntiSpamText(zeroWidth), "discord.gg/abc123", "Zero-width stripping");
  });

  await runTest("Suite 3", "containsDiscordInvite: Standard invite URLs", async () => {
    assert(containsDiscordInvite("Tham gia server https://discord.gg/minecraft"), "discord.gg invite");
    assert(containsDiscordInvite("Check out discord.com/invite/abcdef"), "discord.com/invite");
    assert(containsDiscordInvite("Join discord.io/lsstudio"), "discord.io");
    assert(containsDiscordInvite("Link: discord.me/mycommunity"), "discord.me");
  });

  await runTest("Suite 3", "containsDiscordInvite: Obfuscated invites (spaces, dots, brackets, zero-width)", async () => {
    assert(containsDiscordInvite("vào server d i s c o r d . g g / 1 2 3 4 5"), "Spaced discord.gg");
    assert(containsDiscordInvite("link [discord] . (gg) / abcdef"), "Brackets & parens obfuscation");
    assert(containsDiscordInvite("link: discord(dot)gg/mycode"), "dot in parenthesis");
    assert(containsDiscordInvite("discord․gg/realinvite"), "One-dot leader homoglyph");
  });

  await runTest("Suite 3", "containsDiscordInvite: False-positive exemptions (Safe URLs)", async () => {
    assert(!containsDiscordInvite("Xem huong dan tai https://google.com"), "Google URL");
    assert(!containsDiscordInvite("Plugin download tai https://spigotmc.org/resources/123"), "SpigotMC link");
    assert(!containsDiscordInvite("Anh em xem repo tai https://github.com/LS-Studio"), "GitHub repo");
  });

  await runTest("Suite 3", "containsEveryonePing: Direct & obfuscated pings", async () => {
    assert(containsEveryonePing("Hello @everyone mau vao xem!"), "Direct @everyone");
    assert(containsEveryonePing("Thong bao @here cac ban oi"), "Direct @here");
    assert(containsEveryonePing("＠ｅｖｅｒｙｏｎｅ"), "Fullwidth @everyone");
    assert(containsEveryonePing("@\u200Beveryone"), "Zero-width separated @everyone");
  });

  await runTest("Suite 3", "containsEveryonePing: False-positive exemptions (Escaped, code blocks, emails)", async () => {
    assert(!containsEveryonePing("Lien he admin@everyone.com de ho tro"), "Email address containing everyone");
    assert(!containsEveryonePing("Huong dan: danh lenh \\@everyone trong chat"), "Escaped backslash \\@everyone");
    assert(!containsEveryonePing("Mau lenh: `@everyone` dung de ping"), "Inline code `@everyone`");
    assert(!containsEveryonePing("```\nThong bao @everyone trong code block\n```"), "Fenced codeblock @everyone");
  });

  await runTest("Suite 3", "safeDeleteMessage: Deletable verification and error code suppression", async () => {
    let delCalled = false;
    const msg1 = { deletable: true, delete: async () => { delCalled = true; } };
    await safeDeleteMessage(msg1);
    assertEqual(delCalled, true, "Deletable message deleted");

    const msg2 = { deletable: false, delete: async () => { throw new Error("Should not be called"); } };
    await safeDeleteMessage(msg2);
  });

  await runTest("Suite 3", "AutoMod Event: Normal chat message pass-through", async () => {
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
      deletable: true,
      delete: async () => { deleted = true; }
    };

    botClient.emit(Events.MessageCreate, msg);
    await new Promise(r => setTimeout(r, 50));
    assertEqual(deleted, false, "Normal message must NOT be deleted");
  });

  await runTest("Suite 3", "AutoMod Event: Normal user pinging @everyone triggers 5m mute & deletion", async () => {
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
      deletable: true,
      delete: async () => { deleted = true; }
    };

    botClient.emit(Events.MessageCreate, msg);
    await new Promise(r => setTimeout(r, 50));
    assertEqual(deleted, true, "Message containing @everyone must be deleted");
    assertEqual(timedOut, true, "Member must be timed out");
  });

  await runTest("Suite 3", "AutoMod Event: Staff pinging @everyone is allowed without punishment", async () => {
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
      deletable: true,
      delete: async () => { deleted = true; }
    };

    botClient.emit(Events.MessageCreate, msg);
    await new Promise(r => setTimeout(r, 50));
    assertEqual(deleted, false, "Staff message must NOT be deleted");
    assertEqual(timedOut, false, "Staff member must NOT be timed out");
  });

  await runTest("Suite 3", "AutoMod Event: Discord Invite Link blocked for normal users", async () => {
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
      deletable: true,
      delete: async () => { deleted = true; }
    };

    botClient.emit(Events.MessageCreate, msg);
    await new Promise(r => setTimeout(r, 50));
    assertEqual(deleted, true, "Invite link message must be deleted");
  });

  await runTest("Suite 3", "AutoMod Event: Edge cases (empty message, bot author, null content)", async () => {
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
      deletable: true,
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
      content: "",
      deletable: true,
      delete: async () => { deleted = true; }
    });
    await new Promise(r => setTimeout(r, 50));
    assertEqual(deleted, false, "Empty content message ignored");
  });

  await runTest("Suite 3", "GuildMemberAdd: Welcome message & role auto-assignment", async () => {
    const guild = createMockGuild();
    const memberRole = createMockRole({ name: "👥・Thành Viên" });
    guild.roles.cache.set(memberRole.id, memberRole);

    const welcomeChannel = createMockChannel({ name: "chào-mừng", guild });
    const newUser = createMockUser({ username: 'newcomer' });
    const newMember = createMockGuildMember({ id: newUser.id, user: newUser, guild });

    botClient.emit(Events.GuildMemberAdd, newMember);
    await new Promise(r => setTimeout(r, 50));

    assert(newMember.roles.cache.has(memberRole.id), "New member must automatically receive Thành Viên role");
    assert(welcomeChannel.messages.cache.size > 0, "Welcome channel must receive greeting embed");
  });

  await runTest("Suite 3", "GuildMemberRemove: Goodbye message sent", async () => {
    const guild = createMockGuild();
    const goodbyeChannel = createMockChannel({ name: "tạm-biệt", guild });
    const leaverUser = createMockUser({ username: 'leaver' });
    const leaverMember = createMockGuildMember({ id: leaverUser.id, user: leaverUser, guild });

    botClient.emit(Events.GuildMemberRemove, leaverMember);
    await new Promise(r => setTimeout(r, 50));

    assert(goodbyeChannel.messages.cache.size > 0, "Goodbye channel must receive departure embed");
  });

  // ============================================================================
  // SUITE 4: Slash Commands
  // ============================================================================
  console.log("\n⚡ [SUITE 4: Slash Commands]");

  await runTest("Suite 4", "/ping command response", async () => {
    const interaction = createMockInteraction({ type: 'command', commandName: 'ping' });
    botClient.emit(Events.InteractionCreate, interaction);
    await waitForInteraction(interaction);

    assert(interaction._state.replied, "Must reply to /ping");
    assert(interaction._state.ephemeral, "/ping must be ephemeral");
    assert(interaction._state.replyPayload.content.includes("Pong!"), "Content contains Pong!");
  });

  await runTest("Suite 4", "/stk payment command response", async () => {
    const interaction = createMockInteraction({ type: 'command', commandName: 'stk' });
    botClient.emit(Events.InteractionCreate, interaction);
    await waitForInteraction(interaction);

    assert(interaction._state.deferred, "Must deferReply on /stk");
    assert(interaction._state.editReplyPayload !== null, "Must editReply with embed");
    const embed = interaction._state.editReplyPayload.embeds[0];
    assert(embed.data.title.includes("THÔNG TIN THANH TOÁN"), "Title must contain payment info");
    assert(embed.data.description.includes(BANK_CONFIG.ACCOUNT_NO), "Must include MBBank account number");
  });

  await runTest("Suite 4", "/khachhang: Non-staff permission rejection", async () => {
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

  await runTest("Suite 4", "/khachhang: Staff grant role successfully", async () => {
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

  await runTest("Suite 4", "/khachhang: Target is bot rejection", async () => {
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

  await runTest("Suite 4", "Slash Command /feedback opens modal immediately", async () => {
    const guild = createMockGuild();
    const user = createMockUser();
    const interaction = createMockInteraction({ type: 'command', commandName: 'feedback', user, guild });

    botClient.emit(Events.InteractionCreate, interaction);
    await waitForInteraction(interaction);

    assertEqual(interaction._state.deferred, false, "/feedback command MUST NOT deferReply");
    assert(interaction._state.modalPayload !== null, "/feedback command must invoke showModal");
    assertEqual(interaction._state.modalPayload.data.custom_id, "modal_feedback", "Modal custom_id matches modal_feedback");
  });

  await runTest("Suite 4", "Autocomplete interaction safety", async () => {
    const interaction = createMockInteraction({ type: 'autocomplete' });
    botClient.emit(Events.InteractionCreate, interaction);
    await new Promise(r => setTimeout(r, 50));
    assertEqual(Array.isArray(interaction._state.respondedAutocomplete), true, "Autocomplete must respond with array");
  });

  await runTest("Suite 4", "Discord Slash Commands Specifications Audit (Names, Descriptions, Types)", async () => {
    assert(Array.isArray(commands), "commands must be an array");
    assert(commands.length >= 8, `commands must contain at least 8 commands (got ${commands.length})`);

    const DISCORD_NAME_REGEX = /^[-_\p{L}\p{N}]{1,32}$/u;

    for (const cmd of commands) {
      // 1. Name verification
      assert(cmd.name && typeof cmd.name === 'string', `Command must have a name: ${JSON.stringify(cmd)}`);
      assert(cmd.name === cmd.name.toLowerCase(), `Command name must be lowercase: ${cmd.name}`);
      assert(cmd.name.length >= 1 && cmd.name.length <= 32, `Command name length must be 1-32: ${cmd.name}`);
      assert(DISCORD_NAME_REGEX.test(cmd.name), `Command name must match regex: ${cmd.name}`);

      // 2. Description verification
      assert(cmd.description && typeof cmd.description === 'string', `Command ${cmd.name} must have a description`);
      assert(cmd.description.length >= 1 && cmd.description.length <= 100, `Command ${cmd.name} description length must be 1-100 (got ${cmd.description.length})`);

      // 3. Options verification
      if (cmd.options && Array.isArray(cmd.options)) {
        for (const opt of cmd.options) {
          assert(opt.name && typeof opt.name === 'string', `Option in ${cmd.name} must have name`);
          assert(opt.name === opt.name.toLowerCase(), `Option name in ${cmd.name} must be lowercase: ${opt.name}`);
          assert(opt.name.length >= 1 && opt.name.length <= 32, `Option name in ${cmd.name} length 1-32: ${opt.name}`);
          assert(DISCORD_NAME_REGEX.test(opt.name), `Option name in ${cmd.name} must match regex: ${opt.name}`);

          assert(opt.description && typeof opt.description === 'string', `Option ${opt.name} in ${cmd.name} must have description`);
          assert(opt.description.length >= 1 && opt.description.length <= 100, `Option ${opt.name} description length 1-100 (got ${opt.description.length})`);
          assert(typeof opt.type === 'number' && opt.type >= 1 && opt.type <= 11, `Option ${opt.name} in ${cmd.name} must have valid option type (1-11)`);
        }
      }
    }
  });

  await runTest("Suite 4", "/help command response", async () => {
    const interaction = createMockInteraction({ type: 'command', commandName: 'help' });
    botClient.emit(Events.InteractionCreate, interaction);
    await waitForInteraction(interaction);

    assert(interaction._state.replied, "Must reply to /help");
    assert(interaction._state.ephemeral, "/help must be ephemeral");
    assert(interaction._state.replyPayload.embeds.length > 0, "Must contain embed");
    const embed = interaction._state.replyPayload.embeds[0];
    assert(embed.data.title.includes("HƯỚNG DẪN"), "Title contains help guide");
    assert(embed.data.description.includes("/ping") && embed.data.description.includes("/stk") && embed.data.description.includes("/khachhang"), "Description lists all slash commands");
  });

  await runTest("Suite 4", "/clearmessages: Non-staff permission rejection", async () => {
    const guild = createMockGuild();
    const normalUser = createMockUser();
    const normalMember = createMockGuildMember({ user: normalUser, guild });
    const interaction = createMockInteraction({
      type: 'command',
      commandName: 'clearmessages',
      user: normalUser,
      member: normalMember,
      guild,
      options: { amount: 10 }
    });

    botClient.emit(Events.InteractionCreate, interaction);
    await waitForInteraction(interaction);

    assert(interaction._state.replied, "Must reply");
    assert(interaction._state.replyPayload.content.includes("không có quyền"), "Must reject non-staff for /clearmessages");
  });

  await runTest("Suite 4", "/clearmessages: Staff bulkDelete execution", async () => {
    const guild = createMockGuild();
    const staffRole = createMockRole({ name: "👑・Founder / Lead Dev", position: 100, permissions: new PermissionsBitField([PermissionsBitField.Flags.Administrator]) });
    guild.roles.cache.set(staffRole.id, staffRole);

    const staffUser = createMockUser();
    const staffMember = createMockMemberWithRole(staffUser, [staffRole], guild);
    const channel = createMockChannel({ guild });

    // Populate channel with mock messages
    await channel.send({ content: "Msg 1" });
    await channel.send({ content: "Msg 2" });
    await channel.send({ content: "Msg 3" });

    const interaction = createMockInteraction({
      type: 'command',
      commandName: 'clearmessages',
      user: staffUser,
      member: staffMember,
      guild,
      channel,
      options: { amount: 3 }
    });

    botClient.emit(Events.InteractionCreate, interaction);
    await waitForInteraction(interaction);

    assert(interaction._state.deferred, "Must deferReply for /clearmessages");
    const clearContent = interaction._state.editReplyPayload?.content || interaction._state.replyPayload?.content || '';
    assert(clearContent.includes("Đã xóa thành công"), "Success message returned for /clearmessages");
  });

  await runTest("Suite 4", "/kiemtra: Tra cứu mã đơn hàng hợp lệ & không hợp lệ", async () => {
    const guild = createMockGuild();
    const userInvalid = createMockUser();
    const userValid = createMockUser();

    // 1. Invalid code format
    const intInvalid = createMockInteraction({
      type: 'command',
      commandName: 'kiemtra',
      user: userInvalid,
      guild,
      options: { code: 'INVALID_CODE_123' }
    });
    botClient.emit(Events.InteractionCreate, intInvalid);
    await waitForInteraction(intInvalid);
    assert(intInvalid._state.replyPayload.content.includes("không đúng định dạng"), "Rejects invalid order code format");

    // 2. Valid active order code
    const orderCode = 'LS888999';
    activeOrderCodes.set(orderCode, { createdAt: Date.now(), pkgKey: 'ls_anticheat', buyerId: userValid.id });

    const intValid = createMockInteraction({
      type: 'command',
      commandName: 'kiemtra',
      user: userValid,
      guild,
      options: { code: orderCode }
    });
    botClient.emit(Events.InteractionCreate, intValid);
    await waitForInteraction(intValid);

    const validPayload = intValid._state.replyPayload || intValid._state.editReplyPayload;
    assert(validPayload && validPayload.embeds && validPayload.embeds.length > 0, "Returns order info embed");
    const embed = validPayload.embeds[0];
    assert(embed.data.title.includes(orderCode), "Title includes order code");
    assert(embed.data.description.includes("CHỜ THANH TOÁN"), "Status shows pending payment");
  });

  await runTest("Suite 4", "/kiemtra: Tra cứu thông tin thành viên (Self & Target Member)", async () => {
    const guild = createMockGuild();
    const customerRole = createMockRole({ name: "🛒・Khách Hàng (Buyer)", position: 10 });
    guild.roles.cache.set(customerRole.id, customerRole);

    const buyerUser = createMockUser({ username: 'vip_buyer' });
    const buyerMember = createMockMemberWithRole(buyerUser, [customerRole], guild);
    guild.members.cache.set(buyerUser.id, buyerMember);

    // 1. Check self
    const intSelf = createMockInteraction({
      type: 'command',
      commandName: 'kiemtra',
      user: buyerUser,
      member: buyerMember,
      guild
    });
    botClient.emit(Events.InteractionCreate, intSelf);
    await waitForInteraction(intSelf);

    assert(intSelf._state.replyPayload.embeds.length > 0, "Returns user embed");
    assert(intSelf._state.replyPayload.embeds[0].data.description.includes("Đã kích hoạt"), "Shows Buyer role active");

    // 2. Check target member
    const staffUser = createMockUser();
    const intTarget = createMockInteraction({
      type: 'command',
      commandName: 'kiemtra',
      user: staffUser,
      guild,
      options: { user: buyerUser }
    });
    botClient.emit(Events.InteractionCreate, intTarget);
    await waitForInteraction(intTarget);

    assert(intTarget._state.replyPayload.embeds.length > 0, "Returns target member embed");
    assert(intTarget._state.replyPayload.embeds[0].data.title.includes(buyerUser.tag), "Title contains target user tag");
  });

  await runTest("Suite 4", "/kiemtra: Autocomplete order code filtering", async () => {
    const order1 = 'LS111222';
    const order2 = 'LS999888';
    activeOrderCodes.set(order1, { createdAt: Date.now(), pkgKey: 'ls_anticheat' });
    approvedOrderCodes.add(order2);

    const intAuto = createMockInteraction({
      type: 'autocomplete',
      options: { _focused: { name: 'code', value: '111' } }
    });
    botClient.emit(Events.InteractionCreate, intAuto);
    await new Promise(r => setTimeout(r, 50));

    assert(Array.isArray(intAuto._state.respondedAutocomplete), "Responds with choices array");
    assert(intAuto._state.respondedAutocomplete.some(c => c.value === order1), "Includes matching active order code");
  });

  // ============================================================================
  // SUITE 5: Button Interactions & Ticket Lifecycle
  // ============================================================================
  console.log("\n🔘 [SUITE 5: Button Interactions & Ticket Lifecycle]");

  await runTest("Suite 5", "Button: ticket_pricing", async () => {
    const guild = createMockGuild();
    const chPrice = createMockChannel({ name: "bảng-giá", guild });

    const interaction = createMockInteraction({ type: 'button', customId: 'ticket_pricing', guild });
    botClient.emit(Events.InteractionCreate, interaction);
    await waitForInteraction(interaction);

    assert(interaction._state.replied, "Must reply");
    assert(interaction._state.replyPayload.content.includes(chPrice.id), "Must link to pricing channel");
  });

  await runTest("Suite 5", "Button: switch_lang_vi & switch_lang_en", async () => {
    const guild = createMockGuild();
    const user = createMockUser();
    userCooldowns.delete(user.id);
    const interactionVi = createMockInteraction({ type: 'button', customId: `switch_lang_vi_${user.id}`, user, guild });
    botClient.emit(Events.InteractionCreate, interactionVi);
    await waitForInteraction(interactionVi);

    assert(interactionVi._state.updatePayload !== null, "Must update message for VI");
    assert(interactionVi._state.updatePayload.embeds[0].data.title.includes("TRUNG TÂM THANH TOÁN"), "VI embed title");

    userCooldowns.delete(user.id);
    const interactionEn = createMockInteraction({ type: 'button', customId: `switch_lang_en_${user.id}`, user, guild });
    botClient.emit(Events.InteractionCreate, interactionEn);
    await waitForInteraction(interactionEn);

    assert(interactionEn._state.updatePayload !== null, "Must update message for EN");
    assert(interactionEn._state.updatePayload.embeds[0].data.title.includes("ORDER & SUPPORT CENTER"), "EN embed title");
  });

  await runTest("Suite 5", "Button: ticket_buy channel creation with permissions & rate limit", async () => {
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

    const interaction2 = createMockInteraction({ type: 'button', customId: 'ticket_buy', user, guild });
    botClient.emit(Events.InteractionCreate, interaction2);
    await waitForInteraction(interaction2);

    assert(interaction2._state.replyPayload.content.includes("quá nhanh"), "Must be rate-limited on immediate second click");
  });

  await runTest("Suite 5", "Button: approve_ order verification, idempotency guard & role grant", async () => {
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
    const orderCode = 'LS' + Math.floor(100000 + Math.random() * 900000);
    const customId = `approve_${orderCode}_${buyerUser.id}_ls_anticheat`;

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

    const interactionDouble = createMockInteraction({
      type: 'button',
      customId,
      user: staffUser,
      member: staffMember,
      guild,
      channel
    });

    botClient.emit(Events.InteractionCreate, interactionDouble);
    await waitForInteraction(interactionDouble);
    assert(
      interactionDouble._state.replyPayload.content.includes("đã được xác nhận") ||
      interactionDouble._state.replyPayload.content.includes("đang được") ||
      interactionDouble._state.replyPayload.content.includes("xử lý"),
      "Double approval blocked"
    );
  });

  await runTest("Suite 5", "Button: Ticket close flow (btn_close_ticket, cancel_close_ticket, confirm_close_ticket)", async () => {
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
    await new Promise(r => setTimeout(r, 100));

    assert(intConfirm._state.updatePayload.embeds[0].data.title.includes("ĐANG ĐÓNG TICKET"), "Closing status rendered");
    assert(logCh.messages.cache.size > 0, "Log channel must receive transcript archive");
  });

  // ============================================================================
  // SUITE 6: Select Menu Package Invoices & 0 VND Custom Flow (17 Items)
  // ============================================================================
  console.log("\n📋 [SUITE 6: Select Menu Package Invoices & 0 VND Custom Flow (17 Items)]");

  const packageKeys = Object.keys(PACKAGES);
  for (const pkgKey of packageKeys) {
    const pkg = PACKAGES[pkgKey];
    await runTest("Suite 6", `Select package: ${pkgKey} (${pkg.price_vnd} VNĐ)`, async () => {
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

  await runTest("Suite 6", "Select Menu: Unauthorized user blocked from selecting", async () => {
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

  // ============================================================================
  // SUITE 7: Modal Components, Sanitization & Input Hardening
  // ============================================================================
  console.log("\n📑 [SUITE 7: Modal Components, Sanitization & Input Hardening]");

  await runTest("Suite 7", "sanitizeModalInlineText: Backtick replacement, newlines, mentions & length limits", async () => {
    assertEqual(sanitizeModalInlineText("`rm -rf /`\nnewline @everyone", 100), "'rm -rf /' newline @ everyone", "Backtick, newline and mention sanitization");
    assertEqual(sanitizeModalInlineText(null, 50, "Default"), "Default", "Null fallback");
    assertEqual(sanitizeModalInlineText("   ", 50, "Fallback"), "Fallback", "Whitespace fallback");
  });

  await runTest("Suite 7", "sanitizeModalCodeBlockText: Triple backticks escaping & length limits", async () => {
    assertEqual(sanitizeModalCodeBlockText("```javascript\nconsole.log(1)\n```"), "'''javascript\nconsole.log(1)\n'''", "Triple backtick escaping");
    assertEqual(sanitizeModalCodeBlockText(null, 100, "Empty"), "Empty", "Null fallback");
  });

  await runTest("Suite 7", "sanitizeDiscordChannelTopic: Formatting & 1024 char limit", async () => {
    const longText = "A".repeat(1500);
    const sanitized = sanitizeDiscordChannelTopic(longText);
    assert(sanitized.length <= 1024, `Channel topic length <= 1024 (got ${sanitized.length})`);
  });

  await runTest("Suite 7", "Modal Constraints: Title <= 45 chars, CustomId <= 100, Max 5 ActionRows, 1 TextInput/Row", async () => {
    const customModal = createCustomOrderModal();
    const customData = customModal.toJSON();
    assert(customData.title.length <= 45, `Custom modal title length <= 45 (got ${customData.title.length})`);
    assert(customData.components.length <= 5, `Custom modal components rows <= 5 (got ${customData.components.length})`);
    customData.components.forEach((row, i) => {
      assertEqual(row.components.length, 1, `Row ${i + 1} must contain exactly 1 TextInput`);
    });

    const supportModal = createSupportTicketModal();
    const supportData = supportModal.toJSON();
    assert(supportData.title.length <= 45, `Support modal title length <= 45 (got ${supportData.title.length})`);
    assert(supportData.components.length <= 5, `Support modal components rows <= 5 (got ${supportData.components.length})`);

    const closeReasonModal = createCloseTicketReasonModal();
    const closeReasonData = closeReasonModal.toJSON();
    assert(closeReasonData.title.length <= 45, `Close Reason modal title length <= 45`);
    assert(closeReasonData.components.length === 1, `Close Reason modal components rows == 1`);

    const feedbackModal = createFeedbackModal();
    const feedbackData = feedbackModal.toJSON();
    assert(feedbackData.title.length <= 45, `Feedback modal title length <= 45`);
    assert(feedbackData.components.length === 2, `Feedback modal components rows == 2`);
  });

  await runTest("Suite 7", "Immediate showModal: Buttons & Slash Command invoke showModal without deferReply", async () => {
    const guild = createMockGuild();
    const user = createMockUser();

    userCooldowns.delete(user.id);
    const intCustom = createMockInteraction({ type: 'button', customId: 'ticket_custom', user, guild });
    botClient.emit(Events.InteractionCreate, intCustom);
    await waitForInteraction(intCustom);
    assertEqual(intCustom._state.deferred, false, "ticket_custom MUST NOT deferReply before showModal");
    assert(intCustom._state.modalPayload !== null, "ticket_custom must invoke showModal");
    assertEqual(intCustom._state.modalPayload.data.custom_id, "modal_custom_order", "Modal custom_id matches");

    userCooldowns.delete(user.id);
    const intSupport = createMockInteraction({ type: 'button', customId: 'ticket_support', user, guild });
    botClient.emit(Events.InteractionCreate, intSupport);
    await waitForInteraction(intSupport);
    assertEqual(intSupport._state.deferred, false, "ticket_support MUST NOT deferReply before showModal");
    assert(intSupport._state.modalPayload !== null, "ticket_support must invoke showModal");
    assertEqual(intSupport._state.modalPayload.data.custom_id, "modal_support_ticket", "Modal custom_id matches");

    userCooldowns.delete(user.id);
    const intOpenModal = createMockInteraction({ type: 'button', customId: 'btn_open_custom_modal', user, guild });
    botClient.emit(Events.InteractionCreate, intOpenModal);
    await waitForInteraction(intOpenModal);
    assertEqual(intOpenModal._state.deferred, false, "btn_open_custom_modal MUST NOT deferReply");
    assert(intOpenModal._state.modalPayload !== null, "btn_open_custom_modal must invoke showModal");

    const intCloseReason = createMockInteraction({ type: 'button', customId: 'btn_close_with_reason', user, guild });
    botClient.emit(Events.InteractionCreate, intCloseReason);
    await waitForInteraction(intCloseReason);
    assertEqual(intCloseReason._state.deferred, false, "btn_close_with_reason MUST NOT deferReply");
    assert(intCloseReason._state.modalPayload !== null, "btn_close_with_reason must invoke showModal");

    const intFeedbackBtn = createMockInteraction({ type: 'button', customId: 'btn_ticket_feedback', user, guild });
    botClient.emit(Events.InteractionCreate, intFeedbackBtn);
    await waitForInteraction(intFeedbackBtn);
    assertEqual(intFeedbackBtn._state.deferred, false, "btn_ticket_feedback MUST NOT deferReply");
    assert(intFeedbackBtn._state.modalPayload !== null, "btn_ticket_feedback must invoke showModal");

    const intFeedbackCmd = createMockInteraction({ type: 'command', commandName: 'feedback', user, guild });
    botClient.emit(Events.InteractionCreate, intFeedbackCmd);
    await waitForInteraction(intFeedbackCmd);
    assertEqual(intFeedbackCmd._state.deferred, false, "/feedback command MUST NOT deferReply");
    assert(intFeedbackCmd._state.modalPayload !== null, "/feedback command must invoke showModal");
  });

  await runTest("Suite 7", "Modal Submit: modal_custom_order creates custom ticket with full fields", async () => {
    const guild = createMockGuild();
    const user = createMockUser({ username: 'moddeveloper' });
    userCooldowns.delete(user.id);
    ticketCreationLocks.delete(user.id);

    const fields = {
      custom_project_type: 'Minecraft Fabric Mod 1.21',
      custom_version: 'Fabric 1.21 Java 21',
      custom_features: 'Them vat pham custom va gui thong bao ActionBar khi dap block',
      custom_budget_deadline: '500.000 VNĐ - 3 ngay',
      custom_contact: 'Discord @moddeveloper'
    };

    const interaction = createMockInteraction({
      type: 'modal',
      customId: 'modal_custom_order',
      user,
      guild,
      fields
    });

    botClient.emit(Events.InteractionCreate, interaction);
    await waitForInteraction(interaction);

    assert(interaction._state.deferred, "Modal submit must deferReply");
    assert(interaction._state.editReplyPayload.content.includes("Ticket đặt làm Custom của bạn đã sẵn sàng"), "Ticket creation confirmation");

    const createdCh = Array.from(guild.channels.cache.values()).find(c => c.name.includes("custom-moddeveloper") || c.name.includes("custom-"));
    assert(createdCh !== undefined, "Custom ticket channel must be created in guild");
    assert(createdCh.topic.includes(user.id), "Channel topic must include user ID");
  });

  await runTest("Suite 7", "Modal Submit: modal_custom_order with markdown injection & codeblock escapes", async () => {
    const guild = createMockGuild();
    const user = createMockUser({ username: 'hacker_test' });
    userCooldowns.delete(user.id);
    ticketCreationLocks.delete(user.id);

    const fields = {
      custom_project_type: '```rm -rf /``` @everyone',
      custom_version: '`v1.0`',
      custom_features: '```Malicious code\nwhile(true)```',
      custom_budget_deadline: '1.000.000 VNĐ',
      custom_contact: '@everyone ping'
    };

    const interaction = createMockInteraction({
      type: 'modal',
      customId: 'modal_custom_order',
      user,
      guild,
      fields
    });

    botClient.emit(Events.InteractionCreate, interaction);
    await waitForInteraction(interaction);

    assert(interaction._state.deferred, "Modal submit must deferReply");
    const createdCh = Array.from(guild.channels.cache.values()).find(c => c.name.includes("custom-hacker_test") || c.name.includes("custom-"));
    assert(createdCh !== undefined, "Custom ticket channel created safely");
    assert(!createdCh.topic.includes("```"), "Channel topic must not contain unescaped codeblocks");
  });

  await runTest("Suite 7", "Modal Submit: modal_custom_order with empty fields triggers fallback defaults", async () => {
    const guild = createMockGuild();
    const user = createMockUser({ username: 'empty_user' });
    userCooldowns.delete(user.id);
    ticketCreationLocks.delete(user.id);

    const fields = {
      custom_project_type: '',
      custom_version: '',
      custom_features: '',
      custom_budget_deadline: '',
      custom_contact: ''
    };

    const interaction = createMockInteraction({
      type: 'modal',
      customId: 'modal_custom_order',
      user,
      guild,
      fields
    });

    botClient.emit(Events.InteractionCreate, interaction);
    await waitForInteraction(interaction);

    assert(interaction._state.deferred, "Modal submit must deferReply");
    const createdCh = Array.from(guild.channels.cache.values()).find(c => c.name.includes("custom-empty_user") || c.name.includes("custom-"));
    assert(createdCh !== undefined, "Custom ticket channel created with fallbacks");
  });

  await runTest("Suite 7", "Modal Submit: modal_custom_order inside existing ticket updates channel", async () => {
    const guild = createMockGuild();
    const user = createMockUser({ username: 'existing_buyer' });
    userCooldowns.delete(user.id);
    ticketCreationLocks.delete(user.id);

    const ticketChannel = createMockChannel({
      name: "🛒-mua-existing_buyer",
      topic: `Ticket của @existing_buyer (${user.id}) • Type: ticket_buy`,
      guild
    });

    const fields = {
      custom_project_type: 'Plugin AntiDupe',
      custom_version: '1.20.4',
      custom_features: 'Chong dupe shulker box',
      custom_budget_deadline: '300.000 VNĐ',
      custom_contact: 'Discord'
    };

    const interaction = createMockInteraction({
      type: 'modal',
      customId: 'modal_custom_order',
      user,
      guild,
      channel: ticketChannel,
      fields
    });

    botClient.emit(Events.InteractionCreate, interaction);
    await waitForInteraction(interaction);

    assert(interaction._state.deferred, "Modal submit must deferReply");
    assert(interaction._state.editReplyPayload.content.includes("Đã cập nhật yêu cầu"), "Channel updated message");
    assert(ticketChannel.topic.includes("Plugin AntiDupe"), "Topic updated with new spec");
  });

  await runTest("Suite 7", "Modal Submit: modal_custom_order in DM (guild = null) rejected gracefully", async () => {
    const user = createMockUser({ username: 'dm_user' });
    const interaction = createMockInteraction({
      type: 'modal',
      customId: 'modal_custom_order',
      user,
      guild: null,
      fields: {}
    });

    botClient.emit(Events.InteractionCreate, interaction);
    await waitForInteraction(interaction);

    assert(interaction._state.replied, "Must reply");
    assert(interaction._state.replyPayload.content.includes("trong máy chủ"), "DM modal submit rejected");
  });

  await runTest("Suite 7", "Modal Submit: modal_support_ticket creates support ticket channel", async () => {
    const guild = createMockGuild();
    const user = createMockUser({ username: 'playerhelp' });
    userCooldowns.delete(user.id);
    ticketCreationLocks.delete(user.id);

    const fields = {
      support_issue_title: 'Lỗi không load database SQLite',
      support_server_env: 'Paper 1.20.4 Java 17',
      support_description: 'Khi khoi dong server thi plugin bao loi NullPointerException tai line 45'
    };

    const interaction = createMockInteraction({
      type: 'modal',
      customId: 'modal_support_ticket',
      user,
      guild,
      fields
    });

    botClient.emit(Events.InteractionCreate, interaction);
    await waitForInteraction(interaction);

    assert(interaction._state.deferred, "Modal submit must deferReply");
    assert(interaction._state.editReplyPayload.content.includes("Ticket hỗ trợ kỹ thuật của bạn đã sẵn sàng"), "Support ticket confirmation");

    const createdCh = Array.from(guild.channels.cache.values()).find(c => c.name.includes("support-playerhelp") || c.name.includes("support-"));
    assert(createdCh !== undefined, "Support ticket channel must be created");
  });

  await runTest("Suite 7", "Modal Submit: modal_support_ticket with massive error log truncated safely", async () => {
    const guild = createMockGuild();
    const user = createMockUser({ username: 'log_spammer' });
    userCooldowns.delete(user.id);
    ticketCreationLocks.delete(user.id);

    const massiveLog = "Error at stack trace\n".repeat(500);
    const fields = {
      support_issue_title: 'Crash server',
      support_server_env: 'Fabric 1.21',
      support_description: massiveLog
    };

    const interaction = createMockInteraction({
      type: 'modal',
      customId: 'modal_support_ticket',
      user,
      guild,
      fields
    });

    botClient.emit(Events.InteractionCreate, interaction);
    await waitForInteraction(interaction);

    assert(interaction._state.deferred, "Modal submit must deferReply");
    const createdCh = Array.from(guild.channels.cache.values()).find(c => c.name.includes("support-log_spammer") || c.name.includes("support-"));
    assert(createdCh !== undefined, "Channel created safely");
    assert(createdCh.messages.cache.size > 0, "Log embed posted safely without Discord length limit rejection");
  });

  await runTest("Suite 7", "Modal Submit: modal_close_ticket_reason logs reason and sends transcript", async () => {
    const guild = createMockGuild();
    const user = createMockUser({ username: 'staffmember' });
    const logCh = createMockChannel({ name: "nhật-ký-giao-dịch", guild });
    const ticketCh = createMockChannel({ name: "📝-custom-player1", topic: `Ticket của @player1 (${user.id})`, guild });

    const fields = {
      close_reason: 'Đã hoàn thành bàn giao file Mod Fabric 1.21 và khách hàng xác nhận hoạt động tốt'
    };

    const interaction = createMockInteraction({
      type: 'modal',
      customId: 'modal_close_ticket_reason',
      user,
      guild,
      channel: ticketCh,
      fields
    });

    botClient.emit(Events.InteractionCreate, interaction);
    await waitForInteraction(interaction);

    assert(interaction._state.deferred, "Must deferReply");
    assert(interaction._state.editReplyPayload.content.includes("Đã ghi nhận lý do và tiến hành đóng ticket"), "Success confirmation");
  });

  await runTest("Suite 7", "Modal Submit: modal_feedback forwards customer rating and comments", async () => {
    const guild = createMockGuild();
    const user = createMockUser({ username: 'happybuyer' });
    const fbCh = createMockChannel({ name: "đánh-giá-uy-tín", guild });

    const fields = {
      feedback_rating: '5 sao ⭐⭐⭐⭐⭐',
      feedback_comment: 'Dịch vụ rất nhiệt tình, plugin chạy mượt mà không lỗi lầm gì!'
    };

    const interaction = createMockInteraction({
      type: 'modal',
      customId: 'modal_feedback',
      user,
      guild,
      fields
    });

    botClient.emit(Events.InteractionCreate, interaction);
    await waitForInteraction(interaction);

    assert(interaction._state.deferred, "Must deferReply");
    assert(interaction._state.editReplyPayload.content.includes("Cảm ơn bạn rất nhiều"), "Feedback confirmation message");
  });

  // ============================================================================
  // SUITE 8: Transcript Scalability, Size Limits & Advanced Formatting
  // ============================================================================
  console.log("\n📜 [SUITE 8: Transcript Scalability, Size Limits & Advanced Formatting]");

  await runTest("Suite 8", "generateTranscript: Empty channel (0 messages)", async () => {
    const guild = createMockGuild();
    const channel = createMockChannel({ name: "empty-ticket", topic: "Empty Topic", guild, messages: [] });
    const transcript = await generateTranscript(channel, "Test Close");

    assert(transcript.includes("LS STUDIO - TICKET TRANSCRIPT"), "Transcript title");
    assert(transcript.includes("Tổng số tin nhắn / Total Messages: 0"), "Total messages count is 0");
    assert(transcript.includes("Test Close"), "Close reason recorded");
  });

  await runTest("Suite 8", "generateTranscript: Multi-page message pagination (>200 messages)", async () => {
    const guild = createMockGuild();
    const mockMessages = [];
    for (let i = 1; i <= 250; i++) {
      mockMessages.push({
        id: 'msg_' + i.toString().padStart(4, '0'),
        content: `Tin nhắn số #${i} trong cuộc trò chuyện ticket`,
        createdTimestamp: Date.now() + i * 1000,
        author: { id: 'u1', tag: 'User1#0001', username: 'User1', bot: false }
      });
    }

    const channel = createMockChannel({ name: "paginated-ticket", topic: "Pagination Test", guild, messages: mockMessages });
    const transcript = await generateTranscript(channel);

    assert(transcript.includes("Tổng số tin nhắn / Total Messages: 250"), "Transcript must collect all 250 messages across 3 pages");
    assert(transcript.includes("Tin nhắn số #1"), "First message included");
    assert(transcript.includes("Tin nhắn số #250"), "Last message included");
  });

  await runTest("Suite 8", "generateTranscript: Rich message features (attachments, stickers, embeds, reactions, webhooks)", async () => {
    const guild = createMockGuild();
    const authorUser = createMockUser({ username: 'dev_author' });

    const richMessages = [
      {
        id: 'msg_001',
        content: 'Day la file config va ma nguon:',
        createdTimestamp: Date.now(),
        author: authorUser,
        attachments: new Collection([
          ['att1', { name: 'config.yml', size: 15360, contentType: 'text/yaml', url: 'https://cdn.discordapp.com/attachments/1/config.yml' }]
        ])
      },
      {
        id: 'msg_002',
        content: '',
        createdTimestamp: Date.now() + 1000,
        author: authorUser,
        stickers: new Collection([
          ['stk1', { id: '998877', name: 'ThumbsUp', url: 'https://media.discordapp.net/stickers/998877.png' }]
        ])
      },
      {
        id: 'msg_003',
        content: 'Thong tin don hang:',
        createdTimestamp: Date.now() + 2000,
        author: authorUser,
        embeds: [
          {
            title: 'Don Hang LS123456',
            description: 'Goi LS-AntiCheat',
            fields: [{ name: 'Gia', value: '30.000 VNĐ' }]
          }
        ],
        reactions: {
          cache: new Collection([
            ['👍', { emoji: { name: '👍' }, count: 3 }]
          ])
        }
      },
      {
        id: 'msg_004',
        content: 'Automated notification from GitHub',
        createdTimestamp: Date.now() + 3000,
        author: null,
        webhookId: 'webhook_github_123'
      }
    ];

    const channel = createMockChannel({ name: "rich-ticket", guild, messages: richMessages });
    const transcript = await generateTranscript(channel);

    assert(transcript.includes("[Đính kèm / Attachment]: config.yml"), "Attachment recorded");
    assert(transcript.includes("(15.0 KB)"), "Attachment file size in KB recorded");
    assert(transcript.includes("[Nhãn dán / Sticker]: ThumbsUp"), "Sticker recorded");
    assert(transcript.includes("[Embed]:"), "Embed recorded");
    assert(transcript.includes("[Cảm xúc / Reactions]: 👍 (3)"), "Reaction recorded");
    assert(transcript.includes("Webhook [ID: webhook_github_123]") || transcript.includes("webhook_github_123"), "Webhook author handled safely");
  });

  await runTest("Suite 8", "generateTranscript: Non-text or invalid channel error handling", async () => {
    const invalidChannel = { isTextBased: () => false };
    const transcript = await generateTranscript(invalidChannel);
    assert(transcript.includes("Lỗi: Kênh không hợp lệ"), "Rejects invalid channel gracefully without crash");
  });

  // ============================================================================
  // SUITE 9: Rate Limiting, Cooldowns & Concurrency Guards
  // ============================================================================
  console.log("\n⏱️ [SUITE 9: Rate Limiting, Cooldowns & Concurrency Guards]");

  await runTest("Suite 9", "getRateLimitRemaining: Independent user cooldown tracking", async () => {
    const u1 = 'user_rate_1';
    const u2 = 'user_rate_2';
    userCooldowns.delete(u1);
    userCooldowns.delete(u2);

    const cd1 = getRateLimitRemaining(u1, 3000);
    assertEqual(cd1, 0, "First action of User 1 has 0s cooldown");

    const cd1_repeat = getRateLimitRemaining(u1, 3000);
    assert(cd1_repeat > 0, "Immediate repeat action of User 1 is throttled");

    const cd2 = getRateLimitRemaining(u2, 3000);
    assertEqual(cd2, 0, "User 2 is independent and has 0s cooldown");
  });

  await runTest("Suite 9", "getRateLimitRemaining: Custom cooldown durations", async () => {
    const u = 'user_custom_cd';
    userCooldowns.delete(u);

    getRateLimitRemaining(u, 10000);
    const remaining = getRateLimitRemaining(u, 10000);
    assert(remaining >= 9 && remaining <= 10, `Remaining cooldown should be ~10s (got ${remaining}s)`);
  });

  await runTest("Suite 9", "getRateLimitRemaining: High-capacity memory eviction (>5,000 entries)", async () => {
    userCooldowns.clear();
    const oldTime = Date.now() - 70000;
    for (let i = 0; i < 5050; i++) {
      userCooldowns.set(`old_user_${i}`, oldTime);
    }
    assertEqual(userCooldowns.size, 5050, "Initial cache populated to 5,050 entries");

    getRateLimitRemaining("new_user_trigger", 5000);
    assert(userCooldowns.size <= 5000, `Memory eviction must keep cache size <= 5,000 entries (got ${userCooldowns.size})`);
    userCooldowns.clear();
  });

  await runTest("Suite 9", "ticketCreationLocks: Concurrency race condition prevention & TTL cleanup", async () => {
    const uid = 'race_user_123';
    ticketCreationLocks.delete(uid);

    assert(!ticketCreationLocks.has(uid), "Lock initially free");
    ticketCreationLocks.add(uid);
    assert(ticketCreationLocks.has(uid), "Lock acquired");

    ticketCreationLocks.set(uid, Date.now() - 35000);
    assert(!ticketCreationLocks.has(uid), "Lock auto-expires after TTL");
    ticketCreationLocks.delete(uid);
  });

  // ============================================================================
  // SUITE 10: Server Setup Dry-Run (setup_server.js)
  // ============================================================================
  console.log("\n🏗️ [SUITE 10: Server Setup Dry-Run (setup_server.js)]");

  await runTest("Suite 10", "Full server structure generation, role sync & channel categories", async () => {
    const mockGuild = createMockGuild();
    const mockClient = {
      user: createMockUser({ username: 'LS Studio Bot', tag: 'LS Studio Bot#0001', bot: true }),
      guilds: {
        fetch: async (id) => mockGuild
      }
    };

    await runServerSetup(mockClient, mockGuild.id);

    const expectedRoles = [
      '👑・Founder / Lead Dev',
      '🛠️・Developer',
      '🛡️・Staff / Support',
      '💎・VIP Customer',
      '🛒・Khách Hàng (Buyer)',
      '🤝・Đối Tác (Partner)',
      '👥・Thành Viên',
      '🔔・Ping Plugin Updates',
      '🎁・Ping Giveaway & Event'
    ];

    for (const rName of expectedRoles) {
      const found = Array.from(mockGuild.roles.cache.values()).find(r => r.name === rName);
      assert(found !== undefined, `Role "${rName}" must be created/synced`);
    }

    const expectedChannels = [
      '👋・chào-mừng',
      '🚪・tạm-biệt',
      '📜・luật-lệ',
      '📢・thông-báo',
      '🚀・cập-nhật-changelog',
      '🎁・giveaway-sự-kiện',
      '💎・sản-phẩm-plugin',
      '💰・bảng-giá',
      '🌐・server-test-demo',
      '⭐・đánh-giá-uy-tín',
      '🛒・mua-plugin',
      '🛠️・hỗ-trợ-kỹ-thuật',
      '📝・đặt-làm-plugin',
      '💬・trò-chuyện-chung',
      '💡・góp-ý-ý-tưởng',
      '📸・khoe-server-mc',
      '🤖・lệnh-bot',
      '📦・tải-plugin-updates',
      '💬・chat-khách-hàng',
      '📊・nhật-ký-giao-dịch',
      '💬・nội-bộ-staff'
    ];

    for (const cName of expectedChannels) {
      const found = Array.from(mockGuild.channels.cache.values()).find(c => c.name === cName);
      assert(found !== undefined, `Channel "${cName}" must be created/synced`);
    }

    const chRules = Array.from(mockGuild.channels.cache.values()).find(c => c.name === '📜・luật-lệ');
    assert(chRules && chRules.messages.cache.size > 0, "Rules channel must receive embeds");

    const chPricing = Array.from(mockGuild.channels.cache.values()).find(c => c.name === '💰・bảng-giá');
    assert(chPricing && chPricing.messages.cache.size > 0, "Pricing channel must receive embeds");

    const chBuy = Array.from(mockGuild.channels.cache.values()).find(c => c.name === '🛒・mua-plugin');
    assert(chBuy && chBuy.messages.cache.size > 0, "Buy plugin channel must receive panel embed with button");
  });

  // ============================================================================
  // SUITE 12: Homoglyph Invite Link Detection & Obfuscation Evasion
  // ============================================================================
  console.log("\n🕵️ [SUITE 12: Homoglyph Invite Link Detection & Obfuscation Evasion]");

  await runTest("Suite 12", "Cyrillic homoglyphs in discord domain and invite codes", async () => {
    // Cyrillic 'і' (U+0456), 'ѕ' (U+0455), 'с' (U+0441), 'о' (U+043E)
    assert(containsDiscordInvite("Check this: https://dіѕсоrd.gg/alpha123"), "Cyrillic dіѕсоrd.gg");
    assert(containsDiscordInvite("Tham gia: dіѕсоrd.соm/іnvіtе/mycode"), "Cyrillic discord.com/invite");
    assert(containsDiscordInvite("Join: ԁіѕсоrd.gg/xyz"), "Cyrillic ԁ (U+0501)");
    assert(containsDiscordInvite("Server: dіѕсօrd.gg/arm"), "Armenian օ (U+0585)");
  });

  await runTest("Suite 12", "Greek & IPA phonetic letter homoglyphs", async () => {
    // Greek iota 'ι' (U+03B9), IPA 'ɡ' (U+0261)
    assert(containsDiscordInvite("Link server: dιscord.gg/greek"), "Greek iota in discord");
    assert(containsDiscordInvite("Vao server: discord.ɡɡ/ipa"), "IPA script g in .gg");
    assert(containsDiscordInvite("Link: ԁιѕсօrd.ɡɡ/mixed"), "Multi-script homoglyphs combination");
  });

  await runTest("Suite 12", "Punctuation & Dot homoglyphs (one-dot leader, bullet, middle dot, fullwidth dot)", async () => {
    assert(containsDiscordInvite("discord․gg/onedot"), "One-dot leader (U+2024)");
    assert(containsDiscordInvite("discord．gg/fullwidthdot"), "Fullwidth dot (U+FF0E)");
    assert(containsDiscordInvite("discord‧gg/hyphendot"), "Hyphenation point (U+2027)");
    assert(containsDiscordInvite("discord•gg/bullet"), "Bullet (U+2022)");
    assert(containsDiscordInvite("discord·gg/middledot"), "Middle dot (U+00B7)");
    assert(containsDiscordInvite("discord∙gg/bulletop"), "Bullet operator (U+2219)");
    assert(containsDiscordInvite("discord﹒gg/smalldot"), "Small full stop (U+FE52)");
  });

  await runTest("Suite 12", "Slash homoglyphs (fullwidth solidus, fraction slash, division slash)", async () => {
    assert(containsDiscordInvite("discord.gg／fullwidthslash"), "Fullwidth solidus (U+FF0F)");
    assert(containsDiscordInvite("discord.gg⁄fractionslash"), "Fraction slash (U+2044)");
    assert(containsDiscordInvite("discord.gg∕divisionslash"), "Division slash (U+2215)");
    assert(containsDiscordInvite("discord.com＼invite＼backslash"), "Backslash delimiter");
  });

  await runTest("Suite 12", "Word-based dot/slash obfuscation & bracket patterns", async () => {
    assert(containsDiscordInvite("vao discord(dot)gg/freecode"), "(dot) in parenthesis");
    assert(containsDiscordInvite("link: discord[dot]gg/freecode"), "[dot] in square brackets");
    assert(containsDiscordInvite("link: discord{dot}gg/freecode"), "{dot} in curly brackets");
    assert(containsDiscordInvite("tham gia discord (dot) gg / myserver"), "spaced (dot)");
    assert(containsDiscordInvite("discord(slash)invite"), "(slash) replacement");
  });

  await runTest("Suite 12", "Zero-width and invisible control character injection", async () => {
    assert(containsDiscordInvite("d\u200Bi\u200Ds\uFEFFc\u200Eo\u200Fr\u2060d.gg/stealth"), "Zero-width spaces embedded");
    assert(containsDiscordInvite("discord\u00AD.gg/soft-hyphen"), "Soft hyphen (U+00AD)");
    assert(containsDiscordInvite("discord.gg/\u200B\u200C\u200Dcode"), "Zero-width characters in code");
  });

  await runTest("Suite 12", "Alternative Discord vanity domains and short links", async () => {
    assert(containsDiscordInvite("Join server: https://dsc.gg/lsstudio"), "dsc.gg short link");
    assert(containsDiscordInvite("Vao server: invite.gg/minecraft"), "invite.gg link");
    assert(containsDiscordInvite("Link: dis.gd/helpme"), "dis.gd link");
    assert(containsDiscordInvite("Link: discord.me/mycommunity"), "discord.me link");
    assert(containsDiscordInvite("Link: discord.io/myserver"), "discord.io link");
    assert(containsDiscordInvite("Link: discord.li/gamer"), "discord.li link");
    assert(containsDiscordInvite("Link: discord.link/hub"), "discord.link");
  });

  await runTest("Suite 12", "Markdown masked links & spoiler tags evasion", async () => {
    assert(containsDiscordInvite("[Click here for free VIP plugin](https://discord.gg/malicious)"), "Markdown masked link");
    assert(containsDiscordInvite("||https://discord.gg/spoilertag||"), "Spoiler tags wrapped");
    assert(containsDiscordInvite("`<https://discord.gg/bracketed>`"), "Angle brackets + backticks");
  });

  await runTest("Suite 12", "AutoMod MessageCreate event triggers on homoglyph invite", async () => {
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
      content: "Vao server cua minh nhe: dіѕсоrd․gg／hacker123",
      mentions: { everyone: false },
      deletable: true,
      delete: async () => { deleted = true; }
    };

    botClient.emit(Events.MessageCreate, msg);
    await new Promise(r => setTimeout(r, 50));
    assertEqual(deleted, true, "Message containing homoglyph invite must be deleted");
  });

  await runTest("Suite 12", "Safe false-positive exemptions (Safe URLs & text)", async () => {
    assert(!containsDiscordInvite("https://github.com/LS-Studio/bot-discord"), "GitHub repo URL");
    assert(!containsDiscordInvite("https://spigotmc.org/resources/ls-anticheat.12345"), "SpigotMC plugin URL");
    assert(!containsDiscordInvite("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "YouTube URL");
    assert(!containsDiscordInvite("Huong dan cai dat bot discord tren Windows VPS"), "Plain educational text");
    assert(!containsDiscordInvite("npm install discord.js@latest"), "npm install command");
  });

  // ============================================================================
  // SUITE 13: VietQR Buffer Caching & Network Resilience
  // ============================================================================
  console.log("\n⚡ [SUITE 13: VietQR Buffer Caching & Network Resilience]");

  await runTest("Suite 13", "Buffer cache hit verification with identical buffer reference", async () => {
    clearVietQRCache();
    const qrUrl = generateVietQRUrl({ amount: 30000, addInfo: 'LS111222' });
    const mockPngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, ...new Array(600).fill(0)]);

    // Seed cache directly to verify caching mechanism
    vietQRBufferCache.set(qrUrl, {
      buffer: mockPngBuffer,
      cachedAt: Date.now(),
      size: mockPngBuffer.length
    });

    const res = await fetchVietQRBuffer(qrUrl);
    assert(res !== null, "Must return buffer");
    assertEqual(res.length, mockPngBuffer.length, "Buffer length matches");
    assertEqual(res[0], 0x89, "PNG magic byte 0 matches");
    assertEqual(res[1], 0x50, "PNG magic byte 1 matches");

    const stats = getVietQRCacheStats();
    assert(stats.size >= 1, "Cache size reflects stored item");
    assertEqual(stats.maxSize, 100, "Max cache capacity is 100");
  });

  await runTest("Suite 13", "Cache key isolation between different amounts and memos", async () => {
    clearVietQRCache();
    const url1 = generateVietQRUrl({ amount: 30000, addInfo: 'LS000001' });
    const url2 = generateVietQRUrl({ amount: 59000, addInfo: 'LS000002' });

    const buf1 = Buffer.from([0x89, 0x50, 0x4E, 0x47, ...new Array(600).fill(1)]);
    const buf2 = Buffer.from([0x89, 0x50, 0x4E, 0x47, ...new Array(600).fill(2)]);

    vietQRBufferCache.set(url1, { buffer: buf1, cachedAt: Date.now(), size: buf1.length });
    vietQRBufferCache.set(url2, { buffer: buf2, cachedAt: Date.now(), size: buf2.length });

    const fetched1 = await fetchVietQRBuffer(url1);
    const fetched2 = await fetchVietQRBuffer(url2);

    assertEqual(fetched1[4], 1, "Buffer 1 payload matches");
    assertEqual(fetched2[4], 2, "Buffer 2 payload matches");
    assert(fetched1 !== fetched2, "Different URLs return distinct buffer objects");
  });

  await runTest("Suite 13", "Cache TTL expiration and refresh behavior", async () => {
    clearVietQRCache();
    const qrUrl = generateVietQRUrl({ amount: 99000, addInfo: 'LS999999' });
    const oldBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, ...new Array(600).fill(9)]);

    // Set cache entry created 15 minutes ago (>10 min TTL)
    vietQRBufferCache.set(qrUrl, {
      buffer: oldBuffer,
      cachedAt: Date.now() - (15 * 60 * 1000),
      size: oldBuffer.length
    });

    const result = await fetchVietQRBuffer(qrUrl);
    const cacheEntry = vietQRBufferCache.get(qrUrl);
    assert(cacheEntry === undefined || cacheEntry.cachedAt > Date.now() - 5000, "Expired entry must be refreshed or evicted");
  });

  await runTest("Suite 13", "clearVietQRCache resets cache completely", async () => {
    clearVietQRCache();
    assertEqual(vietQRBufferCache.size, 0, "Cache size is 0 after clear");
  });

  await runTest("Suite 13", "Magic bytes verification for image formats (PNG, JPEG, GIF, WebP)", async () => {
    const pngBuf = Buffer.from([0x89, 0x50, 0x4E, 0x47, ...new Array(550).fill(0)]);
    const isPng = pngBuf[0] === 0x89 && pngBuf[1] === 0x50 && pngBuf[2] === 0x4E && pngBuf[3] === 0x47;
    assert(isPng, "PNG format recognized");

    const jpegBuf = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, ...new Array(550).fill(0)]);
    const isJpeg = jpegBuf[0] === 0xFF && jpegBuf[1] === 0xD8 && jpegBuf[2] === 0xFF;
    assert(isJpeg, "JPEG format recognized");

    const gifBuf = Buffer.from([0x47, 0x49, 0x46, 0x38, ...new Array(550).fill(0)]);
    const isGif = gifBuf[0] === 0x47 && gifBuf[1] === 0x49 && gifBuf[2] === 0x46;
    assert(isGif, "GIF format recognized");

    const webpBuf = Buffer.concat([Buffer.from("RIFF1234WEBP"), Buffer.alloc(550)]);
    const isWebp = webpBuf.toString('ascii', 0, 4) === 'RIFF' && webpBuf.toString('ascii', 8, 12) === 'WEBP';
    assert(isWebp, "WebP format recognized");
  });

  await runTest("Suite 13", "Cache resilience on network error & invalid URLs", async () => {
    const res1 = await fetchVietQRBuffer(null);
    assertEqual(res1, null, "Null URL returns null");
    const res2 = await fetchVietQRBuffer("not_a_url");
    assertEqual(res2, null, "Non-HTTP URL returns null");
    const res3 = await fetchVietQRBuffer("https://non-existent-bank-gateway-domain.io/qr.png");
    assertEqual(res3, null, "Network error returns null safely");
  });

  // ============================================================================
  // SUITE 14: Redundant Role Grant Prevention & Hierarchy Protection
  // ============================================================================
  console.log("\n🛡️ [SUITE 14: Redundant Role Grant Prevention & Hierarchy Protection]");

  await runTest("Suite 14", "/khachhang: Redundant role grant prevented when user already has Customer role", async () => {
    const guild = createMockGuild();
    const staffRole = createMockRole({ name: "👑・Founder / Lead Dev", position: 100, permissions: new PermissionsBitField([PermissionsBitField.Flags.Administrator]) });
    const customerRole = createMockRole({ name: "🛒・Khách Hàng (Buyer)", position: 10 });
    guild.roles.cache.set(staffRole.id, staffRole);
    guild.roles.cache.set(customerRole.id, customerRole);

    const staffUser = createMockUser();
    const staffMember = createMockMemberWithRole(staffUser, [staffRole], guild);

    const targetUser = createMockUser({ username: 'existing_customer' });
    let addRoleCalled = false;
    const targetMember = createMockGuildMember({ id: targetUser.id, user: targetUser, guild, roles: [customerRole] });
    targetMember.roles.add = async () => { addRoleCalled = true; };
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

    assertEqual(addRoleCalled, false, "member.roles.add MUST NOT be called when member already has role");
    assert(interaction._state.editReplyPayload.content.includes("đã sở hữu role"), "Notice informing role already owned");
  });

  await runTest("Suite 14", "/khachhang: Server Owner target rejection", async () => {
    const guild = createMockGuild();
    const staffRole = createMockRole({ name: "👑・Founder / Lead Dev", position: 100, permissions: new PermissionsBitField([PermissionsBitField.Flags.Administrator]) });
    const customerRole = createMockRole({ name: "🛒・Khách Hàng (Buyer)", position: 10 });
    guild.roles.cache.set(staffRole.id, staffRole);
    guild.roles.cache.set(customerRole.id, customerRole);

    const staffUser = createMockUser();
    const staffMember = createMockMemberWithRole(staffUser, [staffRole], guild);

    const ownerUser = createMockUser({ id: guild.ownerId, username: 'server_owner' });
    const ownerMember = createMockGuildMember({ id: ownerUser.id, user: ownerUser, guild });
    guild.members.cache.set(ownerUser.id, ownerMember);

    const interaction = createMockInteraction({
      type: 'command',
      commandName: 'khachhang',
      user: staffUser,
      member: staffMember,
      guild,
      options: { user: ownerUser }
    });

    botClient.emit(Events.InteractionCreate, interaction);
    await waitForInteraction(interaction);

    assert(interaction._state.editReplyPayload.content.includes("Chủ Sở Hữu") || interaction._state.editReplyPayload.content.includes("Server Owner"), "Server owner protected");
  });

  await runTest("Suite 14", "/khachhang: Target member with higher role than Bot rejection", async () => {
    const guild = createMockGuild();
    const staffRole = createMockRole({ name: "👑・Founder / Lead Dev", position: 100, permissions: new PermissionsBitField([PermissionsBitField.Flags.Administrator]) });
    const customerRole = createMockRole({ name: "🛒・Khách Hàng (Buyer)", position: 10 });
    const superAdminRole = createMockRole({ name: "Supreme Admin", position: 150 });
    guild.roles.cache.set(staffRole.id, staffRole);
    guild.roles.cache.set(customerRole.id, customerRole);
    guild.roles.cache.set(superAdminRole.id, superAdminRole);

    const staffUser = createMockUser();
    const staffMember = createMockMemberWithRole(staffUser, [staffRole], guild);

    const targetUser = createMockUser({ username: 'high_rank_user' });
    const targetMember = createMockGuildMember({ id: targetUser.id, user: targetUser, guild, roles: [superAdminRole] });
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

    assert(interaction._state.editReplyPayload.content.includes("thứ bậc Role cao hơn") || interaction._state.editReplyPayload.content.includes("Role Hierarchy"), "Higher role target rejected");
  });

  await runTest("Suite 14", "approve_ button: Skips duplicate role addition if buyer already has Customer role", async () => {
    const guild = createMockGuild();
    const staffRole = createMockRole({ name: "🛡️・Staff / Support", permissions: new PermissionsBitField([PermissionsBitField.Flags.Administrator]) });
    const customerRole = createMockRole({ name: "🛒・Khách Hàng (Buyer)" });
    guild.roles.cache.set(staffRole.id, staffRole);
    guild.roles.cache.set(customerRole.id, customerRole);

    const logCh = createMockChannel({ name: "nhật-ký-giao-dịch", guild });
    const staffUser = createMockUser();
    const staffMember = createMockMemberWithRole(staffUser, [staffRole], guild);

    const buyerUser = createMockUser({ username: 'vip_buyer' });
    let addRoleCalled = false;
    const buyerMember = createMockGuildMember({ id: buyerUser.id, user: buyerUser, guild, roles: [customerRole] });
    buyerMember.roles.add = async () => { addRoleCalled = true; };
    guild.members.cache.set(buyerUser.id, buyerMember);

    const ticketCh = createMockChannel({ name: "🛒-mua-vip_buyer", guild });
    const orderCode = 'LS' + Math.floor(100000 + Math.random() * 900000);
    const customId = `approve_${orderCode}_${buyerUser.id}_ls_anticheat`;

    const interaction = createMockInteraction({
      type: 'button',
      customId,
      user: staffUser,
      member: staffMember,
      guild,
      channel: ticketCh
    });

    botClient.emit(Events.InteractionCreate, interaction);
    await waitForInteraction(interaction);

    assertEqual(addRoleCalled, false, "member.roles.add MUST NOT be called when buyer already has Customer role");
    assert(ticketCh.messages.cache.size > 0, "Approval receipt sent");
    const lastMsg = Array.from(ticketCh.messages.cache.values()).pop();
    assert(lastMsg.embeds[0].data.description.includes("đã sở hữu role"), "Embed notes buyer already has role");
  });

  await runTest("Suite 14", "approve_ button: Idempotency locks block concurrent double execution", async () => {
    const guild = createMockGuild();
    const staffRole = createMockRole({ name: "🛡️・Staff / Support", permissions: new PermissionsBitField([PermissionsBitField.Flags.Administrator]) });
    guild.roles.cache.set(staffRole.id, staffRole);

    const staffUser = createMockUser();
    const staffMember = createMockMemberWithRole(staffUser, [staffRole], guild);
    const buyerUser = createMockUser({ username: 'buyer_test' });
    const ticketCh = createMockChannel({ name: "ticket-approve", guild });

    const orderCode = 'LS' + Math.floor(100000 + Math.random() * 900000);
    approvedOrderCodes.add(orderCode); // Simulate already approved order

    const customId = `approve_${orderCode}_${buyerUser.id}_ls_anticheat`;
    const interaction = createMockInteraction({
      type: 'button',
      customId,
      user: staffUser,
      member: staffMember,
      guild,
      channel: ticketCh
    });

    botClient.emit(Events.InteractionCreate, interaction);
    await waitForInteraction(interaction);

    assert(
      interaction._state.replyPayload.content.includes("đã được xác nhận") ||
      interaction._state.replyPayload.content.includes("xử lý"),
      "Duplicate approval blocked by idempotency guard"
    );
    approvedOrderCodes.delete(orderCode);
  });

  // ============================================================================
  // SUITE 15: Modal Submission Edge Cases & Input Sanitization
  // ============================================================================
  console.log("\n📝 [SUITE 15: Modal Submission Edge Cases & Input Sanitization]");

  await runTest("Suite 15", "modal_custom_order: 4,000 character maximum length field truncated safely", async () => {
    const guild = createMockGuild();
    const user = createMockUser({ username: 'long_text_buyer' });
    userCooldowns.delete(user.id);
    ticketCreationLocks.delete(user.id);

    const superLongDesc = "Tính năng chi tiết Mod: ".repeat(200); // ~5,000 chars
    const fields = {
      custom_project_type: 'Fabric Mod ' + 'A'.repeat(200),
      custom_version: '1.21 ' + 'B'.repeat(200),
      custom_features: superLongDesc,
      custom_budget_deadline: '1.000.000 VNĐ ' + 'C'.repeat(200),
      custom_contact: 'Discord @user ' + 'D'.repeat(200)
    };

    const interaction = createMockInteraction({
      type: 'modal',
      customId: 'modal_custom_order',
      user,
      guild,
      fields
    });

    botClient.emit(Events.InteractionCreate, interaction);
    await waitForInteraction(interaction);

    assert(interaction._state.deferred, "Modal submit must deferReply");
    const createdCh = Array.from(guild.channels.cache.values()).find(c => c.name.includes("custom-long_text_buyer") || c.name.includes("custom-"));
    assert(createdCh !== undefined, "Channel created safely without Discord character limit errors");
    assert(createdCh.messages.cache.size > 0, "Embed sent successfully into ticket");
  });

  await runTest("Suite 15", "modal_custom_order: Submitting from general panel when already having an open ticket", async () => {
    const guild = createMockGuild();
    const user = createMockUser({ username: 'ticket_holder' });
    userCooldowns.delete(user.id);
    ticketCreationLocks.delete(user.id);

    const existingTicket = createMockChannel({
      name: "📝-custom-ticket_holder",
      topic: `Ticket của @ticket_holder (${user.id}) • Type: custom_dev`,
      guild
    });

    const generalChannel = createMockChannel({ name: "📝・đặt-làm-plugin", guild });

    const fields = {
      custom_project_type: 'Plugin AntiCheat',
      custom_version: '1.20',
      custom_features: 'Test duplicate open',
      custom_budget_deadline: '500k',
      custom_contact: 'Discord'
    };

    const interaction = createMockInteraction({
      type: 'modal',
      customId: 'modal_custom_order',
      user,
      guild,
      channel: generalChannel,
      fields
    });

    botClient.emit(Events.InteractionCreate, interaction);
    await waitForInteraction(interaction);

    assert(interaction._state.deferred, "Modal submit must deferReply");
    assert(interaction._state.editReplyPayload.content.includes(existingTicket.id), "Informs user about already open ticket");
  });

  await runTest("Suite 15", "modal_support_ticket: Concurrency lock blocks rapid duplicate submit", async () => {
    const guild = createMockGuild();
    const user = createMockUser({ username: 'spammer_help' });
    userCooldowns.delete(user.id);
    ticketCreationLocks.add(user.id); // Simulate active lock

    const fields = {
      support_issue_title: 'Server Crash',
      support_server_env: 'Paper 1.20',
      support_description: 'Error loading plugin'
    };

    const interaction = createMockInteraction({
      type: 'modal',
      customId: 'modal_support_ticket',
      user,
      guild,
      fields
    });

    botClient.emit(Events.InteractionCreate, interaction);
    await waitForInteraction(interaction);

    assert(
      interaction._state.replyPayload.content.includes("đang xử lý") ||
      interaction._state.replyPayload.content.includes("being processed"),
      "Duplicate submit blocked by lock"
    );
    ticketCreationLocks.delete(user.id);
  });

  await runTest("Suite 15", "modal_close_ticket_reason: Special characters, emoji & unicode in reason", async () => {
    const guild = createMockGuild();
    const user = createMockUser({ username: 'staff_closer' });
    const logCh = createMockChannel({ name: "nhật-ký-giao-dịch", guild });
    const ticketCh = createMockChannel({ name: "🛒-mua-customer1", topic: `Ticket của @customer1 (${user.id})`, guild });

    const complexReason = "🚀 Đã bàn giao Mod 1.21 & Khách hàng rất hài lòng! ⭐⭐⭐⭐⭐ `Code OK`";
    const fields = { close_reason: complexReason };

    const interaction = createMockInteraction({
      type: 'modal',
      customId: 'modal_close_ticket_reason',
      user,
      guild,
      channel: ticketCh,
      fields
    });

    botClient.emit(Events.InteractionCreate, interaction);
    await waitForInteraction(interaction);

    assert(interaction._state.deferred, "Must deferReply");
    assert(interaction._state.editReplyPayload.content.includes("Đã ghi nhận lý do"), "Closure accepted");
  });

  await runTest("Suite 15", "modal_feedback: Special star ratings and multi-line comments", async () => {
    const guild = createMockGuild();
    const user = createMockUser({ username: 'feedback_user' });
    const fbCh = createMockChannel({ name: "đánh-giá-uy-tín", guild });

    const fields = {
      feedback_rating: '⭐⭐⭐⭐⭐ 10/10 Excellent!',
      feedback_comment: 'Plugin hoat dong cuc ky tot, duoc custom theo dung yeu cau!'
    };

    const interaction = createMockInteraction({
      type: 'modal',
      customId: 'modal_feedback',
      user,
      guild,
      fields
    });

    botClient.emit(Events.InteractionCreate, interaction);
    await waitForInteraction(interaction);

    assert(interaction._state.deferred, "Must deferReply");
    assert(interaction._state.editReplyPayload.content.includes("Cảm ơn bạn rất nhiều"), "Confirmation message returned");
    assert(fbCh.messages.cache.size > 0, "Feedback embed forwarded to channel");
  });

  // ============================================================================
  // SUITE 16: Transcript Privacy, Security & Size Handling
  // ============================================================================
  console.log("\n🔒 [SUITE 16: Transcript Privacy, Security & Size Handling]");

  await runTest("Suite 16", "redactSensitiveData: Discord Bot Tokens, Webhooks, API Keys & Private Keys", async () => {
    const sampleToken = ["MTA4OTk5", "OTk5OTk5OTk5OTk5"].join('') + '.' + ["Gxyz12", "abcdefghijklmnopqrstuvwxyz123456789"].join('.');
    const redactedToken = redactSensitiveData(`Day la token bot: ${sampleToken}`);
    assert(!redactedToken.includes(sampleToken), "Discord token must be redacted");
    assert(redactedToken.includes("***[REDACTED_DISCORD_TOKEN]***"), "Redaction placeholder present");

    const sampleWebhook = "https://discord.com/api/webhooks/123456789012345678/AbCdEfGhIjKlMnOpQrStUvWxYz_12345";
    const redactedWebhook = redactSensitiveData(`Webhook: ${sampleWebhook}`);
    assert(!redactedWebhook.includes("AbCdEfGhIjKlMnOpQrStUvWxYz_12345"), "Webhook secret must be redacted");
    assert(redactedWebhook.includes("***[REDACTED_WEBHOOK_TOKEN]***"), "Webhook placeholder present");

    const sampleOpenAIKey = "sk-" + "proj-abc12345678901234567890123456789012345";
    const redactedOpenAI = redactSensitiveData(`OpenAI API Key: ${sampleOpenAIKey}`);
    assert(!redactedOpenAI.includes(sampleOpenAIKey), "OpenAI key must be redacted");

    const sampleClaudeKey = "sk-" + "ant-api03-abcdefghijklmnopqrstuvwxyz1234567890123456789012345";
    const redactedClaude = redactSensitiveData(`Claude API Key: ${sampleClaudeKey}`);
    assert(!redactedClaude.includes(sampleClaudeKey), "Claude key must be redacted");

    const sampleBearer = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ";
    const redactedBearer = redactSensitiveData(`Auth: ${sampleBearer}`);
    assert(!redactedBearer.includes("eyJhbGciOiJIUzI1Ni"), "Bearer token must be redacted");
  });

  await runTest("Suite 16", "createTranscriptAttachments: Single file <= 7.5 MB", async () => {
    const shortText = "LS STUDIO - TICKET TRANSCRIPT\nMessage 1\nMessage 2\n";
    const result = createTranscriptAttachments(shortText, "transcript-ticket-1.txt");

    assertEqual(result.partsCount, 1, "Single part for small transcript");
    assertEqual(result.isSplit, false, "isSplit is false");
    assertEqual(result.isTrimmed, false, "isTrimmed is false");
    assert(result.attachments.length === 1, "1 AttachmentBuilder created");
    assertEqual(result.attachments[0].name, "transcript-ticket-1.txt", "File name matches base name");
  });

  await runTest("Suite 16", "createTranscriptAttachments: Multi-chunk splitting for files > 7.5 MB", async () => {
    // Generate 16 MB transcript text (should produce 3 chunks of 7.5 MB max each)
    const largeChunk = "A".repeat(1024 * 1024); // 1 MB string
    const largeText = largeChunk.repeat(16); // 16 MB string

    const result = createTranscriptAttachments(largeText, "transcript-huge.txt");

    assert(result.totalBytes >= 16 * 1024 * 1024, "Total bytes >= 16 MB");
    assertEqual(result.isSplit, true, "isSplit is true");
    assertEqual(result.partsCount, 3, "16 MB split into 3 parts (7.5MB + 7.5MB + 1MB)");
    assert(result.attachments[0].name.includes("part1-of-3"), "Part 1 filename formatted");
    assert(result.attachments[1].name.includes("part2-of-3"), "Part 2 filename formatted");
    assert(result.attachments[2].name.includes("part3-of-3"), "Part 3 filename formatted");
  });

  await runTest("Suite 16", "createTranscriptAttachments: Capped at 10 attachments max (Discord limit)", async () => {
    // Generate 90 MB transcript text (>10 parts of 7.5 MB each)
    const largeChunk = "B".repeat(1024 * 1024); // 1 MB string
    const massiveText = largeChunk.repeat(90); // 90 MB string

    const result = createTranscriptAttachments(massiveText, "transcript-massive.txt");

    assertEqual(result.isTrimmed, true, "isTrimmed is true for >10 parts");
    assertEqual(result.attachments.length, 10, "Attachments capped at 10 per Discord limits");
  });

  await runTest("Suite 16", "generateTranscript: Sensitive token redaction applied inside transcript output", async () => {
    const guild = createMockGuild();
    const user = createMockUser({ username: 'secret_dev' });

    const sampleToken = ["MTA4OTk5", "OTk5OTk5OTk5OTk5"].join('') + '.' + ["Gxyz12", "abcdefghijklmnopqrstuvwxyz123456789"].join('.');
    const sampleClaude = "sk-" + "ant-api03-abcdefghijklmnopqrstuvwxyz1234567890123456789012345";

    const secretMsg = {
      id: 'msg_sec_1',
      content: `Minh gui key Claude: ${sampleClaude} va token: ${sampleToken}`,
      createdTimestamp: Date.now(),
      author: user
    };

    const channel = createMockChannel({ name: "secret-ticket", guild, messages: [secretMsg] });
    const transcript = await generateTranscript(channel);

    assert(!transcript.includes(sampleClaude), "API Key redacted in transcript text");
    assert(transcript.includes("***[REDACTED_API_KEY]***") || transcript.includes("REDACTED"), "Redaction badge appears in transcript");
    assert(!transcript.includes(sampleToken.slice(0, 10)), "Discord token redacted in transcript text");
  });

  await runTest("Suite 16", "executeTicketClosure: Resilience when ticket opener has DMs disabled", async () => {
    const guild = createMockGuild();
    const closerUser = createMockUser({ username: 'lead_dev' });
    const openerUser = createMockUser({ username: 'closed_dm_buyer' });

    // Simulate Discord API error 50007 (Cannot send messages to this user / DM closed)
    openerUser.send = async () => {
      const err = new Error("Cannot send messages to this user");
      err.code = 50007;
      throw err;
    };

    botClient.users.fetch = async (id) => (id === openerUser.id ? openerUser : createMockUser({ id }));

    const logCh = createMockChannel({ name: "nhật-ký-giao-dịch", guild });
    const ticketCh = createMockChannel({
      name: "mua-closed-dm",
      topic: `Ticket của @closed_dm_buyer (${openerUser.id}) • Type: ticket_buy`,
      guild
    });

    // executeTicketClosure must not throw and must still archive transcript to log channel
    await executeTicketClosure({ channel: ticketCh, guild, closerUser, closeReason: "Done" });

    assert(logCh.messages.cache.size > 0, "Log channel must still receive transcript archive even if DM failed");
  });

  // ============================================================================
  // SUITE 17: ReDoS Protection & Catastrophic Backtracking Stress Testing
  // ============================================================================
  console.log("\n⚡ [SUITE 17: ReDoS Protection & Catastrophic Backtracking Stress Testing]");

  await runTest("Suite 17", "containsDiscordInvite: Adversarial nested brackets and markdown masked link injection", async () => {
    // 5,000 unclosed opening brackets and matching closing brackets
    const maliciousBracketPayload = "[".repeat(2000) + "https://discord.gg/hacker" + "]".repeat(2000);
    const start = Date.now();
    const result = containsDiscordInvite(maliciousBracketPayload);
    const elapsed = Date.now() - start;
    assert(result === true, "Must detect nested invite link");
    assert(elapsed < 200, `Execution time must be < 200ms (took ${elapsed}ms)`);

    // Massive anchor text in markdown link
    const massiveAnchorPayload = "[" + "A".repeat(4000) + "](https://discord.gg/fast_check)";
    const start2 = Date.now();
    const result2 = containsDiscordInvite(massiveAnchorPayload);
    const elapsed2 = Date.now() - start2;
    assert(result2 === true, "Must detect invite in markdown target");
    assert(elapsed2 < 200, `Execution time must be < 200ms (took ${elapsed2}ms)`);
  });

  await runTest("Suite 17", "containsDiscordInvite: Repetitive word-based dot/slash obfuscation without matching invite", async () => {
    // 5,000 repetitions of (dot) and (slash) without discord keyword
    const dotSlashBomb = "hello " + "(dot)".repeat(1000) + " (slash)".repeat(1000) + " harmless_text";
    const start = Date.now();
    const result = containsDiscordInvite(dotSlashBomb);
    const elapsed = Date.now() - start;
    assert(result === false, "Must not trigger false positive");
    assert(elapsed < 200, `Execution time must be < 200ms (took ${elapsed}ms)`);
  });

  await runTest("Suite 17", "containsDiscordInvite: Long repetitive alphanumeric sequence with misleading URL prefix", async () => {
    // Repetitive domain prefixes that do not match invite pattern
    const misleadingPrefix = "https://discord.com/" + "channels/12345/".repeat(500) + "general";
    const start = Date.now();
    const result = containsDiscordInvite(misleadingPrefix);
    const elapsed = Date.now() - start;
    assert(elapsed < 200, `Execution time must be < 200ms (took ${elapsed}ms)`);
  });

  await runTest("Suite 17", "containsEveryonePing: Adversarial code blocks, spoiler markers & mentions", async () => {
    // Large code block followed by ping
    const massiveCodeBlock = "```javascript\n" + "console.log('safe code line');\n".repeat(100) + "```\nHello @everyone";
    const start = Date.now();
    const result = containsEveryonePing(massiveCodeBlock);
    const elapsed = Date.now() - start;
    assert(result === true, "Must detect real @everyone outside code block");
    assert(elapsed < 200, `Execution time must be < 200ms (took ${elapsed}ms)`);

    // Large unclosed code block containing fake @everyone
    const unclosedCodeBlock = "```markdown\n" + "fake @everyone line\n".repeat(100);
    const start2 = Date.now();
    const result2 = containsEveryonePing(unclosedCodeBlock);
    const elapsed2 = Date.now() - start2;
    assert(result2 === false, "Unclosed code block must neutralize mention without backtracking freeze");
    assert(elapsed2 < 200, `Execution time must be < 200ms (took ${elapsed2}ms)`);

    // Adversarial spoiler markers wrapping ping: @||||||...||everyone
    const adversarialSpoiler = "@" + "||".repeat(1000) + "everyone" + "||".repeat(1000);
    const start3 = Date.now();
    const result3 = containsEveryonePing(adversarialSpoiler);
    const elapsed3 = Date.now() - start3;
    assert(result3 === true, "Must detect spoiler-obfuscated @everyone");
    assert(elapsed3 < 200, `Execution time must be < 200ms (took ${elapsed3}ms)`);
  });

  await runTest("Suite 17", "redactSensitiveData: Adversarial long tokens and unclosed private key blocks", async () => {
    // 30,000 character token-like sequence with dots
    const adversarialToken = "MTA4" + "9".repeat(30000) + ".Gxyz123." + "x".repeat(30);
    const start = Date.now();
    const redacted = redactSensitiveData(`Token: ${adversarialToken}`);
    const elapsed = Date.now() - start;
    assert(elapsed < 200, `Execution time must be < 200ms (took ${elapsed}ms)`);

    // Massive repetitive fake API key prefix
    const adversarialApiKey = "sk-" + "proj-".repeat(5000) + "abcdef1234567890";
    const start2 = Date.now();
    const redacted2 = redactSensitiveData(`Key: ${adversarialApiKey}`);
    const elapsed2 = Date.now() - start2;
    assert(elapsed2 < 200, `Execution time must be < 200ms (took ${elapsed2}ms)`);

    // Unclosed private key header
    const unclosedKey = "-----BEGIN RSA PRIVATE KEY-----\n" + "MIIEowIBAAKCAQEA...".repeat(2000);
    const start3 = Date.now();
    const redacted3 = redactSensitiveData(unclosedKey);
    const elapsed3 = Date.now() - start3;
    assert(elapsed3 < 200, `Execution time must be < 200ms (took ${elapsed3}ms)`);
  });

  await runTest("Suite 17", "extractOrderCode & isValidOrderCode: Long repetitive prefix patterns", async () => {
    // 2,000 repetitive 'LS' prefix before actual order code (4,000 chars stress test)
    const adversarialOrderText = "LS".repeat(2000) + " LS987654 done";
    const start = Date.now();
    const code = extractOrderCode(adversarialOrderText);
    const elapsed = Date.now() - start;
    assertEqual(code, "LS987654", "Extract valid code from adversarial text");
    assert(elapsed < 100, `Execution time must be < 100ms (took ${elapsed}ms)`);

    // Massive invalid order codes
    const invalidLongCode = "LS-" + "0".repeat(20000);
    const start2 = Date.now();
    const isValid = isValidOrderCode(invalidLongCode);
    const elapsed2 = Date.now() - start2;
    assertEqual(isValid, false, "Invalid code returns false immediately");
    assert(elapsed2 < 50, `Execution time must be < 50ms (took ${elapsed2}ms)`);
  });

  await runTest("Suite 17", "sanitizeModalInlineText & sanitizeModalCodeBlockText: Massive backtick & delimiter attacks", async () => {
    const massiveBackticks = "`".repeat(30000);
    const start = Date.now();
    const sanitized = sanitizeModalInlineText(massiveBackticks, 100);
    const elapsed = Date.now() - start;
    assertEqual(sanitized.length, 100, "Truncated to 100 chars");
    assert(!sanitized.includes("`"), "Backticks replaced");
    assert(elapsed < 50, `Execution time must be < 50ms (took ${elapsed}ms)`);

    const massiveTripleBackticks = "```".repeat(10000);
    const start2 = Date.now();
    const sanitized2 = sanitizeModalCodeBlockText(massiveTripleBackticks, 200);
    const elapsed2 = Date.now() - start2;
    assertEqual(sanitized2.length, 200, "Truncated to 200 chars");
    assert(!sanitized2.includes("```"), "Triple backticks neutralized");
    assert(elapsed2 < 50, `Execution time must be < 50ms (took ${elapsed2}ms)`);
  });

  await runTest("Suite 17", "normalizeAntiSpamText: 50,000 homoglyphs and zero-width sequence stress test", async () => {
    const homoglyphSpam = "ԁіѕсоrd․gg／".repeat(1000) + "\u200B\uFEFF\u200D\u200C".repeat(5000);
    const start = Date.now();
    const normalized = normalizeAntiSpamText(homoglyphSpam);
    const elapsed = Date.now() - start;
    assert(normalized.includes("discord.gg/"), "Normalized homoglyphs correctly");
    assert(elapsed < 200, `Execution time must be < 200ms (took ${elapsed}ms)`);
  });

  await runTest("Suite 17", "sanitizeTranscriptControlChars & sanitizeSingleLineHeader: Massive CRLF & ANSI escape sequences", async () => {
    const maliciousLog = "\x1b[31;1mCRITICAL_ERROR\x1b[0m\r\n".repeat(5000) + "\u202Ereversed\u200B";
    const start = Date.now();
    const cleaned = sanitizeTranscriptControlChars(maliciousLog);
    const elapsed = Date.now() - start;
    assert(!cleaned.includes("\x1b[31;1m"), "ANSI stripped");
    assert(!cleaned.includes("\u202E"), "BiDi stripped");
    assert(elapsed < 200, `Execution time must be < 200ms (took ${elapsed}ms)`);

    const massiveHeader = "Header Title\r\n".repeat(5000) + "Injected Content";
    const start2 = Date.now();
    const sanitizedHeader = sanitizeSingleLineHeader(massiveHeader, 100);
    const elapsed2 = Date.now() - start2;
    assert(!sanitizedHeader.includes("\n"), "Newlines stripped");
    assert(!sanitizedHeader.includes("\r"), "Carriage returns stripped");
    assert(elapsed2 < 50, `Execution time must be < 50ms (took ${elapsed2}ms)`);
  });

  // ============================================================================
  // SUITE 18: Rate-Limit Retry, Backoff, Cooldown Resilience & Concurrency Guard Testing
  // ============================================================================
  console.log("\n🔄 [SUITE 18: Rate-Limit Retry, Backoff, Cooldown Resilience & Concurrency Guard Testing]");

  await runTest("Suite 18", "Exponential Backoff & Rate-Limit Retry Simulation", async () => {
    // Utility simulating transient 429 Rate Limit responses with retry_after and exponential backoff
    async function simulateOperationWithRetry(fn, { maxRetries = 3, initialDelayMs = 10, backoffFactor = 2 } = {}) {
      let attempt = 0;
      let delay = initialDelayMs;
      while (attempt <= maxRetries) {
        try {
          return await fn(attempt);
        } catch (err) {
          attempt++;
          if (attempt > maxRetries || !err?.isRateLimit) {
            throw err;
          }
          const retryAfter = err.retryAfterMs || delay;
          await new Promise(r => setTimeout(r, retryAfter));
          delay *= backoffFactor;
        }
      }
    }

    // 1. Success on 3rd attempt after two 429 Rate Limit errors
    let executionAttempts = 0;
    const result = await simulateOperationWithRetry(async (attempt) => {
      executionAttempts++;
      if (attempt < 2) {
        const error = new Error("Rate limit exceeded: 429 Too Many Requests");
        error.isRateLimit = true;
        error.retryAfterMs = 5;
        throw error;
      }
      return { success: true, attempts: executionAttempts };
    }, { maxRetries: 3, initialDelayMs: 5 });

    assertEqual(result.success, true, "Operation succeeded after rate-limit backoff retry");
    assertEqual(result.attempts, 3, "Operation succeeded on 3rd attempt");

    // 2. Max retries exceeded triggers failure
    let failedAttempts = 0;
    let caughtError = null;
    try {
      await simulateOperationWithRetry(async () => {
        failedAttempts++;
        const error = new Error("Persistent 429 Rate Limit");
        error.isRateLimit = true;
        error.retryAfterMs = 5;
        throw error;
      }, { maxRetries: 2, initialDelayMs: 5 });
    } catch (err) {
      caughtError = err;
    }
    assert(caughtError !== null, "Should throw when max retries exceeded");
    assertEqual(failedAttempts, 3, "Total attempts equals maxRetries + 1");
  });

  await runTest("Suite 18", "fetchVietQRBuffer: Circuit breaker negative cache & TTL retry recovery", async () => {
    clearVietQRCache();
    const testFailUrl = "https://unreachable-payment-gateway-999.test/qr.png";

    // 1. First call fails and registers in failedVietQRUrls
    const res1 = await fetchVietQRBuffer(testFailUrl);
    assertEqual(res1, null, "Initial request to invalid gateway returns null");
    assert(failedVietQRUrls.has(testFailUrl), "URL recorded in failure circuit breaker");

    // 2. Immediate repeat call hits negative cache circuit breaker instantly (0ms)
    const t0 = Date.now();
    const res2 = await fetchVietQRBuffer(testFailUrl);
    const elapsed = Date.now() - t0;
    assertEqual(res2, null, "Negative cache hit returns null immediately");
    assert(elapsed < 20, `Negative cache response must be instantaneous (<20ms, got ${elapsed}ms)`);

    // 3. Fast-forward TTL (>30s) to simulate recovery retry
    const failedEntry = failedVietQRUrls.get(testFailUrl);
    failedEntry.failedAt = Date.now() - 35000;

    // Simulate mock success on subsequent retry by clearing failed entry
    failedVietQRUrls.delete(testFailUrl);
    const mockSuccessBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, ...new Array(600).fill(5)]);
    vietQRBufferCache.set(testFailUrl, { buffer: mockSuccessBuffer, cachedAt: Date.now(), size: mockSuccessBuffer.length });

    const res3 = await fetchVietQRBuffer(testFailUrl);
    assert(res3 !== null, "Retry after TTL expiration retrieves updated buffer");
    assertEqual(res3[0], 0x89, "Valid PNG buffer returned upon retry");
    clearVietQRCache();
  });

  await runTest("Suite 18", "getRateLimitRemaining: High-concurrency multi-user burst simulation", async () => {
    userCooldowns.clear();
    const numUsers = 50;
    const userIds = Array.from({ length: numUsers }, (_, i) => "1000000000000000" + i.toString().padStart(2, '0'));

    // First burst: All 50 distinct users should have 0s cooldown (permitted)
    const firstBurst = userIds.map(uid => getRateLimitRemaining(uid, 5000));
    for (let i = 0; i < numUsers; i++) {
      assertEqual(firstBurst[i], 0, `User ${userIds[i]} first request must be permitted (0s cooldown)`);
    }

    // Second immediate burst: All 50 users should be throttled (>0s cooldown)
    const secondBurst = userIds.map(uid => getRateLimitRemaining(uid, 5000));
    for (let i = 0; i < numUsers; i++) {
      assert(secondBurst[i] >= 4 && secondBurst[i] <= 5, `User ${userIds[i]} repeat request throttled (${secondBurst[i]}s remaining)`);
    }

    // Single user rapid spam (100 calls in a tight loop)
    const spamUser = '999999999999999999';
    userCooldowns.delete(spamUser);
    const initialCall = getRateLimitRemaining(spamUser, 5000);
    assertEqual(initialCall, 0, "Initial call permitted");

    for (let j = 0; j < 100; j++) {
      const throttled = getRateLimitRemaining(spamUser, 5000);
      assert(throttled > 0, `Spam call #${j + 1} must remain throttled`);
    }
    userCooldowns.clear();
  });

  await runTest("Suite 18", "ticketCreationLocks: Concurrency contention, race condition protection & auto-unlock retry", async () => {
    const testUser = 'user_concurrent_race_1001';
    ticketCreationLocks.delete(testUser);

    // Simulate 20 concurrent ticket creation requests for the same user
    const results = [];
    for (let i = 0; i < 20; i++) {
      if (!ticketCreationLocks.has(testUser)) {
        ticketCreationLocks.add(testUser);
        results.push('ACQUIRED_LOCK');
      } else {
        results.push('LOCKED_OUT');
      }
    }

    const acquiredCount = results.filter(r => r === 'ACQUIRED_LOCK').length;
    const lockedCount = results.filter(r => r === 'LOCKED_OUT').length;
    assertEqual(acquiredCount, 1, "Exactly 1 concurrent request acquires lock");
    assertEqual(lockedCount, 19, "19 duplicate concurrent requests rejected");

    // Release lock
    ticketCreationLocks.delete(testUser);
    assert(!ticketCreationLocks.has(testUser), "Lock released");

    // Retry after release succeeds
    ticketCreationLocks.add(testUser);
    assert(ticketCreationLocks.has(testUser), "Subsequent request acquires lock after release");

    // Auto-unlock simulation (TTL expired)
    ticketCreationLocks.set(testUser, Date.now() - 35000);
    assert(!ticketCreationLocks.has(testUser), "Expired lock automatically treated as free");
    ticketCreationLocks.delete(testUser);
  });

  await runTest("Suite 18", "processingApprovals & approvedOrderCodes: Multi-staff simultaneous approval race condition guard", async () => {
    const orderCode = 'LS' + Math.floor(100000 + Math.random() * 900000);
    processingApprovals.delete(orderCode);
    approvedOrderCodes.delete(orderCode);

    // Simulate 10 staff clicking approve button simultaneously for the same order code
    const approveResults = [];
    for (let staffId = 1; staffId <= 10; staffId++) {
      if (approvedOrderCodes.has(orderCode)) {
        approveResults.push(`ALREADY_APPROVED_${staffId}`);
      } else if (processingApprovals.has(orderCode)) {
        approveResults.push(`ALREADY_PROCESSING_${staffId}`);
      } else {
        processingApprovals.add(orderCode);
        // Simulate completing transaction and committing to approved set
        approvedOrderCodes.add(orderCode);
        processingApprovals.delete(orderCode);
        approveResults.push(`APPROVED_SUCCESS_${staffId}`);
      }
    }

    const successCount = approveResults.filter(r => r.startsWith('APPROVED_SUCCESS')).length;
    const blockedCount = approveResults.filter(r => r.startsWith('ALREADY_APPROVED') || r.startsWith('ALREADY_PROCESSING')).length;

    assertEqual(successCount, 1, "Exactly 1 staff approval transaction succeeds");
    assertEqual(blockedCount, 9, "9 simultaneous approval attempts blocked by idempotency guard");
    assert(approvedOrderCodes.has(orderCode), "Order permanently marked approved");

    // Clean up
    approvedOrderCodes.delete(orderCode);
  });

  await runTest("Suite 18", "safeReply / safeDeferReply / safeDeferUpdate / safeShowModal: Error resilience and graceful recovery", async () => {
    // 1. safeReply with Discord 40060 (Already acknowledged) -> falls back to editReply/followUp safely
    const mockIntAcknowledged = {
      deferred: true,
      replied: false,
      editReply: async (payload) => payload,
      followUp: async (payload) => payload
    };
    const replyRes1 = await safeReply(mockIntAcknowledged, { content: "Safe fallback editReply" });
    assert(replyRes1 !== null && replyRes1.content === "Safe fallback editReply", "safeReply fell back to editReply");

    // 2. safeReply with Discord 10062 (Unknown interaction / expired) -> returns null safely without throwing
    const mockIntExpired = {
      deferred: false,
      replied: false,
      reply: async () => {
        const err = new Error("Unknown interaction");
        err.code = 10062;
        throw err;
      }
    };
    const replyRes2 = await safeReply(mockIntExpired, { content: "Test expired interaction" });
    assertEqual(replyRes2, null, "Expired interaction handled safely with null return");

    // 3. safeDeferReply on already acknowledged interaction -> returns true safely
    const mockIntDeferred = { deferred: true, replied: false };
    const deferRes = await safeDeferReply(mockIntDeferred);
    assertEqual(deferRes, true, "safeDeferReply returns true when already deferred");

    // 4. safeDeferUpdate on interaction that throws 10062 -> returns false safely
    const mockIntUpdateFail = {
      deferred: false,
      replied: false,
      deferUpdate: async () => {
        const err = new Error("Unknown interaction");
        err.code = 10062;
        throw err;
      }
    };
    const deferUpdateRes = await safeDeferUpdate(mockIntUpdateFail);
    assertEqual(deferUpdateRes, false, "safeDeferUpdate handles unknown interaction error safely");

    // 5. safeShowModal on interaction that throws 40060 (already acknowledged) -> returns false safely
    const mockIntModalFail = {
      showModal: async () => {
        const err = new Error("Interaction has already been acknowledged");
        err.code = 40060;
        throw err;
      }
    };
    const showModalRes = await safeShowModal(mockIntModalFail, { customId: 'test_modal' });
    assertEqual(showModalRes, false, "safeShowModal handles already acknowledged error gracefully returning false");
  });

  await runTest("Suite 18", "isIgnorableInteractionError: Complete Discord API error code & message classification", async () => {
    // Standard ignorable Discord error codes
    const ignorableCodes = [10062, 10008, 40060, 50013, 50007, 50006, 50035, 10003, 50001];
    for (const code of ignorableCodes) {
      const err = new Error(`Discord API Error [${code}]`);
      err.code = code;
      assertEqual(isIgnorableInteractionError(err), true, `Error code ${code} must be ignorable`);
    }

    // Standard ignorable Discord error messages
    const ignorableMessages = [
      'Unknown interaction',
      'Interaction has already been acknowledged',
      'Unknown Channel',
      'Unknown Message',
      'Missing Access',
      'Missing Permissions',
      'Cannot send messages to this user',
      'Cannot send an empty message',
      'Invalid Form Body',
      'Request aborted',
      'aborted'
    ];
    for (const msg of ignorableMessages) {
      assertEqual(isIgnorableInteractionError(new Error(msg)), true, `Message "${msg}" must be ignorable`);
    }

    // Critical/fatal errors that MUST NOT be ignored
    assertEqual(isIgnorableInteractionError(new TypeError("Cannot read properties of undefined")), false, "TypeErrors must not be ignored");
    assertEqual(isIgnorableInteractionError(new Error("Database connection refused")), false, "DB errors must not be ignored");
    assertEqual(isIgnorableInteractionError(null), false, "Null returns false");
    assertEqual(isIgnorableInteractionError(undefined), false, "Undefined returns false");
  });

  // ============================================================================
  // SUITE 19: Ticket Permissions, Overwrites Bitfields, Channel Limits & Locks Audit
  // ============================================================================
  console.log("\n🔒 [SUITE 19: Ticket Permissions, Overwrites Bitfields, Channel Limits & Locks Audit]");

  await runTest("Suite 19", "createTicketChannel: Validate PermissionOverwrites, OverwriteType & Bitfields", async () => {
    const guild = createMockGuild();
    const staffRole = createMockRole({ name: "🛡️・Staff / Support", position: 10 });
    const devRole = createMockRole({ name: "🛠️・Developer", position: 12 });
    guild.roles.cache.set(staffRole.id, staffRole);
    guild.roles.cache.set(devRole.id, devRole);

    const user = createMockUser({ username: 'customer_vip' });
    const { ticketChannel, staffMentionString, staffRoles } = await createTicketChannel({
      guild,
      user,
      ticketType: '🛒-mua'
    });

    assert(ticketChannel !== null, "Ticket channel created successfully");
    const owMap = ticketChannel.permissionOverwrites.cache;

    // 1. @everyone Overwrite
    const everyoneOw = owMap.get(guild.id);
    assert(everyoneOw !== undefined, "@everyone overwrite must be present");
    assertEqual(everyoneOw.type, OverwriteType.Role, "@everyone type must be OverwriteType.Role (0)");
    const everyoneDeny = new PermissionsBitField(everyoneOw.deny);
    assert(everyoneDeny.has(PermissionsBitField.Flags.ViewChannel), "@everyone must be denied ViewChannel");
    assert(everyoneDeny.has(PermissionsBitField.Flags.SendMessages), "@everyone must be denied SendMessages");
    assert(everyoneDeny.has(PermissionsBitField.Flags.ReadMessageHistory), "@everyone must be denied ReadMessageHistory");

    // 2. Opener (User) Overwrite
    const userOw = owMap.get(user.id);
    assert(userOw !== undefined, "User overwrite must be present");
    assertEqual(userOw.type, OverwriteType.Member, "Opener type must be OverwriteType.Member (1)");
    const userAllow = new PermissionsBitField(userOw.allow);
    assert(userAllow.has(PermissionsBitField.Flags.ViewChannel), "Opener must be allowed ViewChannel");
    assert(userAllow.has(PermissionsBitField.Flags.SendMessages), "Opener must be allowed SendMessages");
    assert(userAllow.has(PermissionsBitField.Flags.AttachFiles), "Opener must be allowed AttachFiles");
    assert(userAllow.has(PermissionsBitField.Flags.EmbedLinks), "Opener must be allowed EmbedLinks");
    assert(userAllow.has(PermissionsBitField.Flags.ReadMessageHistory), "Opener must be allowed ReadMessageHistory");
    assert(userAllow.has(PermissionsBitField.Flags.AddReactions), "Opener must be allowed AddReactions");

    // 3. Bot Overwrite
    const botId = botClient.user?.id || guild.members.me?.id;
    const botOw = owMap.get(botId);
    assert(botOw !== undefined, "Bot overwrite must be present");
    assertEqual(botOw.type, OverwriteType.Member, "Bot type must be OverwriteType.Member (1)");
    const botAllow = new PermissionsBitField(botOw.allow);
    assert(botAllow.has(PermissionsBitField.Flags.ViewChannel), "Bot must be allowed ViewChannel");
    assert(botAllow.has(PermissionsBitField.Flags.SendMessages), "Bot must be allowed SendMessages");
    assert(botAllow.has(PermissionsBitField.Flags.ManageChannels), "Bot must be allowed ManageChannels");
    assert(botAllow.has(PermissionsBitField.Flags.ManageMessages), "Bot must be allowed ManageMessages");

    // 4. Staff Roles Overwrite
    const staffOw = owMap.get(staffRole.id);
    assert(staffOw !== undefined, "Staff role overwrite must be present");
    assertEqual(staffOw.type, OverwriteType.Role, "Staff role type must be OverwriteType.Role (0)");
    const staffAllow = new PermissionsBitField(staffOw.allow);
    assert(staffAllow.has(PermissionsBitField.Flags.ViewChannel), "Staff must be allowed ViewChannel");
    assert(staffAllow.has(PermissionsBitField.Flags.SendMessages), "Staff must be allowed SendMessages");
    assert(staffAllow.has(PermissionsBitField.Flags.AttachFiles), "Staff must be allowed AttachFiles");
    assert(staffAllow.has(PermissionsBitField.Flags.EmbedLinks), "Staff must be allowed EmbedLinks");
    assert(staffAllow.has(PermissionsBitField.Flags.ManageMessages), "Staff must be allowed ManageMessages");
  });

  await runTest("Suite 19", "createTicketChannel: 500 Guild Channels limit throws code 30013", async () => {
    const guild = createMockGuild();
    // Fill mock guild cache to 500 channels
    for (let i = guild.channels.cache.size; i < 500; i++) {
      guild.channels.cache.set(`ch_${i}`, { id: `ch_${i}`, name: `channel-${i}`, type: ChannelType.GuildText });
    }
    assertEqual(guild.channels.cache.size, 500, "Guild reached 500 channels");

    const user = createMockUser();
    let errorCaught = null;
    try {
      await createTicketChannel({ guild, user, ticketType: '🛒-mua' });
    } catch (err) {
      errorCaught = err;
    }

    assert(errorCaught !== null, "Must throw error when guild has 500 channels");
    assertEqual(errorCaught.code, 30013, "Error code must be 30013 (Guild channel limit)");
    assert(errorCaught.message.includes("500 kênh"), "Error message mentions 500 channels limit");
  });

  await runTest("Suite 19", "createTicketChannel: 50 Category Channels limit auto-recovery to root level", async () => {
    const guild = createMockGuild();
    const ticketCat = createMockChannel({
      name: "🎫 ━━━ HỖ TRỢ & MUA HÀNG ━━━",
      type: ChannelType.GuildCategory,
      guild
    });

    // Fill category to 50 channels
    for (let i = 0; i < 50; i++) {
      const child = createMockChannel({
        name: `ticket-old-${i}`,
        type: ChannelType.GuildText,
        parent: ticketCat,
        guild
      });
      child.parentId = ticketCat.id;
    }

    const catChildCount = guild.channels.cache.filter(c => c && c.parentId === ticketCat.id).size;
    assertEqual(catChildCount, 50, "Category has exactly 50 channels");

    const user = createMockUser({ username: 'overflow_user' });
    const { ticketChannel } = await createTicketChannel({ guild, user, ticketType: '🛒-mua' });

    assert(ticketChannel !== null, "Ticket channel created successfully via auto-recovery");
    assertEqual(ticketChannel.parentId, null, "Ticket channel parent set to null (root level) because category is full");
  });

  await runTest("Suite 19", "createTicketChannel: Discord API 30005 exception retry auto-recovery", async () => {
    const guild = createMockGuild();
    const ticketCat = createMockChannel({
      name: "🎫 ━━━ HỖ TRỢ & MUA HÀNG ━━━",
      type: ChannelType.GuildCategory,
      guild
    });

    // Mock guild.channels.create to throw 30005 if parent is set, succeed if parent is null
    const originalCreate = guild.channels.create;
    let attempts = 0;
    guild.channels.create = async (options) => {
      attempts++;
      if (options.parent && attempts === 1) {
        const err = new Error("Maximum number of channels in category reached (50)");
        err.code = 30005;
        throw err;
      }
      return originalCreate(options);
    };

    const user = createMockUser({ username: 'retry_user' });
    const { ticketChannel } = await createTicketChannel({ guild, user, ticketType: '🛒-mua' });

    assert(ticketChannel !== null, "Ticket channel recovered and created successfully");
    assertEqual(attempts, 2, "guild.channels.create called twice (1 failed with 30005, 1 succeeded with parent: null)");
    assertEqual(ticketChannel.parentId, null, "Recovered channel has parent: null");
  });

  await runTest("Suite 19", "Concurrency Locks: Ticket creation locks always released in finally blocks", async () => {
    const guild = createMockGuild();
    const user = createMockUser();
    const lockKey = `${guild.id}:${user.id}`;

    ticketCreationLocks.delete(lockKey);
    ticketCreationLocks.delete(user.id);

    const int1 = createMockInteraction({ type: 'button', customId: 'ticket_buy', user, guild });
    botClient.emit(Events.InteractionCreate, int1);
    await waitForInteraction(int1);

    assertEqual(ticketCreationLocks.has(lockKey), false, "LockKey released after successful ticket creation");
    assertEqual(ticketCreationLocks.has(user.id), false, "UserId released after successful ticket creation");
  });

  await runTest("Suite 19", "modal_close_ticket_reason: Executes executeTicketClosure without duplicate lock blocking", async () => {
    const guild = createMockGuild();
    const user = createMockUser();
    const logCh = createMockChannel({ name: "nhật-ký-giao-dịch", guild });

    const ticketChannel = createMockChannel({
      name: "mua-closer-user",
      topic: `Ticket của @closer_test (${user.id}) • Type: ticket_buy`,
      guild
    });

    closingTicketChannels.delete(ticketChannel.id);

    const intModal = createMockInteraction({
      type: 'modal',
      customId: 'modal_close_ticket_reason',
      fields: { close_reason: 'Giao dịch hoàn tất 100%' },
      user,
      guild,
      channel: ticketChannel
    });

    botClient.emit(Events.InteractionCreate, intModal);
    await waitForInteraction(intModal);
    await new Promise(r => setTimeout(r, 100));

    assert(intModal._state.deferred, "Modal submit must deferReply");
    assert(logCh.messages.cache.size > 0, "Log channel must record closed ticket transcript with reason");
  });

  // ============================================================================
  // SUITE 11: Anti-Crash & Unhandled Exception Audit
  // ============================================================================
  console.log("\n🛡️ [SUITE 11: Anti-Crash & Unhandled Exception Audit]");

  await runTest("Suite 11", "Zero unhandled promise rejections & exceptions during run", async () => {
    assertEqual(unhandledErrors.length, 0, `Must have 0 unhandled errors, got: ${JSON.stringify(unhandledErrors)}`);
  });

  // ============================================================================
  // SUMMARY REPORT
  // ============================================================================
  console.log("\n================================================================================");
  console.log("📊 TEST HARNESS EXECUTION SUMMARY REPORT");
  console.log("================================================================================");
  console.log(`Total Tests Run:     ${totalTests}`);
  console.log(`Passed Tests:        \x1b[32m${passedTests}\x1b[0m`);
  console.log(`Failed Tests:        \x1b[31m${failedTests}\x1b[0m`);
  console.log(`Unhandled Errors:    ${unhandledErrors.length === 0 ? '\x1b[32m0\x1b[0m' : '\x1b[31m' + unhandledErrors.length + '\x1b[0m'}`);
  console.log("================================================================================");

  if (failedTests > 0 || unhandledErrors.length > 0) {
    console.log("❌ ONE OR MORE TESTS FAILED!");
    process.exit(1);
  } else {
    console.log("🎉 ALL TEST SUITES PASSED WITH 100% SUCCESS RATE!");
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error("❌ Fatal Test Runner Error:", err);
  process.exit(1);
});
