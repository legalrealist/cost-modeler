# eDiscovery Cost Calculator

How much does AI-enhanced document review actually save? This calculator models the full cost of eDiscovery review — traditional vs AI-enhanced — so legal teams and clients can compare workflows with real numbers, not vendor marketing.

AI handles document processing (initial review, privilege screening, privilege log drafting, key document identification). Attorneys focus on what they're trained for: nuanced QC, complex privilege calls, key document analysis, and case strategy. Human corrections feed back to improve AI accuracy through the review.

**[Try it live →](https://legalhack.io/budget/)** | Companion to the [LegalRealist AI Landscape](https://legalrealist.ai) series

## What you can model

**Two workflows side by side:**
- **Traditional** — Contract attorneys handle first-pass review at $50/hr. Junior and senior associates do quality control. Partners oversee key document decisions. Every document touched by a human.
- **AI-Enhanced** — AI processes the full corpus. Attorneys review AI decisions, correct errors, and handle edge cases. Volume QC can shift to managed review ($50/hr) since AI pre-screening makes it straightforward, freeing associates for higher-value work.

**9 risk profiles** match real-world matter types — adversarial litigation (with Rule 26(f) disclaimer), regulatory productions (HSR/CID/subpoena), internal investigations, and compliance/breach response. Each profile calibrates QC depth, junior/senior allocation, partner involvement, and AI efficiency to the matter's oversight requirements.

**Two adjustable sliders** let you model scenarios:
- **AI efficiency gain** (0–40%) — how much AI pre-screening reduces human QC hours. Increases as attorneys correct AI decisions through the review.
- **Volume QC to managed review** (0–60%) — what fraction of routine QC shifts from associates ($750/hr) to contract attorneys ($50/hr), freeing the law firm team for judgment-intensive work.

**Everything is click-to-edit** — task hours, billing rates, document volume (presets from 250K to 2M), privilege population, risk profile. Shareable via URL.

## Sample output (250K docs, regulatory, standard defensibility)

| | Traditional | AI-Enhanced |
|---|---|---|
| **Total cost** | ~$3.2M | ~$1.8M |
| **Human hours** | 13,050 | 2,218 |
| **Cost per doc** | $12.95 | $7.28 |
| **AI processing** | — | $57K (3% of total) |

Savings: **~$1.4M (44%)**. The real cost in both workflows is human hours — AI processing is a rounding error.

## Client insights

The calculator includes a built-in client-facing insights panel covering:
- **Financial benefits** — cost reduction, predictable per-doc pricing, volume economics
- **Quality & feedback loop** — how attorney corrections improve AI accuracy in real time, audit trails, senior oversight on privilege
- **Realistic expectations** — what AI handles well vs what still requires human judgment
- **Questions to ask your law firm** — cost allocation, feedback loop mechanics, timelines, transparency, and course correction (new custodians mid-review, supplemental productions, clawback costs)

## Rates and sources

Billing rates are client-facing rates validated against Am Law 2025–2026 surveys (Thomson Reuters, Valeo Partners, EDRM):

| Role | Rate |
|------|------|
| Contract Attorney | $50/hr |
| Junior Associate | $750/hr |
| Senior Associate | $1,000/hr |
| Partner | $1,500/hr |

AI processing rates (per document):

| Task | Rate |
|------|------|
| Initial review | $0.15 |
| Privilege review | $0.35 |
| Privilege log | $0.50 |
| Key doc ID | $0.50 |

Review throughput benchmarks: 50 docs/hr (initial review), 20 docs/hr (privilege), 5 docs/hr (privilege log drafting), 10 docs/hr (key doc identification).

## For developers

**Stack:** Vite 5 + React 18 + TypeScript + Tailwind CSS + shadcn/ui + Recharts. No backend — all computation is client-side.

```bash
npm install
npm run dev          # http://localhost:5173/index.dev.html
npm run build        # production build to repo root
```

**Key files:**
- `src/lib/rate-overrides.ts` — risk profiles, throughput rates, task hour calculations
- `src/components/TaskCalculator.tsx` — cost computation, cost cards, bar chart, savings analysis, client insights
- `src/components/MatterForm.tsx` — matter inputs with document volume presets
- `src/lib/use-inputs.ts` — URL-state hook, AI efficiency + managed review shift state

## What this excludes

The model covers review-phase costs only — typically 70–80% of total litigation spend. It does not include forensic collection, expert witnesses, deposition prep, trial graphics, motion practice, or appellate work.
