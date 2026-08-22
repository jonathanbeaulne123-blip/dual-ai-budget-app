# GitHub Workflow

Git is the history. GitHub is the shared private copy.

Hosted content: Hearth code, tests, living docs (`docs/STRATEGY.md` and kin), plus labeled nostalgia and Sheets-era reference. Never host Sheet exports, ODS workbooks, `Project Context.txt`, credentials, or recovery bundles. Do not treat `docs/nostalgia/` as the plan.

## One click to the kitchen

1. Open a pull request against `main`.
2. Jonathan merges it.

That merge is the publish. GitHub Actions **Cloudflare Workers** runs `pnpm build` then `wrangler deploy` to `https://hearth-books.jonathan-beaulne123.workers.dev/`.

To republish the current `main` without a new commit: GitHub → Actions → **Cloudflare Workers** → **Run workflow**.

Do not treat a preview hostname or a green pull-request build as the live site. `wrangler versions upload` is preview-only (`pnpm cf:preview`). Production is `pnpm cf:deploy` / `wrangler deploy`.

Once (dashboard, not git):

- GitHub → Settings → Secrets: `CLOUDFLARE_API_TOKEN` with **no wrapping quotes** (the account id is in `wrangler.jsonc`).
- GitHub → Settings → Variables: `VITE_GOOGLE_CLIENT_ID` = the public Google web client ID (never a client secret).
- Hercules talk (allowed, D-045): Cloudflare Worker secrets `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY` (`wrangler secret put …` or the Worker dashboard). Never `VITE_`. Never a GitHub Actions secret that Vite would bake into the SPA.
- Optional: Cloudflare hearth-books Settings → deploy command `rm -f dist/_redirects && npx wrangler deploy --assets=./dist` if Workers Builds stays connected.

Details: [ENVIRONMENTS.md](ENVIRONMENTS.md), [GOOGLE.md](GOOGLE.md), D-041.

## Everyday path

The canonical remote is `https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app`. Default branch is `main`.

Normal path: branch, one coherent change, `pnpm test`, pull request, Jonathan merges.

Apps Script is not on the working tree; recover it from tag `sheets-v0.0.31`.

Old GitHub workflow notes from the Sheets era: [reference/sheets-era/GITHUB_WORKFLOW.md](reference/sheets-era/GITHUB_WORKFLOW.md).
