# Shared production prejoin source — narrow refactor proposal

Ready patch: `shared-source.patch` (three files). Complete proposed source under `source/`; base/proposal hashes in `manifest.json`. `verification.json` records source-text checks. Apply-check passes. No checkout edits, imports, test execution, compilation, or geometry optimizations were performed.

## Change

- New `scripts/horizon/bake-source.ts` exports synchronous `buildHorizonPrejoinSource()` returning `{cuts,buffer,field,ground,corridors,groundBeds,foundations}`. Its construction body is copied verbatim from current bake-entry, from buildLandCuts through settleCorridors. No stage order, constants, callbacks, numerical operations or source geometry changes.
- `scripts/horizon/bake-entry.ts` calls that builder, then retains fitFootLaneJoin, createLandWorld, prepareLiteWorld and artifact results exactly as before. Journey extraction is unchanged.
- `test/horizon-foot-lane-apron.test.ts` builds this real production source once. It removes the selective served-prism/local-YearWalk/S1 reconstruction. The original route-point and unrelated-solid snapshots are taken from actual pre-fit state immediately before fitting. Final region and geography use those full production cuts.

The actual pre-corridor ground closure is returned directly. It is created before settleCorridors appends sidewalk beds, exactly as before; no reconstruction from later mutated cuts and no new snapshot artifact are introduced.

## Gates preserved

Every existing test body, from the first lip witness to the final streaming-host invariant, is byte-for-byte unchanged. This includes fourteen ordinary walks,22 continuous width sweeps,26 lip neighborhoods,6 art variants, meaningful route/untouched-solids/idempotency checks, source/served face equality, manifold and renderOrigin checks, and root's `(sourceTop&&n[1]!<1e-8)` Float32 top-flip guard. No thresholds changed.

One extra assertion checks SHA-256 equality of the builder's terrain buffer against the actual served terrain.bin, preventing differing terrain inputs from being described as served/source parity. This is additive; it does not replace the existing exact face comparison.

No snapshot fixture is committed or consumed. The former selective source fixture is replaced, not retained as a false production authority.

## Type and runner implications

- New builder uses application TypeScript imports only; no esbuild, filesystem, process or Node-specific API is added to it. Return types are inferred from the existing typed calls. The test's import makes scripts/horizon/bake-source.ts reachable by the configured main TypeScript check even though scripts/ is not a root include. Unused old test/bake imports are removed. `encodeTerrainAsset` returns ArrayBuffer, matching the new hash assertion.
- Setup remains once-per-file during module collection, matching the existing test's setup style. Root measured production prejoin63.2s plus fit19.26s, so allow roughly82s of collection plus the actual geography construction and later test work. This is a measured prior run, not a guaranteed timeout budget. Existing per-test15s default and explicit60s movement/art limits remain unchanged; collection is outside those individual test callbacks.
- Run this file serially on the8GB host. The test now creates the full real production world inputs and a full static geography rather than a cropped fixture. Do not run it concurrently with bake or typecheck. Any outer process budget must include collection time.
- If a particular runner enforces a short import/collection timeout, move the shared setup to a single explicitly timed beforeAll in a separate follow-up; that requires changing later module-level physical/path initialization too. Do not merely increase all test timeouts or drop source construction.
- After integration, first run configured typecheck and this focused test. Then compare final bake assets byte-for-byte as normal. This source-only proposal does not claim their success or solve the rendering budget.

## Updated performance conclusion

The successful exact production snapshot and fit reproduce2,004 main-Foot and16,036 funicular faces, equal to actual baked faces. Recorded19.26s fitting does not reproduce the earlier12,215.919s whole-bake elapsed time. Preserve that original log; its cause remains unassigned. No claim of host sleep is made.
