import { useEffect, useState, useCallback } from 'react';
import type { MatterInputs } from '@/lib/calculator';
import type { CorpusMix } from '@/lib/pricing-data';
import { gigabytesToDocs, docsToGigabytes } from '@/lib/calculator';
import { DEFAULTS } from '@/lib/pricing-data';
import {
  DEFAULT_BUDGET_STATE,
  DEFAULT_ROLE_RATES,
  PRESET_ENABLED_ITEMS,
  applyPreset,
  isValidPreset,
  isValidLineItemId,
  sanitizeOverrides,
  getDefaultTaskHours,
  getRiskMultipliers,
  type BudgetState,
  type RateOverrides,
  type StaffingOverridesMap,
  type StaffingRow,
  type TaskHoursState,
  type StaffingRole,
  type WorkflowPreset,
  type LineItemId,
  type RiskMatterType,
  type RiskDefensibility,
} from '@/lib/rate-overrides';

export const DEFAULT_INPUTS: MatterInputs = {
  documentCount: DEFAULTS.documentCount,
  gigabytes: 250_000 / 7_500, // ~33 GB at default 7,500 docs/GB
  corpusMix: 'mixed',
  matterType: 'adversarial',
  weeks: DEFAULTS.weeks,
  privilegeRequired: true,
  privilegeFraction: DEFAULTS.privilegeFraction,
  defensibility: 'high',
  hostingMonths: Math.ceil(DEFAULTS.weeks / 4) + DEFAULTS.hostingMonthsAfterMatter,
};

// Compact param keys for short shareable URLs.
const PARAM_KEYS = {
  documentCount: 'd',
  corpusMix: 'c',
  matterType: 'm',
  weeks: 'w',
  privilegeRequired: 'p',
  privilegeFraction: 'pf',
  defensibility: 'df',
  hostingMonths: 'h',
} as const;

function readParams(): MatterInputs {
  if (typeof window === 'undefined') return DEFAULT_INPUTS;
  const params = new URLSearchParams(window.location.search);

  const documentCount = Number(params.get(PARAM_KEYS.documentCount)) || DEFAULT_INPUTS.documentCount;
  const corpusMix = (params.get(PARAM_KEYS.corpusMix) as CorpusMix['id']) || DEFAULT_INPUTS.corpusMix;
  const matterType = (params.get(PARAM_KEYS.matterType) as MatterInputs['matterType']) || DEFAULT_INPUTS.matterType;
  const weeks = Number(params.get(PARAM_KEYS.weeks)) || DEFAULT_INPUTS.weeks;
  const privilegeRequired =
    params.get(PARAM_KEYS.privilegeRequired) === '0'
      ? false
      : params.get(PARAM_KEYS.privilegeRequired) === '1'
        ? true
        : DEFAULT_INPUTS.privilegeRequired;
  const privilegeFraction = Number(params.get(PARAM_KEYS.privilegeFraction)) || DEFAULT_INPUTS.privilegeFraction;
  const defensibility = (params.get(PARAM_KEYS.defensibility) as MatterInputs['defensibility']) || DEFAULT_INPUTS.defensibility;
  const hostingMonths = Number(params.get(PARAM_KEYS.hostingMonths)) || DEFAULT_INPUTS.hostingMonths;

  return {
    documentCount,
    gigabytes: docsToGigabytes(documentCount, corpusMix),
    corpusMix,
    matterType,
    weeks,
    privilegeRequired,
    privilegeFraction,
    defensibility,
    hostingMonths,
  };
}

function writeParams(inputs: MatterInputs) {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams();
  params.set(PARAM_KEYS.documentCount, String(Math.round(inputs.documentCount)));
  params.set(PARAM_KEYS.corpusMix, inputs.corpusMix);
  params.set(PARAM_KEYS.matterType, inputs.matterType);
  params.set(PARAM_KEYS.weeks, String(inputs.weeks));
  params.set(PARAM_KEYS.privilegeRequired, inputs.privilegeRequired ? '1' : '0');
  params.set(PARAM_KEYS.privilegeFraction, inputs.privilegeFraction.toFixed(2));
  params.set(PARAM_KEYS.defensibility, inputs.defensibility);
  params.set(PARAM_KEYS.hostingMonths, String(inputs.hostingMonths));
  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, '', newUrl);
}

// ---------------------------------------------------------------------------
// Budget state URL serialization
// ---------------------------------------------------------------------------

function readBudgetParams(): BudgetState {
  if (typeof window === 'undefined') return DEFAULT_BUDGET_STATE;
  const params = new URLSearchParams(window.location.search);

  const rawPreset = params.get('bp');
  const preset: WorkflowPreset = isValidPreset(rawPreset) ? rawPreset : DEFAULT_BUDGET_STATE.preset;

  // Enabled items: stored as comma-separated IDs, filtered to valid IDs only.
  const enabledParam = params.get('be');
  const enabledItems: Set<LineItemId> = enabledParam
    ? new Set(enabledParam.split(',').filter(isValidLineItemId))
    : new Set(PRESET_ENABLED_ITEMS[preset]);

  // Rate overrides: parsed from JSON, then sanitized to strip invalid keys/values.
  let overrides: RateOverrides = {};
  const roParam = params.get('ro');
  if (roParam) {
    try {
      overrides = sanitizeOverrides(JSON.parse(decodeURIComponent(roParam)));
    } catch {
      // Ignore malformed JSON.
    }
  }

  return { preset, enabledItems, overrides };
}

function writeBudgetParams(budget: BudgetState, params: URLSearchParams) {
  params.set('bp', budget.preset);

  // Only write enabled items if they differ from the preset defaults.
  const presetDefaults = PRESET_ENABLED_ITEMS[budget.preset];
  const currentItems = [...budget.enabledItems].sort();
  const defaultItems = [...presetDefaults].sort();
  if (currentItems.join(',') !== defaultItems.join(',')) {
    params.set('be', currentItems.join(','));
  }

  // Only write overrides if any exist.
  const sparseOverrides: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(budget.overrides)) {
    if (v !== undefined) sparseOverrides[k] = v;
  }
  if (Object.keys(sparseOverrides).length > 0) {
    params.set('ro', encodeURIComponent(JSON.stringify(sparseOverrides)));
  }
}

// ---------------------------------------------------------------------------
// Combined hook
// ---------------------------------------------------------------------------

export function useMatterInputs() {
  const [inputs, setInputsState] = useState<MatterInputs>(() => readParams());
  const [budget, setBudgetState] = useState<BudgetState>(() => readBudgetParams());

  // When inputs or budget change, sync URL.
  useEffect(() => {
    writeParams(inputs);
    // Re-read the params we just wrote, then add budget params on top.
    const params = new URLSearchParams(window.location.search);
    writeBudgetParams(budget, params);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [inputs, budget]);

  const setInputs = useCallback((updater: Partial<MatterInputs> | ((prev: MatterInputs) => MatterInputs)) => {
    setInputsState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };

      // Auto-sync gigabytes <-> documentCount based on corpusMix.
      if (next.documentCount !== prev.documentCount || next.corpusMix !== prev.corpusMix) {
        next.gigabytes = docsToGigabytes(next.documentCount, next.corpusMix);
      }

      return next;
    });
  }, []);

  const setGigabytes = useCallback((gb: number) => {
    setInputsState((prev) => ({
      ...prev,
      gigabytes: gb,
      documentCount: gigabytesToDocs(gb, prev.corpusMix),
    }));
  }, []);

  const setPreset = useCallback((preset: WorkflowPreset) => {
    setBudgetState((prev) => applyPreset(prev, preset));
  }, []);

  const setOverride = useCallback((key: keyof RateOverrides, value: number | undefined) => {
    setBudgetState((prev) => ({
      ...prev,
      overrides: { ...prev.overrides, [key]: value },
    }));
  }, []);

  const toggleLineItem = useCallback((id: LineItemId) => {
    setBudgetState((prev) => {
      const next = new Set(prev.enabledItems);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { ...prev, enabledItems: next };
    });
  }, []);

  const setStaffingOverride = useCallback(
    (lineItemKey: keyof StaffingOverridesMap, rows: StaffingRow[] | undefined) => {
      setBudgetState((prev) => ({
        ...prev,
        overrides: {
          ...prev.overrides,
          staffing: {
            ...prev.overrides.staffing,
            [lineItemKey]: rows,
          },
        },
      }));
    },
    [],
  );

  const resetBudget = useCallback(() => {
    setBudgetState(DEFAULT_BUDGET_STATE);
  }, []);

  // --- Task calculator state (role rates + task hours) ---
  const [roleRates, setRoleRatesState] = useState<Record<StaffingRole, number>>({ ...DEFAULT_ROLE_RATES });
  const [taskHoursOverride, setTaskHoursOverrideState] = useState<TaskHoursState | null>(null);

  const riskMultipliers = getRiskMultipliers(
    inputs.matterType as RiskMatterType,
    inputs.defensibility as RiskDefensibility,
  );

  const defaultTaskHours = getDefaultTaskHours(inputs.documentCount, riskMultipliers);
  const taskHours = taskHoursOverride ?? defaultTaskHours;

  const setRoleRate = useCallback((role: StaffingRole, value: number) => {
    setRoleRatesState((prev) => ({ ...prev, [role]: value }));
  }, []);

  const setTraditionalTaskHour = useCallback((key: string, value: number) => {
    setTaskHoursOverrideState((prev) => {
      const base = prev ?? defaultTaskHours;
      return { ...base, traditional: { ...base.traditional, [key]: value } };
    });
  }, [defaultTaskHours]);

  const setAiTaskHour = useCallback((key: string, value: number) => {
    setTaskHoursOverrideState((prev) => {
      const base = prev ?? defaultTaskHours;
      return { ...base, ai: { ...base.ai, [key]: value } };
    });
  }, [defaultTaskHours]);

  const resetTaskCalculator = useCallback(() => {
    setRoleRatesState({ ...DEFAULT_ROLE_RATES });
    setTaskHoursOverrideState(null);
  }, []);

  const reset = useCallback(() => {
    setInputsState(DEFAULT_INPUTS);
    setBudgetState(DEFAULT_BUDGET_STATE);
    setRoleRatesState({ ...DEFAULT_ROLE_RATES });
    setTaskHoursOverrideState(null);
  }, []);

  return {
    inputs,
    setInputs,
    setGigabytes,
    budget,
    setPreset,
    setOverride,
    toggleLineItem,
    setStaffingOverride,
    resetBudget,
    // Task calculator
    roleRates,
    setRoleRate,
    taskHours,
    riskMultipliers,
    setTraditionalTaskHour,
    setAiTaskHour,
    resetTaskCalculator,
    reset,
  };
}

export function buildShareUrl(inputs: MatterInputs, budget?: BudgetState): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams();
  params.set(PARAM_KEYS.documentCount, String(Math.round(inputs.documentCount)));
  params.set(PARAM_KEYS.corpusMix, inputs.corpusMix);
  params.set(PARAM_KEYS.matterType, inputs.matterType);
  params.set(PARAM_KEYS.weeks, String(inputs.weeks));
  params.set(PARAM_KEYS.privilegeRequired, inputs.privilegeRequired ? '1' : '0');
  params.set(PARAM_KEYS.privilegeFraction, inputs.privilegeFraction.toFixed(2));
  params.set(PARAM_KEYS.defensibility, inputs.defensibility);
  params.set(PARAM_KEYS.hostingMonths, String(inputs.hostingMonths));
  if (budget) {
    writeBudgetParams(budget, params);
  }
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}
