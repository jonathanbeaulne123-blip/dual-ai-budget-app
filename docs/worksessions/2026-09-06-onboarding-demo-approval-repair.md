# Hearth worksession — onboarding demo approval repair

- **Status:** RELEASE REVIEW IN PROGRESS
- **Opened:** 2026-09-06 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `codex/onboarding-demo-approval-repair`
- **Baseline SHA:** `9057d7285e449816e7e4dbd81799f48959329d4c`
- **Head SHA:** local release candidate; exact commit to be recorded after verification
- **PR or issue:** pending single-PR creation
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** Development

## Household outcome

The Demo Table and both Demo Suite create/replace paths accept only their deterministic, fully completed Development onboarding records. Ordinary household writes still require the normal actor-owned approval proof.

## Budget delta (5)

`+2`: restores validated demo acceptance without changing balances, ledger posting, account semantics, or Final Confirm.

## Engagement delta (3)

`+3`: restores immediate access to the Demo Table and Demo Suite flows that currently fail at the onboarding approval boundary.

## Verified baseline

- Fact: branch `codex/onboarding-demo-approval-repair` starts at `9057d7285e449816e7e4dbd81799f48959329d4c`, the verified `origin/main` baseline for this audit.
- Fact: `seedDemoHousehold()` creates deterministic two-member Ready approvals but no `syntheticFixture` provenance.
- Fact: `syntheticDemoOnboardingIsValid()` requires Demo Suite provenance.
- Fact: `acceptHouseholdWrite()` only exempts a valid Demo Suite when `commandKind` is `create-demo-suite` and `previous` is null.
- Fact: the Demo Table supplies no command kind; Demo Suite replacement supplies no command kind; dedicated Demo Suite creation can have a non-null current household.
- Inference: all three paths are rejected despite carrying the intended deterministic onboarding approval proof.

## Scope

### In scope

- Separate seeded onboarding proof validation from Demo Suite provenance validation.
- Give the Demo Table and Demo Suite replacement explicit command intent.
- Permit dedicated Demo Suite creation while another household is open, without permitting same-id replacement of an ordinary household.
- Add adversarial lifecycle/runtime and application-wiring regressions.
- Record the narrow authority decision and exact verification evidence.

### Out of scope

- The separate onboarding authority findings from the broader audit.
- Existing-household or rehearsal unlock work from the attached audit's later steps.
- Replacing application test mocks beyond what is needed to assert the repaired command wiring.
- Cloud schema, hosted data, Production, or deployment.

## Acceptance evidence

- [x] A valid Demo Table is accepted through the real command runtime only under its explicit command kind.
- [x] A valid Demo Suite is accepted and synchronized when created while a different household is open.
- [x] Same-seed, fresh-seed, and legacy Demo Suite replacements are accepted only from valid same-id synthetic provenance.
- [x] Production, malformed and extra approvals, missing provenance, forged posted ids, generic commands, missing actors, and same-id ordinary-household replacement remain rejected.
- [x] Focused tests and the repository High quick gate pass; the serial Demo Suite phase exceeded the five-minute target and is disclosed below.
- [x] The Demo Table is exercised through the app UI; the Demo Suite confirmation is exercised and stops at the expected Google prerequisite in the credential-free local build.

## Plan

- [x] Add a reusable seeded-onboarding validation predicate and retain the stricter Demo Suite predicate.
- [x] Narrow the runtime exemptions by command kind and previous/candidate identity.
- [x] Wire explicit command tokens from all affected application paths.
- [x] Add focused positive and adversarial tests.
- [x] Run focused tests, quick gate, and manual browser proof.
- [x] Close this worksession with residual uncertainty and handoff state.

## Evidence log

- `git status --short --branch` showed a clean `codex/onboarding-demo-approval-repair` branch before changes.
- Focused `test/onboarding-lifecycle.test.ts`, `test/demo-suite-ui.test.ts`, and `test/app-swift-demo-entry.test.ts` passed. The mounted test's first combined run hit a worker fetch timeout for `AddSlideshow.tsx`; its isolated rerun passed 2/2.
- The isolated new Demo Suite runtime case passed dedicated synchronized creation, same-seed replay, different-seed replacement, legacy-suite replacement, continuity retention, and denial cases in 21.3 seconds on its final focused run.
- `tsc --noEmit` passed.
- Final High quick gate before commit: `quick-gate-passed; time-budget-breached`, base/head `9057d7285e449816e7e4dbd81799f48959329d4c`, pre-evidence-update fingerprint `a8bcf08cb334620419c5e141a2f37f3685fe40b07f0c5db129b882d49659b47a`, 351.4 seconds, 49 fast assertions, 7 PGlite assertions, and all 9 isolated Demo Suite cases. The soft five-minute budget was exceeded by 51.4 seconds while the serial Demo Suite phase completed successfully.
- Production build passed: TypeScript, 482 Vite modules, and Hercules Pro UI. Existing PGlite browser-externalization/eval and large-chunk warnings remained warnings.
- Separate `tsc --noEmit`, `pnpm ai:verify`, and `git diff --check` passed after the production build.
- Local Chromium at `http://127.0.0.1:4317/` opened the Demo Table, entered as Jonathan, and rendered the normal kitchen. The Demo Suite guard rendered its generated-seed disclosure and `Generate & verify`; continuing stopped at the expected Google sign-in prerequisite because the local build has no credentials.
- A read-only authority review found no remaining Step 1 code defect. It retained one later test-quality recommendation: replace the mounted app's fabricated acceptance result with a real-runtime wrapper in the attached audit's Step 3 scope.

## Decisions

- Seeded completion proof is necessary but not sufficient for a bypass: acceptance also requires an explicit, Development-only demo command.
- Demo Suite provenance remains mandatory for Demo Suite commands.
- A Demo Suite command may create a different household while another household is open, but may not replace a same-id ordinary household.

## Remaining uncertainty

- Authenticated Google/Supabase browser proof of Demo Suite creation/replacement was not possible in the credential-free local build. The real runtime and synchronized transport contract are covered with deterministic adapters, but this is not hosted-live evidence.
- Quick evidence is not exhaustive or release evidence. Jonathan did not request `pnpm check:full`, so it was not run.
- The broader onboarding audit findings and the attached audit's Steps 2 and 3 remain intentionally untouched.

## Handoff

Step 1 is complete on the local release candidate. Jonathan authorized commit, push, one PR, required-check monitoring, and merge only if that can preserve the explicit no-deployment boundary. No deployment, schema application, hosted-data mutation, or Production change is authorized.
