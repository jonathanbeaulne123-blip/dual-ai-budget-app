# ChatGPT independent review — Register slice 8 drawing

**Use this in a new ChatGPT chat. Do not continue a Cursor or implementation thread. Do not mix this chat with the Ask panel (#288) review.**

## Which model

Use **GPT-5 Pro** in ChatGPT Pro, with thinking / extended reasoning **on**.

This is a High-risk Dual Course review (Fund obligation drawing). Instant, mini, and GPT-4o will rubber-stamp. If the picker still shows **o3-pro**, that is an acceptable substitute. Do not use GPT-5 Instant, GPT-4o, or mini.

One session is enough if it returns named gates. Do not ask the same model to then implement the fix in that chat. Do **not** merge or deploy.

## How to run it

1. New ChatGPT chat → **GPT-5 Pro**.
2. Paste the fenced prompt below.
3. Connect GitHub `jonathanbeaulne123-blip/dual-ai-budget-app` if possible, or attach at least:
   - `src/core/registerView.ts`
   - `src/Register.tsx`
   - `src/register.css`
   - `src/core/contributionRegister.ts` (existing fold; should be unchanged)
   - `test/register-view.test.ts`
   - `docs/worksessions/2026-09-01-register-8-drawing.md`
   - `docs/AI_HANDOFF.md` (Register slice 8 section on that branch)
4. Optional: draft PR https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/285
5. Do **not** paste `.env`, Worker secrets, Google tokens, workbook exports, or real household rows. Demo/synthetic Development only.

Related: sister review [slice 9 Ask panel](CHATGPT_REGISTER_SLICE_9_ASK_PANEL_REVIEW_2026-09-01.md). These PRs **conflict on docs** and must not be stacked as code. Slice 8 is presentation-only and is **not kitchen-wired**.

## Exact git facts (packet time)

- Repo: `jonathanbeaulne123-blip/dual-ai-budget-app`
- Branch: `cursor/register-8-drawing-115c`
- Review SHA: `36e255dca17573161c6b27eaf17dd4723fc9736f`
- Product closeout SHA on that branch’s handoff: `3053da379f6b7bbae969aa49b604768a8f465e69` (docs followed; head is `36e255d`)
- Implemented from `origin/main@ff9d8d8de70c80fd567ba9835b3cc2ffbcd45082` at the time. **Current GitHub main** is `e7d98389be1a4ad831d4d83204061a68955df232` (Held UI #286 merged). Fetch `origin/main` before judging rebase dirt. Do not rebase unless Jonathan asks.
- Draft PR #285 — **not merged, not kitchen-published, not live**
- Risk: **High**
- Decision owner: Jonathan

---

Paste everything inside the fence:

```text
You are an independent reviewer of Hearth, not the implementer. Return PASS, CONDITIONAL, or FAIL. Do not write a patch. Do not merge, deploy, apply schema, change secrets, or rebase.

## Product (one paragraph)

Hearth is Dual Course: family-office books weigh 5; Hercules and interactables weigh 3. When they conflict, the books win. CAD is integer cents. Books civil dates stay America/Toronto. Commands plus visible Confirm post money. Hercules never posts. The Household Fund (D-161) is a virtual shared operating subledger over Bianca’s savings; Hearth cannot move the money. Shared is one pool (D-173). contributionRegister is the conserved FIFO fold: arrival-order segments, honest unfunded cents, no percentage, no member score. A hidden UI screen is not a privacy boundary.

## Authority (in order)

1. Jonathan’s latest explicit instruction: independent ChatGPT review of Register slice 8. He did not authorize merge or deploy.
2. AGENTS.md, docs/CLOUD_CONTINUITY.md, docs/DECISIONS.md (D-048, D-161, D-173), docs/STRATEGY.md, docs/ARCHITECTURE.md.
3. Current code on branch cursor/register-8-drawing-115c at 36e255dca17573161c6b27eaf17dd4723fc9736f — not docs/nostalgia/ or docs/reference/.

## Exact git facts (verify; do not assume they are still HEAD)

- Repo: jonathanbeaulne123-blip/dual-ai-budget-app (private)
- Branch: cursor/register-8-drawing-115c
- Review SHA: 36e255dca17573161c6b27eaf17dd4723fc9736f
- Baseline at implementation: origin/main@ff9d8d8de70c80fd567ba9835b3cc2ffbcd45082
- Current GitHub main at packet time: e7d98389be1a4ad831d4d83204061a68955df232 (Held UI #286 already merged). This drawing branch is likely dirty vs latest main. Do not rebase. Do not merge.
- Draft PR #285 — not merged, not deployed, not the live kitchen. Register is not imported by OfficeWide or OfficePhone on this PR.
- Sister draft PR #288 is the Ask panel. Do not review Ask in this chat. Do not stack the PRs. They conflict on docs/DECISIONS.md and docs/AI_HANDOFF.md.
- Dual Course claimed: Budget +3, Engagement +2

## Claimed household outcome (verify; do not assume)

Jonathan and Bianca can read the month’s Fund obligations as one honest, true-width register: one shared scale, confirmed money in arrival order, unfunded as a dashed outline. If the fold does not tie, Hearth shows an empty staff rather than a plausible partial drawing. This slice does not place the register in the kitchen.

## What Cursor already claims as proven (treat as claims)

- Focused test/register-view.test.ts + test/contribution-register.test.ts: 20 passed.
- pnpm exec tsc --noEmit passed.
- pnpm test:fast on that head: 214 files passed / 1 skipped, 1,455 tests passed / 2 skipped.
- Full pnpm check not green: serial demo-suite.test.ts fails on an unrelated shiftEnvelopes "upcoming" assertion. Slice does not touch that file.
- Independent books audit: PASS WITH NOTES. UX audit: P0 missing overflow-x auto after an a11y commit; restored on this head. SVG is decorative; the semantic list is the accessible fact sheet.
- Component harness screenshots at 320 / 390 / 720 / ~1100, including untied fail-closed copy. Not kitchen.
- Files: src/core/registerView.ts, src/Register.tsx, src/register.css, test/register-view.test.ts, core/index export, docs. No App/Office mount.

## Open findings Cursor did not close (verify; do not rubber-stamp)

Label each as still true, false at this SHA, or unproven.

1. No kitchen placement. Decide if a presentation component with no host is still mergeable, or if it should wait for an approved desk slot.
2. Forced-colors distinct hers/his/carried fills still need measured visual proof.
3. Empty tied months still show “Nothing owed this month yet.” rather than source totals (packet line).
4. % fence is on Register.tsx data-bearing strings; CSS may still use % for layout. Confirm the fence is the product rule, not a CSS ban.
5. Member pine/copper tones must be explicit host metadata, never inferred from ids, signed-in viewer, contribution size, or array position. Register is not kitchen-wired, so host metadata may be unused — say if that leaves a hole.
6. origin/main has moved (Held UI #286). Confirm the drawing diff is still only the register surface plus docs vs current main, or if Held UI docs collide.
7. Do not stack with Ask panel #288.

## Named gates — return PASS / CONDITIONAL / FAIL each

G-BOOKS. One scale (560 / maxRowCents or equivalent REGISTER_VIEW.barRight - barLeft). Segments stay in supplied arrival order. Unfunded is outline-only. Untied or unmappable register shows no financial bars or totals. No new allocator, command, or Fund formula. contributionRegister math unchanged.

G-SCORE. No percentage, ratio, you-covered-X%, member-vs-member bar, pie, or leaderboard in data-bearing strings. Purpose never branches, sorts, or widths the drawing.

G-A11Y. Phone list is the accessible fact sheet. SVG decorative (aria-hidden). Horizontal scroll is inside the card (overflow-x auto), not the page. Keyboard can reach the scroll container if overflow exists.

G-UX. 320 / 390 / 720 / ~1100 if you can see screenshots; otherwise mark visual unproven. House tokens only; no new hex if the slice promised that. Fail-closed copy exact if present: the untied line from REGISTER_UNTIED_LINE.

G-SHIP. Distinguish local / branch / PR / merged / deployed / live. This work is draft PR #285 only, not kitchen-wired. Do not authorize merge or kitchen publish.

## Return format (required)

1. Overall: PASS | CONDITIONAL | FAIL
2. One household-outcome sentence (what Jonathan and Bianca would notice — including “nothing in the kitchen yet” if that is true).
3. Table of G-BOOKS, G-SCORE, G-A11Y, G-UX, G-SHIP with verdict + one evidence sentence each (file/symbol, not vibes).
4. Ranked findings P0 / P1 / P2. Smallest correction per finding. No patch.
5. What you could not verify (missing files, no runtime, private GitHub).
6. Next owner and the smallest next action. Do not authorize merge or deploy.

## Forbidden

- Do not implement.
- Do not invent CAD, segment widths, or screenshots.
- Do not paste or request secrets, Production data, or real household rows.
- Do not treat Cursor chat memory as proof.
- Do not merge #285 with #288.
- Do not review Ask.tsx in this chat.
- Facts and inferences must be labeled separately.
```
