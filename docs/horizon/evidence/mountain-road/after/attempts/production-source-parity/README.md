# Production source parity — October 1

The bake and apron regressions now call the same ordered production source builder. Its ground closure is preserved from before corridor settlement. This removes the earlier selectively re-emitted local fixture.

The saved unrounded production replay reproduces both served apron face sets exactly at the bake’s nine-decimal precision: 2,004 main-Foot faces and 16,036 Funicular-Foot faces. The isolated production fit took 19.258 seconds. These snapshots precede the builder-only refactor; they are frozen evidence, not a current-source cache.

After refactoring, `pnpm horizon:check` passed in 98.49 seconds (103.12 user, 2.44 system; peak resident memory 727,105,536 bytes). All 3,026 captured source/test/script/asset hashes and HEAD remained unchanged. The check includes generated landings, byte-exact terrain/world bake and native export check. The earlier 12,215.919-second bake is retained; its long elapsed time was not reproduced and no cause is asserted.

The first typecheck failed because two new test calls omitted required bed metadata. Those calls now preserve the lane metadata while substituting only points. The second configured typecheck passed. Movement, shared-ground continuity, geometry budget and final visual evidence remain independent open gates.
