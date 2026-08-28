# Hearth worksession — Household Fund

- **Status:** CLOSED — local implementation review-ready; Release gates remain
- **Opened:** 2026-08-28 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `dual-ai-budget-app`
- **Branch:** `codex/household-fund`
- **Baseline SHA:** `efbe5ed5118b0e6c2c942d318dd4e9643eb163d1`
- **Implementation SHA:** `34f3ca2dc3d4aaf71b332482c297380da6d39152`
- **Release integration SHA:** `95a403fb4b302950e9f7777914e348d0a7d3bec1`
- **PR or issue:** #237
- **Risk:** High for September money semantics; Release before October provider activation
- **Decision owner:** Jonathan
- **Environment impact:** local Development-shaped fixtures only

## Household outcome

Give Jonathan and Bianca one truthful Hearth Household Fund for shared operating money held inside Bianca's existing savings account, with contribution receipt, partial settlement, monthly rollover, privacy, reconciliation, and immutable correction history.

## Budget delta (5)

`+5` — a reconciled operating balance, transfer-due clearing, upcoming reserve, append-only corrections, and a private custodian remainder become command- and books-verified facts.

## Engagement delta (3)

`+2` — Home gets one calm household-money routine: fund, contribute, transfer, reconcile, and roll surplus into the existing Kitty Banks.

## Verified baseline

- Exact baseline CI and Cloudflare workflows were green at `efbe5ed` before opening this branch.
- The source checkout used for earlier roadmap work is dirty and remains untouched; this worktree was created directly from the verified SHA.
- Current `Account` metadata is shared, `addAccount` defaults ownership to `joint`, transaction visibility is independent of account ownership, and no dedicated Household Fund subledger exists.
- PGlite is the accepted on-device books engine. Supabase continuity transports shaped Shared and Personal envelopes; no normalized hosted Household Fund table is required for the September slice.
- D-158 and D-159 are the latest occupied decision ids on this baseline. D-160 and D-161 are available.

## Scope

### In scope

- D-161 Household Fund data contracts, immutable event commands, projector, PGlite persistence/audit, Shared/Personal sync shaping, and synthetic tests.
- Home/Books/Add surfaces for balance, contributions, funded purchases, partial settlements, custodian reconciliation, and Kitty rollover.
- D-162 provider-neutral exact/grouped bank evidence matching and a disabled October Flinks handoff boundary.
- Canon and evidence updates.

### Out of scope

- Provider credentials, real bank connection, hosted schema application, Development or Production household mutations, deployment, merge, or push.
- Automatic posting from bank evidence or model output.
- Reclassifying every existing account; legacy accounts remain shared until a member explicitly changes one.

## Acceptance evidence

- [x] $1,000 contribution → $100 expense → $60 settlement → $20 refund produces $940 operating, $20 due, and $920 free before reserve.
- [x] Only the custodian confirms receipts, settlements, reconciliation, and rollover; either member may propose or mark a purchase fund-backed.
- [x] Personal account/bank totals and Personal transaction ids never enter Shared sync, Hercules disclosure, or shared export.
- [x] Partial settlement, shortfall, refund, reversal, duplicate confirmation, offline/event replay, stale two-device settlement rejection, and Kitty conservation are deterministic.
- [x] Exact unique and exact-sum grouped bank evidence may verify existing actions; extra, near, competing, and unmatched evidence cannot post or drain money.
- [x] Focused suites, `pnpm check`, accessibility/responsive proof, secret scan, and independent High-risk review complete.

## Plan

- [x] Add domain contracts, commands, projector, migration/shape defaults, and audit identity.
- [x] Extend PGlite ingestion and command-log materialization.
- [x] Add Household Fund UI and Personal custodian reconciliation.
- [x] Add provider-neutral October matching behind disabled/read-only boundaries.
- [x] Update D-161/D-162 canon and roadmap additively after current-main reconciliation.
- [x] Run focused/full proof, independent review, local seal, and durable handoff.

## Evidence log

- 2026-08-28: clean worktree `codex/household-fund` opened from `efbe5ed`; no provider, hosted, secret, Production, deploy, or push action performed.
- 2026-08-28: browser proof on fictional local Development data at 320, 390, 720, 1100, and 1280 widths; no horizontal overflow or console error; Fund disclosure, Books route, and Personal-only reconciliation boundary verified.
- 2026-08-28: focused risk suite 12 files / 75 tests passed; independent trust suite 11 files / 76 tests passed; the causal settlement replay file passed 10 repeated root runs and 10 independent runs.
- 2026-08-28: `pnpm check` passed — AI surface verified, 156 test files passed / 1 live-only skipped, 1,049 tests passed / 2 live-only skipped, TypeScript and production build green.
- 2026-08-28: independent books and privacy/trust reviewers report no remaining P0/P1. `git diff --check` and modified-file secret-pattern scan are clean.
- 2026-08-28: Gemini Pro reviewed the complete patch for exact implementation SHA `34f3ca2dc3d4aaf71b332482c297380da6d39152`: `PASS`, no P0/P1 findings, and no required code change before push.
- 2026-08-28: reconciled PR #237 with `main@3740c5c3c78f1f874c5b7ce38c1b572a6e465d06`. Preserved current-main Production Evidence hook behavior, both Books callbacks, and the Household Fund UI/commands; renumbered the Fund canon to D-161/D-162 because D-160 is now occupied.
- 2026-08-28: release-integration proof passed — AI surface verified; 160 test files / 1 live-only skipped; 1,065 tests / 2 live-only skipped; TypeScript and production build green.
- 2026-08-28: implementation sealed locally at `34f3ca2dc3d4aaf71b332482c297380da6d39152`; durable review packet: [`../briefs/HOUSEHOLD_FUND_HANDOFF_2026-08-28.md`](../briefs/HOUSEHOLD_FUND_HANDOFF_2026-08-28.md).

## Decisions

- Household Fund is a virtual append-only operating subledger, not a bank account and not a second source of money truth.
- Bianca is custodian. Her backing account identity, full bank balance, and personal remainder stay in her Personal envelope.
- October connectivity is read-only evidence. Provider support and credentials remain a Release gate.

## Remaining uncertainty

- Flinks support for Bianca's institution/account cannot be verified without the member's institution choice and an approved connected Development smoke.
- Gemini exact-SHA review is complete. Jonathan's explicit push approval remains the only pre-push decision gate.
- Real two-phone September rehearsal and October provider smoke remain household/device gates; no peer device had to remain online for local/offline replay proof.

## Handoff

Implementation owner is Codex in this isolated worktree. The September implementation and inert October matcher are locally review-ready. Jonathan remains the decision owner for push, merge, provider credentials, hosted changes, deployment, Production, and switching the Fund into daily use.
