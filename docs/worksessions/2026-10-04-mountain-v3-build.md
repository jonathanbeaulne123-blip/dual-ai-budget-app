# Hearth worksession — Mountain V3 · the Highlands and the Falls

- **Status:** OPEN (PR to open)
- **Opened:** 2026-10-04 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Claude (design lead, implementor)
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `claude/mountain-v3`
- **Baseline SHA:** `4b89d03` (origin/main, 2026-10-05)
- **Head SHA:** see the PR
- **PR or issue:** to open
- **Risk:** Medium-High
- **Decision owner:** Jonathan (D-M11 recorded; names, buildings, view page open)
- **Environment impact:** none (dev-gated Horizon bake; no household data, no hosted change)

## Household outcome

A highland worth climbing round Mountain v2: a glacier that feeds six falls, a hamlet on uneven benches, the Rim Bridge over Horizon Drive. See `docs/horizon/MOUNTAIN_V3.md`.

## Budget delta (5)

0. No V3 water, bench or structure reads household state (CONTRACT §2.2); `BasinReading` at L01 untouched.

## Engagement delta (3)

+2 target.

## Creation Card

- **What it is:** the high country round the mountain, with the water that runs off it.
- **Everyday names:** Glacier Peak, the Twin Tarns, Bench Hamlet, Westwatch Chapel, Fallswatch, Veil / Rillcut / Long / Spur / Stair Falls, Split Wall Gorge, the Rim Bridge, High Shieling Ranch (proposed).
- **The job:** a reason to climb; on foot, by cruiser and bicycle (the Rim Tunnel), from the air, on the map.
- **Kinds:** ground and landform; water; structure (tunnel, stairs, footbridges); route; planting and map (owed).
- **Where:** Horizon x 985–1620, z 280–770; Crown, Prow, Hollow.
- **Identity:** unique at the top (the horn, the Veil), blended at the edges (benches into heath).
- **Risk:** Medium-High. **Jonathan's calls:** names; v2 edits (granted in his instruction); view poses; buildings; the ranch plan.

## Verified baseline

- Facts: `main` bake 138 conflicts; `horizonWave4` and the arm64/canvas suites fail on `origin/main` in this environment (run in a worktree at `4b89d03`).
- Inference: none of the baseline failures touch V3's files.

## Scope

### In scope
Landform, water and falls; manifest v3.0 routes, stairs, tunnels, footbridges, places, names; the Year Walk re-route; bake and byte-exact check; tests; records.

### Out of scope
Buildings, map glyphs, audio, seat audits, a V3 view page, the ranch editor.

## Acceptance evidence

- [x] Bake gate clean; 138 conflicts (= main); `horizon:check` byte-exact
- [x] `horizon-mountain-v3` + land suites green; changed tests carry reasons
- [x] Before/after captures at five cameras (`docs/horizon/evidence/mountain-v3/`)
- [ ] Quick gate result in the PR
- [ ] Two blind reviews (owed; one-writer session)

## Plan

- [x] Landform and water layer (18 bake iterations to a clean gate)
- [x] Rim Bridge: tunnel, bore, ridge, steps; Rim Walk to Westwatch
- [x] Long Falls added for the bare west face
- [x] Records: D-M11, book, handoff, AI_HANDOFF, LOOK.md
- [ ] Commit, push, PR, drive CI

## Evidence log

- 2026-10-04 bake 17: the Year Walk's Hollow descent met the September pad's level pins (36 × 14 at 40) and stepped 1.84 eu off the lake-rim trail → the walk keeps its v2.7 control at `[1052,662]`; gate clean.
- 2026-10-04 bake 18: Long Falls, the Long Cut and the Long Beck; gate clean.
- 2026-10-05 bake 19/20: Tarn Link lengthened (its own banks), lake-rim trail pinned level over the Veil Footbridge (Year Walk flush within 2 cm again), walks on v2's land region-carried (seam 1.37 → 0.43), gorges carry a rock shoulder on the low side, Split Wall's upper reach moved off v2's footprint edge, Rillcut's last reach lowered below the plateau edge; gate clean, 138 conflicts, byte-exact.
