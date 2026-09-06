# Hearth worksession — onboarding finale fail-closed repair

- **Status:** LOCAL IMPLEMENTATION AND VERIFICATION COMPLETE
- **Opened:** 2026-09-06 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `codex/onboarding-gates-fail-closed`
- **Baseline SHA:** `157afbb`
- **Implementation SHA:** uncommitted local candidate
- **PR or issue:** none
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** none; local test execution only

## Household outcome

Guided setup cannot reach Ready or completion by omitting an active member's progress, presenting a stale or malformed progress envelope, or relying on proof invalidated by a later re-probe. Legitimate completed-household catch-up remains available only to a genuinely new member with no stored progress.

## Budget delta (5)

`+4`: the setup-completion authority now requires valid, current proof for every active seat and routes rejected stored state to repair.

## Engagement delta (3)

`+1`: genuine new members keep the short catch-up path, while corrupt state gets an explicit repair classification instead of a misleading unlock.

## Verified baseline

- Fresh branch from current `origin/main@157afbb`.
- Before production edits, the new tests failed in four places: a one-member Personal replica returned no outstanding gates; missing/stale Jonathan progress vanished from all gates; malformed Alex progress inherited completed chapters; and invalidated Chapter 12 proof passed `assertReadyApprovalPrerequisites`.
- The remaining 27 assertions in the three focused files passed before the fix, including legitimate completion and the existing new-member flow.

## Scope

### In scope

- Evaluate every active member through shaped `memberProgress` at the finale.
- Preserve fail-closed behavior when there are zero active members.
- Apply `chapterProgressSatisfied` to shaped Chapter 12 proof at the Ready write fence.
- Restrict completed-household inheritance to genuinely absent member progress.
- Classify a present-but-unshapeable member progress record as registry repair.
- Correct test fixtures that encoded one member's proof as household-wide completion.

### Out of scope

- Money writers, accounts, transactions, journal/budget formulae, Funds, schema/migrations, hosted rows, Auth/RLS, providers/models, secrets, Production settings/data, exhaustive gates, browser/live use, push, merge, and deployment.

## Acceptance evidence

- [x] Missing active-member progress leaves all twelve household gates outstanding.
- [x] Stale registry-version progress leaves all twelve household gates outstanding.
- [x] Invalidated Chapter 12 proof cannot pass the Ready prerequisite fence.
- [x] Present-but-unshapeable progress returns empty proof and a repair migration plan.
- [x] A genuinely absent replacement-member record still inherits Chapter 3 and Chapter 12 while conducting Chapters 1, 2, and 8.
- [x] A household where both members hold real satisfied rows can collect both approvals and complete.
- [x] Final High quick gate, TypeScript, production build, and AI-surface verification.

## Plan

- [x] Reproduce all three fail-open paths before production edits.
- [x] Make the smallest core and fixture repairs.
- [x] Run focused and complete-onboarding regression coverage.
- [x] Complete the repository-required verification commands.
- [x] Hand off locally without push, merge, or deploy.

## Evidence log

- Pre-fix focused run: 27/31 passed. The four failures were the intended missing/stale gate, malformed inheritance, and invalidated Ready regressions.
- Post-fix focused run: 31/31 passed across `test/onboarding-progress.test.ts`, `test/onboarding-lifecycle.test.ts`, and `test/onboarding-ready.test.ts`.
- `pnpm exec tsc --noEmit` passed. The bundled runtime has no `npx` executable, so this is the equivalent TypeScript command.
- First complete onboarding run: 471/472 passed. The only failure was `test/onboarding-ready-ui.test.ts`, whose helper populated Bianca's progress and explicitly left Jonathan's absent while trying to approve Ready. That fixture asserted the fail-open behavior rather than a valid completed household.
- Corrected Ready UI focus: 4/4 passed after the fixture populated valid progress for both active members.
- Final complete onboarding rerun: 472/472 passed across 33 files.
- The invalidated-Ready regression was strengthened after its first focused pass to cross the real `acceptHouseholdWrite` boundary; the outcome is `validation-rejected`.
- Mutation proof: temporarily restoring only the old raw-row/timestamp Ready check made that exact accepted-write case fail because the invalidated approval returned `ok: true`. Restoring the candidate made the case pass, and `git diff --check` confirms the final patch is clean.
- Final High quick gate passed in 59.411 seconds, under its 300-second budget, at fingerprint `915883b94424f9f6ced91f118972f5fb8771f17952aa39d2c3a391e9a7ced635`: diff, AI-surface, TypeScript, and discovery checks passed; 66 fast assertions passed across six files; and the 7-test serial PGlite trust matrix passed.
- `pnpm build` passed with 483 Vite modules plus Hercules Pro UI. Existing PGlite browser-externalization/eval and large-chunk messages remained non-failing warnings.
- `pnpm ai:verify` passed: 48 required files, 2 Clerk fences, docs-only MCP, bounded roles, guards, and proof gate.

## Decisions

- Keep an explicit zero-active-member condition in `householdGatesOutstanding`. With no active seats, `Array.prototype.some` is false; without the condition the finale would report no outstanding gates. All contributing chapters therefore remain outstanding until at least one active member exists.
- Preserve D-227's sticky return for an already accepted completed household. This repair governs entry to completion and later Ready attempts; it does not reopen a completion record.
- Treat a malformed stored progress envelope as version `0` when it has no parseable registry version. This feeds the existing repair result without inventing proof or a new migration shape.
- Replace the two one-member Ready fixtures with real two-member proof. Their previous success depended on dropping the member whose Personal envelope was absent.

## Remaining uncertainty

- This is local synthetic/core/jsdom evidence, not browser, hosted, authenticated two-device, deployment, or Production proof.
- No exhaustive suite is authorized or claimed.

## Handoff

Keep this branch local until Jonathan separately authorizes commit, push, and merge. Do not deploy or touch either Worker.
