# The Horizon — the deck

> Current canonical manifest: v1.7 — sky-only over v1.6 (FLIGHT.md's glider polar, parachute, Throat corridor, Drop Zone, landing modes and the carried `bailOut` threshold; D34's glider retarget applied pending Jonathan); geography stays `horizon-geo-1`. v1.6: Jonathan confirmed full scale 1.0 and three uphill Terraces plots (seven large reserves total) on 25 September 2026. `src/harbour/horizon/world/MANIFEST.json` is authoritative; embedded manifests in `inputs/` are frozen design references. The generator mirrors the canonical data. PIN-0 remains pending until its accepted merge SHA is recorded.

Version 1.6 · 25 September 2026 · Owner: Jonathan (product) · Author: Claude (design lead, review)

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

## Flight (added 26 Sep)
`FLIGHT.md` decides the glider and the parachute (track M6): a hang glider flown by the bar on a five-point polar (8–17 m/s, trim 11 / 1.2), thermals by the real clock, ridge lift worked on the Crown's south face, the landing-outcome table (walk-off, tumble, or a labelled fade — never a crash), the Throat as a corridor dive to a splash and three echoes, the parachute from the plane's carried `bailOut` threshold (freefall, auto-pull at 45 m, the Drop Zone as a wind problem, the plane flies itself home), one horizon-locked flight cam, two glass bubbles, reduced motion as a sheet of landings and pages. It asks for MANIFEST v1.7 sky-only fields and decisions D34–D38.

## Files and their sources
- The canonical manifest is `src/harbour/horizon/world/MANIFEST.json`; `docs/horizon/make_manifest.py` reproduces it. Run the generator in a temporary directory, compare its JSON with the canonical file, and copy an approved result there. Earlier embedded manifests and review claims under `inputs/` are historical. V1.6 reconciles the prerequisite data; it does not claim built geometry or clearance acceptance.
- `inputs/grand-plan.html` is the approved Grand Plan artifact (the *why*), whose map draws from this same manifest.
- `inputs/mountain-dissection-summary.md` and `inputs/horizon-pitch-v0.1-notes.txt` are the historical references the briefs cite.
- `DECISIONS.md` points to the live list. D12/D13 and the station/homestead land scope D21/D25 are approved; other recommendations retain their recorded status.
