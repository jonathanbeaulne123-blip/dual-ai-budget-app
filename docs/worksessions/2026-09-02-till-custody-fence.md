# Hearth worksession — Till Slice 1 custody fence

- **Status:** CLOSED — merged and published to the Development kitchen
- **Opened:** 2026-09-02 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/till-1-custody-fence-release`
- **Baseline SHA:** `1c03cbedc10ca5f14ca51bf4067db5ba142a91c5`
- **Head SHA:** main merge `9c49e6fd1998e9687820c8eedea4f6a7b062805a`; D-197-integrated Slice 2 base `b520ff954cd2fafb4a15f6ee6f6d1bb26cf9be09`; implementation ancestor `e426a4592dcd72870feb85642f3d0ab894e6dee8`
- **PR or issue:** [#296](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/296), merged 2026-09-02T07:17:36Z
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** Development Worker assets published; no hosted data or Production change

## Household outcome

Only the configured Household Fund custodian can record a new purchase against the shared card. Everyone keeps their existing non-purchase rights, including contribution proposals and shift posting.

## Budget delta (5)

`+5` — a command-layer custody fence prevents an unauthorized shared-card purchase fact before any transaction, Fund event, or accepted-books write can be created.

## Engagement delta (3)

`0` — this slice deliberately adds no Till UI. It is the books-first prerequisite for the later two-tap swipe and Till surface.

## Verified initial baseline and current-main reconciliation

- At worksession opening, exact remote `origin/main` and the initial local baseline were `7101dced3d592f9c70d445ec4b901cc3ff8946b3`.
- Before release, current `origin/main@1c03cbedc10ca5f14ca51bf4067db5ba142a91c5` was integrated in a clean same-root checkout; it already owned D-196, so Till moved to D-197.
- The isolated baseline is clean and the active dirty `codex/roadmap-site` checkout is untouched.
- Clean baseline `pnpm check:windows` passed AI verification, 1,505 fast tests / 2 skipped, 146 serial books tests / 1 skipped, TypeScript, Vite production build, Hercules Pro UI build, and redirect guard.
- `postEntry` resolves optional Household Fund funding and appends either `purchase-funded` or `refund-funded`.
- `requireFundCustodian` exists but is not called by `postEntry`.
- The downloaded build manual's D-182 was stale and D-190 was occupied. D-196 was free on the initial baseline but became the Clerk weekly decision on current main; D-197 is Till Slice 1's reconciled identifier.

## Scope

### In scope

- Classify a funded entry before cloning or mutation.
- Require the configured custodian only when the resulting Fund event is `purchase-funded`.
- Use the exact refusal: `Only the person holding the card can post a household purchase.`
- Preserve refund-funded corrections, contribution proposals, shifts, and other existing non-purchase rights.
- Add focused behavior, non-mutation, correction-lineage, and source-fence tests.
- Repair only synthetic fixtures that attempt a Fund-backed purchase as the non-custodian.
- Record current decision D-197 and return a full local handoff.

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
- [x] A normal same-root dependency checkout reruns the full `pnpm check:windows` and Hercules UI build before push.

## Plan

- [x] Run the clean exact-baseline gate.
- [x] Implement the narrow command guard and focused tests.
- [x] Run focused proof and repair only necessary synthetic actors.
- [x] Record D-197 and the complete evidence-backed handoff.
- [x] Create the Cursor packet for Slices 2 and 3 without implementing either UI slice.
- [x] Before push, rerun the wrapper in a checkout whose dependencies live under the same accessible root.

## Evidence log

- Historical opening evidence: `git status --short --branch` was clean on `codex/till-1-custody-fence-v2`.
- Historical opening evidence: `git ls-remote origin refs/heads/main` returned `7101dced3d592f9c70d445ec4b901cc3ff8946b3` at initial baseline selection.
- Baseline `pnpm check:windows` — passed; 1,651 tests / 3 intentionally skipped, AI surface, TypeScript, 404-module Vite build, Hercules Pro UI, redirect guard.
- Code inspection: `postEntry` funding/classification in `src/core/commands.ts`; existing helper `requireFundCustodian` remains generic for other Fund commands.
- Focused candidate proof — 12 files / 114 tests passed, including custody, Fund, PGlite continuity, rehearsal, and month projections.
- Additional affected-fixture proof — 6 files / 40 tests passed for Ask, Clerk, purpose, and run-rate scenarios.
- Serial books candidate lane — 18 files / 146 tests passed; one performance file/test intentionally skipped.
- Candidate static/build proof — AI surface passed; TypeScript passed; Vite production build transformed 404 modules; diff and staged secret/path scans passed.
- Broad fast candidate run — 216 files / 1,485 tests passed with two intentional skips. Direct complete-dependency reruns passed API, browser evidence collector, and five-of-five checks; the remaining live Flinks and cross-root native-esbuild failures reproduce outside the Slice 1 diff.
- Independent books/trust audit — no P0-P2 defect in authority, correction lineage, projection alignment, fixtures, or scope.
- Current-main same-root release candidate — focused custody **6/6**; `pnpm check:windows` passed AI surface, **1,525 fast + 146 serial = 1,671 tests**, three intentional skips, TypeScript, 410-module production build, Hercules Pro UI, and redirect guard.
- Exact PR head `097b7dd12bf57100ac251cb797810ff69ec56363` — both CI runs, GitHub Cloudflare workflow, and Worker build passed before merge.
- Merge and main — PR #296 merged as `9c49e6fd1998e9687820c8eedea4f6a7b062805a`; main CI `33602847175` and Cloudflare Workers `33602847156` passed; Worker version `3f8852fe-2949-487d-923b-a80da37a0068`.
- Live kitchen — HTTP 200, `Cache-Control: no-store`; immutable `/assets/index-Ds-S26uS.js` contains the exact custody refusal.

## Decisions

- The downloaded manual is requirement input, not canon. Its exact custody behavior is retained; its occupied D-182 identifier is not. D-197 replaces the now-occupied local proposal D-196 after current-main reconciliation.
- Purchase versus correction authority follows the resulting immutable Fund event kind, not merely the input transaction type.

## Remaining uncertainty

- Cursor must re-check current `origin/main` and decision ids before each later slice. Slice 3 may start only from an accepted Slice 2 exact head.

## Handoff

Till Slice 1 is merged, verified, and published to the Development kitchen. Cursor is the next implementation owner only for the sequentially bounded Slice 2 and Slice 3 packet. This worksession authorizes no later Slice 2 or Slice 3 push, merge, deploy, hosted-data write, or Production action.
