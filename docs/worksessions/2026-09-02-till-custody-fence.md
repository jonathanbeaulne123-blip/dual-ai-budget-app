# Hearth worksession — Till Slice 1 custody fence

- **Status:** CLOSED — local implementation and handoff complete; push gate remains external
- **Opened:** 2026-09-02 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/till-1-custody-fence-v2`
- **Baseline SHA:** `7101dced3d592f9c70d445ec4b901cc3ff8946b3`
- **Head SHA:** implementation seal `7a023c75174f9f327266e18b76ec18934125e6f8`; documentation handoff follows locally
- **PR or issue:** none; no push authorized
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** none (local code and fictional tests only)

## Household outcome

Only the configured Household Fund custodian can record a new purchase against the shared card. Everyone keeps their existing non-purchase rights, including contribution proposals and shift posting.

## Budget delta (5)

`+5` — a command-layer custody fence prevents an unauthorized shared-card purchase fact before any transaction, Fund event, or accepted-books write can be created.

## Engagement delta (3)

`0` — this slice deliberately adds no Till UI. It is the books-first prerequisite for the later two-tap swipe and Till surface.

## Verified baseline

- Exact remote `origin/main` and local baseline are `7101dced3d592f9c70d445ec4b901cc3ff8946b3`.
- The isolated baseline is clean and the active dirty `codex/roadmap-site` checkout is untouched.
- Clean baseline `pnpm check:windows` passed AI verification, 1,505 fast tests / 2 skipped, 146 serial books tests / 1 skipped, TypeScript, Vite production build, Hercules Pro UI build, and redirect guard.
- `postEntry` resolves optional Household Fund funding and appends either `purchase-funded` or `refund-funded`.
- `requireFundCustodian` exists but is not called by `postEntry`.
- The downloaded build manual's D-182 is stale; current canon already uses D-182. D-190 is also occupied. The next available decision id at this baseline is D-196.

## Scope

### In scope

- Classify a funded entry before cloning or mutation.
- Require the configured custodian only when the resulting Fund event is `purchase-funded`.
- Use the exact refusal: `Only the person holding the card can post a household purchase.`
- Preserve refund-funded corrections, contribution proposals, shifts, and other existing non-purchase rights.
- Add focused behavior, non-mutation, correction-lineage, and source-fence tests.
- Repair only synthetic fixtures that attempt a Fund-backed purchase as the non-custodian.
- Record current decision D-196 and return a full local handoff.

### Out of scope

- Till Slice 2 swipe UI, Till Slice 3 surface/navigation, or Slice 4 landing preference.
- Schema, hosted rows, Supabase, Auth/RLS, secrets, model/provider behavior, deployment, Production, push, PR, merge, or real household data.

## Acceptance evidence

- [x] Clean baseline gate passes before implementation.
- [x] Custodian can create a Fund-backed purchase.
- [x] Non-custodian receives the exact `ValidationError` before any mutation.
- [x] Ordinary refund and purchase-reversal corrections remain `refund-funded` and do not gain a new custody fence.
- [x] Reversing a refund, which restores a purchase position, remains `purchase-funded` and is custodian-only.
- [x] Non-custodian contribution proposal and shift posting remain valid.
- [x] Source fence keeps the check in the `purchase-funded` command path before cloning.
- [x] Focused, complete serial-books, AI-surface, TypeScript, Vite build, diff, and secret/path checks pass.
- [x] Independent books/trust and packet audits found no implementation defect.
- [x] Durable Cursor packet for Till Slices 2 and 3 names the exact sealed ancestor and contains no hidden chat dependency.
- [ ] A normal same-root dependency checkout reruns the full `pnpm check:windows` and Hercules UI build before push.

## Plan

- [x] Run the clean exact-baseline gate.
- [x] Implement the narrow command guard and focused tests.
- [x] Run focused proof and repair only necessary synthetic actors.
- [x] Record D-196 and the complete evidence-backed handoff.
- [x] Create the Cursor packet for Slices 2 and 3 without implementing either UI slice.
- [ ] Before push, rerun the wrapper in a checkout whose dependencies live under the same accessible root.

## Evidence log

- `git status --short --branch` — clean `codex/till-1-custody-fence-v2` at open.
- `git ls-remote origin refs/heads/main` — `7101dced3d592f9c70d445ec4b901cc3ff8946b3` at baseline selection.
- Baseline `pnpm check:windows` — passed; 1,651 tests / 3 intentionally skipped, AI surface, TypeScript, 404-module Vite build, Hercules Pro UI, redirect guard.
- Code inspection: `postEntry` funding/classification in `src/core/commands.ts`; existing helper `requireFundCustodian` remains generic for other Fund commands.
- Focused candidate proof — 12 files / 114 tests passed, including custody, Fund, PGlite continuity, rehearsal, and month projections.
- Additional affected-fixture proof — 6 files / 40 tests passed for Ask, Clerk, purpose, and run-rate scenarios.
- Serial books candidate lane — 18 files / 146 tests passed; one performance file/test intentionally skipped.
- Candidate static/build proof — AI surface passed; TypeScript passed; Vite production build transformed 404 modules; diff and staged secret/path scans passed.
- Broad fast candidate run — 216 files / 1,485 tests passed with two intentional skips. Direct complete-dependency reruns passed API, browser evidence collector, and five-of-five checks; the remaining live Flinks and cross-root native-esbuild failures reproduce outside the Slice 1 diff.
- Independent books/trust audit — no P0-P2 defect in authority, correction lineage, projection alignment, fixtures, or scope.

## Decisions

- The downloaded manual is requirement input, not canon. Its exact custody behavior is retained; its occupied D-182 identifier is not.
- Purchase versus correction authority follows the resulting immutable Fund event kind, not merely the input transaction type.

## Remaining uncertainty

- The sealed candidate still needs a normal same-root full Windows wrapper/Hercules UI rerun before push because pnpm refuses the sandbox's dependency junction and native esbuild cannot cross the sandbox root.
- The Flinks invalid-token test depends on a live Supabase response and currently receives HTTP 400 rather than 401 on the unchanged baseline; it is unrelated to Till but must be classified in the next normal full gate.
- Cursor must re-check current `origin/main` and decision ids before each later slice. Slice 3 may start only from an accepted Slice 2 exact head.

## Handoff

Codex owns the sealed local Slice 1 implementation and evidence record. Jonathan retains push/PR/merge/deploy authority. Cursor is the next implementation owner only for the sequentially bounded Slice 2 and Slice 3 packet. No push is authorized by this worksession.
