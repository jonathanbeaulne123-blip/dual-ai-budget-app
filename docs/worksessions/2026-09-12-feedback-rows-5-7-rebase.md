# Hearth worksession — Rebase feedback rows 5–7 onto planner main

- **Status:** OPEN (rebased onto main; PR #455; quick-gate verified)
- **Opened:** 2026-09-12 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor (cloud agent)
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `cursor/feedback-rows-5-7-32f2` (rebase of `claude/feedback-rows-5-7@f4d6dc6b` onto `origin/main`)
- **Baseline SHA:** `origin/main@6fa38aed` (planner #453)
- **Head SHA:** `c9410d34`
- **PR or issue:** https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/455
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

- [x] Rebased onto `origin/main@6fa38aed` with both planner and rows 5–7
- [x] `pnpm exec tsc --noEmit` clean
- [x] Focused calendar kinds / fab / app-startup tests green
- [x] PR to `main` (#455)

## Plan

- [x] Fetch and confirm SHAs
- [x] Rebase onto `origin/main`
- [x] Resolve `App.tsx` / `fabActions.ts` / `DECISIONS.md`
- [x] Verify
- [x] Push and open PR

## Evidence log

Starting SHAs:
- feature tip `f4d6dc6b`
- merge-base `58cb1d75`
- `origin/main` `6fa38aed`

Rebase of 7 commits onto `6fa38aed`. Conflicts only on commit 3 (`src/App.tsx`, `src/core/fabActions.ts`) and commit 7 (`docs/DECISIONS.md`).

```
pnpm exec tsc --noEmit
  first run: missing pdfjs-dist in this environment (pre-existing dep, not this branch)
  after `pnpm install`: clean

pnpm exec vitest run test/calendar-kinds.test.ts test/copy-budget.test.ts test/terms.test.ts test/navigation-one-route.test.ts test/vision-v2-slice-1.test.ts test/planner-ui.test.ts
  6 files, 37 tests, pass

pnpm test -- --risk=medium --focus=test/calendar-kinds.test.ts --focus-reason="rows 5-7 rebase: calendar kinds, whisper copy, one-route chrome, and planner room kept from #453"
  quick-gate-passed: base=6fa38aed head=c9410d34 fingerprint=6209abd0… clean=true
  35 selected files (30 fast / 5 serial), 443 tests (315+128), 95.644 s, no time-budget breach
  uiProofRequired=true (calendar evidence already on the branch; Status Centre / phone fold still jsdom)
```

## Decisions

Keep planner `Tab` / `<Planner>` / `openTaskInAdd` / Together `onOpenPlanner`. Retire secondary nav. `+` stays four money verbs named “Add money”. Decision id for this slice becomes D-246 because #453 already shipped D-245.

## Remaining uncertainty

Personal “My planner” strip and household “Plan the week” `+` verb are dropped with row 5. Together’s SharedBoards door and Hercules to-do remain. Independent UX auditor did not start (model quota). Calendar browser proof is from the pre-rebase slice, still on this branch.

## Handoff

**PR:** https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/455 — draft on `cursor/feedback-rows-5-7-32f2@c9410d34` onto `main@6fa38aed`. Quick-gate verified. Not merged, not deployed, not live verified. Next owner: Jonathan to review; Codex to audit D-246; Bianca to read on a phone.
