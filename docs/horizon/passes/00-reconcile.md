# Pass 0 — Reconcile

> 25 September 2026 amendment: D13 is confirmed at 1.0; D12 retains three uphill Terraces plots and four Bight Shore plots (seven large plus two small). These decisions supersede earlier scale recommendations, counts and plot-4 review-history notes below. See the live decision register and MANIFEST v1.6.

Builder: **Codex**. Reviewer: a Claude reviewer subagent (`REVIEW-BRIEF.md`, auditor 4 only) plus a Codex trust review on each PR. Gate: Jonathan. Delivery: `~/Downloads/hearth-horizon-p0-reconcile/`.

---

## Purpose

Put `main` into one known state that the island can be built on: the three unmerged bundles merged in order, the eleven stale PRs triaged, Mountain v2's open majors A1–A5 closed (A3 and A5 without exception), decisions D1–D16 recorded, the WorldDefinition v3 interface typed with a manifest loader and schema test, the deck committed, and the SHA pinned as `PIN-0`.

No island geometry is authored in this pass. No landform, bed, structure or host position changes.

## Inputs

| Input | Where |
|---|---|
| Desk bundle | `~/Downloads/hearth-simple-view-desk` — branch `claude/simple-view-desk`, on `main@87f6027` |
| Skate v2 bundle | `~/Downloads/hearth-skate-v2` — branch `claude/skate-v2-int` |
| Mountain v2 bundle | `~/Downloads/hearth-mountain-v2` — branch `claude/mountain-v2`, HEAD `9901a50`, on `main@2d9c219`; its `CONTRACT.md`, `HANDOFF.md`, `FINISH-PROMPT.md` (A1–A5) |
| The eleven stale PRs | GitHub, open PRs on `jonathanbeaulne123-blip/dual-ai-budget-app` other than the three above |
| Decisions | the deck's `DECISIONS.md` (D1–D16, the source of truth for status); `inputs/grand-plan.txt` ch. 14 for the wording of D1–D12; `MANIFEST.json → scale.decision` (D13) |
| Schema | `CONTRACT.md §4` |
| Budget | `CONTRACT.md §6` (A2 and A3 are why it exists) |

## Base SHA rule

- Start from `origin/main` HEAD on the day the pass starts; record it in `HANDOFF.md` as `P0-base`.
- Each bundle is rebased onto the `main` produced by the previous merge, never onto `P0-base` after the first merge.
- `PIN-0` is the merge SHA after the last step below, recorded in `docs/DECISIONS.md → Pins` with date, pass, `GEOGRAPHY_REVISION` and the presence `world` string.

## Steps (in order; each step is one or more PRs)

### Step 1 — Verify the bundles

For each of the three folders:

1. `git bundle verify <file>.bundle` → must report "okay".
2. `git fetch <file>.bundle <branch>:<branch>`; confirm the head SHA matches the folder's `HANDOFF.md` (`9901a50` for Mountain v2).
3. Confirm the merge base: Desk on `87f6027`, Mountain v2 on `2d9c219`; record Skate v2's base as found.
4. Apply `patches/` to a scratch branch from the same base; the tree must equal the bundle's tree (`git diff --stat` empty). A mismatch stops the pass; report it.
5. Run on the bundle branch: `tsc`, the focused suites named in its `HANDOFF.md`, `pnpm build`. Record results; do not fix yet.

### Step 2 — Push, PR, trust review, merge (order is fixed)

| Order | Branch | Seams to watch | Merge condition |
|---|---|---|---|
| 1 | `claude/simple-view-desk` | deletes `CourtFlat`/`VillageFlat`; the backtick flip; the one quick-travel bar | Codex trust review green; the flat edition renders with WebGL disabled; `pnpm build` green |
| 2 | `claude/skate-v2-int` | `src/harbour/skate/{sim,driver,session,world/field,hud,parkScene}`; Skate Lab dev-only | trust review green; Skate Lab absent from the production build |
| 3 | `claude/mountain-v2` | `src/harbour/scene/runtime.ts`, `src/harbour/HarbourWorld.tsx`, `src/harbour/mountain/MountainPanel.tsx` | trust review green; A3 and A5 fixed (Step 4) on this branch before merge |

- Rebase each onto the current `main` before its PR. Resolve seam conflicts toward the later bundle's intent and list every resolved hunk in `HANDOFF.md → Seams`.
- The Desk must not import anything from `src/harbour/mountain/` or any heightfield after the Mountain v2 merge (`CONTRACT §6`: 0 ms entry stall).

### Step 3 — Triage the eleven stale PRs

One row per PR in `HANDOFF.md → Stale PRs`: number, title, decision (`close` or `merge`), one-line reason.

- **Close** when superseded by the Desk, Skate v2, Mountain v2 or the Horizon deck; when it conflicts with a fixed item in `CONTRACT §1`; or when it cannot pass `tsc` + its tests after a rebase in under 30 minutes of work.
- **Merge** only when it is green after rebase, independent of the island, small, and touches no money semantics, schema, auth, sync or deploy (or its trust review is green).
- Closing comment on GitHub: the one-line reason and "superseded by <PR/branch>" where it applies. Never delete a branch that has unmerged commits referenced by a bundle.

### Step 4 — Close Mountain v2 majors A1–A5

A3 and A5 are **prerequisites**: `PIN-0` does not exist without them. A1, A2, A4 are done in this pass if time allows; any not done are copied verbatim into `FINISH-PROMPT.md` and become the first commits of pass 1.

| Id | Fix | Proof |
|---|---|---|
| **A3** terrain bake at module evaluation (~1.6 s stall) | Move the bake to a build-time script that writes a binary asset under `public/` keyed by `GEOGRAPHY_REVISION` (e.g. `public/mountain/terrain/<GEOGRAPHY_REVISION>.bin`); the runtime loads it async; importing any module evaluates no terrain math | `test/mountainTerrainAsset.test.ts`: importing the terrain module performs no bake (spy on the bake function: 0 calls); the asset name contains the revision; asset ≤ 2.5 MB (`CONTRACT §6`); a stale revision asset is rejected |
| **A5** presence world version across geography revisions (Worker contract change) | The presence `world` string carries the geography revision; browser and `workers/ledgerRoom.ts` bump together; a peer on another revision is shown as **unavailable**, never at a wrong place (`CONTRACT §2.3`); saved body positions carry `geo` and a mismatch migrates to the nearest path node (`CONTRACT §2.14`, `src/house/navigation.ts`) | `test/presenceGeographyRevision.test.ts`: mismatched revision → unavailable state, no position rendered; matched → rendered; saved position with old `geo` → nearest path node. **Codex trust review of the Worker diff is mandatory** |
| A1 app reduced motion in streaming fades | `streaming.ts` fades read the app's reduced-motion setting (not only the OS media query); reduced motion = 300 ms fade (`STYLE §1.1`) | `test/mountainStreamingReducedMotion.test.ts` |
| A2 Walk↔Look streaming churn (synchronous rebuild of all districts) | ≤ 1 district built per frame; 4 s release delay; no synchronous rebuild on the switch (`CONTRACT §6`) | `test/mountainStreamingChurn.test.ts`: 10 Walk↔Look toggles in 2 s build 0 districts synchronously and ≤ 1 per frame |
| A4 race Retry during countdown / at gate 0 | Retry restarts the run from the start gate in every state, including countdown and gate 0; it never cancels the race | `test/mountainRaceRetry.test.ts` |

### Step 5 — Record the decisions

Create `docs/DECISIONS.md` (or append if it exists). One entry per decision: id, title, what was proposed, recommendation, answer with date and Jonathan's words, status (`APPROVED` / `OPEN`), the pass it blocks.

| Id | Decision | Status on 25 Sep 2026 | Blocks |
|---|---|---|---|
| D1 | The hook shape and the Bight | APPROVED ("I love all of it, it's perfect") | — |
| D2 | Little Harbour on a slope | APPROVED | — |
| D3 | Hollow the mountain (Undercroft; funicular becomes the Ore Line) | APPROVED | — |
| D4 | The plane (floats and wheels; strip; dock; one-button ring) | APPROVED | — |
| D5 | Glider into the Throat | APPROVED | — |
| D6 | Lantern Hunt as the flyover | APPROVED | — |
| D7 | Four skate lines with surface-driven pace (cut the Wash last if the arm proves too far) | APPROVED | — |
| D8 | Ten modes | APPROVED | — |
| D9 | Winter ice on Stillwater; sledding on the Shoulder | APPROVED | — |
| D10 | Names (frozen as `MANIFEST.json → names`) | APPROVED | — |
| D11 | The cats: names and colours | OPEN (placeholder tabby per `STYLE §1.9`) | pass 3 dressing only |
| D12 | Three uphill Terraces plots, four Bight Shore plots, plus sealed drift and hangar bay; plot 4 retired | APPROVED by Jonathan 25 Sep 2026: “Keep only three uphill — seven reserve plots total” | — |
| D13 | `scale.factor` = 1.0 (heights included) | APPROVED by Jonathan 25 Sep 2026: “1.0 — full concept scale” | — |
| D14 | The Kitty reserve chambers retire from the dam; Kitty Banks read in the Loft as now; `L01` shows the Fund basin only | OPEN (Claude recommends retire) | pass 3 (Lakeside) |
| D15 | The switch to the Horizon: behind `VITE_HEARTH_HORIZON` from pass 1, flipped for everyone when Little Harbour (pass 3, wave 1) is accepted on both devices, flag deleted in the same PR | OPEN (Claude recommends as stated) | pass 3 |
| D16 | The day/night cycle follows the real sun in the device's time zone at 44° N (sundial scrub, reduced-motion freeze at 15:30, deterministic almanac; `LIGHT.md`) | STATED by Jonathan 25 Sep | — |

Add a `Pins` section at the end of the file (README §4).

### Step 6 — WorldDefinition v3, typed and empty

- `src/harbour/horizon/world/definition.ts`: the `WorldDefinition` interface exactly as `CONTRACT §4`, plus every referenced type (`HeightfieldRef`, `WaterBody`, `Landform`, `District`, `Host`, `OutdoorPlace`, `Bed`, `Line`, `Structure`, `Crossing` with `resolution: 'over' | 'under' | 'threshold'`, `Threshold`, `Reserve`, `FlightEnvelope`, `UndercroftDef`, `LightAnchor`, `SketchbookPose`, `LanternSpot`, `ProtectedArea`). Types only; no geometry, no three.js import.
- `src/harbour/horizon/world/MANIFEST.json`: byte-for-byte copy of the deck's `MANIFEST.json`. From this commit on it is the only manifest.
- `src/harbour/horizon/world/manifest.ts`: typed loader. Reads the confirmed `scale.factor` 1.0 in v1.6. The loader still returns an otherwise valid unconfirmed manifest, but `requireScaleFactor()` throws "D13 open" unless `scale.status` starts with `confirmed`; negative tests preserve that guard.
- `src/harbour/horizon/world/empty.ts`: `emptyWorldDefinition(rev)` returning a valid `WorldDefinition` with empty arrays and `geographyRevision: 'horizon-geo-0'`.
- `test/horizonManifest.test.ts`: the manifest parses into the loader's types; every `names` list is present (including `names.structures`, `names.water` and the `idRule` string: ids are the manifest's camelCase keys, `names` holds their labels); counts: 7 `hosts`, the 12 Harbour place ids across `hosts[*].placeIds` + `places` (`court`, `campfire` and the ten host place ids, `CONTRACT §1`) plus `L01` and `L02` in `places`, 13 `districts` (`CONTRACT §4`), 7 `neighbourhoods`, 12 `views`, 12 `sky.gates`, 4 skate lines (`skate.S1`–`S4`), 7 reserve plots + 2 small; every `crossings[*].resolution` ∈ {`over`, `under`, `threshold`}; every threshold `modes` entry is `a→b`; every reserve plot has its own `rot_deg` (`reserves.rotRule`); every host has `footprint_m` and `roofH_eu` (`hostRule`); every view has `target`, `fov_deg`, `radius_eu` (`viewRule`).
- `test/horizonWorldDefinition.test.ts`: `emptyWorldDefinition` type-checks and round-trips through JSON.
- `test/deskNoHeightfieldImport.test.ts`: the Desk's module graph contains nothing under `src/harbour/mountain/`, `src/harbour/horizon/` or `public/**/terrain/`.

Lighting work in this pass: the `LightAnchor` and `SketchbookPose.bestHour` types only. No rendering change.

### Step 7 — Commit the deck, pin

- Copy the deck (`README.md`, `CONTRACT.md`, `LIGHT.md`, `STYLE.md`, `REVIEW-BRIEF.md`, `NOT-THIS.md`, `passes/`, `inputs/`) to `docs/horizon/`. Do not copy `MANIFEST.json` there; add `docs/horizon/MANIFEST.md` with one line pointing to `src/harbour/horizon/world/MANIFEST.json`.
- Create empty folders with a `README.md` of one line each: `src/harbour/horizon/{world,land,sky,sun,kit,movers,neighbourhoods,pastimes}/`.
- Merge; record `PIN-0`.

## Tracks

Single builder (Codex). If Codex parallelises, the split is:

| Track | Owns | Must not touch |
|---|---|---|
| Merge | Steps 1–3, seam files `src/harbour/scene/runtime.ts`, `src/harbour/HarbourWorld.tsx`, `src/harbour/mountain/MountainPanel.tsx` | `src/core/` |
| Majors | `src/harbour/mountain/{terrainBase,terrain}.ts`, Mountain v2's `streaming.ts` and `race.ts`, the bake script, `public/mountain/terrain/`, `src/house/navigation.ts` (saved `geo`), `src/ledgerSync/worldPresenceWire.ts`, `workers/ledgerRoom.ts` (A5 only, trust review) | money, schema, auth beyond A5 |
| Records | `docs/DECISIONS.md`, `docs/horizon/**`, `src/harbour/horizon/**` | anything under `src/harbour/mountain/` |

## Must produce

- [ ] Three bundles verified, pushed, reviewed, merged in the order Desk → Skate v2 → Mountain v2.
- [ ] Eleven stale PRs each closed or merged with a one-line reason.
- [ ] A3 and A5 fixed with their tests; A1, A2, A4 fixed or carried verbatim in `FINISH-PROMPT.md`.
- [ ] `docs/DECISIONS.md` with D1–D16 and a Pins section.
- [ ] WorldDefinition v3 types, the manifest copy, the loader, `emptyWorldDefinition`, three tests.
- [ ] Deck under `docs/horizon/`; the `src/harbour/horizon/` skeleton.
- [ ] `PIN-0` recorded.

## Must not

- Change any landform, host position, route or structure. That is pass 1.
- Edit `src/core/`, `src/harbour/data/reading.ts`, `src/harbour/village/layout.ts`, `src/harbour/court/dressing.ts`, `src/harbour/scene/place.ts`.
- Change money semantics, schema, auth, sync or deploy beyond A5's presence `world` string, and A5 only with its trust review.
- Edit the spine (`CONTRACT`, `MANIFEST`, `LIGHT`, `STYLE`); conflicts go in `HANDOFF.md → Conflicts`.
- Merge a bundle whose `tsc` or `pnpm build` is red.
- Use real household data anywhere.

## Tests to add

`test/mountainTerrainAsset.test.ts` (A3), `test/presenceGeographyRevision.test.ts` (A5), `test/mountainStreamingReducedMotion.test.ts` (A1), `test/mountainStreamingChurn.test.ts` (A2), `test/mountainRaceRetry.test.ts` (A4), `test/horizonManifest.test.ts`, `test/horizonWorldDefinition.test.ts`, `test/deskNoHeightfieldImport.test.ts`.

Run each with `pnpm exec vitest run test/<name>.test.ts --maxWorkers=1` after its step. On the final SHA: `tsc`, `pnpm build`, then once: `pnpm test -- --risk=high --focus=harbour --focus-reason="horizon p0: merge desk, skate v2, mountain v2; A1-A5; v3 types"` within five minutes.

## Evidence required

| Evidence | File |
|---|---|
| Bundle verify output, head and base SHAs | `evidence/bundles.txt` |
| PR list with links, trust-review verdicts, merge SHAs | `evidence/prs.md` |
| Stale-PR table | `HANDOFF.md → Stale PRs` |
| A3: first-interactive timing before and after on the harness (1440 × 900); asset size | `evidence/perf/a3.json` |
| A5: two browsers on different revisions showing "unavailable" | `evidence/a5-unavailable.png` |
| A2: frame log of 10 Walk↔Look toggles | `evidence/perf/a2.json` |
| Desk with WebGL disabled, sign-in to first paint | `evidence/desk-no-webgl.png` |
| Test and gate output | `evidence/tests.txt` |
| The twelve pages (`CONTRACT §7`) | not applicable: no Horizon geometry exists at `PIN-0`; `tsc`, the focused suites and the quick gate apply |

## Gate

Jonathan signs off when: the three branches are merged on `main`; the Desk opens on his iPhone with no 3D stall; the Mountain opens on his Mac with no ~1.6 s stall; D11–D15 are answered or explicitly deferred in `docs/DECISIONS.md` (D12 and D13 must be answered before pass 1 starts; D14 and D15 before pass 3).

## Delivery

`~/Downloads/hearth-horizon-p0-reconcile/`: `p0-reconcile.bundle` (records commits since the last merge), `patches/`, `HANDOFF.md`, `FINISH-PROMPT.md`, `TEST-PLAN.md`, `evidence/`. Codex pushes its own branches and PRs; nothing merges without its trust review.

## Reconciled to MANIFEST v1.1 (reviewer)

- Decisions widened from D1–D13 to D1–D16 (Purpose, Inputs, Step 5 table, Must produce, Gate) to match `DECISIONS.md`; D12 status aligned ("approved in principle; locations re-laid"); D14, D15, D16 rows added.
- Step 6 loader: `scale.factor_recommended` no longer exists; v1.1 carries `scale.factor` 0.6 with `scale.status` "recommended"; `requireScaleFactor()` keys on `scale.status` starting with `confirmed` (the design lead must adopt that convention when D13 is answered).
- Step 6 manifest test counts: `L01`/`L02` added to the place count; 13 districts and 7 neighbourhoods added.

### v1.2 deltas (reviewer, MANIFEST v1.2)

- D12 row: the open question on Terraces plot 4 (seaward) added.
- Manifest test: `names.structures`, `names.water`, `idRule`, per-plot `rot_deg`, host `footprint_m`/`roofH_eu`, view `target`/`fov_deg`/`radius_eu` checked.
