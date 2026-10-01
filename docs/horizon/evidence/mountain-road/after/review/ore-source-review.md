# Independent Ore junction source review

Verdict: no actionable functional regression found in the bounded source review. This is a source-review result, not a fresh test, movement, bake, or visual acceptance result.

Reviewed the working tree at HEAD `df77030298d5ff960d2eeaa5eb62c8558008694b`, including uncommitted/untracked Ore source, against integrated main `1cf76c551e6f49124b6257162bc4d36ca18d7bd1`. Reviewer did not author this Ore repair. No checkout files were changed, and no test, browser, build, terrain import, or movement probe was run.

## Scope and concrete checks

- `src/harbour/horizon/land/underground/oreRoad.ts`: crossed the new station apron polygon subtraction, explicit facet clipping, upward-face winding, paired bottom vertices, side closure, portal-frame placement, lintel lift, retained upper tube, final floor/roof replacement, rail bearings, retaining face and raster cap against their callers and geometry contracts.
- `src/harbour/horizon/land/mountainV2/roadSource.ts`: reads exported road rows and uses the same six authored transverse bands and diagonals as the runtime region's exact road. It does not import native terrain construction. Its source index is lazy; the existing joins consumer deliberately resolves it during land generation.
- `src/harbour/horizon/land/underground/build.ts:112-123,167-184`: the Ore controls/heights/interpolation, rail offsets, rail dimensions and route endpoint are unchanged from integrated main. The manifest JSON is unchanged. The junction code operates after the existing room-opening pass; the affected tube chunks still use the eight-vertex prism layout consumed by the new clipping code. The final repair adds Horizon solids and changes Horizon lining, not the native road or rail path.
- `src/harbour/horizon/land/mountainV2/joins.ts:7-9`: shared exact road access replaces duplicate source construction; no Ore/native road mutation in this call site.
- `src/harbour/horizon/land/terrain/index.ts:566-625` and `oreRoad.ts:229-250`: the additional cap only lowers the Horizon lattice, requires both named beds, and is bounded to the south mouth plus the existing full/lite raster margin. The nominal mouth box is exactly the south portal outline plus the region's six-metre mouth exclusion. The road itself continues to be queried as a drawn deck across the mouth.
- Read the runtime highest-floor and underside selection in `runtime/geography.ts:91-128`, native-mouth handling in `regions/mountainV2/geography.ts:182-236`, and `structures/mesh.ts:26-49` / `structures/build.ts:556-572` to check the solids are consumed as actual drawn walkable faces rather than special invisible surface candidates.

## Regression test assessment

`test/horizon-ore-road-junction.test.ts` uses the actual underground builder and region provider; its tests inspect physical solids and queried highest faces. It checks the closed crossing's edges, the 28m extent, every upward crossing facet's 12% grade, the two former floor-lip witnesses, the mixed-apron witness, 5m road clearance, 3.2m Ore clearance, the retained upper tube, retaining support and full/lite centimetre-encoded terrain. These are substantive checks. I found no relaxed movement/clearance threshold introduced by this test; the 1e-7/1e-8 terms are numerical comparison allowances.

Coverage limits, not demonstrated current defects:

1. Lines 81-85 reconstruct expected rails from the same current `ore.points`. This catches mesh mutation but would not independently catch a future edit to all rail controls/heights. Today's unchanged source/manifest diff establishes route preservation. If a future regression fixture is desired, pin the baseline control points/heights or their canonical hash in addition to the mesh reconstruction; do not weaken the current checks.
2. Clearance samples cover the centre and selected lateral positions and the final approach. They are not an analytic all-points proof of the complete world, nor a substitute for actual body/cart traversal. The dedicated fixture uses a flat synthetic terrain field plus the region; the separate lattice test uses a flat high field. A final baked-world movement run remains necessary for neighbouring-world interactions.
3. No final source/baked-asset parity, renderer image, GPU budget, terrain-support depth, or controller recovery was independently remeasured here. No previously generated author handoff or pass claim was used as proof of runtime success.
4. `orePortalFrame` assumes the named mountain road exists. The current production build always adds it before `buildUnderground`, and the fixture also supplies it. I found no reachable caller lacking that bed, so this is not reported as a regression.

## Reviewed file hashes (SHA-256)

- `oreRoad.ts`: `c84dcb23b2ded6de0bd2a2ed58fd50a198cd84a8e84e97c1c1aceab557de6d9a`
- `roadSource.ts`: `bfeae3956aca1b4533657e2622baabcc68444e2460e33484ef8331ebceb28876`
- `underground/build.ts`: `8a09c636b7026ee3f2eef6f337f3742f027bf563e63300c373b62dbc96ee858e`
- `mountainV2/joins.ts`: `5fd2c6296068e5a8fbedd78f2bf1d418f3f9759d218e4e49333a4b79d2e84856`
- `terrain/index.ts`: `5fd5c8225b6d70ad33f6bf611ebf297cc8f34b4abd9db89bcf9304511b08f888`
- `horizon-ore-road-junction.test.ts`: `2afebf101860a7c1e4535984575e0ce6c9a6de09cc3fb2820ccd17ca9707b07b`
