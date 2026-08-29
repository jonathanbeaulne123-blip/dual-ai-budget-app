# Hearth worksession — Autonomous shift envelope and confirmed Bible

- **Status:** RELEASE IN PROGRESS — independent books/privacy/Worker UI report zero P0/P1; Development gates authorized
- **Opened:** 2026-08-29 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `dual-ai-budget-app`
- **Branch:** `codex/d172-autonomous-shift-envelope`
- **Baseline SHA:** `98acd9eafae7a8d4d0dcfb48e499d9062b776267`
- **Head SHA:** local working tree
- **PR or issue:** none
- **Risk:** Release
- **Decision owner:** Jonathan
- **Environment impact:** Development code, OAuth client, Evidence migration, and capture-only hosted activation; no Production activation

## Household outcome

7shifts schedules, timesheets, and verified Gmail notices reconcile into a member-personal mail envelope. The user supplies restaurant-only figures, reviews coworker attendance, and uses the ordinary visible Shift Confirm. The confirmed, versioned Shift Bible becomes the durable Tip Science record; shift-specific raw evidence is cryptographically erased seven days later.

## Budget delta (5)

`+5`: worked-time provenance, explicit missingness, ordinary work calculation, corrections, and retained financial meaning become one reviewable record.

## Engagement delta (3)

`+3`: upcoming and worked shifts arrive as a small mail queue instead of repeated transcription.

## Verified baseline

- Clean checkout at `98acd9e`; `origin/main@d87e2dee` is its ancestor.
- D-169 visible schedule/timesheet capture, D-170 extraction hardening, and D-171 approved-punch draft are already present in this baseline and deployed, though not merged to `main`.
- Calendar currently renders confirmed shifts only; saved 7shifts outlook is not a board source.
- Evidence raw bytes live outside household/PGlite in dedicated encrypted D1/R2/Queue planes.
- Existing D-159 automation can post opted-in eligible evidence without visible Confirm; D-172 must not use or enable that path.

## Scope

### In scope

- Versioned Shift Envelope/Bible contracts and member-Personal shaping/merge.
- Deterministic envelope reconciliation for schedule, punch, and provider notice outcomes.
- Calendar outlook/status projection and Shift mail queue opening the ordinary review flow.
- Atomic worked Bible + attendance + `postWorkShift` confirmation and non-money outcome confirmation.
- Job-place historical weather facts and fail-soft pending state.
- Revocable companion registration, alarm/session capture, Gmail incremental sync, and explicit Development-only activation.
- Seven-day retention metadata, crypto-erase queue handler, migrations, and deterministic tests.

### Out of scope

- Production activation, public extension distribution, and public Google OAuth publication/verification.
- Cookie/password/token extraction, official administrator API dependency, AI money authority, silent posting, payroll reopening, and inferred missing financial values.

## Acceptance evidence

- [x] State-machine and source-precedence tests.
- [x] Visible Confirm spy and exact command/PGlite identity coverage.
- [x] Calendar/mail accessibility and 320/390/720/1100 visual smoke.
- [x] Historical weather, Toronto DST, blank/failure/backfill tests.
- [x] Extension wrong-account/origin/session/selector/token tests.
- [x] Gmail sender/history/revocation/duplicate tests.
- [x] Seven-day crypto-erasure and Bible-survival tests.
- [x] Focused tests, TypeScript, AI verification, full suite, builds, dry run, and diff check.
- [x] Independent books, privacy, Worker/UI, and final verification reports with no P0/P1.

## Plan

- [x] Implement the local envelope/Bible kernel and UI.
- [x] Implement weather and retention contracts.
- [x] Implement inert autonomous companion/Gmail contracts.
- [x] Verify, audit, and reconcile findings.
- [x] Close the implementation review after the independent reviewers return zero P0/P1; keep release gates explicit until merge/activation.

## Evidence log

- 2026-08-29: `git fetch origin --prune`; clean baseline `98acd9e`, `origin/main=d87e2dee`, merge base `d87e2dee`.
- 2026-08-29: TypeScript, 60 focused Evidence/companion/Hercules tests, 97 books/sync/Shift tests, and the retained-Bible UI test passed.
- 2026-08-29: full repository run excluding the unchanged Windows-only `bash` assertion passed 1,123 tests / 2 skipped; the new Bible UI regression then passed separately. The ordinary full run had only that `spawnSync bash ENOENT` baseline plus one D-172 test expectation repaired before the clean exclusion run.
- 2026-08-29: AI surface verification, Worker/extension JavaScript syntax, production Vite build, Hercules Pro UI build, Wrangler dry run, and `git diff --check` passed. Dry run reported `EVIDENCE_AUTOMATION_ENABLED`, companion, Gmail companion, retention, and Production allowance all false.
- 2026-08-29: local responsive smoke at 320/390/720/1100 found the Shift mail heading and bottom navigation visible with no horizontal document overflow.
- 2026-08-29: release-review repairs added one shared server-side RFC822 sender assertion for direct and companion Gmail uploads, one-use manual capture precedence with visible retry status, and a stable visible 7shifts employee/location/role tuple that must match before autonomous timesheet upload or owner-job mapping. Focused Evidence/extension/extraction/UI proof passed 45/45; the exact mapping route and same-name/different-employee adversarial regressions then passed, and TypeScript remained clean.
- 2026-08-29: independent books and privacy reviews returned PASS with zero P0/P1. Privacy retained one explicit P2 gate: the committed extension has no real Google OAuth client, so Gmail companion consent remains inert until separate OAuth publication.
- 2026-08-29: final Worker/UI review returned PASS with zero P0/P1. Fresh final proof passed 63/63 across Evidence, extension, extraction, envelope, weather, Bible UI, and Hercules; TypeScript, AI verification, Vite production build, Hercules Pro UI build, Wrangler dry run, and diff check passed. The dry run remained inert with automation, companion, Gmail companion, retention, and Production flags false.
- 2026-08-29: Jonathan authorized the Development release gates. Google Auth Platform registered the Chrome-extension OAuth client for extension `deddlafofoddkacaedocpmnkaocbkjij`, enabled only `gmail.readonly`, retained External Testing status, and kept Jonathan as a test user. The public client ID was added to the extension manifest; focused proof remained 63/63 and TypeScript remained clean.
- 2026-08-29: final pre-release proof passed 1,134 repository tests / 2 skipped. The sole failure was the unchanged Windows runner assertion `spawnSync bash ENOENT`; AI verification, direct Vite production build, Hercules Pro UI build, Wrangler dry run, and `git diff --check` passed. The inert dry run still reported companion, Gmail companion, retention, financial automation, and Production allowance false.

## Decisions

- Collection and prefilling may be autonomous; visible Confirm remains the sole D-172 money door.
- Unexplained disappearance from an explicitly complete captured schedule is `cut`; explicit provider call-out/trade/pickup facts retain their own outcomes.
- Raw shift evidence purges seven days after a Bible is sealed. Reusable jobs/coworker directory/device registration and unresolved envelopes remain.
- Location is configured job place with rounded coordinates, never a per-shift GPS trail.

## Remaining uncertainty

- Exact employee-visible 7shifts page/template shapes can drift; autonomous capture must stop and surface sign-in/shape status rather than broaden projection.
- Chrome alarms cannot wake a sleeping device; copy must remain “automatic while Chrome is running.”
- Google OAuth remains in External Testing for Jonathan-only Development use. Broader extension distribution still requires its own publication and verification gate.

## Handoff

Jonathan authorized push, PR, merge, the Development Evidence migration, Jonathan-only OAuth testing, and capture/retention activation. Production, financial auto-posting, and public OAuth/extension distribution remain separately gated.
