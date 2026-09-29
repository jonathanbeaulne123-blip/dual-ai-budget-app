# Hearth worksession — Horizon in the old app

- **Status:** PR #573 MERGED; BOARD/RESET FOLLOW-UP NOT MERGED OR DEPLOYED
- **Opened:** 2026-09-29 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `dual-ai-budget-app`
- **Branch:** `codex/horizon-board-reset` for the follow-up
- **Baseline SHA:** `e6ee1b0a220af420699ab3b24609d10d80a2b07a` (`origin/main`, checked 2026-09-29)
- **Integration SHA:** `c6bfacf` (source commits `d16bc51`, `366443e`; this record has a later documentation commit)
- **PR or issue:** #573 (merged); board/reset follow-up PR pending
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** no follow-up deployment authorized

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
- Make the old board entry visible from across the map; restore safe-ground Retry on foot and make Reset to marker explicit on the board.

### Out of scope

- Cloud or financial mutation, schema, deployment, Production and destructive cleanup.
- The Mountain's small environmental moments and old race start/finish framing art.

## Acceptance evidence

- [x] Focused Horizon integration checks: 6 files, 47/47 cases passed.
- [x] High quick gate passed on unchanged retry: 296.769s within its 300s budget, fingerprint `17f351f1d8f345d457cccd103da000cee17bc992fe98469d691b3539fdc3d0af`.
- [x] Production build: `pnpm build` passed, including terrain checks, app and workspace typechecks, Vite and Hercules UI.
- [x] Follow-up board/reset focused checks: 5 files, 47/47 cases passed, including the affected host routing test; phone-sized fictional local browser showed entry, foot Retry, active board HUD, Reset and both touch pads.
- [ ] Follow-up High quick gate: over its 300s budget and interrupted after a test double lacked the new board method; the guard was fixed and the affected focused test passed. No clean High gate is claimed.
- [x] Follow-up Vite production bundle: passed locally after 12m 58s on the slow machine, with dependency and chunk-size warnings.
- [ ] Authenticated, cross-device and physical phone/Mac playtest, including movement, camera, transport, race and Final Confirm.

## Evidence log

- First High quick gate: failed. Its only failure was the Journey board warm median at 403.632ms against 400ms while four workers ran; typecheck and other 820 fast cases passed. The unchanged isolated case then passed at 84.2ms. The first failure remains recorded.
- Unchanged second High quick gate: `quick-gate-passed`, 296.769s, no time budget breach. TypeScript 87.021s; fast tests 117.053s; serial tests 74.627s. Same base, head and change fingerprint as the first gate.
- `pnpm build`: passed locally. The bundler reported existing browser-external and large-chunk warnings; there was no build failure.
- A local fictional-data browser view rendered the Horizon in the old shell at about 555px. Browser input was unreliable, so it did not establish the travel, train, race or money-flow acceptance.
- Source review identified and fixed stale skate state during restore/mode switch, skate/train overlap, Boathouse exit height and missing physical train companion/doors.
- Follow-up after Jonathan's feedback: the board entry was hidden away from Tideline; both resets were requested. The board now offers a direct trip to its authored park start, and the walk has an explicit Retry control.
- Follow-up local browser proof at 390×844 with touch emulation: the board entry and foot Retry were visible away from the park; boarding moved the body from the Little Harbour area `(1470, 1186)` to Tideline `(1327.9, 725.5)` and showed the old skate HUD. The month card initially covered both phone pads; after a CSS correction it was hidden during skating, with Reset and both pads visibly clear. This remains fictional loopback proof, not device acceptance.
- Follow-up High quick gate: TypeScript passed but took 304.5s, already beyond the 300s gate budget. The fast suite then found a missing `hasSkate` method in a host-routing test double; Codex stopped that run, guarded the method call, and reran that test plus the four affected files successfully (47/47). The gate's outcome remains unsuccessful for this follow-up.
- Before the follow-up could be added to #573, that PR was merged. The board/reset change was rebased as a separate branch from the merge commit `868343c` so its review contains only the follow-up.

## Decisions

See `docs/DECISIONS.md`, 2026-09-29 entry for completing the old shell's Horizon migration locally.

## Remaining uncertainty

The broad local gate verifies code and many contracts, but visual and physical-device use is still necessary before claiming the app functions exactly like the old experience. The old Mountain's small environmental moments and race framing art are not yet on Horizon.

## Handoff

PR #573 merged without the board/reset follow-up. Codex owns the separate follow-up branch. Jonathan decides on a Development release after reviewing local and device evidence. No follow-up merge or deployment is authorized by this worksession.
