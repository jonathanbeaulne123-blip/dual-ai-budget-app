# Hearth worksession — onboarding demo approval repair

- **Status:** RELEASE CANDIDATE — PR #354 implementation checks passed; merge blocked by no-deploy boundary
- **Opened:** 2026-09-06 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `codex/onboarding-demo-approval-repair`
- **Baseline SHA:** `9057d7285e449816e7e4dbd81799f48959329d4c`
- **Head before this correction:** `ea9ee14e1ee24e262e64b015873abdd9b90dc195`
- **Corrected implementation SHA:** `76ea1423e5513646a96d64f9c557fed79d9acda4`; this evidence-only closure follows
- **PR or issue:** [#354](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/354)
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** Development only

## Household outcome

The Development Demo Table can accept its own deterministic, already-complete onboarding record without pretending either member approved for the other. An explicit Demo Suite action can create or replace the whole disposable synthetic fixture while another household is open. Ordinary onboarding approvals still cross the member-owned transition assertion.

## Budget delta (5)

`+2`: restores validated demo entry without changing balances, posting, budget formulas, account semantics, or Final Confirm.

## Engagement delta (3)

`+3`: restores the first member choice and the Demo Suite create/replace journeys instead of ending both at an approval error.

## Verified baseline and reproduction

- The branch remains based on current `origin/main@9057d7285e449816e7e4dbd81799f48959329d4c`.
- In a detached throwaway worktree at that exact SHA, the requested scratch Vitest called the real `acceptHouseholdWrite` twice: the seeded Demo Table with `previous: null` and no command kind, and the fixture-tagged Demo Suite with `catalogHousehold("development")` as `previous`. Both returned `validation-rejected`, `postedNothing: true`, and `Only you can approve for yourself.` The one-case reproduction passed because it asserted those two failures.
- Code inspection confirmed the shared cause: the seeded completion writes both Ready approvals before the runtime; the old exemption required `create-demo-suite`, a null previous household, and Suite provenance that `seedDemoHousehold()` does not carry.
- The throwaway test and worktree are evidence only and are removed before handoff.

## Scope

### In scope

- Validate the exact Development-only seeded onboarding proof independently of Demo Suite provenance.
- Accept the Demo Table's first generic commit only with no previous household, no fixture, zero posted ids, and that complete seeded proof.
- Accept an explicit `create-demo-suite` whole-fixture create or replacement with Suite provenance and, when a household is open, an active actor present in both books.
- Give the `preserveDemoShowcaseContinuity` application branch the same explicit Suite command metadata as the other Suite branch.
- Preserve fresh per-action confirmation ids for repeated Suite actions.
- Add positive and adversarial runtime tests, including both ordinary approval command paths.

### Out of scope

- Money writers, journal or budget formulas, schema or migrations, hosted rows, Auth/RLS, provider/model calls, secrets, Production settings, and deployment.
- The other findings in the onboarding audit.
- Repairing the separate Chrome worker-backed PGlite opener timeout.

## Acceptance evidence

- [x] `seedDemoHousehold()` commits through real `acceptHouseholdWrite` with `previous: null` and no command kind.
- [x] The exact fixture-tagged `create-demo-suite` candidate commits with a non-null catalog household as `previous`.
- [x] Generated Suite creation, repeated replay, fresh-seed replacement, legacy replacement, and `preserveDemoShowcaseContinuity` output commit.
- [x] The same seeded approvals are refused in Production.
- [x] Missing, duplicate, extra, or wrong-digest approvals; forged or absent completion digest; a third active member; an unsatisfied chapter; a posted-id claim; missing Suite provenance; missing replacement actor; and a generic Suite commit are refused.
- [x] Explicit `approveOnboardingProposal` and `approveOnboardingReady` inputs still reach `assertOnboardingApprovalTransition` and refuse the synthetic pre-completed state with `Only you can approve for yourself.`
- [x] The real app opens the Demo Table, accepts Jonathan, and renders Home through the browser's direct PGlite fallback.
- [x] Final change-focused High quick gate, TypeScript, production build, and AI verification pass on the corrected tree.
- [x] PR #354 implementation-head checks pass: `test`, `pages`, and the automatic branch-preview Workers build succeeded; Supabase Preview was skipped.

## Implementation notes

- `seededOnboardingApprovalsValid()` requires Development, a complete accepted onboarding record, the exact `ready-demo-v1-<sha256>` digest shape, exactly two active members, the same two confirmed ids, exactly two matching Ready approvals, and a satisfied row for every household-track chapter for both members. Looking up every chapter id avoids the vacuous `filter(...).every(...)` case.
- `syntheticDemoOnboardingIsValid()` remains the stricter `hearth-demo-suite` provenance check layered over the common seeded proof.
- The App intentionally does not invent a Demo Table command: its first persistence call reaches the runtime as the ordinary generic `commit`. Runtime acceptance is therefore limited to absent/generic commit metadata plus null previous, no fixture, zero posted ids, and the full seeded proof. Explicit ordinary approval commands cannot use this path.
- `create-demo-suite` may replace existing books because it is an explicit whole synthetic fixture operation. Candidate Fund integrity, full household/journal validation, ingest, persistence, and requested synchronized transport remain mandatory; only old-versus-new transitions that are meaningless across fixture generations are bypassed.
- `src/core/index.ts` already exports the complete lifecycle module, so the new predicate and command constant require no additional barrel edit.

## Evidence log

- Untouched-main reproduction: `test/onboarding-demo-main-repro.test.ts`, run directly with Vitest in the detached `9057d72` worktree, passed 1/1 and proved both reported rejection objects exactly.
- Corrected focused lifecycle/UI/App run: 18/18 passed across `test/onboarding-lifecycle.test.ts`, `test/demo-suite-ui.test.ts`, and `test/app-swift-demo-entry.test.ts` in 5.16 seconds.
- Corrected focused generated-suite runtime case: 1/1 passed (`8` unrelated cases skipped) in 20.04 seconds.
- Browser: on two fresh local origins, the exact worker-backed code crossed the former approval boundary but later hit the repository's existing `BrowserBooksOpenTimeoutError` / `BrowserBooksOperationTimeoutError`. To isolate the requested onboarding path, the local worker selector was temporarily forced to the existing direct-browser PGlite fallback, then Vite opened the Demo Table, `I am Jonathan` completed, and the Home surface rendered `Jonathan · Jonathan & Bianca`, the Household/Personal ledger tabs, Fund board, and Home navigation. The one-line diagnostic change was immediately restored; `git diff --exit-code -- src/ledger/engine.ts` passed. This is application-path proof of the onboarding fix, not worker-backed PGlite proof.
- Final High quick gate passed in 221.446 seconds, within its 300-second budget, at fingerprint `0d22a06b8ad6a84f19202ad46bb825342c09bbd2f44afbf7af6c394f770b3d77`: diff hygiene, AI surface, TypeScript, 49 fast assertions, the 7-test serial trust matrix, and all 9 serial Demo Suite cases. The gate recorded base `9057d7285e449816e7e4dbd81799f48959329d4c`, pre-commit head `ea9ee14e1ee24e262e64b015873abdd9b90dc195`, and `workingTreeClean: false` because the verified correction was not yet committed.
- The requested `npx tsc --noEmit` could not start because this bundled runtime has no `npx` executable. The equivalent repository command `pnpm exec tsc --noEmit` passed separately, and TypeScript also passed inside both the quick gate and production build.
- `pnpm build` passed: TypeScript, 482 Vite modules, Hercules Pro UI, and the `_redirects` refusal. Existing PGlite browser-external/eval and large-chunk notices remained non-failing warnings.
- `pnpm ai:verify` passed separately: 48 required files, 2 Clerk fences, docs-only MCP, bounded roles, guards, and proof gate.
- Independent read-only trust review returned PASS with no P0-P3 findings. Its separate run passed 40/40 onboarding/UI assertions plus the focused generated Suite replacement case. It retained only the disclosed worker-backed browser and hosted-auth evidence limitations.
- PR #354 implementation head `76ea1423e5513646a96d64f9c557fed79d9acda4`: GitHub `test`, `pages`, and `Workers Builds: hearth-books` completed successfully; `Supabase Preview` was skipped. The Workers result was the provider's automatic branch preview after push, not a manual Wrangler or main deployment.
- Earlier evidence and CI on PR #354 predate this corrected implementation and are superseded for release purposes.

## Remaining uncertainty

- Chrome's worker-backed PGlite opener did not complete in this host session. The direct-browser PGlite fallback did render Home, and runtime tests prove the intended approval boundary, but worker-path Home rendering remains unproved here.
- Authenticated Google/Supabase Demo Suite UI proof is unavailable in the credential-free local build. Generated runtime cases cover synchronization adapters, not hosted-live behavior.
- Quick-gate evidence is not exhaustive or release evidence. No exhaustive lane is authorized or run.

## Release review

**CONDITIONAL.** The final local gates, independent read-only trust review, and implementation-head PR checks pass. Quick evidence is not release evidence, and worker-backed/Home plus hosted-auth proof remain incomplete. Merge must remain stopped because `.github/workflows/pages.yml` deploys the Development Worker after a push to `main`, while deployment is explicitly unauthorized.

## Handoff

The corrected implementation is committed and pushed in the single PR #354, and its checks pass. Do not merge while the automatic main deployment conflicts with Jonathan's no-deployment boundary. No manual deployment, schema application, hosted-data mutation, or Production change occurred or is authorized.
