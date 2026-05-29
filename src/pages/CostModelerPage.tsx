import { useMemo, useState } from 'react';
import { Scale, Share2, RotateCcw, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { calculate } from '@/lib/calculator';
import { useMatterInputs, buildShareUrl } from '@/lib/use-inputs';
import { MatterForm } from '@/components/MatterForm';
import { ResultsTable } from '@/components/ResultsTable';
import { BudgetWorksheet } from '@/components/BudgetWorksheet';
import { EditorialSummary, RecallReference } from '@/components/EditorialSummary';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TooltipProvider } from '@/components/ui/tooltip';

export function CostModelerPage() {
  const {
    inputs,
    setInputs,
    setGigabytes,
    budget,
    setPreset,
    setOverride,
    toggleLineItem,
    setStaffingOverride,
    resetBudget,
    reset,
  } = useMatterInputs();
  const [copied, setCopied] = useState(false);
  const [showBenchmarks, setShowBenchmarks] = useState(false);

  const output = useMemo(() => calculate(inputs, budget), [inputs, budget]);

  const handleShare = async () => {
    const url = buildShareUrl(inputs, budget);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link:', url);
    }
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="border-b bg-background sticky top-0 z-30">
          <div className="container flex items-center justify-between py-4">
            <div className="flex items-center gap-2 font-semibold">
              <Scale className="h-5 w-5" />
              <span>Document Review Cost Modeler</span>
            </div>
            <a
              href="https://legalhack.io"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              &larr; LegalHack
            </a>
          </div>
        </header>

        <main className="flex-1">
          <div className="container max-w-6xl py-8">
            {/* Intro */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-tight">
                Document review budget worksheet
              </h1>
              <p className="text-muted-foreground mt-2 max-w-3xl">
                Build a line-item budget for your matter. Start with a workflow preset,
                then click any rate to customize. Benchmark ranges from the Winter 2026
                ComplexDiscovery/EDRM survey are shown as reference — hover for sources.
              </p>
            </div>

            {/* Two-column layout: form on left, results on right */}
            <div className="grid lg:grid-cols-[380px_1fr] gap-6">
              <div className="space-y-4">
                <MatterForm
                  inputs={inputs}
                  onChange={(p) => setInputs(p)}
                  onChangeGigabytes={setGigabytes}
                />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleShare} className="flex-1">
                    {copied ? (
                      <>
                        <Check className="h-3 w-3" /> Copied
                      </>
                    ) : (
                      <>
                        <Share2 className="h-3 w-3" /> Share link
                      </>
                    )}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={reset}>
                    <RotateCcw className="h-3 w-3" /> Reset
                  </Button>
                </div>
              </div>

              <div className="space-y-6 min-w-0">
                {/* Primary: Budget Worksheet */}
                <BudgetWorksheet
                  output={output}
                  budget={budget}
                  onPresetChange={setPreset}
                  onToggleItem={toggleLineItem}
                  onOverride={setOverride}
                  onStaffingOverride={setStaffingOverride}
                  onResetBudget={resetBudget}
                />

                {/* Demoted: Market benchmarks (collapsible) */}
                <Card>
                  <button
                    type="button"
                    onClick={() => setShowBenchmarks(!showBenchmarks)}
                    className="w-full text-left"
                    aria-expanded={showBenchmarks}
                  >
                    <CardHeader className="hover:bg-secondary/30 transition-colors rounded-t-lg">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {showBenchmarks ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        Market comparison
                        <span className="text-sm font-normal text-muted-foreground ml-2">
                          Six delivery models at industry benchmark rates
                        </span>
                      </CardTitle>
                    </CardHeader>
                  </button>
                  {showBenchmarks && (
                    <CardContent className="space-y-6">
                      <ResultsTable output={output} />
                      <EditorialSummary output={output} />
                      <RecallReference />
                    </CardContent>
                  )}
                </Card>

                <Disclaimer />
              </div>
            </div>
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}

function Disclaimer() {
  return (
    <div className="text-xs text-muted-foreground space-y-2 pt-4 border-t">
      <p>
        <strong>About these numbers.</strong> Mid-market US benchmarks current as of early
        2026. Actual quotes vary by vendor, matter complexity, jurisdiction, and counterparty.
        Use the output as a procurement benchmark, not a binding estimate.
      </p>
      <p>
        <strong>What this estimate excludes:</strong> forensic collection, expert witnesses,
        deposition prep beyond AI summarization, trial graphics, motion practice, and any
        appellate work. The model covers review-phase costs only — typically 70–80% of total
        litigation spend per industry estimates, but not the whole picture.
      </p>
      <p>
        <strong>Not legal advice.</strong> Appropriateness flags reference Rule 26(f), Rule
        26(g), and defensibility considerations directionally. They do not replace specific
        procedural judgment from counsel familiar with your jurisdiction, judge, and
        counterparty.
      </p>
      <p>
        Built as a companion to the LegalHack Legal AI Landscape series. Source citations
        link directly to the underlying surveys and benchmarks; no vendor relationships.
      </p>
    </div>
  );
}
