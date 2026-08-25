# Hearth worksession — CAS and Auth/RLS repair

- **Status:** CLOSED — 004/005 applied and approved Development legacy cleanup verified; 006 pending project-boundary decision
- **Opened:** 2026-08-24 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/fix-cas-auth-rls-review`
- **Baseline SHA:** current `main` at `51e59df`
- **Repair commit:** this branch (rebased; see Git history rather than a stale pre-rebase SHA)
- **PR or issue:** repair findings from PR #87 and PR #89
- **Risk:** Release
- **Decision owner:** Jonathan
- **Environment impact:** shared-project schema preparation/hardening; Development legacy-row cleanup; Production household data untouched

## Household outcome

Two signed-in devices can update an existing or newly created cloud ledger without silently overwriting one another. The future Auth/RLS cutover must preserve current household access, prevent self-appointed owners, allow valid one-time invitations, and keep each member's Personal ledger outside the other member's readable household payload.

## Budget delta (5)

`+4` target — exact CAS sequencing, first-create serialization, authenticated ledger scope, and personal/shared storage separation protect accepted books across devices.

## Engagement delta (3)

`0` — this is trust infrastructure. Hercules and Office chrome remain unchanged so engagement work cannot obscure the money and identity boundary.

## Verified baseline

- The repair began from `94aeeb6` and was rebased onto current `main` at `51e59df` before final verification.
- PR #89 head is `8b7862e`; migration 002 is recorded as applied to disposable Development and its sequential 4/4 smoke completed.
- PR #89 checks are red: one stale literal assertion and one TypeScript undefined-access error.
- PR #87 head is `9b45189`; its migration 004 packet was repaired here and later applied with Jonathan's Development approval.
- Current runtime cloud requests use the publishable key, not a Supabase user access token.
- Production deployment/data and secrets remain out of scope. Jonathan later authorized schema migrations 004/005 and deletion of the 30 disposable Development households.

## Scope

### In scope

- Integrate the PR #89 and PR #87 repository artifacts onto current `main`.
- Repair CAS first-create concurrency and exact revision sequencing with deterministic tests.
- Repair Auth/RLS ownership, invitations, RPC grants/signatures, legacy cutover safety, and policy tests.
- Wire an optional authenticated Supabase access token through the real REST client while retaining the disclosed Development bridge until cutover.
- Keep Personal payload storage member-scoped and document the required snapshot cutover.
- Run focused tests, full tests, typecheck, build, and release review.

### Out of scope after the approved live actions

- Deploying, pushing, opening or merging a PR.
- Enabling Google Auth providers or changing secrets.
- Editing or deleting the remaining Production household.
- Applying project-wide cutover migration 006 without a separate project-boundary decision.

## Acceptance evidence

- [x] Concurrent first creation has one winner and one conflict, never silent last-writer-wins.
- [x] Published revision must advance beyond the expected revision; compacted offline jumps are valid and duplicate delivery remains idempotent.
- [x] Direct membership writes cannot create or promote an owner.
- [x] Only bounded authenticated RPCs can create a household owner, issue/redeem an invite, or revoke a member.
- [x] Current anonymous Development bridge remains operational until a separately approved cutover.
- [x] Existing memberships require an exact Google provider-subject backfill before cutover can commit.
- [x] Invitation redemption is target-member-bound by construction and has negative-path contract tests; live PostgreSQL rehearsal remains a release action.
- [x] Personal payloads are removed from the shared household projection and stored in the member-scoped envelope.
- [x] `git diff --check`, focused tests, `pnpm check`, `pnpm test`, and `pnpm build` pass.
- [x] Apply 004 and 005 with Jonathan's Development approval; verify migration ids `[2,4,5]`.
- [x] Delete exactly 30 approved Development households behind count guards; verify 0 Development households, 0 memberships, 0 Personal snapshots, and 1 untouched Production household.
- [x] Make 006 abort while Production rows remain because RLS policies and grants are project-wide.

## Plan

- [x] Integrate exact PR heads onto current `main` and resolve documentation truth.
- [x] Repair CAS SQL, client contract, and tests.
- [x] Split safe 004 preparation, forward 005 hardening, and deny-by-default 006 cutover around bounded RPCs.
- [x] Wire user access-token propagation without activating cutover.
- [x] Complete independent-style release review and close the worksession.

## Evidence log

- `git ls-remote origin pull/87/head pull/89/head` confirmed PR heads `9b45189` and `8b7862e`.
- Live status was reviewed read-only before implementation; no mutation is repeated here.
- PR #89 and #87 histories were integrated onto `main` baseline `94aeeb6` without pushing or opening a PR.
- Focused trust suite: 6 files, 45 tests passed.
- Full gate: `pnpm check` passed; 57 files and 419 tests passed, TypeScript was clean, AI surface verified, and the production Vite build succeeded.
- Post-rebase/final gate: 60 files and 432 tests passed with two workers; focused Auth/RLS/CAS tests passed; `tsc --noEmit`, `pnpm ai:verify`, production build, and `git diff --check` passed.
- The standard test pool is capped at four workers because one PGlite/PostgreSQL WASM runtime per file caused false five-second timeouts under an unbounded pool.
- `git diff --check` passed after documentation cleanup.
- Live SQL verification after the approved actions returned migration ids `[2,4,5]`, 0 Development households, 0 memberships, 0 Personal snapshots, and 1 Production household.

## Decisions

- Applied migration history is immutable: a defect in live 002 requires a forward hardening migration, not a rewritten claim that the already-applied SQL changed.
- Auth/RLS preparation 004 and CAS hardening 005 are applied. The deny-by-default 006 cutover remains unapplied until Google provider/runtime proof and an explicit project boundary are ready.
- Supabase table policies, grants, and functions are shared across rows. An `environment = 'development'` filter does not make a schema migration Development-only; 006 now fails closed while Production data shares the project.

## Remaining uncertainty

- The final cutover date, Google provider configuration, and separate-project versus shared-project Production decision require Jonathan and cannot be inferred from repository code.

## Handoff

Implementation and approved Development cleanup are complete. Migrations 004/005 are live; 006 is not. The 30 Development households were deleted and the one Production household was untouched. Jonathan remains the provider, project-boundary, Production, merge, and deployment decision owner.
