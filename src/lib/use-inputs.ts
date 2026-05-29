import { useEffect, useState, useCallback } from 'react';
import type { MatterInputs } from '@/lib/calculator';
import type { CorpusMix } from '@/lib/pricing-data';
import { gigabytesToDocs, docsToGigabytes } from '@/lib/calculator';
import { DEFAULTS } from '@/lib/pricing-data';
import {
  DEFAULT_ROLE_RATES,
  getDefaultTaskHours,
  getRiskMultipliers,
  type TaskHoursState,
  type StaffingRole,
  type RiskMatterType,
  type RiskDefensibility,
} from '@/lib/rate-overrides';

export const DEFAULT_INPUTS: MatterInputs = {
  documentCount: DEFAULTS.documentCount,
  gigabytes: 250_000 / 7_500,
  corpusMix: 'mixed',
  matterType: 'adversarial',
  weeks: DEFAULTS.weeks,
  privilegeRequired: true,
  privilegeFraction: DEFAULTS.privilegeFraction,
  defensibility: 'high',
  hostingMonths: Math.ceil(DEFAULTS.weeks / 4) + DEFAULTS.hostingMonthsAfterMatter,
};

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

export function useMatterInputs() {
  const [inputs, setInputsState] = useState<MatterInputs>(() => readParams());

  useEffect(() => {
    writeParams(inputs);
  }, [inputs]);

  const setInputs = useCallback((updater: Partial<MatterInputs> | ((prev: MatterInputs) => MatterInputs)) => {
    setInputsState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
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

  // --- Task calculator state ---
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
    setRoleRatesState({ ...DEFAULT_ROLE_RATES });
    setTaskHoursOverrideState(null);
  }, []);

  return {
    inputs,
    setInputs,
    setGigabytes,
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

export function buildShareUrl(inputs: MatterInputs): string {
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
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}
