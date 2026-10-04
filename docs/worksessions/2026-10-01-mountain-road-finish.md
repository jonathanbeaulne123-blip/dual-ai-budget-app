# Hearth worksession — finish Mountain Road and Stillwater

- **Status:** Draft PR #581 open; acceptance gates remain open
- **Opened:** 2026-10-01 (`America/Toronto`)
- **Owner / decision owner:** Jonathan
- **Assignee:** Codex, one checkout writer; read-only review
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `codex/mountain-road-finish`
- **Baseline / initial head:** `123319dff4cfa870648e5d26272ddd6a80185554`
- **Prior PR:** #578 merged; its tree is identical to the submitted `7178504` checkpoint.
- **Risk:** High
- **Environment impact:** local fictional world only; no hosted writes or deployment authorized.

## Household outcome and scope

Finish the existing Mountain Road chain and Stillwater connection as an uninterrupted, authored experience in all three themes. Budget delta (5): 0. Engagement delta (3): +2 target, not accepted. Financial commands, ledger meaning, Auth/RLS, sync, schema and Hercules payloads remain unchanged. Existing written native approvals and named original-grade exceptions persist; further reserved native/view changes still require Jonathan's decision.

Jonathan's latest instruction, “now finish what you were doing before”, resumes implementation and verification and supersedes the previous draft wrap-up stop. The merged checkpoint is not evidence that its outstanding gates passed.

## Verified baseline

Fresh GitHub and remote checks confirm PR #578 merged at the baseline above. This branch was rebased on PR #579 and #580, with current `main` at `2bb45ea`, before the final commit. The prior handoff recorded four synthetic collar failures; the updated collar tests now pass. The original over-budget geometry and incomplete route, clearance, device and budget gates remain explicit. Source and assets were unchanged at branch start.

## Plan and acceptance evidence

- [x] Repair duplicate collar-corner insertion using represented plan collinearity; preserve the narrow faces instead of changing geometry tolerances.
- [x] Replace the oversized ground-cut patch with an adaptively bounded patch that grows only until the unchanged boundary interpolation proof passes. Current served proof measures 2,928 triangles, down from 4,515; full/lite share identical positions and indices.
- [x] Keep the shared funicular trail-art support lookup in world coordinates (the render origin is only a draw transform) and index candidate faces spatially.
- [ ] Re-run physical clearance after the correction; the earlier targeted process was stopped without a result, so no clearance pass is claimed.
- [x] Reframe C/skate shelf, D/surf, F/L01, and L/Boathouse portraits under Jonathan's approval. Baked-world portrait and landscape subject checks pass for all twelve views; changed portraits meet horizon and named-subject thresholds. L now scores 11 Lantern Row and 13 Boathouse pixels.
- [ ] Re-run the six tier/theme art-clearance cases after the render-origin fix.
- [ ] Re-run a stable-source full actual-served route/terrain/render proof. The prior v9 run was invalidated by a concurrent manifest edit and also found unresolved new canonical ground-boundary and exposed-boundary failures.
- [ ] Reduce combined district geometry within the unchanged full/lite budgets, with fresh compiler, bake, and byte-exact export evidence.
- [x] Capture Full / Classic / Night with the actual Horizon renderer on parent revision `123319d` and verify its provenance for that scoped local preview.
- [ ] Complete a three-view capture on the rebased head: only Stillwater drive rendered; Library drive and mountain-air failed to settle. The attempt has stable sources and matching assets, but is explicitly incomplete.
- [x] Run the blind code review on the ground patch, funicular lookup and approved portrait changes; no actionable code defects were reported. This does not clear route, clearance, geometry-budget or device gates.
- [ ] Complete streaming/recovery, envelopes, GPU captures, and three-theme human/device review. None is substituted by the local browser captures.
- [x] Publish draft follow-up PR #581 with remaining failures and explicit delivery state. It is open and draft; merge, deploy, and hosted data changes remain out of scope.

## Evidence log

The final two focused files passed 19/19 tests after rebasing on `2bb45ea`: `horizon-walking-ground-patch.test.ts` (8/8) and `horizonViews.test.ts` (11/11; 28.99s total). Full TypeScript check passed after resolving a boundary-label inference and adding an explicit null guard to the portrait proof. The portrait proof passes all twelve landscape and all twelve portrait subjects, including C/D/F/L visibility and horizon checks. The direct bake check, Mountain landings check, and Mountain v2 export check also returned success before the final rebase; the changed files since then were reviewed and type-checked. These are source/test evidence, not GPU or device acceptance.

The direct terrain bake check returned success in 180.4s with terrain SHA-256 `0dc23c32ca9af9d39f1719fecc5bd7b2f1017562af0f7b2c1bfa046cb44b0c76`, 1,077 solids, 740 diagnostic entries and 138 planner conflicts. Those counts are retained; this is not proof of the district geometry budget. `generate-mountain-landings.mjs --check` passed with 350 vertices / 552 triangles for the library approach and 175 / 272 for the awning approach. `dump-mountain-v2.mjs --check` passed with a 696,991-byte export, 941 road samples and 391 course points.

The actual-served v9 runner (`/tmp/mountain-funicular-actual-served-proof-v9-adaptive`) completed 14 ordinary walking attempts and the six town ±1.3m sweeps. It recorded zero route-gating failures, while 26 continuous-sweep contacts remain outside the original body-safe centre envelope. It found 11 introduced canonical ground-boundary failures, 145 introduced exposed-boundary failures, and 1,279 retained raw boundary-continuity failures (inherited and introduced). The run also detected source drift because the portrait manifest changed while it was executing, so it cannot establish final acceptance.

The v9 art clearance check found four buried ribbon samples on the funicular apron. The first attempted fix incorrectly added `renderOrigin` to collision-space vertices; the world-space bounds and renderer contract disproved that assumption, so the extra offset was reverted. Candidate-face lookups now use a 2m spatial index, but the six-tier/theme physical-clearance test remains unrun after that correction. No clearance pass is claimed.

The standalone local review page is `http://localhost:5173/horizon-review.html?world=horizon&tier=full&shot=F&date=2026-10-01&sun=22:00&theme=classic`. The successful Full/Classic/Night capture set under `after/attempts/night-review-2026-10-04/` is stamped at parent revision `123319d`; it visibly shows Mountain Road lanterns and pools, with 18 loaded assets and 26 source checks matching, stable sources, and zero runtime errors. A fresh attempt at final branch `9e4e398` retained a Stillwater tunnel view, but two of three views failed to settle; its failed inventory and complete provenance are under `after/attempts/night-review-rebased-incomplete-2026-10-04/`. The ordinary app remains unchanged because the branch is local and unmerged. These are headless Chromium SwiftShader captures, not phone/Mac GPU or movement evidence. The app entry route initially presented onboarding, and the Vite preview needed a temporary out-of-repository filesystem allow-list for the linked PGlite runtime. No committed Vite configuration change was made.

## Remaining uncertainty and handoff

The four original grade stretches above 12% remain explicit approved exceptions. The combined district geometry budget, introduced ground-boundary failures, continuous-sweep post contacts, stable-source full proof, streaming/recovery, GPU and device/human gates remain open. Keep the follow-up PR in draft until these gates are resolved; do not merge or deploy on the strength of the current partial evidence.
