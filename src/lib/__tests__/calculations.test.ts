import { describe, it, expect } from 'vitest';
import {
  computeTraditionalCosts,
  computeAiCosts,
  computeSavings,
  computeTimeline,
  computeTraditionalTotalHours,
  formatCurrency,
} from '../calculations';
import type { RiskProfile } from '../rate-overrides';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const STANDARD_PROFILE: RiskProfile = {
  label: 'Standard',
  qcRatios: { review: 0.10, privilege: 0.25, privilegeLog: 0.30, keyDoc: 0.15 },
  juniorFraction: { volumeQC: 0.85, privilegeQC: 0.70, keyDocQC: 0.55 },
  partnerInvolvement: 1.0,
  aiEfficiency: 0.85,
};

const RATES = {
  contractAttorney: 50,
  juniorAssociate: 750,
  seniorAssociate: 1000,
  partner: 1500,
};

// ---------------------------------------------------------------------------
// computeTraditionalCosts
// ---------------------------------------------------------------------------

describe('computeTraditionalCosts', () => {
  it('computes correct role hours and costs for a standard matter', () => {
    const t = {
      initialReview: 100,
      secondLevelReview: 10,
      privilegeReview: 20,
      secondLevelPrivilegeReview: 5,
      privilegeLogDrafting: 15,
      secondLevelPrivilegeLogDrafting: 4,
      keyDocIdentification: 8,
      secondLevelKeyDocIdentification: 2,
    };

    const result = computeTraditionalCosts(t, RATES, STANDARD_PROFILE);
    const jf = STANDARD_PROFILE.juniorFraction;

    // contractAttorney = initialReview + privilegeReview + privilegeLogDrafting
    const expectedCA = t.initialReview + t.privilegeReview + t.privilegeLogDrafting;
    expect(result.roleHours.contractAttorney).toBe(expectedCA);

    // juniorAssociate = secondLevelReview * volumeQC + secondLevelPrivilegeReview * privilegeQC +
    //                   secondLevelPrivilegeLogDrafting * privilegeQC + secondLevelKeyDocIdentification * keyDocQC
    const expectedJA =
      t.secondLevelReview * jf.volumeQC +
      t.secondLevelPrivilegeReview * jf.privilegeQC +
      t.secondLevelPrivilegeLogDrafting * jf.privilegeQC +
      t.secondLevelKeyDocIdentification * jf.keyDocQC;
    expect(result.roleHours.juniorAssociate).toBeCloseTo(expectedJA);

    // seniorAssociate = second-level remainders + keyDocIdentification * 0.5
    const expectedSA =
      t.secondLevelReview * (1 - jf.volumeQC) +
      t.secondLevelPrivilegeReview * (1 - jf.privilegeQC) +
      t.secondLevelPrivilegeLogDrafting * (1 - jf.privilegeQC) +
      t.secondLevelKeyDocIdentification * (1 - jf.keyDocQC) +
      t.keyDocIdentification * 0.5;
    expect(result.roleHours.seniorAssociate).toBeCloseTo(expectedSA);

    // partner = keyDocIdentification * 0.5 * partnerInvolvement
    const expectedPartner = t.keyDocIdentification * 0.5 * STANDARD_PROFILE.partnerInvolvement;
    expect(result.roleHours.partner).toBeCloseTo(expectedPartner);

    // aiProcessingCost should be 0 for traditional
    expect(result.aiProcessingCost).toBe(0);

    // totalCost should match sum of roleCosts
    const expectedTotalCost =
      result.roleCosts.contractAttorney +
      result.roleCosts.juniorAssociate +
      result.roleCosts.seniorAssociate +
      result.roleCosts.partner;
    expect(result.totalCost).toBeCloseTo(expectedTotalCost);
  });

  it('returns zero costs for zero-hour inputs', () => {
    const t = {
      initialReview: 0,
      secondLevelReview: 0,
      privilegeReview: 0,
      secondLevelPrivilegeReview: 0,
      privilegeLogDrafting: 0,
      secondLevelPrivilegeLogDrafting: 0,
      keyDocIdentification: 0,
      secondLevelKeyDocIdentification: 0,
    };

    const result = computeTraditionalCosts(t, RATES, STANDARD_PROFILE);
    expect(result.totalCost).toBe(0);
    expect(result.totalHours).toBe(0);
    expect(result.roleHours.contractAttorney).toBe(0);
    expect(result.roleHours.juniorAssociate).toBe(0);
    expect(result.roleHours.seniorAssociate).toBe(0);
    expect(result.roleHours.partner).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeAiCosts
// ---------------------------------------------------------------------------

describe('computeAiCosts', () => {
  const a = {
    secondLevelReview: 10,
    secondLevelPrivilegeReview: 5,
    secondLevelPrivilegeLogDrafting: 4,
    secondLevelKeyDocIdentification: 2,
  };

  it('computes AI processing cost from doc count and privilege fraction', () => {
    const docCount = 100_000;
    const privilegeFraction = 0.08;
    const privilegeDocs = Math.round(docCount * privilegeFraction);
    const keyDocs = Math.round(docCount * 0.02);

    const result = computeAiCosts(a, RATES, STANDARD_PROFILE, docCount, privilegeFraction);

    const expectedAiCost =
      docCount * 0.15 +
      privilegeDocs * 0.35 +
      privilegeDocs * 0.50 +
      keyDocs * 0.50;
    expect(result.aiProcessingCost).toBeCloseTo(expectedAiCost);
  });

  it('shifts junior hours to managed review when managedReviewShift > 0', () => {
    const docCount = 50_000;
    const managedReviewShift = 0.5;

    const resultNoShift = computeAiCosts(a, RATES, STANDARD_PROFILE, docCount, 0.08, 0);
    const resultWithShift = computeAiCosts(a, RATES, STANDARD_PROFILE, docCount, 0.08, managedReviewShift);

    // With shift, contract attorney hours should be greater than zero
    expect(resultWithShift.roleHours.contractAttorney).toBeGreaterThan(0);
    // With no shift, contract attorney gets nothing
    expect(resultNoShift.roleHours.contractAttorney).toBe(0);
    // Junior hours should be reduced
    expect(resultWithShift.roleHours.juniorAssociate).toBeLessThan(resultNoShift.roleHours.juniorAssociate);
  });

  it('uses aiEfficiencyOverride when provided instead of profile default', () => {
    const docCount = 50_000;
    const overrideEff = 1.0;

    const resultDefault = computeAiCosts(a, RATES, STANDARD_PROFILE, docCount);
    const resultOverride = computeAiCosts(a, RATES, STANDARD_PROFILE, docCount, 0.08, 0, overrideEff);

    // With efficiency override of 1.0 vs profile's 0.85, human hours should be higher
    expect(resultOverride.roleHours.juniorAssociate).toBeGreaterThan(resultDefault.roleHours.juniorAssociate);
  });

  it('includes aiProcessingCost in totalCost', () => {
    const docCount = 100_000;
    const result = computeAiCosts(a, RATES, STANDARD_PROFILE, docCount);

    const roleCostSum =
      result.roleCosts.contractAttorney +
      result.roleCosts.juniorAssociate +
      result.roleCosts.seniorAssociate +
      result.roleCosts.partner;

    expect(result.totalCost).toBeCloseTo(roleCostSum + result.aiProcessingCost);
    expect(result.aiProcessingCost).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// computeSavings
// ---------------------------------------------------------------------------

describe('computeSavings', () => {
  it('computes savings amount and percentage', () => {
    const result = computeSavings(100_000, 60_000);
    expect(result.amount).toBe(40_000);
    expect(result.percentage).toBeCloseTo(40);
  });

  it('handles zero traditional cost (returns 0, 0%)', () => {
    const result = computeSavings(0, 0);
    expect(result.amount).toBe(0);
    expect(result.percentage).toBe(0);
  });

  it('handles AI cost exceeding traditional (negative savings)', () => {
    const result = computeSavings(50_000, 80_000);
    expect(result.amount).toBe(-30_000);
    expect(result.percentage).toBeCloseTo(-60);
  });
});

// ---------------------------------------------------------------------------
// computeTimeline
// ---------------------------------------------------------------------------

describe('computeTimeline', () => {
  it('marks as infeasible when hours exceed capacity', () => {
    // 10 reviewers * 40 hrs/week * 4 weeks = 1,600 available hours
    const result = computeTimeline(2000, 2000, 4, 10, 40);
    expect(result.availableHours).toBe(1600);
    expect(result.traditionalFeasible).toBe(false);
    expect(result.aiFeasible).toBe(false);
  });

  it('marks both feasible when hours fit within capacity', () => {
    // 10 reviewers * 40 hrs/week * 8 weeks = 3,200 available hours
    const result = computeTimeline(1000, 800, 8, 10, 40);
    expect(result.availableHours).toBe(3200);
    expect(result.traditionalFeasible).toBe(true);
    expect(result.aiFeasible).toBe(true);
  });

  it('computes weeks needed correctly', () => {
    // 10 reviewers * 40 hrs/week = 400 hrs/week capacity
    // 1000 trad hrs → Math.ceil(1000/400) = 3 weeks
    // 500 ai hrs → Math.ceil(500/400) = 2 weeks
    const result = computeTimeline(1000, 500, 12, 10, 40);
    expect(result.traditionalWeeksNeeded).toBe(3);
    expect(result.aiWeeksNeeded).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// computeTraditionalTotalHours
// ---------------------------------------------------------------------------

describe('computeTraditionalTotalHours', () => {
  it('sums all 8 task hour fields correctly', () => {
    const t = {
      initialReview: 10,
      secondLevelReview: 20,
      privilegeReview: 30,
      secondLevelPrivilegeReview: 40,
      privilegeLogDrafting: 50,
      secondLevelPrivilegeLogDrafting: 60,
      keyDocIdentification: 70,
      secondLevelKeyDocIdentification: 80,
    };
    const result = computeTraditionalTotalHours(t);
    expect(result).toBe(10 + 20 + 30 + 40 + 50 + 60 + 70 + 80);
  });
});

// ---------------------------------------------------------------------------
// formatCurrency
// ---------------------------------------------------------------------------

describe('formatCurrency', () => {
  it('formats millions', () => {
    expect(formatCurrency(2_500_000)).toBe('$2.5M');
  });

  it('formats thousands', () => {
    expect(formatCurrency(45_000)).toBe('$45K');
  });

  it('formats small amounts', () => {
    expect(formatCurrency(500)).toBe('$500');
  });

  it('handles zero', () => {
    expect(formatCurrency(0)).toBe('$0');
  });
});
