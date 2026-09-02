# Hearth worksession — Till Slice 1 custody fence

- **Status:** OPEN
- **Opened:** 2026-09-02 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/till-1-custody-fence-v2`
- **Baseline SHA:** `7101dced3d592f9c70d445ec4b901cc3ff8946b3`
- **Head SHA:** working tree on baseline
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
- [ ] Custodian can create a Fund-backed purchase.
- [ ] Non-custodian receives the exact `ValidationError` before any mutation.
- [ ] Ordinary refund and purchase-reversal corrections remain `refund-funded` and do not gain a new custody fence.
- [ ] Reversing a refund, which restores a purchase position, remains `purchase-funded` and is custodian-only.
- [ ] Non-custodian contribution proposal and shift posting remain valid.
- [ ] Source fence keeps the check in the `purchase-funded` command path before cloning.
- [ ] Focused tests and full `pnpm check:windows` pass.
- [ ] Independent books and trust auditors plus verifier review the exact diff.
- [ ] Durable Cursor packet for Till Slices 2 and 3 is current-main based and contains no hidden chat dependency.

## Plan

- [x] Run the clean exact-baseline gate.
- [ ] Implement the narrow command guard and focused tests.
- [ ] Run focused proof, repair only necessary synthetic actors, then run the full gate.
- [ ] Record D-196 and the complete evidence-backed handoff.
- [ ] Create the Cursor packet for Slices 2 and 3 without implementing either UI slice.

## Evidence log

- `git status --short --branch` — clean `codex/till-1-custody-fence-v2` at open.
- `git ls-remote origin refs/heads/main` — `7101dced3d592f9c70d445ec4b901cc3ff8946b3` at baseline selection.
- Baseline `pnpm check:windows` — passed; 1,651 tests / 3 intentionally skipped, AI surface, TypeScript, 404-module Vite build, Hercules Pro UI, redirect guard.
- Code inspection: `postEntry` funding/classification in `src/core/commands.ts`; existing helper `requireFundCustodian` remains generic for other Fund commands.

## Decisions

- The downloaded manual is requirement input, not canon. Its exact custody behavior is retained; its occupied D-182 identifier is not.
- Purchase versus correction authority follows the resulting immutable Fund event kind, not merely the input transaction type.

## Remaining uncertainty

- The post-change suite may expose synthetic fixtures that use Jonathan for Fund-backed purchases. Any repair must change only those purchase actors.
- Cursor's Slice 2/3 packet must be pinned to the final verified Slice 1 head or explicitly instruct a rebase if main advances.

## Handoff

Codex owns this local Slice 1 implementation and verification. Jonathan retains push/PR/merge/deploy authority. Cursor is the next implementation owner only for the separately bounded Slice 2 and Slice 3 packet.
