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
assert.strictEqual(bot.formatVND('-0'), '0 VNĐ');
assert.strictEqual(bot.formatVND(null), '0 VNĐ');
assert.strictEqual(bot.formatVND(undefined), '0 VNĐ');
assert.strictEqual(bot.formatVND(NaN), '0 VNĐ');
assert.strictEqual(bot.formatVND(Infinity), '0 VNĐ');
assert.strictEqual(bot.formatVND(-Infinity), '0 VNĐ');
assert.strictEqual(bot.formatVND(true), '0 VNĐ', 'Boolean true must not be 1 VNĐ');
assert.strictEqual(bot.formatVND(false), '0 VNĐ');
assert.strictEqual(bot.formatVND(Symbol('test')), '0 VNĐ');
assert.strictEqual(bot.formatVND({}), '0 VNĐ');
assert.strictEqual(bot.formatVND([]), '0 VNĐ');
assert.strictEqual(bot.formatVND([100]), '0 VNĐ');
assert.strictEqual(bot.formatVND(''), '0 VNĐ');
assert.strictEqual(bot.formatVND('   '), '0 VNĐ');
assert.strictEqual(bot.formatVND('30000 VNĐ'), '30.000 VNĐ');
assert.strictEqual(bot.formatVND('30,000'), '30.000 VNĐ');
assert.strictEqual(bot.formatVND('30.000'), '30.000 VNĐ', 'Dot separator in VNĐ strings must not divide by 1000');
assert.strictEqual(bot.formatVND('1.500.000'), '1.500.000 VNĐ');
assert.strictEqual(bot.formatVND(1000000000000), '1.000.000.000.000 VNĐ');
// BigInt test with zero precision loss
assert.strictEqual(bot.formatVND(9007199254740993999999n), '9.007.199.254.740.993.999.999 VNĐ');
assert.strictEqual(bot.formatVND(-9007199254740993999999n), '-9.007.199.254.740.993.999.999 VNĐ');
assert.strictEqual(bot.formatVND('9007199254740993999999'), '9.007.199.254.740.993.999.999 VNĐ');
console.log('   ✅ formatVND passed all edge cases!\n');

// 2. Currency formatting: formatUSD
console.log('2️⃣ Checking formatUSD:');
assert.strictEqual(bot.formatUSD(1.5), '$1.50 USD');
assert.strictEqual(bot.formatUSD(1234.56), '$1,234.56 USD');
assert.strictEqual(bot.formatUSD(1234567.89), '$1,234,567.89 USD');
assert.strictEqual(bot.formatUSD(-2.5), '-$2.50 USD');
assert.strictEqual(bot.formatUSD(-0.001), '$0.00 USD', 'Small negative fraction must not produce -$0.00 USD');
assert.strictEqual(bot.formatUSD(-0.0049), '$0.00 USD');
assert.strictEqual(bot.formatUSD(-0.005), '-$0.01 USD');
assert.strictEqual(bot.formatUSD(0.001), '$0.00 USD');
assert.strictEqual(bot.formatUSD(0), '$0.00 USD');
assert.strictEqual(bot.formatUSD(-0), '$0.00 USD');
assert.strictEqual(bot.formatUSD('-0'), '$0.00 USD');
assert.strictEqual(bot.formatUSD('-0.00'), '$0.00 USD');
assert.strictEqual(bot.formatUSD(null), '$0.00 USD');
assert.strictEqual(bot.formatUSD(undefined), '$0.00 USD');
assert.strictEqual(bot.formatUSD(NaN), '$0.00 USD');
assert.strictEqual(bot.formatUSD(Infinity), '$0.00 USD');
assert.strictEqual(bot.formatUSD(-Infinity), '$0.00 USD');
assert.strictEqual(bot.formatUSD(true), '$0.00 USD', 'Boolean true must not be $1.00 USD');
assert.strictEqual(bot.formatUSD(false), '$0.00 USD');
assert.strictEqual(bot.formatUSD(Symbol('usd')), '$0.00 USD');
assert.strictEqual(bot.formatUSD('$1.50'), '$1.50 USD');
assert.strictEqual(bot.formatUSD(1000000000.5), '$1,000,000,000.50 USD');
// BigInt USD test
assert.strictEqual(bot.formatUSD(1000n), '$1,000.00 USD');
assert.strictEqual(bot.formatUSD(-1000n), '-$1,000.00 USD');
assert.strictEqual(bot.formatUSD(9007199254740993999999n), '$9,007,199,254,740,993,999,999.00 USD');
assert.strictEqual(bot.formatUSD(-9007199254740993999999n), '-$9,007,199,254,740,993,999,999.00 USD');
console.log('   ✅ formatUSD passed all edge cases!\n');

// 3. VietQR transfer content & characters constraints
console.log('3️⃣ Checking VietQR constraints & URL generation:');
assert.strictEqual(bot.sanitizeVietQRText('Nguyễn Minh Nhựt Đỗ 123!@#'), 'NGUYEN MINH NHUT DO 123');
assert.strictEqual(bot.sanitizeVietQRText('NGUYEN A BC', 9), 'NGUYEN A', 'Must trim trailing spaces after slice');
const longText = 'A'.repeat(100);
const sanitizedLong = bot.sanitizeVietQRText(longText, 50);
assert.strictEqual(sanitizedLong.length, 50, 'VietQR text must be capped at 50 chars max');
assert.strictEqual(bot.sanitizeVietQRText(null), '');
assert.strictEqual(bot.sanitizeVietQRText(undefined), '');
assert.strictEqual(bot.sanitizeVietQRText(true), '');
assert.strictEqual(bot.sanitizeVietQRText(Symbol('test')), '');

const qrZero = bot.generateVietQRUrl({ amount: 0, addInfo: 'LS123456' });
assert(!qrZero.includes('amount='), '0 VND must NOT append amount parameter to VietQR URL');

const qrNegotiated = bot.generateVietQRUrl({ amount: 'Thỏa thuận', addInfo: 'LS123456' });
assert(!qrNegotiated.includes('amount='), 'Negotiable price must NOT append amount parameter');

const qrValid = bot.generateVietQRUrl({ amount: 30000, addInfo: 'LS123456' });
assert(qrValid.includes('amount=30000'), 'Valid amount must append amount=30000');
assert(qrValid.includes('addInfo=LS123456'), 'Valid addInfo must be included');

// Check URL percent encoding (%20 instead of +)
const qrSpace = bot.generateVietQRUrl({ accountName: 'NGUYEN VAN A' });
assert(qrSpace.includes('accountName=NGUYEN%20VAN%20A'), 'URL spaces must be %20 encoded, not +');
assert(!qrSpace.includes('NGUYEN+VAN+A'), 'URL spaces must not contain +');

// Check numeric extraction for formatted string amount and BigInt
const qrStringAmount = bot.generateVietQRUrl({ amount: '30,000', addInfo: 'LS123456' });
assert(qrStringAmount.includes('amount=30000'), 'Formatted string amount 30,000 must parse to amount=30000');
const qrDotAmount = bot.generateVietQRUrl({ amount: '30.000 VNĐ', addInfo: 'LS123456' });
assert(qrDotAmount.includes('amount=30000'), 'Formatted string amount 30.000 VNĐ must parse to amount=30000');
const qrBigInt = bot.generateVietQRUrl({ amount: 50000n, addInfo: 'LS123456' });
assert(qrBigInt.includes('amount=50000'), 'BigInt amount 50000n must parse to amount=50000');

console.log('   ✅ VietQR constraints & URL generation passed all checks!\n');

// 4. Order code generator entropy, boundary regex & collision risk
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
assert.strictEqual(bot.isValidOrderCode(Symbol('order')), false);
assert.strictEqual(bot.extractOrderCode('Chuyen tien LS123456 mua bot'), 'LS123456');
assert.strictEqual(bot.extractOrderCode('LS-123456'), 'LS123456');
// Lookaround boundary tests (underscores, dashes, dots)
assert.strictEqual(bot.extractOrderCode('MB_LS123456'), 'LS123456', 'Underscore prefix must be recognized');
assert.strictEqual(bot.extractOrderCode('DON_HANG_LS123456'), 'LS123456', 'Embedded in underscores must be recognized');
assert.strictEqual(bot.extractOrderCode('LS123456_APPROVED'), 'LS123456', 'Underscore suffix must be recognized');
assert.strictEqual(bot.extractOrderCode('XLS123456'), null, 'Alphabetical prefix must NOT match');
assert.strictEqual(bot.extractOrderCode('LS1234567'), null, '7 digits after LS must NOT match');
console.log('   ✅ Order code generator (5,000 samples) zero collision & regex consistency passed!\n');

// 5. Package lookup fallback & Negotiable price
console.log('5️⃣ Checking Package lookup fallback & Negotiable price:');
assert.strictEqual(bot.isNegotiatedPrice(0), true);
assert.strictEqual(bot.isNegotiatedPrice(null), true);
assert.strictEqual(bot.isNegotiatedPrice(undefined), true);
assert.strictEqual(bot.isNegotiatedPrice('Thỏa thuận'), true);
assert.strictEqual(bot.isNegotiatedPrice(30000), false);
assert.strictEqual(bot.isNegotiatedPrice('30000'), false);
assert.strictEqual(bot.isNegotiatedPrice('30,000'), false);
assert.strictEqual(bot.isNegotiatedPrice('30.000'), false);
assert.strictEqual(bot.isNegotiatedPrice(30000n), false);
assert.strictEqual(bot.isNegotiatedPrice(-5000), true);

const customModPkg = bot.getPackage('custom_mod');
assert(customModPkg !== null);
assert(bot.isNegotiatedPrice(customModPkg.price_vnd), 'custom_mod must be recognized as negotiated');

const customDevPkg = bot.getPackage('custom_dev');
assert(customDevPkg !== null);
assert(bot.isNegotiatedPrice(customDevPkg.price_vnd), 'custom_dev must be recognized as negotiated');

console.log('   ✅ Package fallback & negotiated pricing passed all checks!\n');

// 6. Circuit Breaker & LRU Cache Verification
console.log('6️⃣ Checking VietQR Circuit Breaker & LRU Cache:');
const cb = bot.vietQRCircuitBreaker;
cb.reset();
assert.strictEqual(cb.state, 'CLOSED');
assert.strictEqual(cb.canRequest(), true);

// Simulate 3 failures
cb.recordFailure('Simulated 500 error 1');
assert.strictEqual(cb.state, 'CLOSED');
cb.recordFailure('Simulated 502 error 2');
assert.strictEqual(cb.state, 'CLOSED');
cb.recordFailure('Simulated 504 error 3');
assert.strictEqual(cb.state, 'OPEN', 'Circuit Breaker must trip to OPEN after 3 consecutive failures');
assert.strictEqual(cb.canRequest(), false, 'canRequest must return false when OPEN (fail-fast)');

// Test stats reporting
const stats = bot.getVietQRCacheStats();
assert.strictEqual(stats.circuitBreaker.state, 'OPEN');
assert.strictEqual(stats.circuitBreaker.consecutiveFailures, 3);

// Test recovery on success
cb.recordSuccess();
assert.strictEqual(cb.state, 'CLOSED', 'Successful request must restore state to CLOSED');
assert.strictEqual(cb.canRequest(), true);

// Test LRU Cache & clearVietQRCache
bot.clearVietQRCache();
assert.strictEqual(bot.vietQRBufferCache.size, 0);
assert.strictEqual(cb.state, 'CLOSED');
console.log('   ✅ VietQR Circuit Breaker & LRU Cache passed all checks!\n');

console.log('🎉 ALL 6 FINANCIAL INTEGRITY AUDIT SUITES PASSED FLAWLESSLY!');
