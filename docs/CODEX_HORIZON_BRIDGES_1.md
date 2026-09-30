# Horizon bridges — local implementation handoff

Jonathan said “build them” after the Bridge Book. Work is local on `codex/horizon-bridge-book`, based on `e77309efbc48a76e8328f2b427613ecc6082bb61`. Jonathan subsequently requested a mergeable PR including the airport update. Airport PR #576 is already merged; this branch integrates main at `324cd5f` and retains both runtime lifecycles. PR verification is in progress; there is no bridge merge, deployment or device acceptance. Main's unrelated Bianca Month failure remains named and unchanged.

## Household outcome

The island now has ten bridge identities in source and the baked world, each with its own structural form, meeting anchor, night-light anchors, and readable Journey glyph/name in both editions. Bight is the first review exemplar: a suspension crossing with the existing S2 flyover, a fixed tower stair and upper balcony. A meeting place never changes household data or posts money.

Budget delta(5):0. Engagement delta(3):+2 target, pending Jonathan's visual and riding acceptance.

## What is built

| Bridge | Local architecture | Acceptance still owed |
|---|---|---|
| Suspension Bridge — Bight | Towers, main cables, hangers, anchors, cable necklace,72-tread tower stair, balcony and deck-level meeting | Full approach/theme/map acceptance, swept water/cable envelopes, complete course/device rides, whole-scene budget |
| The Arch — High Span | Outboard curved ribs, springing seats, hangers, rib lights and side meeting bay | Crown-specific lookout refinement, full course/road acceptance |
| Drawbridge — Quay | Seated twin-leaf girders, machinery houses, grounded hinge piers, meeting bay | Moving leaves/collision, barriers, occupancy interlock, bell and operation; current deck remains fixed |
| Ribbon — Apron | Route-following deck, underslung tension members and footlights | Pumpable skate-wave deck and grind feature; current deck remains at the existing grade |
| Covered Bridge — Hollow | Pitched roof, bearing plates, timber bracing, window lanterns and sheltered side bay | Bench/basket treatment; no live rain claim |
| Stone Bridge — canal | Three masonry arch openings and retained road grade | Water-route/controller fit, spandrel/reflection details |
| Cantilever Walk — Prow | Grounded end bearings, route-following cantilever arms, lit side bay | Lower-route swept clearance and rope handrail detail |
| Trestle — Bight spur | Cross-bracing tied to actual retained bearing stations | S4 threading proof and frame-light treatment |
| Garden Bridge — Garden Walk | Wider planted deck, original3.2m walking strip, theme-specific plants | Below-road replay and full approach acceptance |
| Boardwalk — Reach | Pile structure with bearing-aligned braces and regatta landing | Companion raised boat crossing and water acceptance |

Minor connectors retain their existing plain kit. No global controller or physics changes, money/commands/schema/sync/Auth/RLS/Hercules changes, or new point-light pool.

## Measured evidence

The shared structural meshes supply both collision and runtime bridge batches. Meeting bays have graded entrances and flat3×3m standing areas; the baked sampler uses0.3m body radius,1.3m height and0.25m intervals. This is static evidence, separate from controller runs.

Bight's road remains at12m, underside11.4m; S2 retains5m clearance. Gate5 is11×8m at its unchanged centre after the24m study width intersected a pier when tested through the full deck depth. High Span retains its40×12m gate. Both apertures have zero member-triangle intersections. This does not measure the complete wing or every water craft.

Bight's actual runtime walker completed ascent, descent and meeting approach:266,266 and52 input-driven steps respectively, all goals within0.065m, zero browser errors. The stair's maximum sampled riser is0.166667m. The clear route approaches around the protected stair end at station127; the tower occupies part of the balcony's inner strip.

Four bounded real glider simulations traversed Bight and High Span in both directions with actual geography, wind/lift and wall collision; no post-start correction or touchdown. These start airborne and do not establish full authored launch-to-landing courses.

The actual bridge-only batches use3 calls in all themes/tiers. Against the corresponding tier of the prior baked structure, added full triangles are7,926 Classic/6,792 Taylor/9,942 Newfoundland (limit18,000); lite adds6,722/6,650/6,850 (limit7,000). Lite drops cable housings while retaining every structural member and glow bead. Whole-scene captured peaks of457 calls still require budget acceptance.

Evidence lives under `docs/horizon/evidence/bridges/after/`. All browser images/replays use desktop headless SwiftShader and are **not phone or Mac device evidence**. The first independent visual review recognized the suspension silhouette but could not establish stair safety from the two overview images alone.

## Validation and next owner

Final world SHA256 is `c662fb3bed3aaa0256fd7f6627b843fe37e6b9d940f62efdd11d68ee9dc4782a`. The bake took220.024s; the byte-exact check passed in217.147s, and Mountain serialization check passed. All9,504 walking-envelope samples and1,690 meeting-grid samples are clear. The final-bake runtime stair replay repeats266/266/52 steps, maximum goal error0.064m, with no browser errors. Bight's11 focused tests pass. A final standalone TypeScript check after the parity-test changes also passes (328.038s).

All24 Bight Region/Stop map captures across320/390/720/1100 and three themes have unclipped name/glyph labels. Each isolated-map run logged one resource404, retained in its report. Three final night air captures have no browser errors or pending districts; recorded calls are50/139/58. Neither these nor the other screenshots are physical-device evidence.

The corrected road comparison is0/13/83 before versus0/13/82 after, zero restarts, identical auditor hashes and no new finding location/severity. The original0/23/85 and0/23/88 reports remain. Width-aware probes and actual road ownership corrected false classifications; they did not repair ten MAJOR world defects. One old garden support warning disappears; Quay's existing minor edge drop measures0.92→0.93m. See `after/review/road-probes.md`.

The High quick gate is **failed**, not green:648.698s against300s,36 files attempted,530 passing assertions,8 failures and2 RPC timeout errors; the planned serial phase did not run. TypeScript, AI-surface and diff checks passed. Failures include overloaded timing/performance checks and two older action-mark parity assertions that treated passive bridge labels as buttons. Those contracts now retain exact financial-action parity, separately assert all3D bridge identities and exercise Bight's actual flat Stage label without dispatching an action. Independent review accepted that separation. All six affected files subsequently pass one at a time:121 tests, including the real flat Stage label and unchanged action parity. No timeout, performance threshold or test budget was increased. This does not retroactively turn the High gate into a pass; its serial phase and the complete105-file combined sweep remain owed.

The initial focused run's map clearance proof was repaired to measure actual rendered shadows and rail miters while retaining the original month-pad radius. The later light test was narrowed explicitly to new bridge-owned anchors; existing corridor lamps share its kind. The failed logs and subsequent corrections are retained. Dependency directories reuse the existing local Horizon checkout installation; a clean install was not performed.

Independent review fixes: cooperative bridge construction keeps all resident districts scheduled; bridge mount/eviction refreshes shadows; draw telemetry counts linework. Page L's landscape Boathouse count improves11→13 with Quay's new supports and unchanged camera; portrait remains5 and unaccepted.

The full cast is incomplete. The full per-PR105-file world/Journey/harbour sweep, a clean High quick gate, full mode/approach/flat-theme acceptance and whole-scene performance limits remain owed before a PR. Jonathan owns the exemplar look/device ride at the Phase2 stop; Codex owns remaining fixes and subsequent per-bridge/pair implementation. Production, external writes and deployment require separate authorization.

## Airport integration

The historical controller inventory above predates airport PR #576. Kestrel, Swift and Heron now exist on the integrated branch. Complete airport circuits are being rechecked against the bridge bake. Under-bridge plane passages remain unverified: the 11m Bight aperture is narrower than Heron's 14m wingspan and is not an all-aircraft route. A theme-switch review fixed bridge glow initialization at stable night; airport theme updates and both cleanup paths are retained. See [PR integration record](worksessions/2026-09-30-horizon-bridge-pr.md).
