# Hearth worksession — Clerk Slice 4 weekly document

- **Status:** LOCAL PROOF COMPLETE; DRAFT PR #293; NOT MERGED
- **Opened:** 2026-09-02 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `cursor/clerk-4-weekly-49a4`
- **Baseline SHA:** `9f74cb780fed8a1a595a2dd791f510545a85570d`
- **Head SHA:** `c02232d85f343a66e408cef8b386a1ed9876ee6a` (implementation); docs refresh on the same branch
- **PR or issue:** https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/293
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

- Facts: sealed stamp core `9f74cb7`; Gate A exports exist; `askAlternatives` lives in `src/core/ask.ts`; `commitHousehold` now passes `actingMemberId`.
- Inferences: Cloud Agent git policy used `cursor/clerk-4-weekly-49a4` instead of the packet's `clerk/4-weekly`. Jonathan ordered Slice 4 on this agent after that default was stated.

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

- [x] One viewer stamps; document completes with the other line blank
- [x] Partner stamp control absent; command boundary rejects wrong actor
- [x] Non-owner projection/DOM has no route or hours data
- [x] Ask owner sees optional routes/refusal plus read-only other door
- [x] `cadence: "none"` renders no offer; weekday governs weekly eligibility
- [x] Clerk ready/integrity/withheld/empty preserved
- [x] Register has no ratio/ranking
- [x] Act 3 uses exact motion ids/statuses; stamp changes none
- [x] Offline/loading/error/untied/not-enough-data/empty-motion usable
- [x] Monthly sit-down tests still green
- [x] Keyboard 320px focus; reduced motion preserves state
- [x] Screens at 320/390/720/~1100

## Plan

- [x] Branch from sealed SHA
- [x] Projection + tests
- [x] Renderer + stamp wiring
- [x] Proof + handoff

## Evidence log

- `pnpm exec vitest run test/weekly-document.test.ts test/weekly-document-ui.test.ts --maxWorkers=1` → 2 files, 14 tests passed
- Packet regression + `test/app-startup-p1.test.ts` → 13 files, 101 tests passed
- `pnpm check` tests lanes green; first `tsc` failure repaired at `89dc36e`; later `tsc`, Vite build, `pnpm ai:verify`, and `git diff --check 9f74cb7` green
- Keyboard focus: `outline: rgb(44, 106, 78) solid 2px`, `outline-offset: 2px`, `:focus-visible`
- Independent books PASS; privacy PASS; UX P1 live-region/figure clamp repaired at `c02232d`
- Visual artifacts under `/opt/cursor/artifacts/weekly_document_*.png` and `weekly_document_walkthrough.mp4`

## Decisions

Follow the Cursor packet over the dated build manual and UX packet. Other door is read-only. Stamp copy stays `stamp`, like Charter `sign`. No extra Confirm on acknowledgement. D-196 records the weekly document presentation.

## Remaining uncertainty

Hosted RPC still does not inspect stamp JSON. `origin/main@7101dce` now contains merged stamp core (#291) and Register slice 9 Ask confirm (#292). This branch stayed on exact baseline `9f74cb7`. Kitchen `PostcardBody` does not yet pass loading/error/offline; those surfaces are proven on the component.

## Handoff

Local proof is on draft PR #293. Not merged, not deployed, not live. Next owner: Jonathan, for review and an explicit merge/deploy decision.
