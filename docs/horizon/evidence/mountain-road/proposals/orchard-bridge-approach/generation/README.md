# Orchard b0 proposal: reproducible geometry

This review artifact contains the exact saved source input, clipping algorithm, constrained solver, and expected generated output for the unapplied Orchard proposal. It uses Python's standard library only. It reads no live TypeScript and writes only to the requested empty output directory.

Run `python3 regenerate.py /tmp/orchard-reproduced` from any directory. The runner verifies every reviewed input/script hash, recomputes clipping and conforming topology, fits the bridge's flat cross-sections, reconstructs the source JSON, and requires exact parsed-JSON equality with the reviewed geometry. Mesh diagnostic elapsed time is intentionally not part of the generated product.

The 26-row replacement scope, first bridge-art row 8, original row 26 boundary, main-source witness rows 168–218, 11.999% longitudinal fit target and 25% facet ceiling are explicit approved-choice inputs in this study. The last value is transverse slope too, not a claim of a 12% surface in every direction. It remains a proposed native change requiring written approval and ordinary movement proof.

The source snapshot is an exact export of the original road, original Orchard lane and their renderer sweep rows. Main road rows and all XY/width/normal values are fixed. `clip.py` partitions the Orchard footprint against immutable main-road triangles; overlap heights are fixed to those actual planes. `fit.py` first splits all vertex-on-edge T-junctions, fixes main overlap and row26, binds bridge rows8–25 to flat row-height variables, and projects the remaining constraints. It does not move the source road or introduce a new span. Both full/lite renderers, queries, guards, ground cap and unchanged scenery require the separate proposal proofs.

A future runtime error saying “Regenerate Orchard junction” is not permission to silently run this snapshot against changed geometry. Export and review the new real source rows first, compare immutable ownership, then rerun the same clipping/constraint stages with an explicitly reviewed replacement source snapshot and scope. Keep the original input and this complete artifact directory with review evidence. Re-export must not use the already modified Orchard centre as its authored baseline.

Syntax was checked without executing the solver in the current serialized runtime lane. Root should execute the reproduction once before treating the generator as validated. No checkout edits are performed by this artifact.
