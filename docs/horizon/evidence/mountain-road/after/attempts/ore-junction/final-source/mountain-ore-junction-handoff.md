# Ore south portal physical junction proposal

Initial patch: `/tmp/mountain-ore-junction.patch`; final apron-boundary delta: `/tmp/mountain-ore-apron-boundary.patch`. Both applied by root. Root sole writer; no checkout changes made by this agent.

## Scope and geometry

Only Horizon lining, its existing apron, and exposed Horizon mouth terrain change. Native Mountain roads/ground, Ore points, rail heights, and rail meshes remain fixed. The original 9.6m carriageway and portal plan position are retained. Stone infill occupies the last 3.8m of the Ore approach, 1.08m across its fixed rail heads, 5mm below the rail tops. Faceted ramps fit the approved 28m road reach (18m downhill +10m uphill maximum).

Actual crossing occupied reach: -16.645375 to +1.035147m relative to portal projection: 17.680523m. Plan bounds x1344.037204..1361.145189, z676.962728..684.197912. Maximum lift over the original road:209.559mm. Maximum emitted top-triangle grade:11.5000000001%;904 crossing triangles,454 vertices,0 non-manifold edges. Road width is not extended.

Roof and wall lining end at the unchanged south portal frame. The final roof is reshaped over the new real floor with10mm allowance; lintel is raised110.189830mm. Covered Ore clearance is at least3.2m above the actual highest floor. There is no remaining finite roof above the sampled carriageway: the full5m road headroom criterion passes. Upper road crossing over Ore stays fixed: sampled minimum native collision underside clearance5.583842506m above Ore bed (native underside uses top−0.28m; this is the existing collision convention, not a newly drawn closed soffit).

The existing mouth's full/lite Horizon lattice is capped below both the native road and the visible Ore floor. Capping only below the road had brought previously overhead earth into the Ore envelope; that failed intermediate cap was corrected. Full/lite sampled exposed earth is now at least142.469/303.141mm below the road.29 local full-resolution vertices were lowered relative to the fresh merged bake. A grounded0.55m retaining face supports the exposed road edge outside the cart aperture; rail supports remain readable and are not moved.

## Validation

Fresh merged input world gzip SHA256:09d23d7f69ba638b78277afb6ecf804e358bb3a2d2e452fb67c181286d403bae. Source-generated candidate solids replaced only local baseline solids; full terrain plus source candidate cap, current production mouth exclusion and always-loaded native region supplied geography. No full bake/browser/streaming/device validation was run by this agent.

- `/tmp/mountain-ore-junction-candidate.json`: physical source/collision measurements.
- `/tmp/mountain-ore-crossing-modes-final/results.json`: actual bicycle and extracted unchanged walking move().
- `/tmp/mountain-ore-crossing-modes-final/native-results.json`: actual native skate driver plus Horizon adapter.
- `/tmp/mountain-ore-crossing-modes-final/routes.json`: one approximately35.08m road route, offset2m into the lane that intersects the actual rail heads; forward/reverse independent starts, ordinary unchanged pursuit inputs.
- `/tmp/mountain-ore-focused-proof.mjs`: six focused test bodies passed using a Node assertion shim for Vitest expectations. Root should run the actual checked-in Vitest file after applying; this was not a Vitest runner execution.
- `/tmp/mountain-ore-source-triangles.json`: same underground source builder before/after,36,204 →38,544 triangles, net+2,340. Full baked/district/Lite budget remains root's gate.

| Attempt | End | Restarts | Contacts | Airborne | Off-bed | Bails |
|---|---|---:|---:|---:|---|---:|
| Bicycle forward | complete |0|0|0|0|0|
| Bicycle reverse | complete |0|0|0|0|0|
| Walking forward | complete |0|0|0|not applicable|0|
| Walking reverse | complete |0|0|0|not applicable|0|
| Native skate forward | complete |0|0 sampled|0|not exposed|0|
| Native skate reverse | complete |0|0 sampled|0|not exposed|0|

Native contacts retain the audit's1Hz snapshots; bicycle/walker contacts were checked each frame. No automatic recovery, assist, jump, snap, or tuning change. Maximum lateral route deviation0.110447m. Native max speed4.0951/4.3194m/s. This is one short crossing, not a full route claim. Off-bed cannot be inferred as zero for modes that expose no legal-bed metric. Camera collision callback is omitted in headless bicycle/walker proof; body geography is unchanged.

The final station apron is clipped exactly to the actual native road triangle footprint, with212 source triangles. Its previous mixed edge cell overlapped the explicit crossing by10.929868mm and reached13.1818013% grade; the final regression now queries that actual highest floor plus the surrounding dense edge samples. The boundary delta adds68 triangles relative to the first source proposal.

## Retained failures and diagnostic limits

- `/tmp/mountain-ore-junction-interpolated-failure.json`, `/tmp/mountain-ore-interpolated-failure-api.mjs`, `/tmp/mountain-ore-interpolated-failure-cuts.json`: first interpolated crossing exceeded grade at15.2142953%; it is not a pass. Explicit ramp-facet clipping replaced it.
- `/tmp/mountain-ore-mixed-apron-failure.json` plus its matching API/cuts snapshots preserve the13.18% mixed-apron failure.
- Earlier floor-only shape left fixed rail heads up to210.506mm above the native road and was not considered a completed crossing.
- The lintel height progressed from43.895mm (bed-only) through96.525mm (failed ramp) to110.190mm (final profile), plus final roof allowance10mm; all remain Horizon-only source join repair.
- The initial test asked the runtime to stand on exact serialized outer-edge coordinates. Some source points lie fractions of a millimetre beyond the runtime triangle after serialization; at one edge it selected the lower bank. The5m roof test now measures above max(actual source road top, reachable floor), so it tests carriageway clearance rather than an outside-bank floor. Ordinary controller lane samples do not use this adjustment. Native source is unchanged.

## Files and integration

Existing file edits: `land/underground/build.ts`, `land/terrain/index.ts`, `land/mountainV2/joins.ts`. The joins change extracts its existing exact road sampler unchanged, permitting lazy import from terrain. New files: `land/underground/oreRoad.ts`, `land/mountainV2/roadSource.ts`, `test/horizon-ore-road-junction.test.ts`. The final boundary delta touches only oreRoad.ts and its focused test; root tuple/index fixes are preserved. These should not overlap the Foot helper or native Dam generator edits. The patch was made against root-current source; root should apply/test before its final bake.
