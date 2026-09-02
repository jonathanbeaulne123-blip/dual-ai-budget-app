# Hearth worksession — Clerk Slice 4 weekly document

- **Status:** CLOSED — MERGED #293; DEVELOPMENT KITCHEN PUBLISHED; LIVE HTTP VERIFIED
- **Opened:** 2026-09-02 (`America/Toronto`)
- **Closed:** 2026-09-02 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `cursor/clerk-4-weekly-49a4` merged to `main`
- **Baseline SHA:** `9f74cb780fed8a1a595a2dd791f510545a85570d` (Gate A stamp core, later `main` via #291)
- **Head SHA:** merge `97e1ae9df92f5af04ef6717b48c580829756656c`
- **PR or issue:** [#293](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/293) MERGED 2026-09-02T06:12:12Z
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** Development kitchen code published; no hosted household rows, schema, secrets, or Production continuity changed

## Household outcome

Jonathan and Bianca can open one calm weekly household document at different times. It reads the cited Clerk record, shows the conserved month register, puts the household Ask beside a read-only other door, and lists existing motions. Either person may stamp only their own line; one stamp completes the weekly and the other line remains blank without a reminder. Routes stay with the unique active non-custodian.

## Budget delta (5)

`+3` — the weekly composes sealed financial truth without owning new arithmetic or money authority.

## Engagement delta (3)

`+3` — the asynchronous ritual can finish with one quiet acknowledgement and no co-presence or nag.

## Verified baseline

- Facts: sealed stamp core `9f74cb7` (#291); Gate A exports exist; `askAlternatives` lives in `src/core/ask.ts`; `commitHousehold` passes `actingMemberId`.
- Integration parent: `origin/main@7101dce` (Register slice 9 Ask confirm #292 plus stamp core).
- Inferences: Cloud Agent git policy used `cursor/clerk-4-weekly-49a4` instead of the packet's `clerk/4-weekly`. Jonathan ordered Slice 4, then explicit merge and Development deploy.

## Scope

### In scope

- Pure viewer projection `weeklyDocument`
- Sibling weekly renderer beside `SitDownGuide`
- Stamp wiring through accepted-books with `actingMemberId`
- Weekly cadence offer; `none` hides the offer; biweekly/monthly withhold
- Focused tests and visual/accessibility proof
- Merge to `main` and Development kitchen publication after Jonathan's 2026-09-02 order

### Out of scope

- Monthly `SitDownSession.act` reuse
- Goal-deferral `place` command
- Reminders, co-presence, schema, hosted data, Production

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
- [x] Merged to `main` as `97e1ae9`
- [x] D-041 Development kitchen published
- [x] Live HTTP 200 / no-store with weekly bundle markers

## Plan

- [x] Branch from sealed SHA
- [x] Projection + tests
- [x] Renderer + stamp wiring
- [x] Proof + handoff
- [x] Integrate over current `main`, merge, publish Development kitchen, verify live HTTP

## Evidence log

- `pnpm exec vitest run test/weekly-document.test.ts test/weekly-document-ui.test.ts --maxWorkers=1` → 2 files, 14 tests passed
- Packet regression + `test/app-startup-p1.test.ts` → 13 files, 101 tests passed
- `pnpm check` tests lanes green on the implementation head; first `tsc` failure repaired at `89dc36e`; later `tsc`, Vite build, `pnpm ai:verify`, and `git diff --check 9f74cb7` green
- Keyboard focus: `outline: rgb(44, 106, 78) solid 2px`, `outline-offset: 2px`, `:focus-visible`
- Independent books PASS; privacy PASS; UX P1 live-region/figure clamp repaired at `c02232d`
- Visual artifacts under `/opt/cursor/artifacts/weekly_document_*.png` and `weekly_document_walkthrough.mp4` (fictional Development catalog; branch, not live signed-in)
- Merge: PR [#293](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/293) as `main@97e1ae9df92f5af04ef6717b48c580829756656c` at 2026-09-02T06:12:12Z (fast-forward from `7101dce`)
- Main CI [`33597829546`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33597829546) / job `test` `100144792101`: success, completed 2026-09-02T06:20:41Z
- Cloudflare Workers [`33597829535`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33597829535) / job `pages` `100144792093`: success; `VITE_PRODUCTION_CONTINUITY=0`; Worker `hearth-books`; Current Version ID `b9b79e02-143d-4c06-ae08-72bb14d36ce0`
- Live `GET https://hearth-books.jonathan-beaulne123.workers.dev/` → HTTP/2 200, `cache-control: no-store`
- Live `/assets/index-B6_CDc3Y.js` contains `weeklyDocument`, `stampWeeklyDocument`
- Live `/assets/Office-P5Sguoc5.js` contains `This week's page`, `This is another way the month could look`, `does not move a goal`, `weekly-document`, `weekly-stamp-link`
- Live `/assets/Office-C3dOKSHl.css` contains `.weekly-document`, `.weekly-stamp-link`, `outline:2px solid var(--pine)`, `outline-offset:2px`, reduced-motion `transition:none`

## Decisions

Follow the Cursor packet over the dated build manual and UX packet. Other door is read-only. Stamp copy stays `stamp`, like Charter `sign`. No extra Confirm on acknowledgement. D-196 records the weekly document presentation. Desk Ask Confirm from #292 stays on wide Shared Home only.

## Remaining uncertainty

Hosted RPC still does not inspect stamp JSON. Kitchen `PostcardBody` does not yet pass loading/error/offline; those surfaces are proven on the component. Weekly offer uses Toronto `todayKey()` and the Charter `cadenceWeekday`. Signed-in live Office interaction was not exercised against hosted household data.

## Handoff

Merged, Development kitchen published, live HTTP verified. Production continuity, schema, secrets, and household rows are unchanged. Next owner: Jonathan, to open the Development kitchen on the weekly weekday. Hosted RPC stamp-JSON inspection remains a later packet.
