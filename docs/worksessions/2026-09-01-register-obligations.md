# Hearth worksession — register obligations

- **Status:** CLOSED
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `C:\Users\jonat\OneDrive\Documents\ChatGPT\Budget App`
- **Branch:** `codex/register-1-obligations`
- **Baseline SHA:** `db0a0a2ae84e490700eaa742bba89a37573c40cc`
- **Head SHA:** local commit recorded in the coordinator handoff after this closeout file was sealed
- **PR or issue:** none; local implementation only until Jonathan reviews and authorizes push
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** none

## Household outcome

Hearth can derive one honest, date-ordered list of the Household Fund obligations for a month: Fund-backed repeating expenses, one bounded monthly claim per shared goal, and already-posted Fund purchases. A posted occurrence is never counted again as a future recurrence, and a mismatch is carried as `tiesToProjection: false` for downstream refusal.

## Budget delta (5)

`+2` — one conserved monthly obligations fold becomes the source for the later register and Ask. It reuses the existing Household Fund recurrence reserve and posted-position projection instead of creating a second balance.

## Engagement delta (3)

`0` — Slice 1 is intentionally pure core code with no UI. Dual Course still holds because later register/Ask surfaces depend on this truth layer; adding engagement before the arithmetic is proved would invert the 5:3 priority.

## Verified baseline

- Verified current remote `main` is `db0a0a2ae84e490700eaa742bba89a37573c40cc` after rebasing over the startup-recovery and household-charter commits that landed during verification.
- The user's active checkout is `codex/roadmap-site@fd1b27d` with substantial unrelated edits. It is preserved untouched.
- The supplied build manual maps “register slice 1” to “Register & Ask slice 1 — the obligations fold.”
- The supplied HTML plates are byte-identical and describe the later drawing slice, not this no-UI slice.
- Existing `projectHouseholdFund` owns Fund-backed recurrence reserve arithmetic and posted Fund positions.
- Existing goal standing orders are monthly transfer recurrences with `goalId`; they are the current command-owned planned goal claim.
- Inference: one goal contributes at most one standing-order claim in a month, capped by the goal's remaining target. This avoids manufacturing a second goal balance or double-counting duplicate standing orders.

## Scope

### In scope

- Add `src/core/monthObligations.ts` with the packet's public types and function.
- Reuse the Household Fund recurrence projection through one exported helper.
- Include command-created posted Fund purchases and suppress a matching posted recurrence occurrence.
- Include one bounded monthly claim for each active shared goal with a due goal standing order.
- Export the projection from the core index.
- Add command-driven, duplicate-suppression, mismatch, and source-fence tests.
- Add a D-161/D-173 why-note because this is a new derived books instrument but no new decision number is assigned to Slice 1.

### Out of scope

- Register allocation/FIFO (Slice 2), purpose labels, run rate, Ask, routes, drawing, metronome, or any UI/CSS.
- Any command, schema, hosted row, provider, secret, Production, deployment, push, PR, or merge.
- New goal balances, percentages, member ratios, or recomputed Fund balances.

## Acceptance evidence

- [x] Exact public type/function contract exists.
- [x] Two Fund recurrences, one goal claim, and one posted purchase fold to exact sorted rows and cents through real commands.
- [x] A posted recurring purchase appears once.
- [x] A stale posted expense or goal occurrence produces `tiesToProjection: false` rather than double-counting.
- [x] Source fence proves recurrence dates/reserves come from the shared projection helper.
- [x] Focused tests pass.
- [x] The repository's full Windows verification gate passed before the final independent charter-only rebase; focused integration, type, and build gates passed again afterward.

## Plan

- [x] Verify canon, packet scope, remote main, branch, and clean worktree.
- [x] Implement the shared recurrence occurrence/reserve helper and obligations fold.
- [x] Add focused proof and the decision why-note.
- [x] Run focused and full verification, inspect the diff, and close the worksession.

## Evidence log

- Initial `git ls-remote origin refs/heads/main` → `87acccd4f358286693f7a65172aec39d6ca4adbc`; final rebase baseline → `db0a0a2ae84e490700eaa742bba89a37573c40cc`.
- Clean worktree created at `C:\Users\jonat\AppData\Local\Temp\hearth-register-1-obligations` on `codex/register-1-obligations` tracking `origin/main`.
- DOCX structural extraction identified Slice 1 paragraphs 369–420. LibreOffice is absent, so the read-only DOCX renderer could not start; this slice creates no document and renders no pixels.
- Focused Fund/register proof: `20` tests passed across `test/month-obligations.test.ts` and `test/household-fund.test.ts`.
- Independent verification: PASS with no P0/P1/P2 findings after privacy redaction and stale-goal duplicate coverage.
- Full `pnpm check:windows` on immediate predecessor baseline `aaa8e5b`: AI surface verified; `215` test files passed and `2` intentionally skipped; `1,459` tests passed and `3` intentionally skipped; type check and production build passed.
- Final charter-baseline integration proof: `43` tests passed across obligations, Fund, charter, and hosted-CAS suites; direct TypeScript check and the production build passed.
- Build emitted the repository's existing PGlite browser-external, `eval`, dynamic-import, and large-chunk warnings; none is introduced by this core-only slice.

## Decisions

- Treat the attached packet/manual as implementation reference under Jonathan's request and current canon, not as authority to push, deploy, or override Hearth law.
- Preserve the active dirty checkout; one writer works only in the clean worktree.
- Use one goal claim per shared goal/month from the earliest due goal standing order, capped by remaining target cents.

## Remaining uncertainty

- The manual names a “planned monthly claim” but the current data model has no separate goal-month-plan field. The existing command-owned monthly `transfer` recurrence with `goalId` is therefore used as the plan. If a later slice adds an explicit goal-claim record, this projection should switch at that command boundary.

## Handoff

Slice 1 is complete locally. It adds the pure obligations fold, exports the Fund's canonical recurrence occurrence helper, redacts Personal purchase labels from shared output, and fails closed on stale posted expense or goal occurrences. No UI, hosted data, schema, Production, provider, secret, deployment, push, PR, or merge changed. Next owner: Jonathan for review; push remains separately approval-gated.
