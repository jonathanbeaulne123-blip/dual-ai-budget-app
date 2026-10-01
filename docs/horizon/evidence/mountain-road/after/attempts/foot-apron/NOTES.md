# Foot physical apron proposal — source only, not applied

Apply proposal: `/tmp/mountain-foot-lane-apron.patch`.
Proof index: `/tmp/mountain-foot-final-proof.json`.

The existing `mountainV2.footLane` road metadata is 7m wide and22.014m long, but its carried S1 and crossing Year Walk ribbons leave physical gaps at the outer lane offsets. The original Foot batter did not use the deck's host height. Host metadata was also published after original deck emission, and the late edge pass only regenerated edges/batters. Consequently changing host queries or four batter corners did not repair the actual floor.

This proposal adds a final source geometry pass after corridor generation and before world compaction. It refits the existing local `yearWalk.bed`, `yearWalk.shoulders`, `yearWalk.batter`, `S1.surface.*` and `S1.batter` top meshes, and adds one closed `mountainV2.footLane.apron` within the existing7m footprint. It uses final drawn V03 corridor triangles and actual native road edge frames. The visible approach uses a10% rise envelope from actual native edge vertices; native road top vertices target5mm higher than the apron at overlap. Every refitted top has a corresponding closed underside down into the real ground. Mesh and collision use the same positions and indices. No runtime height override, collision tolerance, controller, native source road, terrain, route XY, closure, bridge or branch edit is proposed.

Files touched:
- `scripts/horizon/bake-entry.ts`: call final source join before world creation.
- new `src/harbour/horizon/land/mountainV2/footLaneJoin.ts`: bounded visible Foot apron and existing mesh conformance.
- new `test/horizon-foot-lane-apron.test.ts`: actual source geometry/composed geography continuity, contacts, headroom, native top ownership, closed grounded underside, unchanged route points/unrelated solids, and idempotence.

The pass requires authored8-vertex prisms and rejects compacted vertex data explicitly. Served world meshes must not be passed into that stage. The successful shadow proof regenerated only the real local source bed geometry before running the pass. Other served world solids and the exact runtime region, terrain, mouth exclusions and terrace exclusions remained present.

## Measured proof

Original geometry maximum successive height changes at Foot offsets: left2.625m24.72cm, right1.3125m48.74cm, right2.625m38.36cm. Original inner-right/body checks recorded7 contacts and outer-right13 per direction. A corner-only repair removed some contact but retained31cm slivers; it was not accepted.

The final candidate swept0.04m stations327–352.6 in both directions, at centre,±2m,±2.625m and±3.4m. All14 sweeps recorded0 contacts. All named interior batter/gap events disappeared; no actual neighboring Foot samples produced a height difference above6cm. Centre maximum successive change was4.736mm.

Raw deltas at the V03 turn remain in the JSON: at s327.36→327.40, offset orientation rotates by90degrees and jumps across space. Offset−2m jumps about2.43m and+2m about2.36m, despite only0.04m of station increase. Raw maximums there are6.64/7.55cm at±2m,7.21/10.04cm at±2.625m, and6.95/13.15cm at±3.4m. Those observations are retained. They do not establish a physical neighboring-triangle lip, and this Foot-only proof does not certify driving the V03 turn.

Actual ordinary-controller attempts, one initial placement each:

| Mode | Direction | Progress / attempted | Time | Maximum deviation |
|---|---|---:|---:|---:|
| Bicycle | Forward |21.027 /21.514m |6.40s |2.76cm |
| Bicycle | Reverse |21.055 /21.514m |8.00s |2.74cm |
| Walking | Forward |21.040 /21.514m |8.77s |0.41cm |
| Walking | Reverse |21.040 /21.514m |8.77s |0.41cm |

All4 met the existing0.5m end tolerance, with0 contacts,0 airborne/off-bed frames,0 bails and0 restarts. The bicycle used the unchanged default general pursuit policy and actual product controller. Walking uses the previously extracted actual runtime move function with gateOpen=true, so gate readiness is not tested. These are independent22m Foot attempts, not uninterrupted main-chain or Stillwater passes.

## Retained failures and remaining work

- `/tmp/mountain-foot-batter-corner-only-probe.json`: failed corner-only repair.
- `/tmp/mountain-foot-apron-first-probe.json`: invalid-for-source compacted-mesh shadow; physical failures preserved.
- `/tmp/mountain-foot-apron-modes/results.json`: that incomplete shadow's4 attempts; reverse walking stalled after6.40m. No success/retry substitution.
- `/tmp/mountain-foot-apron-probe.json`: corrected final14 geometry sweeps and baseline.
- `/tmp/mountain-foot-apron-final-modes/results.json`: final4 independent actual controller attempts.
- `/tmp/mountain-native-branch-audit/foot-final-probe.mjs` and `foot-final-modes.mjs`: reusable scratch proof sources.

The proposed focused Vitest tests have not been run. The source patch passes `git apply --check`. No full bake, broad tests, browser or full route was run by this agent. Root must validate the final bake, full main-chain/Stillwater modes, the physical V03 turn, rendered terrain relationship, and tier budgets. The new apron has2,336 vertices and4,612 triangles; local refitted YearWalk/S1 geometry totals13,156 triangles. Tessellation cost is explicit and must not silently bypass budgets.
