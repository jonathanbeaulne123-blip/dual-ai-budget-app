# Hercules slice 3 — useful discovery

Status: implemented and verified locally; ready for the next approved slice. Jonathan authorized slice 3 in this task. No deployment, hosted mutation, schema, secrets, or live provider testing.

Base: slice 2 `1e1233bc1ceb08dd396070df200539690082f433`; origin/main freshly verified `2e113f69d03872eddc22ac461378a0f3e33f6c55`. Clean starting tree; branch `codex/hercules-useful-discovery`. Codex sole writer, bounded independent routing and suggestion/privacy reviews. Claude unused.

Outcome: Bianca can discover Hercules's supported abilities, understand why a suggestion matters now, and safely continue existing work. Approved plan section 2 supplies direction; no unanswered product questions.

Risk High: scoped profile suggestion persistence and navigation. Budget delta (5): current visible evidence leads to existing review/source flows; no financial posting authority. Engagement delta (3): dependable one-tap help, useful choices and quiet personal continuity.

Scope: typed capability catalogue, deterministic eligibility/ranking, three-section help surface, 24-hour snooze, capability disable/re-enable, scoped revalidated resume bookmarks, all three themes. The 3D wardrobe and new outfit asset catalogue remain later slices.

Acceptance: focused pure/authority/mounted UI tests; startup and rehearsal regressions; High quick gate; build; actual local synthetic App browser/keyboard/accessibility checks on phone and desktop in all three themes and both scopes. Live model and real two-device proof remain separate release gates. Results and independent review are recorded below.

## Implementation and review

`HerculesDiscovery.tsx` and `core/herculesDiscovery.ts` provide the shared surface, typed eligibility, explicit explanations and private suggestion controls. App/Books/Ledger/Office route to existing entry, source, duplicate, goal, Fund and outfit controls. The phone desk now exposes the existing wardrobe. Capability hints sent to chat contain available action keys; suggestions themselves make no provider request. Core tools resolve exact selected account/goal IDs before fuzzy names.

Private suggestion admission uses the existing companion command and checks both resource revision and exact predecessor state. This prevents a stale cross-device save from overwriting a reclaimed and recreated occurrence with the same revision. The UI retains command identity on ambiguous retry and cancels stale callbacks across an A → B → A scope switch. Old servers must advertise `companionDiscoveryVersion: 1` before the client queues these writes. No new schema or profile version is introduced.

Independent read-only reviews covered routing/source correctness and suggestion privacy/concurrency. Findings repaired include source identity, exact duplicate/Fund targets, competing desktop drawer state, phone wardrobe reachability, full-month coverage labels, stale Books activity focus, explicit answer focus, capacity reclamation and revision-reuse conflicts. The final trust review independently reproduced the conflict rejection and found no remaining blocker. Codex remained the sole writer; Claude was not used.

## Verification boundaries and release handoff

Browser checks use a fresh Chrome context and fictional local demo data, with every non-local request blocked and local Hercules provider requests returning a synthetic unavailable response. Web Locks are disabled only in that isolated browser to exercise the existing fallback. These checks do not certify an authenticated replica, physical iPhone/Safari, VoiceOver, offline device recovery, real Gemini dialogue quality or two-device suggestion continuity.

A later release must deploy the compatible server capability before activating clients and verify real acknowledged persistence. Rollback must preserve the version-1 private profile; do not erase settings or reinterpret bookmarks as financial drafts. Bills describe next recorded Shared recurring occurrences within an explicitly selected 90-day window. Comparisons describe full recorded calendar months, including future entries and incomplete coverage. Personal hides unsupported Shared-only tools. Fund explanations use only the public drawable register projection. All money still uses existing review and Final Confirm.

Next owner: Codex/Jonathan for slice 4, the approved 3D wardrobe vertical slice. Current authorization ends at local implementation and verification; push, merge, deployment, hosted/schema changes and live provider tests need their own instruction.

## Exact validation commands

Run from `.codex-work/hercules-living-companion-plan` with the bundled Node bin and fallback bin on `PATH`:

```sh
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never test -- --risk=high --focus=test/hercules-discovery.test.ts --focus=test/hercules-discovery-ui.test.ts --focus=test/hercules-companion-continuity.test.ts --focus=test/hercules-companion-profile.test.ts --focus=test/hercules-private-chat-ui.test.ts --focus=test/hercules-chat-providers.test.ts --focus=test/hercules-tools.test.ts --focus=test/register-integration.test.ts --focus=test/register-view.test.ts --focus=test/office-wide.test.ts --focus=test/personal-books-privacy.test.ts --focus=test/app-startup-p1.test.ts --focus=test/month-rehearsal-mainline.test.ts --focus-reason='Slice3 capability eligibility and exact source routes, private suggestion CAS/retry/scope cancellation, source-only disclosure and required App/rehearsal regression'
node .artifacts/hercules-slice-3/browser-final.mjs
node .artifacts/hercules-slice-3/browser-routes.mjs
```

The gate started at base `2e113f69d03872eddc22ac461378a0f3e33f6c55`, HEAD `1e1233bc1ceb08dd396070df200539690082f433`, fingerprint `c5e39834753c0f5c865b27349f03c73949e8a71fd0fc0aa017a7cf67c351e1c8`. That first gate found two new fixture errors and one real empty-query account-match regression. The Fund fixture now declares an actual Fund obligation; the duplicate fixture explicitly confirms the intentional duplicate; exact chart-account matching now requires a nonempty query. The final gate below supersedes this first result. Browser evidence predates only that read-tool guard repair and fixture changes; no UI, navigation or styling changed. Logs are local `/tmp/hercules-s3-gate.log` and `.artifacts/hercules-slice-3/` reports/screenshots. No exhaustive test lane was requested or run.

Browser results: final report **36/36 passed**, comprising discovery and the existing wardrobe across Classic Hearth, Taylor's Scrapbook and Newfoundland, Shared/Personal, and 320/390/1440px. Each surface had no horizontal overflow and zero scoped WCAG A/AA axe violations; no page errors. The separate **11/11 navigation journeys passed**: all three Add modes in both views retained the selected scope, More-to-outfits opened on phone in both views, Play closed phone focus in both views, and desktop outfits replaced an open money list. Screenshots were visually inspected. Browser and task-owned Vite server were closed after validation to free host memory.

Build validation reuses the quick gate's `tsc --noEmit` for the unchanged runtime/test source, then runs the remaining package build stages directly. This avoids a redundant full compiler pass on the memory-constrained host; it does not omit type checking. The package's ordinary build is dist cleanup, TypeScript, Vite, Hercules Pro UI and the `_redirects` absence check.

The repaired discovery/read-tool suites passed **27/27** (`node node_modules/vitest/vitest.mjs run test/hercules-discovery.test.ts test/hercules-tools.test.ts --maxWorkers=1`, 23.47s; `/tmp/hercules-s3-repairs.log`). The second High gate used the same command above, fingerprint `ba9c284f5d29e929ad6f7402167257d086516847ee5631f83848406ba75f379a`, and `/tmp/hercules-s3-gate-final.log`. It passed TypeScript and 307 tests, then exposed the startup test that still expected the old tap-to-onboarding behavior (plus jsdom missing scrollTo). The test now verifies help opens without a command, then explicit Set up Hearth starts onboarding and Close restores focus. The targeted startup case passed in 5.96s. Only that test changed after the second gate; runtime source is unchanged. The earlier gate's 2447.186s failure (218 passes, three repaired failures) is retained as diagnostic evidence, not represented as a pass.


## Accepted verification

The final High quick gate passed **308 tests in 22 files**, TypeScript, AI-surface and diff checks in **397.461 seconds**. Classification: `quick-gate-passed; time-budget-breached` (300-second target exceeded during `vitest-fast`; slowest phase TypeScript 207.387s). Fingerprint `e264e443afaedb754a7a86c72c9147b92914c9055eb26d0fc6c93b7ec79b411a`; log `/tmp/hercules-s3-gate-accepted.log`. This includes all 80 App startup tests, seven serial PGlite proof cases, the month rehearsal mainline and the focused companion/privacy/source checks. Source and tests are unchanged after this passing run; only final evidence documentation follows.

Production build stages after the gate's successful type check:

```sh
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never exec vite build
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never build:hercules-pro-ui
test ! -e dist/_redirects
```

Vite's configured `emptyOutDir: true` handles generated output cleanup. An initial explicit shell cleanup was rejected by the command guard; the supported Vite cleanup completed that work without a permission request.

Build result: **passed**, Vite 649 modules in 15.28s, Hercules Pro UI bundle generated, and `_redirects` absence check passed (combined command exit 0; `/tmp/hercules-s3-build.log`). Dependency eval/browser-externalization and chunks over 500kB warnings remain; they did not fail the build. Final staged diff check passed.

Changed scope: 30 files across the discovery UI/selector, companion contracts and persistence, exact read sources, App/Books/Ledger/Office navigation, three-theme styling, client/server capability negotiation, three regression test files and living canon/evidence. No dependency, financial kernel, schema or deployment changes. Go for local slice-3 completion and slice-4 implementation; live deployment/continuity/model-quality certification remains outside this authorization.
