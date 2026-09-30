# Hearth worksession — Mountain Road inventory and book

- **Status:** Phase 1 book delivered locally for Jonathan; Phase 0 acceptance gaps explicitly remain. Stopped before product edits.
- **Opened:** 2026-09-30, America/Toronto
- **Owner / decision owner:** Jonathan
- **Assignee:** Codex; bounded read-only neighbour, ownership and controller auditors
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** codex/mountain-road-book
- **Baseline / HEAD:** 324cd5f246ab295af5cf64d553ebf78fad57f7b5 (#576)
- **PR:** none; local work only
- **Risk:** High for the proposed work; current writes are diagnostic tooling, drawings and documentation.
- **Environment impact:** no household data, product geometry or deployed environment changes

## Household outcome

A measured plan for one understandable drive from the Prow to Summit Commons, with neighbouring connections chosen by actual terrain and transport constraints. The current road has not been repaired by this inventory.

## Dual Course

Budget delta (5): 0. Engagement delta (3): 0 delivered by this stage; +2 target for the finished road and approved links.

## Baseline and scope

The chat directory is not a Git repository. The managed-worktree tool returned `Not a git repository`; after that failure a separate manual worktree was created from fetched origin/main. Other checkouts are read-only. The bridge work exists at `../horizon-bridge-book` but is not on this main SHA; it is reference only, not imported.

Read AGENTS, operating model, continuity, current roadmap/strategy/architecture/index, handoff, ROAD D-R1–12, current decisions, Mountain placement D-M1–10, native/region/corridor code, original dissection and recovered 2026-09-25 HANDOFF. The named `claude/hearth-mountain-v2-build-2026-09-25.md` is absent; the recovered handoff is explicitly identified as a substitute, never current authority.

Authorized: read-only world/controller probes, evidence, the Mountain Road book and review. Excluded: world geometry, native Mountain v2 changes, physics, land links, bridges, money/commands/schema/sync/Auth/Hercules changes, deployment, merge. Jonathan's prompt requires a stop after the book; it supersedes any general implementation preference.

## Plan

1. Establish exact current main and CI.
2. Reproduce baseline corridor audit and extend evidence over existing V03 + town lane + native road.
3. Probe bicycle, board and walking; inspect shared ownership and neighbour terrain.
4. Capture joins/curves/gaps and compare probe findings; classify capture gaps explicitly.
5. Produce MOUNTAIN_ROAD.md, measurements/drawings and handoff; independent review; stop for Jonathan.

## Evidence log

- GitHub main CI run `36685087825`, test job `109788983055`: 82/83 app-startup tests pass, one fails: “keeps Bianca Month inside the current App and opens the current income slideshow”, `Missing Bianca Month income Start`. This matches the reported pre-existing month-end regression; test and fixture untouched. Horizon assets run `36685088018` succeeded. This task does not claim live acceptance from either run.
- `node scripts/horizon/dump-mountain-v2.mjs --check`: exit 0; 43,914 bytes, 315 road and 391 course points.
- `node scripts/horizon/road-audit.mjs --out docs/horizon/evidence/mountain-road/before/corridor`: 214.9 s; 0 BLOCKER / 23 MAJOR / 85 MINOR; zero restarts. Exact baseline reproduced.
- `node scripts/horizon/road-audit.mjs --mountain-chain --no-static --out docs/horizon/evidence/mountain-road/before/chain`: retained final run 36.8 s (earlier equivalent run 68.8 s); 5 distinct BLOCKER / 22 MAJOR / 22 MINOR findings, 122 raw events; four passes reach endpoint only after seven restarts (2/2/2/1). **Fails uninterrupted-drive acceptance.** Uses the existing audit's severity/event grouping, per-station native width, real stepCruiser and no runtime changes. Static width/guard/headroom sweep is deliberately not implemented for the synthetic chain. The synthetic line is only in memory, never baked.
- `node scripts/horizon/mountain-road-inventory.mjs`: native width/grade/curve/bridge data, point queries, source and bake hashes saved.
- `pnpm_config_verify_deps_before_run=false pnpm exec vitest run test/horizonMountainRegion.test.ts --maxWorkers=1`: 15/15 pass, 57.46 s. Regional test evidence, not rider or standalone acceptance.
- The first pnpm invocation refused dependency-directory removal due to the shared dependency symlink; no removal was performed. Subsequent commands disable automatic dependency reconciliation. Read-only dependencies reused from bridge checkout; no package or lockfile modified.
- High quick gate: TypeScript and 15 selected tests passed; 538.729 s against 300 s, `quick-gate-passed; time-budget-breached`, slowest TypeScript 461.980 s. No exhaustive gate requested or run. Raw jsdom canvas warnings are retained.
- Bicycle/registry-board/walking: 54 attempts, 14 independent end-reaching, 40 incomplete; full chain 0/6. Native shell skate: 18 starts assessed, 12 excluded, six driven, two end-reaching. No native full-chain start was eligible; 180 s native ascent timeout remains inconclusive.
- Static captures, actual clock/viewport and retained failure history are in [LOOK](../horizon/evidence/mountain-road/before/LOOK.md). These do not prove actual rider seating or physical-device experience.
- Independent read-only review raised two P2 findings, both fixed and rechecked: centreline-estimate labels and reproducible neighbour source evidence. No further actionable issue reported in that bounded pass.
- Changed files, exact commands, evidence and omitted gates are enumerated in [handoff](../CODEX_HORIZON_MOUNTAIN_ROAD_1.md). A durable [continuation packet](../briefs/MOUNTAIN_ROAD_PHASE_2.md) preserves the approval boundary and acceptance.

- Final lightweight verification: 95 existing local artifact links resolve; 32 capture files present; six JavaScript scripts and Python source parse; diff check clean; no changed `src`, `public`, test, package or lockfile. See [final check record](../horizon/evidence/mountain-road/FINAL_CHECKS.json).

## Decisions and uncertainty

D-MR proposals live in MOUNTAIN_ROAD.md, not silently accepted in DECISIONS.md. Native source and public bake are unchanged. Guard/foot-surface disagreements and multiple overlapping floors need source-level fixes only after Jonathan's decision. Neighbour chord measurements are screening, not fitted roads. Scripts and SwiftShader are not physical-device evidence.

## Handoff

Next owner: Jonathan for the Phase 1 choices; Codex for further evidence or approved Phase 2. No PR, commit, merge or deployment is implied.
