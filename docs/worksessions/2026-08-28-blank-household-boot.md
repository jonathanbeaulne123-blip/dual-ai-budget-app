# Hearth worksession — Blank kitchen when loading a household

- **Status:** CLOSED
- **Opened:** 2026-08-28 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor (cloud agent)
- **Repository:** dual-ai-budget-app
- **Branch:** `cursor/blank-household-google-boot-b30c`
- **Baseline SHA:** `3740c5c` (`origin/main`, includes PR #235 Evidence hook-order fix)
- **Head SHA:** `1cb2044` (merged to `main`)
- **PR or issue:** Merged [#238](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/238)
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** D-041 kitchen Worker publish only. No hosted schema, secrets, or Production household mutation.

## Household outcome

Opening a saved household must show the kitchen, not a blank `#root`. Welcome can stay; the books and Google sign-in must not unmount the tree.

## Budget delta (5)

`+5` — a blank kitchen after household open makes the books unusable.

## Engagement delta (3)

`+1` — paper recovery chrome if a remaining kitchen throw escapes.

## Verified baseline

Facts:

- Local `main` was stale at `cd74d36`. This branch tracked `origin/main@3740c5c`, then merged later `main`.
- PR #235 already moved the Evidence automation `useEffect` above `if (booting)`. Welcome vs household hook-count crash is fixed on that SHA and on live kitchen.
- Jonathan first reported the blank **only when loading into a household**. Welcome worked.
- Jonathan later said **its fixed**, then ordered **merge and deploy**.

## Scope

### In scope

- Safe Google identity reads for continuity wake
- Default missing Tip Tracker settings on household shape; kitchen preview must not throw
- App-level kitchen ErrorBoundary with Reload / Sign out of Google / Open welcome
- Focused tests and living handoff
- Merge to `main` and D-041 kitchen Worker publish after Jonathan asked

### Out of scope

- Production household data, hosted schema, secrets
- Changing Google OAuth scopes or Auth/RLS
- Fixing localhost `engine.ts` update-depth or Hercules rig 403

## Acceptance evidence

- [x] Stored Google token without `identity` does not throw; continuity skips instead
- [x] Household without `shiftSettings` shapes and kitchen preview does not throw
- [x] ErrorBoundary shows paper recovery without posting money
- [x] App source no longer reads `?.identity.email` (dot after identity)
- [x] Focused tests + `pnpm check` (1044 passed / 2 skipped at `529b983`)
- [x] `docs/AI_HANDOFF.md` complete
- [x] Jonathan: household blank is fixed
- [x] Merged `#238` at `1cb2044`; `main` CI 7/7 success
- [x] D-041 deploy run `33219013249` success; live HTML `Cache-Control: no-store`; recovery copy in kitchen JS
- [x] Live demo household Home paints (not empty `#root`)

## Plan

- [x] Harden `loadGoogleSession` / `continuityIdentityFromGoogle`
- [x] Default missing `shiftSettings`; safe kitchen preview
- [x] Kitchen ErrorBoundary in `main.tsx`
- [x] Optional-chain Office google / chalkboard glance
- [x] Tests, check, auditors, handoff, PR
- [x] Merge and D-041 deploy on Jonathan's order
- [x] Live-verify household open

## Evidence log

- Baseline `origin/main@3740c5c` includes PR #235 (`c1ef000` / `11c7ffa`).
- `pnpm exec vitest run test/app-kitchen-boot.test.ts` → 6 passed.
- `pnpm check` at `529b983` → 1044 passed / 2 skipped.
- Local Vite `http://127.0.0.1:5173/`: member picker → I am Jonathan → kitchen at 390px. Broken GIS token without identity + reload still kitchen. 720px still painted.
- Merged `#238` / `1cb2044`. Workers run `33219013249` published `hearth-books` version `8a6fe6a1-8e22-43d0-bc63-00fd3581cfd3` (bundle `index-DXGA7AoE.js`).
- Live `https://hearth-books.jonathan-beaulne123.workers.dev/` household Home painted. Recovery strings present. Later `#246` deploy changed the JS hash to `index-BHscUhUh.js`; recovery chrome remains.
- Independent books-auditor PASS WITH NOTES; privacy-auditor PASS WITH NOTES; UX-auditor Dual Course PASS; verifier CONDITIONAL on handoff/worksession (closed here).

## Decisions

Kitchen recovery never `postEntry`. Sign out of Google clears Auth/GIS keys **and** the member session. Open welcome clears `hearth:session:v1:*` only. Household replicas stay. Invalid present Tip Tracker settings preview zeros; posting still uses `calcShiftAmounts`.

## Remaining uncertainty

Localhost `Maximum update depth exceeded` (`engine.ts`) and Hercules rig `403` are separate; kitchen still painted.

## Handoff

Jonathan. [#238](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/238) is merged, D-041 deployed, and live-verified: opening a household paints the kitchen.
