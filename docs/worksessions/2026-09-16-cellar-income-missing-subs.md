# Hearth worksession: the cellar's pay in glass, contribution banks, and missing subscriptions (Plan Studio v3, cellar track)

- **Status:** OPEN. Local branch only: not pushed, not a PR, not merged, not deployed, not live verified.
- **Opened:** 2026-09-16 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Claude (UX, accessibility, visual quality), the cellar track of the Plan Studio v3 build
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `claude/plan-v3-cellar` (worktree `wt-cellar`)
- **Baseline SHA:** `6160fb03` (`main`, #495)
- **Risk:** Medium-High. Two new doors onto existing commands. One is `allocateHouseholdFundSurplus`, a money command already reachable from the jug and the gun. The other is `proposePlanBridge` / `declinePlanBridge` / `withdrawPlanBridge` / `dismissNotice`, which already exist and are synced. There is no new command, no schema change, no sync change and no Hercules payload change. The privacy question (a partner's pay in the shared cellar) is resolved by reading household-visible rows only, but it still needs the independent privacy review that the migration review asked for (H8, R2-M5).
- **Decision owner:** Jonathan (D-278, D-279, D-280)
- **Environment impact:** none. Fictional fixtures and the fictional proof page only.
- **Flag:** everything here lives in the Queen's cellar, which only opens behind `VITE_QUEENS_NEST`. Nothing changes what money means anywhere else.

## Household outcome

Jonathan's asks (Choices log, 2026-09-16, "Related cellar work"):

1. **Hypothetical income jars.** The cellar shows each partner a jar on their expected pay date: how high the Fund could stand if all of that pay came in. On the pay date the jar is gone and a contribution kitty bank shows what was actually contributed. Income is not linked to the Fund; contributions move money.
2. **Missing or smaller subscriptions.** A subscription that is charged less than usual, or not charged by its date plus a grace period, stays in the cellar one more cycle with a mark. Tapping it celebrates and offers to roll the difference into a goal kitty bank: the custodian proposes and the partner confirms.

What the couple now sees on the rail, on the same dollar scale as the water and the bill jars (D-265):

- **A glass jar** on each pay date that is still ahead. It is clear, with a dashed edge and an *if* on its belly. Its card says: "If all of your pay came in, about $X, the Fund could stand at $Y. Only a contribution moves money."
- **A contribution kitty bank** on each pay date that has arrived. It is solid clay, and hollow when nothing has come in yet. Its card says what that person contributed to the Fund since that pay day.
- **A missing mark.** This is a ghost of the subscription's jar with a copper spark, drawn where the overdue jar would have been. A smaller charge also carries a down-mark. Opening the mark plays a short burst of sparks (they stand still under reduced motion).
  - The card says "Fictional video club wasn't charged for Sep 5, and $18.00 stayed in the water", or "came in $4.00 lower".
  - It walks the roll-over: **Offer to roll** (custodian) → **Yes, roll it / Not this one** (partner) → **Roll $X into …** behind the app's Confirm (custodian) → **✓ Rolled**, which never rolls twice.
- **The owner's own controls, on their own glass.**
  - **Hide my pay from the jars** is shared, so both phones drop that person's glass. **Show my pay in the jars** brings it back.
  - **Include my private pay** applies to this phone only.
  - The line under the rail says when a partner keeps their pay out, or when only the pay day is shared.

## Budget delta (5)

**+1.** A subscription that didn't bill, or billed less, becomes a visible, agreed, one-time move into a goal instead of disappearing into the float. The roll goes through the Fund's own rollover, so it is capped at the safe surplus and refused a second time for the same occurrence. The glass jar never presents pay as Fund money. There is no new money writer.

## Engagement delta (3)

**+2.** Payday reads as a moment in the cellar, the partner's yes is a real two-person act, and a missed charge is a small celebration.

## What changed

### Pure selectors (core, new files owned by this track)

- **`src/core/missingSubscriptions.ts`**
  - **Occurrences it reads.** It covers subscriptions (`Recurrence.kind === "subscription"`, expense, active) on accounts that aren't Personal.
  - **What counts as a charge.** The recorded `payments` count, plus the recurrence's own posts. Reversed and duplicate rows don't count.
  - **Missing.** No charge for the occurrence, and today is at least 3 days after its day (`MISSING_GRACE_DAYS`).
    - A day before the open one counts only if the subscription had charged earlier, for example when it was skipped past. A new subscription has no phantom past.
  - **Smaller.** Charged less than the recurrence's current amount.
    - If the next cycle (or the previous one) charged the same lower amount, the price changed. That is not a windfall, so no mark is shown.
  - **Visible until** the cycle after next comes due. A mark from last month is carried onto this month's rail from the 1st.
  - **Stages.** `open → offered → agreed → rolled`, read from the cellar's own Plan Bridge rows and the Fund's `kitty-allocated` events. `voidRowIds` lists the viewer's own open offers that no longer have a mark to answer.
  - **Wrappers.**
    - `offerMissingRoll` (custodian only) → `proposePlanBridge` (kind `shared-goal`, label `Roll … into <goal> — from the cellar`).
    - `agreeMissingRoll` (partner only): an identical Bridge row. This is the Our Path rule: proposing the same thing is agreeing.
    - `declineMissingRoll` → `declinePlanBridge`.
    - `withdrawMissingRoll` → `withdrawPlanBridge`.
    - `rollMissingSubscription` (custodian only, both said yes) → `allocateHouseholdFundSurplus` with the occurrence key `cellar-roll:<recurrence>:<date>` in the note. It re-reads the books it runs on and refuses a second roll.
- **`src/core/cellarIncomeJars.ts`**
  - **Pay dates** come from household-visible income recurrences, split to a member or on a member-owned account, and from the member's shared pay cadence (`memberEarningSchedule`).
  - **Shift pay.** Shifts marked `household`/`both` add to the first pay date on or after them.
  - **Private rows.** A member's own Personal rows are read only when `ownPrivateOptIn` is set, and only for their own jar.
  - **Contribution banks** read `contribution-confirmed` Fund events for that member from the pay date to the next one.
  - **Hide choice.** `hiddenPayMembers` reads time-stamped `cellar-pay:<member>:hide|show:<iso>` marks from the calendar's union-merged notice keys. The newest mark wins.

### UI (cellar files)

- **`src/queen/QueenCellarRail.tsx`:** `CellarRailExtra`, `CellarExtraGlyph`. Extra jars stand in the day's seats, and each carries `--jar-px` from the rail's one `cellarScale`.
- **`src/queen/QueenCellarExtras.tsx`** (new):
  - `useCellarExtras` holds both readings. It keeps the private-pay opt-in on the device and withdraws void offers, once, while the room is open.
  - `CellarMissingCard`, `CellarIncomeCard`, `CellarCheer`.
  - The loft's outcome rule (`cellarPostedOk`): no screen says something saved unless the command's outcome says so.
- **`src/queen/QueenCellar.tsx`:**
  - Wires the extras.
  - A marked subscription's ordinary overdue jar steps aside.
  - The sub-line counts the glass and the marks, and the gate line names them.
  - **Show my pay in the jars** sits in the acts when your own pay is hidden.
- **`src/queen/queen-cellar.css`:** the glass, bank and ghost glyphs (Taylor and Newfoundland touches), the spark burst with reduced-motion and forced-colour fallbacks, and short frames that keep the *if* line.

### Proof and tests

- **`scripts/serve-household-home-proof.mjs`:** `cellar3=1` (fictional video club missing on the 5th, fictional music app $4 lower on the 3rd, fictional pay on the 10th and 18th), `roll=offered|agreed|rolled`, and `member=MEM-002`.
- **`test/cellar-missing-subscriptions.test.ts`** (16) covers:
  - grace and marks
  - one more cycle and carry-over
  - skipped vs new
  - late charge after grace
  - reversed charge
  - an amount that changed for good (two lower charges, or a lowered usual amount)
  - a cancelled subscription
  - a Personal subscription
  - the full offer → yes → roll walk, never twice
  - a late charge after a confirmed roll: one roll, settled, no double count
  - a late charge withdraws an unconfirmed offer
  - decline and re-offer
  - a roll refused by the safe surplus
- **`test/cellar-income-jars.test.ts`** (7) covers:
  - glass ahead and banks behind
  - the pay-date swap
  - a partner's Personal shift is never read
  - own opt-in only on own view
  - **partner hidden pay** (both phones; the newest mark wins, even when an older mark syncs in late)
  - a shared pay day with no amount
  - a joint income belongs to no one
- **`test/cellar-v3-ui.test.ts`** (6), jsdom with two phones over shared books, covers:
  - the rail
  - the glass card and hide/show across phones
  - the private-pay opt-in (device only, no write)
  - offer → yes → roll behind Confirm, then both phones tidy their spent offers
  - a late charge clears and withdraws
  - the partner has no offer button, and Escape returns focus
- **`test/cellar-v3-layout.mjs`:** browser evidence → `docs/evidence/cellar-v3/`.
- **`test/verification-focus-map.json`:** one mapping, appended last.

## Decisions and interpretations (defaulted, confirm)

- **The grace period is 3 days** (BUILD-BRIEF default). Missing means *today ≥ day + 3* with no charge. *Defaulted, confirm.*
- **"One more cycle"** means the mark stays until the cycle after next comes due. For a monthly subscription missed on Sep 12, that is until Nov 12. A mark from last month stands on this month's 1st. *Defaulted, confirm.*
- **"Charged less" compares against the recurrence's current amount.** Two lower charges in a row (or an edited usual amount) mean the price changed, so there is no offer. *Defaulted, confirm.*
- **A cancelled (paused) subscription is never missing.** A roll that was already confirmed stands. *Defaulted, confirm.*
- **How the custodian proposes and the partner confirms.** Hearth has no existing "custodian proposes, partner confirms" command for goal banks. The jug and the gun are custodian-only, and Fund contributions run the other way round. So:
  - The two-person consent uses the household's existing shared proposal record, the **Plan Bridge**. The partner's yes is their own identical offer.
  - The money still moves only through the Fund's rollover, by the custodian, behind Confirm.
  - As a result the offer also shows at the Sitdown and on the Our Path bridge, and lights the crown while it waits. A spent offer is withdrawn, so on the island it reads "offered, then took it back" even after it rolled. *Defaulted, confirm. Trust review asked (D-280).*
- **The pay-jar sources are household-visible rows only** (review H8). A partner's pay needs a shared-account income recurrence split to them, or household-visible shifts plus their shared pay cadence. A pay cadence alone makes no jar, and the line says so. Joint income with no member split belongs to no one. *Defaulted, confirm.*
- **Hiding your pay (Q-E: default shown)** hides your glass on both phones; your contribution bank stays, because it is already a shared Fund fact. The choice travels as time-stamped marks in the calendar's union-merged notice keys through the existing `dismissNotice` command. That avoids a schema change. The mark carries no amount. The hide covers only rows the partner can already see elsewhere, so it is a presentation choice, not a privacy boundary. *Defaulted, confirm.*
- **Including your own private pay** is a per-device opt-in, default off. It never leaves the phone.
- **"If all of it came in"** is the Fund's water on that day plus that one pay. Several pay dates are not stacked. *Defaulted, confirm.*

## Evidence log

All commands from the worktree root in the cloud container, Node 22.22.2.

- `npx tsc --noEmit -p .`: clean (after every code commit).
- `npx vitest run test/cellar-missing-subscriptions.test.ts test/cellar-income-jars.test.ts test/cellar-v3-ui.test.ts test/queen-cellar.test.ts test/queen-cellar-ui.test.ts test/queens-nest-ui.test.ts`: 6 files, **82/82**.
- `pnpm test -- --risk=medium-high --focus=test/cellar-missing-subscriptions.test.ts --focus=test/cellar-income-jars.test.ts --focus=test/cellar-v3-ui.test.ts --focus-reason=…`: **`quick-gate-passed`** at head `4f287970`.
  - Phases: diff-check, ai-surface, typescript 63.1 s, test-discovery (22 selected: 21 fast, 1 serial), vitest-fast 21 files / 264 tests, vitest-serial 1 file / 7 tests.
  - Total 124.0 s of the 300 s budget, no breach. `uiProofRequired: true`, answered by the browser run below.
- `HEARTH_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node test/cellar-v3-layout.mjs`: **22 records, 0 page errors**.
  - No page scroll at any capture.
  - axe has no serious or critical hits in the cellar with the card open (Classic).
  - The sparks animate once, and stand still under reduced motion.
  - Three themes × 320×700 / 390×844 / 720×900 / 1100×800.
  - The partner-offer, Confirm and rolled states were captured in Classic at all four sizes, and in Taylor and Newfoundland at 390 and 1100.
  - 78 PNGs are in `docs/evidence/cellar-v3/` (see its README).

## Remaining uncertainty

- **Not modelled in 3D.** The glass, the banks and the marks are drawn over the room, not sculpted.
- **Tiny jars at 100%.** With a $4,000 Fund, an $18 mark sits at the rail's 14px floor, and the person zooms in to read it (D-265, as designed).
- **Authorship of the hide marks.** A `cellar-pay` mark doesn't prove who wrote it (`dismissNotice` has no author check). The UI only offers the toggle for your own pay. A member-owned shared field would be stronger but is a schema change.
- **Partner pay on the partner's phone only.** Pay kept in a partner's Personal rows never reaches the other phone. That is correct, but it means the glass shows only what was shared. The per-pay-date publication in the migration plan (§2e) is not built.
- **The phones.** SwiftShader only, no real phone; the proof page's top-bar stand-in always reads "Alex (fictional)", even when rendering the partner.

## Handoff

Local branch `claude/plan-v3-cellar` only. Not pushed, not a PR, not merged, not deployed, not live verified.

**Next owners:**
- **Codex:** the trust and privacy review of the Bridge-as-consent path, the note-key double-count guard, the notice-key hide marks and the income sources.
- **Jonathan:** confirm the defaults above.
- **The integrator:** merge beside the money and studio tracks. The Slice 6 move of the cellar to `plan:prepare` does not touch these files.
