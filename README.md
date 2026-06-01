# eDiscovery Cost Calculator

Compare traditional vs AI-enhanced eDiscovery workflows. AI handles document processing so attorneys focus on judgment work — human corrections feed back to improve accuracy.

Live at [legalhack.io/budget/](https://legalhack.io/budget/). Companion to the [LegalRealist AI Landscape](https://legalrealist.ai) series.

## What it does

- **Two-workflow comparison** — Traditional (contract attorneys + law firm QC) vs AI-Enhanced (AI document processing + attorney judgment & QC)
- **Throughput-based hours** — 50 docs/hr initial review, 20 privilege, 5 privilege log, 10 key doc ID
- **9 risk profiles** — QC depth, junior/senior allocation, and AI efficiency tied to matter type (adversarial, regulatory, investigation, compliance) × defensibility level
- **AI workflow tuning** — adjustable AI efficiency gain (0–40%) and managed review shift (0–60% of volume QC from associates to contract attorneys)
- **Cost breakdown** — separates AI Processing, Managed Review ($50/hr), and Law Firm (junior/senior/partner at $750–$1,500/hr)
- **Client insights** — financial benefits, efficiency gains, quality & feedback loop, questions to ask your law firm, course correction scenarios
- **Click-to-edit everything** — task hours, billing rates, document volume, risk profile

## Stack

- Vite 5 + React 18 + TypeScript 5
- Tailwind CSS + shadcn/ui
- Recharts (stacked bar chart)
- No backend — inputs encoded in URL query params for shareable links

## Key files

- `src/lib/rate-overrides.ts` — risk profiles, throughput rates, task hour calculations
- `src/lib/use-inputs.ts` — URL-state hook, AI efficiency + managed review shift state
- `src/components/TaskCalculator.tsx` — cost computation, cost cards, bar chart, savings analysis, client insights
- `src/components/MatterForm.tsx` — matter inputs with document volume presets
- `src/pages/CostModelerPage.tsx` — page layout, two-column form + results

## Local development

```bash
npm install
npm run dev
# Opens at http://localhost:5173/index.dev.html
```

## Production build

```bash
npm run build
```

Deploys to Hostinger via hPanel Git auto-deploy. Build output goes to repo root (`index.html`, `assets/`).

## Billing rates

Rates are client-facing billing rates validated against Am Law 2025–2026 surveys (Thomson Reuters, Valeo Partners, EDRM):

| Role | Rate |
|------|------|
| Contract Attorney | $50/hr |
| Junior Associate | $750/hr |
| Senior Associate | $1,000/hr |
| Partner | $1,500/hr |

## AI processing rates

| Task | Per-doc rate |
|------|-------------|
| Initial review | $0.15 |
| Privilege review | $0.35 |
| Privilege log | $0.50 |
| Key doc ID | $0.50 |
