# Hearth worksession — Stress reload shift trends

- **Status:** IMPLEMENTED; DRAFT PR #136; NOT MERGED
- **Opened:** 2026-08-25 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor Cloud Agent
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `cursor/stress-shift-weather-location-85bf`
- **Baseline SHA:** `244bd081c1d1e6fb3d60dce159fa250ee080bba4`
- **Head SHA:** `3d5f050dc1a235b9b1577341c4bf9afad85e2bb5`
- **PR:** [#136](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/136)
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** Development fixtures (Reload random / pretty numbers); Production env can still invoke the pre-existing reload control

## Household outcome

Reload random Development data produces full job-based shifts with realistic Toronto weather/location stamps and weighted tip trends Hercules Pro can read for testing, without inventing a second money path.

## Budget delta (5)

`+1` — stress fixture shifts post through the same `postWorkShift` / settlement commands with every sales, tip, break, and destination field filled; money meaning unchanged.

## Engagement delta (3)

`+2` — reload data carries weather-noted, location-stamped, weekday/season/weather-weighted shift history so Hercules Pro shift tools have analyzable trends.

## Verified baseline

Facts:

- `main@244bd08` shipped `seedStressHousehold` with mixed legacy `postShift` (older months) and sparse `postWorkShift` (last ~2 months).
- Work confirm form fields live in `WorkShiftFlow` / `PostWorkShiftInput`; location stamps already exist on `postEntry` (D-126) but not on work-shift income rows.
- Office weather is live/cache atmosphere only; there is no household weather journal.
- Full `pnpm check` on `main` already fails two `batch-import-ui` SubtleCrypto digests (pre-existing; unrelated).

## Scope

### In scope

- Enhance `seedStressHousehold` shifts: always job-based, fill every work-shift field, weight tips/sales by weekday/season/weather, encode weather in notes, stamp realistic Toronto locations on shifts and spend rows, settle receivables on schedule.
- Optional `location` / `occurredAt` on `postWorkShift`.
- Focused stress-seed tests and living handoff/decision D-138.

### Out of scope

- Production data, hosted schema, secrets, deploy, live Open-Meteo historical backfill, new weather journal table, Hercules Pro OAuth/MCP changes, gating Reload to Development-only (pre-existing surface).

## Acceptance evidence

- [x] Fixed-seed stress household posts only job-based shifts with sales-by-field, breaks, clock times, and notes containing weather words.
- [x] Tip totals skew higher on Friday/Saturday; rainy/snowy notes correlate with lower tip rates (seed `424242`).
- [x] Shift income and ordinary spend rows carry shaped location stamps near real Toronto places.
- [x] Focused tests green; `ai:verify` + `tsc` + `vite build` green. Full `pnpm check` blocked only by pre-existing `batch-import-ui` SubtleCrypto failures also on `main`.

## Plan

- [x] Extend `postWorkShift` for optional location/occurredAt stamps.
- [x] Rebuild stress shift generator with weights, weather notes, locations, settlements.
- [x] Tests, handoff, draft PR.

## Evidence log

- 2026-08-25: baseline `244bd08`; branch `cursor/stress-shift-weather-location-85bf`.
- Focused: `pnpm exec vitest run test/stress-seed.test.ts test/work-jobs.test.ts` → 14 passed; plus timezone-location → 19 passed.
- Proof JSON: Fri/Sat tip/hr 1552¢ vs Mon–Wed 1177¢; clearish 1557¢ vs rainy 1020¢; 177 job-based shifts; Harbourfront GPS stamps.
- Books auditor: PASS (command-only posting; stamps metadata-only).
- `pnpm check` on branch and `main`: same 2× `batch-import-ui` SubtleCrypto failures.

## Decisions

- D-138 recorded.

## Remaining uncertainty

- Reload / pretty-number controls remain available when the environment pill is Production (pre-existing); Erase is Dev-only. Jonathan may want a Dev gate later.
- Winter stress stamps still use `-04:00` clock strings (civil date and cents correct); optional Toronto-offset polish later.
- Patio-vs-ruff tip skew is coded but not separately asserted in tests (weekend + weather skews are).

## Handoff

Next owner: Jonathan review of draft PR #136; smoke More → Reload random data in Development. Not shipped until merged and live-verified.
