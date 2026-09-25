# Pass 4 — Pastimes

Builders: **Claude subagents**: the Lantern Hunt first, then six pastime groups in parallel, one integrator, one reviewer who has not seen the work. Gate: Jonathan plays each pastime on his Mac and iPhone. Delivery: `~/Downloads/hearth-horizon-p4-pastimes/`.

---

## Purpose

Make the fourteen things to do (`MANIFEST.json → names.pastimes`, Grand Plan ch. 10) playable on the finished island, none of which earns, unlocks, scores, nudges or displays anything financial (`CONTRACT §2.1`). The reward for finding a lantern is that it stays lit.

The Ore Line ride is pass 2's mover; the Campfire is kept as the monthly Chapter, unchanged. This pass builds the other twelve.

## Inputs

| Input | Keys / sections |
|---|---|
| `CONTRACT.md` | §2.1 (play earns nothing), §2.2, §2.3 (no fake life), §2.9, §2.10, §2.12; §4 (`lanterns`, and any new field this pass adds) |
| `MANIFEST.json` | `names.pastimes`, `pastimeData` (`nineBaskets`, `mailDayTargets`, `riverRunGates`, `bocce`, `lanternQuotas`, `skating`, `sledding`), `skate.S1`, `structures.landingQuay`, `sky` (`gates`, `courses`, `landings`, `plane`, `glider`), `water_routes.RIVER_RUN`, `DEEP_RUN`, `roads.V01`, `water.stillwater`, `landforms`, `districts`, `reserves`, `protected`, `views`, `underground.rooms.lanternCave` |
| `LIGHT.md` | §1 ("Nothing waits for the sun"), §3 (found lanterns), §7 |
| `STYLE.md` | §1.1 (pop-up motion for authored moments), §1.9 (ghosts), §1.10 (no text that scores or nudges play), §1.11 (found-lantern card), §1.12, §2.7 (the Lantern Cave) |
| `inputs/grand-plan.txt` | ch. 10 |
| Code at `PIN-3` | the movers, the kit, the neighbourhoods' pastime fixtures, Mountain v2 `race.ts` and its replay, the existing letters, the guide map |

## Base SHA rule

- Branch `claude/horizon-pastimes` from `PIN-3`. No geography change.
- Wave A (the Lantern Hunt and the shared framework) commits first; wave B tracks branch their work from wave A's last commit on the same branch.
- New `WorldDefinition` fields (`mailTargets` from `pastimeData.mailDayTargets`, `basketTees` beside `pastimeData.nineBaskets`, `canoeGates` from `pastimeData.riverRunGates`) are added to the interface and `CONTRACT §4` in the same PR (`CONTRACT §4`: "The definition is data").

## The rule, as a test

**Play earns nothing.** `test/horizonPlayEarnsNothing.test.ts`:
1. Static import graph: no module under `src/harbour/horizon/pastimes/**` imports, directly or transitively through `src/harbour/horizon/**`, any module under `src/core/**` (the money commands, owners, scope checks, `BasinReading`) or `src/harbour/mountain/basin.ts`. Allowlist: empty.
2. No pastime module writes to the sync envelope (`src/ledgerSync/**`) except through the household store named below.
3. String lint over pastime UI copy: no currency symbol (`$`, `€`, `£`, `¢`), no "earn", "reward", "unlock", "bonus", "streak", "daily", "come back tomorrow". Allowlist: the existing "Open the Fund" door at the S1 finish.
4. No pastime reads the sun clock to allow or deny play (`LIGHT §1`: nothing waits for the sun).

## Shared framework (integrator, wave A)

| File | Contents |
|---|---|
| `src/harbour/horizon/pastimes/shared/pastime.ts` | `Pastime` interface: `id` (from `names.pastimes`), `start(at threshold or pose)`, `stop()`, reduced-motion behaviour, calm-view behaviour |
| `src/harbour/horizon/pastimes/shared/householdStore.ts` | household-scoped state (found lanterns in order, best runs, sketchbook pages) through **the same store Mountain v2's race replay already uses**. If that store cannot hold these without a schema or sync change: stop, write the request, Codex trust review before any code |
| `src/harbour/horizon/pastimes/shared/ghost.ts` | ghost runs on the existing replay: translucent paper at 40 % with a dotted ink outline (`STYLE §1.9`); appears only during that run; labelled as a recording with its date; never stands at a porch; never shown as live presence (`CONTRACT §2.3`) |
| `src/harbour/horizon/pastimes/registry.ts` | pastime list; entry points from thresholds and fixtures |

## Tracks

| Track | Pastimes | Owns | Must not touch |
|---|---|---|---|
| P1 (wave A) | **Lantern Hunt** | `src/harbour/horizon/pastimes/lanternHunt/**`, `src/harbour/horizon/world/lanterns.ts`, `src/harbour/horizon/world/lights/lanterns.ts` | other pastime folders |
| P2 | Summit to Sea (with line choice), Ring Race, ground ghost runs | `pastimes/summitToSea/**`, `pastimes/ringRace/**` | `race.ts` (integrator) |
| P3 | Ring Run, Drop Zone, Mail Day | `pastimes/ringRun/**`, `pastimes/dropZone/**`, `pastimes/mailDay/**`, `world/mailTargets.ts` | `movers/**` |
| P4 | River Run, Deep Run | `pastimes/riverRun/**`, `pastimes/deepRun/**`, `world/canoeGates.ts` | `movers/**` |
| P5 | Nine Baskets, Bocce | `pastimes/nineBaskets/**`, `pastimes/bocce/**`, `world/basketTees.ts` | the fixtures' placement (`neighbourhoods/**`) |
| P6 | Winter (skating, sledding), the small ones | `pastimes/winter/**`, `pastimes/small/**` | `src/harbour/skate/**` (sim changes are requests) |
| P7 | The Sketchbook and postcards | `pastimes/sketchbook/**` | the letters' schema |
| I | Integrator | `pastimes/shared/**`, `pastimes/registry.ts`, `race.ts`, `src/harbour/scene/runtime.ts`, `src/harbour/HarbourWorld.tsx`, the guide map, `audio.ts` | `src/core/**`, the presence wire, the Worker |
| R | Reviewer | `evidence/review/**` | everything else |

All tracks: must not touch `src/core/**`, `src/harbour/mountain/basin.ts`, `src/harbour/data/reading.ts`, `src/harbour/village/layout.ts`, `src/harbour/horizon/land/**`, `src/harbour/horizon/kit/**` (requests only), the presence wire, the Worker, the Desk.

---

## P1 — Lantern Hunt (first)

- **Sixty-four spots** in `WorldDefinition.lanterns` (`pastimeData.lanternQuotas.total` 64; D6: 64 placed, 60 fill the Lantern Cave), ids `lantern.01` … `lantern.64`, each with position, the object it hangs from (a bracket, beam, branch, rock ledge, cave ceiling, mast; never floating, `STYLE §1.6` rule 6), district, and the modes that reach it.
- **Placement rules:** exactly the per-district counts of `pastimeData.lanternQuotas` (harbour 6, landing 6, reach 3, green 5, hollow 5, scholars 5, flats 6, bight 4, lakeside 5, notch 3, prow 4, crown 4, undercroft 4, offshore 4); none inside any reserve plot or its 6 m clear margin (`CONTRACT §5`); none inside `protected.green`; ≥ 8 reachable only by air, ≥ 6 only by water, ≥ 4 only underground (`lanternQuotas.rule`); ≥ 30 reachable on foot, step-free. No spot requires a timed or skill action.
- **Found** when the body comes within 3 eu (feet, board, bicycle, boat), when a glider or plane passes through its halo, or when it is looked at for 2 s within 80 eu from the balloon or a reduced-motion cut destination. Every spot is findable with reduced motion on.
- **Found means:** it lights with the found-lantern card (`#ffc76b`, `STYLE §1.11`) dusk → dawn (`LIGHT §3`); it hangs in the Lantern Cave in the order the household found it (`STYLE §2.7`); it marks the guide map as a lit dot. The first find of each spot is an authored pop-up moment (300 ms fade under reduced motion).
- **Household-scoped:** both partners share one found set through `householdStore`; no per-person tally.
- **No scores:** no count, no "x of 64" or "x of 60", no percentage, no progress bar, no hint that nags, no notification. The Hunt is better at night and never restricted to it.
- **Tests:** `test/horizonLanterns.test.ts` (64 unique ids; per-district counts equal `lanternQuotas`; placement rules; each hangs from an anchor; reachability per mode), `test/horizonLanternState.test.ts` (household scope; found order kept in the cave; lit dusk → dawn; no count in any UI string).

## P2 — Summit to Sea, Ring Race, ground ghosts

- **Summit to Sea** on `skate.S1`: 17 gates, the Landing quay finish (`structures.landingQuay`, `[1270,1330]`, on the islet between the Reach's west channel and the river) with its 25 m run-out, Retry in every state, "Open the Fund" at the end as now (a door, not a reward). **Line choice** only where pass 1 cut real alternatives: the dam apron's half-pipe or its level line, the Shoulder's rock-lip jump or its ground line, the Notch shelf. The Grand Plan's branch onto S4 is built only if the design lead adds its connecting bed in a land touch-up.
- **Ring Race:** a bicycle lap of Horizon Drive against the household's best run as a ghost; your own time shown at the end; no leaderboard.
- **Tests:** `test/horizonSummitToSea.test.ts` (17 gates in order; each line choice completes; Retry), `test/horizonRingRace.test.ts` (lap closes on `roads.V01`; ghost only during the run).

## P3 — Ring Run, Drop Zone, Mail Day

- **Ring Run:** the courses of `sky.courses`. The plane's `ringRun` is gates 1–11 in order; gate 12, the Throat, is glider only. The glider courses are `damRun` (Crown launch, gates 4 → 3, land on the Reach meadow `[1230,1190]`), `throatRun` (Crown launch, gates 10 (`h` 130) → 12, land in the Deep) and `lampHop` (Lamp gallery, gate 5, land on the Bight water beside the sandbar, which fades you to the sandbar), each with its launch, gates and landing as listed. No clock unless the player asks for one. At night the Lamp's beam is the beacon.
- **Drop Zone:** bail out of the plane over the Green; steer the parachute onto the target painted at `sky.landings.green` (`[1040,1065]`, the protected centre); the closer to the centre, the bigger the puff of dandelion seed. No number.
- **Mail Day:** fly the ring and drop paper parcels on seven rooftop targets, one per host (`pastimeData.mailDayTargets`: the seven hosts' roofs), as roof-anchored decals in `WorldDefinition.mailTargets` (new field; the host masters are not edited). Purely play: a parcel landing opens no tool, routes nowhere and writes nothing.
- **Tests:** `test/horizonRingRun.test.ts` (each `sky.courses` entry in order from its launch to its landing; plane ends at 11; gate 12 glider only; each glider course completes in still air at `sky.glider` speed and sink), `test/horizonDropZone.test.ts`, `test/horizonMailDay.test.ts` (no navigation or tool route fires on a delivery).

## P4 — River Run and Deep Run

- **River Run:** canoe from the lake inlet `[1160,740]` (`RIVER_RUN.pts[0]`; the Cup's outflow above it is a 62 % cascade, scenery only; paper boats still start at the Cup) across Stillwater, the dam portage (`thresholds.damPortage`: a threshold and a cut), the Notch, the Reach, to the harbour; `RIVER_RUN.gates` 9 gates at `pastimeData.riverRunGates` in `WorldDefinition.canoeGates`, each a pair of features that are there anyway (bridge piers, rocks, the High Span's arches), with slalom poles only where nothing else stands (a kit request).
- **Deep Run:** from the Deep's jetty (`thresholds.deepJetty`) down the Steps (three 12 m chutes in the Sea Passage's first 120 m, ridden like a flume; a cut under reduced motion; `water_routes.DEEP_RUN.drop`), then level along the Sea Passage (504 m) to the Sea Door `[1690,770]` (`water_routes.DEEP_RUN`), out under the Prow into daylight, then paddle round to the Landing. The spring at the Reach is decorative and not on this route.
- **Tests:** `test/horizonRiverRun.test.ts` (9 gates in order; portage; finish in the harbour), `test/horizonDeepRun.test.ts` (Deep → Sea Door along `DEEP_RUN.pts`; the daylight exit; the coast to the Landing inside `ROW.area`).

## P5 — Nine Baskets and Bocce

- **Nine Baskets:** disc golf on the pass-3 fixtures at `pastimeData.nineBaskets` (baskets 1–8 ringing the protected centre at 172–190 m, outside `protected.green`, the ninth on the covered bridge at `[893,600]`); tees in `WorldDefinition.basketTees`; the disc flies on the shared wind; throws counted per hole for the players only (not financial, not stored beyond the round).
- **Bocce:** on the square's small green beside the Court (`pastimeData.bocce`, `[1455,1150]`); on one device, two players taking turns or one player against the household ghost (`pastimeData.bocce.note`); a two-device game needs a presence wire change (request only, trust review); one jack, the Queen watching.
- **Tests:** `test/horizonNineBaskets.test.ts` (nine holes; no basket or tee inside `protected.green`), `test/horizonBocce.test.ts`.

## P6 — Winter and the small ones

- **Skating** on Stillwater's ice (`surfaces.ice`, pace `skate`; `pastimeData.skating` months 1–2) from Jan 6 to Feb 28 (`STYLE §1.7`), the board sim with skate parameters; skate arcs accumulate.
- **Sledding** on the Shoulder's south-east meadow (`pastimeData.sledding`, `[1400,760]`) in January and February (`pastimeData.sledding.months`, inside the snowline, `STYLE §1.8`), the board sim with sled parameters on `surfaces.snow`; a sled from a rack at the meadow's top.
- **The small ones:** skipping stones at Lakeside's shelf; kites on Long Sands on the shared wind, at any hour (`LIGHT §1`); at night the kite carries a small lantern (`STYLE §3.1`); paper boats from the Cup, floating down the river; dandelion clocks in June; fishing off the ferry pier (nothing is caught but time); "Where's Hercules" at his spots; the two bells: ring the summit bell (at `L02` or from the Bell Gallery's rope) and the harbour bell answers a beat later, quieter.
- **Tests:** `test/horizonWinter.test.ts` (ice and sledding available only in their date windows; the date, not a balance), `test/horizonSmallOnes.test.ts`.

## P7 — The Sketchbook and postcards

- Standing at the eye point of any of the twelve `views` (`viewRule`: `xy`, `eyeH`, `target`, `fov_deg`), within the drawing radius the design lead sets (not `radius_eu`, which is the streaming radius), draws its page: an authored pop-up moment (300 ms fade under reduced motion), captured in the current dressing, hour, season and weather, kept in the household's sketchbook through `householdStore`.
- **Postcards** go to the partner through the existing letters. If the letters cannot carry an image without a schema change, the postcard carries a page reference (page id and timestamp) and the recipient's app renders the page; no schema change without a Codex trust review.
- **Tests:** `test/horizonSketchbook.test.ts` (twelve pages; drawn only at the pose; household scope), `test/horizonPostcard.test.ts` (sent through the letters' existing interface only).

---

## Must produce

- [ ] The twelve pastimes above, each playable from its threshold or fixture.
- [ ] Sixty-four lantern spots meeting P1's rules (sixty fill the Cave); the Lantern Cave filling in found order; the guide map's lit dots.
- [ ] Ghost runs on the existing replay for Summit to Sea, Ring Race, a clocked Ring Run, River Run and Deep Run.
- [ ] `test/horizonPlayEarnsNothing.test.ts` green.
- [ ] Reduced motion and calm view for every pastime: timed runs available with cuts where the mover cuts; calm view keeps them silent.
- [ ] `CONTRACT §4` updated for every new `WorldDefinition` field.

## Must not

- Import from `src/core/**` or `basin.ts`; read, show or change any financial state; add a streak, daily reward, badge, unlock, or "come back tomorrow".
- Show a count or progress for the Lantern Hunt.
- Gate any pastime on the hour.
- Counterfeit the partner: a ghost is always a labelled recording; nothing implies she is present when she is not.
- Change the presence wire, the Worker, the letters' schema or any sync envelope without a Codex trust review.
- Change geography, beds, structures or kit pieces; add floating targets or world-space text.
- Use real household data.

## Tests to add

The per-track tests above, plus `test/horizonPlayEarnsNothing.test.ts`, `test/horizonGhostRuns.test.ts` (only during the run; labelled; never at a porch; never via presence), `test/horizonPastimesReducedMotion.test.ts`.

After each section: `pnpm exec vitest run test/<name>.test.ts --maxWorkers=1` and `tsc`. Final SHA only: `pnpm build`, then `pnpm test -- --risk=high --focus=harbour --focus-reason="horizon p4: pastimes, lantern hunt, play earns nothing"` within five minutes.

## Evidence required

| Evidence | File |
|---|---|
| Each pastime played start to finish: harness recording and step log | `evidence/rides/<pastime>.mp4`, `.json` |
| The Lantern Hunt at night: ten found lanterns lit in place, the Lantern Cave with those ten in order, the guide map | `evidence/pages/lanterns_*.png` |
| iPhone lite frame rate during Ring Run, Summit to Sea, the Lantern Cave: ≥ 30 fps sustained | `evidence/perf/p4_lite.json` |
| The play-earns-nothing test output | `evidence/tests.txt` |
| A postcard sent between the two review members of the fictional household | `evidence/postcard.png` |
| The twelve pages at `bestHour` and `also`, three dressings, full and lite (`CONTRACT §7`), each with a one-line verdict | `evidence/pages/<page>_<hh-mm>_<dressing>_<full\|lite>.png` |
| Reviewer's report | `evidence/review/REVIEW.md` |

## Gate

Jonathan plays each pastime on his Mac and his iPhone from `TEST-PLAN.md`, one Lantern Hunt evening included. Phone ≥ 30 fps lite. Sign-off per pastime; a pastime that fails stays unregistered.

## Delivery

`~/Downloads/hearth-horizon-p4-pastimes/`: `p4-pastimes.bundle` (`PIN-3..claude/horizon-pastimes`), `patches/`, `HANDOFF.md`, `FINISH-PROMPT.md`, `TEST-PLAN.md`, `evidence/`. Claude does not push; Jonathan pushes, merges, records `PIN-4`.

## Reconciled to MANIFEST v1.1 (reviewer)

- Inputs: `pastimeData`, `sky.courses`, `structures.landingQuay`, `districts` added; the new WorldDefinition fields now derive from `pastimeData`.
- P1: sixty spots → sixty-four placed (D6, `lanternQuotas.total` 64; sixty fill the Cave); v1.0's per-neighbourhood minimums replaced by the manifest's per-district quotas and its air / water / underground-only rule.
- P2: the Summit to Sea finish is the Landing quay on the west bank, not the town quay.
- P3: the glider Ring Run "pending the design lead's definition" replaced by `sky.courses` (`ringRun`, `damRun`, `throatRun`, `lampHop`); Mail Day targets cited.
- P4: the Deep Run no longer ends at the Reach spring; it runs the Sea Passage to the Sea Door and round to the Landing; River Run gates cited.
- P5: basket positions cited; bocce aligned with `pastimeData.bocce.note` (ghost opponent on one device).
- P6: skating and sledding cite `pastimeData`; the kite line no longer overrides STYLE (STYLE §3.1 v1.1 already flies kites at night with a lantern).

### v1.2 deltas (reviewer, MANIFEST v1.2)

- P2: S1 finish on the Reach islet.
- P3: `damRun` gates [4,3] landing on the Reach meadow; `throatRun` gate 10 at h 130; `lampHop` gate [5] landing on the Bight water; Drop Zone target at `[1040,1065]`.
- P4: River Run starts at the lake inlet `[1160,740]`; the Deep Run rides the Steps and the 504 m Sea Passage to the Sea Door `[1690,770]`.
- P5: baskets ring the centre at 172–190 m. P6: sledding `[1400,760]`, Jan–Feb.
- P7: page drawing tied to `viewRule`; `radius_eu` is the streaming radius, so the drawing radius is left to the design lead.
