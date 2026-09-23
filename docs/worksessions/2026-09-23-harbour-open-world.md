# Hearth worksession — the harbour within our journey

- **Status:** CLOSED — local implementation verified; publication remains separate
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

## Verification

- **Consolidated source:** `b244c57dcd54a6a94e42529adbb7e26f39f76c36`, clean when the final gate started, against baseline `e2891196184b4a3bfa2ca636251f24f53a2015fc`. The closing handoff only adds documentation/evidence after this source commit.
- **Required `pnpm test`: passed.** The affected-path quick gate selected 89 files: 885 tests in the fast lane plus 128 in the serial lane, **1,013 total**. Diff/AI surface checks and main TypeScript passed. Duration 351.3 seconds exceeded the advisory 300-second budget; the serial lane took 198.7 seconds. This is a passing gate with a disclosed time-budget breach, not an exhaustive full-suite run.
- **Build: passed.** Workspace TypeScript, Vite production build (21.05 seconds), Hercules Pro UI build, generated player/viewer presence and the `dist/_redirects` absence check passed. Vite retains its large-chunk advisory; no threshold was raised. Windows-safe underlying build stages were used in place of the shell-specific cleanup wrapper.
- **Focused regression proof:** all destination pairs in both render tiers; every visible road segment; actual wrapped Cellar arrival-to-stair traversal; shared companion navigation/animation targets and settling after distant errands; chapter intended-month handling; bidirectional Journey routes and scope; source paint preservation, avatar fit and already-aborted loads. Earlier failing small-world assumptions were updated; actual Cellar obstruction, companion loops and model conversion defects were corrected.
- **Independent review:** separate read-only reviewers inspected the world/Journey/companion integration and the character conversion/geometry. Their findings led to the intended-month fix, painted-face preservation, measured anatomy and pre-cancelled-load cleanup. Final incremental review at `b244c57d` found no further blocker, including the single sharing-control mount. Reviewers' source inspection is distinct from root-run tests and browser proof.
- **Browser:** fictional local app at 1440×900 and 390×844, with Classic, Taylor and Newfoundland checks, reduced motion, keyboard operation, readable fallback, quick travel and book return. Phone closest Journey zoom enters Harbour at the open household chapter; additional outward Harbour zoom returns to that chapter. Explicit controls and Journey close return correctly. Scope and saved position survive the crossing. Bank → All tools → Standing Book shows exact supported figures and returns to the Bank. Escape stops an active walking route. The repaired Cellar entrance is clear. The phone map retains the full sharing explanation/toggle without covering room controls; sharing remained off.
- **Character/browser proof:** Jonathan idle/wave and Bianca walking inspected in the self-contained viewer, which now uses the real game pose implementation. Bianca completed the orchard-to-meadow route in the app; Hercules settled beside her. Final browser error log was empty. Character selection persisted across reload. Appearance restored to Classic / device motion / illustrated; temporary viewport override reset.
- **Observed rendering, not a benchmark:** a resting full-tier meadow frame reported 42 draw calls, body 0.138 ms and renderer 1.19 ms. The island overview reported 352 draws, body 0.107 ms and renderer 2.30 ms. These are individual desktop-browser observations, not real-phone frame-rate guarantees. The two static player surfaces remain one primitive each and under 10,000 triangles.
- **Source hygiene:** no new environment file, credential, workbook, chat, source archive or reference photo is tracked. Original checkout and old preview remain untouched. No push, PR, merge, deployment or hosted data operation was performed for this follow-up.

Machine-readable gate/build/browser summary: [verification evidence](../evidence/harbour-open-world/verification.json).

## Acceptance

- [x] Roomy functional settlement and explorable terrain; routes/collision/shore heights agree.
- [x] Movement, companion and playable models work without obstructing budgeting or confusing real partner presence.
- [x] Journey current-chapter island and bidirectional zoom preserve scope, route and return position.
- [x] Quick tools and readable fallback remain complete.
- [x] Browser verification at phone/wide sizes, themes, keyboard/reduced motion and navigation cancellation.
- [x] Meaningful focused tests, current quick gate, build, independent review and performance/asset measurements.

## Remaining uncertainty

Real-phone touch feel, thermal/battery behavior and two-device shared walking have not been accepted on physical devices. Supplied models are static authored surfaces on a procedural biped, not newly authored skeletal animation clips. Wider weather/season simulation and more spending-driven world evolution remain future work; no invented financial progression was added. Vite's bundle advisory and the quick-gate timing breach remain visible.

## Next recommended action

Jonathan's play-through of the new local preview, especially the short village routes and longer orchard/meadow paths, followed by a separately authorized follow-up PR. Keep financial meaning and immediate tools intact while refining the next world behaviors.
