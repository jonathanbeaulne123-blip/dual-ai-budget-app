# Hearth worksession — Google-first household entry

- **Status:** CLOSED — deployed to Development; live canary verification open
- **Opened:** 2026-08-31 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `dual-ai-budget-app`
- **Branch:** `codex/google-first-household-entry`
- **Baseline SHA:** `1d82a57976af006d0fcf8683d6920a6277738e40`
- **Head SHA:** implementation and deployed UI `244bc67c21df389e22b5aa0dd764c5e1d4bf68c7`
- **PR or issue:** none
- **Risk:** Release
- **Decision owner:** Jonathan
- **Environment impact:** Development

## Household outcome

Jonathan and Bianca enter Hearth through one Google-first door, see every authorized household with honest edit freshness, redeem an invitation without an authentication loop, and always know which member, household, and local clock they are viewing.

## Budget delta (5)

`+3` — dependable authenticated household discovery and invitation recovery make the correct shared books easier to reach across devices without weakening PGlite, membership, or environment boundaries.

## Engagement delta (3)

`+3` — a calmer welcome, legible household cards, and persistent household identity make Hearth easier to recognize and reopen.

## Verified baseline

- `origin/main` and the clean worktree both resolve to `1d82a57976af006d0fcf8683d6920a6277738e40`.
- Development already has Google Auth, membership discovery, QR/Auth invite redemption, command-log Realtime, and the PGlite incremental canary; Production continuity remains disabled.
- The existing household snapshot supplies `name` and `lastCommittedAt`, so this packet requires no schema or hosted API.
- Focused baseline: `test/first-entry.test.ts`, `test/auth-invite-discovery.test.ts`, `test/auth-invite-chrome.test.ts`, and `test/sync-freshness.test.ts` passed 47/47 before implementation.
- Live two-account/two-device acceptance and the fourteen-day Development rehearsal remain future manual evidence, not claims of this local packet.

## Scope

### In scope

- One Google-first welcome action and an always-present authorized-household chooser.
- Reusable household cards with member identity plus relative and exact device-local edit time.
- Auth invite/QR resume states, highlighted joined household, retryable errors, and Advanced recovery for legacy phrase/Pass entry.
- Header identity line: member, household name, and device-local date/time.
- Focused tests, full local checks, living canon, and release-review evidence.

### Out of scope

- Production continuity, Production data, hosted schema, secrets, provider settings, or deployment.
- Literal collaborative field editing or a new sync engine.
- Completing the two-device matrix, 100-event sample, or fourteen-day canary without Jonathan and Bianca's devices.

## Acceptance evidence

- [x] Normal Google sign-in's tested UI contract always reaches an authorized household chooser, including a single household.
- [x] Household cards sort newest-edited first and expose relative plus exact device-local timestamps.
- [ ] Auth link and QR entry have automated resume/retry coverage; the live Google redirect and two-account check remain post-deploy evidence.
- [x] Legacy phrase and Hearth Pass paths remain available under Advanced recovery; recognized legacy QR values now prefill that recovery path.
- [x] Header identifies the active member and household with a minute-updating device-local clock while Toronto posting dates remain unchanged.
- [ ] Focused suites, type checks, Windows-equivalent production build, and independent code review pass. The complete wrapper remains host-blocked by its existing Unix-shell assumptions, and live release evidence remains open.

## Plan

- [x] Add shared household-entry presentation helpers and component.
- [x] Recompose welcome, picker, invite, and active header surfaces.
- [x] Add focused behavior, failure-state, time-zone, accessibility, and responsive tests.
- [x] Run local proof gates and independent read-only audits.
- [x] Update living canon and close with exact evidence.

## Evidence log

- 2026-08-31: `git fetch origin main`; local HEAD matched `origin/main` at `1d82a57976af006d0fcf8683d6920a6277738e40`.
- 2026-08-31: baseline focused suites passed 47/47 in 4 files.
- 2026-08-31: focused entry, Auth invitation, QR, discovery, and freshness suites passed 55/55 in 5 files after the legacy-QR regression repair.
- 2026-08-31: books plus entry/card suites passed 35/35; the books audit independently passed 76 tests across 6 files and found no ledger, PGlite, sync, or Production-path regression.
- 2026-08-31: trust audit passed 78 tests across 9 files and found no privacy, environment, secret, schema, or Production-boundary regression. Its verdict is conditional only on live OAuth/two-account/manual evidence.
- 2026-08-31: independent release verifier passed the legacy recovery fix and the 55-test focused rerun. Overall release remains conditional on live Google/two-account and manual accessibility evidence.
- 2026-08-31: `pnpm exec tsc --noEmit`, `pnpm exec vite build`, `pnpm build:hercules-pro-ui`, and the no-`dist/_redirects` assertion passed. Vite retained its known PGlite browser-external/eval and large-chunk warnings.
- 2026-08-31: the complete Vitest run reached 1,305 passing, 3 skipped, and one host-only failure in `test/api.test.ts` because Windows could not spawn `bash`. `pnpm check` therefore stopped before its build phase; the equivalent Windows build stages passed separately.
- 2026-08-31: browser checks at 320, 390, 720, and 1100 px found no horizontal overflow. The active 320 px header rendered member, household, and device-local date/time; the welcome, join, recovery, and household-card surfaces were inspected locally.
- 2026-08-31: `git diff --check` passed; changed-file scans found no credential/private artifact, migration, workflow, Worker, Supabase, Production flag, or hosted-data change.
- 2026-08-31: Jonathan gave fresh action-time approval to push, merge, and deploy. The reviewed branch was committed as `244bc67c21df389e22b5aa0dd764c5e1d4bf68c7`, pushed, and fast-forwarded to `main` from baseline `1d82a57976af006d0fcf8683d6920a6277738e40`.
- 2026-08-31: Cloudflare Workers run `33421668573` built and deployed exact `244bc67c21df389e22b5aa0dd764c5e1d4bf68c7` successfully. Its Build and Deploy steps both passed with Production continuity still baked off.
- 2026-08-31: main CI run `33421668514` completed successfully against exact `244bc67c21df389e22b5aa0dd764c5e1d4bf68c7`, including the Linux `pnpm check` path that the local Windows host could not execute completely.
- 2026-08-31: the live Development kitchen served asset `assets/index-BNpHpc0J.js`, which contained the new chooser, Google door, and Advanced recovery copy. The signed-in live page rendered `Jonathan · The Stress-Test Household · Aug 31, 2026, 1:52 p.m.` with no browser-console errors.

## Decisions

- Google is the single primary entry action. Create and Join become signed-in next actions.
- The chooser appears after normal sign-in even for one household; it does not auto-open.
- A redeemed invitation refreshes the chooser and highlights the joined household for an explicit Open action.
- Edit freshness uses the canonical accepted `lastCommittedAt`; the exact time and active header clock use the device display zone.

## Remaining uncertainty

- Live OAuth redirect, two-account invitation, assistive-technology, and two-device timing evidence require a later Development release and human devices.

## Handoff

Current state is deployed Development code at `244bc67c21df389e22b5aa0dd764c5e1d4bf68c7`. No hosted-data mutation, schema change, secret change, or Production-continuity change occurred. The live OAuth, two-account invitation/QR, stale-invite escape, assistive-technology, and two-device canary checks remain mandatory before the canary is called stable.
