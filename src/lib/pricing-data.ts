/**
 * Pricing Data — Document Review Cost Modeler
 *
 * Every number in this file is sourced. Hover citations in the UI map back to the
 * `source` field on each entry. When the underlying data updates, edit this file
 * and redeploy — no code changes needed.
 *
 * SOURCES
 *   WINTER_2026_SURVEY:  ComplexDiscovery OÜ / EDRM, "Winter 2026 eDiscovery Pricing
 *                        Survey," Feb 2026. 53 practitioners, 15th edition of the
 *                        Pricing Pulse series. Independent and practitioner-reported.
 *                        https://complexdiscovery.com/the-pricing-pulse-document-review-insights-from-the-winter-2026-ediscovery-pricing-survey/
 *   DECOVER_AI_2026:     DecoverAI, "The Real Cost of Document Review: A 2026 Pricing
 *                        Benchmark," 2026. Worked example: 100 GB / 250K docs / 6-month
 *                        review / 15K responsive / 2K privileged.
 *                        https://www.decover.ai/blog/hidden-cost-document-review/
 *   DISCOVER_LEX_2026:   DiscoverLex, "How Much Does eDiscovery Software Cost in 2026?"
 *                        February 20, 2026.
 *                        https://discoverlex.com/blog/ediscovery-cost-guide
 *   DWR_2025:            Digital WarRoom, "How Many Documents in a Gigabyte? 2025
 *                        Statistics for eDiscovery." Sample of 150M docs across 2,000
 *                        hosted matters.
 *                        https://www.digitalwarroom.com/blog/how-many-documents-in-a-gigabyte-2025-statistics-for-ediscovery
 *   GROSSMAN_CORMACK_2011: Grossman & Cormack, "Technology-Assisted Review in E-Discovery
 *                        Can Be More Effective and More Efficient Than Exhaustive Manual
 *                        Review," Richmond Journal of Law & Technology, 2011.
 *                        https://scholarship.richmond.edu/jolt/vol17/iss3/5/
 *   EDRM_2024:           EDRM, "eDiscovery Review in Transition," 2024.
 *                        https://edrm.net/2024/08/ediscovery-review-in-transition-manual-review-tar-and-the-role-of-ai/
 *   PLATINUM_IDS_2026:   Platinum IDS, "The Great eDiscovery Price Reset," 2026.
 *                        https://blog.platinumids.com/blog/ediscovery-pricing-revolution-2026
 *   LEGALHACK_TOOLS:     LegalHack, "The Tools," Feb 2026 (your post)
 *   LEGALHACK_MSP:       LegalHack, "Managed Services Providers," Mar 2026 (your post)
 *   LEGALHACK_FOUNDATION: LegalHack, "The Foundation" (your post — referenced)
 *   EDISCOVERY_AI_2024:  eDiscovery AI, "Cost Analysis: Human Review v. AI Review,"
 *                        Dec 2024. Source for human-review staffing pyramid math.
 *                        https://ediscoveryai.com/cost-analysis-human-review-v-ai-review-how-do-they-compare/
 */

// ---------------------------------------------------------------------------
// Source registry
// ---------------------------------------------------------------------------

export interface Source {
  id: string;
  label: string;
  url: string;
  /** When the underlying data was published or current. */
  asOf: string;
}

export const SOURCES: Record<string, Source> = {
  WINTER_2026_SURVEY: {
    id: 'WINTER_2026_SURVEY',
    label: 'Winter 2026 ComplexDiscovery/EDRM Pricing Survey (53 practitioners)',
    url: 'https://complexdiscovery.com/the-pricing-pulse-document-review-insights-from-the-winter-2026-ediscovery-pricing-survey/',
    asOf: 'Feb 2026',
  },
  DECOVER_AI_2026: {
    id: 'DECOVER_AI_2026',
    label: 'DecoverAI 2026 Pricing Benchmark (worked example: 100GB / 250K docs)',
    url: 'https://www.decover.ai/blog/hidden-cost-document-review/',
    asOf: '2026',
  },
  DISCOVER_LEX_2026: {
    id: 'DISCOVER_LEX_2026',
    label: 'DiscoverLex 2026 eDiscovery Pricing Guide',
    url: 'https://discoverlex.com/blog/ediscovery-cost-guide',
    asOf: 'Feb 2026',
  },
  DWR_2025: {
    id: 'DWR_2025',
    label: 'Digital WarRoom 2025 Statistics (150M docs / 2,000 matters)',
    url: 'https://www.digitalwarroom.com/blog/how-many-documents-in-a-gigabyte-2025-statistics-for-ediscovery',
    asOf: '2025',
  },
  GROSSMAN_CORMACK_2011: {
    id: 'GROSSMAN_CORMACK_2011',
    label: 'Grossman & Cormack, Richmond JOLT (2011) — foundational TAR study',
    url: 'https://scholarship.richmond.edu/jolt/vol17/iss3/5/',
    asOf: '2011',
  },
  EDRM_2024: {
    id: 'EDRM_2024',
    label: 'EDRM, "eDiscovery Review in Transition" (2024)',
    url: 'https://edrm.net/2024/08/ediscovery-review-in-transition-manual-review-tar-and-the-role-of-ai/',
    asOf: '2024',
  },
  PLATINUM_IDS_2026: {
    id: 'PLATINUM_IDS_2026',
    label: 'Platinum IDS, "The Great eDiscovery Price Reset" (2026)',
    url: 'https://blog.platinumids.com/blog/ediscovery-pricing-revolution-2026',
    asOf: '2026',
  },
  LEGALHACK_TOOLS: {
    id: 'LEGALHACK_TOOLS',
    label: 'LegalHack, "The Tools"',
    url: 'https://legalhack.io',
    asOf: 'Feb 2026',
  },
  LEGALHACK_MSP: {
    id: 'LEGALHACK_MSP',
    label: 'LegalHack, "Managed Services Providers"',
    url: 'https://legalhack.io',
    asOf: 'Mar 2026',
  },
  LEGALHACK_FOUNDATION: {
    id: 'LEGALHACK_FOUNDATION',
    label: 'LegalHack, "The Foundation"',
    url: 'https://legalhack.io',
    asOf: '2026',
  },
  EDISCOVERY_AI_2024: {
    id: 'EDISCOVERY_AI_2024',
    label: 'eDiscovery AI, "Cost Analysis: Human Review v. AI Review" (2024)',
    url: 'https://ediscoveryai.com/cost-analysis-human-review-v-ai-review-how-do-they-compare/',
    asOf: 'Dec 2024',
  },
};

// ---------------------------------------------------------------------------
// Rate types
// ---------------------------------------------------------------------------

export interface PricedRange {
  low: number;
  high: number;
  unit: string;
  source: keyof typeof SOURCES;
  note?: string;
}

// ---------------------------------------------------------------------------
// Per-document rates
// ---------------------------------------------------------------------------

export const PER_DOC_RATES = {
  rawApi: {
    low: 0.01,
    high: 0.05,
    unit: '$/doc',
    source: 'LEGALHACK_FOUNDATION',
    note: 'Mid-tier foundation model API cost. No QC, no defensibility, no infrastructure.',
  } satisfies PricedRange,

  genaiAssistedReview: {
    low: 0.11,
    high: 0.50,
    unit: '$/doc',
    source: 'WINTER_2026_SURVEY',
    note: 'Per-document model is ~28% of the GenAI review market; ~28% use hybrid models. Pricing has not yet converged.',
  } satisfies PricedRange,

  humanResponsivenessFirstPass: {
    low: 1.00,
    high: 3.00,
    unit: '$/doc',
    source: 'WINTER_2026_SURVEY',
    note: 'Traditional contract-attorney review, first-pass responsiveness coding.',
  } satisfies PricedRange,

  humanPrivilegeReview: {
    low: 4.00,
    high: 8.00,
    unit: '$/doc',
    source: 'DECOVER_AI_2026',
    note: 'Privilege review is more expensive than responsiveness because it requires legal judgment.',
  } satisfies PricedRange,
};

// ---------------------------------------------------------------------------
// Per-GB rates (hosting, processing, all-inclusive)
// ---------------------------------------------------------------------------

export const PER_GB_RATES = {
  hostingSelfServe: {
    low: 5,
    high: 5,
    unit: '$/GB/mo',
    source: 'DECOVER_AI_2026',
    note: 'Self-serve platforms with minimal project management.',
  } satisfies PricedRange,

  hostingMidTier: {
    low: 10,
    high: 25,
    unit: '$/GB/mo',
    source: 'DECOVER_AI_2026',
  } satisfies PricedRange,

  hostingFullService: {
    low: 25,
    high: 40,
    unit: '$/GB/mo',
    source: 'DECOVER_AI_2026',
    note: 'Full-service Relativity hosting bundled with project management.',
  } satisfies PricedRange,

  processingLegacy: {
    low: 3,
    high: 10,
    unit: '$/GB',
    source: 'DISCOVER_LEX_2026',
    note: 'Per-GB processing fee charged separately under legacy line-item pricing.',
  } satisfies PricedRange,

  platformVolumeBased: {
    low: 15,
    high: 30,
    unit: '$/GB',
    source: 'DISCOVER_LEX_2026',
    note: 'Volume-based platform pricing for review and production (Relativity, Everlaw, DISCO).',
  } satisfies PricedRange,

  aiNativeAllInclusive: {
    low: 60,
    high: 60,
    unit: '$/GB/mo',
    source: 'DECOVER_AI_2026',
    note: 'All-in: ingestion, OCR, dedup, AI review, Bates numbering, redaction, privilege log, production, SOC 2 hosting. DecoverAI is the published reference; other AI-native vendors price comparably.',
  } satisfies PricedRange,
};

// ---------------------------------------------------------------------------
// Other line items
// ---------------------------------------------------------------------------

export const OTHER_RATES = {
  productionPerPage: {
    low: 0.05,
    high: 0.15,
    unit: '$/page',
    source: 'DECOVER_AI_2026',
    note: 'Per-page Bates-stamping and TIFF conversion fees on legacy platforms.',
  } satisfies PricedRange,

  projectManagementPerHour: {
    low: 200,
    high: 300,
    unit: '$/hr',
    source: 'WINTER_2026_SURVEY',
    note: '26.4% of providers report >$200/hr project management rates in the Winter 2026 survey.',
  } satisfies PricedRange,

  perSeatLicense: {
    low: 50,
    high: 100,
    unit: '$/user/mo',
    source: 'WINTER_2026_SURVEY',
    note: 'Most-cited tier (41.5% of respondents). 34% of providers now use alternative pricing models.',
  } satisfies PricedRange,

  egressFee: {
    low: 25,
    high: 100,
    unit: '$/GB',
    source: 'DECOVER_AI_2026',
    note: 'Charged by some legacy vendors to release client data when switching platforms. Modern platforms typically waive this.',
  } satisfies PricedRange,
};

// ---------------------------------------------------------------------------
// Throughput
// ---------------------------------------------------------------------------

export interface Throughput {
  perHour: { low: number; high: number };
  source: keyof typeof SOURCES;
  note?: string;
}

export const THROUGHPUT = {
  humanReview: {
    perHour: { low: 40, high: 50 },
    source: 'LEGALHACK_MSP',
    note: 'Per reviewer. Faster reviewers compensate for slower; complex tagging slows the rate.',
  } satisfies Throughput,

  genaiAssisted: {
    perHour: { low: 25_000, high: 500_000 },
    source: 'LEGALHACK_MSP',
    note: 'DISCO Cecilia: ~25K/hr. Epiq AI for Review: up to 500K/hr.',
  } satisfies Throughput,
};

// ---------------------------------------------------------------------------
// GB ↔ docs conversion
// ---------------------------------------------------------------------------

export interface CorpusMix {
  id: 'mixed' | 'email-heavy' | 'loose-files';
  label: string;
  docsPerGb: number;
  description: string;
  source: keyof typeof SOURCES;
}

export const CORPUS_MIXES: Record<CorpusMix['id'], CorpusMix> = {
  mixed: {
    id: 'mixed',
    label: 'Mixed corpus (default)',
    docsPerGb: 7_500,
    description: 'Equal mix of email and other documents — the typical mid-size matter.',
    source: 'DWR_2025',
  },
  'email-heavy': {
    id: 'email-heavy',
    label: 'Email-heavy',
    docsPerGb: 10_000,
    description: 'Email plus attachments dominate the corpus (~100 KB per item).',
    source: 'DWR_2025',
  },
  'loose-files': {
    id: 'loose-files',
    label: 'Loose files',
    docsPerGb: 5_000,
    description: 'Word/Excel/PDF files dominate (~200 KB per item).',
    source: 'DWR_2025',
  },
};

// ---------------------------------------------------------------------------
// Recall benchmarks (informational, not used in cost math)
// ---------------------------------------------------------------------------

export interface RecallBenchmark {
  method: string;
  recallLow: number;
  recallHigh: number;
  source: keyof typeof SOURCES;
  note?: string;
}

export const RECALL_BENCHMARKS: RecallBenchmark[] = [
  {
    method: 'Manual (human) review',
    recallLow: 60,
    recallHigh: 70,
    source: 'GROSSMAN_CORMACK_2011',
    note: 'Even a hypothetical perfect human assessor reaches only ~70% recall. Roughly one in three relevant documents missed entirely.',
  },
  {
    method: 'TAR 1.0 (batch training)',
    recallLow: 75,
    recallHigh: 80,
    source: 'EDRM_2024',
  },
  {
    method: 'TAR 2.0 / CAL',
    recallLow: 85,
    recallHigh: 95,
    source: 'EDRM_2024',
  },
  {
    method: 'GenAI-assisted review',
    recallLow: 90,
    recallHigh: 98,
    source: 'EDRM_2024',
    note: 'Vendor-reported. Independent benchmarking at the rigor of the TREC Legal Track studies has not yet caught up.',
  },
];

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULTS = {
  /** Default matter size — matches DecoverAI worked example. */
  documentCount: 250_000,

  /** Default review timeline. */
  weeks: 24,

  /** Default privilege population as a fraction of total documents. User-editable. */
  privilegeFraction: 0.08,

  /** Hosting time = matter timeline + this many additional months. User-editable. */
  hostingMonthsAfterMatter: 6,

  /**
   * Default human review staffing for time calculations.
   * Source: eDiscovery AI 2024 worked example uses 25 reviewers as the standard mid-size
   * staffing assumption. Used only for "is this delivery model feasible in time" checks.
   */
  humanReviewers: 25,
  humanWorkWeekHours: 40,
  qcOverheadFraction: 0.10,

  /**
   * Default project management hours assumed per matter, used in the layered breakdown.
   * 80 hours is a reasonable mid-size matter assumption; large matters scale higher.
   */
  projectManagementHours: 80,

  /**
   * Pages per document for production cost estimation.
   * Average of ~7 pages per document is a commonly used mid-market assumption.
   */
  pagesPerDoc: 7,
} as const;
