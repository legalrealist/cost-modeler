import { CORPUS_MIXES, type CorpusMix } from './pricing-data';

// ---------------------------------------------------------------------------
// Input shape
// ---------------------------------------------------------------------------

export type MatterType =
  | 'adversarial'
  | 'investigation'
  | 'regulatory'
  | 'compliance';

export type Defensibility = 'high' | 'standard' | 'low';

export interface MatterInputs {
  documentCount: number;
  gigabytes: number;
  corpusMix: CorpusMix['id'];
  matterType: MatterType;
  weeks: number;
  privilegeRequired: boolean;
  privilegeFraction: number;
  defensibility: Defensibility;
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
