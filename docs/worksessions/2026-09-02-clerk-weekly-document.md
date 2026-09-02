# Hearth worksession — Clerk Slice 4 weekly document

- **Status:** OPEN
- **Opened:** 2026-09-02 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `cursor/clerk-4-weekly-49a4`
- **Baseline SHA:** `9f74cb780fed8a1a595a2dd791f510545a85570d`
- **Head SHA:** pending
- **PR or issue:** pending draft
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** none

## Household outcome

Jonathan and Bianca can open one calm weekly household document at different times. It reads the cited Clerk record, shows the conserved month register, puts the household Ask beside a read-only other door, and lists existing motions. Either person may stamp only their own line; one stamp completes the weekly and the other line remains blank without a reminder. Routes stay with the unique active non-custodian.

## Budget delta (5)

`+3` — the weekly composes sealed financial truth without owning new arithmetic or money authority.

## Engagement delta (3)

`+3` — the asynchronous ritual can finish with one quiet acknowledgement and no co-presence or nag.

## Verified baseline

- Facts: `origin/main@6918d29`; sealed stamp core `9f74cb7` on `origin/codex/clerk-4-durable-stamp`; Gate A exports exist; `askAlternatives` lives in `src/core/ask.ts`; App `commitHousehold` does not yet pass `actingMemberId`.
- Inferences: Cloud Agent git policy uses `cursor/clerk-4-weekly-49a4` instead of the packet's `clerk/4-weekly`. Jonathan ordered Slice 4 on this agent after that default was stated.

## Scope

### In scope

- Pure viewer projection `weeklyDocument`
- Sibling weekly renderer beside `SitDownGuide`
- Stamp wiring through accepted-books with `actingMemberId`
- Weekly cadence offer; `none` hides the offer; biweekly/monthly withhold
- Focused tests and visual/accessibility proof

### Out of scope

- Monthly `SitDownSession.act` reuse
- Goal-deferral `place` command
- Reminders, co-presence, schema, hosted data, Production, merge, deploy

## Acceptance evidence

- [ ] One viewer stamps; document completes with the other line blank
- [ ] Partner stamp control absent; command boundary rejects wrong actor
- [ ] Non-owner projection/DOM has no route or hours data
- [ ] Ask owner sees optional routes/refusal plus read-only other door
- [ ] `cadence: "none"` renders no offer; weekday governs weekly eligibility
- [ ] Clerk ready/integrity/withheld/empty preserved
- [ ] Register has no ratio/ranking
- [ ] Act 3 uses exact motion ids/statuses; stamp changes none
- [ ] Offline/loading/error/untied/not-enough-data/empty-motion usable
- [ ] Monthly sit-down tests still green
- [ ] Keyboard 320px focus; reduced motion preserves state
- [ ] Screens at 320/390/720/~1100

## Plan

- [x] Branch from sealed SHA
- [ ] Projection + tests
- [ ] Renderer + stamp wiring
- [ ] Proof + handoff

## Evidence log

Record exact commands, results, visual widths, links, and current SHAs.

## Decisions

Follow the Cursor packet over the dated build manual and UX packet. Other door is read-only. No new D-number collision: D-196 records the weekly document presentation.

## Remaining uncertainty

Hosted RPC still does not inspect stamp JSON.

## Handoff

Local implementation in progress. Not merged, not deployed, not live.
