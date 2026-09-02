/**
 * ============================================================================
 * LS STUDIO BOT - UNIFIED AUDIT TEST RUNNER
 * ============================================================================
 * Runs all security, memory, financial, and lifecycle test suites in sequence.
 * ============================================================================
 */

const { spawnSync } = require('child_process');
const path = require('path');

const suites = [
  { name: 'Components V2 UI & Layout Engine', script: 'test_components_v2.js' },
  { name: 'Memory & Lifecycle Audit', script: 'test_memory_audit.js' },
  { name: 'Financial & Payment Audit', script: 'test_financial_audit.js' },
  { name: 'Transcript & Security Audit', script: 'test_transcript_audit.js' },
  { name: 'Full Mock Test Harness (175 Tests / 24 Suites)', script: 'test_harness.js' }
];

console.log('================================================================================');
console.log('🚀 RUNNING ALL LS STUDIO BOT AUDIT SUITES');
console.log('================================================================================\n');

let totalPassed = 0;
let totalFailed = 0;
const startTime = Date.now();

for (const suite of suites) {
  console.log(`▶ Running [${suite.name}] (${suite.script})...`);
  const result = spawnSync(process.execPath, [path.join(__dirname, suite.script)], {
    stdio: 'inherit',
    env: process.env
  });

  if (result.status === 0) {
    console.log(`✅ [${suite.name}] PASSED\n`);
    totalPassed++;
  } else {
    console.error(`❌ [${suite.name}] FAILED (Exit code: ${result.status})\n`);
    totalFailed++;
  }
}

const duration = ((Date.now() - startTime) / 1000).toFixed(2);

console.log('================================================================================');
console.log('📊 UNIFIED AUDIT SUMMARY');
console.log('================================================================================');
console.log(`Total Suites:  ${suites.length}`);
console.log(`Passed:        ${totalPassed}`);
console.log(`Failed:        ${totalFailed}`);
console.log(`Duration:      ${duration}s`);
console.log('================================================================================');

if (totalFailed > 0) {
  console.error('❌ ONE OR MORE AUDIT SUITES FAILED!');
  process.exit(1);
} else {
  console.log('🎉 ALL AUDIT SUITES PASSED SUCCESSFULLY!');
  process.exit(0);
}
