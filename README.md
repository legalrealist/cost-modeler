# Document Review Cost Modeler

Companion to *The Legal AI Landscape* series on legalhack.io. A static SPA that takes a description of a document review matter and produces cost-and-time estimates across six delivery models, with citations to the underlying pricing surveys.

Lives at `legalhack.io/cost-modeler/`.

## Stack

- Vite + React 18 + TypeScript
- Tailwind CSS + shadcn/ui primitives (inlined)
- No backend. Inputs encoded in URL query params for shareable links.
- ~95 KB gzipped JS, ~5 KB gzipped CSS.

## What's in here

- `src/lib/pricing-data.ts` — every number with a citation. Edit this file when the underlying surveys update; no code changes needed.
- `src/lib/calculator.ts` — pure functions that compute cost ranges and time estimates. Fully testable with no UI dependencies.
- `src/lib/use-inputs.ts` — URL-state hook that keeps inputs in query params for shareable links.
- `src/components/MatterForm.tsx` — five-input form with corpus-mix advanced toggle.
- `src/components/ResultsTable.tsx` — six-row delivery model comparison with hover citations.
- `src/components/LayeredBreakdown.tsx` — modern vs. traditional side-by-side line-item math.
- `src/components/EditorialSummary.tsx` — opinionated summary card and recall reference.

## Local development

```bash
npm install
npm run dev
# Opens at http://localhost:5173/cost-modeler/
```

## Production build

```bash
npm run build
npm run preview
# Preview at http://localhost:4173/cost-modeler/
```

Always preview the production build before deploying — `vite preview` catches base-path bugs and SPA-routing edge cases that don't show up in `dev`.

## Deploy to Hostinger

The build output goes to `dist/`. Upload its contents to:

```
~/domains/legalhack.io/public_html/cost-modeler/
```

The `.htaccess` file is in `public/` and gets copied into `dist/` at build time. It handles SPA routing, asset caching, and gzip.

```bash
# From local machine after npm run build:
rsync -avz --delete -e "ssh -p 65002" \
  ./dist/ \
  u123456789@legalhack.io:~/domains/legalhack.io/public_html/cost-modeler/
```

Replace `65002` with your Hostinger SSH port and `u123456789` with your hosting account ID.

## Updating pricing data

When the next ComplexDiscovery survey ships, or when DecoverAI republishes its benchmark:

1. Edit `src/lib/pricing-data.ts` — update the relevant `low`/`high` fields.
2. If a new source needs to be added, add it to the `SOURCES` registry at the top of the file with a label, URL, and `asOf` date.
3. Rebuild and redeploy.

No other code changes needed. The calculator and UI read from the data file at runtime.

## Editorial decisions baked in

- **GB → docs default: 7,500** (Digital WarRoom 2025 sample of 150M docs, configurable per matter)
- **Privilege population default: 8%** (user-editable)
- **Hosting time: matter timeline + 6 months** (user-editable)
- **Appropriateness flags: cautious** — yellow over green when there's any procedural exposure, red only when the model fundamentally can't satisfy the matter type
- **Editorial summary: opinionated** — calls out the cost spread between modern and traditional configurations as a structural finding
- **Spread calculation excludes raw API** — it's not a real procurement option for most matter types, and including it produces misleading 50–100× spreads. Raw API is shown in the table; just not in the headline.

## Things to verify before launch

1. **Plausible domain** — the script in `index.html` is configured for `legalhack.io`. Verify or adjust.
2. **Number sanity** — run the included `test-calculator.ts` against `tsx test-calculator.ts` to see scenario outputs and verify against your editorial intuition.
3. **Share URL test** — generate a shareable URL, paste in incognito, confirm inputs populate.
4. **Mobile layout** — the form is 380px wide on desktop; on mobile it wraps under the results. Verify on a phone before launch.
