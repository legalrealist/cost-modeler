import { useState } from 'react';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import type { CalculatorOutput, LineItem } from '@/lib/calculator';
import { formatCost } from '@/lib/calculator';
import { SOURCES } from '@/lib/pricing-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface LayeredBreakdownProps {
  output: CalculatorOutput;
}

export function LayeredBreakdown({ output }: LayeredBreakdownProps) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-left"
        aria-expanded={open}
      >
        <CardHeader className="hover:bg-secondary/30 transition-colors rounded-t-lg">
          <CardTitle className="text-lg flex items-center gap-2">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Show the math
            <span className="text-sm font-normal text-muted-foreground ml-2">
              Modern AI-managed vs. traditional configuration, line by line
            </span>
          </CardTitle>
        </CardHeader>
      </button>

      {open && (
        <CardContent className="space-y-6">
          <BreakdownColumn
            title="Modern AI-augmented managed services"
            subtitle="Components that build up to the AI managed services row above."
            items={output.layered.modernManaged.items}
            total={output.layered.modernManaged.total}
          />

          <BreakdownColumn
            title="Traditional managed review (TAR + human)"
            subtitle="Same matter, traditional pricing — fragmented into separately-billed line items."
            items={output.layered.traditional.items}
            total={output.layered.traditional.total}
          />

          <div className="rounded-md bg-secondary/50 p-4 text-xs text-muted-foreground">
            <p>
              <strong>Note on privilege log pricing:</strong> the per-entry rate ($5–15) is a
              legacy line-item pricing convention. Modern AI-native vendors typically bundle
              privilege log generation into their per-GB-month rate (the AI-native all-inclusive
              row). The breakdown above shows how legacy pricing fragments the same work into a
              separately-billed line.
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function BreakdownColumn({
  title,
  subtitle,
  items,
  total,
}: {
  title: string;
  subtitle: string;
  items: LineItem[];
  total: { low: number; high: number };
}) {
  return (
    <div>
      <h3 className="font-semibold text-sm">{title}</h3>
      <p className="text-xs text-muted-foreground mb-3">{subtitle}</p>
      <table className="w-full text-sm">
        <tbody>
          {items.map((item, i) => {
            const source = SOURCES[item.sourceId as keyof typeof SOURCES];
            return (
              <tr key={i} className="border-b last:border-b-0">
                <td className="py-2 pr-4">
                  <div>{item.label}</div>
                  <div className="text-xs text-muted-foreground font-mono">{item.formula}</div>
                </td>
                <td className="py-2 text-right whitespace-nowrap font-mono text-xs">
                  {formatCost(item.cost)}
                </td>
                <td className="py-2 pl-2 w-8">
                  {source && (
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
          })}
          <tr className="border-t-2 border-foreground/10 font-medium">
            <td className="py-2 pr-4">Subtotal</td>
            <td className="py-2 text-right whitespace-nowrap font-mono">{formatCost(total)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
