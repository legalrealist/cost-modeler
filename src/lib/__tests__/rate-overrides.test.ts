import { describe, it, expect } from 'vitest';
import { getDefaultTaskHours, getRiskProfile } from '../rate-overrides';

describe('getDefaultTaskHours', () => {
  const profile = getRiskProfile('regulatory', 'standard');

  it('computes first-level hours from throughput rates', () => {
    const result = getDefaultTaskHours(250_000, 20_000, 5_000, profile);

    expect(result.traditional.initialReview).toBe(Math.ceil(250_000 / 50));
    expect(result.traditional.privilegeReview).toBe(Math.ceil(20_000 / 20));
    expect(result.traditional.privilegeLogDrafting).toBe(Math.ceil(20_000 / 5));
    expect(result.traditional.keyDocIdentification).toBe(Math.ceil(5_000 / 10));
  });

  it('computes second-level hours as QC ratio of first-level', () => {
    const result = getDefaultTaskHours(250_000, 20_000, 5_000, profile);
    const initialReviewHrs = Math.ceil(250_000 / 50);

    expect(result.traditional.secondLevelReview).toBe(
      Math.ceil(initialReviewHrs * profile.qcRatios.review)
    );
  });

  it('AI hours only have second-level (no first-level)', () => {
    const result = getDefaultTaskHours(250_000, 20_000, 5_000, profile);

    expect(result.ai).not.toHaveProperty('initialReview');
    expect(result.ai).not.toHaveProperty('privilegeReview');
    expect(result.ai.secondLevelReview).toBe(result.traditional.secondLevelReview);
  });

  it('returns zero privilege hours when privilege count is zero', () => {
    const result = getDefaultTaskHours(100_000, 0, 2_000, profile);

    expect(result.traditional.privilegeReview).toBe(0);
    expect(result.traditional.privilegeLogDrafting).toBe(0);
    expect(result.traditional.secondLevelPrivilegeReview).toBe(0);
    expect(result.traditional.secondLevelPrivilegeLogDrafting).toBe(0);
  });
});

describe('getRiskProfile', () => {
  it('returns the correct named profile', () => {
    const profile = getRiskProfile('adversarial', 'high');
    expect(profile.label).toBe('Maximum oversight');
    expect(profile.partnerInvolvement).toBe(2.0);
  });

  it('returns default profile for unknown combinations', () => {
    const profile = getRiskProfile('compliance', 'low');
    expect(profile.label).toBe('Standard');
  });

  it('returns a defensive copy (mutations do not affect source)', () => {
    const a = getRiskProfile('adversarial', 'high');
    const b = getRiskProfile('adversarial', 'high');
    a.qcRatios.review = 999;
    expect(b.qcRatios.review).toBe(0.30);
  });
});
