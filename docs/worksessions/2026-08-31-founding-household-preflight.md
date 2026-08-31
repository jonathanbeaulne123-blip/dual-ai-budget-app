# Hearth worksession — founding-household rehearsal preflight

- **Status:** OPEN · DEVELOPMENT RELEASE AUTHORIZED
- **Opened:** 2026-08-31 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/founding-household-preflight`
- **Baseline SHA:** `c75d72eef323f1af211c42da440090730363b6f4`
- **Verified runtime candidate SHA:** `5db7140ee53298efc1de9413f99779a9f77eec5a`
- **PR or issue:** Gap-closing Program 1 preparation; Jonathan authorized rebase, merge, and deploy on 2026-08-31
- **Risk:** Release
- **Decision owner:** Jonathan
- **Environment impact:** Development UI and local files only

## Household outcome

Jonathan and Bianca cannot start the real four-week Development rehearsal until a newly downloaded private household backup has been selected again and validated as the exact current recoverable snapshot, and the people at the table have acknowledged the account/device, privacy, cadence, and stop conditions. The proof exercise never imports over the live household and never touches Production.

## Budget delta (5)

`+4` — the first real month starts only after an exact balanced backup has passed the ordinary import validator without persistence, and the stop conditions are visible before any rehearsal evidence exists.

## Engagement delta (3)

`+2` — one calm preparation card makes the weekly sit-down and recovery promise legible without adding another app, route, or financial writer.

## Verified baseline

Facts:

- Program 0 merged as PR #261 at exact `main@201a449cb99251c8a66eb3b282d950305752d1f1`.
- Cloudflare build `520f0603-0ea5-4b73-bbc4-fd0afb03bd3e` produced Worker version `2e7934fd-16dd-4de7-ae9f-eb349e54ab94`; the live roadmap asset matches the merged file hash.
- D-183 already supplies the Development-only four-week `MonthRehearsal`, ordinary Confirm receipts, checkpoints, own-phone acknowledgements, friction notes, and final signatures.
- `makeHouseholdExport` and `validateHouseholdImport` already produce balanced, environment-bound, hash-checked recovery files; validation returns a candidate and does not persist it.
- The current Start card does not require a download/reselect recovery proof or the preparation acknowledgements from the approved gap-closing program.

Inference:

- The smallest coherent next slice is a local preflight gate immediately before `startMonthRehearsal`, not a parallel rehearsal, new hosted API, or simulated multi-week completion.

## Scope

### In scope

- Add an exact-current-snapshot recovery round-trip validator that never persists or transports the candidate.
- Add a Development-only preflight card to the existing Month rehearsal Start surface.
- Require a downloaded backup to be selected again and verified before Start becomes available.
- Require explicit human acknowledgements for separate Google identities/device inventory review, Development/build recording, privacy-safe evidence, weekly cadence, and stop conditions.
- Invalidate the local preflight proof whenever the live household revision changes.
- Add focused domain and UI regression tests plus living decision/handoff updates.

### Out of scope

- Real household values in Git, screenshots, diagnostics, support notes, or model input.
- Starting or fabricating the four-week rehearsal, the 100-event matrix, or the fourteen-day continuity rehearsal.
- Hosted reads/writes, Supabase schema or policy, secrets, provider settings, Production, deploy, or design-partner invitations.
- A second backup format, financial writer, sync API, access-management implementation, or automated assertion that a human used the correct physical phone.

## Acceptance evidence

- [x] A freshly exported current Development snapshot can be reselected and validated without persistence or Production access.
- [x] A balanced but stale/different household backup cannot unlock Start.
- [x] Production and mismatched-environment files fail closed.
- [x] Start and both replay routes stay disabled until the fresh recovery proof and every human preparation acknowledgement are current.
- [x] Existing Month rehearsal, command-sync, and full-App startup contracts remain green.
- [x] Focused tests and the full Windows proof gate pass on the clean exact candidate SHA.
- [x] Independent trust and UX verification report no open P0/P1/P2.

## Plan

- [x] Merge and verify Program 0, refresh `origin/main`, and create one clean writer from the exact merge SHA.
- [x] Inspect D-183, the continuity pilot, current recovery code, and the existing Start surface.
- [x] Implement the recovery round-trip contract and preflight UI.
- [x] Add focused tests, then run the full local proof gate.
- [x] Obtain independent trust/UX/verification review; close only after exact-SHA aggregate evidence.

## Evidence log

- 2026-08-31: PR #261 checks passed; merged as `201a449cb99251c8a66eb3b282d950305752d1f1`.
- 2026-08-31: Cloudflare build `520f0603-0ea5-4b73-bbc4-fd0afb03bd3e` succeeded; live `/roadmap/app.js` SHA-256 `8de2164d35ad2d05580778fa7e65fb837c253e190ea53a75bb9e7b77f1043129` matched the merged repository asset.
- 2026-08-31: clean worktree `Budget App - Founding Household Prep` created on `codex/founding-household-preflight` from exact merged `origin/main`.
- 2026-08-31: focused recovery/Month/mainline/full-App tests passed 5 files / 30 tests; TypeScript and `git diff --check` passed.
- 2026-08-31: independent review identified and the implementation repaired three release-gate bypasses: both replay routes now share the preflight, wrapper and embedded environments must match, and a fresh download in the current session is required before reselect can unlock readiness. UX review also required visible file errors and download status; both are now announced.
- 2026-08-31: repaired interactive UI/recovery proof passed 3 files / 15 tests. The interactive path proves upload-before-download remains blocked, fresh download clears prior proof, exact reselect plus all acknowledgements unlocks Start, revision change relocks it, and a mismatched environment is announced.
- 2026-08-31: final independent trust/release, UX/accessibility, and verification re-reviews reported no remaining P0, P1, or P2 finding. Independent focused verification passed 7 files / 33 tests plus TypeScript.
- 2026-08-31: the pre-refresh candidate passed the full Windows gate: AI-surface verification, 211 passed / 2 skipped files, 1,407 passed / 3 skipped tests, TypeScript, the Vite Production build, Hercules Pro UI build, and redirect guard. `origin/main` advanced during the run; the candidate rebased without conflict onto `acf1d6797ed28dc60885f51dc4dbc88d93b5681a`, and its decision number moved from D-186 to D-187 to preserve the newly merged D-186 continuity decision.
- 2026-08-31: exact refreshed candidate `e81c208930dff9be00c84c416d6d426b8adf700e` passed the repeated full Windows gate: AI-surface verification, 212 passed / 2 skipped files, 1,414 passed / 3 skipped tests, TypeScript, the Vite Production build, Hercules Pro UI build, and redirect guard. Existing non-failing React `act`, PGlite browser-external/eval, and chunk-size warnings were unchanged.
- 2026-08-31: Jonathan authorized rebase, merge, and Development deployment. The three-commit D-187 branch rebased onto `origin/main@c75d72eef323f1af211c42da440090730363b6f4`; runtime code merged without conflict, while the append-heavy handoff and decision history preserved both newer mainline records and D-187.
- 2026-08-31: exact rebased runtime candidate `5db7140ee53298efc1de9413f99779a9f77eec5a` passed the full Windows gate: AI-surface verification, 214 passed / 2 skipped files, 1,442 passed / 3 skipped tests, TypeScript, the Vite Production build, Hercules Pro UI build, and redirect guard. Focused combined proof passed 16 files / 131 tests across recovery, Month, startup, D-186 sync, QR/Auth/storage, and Shared Home desk plates.

## Decisions

- Preparation proof is session-local and fail-closed. The private backup remains a local household file; no proof copy enters the household snapshot, continuity outbox, evidence artifact, analytics, or Hercules.
- Human acknowledgements are labeled as acknowledgements, not automated identity or security evidence. Existing Household access remains the authoritative device/member inventory surface.

## Remaining uncertainty

- Real Google identities, two physical phones, independent Personal-isolation review, and the actual downloaded file remain named-human evidence. Code can require and label those steps but cannot manufacture them.

## Handoff

Development release authorized and in progress. No hosted row, schema, secret, provider, Production, or real-rehearsal action is part of this release; exact PR, merge, deployment, and live receipts are reported at release completion.
