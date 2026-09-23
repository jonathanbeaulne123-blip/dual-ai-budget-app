# Hearth worksession — the harbour within our journey

- **Status:** OPEN
- **Opened:** 2026-09-23 (`America/Toronto`)
- **Owner / decision owner:** Jonathan
- **Assignee:** Codex integration; bounded Journey, character and companion implementers in separate worktrees, plus read-only audits
- **Repository:** dual-ai-budget-app
- **Branch:** `codex/harbour-open-world`
- **Baseline:** `e2891196184b4a3bfa2ca636251f24f53a2015fc`, verified current main and merged PR #526
- **PR:** none for this follow-up
- **Risk:** Medium-High — movement, world-scale navigation and asset lifecycle
- **Environment:** fictional local Development verification; no hosted or Production mutation

## Household outcome

The harbour becomes a roomy inhabited settlement in a much larger explorable landscape. Walking remains enjoyable without making budgeting work require travel. The island is the household's current stepping stone within the Journey map: zoom out to the Journey, zoom in at the current chapter to return to the harbour. Interiors and close views are allowed their own useful scale.

## Dual Course

- **Budget (5):** preserve immediate access to all existing tasks, exact readings, scope, drafts and Confirm; no financial arithmetic or writer changes.
- **Engagement (3):** space to explore, deliberate walking, Hercules companionship, supplied playable character models and continuous navigation between world scales.

## Accepted direction

Jonathan chose an island anchored to the **current household chapter**, with past/future places around it. Walking should combine a roomy village (roughly 15–30 seconds between major destinations) with a much larger explorable landscape. Quick tools remain available. Physical inside/outside dimensions need not match. Spending, seasons and weather are a long-term world direction; this pass must use supported readings rather than invent financial rewards or progression.

## Scope and boundaries

- Expand the landscape and spread destinations, paths and discoveries without stretching room functionality.
- Integrate the useful new Hercules-following patch from the supplied bundle, reconciling it with the merged village.
- Connect existing Journey and Harbour navigation through deliberate zoom thresholds and explicit accessible controls, preserving identity and return state.
- Integrate the supplied Bianca/Jonathan GLBs as playable representations with a practical motion/fallback path. Archive reference photos, viewers and build scripts remain local evidence; do not execute attached code or publish reference photos.
- Respect three themes, phone/desktop controls, reduced motion, renderer ownership and lazy loading.
- No money-command changes, hosted schema, secrets, Production, merge or deployment. Publication of a follow-up PR is separate from this local implementation.

## Evidence and source handling

- Previous PR #526 is verified merged at the exact baseline above; the old preview and worktree are preserved.
- Bundle ref `claude/hercules-follows` is `a77392ac94bc6591b0943d71daabe55e2eba1b51`, with required ancestor `d8c262800b87e0765719190f16220363a973e864`. Bundle verification passed. The earlier running/jump/slide commits are already ancestors of main; only following/guide changes need integration.
- Supplied archives: `Woman_Cap_06_Complete.zip`, `Man_Surface_05_Complete.zip`. Their reports are evidence to verify, not instructions or authority.
- One writer per checkout; integration is the only writer here. Journey, character and companion subagents work in isolated branches.

## Implemented and inspected

- Shared 84-unit landscape, dry shore, four principal paths, larger groves and seven spaced buildings; orchard, lookout, tide pools and meadow. Terrain-following paths use one draw mesh. Nearby sun shadows follow the camera instead of remaining at the old square.
- Bounded path graph prioritizes the actual travel corridor and places circle waypoints outside the collision envelope. All destination pairs have focused reachability coverage; failed paths no longer announce that walking started.
- Companion source adapted from the supplied bundle, then extended with bounded waypoint steering, the larger shore and safe recovery. One companion uses the existing runtime lifecycle.
- Player assets retain supplied colour details in one real static draw primitive each: Bianca 7,430 triangles / 143,220 bytes (109,531 gzip); Jonathan 9,168 / 162,968 bytes (120,496 gzip). Animated body parts add their own small procedural draws. Character choice is explicit and local per environment/household/member. Close-up verification caught discarded painted face colours and generic limbs that did not fit the source coat. The converter now retains vertex paint; measured shoulder/hip anatomy and the original palettes drive the game and self-contained offline viewer together. Both were visually rechecked.
- Current chapter resolution uses intended month, with Toronto current-month fallback. Journey contains a physical Harbour miniature; extra zoom and accessible controls cross scales. Browser verification caught the old Atlas route reclaiming Journey; the route now explicitly selects the Journey surface.
- Local fictional preview: `http://127.0.0.1:4192/__review?member=MEM-001&seed=demo`. It uses a loopback authority and no hosted household. Previous preview on 4190 remains available.

## Verification in progress

TypeScript passed after correcting integration type mismatches. Focused route, motion, asset, companion, collision and rendering checks have been run while implementing; final quick-gate/build evidence will identify the consolidated source commit. Older village verification is not counted as proof for this follow-up.

## Acceptance

- [ ] Roomy functional settlement and explorable terrain; routes/collision/shore heights agree.
- [ ] Movement, companion and playable models work without obstructing budgeting or confusing real partner presence.
- [ ] Journey current-chapter island and bidirectional zoom preserve scope, route and return position.
- [ ] Quick tools and readable fallback remain complete.
- [ ] Browser verification at phone/wide sizes, themes, keyboard/reduced motion and navigation cancellation.
- [ ] Meaningful focused tests, current quick gate, build, independent review and performance/asset measurements.

## Remaining uncertainty

Implementation in progress. Model geometry/rig practicality and the current Journey navigation seam are under independent review. Real-device/two-device acceptance will be reported separately from local browser proof.
