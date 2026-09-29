# Hearth worksession — Horizon in the old app

- **Status:** LOCAL IMPLEMENTATION; NOT DEPLOYED
- **Opened:** 2026-09-29 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `dual-ai-budget-app`
- **Branch:** `codex/horizon-complete`
- **Baseline SHA:** `e6ee1b0a220af420699ab3b24609d10d80a2b07a` (`origin/main`, checked 2026-09-29)
- **Head SHA:** pending integration commit (source commits `d16bc51`, `366443e`)
- **PR or issue:** pending
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** none until separately authorized release

## Household outcome

The Horizon stays inside the familiar app shell, while the old 3D rooms, Tideline skate and race, member-specific Mine doors, character choice, and Mountain monorail connect to it. Existing Simple View, Journey, ledger tools, review and Final Confirm remain their established routes. Horizon's current native movers remain available.

## Budget delta (5)

0. The Mine layer reads the existing member-scoped model and opens established tools. No ledger, accounting, Auth, sync, schema, financial writer or Confirm change.

## Engagement delta (3)

+2. The old room and skate experiences, guide and Mountain train can be reached from the map, alongside its native vehicles.

## Verified baseline

`origin/main` was PR A's `e6ee1b0`. Claude's PR B and C source commits were applied in order as `d16bc51` and `366443e`; their source content was not rewritten. The integration was built on those commits in an isolated worktree. This is a local implementation, not a live claim.

## Scope

### In scope

- Project member-specific Mine access onto the Horizon host doors, with keyboard-accessible twins.
- Add an accessible Step in guide for real views, places, skate/race, monorail, sound and vehicle controls.
- Translate the old monorail route, clock, carriage, companion and doors into Mountain v2 and keep boarding, walking and skating modes mutually consistent.
- Carry the original saved character selection into the Horizon runtime and expose cruiser styling while aboard.

### Out of scope

- Cloud or financial mutation, schema, deployment, Production and destructive cleanup.
- The Mountain's small environmental moments and old race start/finish framing art.

## Acceptance evidence

- [x] Focused Horizon integration checks: 6 files, 47/47 cases passed.
- [x] High quick gate passed on unchanged retry: 296.769s within its 300s budget, fingerprint `17f351f1d8f345d457cccd103da000cee17bc992fe98469d691b3539fdc3d0af`.
- [x] Production build: `pnpm build` passed, including terrain checks, app and workspace typechecks, Vite and Hercules UI.
- [ ] Authenticated, cross-device and physical phone/Mac playtest, including movement, camera, transport, race and Final Confirm.

## Evidence log

- First High quick gate: failed. Its only failure was the Journey board warm median at 403.632ms against 400ms while four workers ran; typecheck and other 820 fast cases passed. The unchanged isolated case then passed at 84.2ms. The first failure remains recorded.
- Unchanged second High quick gate: `quick-gate-passed`, 296.769s, no time budget breach. TypeScript 87.021s; fast tests 117.053s; serial tests 74.627s. Same base, head and change fingerprint as the first gate.
- `pnpm build`: passed locally. The bundler reported existing browser-external and large-chunk warnings; there was no build failure.
- A local fictional-data browser view rendered the Horizon in the old shell at about 555px. Browser input was unreliable, so it did not establish the travel, train, race or money-flow acceptance.
- Source review identified and fixed stale skate state during restore/mode switch, skate/train overlap, Boathouse exit height and missing physical train companion/doors.

## Decisions

See `docs/DECISIONS.md`, 2026-09-29 entry for completing the old shell's Horizon migration locally.

## Remaining uncertainty

The broad local gate verifies code and many contracts, but visual and physical-device use is still necessary before claiming the app functions exactly like the old experience. The old Mountain's small environmental moments and race framing art are not yet on Horizon.

## Handoff

Codex owns the local branch and review artifact. Jonathan decides on a Development release after reviewing local and device evidence. No merge or deployment is authorized by this worksession.
