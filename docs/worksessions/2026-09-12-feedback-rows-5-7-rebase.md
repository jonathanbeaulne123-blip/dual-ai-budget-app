# Hearth worksession — Rebase feedback rows 5–7 onto planner main

- **Status:** OPEN
- **Opened:** 2026-09-12 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor (cloud agent)
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `cursor/feedback-rows-5-7-32f2` (rebase of `claude/feedback-rows-5-7@f4d6dc6b` onto `origin/main`)
- **Baseline SHA:** `origin/main@6fa38aed` (planner #453)
- **Head SHA:** `7f4da6f0` after rebase; follow-up docs on this commit
- **PR or issue:** pending
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** none (no schema, sync, Production, or real-household writes)

## Household outcome

Rows 5–7 land on current main: Calendar kinds, quieter explanations, and one route to each place, without dropping the planner room from #453.

## Budget delta (5)

+0. Integration only. Planner money/task semantics stay; this slice remains read-path chrome and calendar kinds.

## Engagement delta (3)

+3 from rows 5–7, retained. Planner entry keeps Together’s “Open the planner” door and Hercules to-do; the Household tools bar and `+` navigation verbs stay retired.

## Verified baseline

Facts: `claude/feedback-rows-5-7@f4d6dc6b` (7 commits) cut from `58cb1d75`. `origin/main@6fa38aed` is planner #453. Overlap is `src/App.tsx`, `src/core/fabActions.ts`, `docs/DECISIONS.md`. Main already owns D-245 for the planner.

Inferred: a local rebase failed on those two source files.

## Scope

### In scope

- Rebase (or equivalent merge) onto current `origin/main`
- Resolve conflicts: planner room + row-5 chrome
- Renumber this slice’s decision to D-246 (planner already took D-245)
- Focused tests + `tsc --noEmit`
- PR to `main`

### Out of scope

- Restoring Household tools secondary nav or `kind:"go"` on `+`
- New planner product behaviour
- Merge, deploy, schema, Production

## Acceptance evidence

- [ ] Rebased onto `origin/main@6fa38aed` with both planner and rows 5–7
- [ ] `pnpm exec tsc --noEmit` clean
- [ ] Focused calendar kinds / fab / app-startup tests green
- [ ] PR to `main`

## Plan

- [x] Fetch and confirm SHAs
- [x] Rebase onto `origin/main`
- [x] Resolve `App.tsx` / `fabActions.ts` / `DECISIONS.md`
- [ ] Verify
- [ ] Push and open PR

## Evidence log

Starting SHAs:
- feature tip `f4d6dc6b`
- merge-base `58cb1d75`
- `origin/main` `6fa38aed`

## Decisions

Keep planner `Tab` / `<Planner>` / `openTaskInAdd` / Together `onOpenPlanner`. Retire secondary nav. `+` stays four money verbs named “Add money”. Decision id for this slice becomes D-246 because #453 already shipped D-245.

## Remaining uncertainty

Personal “My planner” strip and household “Plan the week” `+` verb are dropped with row 5. Together’s SharedBoards door and Hercules to-do remain.

## Handoff

Pending rebase, tests, and PR.
