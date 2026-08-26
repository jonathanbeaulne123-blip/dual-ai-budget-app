# Hearth worksession — Hercules Shift Oracle

- **Status:** OPEN
- **Opened:** 2026-08-25 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor Cloud Agent
- **Repository:** dual-ai-budget-app
- **Branch:** `cursor/hercules-shift-oracle-129b`
- **Baseline SHA:** `6e2baea3fd5f65a85dd65dd22ee3f455d2faf963` (`main`)
- **Head SHA:** (building)
- **PR or issue:** (pending)
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** Development code only; no deploy, schema, secrets, or Production mutation

## Household outcome

Hercules becomes a tipped-income **Shift Oracle**: seeded Monte Carlo month floors, schedule simulation, weather-adjusted shift outlook, and tax-milk / smoothing-buffer choreography — all as labelled projections. Nothing posts. Confirm remains the only write path.

## Budget delta (5)

`+3` — safe p10 tip floor, emergency-streak reserve, tax-milk and buffer plans grounded on posted D-127 shifts.

## Engagement delta (3)

`+2` — Hercules AI + Pro can run the tipped-worker war-room conversation with typed source cards.

## Verified baseline

- D-127 job shifts store date, hours, cash/card tips, net tips, optional `startedAt`.
- Hercules Pro on `main` has 54 read-only tools (statements, controls, forecasts, teacher).
- Weather is Toronto atmosphere (`Open-Meteo`); not stamped on shift rows yet.
- Hercules never posts; forecasts must stay `projection` basis.

## Scope

### In scope

- Deterministic `tipScience.ts` (bootstrap buckets, Monte Carlo, schedule sim, tax-milk/buffer).
- Four new read tools: `tip_oracle`, `shift_outlook`, `tip_schedule_sim`, `tax_milk_plan`.
- Wire into in-app Hercules + Hercules Pro MCP catalogs.
- Focused tests + docs/decision D-137.
- Soft season/weather adjustment factors labelled as assumptions (no historical weather join yet).

### Out of scope

- Python sandbox / LangChain / model-executed code.
- Auto-posting tax milk or buffer transfers.
- Storing weather on Confirm (follow-up).
- Bank feeds, e-file, Production enablement, Worker deploy.

## Acceptance evidence

- [ ] Seeded Monte Carlo is deterministic for the same household/seed.
- [ ] Tools never mutate household; facts use `projection` basis where estimated.
- [ ] Pro `tools/list` length 58; no write-shaped tools.
- [ ] Focused tip-science + hercules-tools + hercules-pro tests green; `pnpm check` green.

## Plan

- [x] Open branch + worksession
- [ ] Implement tipScience engine
- [ ] Wire Hercules/Pro tools
- [ ] Tests + check
- [ ] Canon/handoff + PR

## Evidence log

## Decisions

- Jonathan selected Strategy 3 (Shift Oracle) over Floor+TaxMilk-only and weather-outlook-only.

## Remaining uncertainty

- Weather causality without per-shift stamps uses season + optional outlook glass as soft priors.
- Default tax-milk rate is an educational assumption (25%), not CRA withholding truth.

## Handoff

Implementer → independent High-risk review → Jonathan playtest in Development ChatGPT Pro + in-app Ask. Not shipped until merged + reviewed; not live until deploy approved.
