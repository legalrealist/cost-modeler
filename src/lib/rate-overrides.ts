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

export const DEFAULT_ROLE_RATES: Record<StaffingRole, number> = {
  contractAttorney: 50,
  juniorAssociate: 750,
  seniorAssociate: 1000,
  partner: 1500,
};

// ---------------------------------------------------------------------------
// Review throughput — docs/hr for each first-level task
// ---------------------------------------------------------------------------

export const REVIEW_THROUGHPUT = {
  initialReview: 50,
  privilegeReview: 20,
  privilegeLogDrafting: 5,
  keyDocIdentification: 10,
};

// ---------------------------------------------------------------------------
// Risk profiles — drive QC depth, allocation, partner involvement, AI efficiency
// ---------------------------------------------------------------------------

export type RiskMatterType =
  | 'adversarial'
  | 'investigation'
  | 'regulatory'
  | 'compliance';

export type RiskDefensibility = 'high' | 'standard' | 'low';

export interface RiskProfile {
  label: string;
  qcRatios: {
    review: number;
    privilege: number;
    privilegeLog: number;
    keyDoc: number;
  };
  juniorFraction: {
    volumeQC: number;
    privilegeQC: number;
    keyDocQC: number;
  };
  partnerInvolvement: number;
  aiEfficiency: number;
}

const DEFAULT_PROFILE: RiskProfile = {
  label: 'Standard',
  qcRatios: { review: 0.10, privilege: 0.25, privilegeLog: 0.30, keyDoc: 0.15 },
  juniorFraction: { volumeQC: 0.85, privilegeQC: 0.70, keyDocQC: 0.55 },
  partnerInvolvement: 1.0,
  aiEfficiency: 0.85,
};

const RISK_PROFILES: Record<string, RiskProfile> = {
  'adversarial:high': {
    label: 'Maximum oversight',
    qcRatios: { review: 0.30, privilege: 0.45, privilegeLog: 0.50, keyDoc: 0.35 },
    juniorFraction: { volumeQC: 0.70, privilegeQC: 0.55, keyDocQC: 0.40 },
    partnerInvolvement: 2.0,
    aiEfficiency: 1.0,
  },
  'adversarial:standard': {
    label: 'High oversight',
    qcRatios: { review: 0.20, privilege: 0.35, privilegeLog: 0.40, keyDoc: 0.25 },
    juniorFraction: { volumeQC: 0.80, privilegeQC: 0.65, keyDocQC: 0.50 },
    partnerInvolvement: 1.5,
    aiEfficiency: 0.90,
  },
  'adversarial:low': {
    label: 'Moderate oversight',
    qcRatios: { review: 0.15, privilege: 0.25, privilegeLog: 0.30, keyDoc: 0.15 },
    juniorFraction: { volumeQC: 0.85, privilegeQC: 0.70, keyDocQC: 0.55 },
    partnerInvolvement: 1.0,
    aiEfficiency: 0.85,
  },
  'regulatory:high': {
    label: 'High oversight',
    qcRatios: { review: 0.25, privilege: 0.45, privilegeLog: 0.45, keyDoc: 0.30 },
    juniorFraction: { volumeQC: 0.75, privilegeQC: 0.60, keyDocQC: 0.45 },
    partnerInvolvement: 1.5,
    aiEfficiency: 0.90,
  },
  'regulatory:standard': {
    label: 'Moderate oversight',
    qcRatios: { review: 0.15, privilege: 0.30, privilegeLog: 0.35, keyDoc: 0.20 },
    juniorFraction: { volumeQC: 0.80, privilegeQC: 0.65, keyDocQC: 0.50 },
    partnerInvolvement: 1.0,
    aiEfficiency: 0.85,
  },
  'investigation:standard': {
    label: 'Moderate oversight',
    qcRatios: { review: 0.15, privilege: 0.30, privilegeLog: 0.35, keyDoc: 0.20 },
    juniorFraction: { volumeQC: 0.80, privilegeQC: 0.65, keyDocQC: 0.50 },
    partnerInvolvement: 1.0,
    aiEfficiency: 0.85,
  },
  'investigation:low': {
    label: 'Reduced oversight',
    qcRatios: { review: 0.10, privilege: 0.20, privilegeLog: 0.25, keyDoc: 0.10 },
    juniorFraction: { volumeQC: 0.85, privilegeQC: 0.75, keyDocQC: 0.60 },
    partnerInvolvement: 0.5,
    aiEfficiency: 0.80,
  },
  'compliance:high': {
    label: 'Moderate oversight',
    qcRatios: { review: 0.10, privilege: 0.20, privilegeLog: 0.25, keyDoc: 0.10 },
    juniorFraction: { volumeQC: 0.90, privilegeQC: 0.80, keyDocQC: 0.65 },
    partnerInvolvement: 0.5,
    aiEfficiency: 0.80,
  },
  'compliance:standard': {
    label: 'Reduced oversight',
    qcRatios: { review: 0.10, privilege: 0.20, privilegeLog: 0.25, keyDoc: 0.10 },
    juniorFraction: { volumeQC: 0.90, privilegeQC: 0.80, keyDocQC: 0.65 },
    partnerInvolvement: 0.5,
    aiEfficiency: 0.80,
  },
};

export function getRiskProfile(
  matterType: RiskMatterType,
  defensibility: RiskDefensibility,
): RiskProfile {
  const key = `${matterType}:${defensibility}`;
  const profile = RISK_PROFILES[key];
  if (profile) return { ...profile, qcRatios: { ...profile.qcRatios }, juniorFraction: { ...profile.juniorFraction } };
  return { ...DEFAULT_PROFILE, qcRatios: { ...DEFAULT_PROFILE.qcRatios }, juniorFraction: { ...DEFAULT_PROFILE.juniorFraction } };
}

export { DEFAULT_PROFILE };

// ---------------------------------------------------------------------------
// TaskHoursState — editable task hours for both workflows
// ---------------------------------------------------------------------------

export interface TraditionalTaskHoursShape {
  initialReview: number;
  secondLevelReview: number;
  privilegeReview: number;
  secondLevelPrivilegeReview: number;
  privilegeLogDrafting: number;
  secondLevelPrivilegeLogDrafting: number;
  keyDocIdentification: number;
  secondLevelKeyDocIdentification: number;
}

export interface AiTaskHoursShape {
  secondLevelReview: number;
  secondLevelPrivilegeReview: number;
  secondLevelPrivilegeLogDrafting: number;
  secondLevelKeyDocIdentification: number;
}

export interface TaskHoursState {
  traditional: TraditionalTaskHoursShape;
  ai: AiTaskHoursShape;
}

export function getDefaultTaskHours(
  docCount: number,
  privilegeCount: number,
  keyDocCount: number,
  riskProfile: RiskProfile,
): TaskHoursState {
  const qc = riskProfile.qcRatios;

  const initialReviewHrs = Math.ceil(docCount / REVIEW_THROUGHPUT.initialReview);
  const privilegeReviewHrs = Math.ceil(privilegeCount / REVIEW_THROUGHPUT.privilegeReview);
  const privilegeLogHrs = Math.ceil(privilegeCount / REVIEW_THROUGHPUT.privilegeLogDrafting);
  const keyDocHrs = Math.ceil(keyDocCount / REVIEW_THROUGHPUT.keyDocIdentification);

  const traditional: TraditionalTaskHoursShape = {
    initialReview: initialReviewHrs,
    secondLevelReview: Math.ceil(initialReviewHrs * qc.review),
    privilegeReview: privilegeReviewHrs,
    secondLevelPrivilegeReview: Math.ceil(privilegeReviewHrs * qc.privilege),
    privilegeLogDrafting: privilegeLogHrs,
    secondLevelPrivilegeLogDrafting: Math.ceil(privilegeLogHrs * qc.privilegeLog),
    keyDocIdentification: keyDocHrs,
    secondLevelKeyDocIdentification: Math.ceil(keyDocHrs * qc.keyDoc),
  };

  const ai: AiTaskHoursShape = {
    secondLevelReview: Math.ceil(initialReviewHrs * qc.review),
    secondLevelPrivilegeReview: Math.ceil(privilegeReviewHrs * qc.privilege),
    secondLevelPrivilegeLogDrafting: Math.ceil(privilegeLogHrs * qc.privilegeLog),
    secondLevelKeyDocIdentification: Math.ceil(keyDocHrs * qc.keyDoc),
  };

  return { traditional, ai };
}

// ---------------------------------------------------------------------------
// Legacy staffing helpers (used by calculator.ts budget worksheet)
// ---------------------------------------------------------------------------

function scaleHours(baseHours: number, docCount: number): number {
  return Math.ceil(baseHours * (docCount / 100_000));
}

const LEGACY_TRADITIONAL_TASK_HOURS = {
  initialReview: 1000,
  secondLevelReview: 800,
  privilegeReview: 100,
  secondLevelPrivilegeReview: 333,
  privilegeLogDrafting: 100,
  secondLevelPrivilegeLogDrafting: 167,
  keyDocIdentification: 160,
  secondLevelKeyDocIdentification: 80,
};

const LEGACY_AI_TASK_HOURS = {
  secondLevelReview: 800,
  secondLevelPrivilegeReview: 333,
  secondLevelPrivilegeLogDrafting: 167,
  secondLevelKeyDocIdentification: 80,
};

const LEGACY_AI_EFFICIENCY = 0.75;

export function defaultTraditionalStaffing(docCount: number): StaffingRow[] {
  const t = LEGACY_TRADITIONAL_TASK_HOURS;
  return [
    { role: 'contractAttorney', hours: scaleHours(t.initialReview + t.privilegeReview + t.privilegeLogDrafting, docCount), rate: DEFAULT_ROLE_RATES.contractAttorney },
    { role: 'juniorAssociate', hours: scaleHours(t.secondLevelReview * 0.6 + t.secondLevelPrivilegeReview * 0.6 + t.secondLevelPrivilegeLogDrafting * 0.6 + t.secondLevelKeyDocIdentification * 0.4, docCount), rate: DEFAULT_ROLE_RATES.juniorAssociate },
    { role: 'seniorAssociate', hours: scaleHours(t.secondLevelReview * 0.4 + t.secondLevelPrivilegeReview * 0.4 + t.secondLevelPrivilegeLogDrafting * 0.4 + t.secondLevelKeyDocIdentification * 0.6 + t.keyDocIdentification * 0.5, docCount), rate: DEFAULT_ROLE_RATES.seniorAssociate },
    { role: 'partner', hours: scaleHours(t.keyDocIdentification * 0.5, docCount), rate: DEFAULT_ROLE_RATES.partner },
  ];
}

export function defaultAiStaffing(docCount: number): StaffingRow[] {
  const a = LEGACY_AI_TASK_HOURS;
  return [
    { role: 'contractAttorney', hours: 0, rate: DEFAULT_ROLE_RATES.contractAttorney },
    { role: 'juniorAssociate', hours: scaleHours((a.secondLevelReview * 0.6 + a.secondLevelPrivilegeReview * 0.6 + a.secondLevelPrivilegeLogDrafting * 0.6 + a.secondLevelKeyDocIdentification * 0.4) * LEGACY_AI_EFFICIENCY, docCount), rate: DEFAULT_ROLE_RATES.juniorAssociate },
    { role: 'seniorAssociate', hours: scaleHours((a.secondLevelReview * 0.4 + a.secondLevelPrivilegeReview * 0.4 + a.secondLevelPrivilegeLogDrafting * 0.4 + a.secondLevelKeyDocIdentification * 0.6) * LEGACY_AI_EFFICIENCY, docCount), rate: DEFAULT_ROLE_RATES.seniorAssociate },
    { role: 'partner', hours: scaleHours(a.secondLevelKeyDocIdentification * 0.5, docCount), rate: DEFAULT_ROLE_RATES.partner },
  ];
}

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

export interface StaffingOverridesMap {
  humanReview?: StaffingRow[];
  humanPrivilege?: StaffingRow[];
  projectManagement?: StaffingRow[];
}

export interface RateOverrides {
  genaiAssistedReview?: number;
  humanResponsivenessFirstPass?: number;
  humanPrivilegeReview?: number;
  hosting?: number;
  processingLegacy?: number;
  projectManagementPerHour?: number;
  productionPerPage?: number;
  tarCullFraction?: number;
  privilegeQcFraction?: number;
  pmScalingMultiplier?: number;
  staffing?: StaffingOverridesMap;
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

export function resolveRate(benchmark: PricedRange, override?: number): PricedRange {
  if (override === undefined) return benchmark;
  return { ...benchmark, low: override, high: override };
}

export function benchmarkMidpoint(rate: PricedRange): number {
  return (rate.low + rate.high) / 2;
}

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

const TRADITIONAL_TASK_KEYS = Object.keys(LEGACY_TRADITIONAL_TASK_HOURS);
const AI_TASK_KEYS = Object.keys(LEGACY_AI_TASK_HOURS);

function sanitizeTaskHoursRecord(
  obj: Record<string, unknown>,
  validKeys: string[],
): Record<string, number> | undefined {
  const result: Record<string, number> = {};
  for (const key of validKeys) {
    const v = obj[key];
    const n = sanitizeNumber(v);
    if (n === undefined) return undefined;
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
    traditional: trad as unknown as TraditionalTaskHoursShape,
    ai: ai as unknown as AiTaskHoursShape,
  };
}

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
