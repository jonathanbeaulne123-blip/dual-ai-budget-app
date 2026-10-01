# Lakeside rendering budget: limits and bounded options

Source/baked-JSON study only. No renderer, world/TypeScript import, test, bake or checkout change ran. Item evidence is `/tmp/mountain-lakeside-rendering-options.json`. The inspected baked world SHA-256 is `0e129df837d3000d674b6ce1dc56446cfb0f690515064e51455047fe1ead0e33`; the retained older capacity report uses `63c4d1e47b6205c66667812377f98a677439ba94ecb389fdf479fbebcf6af91d`. Those are different assets. Source changes and a future bake require fresh counts.

No demonstrated portable change closes ROAD §8's 12-draw district limit while preserving the current authored objects and rendering contract. No batching or planting-removal implementation is proposed for this source freeze. The practical simultaneous count remains unmeasured; the temporary WebGL harness below can measure a finite camera set without changing the builder.

## What the existing counts establish

The saved report records Lakeside furniture 8 draws; plant layer capacity 9 full / 6 lite; shared night pair 2. The capacity sums are 19 full / 16 lite in all three themes. Saved plant samples peak at 8 full / 5 lite, giving component-peak sums 18 / 15. Furniture, planting and light maxima are not measured in one renderer frame. In particular, the night sampling loop runs separately from the planting loop and the latter does not retain its peak camera. Calling 18 / 15 a simultaneous GPU peak would be false.

There is a further source-level distinction: `runtime/corridorArt.ts:96` makes the contact shade transparent DoubleSide. Installed `three/src/renderers/WebGLRenderer.js:2133–2151` issues a back/front pair when `forceSinglePass` is false. The current CPU budget counts this mesh once. Its per-mesh totals therefore are not a guaranteed upper bound on real WebGL submissions. A visible shade mesh can add another submission. This study does not silently set forceSinglePass or change any material.

A renderer audit must retain the old capacity report unchanged, explicitly record whether its asset hashes match, count every actual submission including invisible-by-shader/faded work, and keep sampled success separate from an exhaustive budget gate.

## The actual Lakeside planting

Current baked inventory has 19 full items: 4 pine, 7 birch, 2 round trees, 4 shrubs and 2 heath. The 13 trees supply 13 contact shadows. The table reports horizontal root-to-nearest-native-tree distance; it is not visual-substitutability evidence.

| Group | Lakeside items | Nearest native woodland | Baseline provenance |
|---|---|---|---|
| `VG.plant.framingTrees.1` | pine 1, birch 1, round 2, shrubs 4 | 293.33–304.98 m | All VG planting exactly equals the baked integrated-main `1cf76c5` baseline: 12 groups. |
| `V03.plant.framingTrees.1` | pine 1, heath 2 | 56.05–61.53 m | All V03 planting exactly equals that baseline: 2 groups. |
| `spur stillwater.plant.framingTrees.0` | birch 6 | 37.21–46.34 m | New corridor, absent from baseline. |
| `mountainV2.road.plant.framingTrees.0` | pine 2 | 15.35 / 20.67 m | New corridor, absent from baseline. |

The VG grove is around x972–980/z879–892/y26–31, outside the carried Mountain footprint and far from its woodland. There is no native-woodland replacement case for deleting this inherited grove. The two new Mountain pines' nearest native crown is only 1.138 m in radius, so these roots do not describe coincident canopies either. A claim that the native forest supplies an equivalent view would need visual evidence.

Removing only the two new Mountain pines saves **zero layer draws** because VG/V03 retain pine. Removing only the six new Stillwater birches also saves **zero layer draws** because VG retains birch. Even removing all Mountain, Stillwater and V03 planting (the last is inherited) leaves VG with 8 full / 5 lite plant layers, hence nominal 18 / 15 including current furniture and shared night. Any retained full tree needs at least body + shell + contact (3), while furniture + night is already 10: nominal 13 before other plants. Pruning cannot meet the full portable capacity limit while keeping any Lakeside tree under this architecture. Deleting all trees would destroy the authored local variety and inherited grove; it is neither supported nor proposed.

## Conditional rendering option, retained only as a choice

The smallest concrete batch design found would preserve each prototype once and add matrix instances through installed Three 0.185.1 BatchedMesh:

- One furniture body batch for the four present Lakeside kinds: roadLantern, bridgeLantern, tunnelLamp, railPost. Existing merged markings/card/shade/ink remain. Nominal furniture 8→5.
- One shared tree-body batch across birch/pine/round and one full-only ink-shell batch. Preserve the exact prototype geometry, colors, per-prototype wind amplitude (.022 for birch/round, .012 for pine), per-instance wind phase, far radius, birth time and trunk color. Matching depth shaders are required. Bush, heath and contact layers remain separate. Nominal plants 9→5 full, 6→4 lite.

That projects nominal Lakeside capacity to **12 full / 11 lite** including the global night pair. It does not prove actual calls (the shade double pass above can make that 13 / 12 when visible), appearance, performance or device acceptance. With `WEBGL_multi_draw` unavailable, Three loops over instances; retaining the current instanced fallback is necessary and leaves unsupported devices at the current 19 / 16 nominal totals. Therefore it is not a portable acceptance fix and is not implemented.

This is a moderate renderer change, not a one-line bucket merge: `kit/plants/materials.ts:43–67` currently relies on USE_INSTANCING, instanceMatrix and custom aFar/aBorn/aTrunk attributes. A batching metadata texture plus matching depth path, stable material lifecycle, seasonal rebuild, residency/probe semantics, disposal and statistics would be required. The present CPU budget assumes isInstancedMesh and would undercount such a batch unless changed. A large framework or ordinary transformed-geometry duplication is unnecessary and not proposed.

If later pursued, bounded validation must compare exact prototype attributes, per-instance matrices/colors/fades, seasons, all themes, full/lite, shadow/depth behavior and rebuild/disposal; measure real render calls on supported and fallback backends; preserve unchanged shared 6/2 point lights; and retain the current shapes. None of that validation has run here.

## Temporary actual-renderer audit

`/tmp/mountain-real-draw-proposal/renderer-audit.mjs` and `renderer-audit.page.ts` are an unrun count-only harness. They bundle the existing art, planting and light builders, use frozen served assets and existing route/lamp/plant camera inventory plus an authored aerial and optional captured poses, and record real renderer.info calls per isolated district/season/day-night frame. There is no implementation patch. See the adjacent HANDOFF before running after the heavy slot is released. Sampled peaks cannot be used to waive ROAD §8 or to claim an exhaustive maximum.
