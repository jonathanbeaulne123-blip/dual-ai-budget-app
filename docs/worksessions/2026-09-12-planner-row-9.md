# Hearth worksession — The planner (feedback row 9)

- **Status:** OPEN
- **Opened:** 2026-09-12 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Claude (Cowork session)
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `claude/planner-row-9`
- **Baseline SHA:** `58cb1d757f8c66304bb8882a74bd64b857748cb4` (main after #451)
- **Head SHA:** see Evidence log (final commit named in the closing handoff)
- **PR or issue:** none yet — Jonathan's delivery bot pushes, merges and deploys
- **Risk:** High (new member-scoped continuity collection, envelope split, capability guard, privacy projection)
- **Decision owner:** Jonathan
- **Environment impact:** none (no hosted schema, no Production, no real-household writes)

## Household outcome

Jonathan and Bianca get a planner that knows what things cost. A Task is one object that can be a life errand, a money obligation, a decision, a Chapter Move or a Plan next-step. Today, This week, Anytime, Logbook and lists are views onto one collection. Money tasks show whether they are covered before payday; they are never ticked — they complete by evidence (a posted transaction, a goal contribution, a paid recurrence occurrence). Private tasks are real from day one.

Jonathan's two decisions (2026-09-12, this session): **one Task object** with optional `chapterId` / `planReference` bindings, and **private tasks in the schema now** (`visibility` + `createdBy`, split across both envelopes like `nativeEvents`).

## Budget delta (5)

+4. No command posts money. `completeTask` refuses a manual tick on a financial task and requires evidence that already exists in accepted books; the affordability line is a pure projector over `projectHouseholdFund`, `householdWallet`, `monthObligations` and `paydayTicks`; `financialAuditFacts` and command identity are untouched. Planned spend becomes visible against what is actually available before payday.

## Engagement delta (3)

+3. A daily-open surface that is not a ledger; capture with money in one line; assignment with acknowledgement, a backup owner, and a coverage view framed as "is anything only in one person's head"; a logbook that reads as a month handled.

## Verified baseline

Facts (read in this session):

- `BoardTask` lives in `src/core/sharedBoards.ts` under `kitchen.boards` (household-only: `sync.ts:564`, `:1048`; no personal counterpart). Commands `saveBoardTask` / `removeBoardTask` at `commands.ts:6114-6149`; registered at `ledgerSync/registry.ts:85`; CAS resources at `ledgerSync/resources.ts:67-73`.
- `nativeEvents` is the member-scoped template: type + `saveNativeEvent` in `src/core/nativeEvents.ts`; ten split/merge sites in `sync.ts` (379, 490, 557, 663, 692, 764, 873, 1037, 1175, 1344); `nativeCalendarVersion` guard in `ledgerSync/protocol.ts:35,88,116`, `authority.ts:96`, `client.ts:70,233,447`, `workers/ledgerRoom.ts:1102`; scoped-field parity set in `workers/ledgerSyncAuth.ts:161`; `IMPORT_FIELD_POLICY` in `ledgerSync/importParity.ts`.
- Privacy: `householdForView` (`visibility.ts:255`) filters by `isVisibleInView`; `activitySafeForMember` (`visibility.ts:60`) and `privateActivityTokens` (`sync.ts:528`) scrub partner-private titles from activity; `householdForAiDisclosure` blanks `kitchen.boards` (`visibility.ts:125`).
- `financialAuditFacts` (`commandIdentity.ts:76`) is a positive allow-list; boards and nativeEvents are not in it.
- Non-money data rides in the `household_snapshots.payload` blob; no SQL migration is required for a new collection.
- Money helpers available without change: `monthObligations`, `paydayTicks`, `projectHouseholdFund`, `householdWallet`, `projectCadence`, `parsePadDecimal`, `suggestCategory`.

Inferences: the D-180 continuity command log (`materializeSnapshotFromEvents.ts`) carries Chapters because Codex's D-244 review required it; `nativeEvents` and boards do not travel there. This slice mirrors `nativeEvents` and leaves the D-180 materialization question to the trust review.

## Scope

### In scope

- `src/core/tasks.ts`: `Task`, `TaskList`, validation, shape, revision-wins merge, commands `saveTask`, `completeTask`, `reopenTask`, `acknowledgeTask`, `saveTaskList`, `adoptBoardTasks`.
- Envelope split and merge in `sync.ts` at the ten `nativeEvents` sites; `taskPlannerVersion: 1` capability guard (protocol, client, authority, Worker hello); parity policy and scoped-field set; view/AI/activity privacy projections.
- Read-models: `agenda()` (tasks ∪ obligations, recurrences, potential expenses, appointments, shifts, native events), `affordability()` (planned vs available, payday-aware, covered / short), evidence-derived completion, `parseTaskCapture()`.
- UI: a Planner room (Today · Week · Anytime · Logbook · Lists; Mine / Theirs / Ours), capture bar, money rows, assignment with acknowledgement, backup owner, coverage; entry from Together, the adaptive +, and Hercules' existing `task` action; three authored themes.
- Board to-dos adopted into `tasks`; the carousel page links to the planner.

### Out of scope (follow-ups named in the handoff)

- Migrating Chapter `moves[]` and Rituals into `tasks` (D-244 binds their materialization hash; needs its own trust review). The binding fields exist.
- Hercules read tools over tasks ("plan my week"), voice and receipt-photo capture, drag-to-reschedule on Calendar, home-screen widgets, habits view, completion animation beyond the theme tokens.
- Any hosted schema, Production, Auth/RLS or D-180 materialization change.

## Acceptance evidence

- [x] Unit: private tasks round-trip through `splitForSync` / `assembleHousehold` and never reach the partner's view, activity, or AI disclosure (`test/planner-tasks.test.ts`).
- [x] Unit: `completeTask` refuses a manual tick on a money task; accepts evidence that exists in books; recurrence-linked tasks derive completion from a posted occurrence (`planner-tasks`, `planner-agenda`).
- [x] Unit: `affordability` marks covered / short-until-payday / short with the payday line; `parseTaskCapture` parses `pay hydro friday $140` (`planner-agenda`).
- [x] Unit: old-client guard — a command without `taskPlannerVersion` is refused once tasks exist (`planner-tasks`, through `prepareCommand`).
- [x] Money conservation: `compileHousehold` byte-equal and `financialAuditFacts` unchanged across every task command.
- [x] Quick gate at risk High with focused tests; `tsc` clean; `pnpm build` passes.
- [x] Browser evidence at 320 / 390 / 720 / 1100 across Classic, Taylor's Scrapbook, Newfoundland, both views; keyboard capture → add → tick with visible focus; reduced motion; empty state; 0 serious/critical axe, 0 overflow, 0 page errors.

## Plan

- [x] Read canon and map seams.
- [x] Slice 1 — schema, sync, guards, commands, adoption (`fd786bad`).
- [x] Slice 2 — agenda, affordability, evidence, capture (`c641bb83`).
- [x] Slice 3 — Planner UI, entry points, themes (`f6120409`).
- [x] Gate, evidence, D-245, handoff (this closing commit).

## Evidence log

All on `claude/planner-row-9`, base `58cb1d757f8c66304bb8882a74bd64b857748cb4`, fictional catalog fixtures only.

- `npx tsc --noEmit -p tsconfig.json` — clean after each slice.
- `npx vitest run test/planner-tasks.test.ts test/planner-agenda.test.ts test/planner-ui.test.ts` — 8 + 6 + 5 = 19 tests pass.
- Neighbouring suites at slice 1: `native-events`, `shared-boards`, `sync-integrity`, `ai-disclosure`, `ledger-sync-authority`, `command-contract`, `permission-matrix`, `conflict-cas`, `vision-v2-chapters` — 64 pass; **5 failures in `ai-disclosure` (4) and `sync-integrity` (1) reproduce identically on unmodified `main@58cb1d75`** (verified with `git stash`), so they are pre-existing and not caused by this branch.
- `pnpm test -- --risk=high --focus=test/planner-tasks.test.ts --focus=test/planner-agenda.test.ts --focus=test/planner-ui.test.ts --focus-reason="…"` at `441099da` — `quick-gate-passed`, 81.3 s of the 300 s budget, no breach; 23 selected files (fast lane 21 files / 241 tests, serial lane 2 files / 25 tests); `uiProofRequired: true` (met below).
- Serial mainline regressions (AGENTS.md Bianca Month rule): `app-startup-p1` 81 tests, `month-rehearsal-mainline`, `page-worlds`, `more-worlds`, `ledger-sync-authority` — 98 pass. `ledger-import-parity` 5 pass. `ledger-sync-worker` is skipped in this environment (Miniflare lane not configured here) — **not run**.
- `pnpm build` — passes (743 modules).
- Browser: `HEARTH_ARTIFACTS_DIR=docs/evidence/planner HEARTH_CHROMIUM=/opt/pw-browsers/chromium node test/planner-layout.mjs` — 42 captures (Today / This week / Logbook / Lists household, This week personal × Classic / Taylor / Newfoundland × 320 / 390 / 720 / 1100 for the week, 390 / 1100 for the rest), 0 horizontal overflow, 0 serious/critical axe (one Newfoundland contrast hit was fixed and re-captured), 0 page errors; keyboard-only capture → Enter → tick with a visible focus ring; `reducedMotion: reduce`; personal Anytime empty state. Files and `records.json` in `docs/evidence/planner/`.
- Not done: physical devices, VoiceOver, authenticated two-browser continuity of a private task, real Development data.

## Decisions

- D-245 (proposed) — see `docs/DECISIONS.md`.

## Remaining uncertainty

- Whether tasks must also travel in the D-180 continuity command-log materialization (as Chapters do) before Development release. This slice follows the `nativeEvents` precedent (snapshot payload + Ledger sync v2 command re-execution). Codex's trust review decides.
- Timestamps inside `saveTask`/`completeTask` use `new Date()` like `saveNativeEvent`; ids for the next repeating occurrence are deterministic (`<id>-rYYYYMMDD`) so authority re-execution agrees on resources.
- `affordability` reads the Fund's free-to-spend in the household view when a Fund is configured, else visible cash accounts; a payday with no known amount is reported as "short until <payday>", never as covered.
- Hercules' legacy board edit/complete/remove flow (`herculesActions.ts` ~L152) still targets `kitchen.boards.tasks`; after adoption those rows are empty. A planner-aware edit/complete flow is a follow-up.
- The planner borrows the More scene; a `SceneRoute` of its own is the thirteen-file theme change the brief keeps out of scope.

## Handoff

- **State:** local branch `claude/planner-row-9`, five commits on `58cb1d75`. Not pushed, not a PR, not merged, not deployed, not live verified. This session's cloud container has no push credential; the branch is delivered as a git bundle in Jonathan's Downloads for his delivery bot to push, open a PR, merge and deploy.
- **Next owner:** Codex — independent trust review of the envelope split, the capability guard, the privacy tokens, and the D-180 materialization question; then Jonathan for product review on real Development data.
- **Follow-ups (not in this branch):** Chapter Moves / Rituals migrating into `tasks`; Hercules read tools over tasks ("plan my week", Friday summary); voice and receipt-photo capture; drag-to-reschedule on Calendar; widgets; a completion moment beyond theme tokens; planner-aware Hercules edit/complete.
