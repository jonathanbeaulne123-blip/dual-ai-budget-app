# Hearth worksession — household card opening repair

- **Status:** CLOSED — Development deployed; live two-household canary pending
- **Opened:** 2026-08-31 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `dual-ai-budget-app`
- **Branch:** `codex/household-card-open-fix`
- **Baseline SHA:** `da7fe2e2b079d88a8d88e934f0641be932654b86`
- **Head SHA:** `0f03497087d98a4b1c50bd2a3a9b80b1fc64b04b` (released code commit)
- **PR or issue:** none
- **Risk:** Release
- **Decision owner:** Jonathan
- **Environment impact:** Development

## Household outcome

Selecting a household card opens the household and member seat named by that exact card. A second rapid click cannot race the first acceptance and leave a different ledger active.

## Budget delta (5)

`+3` — the household-selection boundary identifies and validates the intended accepted books before making them active.

## Engagement delta (3)

`+1` — the chooser behaves like a dependable front door instead of a decorative list.

## Verified baseline

- `origin/main` and the clean implementation worktree resolve to `da7fe2e2b079d88a8d88e934f0641be932654b86`.
- D-182 cards render as buttons, but their callback has no target argument; App closes over a discovered row separately.
- Discovered-card opening does not set the shared busy state or hold an immediate ref lock, so rapid selections can overlap PGlite acceptance.
- The active-device switcher sets busy state but has the same pre-render rapid-click window.
- Existing acceptance still routes discovered books through `acceptHouseholdWrite`; replica switching still ingests and inspects PGlite before adoption.

## Scope

### In scope

- Bind every card click to an explicit household id and, where applicable, member id.
- Resolve discovered membership from that exact target and refuse missing/mismatched targets.
- Serialize household opening across chooser and local replica cards.
- Refresh the local replica list after a successful discovered open.
- Focused click-routing, mismatch, and regression tests plus canon/evidence.

### Out of scope

- Ledger commands, sync transport, schema, hosted rows, secrets, Production continuity, or automatic household opening.
- Completing live two-account/two-device canary evidence.

## Acceptance evidence

- [x] Clicking each rendered card reports its own household/member target.
- [x] Discovered opening refuses a stale or mismatched card target, including a missing member id.
- [x] Overlapping opens cannot adopt two competing households; one shared synchronous gate covers discovered and local-replica opening.
- [x] The selected candidate still passes PGlite/accounting acceptance before activation.
- [x] Focused tests, Windows-native type/build checks, and independent review pass. The full wrapper's only failure is its known Unix-`bash` dependency on this Windows host.

## Plan

- [x] Make card target identity explicit and test it in rendered DOM.
- [x] Serialize App household selection and refresh accepted replicas.
- [x] Run focused and complete proof gates.
- [x] Record reviewer and handoff evidence.

## Evidence log

- 2026-08-31: fresh `git fetch origin main`; clean baseline confirmed at `da7fe2e2b079d88a8d88e934f0641be932654b86`.
- 2026-08-31: live Development session rendered the D-182 identity header; no destructive or hosted action was taken during inspection.
- 2026-08-31: corrected card target contract renders and reports the exact household/member pair; stale, wrong-member, missing-member, and missing-household targets are refused.
- 2026-08-31: after rebasing cleanly onto `origin/main@189ba9785c32b86177c8e8b00eaf990d1cf6c465`, focused proof passed 112 tests across card entry, invites, freshness, environment isolation, Production continuity, replicas, books, privacy, and Month-One coexistence.
- 2026-08-31: the exact rebased full Vitest run passed 1,336 tests in 204 files; one test failed only because Windows cannot launch its required Unix `bash` executable. Two live-only files and three tests remained intentionally skipped.
- 2026-08-31: `tsc --noEmit`, the Vite production build, Hercules Pro UI build, `dist/_redirects` absence, and `git diff --check` passed.
- 2026-08-31: books audit passed (53 focused tests), trust/privacy audit passed after strict null-member refusal (30 focused tests), and independent release verification passed (57 focused tests plus type check).
- 2026-08-31: no schema, hosted row, secret, environment flag, Production-continuity, ledger command, or sync transport change was made. No push, merge, or deployment was performed.
- 2026-08-31: Jonathan gave fresh action-time push/merge/Development-deploy approval. Branch `codex/household-card-open-fix` and `main` were pushed at released code commit `0f03497087d98a4b1c50bd2a3a9b80b1fc64b04b`.
- 2026-08-31: main CI `33428186193` and Cloudflare Workers deployment `33428186207` completed successfully. The live JavaScript exposed the exact stale-card, accepted-household mismatch, and card-target data markers; the signed-in Development page retained the member · household · local-time header.
- 2026-08-31: live inspection found a PGlite warning about renaming `v_net_worth.net_worth_cents` to `equity_cents`. The repair diff does not touch schema or ledger engine; this traces to the separately merged Month-One mainline and remains a separate follow-up. No financial or hosted-data repair was attempted inside this release.

## Decisions

- The card owns the target it announces. App must resolve that target at action time instead of trusting an unrelated closure.
- One household acceptance may run at a time. The first explicit selection holds the gate until it succeeds or fails.

## Remaining uncertainty

- Live Google chooser proof still requires a signed-out/two-account canary after a reviewed Development deployment.

## Handoff

The exact-target repair is merged and deployed to Development. A live two-authorized-household click-through remains the canary action, and the separately observed PGlite view-upgrade warning needs its own bounded repair review. Jonathan retains all Production, schema, secret, and hosted-data decisions.
