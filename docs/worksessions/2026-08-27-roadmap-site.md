# Hearth worksession — durable roadmap site

- **Status:** RELEASE REVIEW — public/no-guard access selected; push/deploy confirmation pending
- **Opened:** 2026-08-27 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `C:\Users\jonat\OneDrive\Documents\ChatGPT\Budget App`
- **Branch:** `codex/roadmap-site`
- **Baseline SHA:** `001fa6c4ac31ebf305bc5168b52f7495afbbe721`
- **Head SHA:** `001fa6c4ac31ebf305bc5168b52f7495afbbe721` at open
- **PR or issue:** none
- **Risk:** Medium locally; Release if deployed
- **Decision owner:** Jonathan; public/no-guard access selected, final push/deployment confirmation still required
- **Environment impact:** none until separately approved deployment

## Household outcome

Jonathan can open one durable, mobile-friendly roadmap site at any time and expand it as Hearth grows, without exposing or mutating household books.

## Budget delta (5)

`+1` — makes money-truth, continuity, accessibility, and evidence gates easier to inspect and maintain; no financial semantics or records change.

## Engagement delta (3)

`+1` — turns project progress into a browsable, interactive artifact that is easier to revisit than source files.

## Verified baseline

- Current branch was cut from `origin/main@001fa6c`; local tracked tree was clean.
- Existing untracked `outputs/` and `tmp/` belong to prior work and are out of scope.
- Hearth already publishes Cloudflare Workers + Assets from GitHub `main` through `wrangler deploy`.
- The temporary roadmap is served only from localhost and its Canvas source opens as code in the current app.
- The proposed site contains project/audit information only. It must contain no ledger rows, credentials, household exports, or environment secrets.
- Jonathan selected public, indexable access with no login/privacy guard on 2026-08-27 because displayed names and data are synthetic. The exact reviewed push/deployment remains a separate approval.

## Scope

### In scope

- Add a static, read-only `/roadmap/` website to the existing Assets build.
- Separate structured roadmap data from rendering so future updates are additive and reviewable.
- Preserve the current audit scorecard, evidence gates, investor benchmark context, sources, and an explicit as-of baseline.
- Add maintenance documentation and canonical links.
- Verify build, tests, local route loading, responsive behavior, keyboard use, and reduced-motion behavior.

### Out of scope

- No deployment, push, merge, or Cloudflare access change without Jonathan's explicit decision.
- No change to ledger commands, Supabase, Auth/RLS, Worker APIs, secrets, Production data, or household snapshots.
- No deletion or replacement of canonical roadmap items.
- No live telemetry, analytics, forms, comments, or data collection.
- No claim that the 2026-08-27 audit snapshot is automatically current.

## Acceptance evidence

- [x] `/roadmap/` renders independently from the household app.
- [x] Lens and evidence-gate controls work with keyboard and pointer.
- [x] Content declares its audit date, baseline, evidence confidence, and unknown investor metrics.
- [x] Data can be expanded by editing one structured file.
- [x] No secrets, household rows, or runtime ledger access are present.
- [ ] `pnpm test` passes. Roadmap tests pass; the shared suite is red on two unrelated existing checks recorded below.
- [ ] `pnpm build` passes. The Windows runtime lacks the script's Unix `rm`/`test`; its exact TypeScript, Vite, Hercules Pro, asset-presence, and `_redirects` checks passed individually.
- [x] Local browser proof covers desktop and phone widths.
- [x] Public/no-guard access is explicit; push/deployment approval remains explicit.

## Plan

- [x] Verify canon, branch, hosting path, and current local artifact.
- [x] Implement static roadmap site and structured data.
- [x] Add maintenance/canon links without removing roadmap content.
- [x] Run automated and visual verification.
- [x] Close with the deployment choices and exact handoff.

## Evidence log

- 2026-08-27: `origin/main`, branch baseline, tracked-clean state, and Cloudflare Assets configuration verified.
- 2026-08-27: local main branch is stale, but the worksession baseline equals current `origin/main@001fa6c`.
- 2026-08-27: five focused roadmap tests pass. TypeScript, Vite production build, Hercules Pro UI build, built-asset presence, and `_redirects` absence pass using the configured Windows runtime.
- 2026-08-27: full `pnpm test` result is **889 passed, 2 skipped, 2 failed**. Failures are outside the roadmap: `test/api.test.ts` cannot spawn `bash` in this runtime; `test/companion-office-update.test.ts` expects LF in a source-string regex while the current shared `src/Hercules.tsx` is CRLF. No unrelated file was changed to hide either failure.
- 2026-08-27: real-browser proof passed at 1440×900 and 390×844. `/roadmap/` resolves to the standalone page, lens arrow keys and E5 pointer selection work, all 6 scores/6 gates/10 phases render, the phone layout has one-column score cards, no page-level horizontal overflow, and the console has no errors or warnings.
- 2026-08-27: D-154, the additive roadmap update, audit link, and site maintenance protocol were appended to canon without deleting existing roadmap content.
- 2026-08-27: Jonathan selected **public, no-guard** access because displayed people and data are synthetic. Added index/follow metadata, Open Graph identity, and canonical address `https://hearth-books.jonathan-beaulne123.workers.dev/roadmap/`. No push or deployment occurred.

## Decisions

- Use the existing Cloudflare Assets pipeline rather than introduce Vercel or a second hosting stack.
- Keep the roadmap read-only and data-separated. It never reads the household app, Supabase, local storage, or model endpoints.
- Build locally first. Jonathan selected public, indexable access with no login/privacy guard; the exact push/deployment remains a separate Release confirmation.

## Remaining uncertainty

- Whether Jonathan wants the public site linked from the kitchen UI later; the first release keeps it at the direct `/roadmap/` route.

## Handoff

Next owner: Codex for a clean release packet, then Jonathan for explicit push/deployment approval. Public/no-guard access and the permanent `/roadmap/` URL are decided. Current state is local branch only, not pushed, merged, or deployed; unrelated active shared-worktree changes must not enter the roadmap release.
