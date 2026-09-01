# Hearth worksession — Clerk Slice 2 tappable citations

- **Status:** OPEN
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `cursor/clerk-2-citations-fdc8`
- **Baseline SHA:** `6f1cb43f793312953fb733d795a0d0439d539f35` (Clerk Slice 1)
- **Head SHA:** pending implementation
- **PR or issue:** pending draft PR
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

- Slice 1 commit `6f1cb43f793312953fb733d795a0d0439d539f35` parents current `origin/main@ff9d8d8de70c80fd567ba9835b3cc2ffbcd45082`.
- `git merge-base --is-ancestor 6f1cb43f793312953fb733d795a0d0439d539f35 HEAD` succeeds on this branch.
- `ClerkReading` / `ClerkSentence` and `test/clerk-reading.test.ts` canonical-month fixture exist.
- Slice 1 is not merged to `origin/main` and has no named remote branch; this branch starts from the fetchable SHA.

Inferences to prove:

- A leaf read-only component can resolve cited IDs from a caller-supplied already-scoped household without becoming a visibility projector, money writer, or modal.

## Scope

### In scope

- `src/ClerkReading.tsx`
- `src/clerk-reading.css`
- `test/clerk-citations.test.ts`
- this worksession, `docs/AI_HANDOFF.md` return, and a draft PR

### Out of scope

- `src/App.tsx` placement or any new Home/Books/Hercules route
- Clerk Slice 3 fences and Slice 4 weekly
- commands, Confirm, ledger/Fund mutation, schema, Auth/RLS, hosted I/O, secrets, Production, deployment, real household data
- merging Slice 1 to `main`

## Acceptance evidence

- [ ] Each rendered sentence is reachable in DOM order by Tab
- [ ] Enter and Space activate the same inline disclosure as pointer
- [ ] Control exposes expanded state and controls an associated inline region
- [ ] Disclosed transaction and Fund-event IDs match the sentence, in order, with no extras
- [ ] Empty-citation sentences are omitted
- [ ] Missing citation fails closed without widening scope
- [ ] Untied and tied-empty states
- [ ] No modal at 320/390
- [ ] Visual evidence at 320, 390, 720, ~1100
- [ ] Existing `test/clerk-reading.test.ts` remains green
- [ ] Zero command/network/storage/model imports in the new component

## Plan

- [ ] Implement the read-only citation component and CSS
- [ ] Add command-driven plus source-fence tests around the Slice 1 canonical month
- [ ] Run focused then full local proof
- [ ] Capture rendered evidence
- [ ] Independent UX/verifier review
- [ ] Draft PR; do not merge or deploy

## Evidence log

- 2026-09-01: Branched `cursor/clerk-2-citations-fdc8` from Slice 1 `6f1cb43f793312953fb733d795a0d0439d539f35`. Ancestor check passed.

## Decisions

Cloud Agent git policy requires `cursor/<name>-fdc8`. The packet named `clerk/2-citations`. Jonathan authorized Slice 2 on this Cloud Agent after that default was stated.

## Remaining uncertainty

Slice 1 is still a dangling commit, not on `origin/main`. This PR stacks on that SHA.

## Handoff

Implementation in progress. Next owner after proof: Jonathan for review. Not merged, not deployed, not live.
