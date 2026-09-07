# Hearth worksession — F1 Suite predecessor fence

- Status: local implementation verified; not merged or deployed
- Opened: 2026-09-07 (America/Toronto); filename follows requested audit-series date
- Owner and decision owner: Jonathan
- Assignee: Codex
- Repository: jonathanbeaulne123-blip/dual-ai-budget-app
- Branch: codex/onboarding-f1-suite-fence
- Baseline: 44c5931132176553a74dc6d8668356073e811b62
- Risk: High
- Environment: synthetic local Development only

## Household outcome and scope
Restore normal transition checks for an ordinary same-household predecessor. Preserve genuine Suite replacement and separate-household creation. Claude patch 0001 supplies runtime and regression; documentation qualifies the exemption and digest claims. Money writers, accounting formulas, hosted state, schema, Auth/RLS, provider calls, secrets, Workers and deployment are excluded.

## Dual Course
Budget (5): +3. Engagement (3): 0; legitimate demo behavior stays intact.

## Verified baseline
Applied only the regression to current main, then ran `node node_modules/vitest/vitest.mjs run test/onboarding-lifecycle.test.ts -t 'refuses a same-household Suite replacement' --maxWorkers=1`: failed, expected ok:false but received ok:true. Production change was applied only after this failure.

## Acceptance and evidence
- Ordinary predecessor with immutable Fund change refuses.
- Existing fixture replacement and different-household creation succeed.
- Existing first-write/ordinary-approval lifecycle coverage remains in the gate.
- `pnpm test -- --risk=high --focus=test/onboarding-lifecycle.test.ts --focus-reason="Proves ordinary-book transition checks and legitimate Suite creation and replacement"`: PASS, 55 fast + 7 serial assertions, 202.299 seconds, within 300-second budget. Fingerprint ab840cf5631e700d07a9eeb9563e2f38721db68b820d9b105623cba36310841d.
- Gate `pnpm exec tsc --noEmit`: PASS; this is the equivalent of requested npx invocation on the bundled host.
- `pnpm build`: PASS, including Hercules Pro UI. Existing PGlite browser-externalization/eval and chunk-size warnings remain non-failing.
- `pnpm ai:verify` and `git diff --check`: PASS after documentation/comment closure.
- Independent read-only review: no functional blocker. Corrected the added comment to distinguish exemption restriction from categorical refusal and the App helper's empty-household rule. Runtime and tests did not change after the passing gate; final documentation/comment changes are not represented by that earlier fingerprint.

Commands use the bundled Node runtime and existing dependencies from the previous onboarding checkout. `pnpm_config_verify_deps_before_run=false` prevents the host pnpm wrapper from attempting to replace that shared dependency installation. No dependency file changed.

## Remaining uncertainty and handoff
Local command proof only; not exhaustive, browser, hosted-live, authenticated two-device, or Production evidence. Main merges auto-deploy, so no merge or deployment is authorized under the current instruction. Next owner: Codex for verification, Jonathan for release boundary.
