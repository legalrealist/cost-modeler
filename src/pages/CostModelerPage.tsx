import { useState } from 'react';
import { Scale, Share2, RotateCcw, Check } from 'lucide-react';
import { useMatterInputs, buildShareUrl } from '@/lib/use-inputs';
import { MatterForm } from '@/components/MatterForm';
import { TaskCalculator } from '@/components/TaskCalculator';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';

export function CostModelerPage() {
  const {
    inputs,
    setInputs,
    setGigabytes,
    roleRates,
    setRoleRate,
    taskHours,
    riskMultipliers,
    setTraditionalTaskHour,
    setAiTaskHour,
    resetTaskCalculator,
    reset,
  } = useMatterInputs();
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = buildShareUrl(inputs);
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
              <span>eDiscovery Cost Calculator</span>
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
                eDiscovery cost calculator
              </h1>
              <p className="text-muted-foreground mt-2 max-w-3xl">
                Compare traditional human review vs AI-enhanced workflows. Configure task hours,
                staffing rates, and matter risk profile — click any number to edit. Defaults
                scale with document count and risk level.
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
                {/* Primary: Task Calculator */}
                <TaskCalculator
                  docCount={inputs.documentCount}
                  traditionalTaskHours={taskHours.traditional}
                  aiTaskHours={taskHours.ai}
                  roleRates={roleRates}
                  aiEfficiency={riskMultipliers.aiEfficiencyReduction}
                  privilegeFraction={inputs.privilegeFraction}
                  riskLabel={getRiskLabel(inputs.matterType, inputs.defensibility)}
                  onTraditionalTaskChange={setTraditionalTaskHour}
                  onAiTaskChange={setAiTaskHour}
                  onRoleRateChange={setRoleRate}
                  onResetTaskHours={resetTaskCalculator}
                />

                <Disclaimer />
              </div>
            </div>
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}

function getRiskLabel(matterType: string, defensibility: string): string {
  const labels: Record<string, string> = {
    'adversarial:high': 'Maximum oversight',
    'adversarial:standard': 'High oversight',
    'adversarial:low': 'Standard oversight',
    'regulatory:high': 'High oversight',
    'regulatory:standard': 'Moderate oversight',
    'investigation:standard': 'Moderate oversight',
    'investigation:low': 'Reduced oversight',
    'post_production:high': 'Minimal oversight',
    'post_production:standard': 'Minimal oversight',
    'post_production:low': 'Minimal oversight',
    'compliance:high': 'Minimal oversight',
    'compliance:standard': 'Minimal oversight',
    'compliance:low': 'Minimal oversight',
  };
  return labels[`${matterType}:${defensibility}`] ?? 'Standard oversight';
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
