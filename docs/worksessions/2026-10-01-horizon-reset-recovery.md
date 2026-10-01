# Horizon reset recovery — 2026-10-01

## Scope and authority

Jonathan reports that Reset is neither visible nor usable when stuck. The previous board and safe-ground reset work merged in PR #574. This follow-up started from `origin/main@123319d` and was rebased onto `origin/main@c5a6136` after the inspector PR #579 merged. It changes only local Horizon recovery and its control. No ledger, cloud, Auth, schema, Final Confirm, Production or deployment action is in scope.

Risk: Medium. Budget delta (5): 0, since position reset cannot change money or ledger state. Engagement delta (3): +1, since the character can recover from a stuck ride without reloading.

## Finding and change

The old Retry button was inside the walking-only move row. `retry()` returned false whenever a vehicle, monorail or kitchen activity was active. The control is now a separate, named **Reset position** button shown while walking or riding. The board retains its own Reset to marker or last-gate control. A non-board reset chooses the same safe walking position used on reload, finds the nearest path node and ends the current mode through the existing restore path. The active ride's live coordinates are never used as a foot landing in water or air.

The phone placement is clear of the board entry while walking and clear of the Vespa controls while riding. Classic, Taylor and Newfoundland use their respective control colors. Keyboard focus remains visible, and the target is at least 44px tall.

## Evidence

- On the rebased code, focused `test/horizon-old-shell.test.ts` and board HUD `test/skate-show-hud.test.ts`: 34/34 passed. The first post-rebase run found an old static assertion that required `startRide()` to set the emote immediately after scheduling; PR #579 added a diagnostic call between them. The assertion now allows that call, and the final run passes.
- Fictional loopback browser at 390×844 with touch: the walking button's center hit the button itself; tapping it succeeded. During a Vespa-style ride, the button stayed visible; tapping it ended the ride (`data-horizon-riding` changed from present to absent). No page errors were reported. Screenshots: [walking](../evidence/horizon-reset/phone-foot.png), [riding](../evidence/horizon-reset/phone-ride.png).
- On the rebased code, the same fictional phone at Little Harbour reported `hasSkate=true` and `canSkate=true`. Tapping **Skate the island** mounted the board, exposed the existing marker Reset and left both touch pads clear. No page errors were reported. [Board screenshot](../evidence/horizon-reset/phone-board.png).
- A standalone TypeScript check ran for more than eleven minutes without completing and was interrupted. The first Medium quick gate failed in TypeScript after 196.7 seconds: the new fallback position had an optional height, and an unrelated current-main walking-ground test had an unused `z` parameter. Both were corrected locally. PR #579 independently fixed that test parameter, so it dropped from this PR when rebased.
- The corrected Medium quick gate on the pre-rebase head passed diff check, AI surface and TypeScript (339.6 seconds). It breached the 300-second budget and failed in the selected fast tests. An isolated rerun reproduced five current-main failures: four walking-ground collar faces invert after Float32 conversion, and the harbour source fence has not listed the new `geometry` directory. None of the recovery files change that geometry or directory fence. The gate is **failed**, not green; the focused reset/HUD checks remain the direct behavioral proof.

## Open acceptance

The browser evidence is fictional and local. Physical phone and Mac, all three themes at actual device size, aircraft, monorail, yacht kitchen, and a hosted Development release have not been accepted here. No merge or deployment follows from this worksession.
