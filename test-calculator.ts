import { calculate, formatCost, type MatterInputs, gigabytesToDocs } from './src/lib/calculator.js';

interface Scenario {
  name: string;
  inputs: MatterInputs;
  /** Expected qualitative checks. */
  expect: {
    /** Which delivery model should be cheapest among non-red flagged options. */
    cheapestId?: string;
    /** Which delivery models should have red flags. */
    redFlags?: string[];
    /** Which delivery models should be infeasible on the timeline. */
    timeInfeasible?: string[];
  };
}

const scenarios: Scenario[] = [
  // ----------------------------------------------------------------------
  // 1. The DecoverAI benchmark scenario — 100 GB / 250K docs / 6 months
  // Calibration scenario for sanity-checking the cost ranges.
  // ----------------------------------------------------------------------
  {
    name: 'DecoverAI mid-size commercial dispute (100 GB / 250K docs / 24 weeks)',
    inputs: {
      documentCount: 250_000,
      gigabytes: 100,
      corpusMix: 'mixed',
      matterType: 'adversarial',
      weeks: 24,
      privilegeRequired: true,
      privilegeFraction: 0.08,
      defensibility: 'high',
      hostingMonths: 12, // 6 months matter + 6 months retention
    },
    expect: {
      // Adversarial + high defensibility should red-flag raw API.
      redFlags: ['raw_api'],
    },
  },
  // ----------------------------------------------------------------------
  // 2. Large adversarial — 1M docs / 6 weeks. Human review math says infeasible.
  // ----------------------------------------------------------------------
  {
    name: 'Large adversarial production, tight timeline (1M docs / 400 GB / 6 weeks)',
    inputs: {
      documentCount: 1_000_000,
      gigabytes: 400,
      corpusMix: 'mixed',
      matterType: 'adversarial',
      weeks: 6,
      privilegeRequired: true,
      privilegeFraction: 0.08,
      defensibility: 'high',
      hostingMonths: 9,
    },
    expect: {
      // Adversarial + high defensibility => red on raw API.
      // 1M docs in 6 weeks => human review and TAR both infeasible (red).
      redFlags: ['raw_api', 'traditional_managed_tar', 'human_review'],
      timeInfeasible: ['human_review'],
    },
  },
  // ----------------------------------------------------------------------
  // 3. Small post-production triage. Low defensibility. Raw API should be OK here.
  // ----------------------------------------------------------------------
  {
    name: 'Post-production triage (50K docs / 20 GB / 4 weeks / no privilege)',
    inputs: {
      documentCount: 50_000,
      gigabytes: 20,
      corpusMix: 'mixed',
      matterType: 'post_production',
      weeks: 4,
      privilegeRequired: false,
      privilegeFraction: 0.08,
      defensibility: 'low',
      hostingMonths: 6,
    },
    expect: {
      // Low defensibility + post-production => raw API yellow, not red.
      redFlags: [],
    },
  },
  // ----------------------------------------------------------------------
  // 4. HSR Second Request scale. Regulatory production.
  // ----------------------------------------------------------------------
  {
    name: 'HSR Second Request (3M docs / 1200 GB / 12 weeks)',
    inputs: {
      documentCount: 3_000_000,
      gigabytes: 1200,
      corpusMix: 'mixed',
      matterType: 'regulatory',
      weeks: 12,
      privilegeRequired: true,
      privilegeFraction: 0.05,
      defensibility: 'standard',
      hostingMonths: 18,
    },
    expect: {
      // 3M docs in 12 weeks => human review and TAR both infeasible.
      redFlags: ['traditional_managed_tar', 'human_review'],
      timeInfeasible: ['human_review'],
    },
  },
  // ----------------------------------------------------------------------
  // 5. Internal investigation. No opposing party.
  // ----------------------------------------------------------------------
  {
    name: 'Internal FCPA investigation (200K docs / 80 GB / 8 weeks)',
    inputs: {
      documentCount: 200_000,
      gigabytes: 80,
      corpusMix: 'email-heavy',
      matterType: 'investigation',
      weeks: 8,
      privilegeRequired: false,
      privilegeFraction: 0.08,
      defensibility: 'standard',
      hostingMonths: 14,
    },
    expect: {},
  },
];

function pad(s: string, n: number) {
  return (s + ' '.repeat(n)).slice(0, n);
}

let failed = 0;

for (const s of scenarios) {
  console.log('\n' + '='.repeat(95));
  console.log('SCENARIO:', s.name);
  console.log('='.repeat(95));
  console.log(`Input: ${s.inputs.documentCount.toLocaleString()} docs, ${s.inputs.gigabytes} GB, ${s.inputs.weeks} weeks, ${s.inputs.matterType}, ${s.inputs.defensibility} defensibility`);
  console.log('-'.repeat(95));

  const result = calculate(s.inputs);

  console.log('Delivery models:');
  console.log(pad('  Model', 38) + pad('Cost', 28) + pad('Time', 22) + 'Flag');
  console.log('  ' + '-'.repeat(93));
  for (const m of result.deliveryModels) {
    const flagSymbol = m.flag.level === 'green' ? '✓' : m.flag.level === 'yellow' ? '⚠' : '✗';
    console.log(
      '  ' +
        pad(m.label, 36) +
        pad(formatCost(m.cost), 28) +
        pad(m.timeDescription, 22) +
        `${flagSymbol} ${m.flag.level}`
    );
  }

  console.log(`\nLayered breakdown:`);
  console.log(`  Modern AI managed services total: ${formatCost(result.layered.modernManaged.total)}`);
  for (const item of result.layered.modernManaged.items) {
    console.log(`    - ${pad(item.label, 60)} ${formatCost(item.cost)}`);
  }
  console.log(`  Traditional configuration total:  ${formatCost(result.layered.traditional.total)}`);
  for (const item of result.layered.traditional.items) {
    console.log(`    - ${pad(item.label, 60)} ${formatCost(item.cost)}`);
  }

  console.log(`\nEditorial summary:`);
  if (result.summary) {
    console.log(`  Cheapest: ${result.summary.cheapestLabel} → ${formatCost(result.summary.cheapestTotal)}`);
    console.log(`  Costliest: ${result.summary.costliestLabel} → ${formatCost(result.summary.costliestTotal)}`);
    console.log(`  Spread: ${result.summary.spreadMultiplier.toFixed(1)}×`);
  } else {
    console.log(`  (suppressed — degenerate or sub-$5K matter)`);
  }

  // Validation
  console.log('-'.repeat(95));
  let scenarioOk = true;
  if (s.expect.redFlags) {
    const actualReds = result.deliveryModels.filter((m) => m.flag.level === 'red').map((m) => m.id);
    const missing = s.expect.redFlags.filter((id) => !actualReds.includes(id));
    const unexpected = actualReds.filter((id) => !s.expect.redFlags!.includes(id));
    if (missing.length || unexpected.length) {
      console.log(`✗ Red flag mismatch:`);
      if (missing.length) console.log(`    Expected red but got non-red: ${missing.join(', ')}`);
      if (unexpected.length) console.log(`    Got unexpected reds: ${unexpected.join(', ')}`);
      scenarioOk = false;
    } else {
      console.log(`✓ Red flags as expected: ${actualReds.join(', ') || '(none)'}`);
    }
  }
  if (s.expect.timeInfeasible) {
    for (const id of s.expect.timeInfeasible) {
      const m = result.deliveryModels.find((x) => x.id === id)!;
      // For human review, we encoded the throughput math directly into the flag reason.
      const isInfeasible = m.flag.reason.includes('Throughput math') || m.flag.reason.includes('weeks. Your timeline');
      if (!isInfeasible) {
        console.log(`✗ Expected ${id} to be flagged time-infeasible — was not.`);
        scenarioOk = false;
      } else {
        console.log(`✓ ${id} correctly flagged as time-infeasible`);
      }
    }
  }
  if (scenarioOk) console.log(`✓ PASS`);
  else failed++;
}

// Sanity check the GB→docs conversion
console.log('\n' + '='.repeat(95));
console.log('GB → docs conversion sanity check');
console.log('='.repeat(95));
console.log(`100 GB mixed corpus = ${gigabytesToDocs(100, 'mixed').toLocaleString()} docs (expected: 750,000)`);
console.log(`100 GB email-heavy = ${gigabytesToDocs(100, 'email-heavy').toLocaleString()} docs (expected: 1,000,000)`);
console.log(`100 GB loose-files = ${gigabytesToDocs(100, 'loose-files').toLocaleString()} docs (expected: 500,000)`);

console.log('\n' + '='.repeat(95));
console.log(failed === 0 ? `ALL SCENARIOS PASSED ✓` : `${failed} SCENARIOS FAILED ✗`);
console.log('='.repeat(95));
process.exit(failed === 0 ? 0 : 1);
