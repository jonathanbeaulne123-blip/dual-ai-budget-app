# Approved shared Dam entry repair — proposal, not applied

Root alone writes checkout. This proposal uses existing approval for shared Dam entry/exit landings, not the pending road-frame or awning-entry changes. It does not reroute the promenade or change the western stairs.

Files:
- `/tmp/mountain-dam-entry.patch`: new native `damEntry.ts` plus one conditional call from `course.ts`.
- `/tmp/mountain-dam-entry-tests.patch`: three scoped tests appended to existing shared landing tests.
- `/tmp/dam-entry-static-proof.json`: initial snapshot fit.
- `/tmp/dam-entry-live-proof.mjs`: prepared live composed-world probe; run only on root's coordinated slot. Results will be `/tmp/dam-entry-live-proof.json`.

Both patches pass `git apply --check`. No test suite, bake, browser or typecheck has run for this proposal.

The helper receives the actual native road's samples from the already-imported `MOUNTAIN_ROAD_LINE`; its only imports are native `math.ts` and `branchLandings.ts`. It has no Horizon, exported-data or terrain-bake dependency and adds no import cycle. It derives the six existing swept road bands, follows their exact triangles across the mouth, then blends back into the authored ramp before row13. Projecting the edge triangle plane is used only outside the actual road footprint to avoid a hard crossfall break. The road itself never changes.

Plan coordinates and width are unchanged everywhere. Entry vertex heights change only on rows0–12; source endpoint center heights remain authored. Rows13 onward are preserved, including the first rail beginning at18, crest, all internals, approved exit and its endpoint. Shared branchArt and native/Horizon surface queries already consume these same landingRows. Existing2cm branch paint lift stays unchanged.

Initial snapshot results (from the earlier exact native export, not yet current runtime acceptance):
- Road/deck triangle mismatch: before0.335099m; candidate0.009415m across2509 overlap samples.
- Maximum vertex displacement0.346192m, vertical only.
- Maximum modified entry triangle grade12.467913%, below the existing40% branch-triangle constraint. This does not change or waive the separate main-road12% design requirement.
- Rows13 onward and every XY coordinate exactly preserved.

The live probe compares current unmodified source with the candidate in a local module graph, using the same newly baked world. It checks0.1m road-row fractions at center and±2m over18m around the join, both contact travel directions, native floor with/without this branch, actual composed Horizon floor, off-road native terrain clearance, and unchanged road/other-branch hashes. It will retain any pre-existing baseline discrepancy rather than classify it as repaired.

## Final live proof — revised candidate

`/tmp/dam-entry-live-proof.json`, generated2026-09-30T14:51:10Z, uses merged baked worldSHA256 `09d23d7f69ba638b78277afb6ecf804e358bb3a2d2e452fb67c181286d403bae` and terrainSHA256 `6fa7fbb5114e7c8ac55bc5f304e94461b6f1a62d54446daf0a1fded8b42fbb18`. The before/candidate module graphs use identical actual road and all other branch geometry hashes.

The initial lowering exposed1.17cm of native ground just outside the road. The final patch includes a20mm crown outside the road (rows5–8, easing to zero by13), preserving the lane overlap. Final dense snapshot road-overlap maximum is0.016898m (2,509 samples). Final live whole-mouth sampled minimum exterior clearance is **+0.008311m**, maximum vertex displacement **0.326191m**, maximum modified entry triangle grade **12.467913%**. No contact in either travel direction at center/±2m. Rail, points13 onward and rows13 onward are exactly unchanged.

| Probe | Before | Final candidate |
|---|---:|---:|
| Native center largest adjacent step |0.120410m|0.014796m|
| Native+2m largest adjacent step |0.258347m|0.027374m|
| Horizon+2m largest adjacent step |0.264024m|0.015110m|
| Horizon maximum lane floor error from actual road triangles |0.250311m|0.007673m|
| Native−2m largest adjacent step |0.103015m|0.103015m|

**Retained native baseline:** the −2m jump at native station815.331879 comes from the unchanged coarse native road nearest-segment selector; both source graphs and the road-only control have exactly the same result. The actual swept road is continuous there (Horizon max adjacent step2.43cm). This patch cannot close that separate protected-road limitation. The native branch differs smoothly by at most3.394cm from that coarse native selector while agreeing with actual triangles within0.768cm on the measured lanes. Therefore the regression preserves the road-only control and rejects any new>6cm adjacent step instead of using an invented2cm absolute difference from a knowingly coarse plane. The physical triangle mismatch remains separately bounded at2cm. No controller or existing threshold changes are made.

The proposed three focused tests check immutable XY/protected rows/endpoints, positive exterior clearance and actual shared triangle sampling, and both-direction contacts/adjacent steps at center±2m. They have **not yet run as Vitest**; root should apply both patches and run only the `shared dam entry landing` describe before the final broader checks. The standalone live geometry probe completed; it is not controller completion, a rendered screenshot or device acceptance. First candidate failure retained in `/tmp/dam-entry-live-proof-v1.json`.

The final test is narrower than a general baseline allowance: it exempts exactly the−2m station pair815.231214656→815.331878905, requires its measured0.103014672m step and exact equality with road-only floors, and separately pins the two XZ/height witnesses to `mountain-road`. Every other native adjacent step>6cm fails. This leaves the inherited native defect visible without turning baseline status into a blanket exclusion.
