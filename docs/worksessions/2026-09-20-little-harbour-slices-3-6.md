# Hearth worksession — Little Harbour slices 3–6: doors over the room, the Glasshouse, the Boathouse, WASD

- **Status:** OPEN — local branch candidate, ready for Jonathan's eye and a PR
- **Opened:** 2026-09-20 (`America/Toronto`), same day as slices 1–2
- **Assignee or AI:** Claude (architect + writer, one checkout)
- **Repository:** `dual-ai-budget-app` · **Branch:** `claude/little-harbour` (continues slices 1–2)
- **PR or issue:** none — not pushed (the session's git proxy refuses this repo)
- **Risk:** Medium (presentation and routing only; no money meaning, writer, schema, sync, Auth/RLS or Hercules payload change)
- **Environment impact:** Development only, behind `VITE_HEARTH_HARBOUR` (requires `VITE_HEARTH_HOUSE_WORLD`)

## What Jonathan asked

"Finish the last slices." From his notes still open after slice 2: the page-reflow tool opening (my own top item), the Master Planner's "whole visual and ux redesign" ("I don't understand a thing I'm looking at"), the couples features "reworked or hidden away in a small corner of the app", and "desktop users can use wasd". Plus the defect he found himself: zooming out of the Cellar handed him a doll's box on a lawn.

## Slice 3a — a room holds its camera (`fc4fed7`)

`holdPoseInRoom` (pure, `camera/poses.ts`): each room declares the box its **eye** must stay inside, the smaller box its target may wander, and its own distance and tilt limits (`PLACE_HOLDS`). Every pose passes through the standing room's hold — named poses, drags, zooms, pans, WASD and restored return slots alike. The Court is open sky and has none. A journey flies through open air, so the hold lifts for the flight and lands with it. Containment beats closeness: the `minR` floor could push an eye back through a wall the box had just taken it out of, so the box wins and a hand's breadth is the last resort. Verified in the browser: thirty wheel notches out of the Cellar leave the eye pinned at the front wall.

## Slice 3 — a door opens over the room (`15ad776`)

The one thing slice 2 could not fix inside its fence. With a door open (`data-harbour-door` on the app), the world fixes itself as a band across the top of the viewport — each place declares a **`door` pose**, a frieze built for a wide short frame: the rack close and level in the Tower, the rail at eye height in the Cellar, her portrait in the Court, the front bench in the Glasshouse — and the page arrives as a **sheet** under it, rounded and shadowed, sliding up over the room as it scrolls. A tool that is a body-level portal room (Kitty Banks' `.kitty-room`) is inset below the same band through `:root:has(…)`. The band's stage is inert while a tool is in front of it; the sheet's header carries "Put it back"; the trust chrome keeps floating above the band. The App gained one attribute, and its focus-scroll is settled back to the top after landing so the band is never thrown off screen. **No money surface changed** — the same components render, in the same states, with the same commands; they arrive over the room instead of instead of it.

## Slice 4 — the Glasshouse (`8b1d208`)

The Master Planner as a room (LITTLE_HARBOUR_v2 §3). The Study's `above` (Planner) and `below` (Calendar) both open onto one place: a glasshouse behind the Library — brick plinth, pale ribs, glass with the island showing through, the south pitch open the way the tower's wall opens toward its gap.

- **Benches by week:** this week the front bench in the light, next week behind, the month at the back; an undated pot waits at the back too. Beyond the month, the paper holds it.
- **A pot's state is its plant:** a seed until someone takes it (`acknowledgedBy`), a sprout after; done pots are the **harvest shelf** — blooms, this week's count on the plate. Nothing is deleted; it is harvested.
- **Dry, never overdue:** past its date means dry earth and a bent stem, and the brass watering can comes out. No red, no shame — Hercules's rule, kept.
- **The tag's thread:** copper Jonathan's, pine Bianca's, twisted for both, plain for nobody's yet. A chapter/plan pot carries a **stake** (the island's own mark); a goal-linked pot a **little cat** on the tag.
- **Perennials:** active rituals in the long bed. They come back on their own.
- **Doors, not commands:** a pot opens the Master Planner at its own task (`onOpen("planner", "task/<id>")`), the far pane opens the Calendar, the garden door walks to the Court. The room reads (`shapeTasks`/`taskInView`, rituals — pure, capped at 18 pots with the overflow said in words) and the paper writes. Source fences hold.
- A clear front bench keeps a seed tray and a trowel, not bare boards. Reading edition: three benches as lists, every pot a real button; distinct phone composition (along the path, between the ribs).

Routing grew one notion: **`HARBOUR_ROOMS` is by room and level**, so a row may leave a level to the house — the Standing Book (study/middle) keeps Codex's presentation until the Library is built. Ways became room-aware (`HARBOUR_PLACE_ROOMS`).

## Slice 5 — the Boathouse (`6e0c8c5`)

Together, tucked away (§5). One small timber building at the lawn's far edge by the water — hip roof, porch, behind and right of the Rook. Tapping it (or its twin) walks to the Together room, which keeps everything it holds and stays the house's own inside. Small, far, and there when you want it: the point is what it *stops* being — a quarter of the app. Its interior is a later slice.

## Slice 6 — WASD (`7cc4b1b`)

Desktop hands walk: W A S D pan the camera's target across the ground in screen space through the island's own `panDelta`, and the room's hold keeps a walk inside its walls exactly as it keeps a drag. Grabbing already rotated like a phone swipe (slice 1). The stage's spoken instructions say so.

## Verification

- `vitest run test/harbour-*.test.ts test/house-*.test.ts` — **25 files, 266 tests, 0 failures** (`test/harbour-glasshouse.test.ts` is new: benching by date, plant states, dry/thread/stake/cat, the cap, personal tasks kept off the household benches, door-only anchors, the pose hold, the draw budget)
- `vitest run test/app-startup-p1.test.ts` — **83 tests, 0 failures** (the full App, every flag unset — `App.tsx` changed this phase)
- `tsc --noEmit` — clean · flagged `vite build` — built
- Evidence: `docs/evidence/little-harbour-slice3-6/` (three themes × 390/1440: the three home places, the Glasshouse, a door open with the band and sheet, both reading editions, travel frames), plus the slice-2 set at five widths for the rooms themselves.
- **Known failure, unchanged:** the serial browser lane breaches its five-minute budget on this container; that lane needs Jonathan's machine. Not shipped, not merged, not green.

## Uncertainty and open questions

- **The Glasshouse stands household tasks** (`taskInView(..., "household")`). The vision's private side bench (your own tasks along the side wall) is not built; a personal task simply stays off the benches. Side bench = later slice.
- **Drag-a-pot to reschedule is deliberately absent**: rescheduling is a Planner write, and the harbour's fence is that nothing in a room touches a command. If you want it, it goes through the same seam the jug uses — a door onto the paper — or the fence moves, which is yours to decide, not mine.
- **The Calendar beds around the glasshouse** (months as garden beds) are a plate and a door, not yet a garden. The "one object at two distances" idea stands open.
- **The Boathouse interior** and the **Kitchen recipe-card plan** (§4 — Hercules across the table, five questions, one card) are the two big unstarted pieces, with the Library and the island walk behind them.

## Next owner

Jonathan — walk the Glasshouse with the demo habitat (`/house/study/above?seed=demo`), open a pot, zoom out of the Cellar and try to leave the room, tap the Boathouse. Then the PR. After that I'd take the Kitchen's recipe card first: it is the direct answer to "I don't understand a thing I'm looking at."
