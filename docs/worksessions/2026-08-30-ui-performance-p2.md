# Hearth worksession — UI performance P2

- **Status:** COMPLETE
- **Opened:** 2026-08-30 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/performance-p2`
- **Baseline SHA:** `9376c30ba5db55c920d15ce3feacb65dedae5733` plus the open local D-177 Performance P2 working tree
- **Head SHA:** working tree
- **PR or issue:** none
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** none; client scheduling only

## Household outcome

The kitchen remains responsive while a shift clock is open, Home geometry follows scroll without layout-read storms, and Hercules stays visibly alive through his existing rig engine without running full room choreography behind other rooms or consequential sheets.

## Budget delta (5)

`+2` — opening or reviewing a live shift no longer forces the entire App, Office, and companion tree to render every second, leaving posting controls responsive.

## Engagement delta (3)

`+3` — Hercules keeps ambient breathing, blinking, and fast reactions. Full wandering, fly play, and the ten-second idle pounce belong to the visible Home room; secondary rooms use a quiet rig cadence and blocked sheets pause autonomous work.

## Verified baseline

- `origin/main`, branch HEAD, and the D-177 baseline were `9376c30ba5db55c920d15ce3feacb65dedae5733` when this slice opened; D-177 was then an uncommitted, independently verified local working tree underneath this slice.
- `App.tsx` owns a one-second `shiftTick` whose only visible dependency is the Add-shift elapsed label and quarter-hour pad sync, causing an App-wide render.
- `TimesheetGlance` starts a one-second timer even with no open shift; it is mounted in the Home story surface.
- `useFurniture` performs a synchronous bounding-box read for every scroll/resize notification per mounted furniture surface.
- Hercules' rig already has bounded full/compact/hidden profiles and finite 24 fps reactions, but desktop secondary rooms currently request the full ambient profile and outer fly/wander timers remain active across tabs.

## Scope

### In scope

- Isolate live shift label ticking in a small child and update the Add form only at quarter-hour preview boundaries.
- Keep idle Timesheet tiles timer-free and use minute/active cadence only while the expanded body needs a clock.
- Coalesce furniture geometry publication to one animation-frame read per surface and event burst.
- Gate Hercules Home-only choreography and use full/compact/hidden rig profiles for Home, secondary rooms, reduced/hidden state, and blocked sheets.
- Preserve ten-second idle fly pounce, direct interaction reactions, keyboard/focus, reduced motion, phone and desktop layouts.

### Out of scope

- Visual redesign, CSS atmosphere changes, Office chunk restructuring, financial formulas, shift posting meaning, cloud/sync/Auth/schema, Production data, deployment, or changing Hercules' money authority.

## Acceptance evidence

- [x] No App-owned one-second shift interval; child label remains live and quarter preview updates only when its rounded value changes.
- [x] Closed/no-shift Home Timesheet glance has no timer; expanded idle clock uses minute cadence and active shift remains live.
- [x] Scroll/resize bursts produce at most one queued furniture geometry read per frame; live drag remains frame-accurate.
- [x] Secondary rooms use compact ambient rig cadence; blocked sheets pause autonomous rig/choreography; interaction reactions remain bounded and fast.
- [x] Home still performs one ten-second human-idle fly pounce and successful capture increments the litter box.
- [x] Focused tests, 320/390/720/~1100 responsive checks, keyboard/focus/reduced-motion checks, TypeScript/build, and local UI verification pass.

## Plan

- [x] Extract live shift scheduling and remove App-wide tick ownership.
- [x] Quiesce Timesheet and coalesce furniture publication.
- [x] Apply Hercules activity profiles and Home-only choreography.
- [x] Add scheduling, modal, responsiveness, and accessibility proofs.
- [x] Run gates, close worksession, and return a local handoff.

## Evidence log

- 2026-08-30: two independent read-only audits found the App shift cascade, idle Timesheet timer, furniture layout reads, and unprofiled Hercules secondary-room work. Neither found a P0 financial or privacy boundary.
- 2026-08-30: focused UI/Office/startup gate passed 11 files / 98 tests. `tsc --noEmit`, `pnpm ai:verify`, Vite production build, Hercules companion build, `git diff --check`, and the no-`dist/_redirects` check passed. Independent `pnpm check` completed the full test stage and stopped only at the package build's Unix `rm` command on Windows; the manual build equivalent passed.
- 2026-08-30: in-app browser checks passed at 320, 390, 720, and 1100 CSS px with the correct phone/wide Office surface, no horizontal overflow, no console errors, and a visible 68×56 px keyboard focus target. The local due-item dialog correctly held Hercules in his blocked profile; component tests independently proved unblock rescheduling and the ten-second litter capture without mutating the local household.
- 2026-08-30: final independent review found and closed one phone/reduced-motion retry loop in the pounce scheduler. The effect and its recursive schedule now fail quiescent before allocating a timer; a regression test proves neither the ten-second deadline nor one-second retry is scheduled in those profiles.

## Decisions

- Preserve the animation engine and existing visual grammar. Lower cadence and pause autonomous work by context; direct reactions retain their finite high-rate lease.
- The fly and litter box are Home furniture. The requested idle pounce remains exactly ten seconds of human idle on visible Home.

## Remaining uncertainty

- Real-device CPU and battery improvement still require a Development phone/laptop trace after local deterministic proof.

## Handoff

Complete local worksession. No push, merge, deployment, hosted mutation, secret, or Production action was performed.
