# Hearth worksession — F3 rehearsal environment gate

- Status: local implementation verified; not merged or deployed
- Opened: 2026-09-07 (America/Toronto); filename follows requested audit-series date
- Owner and decision owner: Jonathan
- Assignee: Codex
- Repository: jonathanbeaulne123-blip/dual-ai-budget-app
- Branch: codex/onboarding-f3-rehearsal-environment
- Baseline: 44c5931132176553a74dc6d8668356073e811b62
- Risk: Medium
- Environment: synthetic component fixtures, including a Production-labelled object; no live Production

## Household outcome and scope
Keep the rehearsal access wrapper and its locked copy Development-only. Apply Claude patch 0002 after F1 and F4. No other UI behavior, money writer, formula, hosted row, schema, Auth/RLS, provider, secret, Production setting/data, Worker or deployment change.

## Dual Course
Budget (5): 0. Engagement (3): +1, remove irrelevant Development scaffolding copy.

## Baseline evidence
Applied test only, then ran `node node_modules/vitest/vitest.mjs run test/month-rehearsal-ui.test.ts -t 'offers a clearly named Development-only' --maxWorkers=1`. It failed: expected empty markup, received locked Development card. Only then applied the environment guard.

## Acceptance and evidence
Both home and manage wrapper surfaces render empty outside Development. Existing Development locked and unlocked component behavior remains covered. `pnpm test -- --risk=medium --focus=test/month-rehearsal-ui.test.ts --focus-reason="Checks both rehearsal wrapper surfaces outside Development and preserves Development rendering"`: PASS, 14 fast + 26 serial assertions, 281.190 seconds, within five-minute budget. Fingerprint 4f57cbcb5dc9e29d5392227ed048ca90fe106b09fea88bf34b174c5a878165b4. Selected files: month-rehearsal-ui, onboarding-entry-integration, app-swift-demo-entry, app-startup-p1. This includes mounted Demo Table -> member -> Home proof.

Gate `pnpm exec tsc --noEmit` (equivalent of requested npx spelling), `pnpm build` including Hercules Pro UI, AI verification and diff hygiene: PASS. Existing PGlite browser-externalization/eval and chunk-size build warnings remain non-failing. Independent read-only review: PASS, no blockers. Final documentation-only evidence closure follows the passing gate. No viewport or interactive browser claim: the change removes the entire non-Development component and changes no layout/control in Development.

Bundled Node and the existing onboarding dependency tree are used; pnpm dependency auto-install disabled to avoid changing the shared installation.

## Remaining uncertainty and handoff
Synthetic static React proof, not exhaustive, hosted-live, two-device, or Production deployment evidence. Jonathan owns release; main pushes deploy automatically, so merge remains withheld. Codex completes branch verification and PR preparation.
