# Portable Mountain post-bake refinements

Copy this directory intact into durable evidence (or repository scripts). `reserve_refine.py`, `view_compare.py`, and `evidence_common.py` use only Python's standard library. No checkout-relative current working directory is assumed. Do not rerun into an existing output directory. Both comparison tools pin integrated-main **1cf76c551e6f49124b6257162bc4d36ca18d7bd1**, never HEAD. They hash exact current readable/compressed world, terrain, complete source scope and helper sources; record HEAD plus dirty status; compare readable/served gzip definitions semantically; and preserve diagnostic errors.

Root executes serially after the final bake, with unique output names:

```sh
python3 scripts/horizon/mountain-proof/reserve_refine.py --root "$PWD" --out /tmp/mountain-final-reserve-refinement-RUN_ID
python3 scripts/horizon/mountain-proof/view_compare.py --root "$PWD" --out /tmp/mountain-final-view-refinement-RUN_ID
```

Replace RUN_ID before executing. Exit2 means retained current overlap/view failures, including identical baseline failures. It is not a process crash and not permission to waive them. Exit1 means an evidence error, retained in error.json. Reserve refinement is intentionally limited to the two prior V03 triangle/AABB suspects against plot.terraces.1; it does not replace the full reserve/envelope audit. View comparison retains entire before/after proofs, camera values, diagnostics, subjects and portrait metrics, including page L. It is saved bake-ray evidence, not runtime furniture occlusion acceptance.

# Separate authored-page capture support

The applied `capture-mountain-finish.mjs --authored-pages` support adds a read-only runtime `corridorRenderStatus()` diagnostic. A–L use existing runtime `shot(id)` with every authored eye/target/FOV/aspect/portrait value unchanged. The script verifies served camera definitions against the local bake, records actual runtime lens, exact image SHA256, source hashes and proof metadata, and waits for corridor furniture as well as terrain/region readiness. Failures are retained and make the process nonzero.

From the worktree after the final bake and starting the existing review server:

```sh
HORIZON_REVIEW_URL=http://127.0.0.1:5209 TIERS=full,lite THEMES=classic,taylor,newfoundland TIMES=day,night ORIENTATIONS=landscape,portrait node scripts/horizon/capture-mountain-finish.mjs /tmp/mountain-authored-pages-RUN_ID --authored-pages
```

Default authored matrix:12pages ×2orientations ×2tiers ×3themes ×2times =288 actual renders. Acceptance viewports1440×900 and390×844. Existing matrix and join modes remain separate. Parent directory must exist; output directory must not. Do not pre-create the output leaf. Headless SwiftShader renders remain review evidence, not device acceptance. Screenshots do not automatically establish subject visibility; inspect them alongside retained numeric view failures. No page L/portrait waiver is introduced.

Validation performed here: Python AST parse and Node syntax-only parse. Neither post-bake script nor capture/browser/runtime was executed.

# Actual corridor draw counts

`renderer-audit.mjs` and its adjacent `renderer-audit.page.ts` preserve the measured browser harness used during rendering optimization. The world and terrain bytes are served directly from the frozen local files. Its three exact-source adapters exclude eager native generators; the actual corridor builders, geometry, materials and hooks remain. One resident district is isolated, with both global road-light draws charged. This is the existing corridor base-pass budget, not whole-scene, shadow-pass or physical-device performance.

```sh
node scripts/horizon/mountain-proof/renderer-audit.mjs --root "$PWD" --out /tmp/mountain-final-renderer-RUN_ID --districts lakeside,prow,crown,hollow --corridors all --views docs/horizon/evidence/mountain-road/after/final/captures/captures.json --capacity docs/horizon/evidence/mountain-road/after/final/routes/budget-all.json
```

Default coverage is all three themes, both tiers, four seasons and day/night for the requested districts. Retain the complete `frames.ndjson` and `summary.json`. A completed measurement with an over-budget sample, incomplete coverage or mismatched reference assets exits2 with `FAILURES_RETAINED`; execution errors exit1. A passing finite sample set remains narrower than an exhaustive visibility bound. Source and asset changes invalidate the attempt. Output directories must be fresh.
