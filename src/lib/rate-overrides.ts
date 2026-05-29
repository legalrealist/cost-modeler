import type { PricedRange } from './pricing-data';

// ---------------------------------------------------------------------------
// Line item IDs — the canonical set of budget line items
// ---------------------------------------------------------------------------

export const LINE_ITEM_IDS = [
  'hosting',
  'processing',
  'aiReview',
  'humanReview',
  'humanPrivilege',
  'production',
  'projectManagement',
] as const;

export type LineItemId = (typeof LINE_ITEM_IDS)[number];

// ---------------------------------------------------------------------------
// Workflow presets — convenience configurations that toggle line items
// ---------------------------------------------------------------------------

export type WorkflowPreset = 'modern' | 'traditional';

export const PRESET_ENABLED_ITEMS: Record<WorkflowPreset, Set<LineItemId>> = {
  modern: new Set([
    'hosting',
    'aiReview',
    'humanPrivilege',
    'projectManagement',
  ]),
  traditional: new Set([
    'hosting',
    'processing',
    'humanReview',
    'humanPrivilege',
    'production',
    'projectManagement',
  ]),
};

// ---------------------------------------------------------------------------
// Staffing roles
// ---------------------------------------------------------------------------

export const STAFFING_ROLES = [
  'contractAttorney',
  'juniorAssociate',
  'seniorAssociate',
  'partner',
] as const;

export type StaffingRole = (typeof STAFFING_ROLES)[number];

export const STAFFING_ROLE_LABELS: Record<StaffingRole, string> = {
  contractAttorney: 'Contract Attorney',
  juniorAssociate: 'Junior Associate',
  seniorAssociate: 'Senior Associate',
  partner: 'Partner',
};

export interface StaffingRow {
  role: StaffingRole;
  hours: number;
  rate: number;
}

export interface StaffingDefaults {
  rows: StaffingRow[];
}

/** Default hourly rates by role (from legal_cost_comp — do not change). */
export const DEFAULT_ROLE_RATES: Record<StaffingRole, number> = {
  contractAttorney: 50,
  juniorAssociate: 750,
  seniorAssociate: 1000,
  partner: 1500,
};

/**
 * Task hours from legal_cost_comp at a 100K-doc baseline.
 * These scale linearly with doc count.
 */
const BASE_DOC_COUNT = 100_000;

const TRADITIONAL_TASK_HOURS = {
  initialReview: 1000,
  secondLevelReview: 800,
  privilegeReview: 100,
  secondLevelPrivilegeReview: 333,
  privilegeLogDrafting: 100,
  secondLevelPrivilegeLogDrafting: 167,
  keyDocIdentification: 160,
  secondLevelKeyDocIdentification: 80,
};

const AI_TASK_HOURS = {
  secondLevelReview: 800,
  secondLevelPrivilegeReview: 333,
  secondLevelPrivilegeLogDrafting: 167,
  secondLevelKeyDocIdentification: 80,
};

const AI_EFFICIENCY_REDUCTION = 0.75;

function scaleHours(baseHours: number, docCount: number): number {
  return Math.ceil(baseHours * (docCount / BASE_DOC_COUNT));
}

/**
 * Default staffing for human responsiveness review — traditional workflow.
 * Uses legal_cost_comp's exact role allocation scaled to doc count.
 */
export function defaultTraditionalStaffing(docCount: number): StaffingRow[] {
  const t = TRADITIONAL_TASK_HOURS;
  return [
    {
      role: 'contractAttorney',
      hours: scaleHours(t.initialReview + t.privilegeReview + t.privilegeLogDrafting, docCount),
      rate: DEFAULT_ROLE_RATES.contractAttorney,
    },
    {
      role: 'juniorAssociate',
      hours: scaleHours(
        (t.secondLevelReview + t.secondLevelPrivilegeReview + t.secondLevelPrivilegeLogDrafting + t.secondLevelKeyDocIdentification) * 0.5,
        docCount,
      ),
      rate: DEFAULT_ROLE_RATES.juniorAssociate,
    },
    {
      role: 'seniorAssociate',
      hours: scaleHours(
        (t.secondLevelReview + t.secondLevelPrivilegeReview + t.secondLevelPrivilegeLogDrafting + t.keyDocIdentification + t.secondLevelKeyDocIdentification) * 0.5,
        docCount,
      ),
      rate: DEFAULT_ROLE_RATES.seniorAssociate,
    },
    {
      role: 'partner',
      hours: scaleHours(t.keyDocIdentification * 0.5, docCount),
      rate: DEFAULT_ROLE_RATES.partner,
    },
  ];
}

/**
 * Default staffing for AI-enhanced workflow.
 * Contract attorneys replaced by AI; remaining roles get 25% efficiency gain.
 */
export function defaultAiStaffing(docCount: number): StaffingRow[] {
  const a = AI_TASK_HOURS;
  const secondLevelTotal = a.secondLevelReview + a.secondLevelPrivilegeReview + a.secondLevelPrivilegeLogDrafting + a.secondLevelKeyDocIdentification;
  return [
    {
      role: 'contractAttorney',
      hours: 0,
      rate: DEFAULT_ROLE_RATES.contractAttorney,
    },
    {
      role: 'juniorAssociate',
      hours: scaleHours(secondLevelTotal * 0.5 * AI_EFFICIENCY_REDUCTION, docCount),
      rate: DEFAULT_ROLE_RATES.juniorAssociate,
    },
    {
      role: 'seniorAssociate',
      hours: scaleHours(secondLevelTotal * 0.5 * AI_EFFICIENCY_REDUCTION, docCount),
      rate: DEFAULT_ROLE_RATES.seniorAssociate,
    },
    {
      role: 'partner',
      hours: scaleHours(a.secondLevelKeyDocIdentification * 0.5, docCount),
      rate: DEFAULT_ROLE_RATES.partner,
    },
  ];
}

/**
 * Default staffing for project management.
 * PM doesn't have a role breakdown in legal_cost_comp, so we use a
 * reasonable proportional split with the correct rates.
 */
export function defaultPmStaffing(pmHours: number): StaffingRow[] {
  return [
    { role: 'contractAttorney', hours: 0, rate: DEFAULT_ROLE_RATES.contractAttorney },
    { role: 'juniorAssociate', hours: Math.ceil(pmHours * 0.3), rate: DEFAULT_ROLE_RATES.juniorAssociate },
    { role: 'seniorAssociate', hours: Math.ceil(pmHours * 0.5), rate: DEFAULT_ROLE_RATES.seniorAssociate },
    { role: 'partner', hours: Math.ceil(pmHours * 0.2), rate: DEFAULT_ROLE_RATES.partner },
  ];
}

export function staffingTotal(rows: StaffingRow[]): number {
  return rows.reduce((sum, r) => sum + r.hours * r.rate, 0);
}

export function staffingTotalHours(rows: StaffingRow[]): number {
  return rows.reduce((sum, r) => sum + r.hours, 0);
}

// ---------------------------------------------------------------------------
// Rate overrides — user-supplied values that replace benchmark rates
// ---------------------------------------------------------------------------

/** Per-line-item staffing overrides. Each is an array of {role, hours, rate}. */
export interface StaffingOverridesMap {
  humanReview?: StaffingRow[];
  humanPrivilege?: StaffingRow[];
  projectManagement?: StaffingRow[];
}

export interface RateOverrides {
  // Per-doc rates
  genaiAssistedReview?: number;
  humanResponsivenessFirstPass?: number;
  humanPrivilegeReview?: number;

  // Per-GB rates
  hosting?: number;
  processingLegacy?: number;

  // Other
  projectManagementPerHour?: number;
  productionPerPage?: number;

  // Assumption overrides
  tarCullFraction?: number;
  privilegeQcFraction?: number;
  pmScalingMultiplier?: number;

  // Per-line-item staffing drill-down
  staffing?: StaffingOverridesMap;
}

// ---------------------------------------------------------------------------
// Budget state — everything the worksheet needs
// ---------------------------------------------------------------------------

export interface BudgetState {
  preset: WorkflowPreset;
  enabledItems: Set<LineItemId>;
  overrides: RateOverrides;
}

export const DEFAULT_BUDGET_STATE: BudgetState = {
  preset: 'modern',
  enabledItems: new Set(PRESET_ENABLED_ITEMS.modern),
  overrides: {},
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a rate: if the user provided an override, collapse the range to
 * that single number; otherwise return the benchmark range unchanged.
 */
export function resolveRate(benchmark: PricedRange, override?: number): PricedRange {
  if (override === undefined) return benchmark;
  return { ...benchmark, low: override, high: override };
}

/**
 * Midpoint of a PricedRange — used as the default pre-fill value when
 * the user clicks to edit a benchmark rate.
 */
export function benchmarkMidpoint(rate: PricedRange): number {
  return (rate.low + rate.high) / 2;
}

/**
 * Check whether any overrides have been set (i.e., budget has been customized).
 */
export function hasOverrides(overrides: RateOverrides): boolean {
  return Object.values(overrides).some(
    (v) => v !== undefined && (typeof v !== 'object' || Object.values(v).some((sv) => sv !== undefined))
  );
}

const VALID_PRESETS = new Set<WorkflowPreset>(['modern', 'traditional']);

export function isValidPreset(v: unknown): v is WorkflowPreset {
  return typeof v === 'string' && VALID_PRESETS.has(v as WorkflowPreset);
}

const LINE_ITEM_ID_SET = new Set<string>(LINE_ITEM_IDS);

export function isValidLineItemId(v: unknown): v is LineItemId {
  return typeof v === 'string' && LINE_ITEM_ID_SET.has(v);
}

const NUMERIC_OVERRIDE_KEYS: ReadonlySet<string> = new Set([
  'genaiAssistedReview', 'humanResponsivenessFirstPass', 'humanPrivilegeReview',
  'hosting', 'processingLegacy', 'projectManagementPerHour', 'productionPerPage',
  'tarCullFraction', 'privilegeQcFraction', 'pmScalingMultiplier',
]);

const STAFFING_OVERRIDE_KEYS: ReadonlySet<string> = new Set([
  'humanReview', 'humanPrivilege', 'projectManagement',
]);

function sanitizeNumber(v: unknown): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return undefined;
  return v;
}

function sanitizeStaffingRows(v: unknown): StaffingRow[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const rows: StaffingRow[] = [];
  for (const item of v) {
    if (typeof item !== 'object' || item === null) return undefined;
    const { role, hours, rate } = item as Record<string, unknown>;
    if (!STAFFING_ROLES.includes(role as StaffingRole)) return undefined;
    const h = sanitizeNumber(hours);
    const r = sanitizeNumber(rate);
    if (h === undefined || r === undefined) return undefined;
    rows.push({ role: role as StaffingRole, hours: h, rate: r });
  }
  return rows.length > 0 ? rows : undefined;
}

/**
 * Validate and sanitize an untrusted object (e.g., from URL JSON) into
 * a safe RateOverrides. Strips unknown keys, rejects non-numeric values,
 * rejects negative numbers, and validates staffing row structure.
 */
export function sanitizeOverrides(raw: unknown): RateOverrides {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const result: RateOverrides = {};

  for (const [key, value] of Object.entries(obj)) {
    if (NUMERIC_OVERRIDE_KEYS.has(key)) {
      const n = sanitizeNumber(value);
      if (n !== undefined) {
        (result as Record<string, number>)[key] = n;
      }
    } else if (key === 'staffing' && typeof value === 'object' && value !== null) {
      const staffingObj = value as Record<string, unknown>;
      const staffing: StaffingOverridesMap = {};
      let hasAny = false;
      for (const [sk, sv] of Object.entries(staffingObj)) {
        if (STAFFING_OVERRIDE_KEYS.has(sk)) {
          const rows = sanitizeStaffingRows(sv);
          if (rows) {
            (staffing as Record<string, StaffingRow[]>)[sk] = rows;
            hasAny = true;
          }
        }
      }
      if (hasAny) result.staffing = staffing;
    }
  }

  return result;
}

/**
 * Apply a preset: set the enabledItems to the preset's defaults, but
 * preserve any rate overrides the user has entered.
 */
export function applyPreset(
  current: BudgetState,
  preset: WorkflowPreset
): BudgetState {
  return {
    ...current,
    preset,
    enabledItems: new Set(PRESET_ENABLED_ITEMS[preset]),
  };
}
