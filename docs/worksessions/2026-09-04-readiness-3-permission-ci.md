# Hearth worksession — Readiness 3 permission CI

- **Status:** REVIEW
- **Opened:** 2026-09-04 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `readiness/3-permission-ci`
- **Baseline SHA:** `e055a71fe704df5195ce2c6c177d1a7aa7855e64`
- **Head SHA:** working tree
- **PR or issue:** none yet
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** none; local synthetic PostgreSQL only

## Household outcome

Authorization regressions become reproducible failures before they can expose another member, household, environment, or revoked session.

## Budget delta (5)

`+2` — stronger proof around the cloud authority boundary; no ledger rule, balance, or money command changes.

## Engagement delta (3)

`0` — test infrastructure only, with no household-facing interaction.

## Verified baseline

- Slice 2 PR #326 merged as `e055a71fe704df5195ce2c6c177d1a7aa7855e64`.
- Slice 2 head `1c5b9b923945f2ed55c69d91ba2b7386d70eb195` is an ancestor of `origin/main`.
- Slice 3 starts from that exact merge with a clean worktree.
- The repository has PGlite/PostgreSQL-WASM and existing Auth/RLS source-contract tests, but no Supabase CLI, Docker, `psql`, or pgTAP executable is installed locally.
- The October matrix contains 20 stable control IDs; Readiness 3 must map every automated-proof row to unique test IDs without changing any row to Production-ready.

## Scope

### In scope

- A local synthetic PostgreSQL RLS fixture with users A/B/C, households H1/H2, Development/Production, owner/member/nonmember, anonymous, and revoked-session states.
- Negative allow/deny cases for select, insert, update, bounded RPC, and realtime-subscription admission.
- A manifest mapping every October control with automated proof to checked test IDs.
- Self-tests for missing/duplicate IDs and one deliberately weakened isolated policy that the gate must catch.
- Risk-focused verification mapping and a local package entry point.

### Out of scope

- Applying or changing hosted schema, Supabase rows, secrets, Production flags or targets, GitHub branch/ruleset/required-check settings, deployments, and real household or identity data.
- Claiming the synthetic local harness is exact live Supabase or Production evidence.

## Acceptance evidence

- [x] Every October automated-proof row maps to at least one unique checked test ID.
- [x] Synthetic A/B/C and H1/H2 fixtures prove cross-user, cross-household, cross-environment, anonymous, and revoked-session denial.
- [x] Select, insert, update, RPC, and realtime-subscription admission are represented.
- [x] A deliberately inverted isolated policy makes the matrix fail.
- [x] Failures name only control/test IDs and never print row payloads or credentials.
- [x] Focused High-risk quick gate passes within the measured five-minute budget.
- [x] Independent authorization review returns no P0–P2 finding.

## Plan

- [x] Merge Slice 2 and verify it is on `main`.
- [x] Branch Slice 3 from the exact merged SHA.
- [x] Implement the synthetic PostgreSQL permission harness and manifest.
- [x] Update verification mapping and living test decision.
- [x] Run focused and High-risk verification, then independent review.
- [ ] Push a draft PR and stop before remote settings or schema.

## Evidence log

- `origin/main=e055a71fe704df5195ce2c6c177d1a7aa7855e64`; Slice 2 merge ancestry exit `0`.
- PR #326 advanced from draft and merged only after its exact-head quick gate, independent review, and hosted checks were confirmed green.
- Local dependency inventory: bundled PGlite is present; Supabase CLI, Docker, `psql`, and pgTAP are absent.
- The lane self-test exposed a current-main omission: `test/continuity.test.ts` directly imports the PGlite engine but was absent from both explicit lane boundaries. Readiness 3 repairs that verification-only drift while adding its own serial fixture.
- Initial review rejected the hand-written fixture because it contradicted server-side Production Create, did not bind migration/runtime sources into focus selection, conflated missing membership with environment isolation, and omitted Personal writes and several revoked lifecycle paths. The repaired gate models the 008-before-006 effective policy order, asserts source parity across migrations 006/008/012/013/014/017/018 and runtime authority, uses the same auth identity with distinct environment sessions, and adds the missing write/revocation cases.
- Independent re-review returned PASS with no P0-P2 findings and independently ran 16/16 focused tests.

## Decisions

- Use the repository's bundled PGlite to run real PostgreSQL roles and RLS locally, avoiding a skipped or secret-dependent gate.
- Treat realtime as subscription-admission authorization in the synthetic fixture; live Supabase delivery remains a separate observed proof.
- Preserve the repository's actual authority split: migration 006 accepts bounded Create for Development or Production, while the client separately gates Production continuity; a household-scoped device revocation denies that household without revoking the person's global Auth session.

## Remaining uncertainty

- PGlite proves PostgreSQL policy semantics and repository-source parity but not Supabase Auth token plumbing, PostgREST, Realtime transport, or exact hosted/Production policy state.

## Handoff

Codex owns the branch implementation and review. Jonathan remains the merge and any future remote-setting/schema decision owner.
