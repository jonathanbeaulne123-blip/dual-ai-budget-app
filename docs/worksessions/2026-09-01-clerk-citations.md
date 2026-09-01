# Hearth worksession — Clerk Slice 2 tappable citations

- **Status:** OPEN FOR REVIEW — local proof recorded; draft PR; not merged
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `cursor/clerk-2-citations-fdc8`
- **Baseline SHA:** `6f1cb43f793312953fb733d795a0d0439d539f35` (Clerk Slice 1, now on `origin/main`)
- **Head SHA:** `95456ee59fad738a6a737305e535402c90486978` (this record follows as the next commit) 
- **PR or issue:** draft [#287](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/287)
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** none

## Household outcome

Jonathan or Bianca can focus or tap any Clerk sentence and reveal, directly beneath it, the exact accepted transaction and Household Fund event rows that support that sentence. The explanation stays calm, compact, keyboard- and screen-reader-complete, and never hides the record behind a modal.

## Budget delta (5)

`+1` — every displayed claim becomes inspectable against its exact accepted source rows. No posting, allocation, projection, or financial meaning changes.

## Engagement delta (3)

`+2` — a short reading becomes trustworthy to explore without turning into advice.

## Verified baseline

Facts:

- Packet base `6f1cb43` is now an ancestor of `origin/main@8fb0a5f` (Slice 1 docs + reading).
- This branch adds only the Slice 2 UI files plus this worksession and the handoff.
- `ClerkReading` / `ClerkSentence` and the canonical-month fixture in `test/clerk-reading.test.ts` exist.

## Scope

### In scope

- `src/ClerkReading.tsx`, `src/clerk-reading.css`, `test/clerk-citations.test.ts`
- worksession + `docs/AI_HANDOFF.md` return
- draft PR

### Out of scope

- `src/App.tsx` placement
- Clerk slices 3–4
- repairing `test/demo-suite.test.ts` upcoming-envelope (named pre-existing; packet forbids)

## Acceptance evidence

- [x] Each rendered sentence is a native `type="button"` in DOM order
- [x] Pointer, Enter, and Space activate through the native button click path
- [x] `aria-expanded` + `aria-controls`; region `aria-labelledby` the sentence
- [x] Disclosed transaction and Fund-event IDs match the sentence, in order
- [x] Empty-citation sentences omitted
- [x] Missing citation fails closed without widening scope
- [x] Untied and tied-empty states
- [x] No modal in jsdom or 390px preview
- [x] Visual evidence at 320, 390, 720, ~1100
- [x] Existing `test/clerk-reading.test.ts` remains green (4/4)
- [x] Zero command/network/storage/model imports in the component

## Plan

- [x] Implement the read-only citation component and CSS
- [x] Add command-driven plus source-fence tests around the Slice 1 canonical month
- [x] Run focused proof; record the known books-lane Demo Suite failure
- [x] Capture rendered evidence
- [x] Independent UX review and verifier notes
- [x] Draft PR; do not merge or deploy

## Evidence log

- 2026-09-01: Branched from Slice 1 `6f1cb43`. Ancestor check passed.
- 2026-09-01: Focused Clerk tests **12/12**. `pnpm ai:verify` green. `tsc --noEmit` green. Vite production build and Hercules Pro UI green. `git diff --check` green.
- 2026-09-01: `pnpm check` books lane failed `test/demo-suite.test.ts` upcoming envelope. Packet named this pre-existing fixture issue; not repaired here.
- 2026-09-01: UX audit PASS WITH NOTES; removed `onKeyDown` toggle; unique `open … {date}` names; region `aria-labelledby`.
- 2026-09-01: Preview screenshots at 320/390/720/1100 plus 390px interaction video. Local preview files deleted and not committed.

## Decisions

Cloud Agent git policy used `cursor/clerk-2-citations-fdc8` instead of the packet's `clerk/2-citations`. Jonathan authorized Slice 2 on this Cloud Agent after that default was stated. No new D-number: Slice 1 already recorded D-194.

## Remaining uncertainty

`pnpm check` is not fully green because of the named Demo Suite fixture. Fast lane and Clerk tests are green. Component is unwired from `App.tsx` by packet scope, so kitchen placement is a later decision.

## Handoff

Draft PR #287. Not merged, not deployed, not live. Next owner: Jonathan.
