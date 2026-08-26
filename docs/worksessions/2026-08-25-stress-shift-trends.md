# Hearth worksession — Stress reload shift trends

- **Status:** OPEN
- **Opened:** 2026-08-25 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor Cloud Agent
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `cursor/stress-shift-weather-location-85bf`
- **Baseline SHA:** `244bd081c1d1e6fb3d60dce159fa250ee080bba4`
- **Head SHA:** TBD
- **PR or issue:** TBD
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** Development fixtures only (Reload random data / pretty numbers)

## Household outcome

Reload random Development data produces full job-based shifts with realistic Toronto weather/location stamps and weighted tip trends Hercules Pro can read for testing, without inventing a second money path.

## Budget delta (5)

`+1` — stress fixture shifts post through the same `postWorkShift` / settlement commands with every sales, tip, break, and destination field filled; money meaning unchanged.

## Engagement delta (3)

`+2` — reload data carries weather-noted, location-stamped, weekday/season-weighted shift history so Hercules Pro shift tools have analyzable trends.

## Verified baseline

Facts:

- `main@244bd08` ships `seedStressHousehold` with mixed legacy `postShift` (older months) and sparse `postWorkShift` (last ~2 months).
- Work confirm form fields live in `WorkShiftFlow` / `PostWorkShiftInput`; location stamps already exist on `postEntry` (D-126) but not on work-shift income rows.
- Office weather is live/cache atmosphere only; there is no household weather journal.

Inferences to prove:

- Weighted synthetic weather/weekday/season multipliers produce detectable tip-per-hour weekday skew without breaking books health.
- Stamping harbour GPS on shift income rows stays within D-126 location shape and does not post money.

## Scope

### In scope

- Enhance `seedStressHousehold` shifts: always job-based, fill every work-shift field, weight tips/sales by weekday/season/weather, encode weather in notes, stamp realistic Toronto locations on shifts and spend rows, settle receivables on schedule.
- Optional `location` / `occurredAt` on `postWorkShift` so Confirm-compatible stamps can ride the same command.
- Focused stress-seed tests and living handoff/decision why-note.

### Out of scope

- Production data, hosted schema, secrets, deploy, live Open-Meteo historical backfill, new weather journal table, Hercules Pro OAuth/MCP changes.

## Acceptance evidence

- [ ] Fixed-seed stress household posts only job-based shifts with sales-by-field, breaks, clock times, and notes containing weather words.
- [ ] Tip totals skew higher on Friday/Saturday and patio season; rainy notes correlate with lower tip rates.
- [ ] Shift income and ordinary spend rows carry shaped location stamps near real Toronto places.
- [ ] Focused tests + `pnpm check` green.

## Plan

- [ ] Extend `postWorkShift` for optional location/occurredAt stamps.
- [ ] Rebuild stress shift generator with weights, weather notes, locations, settlements.
- [ ] Tests, handoff, draft PR.

## Evidence log

- 2026-08-25: baseline `244bd08` on branch `cursor/stress-shift-weather-location-85bf`.

## Decisions

## Remaining uncertainty

Whether Jonathan wants historical Open-Meteo API backfill later; this slice uses synthetic but realistic Toronto conditions correlated to tip weights.

## Handoff

Next owner: Jonathan review of draft PR; Development-only reload fixture; not shipped until merged and live-verified.
