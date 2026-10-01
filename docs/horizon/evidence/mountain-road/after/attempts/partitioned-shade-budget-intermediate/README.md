# Partitioned shade intermediate budget

The32 Newfoundland/lite cases complete8032 actual SwiftShader frames on unchanged recorded source and intermediate world/terrain assets. All cases pass the unchanged12calls/10000triangles limits, with0renderer errors and no source drift. District peaks: Lakeside11calls/8186triangles, Prow9/9384, Crown11/9636, Hollow8/9155. The14 focused tests pass.

Only definitely culled faces are omitted from each original BackSide/FrontSide pass; ambiguous faces remain in both original-order lists. No authored fixture/plant, shader color, geometry vertex, support tolerance or budget is removed or loosened. Separate pixel parity, actual CPU cost, final-world full matrix and device performance remain unverified at this checkpoint.

Configured typechecking found five callback-group declaration errors: the installed types call the r185 geometry-group callback argument a scene Group. A narrow boundary type cast is pending after frozen GPU parity. Actual runtime source/tests inspect the installed GeometryGroup reference behavior; no rendering behavior change is needed for this type-only correction.
