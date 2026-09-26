# Hearth worksession — portable Horizon asset checks

- **Status:** COMPLETE — scoped build fix and verification; merge/deploy remain with Jonathan
- **Opened:** 2026-09-25 (`America/Toronto`)
- **Owner / decision owner:** Jonathan
- **Assignee:** Codex
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `codex/horizon-build-reproducibility`
- **Baseline SHA:** `1061fae3b5a9979d8b3ec4a193b862fd5212a097` (merged #547)
- **Risk:** Medium — offline export and build verification; no runtime authority changes
- **Environment impact:** local build and CI only; no merge/deploy action

## Household outcome

The same checked-in Horizon data must pass the asset guard on Cloudflare's Node 22 and the local Node 24 runtime. A valid development-only land asset must not block the ordinary application build because of irrelevant floating-point bits.

Budget delta (5): 0. Engagement delta (3): 0 direct; restores reliable build verification. No financial calculation, Final Confirm, identity, household data, schema, secret or hosted write changes.

## Verified baseline

Jonathan supplied the Cloudflare log: Node 22.23.3 failed `pnpm build` at `Error: Stale Horizon world asset`. Node 24.19.0 had passed locally. GitHub confirms #547 merged as the baseline above. The local land candidate and that merge have the identical tree `d8740eb1511321de4306f82868fe93d7b90d863f`.

Reproduction with the official, SHA-256-verified Node 22.23.3 macOS arm64 binary produced the identical error. A recursive comparison found **28 differing numbers**, no structural/string differences, and maximum absolute difference **2.842170943040401e-14 eu**, in Crown retaining-wall coordinates. The terrain binary matched before the check reached JSON.

The ordinary Git fetch stalled while traversing the existing alternate object stores. The public GitHub Git-commit response supplied the signed commit payload; reconstructing its exact bytes reproduced the expected SHA before adding that object locally. Its tree and parent were already present. The fix uses a separate checkout; the prior review packet is retained as historical evidence.

## Scope and decisions

- Serialize finite fractional JSON numbers to nine decimal places (one nanometre at approved scale 1.0). Preserve integers, identifiers, topology and normal JSON null/optional-field behavior.
- Regenerate world/cards JSON and gzip with that canonical representation; the terrain format remains unchanged.
- Keep plain JSON and terrain byte-exact. Check gzip's decoded payload, allowing compression metadata/library differences while rejecting stale or corrupt content.
- Add regression coverage for the observed Node 22/24 values, actual coordinate/topology changes, gzip corruption and terrain byte changes.
- Add a bounded Ubuntu CI matrix for Node 22 and 24 asset checks.
- Preserve the Bight/ZIP/G1 layout and every existing land acceptance failure. No terrain reauthoring, API-key use, release, PIN-1 or visual acceptance is part of this fix.

## Acceptance evidence

- [x] Reproduce the supplied Node 22 failure.
- [x] Focused artifact regression suite: 5/5 pass on Node 22.23.3 and 5/5 on Node 24.19.0.
- [x] Regenerated assets pass `horizon:check` on Node 22.23.3 and Node 24.19.0. Node 22 check: 31.14 seconds.
- [x] Quantization-only comparison: 1,478,186 numeric values differ by at most 4.999947122996673e-10 eu; zero structural/string changes. Terrain bytes remain identical. World JSON is 32,505,287 bytes; gzip is 7,667,786 bytes.
- [x] Complete `pnpm build` on Node 22.23.3: exit 0, including both asset guards, app/workspace TypeScript, Vite and Hercules UI packaging. Existing bundle-size warnings remain non-fatal.
- [x] Scoped Medium quick gate on clean code SHA `2e0870d12c81c08e5e623770ee9d5cbcd433e63a`: pass in 127.564 seconds; 5/5 tests, no five-minute budget breach.
- [x] Ubuntu Node 22 and 24 matrix: both artifact regression suites and regenerated asset checks pass ([run 36208624218](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/36208624218)).
- [x] GitHub CI quick gate: pass in 89.408 seconds, no budget breach ([run 36208623960](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/36208623960)). This ran the PR merge ref `bae6642420bc5c125faf96b52cf3c843702cbd26` with the same change fingerprint as the local code SHA.
- [x] Cloudflare Workers PR build/container verification: pass; deployment step skipped ([run 36208624019](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/36208624019)).
- [x] Reviewable draft [PR #548](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/548).

## Evidence log

Evidence is saved outside the repository at `/tmp/horizon-build-fix-evidence/`; the initial runtime comparison is `/tmp/horizon-runtime-difference.json`. The CI links above retain hosted evidence. No meaningful household data or credentials are used.

The checks below ran with the named Node runtime first on `PATH`, pnpm 10.14.0 and `pnpm_config_verify_deps_before_run=warn` (shared local dependency installation). Full build and local quick-gate evidence refer to code SHA `2e0870d12c81c08e5e623770ee9d5cbcd433e63a`; this final record is a documentation-only follow-up.

```sh
# Each runtime: Node 22.23.3 and Node 24.19.0
pnpm exec vitest run test/horizonBakeArtifacts.test.ts --maxWorkers=1
pnpm horizon:check
# Node 22.23.3
pnpm build
HEARTH_TEST_BASE=1061fae3b5a9979d8b3ec4a193b862fd5212a097 pnpm test -- --risk=medium --focus=test/horizonBakeArtifacts.test.ts --focus-reason='Portable Horizon exports and strict stale/corrupt asset detection'
```

Changed files: the Horizon artifact helper and bake script; world JSON, gzip and cards exports; the focused artifact tests; the Node-version CI workflow; `docs/DECISIONS.md`; and this worksession. No source terrain, runtime UI or financial behavior changed.

## Remaining uncertainty and handoff

Local macOS and Linux CI now agree. A successful PR build is not a successful Cloudflare deployment: none was performed. Jonathan is the next owner for review and merge/deploy approval. This build fix does not clear the existing Pass 1 land no-go findings or replace Claude's required design review. Budget delta 0; engagement delta 0 direct. Main remained `1061fae3` at handoff verification.
