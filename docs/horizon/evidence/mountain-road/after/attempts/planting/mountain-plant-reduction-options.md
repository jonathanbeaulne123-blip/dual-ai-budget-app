# Small, coherent Mountain planting reductions

Source-only inventory of current baked world and exported native tree crowns; no runtime geometry builder, bake, browser or tests. Full item-level evidence and hashes are in `/tmp/mountain-plant-reduction-options.json`. Prior renderer-budget files are explicitly older than the current Foot repair and lighting handoff.

## Recommended smallest useful change

Remove the **two whole additional pine groves at M-top and M6** from `buildMountainCorridor`'s returned planting, preserving native forest, all fixtures/stops and all remaining theme shapes. Select these by the source reach IDs (`M-top`, `M6`), not incidental sequential group numbering. Do not alter the common planner or other corridors.

| New native-road grove | Existing native forest evidence | Full triangles saved | Lite triangles saved |
|---|---|---:|---:|
| M-top, six pines, group `.3`, centre H[1364.89,150.15,458.18] | Nearest native root4.25–9.07m; each new tree has6–11 native trees within25m |876|0|
| M6, four pines, group `.2`, centre H[1241.71,110.02,556.31] | Nearest native root13.22–18.30m; each has7–11 native trees within25m |584|240|
| **Together, all in Crown** | Leaves native scene and road openings unchanged |**1,460**|**240**|

These are neighborhood-redundancy measurements, not assertions of overlapping crowns or a rendered visual pass. The upper grove is the strongest first choice: three existing native roots are within15m of each proposed additional pine. The M6 group is a second framing layer next to a more established forest. Removing whole groves preserves clearings and authored silhouettes instead of thinning them into isolated trees. Their native forest remains rendered in all three themes.

Current source renders a straight pine as80body +56shell +10contact triangles on full. Lite retains80body; Mountain's additional contact shadows are already omitted. Existing lite policy already omits odd-index Mountain groves, hence no further lite saving for M-top. M6 keeps3of4pines on lite, hence240triangles. These figures follow actual prior runtime geometry-layer counts and exact current lite selection, unchanged across the three themes; a new runtime count still must confirm final totals.

Optional stronger subtraction: omit all four new native-road groves (20pines), relying entirely on existing native planting. Saves2,920full /560lite in total: Crown2,190/320, Lakeside292/80, Prow438/160. This is less visually well justified: the M4 lower approach has only0–2native trees within25m and M5 has0–1. Prefer preserving those authored accents unless the final budget demonstrates that they must go.

## Preserve Stillwater and V03 framing

Stillwater's two six-birch groves are not redundant with native forest. The eastern group (Lakeside, centre H[1239.99,54.04,736.15]) is37.21–46.34m from its nearest native roots; the western group (Hollow, H[991.32,41.79,683.79]) is175.92–183.50m away. Neither has a native tree within25m. Each contributes1,644full /616lite triangles (6full,4lite birches), with existing themed geometry preserved. Removing them would save triangles but eliminate new-link framing, so it is a fallback subtraction, not a native-forest duplication fix.

V03's12plants are inherited and exactly the same item count as the saved baseline. Its groves also have no native trees within25m. Do not remove these under a claim that the new native forest replaces them.

## Draw-call causes and hard lower bound

At Lakeside the current baked source contains:

- VG: one pine, one birch, two round trees, four shrubs.
- V03: one pine and two heath items.
- Stillwater: six additional birches.
- Mountain native road: two additional pines.

The existing VG plants already require three tree-body layers, three full-only shell layers, bush and shared contact: **8full/5lite layers**. V03 heath adds one: **9full/6lite**. Deleting every new Stillwater/Mountain plant does not empty any of those layers. It saves **zero combined plant draw calls**. This is why item reductions alone cannot close the Lakeside draw-call gate.

The older all-corridor budget has Lakeside8furniture draws +9/6plant draws =17full/14lite before shared lighting. The saved inherited baseline already had7furniture +9/6plants =16full/13lite. Current lighting now correctly removes the duplicate art halo but owns **two shared night draws**, not zero. Conservatively attributing both shared draws gives19full/16lite for the prior current layer inventory; removing all new plant items still leaves that layer count. These are source/layer arithmetic, not final runtime/GPU measurements.

Crown likewise has12inherited V01pines (plus33heath), so removing all new native pine groups does not remove a pine body/shell/contact layer. The recommended subtraction therefore gives real triangle savings, not a claimed draw-call saving.

There is **no source-item subtraction confined to the new Mountain/Stillwater additions that can make an already-over-budget inherited Lakeside district pass12calls**, while preserving all strategic fixtures and unrelated corridors. This is an identified constraint, not a waiver: do not report that gate passed, and do not silently remove inherited VG/V01 diversity or change STYLE. The final combined budget must retain the failing value if it remains. The larger saved landing/scholars/flats overruns similarly contain no new Mountain/Stillwater vegetation in the current source; removing Mountain groves cannot resolve them.

## Relation to Foot geometry

The pending1m Foot repair must be counted separately. The quoted18,980triangles for the0.5m candidate vastly exceeds the1,460full recommended vegetation saving. No supported-floor mesh, floor query, source path, bridge/rail, or collision fidelity is traded away in this proposal. The older Crown full22,712 / lite7,920–9,760 reports exclude today's new lighting composition and pending Foot mesh, so subtracting grove savings from them is not final acceptance evidence.

No checkout changes were made. Suggested implementation is a narrow source filter on only the Mountain corridor's final planting list, followed by the normal source export/bake and actual all-theme budget script after root's geometry queue is free.
