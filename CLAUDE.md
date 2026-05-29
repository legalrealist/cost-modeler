# CLAUDE.md — sections to update

## Replace the existing "Deploy" section with:

```markdown
## Deploy

Hosted at `cost-modeler.legalhack.io` via Hostinger Node.js Web Apps.
GitHub auto-deploy: push to `main` → Hostinger pulls, runs `npm install`
+ `npm run build`, serves `dist/` as a static site. No manual steps.

- **Domain**: cost-modeler.legalhack.io (was legalhack.io/cost-modeler/)
- **Hostinger plan**: Business/Cloud (managed Node.js hosting)
- **Build command**: npm run build
- **Output**: dist/
- **Node version**: 22.x
- **Package manager**: npm
- **Framework**: Vite (auto-detected)

To deploy: just push to main.

```bash
git add -A && git commit -m "description of change" && git push origin main
```

Hostinger rebuilds automatically. Check hPanel → Websites → cost-modeler.legalhack.io
→ Deployments for build status and logs.

### Environment variables

Set production env vars in hPanel → Websites → cost-modeler.legalhack.io →
Environment Variables. Do NOT commit secrets to the repo.

Client-side variables must be prefixed with `VITE_` to be exposed to the
browser (Vite convention).
```


## Replace the existing "Stack" section's URL reference:

Change:
  "A static SPA at `legalhack.io/cost-modeler/`"
To:
  "A static SPA at `cost-modeler.legalhack.io`"


## Add a redirect note (optional but recommended):

```markdown
## Migration note (2026-05)

App moved from `legalhack.io/cost-modeler/` to `cost-modeler.legalhack.io`.
Add an .htaccess redirect on the old path so existing links don't break:

```apache
# In legalhack.io's public_html/cost-modeler/.htaccess
RewriteEngine On
RewriteRule ^(.*)$ https://cost-modeler.legalhack.io/$1 [R=301,L]
```

Also update any links in the Legal AI Landscape blog posts on legalhack.io
that point to /cost-modeler/ — they should now point to cost-modeler.legalhack.io.
```


## Update the .claude/commands/deploy.md to:

```markdown
---
description: Build, test, and push to auto-deploy on Hostinger
---

Run the full deploy pipeline:

1. Run `npx tsx test-calculator.ts` — check scenario tests
2. Run `npx tsx stress-test.ts` — check edge case tests  
3. Run `npx tsc -b` — type-check
4. Run `npm run build` — verify build succeeds locally
5. Show the dist/ size summary
6. Run `git add -A && git commit -m "$ARGUMENTS" && git push origin main`
7. Report: commit hash, files changed, and note that Hostinger will auto-deploy from this push
```
