import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { CalculatorOutput, CostRange, BudgetLineItem } from '@/lib/calculator';
import { formatCost } from '@/lib/calculator';
import type {
  RateOverrides,
  WorkflowPreset,
  LineItemId,
  BudgetState,
  StaffingOverridesMap,
  StaffingRow,
} from '@/lib/rate-overrides';
import { hasOverrides } from '@/lib/rate-overrides';
import { EditableLineItem } from '@/components/EditableLineItem';
import { StaffingDrilldown } from '@/components/StaffingDrilldown';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BudgetWorksheetProps {
  output: CalculatorOutput;
  budget: BudgetState;
  onPresetChange: (preset: WorkflowPreset) => void;
  onToggleItem: (id: LineItemId) => void;
  onOverride: (key: keyof RateOverrides, value: number | undefined) => void;
  onStaffingOverride: (key: keyof StaffingOverridesMap, rows: StaffingRow[] | undefined) => void;
  onResetBudget: () => void;
}

const STAFFING_KEY_MAP: Partial<Record<LineItemId, keyof StaffingOverridesMap>> = {
  humanReview: 'humanReview',
  humanPrivilege: 'humanPrivilege',
  projectManagement: 'projectManagement',
};

export function BudgetWorksheet({
  output,
  budget,
  onPresetChange,
  onToggleItem,
  onOverride,
  onStaffingOverride,
  onResetBudget,
}: BudgetWorksheetProps) {
  const { items, total } = output.budget;
  const anyOverrides = hasOverrides(budget.overrides);
  const allOverridden = items
    .filter((i) => i.enabled)
    .every((i) => i.isOverridden);

  const [expandedStaffing, setExpandedStaffing] = useState<Set<LineItemId>>(new Set());

  const toggleStaffing = (id: LineItemId) => {
    setExpandedStaffing((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Budget worksheet</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Click any rate to customize. Benchmark ranges shown as reference.
            </p>
          </div>
          {anyOverrides && (
            <Button variant="ghost" size="sm" onClick={onResetBudget} className="text-xs">
              <RotateCcw className="h-3 w-3" />
              Reset all
            </Button>
          )}
        </div>

        {/* Preset toggle */}
        <div className="flex gap-1 mt-3">
          <PresetButton
            label="Modern AI"
            active={budget.preset === 'modern'}
            onClick={() => onPresetChange('modern')}
          />
          <PresetButton
            label="Traditional"
            active={budget.preset === 'traditional'}
            onClick={() => onPresetChange('traditional')}
          />
        </div>
      </CardHeader>

      <CardContent>
        <table className="w-full">
          <thead>
            <tr className="text-xs text-muted-foreground border-b">
              <th className="pb-2 w-8"></th>
              <th className="pb-2 text-left font-medium">Line item</th>
              <th className="pb-2 text-right font-medium w-32">Rate</th>
              <th className="pb-2 text-right font-medium w-28">Cost</th>
              <th className="pb-2 w-6"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <LineItemWithStaffing
                key={item.lineItemId}
                item={item}
                isStaffingExpanded={expandedStaffing.has(item.lineItemId)}
                onToggle={onToggleItem}
                onOverride={onOverride}
                onToggleStaffing={() => toggleStaffing(item.lineItemId)}
                onStaffingCommit={(rows) => {
                  const staffingKey = STAFFING_KEY_MAP[item.lineItemId];
                  if (staffingKey) onStaffingOverride(staffingKey, rows);
                }}
                onStaffingClear={() => {
                  const staffingKey = STAFFING_KEY_MAP[item.lineItemId];
                  if (staffingKey) onStaffingOverride(staffingKey, undefined);
                }}
              />
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-foreground/20">
              <td></td>
              <td className="py-3 font-semibold text-sm">Total</td>
              <td></td>
              <td className="py-3 text-right font-mono font-semibold">
                {formatBudgetTotal(total, allOverridden)}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        {!allOverridden && (
          <p className="text-[10px] text-muted-foreground mt-2">
            Total shows a range because some rates use industry benchmarks.
            Customize all rates to get a single-number budget.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function LineItemWithStaffing({
  item,
  isStaffingExpanded,
  onToggle,
  onOverride,
  onToggleStaffing,
  onStaffingCommit,
  onStaffingClear,
}: {
  item: BudgetLineItem;
  isStaffingExpanded: boolean;
  onToggle: (id: LineItemId) => void;
  onOverride: (key: keyof RateOverrides, value: number | undefined) => void;
  onToggleStaffing: () => void;
  onStaffingCommit: (rows: StaffingRow[]) => void;
  onStaffingClear: () => void;
}) {
  return (
    <>
      <EditableLineItem
        item={item}
        onToggle={onToggle}
        onOverride={onOverride}
        hasStaffingExpander={item.hasStaffing && item.enabled}
        isStaffingExpanded={isStaffingExpanded}
        onToggleStaffing={onToggleStaffing}
      />
      {item.hasStaffing && item.enabled && isStaffingExpanded && item.defaultStaffing && (
        <StaffingDrilldown
          defaultRows={item.defaultStaffing}
          overrideRows={item.staffingOverride}
          onCommit={onStaffingCommit}
          onClear={onStaffingClear}
        />
      )}
    </>
  );
}

function PresetButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 text-xs rounded-md font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
      )}
    >
      {label}
    </button>
  );
}

function formatBudgetTotal(total: CostRange, allOverridden: boolean): string {
  if (allOverridden && total.low === total.high) {
    if (total.low >= 1_000_000) return `$${(total.low / 1_000_000).toFixed(2)}M`;
    if (total.low >= 1_000) return `$${Math.round(total.low / 1_000).toLocaleString('en-US')}K`;
    return `$${Math.round(total.low).toLocaleString('en-US')}`;
  }
  return formatCost(total);
}
