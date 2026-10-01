# Type-only r185 callback-group correction

Patch: `/tmp/mountain-shade-group-types/callback-group-types.patch`.

The installed renderer passes the live `BufferGeometry.groups` entry into the callback. Installed declarations instead call the sixth argument `THREE.Group`, which is a scene graph object. This produces the five configured-tsc diagnostics retained in `/tmp/mountain-partitioned-shade-typecheck.txt`: two identity comparisons and `.start` in the helper; two test callback arguments.

The source asserts only this library boundary through `unknown` to `THREE.BufferGeometry['groups'][number] | null`. Tests pass the very same group object, asserted only to each callback's declared sixth-argument type through `Parameters<...>[5]`. No group is cloned or replaced and no runtime statement, condition, count, index, material, callback, or shader changes.

`BASE.json` records immutable before/after source hashes. `emission-proof.json` records esbuild0.28.2 transforms (loader ts, format esm, target es2022, no source maps): both helper and test emitted code are **byte-identical**, with no warnings. Helper output SHA256 is `efbf0e6b5ab58efba96acd6ad86a37e9a95fbe49644088950f833c45f9b0e154`; test output is `fd847d19b731916b0ce8fec45d5bb492da5452128aa0c6d95f51d895a5a449c5`. Before/after emitted files and the small standalone verifier are retained beside the proof.

The agent ran only the expressly authorized no-bundle esbuild transform and `git apply --check` (pass). It imported no source/test/world module and ran no test, tsc, browser, renderer or bake. The checkout and frozen proof inputs were untouched. Root should apply after its frozen GPU proof and run the configured typecheck; JavaScript equality is not itself a TypeScript success verdict.
