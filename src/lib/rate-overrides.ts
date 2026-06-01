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
