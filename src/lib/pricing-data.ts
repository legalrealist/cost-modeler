// ---------------------------------------------------------------------------
// AI processing rates (per document)
//
// Sources: Winter 2026 ComplexDiscovery/EDRM Pricing Survey, DecoverAI 2026
// Benchmark, Platinum IDS 2026. See README for full citation list.
// ---------------------------------------------------------------------------

export const AI_PROCESSING_RATES = {
  initial: 0.15,
  privilege: 0.35,
  privilegeLog: 0.50,
  keyDocId: 0.50,
};

// ---------------------------------------------------------------------------
// GB ↔ docs conversion
//
// Source: Digital WarRoom 2025, sample of 150M docs across 2,000 matters.
// ---------------------------------------------------------------------------

export interface CorpusMix {
  id: 'mixed' | 'email-heavy' | 'loose-files';
  label: string;
  docsPerGb: number;
  description: string;
}

export const CORPUS_MIXES: Record<CorpusMix['id'], CorpusMix> = {
  mixed: {
    id: 'mixed',
    label: 'Mixed corpus (default)',
    docsPerGb: 7_500,
    description: 'Equal mix of email and other documents — the typical mid-size matter.',
  },
  'email-heavy': {
    id: 'email-heavy',
    label: 'Email-heavy',
    docsPerGb: 10_000,
    description: 'Email plus attachments dominate the corpus (~100 KB per item).',
  },
  'loose-files': {
    id: 'loose-files',
    label: 'Loose files',
    docsPerGb: 5_000,
    description: 'Word/Excel/PDF files dominate (~200 KB per item).',
  },
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULTS = {
  documentCount: 250_000,
  weeks: 24,
  privilegeFraction: 0.08,
  hostingMonthsAfterMatter: 6,
  humanReviewers: 25,
  humanWorkWeekHours: 40,
} as const;
