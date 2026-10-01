# Shared Mountain road crossing proof — independent source review

Reviewed `/tmp/mountain-shared-source-crossings.patch` against the current crossing builder, junction resolver, source course construction/export and region-carried beds. Also reviewed `/tmp/mountain-underground-test-scope.patch`. Read-only; no imports, tests, bake, or checkout writes.

## Verdict

No concrete functional blocker found in the shared-source proposal. It fixes a representation mismatch using source correspondence rather than a route-name exemption. Root reports147 artificial pads and current pair maximum height difference0.005546m; those measurements were not independently rerun here.

## Source ownership and exclusion boundaries

- Native `src/harbour/mountain/course.ts:18–19` constructs MOUNTAIN_ROAD from every third full road sample, including both endpoints; line54 reverses that sequence before appending the town lane. The new monotonically descending source-index chain, maximum stride3 and Summit-start requirement match this construction. Stopping once expected reaches0 excludes the subsequent town lane.
- `scripts/horizon/dump-mountain-v2.mjs:22–25,36,50` exports course points at centimetre precision and road sample XYZ at micron precision. The0.005001 coordinate box permits only that source quantization; multiple possible source vertices fail closed. It does not choose an arbitrary nearest road segment.
- The entire working road array must match the exported full source array within1e-7, including point count. Each claimed course segment must have both working endpoints equal to the corresponding source-course endpoints within1e-7. A moved point rejects both incident ownership segments; unchanged segments farther along may remain valid. Insertions/reordering cannot acquire ownership merely by retaining the route name.
- A physical intersection only receives sharedSource when its course segment index and owner segment index match that source mapping. The inclusive owner range [b,a−1] is correct for the reversed course edge between road vertices a and b. Another switchback does not fall into that range even if nearby in plan or at a similar height.
- The finite |heightDifference|≤0.02 gate is an additional intersection-level proof bound. It changes no controller step, collision, grade, clearance, or general crossing tolerance. A21mm/NaN height mismatch fails this ownership proof; existing ordinary crossing rules continue to apply.
- `computeIntersections`, raw source coordinates, canonical aliases, and overlap collapse are not modified. The final rawIntersections field still invokes the original exact segment computation. New sharedSource metadata changes only how the corresponding intersections are resolved.
- New resolver skips apply only to a row carrying sharedSource. They suppress artificial pads/markers and regrading for that proven same-source row. Unrelated intersections of the same named routes remain ordinary rows, including the explicit negative fixture. Existing collinear sharedStretch handling remains unchanged; it is not newly widened by this proposal.

## Preservation and test strength

The supplied fixture verifies all current pair proofs are sharedStretch/built, every non-overlap hit has source ownership, raw intersections remain present, resolver emits no pads/solids, and both input point arrays remain exact. Separate negatives cover changed course coordinates, changed road coordinates, an unrelated owner, a wrong owner segment, a height beyond2cm, and same-name arbitrary crossing geometry.

The fixture is deliberately the two-route source pair, not the full world: it does not prove other crossings cannot alter the routes later in a full build. Region-carried source vertices remain protected through existing terrainExclusions/structure-profile pins (`mountainV2/beds.ts:38–44`, `junctions.ts:249`) and this patch does not weaken those pins. Root should still compare final baked S1 native prefix and all941 road points against the export and retain the full crossing inventory after regeneration. In particular, classify a genuinely changed source point as unowned rather than widening the1e-7 identity test to make the pair fixture pass.

No correction patch recommended. Optional cheap test hardening, if desired: exercise `sharedRoadSegmentAt` with NaN and −0.021, and verify changing course Y rejects both incident segment claims. The current implementation already handles those cases by inspection; these are coverage additions, not identified defects.

## Underground fixture assessment

The scoped negative fixture is appropriate. Its asserted contract is missing rock cover, so direct `buildUnderground(emptyCuts,()=>0)` creates the underground routes/rooms and reaches the real routeCover diagnostic (`underground/build.ts:185–192`). It no longer demands that every unrelated fixed-endpoint world road be constructible over a zero-height world. The normal positive tests still use `buildLandCuts(baseHeight)`.

The Stillwater strict slope throws remain production code in `land/mountainV2/stillwater.ts:43,70`; the test patch does not catch or suppress them, raise limits, or label a flattened Stillwater route valid. The new afterEach real setImmediate yield has the previously reviewed IPC purpose and leaves test deadlines/assertions intact. As with the structures proposal, it only yields between tests and cannot preempt one single synchronous build exceeding the independent60s RPC deadline.

Execution remains for root's serialized slot. This review is source evidence, not a pass claim for the new tests or bake.

## Revised endpoint proposal review

Root's pure JSON audit found11 non-overlap endpoint hits that the initial exact-span proposal did not classify. Reviewed modes_probe's revised `/tmp/mountain-test-triage/sharedRoad.ts` and the replaced `/tmp/mountain-shared-source-crossings.patch`. This supplements the initial review: the original proposal was bounded but incomplete; no test pass was claimed.

The revision adds explicit start-touch/end-touch/foot-touch proofs, retaining actual hit segment, source span, and both endpoint XYZ witnesses. An adjacent owner segment is eligible only at its corresponding source interval endpoint and only if the hit lies inside BOTH the centimetre-course and micron-road ±0.005001m per-axis plan boxes. The height bound remains2cm. The Foot continuation is eligible only for segment immediately after an existing final shared span ending at owner vertex0, only against road segment0 and only inside those Foot endpoint boxes. It creates no town-lane span. Because the final valid span already verifies the Foot vertex, a changed Foot position removes this proof; changing the far town-lane endpoint cannot make its interior shared.

Independent pure JSON calculation saved in `/tmp/mountain-shared-source-endpoint-independent.json`: all11 saved misses pass these exact boxes; largest error across either box and plan axis is0.004278182m. The other agent's test additionally rejects shifted hits, later continuation segments and missing final source span. No expanded ±1 owner range or wrong-switchback exemption was found. No TypeScript test/world execution was performed.
