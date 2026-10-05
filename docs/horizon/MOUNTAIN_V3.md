# Mountain V3 · The Highlands and the Falls

**Decision D-M11** (Jonathan, 2026-10-04: *"build it, improve where it lacks, if you have a great idea add it, the rim bridge should extend up until close to Westwatch Chapel… you need to improve the waterfalls and create glacier peak that feeds the streams and waterfalls, make sure it connects with Mountain v2's roads and paths; you may edit those however you wish to make it work"*).

The ring of high ground round Mountain v2 (the Horizon's Shoulder and Crown bands north and west of the massif) becomes the island's **water mountain**: one glacier feeds every stream and fall, a sheep-farming, ski-village community lives on uneven benches above the Hollow, the Rim Walk runs the north crest from Westwatch Chapel to the glacier, and the Rim Bridge carries the east rim over Horizon Drive to the Prow. Mountain v2's own land south of its summit line is untouched; north of it the higher ground wins (D-M2), and Horizon walks that step onto v2's land are carried by the region (the D-M5 rule, now for every walk).

Jonathan's annotated direction (compare-west / compare-lake / compare-aerial / compare-backside, 2026-10-04) is the brief: B's flatter farming plateau on the west; waterfalls covering the bare west cliff; the lake-facing cliff as one great fall with a research structure above it; more falls in the right saddle, all one water system; a ring community on the backside; a tunnel so the mountain connects over the road to the perimeter peaks; a ranch a user can later unlock and edit.

## 1. Creation Card

- **What it is.** The high country round the mountain, with the water that runs off it.
- **Everyday names.** Glacier Peak, the glacier, the Twin Tarns, Bench Hamlet, Westwatch Chapel, Orchard Bench, Fallswatch, Veil Falls, Rillcut Falls, Long Falls, Spur Falls, Stair Falls, Split Wall Gorge, the Rim Bridge, Rim Lookout, High Shieling Ranch. All proposed; names are Jonathan's call (§8).
- **The job.** A reason to climb: the only glacier, the biggest falls, a hamlet to walk through, a ridge to cross over the road. On foot (every bench, the Rim Walk, the stairs), by cruiser and bicycle (Horizon Drive through the Rim Tunnel), by board (S1 unchanged), from the air (the horn and the Veil read from the glider corridor), and on the Journey map (names registered, glyphs owed).
- **Kinds.** Ground and landform; water; structure (tunnel, stairs, footbridges); route (walks); planting and map presence (owed).
- **Where.** Horizon x 985–1620, z 280–770 (`V3_REACH`), the Crown, Prow and Hollow districts.
- **Identity.** Unique at the top (the horn with its snowfield and the single Veil curtain read from the lake and the air); blended at the edges (the benches run into the Shoulder's heath).
- **Dual Course.** Budget delta (5) **0** — no water, bench or stair reads household state; `BasinReading` (L01, the glass dam) is the only money picture and is untouched. Engagement delta (3) **+2 target**: a destination the household has not seen, and three new ways across the island.
- **Risk.** Medium-High: terrain under live routes (V01, the Year Walk, S1's course beside v2, V03), new tunnel and stairs, a changed bake. No money, command, schema, sync or Hercules payload.

## 2. One definition

`src/harbour/horizon/land/mountainV3/landform.ts` and `water.ts` are the only authors of V3 ground and water. Every consumer derives from them:

| Consumer | Derivation |
|---|---|
| Ground | `mountainV3Height(x, z, h)` in `land/terrain/index.ts baseHeight`, after the D-M1/D-M2 v2 rule and before the shore, the Notch and `applyWaters` |
| Paint | `v3Paint` → snow on the glacier, scree on its moraine (`biomeGround`) |
| Water cuts | `buildMountainV3Waters(s)` appended to `land/water buildWaterCuts` |
| Falls | `buildMountainV3Falls(s)` → `LandCuts.falls` (`FallCut`, `bake-source.ts`) → `collision.falls` in the world definition → `runtime/cards.ts addFall` curtains |
| Routes, places, structures, names | `docs/horizon/make_manifest.py` v3.0 block → `MANIFEST.json` (walks, stairs, tunnels, footbridges, crossing rows, `names.mountainV3`) |
| Audits | `scripts/horizon/v3-survey.mjs` (dev tool: owner, v2 height, Horizon height, beds and solids within a radius) |

### 2.1 Landform (`landform.ts`)

- **Glacier Peak** — the horn at `[1402,398]`, top **156**, under v2's summit (163.24) and the V3 ceiling 157; the Crown summit stays the island's high point outside v2's crest.
- **The cirque and the glacier** — a bowl scooped at `[1358,412]` (floor 135, rising 10 to the rim) and filled with ice the terrain carries (crown 143; a tongue to the snout at Glacier Springs `[1388,374]`, 128). The ice is ground painted snow; the moraine is scree.
- **Benches** — nine, no two neighbours at one level (hamlet 104, hamlet.lower 96, westLedge 80, orchard 117, tarns 106, spurCrown 96, ranch 61.5, col 114, westwatch 90). A bench is a place to stand: on v2's apron it holds its level fully (elsewhere V3 acts a quarter at the footprint edge, so the seam stays smooth).
- **Gorges** — the Rillcut (the Lower Tarn's outlet to the west lip), the Spur cut, the glacier's east lip (the Col Rill's cut to the col), Split Wall (the east rim cut lengthwise to Stair Falls' lip), and the **Long Cut**, a 12 m box notch in the west wall with a near-vertical back so Long Falls hangs in air.
- **The Veil amphitheatre** — the Shoulder's lake face at z ≈ 700 recessed into a bay (lip 94.6, x 1086–1136) with two buttresses forward; the Stillwater tunnel inside it keeps ≥ 30 m of rock over its roof.
- **Keep-outs** — the Throat and its collar (P25) and the Deep's skylight saddle; `V3_REACH` bounds everything.

### 2.2 Water (`water.ts`)

One network, two outlets from the glacier, every reach downhill, every fall landing in its own pool at the pool's level (tested).

**West branch.** Glacier Springs (126.8) → the Crown Rill west along the north bench → the **Upper Tarn** (105.6) → the Tarn Link → the **Lower Tarn** (102.4) → the Rillcut → **Rillcut Falls** (98.2 → 46.2, a 52 m ribbon) → Rillcut Pool → the Hollow Rill → the Hollow Tarn. The Rillcut splits on a gravel bar at `[1082,456]`: the **Long Beck** runs down the hamlet's lower field in a cut channel to **Long Falls** (97.4 → 45.5, 52 m, into the Long Cut and Long Pool). The Lower Tarn feeds **Spur Tarn** (95.2) through the spur's rock (a seep, no drawn reach); Spur Tarn spills two ways: the Veil outlet to **Veil Falls** (94.3 → 53.5, a 48 m curtain into Veil Pool, out under the Veil Footbridge to Stillwater) and the Spur spill to **Spur Falls** (92.2 → 55.8).

**East branch.** The Col Rill leaves the glacier's east lip, drops the horn's flank to the Rim Bridge col and feeds **Split Wall Gorge**; its floor steps to **Stair Falls** (upper 92.4 → 78 into Stair Pool, lower 78 → 62 into Shieling Pool) → the Shieling Beck → the **Shieling Mere** (56.4) below the ranch.

No water here reads household state (CONTRACT §2.2); the reservoir inside v2 is not part of this network.

### 2.3 Routes and structures (manifest v3.0)

- **The Rim Walk** — the north crest from Westwatch Chapel (90) to Glacier Springs; the **Glacier Walk** from the Crown launch's side to the glacier's east lip; the **Col Steps** (stair) down the horn's flank to the col; the **east rim walk** from the col over the Col Footbridge, along Split Wall to Stair Falls' head; the **Shieling Steps** beside the falls to the ranch lane; the **ranch lane** over the Shieling Footbridge to High Shieling Ranch and on to the Year Walk's Hearth stretch (its last 30 m on v2's land are region-carried).
- **The Rim Bridge** — the connecting ridge from the east rim to the Prow headland. Horizon Drive runs under it in the **Rim Tunnel** (`[1566,545]`, 84 m, V01) with the Year Walk's bore beside it; the **Rim Steps** (stair) descend from **Rim Lookout** (104) over the tunnel to the Prow. Jonathan asked for the bridge to reach toward Westwatch; the Rim Walk is that reach on foot — the ridge itself ends at the col, where the glacier stands in the way (a ridge over it would bury the cirque).
- **The hamlet lanes** — the hamlet lane from Westwatch Chapel through Bench Hamlet to Orchard Bench; the **Fallswatch lane** from the hamlet over the Hamlet Footbridge (the Rillcut's head) down the spur to **Fallswatch** (93.9), the monitoring deck above the Veil.
- **The Year Walk** — re-routed through the Hollow's east edge north of the September pad (~20 m west off the cliff foot so the plunge pools fit); it crosses the Hollow Rill on the **Rillcut Footbridge** and holds 55.2 as it leaves the lake-rim share. The lake-rim trail is pinned level (55) across the **Veil Footbridge** so the February share stays flush with the Stillwater entrance.
- **Crossing rows** — seven registered (all footbridges `over`; the Sea Passage `under` Split Wall at ≈ 90 m). The confluence rule (`CONFLUENCE_LEVEL_EU` 6): two aquatic routes meeting within 6 eu of height are a confluence, not a crossing to resolve.

## 3. Jonathan's calls honoured and expanded

| Direction | What was built | Expansion, and why |
|---|---|---|
| Flatter farming / ski-village plateau (west) | Bench Hamlet 104 and its lower field, Westwatch's knoll, Orchard Bench, the Twin Tarns shelf | Benches are uneven on purpose: a plateau that rolls ≤ 10 % reads as highland, not a band |
| Waterfalls covering the bare west cliff | Rillcut Falls (52 m) and **Long Falls** (52 m, added) with the Long Cut, plus Spur Falls at the corner | One fall left the face bare in the prototype; the Long Beck gives a second curtain from the same tarns |
| Lake cliff becomes a waterfall; structure above to monitor it | Veil Falls across the whole bay; Fallswatch deck and lane | The Veil is recessed and flanked by buttresses so the curtain hangs in a hollow of rock |
| More falls in the right saddle, connected to one system | Stair Falls (two drops), Split Wall Gorge, the Shieling Beck and Mere, fed from the glacier's east lip | The east lip gives the glacier two outlets; everything still traces to the springs |
| Ring community with the lived-in feel | The benches, lanes and places are plotted; buildings owed | Nothing posts money; the hamlet's buildings are a follow-up with the three themes |
| Tunnel so the mountain connects over the road | The Rim Bridge: Rim Tunnel (V01) + Year Walk bore + ridge + Rim Steps | The ridge is V3 ground, the tunnel a manifest structure; proofs show 27.7 m of cover over V01 |
| A ranch a user can unlock and edit | High Shieling Ranch bench (61.5) and lane, plotted | Building and editing are a later plan (local state only) |

## 4. Proofs

- Bake gate (`groundBeds`: no unsupported bed deeper than 1.25 eu) clean; **138 conflicts** on the bake, the same 138 as `main` (the Year Walk's grade rows renumber by two samples; no V3 conflict).
- `pnpm horizon:check` byte-exact (bake, Mountain v2 dump, mountain landings — the awning landing's terrain hashes re-stamped, its geometry unchanged).
- Footbridge decks over water: Rillcut 2.25, Veil 2.24, Col 5.79, Shieling 3.33, Hamlet 1.94 (all ≥ 1.25). Rim Steps over V01: 27.7 m through the Rim Tunnel's roof; over the Year Walk's bore 32.3. The Sea Passage under Split Wall 104.9 (≥ 6). ORE under the Long Beck.
- `test/horizon-mountain-v3.test.ts` — one definition (the horn's height and ceiling, v2 untouched south of its summit line, nothing outside the reach), the glacier (ice carried by terrain, snow paint, snout above the springs), uneven benches, the water topology (every reach and fall flows to a named body; falls drop ≥ 14 m onto their pool's level; reaches arrive at basins within 1 m; no money word in the source), scaled cuts, determinism, manifest wiring.

## 5. Owed

- Buildings: Bench Hamlet (sheep sheds, a ski hut), Westwatch Chapel, the Fallswatch deck, the ranch; each authored in Classic Hearth, Taylor's Scrapbook and Newfoundland.
- Journey map glyphs and labels for the new places and falls (`src/journey/land/**`).
- Fall audio (original cues, mute respected), lite tier checks (one sheet), reduced-motion stillness of the flow sheen.
- Seat audits with the real controllers through the Rim Tunnel (cruiser, bicycle, both directions) and the Rim Steps / Col Steps on foot; a glider pass over the horn.
- The three view pages whose frames the new ground enters (F's Stillwater eye now sees the Veil; a V3 page of its own is a Jonathan call).
- Hamlet planting (heath, birch, a few pines; orchard trees on Orchard Bench) through the corridor planting rules.
- The horizonManifest test still pins `date 2026-10-04`; the next manifest bump moves it.

## 6. Evidence

`docs/horizon/evidence/mountain-v3/` — before/after captures from the prototype harness over the real bake (aerial, west, lake, backside, plan) and `LOOK.md`. Headless SwiftShader renders of the baked terrain and water with the harness's own curtain sheets; not device evidence.
