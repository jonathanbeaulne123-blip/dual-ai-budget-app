# Hearth worksession — Onboarding Slice 25: Ready and unlock

- **Status:** CLOSED; LOCAL HIGH-GATE + BUILD + UX VERIFIED
- **Opened:** 2026-09-05 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `onboarding/25-ch12-ready`
- **Baseline SHA:** `146dc1a7160d163ea911321aa2034cf4324c44d8`
- **Implementation SHA:** `c1664bf5f59089b4ff26cc96f257b60cfb76d743`
- **PR or issue:** none
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** none; local synthetic Development fixtures only

## Household outcome

Chapter 12 proves that tomorrow's ordinary books workflow is safe and understandable, then lets each member personally declare the same exact household setup Ready. The household unlocks only after every required gate and both current Ready approvals, and an interrupted accepted unlock converges forward instead of leaving a completed household locked.

## Budget delta (5)

`+4`: Ready is tied to typed books evidence, Practice remains outside accepted money, and unlock cannot bypass an outstanding household gate or diverge after acceptance.

## Engagement delta (3)

`+3`: Hercules closes the shared track with a calm, privacy-safe proof or isolated Practice path, a visible two-person Ready moment, an honest summary, and a clear invitation into optional personal setup.

## Verified baseline

- `origin/main` is `146dc1a7160d163ea911321aa2034cf4324c44d8`, the merge commit for onboarding Slice 24.
- The branch was created directly from that SHA and was clean at creation.
- D-128 requires visible isolation between real accepted books and temporary Practice; copied Practice becomes only a real draft and still requires review and Confirm.
- `monthRehearsalPractice.ts` already provides isolated discarded correction proof and must be reused.
- The canonical Slice 25 contract requires eligible accepted-transaction evidence or isolated Practice, the `householdGatesOutstanding()` checklist, two self-owned Ready approvals against one completion digest, all-gates unlock, interrupted-unlock convergence, honest post-unlock copy, and a personal-track offer.

## Scope

### In scope

- Reuse and strengthen the existing Practice isolation projection for the Chapter 12 teaching path.
- Deterministic completion digest, member-owned Ready approvals, outstanding-gate projection, and recovery-safe household unlock.
- Chapter 12 Hercules/Books/Health presentation and focused onboarding tests.
- Required Shared sync/materialization wiring for convergence.
- Living decision, handoff, roadmap, contract, and worksession documentation.

### Out of scope

- Any second money writer, automatic posting, direct Practice promotion, journal mutation, schema, hosted data, Auth/RLS, provider/model call, secrets, Production setting, push, merge, or deployment.
- Personal-track module implementation (Slice 26); this slice may only offer entry to it after unlock.
- Full/exhaustive verification without Jonathan's exact-SHA authorization.

## Acceptance evidence

- [x] A qualifying accepted real transaction is privacy-safe and can satisfy the teaching proof without disclosing partner-personal facts.
- [x] Otherwise, a Practice input and correction remain absent from journals, PGlite accepted books, continuity snapshots, reports, streaks, Health, and accepted-money progress; copying creates only a reviewable draft.
- [x] One current Ready approval reads as waiting for the other member; neither member can approve for the other.
- [x] Ready approvals bind the same deterministic completion digest and stale approvals cannot authorize unlock.
- [x] Any outstanding non-skippable household gate blocks unlock and is presented as a checklist.
- [x] Accepted unlock completion converges to unlocked on launch/replay repair.
- [x] Post-unlock copy truthfully names what was established, says routine ledger inputs remain, and offers the optional personal track.
- [x] Focused, adjacent, quick-gate, build, and browser/accessibility evidence are current for this working change.

## Plan

- [x] Trace current Practice, onboarding gate, approval, command identity, Shared sync, lock, Books, and Health contracts.
- [x] Write the exact Slice 25 implementation contract and focused failing tests.
- [x] Implement the smallest coherent kernel and UI change with one existing financial writer boundary.
- [x] Run focused and adjacent tests plus the High-risk quick gate.
- [x] Verify 320, 390, 720, and about 1100 px; keyboard, focus, reduced motion, loading, empty, error, and offline behavior.
- [x] Review the complete diff for books, privacy, trust, sensitive artifacts, and unsupported claims.
- [x] Close the living handoff without pushing, merging, deploying, or touching hosted data.

## Evidence log

- 2026-09-05: created clean worktree from `origin/main@146dc1a7160d163ea911321aa2034cf4324c44d8`.
- 2026-09-05: focused Slice 25 kernel/UI/copy proof passed 30/30; the complete onboarding suite passed 438/438.
- 2026-09-05: the final High quick gate passed in under 40 seconds: TypeScript, AI-surface and diff fences, 120 fast tests, and 7 serial PGlite proof tests.
- 2026-09-05: the production build passed with 477 Vite modules plus the Hercules Pro UI build. Existing PGlite browser externalization, eval, and large-chunk warnings remain warnings, not Slice 25 failures.
- 2026-09-05: actual-component Chromium passed at 320, 390, 720, and 1100 px with no overflow, sub-44 px controls, console/page errors, or scoped WCAG A/AA axe findings. Keyboard activation and visible focus, reduced motion, busy, Practice-empty, waiting, completion, failure, and explicit offline behavior passed. Mobile and desktop screenshots were visually inspected.
- 2026-09-05: complete diff and sensitive-artifact review found no financial writer, Personal evidence disclosure, schema/provider/hosted/Production action, credential, or unsupported completion claim.

## Decisions

- Treat the manual's time budget as guidance per Jonathan's standing instruction; completeness and user friendliness take priority.
- Reuse D-128 Practice isolation and the existing onboarding approval/event machinery rather than inventing another ledger or acceptance boundary.

## Remaining uncertainty

- The manual omitted an explicit Create/Modify list. The dated contract records the narrow implementation scope required by the current command, continuity, routing, and Books/Health contracts.
- Browser and two-device proofs use synthetic local Development state. No hosted two-account witness, Windows result, exhaustive suite, deployment, or Production claim is made.

## Handoff

Slice 25 is a verified local release candidate. No PR, push, merge, deployment, hosted mutation, or Production claim. Jonathan separately decides release; deployment remains a separate instruction.
