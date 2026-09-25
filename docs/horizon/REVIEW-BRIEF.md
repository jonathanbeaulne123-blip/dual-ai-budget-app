# The Horizon — REVIEW BRIEF

How Claude reviews Codex's pass 1 (the land), and how a reviewer subagent reviews any pass. The method is the one used on Mountain v2 (the "dissection", `inputs/mountain-dissection-summary.md`): parallel read-only auditors, headless probes with numbers, renders from the twelve poses, and a live playthrough, reported as findings with a fix direction and a keep / re-author verdict.

---

## 1. Independence

- The reviewer is a fresh agent that **has not seen the work being produced**: not the builders' conversations, prompts, track notes or plans.
- It reads, in this order: `CONTRACT.md`, this file, `NOT-THIS.md`, the pass brief's *Must produce*, *Must not* and *Evidence required*, the `STYLE` checklists in scope, then the diff (`git diff <basePin>..<head>`).
- It runs its own probes and takes its own captures. The builder's `HANDOFF.md` and `evidence/` are read **only after** the findings are drafted, to reconcile. A `HANDOFF.md` claim that a probe contradicts is a MAJOR ("claim not true").
- Auditors are read-only: they never edit source, tests or the spine. They may write scratch probe scripts under `evidence/review/probes/`.
- The reviewer does not fix. Fixes go back to the owning track through `FINISH-PROMPT.md`.

## 2. The five auditors (run in parallel)

| # | Auditor | Reads | Checks |
|---|---|---|---|
| 1 | **Terrain** | `MANIFEST → island, offshore, landforms, water, protected`; `LIGHT §2`; `STYLE §1.2.9, §1.7, §3.3` | heightfield continuity, bands, asymmetry, faces, strata, summit, the Notch, water in its beds, the Bight, coasts, sea-through |
| 2 | **Beds and structures** | `MANIFEST → profiles, surfaces, roads, skate, walks, rail, cable, structures, underground, reserves`; `STYLE §1.6` | widths, grades, kerbs, parapets, retaining walls, skate surfaces and spots, decks, undersides, supports, tunnels, stations, caves, pads, host aprons |
| 3 | **Crossings and thresholds** | `MANIFEST → crossings, thresholds`; `CONTRACT §2.4, §2.7, §2.8` | the register against computed intersections, vertical separation, threshold pads and markers, step-free doors, invisible walls, mode switches |
| 4 | **WorldDefinition, streaming, performance** | `CONTRACT §4, §6`; `STYLE §1.13` | definition completeness and ids, one source of geometry, districts, triangles, draw calls, residency, per-frame builds, asset size, bake at import, first interactive, journey timings, geography revision and presence string, saved positions |
| 5 | **Sun and views** | `LIGHT.md`; `MANIFEST → views, sky`; `STYLE §1.2, §1.8, §1.12` | the sun map, sun-facing values, shadow swing, night readability, fog, horizon cards, the twelve poses' framing, the flight envelope's gates and corridors |

For passes other than 1, the same five run with their focus shifted:

| Pass | 1 Terrain | 2 Beds & structures | 3 Crossings & thresholds | 4 Definition, streaming, perf | 5 Sun & views |
|---|---|---|---|---|---|
| 0 | — | — | — | **all of it** (merges, A1–A5, v3 types, Desk isolation) | — |
| 2 movers | regression only | stations, cables, platforms, vehicles' contact | every threshold and mode switch; no silent switch; no invisible wall | perf in flight and at speed; streaming ahead | ride cameras, horizon in frame, night running lights and runway lamps |
| 2b kit | — | kit thickness, undersides, supports, contact shadows | markers, racks, reserve dressing | instancing, lite subtractions, draw calls | sun clock, shadow cadence, light cards, night palettes, dressings not tints |
| 3 neighbourhoods | regression only | placement on beds and aprons, bald rings, planting clearance | thresholds dressed; rides still complete | per-district budgets | the pages in three dressings, porch poses, the §2 checklist |
| 4 pastimes | — | targets and fixtures grounded | entry points at thresholds and fixtures | lite ≥ 30 fps | Lantern Hunt at night, the Lantern Cave; plus the play-earns-nothing audit |

## 3. The probes (20–32, headless)

Each probe writes `evidence/review/probes/P<nn>.json` with its value and verdict. Run on the review harness (`HEARTH_REVIEW_PORT=4192 node scripts/serve-whole-house-review.mjs`, `…/__review?seed=mountain&story=growing&run=first&member=MEM-001`, handle `document.querySelector('.house-world__canvas[data-harbour-tier]').__harbour`) or directly against `buildHorizonDefinition()` in a vitest scratch file.

| Id | Auditor | Probe | Fails when |
|---|---|---|---|
| P01 | 1 | Sample every landform polygon on a 10 m grid; share of samples inside its `h` band | < 90 % for any landform |
| P02 | 1 | Centroid → mid-band contour radius around 16 compass bearings | variation < 25 % (a cone or a ring) |
| P03 | 1 | Slope histogram of open ground; faces over the walkable limit without a strata set | any unstrata'd face over the limit; any walkable face over the limit |
| P04 | 1 | Highest sample and its position; edge fade within 100 m of the summit | highest point not at `crown.summit` ± 10 m; any fade near a summit |
| P05 | 1 | Sample every 5 m inside `island.outline`: terrain ≤ 0 outside named water | any sample |
| P06 | 1 | Every water surface sample vs. both bank heights; downstream order | water above a bank; any upstream rise |
| P07 | 1 | The Bight mouth width at the Bight Bridge | water gap wider than `structures.bightBridge.span_m` (230 m), or narrower than 90 % of it |
| P08 | 2 | Grade along every road, spur and trail centreline, 1 m steps | any > `profiles.road.grade_max_pct`; unlisted stretch > `grade_review_pct` |
| P09 | 2 | Walk every bed edge in 1 eu steps: drop to ground beyond the edge vs. `BODY_HEIGHT` 1.25 eu, parapet present | any drop > body height without a parapet (Mountain v2: 544 of 890 u) |
| P10 | 2 | Raycast up from 2 eu below every deck, platform and stair sample | no underside hit; thickness < `STYLE §1.6` minimum |
| P11 | 2 | Support path of every span: support within 15 eu of each end; bent / arch spacing | any gap |
| P12 | 2 | Lowest point of every solid and prop vs. the ground below | gap > 0.02 eu and unsupported |
| P13 | 2 | Each host: bed reaches the apron; angle between the approach and the door normal; door to bed distance | angle > 15°; the approach aimed at the building centre; bed not on the apron |
| P14 | 2 | Every cable: sag below the chord between each tower pair (G1 at `cable.G1.towers`); clearance over every bed and over the terrain; the zip's sagged clearance (`sag_pct` 1) over every roof (`hosts[*].roofH_eu` on `footprint_m`, and ≥ 12 m over `plot.terraces.*` for G1); the zip-over-gondola separation at `[1442,921]` | bows upward; clearance < `cable.G1.clear_eu` 8 (engine units, never scaled: `MANIFEST.json → profileRule`); zip < `cable.ZIP.minClearAboveRoof_eu` 12 above any roof; zip < 8 m above G1 (`crossings`: ZIP × G1); the rider's path meets a skater on S3 at the landing tower |
| P15 | 3 | Pairwise 2D intersections of every bed, line and water centreline vs. `WorldDefinition.crossings` | any unlisted intersection |
| P16 | 3 | Vertical separation at every `over` / `under` crossing | < the lower bed's clear height |
| P17 | 3 | Every threshold: pad, marker, mode pair, action; every bed that meets a threshold stops at it | any missing; any bed passes a threshold |
| P18 | 3 | Path-graph route from the square to each of the seven doors with stair edges removed; time at walk speed | any door unreachable; time vs `journeys.targets_s` |
| P19 | 3 | Collider mesh vs. render mesh along every bed edge and the coast | any collider with no visible geometry (an invisible wall) |
| P20 | 4 | Every `CONTRACT §4` field populated; ids from `names` or a pattern; any module reading geometry from outside the definition | empty field; stray id; a second geometry source |
| P21 | 4 | Triangles and draw calls per district, full and lite | over `CONTRACT §6` |
| P22 | 4 | Ten Walk↔Look toggles in 2 s, and a scripted flight across four districts: districts built per frame, residency | > 1 build per frame; any synchronous rebuild; residency over budget |
| P23 | 4 | Bake calls on import; terrain asset size and key; first interactive on the harness | any bake on import; > 2.5 MB; not keyed by revision; > budget |
| P24 | 4 | Every `journeys.targets_s` entry measured on the path graph at `scale.factor` | outside target (reported, not auto-failed, until the design lead rules) |
| P25 | 5 | Sun map at 09:00, 15:00, 19:00 on 21 June and 21 December | the Throat lit at any time; the dam's south face unlit at 09:00 or 15:00 in June; the square lit while the dam is shaded at golden hour |
| P26 | 5 | L* of south vs. north slope of one biome at solar noon on a page capture | difference < 8 L* |
| P27 | 5 | Each of the twelve poses built per `viewRule` (eye at `xy`, 1.6 eu up unless `eyeH`, looking at `target`, `fov_deg` horizontal at 16:9): every subject in `frames` inside the frustum and reached by an unoccluded ray; horizon line in frame; eye above ground | any subject missing or occluded; no horizon; eye under ground |
| P28 | 5 | 02:00 captures at 390 px: contrast of every door, threshold marker and edge lip; L* histogram mode | contrast < 3 : 1; mode outside 12–35 |
| P29 | 5 | `?sun=09:00` vs `?sun=17:00` on the same pose: shadow regions differ | any directional darkening that stays put |
| P30 | 5 | Fog on the Crown's summit seen from the square | outside 40–60 % fog (it is a silhouette, not a void) |
| P31 | 2 | Every reserve pad (`reserves`): size, its own `rot_deg` per `reserves.rotRule`, 6 m clear margin, distance from every bed edge, spacing ≥ 56 m, on land, served, not under a cable within its clearance | any pad or margin on a bed, in the sea, or inside `protected.green`; spacing < 56 m (`CONTRACT §5`) |
| P32 | 1 | Every host, place, room, door, jetty, pier, threshold and view point vs. its landform, water and footprint: hosts inside their `neighbourhoods[*].r`; Undercroft rooms inside `underground.footprint`; doors on its rim or on a listed tunnel; the Cup inside the Shoulder and outside the Crown; bands applied per `landformRule` (the Hollow, the Stillwater terrace and the Cup cut into the Shoulder; 60 m blends; beds override bands within width + 15 m); land things on land, water things in water, route points not in Stillwater | any |

A pass may add probes; it may not drop P05, P09, P12, P15, P19, P22 or P23 (the Mountain v2 failures).

## 4. Renders from the twelve poses

- The reviewer takes its own captures of pages A–L at `bestHour` and `also` (capture convention: `README.md §8`), 1440 × 900 and 390 × 844, in the dressings the pass brief requires. Saved as `evidence/review/pages/<page>_<hh-mm>_<dressing>_<tier>.png`.
- Each capture gets a one-line verdict against `STYLE §1.12`'s "At best hour", "At the also hour" and "Fails if" columns.
- The builder's captures are compared afterwards; a builder capture that the reviewer cannot reproduce is a MAJOR.

## 5. The live playthrough

On the harness at 1440 × 900, then at 390 × 844:

1. Sign in; land on the square; note the arrival frame.
2. Walk to each of the seven doors on foot; open the tool; return; note where the body and camera end up.
3. Stand in each of the twelve pages (`__harbour.shot('A')` … `shot('L')`), then walk out of each for 20 s.
4. Toggle Walk↔Look ten times fast; note stalls.
5. Set `?sun=02:00`; walk the square, one bridge, one tunnel, one Undercroft door.
6. Flip to the Reading edition (the backtick) and back; confirm no heightfield load on the flip.
7. From pass 2 on: ride every mode from its threshold to its far end; from pass 4: play each pastime once.
8. Turn on reduced motion and calm view; repeat steps 3 and 7 once.

Notes go in `evidence/review/playthrough.md`, one line per step with a timestamp and the concept xy from `__harbour.body().at()`.

## 6. Severity ladder

| Severity | Definition | Consequence |
|---|---|---|
| **BLOCKER** | Breaks a `CONTRACT §2` hard rule; exposes or uses real household data; touches money, schema, auth, sync, deploy, the presence wire or the Worker without a trust review; a door or required route is unreachable; `tsc` or `pnpm build` red; a crash; acceptance cannot be captured | Fixed before the gate. No merge. |
| **MAJOR** | Violates a `MANIFEST.json` number or tolerance, a `STYLE §1` rule ("violations are defects"), a `NOT-THIS.md` item or a `CONTRACT §6` budget; a Sketchbook page meets its "Fails if"; a `HANDOFF.md` claim is not true | Fixed in this pass before the gate. |
| **MINOR** | A visible deviation that breaks no rule, or a rule met with less than 10 % margin | Fixed if under an hour; otherwise carried in `FINISH-PROMPT.md` to the next pass. |
| **NIT** | Taste, naming, comment, a small inconsistency | Logged; no action required. |

When in doubt between two levels, the higher one.

## 7. Report format

`evidence/review/REVIEW.md`:

1. **Header:** pass, base pin, head SHA, reviewer, date, what was read (and confirmation that the builders' work was not seen before drafting).
2. **Verdict:** one paragraph. For pass 1, the first sentence says whether the land can go to Jonathan's gate.
3. **Counts:** BLOCKER / MAJOR / MINOR / NIT.
4. **Findings table**, most severe first:

| Id | Sev | Auditor | Where | Failure | Evidence | Fix direction | Keep / re-author |
|---|---|---|---|---|---|---|---|
| `R1-07` | MAJOR | 2 | `src/harbour/horizon/land/beds/road.ts:212`; V01 at `[1590,700]` | Parapet missing on 38 eu of edge with a 4.2 eu drop (P09); `STYLE §1.6.4` | `probes/P09.json`, `pages/A_19-40_classic_full.png` | Emit parapet where drop > `BODY_HEIGHT`; add the case to `horizonBeds.test.ts` | KEEP-FIX |

   - **Where** is `file:line` when the defect is in code, plus a pose id or concept `[x,y]` when it is in the world.
   - **Failure** is observed vs. expected with a number and the spine key it breaks.
   - **Fix direction** is one line: what to change, not the patch.
5. **Probe table:** P01–P30 with value, threshold, pass / fail.
6. **Pages table:** twelve pages × hours × tiers × dressings with the one-line verdicts.
7. **Keep / re-author table** (§8).
8. **Reconciliation:** each `HANDOFF.md` claim checked, true or not.

Each auditor writes `evidence/review/auditor-<n>.md` in the same table form; the lead reviewer merges, de-duplicates and assigns ids.

## 8. Keep / re-author

Every module the pass touched gets one verdict:

| Verdict | Means |
|---|---|
| **KEEP** | The contract and the place are right. |
| **KEEP-FIX** | The contract is right; the findings listed are local fixes. |
| **RE-AUTHOR** | The place is wrong: the geometry or composition must be redone from the brief, not patched. Required when one module holds three or more MAJORs with one root cause, or any BLOCKER that is structural (for example terrain built as cones, roads as ribbons, a dam in a pit). |

The Mountain v2 verdict is the model: keep the contracts (WorldDefinition, surface and collision queries, 3D gates, versioned presence, streaming, `BasinReading`, race scaffolding, the Skate v2 sim and card kit); re-author the place.

## 9. What Claude sends Jonathan after reviewing pass 1

One page: the verdict paragraph, the counts, the ten most severe findings each with one capture, and the list of pages that already look right. The full `REVIEW.md` rides in the delivery folder. Jonathan's gate follows only when BLOCKERs and MAJORs are closed.

## Reconciled to MANIFEST v1.1 (reviewer)

- P07: "260 m ± 10 %" replaced by the manifest key `structures.bightBridge.span_m` (230 m); the v1.0 figure would have failed a correct build.
- P14: "clear_m × factor" contradicted `MANIFEST.json → profileRule` (clearances are engine units and never scale); fixed. The zip's roof clearance and the zip-over-gondola separation (v1.1 `cable.ZIP`, `crossings`) added.
- P31 and P32 added for the v1.1 geometry the first review found wrong (reserves vs. beds, sea and the protected Green; hosts in their radius; Undercroft rooms and doors; the Cup; points in the lake or the sea).

### v1.2 deltas (reviewer, MANIFEST v1.2)

- P14: G1 towers and `clear_eu`; zip `sag_pct` 1 and `minClearAboveRoof_eu` against `hosts[*].roofH_eu`; ZIP × G1 at `[1442,921]`; the landing tower over S3.
- P27: poses per `viewRule` (target, fov, eyeH).
- P31: per-plot `rot_deg` and `rotRule`; cables over plots. P32: v1.2 `landformRule`.
