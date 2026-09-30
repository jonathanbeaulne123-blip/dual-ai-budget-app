# Validation record

Local uncommitted build, base e77309e. No PR or deployment.

- Bake7 and byte-exact check pass; Mountain check passes.
- Final world: c662fb3bed3aaa0256fd7f6627b843fe37e6b9d940f62efdd11d68ee9dc4782a.
- Final standalone type check passes in328.038s.
- Bight11 tests pass. All six affected gate files pass sequentially:121 tests. Original limits unchanged.
- High gate remains FAILED:648.698s/300s,530 passing assertions,8 failures,2 RPC errors. Its serial phase did not run. Repairs/retries do not erase this failed gate.
- Road corrected before0/13/83, after0/13/82, zero restarts, no new finding location/severity; see the adjacent road-corrected comparison and review/road-probes.md for classification changes and the existing Quay0.01m drop change.
- Stair ascent/descent/meeting pass on the final bake. Four bounded glider runs pass.
-24 map captures fit,3 final night captures complete. Headless SwiftShader only; no device acceptance.
- Full103-file per-PR sweep, complete mode/course/approach proof and whole-scene performance acceptance remain owed.

Failed and timed-out logs are preserved alongside successful retries. Source-state.json hashes the final source/test/script diff and new files. It does not make the old High gate a final-state pass.
