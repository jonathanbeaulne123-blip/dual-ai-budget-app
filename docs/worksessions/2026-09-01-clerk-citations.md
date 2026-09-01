# Hearth worksession — Clerk Slice 2 tappable citations

- **Status:** CLOSED — INDEPENDENT FINDINGS FIXED; COMBINED RELEASE CANDIDATE VERIFIED
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor (implementation); Codex (independent review, repair, and release integration)
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/clerk-2-3-release`
- **Baseline SHA:** `origin/main@e7d98389be1a4ad831d4d83204061a68955df232`
- **Head SHA:** `008310113e392827718e9013f92d3c4c499b5e15` (corrected Slice 2 + Slice 3 integrated with current main; this evidence record follows)
- **PR or issue:** source [#287](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/287); combined release PR follows
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

- Slice 1 `6f1cb43` is an ancestor of current `origin/main@e7d9838`.
- Cursor's exact review head `fdb9190` is integrated without changes to `App.tsx`, commands, storage, Worker, or schema.
- Independent review found two P2 defects: unresolved citations left unsupported sentence text visible, and same-day duplicate rows could have indistinguishable accessible names.
- Commit `4624c31` withholds any sentence whose cited IDs do not all resolve in the supplied scoped household and names each optional record link with label, Toronto civil date, exact CAD amount, and stable row ID.

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
- [x] A sentence with any missing citation is withheld; one calm integrity line remains without widening scope
- [x] Same-day duplicate transaction and Fund record links have unique exact-row accessible names
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
- [x] Ready PR; do not merge or deploy
- [x] GPT-5 Pro independent review packet (`docs/briefs/CHATGPT_CLERK_SLICE_2_REVIEW_2026-09-01.md`)
- [x] Repair both independent P2 findings and add command-created regression fixtures
- [x] Integrate Slice 3 source/output fences and rerun the combined proof

## Evidence log

- 2026-09-01: Branched from Slice 1 `6f1cb43`. Ancestor check passed.
- 2026-09-01: Focused Clerk tests **12/12**. `pnpm ai:verify` green. `tsc --noEmit` green. Vite production build and Hercules Pro UI green. `git diff --check` green.
- 2026-09-01: `pnpm check` books lane failed `test/demo-suite.test.ts` upcoming envelope. Packet named this pre-existing fixture issue; not repaired here.
- 2026-09-01: Push CI `33547763251` failed that same Demo Suite assertion; pull_request CI `33547768030` on SHA `0dd64ca` reported SUCCESS. GPT-5 Pro review packet written.
- 2026-09-01: UX audit PASS WITH NOTES; removed `onKeyDown` toggle; unique `open … {date}` names; region `aria-labelledby`.
- 2026-09-01: Preview screenshots at 320/390/720/1100 plus 390px interaction video. Local preview files deleted and not committed.
- 2026-09-01: Independent review returned FAIL on `fdb9190`: unsupported sentence text remained visible when the scoped household could not resolve a citation, and same-label/date rows could share one accessible name.
- 2026-09-01: `4624c31` repaired both findings. Command-created same-day duplicate transaction and Fund rows now prove four unique names; unresolved sentence text is absent while the integrity line remains.
- 2026-09-01: Corrected combined Slice 1–3 proof passed 3 files / 18 tests, `pnpm ai:verify` passed with 2 Clerk source fences, and TypeScript passed.
- 2026-09-01: Fresh rendered proof at 320/390/720/1100 showed zero horizontal overflow, all visible controls at least 44px, four unique record names, absent unsupported copy, and honest ready/integrity/withheld/empty states. The ignored preview harness was removed.
- 2026-09-01: Full test lanes reached 215 passed / 1 skipped fast files (1,469 passed / 2 skipped tests) and 18 passed / 1 skipped serial files (145 passed / 1 skipped tests). Serial books, including the dated Demo Suite assertion, passed. The only failure was the known Windows host constraint `spawnSync bash ENOENT` in `test/api.test.ts`.

## Decisions

Cloud Agent git policy used `cursor/clerk-2-citations-fdc8` instead of the packet's `clerk/2-citations`. Jonathan authorized Slice 2 on this Cloud Agent after that default was stated. No new D-number: Slice 1 already recorded D-194.

## Remaining uncertainty

The literal Windows `pnpm check` remains non-green only because this bundled host has no `bash`; direct TypeScript/build proof and GitHub CI remain required release gates. The component is intentionally unwired from `App.tsx`, so publication lands the reviewed leaf and fences but does not make a visible kitchen surface.

## Handoff

Jonathan explicitly authorized repair, push, merge, and Development kitchen deployment of corrected Slices 2 and 3. Next owner: Codex re-fetches `origin/main`, pins the combined PR head, confirms GitHub CI, merges, then verifies the main deployment and live kitchen separately. No schema, secret, hosted-row, Production-continuity, or household-data action is authorized.
