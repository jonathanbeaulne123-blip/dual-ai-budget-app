# Yacht Kitchen worksession

Status: CLOSED — local implementation and scoped verification complete; manual device and balance acceptance remain open.
Owner and decision owner: Jonathan. Integrator: Codex.
Branch: codex/yacht-kitchen. Fresh main base: 926d175bfd313a87a4faaf0ff6adfbe4c2f220db.
Risk: High — shared input, moving reference frame, independent local chefs and session restoration.
Budget delta (5): 0; no ledger, financial task evidence, Auth, schema or household writer changes.
Engagement delta (3): +3 intended; complete, replayable cooking services in the existing yacht.

## Scope and acceptance

Implement the attached Yacht Kitchen brief: five configuration-driven recipes, guided introduction, Lunch, Sunset, Banquet and Practice; finite circulating dishes, unattended cooking, recoverable mistakes/fire, handoffs/tossing, deterministic orders/scoring, independent keyboard-plus-controller/two-controller local play, yacht-local geometry/art/camera, pause/exit/resume and identity-scoped recreational results/cosmetics. Physical access remains required. Root owns runtime integration and final browser proof; bounded modules are authored in separate worktrees against the shared contract.

Use the existing galley, body figures, yacht geometry, unified C camera, comfort and input patterns. Ordinary services visibly anchor the yacht and temporarily reserve the helm. No new weather, online multiplayer, financial progression, schema or deployment work. Complete recipe/service replays, ownership/pause/save tests, actual runtime input/moving-yacht and themed phone/desktop checks are required. Physical controllers and human balance acceptance must be reported separately from simulated browser input.

Current request authorizes local implementation; prior fleet release does not authorize a new release.

## Delivered implementation

- `src/harbour/horizon/kitchen/`: configured recipes/services, fixed-step model, independent input, validated local persistence, actual yacht collision, activity lifecycle/camera, themed HUD, food/chef/station art and gesture-enabled sound.
- `HorizonStage.tsx`, `HorizonWorld.tsx`, `horizon.css`, `runtime/index.ts` and the fleet inspection message: physical board entry, identity scope, controls, world-tool pause, moving yacht frame, C views and restored exploration.
- Ten kitchen test files, `scripts/horizon/kitchen-proof.mjs`, `docs/features/YACHT_KITCHEN.md` and the dated decision entry provide reproducible coverage and the play/tuning guide.
- Results and cosmetics are local recreational state only. No financial writer, task completion, Auth, cloud continuity, schema, network service or deployment changed.

## Exact verification

**Validated source and documentation head:** `18695e4ea9b060d578660cffe59fc43ececf6f89`, clean when the gate ran. Source is unchanged from browser-validated `93b8d9f`; subsequent closure edits only update this record and clarify the feature guide.

Command (Node runtime on PATH, `pnpm_config_verify_deps_before_run=false`, artifacts outside the checkout):

```sh
HEARTH_ARTIFACTS_DIR=/tmp/hearth-yacht-kitchen/gate-complete pnpm test -- --risk=high --focus=test/yachtKitchenActivity.test.ts --focus=test/horizonFleet.test.ts --focus=test/horizonQuickLayerModes.test.ts --focus-reason='Complete Yacht Kitchen service lifecycle, five-recipe Practice progression, camera clearance, yacht geometry, shared input and pause regression proof'
```

**PASS: 432 tests in 33 files**, TypeScript, AI-surface guard and diff check. Elapsed **66.569 seconds** against the 300-second quick-gate budget; no time-budget breach. Base `926d175bfd313a87a4faaf0ff6adfbe4c2f220db`; change fingerprint `eb6d23075721e36b0516bb0160e2c9890b1e38de3368bfc76203ef97383f9b3e`. Log: `/tmp/yacht-kitchen-quick-gate-complete.log`; gate artifacts: `/tmp/hearth-yacht-kitchen/gate-complete`. This is the scoped High quick gate, not the exhaustive suite or release evidence.

The engine contributes 40 tests, including all five recipes, five services with one/two chefs, wrong combinations, burn/fire recovery, finite plate recovery, contested item/task ownership, handoffs, frame-rate equivalence, pause, restore validation and six-seed Practice menu coverage. Input/storage/activity tests independently cover repeat actions, two-pad assignments, missing-controller recovery, save failures, duplicate rewards, actual yacht geometry and a complete First Service. The financial boundary guard has five passing tests.

**Rendered browser replay:** `node scripts/horizon/kitchen-proof.mjs`, against `http://127.0.0.1:5198`, passed on the final source. Artifacts: `/tmp/hearth-yacht-kitchen/runtime-proof.json`, `/tmp/hearth-yacht-kitchen/first-service-results.png`; log `/tmp/yacht-kitchen-browser-final.log`.

- All ten service/player-count combinations reached results. First Service delivered and washed one bruschetta in each configuration. Timed modes delivered and recycled three plates each before the remaining clock was advanced. Practice completed salad, bruschetta, fish, pasta and burger in its first five deliveries in both configurations.
- The replay uses actual runtime movement and interactions after explicit development arrival fixtures, with accelerated simulation and forgiving assists. The cooking sequence is scripted through Chef 1; independent virtual-controller movement, assignment and simultaneous shared-pause input are exercised separately. It is not a two-human balance session.
- Remote launch was refused. Physical board E/menu/ready and solo C views worked. A moving yacht at approximately 1.95 m/s settled under its own anchor while cooking stayed in its local frame. Runtime tool pause froze elapsed time, reload offered the saved service at the board, restore remained paused, blur paused, and exit allowed mounting the ordinary cruiser. Zero page errors were observed.

**Rendered visual evidence:** Classic Hearth, Taylor’s Scrapbook and Newfoundland menus/play at 1440, 390 and 320 pixels were inspected. Final camera/HUD clearance checks covered First, Lunch and Sunset at 390 and 320, including the outdoor grill/pass and dish-return surface. No station surface overlapped visible HUD panels; no horizontal overflow or page errors. Camera projection tests cover five viewport sizes in galley and deck configurations. Evidence: `/tmp/hearth-yacht-kitchen-visuals/proof.json`, `framed-final-proof.json`, `lunch-framed-proof.json` and their PNGs. The final layout source was `38a46e5`; the later source change affects only Practice scheduling.

## Defects found and repaired during validation

Integration checks caught inaccessible dirty returns, target-selection retention between surfaces, occupied toss destinations, repeat touch pulses, incorrect view-relative movement, simultaneous controller pause toggling, phone panels covering work surfaces and incomplete Practice recipe coverage. The final browser run initially failed after 40 Practice deliveries because eligible random orders could starve pasta. Practice now waits for the next configured recipe's appliance capacity; six engine seeds and the final browser's five consecutive dishes pass. The failed run is not counted as acceptance.

## Remaining limits and next owner

Jonathan owns physical iPhone/controller play, two-human teamwork and difficulty tuning, screen-reader play, and authenticated end-to-end opening of budgeting tools from an active service. Virtual Gamepad input does not establish physical-controller feel. Automated clock advancement and assists do not establish long-term balance. Runtime tool pause and existing tool integration tests do not replace authenticated full-app acceptance. No online co-op, cross-device game-progress sync, merge, deployment or Production activation is claimed.

The playable branch is `codex/yacht-kitchen`. Start and controls are in [the feature guide](../features/YACHT_KITCHEN.md); tune recipes/timing in `src/harbour/horizon/kitchen/config.ts`, interaction/camera behavior in `input.ts`, `geometry.ts`, `camera.ts` and `activity.ts`, and cosmetics in `storage.ts`/`art.ts`. No required local implementation work remains. Next is hands-on acceptance and, when requested, release review for a PR/merge.

## Authorized push and merge follow-up — 2026-09-27

Jonathan explicitly requested “push and merge” after the implementation handoff. This authorizes pushing `codex/yacht-kitchen`, opening its PR and merging after current checks. The earlier implementation-only scope above is historical. Fresh `origin/main` remains `926d175bfd313a87a4faaf0ff6adfbe4c2f220db`; no mainline integration is required. No additional manual deployment, schema change or Production activation is included. The existing main-branch workflow may run its ordinary Development deployment after merge.

The release review is **CONDITIONAL** on the documented physical-device, two-human balance, screen-reader and authenticated tool-flow acceptance limits. Those limits were disclosed before Jonathan’s merge instruction; this merge does not mark them passed. The existing browser/theme evidence and scoped quick gate support the implementation. The candidate receives another clean-head High quick gate and GitHub PR checks; the exhaustive suite remains unrequested. The changed-file/private-artifact review found no local-only files or credential patterns in the diff. The PR records the final candidate checks and merge result.
