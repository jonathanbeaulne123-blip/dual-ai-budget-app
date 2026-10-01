# Awning width-contract proposal

Patch: `/tmp/mountain-branch-width.patch`.
Exact preimage hashes: `BASE.json` beside this file. The checkout remains untouched. `git apply --check` passed against the current root source; no test, world import, TypeScript compiler, bake or browser was run.

The approved generated rows are the authority for the1.5→1.2m half-width taper. `SkillBranch.halfWidth=1.5` is a conservative envelope, not the local full-width shape. The existing generic branch test uses a segment-normal constant-width capsule, which includes the eight reported points outside those rows. This proposal changes the consumer to sample the retained row polygon, without changing any generated coordinate or the protected first nine rows/rail.

Changes:

1. `branchLandings.ts`: add `landingPointAt(rows,band,along,across)`, a barycentric point on the existing a-b-c / a-c-d triangles, and `landingHalfWidthAt` derived from the same coordinates. Invalid band/parameter input throws. No inflation or outside-polygon fallback is added.
2. `course.ts`: document the conservative envelope versus exact rows. Include `landingRows` in `MOUNTAIN_RACE_REVISION`'s geometry hash so a width/crossfall change cannot silently reuse the same race revision. This deliberately changes race metadata, not geometry.
3. `hearth-mountain.test.ts`: retain all branches, bands, five longitudinal stations, the same95%-of-half-width edge stations, contacts, bounds and0.3m limit. Query actual row points; also keep the0.3m floor-to-centreline height/crossfall check explicitly. Nothing is skipped. A remaining failure stays a failure.
4. `mountain-landings.test.ts`: use the same exact triangle stations for the existing awning return sweep, preserve its0.01m native/Horizon support error limit and all contact checks, and independently compare triangle membership/height.
5. `mountain-native-landings-audit.mjs`: retain existing pursuit inputs, route points and failure thresholds. Add row-width metadata and explicitly label legacy `halfWidth` as the conservative audit corridor envelope. The width profile excludes native road run-ins/runouts and carries its source row indices.
6. New small `mountain-branch-width.test.ts`: checks a hand-computed non-planar cell's diagonal, protected3m rail-band width and exact taper values, plus the retained outside-polygon failure witness and a valid nearby edge station. It imports only the generated JSON and pure helper, not the world.

The actual minimum row half-width is1.1992777993598196m at an interpolated row; the coarse taper endpoints are exactly1.2m. That small difference comes from interpolating rotating edge positions. The proposal reports it and changes no geometry or acceptance threshold.

## Every branch halfWidth consumer traced

| Consumer | Meaning and disposition |
|---|---|
| `mountain/course.ts:66–97` authored branch constructor | Uses the authored constant to build the original source and generate rows. Preserve. Generated return already replaces those rows; no generator changes proposed. |
| `mountain/art/branchArt.ts:16–46,68` | Non-rail top/sides/underside and support anchors already use the actual rows. Preserve geometry and materials. Protected rail specialization at56–67 remains its original rail/catwalk rendering; this proposal does not claim a new visual acceptance of that unchanged skill feature. |
| `mountain/surfaces.ts:24,37,55–64,88–94,101–108,112–119,128–130` | Nominal width provides broad-phase bounds; exact landingSample membership and y/gradient provide floor/ceiling/contact authority. Branch supports already use actual row edges. Keep these consumers and their tolerances unchanged. |
| `horizon/regions/mountainV2/geography.ts:105,186–190,250,275` | Conservative spatial buckets followed by the same exact row-deck queries. No new false floor or looser mouth/ceiling handling needed. |
| `mountain/planting.ts:38` | Conservative keep-out width+1; retaining the maximum keeps plants away from the entire branch. Do not shrink keep-outs just because the return narrows. |
| `mountain/artGeometry.ts:30,68` | Conservative fixture/pavilion exclusions. Preserve maximum envelope. |
| `mountain/definition.ts:87` | Coarse mountain containment with0.3m padding. It does not create a supporting floor; preserve. |
| `body/geography.ts:372` and `skate/world/field.ts:399` | Expanded invisible trick-zone envelopes (+2m), not physical floor widths. Preserve authored physics triggers. |
| `mountain/roads.ts:68–73,79–82` | Separate approved road-edge opening metadata already gives the awning arrival1.2m. Preserve. |
| `scripts/horizon/dump-mountain-v2.mjs:46` → `land/mountainV2/planning.ts:24` | Conservative native-surface keep-out inventory used by planning. It is not a support sampler; preserving the larger envelope avoids moving fixtures or requiring a fresh placement choice. |
| `course.ts:181–184` race revision | Previously hashed centreline and nominal width only. Proposed row-aware hash covers actual width/crossfall too. |
| `mountain-native-landings-audit.mjs:41–46,83` | Nominal width bounds an observational pursuit corridor. Proposed explicit local-width metadata removes ambiguity; controls/thresholds unchanged. It does not newly claim full-width driving acceptance. |
| `generate-mountain-landings.mjs:41`, `awning-return-input.mjs:11–20`, solvers | Offline input and row generation. Approved taper and first nine rows remain untouched. The solver already receives halfWidth1.2 for return constraints, while the runtime maximum is1.5; no regenerated geometry requested. |
| `hearth-mountain.test.ts:348–359`, `mountain-landings.test.ts:143–151` | These require actual support width; proposed shared row-point helper replaces the misleading capsule sample. |
| `hearth-mountain-art.test.ts:18,33` | Existing keep-out/pillar-envelope checks, not the floor-width oracle. Preserve conservative checks. |

Other branch readers use centreline/entry/exit/segment or rail data, not halfWidth. They are outside this metadata fix.

Suggested root verification, serially after the active run: the new pure-data test, `hearth-mountain.test.ts`, and `mountain-landings.test.ts`; then the existing focused native branch/controller evidence as already planned. Confirm the new race revision and inspect any remaining protected-entry, crossfall, contact or height failure rather than relaxing it. `scripts/horizon/mountain-native-landings-audit.mjs` is metadata-only in this proposal; do not rerun solely to overwrite preserved earlier evidence.
