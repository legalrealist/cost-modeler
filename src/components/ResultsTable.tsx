import { Info } from 'lucide-react';
import type { CalculatorOutput, FlagLevel } from '@/lib/calculator';
import { formatCost } from '@/lib/calculator';
import { SOURCES } from '@/lib/pricing-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const flagStyles: Record<FlagLevel, string> = {
  green: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  yellow: 'bg-amber-50 text-amber-900 border-amber-200',
  red: 'bg-red-50 text-red-900 border-red-200',
};

const flagLabels: Record<FlagLevel, string> = {
  green: '✓ Appropriate',
  yellow: '⚠ Caution',
  red: '✗ Not appropriate',
};

interface ResultsTableProps {
  output: CalculatorOutput;
}

export function ResultsTable({ output }: ResultsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Delivery model comparison</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-secondary/50">
              <tr>
                <th className="text-left py-3 px-4 font-medium">Delivery model</th>
                <th className="text-right py-3 px-4 font-medium">Cost</th>
                <th className="text-left py-3 px-4 font-medium">Time</th>
                <th className="text-left py-3 px-4 font-medium">Fit</th>
              </tr>
            </thead>
            <tbody>
              {output.deliveryModels.map((model) => {
                const source = SOURCES[model.primarySourceId as keyof typeof SOURCES];
                return (
                  <tr key={model.id} className="border-b last:border-b-0 align-top">
                    <td className="py-4 px-4">
                      <div className="font-medium">{model.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {model.description}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1.5 italic">
                        Includes: {model.whatsIncluded}
                      </div>
                      {source && (
                        <div className="mt-1.5">
                          <Tooltip delayDuration={150}>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                              >
                                <Info className="h-3 w-3" /> source
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
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right whitespace-nowrap font-mono text-sm">
                      {formatCost(model.cost)}
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap">{model.timeDescription}</td>
                    <td className="py-4 px-4">
                      <Tooltip delayDuration={150}>
                        <TooltipTrigger asChild>
                          <span
                            className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium cursor-help ${flagStyles[model.flag.level]}`}
                          >
                            {flagLabels[model.flag.level]}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-md">
                          <p className="text-xs">{model.flag.reason}</p>
                        </TooltipContent>
                      </Tooltip>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
