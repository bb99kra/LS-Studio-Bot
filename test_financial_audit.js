const bot = require('./bot.js');
const assert = require('assert');

console.log('🧪 Starting Financial Integrity & Currency Precision Verification...\n');

// 1. Currency formatting: formatVND
console.log('1️⃣ Checking formatVND:');
assert.strictEqual(bot.formatVND(30000), '30.000 VNĐ');
assert.strictEqual(bot.formatVND(1234567), '1.234.567 VNĐ');
assert.strictEqual(bot.formatVND(-30000), '-30.000 VNĐ');
assert.strictEqual(bot.formatVND(-0.4), '0 VNĐ', 'Small negative fraction must not produce -0 VNĐ');
assert.strictEqual(bot.formatVND(0.4), '0 VNĐ');
assert.strictEqual(bot.formatVND(0), '0 VNĐ');
assert.strictEqual(bot.formatVND(-0), '0 VNĐ');
assert.strictEqual(bot.formatVND(null), '0 VNĐ');
assert.strictEqual(bot.formatVND(undefined), '0 VNĐ');
assert.strictEqual(bot.formatVND(NaN), '0 VNĐ');
assert.strictEqual(bot.formatVND(Infinity), '0 VNĐ');
assert.strictEqual(bot.formatVND(-Infinity), '0 VNĐ');
assert.strictEqual(bot.formatVND(true), '0 VNĐ', 'Boolean true must not be 1 VNĐ');
assert.strictEqual(bot.formatVND(false), '0 VNĐ');
assert.strictEqual(bot.formatVND({}), '0 VNĐ');
assert.strictEqual(bot.formatVND([]), '0 VNĐ');
assert.strictEqual(bot.formatVND([100]), '0 VNĐ');
assert.strictEqual(bot.formatVND(''), '0 VNĐ');
assert.strictEqual(bot.formatVND('   '), '0 VNĐ');
assert.strictEqual(bot.formatVND('30000 VNĐ'), '30.000 VNĐ');
assert.strictEqual(bot.formatVND('30,000'), '30.000 VNĐ');
assert.strictEqual(bot.formatVND(1000000000000), '1.000.000.000.000 VNĐ');
console.log('   ✅ formatVND passed all edge cases!\n');

// 2. Currency formatting: formatUSD
console.log('2️⃣ Checking formatUSD:');
assert.strictEqual(bot.formatUSD(1.5), '$1.50 USD');
assert.strictEqual(bot.formatUSD(1234.56), '$1,234.56 USD');
assert.strictEqual(bot.formatUSD(1234567.89), '$1,234,567.89 USD');
assert.strictEqual(bot.formatUSD(-2.5), '-$2.50 USD');
assert.strictEqual(bot.formatUSD(-0.001), '$0.00 USD', 'Small negative fraction must not produce -$0.00 USD');
assert.strictEqual(bot.formatUSD(0.001), '$0.00 USD');
assert.strictEqual(bot.formatUSD(0), '$0.00 USD');
assert.strictEqual(bot.formatUSD(-0), '$0.00 USD');
assert.strictEqual(bot.formatUSD(null), '$0.00 USD');
assert.strictEqual(bot.formatUSD(undefined), '$0.00 USD');
assert.strictEqual(bot.formatUSD(NaN), '$0.00 USD');
assert.strictEqual(bot.formatUSD(true), '$0.00 USD', 'Boolean true must not be $1.00 USD');
assert.strictEqual(bot.formatUSD(false), '$0.00 USD');
assert.strictEqual(bot.formatUSD('$1.50'), '$1.50 USD');
assert.strictEqual(bot.formatUSD(1000000000.5), '$1,000,000,000.50 USD');
console.log('   ✅ formatUSD passed all edge cases!\n');

// 3. VietQR transfer content & characters constraints
console.log('3️⃣ Checking VietQR constraints:');
assert.strictEqual(bot.sanitizeVietQRText('Nguyễn Minh Nhựt Đỗ 123!@#'), 'NGUYEN MINH NHUT DO 123');
const longText = 'A'.repeat(100);
const sanitizedLong = bot.sanitizeVietQRText(longText, 50);
assert.strictEqual(sanitizedLong.length, 50, 'VietQR text must be capped at 50 chars max');
assert.strictEqual(bot.sanitizeVietQRText(null), '');
assert.strictEqual(bot.sanitizeVietQRText(undefined), '');
assert.strictEqual(bot.sanitizeVietQRText(true), '');

const qrZero = bot.generateVietQRUrl({ amount: 0, addInfo: 'LS123456' });
assert(!qrZero.includes('amount='), '0 VND must NOT append amount parameter to VietQR URL');

const qrNegotiated = bot.generateVietQRUrl({ amount: 'Thỏa thuận', addInfo: 'LS123456' });
assert(!qrNegotiated.includes('amount='), 'Negotiable price must NOT append amount parameter');

const qrValid = bot.generateVietQRUrl({ amount: 30000, addInfo: 'LS123456' });
assert(qrValid.includes('amount=30000'), 'Valid amount must append amount=30000');
assert(qrValid.includes('addInfo=LS123456'), 'Valid addInfo must be included');
console.log('   ✅ VietQR constraints & URL generation passed all checks!\n');

// 4. Order code generator entropy & collision risk
console.log('4️⃣ Checking Order Code Entropy & Consistency:');
const generatedCodes = new Set();
for (let i = 0; i < 5000; i++) {
  const code = bot.generateUniqueOrderCode();
  assert(!generatedCodes.has(code), `Collision detected on attempt ${i} for code ${code}!`);
  assert(bot.isValidOrderCode(code), `Generated code ${code} is invalid!`);
  generatedCodes.add(code);
}
assert.strictEqual(bot.isValidOrderCode('LS123456'), true);
assert.strictEqual(bot.isValidOrderCode('LS-123456'), true);
assert.strictEqual(bot.isValidOrderCode('LS 123456'), true);
assert.strictEqual(bot.isValidOrderCode('LS12345'), false);
assert.strictEqual(bot.isValidOrderCode('123456'), false);
assert.strictEqual(bot.isValidOrderCode(null), false);
assert.strictEqual(bot.extractOrderCode('Chuyen tien LS123456 mua bot'), 'LS123456');
assert.strictEqual(bot.extractOrderCode('LS-123456'), 'LS123456');
console.log('   ✅ Order code generator (5,000 samples) zero collision & regex consistency passed!\n');

// 5. Package lookup fallback & Negotiable price
console.log('5️⃣ Checking Package lookup fallback & Negotiable price:');
assert.strictEqual(bot.isNegotiatedPrice(0), true);
assert.strictEqual(bot.isNegotiatedPrice(null), true);
assert.strictEqual(bot.isNegotiatedPrice(undefined), true);
assert.strictEqual(bot.isNegotiatedPrice('Thỏa thuận'), true);
assert.strictEqual(bot.isNegotiatedPrice(30000), false);
assert.strictEqual(bot.isNegotiatedPrice('30000'), false);
assert.strictEqual(bot.isNegotiatedPrice(-5000), true);

const customModPkg = bot.getPackage('custom_mod');
assert(customModPkg !== null);
assert(bot.isNegotiatedPrice(customModPkg.price_vnd), 'custom_mod must be recognized as negotiated');

const customDevPkg = bot.getPackage('custom_dev');
assert(customDevPkg !== null);
assert(bot.isNegotiatedPrice(customDevPkg.price_vnd), 'custom_dev must be recognized as negotiated');

console.log('   ✅ Package fallback & negotiated pricing passed all checks!\n');

console.log('🎉 ALL 5 FINANCIAL INTEGRITY AUDIT SUITES PASSED FLAWLESSLY!');
