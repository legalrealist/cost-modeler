import type { CalculatorOutput, FlagLevel } from '@/lib/calculator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CostPoint {
  label: string;
  cost: number;
  isUser?: boolean;
  flag?: FlagLevel;
}

const FLAG_DOTS: Record<FlagLevel, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-500',
  red: 'bg-red-500',
};

interface CostPositioningProps {
  output: CalculatorOutput;
  userTraditionalCost: number;
  userAiCost: number;
}

export function CostPositioning({
  output,
  userTraditionalCost,
  userAiCost,
}: CostPositioningProps) {
  const points: CostPoint[] = [];

  for (const model of output.deliveryModels) {
    if (model.id === 'raw_api') continue;
    const midpoint = (model.cost.low + model.cost.high) / 2;
    points.push({
      label: model.label,
      cost: midpoint,
      flag: model.flag.level,
    });
  }

  points.push({ label: 'Your Traditional', cost: userTraditionalCost, isUser: true });
  points.push({ label: 'Your AI-Enhanced', cost: userAiCost, isUser: true });

  points.sort((a, b) => a.cost - b.cost);

  const maxCost = Math.max(...points.map((p) => p.cost));
  const minCost = Math.min(...points.map((p) => p.cost));
  const range = maxCost - minCost || 1;

  const nearestTo = (userCost: number, label: string) => {
    const others = points.filter((p) => !p.isUser);
    if (others.length === 0) return '';
    let closest = others[0];
    for (const p of others) {
      if (Math.abs(p.cost - userCost) < Math.abs(closest.cost - userCost)) {
        closest = p;
      }
    }
    const diff = userCost - closest.cost;
    const pct = Math.abs(Math.round((diff / closest.cost) * 100));
    const direction = diff > 0 ? 'above' : 'below';
    return `${label} (${formatSingle(userCost)}) is ${pct}% ${direction} ${closest.label} (${formatSingle(closest.cost)})`;
  };

  const tradSummary = nearestTo(userTraditionalCost, 'Your Traditional budget');
  const aiSummary = nearestTo(userAiCost, 'Your AI-Enhanced budget');

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Where your budget lands</CardTitle>
        <p className="text-xs text-muted-foreground">
          Your calculated costs positioned against industry delivery models.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {points.map((point) => {
            const pct = ((point.cost - minCost) / range) * 100;
            return (
              <div key={point.label} className="flex items-center gap-3 text-xs">
                <div className="w-36 shrink-0 text-right truncate">
                  <span className={point.isUser ? 'font-semibold text-primary' : 'text-muted-foreground'}>
                    {point.label}
                  </span>
                </div>
                <div className="flex-1 relative h-5">
                  <div className="absolute inset-0 bg-secondary/50 rounded-full" />
                  <div
                    className={`absolute top-0 left-0 h-5 rounded-full transition-all ${
                      point.isUser ? 'bg-primary/80' : 'bg-muted-foreground/20'
                    }`}
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                  {point.flag && (
                    <div
                      className={`absolute top-1 right-1 w-2.5 h-2.5 rounded-full ${FLAG_DOTS[point.flag]}`}
                      title={point.flag === 'green' ? 'Appropriate' : point.flag === 'yellow' ? 'Caution' : 'Not appropriate'}
                    />
                  )}
                </div>
                <div className={`w-20 shrink-0 font-mono text-right ${point.isUser ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>
                  {formatSingle(point.cost)}
                </div>
              </div>
            );
          })}
        </div>

        {(tradSummary || aiSummary) && (
          <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
            {tradSummary && <p>{tradSummary}</p>}
            {aiSummary && <p>{aiSummary}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatSingle(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}
