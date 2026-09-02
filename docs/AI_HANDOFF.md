# AI Task and Handoff Standard

## Cursor Clerk Slice 4 weekly document (2026-09-02)

**Status:** Ready to implement locally from sealed core `9f74cb780fed8a1a595a2dd791f510545a85570d` on `codex/clerk-4-durable-stamp`; not pushed, merged, deployed, or live. Complete packet: [`briefs/CURSOR_CLERK_SLICE_4_WEEKLY_HANDOFF_2026-09-02.md`](briefs/CURSOR_CLERK_SLICE_4_WEEKLY_HANDOFF_2026-09-02.md). Risk: **High**.

**Household outcome:** either active member can add only their own durable weekly acknowledgement; one stamp completes the document while the other line stays blank and quiet. The weekly composes Clerk, register, Ask, read-only alternative, and real motion truth without creating money or a new motion.

**Core seal:** separate append-only `WSTAMP-` Shared facts; exact Toronto date/week; one-record-only acceptance transition; Google-member binding at client enqueue/flush; direct and compacted replay; immutable merge; Personal/Hercules/financial-audit exclusion. Independent books/sync and privacy reviews found no blocking issue for the supported signed-in client path. The hosted RPC does not inspect stamp JSON and is not claimed as adversarial server enforcement.

**Dual Course:** core Budget `+2` / Engagement `+2`; target Slice 4 Budget `+3` / Engagement `+3`. Full core gate: **1,635 passed / 3 skipped tests**, all books/PGlite lanes, AI verification, TypeScript, and 401-module build. Cursor must rerun proof on its own exact head. No push/PR/release authority is included.

## Clerk Slices 2 + 3 corrected release candidate (2026-09-01)

**Status:** Corrected combined candidate on `codex/clerk-2-3-release`, integrated with current `origin/main@e7d98389be1a4ad831d4d83204061a68955df232` at `008310113e392827718e9013f92d3c4c499b5e15`; this evidence record follows. Source Slice 2 [PR #287](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/287) is integrated. Independent review found two P2 defects, repaired at `4624c31`; exact-head PR review then found a third P2 for long unbroken imported labels, repaired with `overflow-wrap: anywhere` and a regression fixture. Jonathan authorized push, merge, and Development kitchen deployment after exact-candidate verification. Risk: **Medium**.

**Household outcome:** Jonathan or Bianca can focus or tap any Clerk sentence and reveal, directly beneath it, the exact accepted transaction and Household Fund event rows that support that sentence. The explanation stays calm, compact, keyboard- and screen-reader-complete, and never hides the record behind a modal.

**Dual Course:** Slice 2 Budget `+1` / Engagement `+2`; Slice 3 Budget `+1` / Engagement `0`. Books won: a sentence is withheld unless every cited ID resolves in the supplied household, and the source/build fences reject advice, work instructions, and money-writing paths.

**Architecture:** `ClerkReading` remains a display-only leaf over the sealed Slice 1 record. Optional `onOpenRecord` is a passed callback. Same-day duplicates are distinguished by label, Toronto civil date, exact CAD amount, and stable row ID. `scripts/verify-ai-surface.mjs` scans every Clerk-owned source for proposal/work language and money-writer reachability. No `App.tsx` placement.

**Verification:**
- Combined focused Clerk suite: **3 files / 19 tests**
- `pnpm ai:verify`: **41 required files / 2 Clerk source fences**
- `pnpm exec tsc --noEmit`: passed
- Full Windows fast lane: **217 passed / 1 skipped files; 1,482 passed / 2 skipped tests**
- Full serial books lane: **18 passed / 1 skipped files; 145 passed / 1 skipped tests**, including a green dated Demo Suite
- Rendered 320/390/720/1100 proof: no horizontal overflow, all visible controls at least 44px, four unique exact-row names, unsupported sentence absent, ready/integrity/withheld/empty states present
- Direct Vite/Hercules builds, redirect guard, diff hygiene, and secret-path scan passed. Exact follow-up GitHub CI remains the final release check.

**Boundaries:** Local fictional/catalog fixtures only. Zero model, command, network, storage, hosted-row, schema, secret, Production-continuity, or household-data changes. The component performs zero fetches, so offline equals online.

**Next owner:** Codex re-fetches current `main`, pins and pushes the combined SHA, waits for exact-head CI, merges, then verifies the D-041 main deployment and live HTTP separately. `App.tsx` placement remains a later slice, so this release publishes the reviewed leaf and fences without exposing a new kitchen control.
## Charter Slice 5 Held UI (2026-09-01)

**Status:** Merged via [#286](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/286) onto `main` as `e7d98389be1a4ad831d4d83204061a68955df232`. Merge is proven; D-041 kitchen deployment and live behavior are not proven by that merge. Risk: **High** (consent presentation beside Confirm). Environment: client presentation only.

**Household outcome:** Bianca can pause Jonathan's contribution proposal for a calm conversation without rejecting it or moving money. The proposal stays visible and confirmable. The exact holder releases; the exact proposer withdraws.

**Dual Course:** Budget `+3`; Engagement `+2`. Books won: the UI uses the sealed D-193 selector and commands only. Hold/release still do not change Fund projection or journal. Confirm remains the only contribution balance increase. No second motion fold. Proposed/held/released/withdrawn Fund-book rows print `record only`, not CAD.

**What changed:** `src/HouseholdFundPanel.tsx` waiting queue is `householdFundContributionMotions` filtered to `open` | `held`. Eligible custodian gets equal-weight **Confirm received** and **Hold**. Held uses exact `HOUSEHOLD_FUND_HOLD_COPY.status`. Exact holder **Release Hold**; exact proposer **Withdraw proposal**. Removed `Waiting for Bianca`. Hold composer focuses the note and exposes `aria-controls`. Smallest CSS under `.household-fund-panel`. Tests in `test/held-ui.test.ts`. Worksession: [`worksessions/2026-09-01-charter-held-ui.md`](worksessions/2026-09-01-charter-held-ui.md).

**Verification:**
- Focused `pnpm exec vitest run test/held.test.ts test/household-fund-ui.test.ts test/held-ui.test.ts`: **3 files passed, 22 tests passed**.
- `pnpm exec tsc --noEmit` passed. `git diff --check` passed.
- Independent UX/books/trust review on `39d799f`; this follow-up lands the books P1 (`record only`) and UX P2 focus/`aria-controls`.
- Component harness screenshots at 320/390/720/~1100 for open, held, released, withdrawn.
- Core `src/core/householdFund.ts`, `src/core/commands.ts`, PGlite, continuity, schema, workers, App.tsx, Office, Charter amendment authoring, and Register slice 8 were not edited.

**Post-merge follow-up:** `codex/held-audit-office-truth` routes Audit Office pending actions/counts through `householdFundContributionMotions`, removes withdrawn proposals from the confirm queue, gives Held/released/withdrawn records human labels, and prints proposed/Held/released/withdrawn weekly lineage as `record only`. Worksession: [`worksessions/2026-09-01-held-audit-office-truth.md`](worksessions/2026-09-01-held-audit-office-truth.md).

**Boundaries:** Local fictional/catalog verification only. No hosted schema/row, Supabase, Auth/RLS, secret, provider, bank action, real household data, Production, or deploy.

**Next owner:** Complete the bounded Audit Office follow-up verification/merge. Kitchen live remains a separate D-041 evidence step; do not infer it from either merge.
## Charter Slice 5 Held core (2026-09-01)

**Status:** Core and architecture are implemented on branch `codex/charter-slice-5` at code commit `a7729362e469136636f438313215a3b03ccc570d`, rebased onto clean `origin/main@2879af2153affca10709608acbbd6c6e1b202af2` in [PR #283](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/283). Final High-risk release review passed on the code-equivalent pre-evidence tree; Jonathan explicitly authorized push, merge, and Development kitchen deployment on 2026-09-01. Fresh rebased GitHub and live receipts remain pending at this recorded point. Cursor owns the separate UI/UX implementation from [`briefs/CURSOR_CHARTER_HELD_UI_HANDOFF_2026-09-01.md`](briefs/CURSOR_CHARTER_HELD_UI_HANDOFF_2026-09-01.md).

**Household outcome:** The Fund custodian can Hold another member's open contribution proposal for a conversation without rejecting it or moving money. The exact holder can release, the exact proposer can withdraw, and a held proposal remains confirmable.

**Dual Course:** Budget `+3`; Engagement `+2`. Books won: Hold/release create no journal line or balance effect, withdrawal closes only an unconfirmed pending proposal, and confirmation remains the only contribution balance increase.

**Architecture:** D-193 adds immutable Shared `contribution-held`, `contribution-hold-released`, and `contribution-withdrawn` facts; one UI-facing `householdFundContributionMotions` fold; three authority-checked commands; ingest-time lineage validation; compacted command replay/audit retention; and a local PGlite v5→v6 constraint upgrade. No hosted migration or second money writer exists.

**Verification:** Focused core/continuity/PGlite proof passed **62/62**. The complete local proof passed AI-policy checks, **228 files / 1,571 tests**, the repository's **2 files / 3 tests intentionally skipped**, TypeScript, Vite production build, Hercules Pro UI, and redirect guard. Diff hygiene and staged secret scan passed. Existing PGlite browser-external/eval, large-chunk, and React test `act(...)` warnings remained non-failing.

**Boundaries:** Local fictional/catalog data only in verification. No React/CSS UI, browser acceptance proof, hosted schema/row, Supabase, Auth/RLS, secret, provider, bank action, real household data, or Production household mutation. The authorized Development client release makes the local on-device v5→v6 constraint upgrade available; it does not apply a hosted migration.

**Next owner:** Codex completes and records the authorized GitHub/Development publication. Cursor then implements and proves the existing Fund-panel interaction without changing core semantics; that UI head requires its own independent High-risk review.

## Test runner lanes (D-170) (2026-09-01)

**Status:** Release candidate on `codex/test-runner-lanes`; no deployment. Risk: **Medium** because verification reliability protects the books boundary.

**Household outcome:** The full local verification gate keeps direct PGlite/PostgreSQL-WASM tests serial but gives other Vitest files a bounded four-worker lane. The coordinator always runs the serial books lane, even when unrelated fast-lane failures occur, and returns failure if either lane fails.

**Budget delta (5):** `+1` — faster trustworthy feedback makes ledger and continuity regressions cheaper to catch; no financial rule or command behavior changed.

**Engagement delta (3):** `0` — no household-facing interaction changed.

**What changed:** `pnpm test` now invokes a Windows-safe Node coordinator. `test:fast` runs with four workers and excludes exactly the direct `src/ledger/engine.ts` importers on current `main`; `test:books` runs that exact set with one worker. `test/test-lanes.test.ts` recursively detects direct engine references and fails if either lane's membership or worker cap drifts, including an extra fast-lane exclusion. Direct `vitest run` remains conservative and serial.

**Data/environment:** Local configuration, synthetic tests, and documentation only. No household data, Supabase/hosted row, schema, secret, Production, deployment, or browser interaction.

**Next owner:** Jonathan's authorized merge decision; deployment is intentionally out of scope because this is developer test tooling only.

## Charter founding conversation and document page (2026-09-01)

**Status:** Independently reviewed, rebased, and merged in stack order: founding PR [#271](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/271) as `4074e657c94d68a4c2ad8cd67a269b8541b7ec90`, then document PR [#275](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/275) as `main@86da91c2fc16912c2f56dcf62d2dd53e2a8429be`. D-041 Cloudflare Workers Action [`33486435990`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33486435990) succeeded and published Worker version `33ce5c14-612c-4c79-87c3-d39219656c84`; the later release-record Action [`33488671926`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33488671926) published Worker version `1eb0b4b6-109f-4e70-b0a9-ed5e945ef541`. **Kitchen live HTTP is verified** at `https://hearth-books.jonathan-beaulne123.workers.dev/`: HTTP `200`, `Cache-Control: no-store`, and the served `index-0symyTI8.js` contained the founding and Charter-page markers at verification. The earlier `NXDOMAIN` finding came from a stale hostname that omitted the hyphen in `jonathan-beaulne123`, not from a disabled Worker route. This is Development kitchen publication, not Production continuity or Production household data.

**Household outcome:** An empty shared household can found its Charter through five quiet questions without creating an account or moving money; once founded, More opens the paper agreement with equal signature lines and only the viewer's own blank line offers Sign.

**Dual Course:** founding Budget `+2` / Engagement `+3`; document Budget `+1` / Engagement `+3`. Books won: Charter writes remain non-financial, TXN/SHF still require CAD accounts, unsigned is valid, remainder stays authored rather than computed, and the page adds no nag, badge, or partner-directed prompt.

**Verification:** Slice 3 rebased head `7a1e6175210eaa83b65778109925113f8addf805` passed PR CI `33484036459`: `221` files passed / `2` skipped, `1,523` tests passed / `3` skipped, TypeScript and both builds green. Slice 4 rebased head `e8f6a94fe643922ae7a5a8908c1ba88882ecd195` passed focused `66/66` and PR CI `33485352450`: `223` files passed / `2` skipped, `1,534` tests passed / `3` skipped, TypeScript and both builds green. Final-main CI [`33486436015`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33486436015) passed the same `1,534` / `3` gate. No P0/P1/P2 review finding remained. CI is recorded separately from the D-041 publish because merged, published, and live are distinct states.

**Boundaries:** No hosted schema, secret, provider setting, Supabase row, real household row, Production flag, or Production continuity was touched. The only environment action was the authorized D-041 Worker publication from `main`.

## D-189 Charter integrity repair (2026-09-01)

**Status:** Merged through [#274](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/274) as `main@450be34b6bc84f5bf5e203154c864cccba198eb5` and published to the Development kitchen. Main CI `33478168942` and Cloudflare Workers `33478168914` passed; Worker version `ae1df573-e6f9-43a2-af78-c67c03d0318e` is live. No hosted row, schema, secret, Production-continuity, or household-data action.

**Household outcome:** The Charter refuses a later Fund setup with a different custodian, retains independently created signatures/permissions/amendments across device convergence, and changes ceiling units only through one amendment carrying its typed value.

**Budget delta (5):** `+4` — closes silent agreement loss, custody disagreement, and unit reinterpretation without changing money.

**Engagement delta (3):** `0` — trust repair only; Charter UI slices remain separate.

**Implementation:** `HouseholdCharter.termsUpdatedAt` separates scalar-term authority from routine record activity. `mergeHouseholdCharters` merges member signatures and stable-id subrecords, replays resolved amendments deterministically, and applies Fund custody as the final invariant. `proposeCharterCeilingAmendment` carries kind plus integer cents/tenths atomically. `configureHouseholdFund` checks an existing Charter before mutation.

**Verification:** Current-main focused Charter/commands/materialization/outbox/CAS plus new-neighbour proof passed `100/100`. The exact-worktree Windows gate passed: AI-surface verification, `218` test files passed / `2` skipped, `1,499` tests passed / `3` skipped, TypeScript, Vite production build, and Hercules Pro UI build. Two independent final exact-diff audits and the PR code review found no P0–P3. PR CI `33477214483`, preview deploy `33477214530`, main CI `33478168942`, and production Worker publish `33478168914` passed. Live HTML returned `200` with `no-store`, and the served bundle contained the Charter integrity markers.

**Boundaries:** No money command or accounting formula changed. No UI, Supabase, migration, hosted data, provider, Production flag, or secret changed. The only environment action was publishing the reviewed client/Worker bundle to the Development kitchen under D-041.

## Charter page and empty signature line (2026-09-01)

**Status:** Draft PR [#275](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/275) on `cursor/charter-page-021f`, stacked on slice 3 draft [#271](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/271). **Not merged, not kitchen-published, not live.** Risk **High** (presentation). Sign/revoke reuse existing Charter commands. No Production household mutation, hosted schema, or secrets.

**Household outcome:** The household charter reads as a paper document. An unsigned line is the same rule and name as a signed one, with nothing added. The viewer may sign only their own line. The other person's blank line is silent.

**Budget delta (5):** `+1` — display of the existing Charter record. No posting, no second envelope.

**Engagement delta (3):** `+3` — the agreement is visible, patient, and never accusing.

**If they conflicted:** books won. No badge, nag, streak, or nav count on an unsigned line. More card no longer says to sign. Held amendments never read as a refusal.

**What changed:** `charterView.ts` (`SIGNATURE_VIEW`, `signatureLines`); `Charter` overlay; More → the charter opens the page when founded. Worksession: [`worksessions/2026-09-01-charter-page.md`](worksessions/2026-09-01-charter-page.md).

**Verification:**
- Focused page + founding + record + commands + Bianca `app-startup-p1` + `month-rehearsal-mainline`: **39 passed**.
- `pnpm check` on `53c0bcc`: AI surface verified; **1486 passed / 3 skipped**; `tsc` + Vite + Hercules Pro UI green. Follow-up commit is touch-target + More copy + docs.
- Independent books audit: **PASS**. Independent UX audit: **PASS WITH NOTES**; P1 sign/revoke `min-width: 44px` fixed after the audit.
- Browser, fictional Development demo: More → the charter document; Jonathan signed only his line (`1 Sept 2026`); Bianca unsigned with no pending copy; close; viewports 320 / 390 / 720 / ~1100.

**Uncertainty:** Stacked on unmerged slice 3. Dark/forced-colors not verified. App More wiring is not jsdom-covered. `origin/main` has moved to `450be34` (#274 integrity). GPT merge packet requires rebase before land.

**Data and environment disclosure:**
- Development impact: none (branch/PR only)
- Production impact: none
- Network calls or data sent: GitHub push of this branch
- MCP access: none for household data
- Hosted rows/schema/secrets/deployments: none (Worker preview is not the kitchen URL)
- Real household or partner-personal data used: none (fictional Development / catalog)

**Next owner:** Jonathan asked GPT to review and merge slices 3 and 4. Paste-ready packet: [`briefs/CHATGPT_CHARTER_3_4_REVIEW_MERGE.md`](briefs/CHATGPT_CHARTER_3_4_REVIEW_MERGE.md). Rebase onto current `origin/main` (`450be34`, includes #274 charter integrity) before merge. Merging `main` queues D-041 kitchen publish. Do not apply schema or touch Production.

## Charter founding conversation (2026-09-01)

**Status:** Draft PR [#271](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/271) on `cursor/charter-founding-flow-021f` at `7042d7eca20affd6d58ed2face1dab38fce587da`. Base Charter slice 2 sealed `origin/main@effd7b3` (local branch). **Not merged, not kitchen-published, not live.** Risk **High** (presentation). Writes only through existing Charter commands. No Production household mutation, hosted schema, or secrets.

**Household outcome:** From an empty household (members, no accounts/Fund/books), Shared Home opens a five-question founding conversation. Skip is a peer of Next. One person can found alone, then Sign it or Later. Catalog/demo kitchens stay on the office until More → the charter. Founding no longer requires a CAD account; posting still does.

**Budget delta (5):** `+2` — founding records the Charter; it does not post money or create a second envelope.

**Engagement delta (3):** `+3` — empty house opens on paper questions instead of an unexplained desk.

**If they conflicted:** books won. No ledger dollar figure in the flow. Kitchen-local Charter writes skip `requireCadAccounts`; TXN/SHF still require an active CAD account. Permissions grant only when the founder can give away their own confirm. Unsigned remains valid.

**What changed:** `commitCharterFounding`; `CharterFounding` takeover + More → the charter; `commit()` posting gate; focus trap / inert shell / heading announcement. Worksession: [`worksessions/2026-09-01-charter-founding-flow.md`](worksessions/2026-09-01-charter-founding-flow.md).

**Verification:**
- Focused founding + Charter record/commands + Bianca `app-startup-p1` + `month-rehearsal-mainline` on this tree: **34 passed**.
- `pnpm check` on `7042d7e` (pre-docs): AI surface verified; **1481 passed / 3 skipped**; `tsc --noEmit` + Vite **388 modules**; Hercules Pro UI green. Pre-existing 3 skipped unchanged.
- Independent books audit: first FAIL (P1 empty persist); re-audit **PASS** after `isLedgerWrite` gate.
- Independent UX audit: **PASS WITH NOTES**, then inert shell / heading focus / no nested headings in follow-up commits.
- Browser, fictional Development demo: More → the charter through five questions, Later, Escape does not dismiss; close screen at 320 / 390 / 720 / ~1100.

**Uncertainty:** Charter page is slice 4. Dark/forced-colors not verified. Empty-house auto-open is unit-tested; App wiring is not jsdom-covered.

**Data and environment disclosure:**
- Development impact: none (branch/PR only; Worker preview of a branch is not the kitchen URL)
- Production impact: none
- Network calls or data sent: GitHub push of this branch
- MCP access: none for household data
- Hosted rows/schema/secrets/deployments: none
- Real household or partner-personal data used: none (fictional Development / catalog)

**Next owner:** Jonathan asked GPT to review and merge with slice 4. Packet: [`briefs/CHATGPT_CHARTER_3_4_REVIEW_MERGE.md`](briefs/CHATGPT_CHARTER_3_4_REVIEW_MERGE.md). Rebase onto `origin/main@450be34` (#274) before merge. Kitchen publish follows merge to `main` (D-041).

## D-189 interrupted local PGlite recovery (2026-08-31)

**Status:** Local High-risk release candidate on `codex/pglite-interrupted-recovery` from clean `origin/main@87acccd4f358286693f7a65172aec39d6ca4adbc`. No push, PR, merge, deploy, cloud reset, hosted row, schema, secret, or Production action.

**Household outcome:** A saved household with an exact accepted financial receipt can reconstruct an absent/interrupted on-device PGlite projection and reopen Confirm only after the rebuilt journal passes the same hash/balance inspection. Missing or altered receipts and genuine mismatches remain blocked. The Development reset button no longer falsely says `Starting over…` merely because books validation is blocked.

**Budget delta (5):** `+4` — receipt-proved local books recovery without weakening the write gate.

**Engagement delta (3):** `0` — trust infrastructure; no companion behavior is appropriate while books authority is being repaired.

**Verification:** focused startup/readiness/reset plus real PGlite suites passed **33/33** across the first run; the final startup/readiness/reset rerun passed **12/12**, including exact rebuild options and the Retry-validation path. The exact final tree's complete suite passed **1,453/1,453** with **3** intentional skips after adding the bundled Python and Git Unix tools to this Windows shell. `pnpm ai:verify`, TypeScript, the production Vite build, the Hercules Pro UI build, and `git diff --check` passed. Two independent read-only reviews found no P0/P1 blocker; their notes are recorded in the worksession.

**Environment/data:** local synthetic tests only. Development and Production use the same receipt-gated local recovery logic, but Production continuity remains off and untouched. Google identity and Household/Personal scopes do not change. No peer device is required; outbox/offline/hosted behavior is unchanged.

**Worksession:** [`worksessions/2026-08-31-pglite-interrupted-recovery.md`](worksessions/2026-08-31-pglite-interrupted-recovery.md)

## Glance plates, seal lists, scrolling month sheet (2026-08-31)

**Status:** Merged [#265](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/265) as `main@7d01b62`. Kitchen Cloudflare Workers [`33460617226`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33460617226) **success**. Worker version `0a9ceae5-6227-409c-8121-dc964631b1e5`. Live `index-Cdc4gCTV.js` → lazy `Office-BC-mxQLw.js` with `desk-plate`, `aria-expanded`, “Income this month”, “Expenses this month”, `month-posted-list`, leftover-spend footing, and no `selectPlate` / `plate-on-stage`. CSS `index-CEcjvoXs.css` has `--stories-open-height: calc(680px + 2.2rem)`, `.desk-plate.is-open`, collapsed `min-height:80px`. HTML `Cache-Control: no-store`. **Merged and kitchen-published.** Risk was **High** presentation, then Release because Jonathan ordered merge/deploy. No Production household mutation, hosted schema, or secrets.

**Household outcome:** On wide Shared and Personal Home, the six left stories sit as short glance lines and grow in the mosaic for the drawing, footing, and Cabinet handle. They no longer replace the month sheet. Money in opens this month’s posted income rows. Money out opens this month’s posted expense rows. Leftover spend still goes to Plan. The centre stage is a six-open-card height with inner vertical scroll. iPhone `OfficePhone` still sends the two money seals to the blotter.

**Budget delta (5):** `+3` — glance lines and the two lists are the posted month, not a second Fund story.

**Engagement delta (3):** `+3` — less wall of text; one tap to the matching list; the month sheet no longer eats the whole desk.

**If they conflicted:** books won. Lists are display only. Refunds stay in `partitionLedger` `other`, not expenses. Shared lists use the floor’s visible `household`, not partner-personal rooms. No `goal.savedCents` writes. Phone seals stay on the blotter.

**What changed:** `DeskPlateModel.glance`; plates grow via `openPlateIds` instead of staging; `monthPostedRows`; Money in/out → `MonthPostedList`; leftover spend still `onGo("plan")`; `--stories-open-height` plus stage `overflow-y: auto`; a second tap on an open money seal closes the list. Integrated `origin/main@d29d2d6` (D-187/D-188) before publish. Worksession: [`worksessions/2026-08-31-desk-glance-seals.md`](worksessions/2026-08-31-desk-glance-seals.md).

**Verification:**
- Focused `test/desk-plates.test.ts` + `test/desk-plates-dom.test.ts` + Bianca `test/app-startup-p1.test.ts` + `test/month-rehearsal-mainline.test.ts` on `7d01b62`: **30 passed**.
- `pnpm check` on `7d01b62`: **1449 passed / 3 skipped / 0 failed**; TypeScript clean; Vite 384 modules; Hercules Pro UI green.
- Independent UX audit: keep; seal `aria-pressed` now toggles off on a second click.
- Browser, fictional Development demo (pre-merge): 1100 open plate with Month Spread still centre; Money in posted list; 720 stacked open plate; 390 phone still has wax seals and phone story tiles (not desk-plate Cabinets); leftover spend → Plan.
- Live kitchen HTML after merge deploy: `https://hearth-books.jonathan-beaulne123.workers.dev/` serves `Office-BC-mxQLw.js` with glance expand and this-month posted lists.

**Uncertainty:** Live forced-colors / reduced-motion DevTools. Phone blotter body is below the story strip, so a seal click can look like a no-op until you scroll. Video review noted possible plate-footing overlap while shrinking toward phone; `OfficePhone` does not render `DeskPlate`. Main CI `33460617301` was still running at kitchen-proof time.

**Data and environment disclosure:**
- Development impact: kitchen URL published via D-041 `wrangler deploy`
- Production impact: none (no Production household mutation, schema, or secrets)
- Network calls or data sent: GitHub push of `main`; Cloudflare `wrangler deploy` via Actions
- MCP access: none for household data
- Hosted rows/schema/secrets/deployments: Cloudflare Workers `33460617226` success; Worker `0a9ceae5-6227-409c-8121-dc964631b1e5`; no schema apply, no secrets change
- Real household or partner-personal data used: none (fictional Development demo)

**Next owner:** Jonathan. Hard-refresh the kitchen URL on wide Paper office Home. Leftover spend still Plan. Phone seals still blotter. **Merged and kitchen-published.** Not Production.

## D-187 founding-household rehearsal preflight (2026-08-31)

**Status:** Release-ready Development candidate on `codex/founding-household-preflight`, rebased onto exact `origin/main@2690c577aaad3c0b03f01ab33c403ef07c8fe65c`. Jonathan authorized rebase, merge, and deploy on 2026-08-31. The real rehearsal has not started, and Production remains out of scope.

**Household outcome:** Jonathan and Bianca cannot start or replay `Our month` until the current browser has downloaded a private Development backup, selected it again, proven it is the exact current balanced snapshot, and recorded the four named-human preparation acknowledgements. A changed household revision closes the gate again.

**Dual Course:** Budget `+4` through exact recovery-before-start and visible stop conditions. Engagement `+2` through one calm preparation card inside the existing D-183 Month surface. Confirm, PGlite acceptance, money meaning, and the four-week workflow are unchanged.

**What changed:** `verifyCurrentHouseholdRecovery` reuses the ordinary import validator, requires matching Development wrapper/embedded environments and household id, compares the financial audit hash, and compares a canonical full-snapshot SHA-256. It returns metadata only and performs no persistence or transport. `RehearsalPreflight` holds the proof and acknowledgements in React session state, announces download/error/status changes, and gates initial Start plus both replay routes. An interactive jsdom test proves upload-before-download stays blocked, fresh download/reselection plus all checks unlocks Start, revision change relocks it, and a mismatched wrapper error is announced.

**Verification:** exact rebased runtime candidate `6372c8d` is runtime/test-tree identical to fully checked candidate `5db7140ee53298efc1de9413f99779a9f77eec5a`, which passed AI-surface verification, **214 passed / 2 skipped files and 1,442 passed / 3 skipped tests**, TypeScript, the Vite Production build, Hercules Pro UI build, and redirect guard. The combined D-187, D-186 sync, QR/Auth/storage, startup, and Shared Home integration proof passed **16 files / 131 tests**. Independent trust/release, UX/accessibility, and verification re-reviews report no remaining P0–P2. Existing React `act`, PGlite browser-external/eval, and chunk-size warnings remain non-failing and unchanged.

**Environment/data disclosure:** local Development code and fictional tests only. The feature handles a user-selected private household export in browser memory, then discards it; it does not commit the file, send it to an AI/model, upload it, persist it, invoke continuity, access Supabase, alter schema/secrets/providers, touch Production, or create real rehearsal evidence.

**Open gates:** real separate Google identities, Household access/device inventory, the deployed build receipt, Personal isolation, the actual private backup file, weekly cadence, and stop agreement remain named-human Development evidence. Programs 1–6 and their elapsed-time gates remain open.

**Worksession:** [`worksessions/2026-08-31-founding-household-preflight.md`](worksessions/2026-08-31-founding-household-preflight.md)

## Desk plates — Shared and Personal Home mosaic (2026-08-31)

**Status:** Merged [#260](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/260) as `main@c75d72e`. Kitchen Cloudflare Workers [`33447063786`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33447063786) **success**. Worker version `e57b4a67-fbbb-45a2-b57c-043cda197101`. Live `index-BZnOtUHs.js` → lazy `Office-C6krQOJZ.js` with `desk-plate`, “What is due next”, “What the cards are doing”, `scope!=="personal"`, and Standing. CSS `index-D8gcAel_.css` has `.desk-plate-handle`. HTML `Cache-Control: no-store`. **Merged and kitchen-published.** Risk was **High** presentation, then Release because Jonathan ordered merge/deploy. No Production household mutation, hosted schema, or secrets. Migration 018 was already on `main` from #263; this session did not apply schema.

**Household outcome:** The six wide Home mosaic tiles on each floor are desk plates: a household question, a verdict sentence, one of six primitives, a footing, and a cabinet handle. Single click puts the plate on the stage in place of the Month Spread. Double-click and the handle open the existing instrument. Close returns to the Spread. Display only.

**Budget delta (5):** `+3` — mosaic answers household questions from existing selectors instead of repeating the Spread.

**Engagement delta (3):** `+3` — laptop open-to desk is a 2×3 instrument strip.

**If they conflicted:** books won. Shared plates never reintroduce `now` / `attention` / `change`. Pair uses one scale. Empty states are prose. Cabinet handle stays wherever double-click exists. No `goal.savedCents` writes. iPhone mosaic untouched. Shared `cards` never names a `scope === "personal"` card.

**What changed:** `src/core/plates.ts`, `src/core/deskPlates.ts`, `src/DeskPlates.tsx`, `src/desk-plates.css`; OfficeWide mosaic wiring; Shared Home mosaic column 460px below 1200px while F-4 still drops the Kitty shelf under the stage; ≥1200 uses `1.15fr | 1.75fr | 0.72fr`. Follow-up: `aria-current` on the plate, partner-personal card fence, merge of `origin/main` through D-186. Worksession: [`worksessions/2026-08-31-desk-plates.md`](worksessions/2026-08-31-desk-plates.md).

**Verification:**
- Focused `test/desk-plates.test.ts` **21 passed** (includes Bianca private Amex canary) plus `test/desk-plates-dom.test.ts` **1 passed**. After D-186 merge: plates + Bianca `test/app-startup-p1.test.ts` + `test/month-rehearsal-mainline.test.ts` **27 passed**; `tsc --noEmit` green.
- `pnpm check` on `7044423` (D-185 integrated, pre-D-186): **1425 passed / 3 skipped**; Vite 385 modules + Hercules Pro UI green.
- Independent UX audit: **PASS WITH NOTES** after F-1 / N-1 / N-2 repairs.
- Independent trust review: **FAIL** on personal-card leak before merge; fenced `account.scope !== "personal"`; canary green.
- Browser on fictional Development demo: click / close / handle / double-click / keyboard / Personal floor; viewports 320 / 390 / 720 / 1100 / 1440.
- Live kitchen HTML after merge deploy: `https://hearth-books.jonathan-beaulne123.workers.dev/` serves `Office-C6krQOJZ.js` with plate kickers and the personal-scope fence.

**Uncertainty:** Forced-colors and reduced-motion CSS exist; live Chrome Rendering emulation was not completed. `paperHomeMosaic` still encodes old story tile ids for Classic/helper tests; OfficeWide no longer calls it. Empty mosaic plates still echo the same sentence in verdict and `.desk-plate-empty`.

**Data and environment disclosure:**
- Development impact: kitchen URL published via D-041 `wrangler deploy`
- Production impact: none (no Production household mutation, schema, or secrets)
- Network calls or data sent: GitHub push of `main`; Cloudflare `wrangler deploy` via Actions
- MCP access: none for household data
- Hosted rows/schema/secrets/deployments: kitchen SPA only; no schema apply; no secrets changed
- Real household or partner-personal data used: none (fictional Development demo seed; privacy canary is synthetic)

**Next owner:** Jonathan. Hard-refresh `https://hearth-books.jonathan-beaulne123.workers.dev/` on a wide Paper office Home. Classic desk still needs Drawer → Paper office. iPhone Home is unchanged.

## D-185 gap-closing evidence foundation (2026-08-31)

**Status:** Local Release-risk candidate on `codex/gap-closing-foundation`, rebased onto `origin/main@aa56f373ab62dbfec1dfa744e6c8b3606caee4c7`. **Not pushed, merged, deployed, or presented as Production evidence.**

**Household outcome:** Jonathan and Bianca get a fail-closed five-dimension release gate plus repeatable browser evidence for the public roadmap task/recovery journeys. Roadmap tabs now activate with Enter and Space as well as arrow/Home/End keys. The public-only collector covers 320/390/430/720/1100 px, screenshots, redacted console/page errors, all-origin network failures, timeouts, overflow, actual keyboard focus order and tab-panel semantics, full axe findings, measured 200% text growth/content bounds, and normal-versus-reduced motion behavior.

**Budget delta (5):** `+3` through evidence that refuses to call a money/privacy/recovery claim complete when artifacts are stale, mismatched, synthetic, local-only, or missing human acceptance. **Engagement delta (3):** `+2` through real-browser keyboard, focus, responsive, zoom, and reduced-motion proof. No money meaning, posting, continuity, Auth, or hosted authority changed.

**What changed:** D-185/P0-03 evidence contracts and evaluator were reconciled onto current main; browser collection uses Playwright plus axe and writes only ignored, hash-linked local artifacts; the public-roadmap tablist explicitly accepts Enter/Space; and `check:windows` discovers the bundled Bash, real Python, Node, and pnpm runtimes without weakening `pnpm check`. Browser reports are permanently `claimable: false`; exact clean deployment, live-origin evidence, privacy review, hands-on review, and a named human remain required for any literal `5/5`.

**Verification:** focused gate/collector/roadmap tests passed **3 files / 30 tests**, including deliberate redaction, private/cross-origin refusal, and reduced-motion red fixtures. The latest runtime-bearing exact tip passed AI-surface verification, **210 passed / 2 skipped files and 1,403 passed / 3 skipped tests**, TypeScript, the 383-module Vite production build, Hercules Pro UI build, and the no-`dist/_redirects` guard. Its ignored browser report passed **10/10** public-roadmap task/recovery runs over all five widths with zero serious/critical axe findings, console/page errors, all-origin network failures, timeouts, overflow failures, focus-order failures, text-resize failures, or reduced-motion failures and remains `claimable: false`. The implementation content is now `110337c` after the final clean rebase over the upstream documentation-only closeout; the exact final branch SHA and repeated focused/browser receipts are reported in the external handoff because a commit cannot contain its own SHA. Existing React act, PGlite browser-external/eval, and chunk-size warnings remain unchanged.

**Data and environment disclosure:** local static synthetic/public-roadmap content only. No real household amounts, descriptions, identities, partner-personal data, credentials, model input, MCP household access, hosted rows, schema, secrets, provider settings, Production, push, merge, or deploy action. Browser artifacts remain ignored under `artifacts/browser-evidence/`.

**Open gates:** Program 0's local evidence foundation is closed. Program 1–6 still require elapsed Jonathan/Bianca rehearsal, two-device evidence, access/security work, Production approval, and later design-partner consent; none is implied by this packet.

**Worksession:** [`worksessions/2026-08-31-gap-closing-evidence-foundation.md`](worksessions/2026-08-31-gap-closing-evidence-foundation.md)

## D-186 automatic last-entry-wins reconciliation (2026-08-31)

**Status:** Release review **PASS** on runtime candidate `aa774baed47183dd4ca4a3ee66a21d0a1c0c9447`, rebased onto `origin/main@201a449cb99251c8a66eb3b282d950305752d1f1`. Jonathan authorized commit, push, merge, and Development kitchen publication on 2026-08-31. Live household use, schema, hosted rows, secrets, and Production are not authorized.

**Household outcome:** the “Two versions need review” snapshot chooser is removed. Distinct entries from both phones remain; the later accepted same-id entry wins automatically; old saved conflicts and blocked retries self-heal in the background. Accepted reversals stay immutable.

**Budget delta (5):** `+4` — no whole-ledger discard decision, while PGlite, double-entry, scope, audit hash, idempotency, and reversal history stay authoritative. **Engagement delta (3):** `+3` — ordinary recovery is quiet and a sharing delay remains a non-blocking Retry/background state.

**What changed:** ordered command replay now applies later same-id facts; snapshot recovery uses existing record-level recency and an explicit canonical tie-break; persisted conflicts are upgraded; old conflict-blocked outbox rows retry; the modal and its review copy are gone. Worksession: [`worksessions/2026-08-31-last-entry-wins-sync.md`](worksessions/2026-08-31-last-entry-wins-sync.md).

**Verification:** current-main focused sync/accounting/recovery gate **78 passed**. Exact `pnpm check` passed: AI surface verified, **1,410 passed / 3 skipped / 0 failed**, TypeScript clean, kitchen production build complete, Hercules Pro UI build complete, and no-redirect guard passed. Independent exact-head verifier passed 12 focused files / 119 tests plus TypeScript; independent money/trust review and release review both returned **PASS; no P0/P1**. `git diff --check` passed. Existing Vite/PGlite bundle warnings and React test `act(...)` warnings remain non-failing and outside this packet.

**Next owner:** Codex completes the authorized current-main release and exact Development verification. A live signed-in two-device rehearsal remains a separate evidence gate.

## The Month Spread — Shared Home centre (2026-08-31)

**Status:** Merged [#259](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/259) as `main@d648258`. Canon record `main@ed852a8`. Kitchen deploys Cloudflare Workers [`33432365828`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33432365828) (merge) and [`33432832963`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33432832963) (docs record) both **success**. Current Worker version `2488cac3-f052-48a9-8200-65d5ee848f4b`. Live bundle still `Office-BBr3Ic0W.js` with Standing bars and “A proposal is not on the bar.” **Merged and kitchen-published.** Risk was **High** (presentation plus F-2/F-3). No Production household mutation, hosted schema, or secrets.

**Household outcome:** Shared Home's centre is the month as one sheet — Standing, Course, Docket. Standing names each person's confirmed Fund contributions this month (demo Bianca `$1,600.00`, Jonathan `$1,660.00`). Seals, mosaic, Kitty Banks, FAB, and Add slideshow stay.

**Budget delta (5):** `+3` Spread / `+1` bars. **Engagement delta (3):** `+3` / `+1`. Books won: proposals off the bar; both fills pine; Course from `booksHousehold`; Docket never posts.

**What changed:** `sharedMonthCourse` plus Month Spread; F-1 Kitty rollover as a claim; F-2 reconciliation covering `date`; F-3 monthly target = this month's confirmed contributions; Standing `contributionsByMember` paper bars; Course compiled from accepted books. Integrated `origin/main` through D-184 before merge. Worksession: [`worksessions/2026-08-31-month-spread.md`](worksessions/2026-08-31-month-spread.md).

**Verification:**
- Focused `test/month-spread.test.ts`: **33 passed**. After integrating `main@1650910`, focused Spread+Add **60 passed**; `pnpm check` **1377 passed / 3 skipped**.
- Kitchen HTML `https://hearth-books.jonathan-beaulne123.workers.dev/` after the docs-record deploy still serves `index-DQXFR0dT.js` → lazy `Office-BBr3Ic0W.js` with `ms-contrib`, `I · Standing`, `II · Course`, `III · Docket`, and “A proposal is not on the bar.” CSS `index-CsctdKPv.css` has `ms-contrib`. HTML `Cache-Control: no-store`.
- Pre-merge Paper office demo: Bianca `$1,600.00`, Jonathan `$1,660.00`; Fund free-to-spend `$2,018.60` ≠ leftover-spend `$498.64`.
- Books **PASS WITH NOTES**; UX `role="group"` **PASS**; security review no medium+ findings.

**Environment/data:** fictional Development demo seed for local proof. Kitchen publish is D-041 `wrangler deploy` of the SPA. No Production household rows, schema, or secrets changed.

**Next owner:** Jonathan. Open the live kitchen on a wide Paper office Home and confirm Standing bars. Classic desk still needs Drawer → Paper office. iPhone Home is unchanged.

## D-181 Add slideshow + FAB onto current main (2026-08-31)

**Status:** Integration `3b0598c` on `cursor/add-slideshow-main-aef7` (plus unused-`shiftStep` follow-up). Base `origin/main@683910bc19f067ed5a9f4adee394f6026cda0899`. Jonathan ordered **merge, push, and deploy**. Risk: **Release**. Kitchen-desk D-173 already shipped via #252.

**Household outcome:** Live kitchen `+` opens Shift / Income / Expense / Transfer. Add is unique cashpad prompt slideshows. Confirm still posts. Slideshow never `postEntry`.

**Budget delta (5):** `+3` — calmer posting; accepted-books account tiles; Confirm remains the write.

**Engagement delta (3):** `+3` — unique ceremonies instead of one dense sheet.

**If they conflicted:** books win. Cut flourish before auto-posting or hiding Confirm. Pictures stay on this phone.

**What changed:** Merged `#244` unique commits onto current `main`. Kept `main` D-165–D-180 (Shared Money stays D-174). Renumbered Add slideshow **D-181**. Shift jobs panel uses D-175 deferred surfaces. Clocked hours use D-178 `ShiftElapsedHint`. CadPad keeps `emptyDisplay` and giant Enter. D-175 startup tests walk to `[data-add-confirm]`.

**Verification:**
- Focused: `pnpm exec vitest run test/add-slideshow.test.ts test/add-slideshow-ui.test.ts test/household-fund-ui.test.ts test/ledger-story-ui.test.ts test/fab-speed-dial.test.ts test/app-kitchen-boot.test.ts test/app-startup-p1.test.ts` → pass.
- Full `pnpm test` at `3b0598c` (before unused-`shiftStep` tsc fix): **1297 passed / 3 skipped**.
- `pnpm ai:verify` + `tsc --noEmit` + Vite production build (373 modules) + Hercules Pro UI after removing unused `shiftStep`.
- Independent books **PASS** (no P0/P1; P3 hours emptyDisplay closed). Privacy **no P0/P1**. Trust P0 (startup Post selector) closed by walking to Confirm.

**Data and environment disclosure:**
- Development impact: kitchen URL after D-041 deploy
- Production impact: none (no Production household mutation, schema, or secrets)
- Network calls or data sent: GitHub fetch/push; Cloudflare `wrangler deploy` via Actions on `main`
- MCP access: none for household data
- Hosted rows/schema/secrets: none until the authorized kitchen deploy
- Real household or partner-personal data used: none

**Next owner:** this session merges to `main` and verifies `https://hearth-books.jonathan-beaulne123.workers.dev/`.

**Worksession:** [`worksessions/2026-08-31-merge-deploy-add-slideshow.md`](worksessions/2026-08-31-merge-deploy-add-slideshow.md)

## D-180 ledger-native sync pilot (2026-08-31)

**Status:** Development release merged through [PR #256](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/256) as exact `main@e9c5127594a9fd4e6d8b203f19db57cc4b31390a` and deployed by successful Cloudflare run [`33403561188`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33403561188). **Not activated for daily use or proven through the live matrix or fourteen-day rehearsal.** The implementation was built from freshly fetched `origin/main@2a984fd3346dc0b57d0e7b6a17702c18b82596d3`; the original dirty `codex/roadmap-site` checkout remained untouched.

**Household outcome:** Jonathan and Bianca get a bounded Development rehearsal of command-normal two-device books: durable offline acceptance, immediate partner updates, explicit same-fact review, truthful freshness/fallback states, session/device revocation, and privacy-safe diagnostic evidence. Production continuity remains off.

**Dual Course:** Budget `+2 x 5 = +10` through no-silent-loss offline/concurrent/replacement-device recovery. Engagement `+2 x 3 = +6` through immediate partner activity and calm, truthful status.

**What changed:** the Pages build now requires Auth, Development Realtime, and command log on, requires Production continuity off, and enables a Development-only local diagnostic. The diagnostic retains at most 500 constrained records (enough for a multi-phase 100-event run), hashes identifiers, summarizes receiving-device latency, and refuses Production; it contains no money, merchants, notes, emails, tokens, or raw ids. Command replay still auto-converges disjoint additive facts and dedupes events, but true same-fact/reversal divergence now preserves both versions and opens the existing explicit resolution sheet. The Pairing Advanced surface can copy the sanitized diagnostic. Canon and the live/rehearsal runbook are in [`SYNC_PILOT.md`](SYNC_PILOT.md).

**Hosted inventory and release:** read-only provider inspection on 2026-08-31 found migrations 001–017 and Realtime publication entries for `continuity_command_events`, `continuity_personal_snapshots`, and `household_snapshots`. The approved branch head `0f54fa28e59db6997fa7c96bceb8a51f242c51d3` passed PR CI/deploy checks, merged as exact `main@e9c5127594a9fd4e6d8b203f19db57cc4b31390a`, and deployed successfully. Live assets contain the diagnostic action, command-Realtime marker, Production refusal, and offline-cache warning. No schema, hosted household row, provider setting, Production state, secret, or daily-use setting changed.

**Verification:** pre-change continuity baseline passed 22 files / 186 tests. Current-diff sync/Auth/recovery/books/UI proof passed **30 files / 265 tests**; the final Production/privacy repair gate passed **10 files / 86 tests**, and the representative remote-hash conflict/realtime gate passed **5 files / 47 tests**. After current main gained the Google Auth containment release, the rebased Auth/session/sync interaction gate passed **15 files / 137 tests** and exact `pnpm test` passed **1,289 tests / 3 skipped** across 194 passed / 2 skipped files. `pnpm ai:verify` (41 required files), `tsc --noEmit`, pilot-flagged production build (368 modules plus Hercules Pro UI), and `git diff --check` passed. Semantic access/diagnostic UI passed at 320/390/720/1100 px; a local browser spot-check copied the sanitized zero-sample bundle. Independent books and trust reviews passed with no open P0–P2; release re-review passed its 39-test code surface. Exact-merge main CI run [`33403561215`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33403561215) and Cloudflare run [`33403561188`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33403561188) both passed. Live two-device proof remains required before a pilot-success claim.

**Open pilot gate:** run the full two-account matrix with at least 100 new Shared event samples at `<=500 ms p95`, then complete the fourteen-day disposable Development rehearsal. Do not claim “Docs-like Development sync proven for Jonathan and Bianca” before every exit criterion passes. On money loss, duplicate, invalid books, privacy/cross-environment leak, or false Synced state, stop sharing and preserve replicas/outboxes.

**Worksession:** [`worksessions/2026-08-31-google-docs-sync-pilot.md`](worksessions/2026-08-31-google-docs-sync-pilot.md)


## SF-02 Shared Money membership and device access (2026-08-30)

**Status:** Release candidate on `codex/shared-money-program` from exact SF-01 `eceb5ebaeb3db8d8494c0870579cc463859e8619`. Migration **017 is applied to disposable Development** and the hosted authority smoke passed. Merge/deploy and live-client verification remain in progress. Risk: **Release**.

**Household outcome:** Jonathan and Bianca can be independently authenticated equal co-owners, inspect sanitized Auth access, remove devices, leave safely, and recover without turning soft presence or a UI filter into authority.

**Budget delta (5):** `+2` through explicit membership/session authority and former-member replay denial. **Engagement delta (3):** `+1` through a calm access and recovery surface. No financial posting, rail, bank, provider, or notification authority changed.

**What changed:** D-176; local migration 017; co-owner/member invitations; Supabase JWT `session_id` capture; live-session plus non-revoked-device membership gates; RPC-only device registration/list/revoke; metadata-only access audit; ordinary-member revoke; voluntary leave/last-owner protection; Auth phone identity lock; explicit offline/rejoin consequences; tests and canonical evidence.

**Verification:** final focused SF-02/Auth gate passed **6 files / 59 tests**; `tsc --noEmit`, Vite production build (359 modules), Hercules Pro UI build, no-`dist/_redirects`, and diff check passed. Migration 017 was applied from SHA-256 `6fd14ecde4755e346d8c46f510ea787d2f99a3a49bd98101f1ab66ce5b8839c1`. A transactional hosted smoke using two distinct existing Google principals passed invite/replay/replacement, RLS isolation, session registration/revoke, member revoke, Personal-seat reuse denial, last-owner/leave, sanitized audit, and anonymous/private-schema denial, then rolled back. Security Advisor reported 0 errors; its 18 warnings are the intentional guarded `SECURITY DEFINER` RPC surface. Exact evidence is recorded in [`worksessions/2026-08-30-shared-money-sf02.md`](worksessions/2026-08-30-shared-money-sf02.md).

**Environment/data:** the shared Supabase project had 2 Development and 0 Production households at apply. The schema apply was project-wide, but no Production household data existed or changed. The smoke used synthetic rows inside one transaction and ended with `ROLLBACK`; postflight counts were 0 synthetic households, 0 registered sessions, and 0 audit events.

**Open Release gate:** merge/deploy plus live-origin Google configuration and signed-in access-panel verification. Semantic access-panel coverage passed at 320/390/720/1100 px; rendered browser, keyboard, and screen-reader proof remains narrower than the hosted authority proof.

**Next owner:** Codex for the already-authorized merge, deploy, and live-origin smoke. After that gate, the next feature packet is SF-03.

**Worksession:** [`worksessions/2026-08-30-shared-money-sf02.md`](worksessions/2026-08-30-shared-money-sf02.md)

## SF-01 Shared Money baseline reconciliation (2026-08-30)

**Status:** Implemented locally on `codex/shared-money-program` against exact `origin/main@9376c30ba5db55c920d15ce3feacb65dedae5733`. **Not pushed, merged, deployed, activated, or live.** Risk: **High** (truth/governance; no financial behavior change).

**Household outcome:** every Shared Money prerequisite now has one Development-versus-Production truth row, end-to-end trace, owner, rollback, proof, and explicit unknowns. This prevents future AIs from mistaking a flag, migration file, virtual Fund, or roadmap decision for a working bank capability.

**Budget delta (5):** `+1` through reconciled money-authority and continuity truth. **Engagement delta (3):** `0`; no household interaction changed.

**What changed:** added [`SHARED_MONEY_BASELINE.md`](SHARED_MONEY_BASELINE.md) and [`shared-money-baseline.json`](shared-money-baseline.json); corrected stale continuity, membership, import, Fund/provider, roadmap, and policy-comment claims; added contradiction tests for D-161, D-162, D-172, D-174, environments, flags, and baseline completeness. D-172 remains current financial-write law; D-161 remains virtual; D-162 Fund-specific connected evidence remains read-only and Release-gated.

**Verification:** SF-01 focused **2 files / 7 tests** passed; after fixing one aggregate-discovered doc-contract wording mismatch, affected focused proof passed **3 files / 15 tests**. AI surface, `tsc --noEmit`, Vite production build (359 modules), Hercules Pro UI build, no-`_redirects`, and `git diff --check` passed. Full `pnpm check` is **not green** on Windows: `test/api.test.ts` invokes unavailable `bash` (`spawnSync bash ENOENT`). Its first run also caught the now-repaired wording mismatch; aggregate was not rerun after that narrow fix. The literal `pnpm build` wrapper likewise starts with Unix `rm`; its equivalent build steps passed.

**Environment/data:** documentation, one code comment, and tests only. No network call, live-data read, provider, schema, secret, Production, bank, household-data, push, merge, or deploy action.

**Next owner:** run SF-02 from the reconciled baseline. Jonathan approval remains required before push/PR and separately before any external mutation.

**Worksession:** [`worksessions/2026-08-29-shared-money-program.md`](worksessions/2026-08-29-shared-money-program.md)

## D-174 Shared Money program canon (2026-08-29)

**Status:** Local SF-00 implementation and focused verification on `codex/shared-money-program`, rebased without conflict onto exact `origin/main@54096553825bdaa331dca26c2dc963d754e1c583`. **Not pushed, merged, deployed, activated, or live.** Risk: **Release** (company direction; documentation/test slice has no runtime authority).

**Household outcome:** Hearth now has one execution index for becoming a partner-backed Canadian joint-account company for Jonathan and Bianca while preserving private personal accounts and current Confirm law.

**Budget delta (5):** actual `0`; program potential `+5`. **Engagement delta (3):** actual `0`; program potential `+2`. Books win: D-172 remains current law, D-161 remains virtual, and D-162 Fund-specific connected evidence remains read-only/Release-gated.

**What changed:** D-174, canonical phases and exit gates, SF-00 through SF-05 packets, worksession, roadmap/index pointers, and structural safety tests. No runtime code, schema, provider, secret, bank credential, money movement, Production, or real household data.

**Verification:** focused structural test 3/3; AI surface and `git diff --check` passed. A proper isolated offline dependency install succeeded. Real `pnpm check` ran for 248 seconds and is **not green**: the Windows Bash/Python sanitizer harness failed in `test/api.test.ts`, and the unchanged Hercules Pro Personal-shift fixture persistently returned `empty` rather than `ok`. The latter reproduced in isolation while SF-00 passed beside it. The earlier junction-caused `miniflare` condition disappeared and the Evidence local harness passed. Current-baseline `tsc --noEmit`, Vite production build, Hercules Pro UI build, and `_redirects` absence passed.

**Next owner:** independent SF-00 verification, then the AI assigned SF-01. Jonathan approval is required before push/PR and separately before any external mutation.

**Worksession:** [`worksessions/2026-08-29-shared-money-program.md`](worksessions/2026-08-29-shared-money-program.md)

## Kitchen desk + current main integration (D-164–D-173) (2026-08-29)

**Status:** Integrated and independently verified locally on `codex/kitchen-desk-integration` from exact `origin/main@4b2f40064b526541ef7a20d6e99fc99ca5647baa` plus UX head `ed708dc358ed808fbc5a9ec89b6c95bdb9a55a60`. Merge commit `f1daa78bfc1bfc7df3967b597f7af9e3675ff352`; verified implementation `ca8c84a108f9310a3426cf122c51258009963213`. **Not pushed, merged, deployed, or live.** Risk: **High**.

**Household outcome:** Shared Home remains the composed cream-paper desk with seals, mosaic, stage, and Kitty Banks. Personal Books remains the serious accepted-books account floor. Current-main Shift mail, attendance, Evidence, confirmed Bibles, boot recovery, and concrete companion labels stay in the same organism. Shift mail sits below Tip climate and posted cash/card/wage bubbles; it does not become Home furniture.

**Budget delta (5):** `+5` — accepted-books CAD, posted in/out leftover, partner-personal denial, visible Confirm, and D-172 collection-only automation survive one integrated kitchen.

**Engagement delta (3):** `+2` — current-main Shift instruments inherit the existing paper grammar without a new skin or iPhone redesign.

**If they conflicted:** books won. The integration preserved current-main boot/privacy/Confirm boundaries, PR #244's Home/Books/Kitty grammar, and moved only the Shift notebook and the tablet breakpoint needed to satisfy the locked layout.

**What changed:**
- Merged the exact UX lineage into a fresh current-main branch without rebasing or force-pushing PR #244.
- Kept D-165 Evidence Queue through D-172 Shift-envelope law and renumbered the kitchen-desk law to D-173.
- Combined `projectLedgerExperience`, Personal Books floor, accepted-snapshot export/writes, Kitty Banks, desk seals, Calendar kind colour, Hercules leftover fence, current-main coworker disclosure, D-167 ErrorBoundary/identity defense, Shift envelopes/attendance/Evidence/Bibles, and concrete capture labels.
- Placed Shift mail after Tip climate and posted cash/card/wage bubbles. No Evidence/coworker/envelope surface was added to Shared Home or Personal Books.
- Initial books/privacy review found that Personal Audit, Ask, and downloads still compiled the accepted household. The repair adds one adversarially tested `booksPresentationFloor`: Shared gets household/both only; Personal gets household/both plus the signed-in member's rooms. All Books read/export surfaces use it; accepted books remain write-only authority. Device-wide Power SQL is withheld from scoped floors.
- Books re-review then caught Import Confirm building from the presentation clone, which could discard hidden regular reconciliation rows. `BatchImportCard` now separates `household` (scoped review) from `writeHousehold` (accepted command source), with Shared and Personal regression proof that partner reconciliation survives Confirm.
- UX review's only P2 is closed with a scoped 44 px minimum touch target for Shift tabs.
- Fixed a merge-exposed specificity bug so Shared Home stacks at 720–899 px and becomes three columns only at `>=900px`.

**Verification so far:**
- Integrated focused gate before final placement: 10 files / 67 tests passed.
- Post-placement/breakpoint gate: 10 relevant files / 67 tests passed plus `test/ledger-story-ui.test.ts` 6/6 after the new breakpoint assertion. React test-environment `act(...)` warnings remain non-failing baseline noise.
- Full `pnpm check`: AI surface passed; aggregate tests reached **1176 passed / 2 skipped / 2 failed**. `test/api.test.ts` failed because Windows lacked `bash`; with Git Bash plus the bundled Python exposed, it passed **8/8**. `test/hercules-rig.test.ts` sampled the same walk angle twice, then passed **10/10** on isolated rerun; its test and engine blobs are byte-identical to `origin/main`.
- Windows-equivalent build gate: `tsc --noEmit`, Vite build, Hercules Pro UI build, and no `dist/_redirects` all passed.
- Browser proof with fictional Development demo only: 1100 px three-column desk; 720 px stacked `seals → mosaic → stage → banks`; 390/320 px `OfficePhone`; no horizontal overflow; correct three seal labels; Personal Books accepted-position hero; Shift mail after posted bubbles; keyboard focus ring 2 px pine on a 52×69 px control; zero console errors.

**Data and environment disclosure:**
- Development impact: local synthetic/demo browser state only.
- Production impact: none.
- Network calls or data sent: package install/download resolution and localhost only; no provider, Supabase, Gmail, 7shifts, or household-data call.
- MCP access: local in-app browser only; no household connector or database MCP.
- Hosted rows / schema / secrets / deployments: none.
- Real household or partner-personal data used: none.

**Verification:** Books, privacy, UX, and trust report no open P0–P2 on the verified implementation. The verifier found no P0–P2 and classified only its missing-`bash` runner as conditional; the final aggregate with Git Bash and bundled Python exposed closes that environment condition: 175 files passed / 1 skipped, 1182 tests passed / 2 skipped, plus TypeScript, Vite, Hercules Pro UI, and `_redirects` absence.

**Next owner:** Jonathan for the push/draft-PR decision. Codex did not push, merge, deploy, or call this live.

**Worksession:** [`worksessions/2026-08-29-kitchen-desk-main-integration.md`](worksessions/2026-08-29-kitchen-desk-main-integration.md)

## Blank kitchen when loading a household (D-167) (2026-08-28)

**Status:** Draft PR [#238](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/238) on `cursor/blank-household-google-boot-b30c` at `529b983`. **Not merged, not D-041 kitchen-live.** Risk: **Medium** (kitchen boot / Google identity / ErrorBoundary; no money write, schema, secrets, or Production). Jonathan later said the blank is **fixed**.

**Household outcome:** Welcome still works. Opening a household must show the kitchen, not a blank `#root`. If a remaining kitchen throw escapes, paper recovery offers Reload, Sign out of Google, or Open welcome. Nothing is posted.

**Budget delta (5):** `+5` — a blank kitchen after household open makes the books unusable.

**Engagement delta (3):** `+1` — paper recovery if another throw escapes.

**If they conflicted:** books win. Recovery never `postEntry`. Invalid Tip Tracker settings still fail at Confirm. Preview zeros on invalid present settings instead of painting catalog CAD.

**What changed:**
- PR **#235** (already on `origin/main` / live kitchen) moved the Evidence automation `useEffect` above `if (booting)` — that was the hook-count crash that only ran after household+session.
- This PR adds defense: `continuityIdentityFromGoogle` (no `googleSession?.identity.email` throw), GIS tokens without identity are skipped, missing `shiftSettings` default on shape, kitchen preview uses `previewShiftAmounts`, App-level `KitchenErrorBoundary`, continuity replay returns when identity is missing.

**Verification:**
- Focused `test/app-kitchen-boot.test.ts` (6 tests) green.
- `pnpm check` at `529b983` → **1044 passed / 2 skipped**, `tsc` + Vite build green.
- Independent books-auditor: **PASS WITH NOTES** (preview must not paint catalog CAD for invalid present settings — zeros now).
- Independent privacy-auditor: **PASS WITH NOTES** (replay no longer sends empty identity).
- Independent UX-auditor: **Dual Course PASS** (Sign out now also clears member session so recovery cannot loop).
- Independent verifier: **CONDITIONAL** until this handoff and worksession close (addressed here).
- Local Vite `127.0.0.1:5173`: demo household → “I am Jonathan” → kitchen at 390px, not blank. Broken GIS token without identity + reload still showed kitchen. 720px kitchen still painted.
- Live kitchen `hearth-books.jonathan-beaulne123.workers.dev` (PR #235 bundle): household Home painted, not `#root` empty. Jonathan: “its fixed.”

**Data and environment disclosure:**
- Development impact: none (client boot/recovery only)
- Production impact: none
- Network calls or data sent: none new
- MCP access: none for this packet
- Hosted rows/schema/secrets/deployments: none. No merge, no D-041 publish.
- Real household or partner-personal data used: none. Fictional Development demo catalog. Live screenshots are the public kitchen URL with fake `#access_token=not.a.jwt`, not a data source.

**Remaining uncertainty:** Live blank was the #235 hook-order crash. This PR’s ErrorBoundary / identity / shift defaults are **not** kitchen-live until merge + D-041. Localhost also logged `Maximum update depth exceeded` in `engine.ts` and Hercules rig `403` — kitchen still painted; those are separate. Calculator pad still uses strict `calcShiftAmounts`; invalid present settings would hit the new boundary, not a silent post.

**Next owner:** Jonathan — the blank household open is fixed on live (#235). Review whether to merge [#238](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/238) as extra boot hardening. Do not merge or deploy unless you ask.

**Worksession:** [`worksessions/2026-08-28-blank-household-boot.md`](worksessions/2026-08-28-blank-household-boot.md)

## D-164 Kitchen notes (Kitty Banks, sit-down charts, Home desk) (2026-08-29)

**Status:** Draft PR [#244](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/244) on `cursor/shared-ledger-story-aef7` @ `dc00c39`. **Not merged, not deployed, not live.** Risk: **High** (ledger-mode financial presentation).

**Household outcome:** Shared Home is six glance tiles plus a notebook (no Month blotter hero). Shared Now is **Kitty Banks** — existing shared goals that receive Fund surplus (D-161), not a new envelope. Plan Goals is replaced by Kitty Banks on Shared and Personal. Sit-down cycles paper charts; leftover assignment stays on Shared. Calendar cells show titles. Personal nav keeps Books. Home can scroll. Hercules uses a cream bubble and does not dump chips over the mosaic. Shift saucers expand into posted cash/card/wage totals.

**Budget delta (5):** `+3` — honest Shared vs Personal banks, $0 plan remove, posted shift earnings.

**Engagement delta (3):** `+3` — Home desk, paper banks, sit-down charts, cream talk.

**If they conflicted:** books and the mosaic win. Hercules chips and the grounded-fact grid no longer cover Home. Leftover Confirm stays household-only. No new Fund formulas. Widgets still never `postEntry`.

**What changed:**
- Shared wide Home: `is-shared-home` two-column mosaic | notebook; blotter lives in More on this desk.
- Shared Now tile/notebook: Kitty Banks fill bars + CAD; Attention and Change stay story panels. Change tile says **Fund kitty**, not “Kitty Banks.”
- Plan: one `KittyBanks` surface (visibility via `goalVisibleInView` when `memberId` is passed). Door card “Open Fund kitty” and `Goals` vault removed. Contribution amount is per bank.
- Sit-down: `sitDownInfographicDeck` carousel; Shared leftover CAD comes from books `leftoverProjection`; Personal gets folio charts + muted leftover-on-Shared line. Chart dots are 44×44.
- Plan amounts are borderless; × removes a $0 plan (`setBudget` `allowZero`).
- Calendar: full-width board, titles in cells, item list below.
- Home `>=720px`: `overflow-y: auto`; window shrinks on short `dvh`.
- Personal nav: Home · Cal · Shift · + · Plan · Books · More.
- Hercules overlay: opaque cream bubble; closed = spoken + ok; chips only after How can I help.
- Personal leftover CAD: gated on help chips, Plan overlay, typed Ask, `planHerculesTurn`, and Books Ask (`askHercules(..., { memberId, view })`). Parks-in copy is Kitty Banks.
- Shift: 28 posted cups plus week/month/year cash tips, card tips, and wages.

**Verification:**
- Focused leftover/kitchen tests green (`test/ask-books.test.ts`, `test/hercules.test.ts`, `test/sitdown.test.ts`, `test/kitty-banks.test.ts`, `test/ledger-story-ui.test.ts`, plus Plan/Shift/nav fences).
- `pnpm check` at `1e3d31b` and `dc00c39` → **1109 passed / 2 skipped**, `ai:verify` + `tsc --noEmit` + Vite build green.
- Visual, fictional Development demo kitchen as Jonathan: Shared Home ~1100 six tiles + Kitty Banks notebook; Shared Plan leftover paper + Kitty Banks + ×; Calendar cell titles; Personal 7-button nav; Shift posted cash/card/wages; OfficePhone 390 structure unchanged. Walkthrough video `kitchen_shared_personal_walkthrough.mp4` (41s).
- Independent books/privacy/UX/verifier on `1e3d31b`. Privacy P1 (Books Ask leftover CAD) closed in `dc00c39`. Verifier PASS on leftover-CAD checklist at `1e3d31b`.

**Data and environment disclosure:**
- Development impact: none (local/synthetic demo kitchen only)
- Production impact: none
- Network calls or data sent: none new
- MCP access: none for household data
- Hosted rows/schema/secrets/deployments: none
- Real household or partner-personal data used: none. Demo/synthetic Development only.

**Remaining uncertainty:** Demo seed has few `scope: personal` accounts, so Personal folio/wallet charts may be thin. Plan Kitty **Fund bank** still posts via `fundGoal` without a Confirm sheet (books auditor P1; not expanded here). Afford/food Ask can still recite cash-like CAD on Personal (not leftover assignment). Personal `sitDownPostcard` / “we closed” can still name leftover cents. iPhone `OfficePhone` structure is unchanged. Do not rebase onto later `main` unless asked.

**Next owner:** Jonathan — review Shared Home, Plan Kitty Banks, Calendar, Shift earnings, and Personal Books nav on a laptop width. Do not merge, rebase, or deploy unless you ask.

**Worksession:** [`worksessions/2026-08-28-shared-ledger-story-implementation.md`](worksessions/2026-08-28-shared-ledger-story-implementation.md)

## D-164 Shared Household table (not Books) (2026-08-28)

**Status:** Draft PR [#244](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/244) on `cursor/shared-ledger-story-aef7` @ `2033d28`. **Not merged, not deployed, not live.** Risk: **High** (ledger-mode financial presentation).

**Household outcome:** Shared keeps a deep **Household table** room (Fund, cash, cards, activity, import). It does not keep a Shared “Books / household story / double-entry / net worth / P&L” landing. Personal still opens **My books** on position. Audit (journal, trial, statements, rec, close) stays on Shared behind a closed disclosure.

**Budget delta (5):** `+3` — same journal; Shared opening is operating cash/Fund, not household net worth or income vs expenses.

**Engagement delta (3):** `+2` — Shared page job matches the kitchen table; Audit remains one tap away.

**If they conflicted:** books win. Trial-off still opens Audit and banners. No new Fund formulas. Wallet still lists investments as D-047 accounts; they are not kitchen-table tiles.

**What changed:**
- Shared hero: Fund operating or household cash. Copy states this is not net worth or a P&L.
- On-the-table strip: Fund, chequing, goal savings, cards. Investments stay in Wallet / Audit.
- Shared Audit office is a collapsed `<details>` (journal, trial, statements, rec, close, chart, ask). Personal Audit stays open.
- More door and command palette: “Household table” / “Open the household table”. Home story trust button matches.
- PGlite / hosted storage notes move into Shared Audit, not the table opening.

**Verification:**
- Focused `test/ledger-story-ui.test.ts` and `test/accounts.test.ts` green, including goals-only table strip and honest Personal copy fences.
- `pnpm check` at `53799f9` and `2033d28` → **1102 passed / 2 skipped**, `ai:verify` + `tsc --noEmit` + Vite build green. A parallel `e91bb68` run had two unrelated flakes (`hercules-rig` walk tick, `stress-seed` 15s timeout); both passed on rerun.
- Visual, fictional Development demo as Jonathan: Shared Household table hero **$12,234.19** cash (not $13,789.50 net worth); On the table Goal savings **$1,940.00** (pigs vault, not $3,440 with HIS); Audit Trial in balance; Personal My books **$13,789.50** with accepted-books copy.

**Data and environment disclosure:**
- Development impact: none (local/synthetic demo kitchen only)
- Production impact: none
- Network calls or data sent: none new
- MCP access: none for household data
- Hosted rows/schema/secrets/deployments: none
- Real household or partner-personal data used: none. Demo/synthetic Development only.

**Remaining uncertainty:** Wallet pane on Shared still shows investments (Accounts Floor). Shared table CAD still compiles from the scoped presentation clone (pre-existing D-164); Audit compiles accepted books. Personal hero is still accepted `booksEquation` with honest copy. Shared Import still receives `booksHousehold` for Confirm writes. Demo has no personal-scope accounts.

**Next owner:** Jonathan — independent ChatGPT review using [`briefs/CHATGPT_D164_INDEPENDENT_REVIEW_2026-08-29.md`](briefs/CHATGPT_D164_INDEPENDENT_REVIEW_2026-08-29.md). Model: **GPT-5 Pro**. Do not merge, rebase, or deploy unless you ask.

**Worksession:** [`worksessions/2026-08-28-shared-ledger-story-implementation.md`](worksessions/2026-08-28-shared-ledger-story-implementation.md)

## D-164 Shared kitchen composition (2026-08-28)

**Status:** Draft PR [#244](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/244) on `cursor/shared-ledger-story-aef7`. **Not merged, not deployed, not live.** Risk: **High** (ledger-mode privacy and financial presentation).

**Household outcome:** Shared Ledger is the household table: Fund, calendar, plan, and story-in-the-notebook. Personal Ledger keeps Shift and a private folio. Shared Books is a deep Fund/journal/Audit room, not a net-worth landing. Kitty Banks stays D-161 (surplus into existing shared goals); the Plan Goals vault is not deleted.

**Budget delta (5):** `+4` — same books, clearer Shared vs Personal jobs, Fund-first Shared Books, sit-down leftover graph, editable Plan categories via `setBudget` / `addCategory`.

**Engagement delta (3):** `+3` — laptop-width desk, story tiles on the mosaic, Calendar as the board, nav that matches the job.

**If they conflicted:** books win. No new Fund formulas. Trial off still surfaces. Posted category actuals stay when a plan is zeroed. iPhone `OfficePhone` structure unchanged.

**What changed:**
- Wide Home: story/folio live in OfficeWide mosaic + notebook; no stacked “Also on this desk” room. Laptop `>=1100px` uses three desk columns and a wider `.app`.
- Shared primary nav: Home · Cal · + · Plan · More. Personal keeps Shift. Books is More → Journal and Fund.
- Shared Books opens on Fund operating / household cash, not net worth, trial-in-balance, or P&L stats. Audit panes remain.
- Calendar hero facts move onto the month board. Purpose banner only on Plan and More.
- Plan left column: sit-down + Kitty door + Goals. Categories add/adjust/zero on the right.
- Sit-down Act 1 tiles collapse; leftover gets paper bars.
- Goals vault stays on Plan. Kitty Banks is the existing Fund surplus path, not a new product.

**Verification:**
- Focused `test/ledger-story-ui.test.ts`, `test/office-wide.test.ts`, `test/ledger-experience.test.ts`, `test/ledger-story-dom.test.ts`, `test/household-fund-ui.test.ts`, `test/kitchen.test.ts` green.
- `pnpm check` at `ad48fad` → **1102 passed / 2 skipped**, `ai:verify` + `tsc --noEmit` + Vite build green.
- Visual, fictional Development demo kitchen on localhost as Jonathan: Shared Home mosaic + notebook (no stacked story room); Shared nav Home/Cal/+/Plan/More; More → Journal and Fund opens household cash (Fund not set up), not net worth; Calendar week facts on the month card; Plan leftover bars + Kitty Banks door + editable categories; Personal Plan nav includes Shift; OfficePhone at 390/320 keeps seals + stories.

**Data and environment disclosure:**
- Development impact: none (local/synthetic demo kitchen only)
- Production impact: none
- Network calls or data sent: none new
- MCP access: none for household data
- Hosted rows/schema/secrets/deployments: none
- Real household or partner-personal data used: none. Demo/synthetic Development only.

**Remaining uncertainty:** Demo seed has no `scope: personal` accounts, so Personal Books compile empty by design. Kitty Banks does not yet replace the Goals card. Home `overflow: hidden` at `>=720px` may clip tall sill/window chrome. Personal Plan still lists household category rows (Rent, Bianca pay) because month summary is not a Personal-only budget projector. Calendar day copy “inon the board” is fixed in the follow-up commit. Independent books/privacy/UX auditors were launched on this pass; treat their notes as review, not merge authority.

**Next owner:** Jonathan — review Shared Home, Books-from-More, Calendar, Plan on a laptop width. Do not merge, rebase, or deploy unless you ask.

**Worksession:** [`worksessions/2026-08-28-shared-ledger-story-implementation.md`](worksessions/2026-08-28-shared-ledger-story-implementation.md)

## D-164 Shared Story and Personal Folio (2026-08-28)

**Status:** Draft PR [#244](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/244) on `cursor/shared-ledger-story-aef7` @ `dd4fe43`. **Not merged, not deployed, not live.** Risk: **High** (ledger-mode privacy and financial presentation).

**Household outcome:** Opening Shared Ledger feels like sitting down at the household table: what is true together, what changed, what needs a person, what is next, and why the view is trustworthy. Opening Personal Ledger feels like a private folio, not Shared with a filter. Desktop and iPad share one story/folio system at `>=720px`. iPhone keeps `OfficePhone` structure plus a purpose banner.

**Budget delta (5):** `+4` — mode-safe projectors, Fund flow matching D-161, authority in the journey, route-wide Personal denial, persist/compile on the accepted snapshot.

**Engagement delta (3):** `+3` — cooperative weekly/monthly paper story instead of disconnected Fund forms.

**If they conflicted:** books win. No new Fund formulas, event kinds, or command authority. iPhone structural redesign refused. Ranking/spend comparison refused. Presentation clones cannot overwrite partner Personal rows or choose leftover / Fund CAD.

**What changed:**
- `projectLedgerExperience` / `ledgerRouteContract` at the app boundary. Scoped household is read-only presentation. `booksHousehold` is the accepted snapshot.
- Shared Story (now / flow / attention / change / next / trust) and Personal Folio at `>=720px`. Fund commands stay behind progressive disclosure. Phone gets `LedgerPurposeBanner` heading; purpose copy hides below 720px.
- `restoreAcceptedSnapshot` plus Books/Goals/Add writers so Shared `addGoal` and Personal close/rec cannot drop the other scope’s rows. Personal presentation txs compile only against remaining accounts.
- Home sit-down / lock, Shared Story Fund CAD, phone Fund glance, Fund pane, and Books journal/trial/statements compile from `booksHousehold`. Register/wallet stay scoped. Add pickers fail closed when experience is not ok. Office lamp uses redacted `integrityFindings`.
- Shared Confirm “Mark due paid” posts only the due ids the current view showed (`postDueRecurrences(..., ids)`). A hidden Personal-scope standing order can no longer throw and void visible household posts. Personal Rec no longer defaults to a Shared chart account.
- Fund pane label is **Fund free-to-spend**. Unconfigured copy uses `LEDGER_CUSTODY_DISCLOSURE` plus setup, without replacing that sentence. Story deficit figures use `--danger`.

**Verification:**
- Focused `test/ledger-experience.test.ts`, `test/ledger-story-ui.test.ts`, `test/ledger-story-dom.test.ts`, `test/shared-ledger-story.test.ts` green, including Visa owed $70.50 / sit-down preview on accepted vs scoped, Fund reserve on personal-scope recurrences, and Shared due Confirm posting only visible ids.
- `pnpm check` at `dd4fe43` → **1100 passed / 2 skipped**, `ai:verify` + build green.
- Visual, fictional Development demo kitchen on localhost as Jonathan: Shared Home 1280 (Fund free-to-spend + Bianca custody), unconfigured Books Fund pane (same custody sentence), phone 320 purpose heading without the long purpose paragraph.

**Data and environment disclosure:**
- Development impact: none (local/synthetic demo kitchen only)
- Production impact: none
- Network calls or data sent: none new
- MCP access: none for household data
- Hosted rows/schema/secrets/deployments: none
- Real household or partner-personal data used: none. Demo/synthetic Development only.

**Remaining uncertainty:** Demo seed has no `scope: personal` accounts, so Personal Books compile empty by design. Demo Visa can be paid off so owed may be $0 even when personal-visibility lines exist; the $70.50 owed proof uses a catalog fixture. Ask SQL / Import mapping / close-pack export still run on accepted books (bank truth; Dual Course). Shared Books can still list Personal-scope backing **names** (not last4) because journal compiles accepted books. 820/1024/1440 stills were not captured as separate files.

**Next owner:** Jonathan — click the trycloudflare URL in the latest agent reply (this branch’s Vite, not the live kitchen). Then: Open the demo kitchen table → I am Jonathan. On Cursor Desktop, the same kitchen is `http://127.0.0.1:5173/` while this agent tab is active. Do not merge or deploy unless you ask.

**Worksession:** [`worksessions/2026-08-28-shared-ledger-story-implementation.md`](worksessions/2026-08-28-shared-ledger-story-implementation.md)

## Closeable kitchen notices with 1–2 fix steps (2026-08-28)

**Status:** Draft PR [#232](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/232) on `cursor/closeable-kitchen-notices-560d`. **Not merged, not deployed, not live.** Risk: **Low–Medium** (copy/UX; no money write, Auth, or schema).

**Household outcome:** The Import line “This Google account is not linked to that Hearth member.” means this Google session is signed in, but it is not the hosted membership row for the person currently on this kitchen. Bank connect stays refuse-closed. Kitchen errors now show as a small closeable chip (same size language as the sync chip): one problem, 1–2 fix steps, optional Open More / Reload, and ×.

**Budget delta (5):** `+1` — can act on a blocked bank connect or books copy.

**Engagement delta (3):** `+1` — not a wall of red.

**If they conflicted:** books win; notices never `postEntry`. Google mismatch still refuses Flinks. A missing PGlite receipt still does not ingest.

**What changed:** `humanizeKitchenNotice` maps engine/worker strings. `KitchenNotice` is a compact chip. Wired on Books status, Flinks/7shifts errors, App/welcome/Add, and other `.danger` paragraphs. Engine/worker copy is unchanged.

**Verification:**
- Focused `test/kitchen-notice.test.ts` + `test/flinks-connect-ui.test.ts` green.
- `pnpm check` at `6c58daa` → **980 passed / 2 skipped**, build green. Follow-up commit threads `onGoMore` into BatchImport review notices.
- Independent `hearth-ux-auditor`: Dual Course pass (conditional); asked for `onGoMore` on BatchImport slots — wired.
- Independent `books-auditor`: PASS — fail-closed membership and receipt checks unchanged.
- Visual, fictional Development demo kitchen on localhost: Import → Connect bank with Flinks shows “Sign in with Google before connecting a bank” chip with Open More and ×. Dismiss hides it. Open More goes to More.

**Data and environment disclosure:**
- Development impact: none (UI copy only)
- Production impact: none
- Network calls or data sent: none new
- MCP access: none
- Hosted rows/schema/secrets/deployments: none
- Real household or partner-personal data used: none. Demo kitchen only. Live kitchen screenshot was the prompt, not a data source.

**Remaining uncertainty:** Live kitchen still shows the old walls until merge + D-041 deploy. Linking Google in More is the real fix for the membership mismatch. Demo localhost showed the sign-in-first Flinks chip (no Google session), not the membership-mismatch string.

**Next owner:** Jonathan — review [#232](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/232). Do not merge or deploy unless you ask.

**Worksession:** [`worksessions/2026-08-28-closeable-kitchen-notices.md`](worksessions/2026-08-28-closeable-kitchen-notices.md)

## Kitchen queue handler so D-156 can publish (D-041) (2026-08-28)

**Status:** Merged to `main` at `d067e56` (PR #228). Kitchen **deploy failed** Cloudflare Workers `33184620358` and Workers Builds `d6a7492e` with API **11001** (queue handler missing). Fix is on `cursor/fix-kitchen-queue-handler-560d`. Risk: **Medium** (Worker deploy path; no money, Auth, or schema).

**Household outcome:** Unblock the already-approved kitchen publish of the wide paper office (fat nav + live chalkboard). Live kitchen still serves `index-BRjIx46v.js` (early D-156 from #229) until this handler lands.

**Budget delta (5):** `+0` — plumbing only; the paper-office budget delta is unchanged.

**Engagement delta (3):** `+0` — same.

**If they conflicted:** books win; the handler only `ack()`s. It never `postEntry`, never fetches household rows, never talks to a model.

**What changed:** `workers/site.js` exports a no-op `queue`. `wrangler.jsonc` still has **no** `queues` consumers. D-041 why-note records 11001.

**Verification:** focused `test/api.test.ts` (queue acks; no consumer binding) + worker tests green. `pnpm check` next. Then merge to `main` and confirm Cloudflare Workers Deploy green. Live HTML must serve a bundle containing `hearth-notebook-whisper` / live chalkboard, not only `office-wide`.

**Data and environment disclosure:**
- Development impact: none
- Production impact: none (kitchen Worker publish only; no Production household mutation)
- Network calls or data sent: none new
- MCP access: Cloudflare Workers Builds logs (read-only)
- Hosted rows/schema/secrets: none. No Queue consumer added.
- Real household or partner-personal data used: none

**Remaining uncertainty:** Cloudflare may still have a leftover consumer registration on `hearth-books`. Dashboard cleanup (`wrangler queues consumer remove`) is Jonathan's if 11001 returns. Workers Builds still runs `versions upload` (preview), not kitchen `wrangler deploy`.

**Next owner:** Merge this fix to `main` (Jonathan already approved kitchen publish), then hard-refresh https://hearth-books.jonathan-beaulne123.workers.dev/

**Worksession:** [`worksessions/2026-08-28-wide-paper-office.md`](worksessions/2026-08-28-wide-paper-office.md)

## Keep chalkboard; restore screenshot nav (D-156) (2026-08-28)

**Status:** Merged to `main` (`d067e56`) via [#228](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/228). **Not kitchen-live** — deploy `33184620358` failed 11001. Risk: **Medium** (UX Dual Course; no money, Auth, or schema).

**Household outcome:** Laptop Home matches the attached paper-office screenshot: fat bottom nav (Home / Cal / Shift / plus / Plan / Books / More), POST / DUE / HEALTH seals, Today's stories, month blotter. The compact chip-strip nav is gone. Notes still open a live chalkboard in the notebook. Google welcome/sign-in files were not touched.

**Budget delta (5):** `+2` — glanceable month net / wallet / bills / Health stay.

**Engagement delta (3):** `+1` — chalkboard stays; nav goes back to the screenshot bar.

**If they conflicted:** books win; widgets never `postEntry`; plus FAB stays the Add door.

**What changed:** Withdrew `WideMiniBrowser` and `.app.is-wide` hiding of `.nav`. Restored **More on this desk**. Kept live chalkboard (`bare` notebook, letter eraser, auto-save stamps).

**Verification:** focused office-wide / desktop-office / chalk-letters tests; then `pnpm check`. Visual: 1100 fat nav + seals; Notes chalkboard; 390 same Draft C nav.

**Data and environment disclosure:**
- Development impact: none
- Production impact: none
- Network calls or data sent: none new
- MCP access: none
- Hosted rows/schema/secrets/deployments: none
- Real household or partner-personal data used: none. Demo kitchen only.

**Remaining uncertainty:** Saved x/y desks still open Classic. This branch never carried a Google sign-in diff, so nothing Google was reverted here.

**Next owner:** Jonathan — confirm laptop Home matches the screenshot (fat bar + plus, no chip strip), then Notes chalkboard, then Google welcome still as you left it.

**Worksession:** [`worksessions/2026-08-28-wide-paper-office.md`](worksessions/2026-08-28-wide-paper-office.md)

## Laptop nav in the smaller widgets column (D-156) (2026-08-28)

**Status:** Draft PR [#228](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/228) on `cursor/wide-paper-office-560d`. Head after this packet. Base `origin/main` `54c74dc`. **Not merged, not deployed, not live.** Risk: **Medium** (UX Dual Course; no money, Auth, or schema).

**Household outcome:** On a laptop, Home / Cal / Shift / Post / Plan / Books / More live in the **left mosaic column** under Today's stories, with leftover desk chips (Notes, Outfits, …). The fat phone nav and plus FAB are hidden at ≥720px. Single click previews in the notebook; double-click or Shift+Enter opens the page. Phone `<720px` keeps Draft C bottom nav.

**Budget delta (5):** `+2` — glanceable month net / wallet / bills / Health unchanged; nav move is engagement.

**Engagement delta (3):** `+2` — nav sits with the small widgets instead of a second bottom bar.

**If they conflicted:** widgets still never `postEntry`; Post is a small chip, not a covering FAB.

**What changed:** `WideMiniBrowser` moved into `office-wide-widgets` (left column). Unique `desk-` chip ids. Shift+Enter opens the full page. Live chalkboard still fills the notebook. Fat `.nav` stays phone-only.

**Verification:**
- Focused `test/office-wide.test.ts` + `test/desktop-office.test.ts` green (chips under mosaic; unique ids).
- `pnpm check` at `0978af9` → **969 passed / 2 skipped**, build green. Follow-up commit is unique ids + keyboard Shift+Enter + Add freeze on the widget column.
- Visual, fictional Development demo kitchen only: Paper office at ~1100 — chips wrap under Today's stories in the left column; Cal preview in the right notebook; no fat bottom nav. Phone ~390 keeps Home/Cal/Shift/+ /Plan/Books/More.
- Read-only UX auditor: household job met; keyboard double-click gap addressed with Shift+Enter; remaining gaps 720 wrap, 280ms click wait.

**Data and environment disclosure:**
- Development impact: none (layout `localStorage` cosmetics).
- Production impact: none.
- Network calls or data sent: none new.
- MCP access: none.
- Hosted rows/schema/secrets/deployments: none.
- Real household or partner-personal data used: none. Demo kitchen only.

**Remaining uncertainty:** Saved x/y desks still open Classic (chip strip above the canvas). Fresh desks open paper. 720–899px stacks to one column so chips wrap under the mosaic. Branch is behind later Toast OCR work on `main`.

**Next owner:** Jonathan — review laptop ~1100: chips should sit under Today's stories on the left, fat bar gone. Then phone 390 still has the seven-column nav. Do not merge until that looks right.

**Worksession:** [`worksessions/2026-08-28-wide-paper-office.md`](worksessions/2026-08-28-wide-paper-office.md)

## Wide paper office (D-156) (2026-08-28)

**Status:** Draft PR [#228](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/228) on `cursor/wide-paper-office-560d` (`afdff22`). Implementation `e16e873`; this handoff commit follows. Base `origin/main` `54c74dc`. **Not merged, not deployed, not live.** Risk: **Medium** (UX Dual Course; no money, Auth, or schema).

**Household outcome:** On a laptop, Home feels like the phone kitchen — wax seals, paper stories, cream/pine/copper, Fraunces money — but it is a **two-column room**, not a stretched 2×2. A large month-net blotter and journal-true in/out bars use the extra space. The notebook stays open beside stories. Classic free-move desk remains behind Cabinets. Phone `<720px` stays Draft C. Milk/Confirm still post.

**Budget delta (5):** `+2` — month net, wallet, bills, and Health become glanceable on a laptop without a new figure.

**Engagement delta (3):** `+2` — the kitchen feels special at width; Hercules still wanders.

**If they conflicted:** no invented CAD; tip spark is copper-badged **Projection**; widgets still never `postEntry`; if Post were covered, furniture would shrink. Kill criterion was **not** triggered.

**What changed:** `OfficeWide` is the default wide Home. Cabinets **Paper office** / **Classic desk**. App column `min(1120px, 100%)`. Paper bars/spark from `monthSummary` / `tipWeather`. Light two-column CSS on Shift, Books wallet, Calendar, Plan. D-156 in living canon. Add-state CSS polish: freeze hero, dim notebook, pin focus ring.

**Verification:**
- `pnpm check` → **967 passed / 2 skipped**, build green (this SHA).
- Focused `test/office-wide.test.ts` (mosaic ids, demo-household cents, fresh paper / saved-x/y classic).
- Warmth fence: `1120px`, refuses `1280px`, Cabinets copy.
- Read-only UX auditor: Dual Course pass; three CSS polish items landed in `e16e873`.
- Independent verifier: claims 1–8 pass against `66cff63`; claim 9 (`pnpm check` 967/2) re-run here and green.
- Visual, fictional Development demo kitchen only (`pnpm dev` → `http://localhost:5173`, Open the demo kitchen table): 320 / 390 Draft C; 720 OfficeWide (stacks under 900px); ~1100 two-column paper office; Classic toggle; Post/Add uncovered; Shift climate beside punch.

**Data and environment disclosure:**
- Development impact: none (layout `localStorage` cosmetics).
- Production impact: none.
- Network calls or data sent: none new.
- MCP access: none.
- Hosted rows/schema/secrets/deployments: none.
- Real household or partner-personal data used: none. Demo kitchen only.

**Remaining uncertainty:** Existing wide layouts with saved x/y keep Classic so a customized desk is not silently replaced. Fresh desks open paper. Two-column breathing room is the ~1100 face; 720–899px is still OfficeWide but stacked. Branch is behind current `main` by later Toast OCR work — rebase is Jonathan’s call, not this packet.

**Next owner:** Jonathan — review laptop Home at ~1100px, then phone at 390. Do not merge until you are happy with the composed room. Do not treat as shipped or live.

**Worksession:** [`worksessions/2026-08-28-wide-paper-office.md`](worksessions/2026-08-28-wide-paper-office.md)

## Merge and deploy what is safe (2026-08-28)

**Status:** Merged via [#229](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/229) onto `main` (`58b8bcd`). Kitchen Worker **live** via Cloudflare Workers run `33146400613` (Deploy green). Bundle `index-Bi_R2L6I.js` contains `office-wide`. Risk: **Medium**. Not Production household data.

**Household outcome:** Laptop Home is the composed paper office (D-156). 7shifts stays inert. Conflicting High/draft PRs stay unmerged.

**Budget delta (5):** `+1` — laptop Home glance without new figures.

**Engagement delta (3):** `+1` — composed wide paper office on the kitchen.

**Safe / live:** `main@58b8bcd` deploy `33146400613`. Live 7shifts status still `available: false`, Production locked.

**Held (not safe):**
- D-155 enablement — setup `33116671903` failed Cloudflare API `7403`. `#214` superseded by `#220`/`#222`.
- `#218` opening truth — High, CONFLICTING, draft.
- `#216` onboarding, `#207` computer office, `#206` tenant journal, `#203` button inventory — CONFLICTING drafts.

**Verification:** `pnpm check` **967 passed / 2 skipped**; `#229` CI `test` green; visual 1100/720/390/320 on demo Development; live JS includes `office-wide` / `Today's stories`.

**Next owner:** Jonathan — hard-refresh https://hearth-books.jonathan-beaulne123.workers.dev/ on a laptop (~1100px) and a phone (390). Grant the GitHub Cloudflare token D1 access before any 7shifts enablement.

## Tip-sheet transcript-first rethink (D-152) (2026-08-28)

**Status:** Merged via [#227](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/227) onto `main` (`74abbaf`). Kitchen Worker **live** via Cloudflare Workers run `33131628794` (Deploy green). Risk: **Medium**. Not Production household data.

**Household outcome:** Tip-sheet camera drafts Confirm with labeled Toast totals instead of blank/wrong fields. PDF conversion is **not** used (vision APIs are image-only).

**Budget delta (5):** `+2` — labeled OCR wins; invent-nothing still never posts.

**Engagement delta (3):** `+1` — clearer, more usable drafts after Clear Capture.

**What changed:** Transcript-first prompt; coerce `shift-report` from tip-sheet hint + Toast OCR; field-level POS merge; tip-sheet contrast + high-quality JPEG prep; **Auto = free Workers AI first**, paid only when draft still weak.

**Cost:** Default **Auto** avoids paid tokens when free Workers AI + POS parser draft enough. OpenAI chip still costs ~$0.02–0.04 when forced or when Auto falls back.

**Verification:** `pnpm check` → **959 passed / 2 skipped**. Deploy `33131628794` success.

**Next owner:** Jonathan — hard-refresh https://hearth-books.jonathan-beaulne123.workers.dev/ , Development, leave provider on **Auto**, tip sheet scan → Confirm review. Do not treat as Production household data.

## OpenAI tip-sheet 503 fix (D-152) (2026-08-27)

**Status:** Merged via [#226](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/226) onto `main` (`4ea186f`). Kitchen Worker **live** via Cloudflare Workers run `33128613418` (Deploy green). Risk: **Medium**. Not Production household data.

**Household outcome:** Choosing OpenAI for tip-sheet scan drafts Confirm again instead of failing with “OpenAI could not read that tip sheet.”

**Budget delta (5):** `+1` — paid vision path works for dense slips again.

**Engagement delta (3):** `+1` — provider chip matches real behavior.

**Root cause:** OpenAI `strict: true` rejected `shiftDraft` (properties without matching `required`). Schema now null-unions every tip field under `required`; `scanOpenAI` retries `json_object` / plain JSON if strict is refused.

**Verification:** `pnpm check` → **955 passed / 2 skipped**. Deploy `33128613418` success.

**Next owner:** Jonathan — hard-refresh https://hearth-books.jonathan-beaulne123.workers.dev/ , Development, Shift tip sheet → OpenAI → retake. Confirm still posts. Do not treat as Production household data.

## Tip-sheet provider choice + clarity-gated camera (D-152) (2026-08-27)

**Status:** Merged via [#225](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/225) onto `main` (`94f8cd0`). Kitchen Worker **live** via Cloudflare Workers run `33124596368` (Deploy green). Risk: **Medium**. Not Production household data.

**Household outcome:** On Shift tip-sheet scan, choose **Auto / Workers AI / OpenAI / Anthropic**. Live camera capture stays locked until the slip looks sharp and readable (QR-scanner style). Choose-photo applies the same clarity check.

**Budget delta (5):** `+1` — fewer unusable OCR drafts; invent-nothing boundary unchanged.

**Engagement delta (3):** `+2` — clearer camera UX and explicit provider control for dense tip sheets.

**What changed:** Provider chips + local preference; `/documents/scan` honors forced provider without silent fall-through; `DocumentCamera` live clarity meter; Choose-photo clarity gate; D-152 why-note.

**Verification:** `pnpm check` → **954 passed / 2 skipped**. Deploy `33124596368` success. Live bundle contains `Take tip sheet photo`, `Vision provider`, `Waiting for clear tip sheet`, `doc-camera-overlay`. Forced-provider probe returns provider-specific 503 (image not saved); foreign origin still 403.

**Next owner:** Jonathan — hard-refresh https://hearth-books.jonathan-beaulne123.workers.dev/ , Development pill, Shift tip sheet → try providers; confirm Capture stays disabled until clear. Do not treat as Production household data.

## 7shifts Evidence Mesh and automation (D-158/D-159) (2026-08-28)

**Status:** [PR #231](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/231) merged at `main@e342ae9`; post-merge CI and Cloudflare Worker deployment passed. The dedicated Development D1, private R2, Queue/DLQ, `EVIDENCE_KEK_V1`, and migrations 0001/0002 are live and empty. Worker version `9a1606cd-a49c-4bef-9da5-c75468e62f5a` is inert with every Evidence and 7shifts activation flag false. No email route, distribution, activation, real evidence, or Production action.

**Household outcome:** Shift → Evidence can accept explicit member files/screens, saved/private ICS, rotated forwarded-mail evidence, and paired browser/iPhone captures into an encrypted personal vault. Unified bundles retain every attributed observation and conflict. Automation is off by default; an exact member/job opt-in can post eligible evidence through ordinary `postWorkShift`/PGlite/continuity and reconcile a complete payroll week through exact reversals plus chronological replacements.

**Budget delta (5):** `+5`. **Engagement delta (3):** `+3`. **Risk:** Release.

**Hard boundaries:** D-158 storage is separate D1/private R2/Queue and default-disabled. Raw evidence never enters household snapshots, command events, PGlite, Hercules, or generic model payloads. Schedules/email/models never post. Deterministic command ids and receipts supply retry recovery. Closed/settled variance is review-only until a separately approved mapping. Production is refused.

**Verification:** reconciled Toast OCR + Evidence/accounting/Hercules focus passed 16 files / 93 tests, and the dedicated disabled-queue/CORS regressions passed separately. TypeScript, AI verify, production build, local D1 migration execution, Worker dry run, and diff check passed. The full suite is 1018 passed / 2 skipped / 2 unchanged-baseline failures. Remote D1 reports no pending migrations and zero evidence items, bundles, jobs, bytes, objects, puts, or gets; R2 has no public URL or custom domain. Live `/work/evidence/status` and `/work/7shifts/status` both report unavailable/disabled and Production refused. iOS XCTest and physical-device proof remain macOS/TestFlight gates.

**Canon:** [`SEVEN_SHIFTS_EVIDENCE.md`](SEVEN_SHIFTS_EVIDENCE.md) · [`worksessions/2026-08-28-seven-shifts-evidence-mesh.md`](worksessions/2026-08-28-seven-shifts-evidence-mesh.md)

## Native 7shifts Timesheet inbox (D-155) (2026-08-27)

**Status:** Release branch `codex/d152-shifts-release`, based on current `main`; user-authorized two-stage Development release in progress. Risk: **Release**. Production provider access remains refused.

**Household outcome:** Connect 7shifts under Shift → Jobs. Pull a clocked punch into the existing Timesheet review on Shift → Today or Add. Hours, paid breaks, role, and clock times are drafts; cash/card tips stay blank. Only Confirm can post through `postWorkShift`.

**Budget delta (5):** `+3` — less transcription without changing Hearth-owned rates, tip amounts, or the accounting boundary.

**Engagement delta (3):** `+2` — the restaurant clock and Co-workers roster now meet the first-class Shift tab.

**Safety:** Development only; Auth membership before D1/provider access; AES-GCM token storage; HMAC stable identities; strict response allowlists; 7shifts wage/tip/email fields discarded; provider labels sanitized; API version `2026-01-01`; scope changes cancel provider/camera work and clear pending Confirm state.

**Release plan:** Merge/deploy inert with `SEVENSHIFTS_ENABLED=false`; verify status; apply D1 migration 0002 and put both required secrets; then merge the minimal enablement flag/secret-validation change and verify active status plus fail-closed routes.

**Remaining uncertainty:** A real Harbour Developer Tools token is required for the final provider/company smoke. Stop before Confirm during that smoke so no household money is changed.

**Worksession:** [`worksessions/2026-08-27-seven-shifts-inbox.md`](worksessions/2026-08-27-seven-shifts-inbox.md)

## Shift Today camera (D-152 on D-153) (2026-08-27)

**Status:** Merged via [#217](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/217) onto `main` (`048e619`). Kitchen Worker **live** version `c942e55b-a53d-403e-9ab1-3c17c1f9957d` (bundle `index-Ce4ACG2v.js`). Risk: **Medium**. Not Production household data.

**Household outcome:** On Shift → Today, photograph a tip sheet (or pick a photo). The scan drafts Confirm on this page. Confirm still posts. Home Timesheet / Add camera stays.

**Budget delta (5):** `+1`

**Engagement delta (3):** `+2`

**What changed:** Shared `ShiftReportScanBar`. Clock out on Shift clocks out without opening Add. Already off stays on Today. Same `scanShiftReportFile` / `documentHint: shift-report`. Demo kitchen job for Bianca (MEM-001). BatchImport copy points at Shift → Today. Worker prompt names Shift → Today. Same-day Confirm retry stays on `postWorkShift` even if Add is still on the expense pad; the duplicate banner stays on Shift Today.

**Verification:** `pnpm check` → **895 passed / 2 skipped**. GitHub Actions Cloudflare Workers `33111839360` Deploy green. Live HTML serves `index-Ce4ACG2v.js` containing `Take shift-report photo`, `Choose tip sheet photo`, `Optional camera draft`, Bianca demo job note. Browser smoke: Development, demo kitchen, Bianca then Jonathan, Shift → Already off? → camera chips. No Confirm / no journal post.

**Data/environment:** Client/docs. Kitchen publish is GitHub `main` → Cloudflare Workers. Scan still POSTs image bytes like receipts. No schema, secrets, Production rows.

**Next owner:** Jonathan — hard-refresh https://hearth-books.jonathan-beaulne123.workers.dev/ , Development pill, demo kitchen, Shift → Already off? Photograph a tip sheet if you want. Confirm still posts. Do not treat this as Production household data.

## Shift tab (D-153) (2026-08-27)

**Status:** Merged via [#213](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/213) onto `main` (`1e12d32`). Kitchen Worker **live** version `5b2b2b47-d996-427c-b3bf-61a845ee9bcf` (bundle `index-CTPtvBuT.js`). Risk: **Medium**. Numbered **D-153** because `main` already used **D-152** for tip covariates (#208).

**Household outcome:** Bianca and Jonathan open **Shift** from the phone bar. Punch, last shifts, Jobs, compressed report, and Hercules Shift Oracle glances live there. Add stays centered. Confirm still posts. The tab never writes money.

**Budget delta (5):** `+1`

**Engagement delta (3):** `+2`

**What changed:** Nav is `Home · Cal · Shift · [+] · Plan · Books · More`. `WorkShiftPage` hosts Today / Report / Jobs. More no longer mounts Jobs / history / report. Home Timesheet stays. Projections are copper-badged and never post. Rebased onto #208 camera/covariate Confirm path (Add still hosts scan + `WorkShiftFlow`).

**Verification:** `pnpm check` after merging `origin/main`: **887 passed / 2 skipped**. GitHub Actions Cloudflare Workers `33106260692` Deploy green. Live HTML serves `index-CTPtvBuT.js` containing `shift-page`, `Tip climate`, `Floor lamp`, `Protect floor`.

**Data/environment:** Client/docs. Kitchen publish is GitHub `main` → Cloudflare Workers. No schema, secrets, or Production household mutation.

**Remaining uncertainty:** Future climate days cannot show real rain without a multi-day forecast. Today's rain drop uses cached Open-Meteo / fallback.

**Next owner:** Jonathan — hard-refresh https://hearth-books.jonathan-beaulne123.workers.dev/ , Development pill, open Shift. Demo kitchen is fine. Do not treat this as Production household data.

## Tip covariates + Hercules tip science + Pro paged reads (D-152) (2026-08-27)

**Status:** Merging via [PR #208](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/208) onto `main` (Jonathan approved push/merge/deploy). Risk: **Medium–High**. Kitchen publish follows GitHub `main` → Cloudflare Workers.

**Base SHA:** `ef3274a` · **Head SHA:** merge-base-resolved (see tip).

**Household outcome:** End-of-night Confirm captures sales, customers served, floor headcount, and event tags so tip projections get better; Hercules (free + Pro) uses those covariates; Pro can page long shift/ledger history; Timesheet can photograph a tip sheet and draft Confirm without posting.

**Budget delta (5):** `+2` — richer covariates improve tip projections without posting money; OCR stays proposal-only.

**Engagement delta (3):** `+2` — Confirm + optional camera draft + Pro long-history paging.

**What changed:**
- Shift / `postWorkShift` / legacy `postShift`: `customersServed`, `staffingCount`, `eventTag`, optional `weatherGlass`; tipped Confirm requires covers/staffing (+ sales when sales fields exist).
- `WorkShiftFlow` Sales & tips step + legacy ceremony fields; stress seed synthesizes covers/staffing/events.
- `tipScience` observations + soft sales/covers/staffing/event/macro factors on outlook/oracle/year-sim.
- Hercules: tip tools consume covariates; new `list_shifts`; Pro `toolPageMode` page size 50/100 + cursors; free ≤10.
- Worker `/macro/priors` soft Ontario/Canada prior (fail soft); shift-report OCR via shared `/documents/scan` + `documentHint` → Confirm draft only; OCR notes dropped (Worker + `workShiftDraftFromVision`); BatchImport rejects shift-report rows.
- Single-field sales jobs map camera sales into that pad; multi-field jobs leave sales blank with an honest banner (no invented Food/Alcohol/Other split).
- D-152 recorded.

**Verification:** Focused `test/shift-report-draft.test.ts` + `test/document-scan-worker.test.ts` (shift-report sanitize + hint) pass; prior tip-covariates suite green; full `pnpm check` → **873 pass** / 2 skipped. Independent books auditor **PASS WITH NOTES** (Confirm-only; sales multi-field note addressed). Independent privacy auditor **PASS WITH NOTES** (OCR note residual fixed; warnings may still echo names on-device only; third-party vision transit inherent).

**Uncertainty:** Live StatsCan fetch not wired; OCR quality depends on model vision; Cloud UI smoke of Timesheet Confirm may need a Development household (welcome-demo path was previously blocked).

**Data/environment:** Development client/Worker code only. No schema, secrets, Production, or household wipe. Scan POSTs image bytes like receipts; macro endpoint sends region key only.

**Next owner:** After kitchen deploy — hard-refresh; Development smoke of Timesheet → Already off? → Take shift-report photo → Confirm.

## Supabase Preview history matches 016 (D-151) (2026-08-27)

**Status:** Branch `cursor/supabase-preview-016-history-5958`. Risk: **Low** (migration *history* metadata only; money meaning unchanged). Hosted `supabase_migrations.schema_migrations` version retagged `20260827072847` → `016`. Function not re-applied. No household rows.

**Household outcome:** GitHub Supabase Preview can see the same 016 file the kitchen already uses. Start from scratch is unchanged.

**Budget delta (5):** `0`

**Engagement delta (3):** `0` — CI honesty, not an interactable.

**What changed:** MCP apply had stored a 14-digit timestamp; local file is `016_reset_development_households.sql`. Preview looks up remote versions in that folder. History now uses `016`. Filename contract locked in `test/supabase-connection.test.ts`.

**Verification:** Hosted `list_migrations` now ends at `016` / `reset_development_households`. No `20260827072847` row. Focused `pnpm exec vitest run test/supabase-connection.test.ts` → **8 passed**.

**Data/environment:** Development project `tykhocwacaxwquhynkok` history table only. No Production. No Start from scratch invocation.

**Next owner:** Merge this PR so GitHub re-runs Supabase Preview on `main`.

## First-create retry is not another phone (D-149) (2026-08-27)

**Status:** Merged via #210 onto `main` (`48b1716`). Kitchen Worker version `cc694eee-3462-4fff-8f71-8675e8ad2ecf` verified (`index-DTnHo7tC.js`). Risk: **High**. No schema apply.

**Household outcome:** Starting a household alone does not show “Another phone posted a newer household snapshot.” After create, retries CAS from the hosted revision when that revision is a positive integer.

**Budget delta (5):** `+2` — the only copy of the books can reach the cloud.

**Engagement delta (3):** `+2` — Health/More stop blaming a partner who is not there.

**What changed:** `pushSupabaseHousehold` treats `household-already-exists` by reading the hosted snapshot and calling `publish_continuity_snapshot` with that revision when local is same or ahead. Unreadable or non-positive hosted revision stays pending (`missing-snapshot`), not another-phone. Genuinely newer hosted tips still conflict.

**Verification:** Focused 27 tests pass. Full `pnpm test` **875 passed / 2 skipped**. GitHub `main` CI SUCCESS after merge. Live bundle contains `Sharing continues from the hosted books`. Independent reviews at `2ad4411`: books / privacy / trust **PASS WITH NOTES**. Verifier on `824ba66`: **PASS WITH NOTES**.

**Data/environment:** Development kitchen deploy from GitHub `main` (Cloudflare Workers workflow `33092467819`). No hosted SQL, secrets, or Production.

**Next owner:** Jonathan — hard-refresh https://hearth-books.jonathan-beaulne123.workers.dev/ , open More, tap Retry now on the waiting-to-share household.

**Named open risk (October):** this retry compares revision numbers only. A local-ahead snapshot that is not a descendant of the hosted tip can still CAS-advance. `canAbsorbDisjointSharedMoney` is the later guard; not in this packet.

## Invite owner first create (D-149 / D-123) (2026-08-27)

**Status:** Merged via #209 onto `main` (`4009b6c`). Kitchen Worker version `10b7de13-7c05-4c5d-a8ab-fc0942e375c3` verified. Risk: **High**. Follow-up false-conflict fix merged #210 (Worker `cc694eee`).

**Household outcome:** The person who starts a household can send a Google invite. Command-log must not skip `hearth_create_household` on the first cloud write.

**Budget delta (5):** `+2` — partner invite is the door to shared books.

**Engagement delta (3):** `+2` — Invite waits for share instead of a false “only the owner” warning.

**What changed:** `shouldUseCommandLogFlush` returns false when `expectedRevision === 0`, so the first write uses `pushSupabaseHousehold` → `hearth_create_household` (owner membership). Invite Issue stays disabled while sharing (`syncState === "syncing"` or `sharing.mode === "pending-transport"`). Compacted later writes keep `expectedRevision === 0` and still create.

**Verification:** Focused `pnpm exec vitest run test/continuity-command-outbox.test.ts test/auth-invite-chrome.test.ts` → 26 pass. Full `pnpm check` on `f5c6649` → `pnpm ai:verify` green; **868 passed / 2 skipped**; `pnpm build` green. Independent reviews: privacy **PASS WITH NOTES** (P3 proof gaps; compact-0 test added after); trust **PASS WITH NOTES** (P1 handoff filled here; P2 pending-transport gate added); books **PASS WITH NOTES** (assert 012 on first-create); UX **PASS WITH NOTES** (live region always in DOM).

**Data/environment:** Development client/docs only. No hosted SQL, secrets, Production rows, or deploy. Fictional Development fixtures in tests.

**Next owner:** Live on the kitchen after #209. Follow-up: first-create retry false conflict on `cursor/first-create-false-conflict-5958`.

## Start from scratch — Development household reset (D-151) (2026-08-27)

**Status:** Merged via #201 onto `main` (`ef3274a`). Risk: **High** (hosted Development delete/leave; Production blocked). Migration **016 applied** 2026-08-27. RPC **not** invoked during apply.

**Household outcome:** One Confirm deletes every disposable Development household this Google account owns, leaves member-only seats, clears this phone’s Development copies, and opens Create household while Google stays signed in.

**Budget delta (5):** `+2` — leftover test ledgers cannot be mistaken for September books.

**Engagement delta (3):** `+2` — one Confirm instead of tapping Delete on every household.

**What changed:** `hearth_reset_development_households` (016) is live; **Start from scratch** is on the Development welcome home and the first card in More.

**Verification:** 016 metadata apply (Production 0→0, Development 7→7, anon EXECUTE false). Kitchen bundle includes Start from scratch after merge/deploy.

**Data/environment:** Hosted Development schema (016). No household wipe, secrets, or Production rows during apply.

**Next owner:** Jonathan — hard-refresh live kitchen → Development pill → **Start from scratch** (welcome or More) when wiping leftover test households.

## T3-S4 scale envelope (2026-08-27)

**Status:** Branch `cursor/t3-s4-scale-envelope-403c` (draft PR). Risk: **Medium** (policy + scheduling honesty; no money meaning change).

**Household outcome:** Named 2–9 / 10–49 / 50–100 poll bands with Realtime primary; D-121 chat limits untouched; explicit refusal to claim 100-person Production on poll alone.

**Budget delta (5):** `+1` — calmer REST under larger N when Realtime is down.

**Engagement delta (3):** `0` — honesty/docs; no new interactable.

**What changed:** `continuityLivePull.ts` (`SCALE_PULL_BANDS`, `scaleEnvelopeClaim`, `activeMemberCountHint`); App recomputes band each poll tick; `SYNC_ARCHITECTURE` scale table + load-test notes; live-pull tests.

**Verification:** `pnpm exec vitest run test/live-pull-dual-use.test.ts test/continuity-resume.test.ts` → 22 pass; full `pnpm check` → 857 pass.

**Data/environment:** Development client/docs only. No schema, secrets, Production, or D-121 retune.

**Next owner:** Jonathan — review/merge; no 100-person load harness in this slice.

## T3-S3 background sync polish (2026-08-27)

**Status:** Merged via #204 onto `main`; kitchen deploy Version `1fa56e20-4d07-4cbf-95e4-6e9774db3017` verified (Offline badge strings live). Risk: **Low**.

**Household outcome:** Returning to the kitchen resumes share without double focus+visibility churn; Realtime flaps back off the REST poll instead of heartbeat-spamming; Offline badge says when share will resume.

**Budget delta (5):** `+1` — calmer reconnect preserves outbox/poll honesty without changing command posting.

**Engagement delta (3):** `+1` — less sync noise when flipping apps; clearer Offline chrome.

**What changed:** `src/continuityResume.ts` (coalesce + reconnect poll backoff); App continuity loop uses resume gate; offline freshness copy; soft-presence comment (no focus heartbeat); tests.

**Verification:** `pnpm check` green on PR; live bundle contains `Offline · will sync when you're back`.

**Data/environment:** Development client only. No schema, secrets, Production.

**Next owner:** Optional tab-hide/show + airplane-mode smoke.

## T3-S2 soft presence (2026-08-27)

**Status:** Merged via #202 onto `main` and kitchen deploy verified. Risk: **Low–Medium** (privacy UX).

**Household outcome:** Calm “Bianca is in the kitchen” chrome for signed-in partners. Optional Realtime presence when Development Realtime is on; D-100 devices remain the durable fallback. Opt-out: “Hide that I'm in the kitchen.”

**Budget delta (5):** `0` — presence never posts money or carries personal ledger rows.

**Engagement delta (3):** `+2` — soft shared kitchen presence without surveillance ranking.

**What changed:** `softPresence.ts`, `softPresenceRealtime.ts`, `SoftPresenceStatus.tsx`; App stamp/share/track wiring (signed-in + throttle + opt-out); Pairing opt-out + member names; conflict merge uses `mergeDevices`; tests.

**Verification:** `pnpm exec vitest run test/soft-presence.test.ts test/soft-presence-realtime.test.ts`; privacy-auditor **PASS WITH NOTES** (Dev presence topics not membership-private — accepted until private channels; opt-out now flushes inactive device row).

**Data/environment:** Development client only. Presence payload is memberId/deviceId/seenAt. No schema, secrets, Production, or deploy.

**Next owner:** Optional two-phone smoke with Realtime on; confirm opt-out hides self.

## T3-S1 optimistic command chrome (2026-08-27)

**Status:** Merged via #200 onto `main`. Risk: **Medium** (UX only; CommandOutcome unchanged).

**Household outcome:** Linked Development confirms feel instant: Saving → This phone → Cloud → Household progress rail; success toast still waits for PGlite accept; background flush upgrades chip to Up to date.

**Budget delta (5):** `+1` — honest progressive sync chrome reduces false “posted to cloud” belief.

**Engagement delta (3):** `+2` — confirm path feels responsive without celebrating before books accept.

**What changed:** `commandProgress.ts`, `CommandProgressStatus.tsx`, `App.tsx` commit/flush wiring, styles, `test/command-progress.test.ts`.

**Verification:** `pnpm exec vitest run test/command-progress.test.ts test/command-surface.test.ts` → 12 pass; `pnpm check` green.

**Data/environment:** Development client only. No schema, secrets, Production, or deploy.

**Next owner:** Done on main — optional manual confirm smoke.

## G6 Tier 1 proof gaps — Migration 012 harness (2026-08-27)

**Status:** Merged via #197 onto `main`. Risk: **High** (hosted continuity transport proof; no money meaning change).

**Household outcome:** T1-S5 two-client harness exercises the same Auth + Migration 012 atomic publish path production uses, and inbound Realtime pulls accept through `acceptHouseholdWrite` like `App.tsx`.

**Budget delta (5):** `+2` — proof that shared CAS and personal envelope commit atomically in tests before T2 planning continues.

**Engagement delta (3):** `+1` — partner visibility harness now matches live transport semantics.

**What changed:** `src/ledger/continuityCasHarness.ts` (in-memory 012 CAS + fetch stub); `continuityTwoClientHarness.ts` Auth config, 012 stub, `acceptHouseholdWrite` on pull; `test/continuity-cas-harness.test.ts`; `scripts/smoke-continuity-cas.mjs` + `pnpm books:smoke:012`; G6 worksession doc update. Includes cherry-picked T6 build fix (`setShowConflictSheet` removal fallout from #194).

**Verification:** `pnpm exec vitest run test/continuity-cas-harness.test.ts test/continuity-two-browser-proof.test.ts` → 13 pass; full `pnpm check` green. P1-4 confirmed live Jonathan SQL Editor 2026-08-27.

**Data/environment:** In-memory Vitest + optional live Development smoke (JWT required). No schema apply, secrets, Production, or deploy.

**Next owner:** Optional `SUPABASE_ACCESS_TOKEN=… pnpm books:smoke:012` on Development.

## Auto-resolve sync conflicts — no blocking modal (2026-08-27)

**Status:** Branch `cursor/auto-sync-conflict-resolve-12ce`, draft PR. Risk: **Medium** (sync UX + conflict resolution policy).

**Household outcome:** Sync divergences resolve behind the scenes. The “Two versions need review” sheet is gone; when share hiccups, users see **Retry now** / background sharing chrome only (T1-S6 freshness UI continues separately).

**Budget delta (5):** `+2` — automatic conflict resolution preserves local books, absorbs disjoint shared money, and never silent-LWW on command-log replay.

**Engagement delta (3):** `+2` — removes blocking conflict modal; sync feels continuous.

**What changed:** `autoResolveSharedConflict` in `src/core/conflict.ts`; wired through `api.ts`, `commandRuntime.ts`, `App.tsx` replay loop; `ConflictResolution` modal removed; `commandSurface` maps conflicts to Retry; command-log materialization defers same-id conflicts without overwrite.

**Verification:** `pnpm test` 822 pass; `pnpm check` green.

**Data/environment:** Development client only. No schema, secrets, Production, or deploy.

**Next owner:** Jonathan — review/merge PR; optional two-phone smoke on Development kitchen.

After a long thread, [WORKING_MEMORY.md](WORKING_MEMORY.md) recaps *this chat*. GitHub remains the full project context (D-095): [DECISIONS.md](DECISIONS.md), merged PRs, living specs, [nostalgia/](nostalgia/), [reference/](reference/). Do not treat unfinished chat as `main`. Do not skip GitHub history.

Cloud-continuity canon is [CLOUD_CONTINUITY.md](CLOUD_CONTINUITY.md): Google sign-in must reveal personal and household ledgers from any device, no peer device is the host, data through 2026-09-30 is disposable/open Development data, and the security cutover is mandatory before meaningful October data.

## Hercules Pro shift cloud sync after Reload (2026-08-27)

**Status:** Branch `cursor/hercules-pro-shift-cloud-sync-403c` (draft PR). Risk: **Medium** (continuity flush path + Pro diagnostics; no money meaning change).

**Household outcome:** Development Reload force-flushes harbour tip shifts into the hosted shared snapshot so Hercules Pro can read the same shift counts as Work report / free Hercules. Empty Pro answers include an explicit cloud snapshot check.

**Budget delta (5):** `+1` — Pro shift facts depend on the same posted shared ledger the books already show.

**Engagement delta (3):** `+1` — Pro stop saying “0 shifts” when the phone Work report is full after Reload.

**What changed:** `commitHousehold` / `persist` gain `forceFlush`; stress Reload awaits outbox flush and surfaces pending/conflict; `shift_summary` default period `this_month`; Pro Worker appends cloud shift counts on empty diagnostics; regression that shared projection keeps harbour shifts and matches Work report.

**Verification:** `pnpm exec vitest run test/stress-seed.test.ts test/hercules-pro.test.ts` → 17 pass. Demo script: shared cloud shifts == local; `shift_summary` matches `workReportFacts` this-month count.

**Data/environment:** Development client + Worker text only. No schema, secrets, Production, or deploy.

**Next owner:** Jonathan — merge, deploy Worker + app, Reload Development → wait until sync quiet / Retry now if pending → ask Pro “how many shifts this month.”

## Hercules rig engine — Worker route, MCP dispatch, furniture macros (2026-08-26)

**Status:** Branch `cursor/hercules-rig-engine-90cc`, PR #167. Risk: **Low** (presentation-only; no money, no ledger reads).

**Household outcome:** Remote agents and Hercules Pro can puppeteer the live kitchen cat part-by-part (head, tail, each leg). Desk instruments trigger layered rig macros when expanded on Home. Fly auto-deposit (PR #163) remains separate.

**Budget delta (5):** `0` — rig never posts money or reads books.

**Engagement delta (3):** `+2` — AI-controllable animation + furniture-reactive cat.

**What changed:** `src/herculesRig/` engine (parts, clips, validate, transport, macros); `HerculesFigure` inline transforms; Worker `POST /hercules/rig` + `GET /hercules/rig/poll` with KV/memory queue; MCP `hercules_rig_dispatch`; client poller in `HerculesRigProvider`; `HerculesOfficeRigBridge` on widget expand; [HERCULES_RIG.md](HERCULES_RIG.md).

**Verification:** `test/hercules-rig.test.ts` (10), `test/hercules-rig-validate.test.ts` (3), `test/hercules-rig-worker.test.ts` (2), `test/hercules-pro.test.ts` rig tool count (68 tools, 67 read-only) — all green. Full `pnpm test`: 675 pass; 2 pre-existing `batch-import-ui` SubtleCrypto failures unchanged on `main`.

**Data/environment:** Development client + Worker routes. No schema, secrets, Production, or deploy.

**Next owner:** Jonathan — review/merge PR #167; optional live deploy smoke of `/hercules/rig` + `hearthRig().sessionId()` + MCP dispatch.

**PR:** https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/167

## Phase 0 secure Flinks Connect inbox (D-148, 2026-08-26)

**Status:** Merged via #161 onto `main@efac0d2`. Risk: **High** (hosted Worker + bank evidence boundary).

**Household outcome:** Flinks supplies read-only bank evidence to the import inbox on Development. Connect uses Supabase bearer + membership scope, encrypted D1 state, iframe origin validation, HMAC-redacted inbox payloads, and DeleteCard disconnect. PR #160 `/flinks/sync` and browser LoginId storage are retired. Account-scoped category autofill from PR #160 remains in `prepareImportRows`. Final Confirm still posts money.

**Budget delta (5):** `+2` — secure bank evidence path without weakening Confirm or posting authority.

**Engagement delta (3):** `+2` — Import from Flinks returns on Batch Import with Connect + one-tap import after link.

**What changed:** `workers/flinks.js` (`/bank/flinks/*`), D1 migration, `FlinksConnectPanel`, `flinksClient`, `parseFlinksInbox`, Batch Import wiring, vite proxy, wrangler D1 binding. Minor fix: `documentScanner` SubtleCrypto digest for jsdom receipt tests.

**Verification:** Corrected Flinks + import triage + Batch Import UI 51/51. Full serial suite reached 686 pass / 2 skipped with one unrelated 30-second stress-fixture timeout; that complete stress file passed 7/7 with a 90-second allowance. TypeScript + production build, Wrangler dry run/startup profile, and non-traffic Cloudflare version `1d296d03-7776-4d72-add1-217dc718e377` are green. Live combined `main@10f466a` reports `sandbox-configured`; unauthenticated member access returns JSON `401`; legacy `/flinks/sync` returns `410`; the live bundle contains the Connect/fetch controls.

**Privacy review:** PASS WITH NOTES — Development scaffold only. Exact member scope, ownership-bound encrypted state, iframe origin/window and callback state, selected CAD accounts, bounded responses, provider-delete retry state, stable HMAC identifiers, and Final Confirm were rechecked. Server-side loginId attestation remains a Production follow-up.

**Data/environment:** Development only; Production activation is refused. No Supabase schema apply or secret values committed. D1 `hearth-flinks-development` is bound and migrated; five legacy PR #160 demo rows were preserved in a renamed legacy table. All five required Flinks values are secret bindings on the live Worker.

**Worksession:** [`worksessions/2026-08-26-flinks-connect-sandbox.md`](worksessions/2026-08-26-flinks-connect-sandbox.md), [`worksessions/2026-08-26-flinks-development-scaffold.md`](worksessions/2026-08-26-flinks-development-scaffold.md)

**Next owner:** Jonathan — live Flinks Connect smoke on deployed Development after merge.


## Phase 0 optional-publish demotion + hosted honesty (D-147, 2026-08-26)

**Status:** Implementation merged via #157 onto `main@2ee381e` (`ca70ce1`). Follow-up draft PR #158 realigns continuity tests that still assumed legacy GET-compare-POST. Risk: **High** (product) / **Medium** (follow-up tests).

**Household outcome:** Ordinary use never needs **Publish to the cloud**. Auth-off legacy publish is Advanced recovery only. Automatic continuity refuses a racy legacy upsert when CAS is missing, and Personal-scope failure after Shared CAS stays pending in the outbox.

**Budget delta (5):** `+3` — remove false Publish authority; fail closed on partial hosted writes.

**Engagement delta (3):** `+1` — Invite chrome matches the Google door.

**What changed:** `commandRuntime` transports only on `transportRequested`; Pairing demotes Publish; `supabase` Personal-fail honesty + refuse-legacy; `continuity` flush treats `pushed.error` as pending; Hercules concurrent rate tests + [HERCULES_KV_BINDING.md](HERCULES_KV_BINDING.md); [GITHUB_BRANCH_PROTECTION.md](GITHUB_BRANCH_PROTECTION.md); [WORKING_MEMORY.md](WORKING_MEMORY.md) reconciled.

**Verification:** Full `pnpm check` on the implementation branch → 658 pass / 2 pre-existing `batch-import-ui` SubtleCrypto fails. Follow-up #158: continuity/proof/live-pull/production/auth-membership 43/43 green after rebase onto post-#157 `main`. Privacy/books/UX auditors: PASS WITH NOTES.

**Data/environment:** Development client + Worker guard + docs. No schema migrate, secrets, Production, Cloudflare KV create, or GitHub ruleset apply (Jonathan).

**Worksession:** [`worksessions/2026-08-26-phase0-remaining.md`](worksessions/2026-08-26-phase0-remaining.md)

**PRs:** https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/157 (merged) · https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/158 (follow-up tests)

**Next owner:** Jonathan — merge #158 so main CI matches refuse-legacy; create `HERCULES_RATE` KV + deploy; apply branch ruleset; Create/invite smoke and two-browser E2E remain separate.

## Phase 0 evidence + membership tuple + hash acceptance (D-146, 2026-08-26)

**Status:** Merged via #156 onto `main@391e3af`. Risk: **High**.

**Household outcome:** Sheets-era issues/PRs have retained evidence; automatic continuity boundaries validate environment + Google membership; pulled/merged money cannot become active books on entry-count alone — PGlite and `financialAuditHash` must agree.

**Budget delta (5):** `+3` — fail-closed identity and books acceptance on discovery/pull/persist/outbox/switch.

**Engagement delta (3):** `0` — safety and tracker hygiene.

**Verification:** Focused `environment-isolation` + `hosted-transport` + `command-runtime` green; `tsc --noEmit` green; full `pnpm test` on branch.

**Worksession:** [`worksessions/2026-08-26-phase0-evidence-isolation-hash.md`](worksessions/2026-08-26-phase0-evidence-isolation-hash.md)

**Next owner:** Jonathan — review PR; remaining Phase 0: optional-publish removal, full atomic hosted stack, Hercules KV, branch protection, WORKING_MEMORY canon drift.

## Scheme A naming clarity (D-144, 2026-08-26)

**Status:** Merged via #154 onto `main`. Risk: **Medium**.

**Household outcome:** All chrome the household sees uses plain Scheme A labels (Groceries, Goals, Health, Sit-down, Shifts, Goals savings, Mark purchased). Only Hercules AI talk and Hercules Pro may use cat/kitchen metaphors, and those lines gloss the human money meaning.

**Budget delta (5):** `+2` — money controls stop sharing colliding metaphors.

**Engagement delta (3):** `+1` — Hercules keeps personality in AI/Pro only.

**Verification:** Focused naming/hercules/office tests green; `tsc` green; `pnpm build` green; `pnpm check` blocked only by pre-existing `batch-import-ui` SubtleCrypto failures on `main`. Phone CDP proof: seals Post/Due/Health; story Goals; Pad chips Groceries/Coffee; account Goals savings.

**Data/environment:** Development demo only; no schema/secrets/Production/deploy.

**Next owner:** Jonathan — naming is on `main`; no further action unless chrome regressions appear.

## Slim continuity outbox + gzip payloads (D-145, 2026-08-26)

**Status:** Merged via #155 onto `main`. Risk: **High**.

**Household outcome:** Large Development books can share without blowing browser `localStorage` quota. The durable outbox stores a slim tip pointer; flush publishes the live accepted household. Personal cloud envelopes may gzip; shared CAS snapshots stay plain JSON for live 006 SQL guards; legacy plain JSON still pulls.

**Budget delta (5):** `+3` — continuity transport reliability; prevents share stalls that diverge two phones’ books.

**Engagement delta (3):** `+1` — Retry/share stays honest under stress fixtures.

**What changed:** `src/ledger/snapshotPayload.ts` codec; shared CAS payloads stay plain JSON (006 SQL guards); personal envelopes may gzip; `continuity.ts` IDB-first slim durable outbox + tipRevision-aware live resolve; D-145 in decisions + continuity canon.

**Verification:** Focused vitest green; size demo fat outbox ~93KB → slim ~427B; personal gzip ~10.6% wire; books/privacy auditors passed on the PR.

**Data/environment:** Development client transport encoding only; no schema migrate, secrets, Production, or real household data.

**Worksession:** [`worksessions/2026-08-26-outbox-compress.md`](worksessions/2026-08-26-outbox-compress.md)

**PR:** https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/155

**Next owner:** Jonathan — after deploy, on the quota desktop tap **Retry now**; confirm banner clears and Bianca’s entry count / Assets converge.

## Auth membership continuity authority (D-143, 2026-08-26)

**Status:** Merged via #152 onto `main`. Live Create/invite smoke still open. Risk: **High**.

**Household outcome:** Automatic cloud share requires a Google continuity identity that matches an active household member. `linked` alone no longer publishes. Phrase remains Advanced recovery routing. Live anon REST stays denied; migration 010 bind RPC is live.

**Budget delta (5):** `+3` — membership is the only automatic write authority.

**Engagement delta (3):** `+1` — Continue with Google / Auth invites stay the normal door.

**Verification:** Focused vitest + `VITE_SUPABASE_LIVE=1` anon denial matrix. Signed-in Create/invite redeem still needs Jonathan.

**Worksession:** [`worksessions/2026-08-26-auth-membership-authority.md`](worksessions/2026-08-26-auth-membership-authority.md)

**Next owner:** Jonathan — Continue with Google Create/open, issue QR invite, redeem on a second session; Cursor continues S5 canon after smoke.

## Continuity outbox quota + Retry now (2026-08-26)

**Status:** Branch `cursor/fix-outbox-quota-retry-129b`; PR pending. Not merged, not deployed. Risk: **Medium**.

**Household outcome:** When the phone's browser storage is full, Hearth still keeps the share queue in memory (and IndexedDB when possible), shows a clear message instead of a raw `setItem` quota error, and **Retry now** can push the live books to the cloud — including when the durable outbox was emptied by quota.

**Budget delta (5):** `+2` — share path must work so Pro and other devices see posted shifts/journals; books stay local-first and Confirm remains the write boundary.

**Engagement delta (3):** `+1` — Retry now is honest and usable; no cryptic Storage exception in the banner.

**What changed:** `continuity.ts` memory+IDB outbox resilience, `humanizeContinuityError`, flush seeds `liveHousehold` on forced Retry; banner action is Retry now; `App.retryShareNow` no longer marks synced when nothing flushed.

**Verification:** `pnpm exec vitest run test/continuity.test.ts test/command-surface.test.ts` (+ related share tests).

**Data/environment:** Development code only; no schema/secrets/Production.

**Next owner:** Jonathan — on the phone showing the quota banner, tap **Retry now** after Google sign-in; confirm chip clears and Pro can read shifts after sync.

## Hercules read-only reconnect fallback (D-137 follow-up, 2026-08-26)

**Status:** Branch `codex/hercules-readonly-reconnect`; focused tests and TypeScript green, deployment/live proof pending. Risk: **Medium**.

**Household outcome:** A broad ChatGPT reconnect no longer blocks Hercules when writing is off. OAuth narrows `hearth.read hearth.write` to `hearth.read`; it does not change either member-owned write opt-in.

**Verification:** Rebased over #147; `test/hercules-pro.test.ts` + `test/continuity.test.ts` 19/19 and `tsc --noEmit` green. The branch corrects #147's stale `WorkPaySchedule` test fixture without changing runtime continuity. PR/main CI, Worker deploy, reconnect, and resumed PiP smoke remain.

**Worksession:** [`worksessions/2026-08-26-hercules-readonly-reconnect.md`](worksessions/2026-08-26-hercules-readonly-reconnect.md)

## Hercules Pro shift read repair (2026-08-26)

**Status:** Branch `cursor/fix-pro-shift-read-129b`; PR pending. Not merged, not deployed. Risk: **Medium**.

**Household outcome:** Hercules Pro can read the connected member's posted shift history from hosted snapshots the same way in-app Hercules can, including personal-envelope shifts and legacy household-stamped own shifts when ChatGPT uses the default Personal ledger.

**Budget delta (5):** `+1` — shared cloud overlay now matches the phone; shift/oracle read tools include the worker's own posted rows in Personal view without crossing partner-personal boundaries.

**Engagement delta (3):** `+1` — Pro tip/shift tools (`shift_summary`, Shift Oracle, sim/review packs) return facts instead of empty answers when cloud continuity has synced shifts.

**What changed:** `overlayPersonalReplica` / `personalEnvelopeFromPayload` moved to `sync.ts` and wired through `supabase.ts` + `herculesPro.js`; `householdForShiftReadTools` scopes shift reads; tests in `visibility.test.ts` and `hercules-pro.test.ts`.

**Verification:** `pnpm exec vitest run test/visibility.test.ts test/hercules-pro.test.ts test/hercules-tools.test.ts` green (29 tests). Full `pnpm test`: 624/626 green; 2× pre-existing `batch-import-ui` SubtleCrypto failures on `main`.

**Uncertainty:** Live ChatGPT smoke against a signed-in Development household with synced personal shifts not run in this VM. Jonathan's 2026-08-26 check showed `shift_summary` 0 on both Personal and Household — that matches **empty hosted snapshots**, not a period-filter bug. In-app Hercules reads local PGlite; Pro reads cloud only until sync completes.

**Data/environment:** Development code only; synthetic fixtures; no schema, secrets, Production, or deploy.

**Next owner:** Jonathan — on the phone with shifts: confirm Google sign-in, wait for sync (no pending/error chip), optionally More → Reload random data (keep identity) to seed stress shifts, then re-ask Pro. After merge+deploy, `cloudBooks.memberShiftCount` in shift tool responses shows hosted shift totals explicitly. Review PR.

## Hercules PiP auto-load (D-139 follow-up, 2026-08-26)

**Status:** Branch `codex/hercules-pip-autoload`; locally verified, deployment and connected-ChatGPT proof pending. Risk: **Medium**.

**Household outcome:** On the first user turn of a new Hercules Pro conversation, `summon_hercules` is the required first tool. Resource v3 requests picture-in-picture as soon as the optional ChatGPT bridge appears, while the animated inline card remains the fallback when the host declines or lacks PiP.

**Boundaries:** A blank chat cannot invoke an MCP tool before the person sends a message, and ChatGPT retains final display control. No accounting calculation, OAuth scope, write authority, schema, secret, Production data, or household row changed.

**Verification:** Rebased over the merged Pro synced-shift repair (`e768a6d`); focused 3 files / 22 tests, full 89 files / 627 tests, TypeScript, production build, Wrangler dry run, and diff check are green. Connector v3 and new-chat first-turn behavior remain to be verified after merge/deploy.

**Worksession:** [`worksessions/2026-08-26-hercules-pip-autoload.md`](worksessions/2026-08-26-hercules-pip-autoload.md)

## Hercules companion load repair (D-139, 2026-08-26)

**Status:** **Complete.** [PR #143](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/143) merged as `cb77cad`; main Worker deployment succeeded; connector refreshed to resource v2; live ChatGPT rendered the 3D model and reported `Hercules is listening`. Risk: **Medium**.

**Household outcome:** ChatGPT can fetch the animated companion across its sandbox boundary. A missing module, WebGL failure, or stuck GLB now resolves to the static Hercules mark instead of permanent `Waking Hercules…`.

**Boundaries:** Exact public JS/GLB/SVG assets only; URI v2 is the ChatGPT cache boundary. No ledger facts, OAuth, command authority, schema, secret, Production data, or household row changes.

**Verification:** 89 test files / 622 tests, TypeScript, production build, Wrangler dry run, PR/main CI, connector template v2, and live inline 3D card all green. Picture-in-picture is host-controlled; verified inline remains the fallback surface.

**Worksession:** [`worksessions/2026-08-26-hercules-companion-load-fix.md`](worksessions/2026-08-26-hercules-companion-load-fix.md)

## Stress reload weighted shifts (D-138, 2026-08-25)

**Status:** Follow-up branch `cursor/pro-legible-reload-85bf` (continuity preserve on Reload for Hercules Pro). Stress trends merged via PR #136; this packet keeps Google identity so Pro can read Reload fixtures. Not merged, not deployed. Risk: **Medium**.

**Household outcome:** More → Reload random data fills twelve months of complete Harbour Dining Room shifts with weather notes, Toronto GPS stamps, and weekday/season/weather-weighted tips so Hercules Pro can analyze realistic trends.

**Budget delta (5):** `+1` — same `postWorkShift` / settlement commands; every sales, tip, break, clock, and destination field filled; optional location/`occurredAt` stamps on work-shift rows.

**Engagement delta (3):** `+2` — reload fixture carries analyzable tip weather/location/weekday trends for Hercules Pro testing.

**Worksession:** [`worksessions/2026-08-25-stress-shift-trends.md`](worksessions/2026-08-25-stress-shift-trends.md)

**Verification:**
- `pnpm exec vitest run test/stress-seed.test.ts test/work-jobs.test.ts test/timezone-location.test.ts` → focused green (includes continuity-preserve Reload proof)
- `pnpm ai:verify` + `tsc --noEmit` + `vite build` green (re-run after continuity fix)
- Trend proof (seed `424242`): Fri/Sat tip/hr 1552¢ > Mon–Wed 1177¢; clearish 1557¢ > rainy 1020¢; 177 job-based shifts with Harbourfront stamps
- Full `pnpm check` fails 2× `batch-import-ui` SubtleCrypto digests on **this branch and `main`** (pre-existing; unrelated)
- Books auditor: PASS
- After merge with `main`: Pro `tools/list` expects companion + catalog + write (**64**)
- Continuity: Reload with `preserveFrom` keeps householdId / linked / Google links; tip shifts follow signed-in `tipMemberId`

**Pro fixture path:** Development → Google Create → Reload random data (keeps identity) → sync → Connect Hercules Pro → tip_oracle / shift_year_simulation. See `docs/HERCULES_PRO.md`.

**Data/environment:** Synthetic Development fixtures; no hosted schema, secrets, Production mutation, or peer-device requirement. Reload UI itself remains available when the env pill is Production (pre-existing).

**Next owner:** Jonathan: Development Google Create → Reload → sync → Connect Pro; smoke tip_oracle / year sim. Review this follow-up PR. Do not merge/deploy without approval.

## Shift year simulation + sandbox gate (D-140, 2026-08-25)

**Status:** **Merged** to `main` as [`6baf033`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/6baf033) via [PR #138](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/138). Not deployed/live-verified. Risk: **Medium**.

**Household outcome:** Hercules (free + Pro) can build a reproducible next-year tips+wages simulation from posted shifts and teach how it works. Python sandbox is designed as a later High-risk gate, not built.

**Budget delta (5):** `+2` — deterministic year Monte Carlo of tips and wages; never posts.

**Engagement delta (3):** `+2` — teachable year simulation for Pro and free Hercules.

**Worksession:** [`worksessions/2026-08-25-shift-year-simulation.md`](worksessions/2026-08-25-shift-year-simulation.md)

**What changed:** `runShiftYearSimulation` / `explainShiftYearSimulation` in `tipScience.ts`; tools `shift_year_simulation` + `explain_shift_simulation` on free Hercules (Worker planner + on-device) and Pro MCP; D-140 + sandbox gate in `HERCULES_PRO.md`; Pro `tools/list` = companion + catalog + write (64).

**Verification:** focused tip-science / hercules-tools / hercules-pro green on the packet; CI green before merge.

**Data/environment:** Development code only; fictional demo/stress data in tests; no schema, secrets, Production, or deploy.

**Next owner:** ChatGPT Pro smoke when convenient; Worker deploy remains separately gated.

## Environment isolation Phase 0 (2026-08-25)

**Status:** Merged to `main`. Follow-up branch `cursor/legacy-pull-env-bind-f375` closes the leftover legacy `readRemoteSnapshot` environment query filter and adds two-client clock-skew / partial-failure proofs.

**Budget delta (5):** `+2` (original) / follow-up `+1` — legacy pull scoped to env+household; fault harness covers clock skew + mid-publish failure recovery.

**Engagement delta (3):** `0`

**Verification:** focused vitest on `supabase` + `hosted-cas-two-client`; then `pnpm check`.

**Next owner:** Review follow-up PR; two-phone Auth smoke still needs devices.

## App Store sync UX P0+P1 (2026-08-25)

**Status:** **Merged** to `main` as [`3dcb12f`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/3dcb12f) via [PR #114](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/114). Not deployed/live-verified yet. Risk: **High**.

**What was examined:** Conflict sheet, Undo persistence, Sign out wipe, Pairing Invite/Advanced, command Retry, Restore tip host/privacy, personal live-pull.

**Verified findings:** Shared-only conflict impact; Undo scoped env+household+member (last 20); Sign out clears Auth/Google/session/undo/outbox/sync-anchor/pending invite + local household; restore tips strip Personal; Retry force-flushes outbox.

**Changes:** See PR #114 diff (`ConflictResolution`, `undoHistory`, `Pairing`, `App`, `restorePoints`, `continuity`, `supabase` personal pull).

**Budget delta (5):** `+3` — conflict impact honesty; durable Undo on this phone; Restore blast-radius + tip host + Personal strip; Retry flush; personal live-pull; complete Sign out local wipe.

**Engagement delta (3):** `+2` — Pairing Invite/Advanced; clearer sync chrome; Sign out clarity.

**Worksession:** [`worksessions/2026-08-25-appstore-sync-ux.md`](worksessions/2026-08-25-appstore-sync-ux.md)

**Verification:** focused vitest + `pnpm check` passed on packet. UI smoke on local Vite demo (Invite/Advanced, Recent copy, Sign out confirm). Two-phone Auth smoke still needs Jonathan/Bianca devices.

**Remaining uncertainty / decision needed:** Confirm worksession defaults if any are wrong. Two-phone Auth smoke on live Dev.

**Data/environment:** Development client only; disposable Dev data; no hosted schema/secrets/Production mutation; no peer device required online for Sign out.

**Next owner:** Two-phone smoke on live Dev; verify Workers deploy from `main` CI green.

## Combined undo + restore engine (2026-08-25)

**Status:** Branch `cursor/undo-restore-engine-f375` (not merged). Confirmation-scoped LIFO **Undo** (partner stays, auto CAS) + owner **Restore points** (D-124 shape in household payload). Dev last-sync whole-snapshot Undo retired.

**Budget delta (5):** `+3` — safe dual-use Undo; owner Restore; refuse while conflicted.

**Engagement delta (3):** `+1` — Undo vs Restore labels; Recent LIFO of my ledger writes.

**Worksession:** [`worksessions/2026-08-25-undo-restore-engine.md`](worksessions/2026-08-25-undo-restore-engine.md)

**Next owner:** Review PR; smoke Undo with partner post present; smoke owner Restore after sync.

## Live pull dual-use (2026-08-25)

**Status:** Merged via PR #109.

## Risk routing

| Risk | Examples | Default routing |
|---|---|---|
| Low | Copy, styling, docs | One implementer |
| Medium | Dialog, pure calculation, cosmetics that cannot post | Implementer plus a targeted review |
| High | Financial math, migrations, splits, account kinds, statement figures | Implementer plus independent review |
| Release | Switching daily use, hosted schema, auth/RLS | All reviewers, Jonathan approves |

## Hercules living teacher (D-132)

**Status:** implemented on `codex/hercules-living-teacher`; independent privacy/numeric review required before merge. No deploy, schema, hosted row, secret, or Production mutation.

**History finding:** `38af6ef`/`1055d56` are the compact floating-bubble lineage. `6e8e40d` added strong per-message widget snippets while ordinary chat stayed as plain transcript rows. D-132 adapts that per-message visual language without reverting grounded chat, request identity, or model safeguards.

**Budget delta (5): +2** — typed clickable book-source records; explicit Household versus Personal question projection; partner-personal refusal before aggregation/model transport; grounded food/spend/income/shift answers.

**Engagement delta (3): +3** — restored turn bubbles, legitimacy cards, teacher copy, and desktop fly/litter play. Fly piles are session-only and disappear on reload; mobile/reduced motion renders no fly.

**Next owner:** independent review of provenance routing, shared-member aggregation, personal-ledger refusals, and desktop/mobile visual behavior. Do not deploy from this branch.

## Hercules Sim + Review packs (D-142)

**Status:** Draft PR [#140](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/140) on `cursor/hercules-sim-review-packs-129b` (rebased onto `main` after D-138–D-141 landed). Not merged; not deployed; no schema/secrets/Production mutation.

**Baseline:** rebased onto current `main`. Worksession: [`worksessions/2026-08-26-hercules-sim-review-packs.md`](worksessions/2026-08-26-hercules-sim-review-packs.md). Decision renumbered **D-142** because `main` already used D-138–D-141.

**What landed:** `simReview.ts` with Cash Cinema, What-If Desk, Year-in-Review; three shared read tools; Pro MCP `usedTool` + answer prefix; full inventory [`HERCULES_PRO_CAPABILITIES.md`](HERCULES_PRO_CAPABILITIES.md); teacher skill names the tool. Pro `tools/list` is now **67** (companion + 63 reads + 3 write-path).

**Budget delta (5):** `+3`

**Engagement delta (3):** `+2`

**Verification:** focused `sim-review` + `hercules-pro` after conflict resolution; CI pending on merge commit.

**Next owner:** Independent trust review of forecast math + announcement contract; Jonathan merge decision. Do not deploy from this branch.

## Hercules Shift Oracle (D-137)

**Status:** Core Oracle **merged** to `main` via [#133](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/133). Schedule-weighting **merged** via [#137](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/137). Not deployed; no schema/secrets/Production mutation.

**Baseline:** Strategy 3 implementation from `main@6e2baea` lineage. Worksession: [`worksessions/2026-08-25-hercules-shift-oracle.md`](worksessions/2026-08-25-hercules-shift-oracle.md).

**What landed on main (#133):** deterministic `tipScience.ts` with seeded Monte Carlo tip floors, weather/season-adjusted outlook, cadence schedule sim, educational tax-milk/buffer; four shared read tools for free Hercules + Pro (`tip_oracle`, `shift_outlook`, `tip_schedule_sim`, `tax_milk_plan`); Bernoulli day cadence from today; order-stable observations.

**Follow-up (#137):** probability-weight `tip_schedule_sim` totals by weekday frequency; Pro `tools/list` count was 61 before D-138.

**Budget delta (5):** `+3` (merged) / follow-up `+1`

**Engagement delta (3):** `+2` (merged) / follow-up `0`

**Verification:** tip-science + hercules-pro focused suites green on follow-up; full check on this agent VM also hits 2 unrelated `batch-import-ui` SubtleCrypto failures.

**Next owner:** Development smoke in ChatGPT Pro + in-app Ask after D-138; do not deploy without approval.

## Hercules Brain v2 typed reads + free depth (D-133/D-135)

**Status:** implemented on `codex/hercules-brain-v2-tools`; no deploy, schema, hosted row, secret, or Production mutation. Built on the D-132 living-teacher branch so the result cards use its typed provenance UI.

**Shape:** `/hercules/plan` may select at most four of sixteen fixed read-only tools. Provider output is sanitized on the Worker and phone. The phone executes against `householdForHerculesContext`; Personal never widens to a partner and Household never exposes personal-only rows. There is no SQL, code, mutation, or Confirm capability. Planner failure preserves the existing chat/local fallback.

**Spend posture:** Workers AI is first for planning, grounded voice, and selected-image scanning. Gemma 4 is tried before Llama 3.1. OpenAI/Anthropic are inert unless `HERCULES_ALLOW_PAID_PROVIDERS=true`; checked-in Development configuration is `false`, including when provider secrets happen to exist. No Worker was deployed in this slice.

**Budget delta (5): +3** — grounded balances, searches, summaries, bills, shifts, goals, obligations, cash position, budget variance, categories, cards, net worth, audit health, and duplicate review compose without granting model write authority.

**Engagement delta (3): +3** — Hercules can answer broader natural-language financial questions, then gives the deterministic result a short grounded cat-voice pass while every shown amount remains a tappable legitimacy card.

**Next owner:** review catalog arithmetic/scope, provider plan parsing, and source routing; then smoke the four prompts in `docs/HERCULES.md`. Do not deploy from this branch.

Dual Course (D-048): if Course A (books, weight 5) and Course B (engagement, weight 3) disagree, the books win. A companion change that can touch CAD meaning is High, not Medium.

## Required handoff

Status, what was examined, verified findings, changes, verification, remaining uncertainty, decision needed. For continuity work also state the Google identity and ledger scopes, whether any peer device must remain online, offline/outbox behavior, hosted mutations, environment, schema, and whether data was disposable Development data.

Also name:

- **Budget delta (5)** — which posting, rec, sit-down, account-literacy, split-honesty, Health, or statement primitive moved.
- **Engagement delta (3)** — which Hercules line, unlock, chalkboard, wallet tile, ceremony, or Ask chip moved.

If either delta is “none,” say why Dual Course still holds (for example GitHub 2FA is Course A with no mascot on purpose).

Read [nostalgia/](nostalgia/) and [reference/](reference/) to understand past decisions. Do not cite them as the next build plan.

Sheets-era handoff notes (museum): [reference/sheets-era/AI_HANDOFF.md](reference/sheets-era/AI_HANDOFF.md).

## Development continuity slices (D-114 and D-117, PRs #72–#75)

**Status:** exact Google-subject Development discovery, PGlite acceptance, a durable compacting local outbox, launch/focus/reconnect replay, multi-household device replicas, an explicit ledger switcher, and member-only personal device replicas are implemented. Migration 003 is applied: D-117 server-filtered membership discovery and hosted member-personal payloads are live in Development; missing tables retain the D-114 fallback. Inherited broad grants were removed and verified as exactly `SELECT`/`INSERT`/`UPDATE` for `anon` and `authenticated`. No hosted rows, deployment, Production data, or secrets were changed.

**Still required:** two-browser end-to-end proof, Supabase Auth-bound membership, and the late-September deny-by-default RLS cutover. Migration 002 is live in Development; its forward concurrency repair is unapplied migration 005.

**Budget delta (5):** `+4` — accepted offline commands survive reconnection, pulled snapshots pass PGlite, stale remote revisions retain both sides, and locally switching households no longer overwrites a different ledger.

**Engagement delta (3):** `0` — account continuity is trust infrastructure; Hercules and office chrome were intentionally unchanged.

## Command states Slice A+B (D-119, PR #76 merged)

**Status:** Merged to `main` as [PR #76](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/76). Claude authored the UX/copy spec; Cursor Cloud Agent (GPT) implemented parallel Slice A (Add/Confirm a11y) and Slice B (command chrome, sync anchor, conflict choose) plus `App.tsx` integration. Jonathan resolved eight product defaults on 2026-08-24. Worksessions: [`2026-08-24-command-states-slice-ab.md`](worksessions/2026-08-24-command-states-slice-ab.md).

**Budget delta (5):** `+2` — command UI derives from `CommandOutcome`; Development undo/reverse restores last sync anchor; in-app conflict choose without silent LWW.

**Engagement delta (3):** `+1` — accessible Add sheet, honest chip/banner/toast copy; Hercules preset prompt unchanged.

**Still required:** two-device conflict choose proof; Production reversal semantics stay on D-085 until Jonathan approves D-124 build (or an interim Production D-119 approval).

## More → Recent changes copy (D-119 tighten) + D-124 accepted

**Status:** Copy tighten on `cursor/recent-changes-copy-4ffb`. Development empty state and header pill match last-sync undo; older rows say **synced**; Production empty state stays honest LIFO until D-124 ships. Button label remains **Undo**. Pure helpers in `src/recentChangesCopy.ts`.

**Budget delta (5):** `0` — wording only; restore semantics unchanged this pass.

**Engagement delta (3):** `+1` — More card no longer contradicts the toast / D-119 behavior.

**D-124 accepted (not built):** dated hosted restore points, last 30 days, visible to everyone, restore owner-only, Dev+Production together. Next build is a separate PR after Auth/RLS sequencing Jonathan chooses.

## Office chalkboard / Home themes / Hercules snippets (D-120, PR #80)

**Status:** Merged via [PR #80](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/80) and follow-up [PR #82](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/82). Desk tool button is **Home theme** (was Look).

**Budget delta (5):** `0` — chalk Save/delete never posts; bought removed from Office and legacy `DailyHearth` chalk UI.

**Engagement delta (3):** `+2` — weather chip on chalkboard band; Home theme paper stocks (pink/gold/slate; cream unchanged); Hercules widget-anchored snippet stack with placeholder prompts.

**Still required after merge:** Jonathan visual pass at 390/720+; replace Hercules placeholder copy when ready.

## Member-scoped AI disclosure (D-115)

**Status:** Merged to `main` via [PR #83](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/83). `householdForAiDisclosure` strips partner personal txs/shifts/goals/memories; `composeHerculesChatRequest` rebuilds briefing, notices, ledger, and memories from that slice. Canaries in `test/ai-disclosure.test.ts`.

**Budget delta (5):** `+1` — partner personal money cannot leak into model aggregates (Course A privacy of the books).

**Engagement delta (3):** `+1` — Hercules model-first chat can keep growing without partner-personal disclosure.

**D-116 complete in code:** each in-flight model reply is bound to its request id, environment, household id, and member id. A context switch clears the old busy state and reloads the active ledger's chat; the delayed answer is neither displayed nor recorded. Newer requests also supersede older responses. Proof: `test/hercules-reply-context.test.ts`. The phone remains the only payload composer.

## Hosted snapshot CAS + outbox ack (D-122)

**Status:** Applied to Development on 2026-08-25 (Jonathan SQL-editor paste of fixed `002_snapshot_cas.sql`). Live smoke `pnpm books:smoke:cas` **4/4**: first publish, duplicate ack, stale conflict, advance 1→2. Disposable smoke household `HH-cas-smoke-mt7xsikl`. Client + outbox work already on `main` via [PR #84](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/84) / [#86](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/86). Production schema **not** applied.

**Budget delta (5):** `+3` — live atomic hosted CAS is on for Development.

**Engagement delta (3):** `0`.

**Still required:** two-browser E2E on real devices; Auth/RLS cutover before October; Production apply is a separate approval.

**Risk:** High residual until Auth/RLS; open Development RLS unchanged through 2026-09-30.

## D-191 live command latency repair (2026-09-01)

**Status:** exact rebased High-risk candidate `351983fa225fdeeac9f23f54498ee78c4574a03d` over `origin/main@450be34b6bc84f5bf5e203154c864cccba198eb5` passed focused 64/64, full gate 1,510 passed / 3 skipped, production build, and independent books/trust plus continuity release review. Jonathan authorized push, fast-forward merge, and Development deployment on 2026-09-01. At this record, no push, merge, deployment, hosted mutation, or Production change had occurred.

**Household outcome:** command-event and snapshot-recovery acceptance now share one receiver coordinator. Snapshot echoes coalesce for 300 ms and, on expiry, check the committed command log before full recovery can occupy PGlite. Only an exact locally accepted hosted revision suppresses recovery, while missing/unknown/hidden/invalid/conflicted/gap paths retain the full pull/reconcile/PGlite route.

**Budget delta (5):** `+4`. **Engagement delta (3):** `+1`.

**Still required:** exact-tree full gate, independent books/trust and continuity verification, then separately approved release and a fresh deployed two-account 100-sample p95 run. The historical `<=500 ms` smoke is not evidence for this local repair.

## D-192 Realtime terminal-channel self-heal (2026-09-01)

**Status:** exact application commit `f3ca474` on `codex/realtime-self-heal`, cleanly rebased over `origin/main@8ae8071f16b945fe2a174a4df52e62054e1b63f3`; work originally opened from `8def9bd`, passed its final full application gate as `d477c27` over `86da91c`, then took a documentation-only Charter release advance. Jonathan authorized push, merge, and Development deployment; at this record it is committed locally, not yet pushed, merged, deployed, or live-proven.

**Household outcome:** a visible signed-in Development kitchen that loses its Supabase Realtime socket now recreates one authenticated membership-checked channel instead of remaining indefinitely on backed-off polling. Successful resubscription catches up committed command rows through the ordinary coordinator/PGlite acceptance path before the snapshot fail-safe.

**Budget delta (5):** `+4`. **Engagement delta (3):** `+1`.

**What changed:** worker-backed heartbeat configuration where supported; heartbeat and terminal-channel failure signals; one reconnect timer with 1/2/5/10-second bounded backoff; a 5-second `SUBSCRIBED` acknowledgement deadline; focus/visibility/online acceleration; stale-generation/disposal guards; command-log-first reconnect and unhealthy-poll catch-up; privacy-safe reconnect lifecycle phases. Development/Auth/hosted eligibility is required before the healer starts, and lost eligibility stops automatic retry. Poll fallback, Auth/RLS membership, financial command meaning, PGlite acceptance, and Production refusal remain intact.

**Verification:** the source diagnostic had `realtimeStatus: CLOSED`, zero Realtime receives, 27 poll fallbacks, and 4.5–5.0-second snapshot acceptance after poll scheduling, while the posting device reached cloud acknowledgement in 880 ms. On fully tested application commit `d477c27` over `86da91c`, the combined sync/Charter/Fund interaction gate passed 110 tests plus TypeScript and diff checks. Full application tests passed 1,549 / 3 skipped across 224 passed / 2 skipped files; AI-surface verification passed 41 required files. The exact equivalent TypeScript, Vite production build (396 modules), Hercules Pro UI, and no-`dist/_redirects` checks passed. Final `f3ca474` changes the application SHA only because the new base added Charter release documentation; the application diff is unchanged. Independent books/trust review passed; latency review passed with no code blocker after the release record correction; hygiene/privacy found no P0–P3 issue.

**Environment/data disclosure:** Development client code and synthetic local tests only. No hosted query was executed for this repair; no schema, migration, RLS, provider setting, secret, hosted row, Production-continuity flag, financial fact, or real household record changed. Google identity and Shared/Personal scope rules are unchanged. Offline writes remain durable in the existing outbox and no peer device becomes a host.

**Still required:** a separate release decision, then a fresh deployed signed-in two-device 100-sample run before claiming `<=500 ms p95`. Browser-level App lifecycle integration remains a non-blocking P2 proof gap; the pure lifecycle/policy units and reviewer-run focused suites pass.

## D-195 continuity Auth reconnect (2026-09-01)

**Status:** exact rebased application `a7bd6b8`, release-tooling correction `0520c1e`, and schedule-preservation repair `72bba7d` over `origin/main@8fb0a5f` are committed and fully verified on `codex/auth-reconnect-repair`. Clerk remains canonical D-194. Jonathan authorized push, merge, and Development deployment; the replacement push, merge/deploy, and live proof remain pending.

**Household outcome:** a Development household whose secure Supabase/Google session is missing or whose expired refresh is refused no longer appears to be checking the cloud every four seconds. The shared freshness row says **Google sign-in needed** and shows **Continue with Google**. The local accepted replica remains readable; no outbox item or household is removed. The user chooses a Google account, then the existing Auth membership and PGlite-gated continuity lifecycle resumes after OAuth return.

**Budget delta (5):** `+4` — honest, recoverable authenticated continuity for accepted Shared/Personal books without a new writer. **Engagement delta (3):** `+1` — one calm visible recovery action replaces an indefinite false fallback label.

**What changed:** a pure Development eligibility rule distinguishes Auth loss from transport choice, so polling-only and Realtime builds recover the same way; freshness has an `auth-required` mode and visible action; App observes same-window Supabase session save/clear plus cross-window storage changes, including the keyless event emitted by `localStorage.clear()`; the same-window event contains only the environment, never token or identity; OAuth starts only from the explicit button and forces account selection. Missing, refresh-refused, remove-item, and full-storage-clear sessions have App-shell regressions. Offline copy remains primary, and local-only, Auth-disabled, hosted-disabled, and Production states cannot offer the action.

**Verification:** the exact rebased release tree through `72bba7d` passed `pnpm check:windows`: fast lane **1,456 passed / 2 skipped** across 214 passed / 1 skipped files; serial books lane **145 passed / 1 skipped** across 18 passed / 1 skipped files; total **1,601 passed / 3 skipped**. AI-surface verification, deployment sanitizer, TypeScript, the **400-module** Vite production build, Hercules Pro UI, and no `dist/_redirects` all passed. The post-rebase Clerk/Auth/schedule interaction gate passed 38/38. `git diff --check` is clean apart from non-mutating Windows line-ending warnings. GitHub's first pushed candidate inherited a `demo-suite` timeout from `main` under four-worker contention; the guarded serial lane closed that host issue. The next exact remote run exposed that refreshing one member's schedule discarded another member's Personal shift envelope and aged status against wall clock. `mergeScheduleEnvelopes` now preserves untouched members and derives status from the authenticated observation time; the regression and formerly failing demo assertion pass. Rebase integration preserves Clerk D-194, immediate local sign-out, and stale-refresh cancellation while D-195 supersedes the earlier automatic refresh-refusal redirect: only the visible account-chooser action opens OAuth.

**Continuity and privacy boundary:** existing Google OAuth scopes are unchanged. Supabase Auth membership remains the automatic cloud authority; Shared and Personal filtering, RLS, registered-device checks, command-log recovery, one receiver coordinator, PGlite acceptance, durable outbox, and polling fail-safe are unchanged. No peer device must stay online. Offline writes remain local/outboxed. Development client and local synthetic tests only: no Supabase query, hosted mutation, schema/migration/RLS, secret, provider, Production flag/data, or real household entry changed.

**Still required:** complete the authorized replacement push, merge, and Development deployment. A deployed signed-in account chooser/reconnect smoke and fresh two-device 100-sample timing run remain necessary before any live OAuth or `<=500 ms p95` claim.

## Auth + membership RLS cutover (D-123)

**Status:** Migration **006 applied** on live shared project (Jonathan paste). Anon REST denial verified. Kitchen Auth door reaches Google OAuth. Docs record of apply: open PR #104. Invite chrome: branch `cursor/auth-invite-chrome-f375`.

**Budget delta (5):** `+4` — deny-by-default membership door is live for Development data on the shared project.

**Engagement delta (3):** `+1` (invite chrome in flight)

**Next owner:** Jonathan — signed-in Create/open/`HH-591c6905afd19707` sync smoke; then email/QR issue+redeem. Rollback only via explicit order and `docs/sql/009_rollback_006.sql`.

**Risk:** Release residual until signed-in smoke and invite redeem. Do not enable `VITE_PRODUCTION_CONTINUITY` casually.

**Environment / data disclosure:** Live applies: 002/004/005/007/008/006. Disposable Development data. No Production continuity client flag.

## Trust-foundation worksession (2026-08-24, local branch)

**Status:** Merged through [PR #71](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/71). Independent books/privacy/verifier review ran before merge. Auth/RLS remains a do-not-apply packet with synthetic tests. Conflict bundles export both sides without merging. `pnpm check` and `pnpm ai:verify` exist. No hosted schema was applied by that PR.

**Budget delta (5):** Money Confirm now goes through `acceptHouseholdWrite`: validate → balanced journal → PGlite ingest → persist → optional linked transport. Failures restore the previous household. If persist fails and books restore also fails, the outcome is `recovery-available` with both posting flags false. Linked writes compare revision; stale writes keep both sides. Claims and sit-down money block auto-merge. Hearth Pass overlay refuses a different shared journal. Unlinked/demo/empty/Pass households make zero household REST calls. WelcomeJoin applies a Pass without probing hosted books.

**Engagement delta (3):** none by design. Claude gets `src/claude/commandContract.ts` adapters/fixtures; OfficePhone/Hercules chrome were not edited.

**Still required:** atomic hosted CAS/journal authority and an explicit Jonathan migration decision. Do not apply `002_snapshot_cas.sql` or Auth/RLS, deploy, contact the household project, or delete hosted rows without that approval.

## Bianca Month-One rehearsal (D-183) (2026-08-28; mainline catch-up 2026-08-31)

**Status:** Development code release complete at `main@4af04130507291c8805102dcd1d4b73dd8cdfc0a`; Cloudflare Workers run [`33425439223`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33425439223) passed and the live no-store bundle contains the D-183 rehearsal markers. Bianca Month remains a mainline projection, not a trial fork: the current App integration test opens the current Add slideshow, and rehearsal progress materializes through the D-180 command-event path. No hosted schema/data, provider, secret, Production, scaling, shift-intake, or real household entry changed. This is code availability, not authenticated two-phone proof, daily-use approval, server authority, or launch approval.

**Household outcome:** Bianca and Jonathan rehearse four Toronto weeks using real Development Confirms, see `Tied` or `Needs attention` before exact proof, record where Bianca pauses or distrusts a number, acknowledge independently, and decide together whether Hearth is wanted next month.

**Budget delta (5):** `+5` — opening truth, exact journal/equation checkpoints, accepted receipt gates, correction by reversal, reconciliation, and close.

**Engagement delta (3):** `+3` — ten-minute weekly continuation, deterministic Hercules narration, ordinary playtest card, humane return/friction choices, and joint approval.

**Verification:** exact `main@4af0413` release preflight passed `pnpm check`: AI surface, **1,335 passed / 3 skipped / 0 failed** across 205 passed / 2 skipped files, TypeScript, Vite production, Hercules Pro UI, and no-`dist/_redirects`. Responsive local browser proof at 320/390/720/1100 px found no horizontal overflow or console warnings/errors and retained ordinary Hearth navigation and preview-only gating. Exact September 2026 golden assertions still cover every cent, journal/trial/equation, Fund projection, receipt identity, and financial/checkpoint hash. Independent UI release review passed; books/trust review conditionally passed for Development code availability while retaining the server-authority boundary below. Cloudflare run `33425439223` passed; live HTTP 200/no-store proof found the D-183 command and Start/Resume markers. Local and hosted-bundle evidence is never authenticated two-phone continuity evidence.

**Next owner:** Jonathan and Bianca — conduct the four-week Development rehearsal and separately authorize two-authenticated-phone continuity/joint-signoff proof when ready. Gemini review still requires Jonathan's explicit external-transmission approval. Jonathan remains the only owner who may approve any launch/Production step.

**Trust boundary:** current client replay rejects wrong-kind, Personal-scope, changed-participant, nonparticipant, and SHA-mismatched rehearsal materialization, including compacted events. The SHA is client-generated tamper detection, not server authority; a malicious authenticated-participant client remains unproven until Jonathan separately authorizes a server transition validator or signing boundary.
