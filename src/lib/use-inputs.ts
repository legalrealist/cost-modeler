import { useEffect, useState, useCallback } from 'react';
import type { MatterInputs } from '@/lib/calculator';
import type { CorpusMix } from '@/lib/pricing-data';
import { gigabytesToDocs, docsToGigabytes } from '@/lib/calculator';
import { DEFAULTS } from '@/lib/pricing-data';

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

export function useMatterInputs() {
  const [inputs, setInputsState] = useState<MatterInputs>(() => readParams());

  // When inputs change, sync URL.
  useEffect(() => {
    writeParams(inputs);
  }, [inputs]);

  const setInputs = useCallback((updater: Partial<MatterInputs> | ((prev: MatterInputs) => MatterInputs)) => {
    setInputsState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };

      // Auto-sync gigabytes <-> documentCount based on corpusMix.
      // If documentCount or corpusMix changed, recompute gigabytes from doc count.
      if (next.documentCount !== prev.documentCount || next.corpusMix !== prev.corpusMix) {
        next.gigabytes = docsToGigabytes(next.documentCount, next.corpusMix);
      }

      return next;
    });
  }, []);

  // Also expose a setter that lets the user update GB directly.
  const setGigabytes = useCallback((gb: number) => {
    setInputsState((prev) => ({
      ...prev,
      gigabytes: gb,
      documentCount: gigabytesToDocs(gb, prev.corpusMix),
    }));
  }, []);

  const reset = useCallback(() => setInputsState(DEFAULT_INPUTS), []);

  return { inputs, setInputs, setGigabytes, reset };
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
