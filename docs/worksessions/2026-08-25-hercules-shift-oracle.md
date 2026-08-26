# Hearth worksession — Hercules Shift Oracle

- **Status:** IMPLEMENTED; REVIEW REQUIRED
- **Opened:** 2026-08-25 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor Cloud Agent
- **Repository:** dual-ai-budget-app
- **Branch:** `cursor/hercules-shift-oracle-129b`
- **Baseline SHA:** `6e2baea3fd5f65a85dd65dd22ee3f455d2faf963` (`main`)
- **Head SHA:** see `git rev-parse HEAD` on branch (latest includes schedule weighting)
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

## Scope

### In scope

- `tipScience.ts` + four read tools + Worker MCP catalogs + tests + D-137 canon.
- Math repairs: order stability, Bernoulli day cadence from today, payroll-week dry streaks, fail-closed shiftId/non-positive tips, probability-weighted schedule totals, historical pace assertions.

### Out of scope

- Python/LangChain, auto-post transfers, Confirm weather stamps, Worker deploy, Production.

## Acceptance evidence

- [x] Seeded Monte Carlo deterministic for same household/seed and shift-array order
- [x] Tools never mutate household; Oracle facts use `projection` basis
- [x] Pro `tools/list` length 58; no write-shaped tools
- [x] Focused tip-science tests + `pnpm check` green
- [x] p50 near historical pace; schedule totals probability-weighted

## Evidence log

- `pnpm check` green (587 tests + build)
- Artifacts: `/opt/cursor/artifacts/tip-oracle-*.log`

## Remaining uncertainty

- Soft weather/season priors until Confirm stamps.
- Free-route GROUNDED JOURNAL projection marker gap (shared with earlier forecast tools).
- Hours pinned to weekday median while tip/hour is resampled.
- Tiny tip histories can still produce floors; sampleShifts is disclosed.

## Handoff

Independent High-risk re-review → Jonathan Development smoke. Not shipped until merged; not live until deploy approved.
