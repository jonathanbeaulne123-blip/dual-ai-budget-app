# Hearth worksession — Bianca Month-One Rehearsal

- **Status:** OPEN — caught up to current mainline; final verification, Gemini transmission, and real authenticated-phone proof pending
- **Opened:** 2026-08-28 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** Hearth
- **Branch:** `codex/bianca-month-one`
- **Baseline SHA:** current `origin/main` at `1d82a57976af006d0fcf8683d6920a6277738e40`; the pre-catch-up head remains at `codex/bianca-month-one-pre-main-20260831`
- **Implementation SHAs:** historical core/App commits were rebased; exact current final SHA is recorded after verification
- **PR or issue:** Local-only implementation; Cursor PR #244 landed before the one clean rebase
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** Development

## Household outcome

Jonathan and Bianca can rehearse one truthful calendar month together, understand why the books tie, record friction without surveillance, and jointly decide whether they want to use Hearth next month.

## Budget delta (5)

`+5`: truthful opening balances, exact weekly accounting checkpoints, real-receipt linkage, reconciliation, and a guarded month close directly strengthen the family-office books.

## Engagement delta (3)

`+3`: a short Hercules-led weekly ritual, resumable progress, humane friction capture, and joint acknowledgement give Bianca a reason to return throughout the month.

## Verified baseline

- Current `origin/main` and the rebased isolated-worktree baseline are `e19acf09c35c26bda1dba9d01e4806a315e223ab`.
- Cursor PR #244 landed. The branch was rebased once, then the rehearsal was mounted without replacing its Shared/Personal ledger grammar.
- Household Fund, reconciliation, continuity, Confirm, and month-close behavior already exist and remain authoritative.
- Stale PR #218 contains useful opening-truth ideas but is not current-main-compatible and will not be merged wholesale.
- Production, provider, scaling, shift-intake, launch, schema, and real household data are outside this worksession.

## Scope

### In scope

- Development-only truthful opening balances with exact opening equity, idempotency, and full-batch reversal.
- Versioned Shared `MonthRehearsal` state, deterministic week rules, friction lifecycle, receipts/skips, checkpoints, acknowledgements, approval, archive, and reset behavior.
- In-memory fictional correction/reversal practice that cannot persist.
- September 2026 golden-month fixture with exact cents, journal checks, Fund projections, identities, and hashes.
- Two-member continuity/merge and authority tests.
- Development UI invitation, weekly resume, Hercules copy, proof disclosure, reports, and joint sign-off after the Cursor #244 boundary is safe.
- Canonical documentation, proof-backed reviews, and a Gemini review packet.

### Out of scope

- Production data or configuration, deploys, pushes, merges, hosted schema, providers, scaling, shift intake, product launch, analytics, and model interpretation of friction notes.
- Changing existing Fund, reconciliation, continuity, Confirm, or month-close laws.
- Real Jonathan or Bianca balances in implementation or automated proof.

## Acceptance evidence

- [x] Opening rows affect balance sheet/equity only, post once from one visible confirmation, and reverse as a complete batch.
- [x] Rehearsal commands are non-money commits with `postedIds: []`; only existing financial commands and opening truth create money IDs.
- [x] Real-money tasks require accepted linked receipts; eligible events may be honestly skipped.
- [x] Week availability follows Toronto days 1-7, 8-14, 15-21, and 22-end; future weeks are read-only.
- [x] Friction attempts distinguish unfinished from explicitly stopped and disclose participant sharing.
- [x] Checkpoints show current green/tied state and become stale after relevant corrections.
- [x] Members acknowledge only for themselves; approval requires all core experiences, four current green checkpoints, reconciliation, closed month, Bianca's exact statement, and Jonathan's countersignature.
- [x] Golden September fixture freezes exact balances, trial balance, equation, Fund projections, receipt identities, entry counts, and audit hashes.
- [x] Two-client tests prove independent acknowledgement, safe concurrent merge, conflict resolution, stale-checkpoint invalidation, and anti-impersonation.
- [x] Local synthetic Development App proof covers invitation, resume, Hercules steps, evidence disclosure, participant privacy, and responsive 320/390/720/1100 px layout with no console errors. This is visual/layout proof only, not authenticated continuity or joint-signoff proof.
- [ ] Two real authenticated Development phones prove continuity, independent acknowledgement, friction, and joint sign-off.
- [x] Focused suites, `pnpm test`, TypeScript, production build, AI-surface verification, and independent books/UX/code review are recorded.
- [ ] Gemini receives the exact implementation packet only after Jonathan explicitly approves that external transmission; findings are dispositioned afterward.

## Plan

- [x] Reimplement opening truth against current main.
- [x] Add rehearsal model, projections, commands, continuity, and practice sandbox.
- [x] Build golden fixture and focused/two-client tests.
- [x] Rebase once after PR #244 lands and integrate App/Home surfaces with one writer.
- [x] Verify, review, document, and prepare the local-only handoff.
- [ ] Obtain transmission approval, send the exact packet to Gemini, and disposition its review.
- [ ] Run the real two-authenticated-phone proof when an authorized Development identity and endpoint are available.

## Evidence log

- 2026-08-28: isolated worktree created at `C:\Users\jonat\OneDrive\Documents\ChatGPT\Budget App - Bianca Month One`; original dirty checkout left untouched.
- 2026-08-28: baseline `c85ed0ca6e6b4f3235a1711381ea323b7927e666` confirmed locally and against `origin/main`.
- 2026-08-28: Cursor PR #244 confirmed open; App/Home integration deferred until its ownership boundary is safe.
- 2026-08-28: opening truth, rehearsal core, continuity merge, discarded practice, prepared UI components, and exact golden fixture implemented without touching the dirty original checkout.
- 2026-08-28: independent reviews initially blocked repeatable openings, weak receipt semantics, forged practice proof, concurrent-start conflict, participant/report scope, invisible receipt choice, and return friction. All findings were repaired and re-reviewed.
- 2026-08-28: focused opening/rehearsal/Fund proof passed **39/39**; TypeScript passed; independent books review approved and component-level UX review approved.
- 2026-08-28: final full repository run produced **1,095 passed / 2 skipped**. Three unrelated failures remained: Git Bash could not find a `python3` alias for `test/api.test.ts`, a rig timing midpoint repeated, and a loaded stress test exceeded 15 seconds. Rig and stress passed on immediate isolated rerun; AI verification, TypeScript, and the Windows-native production build passed.
- 2026-08-28: independent verifier conditionally passed the isolated Bianca Month core (now D-183); no Worker, hosted migration, provider, Production, or launch scope was added.
- 2026-08-30: PR #244 was present in `main`; the branch rebased exactly once onto `e19acf09`, preserving D-176 PGlite receipt migration v4 and adding opening truth as v5.
- 2026-08-30: `MonthRehearsalPanel` mounted on Household Home and More only, using existing persistence/Confirm routing and adding no navigation item. Personal view remains unmounted.
- 2026-08-30: reconciliation and month close were hardened to emit stable command kinds and artifact IDs; rehearsal completion now requires matching accepted Confirm receipts and audit hashes. Hostile unaccepted tests pass.
- 2026-08-30: local in-app browser proof exercised fictional Bianca and Jonathan sessions at 320, 390, 720, and 1100 px with no horizontal overflow or console errors. The harness deliberately uses synthetic local Development sessions and is not evidence of Google Auth or hosted two-phone continuity.
- 2026-08-30: final books/trust and UX re-reviews report no open P0-P2 findings. Independent focused verification passed 42/42 plus 49/49 command/continuity/visibility checks; the coordinator's final selected seven-file run passed 37/37 and TypeScript passed.
- 2026-08-30: after the two final hostile/privacy tests, the full repository run reached 1,276 passed / 3 skipped with one environment-only `test/api.test.ts` failure because native Windows lacked `bash`. AI verification, TypeScript, and the Windows-native production build passed.
- 2026-08-31: branch caught up to `origin/main@1d82a57`; the only rebase conflict retained both the current synthetic-fixture merge and Bianca rehearsal command-receipt merge.
- 2026-08-31: a D-180 compatibility gap was fixed: non-money rehearsal updates now identify `updateMonthRehearsal`, carry only shaped Shared rehearsal facts, and merge through command-event replay while leaving the financial audit hash unchanged.
- 2026-08-31: permanent regressions now mount Bianca Month inside the actual current `App`, open the current income Add slideshow, and replay start/progress to a partner device through the current command-log harness.

## Decisions

- Decision ID is D-183. The original local D-168 collided with coworker attendance; D-182 later landed for Google-first household entry.
- Bianca Month is a projection over the mainline App/commands/books/continuity. It must not become a parallel trial app or financial writer.
- Live use accepts only user-entered, user-confirmed Development values; all automated examples are fictional.
- Rehearsal metadata is Shared continuity state but excluded from journals, financial audit hashes, Hercules context, analytics, and Worker requests.

## Remaining uncertainty

- The local synthetic browser harness does not prove Google Auth, hosted two-phone merge, or a real Bianca/Jonathan joint sign-off. That proof needs authorized Development identities and an endpoint.
- Gemini review remains unsent because the packet contains project code and named product context; the external transmission requires Jonathan's action-time approval.

## Handoff

Codex owns this isolated local branch. Core and App integration are committed locally only. Nothing is pushed, merged, deployed, Production-verified, or manually entered into a real household.
