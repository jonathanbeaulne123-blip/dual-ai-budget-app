# Skate v2 and walking integration · 2026-09-24

## Source and decision

Jonathan supplied `hearth-skate-v2.zip` and asked to merge Claude's skating work with the unfinished Harbour controls and camera task, complete open work, and make a PR. The archive's handoff and finish prompt were reviewed as proposed work and evidence, not as instructions. The verified bundle head was `b8f95274`, based on `4ffe88fb`; the integration base is current `origin/main@81285dce` (including the playable Bianca and Jonathan models). No hosted data, schema, money writer, or Production setting is part of this change.

Risk **Medium-High**: the shared renderer, rider, key routing, camera, and local recreational progress migration change together. Budget delta (5): **0**; financial meaning and Final Confirm stay in their existing owners. Engagement delta (3): **+3 intended**; skating is deeper, the six emotes remain available on the board, and walking responds consistently indoors and out.

## Integration choices

- Keep the current avatar loading/status callback while taking v2's theme-aware skater look and HUD contract. This is why the merge did not take the archive's older avatar callback block.
- Keep A left and D right in v2's input and signed steering model. Manual walking holds the visible camera heading as its WASD basis, including lateral and diagonal moves. Tap routes can turn the camera behind their travel. Shift works when pressed after a walking key.
- Keys 1–6 play their emotes on the board without dismounting. The skater look layers upper-body expressions over its planted skate pose; touch has an Emote row. E remains a skate grab.
- Repair the unfinished grind smoke loop so it releases W/G/arrow keys and stops scheduling frames when an attempt ends.

## Verification and limits

- TypeScript completed with an 8 GB Node heap. The default 2 GB invocation exhausted its heap; that invocation is not a pass.
- Focused Vitest: 136 tests in six files passed (Harbour body, skate model, input, feel, camera, session). The added all-six-emotes check also passed on a focused rerun (63 Harbour body tests); the final quick gate remains the acceptance measure.
- Fictional local app: board entry, the 1 key's visible wave while remaining on the board, walking return, and selecting Jonathan's 3D model then riding it were observed in the browser. The viewport was also checked at 390 px. This is browser proof, not a physical phone/controller or human feel playtest.
- Claude's supplied head reported earlier Skate Lab and simulation tests, but those results certify its older base only. The final PR needs its own quick gate and CI at the integrated head. The unfinished whole-app grind smoke script has been repaired, but the grind capture itself is not claimed as verified.

Next acceptance: human feel playtest on keyboard and a real phone/controller; a two-device opted-in presence ride; review the chase camera and emote layout at the target widths in all three themes. No deployment is included in this PR.
