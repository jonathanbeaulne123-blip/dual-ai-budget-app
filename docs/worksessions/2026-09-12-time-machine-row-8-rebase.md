# Hearth worksession — Rebase the time machine (row 8) onto main after #455

- **Status:** OPEN (rebased onto main after #455; Books door; D-247)
- **Opened:** 2026-09-12 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor (cloud agent)
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `cursor/time-machine-row-8-420a` (rebase of `claude/time-machine-row-8@64bdf46b` onto `origin/main`)
- **Baseline SHA:** `origin/main@02a5539d` (feedback rows 5–7 #455)
- **Head SHA:** see Evidence log
- **PR or issue:** TBD
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** none (no schema, sync, Production, or real-household writes)

## Household outcome

Jonathan and Bianca can read any month — behind or ahead — with Fund, statements and goals answering at that month's own close, while today's Fund figures stay byte-for-byte. The month ribbon and Books paging land on current main after #455 chrome.

## Budget delta (5)

+5. `FundLens` / `asOf` / `period` close a silent two-month arithmetic trap in `projectHouseholdFund`. Cumulative statements gain an optional `asOf`. No new posting path. Today's Fund still counts future-dated events by design (deferred money-meaning call).

## Engagement delta (3)

+3. A read-only month ribbon in three themes; a month ahead is never postable. Navigation does not resurrect `+` go-verbs or the Household tools bar; Books is the door.

## Verified baseline

Facts: `claude/time-machine-row-8@64bdf46b` (six commits) cut from `main@6fa38aed` (planner #453). `origin/main@02a5539d` is #455. Overlap is `src/App.tsx`, `src/core/fabActions.ts`, `src/Books.tsx`, `src/styles.css`, `docs/DECISIONS.md`, `docs/AI_HANDOFF.md`, `docs/HEARTH_ROADMAP.md`. Main already owns D-245 (planner) and D-246 (rows 5–7).

Inferred: a local rebase failed on `App.tsx` and `fabActions.ts` during slice 2.

## Scope

### In scope

- Rebase onto current `origin/main` on `cursor/time-machine-row-8-420a` (do not force-push `claude/*`)
- Keep all time-machine money semantics
- Keep all #455 / planner chrome: planner room, Together door, no household-secondary bar, + means add, calendar kinds, Whisper/Why
- Time machine decision is D-247
- Books door for the time-machine route (no + go-verbs)
- High quick-gate and `tsc`; ready-for-review PR

### Out of scope

- Changing today's Fund to stop counting future-dated events
- Merge, deploy, schema, Production, real-household writes
- Exhaustive `pnpm test:full`

## Acceptance evidence

- [x] Branch rebased cleanly onto `origin/main@02a5539d`
- [x] Conflicts resolved per priorities
- [x] Decision numbered D-247
- [ ] High quick-gate and `tsc` look sane
- [ ] Ready-for-review PR into main

## Plan

- [x] Record baseline
- [x] Rebase six commits
- [x] Resolve App / fab / Books / docs
- [ ] Quick-gate + tsc
- [ ] Open ready PR

## Evidence log

- Rebase: `git rebase --onto origin/main 6fa38aed origin/claude/time-machine-row-8` on `cursor/time-machine-row-8-420a`.
- Slice 2 conflicts: `src/App.tsx`, `src/core/fabActions.ts`. Kept TimeMachine room and AppTab; dropped household-secondary and `+` go-verbs; `sceneTabFor("timeMachine")` → `ledger`.
- Docs conflicts: time machine is D-247; D-245 planner and D-246 rows 5–7 stay.
- Books door: household overview "Months", personal "My months", statements/register "See any month". `+` remains four money verbs named "Add money".

## Decisions

- Time machine is D-247. Do not steal D-245 or D-246.
- Do not restore household-secondary or + go-verbs. Books opens the time machine.

## Remaining uncertainty

Today's Fund still counts future-dated events (`fundLensToday` keeps `asOf: null`) — preserved byte-for-byte; Jonathan's money-meaning call. Forecast can read `$0.00 expected in` when the Fund is fed by confirmed contributions rather than a projected recurrence. Physical devices, VoiceOver, and a real Development snapshot are not exercised here.

## Handoff

TBD after quick-gate and PR.
