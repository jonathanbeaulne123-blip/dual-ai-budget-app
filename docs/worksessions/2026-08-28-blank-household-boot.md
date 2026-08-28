# Hearth worksession — Blank kitchen when loading a household

- **Status:** OPEN
- **Opened:** 2026-08-28 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor (cloud agent)
- **Repository:** dual-ai-budget-app
- **Branch:** `cursor/blank-household-google-boot-b30c`
- **Baseline SHA:** `3740c5c` (`origin/main`, includes PR #235 Evidence hook-order fix)
- **Head SHA:** (in progress)
- **PR or issue:** none yet
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** none (client boot/recovery only; no hosted schema, secrets, Production, or deploy)

## Household outcome

Opening a saved household must show the kitchen, not a blank `#root`. Welcome can stay; the books and Google sign-in must not unmount the tree.

## Budget delta (5)

`+5` — a blank kitchen after household open makes the books unusable.

## Engagement delta (3)

`+1` — paper recovery chrome if a remaining kitchen throw escapes.

## Verified baseline

Facts:

- Local `main` was stale at `cd74d36`. This branch tracks `origin/main@3740c5c`.
- PR #235 already moved the Evidence automation `useEffect` above `if (booting)`. Welcome vs household hook-count crash is fixed on this SHA and on live kitchen HTML that serves that bundle.
- Jonathan reports the blank still happens **only when loading into a household**. Welcome works.
- There is no React ErrorBoundary around `<App />`. An uncaught kitchen render or effect throw unmounts `#root`.
- Continuity wake `useEffect` runs only when `session.memberId` exists (household kitchen, not welcome). It currently reads `googleSession?.identity.email` without optional identity.
- Kitchen render calls `calcShiftAmounts(..., ledger.shiftSettings)` after the session guard. `ensureHouseholdShape` does not default missing `shiftSettings`. `normalizeShiftSettings` throws if settings are missing.

Inferences:

- Remaining blanks after #235 are kitchen-only render/effect throws (Google identity, missing Tip Tracker settings, or another Office/Hercules path), not welcome.
- Google suspicion is consistent: Continue with Google is how a returning member reaches household+session.

## Scope

### In scope

- Safe Google identity reads for continuity wake
- Default missing Tip Tracker settings on household shape; kitchen preview must not throw
- App-level kitchen ErrorBoundary with Reload / Sign out of Google / Open welcome
- Focused tests and living handoff

### Out of scope

- Merge, deploy, Production, hosted schema, secrets
- Changing Google OAuth scopes or Auth/RLS
- Treating this as shipped until merge + D-041 deploy + live verify

## Acceptance evidence

- [ ] Stored Google token without `identity` does not throw; continuity skips instead
- [ ] Household without `shiftSettings` shapes and kitchen preview does not throw
- [ ] ErrorBoundary shows paper recovery without posting money
- [ ] App source no longer reads `?.identity.email` (dot after identity)
- [ ] Focused tests + `pnpm check`
- [ ] `docs/AI_HANDOFF.md` complete

## Plan

- [ ] Harden `loadGoogleSession` / `continuityIdentityFromGoogle`
- [ ] Default missing `shiftSettings`; safe kitchen preview
- [ ] Kitchen ErrorBoundary in `main.tsx`
- [ ] Optional-chain Office google / chalkboard glance
- [ ] Tests, check, auditors, handoff, PR

## Evidence log

Record exact commands, results, visual widths, links, and current SHAs. Do not copy evidence from another branch.

## Decisions

Kitchen recovery never `postEntry`. Sign out of Google clears only Auth/GIS keys on this phone. Open welcome clears `hearth:session:v1:*` only. Household replicas stay.

## Remaining uncertainty

Live blank may still be an old cached shell until D-041 deploy of this branch, or a kitchen throw this packet does not cover. ErrorBoundary is the containment for unknowns.

## Handoff

Name the next owner and distinguish local, branch, PR, merged, deployed, and manually verified state.
