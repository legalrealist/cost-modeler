import { calculate, formatCost, type MatterInputs } from './src/lib/calculator.js';

const baseline: MatterInputs = {
  documentCount: 250_000,
  gigabytes: 33,
  corpusMix: 'mixed',
  matterType: 'adversarial',
  weeks: 24,
  privilegeRequired: true,
  privilegeFraction: 0.08,
  defensibility: 'high',
  hostingMonths: 12,
};

console.log('\n=== EDGE CASES ===\n');

// 1. Zero documents
console.log('--- 1. Zero documents ---');
const zero = calculate({ ...baseline, documentCount: 0, gigabytes: 0 });
zero.deliveryModels.forEach(m => console.log(`  ${m.label}: ${formatCost(m.cost)}`));
console.log(`  Summary: ${zero.summary ? 'present' : 'null (correctly suppressed)'}`);

// 2. Tiny matter
console.log('\n--- 2. Tiny matter (1,000 docs) ---');
const tiny = calculate({ ...baseline, documentCount: 1_000, gigabytes: 0.13 });
tiny.deliveryModels.forEach(m => console.log(`  ${m.label}: ${formatCost(m.cost)}`));
console.log(`  Summary: ${tiny.summary ? `${tiny.summary.cheapestLabel} → ${formatCost(tiny.summary.cheapestTotal)}` : 'suppressed (sub-$5K matter)'}`);

// 3. Massive matter
console.log('\n--- 3. Massive matter (10M docs / 4 TB) ---');
const massive = calculate({ ...baseline, documentCount: 10_000_000, gigabytes: 4000 });
massive.deliveryModels.forEach(m => console.log(`  ${m.label}: ${formatCost(m.cost)}`));

// 4. Privilege fraction at 0%
console.log('\n--- 4. Privilege required but 0% population ---');
const zeroPriv = calculate({ ...baseline, privilegeFraction: 0 });
zeroPriv.deliveryModels.forEach(m => console.log(`  ${m.label}: ${formatCost(m.cost)}`));

// 5. Privilege fraction at 100% (everything privileged — absurd but possible input)
console.log('\n--- 5. Privilege fraction at 100% ---');
const maxPriv = calculate({ ...baseline, privilegeFraction: 1.0 });
maxPriv.deliveryModels.forEach(m => console.log(`  ${m.label}: ${formatCost(m.cost)}`));

// 6. Very long timeline (no time pressure)
console.log('\n--- 6. 5-year timeline (260 weeks) ---');
const long = calculate({ ...baseline, weeks: 260 });
long.deliveryModels.forEach(m => console.log(`  ${m.label}: ${m.timeDescription} | ${m.flag.level}`));

// 7. Very short timeline (1 week)
console.log('\n--- 7. 1-week timeline ---');
const short = calculate({ ...baseline, weeks: 1 });
short.deliveryModels.forEach(m => console.log(`  ${m.label}: ${m.timeDescription} | ${m.flag.level}`));

// 8. No privilege required at all
console.log('\n--- 8. No privilege required ---');
const noPriv = calculate({ ...baseline, privilegeRequired: false });
noPriv.deliveryModels.forEach(m => console.log(`  ${m.label}: ${formatCost(m.cost)}`));

// 9. Hosting months = 0 (should this even be allowed?)
console.log('\n--- 9. Zero hosting months ---');
const zeroHosting = calculate({ ...baseline, hostingMonths: 0 });
zeroHosting.deliveryModels.forEach(m => console.log(`  ${m.label}: ${formatCost(m.cost)}`));

// 10. Hosting longer than matter (60 months — multi-year retention)
console.log('\n--- 10. 60 months hosting ---');
const longHosting = calculate({ ...baseline, hostingMonths: 60 });
longHosting.deliveryModels.forEach(m => console.log(`  ${m.label}: ${formatCost(m.cost)}`));

// 11. Mismatch — high defensibility on post-production matter
console.log('\n--- 11. High defensibility + post-production (weird combo) ---');
const weirdCombo = calculate({ ...baseline, matterType: 'post_production', defensibility: 'high' });
weirdCombo.deliveryModels.forEach(m => console.log(`  ${m.label}: ${m.flag.level} — ${m.flag.reason.slice(0, 80)}`));

// 12. Negative numbers (defense in depth)
console.log('\n--- 12. Negative document count (input validation) ---');
try {
  const neg = calculate({ ...baseline, documentCount: -1000 });
  neg.deliveryModels.forEach(m => console.log(`  ${m.label}: ${formatCost(m.cost)}`));
} catch (e) {
  console.log(`  Threw: ${e}`);
}

// 13. NaN inputs
console.log('\n--- 13. NaN document count ---');
try {
  const nan = calculate({ ...baseline, documentCount: NaN });
  nan.deliveryModels.forEach(m => console.log(`  ${m.label}: ${formatCost(m.cost)}`));
} catch (e) {
  console.log(`  Threw: ${e}`);
}

console.log('\n=== END EDGE CASES ===\n');
