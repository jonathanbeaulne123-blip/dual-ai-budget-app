# Skate v2 and walking integration · 2026-09-24

## Source and decision

Jonathan supplied `hearth-skate-v2.zip` and asked to merge Claude's skating work with the unfinished Harbour controls and camera task, complete open work, and make a PR. The archive's handoff and finish prompt were reviewed as proposed work and evidence, not as instructions. The verified bundle head was `b8f95274`, based on `4ffe88fb`; the integration base is current `origin/main@81285dce` (including the playable Bianca and Jonathan models). No hosted data, schema, money writer, or Production setting is part of this change.

Risk **Medium-High**: the shared renderer, rider, key routing, camera, and local recreational progress migration change together. Budget delta (5): **0**; financial meaning and Final Confirm stay in their existing owners. Engagement delta (3): **+3 intended**; skating is deeper, the six emotes remain available on the board, and walking responds consistently indoors and out.

## Integration choices

- Keep the current avatar loading/status callback while taking v2's theme-aware skater look and HUD contract. This is why the merge did not take the archive's older avatar callback block.
- Keep A left and D right in v2's input and signed steering model. Manual walking holds the visible camera heading as its WASD basis, including lateral and diagonal moves. Tap routes can turn the camera behind their travel. Shift works when pressed after a walking key.
- Keys 1–6 play their emotes on the board without dismounting. The skater look layers upper-body expressions over its planted skate pose; touch has an Emote row. E remains a skate grab.
- Repair the unfinished grind smoke loop so it releases W/G/arrow keys and stops scheduling frames when an attempt ends.
- Keep Space bound to All tools even when a skating HUD button holds keyboard focus. A focused Retry button previously took Space for itself.
- Keep the skate chase eye outside the full village building exterior. A ride begun beside the Library could put the eye inside its facade because the probe only checked thin wall collision segments. Widen the lens when that obstruction forces the camera close to the rider, and clear the wrapped household status card from the skating HUD at 320–400 px.

## Verification and limits

- TypeScript completed with an 8 GB Node heap. The default 2 GB invocation exhausted its heap; that invocation is not a pass.
- Focused Vitest: 136 tests in six files passed (Harbour body, skate model, input, feel, camera, session). The added all-six-emotes check also passed on a focused rerun (63 Harbour body tests); the final quick gate remains the acceptance measure.
- Fictional local app: board entry, the 1 key's visible wave while remaining on the board, walking return, and selecting Jonathan's 3D model then riding it were observed in the browser. The viewport was also checked at 390 px. This is browser proof, not a physical phone/controller or human feel playtest.
- Claude's supplied head reported earlier Skate Lab and simulation tests, but those results certify its older base only. The final PR needs its own quick gate and CI at the integrated head. The unfinished whole-app grind smoke script has been repaired, but the grind capture itself is not claimed as verified.
- The first clean quick gate at `0ed74ca4` exceeded five minutes and failed six 15-second timeouts under four workers (677 tests passed). The three affected files then passed together, 123/123, with one worker and a 30-second timeout. They now belong to the checked-in serial test lane; its lane contract passed. This is a scheduling repair, not a claim that the breached gate passed.
- At `6451e0cc`, the final focused quick gate passed TypeScript, AI surface, 48 files, and 785 tests in 302.906 seconds: 2.9 seconds over the five-minute budget. GitHub Core and Workers PR workflows passed. The separate unsigned native workflow failed in unchanged iOS Swift type errors and a missing Android `sdkmanager`; the shared app build passed.
- A later in-app pass confirmed Goofy selection, Space from a focused skating button opening All tools, the menu return, and 320/390/720/1100 px Classic layouts. It reproduced a blank view when starting beside the Library; the building-eye fix made the rider visible there. The new camera case passes in focused tests. These later fixes require a new integrated gate and CI at their final head.

Next acceptance: human feel playtest on keyboard and a real phone/controller; a two-device opted-in presence ride; real-grind capture; review the chase camera and emote layout in Taylor and Newfoundland. No deployment is included in this PR.
