import { useState, useMemo } from 'react';
import { Scale, Share2, RotateCcw, Check } from 'lucide-react';
import { useMatterInputs, buildShareUrl } from '@/lib/use-inputs';
import { MatterForm } from '@/components/MatterForm';
import { TaskCalculator, ClientInsights, computeTraditionalCosts, computeAiCosts } from '@/components/TaskCalculator';
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
    riskProfile,
    setTraditionalTaskHour,
    setAiTaskHour,
    resetTaskCalculator,
    reset,
  } = useMatterInputs();
  const [copied, setCopied] = useState(false);

  const privFrac = inputs.privilegeRequired ? inputs.privilegeFraction : 0;
  const traditionalBreakdown = useMemo(
    () => computeTraditionalCosts(taskHours.traditional, roleRates, riskProfile),
    [taskHours.traditional, roleRates, riskProfile],
  );
  const aiBreakdown = useMemo(
    () => computeAiCosts(taskHours.ai, roleRates, riskProfile, inputs.documentCount, privFrac),
    [taskHours.ai, roleRates, riskProfile, inputs.documentCount, privFrac],
  );
  const traditionalTotalHours = Object.values(taskHours.traditional).reduce((s, h) => s + h, 0);
  const aiTotalHumanHours = aiBreakdown.roleHours.juniorAssociate + aiBreakdown.roleHours.seniorAssociate + aiBreakdown.roleHours.partner;

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

                <ClientInsights
                  traditionalBreakdown={traditionalBreakdown}
                  aiBreakdown={aiBreakdown}
                  traditionalHours={traditionalTotalHours}
                  aiHumanHours={aiTotalHumanHours}
                />
              </div>

              <div className="space-y-6 min-w-0">
                {/* Primary: Task Calculator */}
                <TaskCalculator
                  docCount={inputs.documentCount}
                  traditionalTaskHours={taskHours.traditional}
                  aiTaskHours={taskHours.ai}
                  roleRates={roleRates}
                  riskProfile={riskProfile}
                  privilegeFraction={inputs.privilegeRequired ? inputs.privilegeFraction : 0}
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
        Built as a companion to the LegalRealist AI Landscape series. Source citations
        link directly to the underlying surveys and benchmarks; no vendor relationships.
      </p>
    </div>
  );
}
