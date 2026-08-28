# Hearth worksession — 7shifts coworker roster and attendance context

- **Status:** RELEASE AUTHORIZED; SLICE 1 VERIFIED LOCALLY
- **Opened:** 2026-08-28 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `dual-ai-budget-app`
- **Branch:** `codex/d166-coworker-roster`
- **Baseline SHA:** `c85ed0ca6e6b4f3235a1711381ea323b7927e666`
- **Head SHA:** `c85ed0ca6e6b4f3235a1711381ea323b7927e666`
- **PR or issue:** none
- **Risk:** Release
- **Decision owner:** Jonathan
- **Environment impact:** Development code release authorized; no schema, secret, or feature-flag change

## Household outcome

Jonathan can capture the employee-visible 7shifts roster and published schedule, keep coworkers distinct from Hearth members, and review who actually attended a shift before those facts inform tip and sales analysis.

## Budget delta (5)

`0` for this first slice — coworker identity and attendance are non-financial context and do not change work calculations, journal rows, or settlement.

## Engagement delta (3)

`+2` — schedule context preloads the shift review so Jonathan can correct absences and add surprise helpers without retyping the floor.

## Verified baseline

- Freshly fetched `origin/main` is `c85ed0ca6e6b4f3235a1711381ea323b7927e666`.
- The existing Evidence Mesh already provides authenticated one-use browser capture, encrypted raw storage, deterministic extraction, and member-owned Personal continuity.
- The current companion response sanitizer does not inspect credential-shaped keys inside an opaque JSON `body`; roster capture must not be enabled until that boundary is repaired.
- Existing `Shift.staffingCount` is an aggregate financial covariate and intentionally carries no coworker names.

## Scope

### In scope

- Harden selected browser response sanitization and classify explicit employee-visible 7shifts capture paths.
- Add private, job/location-scoped coworker and observed-role contracts without creating household members.
- Add deterministic exact-name and last-name suggestion matching.
- Derive bounded roster and published-schedule facts while preserving unknown fields as schema drift.
- Add focused capture, extraction, identity, sync, and non-financial-boundary tests.
- Prepare attendance-review contracts for the next UI slice.

### Out of scope

- Deployment, hosted activation, migration application, secrets, extension distribution, Production, or real 7shifts capture.
- Capturing cookies, passwords, bearer tokens, request headers, or private URLs.
- Treating schedule as worked time, attendance as a money authority, or changing work calculations.
- Automatic coworker matching from an ambiguous last name.

## Acceptance evidence

- [x] Embedded credential-shaped JSON and CSV fields cannot reach the upload payload.
- [x] Only explicit employee-visible 7shifts response classes are captured.
- [x] Roster and schedule extraction are bounded and preserve unknown fields as drift.
- [x] Coworkers remain member-owned Personal facts and never become household members.
- [x] Exact-name matching is deterministic; last-name-only matches require confirmation.
- [x] Same-name provider identities remain separate and ambiguous until explicitly resolved.
- [x] Coworker facts do not change journal, overtime, tip-out, or PGlite financial integrity.
- [x] Generic model projections exclude coworkers; one Personal-chat opt-in exposes only reduced owner-selected facts for that reply.
- [x] Focused tests, TypeScript, AI verification, build, full suite, and diff check are recorded honestly.

## Plan

- [x] Reconcile a clean branch with current main and inspect the existing Evidence Mesh.
- [x] Harden the companion and add explicit capture classification.
- [x] Implement coworker identity, assignment, and matching contracts.
- [x] Implement private roster/schedule derivation and Personal continuity.
- [ ] Add attendance review UI and contextual covariates in a follow-up slice.
- [ ] Verify, independently review, and prepare a handoff.

## Evidence log

- 2026-08-28: fetched `origin/main`; exact baseline is `c85ed0ca6e6b4f3235a1711381ea323b7927e666`.
- 2026-08-28: created clean worktree `Budget App-d166-coworkers` on `codex/d166-coworker-roster`; primary checkout's unrelated dirty changes were untouched.
- 2026-08-28: final focused extension/extraction/Evidence/coworker/Hercules/sync/books proof passed, 110/110; TypeScript and AI surface verification passed.
- 2026-08-28: final full repository suite reached 1087 passed / 2 skipped with one unchanged Windows-only `spawnSync bash ENOENT` failure in `test/api.test.ts`.
- 2026-08-28: Vite production build and Hercules Pro UI build passed when the repository's Unix-only wrapper was reproduced as native Windows stages; `dist/_redirects` remained absent.
- 2026-08-28: `git diff --check` passed; CRLF conversion notices only.
- 2026-08-28: independent books, privacy/sync, and Worker/UI re-reviews found no remaining P0/P1/P2.

## Decisions

- Coworkers use `coworkerId`; they are never promoted to `Member` or used as an authorization identity.
- Roster roles are observed job/location assignments, not permanent identity claims.
- Schedule means expected staffing only. Checked attendance becomes confirmed context only after Jonathan completes the review.
- Personal guests served and restaurant covers remain separate optional measures.
- Synthetic shifts remain test/demo data and never train real predictions.

## Remaining uncertainty

- Exact 7shifts employee-visible response paths and shapes must be learned from deliberately selected Development captures; the first parser will recognize bounded explicit shapes and preserve all unmatched fields as drift.

## Handoff

Slice 1 is complete and independently verified locally. The OCR/shift review attendance screen remains the next implementation slice. Nothing has been pushed, merged, deployed, activated, or applied to hosted storage.
