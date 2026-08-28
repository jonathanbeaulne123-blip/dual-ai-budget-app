# Hearth worksession — Bianca Month-One Rehearsal

- **Status:** OPEN
- **Opened:** 2026-08-28 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** Hearth
- **Branch:** `codex/bianca-month-one`
- **Baseline SHA:** `c85ed0ca6e6b4f3235a1711381ea323b7927e666`
- **Head SHA:** `c85ed0ca6e6b4f3235a1711381ea323b7927e666`
- **PR or issue:** Local-only implementation; Cursor PR #244 is the UI integration boundary
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

- Current `origin/main` and the isolated worktree baseline are `c85ed0ca6e6b4f3235a1711381ea323b7927e666`.
- Cursor PR #244 remains open and owns overlapping App/Home and shared-story UI work; this packet begins with non-overlapping core code and tests.
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
- [ ] Development phone-width browser proof covers invitation, resume, Hercules steps, detail disclosure, friction, and joint sign-off.
- [ ] Focused suites, `pnpm test`, TypeScript, production build, AI-surface verification, books review, UX review, and Gemini review are recorded.

## Plan

- [x] Reimplement opening truth against current main.
- [x] Add rehearsal model, projections, commands, continuity, and practice sandbox.
- [x] Build golden fixture and focused/two-client tests.
- [ ] Rebase once after PR #244 lands and integrate App/Home surfaces with one writer.
- [ ] Verify, review, document, and prepare local-only handoff.

## Evidence log

- 2026-08-28: isolated worktree created at `C:\Users\jonat\OneDrive\Documents\ChatGPT\Budget App - Bianca Month One`; original dirty checkout left untouched.
- 2026-08-28: baseline `c85ed0ca6e6b4f3235a1711381ea323b7927e666` confirmed locally and against `origin/main`.
- 2026-08-28: Cursor PR #244 confirmed open; App/Home integration deferred until its ownership boundary is safe.
- 2026-08-28: opening truth, rehearsal core, continuity merge, discarded practice, prepared UI components, and exact golden fixture implemented without touching the dirty original checkout.
- 2026-08-28: independent reviews initially blocked repeatable openings, weak receipt semantics, forged practice proof, concurrent-start conflict, participant/report scope, invisible receipt choice, and return friction. All findings were repaired and re-reviewed.
- 2026-08-28: focused opening/rehearsal/Fund proof passed **39/39**; TypeScript passed; independent books review approved and component-level UX review approved.
- 2026-08-28: final full repository run produced **1,095 passed / 2 skipped**. Three unrelated failures remained: Git Bash could not find a `python3` alias for `test/api.test.ts`, a rig timing midpoint repeated, and a loaded stress test exceeded 15 seconds. Rig and stress passed on immediate isolated rerun; AI verification, TypeScript, and the Windows-native production build passed.
- 2026-08-28: independent verifier conditionally passed the isolated D-168 core; no Worker, hosted migration, provider, Production, or launch scope was added.

## Decisions

- Decision ID is D-168; D-166 landed on `main` for unrelated 7shifts work after this isolated branch began, and D-167 is already in use by an attendance review branch.
- Live use accepts only user-entered, user-confirmed Development values; all automated examples are fictional.
- Rehearsal metadata is Shared continuity state but excluded from journals, financial audit hashes, Hercules context, analytics, and Worker requests.

## Remaining uncertainty

- Cursor PR #244 may change the exact App/Home integration surface before core work finishes.
- PR #244 remains open, so Home/More mount points, two-authenticated-phone browser proof, final full check/build/AI verification, and Gemini review remain pending.

## Handoff

Codex owns this isolated local branch. Nothing is pushed, merged, deployed, Production-verified, or manually entered into a real household.
