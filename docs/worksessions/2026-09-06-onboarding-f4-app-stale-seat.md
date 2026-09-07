# Hearth worksession — F4 mounted App stale-seat regression

- Status: local implementation verified; not merged or deployed
- Opened: 2026-09-07 (America/Toronto); filename follows requested audit-series date
- Owner and decision owner: Jonathan
- Assignee: Codex
- Repository: jonathanbeaulne123-blip/dual-ai-budget-app
- Branch: codex/onboarding-f4-app-stale-seat
- Baseline: 44c5931132176553a74dc6d8668356073e811b62
- Risk: Medium
- Environment: local synthetic Development fixture in jsdom

## Outcome and scope
Add Claude patch 0003 mounted-App regression. A deactivated stored session must leave the shell mounted without an identity error or onboarding-offer commit. Directly await act rather than passing its thenable to an expectation; the original patch passed but emitted overlapping-act warnings. No production change; no new decision is needed beyond existing D-229 and D-233 regression authority.

## Dual Course
Budget (5): +1, guard against loss of strict identity presentation safety. Engagement (3): +1, protect startup rendering.

## Evidence
Existing resilience test mounts Hercules only. New test passed before mutation. Temporarily remove App activeMemberSelected guards, run new App and existing Hercules tests, then restore exact App source. Mutation result: new App test failed with `Choose an active household member.`, existing Hercules tests passed 2/2. Restored exact App source and confirmed no App diff.

`pnpm test -- --risk=medium --focus=test/onboarding-app-stale-seat.test.ts --focus-reason="Mounted App survives a deactivated stored session and cannot offer onboarding"`: PASS, 1 test, 92.085 seconds, fingerprint 50fc6c2e609f8e5c2a15984adb33b3a8275dbb6ee963567e2e53be631b955d41. Gate TypeScript (`pnpm exec tsc --noEmit`, equivalent to requested npx spelling) and AI verification pass. No overlapping-act warnings after direct await fix. Independent read-only review: PASS, startup assertion is bounded rather than proof of indefinite absence of offers. `pnpm build` passed including Hercules Pro UI; existing PGlite externalization/eval and chunk-size warnings remain non-failing. Evidence-only closure follows the passing gate.

## Boundaries and handoff
No money writer, formula, household data, hosted request, schema, Auth/RLS, provider, secret, Worker, or deployment change. Tests are local and synthetic, not exhaustive or two-device/live proof. Bundled Node and existing onboarding dependencies are used; pnpm dependency auto-install is disabled to preserve the shared installation. Next owner: Codex verification, Jonathan release boundary. Apply after F1 and before F3.

## Release authorization update — 2026-09-07
Jonathan superseded the deployment hold. F1 merged via #362 as 51ab7dd. Merged current main into this branch, preserving both handoff blocks; conflict was documentation-only and no executable file changed from the reviewed combined code. F4 #363 is authorized next, then F3 #364. Exact updated-head CI is required before merge; Development publication follows main. Earlier no-deploy statements are historical.
