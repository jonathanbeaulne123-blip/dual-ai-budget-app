# Hearth worksession — Plan V2 deployment guard

- **Status:** OPEN
- **Opened:** 2026-09-12 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/plan-v2-deploy-guard`
- **Baseline SHA:** `d152a973b71074030075e93c86d7dfa96adaa6e1`
- **Head SHA:** working tree
- **PR or issue:** none yet
- **Risk:** Release
- **Decision owner:** Jonathan
- **Environment impact:** Development

## Household outcome

Our Path keeps the current Protect, Prepare, Build, and Everyday planning system after every ordinary or accidentally unlabelled build. A deliberate legacy rollback remains possible.

## Budget delta (5)

Restores the accepted Plan authority and current planning read models without changing any record, projection formula, writer, or Final Confirm boundary.

## Engagement delta (3)

Restores Plan Studio and the Horizon A Household Home rather than silently returning Jonathan and Bianca to Categories/Sitdown.

## Verified baseline

- `origin/main@d152a973b71074030075e93c86d7dfa96adaa6e1`; clean new worktree.
- GitHub Cloudflare run `34689402121` for that SHA completed successfully and created Worker version `31eb5b2f-198d-4a61-9660-cd2381e2e4cd` at 10:49 UTC.
- Cloudflare then created distinct version `631ea28c-4723-47fb-abf1-5480a95b3033` at 10:49:55 UTC and promoted it to 100% at 10:59 UTC.
- The live bundle compiled the Plan flag default as `undefined`; the live Our Path visibly rendered legacy Household budgeted net, Categories, three-act Sitdown, and the old Kitty Banks entry.
- Inference: a separately built artifact without the Plan flag was promoted over the good `main` deployment. The Cloudflare deployment list does not identify which local or preview workflow created it.

## Scope

### In scope

- Make current Plan V2 fail safe when build metadata is absent or empty.
- Preserve explicit `0` and `false` as the documented rollback.
- Add focused regression tests, update current canon, merge, redeploy Development, and verify the live route.

### Out of scope

- Production continuity or deployment.
- Schema, hosted household data, ledger records, secrets, provider settings, or financial writers.
- Removing the legacy interface or its explicit rollback.

## Acceptance evidence

- [x] Unit tests prove missing/empty metadata stays current and explicit rollback stays legacy.
- [x] Change-focused High quick gate passes within its budget.
- [x] A build without `VITE_PLAN_SYSTEM_V2` compiles Plan V2 as active.
- [ ] Merged `main` deployment succeeds.
- [ ] Fresh live browser shows Our Path, Plan Studio, and Protect / Prepare / Build / Everyday; legacy Household budgeted net/Categories are absent.

## Plan

- [x] Reproduce and isolate the deployment replacement.
- [x] Implement the fail-safe feature switch and focused assertions.
- [x] Verify locally.
- [ ] Push, merge, deploy Development, and verify live.

## Evidence log

- `pnpm exec vitest run test/plan-system.test.ts test/vision-v2-slice-1.test.ts --maxWorkers=1`: 29 tests passed.
- `env -u VITE_PLAN_SYSTEM_V2 pnpm build`: production build passed; main bundle contains `return !(e==="0"||e==="false")`, proving absent metadata selects the current Plan.
- `pnpm test -- --risk=high --focus=test/plan-system.test.ts --focus=test/vision-v2-slice-1.test.ts --focus-reason="Plan V2 must remain active when build metadata is missing while explicit legacy rollback stays available"`: quick gate passed in 68.622 seconds, 67 tests across five selected files, no time-budget breach, `uiProofRequired:false`.

## Decisions

- D-248: missing build metadata means current presentation, not rollback. Rollback must be explicit.

## Remaining uncertainty

The actor or process that promoted the second Cloudflare version is not named by the read-only deployment metadata.

## Handoff

Codex owns implementation and Development restoration. Jonathan retains Production and explicit rollback decisions.
