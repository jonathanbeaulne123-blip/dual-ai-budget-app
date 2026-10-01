# Current-source Summit walking regressions — bounded proposal, unexecuted

Neither recorded blocker is repaired in current source. No native exception applies to these two witnesses. Checkout was read only; proposal is `/tmp/mountain-summit-joins.patch` (4 files). No world imports, tests, browser, renderer or movement run was performed here.

## Forward: false terminal shoulder cut

Expanded ordinary walk stops at 0.36m, H[1324.1302169332484,158.18000030517578,470.73125184711256], with a reported 64.359311° terrain normal. This is not a native cliff or a missing threshold slab. Native Float32 ground at x−.06, x, x+.06 is exactly158.18000030517578m. None of those points lies on an actual drawn road triangle. They lie behind the last actual swept cross-section.

`drawnRoadGroundCeiling` nevertheless searches earlier segments' clamped centreline projections. At x−.06 it chooses segment935, ceiling157.92999654316984. At centre it chooses934, ceiling159.74189283132216; native ground therefore remains158.18000030517578. The artificial0.250003762m field step across the normal's0.12m stencil reproduces the recorded64.359311°. Pure-source witness reproduction: `/tmp/mountain-summit-pure.py`, `/tmp/mountain-summit-pure.json`.

Proposed correction: once the actual road-floor query returns null, disallow a radial batter behind the final actual cross-section within its6.3m terminal neighbourhood (4.8m half-width +1.5m batter). Actual drawn road triangles retain their original8cm ground clearance. This restores native ground beyond the open road end; it adds no floor, alters no native data, and does not reroute the walk or main road. The shared ceiling supplies both Horizon region ground drawing and queries. Root must still check the resulting full/lite render lattice and the terminal-neighbourhood boundary after application; pure arithmetic is not rendered proof. No global slope/controller tolerance changes.

## Reverse: added landing rails close the receiving walk

Expanded reverse walk stops at12.6400119m near H[1309.688633147,161.105896435,453.176286076], naming `crownLaunch.stair.landingRails@crown`. `crownStairLanding` still emits both added side guards all the way to the source `walk summit` centreline. It never reserves a full-width entrance. The original stair rails are distinct solids.

Proposed correction: trim only the new landing guard where it intersects the declared2.5m receiving walk plus the existing square post's half-diagonal and1cm. Preserve the .09m top member and .25–.95m solid body band on every retained segment; place an end post at each opening boundary. Native geometry, old treads/rails/stringers/supports/cheeks, landing top, and every source path point are unchanged.

Saved current landing rows give one exit on each side: side0 after row4 at H[1311.015342831,160.425671721,454.006539487], removing3.189917169m of plan rail; side6 after row6 at H[1310.983566584,159.937175333,456.038631903], removing2.668353005m. These are measured against saved baked rows, not a newly executed source build. The analytic split is bisected to40 iterations and fails closed if a future short segment has an internal crossing with both ends outside.

Tests proposed: reproduce the exact native-ground stencil and terminal true-floor ownership; sweep the receiving path at centre/±.95m with .3m body radius at the .65m body band; assert retained guard contact farther along the same real landing; assert all original stair members and walk points unchanged. Existing original walking and between-post guard tests remain intact. Tests are not run or claimed passing.

## Root-only execution

Apply/review the patch, then run the two existing focused files with the serial runner. After the baked solids contain the new opening, execute:

```sh
node /tmp/mountain-summit-walk-probe.mjs "$PWD" /tmp/mountain-summit-walk-observed
```

The probe runs the current extracted ordinary walking controller on exactly `walk summit` and `crownLaunch.stair`, both directions, one initial placement each and zero resets. It saves every failed attempt, hashes before/after inputs, refuses output overwrite, and exits1 for any incomplete/contact/air outcome. It passes final walkingJoinSolids like the pending runtime composition. Optional `--walk-clearance` is a separate existing ordinary source-width steering policy; use a fresh OUT and retain centreline failures separately.

Do not infer the whole summit route passes: older native Commons parapet conflicts may become the next blocker after these two fixes. Those are separate evidence/ownership questions; this proposal neither removes them nor substitutes a different source path.

Exact source hashes and saved-row/stencil measurements: `/tmp/mountain-summit-source-witnesses.json`. Full modes audit/final bake and GPU acceptance remain root-owned.
