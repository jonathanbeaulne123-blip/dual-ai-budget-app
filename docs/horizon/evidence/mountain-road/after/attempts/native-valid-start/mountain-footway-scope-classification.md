# Fair footway completion verdict — current evidence, not final acceptance

**The introduced Town funicular/Foot and Horizon Summit failures are mandatory Mountain Road repairs. Original native obstructions must remain named failures, but their discovery does not authorize moving every native wall, stair, water edge or path. Two reported Summit gallery failures are invalid audit starts, not evidence that the surface walk reaches an underground wall. No current legal-width follow-up has executed.**

Authority read: `docs/briefs/MOUNTAIN_ROAD_PHASE_2.md:5–19` requires the authorized chain/Stillwater result, scope-specific gaps and real walking coverage; `docs/horizon/MOUNTAIN_ROAD.md` D-MR3/5/12 preserves native ownership, guard openings and full-footway evidence; `docs/CODEX_HORIZON_MOUNTAIN_ROAD_1.md:82` owes every footway/branch capture/probe. These documents do not authorize blanket native redesign. I did not retrieve an independently preserved verbatim initial user prompt, so I do not turn these summaries into a newly invented “all52 native paths must be rebuilt” requirement. Coverage, successful traversal and authority to change geometry are distinct.

## Exact saved inventory

All paths below are relative to the checkout unless `/tmp` is explicit:

- `docs/horizon/evidence/mountain-road/after/attempts/expanded-native-footway-comparison/{baseline,current}-results.json.gz`
- Same directory `mountain-native-footways-comparison.json`, `baseline-native-paths.json`, and `{baseline,current}-routes.json.gz`.
- `/tmp/mountain-native-footway-witness-disposition.json` records exact compared fields/hashes; `/tmp/mountain-acceptance-disposition.md` is the prior detailed disposition.
- `/tmp/mountain-native-clearance-selection.json` records exact source widths, poses, blockers and selected18-route inventory.

Native104 attempts: baseline74end/30nonfinish, current73end/31nonfinish. Current31 consists of2 introduced funicular failures,2 invalid zero-length attempts,2 wrong-level starts, and25 other incomplete directions. Of those25,23 reproduce the captured baseline witness exactly; observatory-forward retains the same obstruction but a changed supporting floor; summit-overlook-forward reaches farther then fails on a later terrain witness. Exact source equality is not proof of whole-route behavior.

| Class | Exact witnesses | Fair disposition |
|---|---|---|
| **Introduced, scoped, mandatory** | `native path:station:funicular:town~road:foot` F4.48m/R1.72m,57.4682°/58.9561° ground; main previously finished both. | Horizon repair and current full-width support/art/movement proof required; active funicular work owns it. Ordinary steering cannot waive a new broken host. |
| **Introduced, scoped, mandatory** | Horizon `walk summit` F0.36m at64.359311°, R12.64m against `crownLaunch.stair.landingRails@crown`. | Proven Horizon terminal-cut and new-rail defects; current source patch/pre-bake probe owns them. Final ordinary route evidence remains owed. |
| **Native authored obstruction, not new wall** | `path:district:summit~door:observatory` F/R hits `mountainV2:summit-art:parapet:2`. F current floor158.001593425 replaces baseline158; R exact witness repeats. | Native parapet construction is in `src/harbour/mountain/artGeometry.ts:78`, with matching visible observatory parapet in `art/buildingArt.ts:159–166`. Do not remove it under Horizon authority. Test ordinary walking within existing3m width; if impossible, separately measure native opening/path choice. This is still an incomplete route, not a pass/exemption. |
| **Native authored bridge lip, not post steering yet** | Town-north→river-west F blocks at `mountainV2:path:bridge:river-footbridge`; R feet56.2 over floor55.065792969, a1.134207m drop. | Original native bridge/path source is `mountain/pathGraph.ts:104`. Repeat legal-width trial; a supported mouth correction needs explicit native/bridge ownership if still required. Do not identify this as an introduced Mountain Road obstruction. |
| **Native original support/terrain failures** | Harbour stairs F/R; Dam west stairs F/R; east Dam→pavilion F/R; pavilion→reservoir F; reservoir-funicular→Dam F/R; Library approach/gorge/b2 cases; town west lanes F/R; woodland gate F. | Saved corresponding witnesses repeat on integrated main. They require coverage and honest named outcomes. They do not by themselves prove this road patch broke access or authorize unrelated native terrain/route redesign. Valid-start/width follow-up must precede any physical proposal. |
| **Changed first failure after improvement** | Summit→overlook F: baseline airborne4.56m; current stall10.60m at43.8761278°. Reverse exact72.2631° first blocker remains. | Current F is neither complete nor an exact inherited first witness; classify improvement plus later unresolved terrain. No new-terrain-cause claim without source measurement. |
| **Audit initialization error** | Native road→Summit F and Summit→gondola R both start on y90 in the first t0 sample. | Source0.5m start heights157.503732397 and157.306467304; instant67.503732m/67.306467m drops precede motion in both baseline/current. Bell Gallery wall contacts reached from these placements do not establish an ordinary surface-footway obstruction. Retain the failed attempts and rerun with actual runtime placement semantics. |
| **Invalid inventory route** | `native link:lane-junction`, F/R: same point, zero length. | Two invalid attempts, not travel successes and not two physical access defects. Preserve inventory/error; no route invention or stitched continuation. |

Horizon FootQuay's existing station-post centreline collision is a separate safe-footprint steering candidate, previously proved in `/tmp/footquay-generic-cached-movement/` and `/tmp/footquay-clearance-proof.json`. Its final-source repeat is owed. The old promenade chord was false Horizon metadata: current source names only the actual crest. Removing that false chord cannot claim usable west/east native Dam approaches.

## Minimal truthful wrong-level-start correction

The legacy audit's `surface(sourceY,.48)` selects any floor below that ceiling, then unconditionally assigns its height. Runtime same-revision restoration instead calls `restoreHorizonPosition` with `restoreStand`: surface at `savedY+.5` using `HORIZON_RESTORE_TOLERANCE`, plus dry/walkable/unblocked tests; same-place acceptance is bounded by the actual1.6m restore tolerance. See `runtime/index.ts:437` and `runtime/savedPosition.ts:7–24`.

Prepared a separate `/tmp/mountain-native-clearance-runtime-start.mjs` using that actual exported runtime function and exact callback. It retains source XY and every source path point; if runtime fallback would move to a graph node, the attempt is labelled `walking-runtime-start-unavailable-at-source` and does not walk or count as complete. One initial placement only; never rearm, snap or relocate after movement begins. It records old source versus actual placement and preserves the original failed centreline files. It does not adopt unconstrained highest-floor placement or alter the .48m walking step.

Run only these two directions' routes initially (four independent attempts, both directions for each):

```sh
MOUNTAIN_NATIVE_ROUTES='native path:road:summit~district:summit,native path:district:summit~station:gondola:summit' \
node /tmp/mountain-native-clearance-runtime-start.mjs "$PWD" /tmp/mountain-native-runtime-start-observed
```

The unchanged legacy-start clearance wrapper remains `/tmp/mountain-native-clearance-probe.mjs` (18routes/36attempts or `--all-native`52/104). Neither has run as of this review. A complete width-constrained run is evidence of traversability with ordinary inputs; a failed seven-offset greedy helper is not proof that no human line exists.

## Reporting boundary

Do not say “all footways pass”: current evidence cannot support it. Do say which named chain/link/affected connections pass once final-source proof exists, report the full original-path survey counts separately, and name every remaining native access limitation with ownership and exact witnesses. Resolve all introduced scoped regressions. Do not expand into moving unrelated protected native structures merely to make a broad survey green. If the original user acceptance explicitly requires those additional native connections to be traversable, take a measured native repair or narrowed-scope choice to Jonathan; baseline equality alone cannot supply that choice.
