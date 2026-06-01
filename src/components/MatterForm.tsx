import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { MatterInputs } from '@/lib/calculator';
import type { RiskProfile } from '@/lib/rate-overrides';
import { CORPUS_MIXES } from '@/lib/pricing-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

interface MatterFormProps {
  inputs: MatterInputs;
  onChange: (partial: Partial<MatterInputs>) => void;
  onChangeGigabytes: (gb: number) => void;
  riskProfile: RiskProfile;
  presetRiskProfile: RiskProfile;
  isCustomProfile: boolean;
  onUpdateRiskProfile: (updater: (prev: RiskProfile) => RiskProfile) => void;
  onResetRiskProfile: () => void;
}

const DOC_PRESETS = [250_000, 500_000, 750_000, 1_000_000, 1_500_000, 2_000_000];

export function MatterForm({ inputs, onChange, onChangeGigabytes, riskProfile, presetRiskProfile, isCustomProfile, onUpdateRiskProfile, onResetRiskProfile }: MatterFormProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const docPresetValue = useMemo(() => {
    const match = DOC_PRESETS.find(p => p === inputs.documentCount);
    return match ? String(match) : 'custom';
  }, [inputs.documentCount]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Matter inputs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Volume */}
        <div>
          <Label className="text-sm font-medium">Document volume</Label>
          <Select
            value={docPresetValue}
            onValueChange={(v) => {
              if (v !== 'custom') {
                onChange({ documentCount: Number(v) });
              }
            }}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOC_PRESETS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M` : `${(n / 1_000).toFixed(0)}K`} documents
                </SelectItem>
              ))}
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          {docPresetValue === 'custom' && (
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <Label htmlFor="docCount" className="text-xs text-muted-foreground font-normal">
                  Documents
                </Label>
                <Input
                  id="docCount"
                  type="number"
                  min={0}
                  step={1000}
                  value={Math.round(inputs.documentCount)}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    onChange({ documentCount: Number.isFinite(v) && v >= 0 ? v : 0 });
                  }}
                />
              </div>
              <div>
                <Label htmlFor="gigabytes" className="text-xs text-muted-foreground font-normal">
                  Gigabytes
                </Label>
                <Input
                  id="gigabytes"
                  type="number"
                  min={0}
                  step={1}
                  value={Math.round(inputs.gigabytes)}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    onChangeGigabytes(Number.isFinite(v) && v >= 0 ? v : 0);
                  }}
                />
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-1.5">
            {Math.round(inputs.documentCount).toLocaleString()} docs · {Math.round(inputs.gigabytes)} GB ({CORPUS_MIXES[inputs.corpusMix].docsPerGb.toLocaleString()} docs/GB)
          </p>
        </div>

        {/* Matter type */}
        <div>
          <Label htmlFor="matterType" className="text-sm font-medium">
            Matter type
          </Label>
          <Select
            value={inputs.matterType}
            onValueChange={(v) => onChange({ matterType: v as MatterInputs['matterType'] })}
          >
            <SelectTrigger id="matterType" className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="regulatory">Regulatory production (HSR / CID / subpoena)</SelectItem>
              <SelectItem value="adversarial">Adversarial litigation production</SelectItem>
              <SelectItem value="investigation">Internal investigation</SelectItem>
              <SelectItem value="compliance">Compliance / breach response</SelectItem>
            </SelectContent>
          </Select>
          {inputs.matterType === 'adversarial' && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-2">
              *AI-assisted review has not been judicially blessed for adversarial litigation and must be negotiated via Rule 26(f) conference. Discuss with opposing counsel early — a Rule 26(f) stipulation on AI-assisted review avoids disputes at production.
            </p>
          )}
        </div>

        {/* Timeline */}
        <div>
          <Label htmlFor="weeks" className="text-sm font-medium">
            Timeline (weeks available)
          </Label>
          <Input
            id="weeks"
            type="number"
            min={1}
            step={1}
            value={inputs.weeks}
            onChange={(e) => {
              const v = Number(e.target.value);
              onChange({ weeks: Number.isFinite(v) && v >= 1 ? v : 1 });
            }}
            className="mt-1.5"
          />
        </div>

        {/* Defensibility */}
        <div>
          <Label htmlFor="defensibility" className="text-sm font-medium">
            Defensibility profile
          </Label>
          <Select
            value={inputs.defensibility}
            onValueChange={(v) => onChange({ defensibility: v as MatterInputs['defensibility'] })}
          >
            <SelectTrigger id="defensibility" className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">High — adversarial, sanctions risk</SelectItem>
              <SelectItem value="standard">Standard — regulatory, investigation</SelectItem>
              <SelectItem value="low">Low — internal triage, compliance</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Risk profile editor */}
        <button
          type="button"
          onClick={() => setProfileOpen(!profileOpen)}
          aria-expanded={profileOpen}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {profileOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Risk profile
          <Badge variant={isCustomProfile ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0 ml-1">
            {riskProfile.label}
          </Badge>
        </button>

        {profileOpen && (
          <div className="space-y-3 pl-5 border-l-2 border-indigo-200 bg-indigo-50/30 rounded-r-md p-3 -mr-2">
            {isCustomProfile && (
              <button
                type="button"
                onClick={onResetRiskProfile}
                className="text-xs text-primary hover:underline"
              >
                Reset to {presetRiskProfile.label} preset
              </button>
            )}

            <div>
              <Label className="text-xs font-medium">QC sampling rates</Label>
              <p className="text-[10px] text-muted-foreground mb-1.5">
                What % of first-level work gets second-level quality control
              </p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['review', 'Review'],
                  ['privilege', 'Privilege'],
                  ['privilegeLog', 'Priv log'],
                  ['keyDoc', 'Key doc'],
                ] as const).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <Label className="text-[10px] text-muted-foreground w-14 shrink-0">{label}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={5}
                      value={Math.round(riskProfile.qcRatios[key] * 100)}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(100, Number(e.target.value))) / 100;
                        onUpdateRiskProfile((p) => ({ ...p, qcRatios: { ...p.qcRatios, [key]: v } }));
                      }}
                      className="h-7 text-xs w-16"
                    />
                    <span className="text-[10px] text-muted-foreground">%</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium">Junior / senior allocation</Label>
              <p className="text-[10px] text-muted-foreground mb-1.5">
                How QC hours split between junior and senior associates
              </p>
              <div className="space-y-1.5">
                {([
                  ['volumeQC', 'Volume QC'],
                  ['privilegeQC', 'Privilege QC'],
                  ['keyDocQC', 'Key doc QC'],
                ] as const).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <Label className="text-[10px] text-muted-foreground w-20 shrink-0">{label}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={5}
                      value={Math.round(riskProfile.juniorFraction[key] * 100)}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(100, Number(e.target.value))) / 100;
                        onUpdateRiskProfile((p) => ({ ...p, juniorFraction: { ...p.juniorFraction, [key]: v } }));
                      }}
                      className="h-7 text-xs w-16"
                    />
                    <span className="text-[10px] text-muted-foreground">% jr</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Label className="text-[10px] text-muted-foreground w-20 shrink-0">Partner ×</Label>
              <Input
                type="number"
                min={0}
                max={5}
                step={0.5}
                value={riskProfile.partnerInvolvement}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(5, Number(e.target.value)));
                  onUpdateRiskProfile((p) => ({ ...p, partnerInvolvement: v }));
                }}
                className="h-7 text-xs w-16"
              />
              <span className="text-[10px] text-muted-foreground">key doc multiplier</span>
            </div>
          </div>
        )}

        {/* Privilege */}
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <Checkbox
              id="privilege"
              checked={inputs.privilegeRequired}
              onCheckedChange={(v) => onChange({ privilegeRequired: v === true })}
              className="mt-0.5"
            />
            <div>
              <Label htmlFor="privilege" className="text-sm font-medium cursor-pointer">
                Privilege review required
              </Label>
              <p className="text-xs text-muted-foreground">
                Adds privilege review costs at human ($4–8/doc) or AI ($5–15/entry) rates.
              </p>
            </div>
          </div>
          {inputs.privilegeRequired && (
            <div className="ml-6">
              <Label htmlFor="privFraction" className="text-xs text-muted-foreground font-normal">
                Privilege population (% of total documents)
              </Label>
              <Input
                id="privFraction"
                type="number"
                min={0}
                max={100}
                step={1}
                value={Math.round(inputs.privilegeFraction * 100)}
                onChange={(e) =>
                  onChange({ privilegeFraction: Math.max(0, Math.min(100, Number(e.target.value))) / 100 })
                }
                className="mt-1 w-24"
              />
            </div>
          )}
        </div>

        {/* Advanced section */}
        <button
          type="button"
          onClick={() => setAdvancedOpen(!advancedOpen)}
          aria-expanded={advancedOpen}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {advancedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Advanced
        </button>

        {advancedOpen && (
          <div className="space-y-4 pl-5 border-l-2 border-secondary">
            <div>
              <Label htmlFor="corpusMix" className="text-sm font-medium">
                Corpus mix
              </Label>
              <Select
                value={inputs.corpusMix}
                onValueChange={(v) => onChange({ corpusMix: v as MatterInputs['corpusMix'] })}
              >
                <SelectTrigger id="corpusMix" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(CORPUS_MIXES).map((mix) => (
                    <SelectItem key={mix.id} value={mix.id}>
                      {mix.label} ({mix.docsPerGb.toLocaleString()} docs/GB)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {CORPUS_MIXES[inputs.corpusMix].description}
              </p>
            </div>

            <div>
              <Label htmlFor="hostingMonths" className="text-sm font-medium">
                Hosting duration (months)
              </Label>
              <Input
                id="hostingMonths"
                type="number"
                min={1}
                step={1}
                value={inputs.hostingMonths}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  onChange({ hostingMonths: Number.isFinite(v) && v >= 1 ? v : 1 });
                }}
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Default: matter timeline + 6 months for post-production access.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
