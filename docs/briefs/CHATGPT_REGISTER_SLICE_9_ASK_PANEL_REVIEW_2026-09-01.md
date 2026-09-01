# ChatGPT independent review — Register slice 9 Ask panel

**Use this in a new ChatGPT chat. Do not continue a Cursor or implementation thread.**

## Which model

Use **GPT-5 Pro** in ChatGPT Pro, with thinking / extended reasoning **on**.

This is a High-risk Dual Course review (Fund Ask cents + work-route options on Jonathan’s desk). Instant, mini, and GPT-4o will rubber-stamp. If the picker still shows **o3-pro**, that is an acceptable substitute. Do not use GPT-5 Instant, GPT-4o, or mini.

One session is enough if it returns named gates. Do not ask the same model to then implement the fix in that chat. Do **not** merge or deploy.

## How to run it

1. New ChatGPT chat → **GPT-5 Pro**.
2. Paste the fenced prompt below.
3. Connect GitHub `jonathanbeaulne123-blip/dual-ai-budget-app` if possible, or attach at least:
   - `src/core/askView.ts`
   - `src/Ask.tsx`
   - `src/ask.css`
   - `src/OfficeWide.tsx` (Ask mount only)
   - `src/core/ask.ts`
   - `src/core/askRoutes.ts`
   - `test/ask-panel.test.ts`
   - `docs/worksessions/2026-09-01-register-9-ask-panel.md`
   - `docs/AI_HANDOFF.md` (top Register slice 9 section only)
4. Optional: draft PR https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/288
5. Do **not** paste `.env`, Worker secrets, Google tokens, workbook exports, or real household rows. Demo/synthetic Development only.

Related: [AI_HANDOFF.md](../AI_HANDOFF.md) · [worksession](../worksessions/2026-09-01-register-9-ask-panel.md) · [DECISIONS.md](../DECISIONS.md) D-161 / D-173 / D-048. Sister review: [slice 8 drawing](CHATGPT_REGISTER_SLICE_8_DRAWING_REVIEW_2026-09-01.md). Do not stack the two PRs.

## Exact git facts (packet time)

- Repo: `jonathanbeaulne123-blip/dual-ai-budget-app`
- Branch: `cursor/register-9-ask-panel-115c`
- Review SHA: `08d98f7c45498bab382ecf99196fdadf59fdab9e`
- Implemented from `origin/main@09be0dcde24356ede228d136fb8cc26498042697` (Merge #284). **Not stacked** on Register 8 (#285) or Charter Held UI.
- Current GitHub `origin/main` at packet time: `e7d98389be1a4ad831d4d83204061a68955df232` (Held UI #286 **already merged**). Fetch `origin/main` before judging rebase dirt. Do not rebase unless Jonathan asks.
- Draft PR #288 — **not merged, not kitchen-published, not live**
- Risk: **High**
- Decision owner: Jonathan

---

Paste everything inside the fence:

```text
You are an independent reviewer of Hearth, not the implementer. Return PASS, CONDITIONAL, or FAIL. Do not write a patch. Do not merge, deploy, apply schema, change secrets, or rebase.

## Product (one paragraph)

Hearth is Dual Course: family-office books weigh 5; Hercules and interactables weigh 3. When they conflict, the books win. CAD is integer cents. Books civil dates stay America/Toronto. Commands plus visible Confirm post money. Hercules never posts. The Household Fund (D-161) is a virtual shared operating subledger over Bianca’s savings; Hearth cannot move the money. Shared is one pool (D-173). The Ask says the contribution register’s unfunded tail; it does not own a second obligation formula. Ask alternatives are proposal-only; no tap moves a goal. Ask routes are optional conservative shift combinations; expected/p50 is a whisker only. A hidden UI screen is not a privacy boundary. The Ask informs the person doing the work; it must never report Jonathan’s workload to Bianca on her default surface.

## Authority (in order)

1. Jonathan’s latest explicit instruction: independent ChatGPT review of Register slice 9. He did not authorize merge or deploy.
2. AGENTS.md, docs/CLOUD_CONTINUITY.md, docs/DECISIONS.md (D-048, D-161, D-173, Bianca Month D-183 — do not mint a colliding D-number), docs/STRATEGY.md, docs/ARCHITECTURE.md.
3. Current code on branch cursor/register-9-ask-panel-115c at 08d98f7c45498bab382ecf99196fdadf59fdab9e — not docs/nostalgia/ or docs/reference/.

## Exact git facts (verify; do not assume they are still HEAD)

- Repo: jonathanbeaulne123-blip/dual-ai-budget-app (private)
- Branch: cursor/register-9-ask-panel-115c
- Review SHA: 08d98f7c45498bab382ecf99196fdadf59fdab9e
- Isolated from origin/main@09be0dcde24356ede228d136fb8cc26498042697. Ask core (householdAsk, askAlternatives, askRoutes) is already on that main.
- Register slice 8 drawing is a separate draft PR #285. Do not treat Register.tsx as in this diff.
- Charter Held UI PR #286 is already merged to main as e7d98389be1a4ad831d4d83204061a68955df232. This Ask branch may now be dirty vs latest main on docs only. Do not rebase. Do not merge #288 onto stale or current main.
- Draft PR #288 — not merged, not deployed, not the live kitchen
- Dual Course claimed: Budget +3, Engagement +2

## Claimed household outcome (verify; do not assume)

Jonathan can read this month’s Fund Ask on his wide Shared Home desk: the exact unfunded figure, optional conservative work routes at one scale, and the other door in the open. Bianca’s default surface never receives this panel. Covered $0.00 is pine and hides routes and the door. Thin shift history still shows the amount with the existing refusal copy. Raise it does not post money or defer a goal.

## What Cursor already claims as proven (treat as claims)

- Focused test/ask-panel.test.ts: 8 passed, including watching caveat off the sentence, covered hides routes/door, Halifax door copy, Raise-it non-mutation, OfficePhone/custodian source fences, tabIndex={0} on the routes scroller.
- Neighbour Ask suites on that checkout: ask.test.ts 9 + ask-alternatives 6 + ask-routes 7 = 22 passed.
- pnpm exec tsc --noEmit passed.
- pnpm test:fast: 1,464 passed / 2 skipped (pre-a11y head; focused 8/8 re-ran after tabIndex and caveat follow-ups).
- Bianca Month test/app-startup-p1.test.ts + test/month-rehearsal-mainline.test.ts: 10 passed.
- Independent Cursor books audit: PASS. UX: PASS WITH NOTES then tabIndex fix. Privacy: PASS WITH NOTES (no painted partner-personal leak; in-memory AskPanelView still holds monthAsk.register).
- Visual component harness at 320 / 390 / 720 / ~1100, Raise-it focus, routes focus, night, reduced-motion. Fictional Development copy. Not a kitchen walkthrough.
- Full pnpm check not rerun. Serial demo-suite.test.ts has an unrelated known fail on other branches.

## Open findings Cursor did not close (verify; do not rubber-stamp)

Label each as still true, false at this SHA, or unproven.

1. Kitchen Raise it is a visible no-op: OfficeWide does not pass onRaise. There is no defer-goal command. Decide if a dead control is honest or a P1.
2. Placement is “not the Fund custodian on Shared Home stage”, not a Jonathan hardcode and not Till slice 4 landingSurface (unimplemented). A later non-custodian would also see Ask, with their routes.
3. paydayLine only appears when householdAsk(..., "payday") actually takes the payday horizon. Panel tests do not assert a payday line.
4. Provisional run-rate has no extra Ask caveat in core; the panel only surfaces the watching line. Packet wanted ≠ settled.
5. OfficeWide gate is source-string tested, not jsdom-mounted as Bianca vs Jonathan.
6. Routes drawing at 320 depends on overflow-x auto + keyboard scroller; harness showed labels more than bars at 320. Mark visual-at-phone unproven if you cannot see screenshots.
7. Landing #288 and #285 both edit docs/DECISIONS.md and docs/AI_HANDOFF.md. They must not be stacked as code; docs will conflict on merge.
8. origin/main has moved to Held UI #286. This branch was cut from 09be0dc. Rebase dirt is likely docs-only; confirm. Do not rebase.

## Named gates — return PASS / CONDITIONAL / FAIL each

G-BOOKS. No second allocator. Figure is formatCad(monthAsk.askCents) from householdAsk. Alternatives from askAlternatives only. Routes from askRoutes; bars = safe/p10; whiskers = expected/p50; ask mark shares routeScale. Raise it does not call postEntry, Fund commands, or goal writes. Covered hides routes and door. not-enough-data still shows the amount.

G-PLACEMENT. Ask mounts only in OfficeWide when view === "household", spread is the stage, and memberId !== householdFund.custodianMemberId. OfficePhone must not import Ask or askRoutes. Till does not exist on this SHA and must not be invented.

G-COPY. No you should / you need to / pick up a shift / required / target / goal met / percent score / progress ring / streak / celebration. Shortfall copper, never danger. Header exact: "bars are your safe number · whiskers reach the good night". Other door copy from askAlternatives. Refusal copy from askRoutes.

G-UX. Order: figure, sentence, payday, routes or refusal, other door (not a toggle), watching caveat. Routes drawing named for AT (role=img + aria-label). Raise it is a real button with visible focus. 320 / 390 / 720 / ~1100 called out if you can see screenshots; otherwise mark visual unproven. Add/Confirm remain unobstructed.

G-SHIP. Distinguish local / branch / PR / merged / deployed / live. This work is draft PR #288 only. Do not authorize merge or kitchen publish.

## Return format (required)

1. Overall: PASS | CONDITIONAL | FAIL
2. One household-outcome sentence (what Jonathan and Bianca would notice).
3. Table of G-BOOKS, G-PLACEMENT, G-COPY, G-UX, G-SHIP with verdict + one evidence sentence each (file/symbol, not vibes).
4. Ranked findings P0 / P1 / P2. Smallest correction per finding. No patch.
5. What you could not verify (missing files, no runtime, private GitHub).
6. Next owner and the smallest next action. Do not authorize merge or deploy.

## Forbidden

- Do not implement.
- Do not invent CAD, routes, or screenshots.
- Do not paste or request secrets, Production data, or real household rows.
- Do not treat Cursor chat memory as proof.
- Do not merge #288 with #285.
- Do not review or re-merge Held UI #286 in this chat.
- Facts and inferences must be labeled separately.
```
