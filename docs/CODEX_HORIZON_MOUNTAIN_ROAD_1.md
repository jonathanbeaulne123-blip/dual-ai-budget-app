# Mountain Road 1 — inventory and decision book

30 September 2026 · Phase 1 stop · High risk

The household gets a measured route plan from the Prow to Summit Commons and an honest choice of neighbouring connections. This delivery identifies the current interruptions, names the ownership boundary and makes the next intervention reviewable. It does not yet make the road comfortable or continuous.

**Budget delta (5): 0. Engagement delta (3): 0 delivered by this stage; +2 target for the finished experience.**

## Delivery and decision

- **Local only:** branch `codex/mountain-road-book`, baseline and HEAD `324cd5f246ab295af5cf64d553ebf78fad57f7b5`, including airport #576. Uncommitted documentation, evidence and diagnostic scripts. No PR, merge, deployment or live verification.
- **Main result:** [Mountain Road book](horizon/MOUNTAIN_ROAD.md), [visual record](horizon/evidence/mountain-road/before/LOOK.md), [worksession](worksessions/2026-09-30-mountain-road-book.md), [independent review](horizon/evidence/mountain-road/REVIEW.md).
- **Recommendation:** D-MR1–7 and D-MR11–12 frame a Horizon-side repair of the existing chain. D-MR8 advances Stillwater only to a fitted study with a second descent to Green Road. D-MR9–10 defer other links and preserve one shared bridge contract. All D-MR choices remain proposals.
- **Stop authority:** Jonathan's pasted prompt explicitly says to stop after Phase 1 and give him the book. Phase 2 geometry, native Mountain changes, links and landmark bridges are not approved by this delivery.
- **Next owner:** Jonathan for the proposed decisions; Codex for further read-only evidence and the bounded phase he selects. The [continuation packet](briefs/MOUNTAIN_ROAD_PHASE_2.md) preserves scope and acceptance.

## Per reach and link

| Place | What this stage changed | What remains |
|---|---|---|
| M1–M3, V03/Prow/tunnel/canal/lane | Added the existing approach to one in-memory diagnostic chain, measured source joins and captured static context. | Prow/portal/bridge/Foot lip scans and actual ridden handovers. Foot ascent and lane return stall in the cruiser probe. |
| M4–M8, native ascent and bridges | Recorded the native/plan station conversion, varying drawn widths, seven tight-curve groups and three main bridge ranges. Added controller traces and layered-floor witnesses. | Ore Line headroom, library/dam overlap, guards, natural downhill, native skate field mismatch, lamps, planting, map and transport/view envelopes. |
| M-top | Captured summit context and preserved existing destination/launch/transport ownership. | Full rider arrival/departure and all envelope proofs. |
| Stillwater | Endpoint profile, terrain chord and sampled G1 crossing calculation. | Fit the 58.507 m first link and a separate descent of about 21 m to Green Road. No complete loop alignment exists. |
| Hollow / Green Road / Scholars | Measured direct options; rejected destructive/steep chords; described a deferred Viaduct alternative in Bridge Book format. | Contour alignment, plot/view protection, cart/cable envelopes and shared-contract decision. |
| North / Shoulder | Measured descent requirements and reserved envelopes; recommended views for now. | Any larger intervention needs Jonathan's separate choice. |
| Crown / Undercroft | Recorded existing summit and rail access. | No new road proposed through the mountain. |

No `src/`, `public/`, tests, package manifest or lockfile changed. Mountain v2 is still the live default world and its source has not been modified. Budget logic, Final Confirm, commands, schema, sync, Auth/RLS and Hercules remain outside this work. No household data or secrets were used. Network use was read-only repository/CI retrieval and loopback rendering; no hosted product writes occurred.

## Exact verification

| Run | Result | Meaning |
|---|---|---|
| Main CI `36685087825`, job `109788983055` | 82 passed / 1 failed app-startup tests; `Missing Bianca Month income Start` in the named month-end regression. | Existing red CI named, no test/fixture change. Horizon assets run `36685088018` succeeded; this is not a local byte-exact check. |
| Original corridor audit | **0 BLOCKER / 23 MAJOR / 85 MINOR, 0 restarts**, 214.9 s. | Baseline reproduced unchanged. |
| Whole-chain cruiser, centre/right both ways | **5 distinct BLOCKER / 22 MAJOR / 22 MINOR**, 122 raw events, **7 restarts (2/2/2/1)**, retained final run 36.8 s. | Four endpoint-reaching passes, zero uninterrupted acceptance. The earlier 68.8 s attempt had the same findings. Variable-width drive only; no full static sweep. |
| Bicycle / Horizon registry board / walking | **54 attempts: 14 end-reaching independent reaches / 40 incomplete. Whole chain 0/6.** | Bicycle 4/18, board 2/18, walking 8/18. Walking assumes ready chunks/gates and stops at airborne handoff. Camera/streaming/UI absent. |
| Native everyday skate | **18 starts assessed; 12 excluded by shell launch radius; 6 driven; 2 end-reaching.** | Full-chain endpoints excluded; no native full-chain trial. Native driver uses native collision, not Horizon baked body collision. V03 reverse water bail at 105.13/326.87 m; mountain uphill 679.19/938.29 m at 180 s cap, inconclusive. |
| Mountain dump `--check` | **43,914 bytes, 315 road / 391 course points**, exit 0. | Generated native export matches unchanged source. |
| Standalone focused region test | **15/15 pass**, 57.46 s. | Region/source protection, not device or road acceptance. |
| High quick gate | TypeScript and selected **15/15 tests pass**; **538.729 s / 300 s budget**. | `quick-gate-passed; time-budget-breached`. The breach began in TypeScript (461.980 s); not a fully green gate. |
| Independent read-only review | **Two P2 findings fixed and rechecked; no remaining actionable finding within its scope.** | Centreline-estimate wording and reproducible neighbour evidence. No physical-device acceptance. |

The quick-gate evidence fingerprint is `cf44599339b84d40ddd5c3e86af6a0cb477b30be6612b1de4db48861cbd6875d`. Final documentation, capture metadata and diagnostic provenance were subsequently completed; this is not a claim that the gate ran on the final complete file set. Product source stayed unchanged throughout. Final lightweight checks pass: six JavaScript scripts parse, the Python drawing source parses, 95 local artifact links resolve, all 32 manifest image files exist, no evidence file is empty, and `git diff --check` is clean. Product-source/test/bake diff is empty. [Final check record](horizon/evidence/mountain-road/FINAL_CHECKS.json) retains diagnostic source hashes.

No exhaustive gate was requested or run. No new world bake, local byte-exact bake check, full serial world suite or view suite was run because this stage did not change the world. They remain required after approved implementation. The focused region runs log jsdom canvas `getContext` warnings while all 15 assertions pass; the warnings are retained, not suppressed.

## Reproduction

Run from the worktree root using the existing dependencies. This checkout's `node_modules` is a read-only reuse of the bridge checkout; do not let a package runner remove/reconcile that shared directory. The initial plain pnpm run refused removal without a TTY and changed no dependencies. The environment flag below disables its automatic verification/reconciliation.

```sh
node scripts/horizon/road-audit.mjs --out docs/horizon/evidence/mountain-road/before/corridor
node scripts/horizon/road-audit.mjs --mountain-chain --no-static --out docs/horizon/evidence/mountain-road/before/chain
node scripts/horizon/mountain-road-inventory.mjs
node scripts/horizon/mountain-road-neighbours.mjs
python3 scripts/horizon/mountain-road-drawings.py
node scripts/horizon/dump-mountain-v2.mjs --check
pnpm_config_verify_deps_before_run=false pnpm exec vitest run test/horizonMountainRegion.test.ts --maxWorkers=1
pnpm_config_verify_deps_before_run=false pnpm test -- --risk=high --focus=test/horizonMountainRegion.test.ts --focus-reason='Mountain Road Phase 0 diagnostics preserve placed region; product geometry is unchanged'
```

Other-mode reproduction is in [modes/README](horizon/evidence/mountain-road/before/modes/README.md); preserve timeouts, bails and automatic resets. The [native summary](horizon/evidence/mountain-road/before/modes/SUMMARY.md) explains the two skate systems.

For static review captures, start the existing Vite review harness on loopback port 5209 and run `node scripts/horizon/capture-mountain-road.mjs`. It resumes successful named captures. Existing files are historical baseline evidence; copy them aside before intentionally making a fresh baseline. The [LOOK](horizon/evidence/mountain-road/before/LOOK.md) records viewport, actual clock, failures and limits. Frame totals are not per-district cost measurements.

## Changed files

- `scripts/horizon/road-audit.mjs`: optional in-memory existing mountain chain and trace metadata; default corridor behavior preserved.
- `scripts/horizon/mountain-road-inventory.mjs`: source and layered-surface/ceiling queries.
- `scripts/horizon/mountain-road-neighbours.mjs`: reproducible endpoint, terrain and sampled-cable feasibility evidence.
- `scripts/horizon/mountain-road-drawings.py`: eight endpoint plan/profile sheets, chain plan and hairpin table source.
- `scripts/horizon/capture-mountain-road.mjs`: read-only static review poses and honest capture manifest.
- `docs/horizon/MOUNTAIN_ROAD.md`, this handoff, the worksession, continuation packet and `AI_HANDOFF.md` entry.
- `docs/horizon/evidence/mountain-road/**`: raw audits, source measurements, modes and retained scripts, logs, diagrams, review and captures.

## Rough areas and owed list

The road remains interrupted in the measured controllers. Five distinct cruiser blockers are still present; some additional failures can come from scripted steering or mode legality. The lower portal has only .25 m clearance at one footprint sample for a 1.55 m rider. Library/dam queries select overlapping floors, with about 1.68 m and .69 m level differences. The Foot has a baked blocked graph edge and a stalled driver, but a static camera alone cannot prove the exact wheel/ground mechanism. No source repair is selected from screenshots alone.

Visual evidence is **32 Classic/full/day headless SwiftShader images**, including one rock-occluded Undercroft shot, with nominal static eye poses. The manifest retains 21 interruption errors and three unresolved HTTP 404s; observed clocks differ between initial and resumed runs. It is not an actual surface-seated rider, a moving-controller witness, a physical Mac/iPhone ride or a completed three-theme matrix. Exact bridge abutments, both approach directions, every footway/branch, natural downhill, visible guard contact, full static chain scans, maps, night/lite/themes, flight/cable/cart/funicular/view proofs and real per-district budgets remain owed. The 3-pixel Boathouse view issue stays named.

The original named `claude/hearth-mountain-v2-build-2026-09-25.md` was absent. The original dissection and recovered 25 September Mountain v2 `HANDOFF.md` were read as historical evidence; current repository authority wins. The adjacent bridge effort is unmerged at its inspected local head and is a dependency, not an approved contract on this main SHA.

**Next owner: Jonathan.** Select the D-MR proposals before Phase 2. A Horizon-side go-ahead does not include editing native Mountain v2, moving a gate/cable/view, introducing a new landmark bridge, merging or deploying. Codex should first reconcile any newer main/bridge work and close the diagnostic gaps within the chosen scope.
