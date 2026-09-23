# Skate v2 · PARK track notes

Branch `claude/skate-v2-park`. Owns `src/harbour/skate/world/**`, `park.ts`, `parkScene.ts`, `test/skate-world*.test.ts`.

## API

| Call | Gives |
|---|---|
| `createSkateField(ground, { tier? })` (`world/field.ts`) | `SkateWorldField`: the contract's `SkateField` plus `tier`, `ground`, `pads` (plane, apron, shapes, rails, planters, posts), `heightAt(x,z)`, `sampleInto(x,z,out)`. Grindables carry `featureId` and, on curved bowl coping, per-point `faceYaws`. `asSkateField(f)` proves assignability. `tier` does **not** change physics. |
| `skateFieldFor(ground)` (`park.ts`) | The same field, cached per ground function (built once, about 20 ms). |
| `buildSkatePark(dressing, { tier?, field? })` (`parkScene.ts`) | `{ group, field, checkpoint, update(snapshotLike), dispose() }`. Pass the sim's field so render and physics share one instance. |
| `buildParkMeshData(field, palette, tier)` (`world/meshes.ts`) | Pure geometry buckets, one per material, plus `checks` (every top vertex) for render == physics tests. |
| `SKATE_SPOTS`, `SKATE_ROUTES`, `SKATE_DECKS`, `SkateSpotId`, `SkateRouteId`, `SkateDeckId`, `skateSurface` | Same names as v1, now backed by v2 (`park.ts`). |
| `SKATE_KEEP_OUTS` | Oriented pad + apron rectangles in planting's `KeepOutRect` shape. They fit tighter than the spot AABBs. |
| `SKATE_RAMPS` (empty), `rampRise/rampWorld/rampLocal`, `SKATE_RAILS`, `railPoint` | Deprecated v1 shims so `skateModel.ts` still compiles. |

## Conventions the SIM must honour

- **Composition.** `y` is the MAX of the island ground, each pad and each feature. A pad is a least-squares plane lifted 0.042 over the ground and falling to the lawn through a C1 apron at slope 0.35. A feature's height is its pad plane plus the feature profile. Features are sheared onto the plane, so a lip's real angle is the authored angle ± the pad's tilt. Tideline's tilt is at most 1.4° (a drainage fall of 0.025). Street pads follow the land up to 0.06–0.09.
- **Rideable blocks are in `sample()` at their top**: manual pads 0.16–0.18, curbs 0.12, bench seats 0.38, ledges 0.3, stair treads (rise 0.12, run 0.34), platforms 0.6/0.72, hubba tops, funbox tops, the pier deck 0.4. Every stair riser and block side is a grounded step over 0.06, so the sim treats it as a wall going up and a drop going down.
- **`solids`** holds only never-rideable things: lantern and sign posts, bollards, planters (`obox`, top = the highest rim corner) and rail feet (`r` 0.03, top just under the rail tube). `top` is absolute y. Island obstacles are **not** included, so merge `courtObstacles(tier)` yourself.
- **Lips.** `lip` is set on the last `LIP_BAND` = 0.15 of every transition: quarterpipe, mini and bowl coping, plus the kicker end, where `kind` is `'metal'`. `lipYaw` is the uphill direction, the way you leave the ramp; it is opposite the horizontal part of the normal. `vert` is true on EVERY coping lip — quarterpipe, mini and bowl — whatever its angle (integration 2026-09-23, per the sim's contract: airs off a transition go straight up and come back in; pumping the Breadbin climbs into airs above the coping). Kicker lips are the only non-vert lips. On tight radii the strip starts near 60°. **Launch where the rider leaves the strip on its uphill side** (the coping line), using the normal there. Do not launch on entry.
- **Normals** are analytic on every skate surface. Open ground uses a central difference of the injected ground function. The island ground steps down at r = 84 under the sea, so that gradient is clamped to 84° to keep `ny ≥ 0.1`.
- **Grindables** are TOP lines. Coping sits at the lip + 0.03 (pipe radius 0.042). A rail point is the top of its tube (radius 0.034). A ledge, bench, curb or hubba point is the block's top edge. `faceYaw` means: for ledges, benches, curbs and hubbas, the direction the vertical face looks, away from the block; for coping, the direction the transition face looks, into the ramp and opposite `lipYaw`. Bowl coping is split into four runs (+x, +z, −x, −z) that share end points. Treat a run end as a `transfer` exit.
- **Allocation.** `sample()` returns a fresh object, which the caller may keep. `sampleInto` writes into your object and allocates only a `lip` object on lip strips. `heightAt` returns height only. 100k mixed samples take about 55–75 ms on this box.
- **Surface kinds**: `concrete` (pads, aprons, bowl, banks, stairs, ledges), `wood` (quarterpipes, the mini, kicker bodies, benches, the pier and slipway), `metal` (kicker lip plate), `path` (within 0.9 of a lane), `cobble` (village square, r ≤ 10.4), `sand` (r > 58) and `grass` elsewhere. The sim decides friction.
- **Water** is not a `SurfaceKind`. Use `HARBOUR_LAND.shore` (73.2) or `y < SEA_LEVEL`.

## Tideline Park (flagship)

Frame: island (18.6, −38.3), yaw 150°, between the Fund bank and the Boathouse on the lawn's crown. The pad is 29 × 20 with rounded corners. Local −X is the Boathouse end, +X the Northlight end, and +Z faces the north shore (gently downhill).

```
 Z−10 ┌──────────────────────────────────────────────────────────────────────────┐
      │ KETTLE bowl block (deck 1.1)  │roll-in│  Breadboard manual   │ CHIMNEY 1.9  │
      │  X −13.6…−5.8, Z −9…−2.6      │ bank  │  X 2.5…6.1           │ vert 84°     │
      │                               │→ −X   │                      │ X 11…14.1    │
      │ HOB quarter (1.1, 62°) ↓      │       │ Rolling Pin bar Z−3.4│              │
 Z 0  │ toe Z −0.8                    │       │        CAKE STAND funbox + Teaspoon│
      │                          ◄ Hatch down-bank │landing│ planter │ kicker ◄ launch −X  │
      │ BREADBIN mini (0.85)  │roll-in│                 │ Sill bank ↑ + Sill   │
      │ X −12.3…−5.7          │ bank  │   Lantern Steps ◄ 5-stair · Mantel hubba│
 Z 10 └─────────────────── Dunking Bench ───────── Lamplighter rail · terrace 0.6 ┘
```

**Lines that are meant to link** (g = 15 in v1; the heights below need these toe speeds):
1. **First Light (transition to vert).** Carve the Hob → ride up the Kettle roll-in onto the deck → drop into the Kettle (1.1, needs ≥ 5.8 u/s) → carve the pocket → pump back out over the roll-in and down it heading +X → manual the Breadboard → 13.8 units of runway → air the Chimney (1.9, needs ≥ 7.6 u/s; at 10 u/s you clear the coping by about 1.4) → come back down heading −X.
2. **Hob to Hatch.** From the Chimney, head −X along Z ≈ 2.5 → kickflip the Hatch (0.5 lip at 38°) over the planter. The gap is 2.55 to the landing block and about 4 to the down-bank at 8 u/s → land rolling −X → carve the Hob wall. Or keep going up the Breadbin roll-in and drop into the mini.
3. **Lantern Steps (street).** Ride up the Sill bank (0.6) → bank-to-ledge the Sill (0.9) or roll through the gap onto the terrace → head −X → kickflip the five-stair, 5-0 the Mantel hubba, or boardslide the Lamplighter handrail (0.36 over the nosings) → land heading −X down the long lane toward the Breadbin roll-in.
4. **Cake walk.** Roll out of the Hatch landing, loop back along Z ≈ −1 heading +X → up the Cake Stand's −X bank → 50-50 the Teaspoon kinked rail (flat over the top, down the +X bank, flat out) or crooked the Cake Stand ledge → carve left into the Chimney, or right up the Sill bank.

Also here: the Dunking Bench, six paper lanterns, the sign (village side), a kitty-paw stencil trail, a hearth stencil in the Kettle floor, and lanterns stencilled on the Kettle block.

## Street spots

| id | Where | What | Words |
|---|---|---|---|
| `bookends` · Bookends Square | (−14, −6), between the west road and the library lane | Two planter "bookends" whose rims are ledges, the Reading bench, the Westway curb along the road side | Low ledges. Long lines. One more try. |
| `fundsteps` · Counting-House Steps (new) | (15, −16), by the Fund bank | 0.72 landing, six-stair, two handrails (Ledger, Tally), side banks up, the Counting ledge on top | Six steps down from the Fund. Count them on the way. |
| `drydock` · Drydock Pier | (52, −32), on the Boathouse shore | Slipway bank onto a plank pier (0.4) whose edges are ledges, bollards, the Mooring rail | Salt air and a rail all the way home. |
| `orchard` · Orchard Culvert | (−42, 39), below the orchard | Two berms (C1 banks, hips at the ends) make a drainage ditch, with the Culvert rail down the middle and painted rain-waves | The rain found this line first. |
| `northlight` · Northlight Run | (−12, −48), beside the lookout lane | Beacon kicker at the top of a long downhill strip, the Lighthouse rail, the Keeper's ledge and the Point quarterpipe to turn round | The island ends. The line goes on. |
| `tidepools` · Tidepool Promenade | (46.2, 31), along the tide-pool path | Promenade curb on the path side, two benches, the Shell manual pad | Save a little speed for the way back. |

## Routes

Ids are unchanged. `first-line` is now a seven-gate lap of the new Tideline. The `coast-run` gate at (48, 31) moved to (50.8, 30.5) so it stays on the path and off the promenade curb. The others are unchanged. Tests check that every gate is on open ground and that every segment is clear in both planting tiers.

## Render

`parkScene.ts` builds one merged mesh per material:
- pads (receive shadows only, `polygonOffset` pushed back so coplanar floors win);
- card features (cast and receive; flat-shaded strips so a transition reads as folded card);
- steel (coping, rails, feet, bollard caps);
- paint (stair nosings);
- wax (full tier only);
- stencils (a 2×2 CanvasTexture atlas: lantern, hearth, kitty paw, wave);
- paper lanterns (unlit);
- one ink `LineSegments` for every cut edge.

That is 8 draws, plus one engraved plate per spot (7; their posts are in the card mesh) and the checkpoint ring and arrow. Paper grain and pencil hatching come from a runtime CanvasTexture. Palettes are authored per theme in `world/palette.ts`: Newfoundland's ramps are jellybean teal and mustard with red decks. The lite tier halves the arc and corner segments, uses 6-sided tubes and drops wax. Canvas-dependent pieces (textures, plates) are skipped when `document` is absent (tests).

## Integration must

- `scene/runtime.ts`: `buildSkatePark(dressing, { tier, field })`. Share the sim's field.
- `scene/planting.ts`: nothing required, because it reads `SKATE_SPOTS` rectangles. There are now **7** spots, so the trees re-sow. Optionally use `SKATE_KEEP_OUTS` for tighter oriented keep-outs.
- `body/places.ts`: nothing required. `skateSurface` is v2, so walkers follow pads, ramps and ledges.
- Sim: merge `courtObstacles(tier)` with `field.solids`.
- Integrated 2026-09-23: `skate/driver.ts` rides `skateFieldFor(groundHeightAt)` and `runtime.ts` builds `buildSkatePark(dressing,{tier,field})` from the same instance; island obstacles + `holdAshore` are merged in by `skateSimOptions`. The v1 ramp shims and `SkateSpotEntry.yaw` are gone (use `startYaw`).

## Honest gaps

- No browser or GPU verification. Geometry was checked by tests, and the look by a throwaway software rasterizer (not committed).
- The island ground mesh is coarse (1.3 × 2.6), so the line where an apron meets the lawn is a zig-zag at the island mesh's resolution.
- Rails are straight polylines over a gently sloped pad. Their clearance is tested (≥ 0.12), but a rail's height above the surface varies by a few mm along a fillet.
- The contract's `SurfaceKind` has no `water`. Bowl coping uses per-point `faceYaws`, an addition to the contract.
