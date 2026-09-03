# Hearth worksession — Fund next-out and consequence integration

- **Status:** CLOSED — PASS
- **Opened:** 2026-09-03 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/fund-next-out-consequence`
- **Baseline SHA:** `cd56cabc8917dfce13027f7a4f5601de7f1604b5`
- **Head SHA:** `64192e3dd754142e75bb5e29feb84ccee4558711` (reviewed implementation head; closure metadata follows)
- **PR or issue:** [#314](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/314)
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** none

## Household outcome

The Shared Fund desk shows what leaves next, what is spoken for, and the read-only consequence of confirming an open or held contribution before the Fund custodian consents.

## Budget delta (5)

`+3` — the authoritative Fund walk becomes a full next-out read, and the custodian gets a deterministic before/after consequence preview without a second balance or command bypass.

## Engagement delta (3)

`+2` — the Fund rail opens focused stages for next obligations, held motions, and recent decisions while reusing the established confirmation card.

## Verified baseline

- `origin/main` was fetched at `cd56cabc8917dfce13027f7a4f5601de7f1604b5`.
- Current `main` already contains the Fund walk, eight plates, rail, and drawer; the older widget attachment had no unapplied patch.
- `fund-next-out.patch` was based on `8dd07cf`; `fund-consequence.patch` depends on it.
- The source checkout contains unrelated work, so integration uses this dedicated worktree.
- Claims in the supplied apply notes are historical input only; all evidence below is current-branch evidence.

## Scope

### In scope

- Apply the two supplied patches in dependency order and reconcile the drawer-era seams.
- Preserve Fund custody, integer-cent arithmetic, projection confidence, and partner-personal privacy.
- Run an independent trust review and current verification before opening and merging a PR.

### Out of scope

- Schema, migrations, dependencies, secrets, deployments, hosted rows, Production data, and household data.
- Any new money command or automatic confirmation path.
- Reapplying the Fund widget foundation already on `main`.

## Acceptance evidence

- [x] Patch commits applied in dependency order and integrated with the current drawer.
- [x] Focused Fund tests, typecheck, AI verification, and build passed before review fixes.
- [x] Independent review reproduced privacy and what-if defects; merge was stopped.
- [x] Regression fixes and focused tests cover private labels, estimated inflow replacement, confidence copy, and actor-sensitive heading.
- [x] Post-fix type/build checks pass; the sole quick-gate timeout is isolated below with exact evidence.
- [x] Independent re-review passes.
- [x] No secret, export, workbook, chat, credential, or `.env` artifact is tracked.
- [x] PR has green hosted checks and Jonathan's explicit merge authorization; merge state and commit remain authoritative in the linked PR. No manual deployment is performed.

## Plan

- [x] Apply and inspect both patches.
- [x] Run the first focused verification and independent review.
- [x] Close all review findings and rerun the release gate.
- [x] Push and open the PR with green hosted checks; execute the authorized merge in this task.

## Evidence log

- `pnpm install --frozen-lockfile` — passed with the existing lockfile.
- `pnpm exec tsc --noEmit` — passed before review fixes.
- Fund-adjacent Vitest run — 10 files, 98 tests passed before review fixes.
- `pnpm ai:verify` — passed; 48 required files and two Clerk fences.
- `pnpm build` — passed before review fixes; existing PGlite/Vite warnings only.
- Independent review — `FAIL`; reproduced a partner-personal recurrence-label leak and hypothetical observed-inflow double count, and found two disclosure/state-consistency defects.
- Post-fix focused Vitest — 2 files, 25 tests passed.
- Post-fix Fund-adjacent Vitest — all 114 tests passed across the 10-file application run and isolated 4-test PGlite run. The combined run's first PGlite test crossed its 30-second timeout; the unchanged file passed 4/4 alone in 59.1 seconds.
- Post-fix `pnpm exec tsc --noEmit` — passed.
- Post-fix `pnpm ai:verify` and `pnpm build` — passed; existing PGlite/Vite warnings only.
- Independent re-review — `PASS`; the privacy, accounting parity, disclosure, actor-copy, stale-stage, and return-focus findings are closed.
- High-risk quick gate — diff, AI surface, TypeScript, discovery, and five focused files (58 tests) passed. The host took 477.9 seconds for TypeScript, then the first serial proof test crossed its fixed 15-second timeout at 16.9 seconds. Immediate isolated rerun passed all 7 proof tests in 13.3 seconds. Hosted CI remains the merge authority.
- An earlier concurrent broad fast suite and first high-risk quick gate were invalidated by severe host contention; unrelated 15-second PGlite/Hercules tests timed out while TypeScript took 454 seconds. They are not recorded as code failures or passing evidence.
- Hosted PR checks on implementation head `64192e3`: [CI run 33784139200](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33784139200) — `success`; [Cloudflare Workers run 33784139270](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33784139270) — `success`.
- Branch diff scan — no secret, credential, `.env`, chat export, workbook, archive, or key artifact detected.

## Decisions

- Use one PR with the original ordered patch commits because slice 6 directly depends on slice 5.
- Redact a personal-account recurrence to `Household obligation` at the common month-obligation projection while preserving its cents.
- Make hypothetical confirmation suppress the same member/date observed estimate, matching canonical real-confirm behavior.
- Preserve whether the spoken-for horizon is observed, confirmed, or month-end in stage copy.
- Resolve stale stage state before rendering and restore keyboard focus to the resolved heading when the drawer closes.

## Remaining uncertainty

- The local quick gate retains the isolated host-timeout classification above. The linked PR is the authority for its GitHub-generated final merge commit.
- Live Fund-stage browser proof could not use the existing local snapshot because its Fund is unopened and its PGlite receipt hash is in recovery; no household data was reset or altered for screenshots.

## Handoff

Closed with an independent PASS and green hosted checks. Jonathan is the release decision owner and explicitly authorized push and merge in this task; Codex is executing that merge without a separate manual deployment.
