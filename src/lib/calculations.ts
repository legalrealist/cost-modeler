// ---------------------------------------------------------------------------
// Pure cost computation helpers — extracted from TaskCalculator.tsx
// ---------------------------------------------------------------------------

import { AI_PROCESSING_RATES } from './pricing-data';
import type { StaffingRole, RiskProfile } from './rate-overrides';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface RoleHours {
  contractAttorney: number;
  juniorAssociate: number;
  seniorAssociate: number;
  partner: number;
}

export interface CostBreakdown {
  roleCosts: Record<StaffingRole, number>;
  roleHours: RoleHours;
  aiProcessingCost: number;
  totalHours: number;
  totalCost: number;
}

export interface SavingsResult {
  amount: number;
  percentage: number;
}

export interface TimelineResult {
  availableHours: number;
  traditionalWeeksNeeded: number;
  aiWeeksNeeded: number;
  traditionalFeasible: boolean;
  aiFeasible: boolean;
}

// These mirror the shapes defined in rate-overrides.ts and TaskCalculator.tsx
export interface TraditionalTaskHours {
  initialReview: number;
  secondLevelReview: number;
  privilegeReview: number;
  secondLevelPrivilegeReview: number;
  privilegeLogDrafting: number;
  secondLevelPrivilegeLogDrafting: number;
  keyDocIdentification: number;
  secondLevelKeyDocIdentification: number;
}

export interface AiTaskHours {
  secondLevelReview: number;
  secondLevelPrivilegeReview: number;
  secondLevelPrivilegeLogDrafting: number;
  secondLevelKeyDocIdentification: number;
}

// ---------------------------------------------------------------------------
// computeTraditionalCosts — verbatim from TaskCalculator.tsx:85-118
// ---------------------------------------------------------------------------

export function computeTraditionalCosts(
  t: TraditionalTaskHours,
  rates: Record<StaffingRole, number>,
  riskProfile: RiskProfile,
): CostBreakdown {
  const jf = riskProfile.juniorFraction;
  const roleHours: RoleHours = {
    contractAttorney:
      t.initialReview + t.privilegeReview + t.privilegeLogDrafting,
    juniorAssociate:
      t.secondLevelReview * jf.volumeQC +
      t.secondLevelPrivilegeReview * jf.privilegeQC +
      t.secondLevelPrivilegeLogDrafting * jf.privilegeQC +
      t.secondLevelKeyDocIdentification * jf.keyDocQC,
    seniorAssociate:
      t.secondLevelReview * (1 - jf.volumeQC) +
      t.secondLevelPrivilegeReview * (1 - jf.privilegeQC) +
      t.secondLevelPrivilegeLogDrafting * (1 - jf.privilegeQC) +
      t.secondLevelKeyDocIdentification * (1 - jf.keyDocQC) +
      t.keyDocIdentification * 0.5,
    partner: t.keyDocIdentification * 0.5 * riskProfile.partnerInvolvement,
  };

  const roleCosts: Record<StaffingRole, number> = {
    contractAttorney: roleHours.contractAttorney * rates.contractAttorney,
    juniorAssociate: roleHours.juniorAssociate * rates.juniorAssociate,
    seniorAssociate: roleHours.seniorAssociate * rates.seniorAssociate,
    partner: roleHours.partner * rates.partner,
  };

  const totalCost = Object.values(roleCosts).reduce((s, c) => s + c, 0);
  const totalHours = Object.values(roleHours).reduce((s, h) => s + h, 0);

  return { roleCosts, roleHours, aiProcessingCost: 0, totalHours, totalCost };
}

// ---------------------------------------------------------------------------
// computeAiCosts — verbatim from TaskCalculator.tsx:121-174
// ---------------------------------------------------------------------------

export function computeAiCosts(
  a: AiTaskHours,
  rates: Record<StaffingRole, number>,
  riskProfile: RiskProfile,
  docCount: number,
  privilegeFraction = 0.08,
  managedReviewShift = 0,
  aiEfficiencyOverride?: number,
): CostBreakdown {
  const privilegeDocs = Math.round(docCount * privilegeFraction);
  const keyDocs = Math.round(docCount * 0.02);
  const eff = aiEfficiencyOverride ?? riskProfile.aiEfficiency;
  const jf = riskProfile.juniorFraction;

  const rawJuniorVolumeQC = a.secondLevelReview * jf.volumeQC * eff;
  const shiftedToManagedReview = rawJuniorVolumeQC * managedReviewShift;

  const juniorHours =
    (rawJuniorVolumeQC - shiftedToManagedReview) +
    (a.secondLevelPrivilegeReview * jf.privilegeQC +
      a.secondLevelPrivilegeLogDrafting * jf.privilegeQC +
      a.secondLevelKeyDocIdentification * jf.keyDocQC) * eff;
  const seniorHours =
    (a.secondLevelReview * (1 - jf.volumeQC) +
      a.secondLevelPrivilegeReview * (1 - jf.privilegeQC) +
      a.secondLevelPrivilegeLogDrafting * (1 - jf.privilegeQC) +
      a.secondLevelKeyDocIdentification * (1 - jf.keyDocQC)) * eff;

  const roleHours: RoleHours = {
    contractAttorney: shiftedToManagedReview,
    juniorAssociate: juniorHours,
    seniorAssociate: seniorHours,
    partner: a.secondLevelKeyDocIdentification * 0.5 * riskProfile.partnerInvolvement,
  };

  const aiProcessingCost =
    docCount * AI_PROCESSING_RATES.initial +
    privilegeDocs * AI_PROCESSING_RATES.privilege +
    privilegeDocs * AI_PROCESSING_RATES.privilegeLog +
    keyDocs * AI_PROCESSING_RATES.keyDocId;

  const roleCosts: Record<StaffingRole, number> = {
    contractAttorney: roleHours.contractAttorney * rates.contractAttorney,
    juniorAssociate: roleHours.juniorAssociate * rates.juniorAssociate,
    seniorAssociate: roleHours.seniorAssociate * rates.seniorAssociate,
    partner: roleHours.partner * rates.partner,
  };

  const totalCost =
    Object.values(roleCosts).reduce((s, c) => s + c, 0) + aiProcessingCost;
  const totalHours = Object.values(roleHours).reduce((s, h) => s + h, 0);

  return { roleCosts, roleHours, aiProcessingCost, totalHours, totalCost };
}

// ---------------------------------------------------------------------------
// computeSavings — new
// ---------------------------------------------------------------------------

export function computeSavings(
  traditionalCost: number,
  aiCost: number,
): SavingsResult {
  const amount = traditionalCost - aiCost;
  const percentage = traditionalCost === 0 ? 0 : (amount / traditionalCost) * 100;
  return { amount, percentage };
}

// ---------------------------------------------------------------------------
// computeTimeline — new
// ---------------------------------------------------------------------------

export function computeTimeline(
  traditionalHours: number,
  aiHumanHours: number,
  weeks: number,
  reviewers: number,
  workWeekHours: number,
): TimelineResult {
  const availableHours = weeks * reviewers * workWeekHours;
  const traditionalWeeksNeeded = Math.ceil(traditionalHours / (reviewers * workWeekHours));
  const aiWeeksNeeded = Math.ceil(aiHumanHours / (reviewers * workWeekHours));
  const traditionalFeasible = traditionalHours <= availableHours;
  const aiFeasible = aiHumanHours <= availableHours;
  return { availableHours, traditionalWeeksNeeded, aiWeeksNeeded, traditionalFeasible, aiFeasible };
}

// ---------------------------------------------------------------------------
// computeTraditionalTotalHours — new
// ---------------------------------------------------------------------------

export function computeTraditionalTotalHours(t: TraditionalTaskHours): number {
  return (
    t.initialReview +
    t.secondLevelReview +
    t.privilegeReview +
    t.secondLevelPrivilegeReview +
    t.privilegeLogDrafting +
    t.secondLevelPrivilegeLogDrafting +
    t.keyDocIdentification +
    t.secondLevelKeyDocIdentification
  );
}

// ---------------------------------------------------------------------------
// formatCurrency — extracted from fmt() in TaskCalculator.tsx:1295-1299
// ---------------------------------------------------------------------------

export function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000).toLocaleString('en-US')}K`;
  return `$${Math.round(n).toLocaleString('en-US')}`;
}
