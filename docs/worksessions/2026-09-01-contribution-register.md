# Hearth worksession — contribution register

- **Status:** CLOSED
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `C:\Users\jonat\OneDrive\Documents\ChatGPT\Budget App`
- **Branch:** `codex/register-2-fold`
- **Baseline SHA:** `6dc629f2373f0c8807de067e1d33be48c4a4216a`
- **Head SHA:** local commit recorded in the coordinator handoff after this closeout file was sealed
- **PR or issue:** none; rebased locally onto merged Slice 1 `main@01e962d`; Slice 2 is not pushed
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** none

## Household outcome

Hearth can explain which carried Fund cents and which confirmed household contribution paid each monthly obligation, oldest money first, without ratios or hidden proposals.

## Budget delta (5)

`+3` — a cents-exact FIFO register makes the Household Fund explainable while preserving confirmed contribution provenance, honest shortfalls, and surplus money.

## Engagement delta (3)

`0` — this slice is a pure books projection. No new surface or interaction is added.

## Verified baseline

- Slice 1 exact head `6dc629f2373f0c8807de067e1d33be48c4a4216a` passed independent release review and the exact-head Windows full gate.
- Slice 1 PR #270 is open. Its Cloudflare check passed and CI is still running at worksession open.
- The user checkout remains untouched; this clean worktree is on `codex/register-2-fold` at the reviewed Slice 1 commit.
- Current Fund operating balance is confirmed contributions minus settlements and Kitty allocations plus Kitty releases.
- Inference required by the manual's simultaneous surplus and conservation cases: source amounts remain full and truthful; row conservation always holds, while `source total + unfunded = owed` applies only when no source remains undrawn.

## Scope

### In scope

- Add the pure contribution register contract and FIFO allocator.
- Consume Slice 1 `monthObligations` rows and tie state.
- Add a canonical Fund operating-balance-before-date helper for carried cents.
- Include only active confirmed contributions, sorted by date, creation time, then id.
- Sum full confirmed contribution amounts by member without ratios, shares, or rankings.
- Fail closed with no allocation when the obligations fold does not tie.
- Add canonical, shortage, surplus, reversal/proposal, ordering, mismatch, and source-fence tests.
- Export the register and add a D-161/D-173 why-note without reusing the manual's conflicting D-176 number.

### Out of scope

- Purpose/run-rate/Ask/routes/drawing/metronome slices or UI/CSS.
- Commands, writes, schema, hosted rows, Auth/RLS, provider calls, secrets, Production, deployment, or household-data mutation.
- Ratios, percentages, fairness scoring, rankings, or access to Personal Fund backing/reconciliation state.

## Acceptance evidence

- [x] Canonical September scenario returns carried `24000`, Bianca `196000`, Jonathan `53500`, owed `307500`, and unfunded `34000` cents.
- [x] Every row conserves exactly and no source is overdrawn.
- [x] Proposals and reversed confirmations are invisible.
- [x] Same-day contributions sort by `createdAt`, then id.
- [x] Surplus sources stay full and the register still ties.
- [x] A Slice 1 mismatch produces no invented funding and `tiesToProjection: false`.
- [x] No ratio/share/percentage or private reconciliation source enters the implementation.
- [x] Focused and full Windows verification pass.

## Plan

- [x] Verify exact baseline, release evidence, and deployment boundary.
- [x] Inspect canonical obligations and Fund event arithmetic.
- [x] Implement carried balance helper and FIFO register.
- [x] Add focused proof and decision why-note.
- [x] Run verification, independent review, commit locally, and close the worksession.

## Evidence log

- Exact baseline status: clean `codex/register-2-fold@6dc629f2373f0c8807de067e1d33be48c4a4216a`.
- Slice 1 PR #270 checks closed green: CI `33470566351` and Cloudflare Workers `33470566375` both passed.
- Focused Slice 1 + Slice 2 Fund gate: `29/29` tests passed across contribution register, monthly obligations, and Household Fund.
- Exact uncommitted Slice 2 `pnpm check:windows`: AI surface passed; `217` test files passed and `2` skipped; `1,478` tests passed and `3` skipped; TypeScript, 387-module production build, Hercules Pro UI build, and no-redirect guard passed.
- Existing PGlite browser-external, `eval`, dynamic-import, chunk-size, and React test `act(...)` warnings remained non-failing.
- Independent books audit and independent verifier both returned PASS with no P0/P1/P2 findings after the lexical-id proof and malformed-contributor guard were repaired.
- `git diff --check` passed. Tracked private-artifact/secret inspection found no new credential, workbook, archive, or key material.
- After Slice 1 merged, Slice 2 rebased cleanly onto exact `main@01e962d24038d3047c361df12d24b30a879f13fb`; the exact rebased tree passed the 29-test focused gate, TypeScript, and diff check.

## Decisions

- Preserve full confirmed source amounts in surplus cases. Track undrawn cents internally for conservation; do not add an unrequested public field.
- Treat carried money as the active Fund operating balance strictly before the month start, so a contribution dated on day one remains a contribution source.
- A stale Slice 1 fold may disclose its obligation rows but receives no funding segments; every row remains fully unfunded and the register refuses to tie.

## Remaining uncertainty

- The manual's aggregate equality omits undrawn source cents while separately requiring a surplus test. The implementation preserves both truths through row/source conservation and an internal undrawn check; the manual equality is also asserted exactly in its canonical no-surplus case. Independent books review classifies this as a source-document ambiguity, not an implementation defect.

## Handoff

Slice 2 is complete in the clean local worktree and committed on the merged Slice 1 mainline. It adds the pure FIFO register, a shared carried-balance helper, exact canonical and adversarial proof, and a D-161/D-173 why-note. No Slice 2 push, PR, merge, deploy, hosted change, schema change, provider call, or Production mutation occurred. Next owner: Jonathan for review and separate Slice 2 push authorization.
