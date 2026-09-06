# Hearth worksession — onboarding test-net repairs

- **Status:** RELEASE CANDIDATE — PR #356 open; checks pending
- **Opened:** 2026-09-06 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `codex/onboarding-test-net-repairs`
- **Baseline SHA:** `a3b6124f1211f511453241d88c2e021255caf34c`
- **Implementation SHA:** `e86f2f5bbdd24faec94f064e6176dfd41a8ff62c`; this evidence/status closure follows
- **PR or issue:** [#356](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/356)
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** none; local test execution only

## Household outcome

No household behavior changes. The entry integration net now exercises the real command validators, and rehearsal preflight behavior no longer depends on one exact Start-button sentence.

## Budget delta (5)

`+1`: catches command-boundary refusals in the mounted onboarding regression net before they can be presented as accepted books.

## Engagement delta (3)

`+1`: protects Demo Table member entry and rehearsal-start behavior from false-green and copy-coupled tests.

## Verified baseline

- Fresh branch from current `origin/main@a3b6124f1211f511453241d88c2e021255caf34c`.
- Untouched `test/month-rehearsal-preflight-ui.test.ts` failed 2/2 with `Missing Start our month button` after the production label had become `Start rehearsal`.
- Untouched `test/onboarding-entry-integration.test.ts` passed 4/4 while replacing `acceptHouseholdWrite` with an unconditional accepted outcome, so it supplied no command-runtime validator evidence.

## Scope

### In scope

- Remove the `acceptHouseholdWrite` replacement and retain the existing lower-level storage, continuity, Google, and ledger doubles.
- Capture accepted mounted candidates through the in-memory persistence adapter.
- Add one deterministic Demo Table seed acceptance/member-choice regression through the real runtime boundary.
- Give the rehearsal Start button one stable test id and use it from behavior tests.
- Prove the Demo Table test fails when the demo-approval runtime repair is absent.

### Out of scope

- Production behavior, money writers, journal/budget formulae, schema/migrations, hosted rows, Auth/RLS, providers/models, secrets, Production settings/data, exhaustive gates, browser/live use, deployment, and every other audit finding.

## Acceptance evidence

- [x] Entry integration imports the real `acceptHouseholdWrite`.
- [x] Storage, continuity, and Google remain mocked; ledger ingest/validation stays in memory.
- [x] Accepted candidates are captured through `saveHousehold`, not a replaced command function.
- [x] The Demo Table seed commits with `previous: null`, no command kind, in-memory `persist`/`ingest`, and exposes an active Jonathan choice.
- [x] The mounted Demo Table path selects Jonathan, reaches Home, and remembers the accepted household id.
- [x] Removing the full PR #354 command-runtime exemption makes the new test fail; restoring it makes the test pass.
- [x] `src/core/commandRuntime.ts` has no final diff.
- [x] Rehearsal preflight uses `data-testid="month-rehearsal-start"`; visible `Start rehearsal` copy remains covered separately.
- [x] Final Medium quick gate, TypeScript, production build, and AI-surface verification.

## Plan

- [x] Reproduce both baseline test-net defects on current main.
- [x] Make the smallest test/hook edits.
- [x] Run fail-then-pass mutation proof and restore runtime source exactly.
- [x] Complete the focused and repository-required gates.
- [x] Hand off locally without push, merge, or deploy.

## Evidence log

- Baseline preflight run: 0/2 passed; both failures were the stale visible-text selector.
- Baseline entry integration run: 4/4 passed under the unconditional acceptance replacement.
- Initial repaired focus: rehearsal preflight passed 2/2; entry integration's real boundary passed the Demo Table, new-household, and preview cases. The existing-books assertion was then corrected to count unique accepted command receipt ids because adapter observation also sees a harmless repeated cache persistence of the same accepted snapshot.
- Repaired entry integration: 5/5 passed.
- Mutation proof: after temporarily restoring the full pre-PR #354 `commandRuntime` logic, the dedicated Demo Table case failed because the outcome was `ok: false`, `postedNothing: true`. After restoring current main, it passed 1/1; `git diff --exit-code -- src/core/commandRuntime.ts` passed.
- Adding the required stable DOM hook initially exposed one adjacent exact-markup assertion; that assertion now covers the same disabled/copy state plus the test id.
- Final entry integration run: 6/6 passed, including real direct acceptance and mounted member selection into Home. The preceding three-file focus passed 13/13 before that mounted case was added; the exact final quick gate below reran the complete changed set.
- Medium quick gate passed in 75.879 seconds, below its 300-second budget, at fingerprint `c1dece9de262bf7a052000ac93e4d77d7bc6a8f9ef9b4a36e48aafa66528ee10`: diff/AI-surface/TypeScript/discovery passed, then 16/16 fast assertions across four files and 26/26 serial D-183 startup assertions. The gate reported UI proof required because of the inert `data-testid`; the focused mounted/static tests prove the attribute, label, disabled state, unlock, invalidation, error behavior, and member entry into Home. No visible styling or behavior changed, so no separate visual-browser claim is made.
- `pnpm exec tsc --noEmit` passed separately. The bundled runtime has no `npx` executable, so the equivalent repository command was used; the quick gate and build also reran TypeScript.
- `pnpm build` passed with 483 Vite modules plus Hercules Pro UI. Existing PGlite browser-externalization/eval and large-chunk messages remained non-failing warnings.
- `pnpm ai:verify` passed: 48 required files, 2 Clerk fences, docs-only MCP, bounded roles, guards, and proof gate.

## Decisions

- Count unique `offerHouseholdOnboarding` command receipt ids rather than raw persistence calls. Persistence adapters can observe the same accepted snapshot more than once; the receipt identity proves whether the frequently fired effect committed a second command.
- Keep human-visible `Start rehearsal` coverage separate from behavior selection, which now uses the stable test id.

## Remaining uncertainty

- This is local jsdom/static-render and synthetic command-runtime evidence, not a browser, hosted, authenticated, two-device, deployment, or Production run.
- No exhaustive suite is authorized or claimed.

## Handoff

Implementation commit `e86f2f5` is pushed in the single PR #356. Jonathan authorized push and merge; wait for required checks and merge only the unchanged reviewed head. Do not deploy or touch either Worker.
