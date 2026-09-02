# ChatGPT independent review and merge — Register slice 10 metronome

**Use this in a new ChatGPT chat. Do not continue a Cursor or implementation thread.**

Jonathan (2026-09-02) asked Cursor to implement Register slice 10 and to **provide a review and merge handoff** for GPT. Review first. Merge only after PASS or CONDITIONAL with docs-only nits. Kitchen publish from `main` (D-041) is a consequence of merge. Do not apply schema, change secrets, use Production, or mutate household data.

## Which model

Use **GPT-5 Pro** in ChatGPT Pro, with thinking / extended reasoning **on**. Instant, mini, and GPT-4o will rubber-stamp. If the picker still shows **o3-pro**, that is an acceptable substitute.

One session: review first, merge only after named gates pass. Do not implement a rewrite in that chat.

## How to run it

1. New ChatGPT chat → **GPT-5 Pro**.
2. Paste the fenced prompt below.
3. Connect GitHub `jonathanbeaulne123-blip/dual-ai-budget-app` if possible, or attach at least:
   - `src/core/monthSpread.ts`
   - `src/MonthSpread.tsx`
   - `src/month-spread.css`
   - `src/OfficeWide.tsx` (MonthSpread mount only)
   - `src/core/ask.ts` (`nextPaydayDate` only)
   - `src/core/workSettlement.ts` (`nextWorkScheduleDate` only)
   - `test/month-spread.test.ts`
   - `docs/worksessions/2026-09-02-register-10-metronome.md`
   - `docs/AI_HANDOFF.md` (top Register slice 10 section only)
4. Optional: draft PR https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/294
5. Do **not** paste `.env`, Worker secrets, Google tokens, workbook exports, or real household rows.

Sister drafts that must **not** be merged in this chat: Register slice 8 drawing [#285](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/285).

---

Paste everything inside the fence:

```text
You are an independent reviewer of Hearth and, if the review passes, the merger of one draft PR. Return PASS, CONDITIONAL, or FAIL before any git write. Do not write a product patch. Do not apply hosted schema, change secrets, use Production, or mutate household rows. Do not rebase unless merge is blocked only by a trivial docs conflict you can resolve without changing Course scale.

## Product (one paragraph)

Hearth is Dual Course: family-office books weigh 5; Hercules and interactables weigh 3. When they conflict, the books win. CAD is integer cents. Books civil dates stay America/Toronto. Commands plus visible Confirm post money. Hercules never posts. The Household Fund (D-161) is a virtual shared operating subledger over Bianca’s savings; Hearth cannot move the money. Shared is one pool (D-173). The Month Spread Course draws operating above a baseline and Kitty below it at ONE scale; that conservation picture is law. Payday ticks mark TIMING only. Bianca's contribution amount varies; the drawing must not imply a constant paycheck. Contribution marks keep their existing treatment. The contrast — regular tick versus irregular mark — is the information. A hidden UI screen is not a privacy boundary. main publishes the kitchen via wrangler deploy (D-041). A Cloudflare Workers preview of a branch is not the kitchen URL and is not live.

## Authority (in order)

1. Jonathan’s latest explicit instruction: implement Register slice 10 and provide a GPT review-and-merge handoff. He authorized GPT to merge this slice if named gates pass. He did not authorize Production, schema, or a second deploy.
2. AGENTS.md, docs/CLOUD_CONTINUITY.md, docs/DECISIONS.md (D-048, D-041, D-161, D-173), docs/STRATEGY.md, docs/ARCHITECTURE.md.
3. Current code on branch cursor/register-10-metronome-115c at the review SHA below — not docs/nostalgia/ or docs/reference/.

## Exact git facts (verify; do not assume they are still HEAD)

- Repo: jonathanbeaulne123-blip/dual-ai-budget-app (private)
- Branch: cursor/register-10-metronome-115c
- Review SHA: confirm `git rev-parse HEAD` on `cursor/register-10-metronome-115c` after fetching (first product commit was `d00b9dace28fae58d4b71f6986cdd8e79bb38e20`; Chip-above-axis label is a follow-up on the same branch)
- Baseline: origin/main@7101dced3d592f9c70d445ec4b901cc3ff8946b3 (Merge #292)
- Fetch origin/main before merge. Do not merge onto a stale main if main has moved; rebase only if the conflict is docs and Course geometry is untouched.
- Draft PR https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/294 — not kitchen-live until merged
- Dual Course claimed: Budget +3, Engagement +2
- Do not merge draft #285 (register drawing) in this chat. Do not stack this PR on #285.

## Claimed household outcome (verify; do not assume)

On Shared Home's Month Spread Course, the Fund custodian's projected paydays appear as short felt ticks below the axis. Only the first is labelled "payday". Ticks carry no amount, height, or value. Confirmed contribution event marks keep their existing dots. courseScale, courseTop, and courseBottom are unchanged. OfficePhone does not mount MonthSpread.

## What Cursor already claims as proven (treat as claims)

- Focused test/month-spread.test.ts: 39 passed, including cadence-date landing, inactive/non-custodian exclusion, no-amount fence, exact courseScale/courseTop/courseBottom source, and axis drawing fences.
- Existing conservation, posted-vs-future, and Standing-bar cases were not rewritten.
- pnpm test:fast: 1,511 passed / 2 skipped. tsc --noEmit passed. Bianca Month 10 passed. pnpm ai:verify passed.
- GitHub pnpm check succeeded on first head d00b9dac (CI 33595112394) before the Chip-above-axis follow-up; re-check HEAD.
- Independent Cursor books: PASS WITH NOTES. Privacy: PASS WITH NOTES. UX: PASS WITH NOTES then Chip above the axis. Verifier: PASS WITH NOTES.
- Component harness screenshots at 320 / 390 / 720 / ~1100, empty staff, night, reduced-motion. Fictional Development. Not kitchen.

## Open findings Cursor did not close (verify; do not rubber-stamp)

Label each as still true, false at this SHA, or unproven.

1. Demo kitchen Bianca and Jonathan share the same biweekly Demo Bistro job, so ticks and contribution marks can land on related days in the seed. Distinct-cadence proof is in tests.
2. OfficeWide household={booksHousehold} was a justified expansion (packet listed four files). Confirm no other host gained ticks.
3. Visual 320 / 390 / 720 / ~1100 exist as a fictional component harness at this packet; mark kitchen-unproven.
4. Ticks appear on the empty staff as well as the drawn Course. Decide if that is honest timing or clutter.
5. Do not merge #285 with this PR.

## Named gates — return PASS / CONDITIONAL / FAIL each

G-BOOKS. paydayTicks uses nextWorkScheduleDate on active custodian paySchedule jobs only. PaydayTick has date only. No assumed CAD. courseScale, courseTop, courseBottom source and conservation tests unchanged. No command, postEntry, Fund writer, or PGlite change.

G-DRAWING. Ticks are a short vertical 3px felt rule below the axis. First labelled exactly "payday". Contribution marks (ms-dot) unchanged. One shared Course scale.

G-COPY. No you should / pick up / paycheck amount on a tick. Aria says timing only, no amount.

G-SHIP. Distinguish local / branch / PR / merged / deployed / live. Merge to main queues D-041 kitchen publish. A preview URL is not live. Do not touch Production.

## Return format (required)

1. Overall: PASS | CONDITIONAL | FAIL
2. One household-outcome sentence.
3. Table of G-BOOKS, G-DRAWING, G-COPY, G-SHIP with verdict + one evidence sentence each.
4. Ranked findings P0 / P1 / P2. Smallest correction per finding. No product patch unless you are merging a docs-only nit you already made.
5. What you could not verify.
6. Merge decision: MERGE | DO NOT MERGE. If MERGE, fetch origin/main, confirm the PR is this branch only, merge it, record the merge SHA, and say that D-041 kitchen publish is queued — then stop. Do not deploy a second time. Do not merge #285. Do not use Production.

## Forbidden

- Do not implement a rewrite.
- Do not invent CAD or screenshots.
- Do not paste or request secrets, Production data, or real household rows.
- Do not treat Cursor chat memory as proof.
- Do not merge #285.
- Facts and inferences must be labeled separately.
```
