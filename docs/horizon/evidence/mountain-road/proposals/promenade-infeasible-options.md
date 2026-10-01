# Dam promenade review option — NOT approval-ready

No checkout edits. No route approval assumed. No new span, native terrain, water, collision or rail modification.

## Verdict

The western existing-stair route is geometrically shorter and less disruptive than a new east-side span, but **reuse plus art alignment is not presently a feasible continuous walking route**. The real extracted controller enters reservoir water. Do not ask Jonathan to approve this option as ready to build.

The old east connector is 24.522 m at 11.156% grade, up to 6.015 m above terrain. It intersects pavilion column 4, then passes only 0.210 m beneath native road. A simple apron on its centerline is invalid.

## Measured western route

| Measure | Value |
|---|---:|
| Lower road entry H(x,y,z) | (1268.305696,121.380449,534.766325) |
| Stair/crest junction | (1295.181843,142,525.941705) |
| Crest east end | (1336.818157,142,525.941705) |
| Full lower-road approach and stairs | 36.400007 m |
| Existing built stair after road clipping | 31.126430 m |
| Crest | 52.968944 m |
| Combined route | 89.368951 m |
| Difference from old 77.372514 m route | +11.996437 m |
| Road-entry station change | ~201.45 m lower along the native road |
| Stair rise / maximum grade | 20.619551 m / 72.899690% = 36.091933° |
| Stair / crest width | 2.8 / 3.6 m |

This is stair access from the lower road, not a level continuation from the old road entry. The north-side body-center line at 0.6 m offset had no static obstacle/headroom failure, but those preliminary samples did not check water and are **not** walking acceptance.

## Real walking result — exact reason retained

`/tmp/promenade-west-real-walk-water/results.json` uses current extracted `runtime/index.ts move()` and actual baked/dynamic geography. Ordinary walking inputs after one initial placement; zero resets. Both attempts fail:

- Forward: 24.47/89.00 m, H(1283.301444,132.961756,522.486123); next stair floor132.990916, reservoir water140.000.
- Reverse: 54.75/89.00 m, H(1292.246478,139.725061,524.626524); next stair floor139.695902, reservoir water140.000.

`leftSupport` is true because actual water lies above the next support floor; this is neither a cache issue nor a tolerance-only test failure. `/tmp/promenade-west-water-width/water-width.json` then probes seven body-center offsets from −1.05 to+1.05 m (existing1.4m half-width less0.3m body and0.05m margin) every≤0.25m. **33 cross-sections are wet at all seven offsets**, from route station25.531724 through33.092269 m. A simple lateral sidestep cannot be accepted as the dry solution. No water envelope was changed or ignored.

## Approval-only native art alignment

`/tmp/mountain-dam-stair-art-alignment.patch` changes only shared `mountain/art/routeArt.ts`. Only edge `stair:dam-west-steps` opts into height alignment. It retains all69 tread plan centers, yaw, half-width, depth, source endpoints, source route/collision/profile, cheek walls, rail and posts. Every other stair retains its exact formula. Dependent tread foundation/leg heights follow corrected tread tops using existing construction logic.

Each existing tread top follows the midpoint of the source-profile heights at its four corners. This handles the landing and the bends; merely using center height leaves0.325740m full-width mismatch and was rejected. The final candidate measures **0.271393m maximum** discrepancy against the existing continuous profile, below its **0.298834m existing riser**. Center discrepancy≤0.074497m. Old tread geometry maximum discrepancy was1.468703m over the same footprint.

`/tmp/mountain-dam-stair-art-proof.mjs` extracts and executes actual candidate `stair()` with a recording CardBuilder; 21×21 points per each of69 emitted tread tops within collision half-width. Full and lite both pass unchanged plan/cheek/rail/post comparisons and the existing-riser assertion. Ground and colors are stubbed for this tread-only proof because neither affects tread top/plan; foundation visibility still needs rendering. Shared `buildRouteArt` is called by native `mountain/landscape.ts:56` and Horizon `regions/mountainV2/scene.ts:112`, so the one scoped source correction serves both worlds. This is emitted geometry proof, not screenshots or native-controller proof. Three themes affect palette only.

Patch applies cleanly (`git apply --check`). It remains an independent approval-only art repair and does not resolve submerged stairs. No route source patch is offered as feasible.

## Source/version and artifacts

- Probed world gzip SHA256: `dd252b36ff5d5ded6ea059a6d9d3ecaa9e00fef49ffb8e28a8ba878ba83f0f35`.
- Terrain SHA256: `908a33ea9a00114444ad14164b37306699578614eb33961bb9bc6e6943c8f948`.
- Original routeArt SHA256: `2e9de0d8a75673a0ce59831f436b8c0fa0fffd4ffae3aff06d9ee02f86dfb37c`.
- Diagram: `/tmp/mountain-promenade-choice.svg` (deliberately labels the water failure).
- Art numeric proof: `/tmp/mountain-dam-stair-art-proof.json`.
- Exact attempted north-offset route and unchanged original source points: `/tmp/promenade-west-real-walk-water/routes.json`.
- Static native points/profiles/solids: `/tmp/promenade-options.json`.
- Original connector evidence: `/tmp/promenade-source-envelope.json`.
- Re-run art proof: `node /tmp/mountain-dam-stair-art-proof.mjs "$PWD"` from worktree. It writes only /tmp; requires existing /tmp/promenade-options.json snapshot.

## Summit requested earlier

No bidirectional verified summit detour exists in my evidence. `/tmp/summit-east-movement-2/routes.json` has the least disruptive east-side trial: forward completed43.65/44.13m, reverse entered air at H(1316.011396,158,472.158334), leaving Commons for157.519715m ground. Other detours hit existing Crown stair supports. Do not label this one-direction trial as an approved/verified two-way route. Root's current summit work supersedes it.
