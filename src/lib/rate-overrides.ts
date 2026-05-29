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

export const TRADITIONAL_TASK_HOURS = {
  initialReview: 1000,
  secondLevelReview: 800,
  privilegeReview: 100,
  secondLevelPrivilegeReview: 333,
  privilegeLogDrafting: 100,
  secondLevelPrivilegeLogDrafting: 167,
  keyDocIdentification: 160,
  secondLevelKeyDocIdentification: 80,
};

export const AI_TASK_HOURS = {
  secondLevelReview: 800,
  secondLevelPrivilegeReview: 333,
  secondLevelPrivilegeLogDrafting: 167,
  secondLevelKeyDocIdentification: 80,
};

export const AI_EFFICIENCY_REDUCTION = 0.75;

function scaleHours(baseHours: number, docCount: number): number {
  return Math.ceil(baseHours * (docCount / BASE_DOC_COUNT));
}

// ---------------------------------------------------------------------------
// Risk multipliers — scale task hours by matter type + defensibility
// ---------------------------------------------------------------------------

export type RiskMatterType =
  | 'adversarial'
  | 'investigation'
  | 'regulatory'
  | 'post_production'
  | 'compliance';

export type RiskDefensibility = 'high' | 'standard' | 'low';

export interface RiskMultipliers {
  /** Multiplier on second-level task hours (0.7 – 1.5) */
  secondLevelReview: number;
  /** Multiplier on privilege-related tasks (0 – 1.5) */
  privilegeReview: number;
  /** Multiplier on partner hours (0 – 2.0) */
  partnerInvolvement: number;
  /** 0.75 = 25% faster, 1.0 = no efficiency gain */
  aiEfficiencyReduction: number;
}

const DEFAULT_RISK: RiskMultipliers = {
  secondLevelReview: 1.0,
  privilegeReview: 1.0,
  partnerInvolvement: 1.0,
  aiEfficiencyReduction: 0.75,
};

const RISK_PROFILES: Record<string, RiskMultipliers> = {
  'adversarial:high':     { secondLevelReview: 1.5, privilegeReview: 1.5, partnerInvolvement: 2.0, aiEfficiencyReduction: 1.0 },
  'adversarial:standard': { secondLevelReview: 1.2, privilegeReview: 1.2, partnerInvolvement: 1.5, aiEfficiencyReduction: 0.85 },
  'adversarial:low':      { secondLevelReview: 1.0, privilegeReview: 1.0, partnerInvolvement: 1.0, aiEfficiencyReduction: 0.75 },
  'regulatory:high':      { secondLevelReview: 1.3, privilegeReview: 1.3, partnerInvolvement: 1.5, aiEfficiencyReduction: 0.9 },
  'regulatory:standard':  { secondLevelReview: 1.0, privilegeReview: 1.0, partnerInvolvement: 1.0, aiEfficiencyReduction: 0.8 },
  'investigation:standard': { secondLevelReview: 1.0, privilegeReview: 1.0, partnerInvolvement: 1.0, aiEfficiencyReduction: 0.75 },
  'investigation:low':    { secondLevelReview: 0.7, privilegeReview: 0.7, partnerInvolvement: 0.5, aiEfficiencyReduction: 0.75 },
};

/** "any defensibility" overrides for matter types where defensibility doesn't matter */
const RISK_ANY_DEFENSIBILITY: Partial<Record<RiskMatterType, RiskMultipliers>> = {
  post_production: { secondLevelReview: 0.5, privilegeReview: 0,   partnerInvolvement: 0,   aiEfficiencyReduction: 0.75 },
  compliance:      { secondLevelReview: 0.5, privilegeReview: 0.3, partnerInvolvement: 0.3, aiEfficiencyReduction: 0.75 },
};

/**
 * Look up risk multipliers for a given matter type and defensibility level.
 * Falls back to sensible defaults when the combination isn't explicitly mapped.
 */
export function getRiskMultipliers(
  matterType: RiskMatterType,
  defensibility: RiskDefensibility,
): RiskMultipliers {
  // Check "any defensibility" overrides first
  const anyDef = RISK_ANY_DEFENSIBILITY[matterType];
  if (anyDef) return { ...anyDef };

  // Check specific combination
  const key = `${matterType}:${defensibility}`;
  const profile = RISK_PROFILES[key];
  if (profile) return { ...profile };

  return { ...DEFAULT_RISK };
}

// ---------------------------------------------------------------------------
// TaskHoursState — editable task hours for both workflows
// ---------------------------------------------------------------------------

export interface TaskHoursState {
  traditional: typeof TRADITIONAL_TASK_HOURS;
  ai: typeof AI_TASK_HOURS;
}

/**
 * Compute default task hours scaled by doc count and adjusted by risk multipliers.
 * The base hours (at 100K docs) are TRADITIONAL_TASK_HOURS and AI_TASK_HOURS.
 */
export function getDefaultTaskHours(
  docCount: number,
  riskMultipliers: RiskMultipliers,
): TaskHoursState {
  const rm = riskMultipliers;

  const traditional = {
    initialReview: scaleHours(TRADITIONAL_TASK_HOURS.initialReview, docCount),
    secondLevelReview: scaleHours(TRADITIONAL_TASK_HOURS.secondLevelReview * rm.secondLevelReview, docCount),
    privilegeReview: scaleHours(TRADITIONAL_TASK_HOURS.privilegeReview * rm.privilegeReview, docCount),
    secondLevelPrivilegeReview: scaleHours(TRADITIONAL_TASK_HOURS.secondLevelPrivilegeReview * rm.privilegeReview, docCount),
    privilegeLogDrafting: scaleHours(TRADITIONAL_TASK_HOURS.privilegeLogDrafting * rm.privilegeReview, docCount),
    secondLevelPrivilegeLogDrafting: scaleHours(TRADITIONAL_TASK_HOURS.secondLevelPrivilegeLogDrafting * rm.privilegeReview, docCount),
    keyDocIdentification: scaleHours(TRADITIONAL_TASK_HOURS.keyDocIdentification, docCount),
    secondLevelKeyDocIdentification: scaleHours(TRADITIONAL_TASK_HOURS.secondLevelKeyDocIdentification, docCount),
  };

  const ai = {
    secondLevelReview: scaleHours(AI_TASK_HOURS.secondLevelReview * rm.secondLevelReview, docCount),
    secondLevelPrivilegeReview: scaleHours(AI_TASK_HOURS.secondLevelPrivilegeReview * rm.privilegeReview, docCount),
    secondLevelPrivilegeLogDrafting: scaleHours(AI_TASK_HOURS.secondLevelPrivilegeLogDrafting * rm.privilegeReview, docCount),
    secondLevelKeyDocIdentification: scaleHours(AI_TASK_HOURS.secondLevelKeyDocIdentification, docCount),
  };

  return { traditional, ai };
}

// ---------------------------------------------------------------------------
// Staffing from user-editable task hours
// ---------------------------------------------------------------------------

/**
 * Build traditional staffing rows from a (possibly user-edited) TaskHoursState.
 * Uses the same role allocation logic as defaultTraditionalStaffing but
 * operates on pre-scaled, pre-risk-adjusted hours.
 */
export function staffingFromTaskHours(
  taskHours: TaskHoursState,
  riskMultipliers: RiskMultipliers,
): StaffingRow[] {
  const t = taskHours.traditional;
  const rm = riskMultipliers;
  return [
    {
      role: 'contractAttorney',
      hours: t.initialReview + t.privilegeReview + t.privilegeLogDrafting,
      rate: DEFAULT_ROLE_RATES.contractAttorney,
    },
    {
      role: 'juniorAssociate',
      hours: Math.ceil(
        (t.secondLevelReview + t.secondLevelPrivilegeReview + t.secondLevelPrivilegeLogDrafting + t.secondLevelKeyDocIdentification) * 0.5,
      ),
      rate: DEFAULT_ROLE_RATES.juniorAssociate,
    },
    {
      role: 'seniorAssociate',
      hours: Math.ceil(
        (t.secondLevelReview + t.secondLevelPrivilegeReview + t.secondLevelPrivilegeLogDrafting + t.keyDocIdentification + t.secondLevelKeyDocIdentification) * 0.5,
      ),
      rate: DEFAULT_ROLE_RATES.seniorAssociate,
    },
    {
      role: 'partner',
      hours: Math.ceil(t.keyDocIdentification * 0.5 * rm.partnerInvolvement),
      rate: DEFAULT_ROLE_RATES.partner,
    },
  ];
}

/**
 * Build AI-workflow staffing rows from a (possibly user-edited) TaskHoursState.
 * Uses the same role allocation logic as defaultAiStaffing but operates on
 * pre-scaled, pre-risk-adjusted hours.
 */
export function aiStaffingFromTaskHours(
  taskHours: TaskHoursState,
  riskMultipliers: RiskMultipliers,
): StaffingRow[] {
  const a = taskHours.ai;
  const rm = riskMultipliers;
  const secondLevelTotal = a.secondLevelReview + a.secondLevelPrivilegeReview + a.secondLevelPrivilegeLogDrafting + a.secondLevelKeyDocIdentification;
  return [
    {
      role: 'contractAttorney',
      hours: 0,
      rate: DEFAULT_ROLE_RATES.contractAttorney,
    },
    {
      role: 'juniorAssociate',
      hours: Math.ceil(secondLevelTotal * 0.5 * rm.aiEfficiencyReduction),
      rate: DEFAULT_ROLE_RATES.juniorAssociate,
    },
    {
      role: 'seniorAssociate',
      hours: Math.ceil(secondLevelTotal * 0.5 * rm.aiEfficiencyReduction),
      rate: DEFAULT_ROLE_RATES.seniorAssociate,
    },
    {
      role: 'partner',
      hours: Math.ceil(a.secondLevelKeyDocIdentification * 0.5 * rm.partnerInvolvement),
      rate: DEFAULT_ROLE_RATES.partner,
    },
  ];
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

  // Pre-computed / user-edited task hours
  taskHours?: TaskHoursState;
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

const TRADITIONAL_TASK_KEYS = Object.keys(TRADITIONAL_TASK_HOURS);
const AI_TASK_KEYS = Object.keys(AI_TASK_HOURS);

function sanitizeTaskHoursRecord(
  obj: Record<string, unknown>,
  validKeys: string[],
): Record<string, number> | undefined {
  const result: Record<string, number> = {};
  for (const key of validKeys) {
    const v = obj[key];
    const n = sanitizeNumber(v);
    if (n === undefined) return undefined; // all fields required
    result[key] = n;
  }
  return result;
}

function sanitizeTaskHours(obj: Record<string, unknown>): TaskHoursState | undefined {
  if (typeof obj.traditional !== 'object' || obj.traditional === null) return undefined;
  if (typeof obj.ai !== 'object' || obj.ai === null) return undefined;

  const trad = sanitizeTaskHoursRecord(obj.traditional as Record<string, unknown>, TRADITIONAL_TASK_KEYS);
  const ai = sanitizeTaskHoursRecord(obj.ai as Record<string, unknown>, AI_TASK_KEYS);
  if (!trad || !ai) return undefined;

  return {
    traditional: trad as typeof TRADITIONAL_TASK_HOURS,
    ai: ai as typeof AI_TASK_HOURS,
  };
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
    } else if (key === 'taskHours' && typeof value === 'object' && value !== null) {
      const taskHoursObj = value as Record<string, unknown>;
      const sanitized = sanitizeTaskHours(taskHoursObj);
      if (sanitized) result.taskHours = sanitized;
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
