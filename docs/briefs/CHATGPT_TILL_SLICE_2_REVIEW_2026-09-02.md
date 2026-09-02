# ChatGPT independent review — Till Slice 2 two-tap swipe

**Use this in a new ChatGPT chat. Do not continue the Cursor implementation thread.**

Jonathan (2026-09-02) asked Cursor to implement Till Slice 2 and to return this GPT review plus a durable handoff. Do **not** merge, deploy, apply schema, change secrets, use Production, or mutate household data. A Cloudflare Workers check on the PR is a branch preview, not the kitchen URL and not live.

## Which model

Use **GPT-5 Pro** in ChatGPT Pro, with thinking / extended reasoning **on**. Instant, mini, and GPT-4o will rubber-stamp. If the picker still shows **o3-pro**, that is an acceptable substitute.

This is a **High-risk** Dual Course review (books custody + posting UI). One session is enough if it returns named gates. Do not ask the same model to then implement the fix in that chat.

## How to run it

1. New ChatGPT chat → **GPT-5 Pro**.
2. Paste the fenced prompt below.
3. Give it the code. The GitHub repo is private, so connect the repo or attach:
   - `src/core/commands.ts` (`postEntry`, `householdFundEventKindForPost`, `HOUSEHOLD_PURCHASE_CUSTODY_REFUSAL`, `requireFundCustodian`)
   - `src/core/swipe.ts`
   - `src/Swipe.tsx`
   - `src/swipe.css`
   - `src/App.tsx` (`submitSwipePurchase`, `openSwipeIntoAdd`, Shared Home action, strip)
   - `test/custody-fence.test.ts`
   - `test/swipe.test.ts`
   - `docs/AI_HANDOFF.md` (top Till Slice 2 section only)
   - `docs/worksessions/2026-09-02-till-2-swipe.md`
   - `docs/DECISIONS.md` (D-197 / D-198 / D-161 purchase-funded why-note)
4. Optional: draft PR https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/295 if ChatGPT can open it.
5. Do **not** paste `.env`, Worker secrets, Google tokens, workbook exports, or real household rows. Demo/synthetic Development only.

Related: [AI_HANDOFF.md](../AI_HANDOFF.md) · [worksession](../worksessions/2026-09-02-till-2-swipe.md) · [DECISIONS.md](../DECISIONS.md) D-197 / D-198 / D-161 / D-047 / D-048

## Exact git facts (packet time)

- Repo: `jonathanbeaulne123-blip/dual-ai-budget-app`
- Branch: `cursor/till-2-swipe-0c3a`
- Base: `origin/main` @ `1c03cbedc10ca5f14ca51bf4067db5ba142a91c5`
- Review SHA: branch tip of draft PR #295 after the proof/docs commit (code+Hercules pause `938cb33401ed5313a615ece4ac6259f8f7ec0d9a`)
- Draft PR #295 — **not merged, not deployed, not live, not shipped**
- Risk: **High**
- Decision owner: Jonathan
- Slice 3 is blocked until this exact head is accepted

---

Paste everything inside the fence:

```text
You are an independent reviewer of Hearth, not the implementer. Return PASS, CONDITIONAL, or FAIL. Do not write a patch. Do not merge, deploy, apply schema, change secrets, or rebase.

## Product (one paragraph)

Hearth is Dual Course: family-office books weigh 5; Hercules and interactables weigh 3. When they conflict, the books win. CAD is integer cents. Books civil dates stay America/Toronto. Commands plus visible Confirm post money. Hercules never posts. The Household Fund (D-161) is a virtual shared operating subledger over Bianca’s savings; Hearth cannot move the money. Persistent custody sentence: “The money remains in Bianca’s savings. Hearth cannot move it.” A purchase-funded claim records that a household purchase was made on a card; it does not move Fund operating CAD. Audit Office is how we show the ledger. Accounts Floor is how we touch accounts. A hidden UI screen is not a privacy boundary.

## Authority (in order)

1. Jonathan’s latest explicit instruction: implement Till Slice 2 only; return a GPT review and handoff; do not start Slice 3.
2. AGENTS.md, docs/CLOUD_CONTINUITY.md, docs/DECISIONS.md (D-047, D-048, D-161, D-197, D-198), docs/STRATEGY.md, docs/ARCHITECTURE.md.
3. Current code on branch cursor/till-2-swipe-0c3a — not docs/nostalgia/ or docs/reference/.

## Exact git facts

- Repo: jonathanbeaulne123-blip/dual-ai-budget-app (private)
- Branch: cursor/till-2-swipe-0c3a
- Base: origin/main @ 1c03cbedc10ca5f14ca51bf4067db5ba142a91c5
- Review SHA: branch tip of draft PR #295 (code+Hercules pause 938cb33401ed5313a615ece4ac6259f8f7ec0d9a plus this packet/docs commit)
- Draft PR #295 — not merged, not deployed, not the live kitchen
- Do not rebase onto later main unless Jonathan asks

## Claimed household outcome (verify; do not assume)

Bianca, the Fund custodian, can record an ordinary Household Fund purchase from Shared Home in two taps: CadPad amount, then an observed category. Local books update immediately. Strip copy is “Posted. Nothing moved.” Money does not move. Jonathan cannot create a purchase-funded claim. More, an ambiguous card, and a duplicate open ordinary Add. Undo lasts ten seconds.

Dual Course claimed: Budget +3 / Engagement +3. Books win: no React writer, no auto duplicate confirm, no camera/OCR, no second Fund fold.

## Justified expansion Cursor already discloses (verify)

The packet wanted sealed Slice 1 SHA 7a023c75 on codex/till-1-custody-fence-v2. That SHA was never pushed. Cursor reconstructed the custody fence on current main as D-197 because D-196 is the weekly document. Slice 2 is D-198. Confirm this was required for correctness, not scope creep.

## What Cursor already claims as proven (treat as claims)

- Focused custody-fence + swipe on 938cb33: 17 tests passed.
- Exact pnpm check on 938cb33 passed: ai:verify 41 files / 2 Clerk fences; fast 224 files / 1536 tests; serial books 18 files / 146 tests; tsc; Vite 413 modules; Hercules Pro UI.
- Fund/Clerk/startup/rehearsal packet including PGlite Fund and Bianca app-startup-p1 passed earlier; golden month hashes were frozen after changing Fund-backed purchase actors to the custodian. Money amounts were not changed.
- Swipe.tsx does not import postEntry, commitHousehold, outbox, PGlite, or IndexedDB.
- postEntry requires the Fund custodian before cloneHousehold for purchase-funded.
- Exact refusal: “Only the person holding the card can post a household purchase.”
- Playwright fictional Development demo as Bianca (Toronto 2026-09-12): I spent something → CadPad What did you just spend? → Groceries → Posted. Nothing moved. Operating stayed $3260.00. Hercules pill hidden while the sheet is open. 320/390/720/1100 overflowX 0.
- Independent UX auditor failed to launch. Books/privacy/verifier were launched; if their written verdicts are missing from the handoff, mark those reviews unproven.

## Named gates — return PASS / CONDITIONAL / FAIL each

G-BOOKS. purchase-funded is custodian-only before clone. Refunds/purchase reversals remain refund-funded without the new fence. Reversing a refund is purchase-funded and custodian-only. Fund operating balance does not move. No new Fund formula or event kind. Unfunded posts, contributions, settlements, and shifts stay unfenced.

G-PRIVACY. Observed categories and remembered cards use the scoped household and current member. Partner-Personal credits and history are excluded. A hidden UI is not a privacy boundary.

G-PURPOSE. This is Till Slice 2 only: two-tap swipe for an ordinary Fund purchase. Camera/OCR, notes, account picker, Till route, and Slice 4 landing preference stay out.

G-UX. One I spent something on Shared Home for the custodian. CadPad titled What did you just spend? then 2×3 72px cells plus More. Keyboard Escape closes. 10s Undo. 320/390 one-handed; 44px targets. If you cannot see screenshots, mark visual unproven.

G-SHIP. Distinguish local / branch / PR / merged / deployed / live. This work is draft PR only. Slice 3 is blocked.

## Return format (required)

1. Overall: PASS | CONDITIONAL | FAIL
2. One household-outcome sentence (what Jonathan and Bianca would notice).
3. Table of G-BOOKS, G-PRIVACY, G-PURPOSE, G-UX, G-SHIP with verdict + one evidence sentence each (file/symbol, not vibes).
4. Ranked findings P0 / P1 / P2. Smallest correction per finding. No patch.
5. What you could not verify (missing files, no runtime, private GitHub).
6. Next owner and the smallest next action. Do not authorize merge or deploy.

## Forbidden

- Do not implement.
- Do not invent CAD, Fund math, or screenshots.
- Do not paste or request secrets, Production data, or real household rows.
- Do not treat Cursor chat memory as proof.
- Facts and inferences must be labeled separately.
- Do not start or specify Slice 3 work.
```
