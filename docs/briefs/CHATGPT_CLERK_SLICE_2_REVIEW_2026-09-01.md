# ChatGPT independent review — Clerk Slice 2 tappable citations

**Use this in a new ChatGPT chat. Do not continue the Cursor implementation thread.**

Jonathan (2026-09-01) asked for this packet so GPT can **review** Clerk Slice 2. Do **not** merge, deploy, apply schema, change secrets, use Production, or mutate household data. A Cloudflare Workers check on the PR is a branch preview, not the kitchen URL and not live.

## Which model

Use **GPT-5 Pro** (or the strongest available Pro reasoning model) with thinking **on**. Instant / mini / 4o will rubber-stamp.

This is a **Medium-risk** accessibility/behavior review of a read-only money-adjacent UI. Books/trust review is required only if the implementation expanded into financial meaning, visibility projection, navigation authority, or write paths. Return PASS, CONDITIONAL, or FAIL. Do not write a patch in that chat.

## How to run it

1. New chat → GPT-5 Pro.
2. Connect the GitHub repo `jonathanbeaulne123-blip/dual-ai-budget-app` if possible, or attach the files listed below.
3. Paste the fenced prompt.
4. Do **not** paste `.env`, Worker secrets, Google tokens, workbook exports, or real household rows.

### Files to attach if GitHub is not connected

- `src/ClerkReading.tsx`
- `src/clerk-reading.css`
- `test/clerk-citations.test.ts`
- `src/core/clerkReading.ts`
- `test/clerk-reading.test.ts`
- `docs/AI_HANDOFF.md` (top Clerk Slice 2 section only)
- `docs/worksessions/2026-09-01-clerk-citations.md`
- `docs/briefs/CURSOR_CLERK_SLICE_2_CITATIONS_2026-09-01.md` (implementation contract; on `origin/main`)
- `docs/DECISIONS.md` (D-194 why-note only)

This packet lives at `docs/briefs/CHATGPT_CLERK_SLICE_2_REVIEW_2026-09-01.md` on the review branch.

PR: https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/287

---

Paste everything inside the fence:

```text
You are an independent reviewer of Hearth Clerk Slice 2, not the implementer. Return PASS, CONDITIONAL, or FAIL before any advice about merge. Do not write a patch. Do not merge, deploy, apply hosted schema, change secrets, use Production, mutate household rows, or rebase unless Jonathan separately asks.

## Product (one paragraph)

Hearth is Dual Course: family-office books weigh 5; Hercules and interactables weigh 3. When they conflict, the books win. CAD is integer cents. Books civil dates stay America/Toronto. Commands plus visible Confirm post money. Hercules never posts and never proposes amounts or work. The Household Fund is a virtual shared operating subledger over Bianca’s savings; Hearth cannot move the money. The Clerk quotes accepted rows and cites them (D-194). A sentence without a citation is not rendered. When the existing Fund conservation guard does not tie, the reading is withheld. A hidden UI screen is not a privacy boundary. main publishes the kitchen via wrangler deploy (D-041). A Cloudflare Workers preview of a branch is not the kitchen URL and is not live.

## Authority (in order)

1. Jonathan’s latest explicit instruction: independently review Clerk Slice 2 tappable citations. Do not merge.
2. AGENTS.md, docs/CLOUD_CONTINUITY.md, docs/DECISIONS.md (D-048 Dual Course, D-194 Clerk cited reading, D-193 Held motions), docs/STRATEGY.md, docs/ARCHITECTURE.md, docs/AI_HANDOFF.md (top Clerk Slice 2 section).
3. The Slice 2 implementation contract on origin/main: docs/briefs/CURSOR_CLERK_SLICE_2_CITATIONS_2026-09-01.md. Where it conflicts with living canon, living canon wins.
4. Current code on the named SHA — not docs/nostalgia/ or docs/reference/.

## Exact git facts (verify; do not assume they are still HEAD)

- Repo: jonathanbeaulne123-blip/dual-ai-budget-app (private)
- Review branch: cursor/clerk-2-citations-fdc8
- Review SHA: branch tip of cursor/clerk-2-citations-fdc8 at or after 0dd64ca46e3670389bc866ad8a9a97cf08f362a9, including this packet. Confirm HEAD before judging.
- Slice 1 contract SHA (must remain an ancestor): 6f1cb43f793312953fb733d795a0d0439d539f35
- origin/main at packet time: 09be0dcde24356ede228d136fb8cc26498042697 — already contains Slice 1 (clerkReading.ts, D-194, the Cursor Slice 2 brief). Fetch origin/main and the review branch before judging ancestry.
- Open PR #287: feat(clerk): tap a sentence, see its rows. Base main. Ready for review (not draft) at packet time. Not merged, not kitchen-published, not live.
- Cloud Agent used cursor/clerk-2-citations-fdc8 instead of the packet’s clerk/2-citations. That is acceptable.
- Files this PR should add versus main: src/ClerkReading.tsx, src/clerk-reading.css, test/clerk-citations.test.ts, docs/worksessions/2026-09-01-clerk-citations.md, docs/AI_HANDOFF.md (top section), and this ChatGPT brief. If App.tsx, commands, clerkReading.ts, storage, Worker, or schema changed, that is a scope break.
- CI on SHA 0dd64ca, same workflow, two events: pull_request CI SUCCESS (https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33547768030); push CI FAILURE (https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33547763251) on test:books, test/demo-suite.test.ts:89 upcoming-envelope. The Slice 2 contract named that Demo Suite fixture and forbade repairing it here. Do not treat a later packet-commit CI rerun as a new books-lane blocker unless ClerkReading.tsx caused it. Workers Builds SUCCESS is a branch preview, not D-041 kitchen publish. Do not treat it as live.

## Claimed household outcome (verify; do not assume)

Jonathan or Bianca can focus or tap any Clerk sentence and reveal, directly beneath it, the exact accepted transaction and Household Fund event rows that support that sentence. The explanation stays calm, compact, keyboard- and screen-reader-complete, and never hides the record behind a modal.

Dual Course claimed: Budget +1, Engagement +2. Books win: withhold or fail closed rather than substitute, infer, or widen the supplied household. No posting.

## What Cursor already claims as proven (treat as claims; do not copy forward)

- Focused test/clerk-reading.test.ts + test/clerk-citations.test.ts: 12/12 on the implementation head.
- pnpm ai:verify green. tsc --noEmit green. Vite production build and Hercules Pro UI green.
- pnpm check books lane failed test/demo-suite.test.ts upcoming envelope locally and on push CI run 33547763251. Pull-request CI run 33547768030 on the same SHA reported SUCCESS. The Slice 2 contract named this as a pre-existing Demo Suite fixture issue and forbade repairing it in this slice. Confirm it is unrelated to ClerkReading.tsx; do not “fix” it here. Do not treat the green pull_request check as proof the books lane is green.
- Independent UX audit PASS WITH NOTES, then Cursor removed onKeyDown toggle (native button click is the activation path), unique aria-label on open links including civil date, and region aria-labelledby the sentence button.
- Visual claims: 320 / 390 / 720 / ~1100 with keyboard focus, mixed-source disclosure (Groceries $120.00, contribution confirmed $150.00, contribution proposed $40.00), missing-citation line, withheld, empty. Local preview harness was deleted and not committed. No 5/5 claim.
- Component is unwired from App.tsx by contract.

## Named gates — PASS / CONDITIONAL / FAIL each

G-LEAF. ClerkReading.tsx is a display-only leaf. It imports types, formatCad from money.ts, and CSS only — not core/index, commands, storage, fetch, Worker, model, or App. It does not recalculate sentence text. Optional onOpenRecord is a passed callback, not a new global navigation or data-access path. App.tsx is untouched.

G-IDS. Disclosure lists exactly sentence.transactionIds then sentence.fundEventIds, in that order, looked up only in the supplied household.transactions and household.fundEvents. Missing IDs render the calm integrity line and no substitute row. Empty-citation sentences are omitted. Partner-Personal projection is not this component’s job; it must not search a broader snapshot to fill a gap.

G-WITHHOLD. tiesToProjection === false renders one honest withheld line and zero sentence controls, even if sentences were supplied. Tied empty reading is calm and invents no facts. Copy must not use denied, rejected, pending, you should, work more, or lite.

G-A11Y. Each visible sentence is a native button type="button". Pointer, Enter, and Space activate the same inline disclosure (native click path is acceptable; a second onKeyDown toggle is a defect). aria-expanded and aria-controls are present. The region is inline, not role=dialog, not a portal, not position:fixed overlay. Visible copy includes exactly “the rows this came from”. Focus ring is 2px solid var(--pine) offset 2. Primary targets min 44px. No hex literals in new CSS. Reduced motion does not hide state.

G-BOOKS. Slice 1 clerkReading.ts arithmetic, D-194, Fund projection, and commands are unchanged. CAD shown is integer-cents from the resolved row via formatCad (thousands separators in the view are presentation only). Toronto DateKey is not reinterpreted in the runtime zone. No Confirm, no journal write.

G-PROOF. Tests rebuild the Slice 1 canonical month through real commands, then call clerkReading(); they are not hand-written citation objects alone. They cover DOM order, disclosure, exact IDs, empty drop, missing/narrow household, untied, tied-empty, mixed-source, and the leaf source fence. Re-run the focused two-file Vitest command on the review SHA if you can; do not paste Cursor’s 12/12 as your own result. Do not require a green books-lane Demo Suite as a Slice 2 blocker unless Clerk caused it.

## Return format

1. Overall PASS, CONDITIONAL, or FAIL.
2. One line per gate.
3. Ranked P0–P3 findings with file paths. P0 = money/scope break. P1 = accessibility or fail-closed defect. P2 = should fix before merge. P3 = note.
4. Dual Course judgment: did books actually win?
5. Whether PR #287 may be merged by Jonathan (recommendation only). Explicitly state: not merged, not deployed, not live.
6. Next owner and the smallest next action. Clerk Slice 3 fences and App placement stay out of scope.

Forbidden copy in the UI, if present, is a finding: governance, lite, denied, rejected, declined, pending, action required, you should, you need to, pick up a shift.
```
