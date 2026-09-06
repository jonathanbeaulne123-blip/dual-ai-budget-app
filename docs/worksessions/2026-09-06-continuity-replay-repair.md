# Hearth worksession — continuity replay repair

- **Status:** LOCAL IMPLEMENTATION AND REQUIRED VERIFICATION COMPLETE
- **Opened:** 2026-09-06 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `codex/continuity-replay-repair`
- **Baseline SHA:** `9758f90`
- **Implementation SHA:** uncommitted local candidate
- **PR or issue:** none
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** none; local test execution only

## Household outcome

An authenticated device can use the command-log fast path again while assembling one stable Shared + Personal generation. Every Shared attempt rechecks the signed-in membership, and compacted offline work that touches one entity more than once no longer becomes malformed merely because its top-level id list repeated that entity.

## Budget delta (5)

`+4`: restores validated command replay and closes the retry-time membership revocation gap without weakening snapshot fallback or ledger authority.

## Engagement delta (3)

`+1`: avoids needless full-snapshot fallback and gives a truthful refusal when membership changes during restore.

## Verified baseline

- Fresh branch from current `origin/main@9758f90`.
- Before production edits, the new consistent-pull test observed zero `continuity_command_events` reads.
- Before production edits, the retry test resolved a revision-9 replica after its authoritative membership disappeared.
- Untouched main's `test/ask-goal-move.test.ts` passed 5/6; the double-move case returned `malformed-command-envelope` instead of `ask-goal-move-authority-mismatch`.
- `git show 85bafff:src/ledger/continuityCommandLog.ts` confirms the non-deduplicating `scopedPostedIds` construction predates onboarding Slice 23. It is not attributed to the onboarding patches.

## Scope and decisions

- `bindMember` already enforced the exact Google/member link for linked snapshots and used `continuityMembershipRows` plus `assertMembershipAuthoritativeDiscovery` for newly redeemed snapshots. That is authority-equivalent and broader than the removed raw-snapshot check, but it was not retry-equivalent because it cached the row and returned early for linked snapshots.
- Signed-in binding now queries the authoritative active membership on every Shared snapshot attempt, validates its environment, household, active roster seat, Google subject/email, and Auth user, and refuses a missing later row with the prior membership-changed message.
- The already-bound `memberId` is passed only to the private command materializer after binding. Restoring `input.identity` to the raw pull would reject the legitimate pre-overlay invited-member snapshot and undo `aa6ca41`'s intended bootstrap repair.
- Command compaction converts only the top-level touched-id list to a sorted set. It retains all compacted command descriptors and materialization facts so semantic replay checks still see and reject a true double move.
- No schema, migration, hosted row, Auth/RLS rule, secret, provider/model call, Production setting/data, Worker, account, transaction, formula, or financial writer is changed.

## Acceptance evidence

- [x] `pullConsistentMemberReplicaById` reaches command-event materialization with its resolved member id.
- [x] Membership revoked during the stable-generation retry loop is refused.
- [x] A valid compacted envelope with two command descriptors touching one recurrence has unique posted ids and applies.
- [x] The existing two-move case reaches `ask-goal-move-authority-mismatch`; its expectation did not change.
- [x] `test/ask-goal-move.test.ts` passes 7/7.
- [x] Mandatory `test/app-startup-p1.test.ts` and `test/month-rehearsal-mainline.test.ts` remain green.
- [x] Final High quick gate, production build, and AI-surface verification.

## Evidence log

- Post-fix focused acceptance: 3 files, 26/26 assertions passed.
- Expanded continuity/materialization/startup/rehearsal run: 8 files, 72/72 assertions passed in 104.83 seconds.
- `pnpm exec tsc --noEmit`: passed. The host does not provide `npx`, so this is the repository-equivalent TypeScript invocation.
- High quick gate: 114/114 assertions passed in 211.268 seconds at fingerprint `867b5a780abdefb854b3ef4facfa4d9ffbcd8a534e586ff42e2848d09fca0369`; this includes 70 fast assertions, 44 serial startup/permission/trust assertions, TypeScript, AI-surface, discovery, and diff checks. The five-minute budget was not breached.
- `pnpm build` passed with 483 Vite modules plus Hercules Pro UI. Existing PGlite browser-externalization/eval, mixed-import, and large-chunk messages remained non-failing warnings.
- `pnpm ai:verify` passed: 48 required files, two Clerk fences, docs-only MCP, bounded roles, guards, and proof gate.

## Remaining uncertainty

- This is local synthetic/client proof, not hosted, authenticated two-device, browser, deployment, or Production proof.
- No exhaustive lane is authorized or claimed.

## Handoff

Keep this branch local until Jonathan separately authorizes commit, push, and merge. Do not deploy or touch either Worker.
