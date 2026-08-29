# Hearth worksession — Kitchen desk, Personal books floor, Kitty Banks

- **Status:** OPEN
- **Opened:** 2026-08-29 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor
- **Repository:** `dual-ai-budget-app`
- **Branch:** `cursor/shared-ledger-story-aef7`
- **Baseline SHA:** `2526af1`
- **Head SHA:** `af1413f`
- **PR or issue:** draft [#244](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/244)
- **Risk:** High (ledger-mode presentation, Home CAD seals, Personal account floor)
- **Decision owner:** Jonathan
- **Environment impact:** none; local/synthetic Development only

## Household outcome

Shared Home is one pool plus Kitty Banks as sub-accounts. Personal Books is the serious account floor (household-visible rooms plus mine, never partner-personal). Home seals are posted Money in, posted expenses Money out, and leftover spend for Kitty Banks. Fat paper banks grow at 10% of `savedCents`. Setup forms collapse.

## Budget delta (5)

`+4` — honest Personal rooms, posted in/out leftover (not sit-down leftover), Fund bank Confirm.

## Engagement delta (3)

`+3` — 3-column desk, fat banks, collapsible chrome, kind-coloured calendar.

## Verified baseline

- Branch `cursor/shared-ledger-story-aef7` @ `2526af1` on draft PR #244.
- Jonathan confirmed 2026-08-29: Shared is one pool; Personal gets Wealthsimple-style rooms; leftover spend is posted in − posted expenses; Kitty Banks from `savedCents` at 10% steps.

## Scope

### In scope

- Wide 3-column desk (mosaic | stage | Kitty Banks) on Shared and Personal.
- Desk seals Money in / Money out / Leftover spend; iPhone same labels.
- Personal Books floor projector; Shared Wallet no longer a room list.
- Fat Kitty Banks; Fund contribute Confirm; collapsible setup forms.
- Calendar kind colour + second tap detail; Shift posted bubbles under Tip climate.
- Gold chrome collapsed into Drawer; weather temp stays in the glass.

### Out of scope

- New Fund formulas, sit-down leftover change, schema, secrets, merge, deploy, Production.
- iPhone OfficePhone mosaic structure (seals labels only).
- Showing partner-personal rooms or reciting leftover as sit-down leftover.

## Acceptance evidence

- [x] Personal Books lists joint + own rooms; partner-personal denied; balances include household-visibility posts to shared rooms.
- [x] Home leftover CAD equals posted income − posted expenses for that ledger; unpaid bills do not enter Money out.
- [x] Kitty Banks step 0 / 10% / 100% are visually distinct; contribute uses Confirm.
- [x] Focused tests + `pnpm check` (1115 passed / 2 skipped at `af1413f`).
- [x] Visual proof at 320 / 390 / 720 / ~1100 (recaptured Shared Home, Personal Books, Plan Confirm, OfficePhone seals on this pass).

## Plan

- [x] Open worksession from confirm.
- [x] Core projectors and tests.
- [x] Desk / Books / banks / calendar / shift UI.
- [x] Docs, check; visual proof and independent auditors in this packet.

## Evidence log

- 2026-08-29: Jonathan confirm after locking Personal floor, leftover formula, and fat banks.
- 2026-08-29: `bb69daf` docs + visual proof. `pnpm check` **1114 passed / 2 skipped**.
- 2026-08-29: `1a3d006` floor clone denial + Confirm on room interest. `af1413f` partner-goal floor test. `pnpm check` **1115 passed / 2 skipped**.

## Remaining uncertainty

Sit-down leftover (`cash-like − bills − mins`) stays a different number. Personal Home seals still use scoped personal+both, not the Books floor journal. Demo personal-scope accounts remain thin; the floor now includes household-visible rooms.

## Handoff

Not merged, not deployed, not live. Next owner: Jonathan review on draft PR #244.
