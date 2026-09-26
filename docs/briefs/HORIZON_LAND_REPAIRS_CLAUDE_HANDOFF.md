# Horizon land: independent review, then enhancement

Jonathan wants a continuous, walkable Horizon that reads clearly from its twelve authored views. Review the repairs against current main, then enhance the land within the approved Pass 1 scope. This is a Classic greybox land candidate, not accepted art or an activated Hearth release.

Repository: `jonathanbeaulne123-blip/dual-ai-budget-app`. Baseline: `0f601b55054fbc55ca997b172f4a1e9daf0ce79d` (merged #548). Repair branch: `codex/horizon-land-repairs`. The delivery's `SOURCE.json` identifies the exact code and handoff commits, artifact hashes and verification results. Historical `3c6f7b7` evidence from the earlier packet does not certify this candidate. Review the full Pass 1 implementation as well as the repair diff; the earlier land was merged without acceptance.

Risk High. Budget delta (5): 0; no ledger, Auth, household, schema or financial writer changes. Engagement delta (3): improved physical access, retaining geometry and dependable views; full usability and visual acceptance remain open.

## Start independently

Read `AGENTS.md`, current continuity and operating-model canon, then `docs/horizon/CONTRACT.md`, `REVIEW-BRIEF.md`, `NOT-THIS.md`, the Must produce / Must not / Evidence sections of `passes/01-land.md`, `LIGHT.md` and the relevant `STYLE.md` sections. Read the source and run your own probes before reading builder verdicts. Keep the five audit scopes in REVIEW-BRIEF: terrain; beds/structures; crossings/thresholds; definition/streaming/performance; sun/views. Auditors may run in parallel but remain read-only, with one subsequent implementation writer.

Jonathan's latest instruction explicitly requests review **and enhancement**. It supersedes REVIEW-BRIEF's blanket "reviewer does not fix" for the enhancement phase. First write independent findings and keep/re-author verdicts. Then reconcile the builder evidence and implement justified improvements in a separate commit series. Do not silently amend the builder's evidence or lower acceptance thresholds.

## Decisions and boundaries

- Scale is 1.0. Seven large reserve plots: three uphill Terraces, four Bight Shore; retain the two small reserves.
- Preserve the fixed Bight bridge span/positions and ZIP/G1 dimensions/positions for Claude's design decision. Measure and propose a coordinated resolution; do not silently retune them to make a test green. Record the recommendation and obtain Jonathan's decision before treating changed authored constraints as approved.
- Keep `horizon-geo-1` and `horizon:horizon-geo-1`; preserve saved-position partitioning and presence trust boundaries.
- Horizon stays development-only. No main merge, deployment, Production activation, schema or data operations, or default-world switch is included.
- Only Final Confirm posts. Doors reuse existing tools; Review is not Confirm. No new financial writer, money-derived weather, or money effects from exploration.
- Do not request, inspect or use an API key to arrange review. Use Claude's ordinary signed-in workflow. This packet is the handoff; no message has been sent to another service.
- No planting, props, decorative dressing or movers until land acceptance. The explicit Classic greybox scope remains; later product treatment still requires all three themes.

## Repairs to examine closely

- Host access now considers the climb as well as plan distance. The Library foundation shares the building rotation and the Year Walk bypasses the Library and Cottage footprints; the garden path meets the Cottage spur at its endpoint and reaches the Glasshouse around its footprint with a level apron entry.
- Actual 1:6 retaining faces, rebuilt against the final graded terrain, with collision matching visible geometry.
- Closed masonry openings at separated route crossings, retaining lintels and adjacent walls. Junction openings follow the connected approach footprint, including angled approaches before the pad. Offset columns and crossbeams keep lower routes open; beams are not extended down as if they were footings. Probe headroom and complete load paths rather than checking for named objects.
- Town access grades and High Span alignment. Open-span terrain is capped below the deck without filling channels or removing tunnel roofs. The Bight spur has a new common Year Walk landing at [887.3,923.4], separate from the preserved Bight bridge design conflict. Replay every square-to-door walk using real collision; a graph connection alone is insufficient.
- A supported lower-gallery overlook at the fixed camera C coordinate, and rejection of underwater authored eyes. Check the overlook's supports, walking approach, river traffic and the High Span aperture together.
- Polygon-based district distance and camera-district priority; Lite collision matching its rendered terrain; Look mode restores its named pose.
- Where a registered threshold has incompatible fixed heights but sufficient physical clearance, the candidate constructs a separated passage and keeps the register conflict red. Review these proposals explicitly; their construction is not an approved change to the manifest.
- Fixed-frame captures and raw diagnostics remain evidence of failures when their numeric checks are red. Do not mistake an improved image for full composition acceptance.

## Reproduction

Use Node 22 or 24 and the repository's pinned pnpm. Install normal repository dependencies; do not copy a developer's node_modules or .env into the packet.

```sh
pnpm install --frozen-lockfile
node scripts/horizon/bake-terrain.mjs --check --evidence-dir /tmp/horizon-review-bake
pnpm exec vite --host 127.0.0.1 --port 5199 --strictPort
```

Open `http://127.0.0.1:5199/horizon-review.html?world=horizon&shot=A`. This isolated review harness contains no household data. Use `HORIZON_CAPTURE_GPU=metal` only on supported Mac hardware; record the actual renderer elsewhere.

```sh
HORIZON_REVIEW_URL=http://127.0.0.1:5199 node scripts/horizon/walk-proof.mjs /tmp/horizon-review-walks
HORIZON_REVIEW_URL=http://127.0.0.1:5199 node scripts/horizon/capture.mjs /tmp/horizon-review-captures
HORIZON_TIER=lite HORIZON_REVIEW_URL=http://127.0.0.1:5199 node scripts/horizon/walk-proof.mjs /tmp/horizon-review-walks-lite
node scripts/horizon/report.mjs /tmp/horizon-review-probes
node scripts/horizon/extra-evidence.mjs --root . --url http://127.0.0.1:5199 --out /tmp/horizon-review-extra
pnpm test -- --risk=high --focus=test/horizonLandRepairs.test.ts --focus-reason="Physical land repairs, route collision and view continuity"
pnpm build
```

See the delivery's `VERIFICATION.md` for actual commands/results and the raw logs. Full exhaustive test/check lanes require a separate explicit request under repository rules. Source tests, headless capture and a 390 px viewport do not certify physical Mac/iPhone acceptance. If a command times out or breaches the five-minute quick-gate budget, report it as such.

## Measured candidate status

Code `6dd7aacf1bbb3c9dae71f7e9e496455aa660b7cb`: seven of seven door walks pass in both full and Lite; 118 Horizon tests pass; the isolated High gate passes in 132.632 seconds; ordinary build and Node 22/24 asset reproduction pass. There are 68 review captures. Earlier timeout/overrun runs are retained as failed evidence alongside successful unchanged-code retries.

Land acceptance remains **NO-GO**: 186 geometry conflicts, 69 terrain-bed gap samples requiring load-path review, five failed cable crossings, eleven failed view proofs and seven failed journey targets remain. See the [repair worksession](../worksessions/2026-09-25-horizon-land-repairs.md) and delivery reports. Fixed decisions are not waived.

## Expected return

Return independent findings with measured coordinates, severity, source and keep/re-author recommendations; before/after captures at identical poses; discrete enhancement commits or a patch; a regenerated deterministic asset set; full collision-based walking and crossing results; and a concise list of decisions for Jonathan. Include failed probes and any new regressions. Deliver an updated FINISH-PROMPT for remaining work and a clear GO/NO-GO. Jonathan's visual decision and physical-device acceptance are still required for PIN-1.
