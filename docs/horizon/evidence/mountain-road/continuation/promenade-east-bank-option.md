# Dam promenade: smaller east-bank connection, source-only candidate

Status: concrete plan/profile candidate, not built or controller-verified. No approval is assumed. The old straight east connector and submerged western stairs remain failed options.

## Exactly what is missing

`src/harbour/horizon/land/mountainV2/beds.ts:85–89` takes the 13 exported `V2.dam.promenade` points, finds the nearest road sample, appends that point, and applies `regionCarry(b)` to the entire resulting bed. That last segment is the 24.522 m line from H(1337.86,142,526.54) to H(1355.031336,144.735683,509.033424). It is metadata for a carried route, not an existing native physical direct connector.

The source export at `scripts/horizon/dump-mountain-v2.mjs:58` gets those 13 points from `DAM_PARTS.promenade`, a radius 25.2 arc including its endpoints. Native `pathGraph.ts:141–155` instead creates a 37-point physical crest whose endpoints are on the radius 24 dam arc, then connects its east end to the pavilion by a separate ground path. That native crest endpoint is H(1336.818157,142,525.941705),1.2 m from the current Horizon metadata endpoint. There is no native `dam:east→nearest road` edge.

Native paths that do exist are `path:dam:east~door:pavilion`, `path:door:pavilion~district:reservoir`, `path:road:reservoir~district:reservoir`, and `path:station:funicular:reservoir~dam:east`. Their source profiles are not a ready replacement: the east→pavilion path falls from142 to123.469 then rises to144. Its ordinary `path` geometry is not among `WORLD_SURFACES` walkable decks. The new proposal must not declare those existing lines traversable by assertion.

## Candidate

A 2.4 m wide bank stair/walk on the west side of the pavilion, from the ACTUAL native crest endpoint to the road's west/left edge near source sample 810. Coordinates and source hashes are in `/tmp/promenade-east-bank-plan.json`.

| Horizon point | Height | Purpose |
|---|---:|---|
| 1336.818157,525.941705 |142.000|Actual unchanged crest endpoint|
|1340,523|143.700|Short climb on bank|
|1343,520|144.700|Upper stair landing|
|1345.4,517|145.050|West of pavilion|
|1345.4,512|145.200|Approach from outside the road|
|1350.471059,510.991681|144.909018|Actual road sample810 left edge, at drawn top|
|1354.411249,508.250348|144.909018|Existing road center, reference destination only|

Total plan length 27.388 m; only 22.588 m is a proposed new link, followed by 4.8 m across the existing carriageway. Its road endpoint moves one source sample (~1 m) along the same road from the failed metadata connector. Maximum center profile grade 39.231%=21.420°, appropriate to a short stair flight; this is not a 12% wheeled ramp. Lowest floor 142 gives 2 m clearance above the full reservoir level 140. The existing dam crest and native road centerline/profile remain unchanged.

Recorded-source arithmetic at ≤0.1 m center spacing, using the entire 1.2 m half-width envelope, finds:

- 0.604 m minimum clearance to the recorded body-height static AABBs (the limiting box is an existing branch support near the crest).
- 0.275 m clearance outside the whole rotated pavilion roof footprint, so no column or roof move is proposed.
- 5.667 m clearance to recorded native non-kerb body guards.
- No overlap with the legacy 1.7 m half-width skill branch projection. The minimum 0.073 m is at the destination already inside the existing road, not in the new bank link. Final landing triangles are NOT represented in this source snapshot; they must be checked before accepting the approach.

These are necessary geometric constraints, not complete geometry acceptance. Terrain/footing depths, the final exact road-edge join and full-width corner surfaces remain unmeasured. The plan uses no new landmark span; a short deck or stepped bank retaining structure supplies actual support.

## Ownership and choices

The missing connector is a Horizon route. A Horizon-owned physical stair/walk can be added without moving native road, dam, columns, skill branch or crest. It should use the existing exact native crest points from `V2.nativePlanning.walks`, carry only the crest portion, and own the new external connector's drawn closed mesh, floor, side/support geometry and guards. Surface queries must read that same mesh. Clip the new deck at the actual drawn road footprint; never lay a ramp slab across the through carriageway.

There is an existing native 0.22 m drawn kerb at the proposed mouth (0.17 m above the road's 0.05 m painted top). Two honest join choices:

1. Preserve the native kerb and terminate the walking approach at its outside face, treating it as an ordinary walking step. This avoids native edits but requires a real bidirectional walking check; do not claim a flush join.
2. If a flush mouth is required, cut one visible approximately 2.8 m opening in that kerb only. This is a specific native edge-art change needing Jonathan's choice unless independently authorized. No guard over a drop, native road top/profile or bridge changes are proposed.

Do not move pavilion column4, lower water, remove the western submerged stairs, or relax collision/walking tolerances. Any footing that intrudes on an existing usable lower path must move or use an open support bay; do not close it under fill.

## Proposed source changes after feasibility verification

- `land/mountainV2/beds.ts`: replace the misleading carried straight link with actual source crest points and this explicit connector; restrict `regionCarry` to the crest.
- New `land/mountainV2/promenade.ts`: one Horizon-owned physical connector mesh, with bounded bank support, exact native road-edge conformance and side guards where the actual drop requires them. Keep its source floor triangles common to drawing and contact.
- Existing shared region-ground ceiling consumer: only if needed, clip visible Horizon ground under the new physical deck; preserve native terrain source and any lower passage. Do not add a query-only ground override.
- A small geometry regression should use the native road triangles, roof envelope, full-width tread/landing samples and branch landing rows; then actual ordinary walking both directions with zero resets.

No source patch is offered as implementation-ready until the missing ground/full-width support measurements are available. The next bounded probe should measure this ONE plan against actual native ground and exact current branch landing triangles, derive support footings, and prove both ways with the actual walker. After that, root can decide whether this is wholly within Horizon authority or whether the optional tiny kerb-mouth change needs a separate question.
