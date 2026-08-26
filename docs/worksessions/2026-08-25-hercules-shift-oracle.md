# Hearth worksession — Hercules Shift Oracle

- **Status:** IMPLEMENTED; REVIEW REQUIRED
- **Opened:** 2026-08-25 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor Cloud Agent
- **Repository:** dual-ai-budget-app
- **Branch:** `cursor/hercules-shift-oracle-129b`
- **Baseline SHA:** `6e2baea3fd5f65a85dd65dd22ee3f455d2faf963` (`main`)
- **Head SHA:** (see latest commit on branch)
- **PR or issue:** [#133](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/133) draft
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** Development code only; no deploy, schema, secrets, or Production mutation

## Household outcome

Hercules Shift Oracle: seeded Monte Carlo tip floors, schedule simulation, weather-adjusted outlook, and tax-milk / smoothing-buffer choreography as labelled projections. Nothing posts.

## Budget delta (5)

`+3`

## Engagement delta (3)

`+2`

## Verified baseline

- D-127 job shifts store date, hours, tips, optional `startedAt`.
- Hercules Pro on `main` had 54 read-only tools before this branch.
- Weather is Toronto atmosphere; not stamped on shift rows yet.

## Scope

### In scope

- `tipScience.ts` + four read tools + Worker MCP catalogs + tests + D-137 canon.
- Math repairs after trust review: span-based cadence, order stability, empty payroll weeks, negative tip inclusion, exact horizon days, Toronto meal hour, fail-closed shiftId, comparable advice scores.

### Out of scope

- Python/LangChain, auto-post transfers, Confirm weather stamps, Worker deploy, Production.

## Acceptance evidence

- [x] Seeded Monte Carlo deterministic for same household/seed and shift-array order
- [x] Tools never mutate household; Oracle facts use `projection` basis
- [x] Pro `tools/list` length 58; no write-shaped tools
- [x] Focused tip-science tests + `pnpm check` (587 tests) green
- [x] Simulated p10 stays inside historical monthly envelope on demo seed

## Plan

- [x] Open branch + worksession
- [x] Implement tipScience engine
- [x] Wire Hercules/Pro tools
- [x] Tests + check
- [x] Trust-review math fixes
- [x] Canon/handoff + PR

## Evidence log

- Focused: `pnpm exec vitest run test/tip-science.test.ts test/hercules-pro.test.ts test/hercules-tools.test.ts` → 21 passed (pre-fix) / tip-science 6 passed (post-fix)
- Full: `pnpm check` → 84 files / 587 tests + build green
- Artifacts under `/opt/cursor/artifacts/tip-oracle-*.log`

## Decisions

- Jonathan selected Strategy 3 (Shift Oracle).
- Independent trust review blocked merge until cadence inflation and order dependence were fixed; those fixes are on this branch.

## Remaining uncertainty

- Soft weather/season priors until Confirm stamps.
- Free-route GROUNDED JOURNAL projection marker gap (shared with earlier forecast tools).

## Handoff

Independent High-risk re-review → Jonathan Development smoke in ChatGPT Pro + in-app Ask. Not shipped until merged; not live until deploy approved.
