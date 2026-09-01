# Hearth worksession — Charter founding conversation

- **Status:** OPEN
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `cursor/charter-founding-flow-021f`
- **Baseline SHA:** `effd7b382bde313fc80a0b4aa218322c6052450a` (`origin/main`, Charter slice 2 sealed)
- **Head SHA:** (see latest commit on the branch)
- **PR or issue:** (opens with this slice)
- **Risk:** High (presentation; writes only through existing Charter commands)
- **Decision owner:** Jonathan
- **Environment impact:** none — fictional Development demo and empty household; no Production, hosted mutation, schema, or secrets

## Household outcome

Two people can found the household charter in about six minutes from empty: purpose, split, permissions, cadence, and a work ceiling, then sign only their own line or leave it blank. Skip is a peer of Next. No ledger dollar figure appears in the flow. Demo Home with books stays the office until More → the charter.

## Budget delta (5)

`+2` — founding writes the Charter record through `foundHouseholdCharter` / `grantCharterPermission` / `signHouseholdCharter`. It does not post money or create a second envelope.

## Engagement delta (3)

`+3` — the empty house opens on a paper conversation instead of an unexplained desk.

## If they conflicted

Books win. The flow never shows a balance, chart, or computed split. Permissions are granted only when the founder can give away their own confirm. Unsigned remains valid.

## Verified baseline

Facts:

- Charter slice 1 is `db0a0a2` (`HouseholdCharter`, D-189 remainder).
- Charter slice 2 is merged #269 as `ec57e38` / sealed `effd7b3`: `foundHouseholdCharter` does not auto-sign; founding twice throws; permissions are a separate grant command.
- `catalogHousehold()` has a Fund and transactions, so it must not take over Shared Home.
- UX packet + plates: five question screens, no “Step 2 of 5”, selected split is a pine tick not a fill. Plate wins over copy mismatches.

Inferences:

- Empty landing means no charter, no Fund, no transactions, at least one member.
- Households that already have books found from More → the charter.

## Scope

### In scope

- `src/core/charterFounding.ts` draft → command mapping
- `src/CharterFounding.tsx` + `src/charter-founding.css`
- Shared-home empty takeover and More → the charter
- Focused tests

### Out of scope

- Charter page (slice 4)
- Held (slice 5)
- Slice 0 register tokens
- Fund math, schema, Production, merge, deploy

## Acceptance evidence

- [ ] Walk answers through to `foundHouseholdCharter`
- [ ] Skip every step still founds
- [ ] Fence: `"How much work is too much?"`
- [ ] Focused tests + `pnpm check`
- [ ] Visual 320 / 390 / 720 / ~1100

## Plan

- [ ] Core draft helper
- [ ] Founding UI
- [ ] App entry + More
- [ ] Tests, check, PR

## Evidence log

- 2026-09-01: Jonathan confirmed slice 2 on `main` and ordered slice 3. Baseline `origin/main@effd7b3`.

## Decisions

- Skip defaults: remainder with empty note; cadence none; ceiling none; no permission grants.
- No `$` in founding chrome (hours and dollars-a-month are number fields, not a CAD pad) so the slice’s no-figure rule holds.

## Remaining uncertainty

- Live forced-colors / reduced-motion DevTools on the kitchen URL (this slice is not merged).

## Handoff

Draft PR against `main`. Not merged, not kitchen-published, not live.
