# Frozen v3 funicular Foot art subtraction review

Source-only and pure saved-JSON/math review. No world import, test runner, renderer, GPU or checkout edit. Candidate owner remains modes_probe. Frozen inputs: `/tmp/mountain-funicular-foot-candidate-proof-v3-serial/`; source provenance is its `frozen-source-hashes.json` and `results.json`.

## Findings

1. `funicularFootPath.ts:16–25,58–78`: planar subtraction leaves numerical fragments, and emission triangulates them without validating each fan triangle. `valid` checks only the entire polygon using a cancellation-prone global-coordinate shoelace area. At coordinates near1288/727, products are around936,000; their subtraction can make a zero/tiny polygon appear to have area≈1.1641532e−10. Valid enclosing polygons can also contain duplicate/collinear vertices, so a later fan can have zero area even when the parent is valid.

   The first reported buried witness is exactly the centroid of full-classic ribbon triangle28: vertices A,A,C, with A=[1288,55.472124976532236,727.2054930273373] repeated. Its true area is zero. Physical upward apron triangles876 and1134 both cover the witness at55.62486840546161 and both satisfy the art input winding filter. The higher face was not absent: the retained output is a degenerate fan fragment. Corresponding correct gravel triangles also exist over the shared apron edge.

2. The complete failure set has two geometric degeneracy classes, requiring both existing checks at fan emission:

   - Long, thin fragments have minimum altitude4.01354e−9..9.30666e−9 m, below the source's existing coordinate epsilon1e−8 m.
   - Four compact microscopic fans (full1339–1342) have true determinants1.94510e−11..2.59022e−11 and longest edges0.365–0.475 mm. Their altitude exceeds1e−8, so altitude-only cleanup is incomplete. Their true area determinant violates the source's existing `valid` threshold1e−10. Per-fan validation was missing.

   Applying **both existing geometric criteria**, using translated cross products, classifies691 of702 full bad-sample witnesses and767 of778 lite witnesses as invalid art fans. This is not a floor-gap tolerance change or a spatial mask. It does not permit any positive-area buried paving to remain. The original full656buried/46hover and lite758buried/20hover counts remain preserved in the frozen evidence.

3. Eleven remaining substantial hover witnesses per tier are real drawn/query disagreement at the station fringe, not a subtraction error. They lie on five triangles (full174,176,453–455; lite168,170,445–447), all inside the native station's actual planked rectangle but outside its queried1.6 m capsule. Existing art `mountain/art/transportArt.ts:100` draws halfWidth+0.05 and halfLength+0.05. Native exported station axis length6.3999999569 m, halfWidth1.6 m, top55.650854. These witness local positions have longitudinal5.986697..6.448857 and lateral1.601029..1.649420 m: inside the drawn rectangle[-.05,6.45]×[-1.65,1.65], outside the1.6 m capsule.

   Gravel is correctly4.90619–5 cm above the actual planks. `g.surface` instead selects apron55.620821..55.633634, producing apparent6.628–8.003 cm hover. Removing those triangles or lowering gravel to the query would put art inside the unchanged native planks. modes_probe's bounded repair is to let the new Horizon apron fill/support that exact existing plank fringe at55.650854 and begin its descent beyond the actual drawn rectangle. Native station art/query remains unchanged; no broad footprint expansion.

## Minimal corrections

- Compute signed polygon area by translating vertices to polygon[0] before cross products; keep the original1e−10 area criterion.
- Remove consecutive duplicate vertices during split/intersection cleanup.
- Validate every emitted fan separately: stable absolute cross>1e−10 **and** absolute cross/longestPlanEdge>existing eps1e−8. Check before both proof recording and builder emission. Do not hide invalid faces solely from the audit.
- Keep all eleven positive-area station-fringe cases in the art clearance regression; supply exact physical support from the placed Horizon repair, using the same actual station plank rectangle as the art placement. Do not alter station/native geometry, physical floor-gap bounds, or the all-theme test expectations.

Recommended focused pure tests: translation-invariant area at the real Horizon coordinates; duplicate-A,A,C fan rejection; the measured compact and needle fragments rejected with the existing predicates; a genuine small visible triangle preserved; all final emitted ribbon triangles satisfy both predicates; actual support-gap checks still include the measured eleven station-fringe coordinates.

## Reproduction artifacts

- `/tmp/mountain-funicular-art-subtract-review.py` and `...-witness.json`: first centroid, exact covering source triangles and winding.
- `/tmp/mountain-funicular-art-classify.py` and `...-classification.json`: every saved witness mapped to art triangle/sample, without runtime imports. The initial determinant buckets are deliberately preserved; determinant alone does not classify every needle.
- `/tmp/mountain-funicular-art-microscopic-fans.json`: the four compact fans showing why altitude-only cleanup is incomplete.
- `/tmp/mountain-funicular-art-station-witnesses.py` and `...-station-witnesses.json`: all eleven substantial hover cases transformed into the exact station frame, demonstrating drawn-rectangle inclusion and physical-capsule exclusion.

No claim that revised v4 art passes is made: owner must regenerate and rerun unchanged physical and all-theme art checks in root's serialized lane. These results do not resolve the separate88.2°face/continuous Year Walk problem, which modes_probe owns.

Final all-six-file classification: `/tmp/mountain-funicular-art-fan-verdict.py` and `.json` use both existing predicates. All saved witnesses matched. Full has185 invalid bad fans, total plan area4.30846e−9 m²; lite has202, total4.32346e−9 m². All three themes have identical saved art geometry within each tier. After geometric validity classification each retains exactly11 positive-area hover witnesses and zero positive-area buried witnesses. This arithmetic classification is not a rerun of revised generation.
