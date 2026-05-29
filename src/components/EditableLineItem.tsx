import { useState, useRef, useEffect } from 'react';
import { Info, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import type { BudgetLineItem, CostRange } from '@/lib/calculator';
import { formatCost } from '@/lib/calculator';
import type { RateOverrides, LineItemId } from '@/lib/rate-overrides';
import { benchmarkMidpoint } from '@/lib/rate-overrides';
import { SOURCES, type PricedRange } from '@/lib/pricing-data';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// Map rateKey to the benchmark PricedRange for display
import { PER_DOC_RATES, PER_GB_RATES, OTHER_RATES } from '@/lib/pricing-data';

const RATE_BENCHMARKS: Record<string, PricedRange> = {
  genaiAssistedReview: PER_DOC_RATES.genaiAssistedReview,
  humanResponsivenessFirstPass: PER_DOC_RATES.humanResponsivenessFirstPass,
  humanPrivilegeReview: PER_DOC_RATES.humanPrivilegeReview,
  hosting: PER_GB_RATES.hostingMidTier,
  processingLegacy: PER_GB_RATES.processingLegacy,
  projectManagementPerHour: OTHER_RATES.projectManagementPerHour,
  productionPerPage: OTHER_RATES.productionPerPage,
};

interface EditableLineItemProps {
  item: BudgetLineItem;
  onToggle: (id: LineItemId) => void;
  onOverride: (key: keyof RateOverrides, value: number | undefined) => void;
  hasStaffingExpander?: boolean;
  isStaffingExpanded?: boolean;
  onToggleStaffing?: () => void;
}

export function EditableLineItem({
  item,
  onToggle,
  onOverride,
  hasStaffingExpander,
  isStaffingExpanded,
  onToggleStaffing,
}: EditableLineItemProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const source = SOURCES[item.sourceId as keyof typeof SOURCES];
  const benchmark = item.rateKey ? RATE_BENCHMARKS[item.rateKey] : undefined;

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.select();
    }
  }, [editing]);

  const startEdit = () => {
    if (!item.enabled || !item.rateKey || !benchmark) return;
    const currentValue = item.isOverridden
      ? (item.cost.low / (item.quantity || 1))
      : benchmarkMidpoint(benchmark);
    setEditValue(currentValue.toFixed(2));
    setEditing(true);
  };

  const commitEdit = () => {
    setEditing(false);
    if (!item.rateKey) return;
    const num = parseFloat(editValue);
    if (!Number.isFinite(num) || num < 0) return;
    onOverride(item.rateKey, num);
  };

  const resetRate = () => {
    if (item.rateKey) {
      onOverride(item.rateKey, undefined);
    }
  };

  const formatRateDisplay = (): string => {
    if (!benchmark) return '';
    if (item.isOverridden) {
      const rate = item.quantity ? item.cost.low / item.quantity : 0;
      return `$${rate.toFixed(2)}`;
    }
    if (benchmark.low === benchmark.high) return `$${benchmark.low.toFixed(2)}`;
    return `$${benchmark.low}–$${benchmark.high}`;
  };

  return (
    <tr className={cn(
      'border-b last:border-b-0 group',
      !item.enabled && 'opacity-40',
    )}>
      {/* Toggle */}
      <td className="py-2.5 pr-2 w-8 align-top">
        <Checkbox
          checked={item.enabled}
          onCheckedChange={() => onToggle(item.lineItemId)}
          className="mt-0.5"
        />
      </td>

      {/* Label + formula + optional staffing expander */}
      <td className="py-2.5 pr-4 align-top">
        <div className="flex items-center gap-1">
          {hasStaffingExpander && (
            <button
              type="button"
              onClick={onToggleStaffing}
              className="text-muted-foreground hover:text-foreground -ml-1 p-0.5"
              title={isStaffingExpanded ? 'Collapse staffing' : 'Expand staffing breakdown'}
            >
              {isStaffingExpanded
                ? <ChevronDown className="h-3.5 w-3.5" />
                : <ChevronRight className="h-3.5 w-3.5" />
              }
            </button>
          )}
          <span className="text-sm">{item.label}</span>
        </div>
        {item.enabled && !isStaffingExpanded && (
          <div className="text-xs text-muted-foreground font-mono mt-0.5">
            {item.formula}
          </div>
        )}
        {item.enabled && item.useStaffingCost && (
          <div className="text-[10px] text-primary mt-0.5">
            Cost from staffing breakdown
          </div>
        )}
      </td>

      {/* Rate (click-to-edit) */}
      <td className="py-2.5 pr-2 text-right whitespace-nowrap align-top w-32">
        {item.enabled && benchmark && (
          editing ? (
            <div className="inline-flex items-center gap-1">
              <span className="text-xs text-muted-foreground">$</span>
              <input
                ref={inputRef}
                type="number"
                step="0.01"
                min="0"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEdit();
                  if (e.key === 'Escape') setEditing(false);
                }}
                className="w-20 px-1.5 py-0.5 text-xs font-mono text-right border border-ring rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <span className="text-xs text-muted-foreground">
                /{item.rateUnit?.replace('$/', '')}
              </span>
            </div>
          ) : (
            <div className="inline-flex flex-col items-end">
              <button
                type="button"
                onClick={startEdit}
                className={cn(
                  'text-xs font-mono px-1.5 py-0.5 rounded transition-colors',
                  item.isOverridden
                    ? 'bg-primary/10 text-primary hover:bg-primary/20'
                    : 'hover:bg-secondary text-muted-foreground',
                )}
              >
                {formatRateDisplay()}/{item.rateUnit?.replace('$/', '')}
              </button>
              {item.isOverridden && benchmark && (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">
                    benchmark: ${benchmark.low}–${benchmark.high}
                  </span>
                  <button
                    type="button"
                    onClick={resetRate}
                    className="text-muted-foreground hover:text-foreground"
                    title="Reset to benchmark"
                  >
                    <RotateCcw className="h-2.5 w-2.5" />
                  </button>
                </div>
              )}
            </div>
          )
        )}
      </td>

      {/* Cost total */}
      <td className="py-2.5 text-right whitespace-nowrap font-mono text-xs align-top w-28">
        {item.enabled && (
          <span className={item.isOverridden ? 'text-primary font-medium' : ''}>
            {formatBudgetCost(item.cost)}
          </span>
        )}
      </td>

      {/* Source citation */}
      <td className="py-2.5 pl-2 w-6 align-top">
        {item.enabled && source && (
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <button type="button" className="text-muted-foreground hover:text-foreground">
                <Info className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                <div className="font-medium">{source.label}</div>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline mt-1 inline-block"
                >
                  {new URL(source.url).hostname.replace('www.', '')}
                </a>
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </td>
    </tr>
  );
}

function formatBudgetCost(c: CostRange): string {
  if (c.low === c.high) {
    return formatSingleCost(c.low);
  }
  return formatCost(c);
}

function formatSingleCost(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000).toLocaleString('en-US')}K`;
  return `$${Math.round(n).toLocaleString('en-US')}`;
}
