# Hearth worksession — two random-data options

- Status: RELEASE AUTHORIZED — push, merge and Development deployment in progress
- Opened: 2026-09-11 (America/Toronto)
- Owner / decision owner: Jonathan
- Assignee: Codex; independent read-only command investigation and review
- Repository: dual-ai-budget-app
- Branch: codex/two-random-data-buttons
- Baseline: origin/main a889b01 (fetched this session)
- Risk: High (explicitly confirmed fictional financial entries)
- Environment impact: Development feature; local synthetic verification only

## Household outcome

Two distinct options in More: Quick sample data gives 3–6 months of basic fictional income/spending in the selected existing ledger; Investor preview retains the larger existing twelve-month simulation and verification suite. The attachment is contextual evidence; Jonathan's direct request defines scope.

## Budget delta (5)

Account, dates, entry count and exact totals are reviewed before the existing Confirm/command acceptance boundary. Existing setup and rows remain. Personal data uses the actor's Personal cash account. One bounded set prevents accidental growth.

## Engagement delta (3)

48–96 labelled examples fill everyday financial widgets without running the stress generator or Hercules simulations. Preparation runs in a short-lived worker, with error/timeout cleanup and stale-household/scope rejection before application. Classic, Taylor and Newfoundland panel treatments use existing theme tokens.

## Scope and decisions

- Keep investor generation behavior, seeded distributions and coverage; make cost/purpose explicit.
- Quick samples add income and expenses only: no fabricated shifts, claims, Fund settlements, onboarding approvals or reconciliation proof. Existing specialized widgets remain truthfully empty when their required records are absent.
- Default three months; maximum six including current partial month. No future dates. Refuse closed periods and repeat sets; existing accounting checks remain.
- Use one captured command because v2 limits compound requests to 20 steps. Actor binding and catalog resources are enforced on replay.
- Initial implementation excluded release actions. Jonathan subsequently explicitly authorized “push merge and deploy” on 2026-09-11 for this scoped Development change. Schema, secrets, Production activation and real-household mutations remain excluded.

## Acceptance evidence

- Independent read-only review found and closed a Shared/household visibility vocabulary mismatch. Final worker, stale-scope, replay and Undo review found no remaining blocker.
- `pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never test -- --risk=high --focus=test/quick-sample-data.test.ts --focus=test/five-boards-entry-app.test.ts --focus=test/app-startup-p1.test.ts --focus=test/month-rehearsal-mainline.test.ts --focus-reason="Sample generation, authority replay and mounted Confirm/cancel plus required App and rehearsal regressions"`: **151 passed** (44 fast, 107 serial), TypeScript/AI surface/diff checks passed. Fingerprint `22143f412ed63cf1c188d5cf56b5f45e6fa37c90c12caebc3afcd9ea1278e4bd`; base/HEAD `a889b01e38b8aeab5ad05678f165a8849860fbaf`, dirty implementation branch. Later edits are browser-runner evidence and this documentation only.
- **Five-minute budget breached:** 518.327 s total, TypeScript 399.706 s. Classification `quick-gate-passed; time-budget-breached`. This is scoped verification, not exhaustive/release acceptance.
- The preceding quick-gate attempt failed a 2 s synchronous timing assertion under concurrent load (5.6 s versus approximately 0.4–0.8 s standalone), after TypeScript passed. Because preparation now runs off the interaction thread, replaced that inappropriate main-thread criterion with deterministic size/preservation guards plus measured browser rendering during worker execution. All business assertions retained.
- `node_modules/.bin/vite build`: passed (2 m 16 s); separate `quickSample.worker-Cp5YAlOb.js`, 139.21 KB. Existing PGlite externalization/eval and chunk-size warnings remain. Hercules Pro secondary UI was unchanged and not separately rebuilt.
- First successful `node scripts/check-quick-samples.mjs`: 18 actual-page geometry cases (3 themes × Shared/Personal × 320/390/1440), 6 scoped axe checks with zero violations, keyboard review/cancel, zero page errors. At the 2,000-existing-row ceiling, 96-row worker preparation took 4,085.7 ms while rendering 245 frames (maximum frame gap 16.8 ms). This is local desktop Chrome evidence, not a physical-phone performance guarantee.
- Initial browser attempts hit local Vite symlink allow-list restrictions and, under simultaneous TypeScript/build load, PGlite startup timeouts. The local-only server uses `VITE_LEDGER_SYNC_V2=0` and explicitly allows the resolved dependency directory; no product access control changed. The runner blocks hosted/proxy requests and can exercise existing Retry validation recovery.
- Final extended browser runner **passed**: production-built worker returned 48 rows; actual App Confirm persisted 48 rows and `inspectBrowserBooks` returned `ok: true`; repeated all 18 geometry and 6 axe cases, keyboard/cancel and zero page errors. On the isolated final run, the 2,000-row + 96-row worker took **1,692.2 ms**, rendered **101 frames**, and had a **16.8 ms** maximum frame gap. Evidence: `/tmp/hearth-quick-samples-final/evidence.json` and theme screenshots beside it. No startup retry was needed on this final run.

## Handoff

Jonathan authorized the scoped push, merge and Development deployment on 2026-09-11. Codex owns release execution and the deployment receipt. Physical-device and authenticated hosted acceptance are not claimed. Exhaustive gate not requested. The new command is compiled into the existing Worker authority registry and client assets by the same GitHub deployment job. Current main was fetched again and remains the tested a889b01 baseline. No source changes were needed for release. Release review is conditional on the already disclosed physical-device and authenticated hosted acceptance gaps; the owner authorized this Development release with those limits visible. The prior build, 151-test scoped gate, independent review and final browser acceptance evidence are retained; no exhaustive gate was requested.
