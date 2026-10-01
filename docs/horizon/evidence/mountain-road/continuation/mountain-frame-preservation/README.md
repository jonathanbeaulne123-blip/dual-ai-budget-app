# Approval-only road-frame preservation amendment

Not applied and not executed. All files are under /tmp. Native bend approval is still pending.

- Complete replacement proposal: /tmp/PROPOSAL-native-road-frame-fairing-preserving-scenery.patch
- Delta over the old frame proposal: /tmp/native-road-frame-scenery-amendment.patch
- Do not apply both.
- Seven affected files: roads.ts, new roadFrameFairing.ts, new roadPlacement.ts, planting.ts, art/placements.ts, art/townArt.ts, course.ts (all under src/harbour/mountain).

The physical normal remains authoritative for the road deck, kerbs, retaining/edge rails, branch road join fitting and body edge queries. Only scenery reads placementNormal, which is the exact original normal retained before fairing. Default unchanged samples have no extra field. roadSampleAt interpolates the original frame as well as the physical frame when needed.

The race geometry key now includes the actual full road footprint inputs (at, normal, halfWidth), because physical frame changes invalidate prior race timings even though gate positions and course centres stay the same. The comment now explicitly distinguishes preserved skill-rail points from road edge rails that follow repaired frames.

## Consumer audit

Every native road-normal reader was searched, including indirect facade imports.

- planting.ts: avenues, hedges and roadside tufts use the original placement frame. All seed calls, candidate order, acceptance branches and occupancy remain unchanged by this amendment.
- art/placements.ts: besideRoute position/yaw and district side choice use original frames.
- art/townArt.ts: the town gate piers/lintel use original frames, even though the proposed bends do not change sample 6.
- art/routeArt.ts, art/bridgeArt.ts, roads.ts edge runs/openings, damEntry.ts and body/geography.ts retain physical normals.
- scene/groundPaint.ts stamps at + halfWidth only; crossings.ts uses at + halfWidth only; mapBuild.ts, townSquare.ts, course.ts, spots.ts and art/propArt.ts add no unhandled road-normal scenery dependency. roadSampleAt has no external scene caller, but its extra frame is interpolated correctly for future use.
- Ground samples and scenery-clearance helpers use unchanged centres/widths/terrain. Actual whole-output comparison is still required rather than inferred from source alone.

## Queued proof

Run prove.mjs with checkout path and --execute ONLY after the root releases the execution slot. It serially bundles current source and the /tmp proposal in isolated module graphs, then compares exact JSON bytes for full and lite planting (all trees, shrubs, flowers, tufts), all props, placement inputs, complete branch payloads, first skill rails, and bridge frames/objects. It additionally requires changed road footprint and changed race revision. No checkout writes. No execution has occurred and no byte-equivalence is yet claimed.

This A/B proves that applying the proposed fairing does not ADD a scenery change to the current checkout. It does not establish that current scenery already matches the historical baseline: changed branch keepouts are a separate existing RNG input, addressed in branch-keepout-plan.md.
