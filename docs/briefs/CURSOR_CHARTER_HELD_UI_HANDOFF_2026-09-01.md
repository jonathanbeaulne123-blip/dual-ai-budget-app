# Cursor handoff — Charter Slice 5 Held UI/UX

**Consumed 2026-09-01.** Implementation merged via [#286](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/286) as `main@e7d98389be1a4ad831d4d83204061a68955df232`. Start SHA below is historical (`a772936` / later `94a9f50`). D-193 core is on `main@ff9d8d8` via #283. Use [`CHARTER_SLICE_5_HELD_UI_RETURN_HANDOFF_2026-09-01.md`](CHARTER_SLICE_5_HELD_UI_RETURN_HANDOFF_2026-09-01.md) as the consumed evidence packet; kitchen live remains unverified.

## Assignment

Implement the visual and interaction layer for Held contribution motions using the sealed D-193 core. Do not redesign the wider Hearth desk and do not change financial meaning.

- **Target AI:** Cursor
- **Repository:** `dual-ai-budget-app`
- **Start from:** `a7729362e469136636f438313215a3b03ccc570d`
- **Branch suggestion:** `cursor/charter-held-ui`
- **Risk:** High (consent presentation beside a financial Confirm)
- **Decision owner:** Jonathan
- **Household outcome:** Bianca can pause Jonathan's contribution proposal for a calm conversation without rejecting it or moving money; the proposal stays visible and confirmable, and the exact holder or proposer can resolve their own action.
- **Budget delta (5):** `+3` — the screen must expose the existing append-only authority and state without inventing balance effects.
- **Engagement delta (3):** `+2` — Hold becomes a legible, reversible conversation state instead of silence or refusal.

## Sealed core contract

Use these exports from `src/core/index.ts`; do not duplicate their logic in React:

- `householdFundContributionMotions(household, fundId?)`
- `HOUSEHOLD_FUND_HOLD_COPY`
- `holdHouseholdFundContribution`
- `releaseHouseholdFundHold`
- `withdrawHouseholdFundContribution`
- existing `confirmHouseholdFundContribution`

The selector returns newest-first motions with `status: "open" | "held" | "confirmed" | "withdrawn"`, the original `proposal`, `activeHold`, `activeHolds`, `confirmation`, and `withdrawal`.

Core invariants are already enforced:

1. Only the current Fund custodian may Hold, and they cannot Hold their own proposal.
2. Only the exact holder releases a Hold; only the exact proposer withdraws an unconfirmed proposal.
3. Held remains open and confirmable. It is never refusal.
4. Hold and release do not change the Fund projection or journal. Withdrawal removes only the unconfirmed pending amount. Confirmation remains the only contribution balance increase.
5. Every action is append-only Shared history and survives compacted command replay.

If the UI appears to require a change to any of those rules, stop and return the blocker rather than editing `src/core/householdFund.ts`, `src/core/commands.ts`, PGlite, continuity, or audit code.

## Required UI scope

Work primarily in `src/HouseholdFundPanel.tsx` and the smallest existing stylesheet/test surface needed. The current panel manually derives `pending` from raw Fund events; replace that derivation with `householdFundContributionMotions`. Do not create a second motion fold.

For each `open` or `held` contribution motion:

- Keep the proposal card visible with member name, amount, and date.
- For the eligible custodian, place **Confirm received** and **Hold** as equal-weight controls in the same row. Both must be at least 44 by 44 CSS pixels. Hold is never an overflow item or a text link.
- A Hold opens or reveals one optional note field using exactly `HOUSEHOLD_FUND_HOLD_COPY.notePlaceholder`: `What would you want to know first?`
- Submit through `onCommand((current) => holdHouseholdFundContribution(current, ...))`; never mutate local household data.
- In the held state, show exactly `HOUSEHOLD_FUND_HOLD_COPY.status`: `Held — let's talk about this.` No red, warning triangle, failure icon, denial language, or partner blame.
- Show the immutable record in calm prose: `{Holder name} held this on {human date}.` Show the note when present.
- The exact holder gets a visible **Release Hold** action wired to `releaseHouseholdFundHold`.
- The exact proposer gets a visible **Withdraw proposal** action wired to `withdrawHouseholdFundContribution`, whether the proposal is open or held.
- A held proposal must still show the custodian's **Confirm received** action.
- Confirmed and withdrawn motions leave the waiting queue. Do not render a synthetic `0 items` or empty waiting card.

Use the selector's status and event identities for visibility. Buttons hidden by eligibility are convenience only; the core commands remain the authority.

## Charter-page boundary

`src/Charter.tsx` currently displays amendment history but does not provide amendment-authoring controls. Do not expand this task into a new Charter amendment composer or invent a Charter Hold-release command. Existing held Charter amendment history may keep using `charterAmendmentLines`; a fuller Charter motion-control surface needs its own core and UX packet.

## Visual direction

Add onto the existing paper/card grammar; do not restyle the desk. Use the supplied UX plates and packet as visual guidance, reconciled to the current Hearth theme and components.

- Confirm and Hold are peers, not primary-versus-hidden.
- Held is quieter than an error and stronger than muted metadata.
- Keep amount, proposer, current state, and action ownership scannable without adding a dashboard metric or badge.
- Do not use `denied`, `rejected`, `declined`, `blocked`, `failed`, or `waiting for Bianca` for a held motion.
- Preserve the existing custody disclosure: Hearth cannot move the savings.
- No motion control may look like money was posted before Confirm succeeds.

## Accessibility and responsive acceptance

- Verify 320, 390, 720, and approximately 1100 CSS-pixel widths.
- No horizontal overflow; the action row may wrap while preserving equal 44px controls.
- Every note input has a programmatic label, not placeholder-only naming.
- State changes are announced through an existing polite status/error pattern; do not make a toast the only record.
- Keyboard order follows proposal → note → Hold/Confirm → Release/Withdraw as applicable.
- Focus remains predictable after Hold, release, withdraw, and Confirm.
- Verify default theme plus the alternate/forced-colors treatment supported by the current app; reduced motion must not hide state.

## Required tests and proof

Add behavioral UI tests, not only source-string assertions. At minimum prove:

1. Open custodian view shows equal Confirm and Hold controls.
2. Holding with a note produces the exact calm state and keeps Confirm visible.
3. Only the holder sees Release Hold; only the proposer sees Withdraw proposal.
4. Release returns the motion to open; withdrawal removes it from the waiting queue.
5. Confirming a held proposal updates the accepted household through the normal `onCommand` path.
6. A non-custodian cannot obtain a working Hold control, including after rerender with another member.
7. Mobile action layout has no horizontal overflow and all controls meet 44px.
8. Existing Fund disclosure, transfer, reconciliation, Kitty, books history, and Personal-scope fences remain intact.

Run at least:

```sh
pnpm exec vitest run test/held.test.ts test/household-fund-ui.test.ts <new-held-ui-test>
pnpm exec tsc --noEmit
pnpm build
pnpm check
git diff --check
```

Also capture rendered evidence at 320 / 390 / 720 / ~1100 for open, held-with-note, released, and withdrawn states. Use fictional Development data only.

## Data, network, and release boundaries

- No Supabase migration, hosted row, RLS, Auth, provider, Worker secret, bank connection, or Production action.
- No real household, bank, or partner-Personal data in screenshots or tests.
- PGlite schema v6 is already part of the sealed core; do not create another local or hosted migration.
- Do not push, open a PR, merge, or deploy without Jonathan's action-time approval.

## Expected return handoff

Return the exact base and head SHA, changed files, screenshots/viewports, keyboard and accessibility evidence, focused/full command results, any warnings, environment/data disclosure, and a verdict on whether the branch is ready for independent High-risk review. Explicitly confirm that Hold and release left the Fund projection and journal unchanged and that the UI never derived authority from raw event math.
