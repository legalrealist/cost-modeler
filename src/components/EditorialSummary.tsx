import { TrendingDown, BookOpen } from 'lucide-react';
import type { CalculatorOutput } from '@/lib/calculator';
import { formatCost } from '@/lib/calculator';
import { RECALL_BENCHMARKS, SOURCES } from '@/lib/pricing-data';
import { Card, CardContent } from '@/components/ui/card';

interface EditorialSummaryProps {
  output: CalculatorOutput;
}

export function EditorialSummary({ output }: EditorialSummaryProps) {
  const { summary } = output;

  // Suppress the spread framing for degenerate inputs.
  if (!summary) {
    if (output.inputs.documentCount === 0) {
      return (
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Enter a document count or volume to see cost estimates.
            </p>
          </CardContent>
        </Card>
      );
    }
    return null;
  }

  const spread = summary.spreadMultiplier;
  const spreadLabel = spread >= 2 ? `${spread.toFixed(1)}× spread` : 'modest spread';

  return (
    <Card className="border-2 border-primary/20 bg-primary/5">
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <TrendingDown className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="space-y-2">
            <p className="text-sm font-semibold">The spread on your matter</p>
            <p className="text-sm leading-relaxed">
              For this matter, total cost ranges from{' '}
              <span className="font-semibold text-foreground">
                {formatCost(summary.cheapestTotal)}
              </span>{' '}
              ({summary.cheapestLabel}) to{' '}
              <span className="font-semibold text-foreground">
                {formatCost(summary.costliestTotal)}
              </span>{' '}
              ({summary.costliestLabel}) — a <strong>{spreadLabel}</strong> on the same
              underlying work.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The gap is structural, not vendor-specific: traditional pricing fragments the
              work into separately-billed line items (hosting, processing, review, privilege
              log, production, project management), while modern all-inclusive pricing bundles
              them into a single per-GB rate. Show the math below to see this line by line.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function RecallReference() {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start gap-3 mb-3">
          <BookOpen className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">Recall benchmarks</p>
            <p className="text-xs text-muted-foreground">
              Cost is one dimension; recall is another. Cheaper review that misses 30% of
              relevant documents is not actually cheaper.
            </p>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="text-left py-2 font-medium">Method</th>
              <th className="text-right py-2 font-medium">Recall</th>
              <th className="text-left py-2 pl-4 font-medium hidden sm:table-cell">Source</th>
            </tr>
          </thead>
          <tbody>
            {RECALL_BENCHMARKS.map((b, i) => {
              const source = SOURCES[b.source];
              return (
                <tr key={i} className="border-b last:border-b-0">
                  <td className="py-2">{b.method}</td>
                  <td className="py-2 text-right font-mono text-xs">
                    {b.recallLow}–{b.recallHigh}%
                  </td>
                  <td className="py-2 pl-4 text-xs text-muted-foreground hidden sm:table-cell">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {source.label.split(',')[0]}
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-xs text-muted-foreground mt-3">
          GenAI recall figures are largely vendor-reported. Independent benchmarking at the
          rigor of the TREC Legal Track studies has not yet caught up.
        </p>
      </CardContent>
    </Card>
  );
}
