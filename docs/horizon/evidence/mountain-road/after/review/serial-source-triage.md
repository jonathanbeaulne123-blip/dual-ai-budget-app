# Serial native/world failures: bounded source triage

Checkout: `/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book`.
Compared integrated main `1cf76c5` with current HEAD `df77030298d5ff960d2eeaa5eb62c8558008694b` plus the dirty working tree. Exact dependency and completed-log SHA-256 values are in `/tmp/mountain-serial-failure-triage.json` (37 relevant files; 32 identical). No test runner, TypeScript/world import, bake, browser, baseline execution, or checkout write was performed. Root owns the serial run and the subsequent baseline replay.

## Initial four files

| Failed assertion | Classification from source | Evidence / next proof |
|---|---|---|
| `harbour-hercules.test.ts:264`, attention door radius <73.2 | Inherited deterministic contract mismatch | `data/attention.ts`, `village/layout.ts`, `mountain/places.ts`, and `scene/place.ts` are byte-identical to main. Home is `[58,-119]`; the unchanged `attentionDoor('stairhead')` plan formula produces `[58.0713354563,-114.6675290748]`, radius **128.533739639852**, exactly the log. Floor-height calculation cannot affect those x/z components. |
| `harbour-hercules.test.ts:463`, `spotless(ATTENTION_SPOTS)` | Inherited deterministic contract mismatch; not a reading/payload failure | The helper at lines468–469 only checks radial geometry. Unchanged home centre radius **132.38202294873724** exceeds unchanged `HARBOUR_LAND.shore=73.2`. No financial reading, authority or payload changes are implicated. |
| `harbour-open-world.test.ts:40`, all major sites within30 seconds | Inherited deterministic contract mismatch | Same home centre divided by unchanged `WALK_SPEED=2.1` is **63.03905854701773s**, exactly the log. The sole `bodyModel.ts` change is passing an optional initial y into pushOut at line357; it cannot change this arithmetic. |
| `harbour-open-world.test.ts:32`, kitchen→orchard full/lite | **Unclassified pending actual baseline** | The unchanged test calls the bounded, height-blind `findPath`, not runtime `planWalk`'s mountain network. `courtObstacles()` nevertheless reaches changed native branches, support posts, edge openings, and branch-fed seeded planting. Unchanged direct files are insufficient proof. |
| `harbour-skate-model.test.ts:142`, all spots/routes/rails inside73.2 | Inherited deterministic contract mismatch | `skate/park.ts:27` already appends `MOUNTAIN_RACE`; unchanged road alignment ends at `[17,-293.5]`, radius **293.9919216577218**, exactly the log. Main-road/town-lane construction and gate-plan source blocks are byte-identical; `roads.ts` classification preserves every sample's `at`. This test's town-radius assumption already includes mountain gates. |
| `harbour-skate-model.test.ts:153`, timed-route straight segments clear | **Unclassified pending actual baseline** | All nine logged blocked segments are `mountain-descent` gate-to-gate chords: full5/9/12/14/15 and lite5/12/14/15. `course.ts:184` deliberately exposes gate positions, not the dense driven road. A blocked long chord need not mean a blocked road, but changed obstacle dependencies prevent calling these inherited yet. |
| `harbour-skate-presence.test.ts:35`, stale pose has no y | Inherited deterministic source/test disagreement | `worldMotion.ts`, its direct dependencies and the test are byte-identical to main. `worldMotion.ts:136–148` explicitly retains newest.y while dropping the act on stale data. The log's3 is exactly that behavior. `hearth-mountain.test.ts:392–395` separately requires delayed mountain walking altitude to remain; a blanket removal of stale y would break that accepted contract. |

Thus **five of the eight initial assertions have direct unchanged-source/arithmetic proof**. The other three assertions remain open for root's replay. This is not a waiver and is not a claim the complete files pass.

## Additional completed files

`hearth-mountain-channel.test.ts:46` reports y=-0.05 against expected0.57. Strong source attribution is the unchanged legacy monorail quay `[0,.57,58]` (`transportAll.ts:8–23`). `TRANSPORT_STOPS` includes monorail, while `WORLD_SURFACES` only builds station decks from `TRANSPORT_LINES` (`surfaces.ts:23`, `transport.ts:111`), which contains funicular/gondola. The island formula at radius58 yields -0.05. The transport, island and channel files are identical to main. The failed log does not print kind/id, so retain **likely inherited, baseline pending** until the replay or one labelled stop query identifies the exact stop. No monorail floor should be invented to clear this assertion.

`hearth-mountain.test.ts:348–359` samples all branches using the constant declared `halfWidth`. The approved awning return tapers from1.5m to1.2m half-width; its canonical rows preserve the first nine rows. The first eight logged failures are outside all current landing triangles, confirmed by lightweight arithmetic over the JSON only (no runtime imports): `/tmp/mountain-serial-awning-witnesses.json`. The first witness is `[34.34834159587545,17.08669623447073,-93.0731373165179]`, expected by the old segment-normal capsule, queried floor16.693750120685415. It also demonstrates the bend-end difference between a constant segment-normal capsule and the protected row frame, independently of the later taper.

This does **not** establish missing support on the approved deck. The actual local row half-widths are1.3709341597170752 at row9,1.425 at row10, then nominal coarse taper anchors1.35/1.275/1.2. Interpolating rotating edge positions gives a minimum row half-width1.1992777993598196 at row17; this is reported exactly, not rounded into a claimed minimum1.2. No geometry or minimum-width requirement was changed during triage. The log shows only `failures.slice(0,8)`; total failures are unknown from this log.

A bounded proposal fixes the width consumer and diagnostic metadata without changing the taper, mesh, protected entry/rail, controller, or tolerances: `/tmp/mountain-branch-width.patch`; handoff `/tmp/mountain-branch-width-proposal/HANDOFF.md`. Root must run the proposed checks; no passing result is claimed here.

The same `hearth-mountain` log reports the shipped native input-driven main descent completed17/17 gates in94.4s with0bails. That is the scope of this existing test's positive evidence, not Horizon or whole-branch acceptance.

## Dependency proof still needed

Root has prepared detached main `../mountain-baseline-proof` at1cf76c5. Replay the six original failing files there only after the active serial run. Keep baseline assets and test files from that revision; shared installed dependencies may be symlinked. A matching first failure establishes that witness as inherited, not that every unexecuted assertion or generated obstacle is unchanged.

For the two obstacle-dependent cases, if attribution remains disputed, compare the effective ordered data at both revisions rather than copying only `obstacles.ts`:

- `courtObstacles('full'/'lite')`: all IDs, types, x/z geometry, extents, yaw, bottom/top, and ordering. `pathfinder.ts` uses a bounded128-node graph and tie/order effects can matter.
- Categories: unchanged court/building/landmark inputs; `WORLD_SOLIDS` branch support posts (`surfaces.ts:112–119`); `EDGE_SOLIDS` (`roads.ts`, now including three branch arrival openings); `mountainTrees(tier)`.
- `mountain/planting.ts` is unchanged but `keepClear():38` consumes changed `SKILL_BRANCHES`. Its seeded generator's acceptance path can move subsequent trees. Byte equality of planting.ts alone proves nothing about its resulting tree array.
- Hash/compare the exact destination list and `MOUNTAIN_RACE.points`; then list all intersecting obstacle IDs per failed route chord. `pathSegmentClear` ignores obstacle altitude, unlike real3D movement, so label projection obstructions distinctly from physical rider collisions.
- For kitchen→orchard, preserve the actual endpoints, settled endpoints, first blocking IDs and node-cap outcome. Do not substitute a passing `planWalk` result for the existing `findPath` assertion. Runtime `walker.ts:319` uses `planWalk`; `route.ts:39–69` is the correct separate user-path proof.
- For the awning, replay baseline first, then run the actual-row checks with unchanged0.3m generic floor/centreline-crossfall limits, the existing stricter landing checks, contact checks, and boundary checks. No widened footprint or invented support is proposed.

No tests were loosened, skipped, quarantined, or changed in the checkout.
