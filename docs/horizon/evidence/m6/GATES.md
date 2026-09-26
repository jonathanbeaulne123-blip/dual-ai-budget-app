# M6 gates (reviewer-integrator, 26 Sep 2026)

Container: 2 CPUs, 7 GB, Linux; Node 22.22.2; run in the worktree `claude/horizon-glider-cam`, one at a time, nothing else
heavy running. Base `main@0f601b5`.

| Gate | Command | SHA | Result | Wall time |
|---|---|---|---|---|
| Presence wire / books untouched | `git diff --stat 0f601b5..HEAD -- src/core src/ledgerSync workers` | `fd534e9` | empty | — |
| Manifest regeneration | `python3 docs/horizon/make_manifest.py` (temp dir) + `cmp` with `src/harbour/horizon/world/MANIFEST.json` | `e4655b3` | identical (v1.7) | < 1 s |
| Bake check | `node scripts/horizon/bake-terrain.mjs --check` | `e4655b3` | pass (terrain sha `d5c8ad20…`, world 32 505 806 B, gz 7 667 687 B) | 29.8 s |
| TypeScript | `pnpm typecheck` | `e4655b3` / `fd534e9` | pass / pass | 100.1 s / 97.5 s |
| Horizon tests | `pnpm exec vitest run test/horizon*.test.ts --maxWorkers=1` | `e4655b3` | 42 files, 274 tests passed (4 are `it.fails` records of land conflicts) | 44.0 s |
| Horizon tests | same | `fd534e9` | **43 files, 281 tests passed** (+ `horizonGliderJourneysWind`, 3 more `it.fails` records of the build's wind) | 44.4 s |
| Quick gate (High) | `pnpm test -- --risk=high --focus=test/horizonGliderController.test.ts --focus-reason="horizon p2 M6: glider and parachute movers, thresholds, flight cam"` | `fd534e9` | **`quick-gate-passed`**: 20 files / 197 tests (fast lane), phases diff-check 0.6 s, ai-surface 0.7 s, typescript 97.3 s, test-discovery 18.9 s, vitest-fast 12.7 s; **133.4 s of the 300 s budget, `timeBudgetBreached: false`**, `workingTreeClean: true`, `uiProofRequired: true` (met headlessly by `hud/` and `rides/`; device acceptance still open) | 134.4 s |
| Build | `pnpm build` (mountain pack check, bake check, typecheck ×2, `vite build`, Hercules Pro UI, no `_redirects`) | `fd534e9` | **pass** (only the existing >500 kB chunk warning) | 193.2 s |

Environment note, stated plainly: the first quick-gate attempt failed in 3.8 s before any phase — `git hash-object
--no-filters -- node_modules failed (128)` — because this worktree's `node_modules` is an untracked **symlink** (the
`node_modules/` ignore rule matches directories only) and the gate hashes every untracked path. The worktree also holds
untracked builder leftovers (`.probe2.mjs`, `.probe3.mjs`, `delivery/`, `evidence-glider/`) that are not on the branch.
The passing run excluded exactly those five paths for the gate's own git calls through the environment
(`GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.excludesFile GIT_CONFIG_VALUE_0=<file listing them>`), without touching the
repository's or the shared `.git/info/exclude`; the gate then reported `workingTreeClean: true` for the branch's content.
The build step's base comparison on `0f601b5` was not needed (the build passed).

Not run (not requested, reserved): `pnpm test:full`, `pnpm check:full` (AGENTS.md: only on Jonathan's explicit request).
