# Mountain Road and Stillwater — draft PR checkpoint

October 1, 2026. **Prepared for a draft PR at Jonathan's request; not ready to merge, deployed or live verified.** The PR's commit and delivery receipt identify the submitted head. Earlier source checkpoints below and in the evidence folders retain their own identities.

Jonathan's latest instruction is: “i think youve done enough work, wrap up what you are working on and create a pr”. This supersedes continuing the remaining implementation and acceptance work in this session. The existing Mountain Road and Stillwater work is packaged together for review; new optimization studies are deferred.

The Prow → Foot → Summit road chain and the 341.094 m Stillwater connection to Green Road are implemented, with shared road ownership, fitted joins, supported lanterns, authored treatments in Classic Hearth, Taylor's Scrapbook and Newfoundland, and Journey map projection. The approved library/dam landings, extended awning return, three folded bends, awning entrance and Orchard approach repairs are included. The original road grades remain explicit exceptions under D-MR17. **An uninterrupted, fully accepted journey is still unproven.**

Risk **High**. Budget delta (5): **0**. Engagement delta (3): **+2 target**, pending route and visual acceptance. Financial commands, ledger meaning, Auth/RLS, sync, schema and Hercules payloads are unchanged.

## Review entry points

- Branch: `codex/mountain-road-book`, checkout `.codex-work/mountain-road-book`.
- Integrated main: `1cf76c551e6f49124b6257162bc4d36ca18d7bd1` (#577), merged locally at `df77030298d5ff960d2eeaa5eb62c8558008694b`. Remote main was checked at this same base during wrap-up.
- [Mountain Road book](horizon/MOUNTAIN_ROAD.md), [build work session](worksessions/2026-09-30-mountain-road-build.md), [draft brief](briefs/MOUNTAIN_ROAD_PHASE_2.md), [partial visual review](horizon/evidence/mountain-road/after/LOOK.md).
- [Final bounded source checks](horizon/evidence/mountain-road/after/attempts/draft-pr-wrap-up/), with individual exit status and source hashes. A timeout is incomplete, never a pass.
- [Deferred studies](horizon/evidence/mountain-road/continuation/wrap-up-studies/README.md) and [independent review](horizon/evidence/mountain-road/after/review/) preserve the continuation evidence.

## Implemented scope

| Area | Included behavior |
|---|---|
| Main chain | One route through the Prow tunnel, canal, native mountain road and Summit; source-defined handovers retain surface ownership. |
| Foot and Ore Line | A fitted Foot apron and a closed crossing to fixed rail heads, with portal geometry withdrawn from road width. |
| Native repairs | Written approvals D-MR19–20 and D-MR22 are applied in the shared source. Main centreline, heights and main bridges remain protected except for the separately approved Orchard bridge prefix. |
| Summit | The native road owns its surface; the added landing guard leaves the existing walk open and its ground cut ends at the actual road end. |
| Stillwater | 341.094 m plan length, maximum 8.222% grade, 104 m lined tunnel, 12 m internal width and 5.4 m headroom. |
| Lighting and map | Shared clock, six full/two lite shadowless road lights, three authored theme treatments and Journey route projection. The inherited airport has five separate lights; 6/2 is not a whole-scene limit. |
| Runtime | Streaming refresh, exact static face bounds, source-owned local render origin, ground cache separation and shared physical/drawn funicular ground. |

The production bake and apron fixtures now use the same ordered builder. The authoritative funicular apron retains **16,036 triangles**. An exact planar reduction to 6,704 triangles passed isolated apron geometry checks but changed the downstream canonical ground by **25.892 cm**. It was removed from production and archived as rejected; no budget waiver was made.

The applied v7 shared-ground patch passes its actual-served numerical preflight in both tiers: **110,280 dense samples and 4,521 published-path samples per tier**, maximum drawn seam below **0.000001 m**, no new/worsened steep physical faces. It adds **5,515 full / 5,350 lite** ground triangles. This proves that frozen actual fixture, not general ground composition, movement, artwork, streaming or device performance. The wrap-up focused run is **15 passed / 4 failed across four files**: the four failures are ground-collar inversion assertions on synthetic grids. They are retained as current blockers; no assertion or tolerance was weakened.

## Evidence and its limits

- Earlier lighting checkpoint: bake **144.477 s**, byte-exact check **160.889 s**, **28/28 focused tests**. These are historical, source-pinned results, not final-head acceptance.
- Intermediate serial lane: **147 files passed / 31 failed / 178 total**. Integrated-main replay: **11 passed / 19 failed / 30 total**. Only matching measured failures are inherited; the entire failing lane is not excused.
- Four earlier whole-chain cruiser rides had zero restarts, body contacts or airborne steps, but retained **0 BLOCKER / 1 MAJOR / 12 MINOR**, including the Orchard lip. After approved repair, **12 local native/Horizon Orchard rides** and **5 focused tests** pass. A fresh whole chain is owed.
- Exact static-query comparison: **11,469 queries** agree; **11 geography regressions** pass. These are bounded source measurements, not overall performance acceptance.
- Frozen lighting comparisons: **288 image pairs**, **144 shadow color-attachment pairs**, and **36 nonflat Long Sands pairs** agree. Actual depth textures and physical devices are not accepted by these probes.
- Native visual run: **87 of 132 captures saved**, one Newfoundland overview did not settle in 45 seconds, then the run was intentionally stopped for this wrap-up. All **1,839 tracked capture inputs** remained unchanged. See [LOOK](horizon/evidence/mountain-road/after/LOOK.md). This is partial headless evidence.

## Merge blockers and unfinished acceptance

1. **Rendering budget:** the baked Lakeside solid contribution is **33,298 full / 29,360 lite triangles before art and shared ground**, already over ROAD §8's unchanged **25,000 / 10,000** limits. Add the shared-ground counts above; combined renderer acceptance remains failed. All layers and actual draw calls must be measured together.
2. **Ground construction:** fix and rerun the four synthetic-grid collar failures without changing the proved actual-world surface or weakening gates. Ground preparation cost and complete scene-ready latency also need review.
3. **Journeys:** fresh final-chain/Stillwater cruiser, bicycle, board and walking runs; natural descent and the hairpin table; all original footways and final funicular width/body/art checks. The reduced-apron movement runner stopped at failed ground parity and proves no ride.
4. **Real runtime:** full/lite streaming, late Crown load, initial-load race, recovery and final GPU drawn-floor checks.
5. **Visuals and envelopes:** remaining native captures, final Horizon/Journey/day-night/theme/tier views, flight/transport/reserve checks and ordinary clearance. Four inherited portrait failures remain an unanswered design choice; native dam walking failures remain named. An Orchard bridge-support concern is unmeasured.
6. **Verification:** remaining serial failures, final focused High gate and full acceptance. The exhaustive lane has not been requested for an exact clean SHA and was not run. Human final look and physical-phone ride remain separate.

## Delivery and next owner

Create the requested draft PR and stop expanding the work. Jonathan owns prioritization of the next review/repair session; the next implementer should start with the ground-collar test failures and the unchanged combined rendering budget, then regenerate exact assets before final routes and captures. Do not infer merge or deployment authority from this draft.

Rollback before merge is to close the draft and keep main unchanged. Any later integrated rollback should revert the scoped implementation and regenerate matching Horizon/native assets together; do not mix new physical source with an older bake. No hosted rows, schema, secrets or deployments were changed, and no real household data was used.

## Final bounded wrap-up receipt

The High quick gate passed its diff/AI checks but did not complete the compiler stage within the 300-second limit (307.964 s including termination, exit -9). The fresh bake likewise exceeded its limit (300.433 s, exit -15); the duplicate byte-exact regeneration was stopped after 17.849 s (exit -15). **All are incomplete, not passes.** No exhaustive lane ran. All 1,970 captured source inputs remained unchanged. Existing world/terrain/native-export hashes still match the passing actual-served ground preflight, but fresh final source/bake parity remains open. The exact receipts are in `after/attempts/draft-pr-wrap-up`.

The standalone native export check passes (exit 0; 696,991 bytes, 941 road samples, 391 course points). This is separate from the incomplete full-world checks.
