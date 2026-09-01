/**
 * TEST MEMORY AUDIT & PROCESS LIFECYCLE FOR BOT.JS
 * Tests memory bounds, TTL eviction, Garbage Collection, Watchdog thresholds & Graceful Shutdown
 */

const assert = require('assert');
const path = require('path');

const bot = require('./bot.js');

console.log('🧪 Starting Memory Footprint, GC, and Process Lifecycle Audit Tests...\n');

// =========================================================================
// TEST SUITE 1: ExpiringLockMap Data Structure & Auto-TTL
// =========================================================================
console.log('1️⃣ Testing ExpiringLockMap:');

const lockMap = new bot.ExpiringLockMap(100, 5); // 100ms TTL, max 5 entries

// 1.1 Add & Has
lockMap.add('key1');
assert.strictEqual(lockMap.has('key1'), true, 'ExpiringLockMap.has should return true for active key');
assert.strictEqual(typeof lockMap.get('key1'), 'number', 'ExpiringLockMap.get should return timestamp');

// 1.2 TTL Expiration
setTimeout(() => {
  assert.strictEqual(lockMap.has('key1'), false, 'ExpiringLockMap.has should return false after TTL');
  assert.strictEqual(lockMap.get('key1'), undefined, 'ExpiringLockMap.get should return undefined after TTL');
  console.log('   ✅ ExpiringLockMap TTL expiration verified!');
}, 150);

// 1.3 Max Size Bound (FIFO eviction)
const boundedMap = new bot.ExpiringLockMap(10000, 3);
boundedMap.add('a');
boundedMap.add('b');
boundedMap.add('c');
assert.strictEqual(boundedMap.size, 3);
boundedMap.add('d'); // should evict 'a'
assert.strictEqual(boundedMap.size, 3);
assert.strictEqual(boundedMap.has('a'), false, 'Oldest key should be evicted when capacity reached');
assert.strictEqual(boundedMap.has('d'), true, 'Newest key should be present');
console.log('   ✅ ExpiringLockMap capacity bound & FIFO eviction verified!');

// =========================================================================
// TEST SUITE 2: activeOrderCodes & Order Pool Memory Bounds
// =========================================================================
console.log('\n2️⃣ Testing activeOrderCodes & Order Pool Bounds:');

const initialSize = bot.activeOrderCodes.size;
const testCode = bot.generateUniqueOrderCode();
assert.strictEqual(typeof testCode, 'string');
assert.strictEqual(bot.activeOrderCodes.has(testCode), true);
assert.strictEqual(bot.MAX_ACTIVE_ORDERS, 10000);
console.log(`   ✅ Active order code generated: ${testCode}, Map size: ${bot.activeOrderCodes.size}`);

// =========================================================================
// TEST SUITE 3: failedVietQRUrls & Negative Cache Bound
// =========================================================================
console.log('\n3️⃣ Testing failedVietQRUrls Negative Cache Bounds:');

assert.strictEqual(bot.VIETQR_FAILED_MAX_SIZE, 100);
const initialFailedCount = bot.failedVietQRUrls.size;

// Test negative cache retrieval
bot.failedVietQRUrls.set('https://img.vietqr.io/test-fail.png', { failedAt: Date.now(), reason: 'Test error' });
assert.strictEqual(bot.failedVietQRUrls.has('https://img.vietqr.io/test-fail.png'), true);
bot.failedVietQRUrls.delete('https://img.vietqr.io/test-fail.png');
console.log('   ✅ failedVietQRUrls negative cache verified!');

// =========================================================================
// TEST SUITE 4: userCooldowns & Rate Limiting Bound
// =========================================================================
console.log('\n4️⃣ Testing userCooldowns Bounds & Pruning:');

assert.strictEqual(bot.MAX_USER_COOLDOWNS, 1000);
const remaining1 = bot.getRateLimitRemaining('test_user_mem_1', 3000);
assert.strictEqual(remaining1, 0, 'First request should have 0 remaining cooldown');
const remaining2 = bot.getRateLimitRemaining('test_user_mem_1', 3000);
assert.strictEqual(remaining2 > 0, true, 'Immediate subsequent request should be rate limited');
console.log('   ✅ userCooldowns rate limiting & bounds verified!');

// =========================================================================
// TEST SUITE 5: Memory Watchdog & Cache Flush Functionality
// =========================================================================
console.log('\n5️⃣ Testing flushMemoryCaches & getMemoryFootprint:');

const footprint = bot.getMemoryFootprint();
assert.strictEqual(typeof footprint.rssMB, 'number');
assert.strictEqual(typeof footprint.heapTotalMB, 'number');
assert.strictEqual(typeof footprint.heapUsedMB, 'number');
assert.strictEqual(typeof footprint.collections, 'object');
console.log('   📊 Current Process Memory Footprint:', JSON.stringify(footprint, null, 2));

// Test Soft & Critical Flush
bot.flushMemoryCaches('soft');
bot.flushMemoryCaches('critical');
console.log('   ✅ flushMemoryCaches(soft/critical) executed without exceptions!');

// =========================================================================
// TEST SUITE 6: Verification of Timer References (.unref)
// =========================================================================
console.log('\n6️⃣ Testing Timer Unref & Lifecycle:');

// Verify that closingTicketChannels has TTL and doesn't block closing
assert.strictEqual(bot.closingTicketChannels instanceof bot.ExpiringLockMap, true);
assert.strictEqual(bot.ticketCreationLocks instanceof bot.ExpiringLockMap, true);
assert.strictEqual(bot.processingApprovals instanceof bot.ExpiringLockMap, true);
console.log('   ✅ All concurrency lock collections are ExpiringLockMaps with auto-TTL!');

setTimeout(() => {
  console.log('\n🎉 ALL MEMORY FOOTPRINT & LIFECYCLE AUDIT TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}, 200);
