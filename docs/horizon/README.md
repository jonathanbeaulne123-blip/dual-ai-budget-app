# The Horizon — the deck

> Current canonical manifest: **v2.4** (Stage A Wave 7, integrator 4, 27 September 2026; see "v2.4 (Stage A Wave 7, integrator 4)" at the end), on v2.3 (Stage A Wave 7, track W7-A; see "v2.3 (Stage A Wave 7, W7-A)"), on v2.2 (reconciled with main #549–#552, 27 September 2026; see "v2.2 (reconciled with main #549–#552)"): the Stage A land v2.1 plus main's two data-only v1.7 blocks — FLIGHT.md's sky fields (glider polar, parachute, Throat corridor, Drop Zone, landing modes, the carried `bailOut` threshold; D34 pending Jonathan) and RIDE.md's paces and surface grip (D42). v2.1 / v2.0: Stage A Wave 5 and Jonathan's rulings of 27 September 2026. v1.9 / v1.8 / v1.7: Stage A fixer, integration and design-lead data, 26 September 2026. v1.6: Jonathan confirmed full scale 1.0 and three uphill Terraces plots (seven large reserves total) on 25 September 2026. `src/harbour/horizon/world/MANIFEST.json` is authoritative; embedded manifests in `inputs/` are frozen design references. The generator mirrors the canonical data byte for byte. PIN-0 is recorded as the accepted #546 merge in `docs/DECISIONS.md`.

Version 1.9 · 26 September 2026 · Owner: Jonathan (product) · Author: Claude (design lead, review)

This folder is **what** to build, pass by pass. The Grand Plan artifact (`inputs/grand-plan.html`, published as "The Horizon Grand Plan" v1.1) is **why**: the approved design, its chapters and decisions D1–D12 (`DECISIONS.md` carries their status and adds D13–D16). Nobody builds from the Grand Plan directly. Where the Grand Plan and this folder differ in a number or an id, this folder wins; where they differ in intent, stop and ask the design lead.

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
| `RIDE.md` | The movement foundation for wheels: one ground kernel, the tyre step, S / A / D powerslide, the pump-boost, pace as physics, profiles for the board, the bicycle and pass 4's skates, the ride log and five tuning situations; D39–D46 |
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
| Pass 2 mover subagent | `CONTRACT.md`, its own section of `passes/02-movers.md`, `NOT-THIS.md`; **M1 and M2 also `RIDE.md`**, M6 also `FLIGHT.md` (pending its patch) | `MANIFEST.json` keys its section names; `LIGHT §3`; `STYLE §1.1, §1.2, §1.6, §1.11, §1.12`, §3 vehicle rows |
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

## Flight (added 26 Sep)
`FLIGHT.md` decides the glider and the parachute (track M6): a hang glider flown by the bar on a five-point polar (8–17 m/s, trim 11 / 1.2), thermals by the real clock, ridge lift worked on the Crown's south face, the landing-outcome table (walk-off, tumble, or a labelled fade — never a crash), the Throat as a corridor dive to a splash and three echoes, the parachute from the plane's carried `bailOut` threshold (freefall, auto-pull at 45 m, the Drop Zone as a wind problem, the plane flies itself home), one horizon-locked flight cam, two glass bubbles, reduced motion as a sheet of landings and pages. It asks for MANIFEST v1.7 sky-only fields and decisions D34–D38.
## Riding (added 26 Sep)
`RIDE.md` decides how wheels move: one ground kernel in `movers/shared/ground/` (state, fixed step, three-point contact, gravity everywhere, pace as rolling resistance and grip, drag-set top speed), the tyre step that makes carve, slide and twist one rule, S / A / D as the powerslide, the boost as the pump out of a clean slide released by W, the bed-bound edge (run-outs and pads at threshold pace; off the bed the wheels stall and a fade returns you), profiles for the board, the bicycle and the ice skates, the ride log and five reproducible situations. It refines pass 2's M1 and M2 and the approved D7, retires Skate v2's ground model by a keep / merge / replace / remove table, and adds decisions D39–D46 (D34–D38 belong to `FLIGHT.md`, whose patch is not yet on `main`).

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

### 5. Manifest self-contradictions and unread numbers

| Key | v1.6 | v1.7 | Source |
|---|---|---|---|
| `profiles.walkable.slope_max_deg` | 38 (code uses 40) | 40, matching the kept Mountain v2 body limit | A1-14, A2-14 |
| crown launch vs summit | launch h 160 at [1310,440], 2 eu over the 158 summit | launch folded into the summit lookout (§4); the summit stays the highest ground | A1-06, A5-01 |
| `underground.rooms.deep.skylight.to` | [1300,400], on the Throat's centreline | [1320,400], 20 eu east, still inside page G's frame (26.6° off axis) | A5-13 |
| `profiles.road.exceptions` (new list; `exception` kept) | only the Prow cliff drive | + Crown Road (V02) may hold 12 % continuously on its ≈ 300 m climb to the Shoulder Tunnel (the geometry forces 36 m over 382 m); every other stretch over 8 % is listed by the bake | A2-13 |
| `profiles.rail.grade_max_pct`, `profiles.rail.chainLift` (new) | none (the bake used 1000 %) | 6 %, with the climb out of the Deep to the South Portal ([1300,420] → [1345,680]) a named chain-lift incline; the drop at [1270,450] stays the other named exception | A2-19 |
| the six offshore Year Walk control points | [760,700], [560,890], [740,1432], [1500,340], [470,1030], [560,1100] | retired with the v1.6 walk (§1) | A1-01 |

Reserved and not changed (options with numbers in the Stage A handoff notes, Jonathan decides): the Bight Bridge `span_m` 230 and its ends; the ZIP endpoints and G1 towers; the gondola top station (h 112 behind the 129 ridge); the Prow Tunnel (no hill over it); the dam's due-south face against the June golden hour.

## v1.8 deltas (Stage A integration)

The integrator merged the four Stage A tracks (T1 terrain/water/paint, T2 beds/junctions/Year Walk, T3 structures/underground, T4 runtime/sky/proof) and re-authored the data the merged build needed. `make_manifest.py` → "v1.8"; the generator reproduces `MANIFEST.json` byte for byte. Ids never change.

### 1. The crossings register (R1-10, R1-11, R-A7)

| | v1.7 | v1.8 |
|---|---:|---:|
| Rows | 46 | 313 |
| Authored rows kept (resolution unchanged) | 46 | 37 (30 as authored, 7 re-pointed to their computed hit) |
| Stale rows (no plan intersection) | 12 (#2, 11, 12, 14, 20, 25, 26, 27, 29, 40, 44, 45) + 7 after Stage A | 0 outside the reserved rows; 9 retired to `routePairNotes` (kind "retired register row (v1.8)", each with its reason) |
| Computed intersections without a row | 450 of 511 (v1.6 bake) | 0 of 339 |

- **Re-pointed** (`movedFrom` keeps the v1.7 point): #5 Garden Walk × brook → [898,611]; #6 S4 × brook → [899,591]; #21 Deep run × V01 → [1587,677]; #23 Deep run × Prow walk → [1611,710]; #24 S4 × V01 (dune culvert) → [1009,1388]; #27 S1 × the lake-rim walk → S1 × `damPortage` at [1160.8,940.1] (the portage stair replaced the walk; reserved); #38 Crown walk × Ore Line → [1374,615].
- **Retired** (no plan intersection in the v1.8 build): #2 walk reach × VG (the Reach walk runs beside the river under the gallery), #11 S1 finish × V01, #14 S2 × V01 dismount at [660,1170] (S2 is a lane of the Bight Bridge deck; D-3), #20 S3 × town quay, #25 S3 × walk dune ("none"), #26 S3 × V01 at [1480,1050] (S3 meets V01 only on the river-mouth bridge decks at [1350,1345] and [1322,1372], kept as rows accepted from the bake: a register pad there would stand in the river; a threshold needs a widened, guarded deck), #29 ZIP × town (an area rule, checked as `cable.ZIP.roofs`), #40 S4 × spur studio (S4 starts at [1000,520]), #45 plane × everything (an area rule).
- **Accepted from the bake** (`source: "bake v1.8"`, 276 rows): the design lead accepts each computed resolution in T4's vocabulary — `kind` crossing 208, junction 48, modeTransfer 8, waterConfluence 6, sharedStretch 4, waterBody 2; `resolution` stays over / under / threshold (the loader's rule). A row accepted from the bake never creates a register pad or a dismount threshold (a flush junction carries no marker, R1-88). A row whose physical resolution is not built yet keeps its note ("a named structure is owed", "regrade owed", "a bridge, causeway or re-route is owed") and stays a conflict in the bake until it is built.
- **Reserved rows keep their authored resolution** (`reserved` names the decision): S4 × walk garden #7, S4 × VG #17, VG × walk garden #18, V01 × walk bightPier #34, S1 × damPortage (was #27) — R-A7, physically separated thresholds; ZIP × G1 #30 — R-A2 (register order); V01+S2 × Bight mouth #12 and FERRY × bightBridge #44 — R-A1 (corridor rows without a plan hit). Rows on the summit walk from the gondola (`walk crownFromGondola`, `G1`, `crownLaunch.stair`) carry "RESERVED R-A3: waits on the gondola top station".
- `crossingRule` gains the v1.8 sentence (kinds, `source`, `reserved`).

### 2. Glasshouse footprint

`hosts.glasshouse`: 30 × 18 at [1010,790] → **25 × 18 at [1007.5,790]** (T2: the lake-facing end drawn in to stand ≥ 3 m off Stillwater; v1.7 values kept in `v1_7`).

### 3. High Span sky gate

`sky.gates.highSpan`: 40 × 14 at h 16 → **40 × 12 at h 17** (11–23). Its v1.7 bottom (h 9) lay under the river pools (9.97–10.8) and the bank lip (T1); the Notch is ≥ 54 m wide at h 11 after T1's shelf. The merged bake's gate proof: clear.

### 4. Views

- Every page carries `subjects`, a machine list in the frame vocabulary (the ID-buffer proof reads it; the code table is only a fallback).
- **Page A** drops "the Crown behind" from `frames` and `subjects` (T0 request 8, T1 R1-46: the Shoulder's own in-band rim stands 4–16 eu over the square→summit line; cutting it breaks the Shoulder band; page E holds the Crown). v1.7 wording kept in `v1_7_frames`; the Crown is listed in `deferred` with the reason.
- **Page D portrait** drops the Lamp from `portrait.frames` until the Pass 2b lighthouse (2 px at 390 × 844); the Lamp stays a 16:9 subject.

### 5. District hearts

`districts[*].heart` = the Voronoi seeds the bake and the runtime already used (a code table until v1.7; R1-67): harbour [1470,1170], landing [1060,1410], reach [1280,1260], green [1030,1060], hollow [985,580], scholars [765,400], flats [420,685], bight [745,995], lakeside [1130,820], notch [1205,1070], prow [1600,780], crown [1310,470].

### 6. Confirmed, not changed

- The lite fog pair **180 / 1230** (`sky/fog.ts`, STYLE §1.8): the summit from the square sits at 57.3 % fog on lite (49.4 % full), inside the 40–60 % band. Confirmed as authored by T4.
- The summit journey target stays **375 s** and red (432.9 s on the walkable path graph): it is reserved on the gondola top station (R-A3); the target returns to ~180 s after that decision. Not retuned.

### 7. Open items noted (not fixed in v1.8)

- **S2's descent** (T2 D-3): S2 cannot descend from the Wash (38) to the Bight Bridge deck lane (12) at 18 %; it needs ~150 m more or a ramp. Jonathan decides with R-A1.
- **V01's offshore north-east corner** (T0 item 14): V01 samples at [1454–1534, 324–406] lie up to 24 m outside the island outline (manifest point [1500,340]); the Year Walk shares V01 there. Either the coast grows or V01's corner moves inland (~[1480,360]); needs a terrain + route revision.

## v1.9 deltas (Stage A, W3-A: beds, structures and data)

Track W3-A re-authored the Year Walk, Horizon Drive's north-east corner and Crown Road's start so the seven door walks, the nine journeys and the Year Walk's grade rule pass on the built land. `make_manifest.py` → "v1.9"; the generator reproduces `MANIFEST.json` byte for byte. Ids never change. Every re-authored Year Walk run is recorded in `journey.yearWalk.v1_9_edits` (was / now / why); moved values keep their v1.8 value beside them (`v1_8_pts`, `v1_8_h`, `v1_8_from`, `v1_8_to`).

### 1. The Year Walk

| Place | v1.8 | v1.9 | Why (number) |
|---|---|---|---|
| Scholars, the March in-leg | a second line 3–4 eu over the Garden Walk's shoulder at [802,468] | the north lane of the March out-leg (3.5 m, one height); crosses the Garden Walk flush beside the out-leg | the Glasshouse and Cottage door walks stopped at [802,468] (terrain 40.4°); browser walks 5/7 → 7/7 |
| The Hollow: May / September pads | 31.5 / 33 | **37 / 35** (`pins[*].v1_8_h`) | the Green Road footway they leave is at 38.8, 37–45 m away: fixed heights 22.2 and 9.3 eu of route short (P08 72.7 % / 40.6 %) |
| The Hollow neck (x 893–913, z 600–660) | both Hollow lanes 2–8 eu over S4 and the Garden Walk | both lanes are **S4's east footway** (new `shares` rows, offsets 6 / 8); S4 meets the Cottage front walk at grade (36) | separation S4 69 samples; a generated S4 × Year Walk deck stood across the Garden Walk |
| The April lane above the Hollow | [925,585] | [935,585] | its 18 eu band-face descent to the S4 footway needs ≥ 150 m at 12 % (148 → 164 m) |
| January pad | 117 | **112.8** | 7 eu over the turning circle with 37 m of walk between (P08 36 % at [1369,689]) |
| South portal forecourt | the two January legs crossed the Ore Line's approach cut and ran 1–3 eu over the ORE station's link walk | both legs keep west of the rail as lanes 3.5 m apart; `levels`: both at 110 within 9 m of [1350,687] | P16 Year Walk 2.65 over the Ore Line (rail clearance 3.2) |
| The Lakeside switchback (T0 #16) | 14 legs of 20–30 m, 5 m apart, 12–16 %; left across S1 at [1255,862] where S1 is 4 eu under the terrace | **seven 28 m legs on a 7.4 m pitch** (x 1325–1280.6, z 852–880) with turning landings; `structures.lakesideSwitchback` (kind switchbackRamp): each leg's downhill shoulder is grounded onto the leg below as the retaining wall between them; leaves across S1 at grade at **[1267,842]** (S1 at the terrace height, 55) to the rim trail at [1251,836] (the February share starts there; `s1Crossing`) | P08 15–16 % at [1250–1254, 842–862]; fixed heights 2.9 eu short |
| North-east corner (November / January verges) | offsets of the v1.8 chord over the sea | re-laid as offsets of the new Drive alignment (same sides and offsets); January turns onto Crown Road's east verge at the junction's inside corner without crossing V02 | follows item 2 |

New fields: `journey.yearWalk.levels` (extra height pins on unshared stretches; `r` pins every sample within r), `journey.yearWalk.s1Crossing`.

### 2. Horizon Drive's north-east corner and Crown Road (T0 #14)

`roads.V01`: the control [1500,340] made the Drive a 330 m chord over the sea (x 1370 → [1545,470], 65–70 eu over water; P09 worst drop 72.7, P12 worst void 74.3, P32 a crossing pad 70 over the sea). It is replaced by seven controls 10 m inside the cliff top ([1353.8,295.8] … [1546,472]): a cliff drive cut into the headland like the Prow. `roads.V02` starts from the Drive at **[1433.3,335.6]** (was [1500,340]) and climbs one even grade (11.2 %) after a 25 m level landing at 70 (builder), so its Year Walk footway stays ≤ 12 %.

### 3. February and September above the Hollow

February rode the Crown's flank at 65–67 over September at 40–44, 5 m away (P12: 24 eu unsupported runs at [1046–1056,519–529]). February now comes down onto the 45 shelf ([1052,662] → [1060,600] → [1062,540] → [1050,487]); September's pad moves 8 m west to **[1032,652]** at **40** (`stations[sep].v1_8_xy`, `moveWhy_v1_9`) and September returns from it across Green Road and walks Green Road's **west footway** (new `shares` row, offset 6.5) north to the pass ([927,388]). Green Road meets February at grade at [945,474.5] (45.5, builder pin).

### 4. Named footbridges (`structures`)

| Id | Where | Carries | Over | Why |
|---|---|---|---|---|
| `gardenWalkBridge` | [965.7,761.1], 40 m, opening 26 | the Garden Walk on its own grade (51–55) | Green Road (37) and its May/September footway | the walk hung 16.7 eu over Green Road (the generated span found no footing within 20 m); the reserved at-grade row VG × walk garden (R-A7) is untouched |
| `crownWalkBridge` | [1410.1,605.8], 36 m, opening 24 | the Crown walk (119–122) | Crown Road's cutting (99) and its January footway | the walk hung 21 eu over Crown Road (span refused) |

A named footbridge (`route`, `span_m`, `opening_m`, `width_m`) is built by the structures builder on the route's own graded points; its bents stand outside every lower corridor (moved outward up to 6 eu, else refused and reported) and a through truss spans the opening between the innermost bents.

### 5. The Prow walk

`walks.prow.pts` (v1.8 in `v1_8_pts`): the trail ran along the lip of V01's Prow cutting and over it twice (22 unsupported runs up to 38.5 eu; six foot crossings 12–34 eu over the Year Walk). It now keeps to the Prow top east of the cutting — from the south lookout over the harbour past the November station, between the Year Walk's two Prow lanes, onto the west lane at [1630,790], short of the sea stair's head.

### 6. Views (W3-C requests A1, A4, A6, A7)

Page A portrait `fov_deg` 50 → **45** (the viewRule minimum); page E `xy` [1305,482] → **[1300.5,485.5]** (the run-off corner of the lookout deck; the deck centre filled 44 % of the frame); page K `xy` [1000,758] → **[1006,762]** (on the rim walk by the Glasshouse steps; the eye stood 1.4 eu under the walk); page L `portrait.xy` → **[1460,1300]**. v1.8 values kept beside them.

### 7. Builder rules that came with v1.9 (no data)

- A Year Walk height pin carries its sample index (two lanes of one walk no longer take each other's pins).
- Every Year Walk centreline crossing of a foot route within 3 eu is held flush on both neighbouring samples.
- A spur holds its host road's height across that road's Year Walk footway lanes.
- Junction aprons: a foot route inside a road's corridor near an at-grade junction takes the road's height (the Boathouse walk).
- `groundBeds`: a lower route is judged at its own height where it passes under a prism.
- The zip landing ramp is a timber trestle (no earth dune across the beach; W3-C A3).

### 8. Reserves (P31) — D-2 for Jonathan (reversible)

- **The Bight trail becomes the Bight Shore spur's landward footway** (`walks.bight.footwayOf`: host VBS, 4.2 m, the side of [1100,1100]; the builder lays it at the spur's heights with no wall between). It ran through all four Bight plots (27–28 samples inside each); its v1.8 shore line is kept in `v1_8_pts`. Undo = delete `footwayOf`.
- **The hangar bay** (`reserves.small.hangarBay`, plot.flats.1) moves [455,600] → **[458.2,600]** and becomes an **11 × 18 m** bay facing the strip (the 26 m between the strip's and S2's 6 m margins cannot hold an 18 m face); its door is on the strip side and its access walk is its service (`plot.flats.1.service`, was `hangar.access`).
- **The Bight Shore jetty** moves [735,955] → **[728,946]** (it stood in plot bight.2's margin; v1.8 in `structures.jettiesV1_8`).
- **Terraces plot 3**: the Prow cliff drive's control [1540,1000] → **[1543.2,1001.4]** (3.5 m off the plots); the December and January verges are re-laid on it.
- Open: **plot bight.1** — the June lane (32 samples inside) and S4 (13 in the margin) run in the 10 m between the plot's north-east margin and the Bight Shore spur; the corridor needs either the plot moved ~12 m south-west or S4 and the June lane re-routed (decision for Jonathan).

### 9. Structures and heights (P16/P17)

- `reachFootbridge` deck 6 → **9.5** (4 m canoe clearance over the lower river; the Reach walk's pin follows).
- Every dock stands 0.6 over the water it reaches, read from the manifest's water (the Boathouse jetty's deck at 1 stood 0.75 under the Reach east channel's 1.75; now 2.35), and a threshold on a jetty stands on its deck.
- The Bight pier walk stops at the Flats' cliff top (`walks.bightPier.pts`, v1.8 in `v1_8_pts`) and **`structures.bightPierStair`** (kind stair, [498,896] → [557.5,896]) takes it down to a new **`jetties.bightPier`** at the ferry stop [560,896] (it ran on at 36 eu over the Bight). The wash footbridge span is retired (the stair crosses the dry wash mouth).
- The dune walk starts at the zip landing's foot [1148,1463] (it passed 2.2 eu under the landing stair) and runs 10–18 m south of the landing ramp's trestle ([1125,1481], [1000,1480]; it ran under the trestle's south leg for 60 m, where no bent could stand).
- **`seaStairWestLaneBridge` / `seaStairEastLaneBridge`**: the Year Walk's two Prow lanes cross the sea stair's cutting on short named footbridges (4.9 and 14.2 eu over the stair).
- **The dam gallery** (T3's layout): an open stairwell in the east abutment south of the wall — three flights in x-lanes 1166.5 / 1162.4 / 1170.6 between z 910.75 and 922.75, landings at 38 and 45, the exit at 52 to the crest at [1162,52,903]; nothing in Stillwater; walls to 46.05 and no roof (page F's eye is 2.3 m away). The homestead's reserve basin moves 5 m east ([1177,912]).
- **The Deep (W3-C A5)**: the ceiling is closed over the Throat corridor (the skylight is its only hole); the Throat's lining ends at the Deep's north wall (z 390) and the collar carries that wall from the ceiling (68) to 76.7, so the Throat opens into the Deep below its ceiling only. From the jetty the mouth of daylight reads through that opening (its lower band); page G's skylight shaft is no longer hidden by the Throat's lining inside the room; the Throat is dark again (P25).
- The junction resolver: a lower route under a tunnel or cavern roof is separated by it (no "two foot routes" report); a carried deck (no terrain cut: a trestle, stair or jetty) with the lower route's clearance under it is its own structure.
- The Flats trail and the pier walk meet at one height (30.5) at [350,880].

### 10. The crossings register (v1.9)

Every computed intersection of the v1.9 build has a row (**324 / 324**). 19 rows are accepted from this bake (`source: "bake v1.9"`, same vocabulary and notes as v1.8); 45 v1.8 bake rows with no plan hit in the v1.9 build (the geometry they described moved: the Prow walk, the dam gallery, the Bight pier, the January legs, the NE corner…) or duplicating a matched row are retired to `routePairNotes` (kind "retired register row (v1.9)"); three authored rows whose routes moved are retired with their reason (DEEP_RUN × walk prow, S2 × walk bightPier, walk bightPier × water wash); nine v1.8 bake rows now met flush become junctions (`v1_8_resolution` kept). Reserved rows are untouched.

### 11. S1 on its High Span shelf (W3-C A2)

`skate.S1.pts` gains [1204,1080] and [1204,1133] (v1.8 in `v1_8_pts`): S1 rides its skate shelf (x 1204, z 1078–1135, h 12, builder pins) instead of running at grade 1–6 m east of it and 1 m above it. Page C: the shelf 0/0 → 2/4 px (portrait passes; 16:9 needs W3-C's sight window). crown→quay 127.7 → 128.9 s (110–150).


### 12. Integrator 2 (merge of W3-A and W3-C, seams)

Data (`make_manifest.py` → the "integrator 2" block after v1.9; still version 1.9; byte-exact):

- **The Inlet Footbridge.** The upper river's last reach is the lake's inlet pool, level with Stillwater (50) from a surveyed station at [1163,716] (land/water; the 50 m fall from the Cup is shared by seven 7.1 m weirs above it, was five 5 m weirs and a pool at 58–60 under the bridge). The rim trail's inlet pin 52 → **55** and the footbridge deck 52 → **55** (`structures.inletFootbridge.deck_h`): clear **4.4** over the pool (a river's 4). Crossings `walk lakerim × river upper` (both) now built; P16 inlet rows 3 → 0.
- **Register row `yearWalk × river upper`** [1161.9,725.2]: under → **over** (`v1_8_resolution` kept): the Year Walk's February stretch crosses the inlet on its deck beside the footbridge.

Build (no manifest data):

- **Page C** (the skate shelf): a Sketchbook sight window from the overlook to the shelf line (terrain only, never a bed) now that S1 rides the shelf: 16:9 **2 → 40 px**.
- **Jetties are boarding points**: a jetty or dock deck over water is a mode transfer (feet → boat) proved on its own deck, not a land route meeting water (`world/crossings.ts`; clears the Boathouse dock threshold).
- **Two striped fins smoothed**: the Shoulder's outward blend south of Stillwater never stands above the terrace's top 55 (`STILLWATER_SILL`: [1235–1260, 905–915] was 60–67 over S1's cut); the Notch's west rim south of the High Span, where S1 runs inside the west wall, stands at the Green's ground ≤ 16 (`NOTCH_WEST_BANK`: [1205–1220, 1150–1175] was 24–30). Knife-ridge points (> 8 over both sides within 20 m) 107 → 79.

## v2.0 (Wave 5, Jonathan's rulings 2026-09-27)

MANIFEST v1.9 → **v2.0**, 27 September 2026, Claude (design lead, track W5-DATA). Input: Jonathan's answers to the Stage A `DECISIONS.md` (group A item by item; groups B and C "recommended on all"), the proposals under `proposals/` and ray/bed probes on the committed candidate-3 bake (`f1a1ec1`). `make_manifest.py` → "v2.0"; the generator reproduces `MANIFEST.json` byte for byte. Ids never change. Every moved value keeps its old value beside it (`v1_9`, `v1_9_*`); every register row changed by a ruling carries `decided` and its old `v1_9_resolution` / `v1_9_at`; rows the rulings made impossible are retired to `routePairNotes` (kind "retired register row (v2.0)", 19 rows, each with its reason). Nothing is re-baked here: the land, structures and runtime tracks build the data next (their requests are in the Wave 5 handoff notes). The Hollow neck (#7) is the only reserved row left (D-C10).

| Key | v1.9 | v2.0 | Ruling |
|---|---|---|---|
| `version` / `date` | 1.9 / 2026-09-26 | **2.0** / 2026-09-27 | — |
| `structures.bightBridge.span_m` | 230 | **245** (deck on the V01 axis [460,1030] → [660,1170], 244.1 m) | D-A1 |
| `structures.bightBridge.opening` (new) | — | s **98–134** (centre 116, [555.0,1096.5]), width **36**, kind **steel-arch**, clear **11.4** high × 34 wide; `needAlongAxis_m` 32.0 at 46° / 22.9 at 58° for an 8 m hull | D-A1 |
| `structures.bightBridge.section` (new) | deck 17 m, "V01 + S2 separated lane" | **21.6 m** (−9.0 … +12.6 off the V01 axis, + toward the Bight): S2 sea lane −7.0, V01 ±4 (+1), Year Walk footways +5.2 / +7.4, S2 lagoon lane +10.6 (S2 lanes 3.5 m); rails on both edges, kerb rails between lanes | D-A1 |
| `structures.bightBridge.bents` (new) | 21 paired bents (built) | 8 west (10.9 m bays, s 0–98), 9 east (11.0 m bays, s 134–244), two arch piers | D-A1 |
| `structures.bightBridge.lookout` (new) | — | a 24 × 7.2 deck bay at the arch crown, lagoon side, [562.1,1086.4], deck 12, off the Year Walk footway; a structure, not a pad | D-A1 |
| `structures.bightBridge.s2Flyover` (new) | S2 crossed V01 on the deck (0 of 5 headroom) | S2 over V01 once, [548.0,1078.7] → [564.1,1111.4] at **17.6** (5.0 clear over the road), hung from the arch | D-A1 |
| `views.B.frames` | "the Bight Bridge, the Flats, the whole hook" | "the Bight Bridge with its steel arch and the lookout at its crown, the Flats, the whole hook" (machine subject unchanged: both are `bightBridge.*`) | D-A1 |
| `water_routes.FERRY.beam_m` (new) | — | **8** | D-A1 |
| `skate.S2.pts` | … [480,985], [470,1030], [560,1100], [650,1185], [750,1265] … | … [480,985], lagoon lane [466.1,1021.3] → [490.7,1038.5] → [548.0,1078.7], flyover [556.1,1095.0] → [564.1,1111.4], sea lane [621.5,1151.6] → [655.9,1175.7], banked descent [672,1192] → [690,1210] → [712,1230], [750,1265] … (`v1_9_pts`); length 1 254 → 1 259 | D-A1 |
| `skate.S2.levels`, `westRamp`, `deckLanes`, `eastDescent` (new) | — | ramp from the Wash [485,800] h 23.7 down to the deck at 12, **5.0 %** (trestle over the Wash mouth, ≤ 4 eu cut through the spit knoll); lanes on the deck; banked right-hand descent 12 → 6.5 at **7.1 %**, bank 12–20°, r 45 | D-A1 |
| `skate.S2.spots` (new) | segment spot "full-length rail" | `S2.archCrown` (rail, 17.6), `S2.westAbutmentBank` (bank lip), `S2.eastAbutmentBank` (bank lip), `S2.deckRail` (rail); each `bed`, `on`, `xy`, `h`, `groundLine`, `requiredJump: false` (Pass 02 M1 "Spots") | D-A1 |
| crossings `V01+S2 × Bight mouth`, `FERRY × bightBridge` | reserved R-A1 | decided D-A1 | D-A1 |
| crossing `S2 × V01` (point row, new) | — | over at [557.7,1098.4], structure `bightBridge.s2Flyover` | D-A1 |
| crossing `S2 × yearWalk` [553.9,1095] | threshold (on the deck) | **over** at [551.9,1086.7] on the flyover | D-A1 |
| crossing `S2 × yearWalk` [468.2,1026.4] | threshold, regrade owed | retired (S2 runs outboard of the footways) | D-A1 |
| crossing `ZIP × G1` | over, "10.7 m above", reserved R-A2, [1442,921] | **under**, measured 30.45 (ZIP 60.6, G1 91.1 at [1441.5,920.8]); re-pointed to [1437.5,927.4] for the new G1 (29.0 predicted) | D-A2 |
| `cable.ZIP.note` | "crosses above the gondola cable … 10.7 m" | "crosses under the gondola cable … 30.45 m beneath it" | D-A2 |
| `cable.G1.to` / `toH` | [1360,560] / 112 | **[1335,535] / 150** (ground 148.5) | D-A3 |
| `cable.G1.towers` | [1450,958], [1420,825], [1390,693] | [1445.8,959.0], [1411.3,827.1], **[1380.9,710.7]** (135.4 / 271.7 / 392 m from the base; tower 3 moved from 407 m off the Year Walk lane); no heights authored, `towerSolve` forbids the 300 clamp; `towerMin_h_reference` 83 / 110 / 151 | D-A3 |
| `cable.G1.length_m` | 543 | **574** | D-A3 |
| `structures.gondolaStations.crownStation`, threshold `gondolaTop` | [1360,560] | **[1335,535]** (deck 150) | D-A3 |
| `walks.crownFromGondola.pts` | [1360,560], [1330,520], [1310,500] | **[1335,535], [1322,517], [1310,500]** (43 m, 9 %), with `levels` | D-A3 |
| `journeys["square→summit by gondola + walk"].legs` | 158 walk + 543 gondola + 78 walk | 158 + **574** + **70** (station → L02); estimate 176 → 177 s | D-A3 |
| `journeys.targets_s` summit | 375 (reserved) | **205** (`targets_v1_9` keeps 375) | D-A3 |
| crossings on G1 (11 rows) | v1.9 points | re-pointed to the new chord's plan intersections with the candidate-3 beds (e.g. G1 × V01 [1469,1043] → [1468,1044], G1 × Crown Road [1385,655] → [1373.4,682], G1 × ORE [1375,625] → [1363.9,645.4]) | D-A3 |
| crossings on the old station walk (12 rows) | "RESERVED R-A3" | retired; the other R-A3 notes read "D-A3 decided" | D-A3 |
| `structures.prowTunnel` | [1600,780], kind tunnel, 90 m | **[1592,890]** (V01's centreline point nearest [1590,890]), kind **gallery** (new: hill wall east, roof on a west colonnade, lined and ceiled, headroom ≥ 5, cover reported); V01 unchanged, 25.6 → 30.9 over the 90 m | D-A4 |
| `lights` (new), `structures.dam.faceLight`, `views.A.lightRule` | — | light card `dam.glassFace` (golden hour → dawn, no dynamic light); page A golden-hour proof "lit or emissive" | D-A5 |
| LIGHT §2 dam line | "lit through the day and seen lit from the square" | "… and, at golden hour and dusk, glows from inside (a light card, no dynamic light), seen from the square" | D-A5 |
| crossing `VG × walk garden` | threshold at [974,748], reserved R-A7 | **over** at [969.5,764.2], structure `gardenWalkBridge` | D-A7 |
| crossings `V01 × walk bightPier` ([407,894] → [402.3,894.5]), `S4 × VG`, `S4 × walk garden` [905.9,640.6], `S1 × damPortage` | reserved R-A7 / separated | decided flush thresholds; the regrade is owed by the beds track | D-A7 |
| crossing `S4 × walk garden` [893,600] (#7) | reserved R-A7 | reserved **D-C10** (the Hollow neck stays reserved) | D-A7 / D-C10 |
| `journey.stations[nov]`, its pin | [1622,912], pad 36 × 14 E–W, h 56.5 | **[1626,904]**, `pad_rot_deg` **90**, h **56** (ground 54.0–56.7 under the pad; was 26.3–56.7); Year Walk loop tip [1620,910] → [1626,904]; `journey.station.padRotRule` (new) | D-A8 |
| `views.K` | [1006,762] → [1120,812] @52; portrait → [1060,800] @55 | **[994,770] → [1120,815] @52**, portrait → [1120,815] @52 (probe: Glasshouse 3 089 / Stillwater 790 px at 1440 × 900, 955 / 168 at 390 × 844; was 0 / 1 989 and 254 / 381) | D-B2 |
| `views.H.bestHour` / label / frames | sunset / "The Flats at sunset" / "… the west sea under the sunset" | **golden hour** / "The Flats at golden hour" / "… the west sea under the low sun" | D-B3 |
| `underground.doors.throat.collarAperture_m` (new) | the 18 m of `mouth_m` read as the passage's | **10.8** (built 10.79) where the passage enters the Deep under the collar; `mouth_m` [26,18] is the mouth's | D-C3 |
| `views.I.subjectDefs` (new) | "the Reach water" = the channels only | the channels **or** the lower river inside `landforms.reach` | D-C5 |
| `places[L01].xy` | [1172,912] | **[1173,912]** | D-C6 |
| `walks.crown.pts`, `joinsYearWalk` (new) | [1370,690], [1330,600], [1310,500] (the builder hard-codes another route) | the built route from **[1417.7,677.4]**, where it leaves the Year Walk's January lane; 4 stacked-lane rows retired, the junction re-pointed [1379.9,687.4] → [1417.7,677.4] | D-C7 |
| `reserves.bightShore.plots[0]` (plot bight.1) | [836,907] | **[814,919]** (25 m WSW; ≈ 12 m SW leaves 12 + 55 Year Walk samples, 12 m W reaches the lagoon shore) | D-C8 |
| `structures.bightSpurTrestle` (new) | VBS 6–9 eu over the ground beside S4, no structure | trestle [918.1,877] → [891.6,906], 44 m, bents away from S4 (`length_m`, not auto-built) | D-C9 |
| crossings `marketRamp × …` (2 rows), `structures.marketStair` (new), `profiles.stair.exceptions` (new), S3 "Market stair" spot | ramp twin as the step-free way | ramp retired; `stepFree` = the **295 eu** detour (walk square → town.bankLink → town.northLink → V01 → spur upperStreet); spot ground line "park at stairTop and carry" | D-C11 |
| `structures.coveStair` (new), crossing `walk coveWalk × ferry.scholarsCove` | over by 32.8, "structure owed" | kind **cliff-stair** [631.2,241.9] h 34.1 → the pier [630,235] h 1.8; the row becomes a mode transfer at the pier | D-C14 |
| `structures.s1Flyover` (new) | S1's upper pass 13.4 unsupported at [1358,750] | skate flyover [1363.5,752.2] → [1326.6,735.7], 44 m, 11.5 over the lower pass at [1353.6,747.9] (`length_m`, not auto-built) | D-C15 |
| crossings / `routePairNotes` | 284 / 59 | 266 / 78 | — |

Accepted as made (no data change): D-A6 (all eleven v1.7 poses; K re-posed by D-B2), D-B1 (the Crown off page A), D-B4 (2.4 m/s until Jonathan walks it), D-B5 … D-B13, D-C1 (the Notch is a shallow gorge; page A wins), D-C2 (a railed parapet: a structures request), D-C4 (P29 measured with the plaza slab checked), D-C10 (reserved), D-C12, D-C13.

## v2.1 (Wave 5 integration, design lead, 2026-09-27)

MANIFEST v2.0 → **v2.1**, 27 September 2026, Claude (design lead, integrator 3), after merging W5-A (beds/town), W5-S (structures/underground) and W5-T (terrain/views/runtime/chunking) and measuring the merged bake. `make_manifest.py` regenerates `MANIFEST.json` byte-exact. Every v2.0 value is kept beside the new one (`v2_0_*`). All are reversible design-lead calls inside Jonathan's rulings; the first three are listed for him in `DECISIONS.md` → "Design-lead calls in the Wave 5 integration".

| Key | v2.0 | v2.1 | Why (number) |
|---|---|---|---|
| `version` | 2.0 | **2.1** | — |
| `structures.bightBridge.opening` | s 98–134, 36 m, 34 clear | **s 103–143, 40 m, 38 clear** (centre s 123, [560.8,1100.5]); `v2_0` kept; `hullClearance_eu` recorded | An 8 m ferry hull cleared the east arch pier by **−3.99** eu at 36 m (the ferry crosses the deck edges at s ≈ 113–131, not centred on s 116); 40 m at s 103–143 gives **+1.37** (best 36 m, s 105–141: +0.15). D-A1's 36 m, widened; reversible |
| `structures.bightBridge.bents` | west s 0–98 (10.9 m bays), east 134–244 (11.0), arch piers 98 / 134 | west s 0–103 (**11.4**), east 143–244 (**10.1**), arch piers **103 / 143** | the piers and bents follow the opening; every bay under the 12 eu timber limit |
| crossings `FERRY × bightBridge`, `V01+S2 × Bight mouth` | notes "s 98-134, 36 m" | "s 103-143, 38 m clear, +1.37 past each pier" | — |
| `structures.coveStair.to_h` / `rise_m` | 1.8 / 32.3 | **1.0 / 33.1** | the stair lands on the Scholars Cove dock deck (water + 0.6); 1.8 left a 0.8 lip (W5-S) |
| crossing `ZIP × G1` `measured` / note, `cable.ZIP.note` | 30.45 m at [1441.5,920.8] (candidate 3) | **15.0 m** at [1437.5,927.5] (`v2_0_measured` kept) | W5-A's tower solve (tops 65.1 / 109.9 / 152.7: the lowest keeping 8 eu at 1 % sag); still ≥ 8 |
| `structures.marketStair.stepFree` | the 295 eu detour (square → bankLink → northLink → V01 → upper street) | **`walk square`**, 94 eu at ≤ 8 % (mean 6.4 %), square [1478,12,1150] → upper street [1480,18,1062]; the detour kept as `v2_0_stepFree`, superseded | W5-A narrowed the upper-street terrace (x 1463–1480, `TOWN_TIERS`) so the square walk climbs beside it; reversible by restoring `TOWN_TIERS` |
| `profiles.stair.exceptions[marketStair].stepFree` | "295 eu" | "walk square, 94 eu at ≤ 8 %" | — |
| crossing `jetty.bightPier × FERRY` [560,890] (new) | — (P15's one unlisted computed crossing, R2-116) | **threshold, modeTransfer** (boarding at the pier head; the ferry's second pass) | P15 unlisted 1 → 0 |
| `views.D.frames` / `subjects` / `deferred` | "surf, the Lamp, the zipline landing" | **"surf, the zipline landing"**; the Lamp deferred as a Pass 2b subject | the Lamp is 670 eu from the eye and 9 px of 13 at 1440 × 900 by size alone; the Pass 2b lighthouse's 25 m gallery makes it legible |
| `structures.bightSpurTrestle.to` / `length_m` / deck | [891.6,906] / 44 / 27.4 → 25.2 | **[886.7,916.0] / 56** / 27.4 → 24.4 | VBS hung 7.0 → 3.1 eu over the ground for 12 m south of the old end (W5-A/W5-T) |
| `hosts[bank].footprint_m` / `xy` | 26 × 18 / [1440,1125] | **20 × 18 / [1443,1125]** (east wall and door side kept; the door moves 3 m east with the centre) | page A 1440 × 900: the bank's south wall hid 36 of the Shoulder's rays (8 px of 13) → **33 px**, PASS |
| `views.H.portrait.xy` (new) | the landscape eye [440,760] | **[428,760]** (on the strip, 4 m in from its railed west edge, 1.6 over it) | page H 390 × 844: west sea 1 → **14** px (min 8); the strip 3,115 px |
| `walks.lakerim.surface_m` / `shoulder_m` (new) | the trail profile (2.5, no shoulder) | **5.2 / 1.2** (the Year Walk's own section) | the Year Walk's February share rides the rim trail at offset 0: ≈ 118 m of its edge stood outboard of the trail's rails (P09) |

Tried and left as they were (poses): page C portrait (target and eye nudges give the skate shelf ≤ 5 px of 8 — blocked by `highSpan.supports` and `S1.retaining.notch`), page L portrait (the Boathouse ≤ 6 px of 8 anywhere on the quay: the harbour's west bank hides it), page D portrait (surf ≤ 4 px of 8 for targets up to [800,1540]), page A portrait (the dam face 4 px of 8 after the stairwell's east wall opened: the rays now meet the flights, the west wall and the portage stair).


## v2.2 (reconciled with main #549–#552)

MANIFEST v2.1 → **v2.2**, 27 September 2026, Claude (integrator, reconciliation of Stage A candidate 5 with `main` @ `ca8ed7e`). Main's two MANIFEST "v1.7" blocks (Codex, 26 September: FLIGHT's sky fields for the glider and parachute, #552; RIDE's paces and grip for the board and bicycle, #551) were written on the v1.6 land. `make_manifest.py` applies them **after** v2.1 with their numbers verbatim (their asserts — a grip row for every surface, a known pace and surface for every skate segment — run on the v2.1 land and pass, S2's Bight ribbon included). #549 (Mountain v2 funicular/gondola) and #550 (Tool Atlas) carry no MANIFEST data; there is no Horizon gondola ride on `main` to re-anchor.

| Key | v2.1 | v2.2 | Why |
|---|---|---|---|
| `version` / `date` | 2.1 | **2.2** / 2026-09-27 | — |
| `sky.gliderPolar`, `gliderPolarRule`, `parachute`, `corridors.throat`, `landingModes`, `sky.landings.{green,reachMeadow,sands}.modes`, `carriedThresholds` (`bailOut`), `carriedThresholdRule` | — | main's values verbatim | FLIGHT.md §9.5 (D34–D38) |
| `sky.dropZone.xy` | — (main: [1040,1065]) | **[1028,1112]** = `sky.landings.green.xy`; `v1_7_xy` kept | FLIGHT's own rule ("inside the Green's protected centre at `sky.landings.green`"); Stage A v1.7 moved the green landing clear of Green Road and the Year Walk |
| `journeys.targets_s["crown→lamp by glider"]` | [85,120] (Stage A v1.7) | **[85,120]** kept; D34's [70,110] recorded in `targets_s.decisions` (`v2_2_d34`) | measured 96.0 s on candidate 5 from the v2.1 lookout launch [1305,482] h 170; both ranges contain D34's ≈ 98 s trim flight |
| `paces`, `surfaces[*].grip`, `surfaces.stone`, `skate.park.note` | — | main's values verbatim | RIDE.md §8.3 (D40, D42) |

The Throat corridor reads gate 12 as v1.7–v2.1 left it (h **119**, aperture **24 × 16**, the mouth re-seated on the built rock), not main's v1.6 h 110 / 26 × 18; the Crown launch is the lookout deck [1305,482] h 170 (Stage A v1.7). Ids unchanged; no `horizon-geo` bump; the land is re-baked from v2.2.

## v2.3 (Stage A Wave 7, W7-A)

MANIFEST v2.2 → **v2.3**, 27 September 2026, Claude (track W7-A: beds, town, reserves, path graph; the design lead's call D-D8 and the reconciliation's regressions 2 and 9). The generator reproduces `MANIFEST.json` byte for byte. Ids never change; every moved value keeps its v2.2 value beside it. No geography revision change.

| Key | v2.2 | v2.3 | Why |
|---|---|---|---|
| `version` | 2.2 | **2.3** | — |
| `walks.lakerim.surface_m` / `shoulder_m` | 5.2 / 1.2 | removed (profile trail 2.5; kept as `v2_1_surface_m` / `v2_1_shoulder_m`) | **D-D8, design lead, reversible**: the Year Walk's February share (offset 0) is carried by the Year Walk's own 5.2 m + 1.2 m section (beds: at offset 0 the wider bed carries the narrower), so the rails the widening bought stay and the widening stops where the share stops ([1251,836]); the trail's dam end no longer overhangs the dam gallery's stairwell (the island's worst void, 10.41 eu at [1161.5,908.8]) or stands its 1.2 m shoulders in the dam face's 09:00 sun. W7-T measures P25 (June 09:00 must be back to ≥ 50 % lit) |
| `walks.lakerim.pts` last point | [1140,905] | **[1166,905]** (`v2_2_pts`) | the trail's last leg ran along the dam crest 2 m south of `walk damCrest`, its south edge over the dam's face (19 eu unguarded once narrowed); it now ends at the crest's east end, where the gallery exit meets the crest walk. The register row `walk lakerim × river lower` [1140,905] is retired into `walks.lakerim.v2_2_crossing`; `walk damCrest × river lower` [1140.2,903] is the rim's crossing |
| `structures.marketStair.head` / `foot` / `xy` | [1480,18,1150] / [1480,12,1171] / [1480,1160] | **[1472,18,1115] / [1472,12,1134] / [1472,1124.5]** (`v2_2_*`) | the reconciliation's regression 2: the head stood 6 m over the square, 35 m past the upper street's south edge (z 1115 since W5-A narrowed the terrace). The stair now leaves the street's edge at 18: three 2 m flights with level landings (`marketStair.landingWalk.*`), a level foot landing onto the square walk (`marketStair.foot`), and a level walk across the street from the gondola base walk (`town.upperStreetWalk`). D-C11 (stairs only) stands; the square walk stays the step-free way (D-D3) |
| `speeds_ms.bicycle` | 8 | **6.0** (`v2_2_bicycle`) | the reconciliation's regression 9: the bicycle kernel's cap is 6.0 (RIDE §8.1) |
| `journeys.targets_s["square→library by bicycle"]` | 185 | **243** (`decisions.v2_2_square→library by bicycle` 185) | **design lead, reversible**: at 6 m/s the ride measures 220.6 s (1,324 eu) on the Stage A graph, over 185; the target is the measured value + 10 % |
| `reserves.bightShore.plots[0]` | [814,919] | **[813,918.8]** (`v2_2_plots`) | D-D2 (keep 25 m, recommended) / R3-32: the 6 m margin stood 5.79 from the Year Walk's shoulder at one corner; 1.0 m straight away from it |
| `reserves.terraces.plots[0]` | [1552,832] | **[1551.1,832.5]** (`v2_2_plots`) | R3-32: 5.83 → 1.0 m away from the Prow walk's corner |
| `crossings` S4 × yearWalk [968.6,540.5] | under (0.68 of 2.4) | **threshold, at grade** (`v2_2_resolution`) | S4 holds Green Road's level across its Year Walk footway lanes at the studio terrace (the flush landing of D-A7 #17): 0.05 apart |
| `crossings` yearWalk × plot.bight.1.service | under at [871.2,914.9] (1.97 of 2.4 at the moved plot) | **threshold, at grade, at [856.7,935.0]** (`v2_2_resolution`, `v2_2_at`) | the June lane rises to the moved plot's service drive (the walk meets every plot service drive at grade) |
| `views.J` | eye [1840,1000] at 60 over the sea, target [1780,700] h 14; subjects arch, Stacks, Prow | **eye [1665,680] on the Prow (51.5), target [1790,681] h 25; subjects the arch, the Prow; `ground` [1607.3,690.9] h 48.5** (`v2_2`) | **D-D6, design lead, reversible** (W7-T's measured pose): J looks due east through the Needle's Eye at dawn (the sunrise gate keeps its alignment): arch 2,027 px, opening 22 % of its face at 1440 × 900; the Stacks are not on this line and are deferred; Walk from J starts on the Year Walk at the Prow (R3-130) |

Code with the data (W7-A files): the Year Walk meets plot service drives at grade (`reserves/build.ts reserveServiceLines`); S4 × VBS is one tread (both 21.2 at [872.5,944]: was a 1.72 step, and VBS hung 1.49 over S4); the homestead lane leaves the yard 13 m clear of the Year Walk's two lanes (it started 3.5 eu over them); the path graph joins a bed that ends on another bed's surface (a tee: stair feet, jetty roots, footbridge landings) and keeps a walled edge's open runs instead of dropping it whole (R3-119: 13 foot beds were not in the graph at all, now 0).

## v2.4 (Stage A Wave 7, integrator 4)

MANIFEST v2.3 → **v2.4**, 27 September 2026, Claude (design lead, integrator 4: merge of W7-A, W7-S, W7-T and their cross-track requests), measured on the merged scratch bakes with the repo's own view ray caster, walk-out probe (`runtime/walkOut.ts`) and flight model (`movers/glider/journeys.ts`). The generator reproduces `MANIFEST.json` byte for byte. Ids never change; every moved value keeps its v2.3 value beside it (`v2_3*`). No geography revision change.

| Key | v2.3 | v2.4 | Why |
|---|---|---|---|
| `version` | 2.3 | **2.4** | — |
| `views.{D,E,I,L}.ground` | — | **D [1181,1401] h 3 · E [1306,482] h 170 (the Crown launch deck) · I [1284.8,1215] h 9.5 · L [1477,1289] h 3** | W7-T A2/A3 (R3-130): the four eyes stand > 8 eu (walkPlan's snap) from the path graph; each ground is dry, walkable, unblocked on both tiers and ≤ 5.1 eu from a path edge reachable from the square. E stays ON the launch deck (5.1 eu from `crownLaunch.stair`'s head). D's ground is the beach verge south of the Drive: Long Sands' dune walk and zip landing are in the graph but not reachable from the square (R3-119, open) |
| `views.J.xy` / `eyeH` / `target_h` | [1665,680] / 51.5 / 25 | **[1665,695] / 51.6 / 20** (`v2_3`) | D-D6 applied, J's own subjects fixed: from [1665,680] the Prow is 0 px at 1440 × 900 (the cliff edge is below the frame). 15 m south on the same cliff: the arch 1,743 / 307 px, the Prow 1,250 / 2,988 px, the opening **37.7 % / 36.6 %** of the arch's face (≥ 25 % with W7-S's re-authored arch), horizon in frame |
| `views.G` | eye [1300,440] (the jetty) → the Throat's mouth [1300,300] h 110; subjects the Throat's mouth of daylight, the skylight shaft | **eye [1320,404] (4 eu from the shaft's axis) → [1320,380] h 110; subjects the skylight shaft; `ground` the jetty [1300,440] h 40.6** (`v2_3`) | **D-D7 option 1, design lead, reversible** (W7-T A4): the proof counts only sky seen through the shaft; from the jetty no ray passes it (0 px). Under the shaft: 70 / 42 px. The Deep's roof is open under the shaft (by ray: sky straight up at [1320,400]). The Throat stays dark (D-B5) |
| `views.H.eyeH` / `target_h` (both aspects) | floor + 1.6 = 39.6 / 30 | **48 / 20**; `ground` the strip [440,760] h 38 | W7-T A5 (R3-59): no standing eye on the Flats sees the in-map west sea (review 3: 0 ‰). An aerial eye 10 m over the strip: west sea 0 → **350 / 94 px**, the strip 121 / 80 px |
| `sky.landings.reachMeadow.xy` | [1143,1167] (h 15.3) | **[1195,1205]** (h 4.7; `v2_3_xy`) | W7-T A6: the Dam Run landed 127 m short of the high meadow. W7-T's [1230,1190] is crossed by S1, the Reach walk, its footbridge and the spring (a `sky.landing.reachMeadow` conflict on the merged bake); the nearest clear, dry 40 m field is [1195,1205]: the Dam Run lands 17.3 m from the centre; **Prow → meadow 23.1 m in hand (25 asked)** |
| `sky.gates[northFace].h` | 130 | **139** (`v2_3_h`) | W7-T A7: the Throat Run at trim crosses gate 10 at +0.2 (was 1.2 over its top) |
| `sky.landings.sands.note_v2_4` | — | accepted | W7-T A8: Prow → Sands arrives +3.5 m at any hour; the reduced-motion label is "Long Sands" (was "Long Sands (afternoon)", `glider/controller.ts`) |
| `structures.landingQuay.finish_h` | (3 in code) | **4.7** (`v2_3_finish_h` 3) | W7-S → W7-T, design lead: S1's paved finish and its pad sit on the islet's natural ground instead of digging a 1.7 eu pit (`threshold.landingQuay.pit` closed); S1's finish pin follows |
| `structures.bightSpurTrestle.from` / `to` / `length_m` | [918.1,877] / [886.7,916.0] / 56 | **[923.6,874.5] / [881.0,926.5] / 68** (`v2_3_*`) | W7-S request 4: the trestle runs 6 m further north and 12 m further south along VBS over the voids at its ends |
| `reserves.terraces.plots[0]` | [1551.1,832.5] (W7-A, R3-32) | **[1552,832]** (back to v2.2; `v2_3_plots`) | the v2.3 move shifted the plot's service drive so its bed stands 0.47 over the Year Walk at [1594.7,837.9]: a wall to the walking body; the square → L02 walk on foot stopped there on both tiers (horizonWave4 R2-03 / R2-08 on candidate 6's first bake). **R3-32 (5.83 of 6) is open again**, owner W7-A (move the plot with its drive meeting the Year Walk at grade) |
| `structures.prowLoopFootbridge` | — | **new**: the Year Walk's upper pass over its own lower lane at the Prow ([1603.5,674.6] → [1609.8,702.9], 6 m wide) | W7-A → W7-S: the November loop crossed over itself 5.6 eu apart (an OPEN_VOIDS row since Wave 5). Built as a named carrier: 6 bents, none refused, the underside clears the lower lane by 4.40 eu; the OPEN_VOIDS row is gone |

Code with the data (integrator 4): the gondola stations' head-frame legs stand ±3.2 eu from the rope's line (`HEAD_FRAME_LEG_SPAN`; at ±1.3 they stood in the gondola top's and base's walks and the summit journey had no path; the zip stations keep ±1.3 — a wide cross-head over the Prow's run-off took the glider's flight camera, a 7.5 eu pull-in); a stair opens the kerb / edge / rail of the bed it lands on at its foot and head (never its own rails, never a landing's far parapet); S3 holds the Quay Bridge's 9 from the deck edge [1360,1340]; S1 reaches the apron bay's 31 at its east edge [1170.2,929]; a manifest threshold that takes its bed's height (skate line starts 1 and 4) stands on that bed's own cut, not a pit (authored heights and register pads are still checked); page subjects G and J follow the manifest.
