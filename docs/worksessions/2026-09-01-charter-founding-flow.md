# Hearth worksession — Charter founding conversation

- **Status:** CLOSED; MERGED #271; KITCHEN PUBLISHED; LIVE HTTP UNVERIFIED (DNS NXDOMAIN)
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `cursor/charter-founding-flow-021f`
- **Baseline SHA:** `8def9bd9ec70fe9c343f5b63880d0c6db2dcffd8` (`origin/main` at review rebase)
- **Head SHA:** `7a1e6175210eaa83b65778109925113f8addf805` (rebased review head); merge `4074e657c94d68a4c2ad8cd67a269b8541b7ec90`
- **PR or issue:** merged [#271](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/271)
- **Risk:** High (presentation; writes only through existing Charter commands)
- **Decision owner:** Jonathan
- **Environment impact:** D-041 Development kitchen publication only; no Production, hosted-row mutation, schema, or secrets

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

- [x] Walk answers through to `foundHouseholdCharter`
- [x] Skip every step still founds
- [x] Fence: `"How much work is too much?"`
- [x] Focused tests 34 passed; `pnpm check` on `7042d7e` 1481 passed / 3 skipped
- [x] Visual 320 / 390 / 720 / ~1100 (close screen + founding video on fictional Development demo)

## Plan

- [x] Core draft helper
- [x] Founding UI
- [x] App entry + More
- [x] Tests, PR; `pnpm check` 1481 passed / 3 skipped on `7042d7e`

## Evidence log

- 2026-09-01: Jonathan confirmed slice 2 on `main` and ordered slice 3. Baseline `origin/main@effd7b3`.
- Focused tests 34 passed including empty household with no CAD accounts.
- Browser: More → the charter, five questions, Later; Escape does nothing; viewports 320/390/720/~1100 on the close screen.
- Books audit P1 (empty persist) fixed: `requireCadAccounts` only on TXN/SHF. Re-audit PASS.
- `pnpm check` on `7042d7e`: 1481 passed / 3 skipped; Vite 388 modules; Hercules Pro UI green.
- UX audit P1s: inert `app-shell`, heading focus, option cards without nested headings.

## Decisions

- Skip defaults: remainder with empty note; cadence none; ceiling none; no permission grants.
- No `$` in founding chrome (hours and dollars-a-month are number fields, not a CAD pad) so the slice’s no-figure rule holds.
- Empty founding is a kitchen-local write: it may persist with zero accounts. Posting still requires an active CAD account.

## Remaining uncertainty

- Live HTTP and forced-colors / reduced-motion remain unverified because the canonical kitchen hostname returned DNS `NXDOMAIN` after the successful D-041 publication.

## Handoff

Merged #271 in the required first position after exact-current-main rebase and Linux `pnpm check` (`1,523` passed / `3` skipped). D-041 later published the combined Slice 3+4 main bundle in Action `33486435990`; do not call it live until the Worker hostname returns HTTP and the served bundle is inspected.
