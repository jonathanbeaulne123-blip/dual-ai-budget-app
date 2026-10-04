# Prompt · The Mountain Road, finished and joined to its neighbours (2026-09-30)

This prompt is for GPT/Codex in the Hearth repository. It is the companion to `claude/prompt-horizon-bridges-2026-09-30.md`. It asks GPT to give the Mountain Road the method Horizon Drive got in #575 (merged at `e77309e`): one road definition, driven end to end in both directions. It also asks GPT to join the road to the neighbouring high ground, by grade where the land allows it and by a bridge where it doesn't. Paste everything below the line.

---

# Hearth · The Mountain Road: from the Prow to the summit, and out to the neighbouring heights

You are Codex, working in the Hearth repository (`jonathanbeaulne123-blip/dual-ai-budget-app`). Jonathan is the product owner and the only approver, and `AGENTS.md` applies in full. The risk is **High**: this touches shared land geometry, collision, navigation, the placed Mountain v2 region, flight and cable clearances, and night lighting. Plan first, stop where this prompt tells you to, and keep one writer per checkout.

## The brief in one paragraph

The Mountain Road should be one road you can drive, ride, skate and walk, from Horizon Drive on the Prow to Summit Commons and back down, with no seam, lip, snag or launch. It should read as a mountain road: hairpins with views, stone parapets only where the drop needs them, lanterns only where you need them at night, forest and meadow that change as you climb. It also stops being a dead end. It joins the neighbouring heights, either by grade where the land allows (a road that simply continues) or by a bridge where a valley, a gorge or the Throat is in the way. Any new bridge is a landmark with its own name and shape, built to the bridges prompt's rules.

- **Budget delta (5): 0.** No money path, command, schema, sync, Auth/RLS or Hercules payload changes.
- **Engagement delta (3): +2 target.** The mountain becomes somewhere you drive through, not only up and back.

## First: the one constraint that changes everything

`src/worldGeography.ts` sets `CURRENT_WORLD_GEOGRAPHY = 'hearth-mountain-geo-2'`. **Mountain v2 is the world the app opens today.** The Horizon places that same Mountain v2 as a region (`src/harbour/horizon/regions/mountainV2/**`, offset `{x:1308, y:54, z:764}`, footprint x 1108–1508, z 368–848).

Any change under `src/harbour/mountain/**` changes the live default world as well as the Horizon.
- Do all of this work on the Horizon side by default: region placement, `land/mountainV2/beds.ts` (`regionCarry`), the corridor, and Horizon terrain.
- A change to Mountain v2's own road, terrain or bridges is a decision for Jonathan. Bring it to him with the change measured in both worlds, and wait.
- If he approves, run `node scripts/horizon/dump-mountain-v2.mjs` and then its `--check`, rebake, and prove the standalone Mountain v2 is unchanged or better: its own tests, captures and walks.

Check `main` CI before starting. On 30 Sep it was red for one reason that has nothing to do with this work: `test/app-startup-p1.test.ts`, "keeps Bianca Month inside the current App…". It fails on a month's last day because `test/fixtures/existing-books-onboarding.ts` activates at now + 24 h. Name it if it is still red. Do not change that test without Jonathan, because it is the Bianca Month regression.

## Read first

1. `AGENTS.md`, `docs/AI_OPERATING_MODEL.md`, `docs/HEARTH_ROADMAP.md`, `docs/AI_HANDOFF.md`.
2. `docs/CLAUDE_HORIZON_MAIN_ROAD.md` (the road handoff), `docs/horizon/ROAD.md` (D-R1 to D-R12) and the 2026-09-29 entry in `docs/DECISIONS.md`.
3. The Mountain v2 decisions D-M1 to D-M10 (`MANIFEST.json` `regions[0].decisions`, `docs/DECISIONS.md`) and `src/harbour/horizon/land/mountainV2/README.md`.
4. The project docs `claude/hearth-mountain-v2-build-2026-09-25.md` and `claude/hearth-mountain-ux-dissection-2026-09-24.md`. These set the finish and evidence bar.
5. Code:
   - `land/corridor/**`
   - `land/mountainV2/{beds,ground}.ts` and `v2-data.json` (generated; never edit it by hand)
   - `regions/mountainV2/{geography,ground,graph,rides,scene,placement}.ts` (read `terraceBedExclusion` closely, including its steep 2 : 1 rise back to v2's lawn)
   - `land/structures/build.ts` (the Mountain Road Tunnel and the canal bridge)
   - `scripts/horizon/{road-audit,capture-road,road-inspector}.mjs`
   - `runtime/{roadLights,corridorArt,corridorPlanting,inspector}.ts`
   - `src/journey/land/**`
6. The evidence to imitate is in `docs/horizon/evidence/road/**`, with `after/LOOK.md` as the model.
7. The companion bridges prompt, if its `docs/horizon/BRIDGES.md` exists by the time you start.

## The Mountain Road today (verify every number)

| Part | What it is | Notes |
|---|---|---|
| **V03 "Mountain Road"** | 327 m, corridor road, grade max 10 %. It runs from Horizon Drive on the Prow cliff drive `[1599.5,790.8]` west to the Foot terrace `[1281.5,742]`. | It passes through the **Mountain Road Tunnel** under the Shoulder remnant: ridge 93–99 over a road at 45–52. The Year Walk January footway rides its south side at 6.5. It crosses the v2 town channel on the **Mountain Road canal bridge** (18 m). In the corridor audit today it has 1 MAJOR, 0 BLOCKER and 0 restarts. |
| **The join at the Foot** | V03 ends on a v2 town lane 22 m south of the road foot `[1282, 54.65, 720]`. "The lane carries wheels on to the foot." | Nobody has audited this join as one drive. |
| **Mountain v2 `mountain-road`** | 946 eu from the foot `[1282, 54.65, 720]` to Summit Commons `[1325, 158.2, 470.5]`. 315 samples; half-width 3.5–4.8; grade between 1.7 % and 15.4 % (the steepest is near s 18, at the foot). | It has three bridges: `b-foot` (s 36–57), `b2` (s 392–446) and `b3` (s 622–694), plus embankments. It is **drawn by the region** (`regionCarry`: no Horizon cut, deck, kerb or wall). **The road audit has never driven it**: `road-audit.mjs` covers only V01, VG, VBS, V03, the spurs and the service roads. |
| **At the top** | The observatory `[1306,158,466]`; the Crown launch deck (h 170, `[1322,472]`); the gondola's Summit Commons terminal `[1300,158,480]`. | The downhill `course` starts at the road top. |
| **Nearby movers and passages** | Gondola G1 from Waterfront `[1282,810]` to Summit Commons, over towers at `[1250,710]`, `[1228,614]` and `[1370,550]`. The funicular (the square, the lower neighbourhood, Library Woods). The Ore Line, from the Adit `[1090,540]` h 40 to the South Portal `[1345,680]` h 67.5, which sits on v2's lower switchback leg. | Flight gates: `northFace` 10 `[1300,200]` h 139, `crown` 11 `[1310,470]` h 190, and `throat` 12 `[1300,300]` h 119 (glider only; 24 × 16 inside the 26 × 18 mouth, 110–128). |

The neighbouring heights, from `MANIFEST.json` `landforms` (bounding boxes x0, z0 → x1, z1):

| Neighbour | Box | Height |
|---|---|---|
| **The Prow** | 1560,480 → 1700,1080 | 40–70; V03 already joins it |
| **The Shoulder** | 1000,300 → 1520,900 | 90–110 |
| **The Crown** | 1120,280 → 1520,700 | 110–160; summit 158 |
| **The Undercroft** | ellipse centred 1300,470, 170 × 130 | 30–95 |
| **Stillwater terrace** | 1000,720 → 1280,900 | 45–55; nearly level with the Foot at 54 |
| **The Hollow** | 850,480 → 1090,680 | 30–45; Green Road runs past it at `[1000,600]` → `[940,460]` |
| **Scholars' Edge** | 600,260 → 960,520 | 35–60 |
| **The north face and north coast** | Horizon Drive passes about `[1300,260]` | The Throat is at `[1300,300]` |

## What the road taught (apply every one of these)

1. **One definition, every consumer derived from it.** Horizon Drive became trustworthy when stations every 2 eu produced everything else: surface, collision, kerbs, guards, lamps, planting, stops and the Journey map. Before that, beds, edge pieces and art disagreed with each other.
   - Treat V03 + the Foot join + v2's `mountain-road` + any new links as **one corridor chain**, with reaches such as M1 (Prow cliff mouth), M2 (tunnel), M3 (canal and Foot), M4 onward (the switchbacks) and M-top (Summit Commons).
   - Where v2 draws the road (`regionCarry`), the corridor may still own the stations, the audit, the guards, the lamps and the map, without re-cutting v2's surface.
   - Say where you draw that line, and why, in a D-MR decision.
2. **Handovers never show.** Junction aprons (D-R10) blend a joining deck into the through surface in lateral strips; a flat joining deck left lips on climbing roads. Guards, kerbs and fills lap onto structure ends. A bare structure edge gets a corridor guard (D-R11). Apply this at:
   - the Prow cliff mouth;
   - both tunnel portals;
   - the canal bridge;
   - the V03 → v2 lane → foot join;
   - each of `b-foot`, `b2` and `b3`;
   - every new link.

   Nothing on the rider's line may step more than 0.48.
3. **Collision is what is drawn.**
   - Contact levels are y + 0.2 and y + 0.65; the body is 1.25.
   - A parapet or rail must stop a body at the 0.65 band. The trestle's mid rail sat below 0.65; a 0.25–0.95 board rail fixed it.
   - Colliders follow the drawn rail, with buried ends ramping over 2.5 eu (review M1).
   - The view raycast skips post-and-rail colliders, so no invisible collider blocks an authored view.
   - No invisible walls on a mountain road. A drop with nothing drawn is a fall the audit must catch, and a barrier you can't see is a bug.
4. **Guards only where the drop needs them.** Mountain drops are big, so stone parapets are for the outer edges of hairpins and the cliff sections. Post-and-rail stays below the rider's eye where the view is the point, and open verges are fine where the ground is gentle. Use the corridor's guard rule (`guardNeed`, drop > guardDrop), not taste.
5. **Fix it at the source, never at the symptom.**
   - The road's L1 track fixed faired profiles, abutments and 1 : 1.5 embankments that never enter a pad's footprint. An embankment once lifted a home plot 3.6 m.
   - Mountain v2's own ground is used inside its footprint (D-R12). The region yields to V03 and S1 through `terraceBedExclusion`, with a steep 2 : 1 rise back to v2's lawn, so v2's authored lawn is lowered only in a narrow band.
   - Keep both rules. Where Horizon terrain meets v2's apron (v2's sea within 40 m of v2 land becomes an apron from 53.95 down to the Horizon), make the seam invisible at the bake, not with a covering piece.
6. **Drive it from the saddle, with the real controllers, both ways.**
   - Extend `road-audit.mjs`, or add a `mountain-audit.mjs` that shares its code, so it drives the real `stepCruiser` over the **whole chain**: Prow → tunnel → Foot → every hairpin → summit, then back down. Centreline and keep-right both ways.
   - Also run the bicycle and the board up and down, and the walking body over every footway.
   - Downhill matters: a hairpin taken at a natural descent speed must not throw a rider through a parapet or off the edge. Measure entry speed, lateral grip and radius at each hairpin, and report them.
   - The road went from 41 / 298 / 584 to 0 / 23 / 85 with 0 restarts. Use the same severity rules: a contact is in-lane if the rider came into the lane at any point.
   - Distrust your own probe until a capture agrees with it. Two "BLOCKERs" on the road were probe bugs.
7. **The bake and the tests read the same world.** #575's one MAJOR finding: the bake called `planCorridor` without water, walks or destinations while the tests used the full environment, so the tests passed while the bake was different. Fixed by `corridorDestinations(cuts)`.
   - Any planner you add takes its environment from one function that both the bake and the tests call.
   - `pnpm horizon:bake`, then `pnpm horizon:check` byte-exact, about 2 minutes each.
   - `dump-mountain-v2.mjs --check` stays green.
8. **Tests change only with the reason written in place.** Name exceptions explicitly, as `KNOWN_DARK` does. Never skip, quarantine or silently loosen a test. Fixtures never read the wall clock.
9. **Authored views, flight, cable and the map are part of the road.**
   - A new abutment once hid 3 px of the Boathouse and failed view page L (still owed). Run the view proofs after every change.
   - Keep G1's clearance, the Ore Line portal, the funicular, gates 10–12 and the Crown launch intact. Each is a measured envelope with a diagnostic and a test.
   - The Journey map draws the whole chain, its tunnel as a covered stretch, and each link.
10. **Night, themes and budget.**
    - Lanterns on the world clock, ramping from +2° to −6° sun elevation, with pool decals on the surface.
    - A bounded, shadowless point-light pool: 6 on full, 2 on lite (D-R3, owed to Jonathan).
    - A mountain road is dark between junctions. Light hairpins, portals, junctions and stops, and let the kerb and rail chalk carry the rest.
    - Author the three themes (Classic Hearth, Taylor's Scrapbook, Newfoundland); never derive them.
    - Lite drops items, never substitutes them.
    - Measure the per-district draw-call budget (ROAD §8) on the real bake. The road pass never did.
11. **Honest evidence.**
    - Headless SwiftShader captures (`capture-road.mjs`) and inspector snapshots (`?diagnostics=1`, `=`) are **not device evidence**; say so.
    - Write `LOOK.md` in plain words, rough areas included.
    - Run a blind reviewer before the PR.
    - Verify every review-bot finding: fix it, or reply with the reason. On #575, three were withdrawn after reasoned replies.
    - State delivery literally: local, branch, PR, merged, deployed, live verified.
12. **Jonathan's calls stay his.** Examples: anything that changes Mountain v2 itself, an authored view, a flight gate, the gondola line or a STYLE rule; a moving or new landmark bridge; closing or re-routing an existing path. Bring measured options with one recommendation. Don't decide these yourself.

## Joining the neighbouring heights

For each neighbour, measure the gap: plan distance, height difference, what lies between (valley, river, the Ore Line, the Throat, gondola lines, flight gates, plots), and the grade a road would need. Then choose one of these:

- **Join by grade.** The road continues on the land at no more than 10 % (V03's limit), following contours, with hairpins where it must. Prefer this wherever the land allows it without scarring an authored view or a reserved plot. A natural join is one you don't notice as a join.
- **Join by a bridge.** Where a valley, gorge, river or the Throat makes a grade road long, steep or ugly, cross it with a bridge that becomes a **landmark**. It must have:
  - a unique everyday name that is also its picture word;
  - a unique typology, purpose and signature feature;
  - over / under / through passages with measured envelopes;
  - a meeting spot and a night signature.

  All of these follow the bridges prompt's `BridgeDefinition` and its "meet me at" tests. **Do not start a second bridge system.** If the bridges work has landed, use its contract. If it hasn't, write the bridge's entry in `docs/horizon/BRIDGES.md` format and stop for Jonathan, so that one of the two efforts owns the shared contract.
- **Don't join.** Sometimes a neighbour is better left as a view. Say why.

Starting hypotheses, which are for you to test, not decisions:

| Neighbour | Likely join | Why and what to watch |
|---|---|---|
| **The Prow (east)** | Existing: V03 and the tunnel | Make it read as one road. Check the cliff mouth, the portal lighting and the Year Walk January footway beside it. |
| **Stillwater terrace (south-west)** | **By grade**: the Foot (54) and Stillwater (45–55) are nearly level | A lake-rim road from the Foot to Green Road at about `[980,700]` would make the mountain a loop, not a cul-de-sac. Watch the S1 inflow bridge, the inflow footbridge, the lake rim and the gondola's Waterfront. |
| **The Hollow and Green Road (west)** | A mid-mountain link from v2's west flank (the woodland clearing `[1204,108,568]`, near the glasshouse site) down to Green Road at about `[1000,600]`, which drops about 60+ eu | Probably needs a **viaduct** over the Ore Line's Adit valley `[1090,540]`: a curving multi-span road viaduct, with the ore cart running under it. Watch gondola tower 2 `[1228,614]` and the reserved plots. |
| **The north face and north coast** | From Summit Commons down to Horizon Drive near `[1300,260]` | The Throat `[1300,300]` sits in the way. A bridge across the Throat's mouth, with gliders flying **under** it into the mountain, could be the island's most dramatic crossing. The throat gate's aperture (110–128) and gate 10 (h 139) are hard envelopes. Otherwise, descend by grade and leave the Throat alone. |
| **The Shoulder (north-east)** | By grade: a short spur or overlook onto the ridge | Maybe a scenic stop, not a through road. |
| **The Crown and Undercroft** | Already the summit; the Ore Line is rail inside the rock | No new road inside the mountain. |

## Acceptance

- **One drive, both directions:** Horizon Drive → Prow → tunnel → Foot → summit, and every new link, driven by the real controllers with 0 restarts and 0 BLOCKER. Every remaining MAJOR is off the lanes and named. The corridor audit (0 / 23 / 85) must not regress.
- **Hairpins:** each one's radius, entry speed downhill, grip margin, guard and night light is reported in a table.
- **Joins:** every join (the Foot, each portal, each bridge end, each new link) has a capture at rider height plus an audit record showing no lip or gap.
- **Neighbours:** each has a verdict (grade, bridge or view) with its measurements, and every built link is walkable, rideable and skateable where its profile allows.
- **Envelopes:** G1, the funicular, the Ore Line, gates 10–12, the Crown launch and every view page are green, or each change is on Jonathan's list.
- **Mountain v2 standalone:** unchanged, or explicitly approved by Jonathan and proven.
- **Three themes, day and night, full and lite:** captured at driver height, from the air and on the Journey map, all SwiftShader-labelled.
- **Budget:** per-district draw calls and triangles measured on the real bake for every district the chain crosses.

## How to work

- **Phase 0, inventory (read-only; subagents are fine).**
  - Audit the whole chain as it stands, both ways and all modes, into `docs/horizon/evidence/mountain-road/before/`.
  - Capture every hairpin, every join and each neighbour gap.
  - List every place the region's road and the Horizon disagree: surface, ground, collision, art.
- **Phase 1, the Mountain Road book.** Write `docs/horizon/MOUNTAIN_ROAD.md`, the mountain's ROAD.md. It contains:
  - decisions D-MR1 onward;
  - the reach table;
  - the region/corridor ownership line;
  - the hairpin table;
  - the neighbour verdicts, each with a drawing (plan and profile) and its measurements;
  - any new landmark bridge in `BRIDGES.md` format;
  - the owed list.

  **Stop.** Give Jonathan the book and the decisions in plain words.
- **Phase 2, the chain.** Finish Prow → summit end to end to the road's bar: handovers, guards, lamps, planting, stops, map, audit, captures, tests and handoff. **Stop** for Jonathan's look, and a ride on his phone if he wants one.
- **Phase 3, the links.** One PR per link, grade links first and then any bridge link, each to the same bar.

For every PR:
- Run the quick gate: `pnpm test -- --risk=high --focus=<test> --focus-reason="…"`.
- Run every `horizon*`, `journey-*`, `harbour-world-toggle`, `harbour-source-fences` and `harbour-walk*` file one at a time, plus any Mountain v2 tests your change reaches.
- `pnpm typecheck`; bake and a byte-exact check; the `dump-mountain-v2 --check`; the road and mountain audits before and after; the view proofs; and a blind reviewer.
- Check widths 320, 390, 720 and about 1100 wherever UI changes (the inspector, map labels).
- Use fictional Development data only, and no secrets.
- Write the handoff in `docs/CODEX_HORIZON_MOUNTAIN_ROAD_<n>.md` and add an `AI_HANDOFF.md` entry.

## Hard rules

- No money, commands, schema, sync, Auth/RLS or Hercules payload changes. Nothing on the road posts money.
- No steering assist, snapping or global physics change. Mountain roads are driven with the same controllers as everywhere else.
- No invisible walls, no unguarded drop a rider can reach at speed, and no step over 0.48 on the rider's line.
- No change to Mountain v2 itself, the live default world, without Jonathan's written choice.
- Reduced motion is respected. The flat edition is never gated by 3D.
- Nothing is "shipped" until it is merged to `main` and the live deployment has been verified.

End every stage with:
- the household outcome in one paragraph;
- both Dual Course deltas;
- what changed per reach and link;
- exact verification numbers;
- the captures, with the ones that are not device evidence named;
- rough areas stated plainly;
- the owed list;
- the next owner.