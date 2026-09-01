# ChatGPT independent review and merge — Charter slices 3 and 4

**Use this in a new ChatGPT chat. Do not continue the Cursor implementation thread.**

Jonathan (2026-09-01) asked for this packet so GPT can **review, then merge** the founding conversation and the charter page. Kitchen publish from `main` (D-041) is a consequence of merge. Do not apply schema, change secrets, use Production, or mutate household data.

## Which model

Use **GPT-5 Pro** (or the strongest available Pro reasoning model) with thinking **on**. Instant / mini / 4o will rubber-stamp. One session: review first, merge only after PASS or CONDITIONAL-with-rebase.

## How to run it

1. New chat → GPT-5 Pro.
2. Connect the GitHub repo `jonathanbeaulne123-blip/dual-ai-budget-app` if possible, or attach the files listed below.
3. Paste the fenced prompt.
4. Do **not** paste `.env`, Worker secrets, Google tokens, workbook exports, or real household rows.

### Files to attach if GitHub is not connected

- `docs/AI_HANDOFF.md` (top two Charter sections only)
- `docs/worksessions/2026-09-01-charter-founding-flow.md`
- `docs/worksessions/2026-09-01-charter-page.md`
- `src/core/charter.ts`
- `src/core/charterFounding.ts`
- `src/core/charterView.ts`
- `src/core/commands.ts` (`commit`, `foundHouseholdCharter`, `signHouseholdCharter`, `grantCharterPermission`, `revokeCharterPermission`)
- `src/core/writeKind.ts`
- `src/CharterFounding.tsx` + `src/charter-founding.css`
- `src/Charter.tsx` + `src/charter.css`
- `src/App.tsx` (charter overlay + More card only)
- `test/charter-founding.test.ts`
- `test/charter-page.test.ts`
- `test/charter-record.test.ts`
- `test/charter-commands.test.ts`

PRs:

- Slice 3: https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/271
- Slice 4: https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/275

---

Paste everything inside the fence:

```text
You are an independent reviewer and, if the review passes, the merger of two stacked Hearth Charter PRs. You are not the implementer. Return PASS, CONDITIONAL, or FAIL before any git write. Do not apply hosted schema, change secrets, use Production, or mutate household rows.

## Product (one paragraph)

Hearth is Dual Course: family-office books weigh 5; Hercules and interactables weigh 3. When they conflict, the books win. CAD is integer cents. Books civil dates stay America/Toronto. Commands plus visible Confirm post money. Hercules never posts. The Household Fund is a virtual shared operating subledger over Bianca’s savings; Hearth cannot move the money. Unsigned charter is a valid state, not an error. Remainder is a first-class split rule (D-189). A hidden UI screen is not a privacy boundary. main publishes the kitchen via wrangler deploy (D-041). A Cloudflare Workers preview of a branch is not the kitchen URL and is not live.

## Authority (in order)

1. Jonathan’s latest explicit instruction: review Charter slices 3 and 4, then merge them if they pass.
2. AGENTS.md, docs/CLOUD_CONTINUITY.md, docs/DECISIONS.md (D-048 Dual Course, D-041 kitchen publish, D-189 remainder / founding why-notes), docs/STRATEGY.md, docs/ARCHITECTURE.md, docs/AI_HANDOFF.md (top Charter sections).
3. Current code on the named SHAs — not docs/nostalgia/ or docs/reference/.

## Exact git facts (verify; do not assume they are still HEAD)

- Repo: jonathanbeaulne123-blip/dual-ai-budget-app (private)
- origin/main at packet time: 450be34b6bc84f5bf5e203154c864cccba198eb5 — includes #274 “Fix Charter agreement integrity” (56ee6b4). Fetch origin/main first. Do not merge onto stale main.
- Slice 3 draft PR #271: branch cursor/charter-founding-flow-021f @ e9b14d907b6e15b7243df97b09c8d964117981a8, base main. Title: feat(charter): the founding conversation. CI test on this SHA was SUCCESS. Still draft at packet time.
- Slice 4 draft PR #275: branch cursor/charter-page-021f @ 3c08502c7ff6c896eea3d744c784bed15f596ac3, base cursor/charter-founding-flow-021f (stacked). Title: feat(charter): the charter page and the empty signature line.
- Slice 3 original baseline was origin/main@effd7b3 (slice 2 sealed). main has since gained register work, PGlite re-anchor #273, and charter integrity #274. Rebase (or merge origin/main) is required before #271 can land cleanly. Expect conflicts in src/core/charter.ts, src/core/commands.ts, test/charter-record.test.ts, test/charter-commands.test.ts, docs/AI_HANDOFF.md.
- Cloud Agents used branch prefix cursor/…-021f instead of the build manual’s charter/3-founding-flow and charter/4-page. That is acceptable.
- Neither PR is kitchen-live. Merging to main will queue D-041 wrangler deploy. Jonathan authorized merge of these two slices; that includes the kitchen publish that follows. Do not deploy a second time. Do not touch Production household data.

## Claimed household outcomes (verify; do not assume)

Slice 3: From an empty household (members, no accounts, no Fund, no books), Shared Home opens a five-question paper founding conversation (purpose, split, permissions, cadence, ceiling). Skip is a peer of Next. One person can found alone, then Sign it or Later. Catalog/demo kitchens with accounts stay on the office until More → the charter. Founding persists with zero CAD accounts; posting still requires an active CAD account. No ledger $ figure, chart, or “Step 2 of 5” in the flow. Escape does nothing.

Slice 4: After a charter exists, More → the charter opens the document. Purpose is the masthead. Identical 260px signature rules. An unsigned line adds nothing — no pending, badge, amber, nav count, or prompt aimed at the other person. Only the viewer sees a quiet sign on their own blank line. Escape closes the document.

Dual Course claimed: slice 3 Budget +2 / Engagement +3; slice 4 Budget +1 / Engagement +3. Books win in both.

## What Cursor already claims as proven (treat as claims)

Slice 3 (e9b14d9 / runtime 7042d7e):
- Focused founding + record + commands + app-startup-p1 + month-rehearsal-mainline: 34 passed (later 7 founding tests on the page branch).
- pnpm check on 7042d7e: 1481 passed / 3 skipped; tsc + Vite; Hercules Pro UI green. Pre-existing 3 skipped unchanged.
- Books audit: first FAIL (empty household could not persist because commit() always requireCadAccounts); fixed by gating requireCadAccounts on isLedgerWrite({ postedIds }) i.e. TXN/SHF only; non-CAD active accounts still rejected; re-audit PASS.
- UX audit PASS WITH NOTES; follow-ups: Tab trap, aria-pressed, inert app-shell, heading focus, no h4 inside buttons.
- Browser fictional Development: More → five questions → Later; Escape does not dismiss.

Slice 4 (53c0bcc check; 3c08502 follow-up):
- Focused page + founding + record + commands + Bianca + month rehearsal: 39 passed.
- pnpm check on 53c0bcc: 1486 passed / 3 skipped; Vite 391 modules; Hercules Pro UI green.
- Books audit PASS (sign/revoke only; unsigned valid; no posting).
- UX audit PASS WITH NOTES; P1 sign/revoke min-width 44px fixed in 3c08502. More card copy is only “The household agreement.”
- Browser: document page; Jonathan signed only his line (1 Sept 2026); Bianca unsigned silent; 320 / 390 / 720 / ~1100.

Do not copy these numbers forward. Re-run pnpm check on the rebased SHAs.

## Named gates — PASS / CONDITIONAL / FAIL each

G-REBASE. #271 is rebased or merged onto current origin/main including #274 charter integrity. Keep BOTH: (a) agreement-integrity repairs from #274, and (b) kitchen-local Charter writes skipping requireCadAccounts while TXN/SHF still require CAD accounts. If you cannot keep both, FAIL and stop.

G-BOOKS. Founding/sign/grant/revoke/amend do not post journal money, create a Fund, or invent a second envelope. isLedgerWrite remains TXN/SHF. Empty founding still founds. postEntry without an account still throws. Remainder is stored, not computed. No percent/ratio. Unsigned remains valid. #274 integrity tests still pass.

G-UX. Five founding questions, skip peer of Next, no Step 2 of 5, no $ figure in founding. Charter page: identical signature rules, sign only on the viewer’s unsigned line, no pending/awaiting/action required/nav count. Founding Escape does nothing; page Escape closes. Bianca Month tests stay green.

G-STACK. Merge order is #271 to main first, then retarget #275 to main, rebase #275, pnpm check, then merge #275. Never merge #275 to main while it still targets the slice 3 branch. Never squash away the Dual Course handoff.

G-SHIP. After merge, distinguish: merged to main ≠ kitchen published ≠ live verified. D-041 will deploy. Confirm the GitHub Actions wrangler run and that Production household data was not touched. Worker preview URLs are not the kitchen.

## Merge procedure (only after overall PASS or CONDITIONAL whose only work is rebase/docs)

If FAIL: stop. Comment on both PRs with the ranked findings. Do not merge.

If PASS / CONDITIONAL-rebase:

1. Fetch origin/main, origin/cursor/charter-founding-flow-021f, origin/cursor/charter-page-021f.
2. Rebase slice 3 onto origin/main. Resolve with G-REBASE. Do not drop #274 tests. Do not restore always-on requireCadAccounts.
3. pnpm check on the rebased slice 3 SHA. Must be green (pre-existing 3 skipped unchanged).
4. Mark #271 ready (undraft). Merge #271 to main with a merge commit or the repo’s usual merge method. Do not force-push main. Do not delete evidence.
5. Retarget #275 to main. Rebase slice 4 onto the new main. pnpm check. Mark ready. Merge #275.
6. Watch the D-041 kitchen deploy Action for main. Record the run id. Do not call it live until the kitchen HTML is fetched.
7. Update docs/AI_HANDOFF.md tops to: merged, kitchen Action id, not Production. Close the two worksessions as MERGED; kitchen live only after you verified the worker.

Forbidden during merge:
- Production household mutation, supabase schema apply, wrangler secret put, clasp, force-push of main, merging unrelated PRs, Charter slice 5 / Register UI.

## Return format (required)

1. Overall: PASS | CONDITIONAL | FAIL
2. One household-outcome sentence for slices 3+4 together.
3. Table of G-REBASE, G-BOOKS, G-UX, G-STACK, G-SHIP with verdict + one evidence sentence each.
4. Ranked P0 / P1 / P2. Smallest correction per finding.
5. If merging: exact SHAs merged, PR numbers, rebase notes, pnpm check counts, deploy Action id, what remains unverified.
6. If not merging: why, and the smallest next action for Jonathan.
7. Facts vs inferences labeled separately.

## Forbidden in the review half

- Do not implement product scope beyond rebase conflict resolution.
- Do not invent CAD, screenshots, or CI numbers.
- Do not paste or request secrets, Production data, or real household rows.
- Do not treat Cursor chat memory as proof.
```
