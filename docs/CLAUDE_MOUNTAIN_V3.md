# Claude handoff — Mountain V3 · the Highlands and the Falls (D-M11)

- **Status:** built on branch `claude/mountain-v3`; PR to open from this handoff. Not merged, not deployed, not live-verified. The Horizon is dev-gated (`public/.assetsignore` drops `/horizon/**`), so "live" would mean the dev-gated route on the Workers build after a merge.
- **Base:** `origin/main` `4b89d03` (fast-forwarded before the commit; no overlap with #584's files).
- **Risk:** Medium-High (terrain under live routes, a new tunnel and stairs, a changed bake). No money, command, schema, sync, Auth/RLS or Hercules payload change.
- **Budget delta (5):** 0 — no V3 water, bench or structure reads household state; `BasinReading` (L01) untouched. **Engagement delta (3):** +2 target — a glacier to climb to, the island's six falls, three new ways across (Rim Tunnel, Rim Steps, the Rim Walk).

## Household outcome

Jonathan and Bianca get a reason to climb. The blank ring of high ground round Mountain v2 is a highland: Glacier Peak with its snowfield, two tarns on a shelf, a sheep-and-ski hamlet on uneven benches, and water running off every side — two 50 m curtains into the Hollow, the Veil across the whole lake face with a watching deck above it, Stair Falls stepping down to a mere below the ranch. Horizon Drive dives under the new Rim Bridge; the Rim Steps come down over it to the Prow; the Rim Walk follows the crest from Westwatch Chapel to the glacier's snout.

## What changed

**One definition.** `src/harbour/horizon/land/mountainV3/landform.ts` (ridges, cirque and glacier, nine benches, five gorges, the Veil, keep-outs, the reach) and `water.ts` (reaches, basins, falls, flow graph). Applied in `land/terrain/index.ts baseHeight` after the v2 rule; paint via `v3Paint`; waters appended in `land/water`; falls as `LandCuts.falls` (`FallCut`, new `lean` field) → `collision.falls` → `runtime/cards.ts addFall` curtains.

**Rules.** `world/crossings.ts CONFLUENCE_LEVEL_EU = 6` (aquatic routes meeting within 6 eu are a confluence). `land/beds/build.ts`: every walk that runs onto v2's land is region-carried (`regionCarryLand`, the D-M5 rule generalised; the ranch lane's last 30 m). Benches hold their level on v2's apron. A gorge carries a 6 m rock shoulder on its low side.

**Manifest v3.0** (`docs/horizon/make_manifest.py`, regenerated; never hand-edited): walks rimWalk, glacierWalk, eastRim, hamletLane, fallswatch, ranchLane; stairs colSteps, shielingSteps, rimSteps; tunnels rimTunnel (V01) and rimTunnelWalk (yearWalk); footbridges col, shieling, hamlet, rillcut, veil; nine places; seven crossing rows; `names.mountainV3`; the Year Walk re-route (north of the September pad it keeps its line; from there ~20 m west, over the Rillcut Footbridge) and its 55.2 level pin; the lake-rim trail pinned level across the Veil Footbridge. A v2.7 sync block first made the generator reproduce #581's hand edits.

**Bake.** `public/horizon/**` regenerated; `src/harbour/mountain/generated/awning-landing.json` re-stamped (its terrain hashes; geometry identical).

**Tests.** New `test/horizon-mountain-v3.test.ts` (7). Changed with the reason in place: `horizonManifest` (version 3.0, date, the nine places are not hosts), `horizonUnderground` (the Rim Tunnel's and the bore's portals are named mouths), `horizonCorridorPlan` + `test/helpers/corridorStations.ts` (the adapter names the Rim Tunnel; R3 carries its approach tails), `horizonWater` (a fall lip has no bank). `test/verification-focus-map.json` maps the V3 sources to eight suites.

**Dev tool.** `scripts/horizon/v3-survey.mjs` (+ `v3-survey-entry.ts`): ground owner, v2 height, Horizon height, beds and solids within a radius; `--grid`, `--landforms`.

## Verification (exact)

- `pnpm horizon:bake`: gate clean (no unsupported bed deeper than 1.25 eu); **138 conflicts**, the same count as `main` (the Year Walk's grade rows renumber; no V3 conflict). `pnpm horizon:check`: byte-exact (bake, v2 dump, landings).
- `pnpm typecheck` clean.
- Proofs on the bake: footbridge decks over water Rillcut 2.25 / Veil 2.24 / Col 5.79 / Shieling 3.33 / Hamlet 1.94 (≥ 1.25); Rim Steps over V01 27.7 (through the Rim Tunnel roof), over the Year Walk's bore 32.3; Rim Steps girder span 21.2 < 24; Sea Passage under Split Wall 104.9 ≥ 6; ORE under the Long Beck.
- Suites, one file at a time (`--maxWorkers=1`): `horizon-mountain-v3`, `horizonWater`, `horizonStillwaterLink`, `horizonGliderController`, `horizonManifest`, `horizonCorridorPlan`, `horizonLandforms`, `horizonCrossings`, `horizonCards`, `horizonBakeArtifacts`, `horizonWorldDefinition`, `horizonViews` green, plus 94 of the 110 Horizon/journey/harbour files in the first full pass. Region seam probe: worst 0.43 ≤ 0.5 (was 1.37 before the carry rule).
- **Baseline failures on `origin/main` in this environment (arm64, no canvas), not touched:** `horizonWave4` (portrait C/D/F/L pass since #581; the claim string `ABEGHIJK` is stale), `horizonMountainRegion` (canvas getContext), `horizonUnderground` ("reading 'points'"), `horizon-mountain-road-floor` (1 mm floor vs 5e-7), `horizonBoardPace` / `horizonBoardThresholds` / `horizonRideSituations` / `horizonSkateLines` (the walking-ground fairing's 3 cm bound at import), `horizon-foot-lane-apron` (worker timeout), `horizonStreaming`, `horizonMoversNoMoney` (known).
- Quick gate: `pnpm test -- --risk=medium-high --focus=test/horizon-mountain-v3.test.ts --focus-reason="…"` — result recorded in the PR.

## Visual evidence

`docs/horizon/evidence/mountain-v3/` before/after at five cameras over the real bake (prototype harness, SwiftShader; curtains from the same FallCut numbers; buildings not drawn). No device captures; no runtime captures of the three themes (owed with the buildings).

## Rough areas and uncertainty

- The Veil reads as one 50 m panel in the harness; the runtime `addFall` curtain (two sheets, flow sheen, foam ring) has not been captured in the running world on this branch.
- The hamlet lane and Fallswatch lane run at 12 % for long stretches (within the walk profile; steep for a village).
- Rillcut Falls' brook runs below the plateau edge for its last 20 m (deliberate); the plateau edge there is ragged where the gorge, the ledge bench and the Shoulder band meet.
- Long Falls' lean is authored (9 m) so the curtain clears the Long Cut's back wall; other falls use the default lean.
- The glacier walk begins beside the Crown launch; the launch's run-off is unchanged (test green) but no glider pass over the horn was flown.

## Owed (next owner)

Buildings in three themes (hamlet, chapel, Fallswatch deck, ranch); Journey map glyphs and labels; fall audio and lite/reduced-motion checks; seat audits through the Rim Tunnel (cruiser, bicycle) and on the stairs; a V3 view page (Jonathan's call); planting on the benches; the ranch unlock-and-edit plan (local state only). The `horizonWave4` claim string is #581's follow-up.

## Jonathan's calls

Names (all proposed here); whether the Rim Bridge should also be a drawn ridge toward Westwatch (today the Rim Walk is that reach; a ridge would bury the cirque); buildings; the V3 view page; the ranch plan.
