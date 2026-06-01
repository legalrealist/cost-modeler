import { useState, useRef, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  STAFFING_ROLE_LABELS,
  type StaffingRole,
  type RiskProfile,
} from '@/lib/rate-overrides';
import { AI_PROCESSING_RATES } from '@/lib/pricing-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

export interface TaskCalculatorProps {
  docCount: number;
  weeks: number;
  traditionalTaskHours: TraditionalTaskHours;
  aiTaskHours: AiTaskHours;
  roleRates: Record<StaffingRole, number>;
  riskProfile: RiskProfile;
  privilegeFraction: number;
  aiEfficiencyOverride?: number;
  managedReviewShift: number;
  onTraditionalTaskChange: (key: string, value: number) => void;
  onAiTaskChange: (key: string, value: number) => void;
  onRoleRateChange: (role: StaffingRole, value: number) => void;
  onAiEfficiencyChange: (v: number) => void;
  onManagedReviewShiftChange: (v: number) => void;
  onResetTaskHours?: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLE_ORDER: StaffingRole[] = [
  'contractAttorney',
  'juniorAssociate',
  'seniorAssociate',
  'partner',
];

// ---------------------------------------------------------------------------
// Cost computation helpers
// ---------------------------------------------------------------------------

interface RoleHours {
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
// InlineNumberInput — click-to-edit pattern (from StaffingDrilldown)
// ---------------------------------------------------------------------------

function InlineNumberInput({
  value,
  onChange,
  className,
  prefix,
  suffix,
  disabled,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
  prefix?: string;
  suffix?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.select();
    }
  }, [editing]);

  const startEdit = () => {
    if (disabled) return;
    setEditValue(String(value));
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const num = parseFloat(editValue);
    if (Number.isFinite(num) && num >= 0) {
      onChange(num);
    }
  };

  if (editing) {
    return (
      <span className="inline-flex items-center gap-0.5">
        {prefix && <span className="text-muted-foreground">{prefix}</span>}
        <input
          ref={inputRef}
          type="number"
          min="0"
          step="1"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
          aria-label={ariaLabel}
          className={cn(
            'px-1 py-0 text-xs font-mono text-right border border-ring rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring',
            className,
          )}
        />
        {suffix && <span className="text-muted-foreground">{suffix}</span>}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      disabled={disabled}
      aria-label={ariaLabel ? `Edit ${ariaLabel}` : undefined}
      className={cn(
        'text-xs font-mono px-1 py-0 rounded transition-colors',
        disabled
          ? 'cursor-default text-muted-foreground'
          : 'hover:bg-secondary',
      )}
    >
      {prefix}
      {value.toLocaleString('en-US')}
      {suffix ? ` ${suffix}` : ''}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TaskGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-l-2 border-border bg-secondary/20 rounded-r-md p-3 mb-3">
      <div className="mb-2">
        <h5 className="text-sm font-semibold text-foreground">{title}</h5>
        {description && (
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {description}
          </p>
        )}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function TaskRow({
  label,
  value,
  onChange,
  allocation,
  efficiencyBadge,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  allocation?: string;
  efficiencyBadge?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 bg-background rounded border border-border/60">
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium text-foreground">{label}</span>
        {allocation && (
          <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
            {allocation}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <InlineNumberInput
          value={value}
          onChange={onChange}
          className="w-16"
          suffix="hrs"
          ariaLabel={`${label} hours`}
        />
        {efficiencyBadge && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {efficiencyBadge}
          </Badge>
        )}
      </div>
    </div>
  );
}

function AiProcessingRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 bg-primary/5 rounded border border-primary/20">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
        AI Processing
      </Badge>
    </div>
  );
}

function CostCard({
  title,
  breakdown,
  subtitle,
  isAi,
  docCount,
}: {
  title: string;
  breakdown: CostBreakdown;
  subtitle?: string;
  isAi?: boolean;
  docCount?: number;
}) {
  const managedReviewCost = breakdown.roleCosts.contractAttorney;
  const lawFirmCost =
    breakdown.roleCosts.juniorAssociate +
    breakdown.roleCosts.seniorAssociate +
    breakdown.roleCosts.partner;
  const lawFirmHours =
    breakdown.roleHours.juniorAssociate +
    breakdown.roleHours.seniorAssociate +
    breakdown.roleHours.partner;

  return (
    <Card className={cn('flex-1', isAi ? 'bg-blue-50/40 border-blue-200/60' : 'bg-stone-50/40 border-stone-200/60')}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        {subtitle && (
          <p className="text-[10px] text-muted-foreground">{subtitle}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-2xl font-bold font-mono">
          ${Math.round(breakdown.totalCost).toLocaleString('en-US')}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {Math.round(breakdown.totalHours).toLocaleString('en-US')} total hours
          {isAi && ' + AI processing'}
          {docCount && docCount > 0 && (
            <span className="ml-2">
              · ${(breakdown.totalCost / docCount).toFixed(2)}/doc
            </span>
          )}
        </div>

        {/* Breakdown by category */}
        <div className="pt-2 border-t space-y-2">
          {/* AI Processing */}
          {isAi && breakdown.aiProcessingCost > 0 && (
            <div>
              <span className="text-[10px] font-medium text-primary uppercase tracking-wider">AI Processing</span>
              <div className="flex justify-between text-xs py-1 px-1.5 bg-primary/5 rounded mt-0.5">
                <span className="font-medium text-primary">Platform cost</span>
                <span className="font-mono font-medium text-primary">
                  ${Math.round(breakdown.aiProcessingCost).toLocaleString('en-US')}
                </span>
              </div>
            </div>
          )}

          {/* Managed Review */}
          {managedReviewCost > 0 && (
            <div>
              <span className="text-[10px] font-medium text-violet-600 uppercase tracking-wider">
                Managed Review
              </span>
              <div className="flex justify-between text-xs py-1 px-1.5 bg-violet-50 rounded mt-0.5">
                <span>Contract Attorney <span className="text-muted-foreground">({Math.round(breakdown.roleHours.contractAttorney).toLocaleString()} hrs)</span></span>
                <span className="font-mono">${Math.round(managedReviewCost).toLocaleString('en-US')}</span>
              </div>
            </div>
          )}

          {/* Law Firm */}
          {lawFirmCost > 0 && (
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-amber-700 uppercase tracking-wider">
                  Law Firm
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {Math.round(lawFirmHours).toLocaleString()} hrs · ${Math.round(lawFirmCost).toLocaleString('en-US')}
                </span>
              </div>
              <div className="space-y-0.5 mt-0.5">
                {(['juniorAssociate', 'seniorAssociate', 'partner'] as const).map((role) => {
                  const cost = breakdown.roleCosts[role];
                  if (cost === 0) return null;
                  return (
                    <div
                      key={role}
                      className="flex justify-between text-xs py-1 px-1.5 bg-amber-50/50 rounded"
                    >
                      <span>{STAFFING_ROLE_LABELS[role]} <span className="text-muted-foreground">({Math.round(breakdown.roleHours[role]).toLocaleString()} hrs)</span></span>
                      <span className="font-mono">
                        ${Math.round(cost).toLocaleString('en-US')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const REVIEWERS = 25;
const WORK_WEEK_HOURS = 40;

export function TaskCalculator({
  docCount,
  weeks,
  traditionalTaskHours,
  aiTaskHours,
  roleRates,
  riskProfile,
  privilegeFraction,
  aiEfficiencyOverride,
  managedReviewShift,
  onTraditionalTaskChange,
  onAiTaskChange,
  onRoleRateChange,
  onAiEfficiencyChange,
  onManagedReviewShiftChange,
  onResetTaskHours,
}: TaskCalculatorProps) {
  const t = traditionalTaskHours;
  const a = aiTaskHours;
  const eff = aiEfficiencyOverride ?? riskProfile.aiEfficiency;
  const jf = riskProfile.juniorFraction;

  const traditionalBreakdown = useMemo(
    () => computeTraditionalCosts(t, roleRates, riskProfile),
    [t, roleRates, riskProfile],
  );
  const aiBreakdown = useMemo(
    () => computeAiCosts(a, roleRates, riskProfile, docCount, privilegeFraction, managedReviewShift, aiEfficiencyOverride),
    [a, roleRates, riskProfile, docCount, privilegeFraction, managedReviewShift, aiEfficiencyOverride],
  );
  const savings = traditionalBreakdown.totalCost - aiBreakdown.totalCost;
  const savingsPct =
    traditionalBreakdown.totalCost > 0
      ? (savings / traditionalBreakdown.totalCost) * 100
      : 0;

  const traditionalTotalHours =
    t.initialReview +
    t.secondLevelReview +
    t.privilegeReview +
    t.secondLevelPrivilegeReview +
    t.privilegeLogDrafting +
    t.secondLevelPrivilegeLogDrafting +
    t.keyDocIdentification +
    t.secondLevelKeyDocIdentification;

  const aiTotalHumanHours =
    aiBreakdown.roleHours.contractAttorney +
    aiBreakdown.roleHours.juniorAssociate +
    aiBreakdown.roleHours.seniorAssociate +
    aiBreakdown.roleHours.partner;

  const effBadge = eff < 1.0 ? `${Math.round((1 - eff) * 100)}% faster` : undefined;

  const availableHours = weeks * REVIEWERS * WORK_WEEK_HOURS;
  const traditionalWeeksNeeded = Math.ceil(traditionalTotalHours / (REVIEWERS * WORK_WEEK_HOURS));
  const aiWeeksNeeded = Math.ceil(aiTotalHumanHours / (REVIEWERS * WORK_WEEK_HOURS));
  const traditionalFeasible = traditionalTotalHours <= availableHours;
  const aiFeasible = aiTotalHumanHours <= availableHours;

  return (
    <div className="space-y-6">
      {/* Timeline feasibility warning */}
      {!traditionalFeasible && (
        <div className={cn(
          'text-xs px-4 py-3 rounded-md border',
          aiFeasible
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-red-50 border-red-200 text-red-800'
        )}>
          <strong>Timeline check:</strong>{' '}
          {aiFeasible ? (
            <>Traditional review needs ~{traditionalWeeksNeeded} weeks at {REVIEWERS} reviewers — exceeds your {weeks}-week timeline. AI-enhanced fits at ~{aiWeeksNeeded} weeks.</>
          ) : (
            <>Both workflows exceed your {weeks}-week timeline at {REVIEWERS} reviewers. Traditional needs ~{traditionalWeeksNeeded} weeks, AI-enhanced ~{aiWeeksNeeded} weeks. Consider increasing staffing or extending the timeline.</>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 1. Task Hours Section                                              */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Task hours & allocation</CardTitle>
            {onResetTaskHours && (
              <button
                type="button"
                onClick={onResetTaskHours}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Reset hours
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Click any hour value to edit. Tasks are allocated to roles per
            industry-standard staffing splits.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Traditional column */}
            <div className="space-y-1 bg-stone-50/50 rounded-lg p-3 -m-1">
              <h4 className="text-sm font-semibold mb-3 text-stone-800">
                Traditional Approach
              </h4>

              <TaskGroup
                title="Contract Attorney Tasks"
                description="Primary responsibility for initial work"
              >
                <TaskRow
                  label="Initial Review"
                  value={t.initialReview}
                  onChange={(v) => onTraditionalTaskChange('initialReview', v)}
                  allocation="100% Contract Attorney"
                />
                <TaskRow
                  label="Privilege Review"
                  value={t.privilegeReview}
                  onChange={(v) => onTraditionalTaskChange('privilegeReview', v)}
                  allocation="100% Contract Attorney"
                />
                <TaskRow
                  label="Privilege Log Drafting"
                  value={t.privilegeLogDrafting}
                  onChange={(v) =>
                    onTraditionalTaskChange('privilegeLogDrafting', v)
                  }
                  allocation="100% Contract Attorney"
                />
              </TaskGroup>

              <TaskGroup
                title="Second Level Tasks"
                description="Quality control split between Junior & Senior Associates"
              >
                <TaskRow
                  label="Second Level Review"
                  value={t.secondLevelReview}
                  onChange={(v) =>
                    onTraditionalTaskChange('secondLevelReview', v)
                  }
                  allocation={`Junior ${Math.round(jf.volumeQC * 100)}%: ${(t.secondLevelReview * jf.volumeQC).toFixed(0)} hrs | Senior ${Math.round((1 - jf.volumeQC) * 100)}%: ${(t.secondLevelReview * (1 - jf.volumeQC)).toFixed(0)} hrs`}
                />
                <TaskRow
                  label="Second Level Privilege Review"
                  value={t.secondLevelPrivilegeReview}
                  onChange={(v) =>
                    onTraditionalTaskChange('secondLevelPrivilegeReview', v)
                  }
                  allocation={`Junior ${Math.round(jf.privilegeQC * 100)}%: ${(t.secondLevelPrivilegeReview * jf.privilegeQC).toFixed(0)} hrs | Senior ${Math.round((1 - jf.privilegeQC) * 100)}%: ${(t.secondLevelPrivilegeReview * (1 - jf.privilegeQC)).toFixed(0)} hrs`}
                />
                <TaskRow
                  label="Second Level Privilege Log Drafting"
                  value={t.secondLevelPrivilegeLogDrafting}
                  onChange={(v) =>
                    onTraditionalTaskChange('secondLevelPrivilegeLogDrafting', v)
                  }
                  allocation={`Junior ${Math.round(jf.privilegeQC * 100)}%: ${(t.secondLevelPrivilegeLogDrafting * jf.privilegeQC).toFixed(0)} hrs | Senior ${Math.round((1 - jf.privilegeQC) * 100)}%: ${(t.secondLevelPrivilegeLogDrafting * (1 - jf.privilegeQC)).toFixed(0)} hrs`}
                />
                <TaskRow
                  label="Second Level Key Doc ID"
                  value={t.secondLevelKeyDocIdentification}
                  onChange={(v) =>
                    onTraditionalTaskChange(
                      'secondLevelKeyDocIdentification',
                      v,
                    )
                  }
                  allocation={`Junior ${Math.round(jf.keyDocQC * 100)}%: ${(t.secondLevelKeyDocIdentification * jf.keyDocQC).toFixed(0)} hrs | Senior ${Math.round((1 - jf.keyDocQC) * 100)}%: ${(t.secondLevelKeyDocIdentification * (1 - jf.keyDocQC)).toFixed(0)} hrs`}
                />
              </TaskGroup>

              <TaskGroup
                title="Partner Level Tasks"
                description="Senior oversight and strategic decisions"
              >
                <TaskRow
                  label="Key Document Identification"
                  value={t.keyDocIdentification}
                  onChange={(v) =>
                    onTraditionalTaskChange('keyDocIdentification', v)
                  }
                  allocation={`Senior: ${(t.keyDocIdentification * 0.5).toFixed(0)} hrs | Partner: ${(t.keyDocIdentification * 0.5).toFixed(0)} hrs`}
                />
              </TaskGroup>

              {/* Total */}
              <div className="flex justify-between items-center bg-secondary/40 border border-border rounded-md px-3 py-2">
                <span className="text-xs font-semibold">Total Human Hours</span>
                <span className="text-sm font-bold font-mono">
                  {traditionalTotalHours.toLocaleString('en-US')} hrs
                </span>
              </div>
            </div>

            {/* AI-Enhanced column */}
            <div className="space-y-1 bg-blue-50/50 rounded-lg p-3 -m-1">
              <div className="flex items-center gap-2 mb-3">
                <h4 className="text-sm font-semibold text-blue-900">AI-Enhanced Approach</h4>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {riskProfile.label}
                </Badge>
              </div>

              <TaskGroup
                title="AI Document Processing"
                description="AI handles volume processing — human corrections feed back to improve accuracy"
              >
                <AiProcessingRow label="Initial Review" />
                <AiProcessingRow label="Privilege Review" />
                <AiProcessingRow label="Privilege Log Drafting" />
                <AiProcessingRow label="Key Document Identification" />
              </TaskGroup>

              <TaskGroup
                title="Attorney Judgment & QC"
                description="Attorneys focus on nuanced review, edge cases, and correcting AI decisions"
              >
                <TaskRow
                  label="Second Level Review"
                  value={a.secondLevelReview}
                  onChange={(v) => onAiTaskChange('secondLevelReview', v)}
                  allocation={`Junior ${Math.round(jf.volumeQC * 100)}%: ${(a.secondLevelReview * jf.volumeQC * eff).toFixed(0)} hrs | Senior ${Math.round((1 - jf.volumeQC) * 100)}%: ${(a.secondLevelReview * (1 - jf.volumeQC) * eff).toFixed(0)} hrs`}
                  efficiencyBadge={effBadge}
                />
                <TaskRow
                  label="Second Level Privilege Review"
                  value={a.secondLevelPrivilegeReview}
                  onChange={(v) =>
                    onAiTaskChange('secondLevelPrivilegeReview', v)
                  }
                  allocation={`Junior ${Math.round(jf.privilegeQC * 100)}%: ${(a.secondLevelPrivilegeReview * jf.privilegeQC * eff).toFixed(0)} hrs | Senior ${Math.round((1 - jf.privilegeQC) * 100)}%: ${(a.secondLevelPrivilegeReview * (1 - jf.privilegeQC) * eff).toFixed(0)} hrs`}
                  efficiencyBadge={effBadge}
                />
                <TaskRow
                  label="Second Level Privilege Log Drafting"
                  value={a.secondLevelPrivilegeLogDrafting}
                  onChange={(v) =>
                    onAiTaskChange('secondLevelPrivilegeLogDrafting', v)
                  }
                  allocation={`Junior ${Math.round(jf.privilegeQC * 100)}%: ${(a.secondLevelPrivilegeLogDrafting * jf.privilegeQC * eff).toFixed(0)} hrs | Senior ${Math.round((1 - jf.privilegeQC) * 100)}%: ${(a.secondLevelPrivilegeLogDrafting * (1 - jf.privilegeQC) * eff).toFixed(0)} hrs`}
                  efficiencyBadge={effBadge}
                />
                <TaskRow
                  label="Second Level Key Doc ID"
                  value={a.secondLevelKeyDocIdentification}
                  onChange={(v) =>
                    onAiTaskChange('secondLevelKeyDocIdentification', v)
                  }
                  allocation={`Junior ${Math.round(jf.keyDocQC * 100)}%: ${(a.secondLevelKeyDocIdentification * jf.keyDocQC * eff).toFixed(0)} hrs | Senior ${Math.round((1 - jf.keyDocQC) * 100)}%: ${(a.secondLevelKeyDocIdentification * (1 - jf.keyDocQC) * eff).toFixed(0)} hrs | Partner: ${(a.secondLevelKeyDocIdentification * 0.5 * riskProfile.partnerInvolvement).toFixed(0)} hrs`}
                  efficiencyBadge={effBadge}
                />
              </TaskGroup>

              {/* Total */}
              <div className="flex justify-between items-center bg-secondary/40 border border-border rounded-md px-3 py-2">
                <div>
                  <span className="text-xs font-semibold">
                    Total Human Hours
                  </span>
                  <div className="text-[10px] text-muted-foreground">
                    + AI processing for{' '}
                    {docCount.toLocaleString('en-US')} documents
                  </div>
                </div>
                <span className="text-sm font-bold font-mono">
                  {Math.round(aiTotalHumanHours).toLocaleString('en-US')} hrs
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* 2. Hourly Rates Section                                            */}
      {/* ------------------------------------------------------------------ */}
      <Card className="bg-amber-50/30 border-amber-200/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Hourly rates</CardTitle>
          <p className="text-xs text-muted-foreground">
            Click any rate to customize.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {ROLE_ORDER.map((role) => (
              <div
                key={role}
                className="flex flex-col items-center gap-1 bg-secondary/20 rounded-md p-3 border border-border/60"
              >
                <span className="text-[11px] font-medium text-muted-foreground">
                  {STAFFING_ROLE_LABELS[role]}
                </span>
                <InlineNumberInput
                  value={roleRates[role]}
                  onChange={(v) => onRoleRateChange(role, v)}
                  className="w-20"
                  prefix="$"
                  suffix="/hr"
                  ariaLabel={`${STAFFING_ROLE_LABELS[role]} rate per hour`}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* 3. AI Tuning Controls                                              */}
      {/* ------------------------------------------------------------------ */}
      <Card className="bg-indigo-50/30 border-indigo-200/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">AI workflow tuning</CardTitle>
          <p className="text-xs text-muted-foreground">
            AI handles document processing so attorneys can focus on higher-value judgment work. Human corrections feed back to improve AI accuracy through the review.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* AI Efficiency */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium">AI efficiency gain</label>
                <span className="text-sm font-mono font-semibold">
                  {Math.round((1 - eff) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={40}
                step={5}
                value={Math.round((1 - eff) * 100)}
                onChange={(e) => onAiEfficiencyChange(1 - Number(e.target.value) / 100)}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                <span>0% (no gain)</span>
                <span>40% faster</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                AI pre-screens documents so attorneys review fewer items and focus on edge cases. Improves as human corrections feed back. Profile default: {Math.round((1 - riskProfile.aiEfficiency) * 100)}%.
              </p>
            </div>

            {/* Managed Review Shift */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium">Volume QC to managed review</label>
                <span className="text-sm font-mono font-semibold">
                  {Math.round(managedReviewShift * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={60}
                step={10}
                value={Math.round(managedReviewShift * 100)}
                onChange={(e) => onManagedReviewShiftChange(Number(e.target.value) / 100)}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                <span>0% (all associates)</span>
                <span>60% to contract attys</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                AI pre-screening makes volume QC straightforward enough for contract attorneys, freeing associates for nuanced privilege review, key document analysis, and case strategy.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* 4. Cost Comparison Section                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Cost comparison</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CostCard
            title="AI-Enhanced"
            breakdown={aiBreakdown}
            subtitle="AI processes documents, attorneys focus on judgment work"
            isAi
            docCount={docCount}
          />
          <CostCard
            title="Traditional"
            breakdown={traditionalBreakdown}
            subtitle="Full human review — attorneys handle volume and judgment"
            docCount={docCount}
          />
        </div>

        {/* Bar chart */}
        <Card className="bg-slate-50/40 border-slate-200/50" aria-label="Cost comparison bar chart">
          <CardContent className="pt-6">
            <div role="img" aria-label="Stacked bar chart comparing AI-Enhanced vs Traditional costs by role">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={[
                {
                  name: 'AI-Enhanced',
                  'AI Processing': aiBreakdown.aiProcessingCost,
                  'Junior Associate': aiBreakdown.roleCosts.juniorAssociate,
                  'Senior Associate': aiBreakdown.roleCosts.seniorAssociate,
                  'Partner': aiBreakdown.roleCosts.partner,
                },
                {
                  name: 'Traditional',
                  'Contract Attorney': traditionalBreakdown.roleCosts.contractAttorney,
                  'Junior Associate': traditionalBreakdown.roleCosts.juniorAssociate,
                  'Senior Associate': traditionalBreakdown.roleCosts.seniorAssociate,
                  'Partner': traditionalBreakdown.roleCosts.partner,
                },
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => `$${Math.round(Number(value)).toLocaleString('en-US')}`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Contract Attorney" stackId="a" fill="#8b5cf6" />
                <Bar dataKey="Junior Associate" stackId="a" fill="#22c55e" />
                <Bar dataKey="Senior Associate" stackId="a" fill="#f59e0b" />
                <Bar dataKey="Partner" stackId="a" fill="#ef4444" />
                <Bar dataKey="AI Processing" stackId="a" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Savings callout */}
        {savings > 0 && (() => {
          const tradLawFirmCost =
            traditionalBreakdown.roleCosts.juniorAssociate +
            traditionalBreakdown.roleCosts.seniorAssociate +
            traditionalBreakdown.roleCosts.partner;
          const aiLawFirmCost =
            aiBreakdown.roleCosts.juniorAssociate +
            aiBreakdown.roleCosts.seniorAssociate +
            aiBreakdown.roleCosts.partner;
          const lawFirmSavings = tradLawFirmCost - aiLawFirmCost;
          const managedReviewCost = traditionalBreakdown.roleCosts.contractAttorney;
          const managedReviewEliminated = managedReviewCost - aiBreakdown.roleCosts.contractAttorney;
          const tradLawFirmHours =
            traditionalBreakdown.roleHours.juniorAssociate +
            traditionalBreakdown.roleHours.seniorAssociate +
            traditionalBreakdown.roleHours.partner;
          const aiLawFirmHours =
            aiBreakdown.roleHours.juniorAssociate +
            aiBreakdown.roleHours.seniorAssociate +
            aiBreakdown.roleHours.partner;
          const lawFirmHoursPct = tradLawFirmHours > 0
            ? ((tradLawFirmHours - aiLawFirmHours) / tradLawFirmHours * 100)
            : 0;

          return (
            <Card className="bg-emerald-50/50 border-emerald-200">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Total savings</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold font-mono text-emerald-700">
                      ${Math.round(savings).toLocaleString('en-US')}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {savingsPct.toFixed(0)}%
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-white/60 rounded p-2">
                    <div className="text-muted-foreground mb-0.5">Law firm hours saved</div>
                    <div className="font-mono font-semibold">
                      {Math.round(tradLawFirmHours - aiLawFirmHours).toLocaleString()} hrs
                      <span className="text-muted-foreground font-normal ml-1">({lawFirmHoursPct.toFixed(0)}%)</span>
                    </div>
                    <div className="text-muted-foreground font-mono mt-0.5">
                      = ${Math.round(lawFirmSavings).toLocaleString('en-US')} saved
                    </div>
                  </div>
                  <div className="bg-white/60 rounded p-2">
                    <div className="text-muted-foreground mb-0.5">
                      {managedReviewShift > 0 ? 'Associates freed for judgment work' : 'Volume processing automated'}
                    </div>
                    <div className="font-mono font-semibold">
                      {managedReviewShift > 0 ? (
                        <>{Math.round(aiBreakdown.roleHours.contractAttorney).toLocaleString()} hrs volume QC → managed review</>
                      ) : (
                        <>{Math.round(traditionalBreakdown.roleHours.contractAttorney).toLocaleString()} hrs automated by AI</>
                      )}
                    </div>
                    <div className="text-muted-foreground font-mono mt-0.5">
                      {managedReviewShift > 0
                        ? `$${Math.round(aiBreakdown.roleCosts.contractAttorney).toLocaleString('en-US')} at $50/hr vs $${Math.round(managedReviewEliminated).toLocaleString('en-US')} at associate rates`
                        : `= $${Math.round(managedReviewCost).toLocaleString('en-US')} saved`}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Key takeaways */}
        <KeyTakeaways
          traditionalCost={traditionalBreakdown.totalCost}
          aiCost={aiBreakdown.totalCost}
          traditionalHours={traditionalTotalHours}
          aiHumanHours={aiTotalHumanHours}
          savings={savings}
          savingsPct={savingsPct}
          aiProcessingCost={aiBreakdown.aiProcessingCost}
          traditionalBreakdown={traditionalBreakdown}
          aiBreakdown={aiBreakdown}
          riskLabel={riskProfile.label}
        />

      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Client Insights (collapsible)
// ---------------------------------------------------------------------------

export function ClientInsights({
  traditionalBreakdown,
  aiBreakdown,
  traditionalHours,
  aiHumanHours,
}: {
  traditionalBreakdown: CostBreakdown;
  aiBreakdown: CostBreakdown;
  traditionalHours: number;
  aiHumanHours: number;
}) {
  const [open, setOpen] = useState(true);
  const speedImprovement = traditionalHours > 0
    ? Math.round((traditionalHours - aiHumanHours) / traditionalHours * 100)
    : 0;

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
      <CardHeader
        className="pb-2 cursor-pointer"
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open); } }}
        role="button"
        tabIndex={0}
        aria-expanded={open}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm text-blue-900">Client insights</CardTitle>
          <span className="text-xs text-blue-400" aria-hidden="true">{open ? '▾' : '▸'}</span>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-6 text-xs text-blue-950">
          {/* Financial Benefits */}
          <div>
            <h4 className="font-semibold text-sm mb-2">Financial Benefits</h4>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5 shrink-0">•</span>
                <span><strong>Lower legal bills.</strong> Document review costs drop from {fmt(traditionalBreakdown.totalCost)} to {fmt(aiBreakdown.totalCost)} with AI-enhanced review.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5 shrink-0">•</span>
                <span><strong>Predictable pricing.</strong> AI processing costs are fixed per-document, making legal budgets more reliable.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5 shrink-0">•</span>
                <span><strong>Volume economics.</strong> AI per-document costs stay flat or decrease with scale — unlike human review, which scales linearly.</span>
              </li>
            </ul>
          </div>

          {/* Time Savings & Strategic Advantage */}
          <div>
            <h4 className="font-semibold text-sm mb-2">Time Savings & Getting to Strategy Faster</h4>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5 shrink-0">•</span>
                <span><strong>{speedImprovement}% fewer human hours.</strong> Review that takes {Math.round(traditionalHours).toLocaleString()} hours traditionally completes in {Math.round(aiHumanHours).toLocaleString()} hours with AI — freeing {Math.round(traditionalHours - aiHumanHours).toLocaleString()} hours of attorney time.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5 shrink-0">•</span>
                <span><strong>Get to case merits sooner.</strong> When document review finishes in weeks instead of months, your legal team pivots to depositions, motions, and settlement strategy while the other side is still reviewing.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5 shrink-0">•</span>
                <span><strong>Key documents surface earlier.</strong> AI flags hot documents and privilege issues across the full corpus on day one — attorneys focus on the documents that matter instead of waiting for linear review to reach them.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5 shrink-0">•</span>
                <span><strong>24/7 processing.</strong> AI works around the clock. No delays for nights, weekends, holidays, or reviewer fatigue — the corpus is processed while your team sleeps.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5 shrink-0">•</span>
                <span><strong>Faster supplemental productions.</strong> When new custodians or document sources appear mid-case, AI processes the incremental corpus in hours, not weeks of re-staffing.</span>
              </li>
            </ul>
          </div>

          {/* Quality & Oversight */}
          <div>
            <h4 className="font-semibold text-sm mb-2">Quality & Continuous Improvement</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-medium mb-1">Human-AI Feedback Loop</p>
                <div className="space-y-1 bg-secondary/20 rounded-md p-2">
                  <div className="flex justify-between"><span>AI Document Processing:</span><span className="font-medium">100% of corpus</span></div>
                  <div className="flex justify-between"><span>Attorney Judgment & QC:</span><span className="font-medium">{Math.round(aiBreakdown.roleHours.contractAttorney + aiBreakdown.roleHours.juniorAssociate + aiBreakdown.roleHours.seniorAssociate).toLocaleString()} hrs</span></div>
                  <div className="flex justify-between"><span>Partner Strategic Review:</span><span className="font-medium">{Math.round(aiBreakdown.roleHours.partner).toLocaleString()} hrs</span></div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Human corrections feed back to improve AI accuracy — the model learns from attorney judgment calls throughout the review.
                </p>
              </div>
              <div>
                <p className="font-medium mb-1">Quality Protections</p>
                <ul className="space-y-1">
                  <li>• Attorney corrections improve AI accuracy in real time</li>
                  <li>• Senior oversight on privilege and key document calls</li>
                  <li>• Complete audit trail of AI decisions and human overrides</li>
                  <li>• AI flags edge cases for attorney judgment rather than guessing</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Realistic Expectations */}
          <div>
            <h4 className="font-semibold text-sm mb-2">Realistic Expectations</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-medium mb-1">AI Handles the Processing</p>
                <ul className="space-y-1">
                  <li>• High-volume document classification and coding</li>
                  <li>• Consistent application of review criteria</li>
                  <li>• Pattern recognition across large datasets</li>
                  <li>• Initial privilege screening and flagging</li>
                  <li>• Learns from attorney corrections throughout review</li>
                </ul>
              </div>
              <div>
                <p className="font-medium mb-1">Attorneys Focus on Judgment</p>
                <ul className="space-y-1">
                  <li>• Nuanced QC — reviewing and correcting AI decisions</li>
                  <li>• Complex privilege determinations</li>
                  <li>• Key document analysis and case strategy</li>
                  <li>• Edge cases AI flags for human review</li>
                  <li>• Client counseling on findings</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Questions to Ask Your Law Firm */}
          <div>
            <h4 className="font-semibold text-sm mb-2">Questions to Ask Your Law Firm</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-medium mb-1">Cost & Implementation</p>
                <ul className="space-y-1">
                  <li>• "How do you allocate costs between AI and human review?"</li>
                  <li>• "What's your AI cost pass-through policy?"</li>
                  <li>• "What volume discounts apply to our case size?"</li>
                  <li>• "How do AI savings get passed to clients?"</li>
                </ul>
              </div>
              <div>
                <p className="font-medium mb-1">Quality & Feedback Loop</p>
                <ul className="space-y-1">
                  <li>• "How do attorney corrections feed back into the AI model?"</li>
                  <li>• "How quickly does AI accuracy improve as reviewers correct decisions?"</li>
                  <li>• "How do you train the AI on our specific case issues?"</li>
                  <li>• "What's your error rate, and how does it trend through the review?"</li>
                </ul>
              </div>
              <div>
                <p className="font-medium mb-1">Timelines</p>
                <ul className="space-y-1">
                  <li>• "How much faster is AI review vs traditional?"</li>
                  <li>• "How do you plan to leverage faster review to advance case strategy?"</li>
                  <li>• "What are the key milestones and deliverable dates?"</li>
                </ul>
              </div>
              <div>
                <p className="font-medium mb-1">Transparency</p>
                <ul className="space-y-1">
                  <li>• "Can we see real-time accuracy metrics during the case?"</li>
                  <li>• "How do you validate AI accuracy?"</li>
                  <li>• "Can you guarantee data doesn't train other AI models?"</li>
                </ul>
              </div>
              <div>
                <p className="font-medium mb-1">Course Correction</p>
                <ul className="space-y-1">
                  <li>• "What happens when new custodians or document sources are identified mid-review?"</li>
                  <li>• "How do you handle supplemental productions without restarting from scratch?"</li>
                  <li>• "What's the process when reviewers discover errors — missed privilege, wrong coding calls?"</li>
                  <li>• "How quickly can you re-run AI models if review criteria change after production begins?"</li>
                  <li>• "What does a clawback or recall cost — both for privileged documents and for coding errors?"</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Key Takeaways
// ---------------------------------------------------------------------------

function KeyTakeaways({
  traditionalCost,
  aiCost,
  traditionalHours,
  aiHumanHours,
  savings,
  savingsPct,
  aiProcessingCost,
  traditionalBreakdown,
  aiBreakdown,
  riskLabel,
}: {
  traditionalCost: number;
  aiCost: number;
  traditionalHours: number;
  aiHumanHours: number;
  savings: number;
  savingsPct: number;
  aiProcessingCost: number;
  traditionalBreakdown: CostBreakdown;
  aiBreakdown: CostBreakdown;
  riskLabel?: string;
}) {
  const hoursSaved = traditionalHours - aiHumanHours;
  const hoursPct = traditionalHours > 0 ? (hoursSaved / traditionalHours) * 100 : 0;

  const biggestTraditionalRole = (Object.entries(traditionalBreakdown.roleCosts) as [StaffingRole, number][])
    .filter(([, c]) => c > 0)
    .sort(([, a], [, b]) => b - a)[0];

  const aiProcessingPct = aiCost > 0 ? (aiProcessingCost / aiCost) * 100 : 0;

  const insights: string[] = [];

  if (savings > 0) {
    insights.push(
      `AI-enhanced workflow saves ${fmt(savings)} (${savingsPct.toFixed(0)}%) compared to traditional review.`
    );
  } else if (savings < 0) {
    insights.push(
      `Traditional workflow is ${fmt(Math.abs(savings))} cheaper — AI overhead exceeds efficiency gains at this configuration.`
    );
  }

  if (hoursSaved > 0) {
    insights.push(
      `Human hours drop from ${traditionalHours.toLocaleString()} to ${aiHumanHours.toLocaleString()} — ${hoursPct.toFixed(0)}% reduction (${hoursSaved.toLocaleString()} fewer hours).`
    );
  }

  if (biggestTraditionalRole) {
    const [role, cost] = biggestTraditionalRole;
    const pct = (cost / traditionalCost) * 100;
    insights.push(
      `${STAFFING_ROLE_LABELS[role]} costs drive ${pct.toFixed(0)}% of the traditional budget (${fmt(cost)}).`
    );
  }

  if (aiProcessingCost > 0) {
    insights.push(
      `AI processing adds only ${fmt(aiProcessingCost)} (${aiProcessingPct.toFixed(1)}% of AI-enhanced total) — the real cost is still human QC.`
    );
  }

  if (traditionalBreakdown.roleCosts.contractAttorney > 0) {
    if (aiBreakdown.roleCosts.contractAttorney > 0) {
      const shiftSavings = aiBreakdown.roleHours.contractAttorney * 750 - aiBreakdown.roleCosts.contractAttorney;
      insights.push(
        `AI pre-screening frees ${Math.round(aiBreakdown.roleHours.contractAttorney).toLocaleString()} hrs of volume QC for managed review ($50/hr vs $750/hr), saving ${fmt(shiftSavings)} while associates focus on nuanced judgment work.`
      );
    } else {
      insights.push(
        `AI automates all document processing (${fmt(traditionalBreakdown.roleCosts.contractAttorney)} saved), freeing attorneys entirely for judgment-intensive tasks.`
      );
    }
  }

  if (riskLabel) {
    insights.push(
      `Risk profile: ${riskLabel}. QC depth, allocation, and AI efficiency are calibrated to this matter's oversight requirements.`
    );
  }

  if (insights.length === 0) return null;

  return (
    <Card className="bg-teal-50/30 border-teal-200/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Key takeaways</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {insights.map((insight, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="text-primary mt-0.5 shrink-0">•</span>
              <span>{insight}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000).toLocaleString('en-US')}K`;
  return `$${Math.round(n).toLocaleString('en-US')}`;
}
