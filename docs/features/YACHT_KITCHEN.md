# Yacht Kitchen

Yacht Kitchen is an optional local cooking game aboard the existing Horizon yacht. Its results, ingredients, waste and cosmetic rewards never write household money or budgeting-task evidence. Implementation and verification evidence are recorded in the linked worksession.

## Start aboard the yacht

Travel to the offshore yacht using the fleet, board at its stern, and walk upstairs to the main-deck galley. Approach the physical **Yacht Kitchen** menu board beside the pantry and press **E**, or use the nearby menu button. Choose a service and one or two chefs, then ready up. Starting drops the existing anchor and reserves the helm until you return to exploration. It does not move the vessel to a separate kitchen.

You can retry from results, select another service, or return to the yacht. To begin a galley-only service after ending on the outdoor deck, close the menu and walk back inside. Opening Hearth tools or leaving the window pauses both chefs and all cooking, order, hazard and trolley timers. Resume is explicit.

## Controls

| Action | Keyboard | Standard controller |
| --- | --- | --- |
| Move relative to the view | WASD / arrows | Left stick |
| Pick up, place, combine or serve | E | A |
| Prepare, wash, extinguish; secure/release trolley | F | X |
| Toss a cool loose ingredient to the marked destination | R | B |
| Choose stored ingredient or item on a shared surface | Q | Y |
| Ready | Enter | Start |
| Shared pause / resume | Escape | Start |
| Change solo view | C | Kitchen view button restores the recommended camera |

Preparation defaults to press-to-start/stop. Hold-to-work is available in the assists. Touch controls provide movement and the same actions. Co-op requires keyboard plus a connected controller, or two connected controllers; each chef has independent input and a visible connection label. A disconnected controller keeps its chef assignment, pauses the service, and returns its held item safely. Reconnect it or choose **Continue with one chef**.

Chefs can share a preparation counter by placing and picking up items with E/A, and can toss compatible loose ingredients across clear space. Hot food and completed plates are carried. Counters with multiple items use Q/Y to select a slot. Walk away from a preparation task to stop it; partial work remains.

## Menu and services

- **Garden salad:** chopped tomato and lettuce.
- **Tomato bruschetta:** toasted bread and chopped tomato.
- **Grilled fish plate:** cooked fish and prepared lettuce garnish.
- **Tomato pasta:** boiled pasta and cooked chopped tomato sauce.
- **Deck burger:** grilled patty, chopped lettuce and tomato, and bun.

All dishes need a clean plate and an active matching order. Pick up the finished plate and deliver it at the pass, or use the trolley during Captain’s Banquet. Dirty plates return after six seconds; take them to the sink and prepare to wash. Three plates circulate in solo, four in co-op. The waste bin clears mistaken food and returns plates for washing. An unattended appliance can burn food and, with hazards enabled, start a contained fire. Carry the extinguisher to it and prepare before removing burnt food.

| Service | Rules |
| --- | --- |
| First Service | Guided bruschetta, delivery and washing; no countdown. |
| Lunch at Anchor | Four-minute galley service. |
| Sunset Deck Service | Galley preparation, outdoor grill and dining pass; 4½ minutes. |
| Captain’s Banquet | Five-minute service with a bounded trolley: load at LOAD, release, walk to SERVE and secure, then return it for the next load. |
| Practice / relaxed | Cycles all five recipes without a clock or expiring orders; extra cooking forgiveness and fires off by default. Finish with the visible button or Enter. |

Assists adjust cooking forgiveness, patience, warnings and preparation input. Scores, sequence bonuses and ratings are recreational. Earned apron, sea-glass inset, outdoor table runner and captain’s memento appear on this yacht. Results and interrupted sessions are saved together on this device, scoped to the environment, household, member and view. They do not synchronize across devices. For an interrupted service, return to the galley menu board and choose Resume service; it restores paused until you explicitly resume. Failed storage is reported; replaying a result does not grant it twice.

## Implementation and tuning

- `src/harbour/horizon/kitchen/config.ts`: recipes, ingredients, preparation/cook/burn times, service lengths, patience, order limits, thresholds and trolley docks.
- `model.ts`: deterministic fixed-step rules, capacity-aware orders, scoring, single item ownership and validated session restore.
- `geometry.ts`, `camera.ts` and `activity.ts`: actual yacht collision, physical entry, camera/input ownership, moving frame, pause and recovery.
- `input.ts`: independent controller assignments, dead zones, stable targets and toss destinations.
- `storage.ts`: identity-scoped recreational results and once-only cosmetic rules.
- `KitchenHUD.tsx`, `kitchen.css`, `art.ts`, `audio.ts`: themed presentation, food states, chefs, local attachments and optional sound cues.

The kitchen uses the existing yacht galley and deck fittings. It has no separate map, weather system, online session or financial progression system. The temporary deck grill and trolley appear only in their service. Existing furniture and persistent personal objects are retained.

## Evidence and acceptance limits

See `docs/worksessions/2026-09-27-yacht-kitchen.md` for the measured final gate and exact artifacts. Engine tests cover all recipes, all five services with one/two chefs, burns/fire recovery, finite dish circulation, invalid combinations, simultaneous ownership, pause, frame-rate equivalence and corrupt saves. Activity tests traverse real collision geometry through the complete introduction. The browser replay is `scripts/horizon/kitchen-proof.mjs`; it uses normal movement/actions, accelerated simulation and virtual Gamepad API samples after an explicit development arrival fixture.

Browser evidence distinguishes implemented co-op from physical-controller acceptance. Human two-player play, physical iPhone/controller feel, long-term balance, screen-reader play and authenticated end-to-end opening of budgeting tools remain manual acceptance work. Runtime pause, input restoration and the existing Hearth tool integration are covered separately. No Production, schema, deployment or financial writer was exercised.
