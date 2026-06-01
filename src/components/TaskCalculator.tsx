import { useState, useRef, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  STAFFING_ROLE_LABELS,
  type StaffingRole,
  type RiskProfile,
} from '@/lib/rate-overrides';
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
  traditionalTaskHours: TraditionalTaskHours;
  aiTaskHours: AiTaskHours;
  roleRates: Record<StaffingRole, number>;
  riskProfile: RiskProfile;
  privilegeFraction: number;
  onTraditionalTaskChange: (key: string, value: number) => void;
  onAiTaskChange: (key: string, value: number) => void;
  onRoleRateChange: (role: StaffingRole, value: number) => void;
  onResetTaskHours?: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AI_PROCESSING_RATES = {
  initial: 0.15,
  privilege: 0.35,
  privilegeLog: 0.50,
  keyDocId: 0.50,
};

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
): CostBreakdown {
  const privilegeDocs = Math.round(docCount * privilegeFraction);
  const keyDocs = Math.round(docCount * 0.02);
  const eff = riskProfile.aiEfficiency;
  const jf = riskProfile.juniorFraction;

  const juniorHours =
    (a.secondLevelReview * jf.volumeQC +
      a.secondLevelPrivilegeReview * jf.privilegeQC +
      a.secondLevelPrivilegeLogDrafting * jf.privilegeQC +
      a.secondLevelKeyDocIdentification * jf.keyDocQC) * eff;
  const seniorHours =
    (a.secondLevelReview * (1 - jf.volumeQC) +
      a.secondLevelPrivilegeReview * (1 - jf.privilegeQC) +
      a.secondLevelPrivilegeLogDrafting * (1 - jf.privilegeQC) +
      a.secondLevelKeyDocIdentification * (1 - jf.keyDocQC)) * eff;

  const roleHours: RoleHours = {
    contractAttorney: 0,
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
    contractAttorney: 0,
    juniorAssociate: roleHours.juniorAssociate * rates.juniorAssociate,
    seniorAssociate: roleHours.seniorAssociate * rates.seniorAssociate,
    partner: roleHours.partner * rates.partner,
  };

  const totalCost =
    Object.values(roleCosts).reduce((s, c) => s + c, 0) + aiProcessingCost;
  const totalHours = Object.values(roleHours).reduce((s, h) => s + h, 0);

  return { roleCosts, roleHours, aiProcessingCost, totalHours, totalCost };
}

export function computeCrossCheckCosts(
  rates: Record<StaffingRole, number>,
  docCount: number,
  privilegeFraction = 0.08,
): CostBreakdown {
  const privilegeDocs = Math.round(docCount * privilegeFraction);
  const keyDocs = Math.round(docCount * 0.02);

  const seniorHours = Math.ceil(docCount / 100_000) * 5;
  const partnerHours = Math.ceil(docCount / 250_000) * 3;

  const roleHours: RoleHours = {
    contractAttorney: 0,
    juniorAssociate: 0,
    seniorAssociate: seniorHours,
    partner: partnerHours,
  };

  const aiProcessingCost =
    docCount * AI_PROCESSING_RATES.initial +
    privilegeDocs * AI_PROCESSING_RATES.privilege +
    privilegeDocs * AI_PROCESSING_RATES.privilegeLog +
    keyDocs * AI_PROCESSING_RATES.keyDocId;

  const roleCosts: Record<StaffingRole, number> = {
    contractAttorney: 0,
    juniorAssociate: 0,
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
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
  prefix?: string;
  suffix?: string;
  disabled?: boolean;
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
          <div className="text-[10px] text-muted-foreground mt-0.5">
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
  addOnCost,
}: {
  title: string;
  breakdown: CostBreakdown;
  subtitle?: string;
  isAi?: boolean;
  docCount?: number;
  addOnCost?: number;
}) {
  const isAddOn = addOnCost !== undefined && addOnCost > 0;
  const combinedCost = isAddOn ? addOnCost + breakdown.totalCost : breakdown.totalCost;

  return (
    <Card className="flex-1">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        {subtitle && (
          <p className="text-[10px] text-muted-foreground">{subtitle}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {isAddOn ? (
          <>
            <div className="text-2xl font-bold font-mono">
              +${Math.round(breakdown.totalCost).toLocaleString('en-US')}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Combined with traditional: ${Math.round(combinedCost).toLocaleString('en-US')}
              {docCount && docCount > 0 && (
                <span className="ml-1">
                  · ${(combinedCost / docCount).toFixed(2)}/doc
                </span>
              )}
            </div>
          </>
        ) : (
          <>
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
          </>
        )}

        {/* Breakdown */}
        <div className="pt-2 border-t space-y-1">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            {isAddOn ? 'Cross-check cost' : 'Cost breakdown'}
          </span>

          {isAi && breakdown.aiProcessingCost > 0 && (
            <div className="flex justify-between text-xs py-1 px-1.5 bg-primary/5 rounded">
              <span className="font-medium text-primary">AI Processing</span>
              <span className="font-mono font-medium text-primary">
                ${Math.round(breakdown.aiProcessingCost).toLocaleString('en-US')}
              </span>
            </div>
          )}

          {ROLE_ORDER.map((role) => {
            const cost = breakdown.roleCosts[role];
            if (cost === 0) return null;
            return (
              <div
                key={role}
                className="flex justify-between text-xs py-1 px-1.5 bg-secondary/30 rounded"
              >
                <span>{STAFFING_ROLE_LABELS[role]}</span>
                <span className="font-mono">
                  ${Math.round(cost).toLocaleString('en-US')}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TaskCalculator({
  docCount,
  traditionalTaskHours,
  aiTaskHours,
  roleRates,
  riskProfile,
  privilegeFraction,
  onTraditionalTaskChange,
  onAiTaskChange,
  onRoleRateChange,
  onResetTaskHours,
}: TaskCalculatorProps) {
  const t = traditionalTaskHours;
  const a = aiTaskHours;
  const eff = riskProfile.aiEfficiency;
  const jf = riskProfile.juniorFraction;

  const traditionalBreakdown = useMemo(
    () => computeTraditionalCosts(t, roleRates, riskProfile),
    [t, roleRates, riskProfile],
  );
  const aiBreakdown = useMemo(
    () => computeAiCosts(a, roleRates, riskProfile, docCount, privilegeFraction),
    [a, roleRates, riskProfile, docCount, privilegeFraction],
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
    aiBreakdown.roleHours.juniorAssociate +
    aiBreakdown.roleHours.seniorAssociate +
    aiBreakdown.roleHours.partner;

  const effBadge = eff < 1.0 ? `${Math.round((1 - eff) * 100)}% faster` : undefined;

  return (
    <div className="space-y-6">
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
            <div className="space-y-1">
              <h4 className="text-sm font-semibold mb-3">
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
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-3">
                <h4 className="text-sm font-semibold">AI-Enhanced Approach</h4>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {riskProfile.label}
                </Badge>
              </div>

              <TaskGroup
                title="AI Processing"
                description="Automated by AI — no human hours required"
              >
                <AiProcessingRow label="Initial Review" />
                <AiProcessingRow label="Privilege Review" />
                <AiProcessingRow label="Privilege Log Drafting" />
                <AiProcessingRow label="Key Document Identification" />
              </TaskGroup>

              <TaskGroup
                title="Human Quality Control"
                description="Enhanced efficiency with AI assistance"
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
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Hourly rates</CardTitle>
          <p className="text-xs text-muted-foreground">
            Click any rate to customize.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* 3. Cost Comparison Section                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Cost comparison</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CostCard
            title="AI-Enhanced"
            breakdown={aiBreakdown}
            subtitle="AI processing + human QC"
            isAi
            docCount={docCount}
          />
          <CostCard
            title="Traditional"
            breakdown={traditionalBreakdown}
            subtitle="Full human review workflow"
            docCount={docCount}
          />
        </div>

        {/* Bar chart */}
        <Card>
          <CardContent className="pt-6">
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
          </CardContent>
        </Card>

        {/* Savings callout */}
        {savings > 0 && (
          <div className="flex items-center justify-center gap-3 bg-primary/5 border border-primary/20 rounded-md px-4 py-3">
            <span className="text-sm font-medium">AI-Enhanced savings:</span>
            <span className="text-lg font-bold font-mono text-primary">
              ${Math.round(savings).toLocaleString('en-US')}
            </span>
            <Badge variant="secondary" className="text-xs">
              {savingsPct.toFixed(1)}%
            </Badge>
          </div>
        )}

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
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setOpen(!open)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm text-blue-900">Client insights</CardTitle>
          <span className="text-xs text-blue-400">{open ? '▾' : '▸'}</span>
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

          {/* Efficiency Gains */}
          <div>
            <h4 className="font-semibold text-sm mb-2">Efficiency Gains</h4>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5 shrink-0">•</span>
                <span><strong>Faster case resolution.</strong> Complete document review {speedImprovement}% faster, getting to case merits sooner.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5 shrink-0">•</span>
                <span><strong>24/7 processing.</strong> AI works around the clock — no delays for nights, weekends, or holidays.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5 shrink-0">•</span>
                <span><strong>Consistent quality.</strong> AI doesn't have off days, fatigue, or attention lapses.</span>
              </li>
            </ul>
          </div>

          {/* Quality & Oversight */}
          <div>
            <h4 className="font-semibold text-sm mb-2">Quality & Oversight Maintained</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-medium mb-1">Human Oversight Structure</p>
                <div className="space-y-1 bg-secondary/20 rounded-md p-2">
                  <div className="flex justify-between"><span>AI Initial Processing:</span><span className="font-medium">100% automation</span></div>
                  <div className="flex justify-between"><span>Associate Quality Control:</span><span className="font-medium">{Math.round(aiBreakdown.roleHours.juniorAssociate + aiBreakdown.roleHours.seniorAssociate).toLocaleString()} hrs</span></div>
                  <div className="flex justify-between"><span>Partner Strategic Review:</span><span className="font-medium">{Math.round(aiBreakdown.roleHours.partner).toLocaleString()} hrs</span></div>
                </div>
              </div>
              <div>
                <p className="font-medium mb-1">Quality Protections</p>
                <ul className="space-y-1">
                  <li>• Two-level human review of all AI decisions</li>
                  <li>• Senior attorney oversight on privilege calls</li>
                  <li>• Complete audit trail of all decisions</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Realistic Expectations */}
          <div>
            <h4 className="font-semibold text-sm mb-2">Realistic Expectations</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-medium mb-1">What AI Does Well</p>
                <ul className="space-y-1">
                  <li>• High-volume document classification</li>
                  <li>• Consistent application of review criteria</li>
                  <li>• Pattern recognition across large datasets</li>
                  <li>• Fast privilege identification</li>
                </ul>
              </div>
              <div>
                <p className="font-medium mb-1">What Still Requires Humans</p>
                <ul className="space-y-1">
                  <li>• Complex legal judgment calls</li>
                  <li>• Case strategy and legal arguments</li>
                  <li>• Client counseling and communication</li>
                  <li>• Unusual document types or formats</li>
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
                <p className="font-medium mb-1">Quality Control</p>
                <ul className="space-y-1">
                  <li>• "What's your quality control process for AI-reviewed documents?"</li>
                  <li>• "How do you train the AI on our specific case issues?"</li>
                  <li>• "How do you document AI decision rationale?"</li>
                  <li>• "What's your error rate with AI review?"</li>
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

  if (traditionalBreakdown.roleCosts.contractAttorney > 0 && aiBreakdown.roleCosts.contractAttorney === 0) {
    insights.push(
      `AI eliminates all contract attorney hours (${fmt(traditionalBreakdown.roleCosts.contractAttorney)} saved) by automating first-pass review.`
    );
  }

  if (riskLabel) {
    insights.push(
      `Risk profile: ${riskLabel}. QC depth, allocation, and AI efficiency are calibrated to this matter's oversight requirements.`
    );
  }

  if (insights.length === 0) return null;

  return (
    <Card>
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
