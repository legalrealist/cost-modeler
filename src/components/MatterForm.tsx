import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { MatterInputs } from '@/lib/calculator';
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

interface MatterFormProps {
  inputs: MatterInputs;
  onChange: (partial: Partial<MatterInputs>) => void;
  onChangeGigabytes: (gb: number) => void;
}

export function MatterForm({ inputs, onChange, onChangeGigabytes }: MatterFormProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Matter inputs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Volume — both doc count and GB visible, kept in sync */}
        <div>
          <Label className="text-sm font-medium">Volume</Label>
          <div className="grid grid-cols-2 gap-3 mt-1.5">
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
          <p className="text-xs text-muted-foreground mt-1.5">
            Editing one updates the other based on the selected corpus mix ({CORPUS_MIXES[inputs.corpusMix].docsPerGb.toLocaleString()} docs/GB).
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
              <SelectItem value="adversarial">Adversarial litigation production</SelectItem>
              <SelectItem value="investigation">Internal investigation</SelectItem>
              <SelectItem value="regulatory">Regulatory production (HSR / CID / subpoena)</SelectItem>
              <SelectItem value="post_production">Post-production analysis</SelectItem>
              <SelectItem value="compliance">Compliance / breach response</SelectItem>
            </SelectContent>
          </Select>
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
              <SelectItem value="low">Low — internal triage, post-production</SelectItem>
            </SelectContent>
          </Select>
        </div>

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
