# Footway audit: frozen highest-floor bake

34 independent walking attempts;19 end,15 fail, including2 January duplicates of Year Walk part5. No retries or suppressed invalid/air/stall outcomes. World gzip SHA fdf25dfa4bcf4f35e3fa89a4ae09b7f6acd7ec7a8d0252221941be8b1918560a; raw JSON SHA ac6e97395e5eb1a0c7e85a896db3ad003a4fd01b6516193147df98ba068bc458; HEAD750150f887f96ba1fa991056f23fe3f66345a769. Full frozen inputs: /tmp/mountain-footways-run-versions.json.

|Source bed / independent route|Forward|Reverse|Source range|
|---|---|---|---|
|walk mountainV2.promenade|stalled-no-progress-5s 52.95/76.87m|stalled-no-progress-5s 5.00/76.87m|0–13|
|walk crown|stalled-no-progress-5s 207.18/703.77m|stalled-no-progress-5s 69.85/703.77m|0–711|
|walk summit|stalled-no-progress-5s 16.00/45.40m|stalled-no-progress-5s 22.12/45.40m|0–10|
|walk summitStation|walking-airborne-handoff 5.40/16.05m|stalled-no-progress-5s 10.04/16.05m|0–4|
|crownLaunch.stair|end 16.53/17.02m|stalled-no-progress-5s 2.17/17.02m|0–2|
|walk footQuay|stalled-no-progress-5s 64.83/69.16m|stalled-no-progress-5s 3.12/69.16m|0–17|
|walk lakerim|end 472.03/472.52m|end 472.03/472.52m|0–97|
|southPortal.link|end 0.88/1.37m|end 0.88/1.37m|0–1|
|yearWalk mountain/Stillwater part 1|end 534.27/534.74m|end 534.27/534.74m|0–172.27091920349065|
|yearWalk mountain/Stillwater part 2|end 63.52/63.99m|end 63.52/63.99m|735.1636171780758–753.9773853720492|
|yearWalk mountain/Stillwater part 3|end 44.32/44.81m|end 44.32/44.81m|2005.5741113348572–2019.653438629233|
|yearWalk mountain/Stillwater part 4|end 93.12/93.59m|end 93.12/93.59m|2432.84517460875–2460.887198608612|
|yearWalk mountain/Stillwater part 5|stalled-no-progress-5s 251.89/512.23m|stalled-no-progress-5s 61.72/512.23m|3108.1939634515893–3265|
|yearWalk January arrival part 1|stalled-no-progress-5s 251.89/512.23m|stalled-no-progress-5s 61.72/512.23m|190.19396345158935–348|
|walk garden Stillwater local part 1|end 9.56/10.03m|end 9.56/10.03m|140.38375003434345–143.9776176375792|
|structure.gardenWalkBridge Stillwater local part 1|end 9.56/10.04m|end 9.56/10.04m|5.189359391944202–6.9888560636431745|
|Stillwater approach on road|end 340.13/340.59m|end 340.13/340.59m|0–280|

## Failure disposition

- Crown forward/reverse: confirmed behavioral regressions against recorded before/modes, both previously completed. Parent assigned modes agent.
- Promenade forward/reverse: inherited recorded failures. Carried source line leaves actual dam crest for an unsupported straight link to the road. Current forward first missing floor is5.64m belowcrest on44.35°ground. Requires a real Horizon connector proposal; cannot classify as completed. Native dam geometry stays protected.
- Summit forward/reverse: path centerline byte-identical to324cd5f; native summit parapet source/definition/art land byte-identical. Explicit native parapet1 and14 block route. This is an authored inherited source conflict, not a measured old walking run. Repair requires a Horizon approach routed through existing opening, not deleting native parapets.
- SummitStation forward/reverse: centerline and crossing.walkSummitStation.g1.1.slab solids byte-identical to324cd5f. Forward unsupported step at1302.500214,158.041576,477.499786; reverse collides with slab edge. Strong inherited source evidence, no historical controller run. Needs a visibly supported Horizon ramp/fairing if continuous access is required.
- Crown stair reverse: centerline and every crownLaunch.stair.bed solid byte-identical to324cd5f. It collides with its own slab at1312.319905,158.815976,455.102388. Forward completes. Inherited source evidence only; do not waive.
- FootQuay both: unchanged centerline crosses native gondola quay post1 near1282.6,54.8,806. Native station art/definition byte-identical. Requires Horizon footway routing around its real post, not native-post removal. No historical controller-run claim.
- YearWalkpart5/January duplicate forward: inherited observed Foot failure matches old reach3 forward at1285.006571,55.371759,735.211085. Exact new witness has drawn YearWalk slab55.321097 buried by native lawn55.371869 (39.97°, next43.18°); baked terrain only54.85636. Bounded terrace-yield correction retains the visible slab and all native-carried runs. Local63.43m extracted walker completes both ways with candidate source, with no air/restarts. Parent applied source patch; full34 rerun intentionally deferred until final bake.
- YearWalkpart5/January duplicate reverse: current first failure1329.536928,68.910021,678.955012 is40.87°native ground. This portion remains native-carried; Foot yield intentionally doesnot affect it. Old reach1 failed nearby but at different source stations, so source-level inheritance is plausible but exact behavioral before proof absent. January station slab repair is separately assigned blind_review; do not conflate this coordinate with their1352.83,73.2,656.91 slab.

The remaining13 after Crown include2 duplicate January attempts. They are live continuity defects under the continuous-footway request, even where source inheritance is demonstrated. No inherited failure is counted as success.

## Artifact links and copying

Copy /tmp/mountain-footways-highest-floor/ into chosen evidence directory; retain results.json, routes.json, footway-inventory.json, walker-extracted.mjs. Copy /tmp/mountain-footways-run-versions.json and /tmp/footways-baseline-source-comparison.json beside it. The latter gives hashes for exact unchanged paths, two unchanged Horizon solids, and native art/definition/land. Re-run repository mountain-modes-audit.mjs ROOT OUT --footways only after final bake. All attempts remain separate; do not concatenate Year Walk clips or treat them as whole-chain walking.

## Source files

- Footway audit inventory/controller extraction: `scripts/horizon/mountain-footway-routes.mjs`, `scripts/horizon/mountain-modes-audit.mjs`; frozen run `/tmp/mountain-footways-highest-floor/`.
- Year Walk grading/carried ownership: `src/harbour/horizon/land/beds/build.ts` near447; emitted deck/shoulder and exact carried midpoint rule: `land/beds/profiles.ts` near120; Foot native-ground yield: `regions/mountainV2/geography.ts` near137.
- Promenade carried source connector: `src/harbour/horizon/land/mountainV2/beds.ts` near99.
- Summit/SummitStation authored Horizon lines: `src/harbour/horizon/land/town/build.ts`79–82.
- Crown launch staircase: `src/harbour/horizon/land/structures/build.ts`835–847.
- Native summit/transport post solids: `src/harbour/mountain/artGeometry.ts`12–22,72–77; native positions: `src/harbour/mountain/definition.ts`.

A failed centreline pursuit does not by itself prove that every human route through the surrounding footprint is blocked. Narrow posts must be distinguished from a full-width closure; all original failed attempts remain recorded regardless of bounded detour followups.

## Bounded ordinary-steering followups

FootQuay is physically continuous with ordinary input: the optional generic source-width clearance driver completes BOTH directions on the original route points, with all body bounds inside the2.5m width; see /tmp/footquay-generic-cached-movement/ and /tmp/footquay-clearance-proof.json. The original centreline failures remain unchanged. No source repair is warranted merely to make a controller walk through a visible terminal post.

Promenade is a genuine geometry issue. Its unsupported24.522m connector rises11.156%, needs up to6.015m support, intersects preserved pavilion column4 at14.25–15m, then lies only0.210m below the road deck around20m. A same-centerline apron would collide with protected geometry. This requires an explicit new Horizon connector alignment/span decision or use of the native west-abutment steps; no patch has been proposed to hide the missing floor.

## Summit Commons followups and version boundary

Explicit existing-ground routes around the observatory were tested separately; no product/source line was rewritten. On fdf25dfa…60a, an east Commons line completed forward, while reverse stepped off place.L02.slab at[1316.0114,158,472.1583] onto157.5197m ground and became airborne. The nominally flush northeastern slab exit (z465, floor158m) is not a complete solution: a tested approach atz464.6 collided with crownLaunch.stair.supports in both directions. Moving farther east atx1318.5 also met that support group nearz463. No bidirectional Summit completion is claimed. All failed trials remain under /tmp/summit-east-movement-2/, /tmp/summit-flush-edge-movement/, /tmp/summit-commons-outside-movement/.

The last west-commons trial loaded NEW gzip dd252b36ff5d5ded6ea059a6d9d3ecaa9e00fef49ffb8e28a8ba878ba83f0f35 at14:09:02UTC. Its start then failed on ground slope near[1324.169,158.18,470.721], so it cannot be merged into the frozen34 counts or compared as one-variable steering against fdf25dfa. Kept separately: /tmp/summit-commons-west-movement/. The local geography source override used by these trial scripts was checked byte-identical to the current checkout geography at the end of this followup; the world asset change, not a hidden source override difference, is the important version boundary.

Parent owns the final bake/final all-footways audit. Latest raw centreline and clearance-driver outcomes should both be retained as separate evidence classes. The geometry issues around Crown stair/SummitStation are appropriate for the source owner already examining those structures. Promenade requires an explicit connector-alignment decision because its original segment intersects protected pavilion/road geometry.
