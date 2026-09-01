# Charter Slice 5 return handoff — Held UI ready for review

**Use this packet, not chat memory.** A fresh AI can review or continue from the named SHAs without this thread.

The original implementation brief [`CURSOR_CHARTER_HELD_UI_HANDOFF_2026-09-01.md`](CURSOR_CHARTER_HELD_UI_HANDOFF_2026-09-01.md) is **consumed**. Its start SHA `a772936` / `94a9f50` is stale. D-193 core is already on `main` via [#283](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/283). This packet is the return from the UI implementation.

---

## Status and exact baseline

- **Target AI:** Codex as integrator/reviewer. Claude may run an independent UX pass. Cursor does not write a second implementation on this checkout.
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Core (SHIPPED on main, not this PR):** [#283](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/283) merged as `main@ff9d8d8de70c80fd567ba9835b3cc2ffbcd45082` on 2026-09-01. Sealed D-193 commands, selector, copy, PGlite v6 constraint. **Do not re-implement core.**
- **UI branch:** `cursor/charter-held-ui-115c`
- **UI base:** `ff9d8d8de70c80fd567ba9835b3cc2ffbcd45082`
- **UI head:** `ee704ad28f1a1bc476edbdee3e789748244e1679` (this packet). Product closeout `e800cede3c9cf249b27b6bfafbf84a01a5f1b629`.
- **Draft PR:** [#286](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/286) — **draft, not merged, not kitchen-published, not live, not shipped**
- **Worksession:** [`docs/worksessions/2026-09-01-charter-held-ui.md`](../worksessions/2026-09-01-charter-held-ui.md)
- **Risk:** High (consent presentation beside Confirm)
- **Decision owner:** Jonathan
- **Environment:** none. No hosted row, schema, secret, Production, or deploy.

Re-fetch `origin/main` before merge. GitHub `main` has moved past `ff9d8d8`. This PR will be dirty against current `main`. If Jonathan authorizes merge, rebase onto the then-current `origin/main` and record the new SHA. Do not force-push. Expect doc conflicts with Register slice 8 draft [#285](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/285) on `docs/DECISIONS.md` and `docs/AI_HANDOFF.md` if both land; rebase the later one.

---

## Household outcome

Bianca can pause Jonathan's Fund contribution proposal for a calm conversation without rejecting it or moving money. The proposal stays visible and confirmable. The exact holder releases; the exact proposer withdraws. Confirm remains the only contribution increase.

**Budget delta (5):** `+3` — the screen exposes existing append-only Hold/release/withdraw authority without inventing a balance effect.

**Engagement delta (3):** `+2` — Hold is a legible, reversible conversation state instead of silence or refusal.

**If they conflicted:** books won. Hold never looks like posted money, denial, or a second envelope.

---

## Facts vs inference

Facts:

- Diff vs `ff9d8d8` is six files: `src/HouseholdFundPanel.tsx`, `src/styles.css`, `test/held-ui.test.ts`, `docs/AI_HANDOFF.md`, `docs/DECISIONS.md` (D-193 why-note), `docs/worksessions/2026-09-01-charter-held-ui.md`.
- `git diff ff9d8d8 -- src/core/householdFund.ts src/core/commands.ts src/App.tsx src/Charter.tsx src/core/contributionRegister.ts` is empty.
- Waiting queue is one `householdFundContributionMotions(household, fund?.id)` call, filtered to `status === "open" || status === "held"`.
- Writes go only through `onCommand` to `holdHouseholdFundContribution`, `releaseHouseholdFundHold`, `withdrawHouseholdFundContribution`, `confirmHouseholdFundContribution`.
- Held copy is exactly `HOUSEHOLD_FUND_HOLD_COPY.status`: `Held — let's talk about this.`
- Fund books print `contribution-proposed`, `contribution-held`, `contribution-hold-released`, and `contribution-withdrawn` as `record only`, not `formatCad`.
- Focused tests on this tree: `pnpm exec vitest run test/held.test.ts test/household-fund-ui.test.ts test/held-ui.test.ts` → **3 files / 22 tests passed**.
- `pnpm exec tsc --noEmit` passed. `pnpm test:fast` on `b37719d`: **214 files passed / 1 skipped**, **1456 tests passed / 2 skipped**.
- Independent reviews on `39d799f`: UX merge-ready as draft (P2 focus/`aria-controls` later landed); books FAIL P1 Fund-books CAD (later `record only`); trust PASS on money/authority.

Inference:

- App Books wiring still uses the existing `onCommand` path; jsdom covers the panel, not a full App mount of Hold.
- Audit Office `sharedLedgerStory` / `sharedActionQueue` / `weekEventLabel` were not edited. A withdrawn motion can still appear there as a pending confirm with CAD. That is a follow-up packet, not a merge blocker for this Fund-panel slice unless Jonathan expands scope.

---

## Sealed APIs (do not duplicate)

From `src/core/index.ts`:

- `householdFundContributionMotions(household, fundId?)`
- `HOUSEHOLD_FUND_HOLD_COPY` (`action`, `status`, `notePlaceholder`)
- `holdHouseholdFundContribution`
- `releaseHouseholdFundHold`
- `withdrawHouseholdFundContribution`
- `confirmHouseholdFundContribution`

Core invariants already on `main` via #283:

1. Only the current Fund custodian may Hold, and they cannot Hold their own proposal.
2. Only the exact holder releases; only the exact proposer withdraws.
3. Held remains confirmable. It is never refusal.
4. Hold and release do not change `projectHouseholdFund` or the compiled journal. Withdrawal removes only the unconfirmed pending amount. Confirm is the only contribution balance increase.
5. Hidden UI is convenience. Commands remain the authority.

If review appears to require a core change, stop. Do not edit `src/core/householdFund.ts`, `src/core/commands.ts`, PGlite, continuity, or audit identity.

---

## What the UI does

For each `open` or `held` motion in `src/HouseholdFundPanel.tsx`:

- Card shows proposer name, CAD, date.
- Eligible custodian: **Confirm received** (pine `primary`) and **Hold** (outline `ghost`) as equal 44×44 controls in `.fund-motion-actions`.
- Hold opens a labeled optional note (`HOUSEHOLD_FUND_HOLD_COPY.notePlaceholder`), focuses the input, and sets `aria-controls` / `aria-expanded`.
- Held status is exact copy. Calm record: `{Holder} held this on {date}.` plus note when present.
- Exact holder: **Release Hold**. Exact proposer: **Withdraw proposal** (open or held). Custodian Confirm remains on held.
- Confirmed and withdrawn leave the waiting queue. No `Waiting for Bianca`. No `denied` / `rejected` / `declined`.
- Custody disclosure stays: the money remains in Bianca's savings; Hearth cannot move it.

CSS lives under `.household-fund-panel` in `src/styles.css`. Do not restyle the desk.

---

## Invariant laws for review

- No second motion fold in the Fund panel.
- No new money writer.
- No motion control may look like posted CAD before Confirm succeeds (Fund books `record only` for the four non-operating kinds).
- Bianca Month: `test/app-startup-p1.test.ts` and `test/month-rehearsal-mainline.test.ts` were not the focused gate; they were not edited. Do not duplicate a financial writer.
- Fictional Development fixtures only in tests and screenshots.

---

## Acceptance map

| Criterion | Evidence |
|---|---|
| Equal Confirm + Hold, ≥44px | `test/held-ui.test.ts`; CSS `min-height`/`min-width` 44px; inline `MOTION_ACTION_SIZE` |
| Hold with note, Confirm stays, projection/journal unchanged | `held-ui` hold-with-note test vs `projectHouseholdFund` / `compileHousehold` |
| Release / withdraw / confirm-held | `held-ui` release, withdraw, confirm-held tests |
| Non-custodian cannot Hold | `held-ui` plus core throw on `held.test.ts` |
| No `Waiting for Bianca` | source fence + forbidden-copy regex |
| One selector call site | source fence counts `householdFundContributionMotions(` === 1 |
| Fund books not CAD for Hold | `record only` test on held row |
| Core untouched | empty diff on `householdFund.ts` / `commands.ts` |
| 320 wrap | jsdom `flex-wrap` + scrollWidth check |
| Four-width visual | component harness, not kitchen: open 320/390/720/1100; held Bianca/Jonathan; released; withdrawn |

---

## Exact commands already run on this tree

```sh
pnpm exec vitest run test/held.test.ts test/household-fund-ui.test.ts test/held-ui.test.ts
# 3 files passed, 22 tests passed

pnpm exec tsc --noEmit
# exit 0

pnpm test:fast
# 214 files passed / 1 skipped, 1456 tests passed / 2 skipped

git diff --check
# clean
```

`pnpm check` is **not** a passing packet proof. Serial `test/demo-suite.test.ts` fails on `shiftEnvelopes` `"upcoming"` for seed 10101. That file does not import this UI. Do not repair demo-suite inside #286.

`pnpm build` was not re-run on `b37719d` because the books lane fails first in `pnpm check`. Fast-lane plus `tsc` is the local UI proof.

---

## Data, network, and release boundaries

- Development impact: Fund panel UI/CSS/tests/docs only.
- Production impact: none.
- Network: GitHub push of this branch only.
- MCP / hosted rows / schema / secrets / deployments: none.
- Real household or partner-personal data: none.
- Do not merge, deploy, apply hosted schema, change secrets, or use Production without Jonathan's explicit approval.

---

## Remaining uncertainty (honest)

1. **Audit Office second fold (follow-up packet, not this PR unless Jonathan expands):** `sharedActionQueue` / `buildSharedLedgerStory` / `weekEventLabel` still treat a withdrawn proposal as pending confirm and can print raw `contribution-held` beside CAD. Route those surfaces through `householdFundContributionMotions` in a separate High-risk packet. Do not edit them on #286 by default.
2. **Kitchen:** this is Fund-panel presentation already mounted where `HouseholdFundPanel` is used. There is no separate new route. Live kitchen 320/390/720/1100 after merge/deploy is still unproven.
3. **Forced-colors / reduced-motion:** CSS has a reduced-motion guard; forced-colors distinctness was not measured in a real browser.
4. **Record-only coverage:** tests assert the held Fund-books row; released/withdrawn book rows share the same helper but are not separately asserted.

---

## Required independent reviewers

High-risk. After any rebase onto current `main`:

1. Books auditor — Confirm stays the money boundary; Hold is not posted CAD.
2. UX auditor — 320/390/720/1100, keyboard after Hold composer, Dual Course.
3. Trust auditor — no new writer, sealed command path, no Auth/schema/Production.

Do not self-audit a merge you just rebased.

---

## Next owner and smallest next action

**Jonathan decides.** Smallest next action is one of:

1. **Review/merge #286** after rebase onto then-current `origin/main` (authorized merge only). Keep draft until that review. Do not call it shipped until `main` + live kitchen are verified.
2. **Open a follow-up packet** for Audit Office motion kinds (`sharedLedgerStory` / `sharedActionQueue` / `weekEventLabel` / personal contribution bridge) using the same sealed selector.
3. **Leave #286 draft** if Register #285 should land first; then rebase this PR.

Do not stack Charter amendment authoring, Register slice 8, or Fund core changes on this branch.

---

## Paste-ready review prompt

```
Review Hearth Charter Slice 5 Held UI only.

Repo: jonathanbeaulne123-blip/dual-ai-budget-app
Branch: cursor/charter-held-ui-115c
Base: ff9d8d8de70c80fd567ba9835b3cc2ffbcd45082 (D-193 core already on main via #283)
Head: ee704ad28f1a1bc476edbdee3e789748244e1679
Draft PR: https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/286
Packet: docs/briefs/CHARTER_SLICE_5_HELD_UI_RETURN_HANDOFF_2026-09-01.md

Do not merge, deploy, edit core/commands/PGlite, or treat this as shipped.
Confirm sealed householdFundContributionMotions only, Confirm is the money boundary,
Hold/release/withdraw are record-only in Fund books, and name any P0/P1.
Return Dual Course deltas, exact commands you re-ran, and the smallest next action.
```

---

## Expected return from the next AI

Exact rebased SHA if `main` moved, files touched, focused/full command results, whether Audit Office is in or out of scope by Jonathan's order, and a verdict: ready for Jonathan's merge decision, or blocked with one P0/P1.
