# The Horizon — the deck

> Current canonical manifest: v1.7 (Stage A design-lead data, 26 September 2026; see "v1.7 deltas" at the end). v1.6: Jonathan confirmed full scale 1.0 and three uphill Terraces plots (seven large reserves total) on 25 September 2026. `src/harbour/horizon/world/MANIFEST.json` is authoritative; embedded manifests in `inputs/` are frozen design references. The generator mirrors the canonical data. PIN-0 remains pending until its accepted merge SHA is recorded.

Version 1.7 · 26 September 2026 · Owner: Jonathan (product) · Author: Claude (design lead, review)

This folder is **what** to build, pass by pass. The Grand Plan artifact (`inputs/grand-plan.txt`, published as "The Horizon Grand Plan" v1.1) is **why**: the approved design, its chapters and decisions D1–D12 (`DECISIONS.md` carries their status and adds D13–D16). Nobody builds from the Grand Plan directly. Where the Grand Plan and this folder differ in a number or an id, this folder wins; where they differ in intent, stop and ask the design lead.

> **Golden rule: if a brief and `CONTRACT.md` disagree, `CONTRACT.md` wins.** Then `MANIFEST.json` (numbers), then `LIGHT.md` (the sun), then `STYLE.md` (the look), then the pass brief. A builder who finds a conflict reports it in `HANDOFF.md → Conflicts` and follows the higher file; a builder never resolves a conflict by editing the spine.

---

## 1. The four spine files

| File | Holds | Changes only when |
|---|---|---|
| `CONTRACT.md` | Hard rules, WorldDefinition v3 schema, performance budget, acceptance, roles | Jonathan approves; a pass that adds a WorldDefinition field updates §4 in the same PR |
| `MANIFEST.json` | Every number and id: landforms, water, hosts, beds, structures, crossings, thresholds, reserves, sky, views, journeys, names | Design lead edits, Jonathan approves; ids never change once merged (CONTRACT §2.13) |
| `LIGHT.md` | The real-sun day/night cycle; lights the island owns; night states | Design lead edits |
| `STYLE.md` | The art bible, seven neighbourhood sheets, the kit inventory (§3) | Design lead edits; corrected in the same PR if it contradicts the three above |

Briefs cite spine keys (`MANIFEST.json → structures.highSpan`, `STYLE §1.6.4`, `LIGHT §3`). A brief never restates a number loosely; if a brief quotes a number it quotes it exactly and names the key.

## 2. The rest of the folder

| File | Purpose |
|---|---|
| `DECISIONS.md` | D1–D16 with status and the pass each blocks; copied into `docs/DECISIONS.md` in pass 0 |
| `passes/00-reconcile.md` | Pass 0, Codex: merge the three bundles, fix Mountain v2 A1–A5, record D1–D16, WorldDefinition v3 types, pin |
| `passes/01-land.md` | Pass 1, Codex: terraform the island; Claude reviews; Jonathan gates by eye |
| `passes/02-movers.md` | Pass 2, Claude subagents: the nine movers beyond feet |
| `passes/02b-kit.md` | Pass 2b, Claude subagents, parallel with 2: the kit, the sun clock, the light cards, planting, ground paint, dressings |
| `passes/03-neighbourhoods.md` | Pass 3, Claude subagents: one template, seven neighbourhoods, two at a time |
| `passes/04-pastimes.md` | Pass 4, Claude subagents: fourteen pastimes, Lantern Hunt first |
| `REVIEW-BRIEF.md` | How any pass is reviewed (the dissection method), severity ladder, report format |
| `NOT-THIS.md` | One-page checklist of the Mountain v2 anti-patterns, each with its "instead" |
| `inputs/` | Read-only sources: Grand Plan text and HTML, the dissection summary, the pitch v0.1 notes |
| `make_manifest.py` | Design lead's generator for `MANIFEST.json`; builders never run it |

Mountain v2 file names in the briefs are as its `HANDOFF.md` lists them; where a brief gives a bare name (`streaming.ts`, `surfaces.ts`, `race.ts`, `lightRig.ts`, `audio.ts`, `camera/…`, `body/…`) the folder prefix is the one in that handoff.

From pass 0 on, the deck lives in the repository at `docs/horizon/` and the canonical manifest at `src/harbour/horizon/world/MANIFEST.json` (pass 0 copies both). After that, agents read the repo copy at their base SHA, never this scratch folder.

## 3. Who reads what

| Reader | Reads in full | Reads the parts named |
|---|---|---|
| Codex, pass 0 | `CONTRACT.md`, `passes/00-reconcile.md`, `DECISIONS.md` | `MANIFEST.json → names, scale, districts`; Grand Plan ch. 14 (wording of D1–D12) |
| Codex, pass 1 | `CONTRACT.md`, `MANIFEST.json`, `LIGHT.md §1–2`, `passes/01-land.md`, `NOT-THIS.md` | `STYLE §0, §1.2, §1.4 (clearings, strata), §1.5, §1.7, §1.8, §1.12, §1.13, §1.14` (per `STYLE §0.2`) |
| Pass 2 mover subagent | `CONTRACT.md`, its own section of `passes/02-movers.md`, `NOT-THIS.md` | `MANIFEST.json` keys its section names; `LIGHT §3`; `STYLE §1.1, §1.2, §1.6, §1.11, §1.12`, §3 vehicle rows |
| Pass 2b kit subagent | `CONTRACT.md`, `LIGHT.md`, `STYLE §1, §3`, `passes/02b-kit.md` | `MANIFEST.json → surfaces, reserves, names` |
| Pass 3 neighbourhood subagent | `CONTRACT.md`, `LIGHT.md`, `STYLE §1` + its own §2 sheet, `passes/03-neighbourhoods.md` (template + its section) | the §3 rows its sheet names; `MANIFEST.json → districts, neighbourhoods, hosts, places, thresholds, views, pastimeData` (its fixtures) |
| Pass 4 pastime subagent | `CONTRACT.md §2`, `passes/04-pastimes.md` | `STYLE §1.9–1.12`; `LIGHT §1, §3`; the `MANIFEST.json` keys its pastime names, `pastimeData`, `sky.courses` |
| Integrator (any pass) | everything its pass's subagents read | — |
| Reviewer (any pass) | `CONTRACT.md`, `REVIEW-BRIEF.md`, `NOT-THIS.md`, the pass brief's *Must produce / Must not / Evidence* | `STYLE §1.14` + the §2 checklists in scope; never the builders' conversation |
| Jonathan | `README.md`, each pass's `HANDOFF.md` and `TEST-PLAN.md`, the evidence folder | anything else he likes |

## 4. Pass order and gates

| Pass | Builder | Reviewer | Gate (who signs off) | Base | Produces pin |
|---|---|---|---|---|---|
| 0 Reconcile | Codex | Claude reviewer subagent + Codex trust reviews on each PR | Jonathan: three bundles merged, D11–D15 answered or explicitly deferred (D12 and D13 before pass 1) | `origin/main` HEAD at start | `PIN-0` |
| 1 Land | Codex | Claude, `REVIEW-BRIEF.md` (five auditors) | **Jonathan by eye** on the twelve no-props renders, then on Mac and iPhone | `PIN-0` | `PIN-1` |
| 2 Movers | Claude: 9 mover subagents + integrator | reviewer subagent | Jonathan rides each mode on Mac and iPhone | `PIN-1` | `PIN-2` (merged with 2b) |
| 2b Kit | Claude: 6 kit subagents + integrator | reviewer subagent | Jonathan looks at the kit render sheet | `PIN-1` | `PIN-2` |
| 3 Neighbourhoods | Claude: 2 neighbourhood subagents per wave + integrator | reviewer subagent per wave | Jonathan per wave, on devices | `PIN-2`, then each wave's pin | `PIN-3a…3d` → `PIN-3` |
| 4 Pastimes | Claude: one subagent per pastime group + integrator | reviewer subagent | Jonathan plays each pastime on devices | `PIN-3` | `PIN-4` |

Rules for the order:
- **Nothing goes on the land before Jonathan's pass-1 gate.** No kit placement, planting, dressing or mover route lands on the terrain until he has looked at the pass-1 renders and said go. Pass 2b may build and render its kit on the kit sheet before the gate; it merges only after.
- Pass 2 and pass 2b share no file (their briefs list ownership); they merge together into `PIN-2` through one integration branch.
- Pass 3 waves: (1) Little Harbour + Lakeside, (2) the Crown & Undercroft + the Hollow, (3) Scholars' Edge + the Landing & Long Sands, (4) the Flats. Each wave pins before the next starts.
- A pin is a merged SHA on `main`, recorded in `docs/DECISIONS.md → Pins` with the date, the pass, the geography revision and the presence world string.
- **One geography revision per pass** (CONTRACT §2.14): pass 1 sets `horizon-geo-1`. Passes 2, 2b and 4 do not change geography. Pass 3 batches every terrain request into one land touch-up at the end of wave 4 (`horizon-geo-2`, one Codex trust review for the presence bump).

## 5. How a pass runs (the one-shot pattern)

1. The integrator reads the brief, creates the branch from the base pin, creates every shared interface file named in the brief on the first commit, and assigns tracks.
2. Track subagents run in parallel. Each owns only the files its track lists; **never two agents on one file**. A track that needs a change in a file it does not own writes the request into `HANDOFF-notes/<track>.md` for the integrator.
3. Each track commits small, runs its focused suites after each section (`pnpm exec vitest run test/<name>.test.ts --maxWorkers=1`) and `tsc` (`node --max-old-space-size=5500 node_modules/typescript/bin/tsc --noEmit`).
4. The integrator wires the seams, runs every focused suite, captures evidence, runs `pnpm build`, then runs the exhaustive gate **once, on the final SHA**, within its five-minute budget: `pnpm test -- --risk=high --focus=<area> --focus-reason="<pass>: <one line>"`.
5. The reviewer subagent (has not seen the work) runs `REVIEW-BRIEF.md`. BLOCKER and MAJOR findings go back to the owning track; the reviewer re-checks only those.
6. The integrator packages the delivery (§6). Jonathan gates.

## 6. Delivery format (every pass)

Delivered to `~/Downloads/hearth-horizon-<pass>/` (for example `hearth-horizon-p1-land`), as Mountain v2 was:

| Item | Content |
|---|---|
| `<pass>.bundle` | `git bundle create <pass>.bundle <basePin>..<branch>`; verified with `git bundle verify` |
| `patches/` | `git format-patch <basePin>..<branch>`, one file per commit |
| `HANDOFF.md` | Base SHA, head SHA, branch name, geography revision, presence world string; what was built per track; files touched; tests added; every command run with its result; conflicts found; trust reviews required; known issues by severity |
| `FINISH-PROMPT.md` | A self-contained prompt that finishes every open MAJOR and MINOR, in the Mountain v2 A1–A5 style (id, file:line, failure, fix direction, test that proves it) |
| `TEST-PLAN.md` | Jonathan's device steps: harness or app URL, pose or route, expected result, where to write the verdict; Mac first, iPhone second |
| `evidence/` | `pages/<page>_<hh-mm>_<dressing>_<full\|lite>.png`, `probes/*.json`, `perf/*.json`, `rides/*.mp4` or step logs, `review/REVIEW.md` from the reviewer |

**Claude never pushes** (no credential). Jonathan or Codex pushes the branch, opens the PR, requests the Codex trust review where the brief says so, merges, and records the pin. Codex passes deliver the same folder and may push their own branch as a draft PR; nothing merges before its gate.

## 7. Rules every brief repeats (from `AGENTS.md`)

1. Fictional data only: the `mountain` review household (`member=MEM-001`) or a successor; never Jonathan and Bianca's data, in tests, renders, harness runs or evidence.
2. Three themes (dressings) authored: Classic, Taylor, Newfoundland; palette-only differences are a defect.
3. Reduced motion and calm view kept in every change.
4. The flat edition (the Desk) is never gated by 3D and never imports the heightfield.
5. No money-semantics, schema, auth, sync or deploy change without a Codex trust review; the Worker (`workers/ledgerRoom.ts`) and the presence wire (`src/ledgerSync/worldPresenceWire.ts`) count.
6. Commit small; run focused suites after each section.
7. The change-focused quick gate (`pnpm test -- --risk=high --focus=... --focus-reason=...`) runs on the final SHA, within its five-minute budget. Exhaustive lanes remain separately authorized under `docs/VERIFICATION.md`.
8. `pnpm build` green before handoff.

## 8. Review harness and capture convention

- Serve: `HEARTH_REVIEW_PORT=4192 node scripts/serve-whole-house-review.mjs`
- Open: `http://localhost:4192/__review?seed=mountain&story=growing&run=first&member=MEM-001` plus `&sun=HH:MM` (LIGHT §1).
- Runtime handle: `document.querySelector('.house-world__canvas[data-harbour-tier]').__harbour` → `shot(id)`, `body().at()`, `nearestStation`, `mountainTravel`.
- Sizes: 1440 × 900 (full tier: needs ≥ 720 px and `hardwareConcurrency > 4`) and 390 × 844 (lite).
- Headless captures are the builder's checks. Acceptance captures come from Jonathan's Mac and iPhone (CONTRACT §2.15, §7).
- Poses are built from `MANIFEST.json → views` per its `viewRule` (eye at `xy`, 1.6 eu up unless `eyeH`, `target`, `fov_deg`). `views[*].bestHour` and `.also` are words; captures use `LIGHT §1`'s mapping from the solar function at 44° N on the capture date: dawn = sunrise; morning = sunrise + 3 h; noon = solar noon; afternoon = noon + 3 h; golden hour = sunset − 1 h; sunset = sunset; dusk = sunset + 30 min; night = 22:00. The readable-night checks (`LIGHT §1`, `REVIEW-BRIEF` P28) are captured at 02:00 in addition. Reduced-motion captures use the frozen 15:30.

## Reconciled to MANIFEST v1.1 (reviewer)

- Version line 1.0 → 1.1; `DECISIONS.md` added to the folder table and to pass 0's reading; D1–D13 → D1–D16; the pass-0 gate names D11–D15.
- Pass 3 and pass 4 readers pointed at `districts`, `pastimeData` and `sky.courses` (new in v1.1).
- §8 capture mapping: the deck-set interim mapping (dawn + 10 min, 09:00, 15:30, sunset − 45 min, night 02:00 …) replaced by `LIGHT §1` v1.1's clock times, which now exist; 02:00 kept only for the readable-night checks.

### v1.2 deltas (reviewer, MANIFEST v1.2)

- §8: capture poses built per `viewRule` (v1.2 views carry `target`, `fov_deg`, `radius_eu`, and `eyeH` for J).


## The Journey scale (added 25 Sep, afternoon)
`SCALES.md` defines the Journey map and the world as two scales of one place: the map is home, the zoom is a tier change on shared coordinates, one `WorldOverlay` derives on read, the Year Walk's twelve stations carry time, the homestead carries everyday life and the only physical wear. It adds pass `02c-journey-scale.md`, amendments to 01/02b/03, CONTRACT rules 15–18 and `journey` in the manifest, STYLE §1.15, and decisions D18–D26. Inputs: `inputs/journey-brief.txt` (Jonathan's brief) and `inputs/our-path-living-world-prototype.html` (his prototype, a guide not a spec).

## Time and the plan (added 25 Sep, later)
`TIME.md` decides the flow of time (a walk of day-stones on the Year Walk; one day ledger; the month turns at the Campfire) and the Plan Studio (the kitchen table; "One Pull Raises It"; one card with four views; Direction C's drawer; one five-beat ritual). It adds pass `02d-kitchen-table.md`, amendments to 01/02b/02c, CONTRACT rules 19–20, `journey.stretch` in the manifest, and decisions D27–D33.

## Files and their sources
- The canonical manifest is `src/harbour/horizon/world/MANIFEST.json`; `docs/horizon/make_manifest.py` reproduces it. Run the generator in a temporary directory, compare its JSON with the canonical file, and copy an approved result there. Earlier embedded manifests and review claims under `inputs/` are historical. V1.6 reconciles the prerequisite data; v1.7 re-authors the Stage A land data from the review. Neither claims built geometry or clearance acceptance; the land is re-baked from v1.7 by the integrator.
- `inputs/grand-plan.html` is the approved Grand Plan artifact (the *why*), whose map draws from this same manifest.
- `inputs/mountain-dissection-summary.md` and `inputs/horizon-pitch-v0.1-notes.txt` are the historical references the briefs cite.
- `DECISIONS.md` points to the live list. D12/D13 and the station/homestead land scope D21/D25 are approved; other recommendations retain their recorded status.

## v1.7 deltas (Stage A, design lead)

MANIFEST v1.6 → v1.7, 26 September 2026, Claude (design lead, track T0). Inputs: the five Stage A review reports (auditors 1–5) and their probes. Every number below was checked on a scratch bake of this manifest; the committed `public/horizon/` artifacts are **not** re-baked here (the integrator re-bakes once). The scratch bake is the repository's own bake with four simulated builder changes that the land and runtime tracks own: the Year Walk laid verbatim from `journey.yearWalk.pts` with its pins and shared heights, `journeys.anchors`, `sky.waterLandings`, and `views[*].target_h`. Ids are unchanged (CONTRACT §2.13).

### 1. The Year Walk, re-authored on land

**Why.** Auditors 1–3 (A1-01/02/07, A2-03/04/10/17, A3-01/03/22) found the v1.6 walk on the seabed (down to −11.4 eu), 100+ points inside Stillwater, through `plot.bight.1`, and stacked beside V01/V02 at 20–57 eu height differences, with retaining walls that cut both roads. The v1.6 control points were diagram chords; six of them were offshore.

**What changed** (`journey.yearWalk`, `journey.stations`, `profiles.walk`):

- `yearWalk.pts`: 33 diagram points → 284 centreline points, entirely on land. Where the walk shares a corridor it now **shares the host bed** (`yearWalk.shares`: a footway at a stated offset and at the host's height, no separate terrain override) instead of laying a second bed beside it at another height: the lake rim trail and the Inlet Footbridge (Feb), Green Road's west footway (May, Sep), the Bight Bridge's lagoon-side footway (Jul out, Aug back), Horizon Drive's north-coast and Prow verges (Nov, Dec, Jan) and Crown Road's east verge through the Shoulder Tunnel (Jan). Three stretches lay their own trail (`yearWalk.ownTrails`): the Hollow lane (Apr and Jun, two lanes 3 m apart between Orchard Brook and S4) and the Lakeside zig-zag (Feb) off the Shoulder's south-west corner.
- `yearWalk.pins`: one pin per station pad (the builder's hard-coded 110/53/12 go; each pad sits at its own ground).
- Seven station pads moved inside their own neighbourhood because the pad sat on a road, a skate line or a channel (old xy kept in `movedFrom`, the reason in `moveWhy`): feb [1255,860] → [1100,721] (on S1 and the rim trail → the north-shore rim, "the skipping shelf"); apr [860,980] → [932,995] (across VBS and S4); jul [380,800] → [401,745] (on V01); aug [1230,1290] → [1203,1292] (into the Reach west channel); oct [800,300] → [790,322] (on V01); nov [1570,940] → [1622,912] (on V01 in its 34 m Prow cutting); dec [1475,1230] → [1488,1228] (on S3). jan, mar, may, jun and sep keep their xy. **Design-lead call:** the brief allowed a move only for a station in water (aug); the other six pads physically overlapped a road or skate bed, which the no-stacking rule forbids. Jonathan may overrule any of the six.
- `profiles.walk.grade_max_pct` 12 (new; the builder already graded the walk at 12 %) and `grade_typ_pct` [0, 8].
- The builder (land track) must use `pts` verbatim: no inserted controls, no special-cased points, pins from `pins`, heights on `shares` copied from the host.

**Measured on the scratch bake (v1.6 bake → v1.7 bake):**

| Check | v1.6 | v1.7 |
|---|---:|---:|
| Length (m) | 9 751 | 11 541 |
| Bed points > 3 m outside the island outline (not on the Bight Bridge deck) | 448 | 62, all on V01's own north-east corner [1454–1521, 324–389], which lies outside the outline (V01's alignment, not the walk's) |
| Bed points below sea level | 212 | 0 |
| Bed points below a lake, lagoon or river surface | 99 | 3 (the upper-river crossing, which must be carried on the Inlet Footbridge) |
| Reserve plots crossed (plot + 6 m margin) | plot.bight.1 (~500 m²) | none |
| Bake conflicts, all families | 186 | 144 (with every v1.7 delta) |
| Year Walk conflicts | 22 | 10 (at-grade thresholds still to build: S1 [1255,862], spur cottage, walk bightPier, walk garden, southPortal.link; the upper-river crossing on the Inlet Footbridge) |
| Terrain–bed gap: centreline samples ≥ 1.25 eu over the ground, all beds (m) | 7 296 | 4 560 |
| … of it on the Year Walk (m) | 2 172 | 1 262 (about 430 m is the Bight Bridge deck by design; the rest is the Lakeside zig-zag and the verges beside V01's cuttings) |
| Year Walk samples within 7 m of another bed at > 1.25 eu height difference | V01 256, S2 48, walk garden 72, V02 36, S1 32, walk prow 24, … | V01 30 and S2 74 (S2's lane on the Flats arm, fixed when S2 is re-laid), walk garden 38 (Green Road's footway under the garden walk's crossing deck), walk prow 52 (the Prow drive's seaward verge below the Prow walk's dead end) |

Stretch lengths (m, previous station → station): jan 1 511 · feb 1 065 · mar 669 · apr 863 · may 526 · jun 980 · jul 1 015 · aug 1 171 · sep 925 · oct 502 · nov 1 483 · dec 858 (v1.6: 1 411 · 546 · 874 · 542 · 358 · 999 · 995 · 1 205 · 670 · 520 · 1 345 · 323).

**Still owed by other tracks** (see the Stage A handoff notes): the Lakeside zig-zag (x 1285–1336, z 845–885) is a stacked switchback ramp with retaining walls, 30 m of descent in eight short legs, and it is the only step-free way off the Shoulder that does not cross S1 (structures; or terrain eases the Shoulder's south-west corner so that two legs suffice); the S1 crossing at [1255,862] is 2.9 eu out of grade; the Prow and Shoulder tunnels must carry the footway inside their section; V01's north-east corner sits outside the outline.

v1.6 points (retired; also kept as `yearWalk.retired_v1_6_pts`):
`[1330,640], [1255,860], [1130,720], [990,780], [930,660], [880,560], [740,400], [700,470], [760,700], [860,980], [960,640], [893,600], [950,1445], [740,1432], [560,1100], [470,1030], [380,800], [430,900], [560,890], [840,880], [1240,1130], [1230,1290], [1040,650], [900,290], [800,300], [1300,260], [1500,340], [1590,700], [1570,940], [1480,1060], [1475,1230], [1370,690], [1330,640]`

<details><summary>v1.7 points (284)</summary>

`[1330,640], [1355,660], [1350,685], [1375,690], [1415,680], [1445,690], [1445,695], [1465,685], [1460,705], [1470,700], [1460,755], [1405,865], [1390,870], [1395,870], [1330,885], [1320,880], [1315,865], [1320,885], [1305,845], [1305,875], [1300,855], [1300,880], [1295,860], [1295,880], [1290,860], [1290,885], [1285,870], [1285,880], [1245,855], [1250,845], [1250,800], [1235,755], [1145,720], [1100,720], [1080,725], [1055,710], [1100,600], [1085,555], [1070,535], [960,470], [930,480], [895,480], [905,470], [885,465], [815,470], [800,480], [755,480], [700,470], [715,450], [770,450], [790,440], [855,445], [870,465], [905,470], [895,475], [905,475], [895,480], [915,480], [900,500], [905,545], [910,565], [925,585], [905,610], [900,640], [900,628], [899,660], [898,700], [895,740], [892,780], [887,815], [890,870], [920,900], [915,910], [930,995], [990,1010], [997,1006.7], [977.4,967.2], [966.1,929.6], [957.3,889.1], [953.3,848.9], [956.7,808.9], [962.3,768.6], [969.2,725.7], [975.4,689.6], [986.5,649.9], [994.1,612.3], [970,625], [960,640], [930,605], [910,605], [903,628], [902,660], [901,700], [898,740], [895,780], [890,815], [870,835], [870,870], [885,905], [865,920], [845,965], [865,985], [885,1065], [885,1120], [900,1180], [920,1220], [960,1355], [970,1365], [945,1385], [950,1445], [925,1440], [870,1385], [790,1325], [735,1270], [765,1235], [710,1190], [701.9,1195.9], [679.4,1178.1], [645.9,1154.1], [613.3,1133.2], [579.3,1111.5], [546.3,1090], [512.6,1067], [482.5,1044.2], [454.9,1014], [437.3,979.5], [423.4,943.6], [410.5,904], [425,890], [400,745], [425,770], [440,860], [440,870], [412.6,903.3], [425.5,942.8], [439.3,978.6], [456.7,1012.8], [483.9,1042.5], [513.9,1065.2], [547.5,1088.2], [580.5,1109.6], [614.5,1131.3], [647.1,1152.2], [680.8,1176.4], [703.3,1194.2], [730,1180], [930,1265], [950,1265], [970,1245], [1120,1270], [1160,1300], [1205,1290], [1160,1245], [1120,1250], [1100,1245], [975,1155], [960,1130], [955,1095], [990,1010], [994.6,1008.6], [974.6,968.2], [963.2,930.4], [954.3,889.7], [950.3,848.9], [953.7,808.6], [959.3,768.2], [966.2,725.2], [972.5,688.9], [983.6,649], [991.1,612], [1010,615], [1040,650], [1045,550], [1055,505], [1045,490], [995,470], [980,415], [945,370], [915,370], [820,345], [790,320], [810,305], [810,280], [815,275], [895,275], [899.2,283.6], [940,276.6], [980,268.6], [1017.4,261], [1056.8,253.2], [1096.5,246.3], [1136.3,242.6], [1178.5,242.2], [1216.7,243.5], [1259.2,246.9], [1297.7,252.8], [1319.7,258.5], [1340.4,281.3], [1379.9,294.4], [1415.6,307.5], [1453.6,323.6], [1487.1,341.9], [1508.5,367.9], [1524.1,404.6], [1535.4,441.5], [1545.7,481.6], [1554.7,520.2], [1561,556.4], [1567.4,598.5], [1572.5,635.5], [1577.9,678.4], [1581,705], [1570,665], [1575,670], [1600,665], [1615,725], [1630,745], [1630,855], [1620,910], [1645,875], [1650,855], [1650,745], [1645,725], [1615,685], [1596.9,703.2], [1601.5,743.6], [1605.7,784.8], [1608.1,827.2], [1605.7,864.9], [1592.8,905.1], [1576.5,943.3], [1558.6,980.4], [1536.4,1014.4], [1502.6,1037], [1500.3,1038.1], [1510,1050], [1510,1100], [1525,1175], [1500,1200], [1490,1230], [1500,1200], [1545,1160], [1535,1120], [1540,1085], [1530,1055], [1505,1015], [1495,1015], [1490,1020], [1494.7,1026.4], [1527.3,1005.1], [1548.8,970.9], [1564.7,937.9], [1580.6,900.4], [1593,862.2], [1595,822.6], [1592.7,785.9], [1588.9,747.7], [1584,704.7], [1579.2,664], [1574.3,626.7], [1568.7,586.5], [1562.7,548], [1555.2,508.1], [1546.3,471.5], [1536.1,432.7], [1524.2,396], [1506.8,358.9], [1495.4,344.6], [1505.5,343.5], [1482.9,377.2], [1461,411.8], [1449.5,447.4], [1452,485.4], [1449.1,529], [1433.5,565.6], [1417,599.6], [1400.2,635.7], [1383.7,674.4], [1376.8,690.6], [1345,680], [1355,675], [1330,660], [1345,650], [1330,640]`

</details>

### 2. Views v1.7 (the twelve Sketchbook poses)

**Why.** Auditor 5 (A5-01/04/05/11/14–21) passed 0 of 12 poses at 16:9 and 0 of 12 at 390 × 844: subjects behind the camera or outside the 55° frame, eyes beside banks, page E against the launch mound, and a runtime that kept the landscape vertical FOV on a phone (15.3° horizontal).

**What changed** (`views`, `viewRule`):

- `viewRule` is now `{landscape, portrait}`. **The portrait rule:** on a portrait capture the camera holds the page's *horizontal* FOV, never the vertical one: horizontal FOV = `portrait.fov_deg` (never below 45°), aimed at `portrait.target` / `portrait.target_h` (the page's target when absent), from the landscape eye; `portrait.frames` lists the subjects that must be legible on the phone. The runtime track implements it (`runtime/index.ts` lookAt, `world/views.ts` proof).
- Every view gains `target_h` (the look-at height; it replaces the per-page constants and the terrain-height default in `views.ts`), `portrait`, `deferred` (props that arrive in Pass 2/2b/3) and `v1_6` (the retired pose). `frames` words now name only Pass 1 subjects.
- Pose values: the table. "‰" is the share of a ray-cast ID buffer (128 × 72 landscape, 60 × 130 portrait) that hits the subject first, on the scratch bake with the v1.7 Year Walk; "LOS" is the first hit on the eye→subject line.

| Page | v1.6 pose (xy → target, FOV) | v1.7 pose (xy → target @ h, FOV, radius) · portrait | Why (auditor cause) | Landscape / portrait after | Still blocked (owner) |
|---|---|---|---|---|---|
| A The square | [1455,1200] → [1200,700], 55° | [1470,1186] → [1175,960] @30, 60°, r480 · 50° → [1195,1005] @28 | POSE: the Reach 80.6° and the High Span 39.3° off axis. No lens on the square holds the Reach (bearing ≈ 237°) with the dam (311°); the Reach moves to `deferred` (page I carries it). | High Span 0.5 / 0.3 ‰, dam 0, Crown 0 — all three are now inside the frustum | LAND: the Green's Notch-side rim at [1276,1114] (22 eu) cuts the deck line — lower ≥ 3 eu; the bank at [1193,954] (32–48 eu) buries the dam — ≤ 18 eu over x 1140–1200, z 905–1000 (A5-03); the Shoulder's south edge at [1403,885] (74 eu) hides the summit by ≥ 23 eu — **recommend Jonathan drops the Crown from A** (it is page E's) rather than cutting the Shoulder |
| B Lamp gallery | [540,1195] → [900,700], 55° | [540,1195] → [515,880] @20, 55°, r520 · 50° → [522,940] @18 | POSE: the Flats 47° and the hook 57° off axis | bridge 38.8 / 11.2, Flats 10.5, hook 84.9 / 25.6 ‰ | — |
| C High Span | [1245,1125] → [1240,1105], 55° | [1268,1145] → [1210,1098] @16, 55°, r220 · 50° → [1222,1102] @16 | POSE: the eye stood on the walk in the river looking up the deck's underside (pitch 14.7°) | deck 48.7 / 17.1, walk 22.4 / 7.3, water 153 ‰ | LAND: the shelf (h 12) is hidden by the west-bank lip at [1227,1119] (12 eu) — cut the lip to ≤ 10 eu over x 1215–1235, z 1100–1150 or raise the shelf (A5-11) |
| D Long Sands | [900,1470] → [540,1230], 55° | [1185,1445] → [700,1462] @6, 55°, r720 · 50° → [700,1454] @5 | POSE: the zip landing was 139° behind the camera | landing 65.4 / 22.3, Lamp 1.2 / 0.3, surf 2.8 / 0.6 ‰ | the Lamp is 690 m away: its legibility rests on the Pass 2b lighthouse; "a bench" is deferred |
| E The Crown | [1310,430] → [1000,1000], 55° | [1305,482] (the summit lookout's run-off deck) → [870,860] @20, 55°, r900 · 55° → [1000,880] @20 | POSE + LAND: the eye was 2 eu from the launch mound. **Frames re-worded:** from the summit the Shoulder hides the harbour, the Reach, Long Sands and the Prow; no single lens holds "everything" | Green 22.7 / 9.1, Stillwater 11.1 / 1.8, the Flats 25.4, the sea 130 / 31 ‰ | STRUCTURES: the lookout deck (h 170, see §4) must be a walkable structure; today the builder raises a terrain pad there |
| F Dam crest | [1150,905] → [1450,1180], 55° | [1158,905] → [1400,1150] @14, 55°, r420 · 45° → [1260,990] @30 | the lake was 146° behind the camera: "the lake behind" means behind the viewer, so it leaves `frames` | L01 57.8 / 22.4, town 4.8 / 2.2 ‰ | LAND: the same bank south of the dam ([1184,955], 46 eu) hides most of the town |
| G The Deep | [1300,440] → [1300,300], 55° | pose kept; `target_h` 110 (was a constant) · 45° | the skylight sat on the Throat's centreline | (underground; not ray-probed) | MANIFEST (§5): skylight → [1320,400]; LAND: open the Deep's roof along the Throat corridor (x 1287–1313, z 380–420) and close the wall/roof seam at [1258–1267, 130, 335] (A5-13) |
| H The Flats | [330,800] → [435,690], 55° | [440,760] → [100,560] @30, 55°, r260 · 50° | POSE: the camera faced north-east, away from the sunset; the windsock and the balloon are Pass 2/2b props (only their footings are built) → `deferred` | strip 407 / 473 ‰; the west sea is the horizon band beyond the 2 km field (the probe cannot count it; the line of sight clears the arm) | LAND: check the strip bed is not under the terrain at [414,712] (A5-19) |
| I Reach boardwalk | [1270,1240] → [1280,1150], 55° | [1275,1226] → [1250,1180] @5, 55°, r220 · 45° | POSE + LAND: the target sat up a bank (pitch 16.2°) and the Year Walk's retaining wall hid the spring — that wall is gone with §1 | spring 5.8 / 2.3, Reach water 44.7 ‰ | — (reeds and the heron deferred) |
| J Needle's Eye | [1790,720] h60 → [1790,680], 55° | [1840,1000] h60 → [1780,700] @14, 55°, r340 · 50° → [1760,760] | POSE: pitch −49°, the Stacks 175° behind | arch 15.3 / 5.3, Stacks 46.1 / 69, Prow 104 / 41.5 ‰ | — |
| K Glasshouse | [990,810] → [1130,820], 55° | [1000,758] → [1120,812] @52, 55°, r220 · 45° → [1060,800] @55 | POSE: the Glasshouse was 49° off axis | Glasshouse 76.2 / 55.1, Stillwater 124 / 37.8 ‰ | the roof/glazing is kit (Pass 2b) |
| L The quay | [1430,1290] → [1285,1315], 55° | [1484,1295] → [1285,1315] @4, 55°, r240 · 45° | POSE: the eye stood 4 eu from a bank, 36 eu upslope of the quay. The floatplane dock is at the quay's east end, opposite the Boathouse: no lens holds both; the floatplane (a Pass 2 mover) is `deferred` | Lantern Row 376 / 467 ‰; Boathouse 0 | BEDS: S3's bed (6–7 eu) crosses [1433,1298] above the quay (3 eu) and hides the Boathouse — bring S3 down to ≤ 3.5 eu there or north of the quay's west end |

PROOF (runtime track, `world/views.ts`): read `target_h`, `portrait` and the subject list from the manifest; map `structure.townQuay` to the built `town.quay.*` / `town quay.*` solids and `structure.balloonMooring` to `balloon.footing.*` (A5-27; both are in `MANIFEST → structures`, so they are id-mapping gaps, not missing builds); count landform pixels, not polygon-vertex samples (A5-28); require sky or sea on the horizon row (A5-29).

`test/horizonViews.test.ts` (not T0's file) asserts two v1.6 poses: line 17 expects page J's horizon out of frame (true of the old −49° pose; the v1.7 pose is at −8.6°) and line 28 places a test river under page C's old eye at [1245,1125]. Its owner updates both; the failures are the re-authored data, not the bake.

### 3. Journeys at scale 1.0

**Why.** Auditor 3 (A3-15/16/17): 7 of 9 journeys failed at scale 1.0 because the speeds and targets were authored as a pair at 0.6; "square→green running" had no path because its anchor (the Green's centre) has no bed within the 8 eu snap.

**What changed** (`speeds_ms`, `journeys.targets_s`, `journeys.anchors`; `sky.plane.speed_ms` and `cable.G1.speed` follow `speeds_ms`; `targets_v1_6` keeps the old targets; the three `at_factor` estimate tables are recomputed with the new speeds): walk 1.7 → 2.4, run 3.4 → 5.0, bicycle 6 → 8, board 7 → 10, plane 35 → 45, gondola 6 → 7 m/s; glider kept at 11. `journeys.anchors["square→green running"]` = [1053.9,1043.4], the nearest Green Road bed point (the runtime track reads it in `world/pathGraph.ts`). Every target is achievable with ≥ 10 % margin on the path graph of the scratch bake (lengths below); ranges keep ≥ 10 % inside both ends.

| Journey | Length (eu) | v1.6 speed (m/s) | v1.6 time (s) | v1.6 target (s) | v1.7 speed | v1.7 time (s) | v1.7 target (s) | Margin | Rationale |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| square→library by bicycle | 1 325 | 6.0 | 220.8 | 150 | 8.0 | 165.6 | 185 | 11.7 % | 29 km/h is a brisk island bike and stays ≤ 8 m/s for streaming; 3 minutes across the island reads as a trip |
| square→green running | 560 (to the Green's edge) | 3.4 | 164.7 (no path: anchor) | 100 | 5.0 | 112.0 | 125 | 11.6 % | a game run; the anchor moves onto Green Road at the Green's edge |
| square→summit by gondola + walk | 159 + 758 + 396 | 1.7 / 6 / 1.7 | 452.6 | 120 | 2.4 / 7 / 2.4 | 339.4 | 375 | 10.5 % | **reserved**: the last walk leg (396 eu for 103 eu of plan) is set by the gondola top station behind the 129 ridge; the target is the achievable value until Jonathan decides the station, then 180 (Auditor 3) |
| crown→quay on the board (S1) | 1 278 | 7.0 | 182.6 | 70–130 | 10.0 | 127.8 | 110–150 | 13.9 % / 17.4 % | an 11.8 % average downhill race line supports 36 km/h; keeps a ~2-minute race |
| crown→lamp by glider | 1 087 → 1 056 | 11.0 | 98.8 | 50–90 | 11.0 | 96.0 | 85–120 | 11.5 % / 25 % | glider speed is tied to sink and the 10 eu corridor; the target moves, not the physics (the launch moves to the summit lookout, §4) |
| ring by plane | 4 573 → 4 571 | 35 | 130.6 | 60–120 | 45 | 101.6 | 60–120 | 18.1 % | light-aircraft cruise; gate apertures and turns are re-checked at 45 by the movers track |
| square→home, walking | 57 | 1.7 | 33.8 | 60 | 2.4 | 23.9 | 60 | 151 % | full-scale walking pace |
| square→bank, walking | 90 | 1.7 | 52.8 | 60 | 2.4 | 37.4 | 60 | 60 % | (home and bank share one target key) |
| square→boathouse, walking | 388 | 1.7 | 228.2 | 100 | 2.4 | 161.7 | 180 | 11.3 % | the detour over the Quay Bridge is most of the time; when the homestead's timber crossing joins the path graph (≈ 260 eu, ≈ 108 s) the target returns to 120 |

`test/horizonManifest.test.ts` follows: the library target is 185 and the straight-segment estimate (182 s) now sits inside it.

### 4. The sky envelope

**Why.** Auditor 5 (A5-22 to A5-26): three gates sunk in rock, all five landing fields obstructed, and the Crown→Lamp glide starting inside its 10 eu margin (−0.20 eu).

| Key | v1.6 | v1.7 | Measured on the scratch bake |
|---|---|---|---|
| `sky.gates` throat | h 110, 26 × 18 | h 119 (the mouth's centre, mask 110–128), 24 × 16 inside the 26 × 18 mouth | clear |
| `sky.gates` scholarsCove | h 40 | h 48 (lift 8 over terrain 36.1–39.4) | clear |
| `sky.gates` lamp | h 20 | h 20.5 | clear |
| `sky.gates` highSpan | h 16, 40 × 14 | unchanged | blocked by the Notch's east wall (22 eu clear of 40): **terrain** widens the Notch to ≥ 40 eu between h 9 and 23 (cut the east wall at x 1255–1262) |
| `sky.landings` green | [1040,1065] r60 | [1028,1112] r60 (clear of Green Road by 5 eu and of the v1.7 Year Walk) | clear |
| `sky.landings` reachMeadow | [1230,1190] r40 | [1143,1167] r40 | clear |
| `sky.landings` sands | [1050,1440] r60 | [1095,1362] r60 | clear |
| `sky.waterLandings.bight` (new; the envelope used the lagoon's centroid) | centroid, r60 | [592,804] r60 | clear |
| `sky.waterLandings.deep` (new) | centroid [1300,420], r20 | [1278,423] r8 — the only clear water: the Ore Line's splash crosses the Deep and the Throat's foot fills its north side; no r ≥ 10 circle is clear | clear. For r 20 the underground track moves the splash ≥ 20 eu east or widens the Deep 15 eu west |
| `sky.launches.crown` and `thresholds.crownLaunch` | [1310,440] h160 (on a terrain mound north of the summit) | [1305,482] h170: the run-off deck of the summit lookout (L02) on the summit's south-west lip, a structure 12 eu above the ground | glide minimum clearance 12.6 eu over the terrain (≥ 10 from the first sample, arrival 55.9); the scratch bake still reports 9.7 because the builder hard-codes the crownLaunch pad at 160 as a terrain pad (`land/beds/build.ts:148`), which raises a mound under the deck |
| `sky.courses.damRun` | lands at [1230,1190] | lands at [1143,1167] | — |

**Launch: raised, and folded into the lookout — the choice and why.** A pad at 157.5 on the summit plateau (the option that keeps the pad below the summit) cannot clear 10 eu over the plateau within the proof's first 4 eu sample at any rim position (tested on the rim: [1296,496] at h 160 gives a 4.8 eu minimum, [1290,505] at h 158 gives 5.1 eu, and even [1300,490] at h 165 gives only 8.8 eu). The glide needs ≥ +10 eu of launch height (Auditor 5). A 12 eu run-off deck on the summit lookout gives it with 2.6 eu to spare, keeps the terrain summit (158) the island's highest ground (P04), gives page E an eye that is not beside a mound, and is architecture that is there anyway (L02 is "the summit lookout, observatory, the bell"). The structures track builds it as a deck; no bed may raise the ground above `landforms.crown.summitH`.
