# Applied Orchard checkpoint

D-MR22 is applied. Native export and its byte-exact check both exited0; the five focused Orchard checks passed. Export:696991 bytes,941 road samples,391 course points. The retained direct `pnpm exec tsc --noEmit` attempt aborted at the default2GB heap ceiling before producing a type verdict. The repository typecheck command supplies6GB and remains required; this resource failure is not a pass. Final bake, whole-route, full code check and captures are still owed.

The repository-configured6GB typecheck completes with one source diagnostic: roads.ts retains an unused ORCHARD_LANE_CENTRE import after the authored-lane split. That import will be removed before the final full check; this run exits2. No additional type diagnostic was reported.

After the Orchard source repair, the shared library/Awning generator check also exits0 and reproduces both saved products, including the exact unchanged Awning source hash f06b728d. The unused road import is removed without geometry changes; a fresh configured typecheck is pending.
