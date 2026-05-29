/**
 * Cost Modeler — Calculator Math
 *
 * Pure functions. Given a matter description, compute cost ranges and time
 * estimates for each delivery model. No UI, no I/O.
 *
 * Every formula traces back to a numbered cell in the layered breakdown so
 * the UI can show its work via hover citations.
 */

import {
  PER_DOC_RATES,
  PER_GB_RATES,
  OTHER_RATES,
  THROUGHPUT,
  CORPUS_MIXES,
  DEFAULTS,
  type CorpusMix,
  type PricedRange,
} from './pricing-data';
import {
  resolveRate,
  defaultTraditionalStaffing,
  defaultAiStaffing,
  defaultPmStaffing,
  staffingTotal,
  type RateOverrides,
  type BudgetState,
  type LineItemId,
  type StaffingRow,
} from './rate-overrides';

// ---------------------------------------------------------------------------
// Input shape
// ---------------------------------------------------------------------------

export type MatterType =
  | 'adversarial'
  | 'investigation'
  | 'regulatory'
  | 'post_production'
  | 'compliance';

export type Defensibility = 'high' | 'standard' | 'low';

export interface MatterInputs {
  /** Number of documents in the corpus. */
  documentCount: number;
  /** Corpus volume in GB (derived from documentCount via corpusMix). */
  gigabytes: number;
  /** Document type mix, drives docs/GB ratio. */
  corpusMix: CorpusMix['id'];
  /** Type of matter — affects appropriateness flags. */
  matterType: MatterType;
  /** Weeks available for review. */
  weeks: number;
  /** Whether privilege review is required. */
  privilegeRequired: boolean;
  /** Privilege population as fraction of total docs (0–1). */
  privilegeFraction: number;
  /** Defensibility profile. */
  defensibility: Defensibility;
  /** Months data is held live (drives hosting cost). Default = weeks/4 + 6 months. */
  hostingMonths: number;
}

// ---------------------------------------------------------------------------
// Utility — derive volume from one input given the other
// ---------------------------------------------------------------------------

export function docsToGigabytes(docs: number, mix: CorpusMix['id']): number {
  return docs / CORPUS_MIXES[mix].docsPerGb;
}

export function gigabytesToDocs(gb: number, mix: CorpusMix['id']): number {
  return Math.round(gb * CORPUS_MIXES[mix].docsPerGb);
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface CostRange {
  low: number;
  high: number;
}

export type FlagLevel = 'green' | 'yellow' | 'red';

export interface AppropriatenessFlag {
  level: FlagLevel;
  reason: string;
}

export interface DeliveryModel {
  id:
    | 'raw_api'
    | 'platform_bundled'
    | 'ai_native_inclusive'
    | 'ai_managed_services'
    | 'traditional_managed_tar'
    | 'human_review';
  label: string;
  description: string;
  cost: CostRange;
  /** Time estimate in working days (8h × 5d/wk × given staffing). */
  timeDescription: string;
  whatsIncluded: string;
  flag: AppropriatenessFlag;
  /** Cite the dominant source for this model's pricing. */
  primarySourceId: string;
}

export interface LineItem {
  label: string;
  formula: string;
  cost: CostRange;
  /** ID of the underlying rate or source. */
  sourceId: string;
  /** Which line item ID this belongs to (for toggle/override mapping). */
  lineItemId?: LineItemId;
  /** Which RateOverrides key controls the rate for this item. */
  rateKey?: keyof RateOverrides;
  /** What the benchmark cost would be (without overrides). */
  benchmarkCost?: CostRange;
  /** True when the user has customized this rate. */
  isOverridden?: boolean;
  /** The unit for the editable rate (e.g., '$/doc', '$/GB/mo'). */
  rateUnit?: string;
  /** The multiplier quantity (e.g., doc count, GB × months). */
  quantity?: number;
}

export interface LayeredBreakdown {
  /** Modern AI-augmented managed services configuration. */
  modernManaged: {
    items: LineItem[];
    total: CostRange;
  };
  /** Traditional layered configuration with human review. */
  traditional: {
    items: LineItem[];
    total: CostRange;
  };
}

export type WarningLevel = 'info' | 'caution' | 'warning';

export interface BudgetWarning {
  level: WarningLevel;
  message: string;
  /** Which line item this warning is attached to (null = top-level). */
  lineItemId?: LineItemId;
}

/** Budget worksheet: a unified list of all possible line items with overrides applied. */
export interface BudgetWorksheetOutput {
  items: BudgetLineItem[];
  /** Total of enabled items only. */
  total: CostRange;
  /** Appropriateness warnings based on the current configuration. */
  warnings: BudgetWarning[];
}

export interface BudgetLineItem extends LineItem {
  lineItemId: LineItemId;
  enabled: boolean;
  /** Whether this line item supports staffing drill-down. */
  hasStaffing?: boolean;
  /** Default staffing rows (generated from doc count / assumptions). */
  defaultStaffing?: StaffingRow[];
  /** User-overridden staffing rows (if any). */
  staffingOverride?: StaffingRow[];
  /** Whether the user has expanded staffing and is using staffing-derived cost. */
  useStaffingCost?: boolean;
}

export interface CalculatorOutput {
  inputs: MatterInputs;
  /** All six delivery models with cost, time, and flags. */
  deliveryModels: DeliveryModel[];
  /** Side-by-side modern vs. traditional breakdown. */
  layered: LayeredBreakdown;
  /** Budget worksheet: unified line items with overrides + toggles applied. */
  budget: BudgetWorksheetOutput;
  /**
   * Editorial summary line — opinionated.
   * Null on degenerate inputs (zero documents, sub-$5K matters, only one
   * realistic option) where a "spread" framing would be misleading.
   */
  summary: {
    cheapestTotal: CostRange;
    costliestTotal: CostRange;
    cheapestLabel: string;
    costliestLabel: string;
    /** Spread multiplier, computed off midpoints for stability. */
    spreadMultiplier: number;
  } | null;
}

// ---------------------------------------------------------------------------
// Helpers — range arithmetic
// ---------------------------------------------------------------------------

function multiplyRange(rate: PricedRange, units: number): CostRange {
  return { low: rate.low * units, high: rate.high * units };
}

function multiplyRangeNum(range: CostRange, scalar: number): CostRange {
  return { low: range.low * scalar, high: range.high * scalar };
}

function addRanges(...ranges: CostRange[]): CostRange {
  return ranges.reduce(
    (acc, r) => ({ low: acc.low + r.low, high: acc.high + r.high }),
    { low: 0, high: 0 }
  );
}

function midpoint(r: CostRange): number {
  return (r.low + r.high) / 2;
}

/**
 * Project management hours scale with document volume. A 1K-doc matter has a
 * floor (40 hrs); a 10M-doc HSR matter needs hundreds of hours. Reasonable
 * approximation: 1 hour of PM per ~3,000 documents, with a 40-hour floor.
 */
function scaledPmHours(documentCount: number): number {
  return Math.max(40, Math.ceil(documentCount / 3000));
}

// ---------------------------------------------------------------------------
// Per-model cost calculators
// ---------------------------------------------------------------------------

function calcRawApi(inputs: MatterInputs): CostRange {
  return multiplyRange(PER_DOC_RATES.rawApi, inputs.documentCount);
}

/**
 * Platform-bundled AI: Relativity aiR / Everlaw / DISCO. AI is bundled into
 * standard pricing; the user still pays for hosting and per-GB platform fees.
 *
 * Approach: hosting (full-service tier) + per-GB platform pricing for review
 * volume. AI itself is "free" — bundled into base. Source: Platinum IDS 2026
 * Price Reset analysis; DiscoverLex 2026 volume-based platform tier.
 */
function calcPlatformBundled(inputs: MatterInputs): CostRange {
  const hosting = multiplyRangeNum(
    multiplyRange(PER_GB_RATES.hostingFullService, inputs.gigabytes),
    inputs.hostingMonths
  );
  const platformVolume = multiplyRange(PER_GB_RATES.platformVolumeBased, inputs.gigabytes);
  return addRanges(hosting, platformVolume);
}

/**
 * AI-native all-inclusive (DecoverAI tier): single per-GB-month rate that
 * bundles ingestion, OCR, dedup, AI review, Bates, redaction, privilege log,
 * production, and SOC 2 hosting. No separate line items.
 */
function calcAiNativeInclusive(inputs: MatterInputs): CostRange {
  return multiplyRangeNum(
    multiplyRange(PER_GB_RATES.aiNativeAllInclusive, inputs.gigabytes),
    inputs.hostingMonths
  );
}

/**
 * AI-augmented managed services (Epiq, Lighthouse, Consilio, FTI tier).
 *
 * Pricing model: AI does the responsiveness AND privilege workflow, with humans
 * handling QC and exception-resolution. Privilege log generation is *bundled*
 * into the AI workflow at near-zero marginal cost — modern managed services
 * vendors don't itemize privilege log entries separately the way legacy vendors
 * did. The DecoverAI per-entry rate ($5–15) is a *legacy* line item; including
 * it here would triple-count the privilege workflow.
 *
 * What we charge for instead: per-doc AI review across the full corpus
 * (PER_DOC_RATES.genaiAssistedReview already covers responsiveness + privilege
 * per Winter 2026 survey "GenAI-assisted review" pricing), plus a privilege QC
 * surcharge at human review rates on a small fraction of documents (5% of the
 * privilege population, reflecting the human exception-resolution layer).
 *
 * Components: hosting (mid-tier, since PM is separately accounted) + AI review
 * across full corpus + privilege QC on a small subset + PM scaled with volume.
 */
function calcAiManagedServices(inputs: MatterInputs): CostRange {
  const hosting = multiplyRangeNum(
    multiplyRange(PER_GB_RATES.hostingMidTier, inputs.gigabytes),
    inputs.hostingMonths
  );
  const aiReview = multiplyRange(PER_DOC_RATES.genaiAssistedReview, inputs.documentCount);

  // Human privilege QC on a small fraction (5%) of the privileged population.
  // The AI handles bulk privilege classification; humans review the exceptions.
  let privilegeQc: CostRange = { low: 0, high: 0 };
  if (inputs.privilegeRequired) {
    const privilegedDocs = inputs.documentCount * inputs.privilegeFraction;
    const qcDocs = privilegedDocs * 0.05; // 5% exception-resolution rate
    privilegeQc = multiplyRange(PER_DOC_RATES.humanPrivilegeReview, qcDocs);
  }

  const pmHours = scaledPmHours(inputs.documentCount);
  const pm = multiplyRange(OTHER_RATES.projectManagementPerHour, pmHours);

  return addRanges(hosting, aiReview, privilegeQc, pm);
}

/**
 * Traditional managed review with TAR 1.0/2.0 + human first-pass. The cost
 * floor for adversarial production where AI alone may not be defensible.
 *
 * Components: hosting + processing + human responsiveness + human privilege +
 * production + privilege log entries + PM.
 */
function calcTraditionalManagedTar(inputs: MatterInputs): CostRange {
  const hosting = multiplyRangeNum(
    multiplyRange(PER_GB_RATES.hostingFullService, inputs.gigabytes),
    inputs.hostingMonths
  );
  const processing = multiplyRange(PER_GB_RATES.processingLegacy, inputs.gigabytes);

  // TAR culls — assume 60% reduction in docs reaching human review (typical TAR result).
  // The human review in a TAR workflow is on the responsive subset, not the full corpus.
  const humanReviewDocs = inputs.documentCount * 0.4;
  const humanResponsiveness = multiplyRange(
    PER_DOC_RATES.humanResponsivenessFirstPass,
    humanReviewDocs
  );

  let privilege: CostRange = { low: 0, high: 0 };
  if (inputs.privilegeRequired) {
    const privilegedDocs = inputs.documentCount * inputs.privilegeFraction;
    privilege = multiplyRange(PER_DOC_RATES.humanPrivilegeReview, privilegedDocs);
  }

  // Production rate varies by matter type — adversarial/regulatory produce most
  // responsive docs; investigation/post-production/compliance often produce nothing.
  const producedPages =
    inputs.documentCount * productionRate(inputs.matterType) * DEFAULTS.pagesPerDoc;
  const production = multiplyRange(OTHER_RATES.productionPerPage, producedPages);

  // Traditional review needs 1.5× the PM scaling because of human reviewer coordination.
  const pm = multiplyRange(
    OTHER_RATES.projectManagementPerHour,
    Math.ceil(scaledPmHours(inputs.documentCount) * 1.5)
  );

  return addRanges(hosting, processing, humanResponsiveness, privilege, production, pm);
}

/**
 * Production rate by matter type. Adversarial/regulatory typically produce the
 * responsive subset; internal investigations and post-production analysis do not
 * produce documents externally. Approximate proportions of total corpus.
 */
function productionRate(matterType: MatterType): number {
  switch (matterType) {
    case 'adversarial':
      return 0.10; // ~10% of corpus produced after responsiveness + privilege culling
    case 'regulatory':
      return 0.30; // HSR/CID typically produce a larger fraction
    case 'investigation':
      return 0.0; // internal — no external production
    case 'post_production':
      return 0.0; // documents already produced
    case 'compliance':
      return 0.0; // no external production
  }
}

/**
 * Pure human contract review — the displaced baseline.
 * Components: full-service hosting + processing + human responsiveness on
 * full corpus + human privilege + production + heavy PM.
 */
function calcHumanReview(inputs: MatterInputs): CostRange {
  const hosting = multiplyRangeNum(
    multiplyRange(PER_GB_RATES.hostingFullService, inputs.gigabytes),
    inputs.hostingMonths
  );
  const processing = multiplyRange(PER_GB_RATES.processingLegacy, inputs.gigabytes);
  const humanResponsiveness = multiplyRange(
    PER_DOC_RATES.humanResponsivenessFirstPass,
    inputs.documentCount
  );

  let privilege: CostRange = { low: 0, high: 0 };
  if (inputs.privilegeRequired) {
    const privilegedDocs = inputs.documentCount * inputs.privilegeFraction;
    privilege = multiplyRange(PER_DOC_RATES.humanPrivilegeReview, privilegedDocs);
  }

  const producedPages =
    inputs.documentCount * productionRate(inputs.matterType) * DEFAULTS.pagesPerDoc;
  const production = multiplyRange(OTHER_RATES.productionPerPage, producedPages);

  // Pure human review needs 2× PM scaling — heavy reviewer coordination, QC, calibration.
  const pm = multiplyRange(
    OTHER_RATES.projectManagementPerHour,
    Math.ceil(scaledPmHours(inputs.documentCount) * 2)
  );

  return addRanges(hosting, processing, humanResponsiveness, privilege, production, pm);
}

// ---------------------------------------------------------------------------
// Time feasibility
// ---------------------------------------------------------------------------

interface TimeAssessment {
  description: string;
  feasible: boolean;
  /** Estimated weeks to complete with the model's typical staffing. */
  weeksEstimate: number;
}

function timeRawApi(_inputs: MatterInputs): TimeAssessment {
  return { description: 'Hours', feasible: true, weeksEstimate: 0.1 };
}

function timeAiBased(inputs: MatterInputs): TimeAssessment {
  // Use the conservative end of the AI throughput range (25K/hr — DISCO Cecilia)
  // because matter-specific tuning, QC, and validation slow real deployments.
  const hours = inputs.documentCount / THROUGHPUT.genaiAssisted.perHour.low;
  const days = Math.max(1, Math.ceil(hours / 8));
  if (days <= 5) return { description: `${days} day${days === 1 ? '' : 's'}`, feasible: true, weeksEstimate: days / 5 };
  const weeks = Math.ceil(days / 5);
  return { description: `${weeks} week${weeks === 1 ? '' : 's'}`, feasible: weeks <= inputs.weeks, weeksEstimate: weeks };
}

function timeHumanReview(inputs: MatterInputs): TimeAssessment {
  // Standard staffing: 25 reviewers × 40 docs/hr × 40 hr/wk × (1 + 10% QC overhead).
  const reviewers = DEFAULTS.humanReviewers;
  const docsPerHourPerReviewer = (THROUGHPUT.humanReview.perHour.low + THROUGHPUT.humanReview.perHour.high) / 2;
  const docsPerWeek = reviewers * docsPerHourPerReviewer * DEFAULTS.humanWorkWeekHours;
  const baseWeeks = inputs.documentCount / docsPerWeek;
  const weeks = Math.ceil(baseWeeks * (1 + DEFAULTS.qcOverheadFraction));
  return {
    description: `~${weeks} weeks (${reviewers} reviewers)`,
    feasible: weeks <= inputs.weeks,
    weeksEstimate: weeks,
  };
}

function timeTraditionalTar(inputs: MatterInputs): TimeAssessment {
  // TAR cuts the human review population. Assume 60% reduction.
  const effectiveDocs = inputs.documentCount * 0.4;
  const reviewers = DEFAULTS.humanReviewers;
  const docsPerHourPerReviewer = (THROUGHPUT.humanReview.perHour.low + THROUGHPUT.humanReview.perHour.high) / 2;
  const docsPerWeek = reviewers * docsPerHourPerReviewer * DEFAULTS.humanWorkWeekHours;
  const weeks = Math.ceil((effectiveDocs / docsPerWeek) * (1 + DEFAULTS.qcOverheadFraction));
  return {
    description: `~${weeks} weeks (TAR + ${reviewers} reviewers)`,
    feasible: weeks <= inputs.weeks,
    weeksEstimate: weeks,
  };
}

// ---------------------------------------------------------------------------
// Appropriateness flags
// ---------------------------------------------------------------------------

function flagRawApi(inputs: MatterInputs): AppropriatenessFlag {
  if (inputs.matterType === 'adversarial') {
    return {
      level: 'red',
      reason:
        'Raw API processing has two compounding problems for adversarial matters: (1) no QC, privilege log, defensibility documentation, or production workflow — Rule 26(g)\'s "reasonable inquiry" duty requires more than direct API access; and (2) per United States v. Heppner (S.D.N.Y. 2026), exchanges with consumer-tier AI may not be privileged. If raw API access here means a consumer plan with no contractual no-training commitment, you may also be waiving privilege. Use Enterprise/Team-tier API access with documented attorney direction at minimum.',
    };
  }
  if (inputs.defensibility === 'high') {
    return {
      level: 'red',
      reason:
        'Your defensibility profile requires QC and audit trail layers that raw API processing does not provide. Heppner privilege concerns also apply if the API tier lacks a contractual no-training commitment.',
    };
  }
  if (inputs.matterType === 'post_production' || inputs.matterType === 'investigation') {
    return {
      level: 'yellow',
      reason:
        'Workable for triage and internal analysis. Confirm your API tier has a no-training commitment (per Heppner privilege guidance) before processing any privileged client material.',
    };
  }
  return {
    level: 'yellow',
    reason: 'Suitable for low-defensibility internal work. Not appropriate if any procedural challenge is foreseeable. Heppner privilege concerns apply to any client material processed through consumer-tier APIs.',
  };
}

function flagPlatformBundled(inputs: MatterInputs): AppropriatenessFlag {
  if (inputs.matterType === 'adversarial' && inputs.defensibility === 'high') {
    return {
      level: 'yellow',
      reason:
        'Platform-bundled AI handles review and privilege but does not include managed-services QC. Disclose your AI methodology at the Rule 26(f) conference and confirm validation-and-sampling protocols meet your jurisdiction\'s standards.',
    };
  }
  return {
    level: 'green',
    reason: 'Platform-bundled AI fits this matter. Confirm with your platform that AI is included in your existing tier.',
  };
}

function flagAiNativeInclusive(inputs: MatterInputs): AppropriatenessFlag {
  if (inputs.matterType === 'adversarial' && inputs.defensibility === 'high') {
    return {
      level: 'yellow',
      reason:
        'AI-native all-inclusive platforms bundle the workflow but typically do not staff the managed-services QC layer that high-defensibility adversarial production may require. Confirm Rule 26(f) disclosure language and validation methodology before relying on this tier alone.',
    };
  }
  return {
    level: 'green',
    reason: 'A natural fit — single per-GB-month price with the workflow bundled.',
  };
}

function flagAiManagedServices(_inputs: MatterInputs): AppropriatenessFlag {
  return {
    level: 'green',
    reason:
      'Managed AI services include the human QC, project management, and defensibility documentation that adversarial and regulatory production typically require.',
  };
}

function flagHumanReview(inputs: MatterInputs, time: TimeAssessment): AppropriatenessFlag {
  if (!time.feasible) {
    return {
      level: 'red',
      reason: `Throughput math: ${DEFAULTS.humanReviewers} reviewers × ${THROUGHPUT.humanReview.perHour.low}–${THROUGHPUT.humanReview.perHour.high} docs/hr × ${DEFAULTS.humanWorkWeekHours} hrs/wk requires ~${time.weeksEstimate} weeks. Your timeline is ${inputs.weeks} weeks. Cannot complete without dramatically larger staffing.`,
    };
  }
  if (inputs.matterType === 'post_production') {
    return {
      level: 'yellow',
      reason: 'Pure human review for post-production analysis is unusually expensive — AI-augmented workflows are typically a better fit when defensibility constraints are lower.',
    };
  }
  return {
    level: 'yellow',
    reason: 'The displaced baseline. Recall is 60–70% (Grossman & Cormack 2011) — significantly lower than AI-augmented or TAR alternatives. Most appropriate when defensibility precedent strongly favors human review or when AI tools are unavailable.',
  };
}

function flagTraditionalManagedTarWithTime(_inputs: MatterInputs, time: TimeAssessment): AppropriatenessFlag {
  if (!time.feasible) {
    return {
      level: 'red',
      reason: `Even with TAR culling, the human review on the responsive subset takes ~${time.weeksEstimate} weeks — beyond your timeline. Adding reviewers helps but typically requires onboarding time that erodes the gain.`,
    };
  }
  return {
    level: 'green',
    reason:
      'Traditional managed review with TAR is well-tested and judicially accepted (Da Silva Moore, Rio Tinto). Most expensive option but the most established defensibility record.',
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Sanitize inputs — clamp negatives, replace NaN with 0, ensure required ranges.
 * Defense in depth: the form should prevent these but we belt-and-suspenders.
 */
function sanitize(inputs: MatterInputs): MatterInputs {
  const safe = (n: number, fallback = 0): number =>
    Number.isFinite(n) && n >= 0 ? n : fallback;
  return {
    ...inputs,
    documentCount: safe(inputs.documentCount),
    gigabytes: safe(inputs.gigabytes),
    weeks: Math.max(1, safe(inputs.weeks, 1)),
    privilegeFraction: Math.max(0, Math.min(1, safe(inputs.privilegeFraction))),
    hostingMonths: Math.max(1, safe(inputs.hostingMonths, 1)),
  };
}

export function calculate(rawInputs: MatterInputs, budgetState?: BudgetState): CalculatorOutput {
  const inputs = sanitize(rawInputs);
  const overrides = budgetState?.overrides ?? {};
  const enabledItems = budgetState?.enabledItems;

  // Per-model time assessments
  const tRawApi = timeRawApi(inputs);
  const tAi = timeAiBased(inputs);
  const tTar = timeTraditionalTar(inputs);
  const tHuman = timeHumanReview(inputs);

  // Per-model costs
  const cRawApi = calcRawApi(inputs);
  const cPlatform = calcPlatformBundled(inputs);
  const cAiNative = calcAiNativeInclusive(inputs);
  const cAiManaged = calcAiManagedServices(inputs);
  const cTraditional = calcTraditionalManagedTar(inputs);
  const cHuman = calcHumanReview(inputs);

  const deliveryModels: DeliveryModel[] = [
    {
      id: 'raw_api',
      label: 'Raw API processing',
      description: 'Direct foundation model API access. No QC, no infrastructure.',
      cost: cRawApi,
      timeDescription: tRawApi.description,
      whatsIncluded: 'Classification only',
      flag: flagRawApi(inputs),
      primarySourceId: 'LEGALHACK_FOUNDATION',
    },
    {
      id: 'platform_bundled',
      label: 'Platform-bundled AI',
      description: 'Relativity aiR, Everlaw AI, DISCO Cecilia. AI included in base platform pricing.',
      cost: cPlatform,
      timeDescription: tAi.description,
      whatsIncluded: 'AI review + standard hosting + production tooling. No managed QC.',
      flag: flagPlatformBundled(inputs),
      primarySourceId: 'PLATINUM_IDS_2026',
    },
    {
      id: 'ai_native_inclusive',
      label: 'AI-native all-inclusive',
      description: 'Single per-GB-month price (DecoverAI tier). Workflow bundled.',
      cost: cAiNative,
      timeDescription: tAi.description,
      whatsIncluded: 'Hosting + AI review + privilege log + Bates + production + SOC 2',
      flag: flagAiNativeInclusive(inputs),
      primarySourceId: 'DECOVER_AI_2026',
    },
    {
      id: 'ai_managed_services',
      label: 'AI-augmented managed services',
      description: 'Epiq, Lighthouse, Consilio, FTI. AI plus human QC and project management.',
      cost: cAiManaged,
      timeDescription: tAi.description,
      whatsIncluded: 'AI review + human QC + privilege log + project management + defensibility',
      flag: flagAiManagedServices(inputs),
      primarySourceId: 'LEGALHACK_MSP',
    },
    {
      id: 'traditional_managed_tar',
      label: 'Traditional managed review (TAR)',
      description: 'Predictive coding plus human first-pass review. The judicially-tested baseline.',
      cost: cTraditional,
      timeDescription: tTar.description,
      whatsIncluded: 'TAR + human review + privilege + production + heavy PM',
      flag: flagTraditionalManagedTarWithTime(inputs, tTar),
      primarySourceId: 'EDRM_2024',
    },
    {
      id: 'human_review',
      label: 'Pure human contract review',
      description: 'Contract attorneys reviewing the full corpus. The displaced baseline.',
      cost: cHuman,
      timeDescription: tHuman.description,
      whatsIncluded: 'Human-coded responsiveness + privilege + production',
      flag: flagHumanReview(inputs, tHuman),
      primarySourceId: 'EDISCOVERY_AI_2024',
    },
  ];

  // ---- Layered breakdown — modern AI managed services ----
  const modernPmHours = scaledPmHours(inputs.documentCount);
  const modernItems: LineItem[] = [
    {
      label: `Hosting (${inputs.hostingMonths} months × ${formatGB(inputs.gigabytes)})`,
      formula: `${formatRange(PER_GB_RATES.hostingMidTier, '$/GB/mo')} × ${formatGB(inputs.gigabytes)} × ${inputs.hostingMonths} mo`,
      cost: multiplyRangeNum(multiplyRange(PER_GB_RATES.hostingMidTier, inputs.gigabytes), inputs.hostingMonths),
      sourceId: 'DECOVER_AI_2026',
    },
    {
      label: `AI review across full corpus (${formatNumber(inputs.documentCount)} docs)`,
      formula: `${formatRange(PER_DOC_RATES.genaiAssistedReview, '$/doc')} × ${formatNumber(inputs.documentCount)} docs`,
      cost: multiplyRange(PER_DOC_RATES.genaiAssistedReview, inputs.documentCount),
      sourceId: 'WINTER_2026_SURVEY',
    },
  ];
  if (inputs.privilegeRequired) {
    // Privilege QC at human rates on 5% of the privileged population — exception resolution.
    const qcDocs = inputs.documentCount * inputs.privilegeFraction * 0.05;
    modernItems.push({
      label: `Privilege QC (5% of privileged population, ${formatNumber(qcDocs)} docs)`,
      formula: `${formatRange(PER_DOC_RATES.humanPrivilegeReview, '$/doc')} × ${formatNumber(qcDocs)} docs (privilege log itself bundled into AI review rate)`,
      cost: multiplyRange(PER_DOC_RATES.humanPrivilegeReview, qcDocs),
      sourceId: 'DECOVER_AI_2026',
    });
  }
  modernItems.push({
    label: `Project management (${modernPmHours} hrs, scaled with volume)`,
    formula: `${formatRange(OTHER_RATES.projectManagementPerHour, '$/hr')} × ${modernPmHours} hrs (1 hr per ~3,000 docs, 40-hr floor)`,
    cost: multiplyRange(OTHER_RATES.projectManagementPerHour, modernPmHours),
    sourceId: 'WINTER_2026_SURVEY',
  });

  // ---- Layered breakdown — traditional configuration ----
  const traditionalPmHours = Math.ceil(scaledPmHours(inputs.documentCount) * 1.5);
  const tradProductionRate = productionRate(inputs.matterType);
  const traditionalItems: LineItem[] = [
    {
      label: `Hosting (full-service, ${inputs.hostingMonths} months)`,
      formula: `${formatRange(PER_GB_RATES.hostingFullService, '$/GB/mo')} × ${formatGB(inputs.gigabytes)} × ${inputs.hostingMonths} mo`,
      cost: multiplyRangeNum(multiplyRange(PER_GB_RATES.hostingFullService, inputs.gigabytes), inputs.hostingMonths),
      sourceId: 'DECOVER_AI_2026',
    },
    {
      label: `Processing (${formatGB(inputs.gigabytes)})`,
      formula: `${formatRange(PER_GB_RATES.processingLegacy, '$/GB')} × ${formatGB(inputs.gigabytes)}`,
      cost: multiplyRange(PER_GB_RATES.processingLegacy, inputs.gigabytes),
      sourceId: 'DISCOVER_LEX_2026',
    },
    {
      label: `Human responsiveness review (${formatNumber(inputs.documentCount * 0.4)} docs after TAR cull)`,
      formula: `${formatRange(PER_DOC_RATES.humanResponsivenessFirstPass, '$/doc')} × ${formatNumber(inputs.documentCount * 0.4)} docs`,
      cost: multiplyRange(PER_DOC_RATES.humanResponsivenessFirstPass, inputs.documentCount * 0.4),
      sourceId: 'WINTER_2026_SURVEY',
    },
  ];
  if (inputs.privilegeRequired) {
    const privDocs = inputs.documentCount * inputs.privilegeFraction;
    traditionalItems.push({
      label: `Human privilege review (${formatNumber(privDocs)} docs)`,
      formula: `${formatRange(PER_DOC_RATES.humanPrivilegeReview, '$/doc')} × ${formatNumber(privDocs)} docs`,
      cost: multiplyRange(PER_DOC_RATES.humanPrivilegeReview, privDocs),
      sourceId: 'DECOVER_AI_2026',
    });
  }
  if (tradProductionRate > 0) {
    const producedPages = inputs.documentCount * tradProductionRate * DEFAULTS.pagesPerDoc;
    traditionalItems.push({
      label: `Production (${formatNumber(producedPages)} pages, ${(tradProductionRate * 100).toFixed(0)}% of corpus Bates-stamped)`,
      formula: `${formatRange(OTHER_RATES.productionPerPage, '$/page')} × ${formatNumber(producedPages)} pages`,
      cost: multiplyRange(OTHER_RATES.productionPerPage, producedPages),
      sourceId: 'DECOVER_AI_2026',
    });
  }
  traditionalItems.push({
    label: `Project management (${traditionalPmHours} hrs, scaled with volume)`,
    formula: `${formatRange(OTHER_RATES.projectManagementPerHour, '$/hr')} × ${traditionalPmHours} hrs (1.5× modern PM scaling for human reviewer coordination)`,
    cost: multiplyRange(OTHER_RATES.projectManagementPerHour, traditionalPmHours),
    sourceId: 'WINTER_2026_SURVEY',
  });

  const layered: LayeredBreakdown = {
    modernManaged: {
      items: modernItems,
      total: addRanges(...modernItems.map((i) => i.cost)),
    },
    traditional: {
      items: traditionalItems,
      total: addRanges(...traditionalItems.map((i) => i.cost)),
    },
  };

  // ---- Editorial summary ----
  // Compare only the models that are "real" procurement options:
  // - Filter out red-flagged models (not appropriate for the matter).
  // - Filter out raw_api specifically: it lacks the QC/defensibility layer that
  //   makes other models comparable, so including it produces misleading 50–100x
  //   spread numbers. Users see raw API in the table; just not in the headline.
  const candidates = deliveryModels.filter((m) => m.flag.level !== 'red' && m.id !== 'raw_api');
  const sorted = [...candidates].sort((a, b) => midpoint(a.cost) - midpoint(b.cost));

  // Empty-state and degenerate-input handling.
  // - If document count is zero, nothing to summarize.
  // - If fewer than 2 candidates, no meaningful spread.
  // - If cheapest midpoint is below $5,000, the spread comparison is misleading
  //   (small matters have inherently noisy cost ratios from fixed PM overhead).
  const isDegenerate =
    inputs.documentCount === 0 ||
    sorted.length < 2 ||
    midpoint(sorted[0].cost) < 5_000;

  // ---- Budget worksheet — unified line items with overrides ----
  const budget = buildBudgetWorksheet(inputs, overrides, enabledItems);

  return {
    inputs,
    deliveryModels,
    layered,
    budget,
    summary: isDegenerate
      ? null
      : {
          cheapestTotal: sorted[0].cost,
          costliestTotal: sorted[sorted.length - 1].cost,
          cheapestLabel: sorted[0].label,
          costliestLabel: sorted[sorted.length - 1].label,
          spreadMultiplier: midpoint(sorted[sorted.length - 1].cost) / midpoint(sorted[0].cost),
        },
  };
}

// ---------------------------------------------------------------------------
// Budget worksheet builder
// ---------------------------------------------------------------------------

function buildBudgetLineItem(
  lineItemId: LineItemId,
  label: string,
  benchmarkRate: PricedRange,
  overrideValue: number | undefined,
  quantity: number,
  rateKey: keyof RateOverrides,
  sourceId: string,
  enabled: boolean,
): BudgetLineItem {
  const rate = resolveRate(benchmarkRate, overrideValue);
  const cost = multiplyRange(rate, quantity);
  const benchmarkCost = multiplyRange(benchmarkRate, quantity);
  const isOverridden = overrideValue !== undefined;
  return {
    lineItemId,
    label,
    formula: `${formatRange(rate, benchmarkRate.unit)} × ${formatNumber(quantity)} ${benchmarkRate.unit.replace(/^\$\//, '')}`,
    cost,
    sourceId,
    rateKey,
    benchmarkCost: isOverridden ? benchmarkCost : undefined,
    isOverridden,
    rateUnit: benchmarkRate.unit,
    quantity,
    enabled,
  };
}

function buildBudgetWorksheet(
  inputs: MatterInputs,
  overrides: RateOverrides,
  enabledItems?: Set<LineItemId>,
): BudgetWorksheetOutput {
  const isOn = (id: LineItemId) => enabledItems ? enabledItems.has(id) : true;
  const tarCull = overrides.tarCullFraction ?? 0.6;
  const privQcFraction = overrides.privilegeQcFraction ?? 0.05;
  const pmMultiplier = overrides.pmScalingMultiplier ?? 1.0;
  const pmHours = Math.ceil(scaledPmHours(inputs.documentCount) * pmMultiplier);

  const items: BudgetLineItem[] = [];

  // Hosting
  const hostingQty = inputs.gigabytes * inputs.hostingMonths;
  items.push(buildBudgetLineItem(
    'hosting',
    `Hosting (${inputs.hostingMonths} mo × ${formatGB(inputs.gigabytes)})`,
    PER_GB_RATES.hostingMidTier,
    overrides.hosting,
    hostingQty,
    'hosting',
    'DECOVER_AI_2026',
    isOn('hosting'),
  ));

  // Processing
  items.push(buildBudgetLineItem(
    'processing',
    `Processing (${formatGB(inputs.gigabytes)})`,
    PER_GB_RATES.processingLegacy,
    overrides.processingLegacy,
    inputs.gigabytes,
    'processingLegacy',
    'DISCOVER_LEX_2026',
    isOn('processing'),
  ));

  // AI review
  items.push(buildBudgetLineItem(
    'aiReview',
    `AI review (${formatNumber(inputs.documentCount)} docs)`,
    PER_DOC_RATES.genaiAssistedReview,
    overrides.genaiAssistedReview,
    inputs.documentCount,
    'genaiAssistedReview',
    'WINTER_2026_SURVEY',
    isOn('aiReview'),
  ));

  // Human responsiveness review (quantity depends on TAR cull assumption)
  const humanReviewDocs = inputs.documentCount * (1 - tarCull);
  const isAiWorkflow = isOn('aiReview') && !isOn('humanReview');
  const humanReviewDefaultStaffing = isAiWorkflow
    ? defaultAiStaffing(inputs.documentCount)
    : defaultTraditionalStaffing(humanReviewDocs);
  const humanReviewStaffingOverride = overrides.staffing?.humanReview;
  const humanReviewUseStaffing = !!humanReviewStaffingOverride;
  const humanReviewItem = buildBudgetLineItem(
    'humanReview',
    `Human responsiveness review (${formatNumber(humanReviewDocs)} docs after ${(tarCull * 100).toFixed(0)}% TAR cull)`,
    PER_DOC_RATES.humanResponsivenessFirstPass,
    humanReviewUseStaffing ? undefined : overrides.humanResponsivenessFirstPass,
    humanReviewDocs,
    'humanResponsivenessFirstPass',
    'WINTER_2026_SURVEY',
    isOn('humanReview'),
  );
  humanReviewItem.hasStaffing = true;
  humanReviewItem.defaultStaffing = humanReviewDefaultStaffing;
  humanReviewItem.staffingOverride = humanReviewStaffingOverride;
  humanReviewItem.useStaffingCost = humanReviewUseStaffing;
  if (humanReviewUseStaffing) {
    const total = staffingTotal(humanReviewStaffingOverride);
    humanReviewItem.cost = { low: total, high: total };
    humanReviewItem.isOverridden = true;
  }
  items.push(humanReviewItem);

  // Human privilege review — quantity depends on preset context
  const privDocs = inputs.privilegeRequired
    ? (isOn('aiReview') && !isOn('humanReview'))
      ? inputs.documentCount * inputs.privilegeFraction * privQcFraction
      : inputs.documentCount * inputs.privilegeFraction
    : 0;
  const privStaffingOverride = overrides.staffing?.humanPrivilege;
  const privUseStaffing = !!privStaffingOverride;
  const privItem = buildBudgetLineItem(
    'humanPrivilege',
    inputs.privilegeRequired
      ? (isOn('aiReview') && !isOn('humanReview'))
        ? `Privilege QC (${(privQcFraction * 100).toFixed(0)}% of privileged, ${formatNumber(privDocs)} docs)`
        : `Human privilege review (${formatNumber(privDocs)} docs)`
      : 'Human privilege review (not required)',
    PER_DOC_RATES.humanPrivilegeReview,
    privUseStaffing ? undefined : overrides.humanPrivilegeReview,
    privDocs,
    'humanPrivilegeReview',
    'DECOVER_AI_2026',
    isOn('humanPrivilege') && inputs.privilegeRequired,
  );
  privItem.hasStaffing = true;
  privItem.defaultStaffing = defaultTraditionalStaffing(privDocs);
  privItem.staffingOverride = privStaffingOverride;
  privItem.useStaffingCost = privUseStaffing;
  if (privUseStaffing) {
    const total = staffingTotal(privStaffingOverride);
    privItem.cost = { low: total, high: total };
    privItem.isOverridden = true;
  }
  items.push(privItem);

  // Production
  const tradProductionRate = productionRate(inputs.matterType);
  const producedPages = inputs.documentCount * tradProductionRate * DEFAULTS.pagesPerDoc;
  items.push(buildBudgetLineItem(
    'production',
    tradProductionRate > 0
      ? `Production (${formatNumber(producedPages)} pages, ${(tradProductionRate * 100).toFixed(0)}% Bates-stamped)`
      : 'Production (none for this matter type)',
    OTHER_RATES.productionPerPage,
    overrides.productionPerPage,
    producedPages,
    'productionPerPage',
    'DECOVER_AI_2026',
    isOn('production') && tradProductionRate > 0,
  ));

  // Project management
  const pmStaffingOverride = overrides.staffing?.projectManagement;
  const pmUseStaffing = !!pmStaffingOverride;
  const pmItem = buildBudgetLineItem(
    'projectManagement',
    `Project management (${pmHours} hrs)`,
    OTHER_RATES.projectManagementPerHour,
    pmUseStaffing ? undefined : overrides.projectManagementPerHour,
    pmHours,
    'projectManagementPerHour',
    'WINTER_2026_SURVEY',
    isOn('projectManagement'),
  );
  pmItem.hasStaffing = true;
  pmItem.defaultStaffing = defaultPmStaffing(pmHours);
  pmItem.staffingOverride = pmStaffingOverride;
  pmItem.useStaffingCost = pmUseStaffing;
  if (pmUseStaffing) {
    const total = staffingTotal(pmStaffingOverride);
    pmItem.cost = { low: total, high: total };
    pmItem.isOverridden = true;
  }
  items.push(pmItem);

  const enabledCosts = items.filter((i) => i.enabled).map((i) => i.cost);
  const total = enabledCosts.length > 0 ? addRanges(...enabledCosts) : { low: 0, high: 0 };

  const warnings = generateBudgetWarnings(inputs, items, enabledItems);

  return { items, total, warnings };
}

// ---------------------------------------------------------------------------
// Budget warnings — appropriateness flags for the worksheet configuration
// ---------------------------------------------------------------------------

function generateBudgetWarnings(
  inputs: MatterInputs,
  items: BudgetLineItem[],
  enabledItems?: Set<LineItemId>,
): BudgetWarning[] {
  const warnings: BudgetWarning[] = [];
  const on = (id: LineItemId) => items.find((i) => i.lineItemId === id)?.enabled ?? false;

  // Privilege review disabled on a matter that requires it
  if (inputs.privilegeRequired && !on('humanPrivilege')) {
    warnings.push({
      level: 'warning',
      message: 'Privilege review is disabled but this matter requires it. Producing privileged documents can waive privilege.',
      lineItemId: 'humanPrivilege',
    });
  }

  // Adversarial matter with no human QC layer at all
  if (inputs.matterType === 'adversarial' && on('aiReview') && !on('humanReview')) {
    if (inputs.defensibility === 'high') {
      warnings.push({
        level: 'caution',
        message: 'High-defensibility adversarial matter with AI-only review. Consider adding human QC — Rule 26(g) requires a "reasonable inquiry" that courts may interpret as requiring human validation.',
      });
    }
  }

  // Human review enabled — check timeline feasibility
  if (on('humanReview')) {
    const time = enabledItems?.has('aiReview')
      ? timeTraditionalTar(inputs)
      : timeHumanReview(inputs);
    if (!time.feasible) {
      warnings.push({
        level: 'warning',
        message: `Human review requires ~${time.weeksEstimate} weeks with standard staffing, but your timeline is ${inputs.weeks} weeks. Increase staffing or extend the timeline.`,
        lineItemId: 'humanReview',
      });
    }
  }

  // AI review without hosting
  if (on('aiReview') && !on('hosting')) {
    warnings.push({
      level: 'info',
      message: 'AI review typically requires a hosting platform. Confirm your vendor bundles hosting or add it separately.',
      lineItemId: 'hosting',
    });
  }

  // No project management on large matters
  if (!on('projectManagement') && inputs.documentCount > 50_000) {
    warnings.push({
      level: 'caution',
      message: 'No project management on a matter with 50K+ documents. Vendor coordination, QC, and timeline management typically require dedicated PM.',
      lineItemId: 'projectManagement',
    });
  }

  // Post-production / investigation with heavy human review
  if (inputs.matterType === 'post_production' && on('humanReview') && !on('aiReview')) {
    warnings.push({
      level: 'info',
      message: 'Post-production analysis with pure human review is unusually expensive. AI-augmented workflows are typically a better fit when defensibility constraints are lower.',
      lineItemId: 'humanReview',
    });
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// Formatting helpers (used by both calculator output and UI)
// ---------------------------------------------------------------------------

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}K`;
  return Math.round(n).toLocaleString('en-US');
}

export function formatGB(gb: number): string {
  if (gb >= 1000) return `${(gb / 1000).toFixed(1)} TB`;
  return `${gb.toFixed(0)} GB`;
}

export function formatRange(r: PricedRange, unit: string): string {
  if (r.low === r.high) return `$${r.low.toFixed(2)}/${unit.replace('$/', '')}`;
  return `$${r.low}–$${r.high}/${unit.replace('$/', '')}`;
}

export function formatCost(c: CostRange): string {
  const fmt = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
    return `$${Math.round(n).toLocaleString('en-US')}`;
  };
  return `${fmt(c.low)} – ${fmt(c.high)}`;
}

export function formatBudgetAsText(output: CalculatorOutput): string {
  const { inputs, budget } = output;
  const lines: string[] = [];

  lines.push('DOCUMENT REVIEW BUDGET');
  lines.push('═'.repeat(40));
  lines.push('');

  lines.push(`Matter: ${inputs.matterType.replace('_', ' ')} | ${formatNumber(inputs.documentCount)} docs | ${formatGB(inputs.gigabytes)} | ${inputs.weeks} weeks`);
  if (inputs.privilegeRequired) {
    lines.push(`Privilege: ${(inputs.privilegeFraction * 100).toFixed(0)}% of corpus`);
  }
  lines.push('');

  const enabledItems = budget.items.filter((i) => i.enabled);
  const maxLabelLen = Math.max(...enabledItems.map((i) => i.label.length));

  for (const item of enabledItems) {
    const costStr = item.cost.low === item.cost.high
      ? formatCostExact(item.cost.low)
      : formatCost(item.cost);
    const marker = item.isOverridden ? ' *' : '';
    lines.push(`  ${item.label.padEnd(maxLabelLen + 2)}${costStr}${marker}`);
  }

  lines.push('  ' + '─'.repeat(maxLabelLen + 16));
  const totalStr = budget.total.low === budget.total.high
    ? formatCostExact(budget.total.low)
    : formatCost(budget.total);
  lines.push(`  ${'TOTAL'.padEnd(maxLabelLen + 2)}${totalStr}`);

  if (enabledItems.some((i) => i.isOverridden)) {
    lines.push('');
    lines.push('* = customized rate (differs from industry benchmark)');
  }

  if (budget.warnings.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    for (const w of budget.warnings) {
      const prefix = w.level === 'warning' ? '⚠' : w.level === 'caution' ? '△' : 'ℹ';
      lines.push(`  ${prefix} ${w.message}`);
    }
  }

  lines.push('');
  lines.push('Generated by LegalHack Cost Modeler — legalhack.io/cost-modeler');

  return lines.join('\n');
}

function formatCostExact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return `$${Math.round(n).toLocaleString('en-US')}`;
}
