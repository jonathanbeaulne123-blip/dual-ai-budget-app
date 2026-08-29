# AI Task and Handoff Standard

## D-165 Kitchen desk, Personal books floor, leftover spend (2026-08-29)

**Status:** Draft PR [#244](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/244) on `cursor/shared-ledger-story-aef7` @ `ec69d1e`. **Not merged, not deployed, not live.** Risk: **High** (ledger-mode financial presentation; leftover CAD; Personal account journal).

**Household outcome:** Shared Home is one pool plus Kitty Banks as sub-accounts. Personal Books is the serious account floor (household-visible rooms plus mine, never partner-personal). Home seals are posted Money in, posted expenses Money out, and leftover spend for Kitty Banks after the month. Fat paper banks grow at 10% of `savedCents`. Setup forms collapse.

**Budget delta (5):** `+4` — honest Personal rooms, posted in/out leftover (not sit-down leftover), Fund bank Confirm.

**Engagement delta (3):** `+3` — 3-column desk, fat banks, collapsible chrome, kind-coloured calendar.

**If they conflicted:** books win. Personal Home/Hercules stay on `scopedHousehold`. Leftover spend is posted in − posted expenses and must not share a label with sit-down leftover. No new Fund formulas. Widgets still never `postEntry`. Confirm still posts money.

**What changed:**
- `personalBooksFloor(household, memberId)` for Personal Books tiles only. Home/dashboard/Hercules/export unchanged.
- `deskMonthSeals` from `incomeActualCents` / `expenseActualCents`. Unpaid recurrences stay out of Money out.
- Wide Home: mosaic \| stage \| Kitty Banks on Shared and Personal. Seals: Money in / Money out / Leftover spend (`posted in minus posted expenses`). A hole is not a pending empty seal. Both desks open Plan from leftover spend.
- Personal Books Activity uses the floor journal (`presentedTransactions`), not a second `isVisibleInView` pass. Audit/hero/Ask stay on accepted `booksHousehold`.
- iPhone `OfficePhone`: same three seal labels; leftover tap opens Plan; mosaic structure otherwise unchanged.
- Shared Wallet: Shared pool card + Kitty Banks, not a room list.
- Kitty Banks: SVG fatness by `kittyBankStep`; Fund contribute gated by ConfirmSheet.
- Drawer holds Paper/Classic/Edit/Desks/Home theme. Window temp stays in the glass. Calendar colours by kind; second tap grows detail. Shift posted bubbles sit under Tip climate.

**Verification:**
- Focused: `pnpm exec vitest run test/ledger-experience.test.ts test/kitty-banks.test.ts test/office-wide.test.ts test/ledger-story-ui.test.ts test/desktop-office.test.ts test/office-phone.test.ts` → **51 passed**.
- `pnpm check` at `0ed5651` → **1114 passed / 2 skipped**, `ai:verify` + `tsc --noEmit` + Vite build green. Follow-up `ec69d1e` focused leftover/Activity/UI tests green; full check rerun in this packet.
- Independent books **CONDITIONAL** at `0ed5651` (P1 Activity used scoped view — closed in `ec69d1e`; P1 interest chips on joint rooms disclosed). Privacy **CONDITIONAL** (hero/Audit/Ask stay accepted books by D-164 integrity copy). UX **CONDITIONAL** (leftover is not sit-down leftover by Jonathan’s lock; Plan tap + reduced-motion + 44px close closed). Trust **CONDITIONAL** (same leftover lock; AskBooks=`booksHousehold` is pre-existing vs this packet).

**Data and environment disclosure:**
- Development impact: none (local/synthetic demo kitchen only)
- Production impact: none
- Network calls or data sent: none new
- MCP access: none for household data
- Hosted rows/schema/secrets/deployments: none
- Real household or partner-personal data used: none. Demo/synthetic Development only.

**Remaining uncertainty:** Sit-down leftover stays a different number; the seal sub-copy is posted in minus posted expenses so the two are not homonyms. Personal Home seals still use scoped personal+both, not the Books floor journal. Personal hero, Audit, Ask, and SQL stay on accepted `booksHousehold` (integrity, with honest copy). Joint Visa interest/rewards chips on the Personal floor still post without a new Confirm sheet (pre-existing AccountRoom). GCal overlay can still tint by member. Demo personal-scope accounts remain thin. iPhone mosaic structure is unchanged except seal labels. Do not rebase onto later `main` unless asked.

**Next owner:** Jonathan — review Shared Home three columns + leftover spend, Personal Books rooms (joint chequing/Visa/TFSA), fat Kitty Banks, and Confirm on Fund bank. Do not merge, rebase, or deploy unless you ask.

**Worksession:** [`worksessions/2026-08-29-kitchen-desk-banks.md`](worksessions/2026-08-29-kitchen-desk-banks.md)

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
