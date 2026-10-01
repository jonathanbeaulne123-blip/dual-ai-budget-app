# Final acceptance wrapper corrections (proposal only)

Three independent patches, prepared against the current mountain-road-book working tree; no checkout files changed:

1. `/tmp/mountain-acceptance-runners.patch`: adds durable `scripts/horizon/mountain-final-route-runner.py`, makes the existing serial test runner use a required fresh `--out`, and changes native-landings arrival from historical high-water `d` to current `pr.d` while preserving the existing 0.35 m station / 0.5 m endpoint / 0.48 m height thresholds. High-water progress/stall behavior stays unchanged.
2. `/tmp/mountain-capture-integrity.patch`: shared provenance helper plus all three actual-renderer capture scripts. Fresh leaf output directories, validated selected matrix inputs, expected-count checks, recorded runtime errors produce exit 1, and startup/final provenance is retained. Readable world, gzip world and terrain are compared to the served origin before and after Horizon/Journey captures. Gzip checks compare decoded bytes and retain both transport and decoded hashes (HTTP may transparently decode). Local readable/gzip world definitions must also agree. Journey adds its actual Journey gzip input. Native does not consume Horizon assets: it instead compares the listed native renderer/source/generated inputs through Vite `?raw`, preserving the fixed daylight renderer. Source hashes cover tracked and untracked Harbour/world/capture sources, public assets, dependency configuration and the Journey harness.
3. `/tmp/mountain-postbake-integrity.patch`: reserve/view refinement retain original manifest and findings, then write an independent final manifest and fail on changed source/assets. No proof tolerances, cameras, reserve definitions, geometry or acceptance exceptions change.

`node --check` passed on the five staged MJS files; Python `ast.parse` passed on both runners and all three proof files. No scripts were executed against a world, server, browser, test suite or GPU. These are syntax/source-reviewed proposals, not executed acceptance evidence.

## Runner semantics and limits

Every configured job runs despite earlier child-process/assertion findings. Source drift stops the sequence. Pause/interruption/incomplete inventory exits 1; fresh output protects previous failed attempts. Explicit job selection and commands are saved; ambient route/asset narrowing selectors are cleared and recorded. Start/end fingerprints include HEAD and actual source/assets. A process that returned 0 remains distinct from acceptance. Cruiser completion/restarts/contact/airborne and MAJOR/BLOCKER findings, movement failures, and conservative envelope findings are retained as failures. Envelope exit 2 is labeled completed-with-findings rather than a process crash.

Budget capacity reports and hairpin reports remain `review-required`: they expose measured numbers but do not themselves provide a valid all-render-pass acceptance boolean. In particular, adding component maxima can exceed a cap without proving a simultaneous sampled draw exceeds it. The separate actual renderer-budget tool must retain its own sampled false booleans and nonzero acceptance exit; parent owns that correction. No capacity number is silently treated as passed. Source-identical inherited route failures still produce a failing wrapper until reviewed; no baseline waiver is embedded.

The serial runner executes the existing explicit changed-area file list, not the complete repository gate. It distinguishes per-file process return codes from the raw assertion/RPC logs, but does not claim that a failed RPC necessarily means failed assertions. Raw logs stay authoritative. Final captures record their selected scope; a partial theme/tier invocation is not relabeled full-matrix acceptance. Static screenshots remain distinct from controls, streaming/device acceptance and actual occlusion review. Known authored L/portrait failures are not waived. Served input checks establish server/local parity at both boundaries, not an exhaustive hash of every dynamically fetched JS module or proof against transient server changes restored before the end.

## Commands after application and source freeze

Run from the intended checkout; each OUT must be absent. Replace paths with a new durable evidence directory for each attempt.

```
python3 scripts/horizon/mountain-final-route-runner.py --root "$PWD" --out /absolute/new-final-routes
python3 scripts/horizon/mountain-serial-tests.py --out /absolute/new-final-tests
node scripts/horizon/capture-mountain-finish.mjs /absolute/new-authored-pages --authored-pages
node scripts/horizon/capture-native-mountain.mjs /absolute/new-native-captures
node scripts/horizon/capture-mountain-journey.mjs /absolute/new-journey-captures --responsive
```

Full authored matrix is 12 pages × 3 themes × 2 tiers × day/night × landscape/portrait = 288 captures. Eye, target and FOV remain the original authored values; no camera is altered to repair a failure. Existing joins/matrix capture modes remain separate.

## Safe single-worker quick-gate invocation

```
VITEST_MAX_THREADS=1 VITEST_MIN_THREADS=1 VITEST_MAX_FORKS=1 VITEST_MIN_FORKS=1 pnpm check:quick
```

This uses installed Vitest's supported pool-specific environment configuration, which takes precedence over the gate's generic `--maxWorkers=4`. Evidence: installed `coverage.DfSpMS-b.js` lines 3719–3762 resolve the env variables into thread/fork pool options; lines 2612–2615 and 2748–2751 prefer those pool-specific options over config.maxWorkers/minWorkers. Both threads and forks are covered. No repository gate policy, test inventory, assertions or deadlines change. Recheck this installed mechanism after a dependency update. Passing `--maxWorkers=1` to the quick-gate wrapper itself is not a supported forwarding mechanism.

## Incremental actual-response proof

After the three patches above were applied by root, `/tmp/mountain-capture-loaded-assets.patch` adds browser **response listeners installed before navigation**. Every actually requested Horizon world/index/district/cards JSON or gzip, Horizon terrain, Journey gzip, and native terrain response is recorded with page identity, URL, status, Content-Encoding, exact local/served byte hashes and explicit comparison mode. A gzip response passes only if its compressed bytes match exactly or its decoded bytes match the exact locally decoded payload; no parsed-JSON comparison can replace this byte check. Per-page required input families must be observed. Pending response body reads are drained before page close and before final reporting. Failed/mismatched asset requests fail the capture while retaining their record.

Native terrain is resolved from `src/worldGeography.ts` without importing the native world, checked live before/after, and required among the native page's actual responses. Source fingerprinting now includes `public/mountain`, all `src` (including Journey), and the Journey fixture directory. The before/after endpoint fetch remains complementary evidence; it is no longer the only server check. Only syntax checks were performed, no network requests or renderer execution.
