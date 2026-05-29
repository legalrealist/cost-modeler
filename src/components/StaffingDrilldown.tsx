import { useState, useRef, useEffect } from 'react';
import {
  STAFFING_ROLE_LABELS,
  staffingTotal,
  staffingTotalHours,
  type StaffingRow,
} from '@/lib/rate-overrides';
import { cn } from '@/lib/utils';

interface StaffingDrilldownProps {
  defaultRows: StaffingRow[];
  overrideRows?: StaffingRow[];
  onCommit: (rows: StaffingRow[]) => void;
  onClear: () => void;
}

export function StaffingDrilldown({
  defaultRows,
  overrideRows,
  onCommit,
  onClear,
}: StaffingDrilldownProps) {
  const rows = overrideRows ?? defaultRows;
  const total = staffingTotal(rows);
  const totalHours = staffingTotalHours(rows);
  const hasOverride = !!overrideRows;

  const updateRow = (index: number, field: 'hours' | 'rate', value: number) => {
    const next = rows.map((r, i) => (i === index ? { ...r, [field]: value } : r));
    onCommit(next);
  };

  return (
    <tr>
      <td></td>
      <td colSpan={4} className="pb-3">
        <div className="bg-secondary/30 rounded-md p-3 mt-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">
              Staffing breakdown
            </span>
            {hasOverride && (
              <button
                type="button"
                onClick={onClear}
                className="text-[10px] text-muted-foreground hover:text-foreground underline"
              >
                Reset to defaults
              </button>
            )}
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left font-medium pb-1 pr-4">Role</th>
                <th className="text-right font-medium pb-1 w-20 pr-2">Hours</th>
                <th className="text-right font-medium pb-1 w-24 pr-2">$/hr</th>
                <th className="text-right font-medium pb-1 w-24">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <StaffingRowInput
                  key={row.role}
                  row={row}
                  isOverridden={hasOverride}
                  onHoursChange={(v) => updateRow(i, 'hours', v)}
                  onRateChange={(v) => updateRow(i, 'rate', v)}
                />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t font-medium text-xs">
                <td className="pt-1.5">Total</td>
                <td className="pt-1.5 text-right pr-2">
                  {totalHours.toLocaleString('en-US')} hrs
                </td>
                <td></td>
                <td className="pt-1.5 text-right font-mono">
                  ${total.toLocaleString('en-US')}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </td>
    </tr>
  );
}

function StaffingRowInput({
  row,
  isOverridden,
  onHoursChange,
  onRateChange,
}: {
  row: StaffingRow;
  isOverridden: boolean;
  onHoursChange: (v: number) => void;
  onRateChange: (v: number) => void;
}) {
  const subtotal = row.hours * row.rate;

  return (
    <tr className="group">
      <td className="py-0.5 pr-4 text-foreground">
        {STAFFING_ROLE_LABELS[row.role]}
      </td>
      <td className="py-0.5 text-right pr-2">
        <InlineNumberInput
          value={row.hours}
          onChange={onHoursChange}
          className="w-16"
          suffix="hrs"
        />
      </td>
      <td className="py-0.5 text-right pr-2">
        <InlineNumberInput
          value={row.rate}
          onChange={onRateChange}
          className="w-20"
          prefix="$"
        />
      </td>
      <td className="py-0.5 text-right font-mono text-muted-foreground">
        ${subtotal.toLocaleString('en-US')}
      </td>
    </tr>
  );
}

function InlineNumberInput({
  value,
  onChange,
  className,
  prefix,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
  prefix?: string;
  suffix?: string;
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
      className="text-xs font-mono hover:bg-secondary px-1 py-0 rounded transition-colors"
    >
      {prefix}{value.toLocaleString('en-US')}{suffix ? ` ${suffix}` : ''}
    </button>
  );
}
