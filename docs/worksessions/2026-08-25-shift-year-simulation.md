# Hearth worksession — Shift year simulation + sandbox gate

- **Status:** READY FOR REVIEW
- **Opened:** 2026-08-25 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor Cloud Agent
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `cursor/shift-year-simulation-85bf`
- **Baseline SHA:** `8336b5d4649d2cad4f13d56e4a433178c42b8af5`
- **Head SHA:** `ce8162013deb8b41e6277e42f594643daacbb828`
- **PR or issue:** [#138](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/138) (draft)
- **Risk:** Medium (High if sandbox were built; sandbox is design-only)
- **Decision owner:** Jonathan
- **Environment impact:** none beyond Development code; no deploy/schema/secrets

## Household outcome

Hercules Pro can build a real, reproducible next-year tips+wages simulation from posted shifts, teach how it works, and keep a documented Python-sandbox gate for later open-ended science — without posting money.

## Budget delta (5)

`+2` — deterministic year sim from posted tip/wage history; projections never invent journal rows.

## Engagement delta (3)

`+2` — Pro can teach year-ahead shift income with labelled assumptions and next steps.

## Verified baseline

- D-137 Shift Oracle already ships short-horizon tip Monte Carlo (`tip_oracle` ≤62 days), outlook, schedule sim, tax milk.
- Jonathan chose Option 3: ship deterministic year sim now; design Python sandbox later without building it.

## Scope

### In scope

- Year horizon tips+wages simulation + explain/teach tool shared by free Hercules and Pro MCP.
- Canon: D-140, HERCULES_PRO sandbox gate, plugin teacher skill, worksession/handoff.
- Focused tests.

### Out of scope

- Building a Python sandbox, LangChain writers, shadow ledgers, deploy, Production, hosted schema.

## Acceptance evidence

- [x] Same household+seed ⇒ identical year sim
- [x] Facts are `projection`; household unchanged
- [x] Monthly tips+wages totals for 6–12 months
- [x] Explain tool teaches method without posting
- [x] Sandbox documented as gated future, not implemented

## Plan

- [x] Extend tipScience with year sim
- [x] Wire tools + Pro catalog + teacher skill
- [x] Document sandbox gate
- [x] Tests + verify + PR

## Evidence log

- Baseline `8336b5d` on `cursor/shift-year-simulation-85bf`.
- Focused vitest: `tip-science`, `hercules-tools`, `hercules-pro` green (catalog list = 60 read + 3 write = 63).
- Pre-existing Pro list length drift on `main` (58/57 vs 61) corrected as part of this packet.

## Remaining uncertainty

- Soft season priors until weather stamps are universal; wage rate resampling uses posted take-home wages/hours.

## Handoff

Jonathan reviews draft PR; smoke in ChatGPT Pro: “Simulate my next year of tips and wages, then teach me how it works.”
