const {
  normalizeAntiSpamText,
  extractAllLinkTargets,
  containsDiscordInvite,
  containsEveryonePing,
  redactSensitiveData
} = require('./bot.js');

console.log('====================================================');
console.log('AUDIT TEST SUITE: AutoMod, Homoglyphs & Redaction');
console.log('====================================================');

let passed = 0;
let failed = 0;

function assert(condition, name, details = '') {
  if (condition) {
    console.log(`✅ PASS: ${name}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${name} ${details ? '(' + details + ')' : ''}`);
    failed++;
  }
}

// 1. Homoglyphs & Normalization
console.log('\n--- 1. Testing normalizeAntiSpamText ---');
assert(normalizeAntiSpamText('ｄｉｓｃｏｒｄ') === 'discord', 'Fullwidth letters');
assert(normalizeAntiSpamText('𝐝𝐢𝐬𝐜𝐨ｒ𝐝') === 'discord', 'Mathematical Bold');
assert(normalizeAntiSpamText('𝑑𝑖𝑠𝑐𝑜𝑟𝑑') === 'discord', 'Mathematical Italic');
assert(normalizeAntiSpamText('𝓓𝓲𝓼𝓬𝓸𝓻𝓭') === 'Discord', 'Mathematical Bold Script');
assert(normalizeAntiSpamText('dіѕсоrd') === 'discord', 'Cyrillic homoglyphs');
assert(normalizeAntiSpamText('ԁιѕсօrd') === 'discord', 'Armenian & Greek mixed homoglyphs');
assert(normalizeAntiSpamText('d\u200Bi\u200Ds\uFEFFc\u200Eo\u200Fr\u2060d') === 'discord', 'Zero-width spaces');
assert(normalizeAntiSpamText('discord．gg') === 'discord.gg', 'Fullwidth dot');
assert(normalizeAntiSpamText('discord․gg') === 'discord.gg', 'One-dot leader');
assert(normalizeAntiSpamText('discord／invite') === 'discord/invite', 'Fullwidth slash');
assert(normalizeAntiSpamText('discord＼invite') === 'discord/invite', 'Fullwidth backslash');
assert(normalizeAntiSpamText('d\u3164i\u3164s\u3164c\u3164o\u3164r\u3164d') === 'discord', 'Hangul Filler spaces');
assert(normalizeAntiSpamText('d\uFE0Fi\uFE0Fs\uFE0Fc\uFE0Fo\uFE0Fr\uFE0Fd') === 'discord', 'Variation Selectors');

// 2. containsDiscordInvite
console.log('\n--- 2. Testing containsDiscordInvite ---');
assert(containsDiscordInvite('https://discord.gg/minecraft'), 'Standard discord.gg');
assert(containsDiscordInvite('discord.com/invite/abcdef'), 'Standard discord.com/invite');
assert(containsDiscordInvite('discordapp.com/invite/xyz'), 'Standard discordapp.com/invite');
assert(containsDiscordInvite('dsc.gg/myserver'), 'dsc.gg short link');
assert(containsDiscordInvite('invite.gg/test'), 'invite.gg link');
assert(containsDiscordInvite('dis.gd/help'), 'dis.gd link');
assert(containsDiscordInvite('discord.io/community'), 'discord.io link');
assert(containsDiscordInvite('discord.me/servers'), 'discord.me link');
assert(containsDiscordInvite('discord.li/gamer'), 'discord.li link');
assert(containsDiscordInvite('discord.link/hub'), 'discord.link link');
assert(containsDiscordInvite('discord.gift/1234567890'), 'discord.gift nitro scam link');
assert(containsDiscordInvite('d i s c o r d . g g / 1 2 3 4 5'), 'Spaced discord.gg');
assert(containsDiscordInvite('discord dot gg / 12345'), 'Word dot discord dot gg');
assert(containsDiscordInvite('discord(dot)gg/freecode'), 'Parenthesis dot');
assert(containsDiscordInvite('discord[dot]gg/freecode'), 'Square bracket dot');
assert(containsDiscordInvite('discord{dot}gg/freecode'), 'Curly bracket dot');
assert(containsDiscordInvite('d||i||s||c||o||r||d.gg/abc'), 'Spoiler tags in domain');
assert(containsDiscordInvite('discord.gg/||xyz||'), 'Spoiler tags in code');
assert(containsDiscordInvite('d`i`s`c`o`r`d.gg/abc'), 'Backticks in domain');
assert(containsDiscordInvite('[Click here](https://discord.gg/stealth)'), 'Markdown masked link hidden target');
assert(containsDiscordInvite('[discord.gg/scam](https://google.com)'), 'Markdown masked link visible target');
assert(containsDiscordInvite('<https://discord.gg/bracketed>'), 'Angle bracket link');
assert(containsDiscordInvite('https://dіѕсоrd.gg/alpha123'), 'Cyrillic discord.gg');
assert(containsDiscordInvite('https://ԁιѕсօrd.ɡɡ/mixed'), 'Multi-script homoglyphs');

// Safe URLs (False-Positive Check)
assert(!containsDiscordInvite('https://google.com'), 'Safe: Google');
assert(!containsDiscordInvite('https://spigotmc.org/resources/123'), 'Safe: SpigotMC');
assert(!containsDiscordInvite('https://github.com/LS-Studio/bot'), 'Safe: GitHub');
assert(!containsDiscordInvite('https://discord.com/terms'), 'Safe: Discord ToS');
assert(!containsDiscordInvite('https://discord.com/privacy'), 'Safe: Discord Privacy');
assert(!containsDiscordInvite('https://discord.com/guidelines'), 'Safe: Discord Guidelines');

// 3. containsEveryonePing
console.log('\n--- 3. Testing containsEveryonePing ---');
assert(containsEveryonePing('Hello @everyone check this out'), 'True: @everyone standard');
assert(containsEveryonePing('Hey @here come here'), 'True: @here standard');
assert(containsEveryonePing('Hey @еveryone win free nitro'), 'True: @everyone Cyrillic e');
assert(containsEveryonePing('Check @||everyone|| please'), 'True: @everyone spoiler tags');
assert(containsEveryonePing('Hey @e\u200Bv\u200De\uFEFFr\u200Ey\u200Fo\u2060n\u00ADe free'), 'True: @everyone zero-width');
assert(containsEveryonePing('Hey @**everyone** now'), 'True: @everyone markdown bold');

// False Positives
assert(!containsEveryonePing('Use `@everyone` in Discord'), 'Safe: Inline code');
assert(!containsEveryonePing('```js\nconsole.log("@everyone");\n```'), 'Safe: Code block');
assert(!containsEveryonePing('Please do not ping \\@everyone here'), 'Safe: Escaped \\@everyone');
assert(!containsEveryonePing('Please do not ping \\@here here'), 'Safe: Escaped \\@here');
assert(!containsEveryonePing('Contact support@everyone.com for help'), 'Safe: Email support@everyone.com');
assert(!containsEveryonePing('Contact admin@here.org for support'), 'Safe: Email admin@here.org');
assert(!containsEveryonePing('Reach us at <admin@everyone.com>'), 'Safe: Email <admin@everyone.com>');
assert(!containsEveryonePing('Follow us on https://twitter.com/@everyone'), 'Safe: URL twitter.com/@everyone');
assert(!containsEveryonePing('Check channel https://youtube.com/@here'), 'Safe: URL youtube.com/@here');
assert(!containsEveryonePing('This is beveryone or not'), 'Safe: Word ending in everyone');
assert(!containsEveryonePing('I will go somewhere today'), 'Safe: Word containing here');

// 4. redactSensitiveData
console.log('\n--- 4. Testing redactSensitiveData ---');
const sampleTokenStd = ['NzgxMjM0', 'NTY3ODkwMTIzNDU2'].join('') + '.' + ['GaBcDe', '1234567890abcdefghijklmnopqrstuvwx'].join('.');
const sampleTokenModern = ['MTIzNDU2', 'Nzg5MDEyMzQ1Njc4OTAxMjM0'].join('') + '.' + ['G1a2b3', 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0'].join('.');
const sampleMfaToken = 'mfa.' + ['abcdefghijklmnopqrstuvwxyz1234567890', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'].join('');
const sampleWebhookUrl = 'https://discord.com/api/webhooks/123456789012345678/' + ['abcdefghijklmnopqrstuvwxyz', '1234567890-ABCDEFGHIJKLM'].join('_');
const sampleOpenAiKey = 'sk-' + ['proj-abcde1234567890abcdefghijklmnopqrstuvwxyz', '1234567890ABCDEF'].join('');
const sampleClaudeKey = 'sk-' + ['ant-api03-abcdefghijklmnopqrstuvwxyz1234567890', 'ABCDEFGHIJKLMNOPQRSTUV'].join('');
const sampleGeminiKey = 'AIzaSy' + ['A1b2c3d4e5f6g7h8i9j0', 'k1l2m3n4o5p6q'].join('');
const sampleGithubClassic = 'ghp_' + ['abcdefghijklmnopqrstuvwxyz', '1234567890'].join('');
const sampleGithubPat = 'github_pat_' + ['11AAAAAAA_abcdefghijklmnopqrstuvwxyz', '1234567890ABCDEFGHIJKLMNOPQRSTUV'].join('');
const sampleAwsKey = 'AKIA' + ['IOSFODNN7', 'EXAMPLE'].join('');

assert(redactSensitiveData(`token: ${sampleTokenStd}`).includes('***[REDACTED_DISCORD_TOKEN]***'), 'Discord Bot Token Standard');
assert(redactSensitiveData(`token: ${sampleTokenModern}`).includes('***[REDACTED_DISCORD_TOKEN]***'), 'Discord Bot Token Modern HMAC');
assert(redactSensitiveData(`mfa: ${sampleMfaToken}`).includes('***[REDACTED_DISCORD_TOKEN]***'), 'Discord MFA Token');
assert(redactSensitiveData(sampleWebhookUrl).includes('***[REDACTED_WEBHOOK_TOKEN]***'), 'Discord Webhook URL');
assert(redactSensitiveData(sampleOpenAiKey).includes('***[REDACTED_API_KEY]***'), 'OpenAI sk-proj Key');
assert(redactSensitiveData(sampleClaudeKey).includes('***[REDACTED_API_KEY]***'), 'Anthropic Claude Key');
assert(redactSensitiveData(sampleGeminiKey).includes('***[REDACTED_API_KEY]***'), 'Gemini Key');
assert(redactSensitiveData(sampleGithubClassic).includes('***[REDACTED_GITHUB_TOKEN]***'), 'GitHub Classic Token');
assert(redactSensitiveData(sampleGithubPat).includes('***[REDACTED_GITHUB_TOKEN]***'), 'GitHub PAT');
assert(redactSensitiveData(sampleAwsKey).includes('***[REDACTED_AWS_KEY]***'), 'AWS Access Key');
assert(redactSensitiveData('postgres://admin:secretPass123@db.example.com:5432/mydb').includes('***[REDACTED_DB_PASSWORD]***'), 'Postgres DB Password');
assert(redactSensitiveData('redis://:redisSuperPass@localhost:6379/0').includes('***[REDACTED_DB_PASSWORD]***'), 'Redis No-Username DB Password');
assert(redactSensitiveData('-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----').includes('[REDACTED_PRIVATE_KEY]'), 'RSA Private Key');
assert(redactSensitiveData('-----BEGIN PGP PRIVATE KEY BLOCK-----\nMIIE...\n-----END PGP PRIVATE KEY BLOCK-----').includes('[REDACTED_PRIVATE_KEY]'), 'PGP Private Key Block');

// ReDoS & Long Input Safety
const longText = 'The quick brown fox jumps over the lazy dog. '.repeat(1000);
const t0 = Date.now();
const longResult = redactSensitiveData(longText);
const t1 = Date.now();
assert(t1 - t0 < 100, `ReDoS Check: 45k chars processed in ${t1 - t0}ms (< 100ms)`);

console.log('\n====================================================');
console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('====================================================');

process.exit(failed > 0 ? 1 : 0);
