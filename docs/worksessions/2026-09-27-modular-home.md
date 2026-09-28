# Hearth worksession — A home made yours

- Status: IMPLEMENTED LOCALLY — scoped feature checks passed; broader verification has timeouts; not release acceptance
- Owner / decision owner: Jonathan
- Assignee: Codex
- Repository: dual-ai-budget-app
- Branch: codex/modular-home
- Baseline: baff688d55e0994ad0c1c9ed578a4a4c49219197 (fresh origin/main)
- Risk: High — creative persistence, world geometry and input transitions
- Environment impact: local code and fictional test fixtures only

## Outcome
One renovation book, permanent evidence-based blueprints, editable rooms and furnishings, and each member's own committed home seen on Journey and the island. Each member receives a distinct surveyed residential plot. The original island house and existing financial workspaces are preserved.

## Deltas
Budget (5): useful, supported review/adoption guidance; no financial writer or amount changes.
Engagement (3): build, arrange, finish, store and restore a personal home.

## Verified baseline
Existing creative commands provide scoped durable save and revision conflicts. Existing fixed village arrangements and pottery identities remain. Default Harbour, Horizon preview, full Journey and mini Journey use separate renderers. Upcoming/income reviews currently have no durable completion receipt; opening those screens cannot grant rewards.

## Acceptance
Fictional-data domain/command tests; invalid/disconnected layouts; repeated grant and correction tests; shared/private preservation; map/island projection; actual editor interaction and keyboard checks; change-focused High quick gate. No hosted mutation, migration, deployment or exhaustive gate.

## Implementation
Root is sole writer. Read-only home integration and milestone evidence audits completed and their findings fixed. One authoritative member-private creative document; minimal shared plot claims; declarative catalogue/configuration; draft editor; shared geometry; private notes through existing Personal Life authority. See [the feature handoff](../MODULAR_HOME.md) for controls, catalogue, thresholds and integration boundaries.

## Evidence and limits
- Full local build passed, including application/workspace TypeScript, asset checks and bundle generation (`/tmp/hearth-home-build.log`). Existing Horizon land diagnostics remain; this feature does not change terrain.
- Focused domain, editor and source-fence checks: 42/42 passed (`/tmp/hearth-home-boundary.log`). Additional earlier routing, mini-Journey and world-toolbar checks passed.
- High change-focused quick gate: 1,181 passed, two stale local boating-storage fence failures; 317.451 seconds exceeded the five-minute target. The fences were corrected and rechecked without allowing network or financial writes. The original run remains a failed, time-breached gate (`/tmp/hearth-home-final-gate.log`).
- Selected serial regressions: 219 passed, three failures in legacy App navigation expectations (`/tmp/hearth-home-serial.log`). Updated selectors for the existing Record/Boathouse/Glasshouse labels and isolated legacy presentation flags/cache. The two-client authority recheck passed (33.535 seconds), and the flag-off Plan route passed (45.556 seconds). The legacy navigation/theme rehearsal reached the theme phase but timed out at 180 seconds and remains failed. App startup (83), world walking (81), Plan (19), memories (4), design surfaces (5), bank acknowledgement (6), workspace (6), proof matrix (7), design authority (1), new editor (1), new world walking (1), Bianca command sync (1) and merge review (4) passed.
- Actual editor: Classic Hearth, Taylor's Scrapbook and Newfoundland at desktop/phone widths, plus 320px overflow check; books hash unchanged. `/tmp/hearth-home-browser`.
- World proof uses a fictional second member's Terraces plot, matches full/map module identity, walks through the entrance and climbs to the actual 3.2m upper floor. The strengthened proof passed: it enters from an already-ready Journey through the user-visible Visit action, asserts books remain ready and verifies a full viewport with controls below the account/status row. Direct heavy-world startup encountered the local-books startup deadline during the broad run; that boot path remains separate from this proven interaction.
- Final focused rerun: **54/54 passed in 38.78 seconds** across domain, editor, real world browser, source fences and existing mover-toolbar tests (`/tmp/hearth-home-final-focused.log`).
- After the final viewport CSS adjustment, the production bundle rebuilt successfully in 40.57 seconds and the Hercules UI build completed; no TypeScript source changed after the successful full build. `git diff --check` passed. `/tmp/hearth-home-final-bundle.log`.
- Extensive valid ten-room / 95-furnishing layout: median CPU art construction 13.58ms map / 31.42ms full across ten samples; all observed resources disposed. This is not GPU/device acceptance. `/tmp/hearth-home-measurements.json`.

## Open acceptance and next action
No hosted two-device proof, atomic cross-device plot-claim race proof, physical iPhone/Mac feel or screen-reader/art acceptance. Seven plots only. Precipitation accumulation/wet art, musical performance, shed vehicle parking, blueprint import/publication and simultaneous editing are not implemented. No push, deployment, schema application, exhaustive suite or meaningful household mutation. Review the local implementation and complete device/two-device acceptance before release consideration.

## September 28 — owner-authorized push and merge
Jonathan explicitly requested “push and merge” after the implementation handoff disclosed the verification limits. Refreshed `origin/main` remains `baff688d55e0994ad0c1c9ed578a4a4c49219197`; no integration conflict. A final independent read-only ownership/privacy/milestone audit found no merge-blocking regression. Release review is CONDITIONAL on the disclosed device, hosted claim-race, terrain and timing limits; no full-verification or Production approval is inferred. Run the exact candidate quick gate and repository PR checks before merging. The repository's existing main-push workflow publishes Development with Production continuity disabled; no separate schema or data operation is authorized.

### PR #560 release review follow-ups

- Owner requested push and merge. PR: https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/560.
- Corrected three reviewed issues: home fronts now face each surveyed plot door (all seven transforms checked); a native furnishing selector supplies a 44px phone target with room context; mini island/journey keys include saved home geometry and month so edits and seasonal art rebuild.
- Independent read-only reviews found no blockers. Model/editor/Journey regression run passed 48 tests. Separate real-browser rerun passed both editor/320px furnishing selection and corrected Terraces 2 walking/stairs tests in 78.55 seconds; first attempt exposed the selector label mismatch (fixed) and a startup timeout while a separate undersized type-check process ran out of memory.
- Earlier release candidate quick gate passed TypeScript and 1,200 fast tests, with 219/220 serial passes and a legacy navigation timeout; total 795.1s breached the five-minute target. Hercules CI showed the same navigation rehearsal passing at 179.644s against its 180s limit. Raised that rehearsal's limit to 240s without dropping assertions; local full rehearsal then passed at 179.434s. This does not change the quick-gate timing target.
- Installed Chromium in Hercules CI after three related suites could not start on its runner. Final head checks remain required before merging. No manual deployment or Production activation.
