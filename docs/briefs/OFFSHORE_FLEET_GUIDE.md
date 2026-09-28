# Horizon's offshore fleet

The tandem kayak, dinghy and motorboat wait on the **east side of the float dock**, around world x1527, z1269–1283. Walk to the dock edge and use the nearby boarding action. The yacht starts anchored offshore to the southeast at x1620, z1340. Its location is shared by Walk and Island views.

## Travel and controls

- **W / up:** paddle or accelerate continuously. **S / down:** slow, then reverse. **A / D:** steer. **Space / Brake:** stop the boat.
- **E / Interact:** the first available nearby action. Other nearby actions are buttons. The touch movement and look pads remain available.
- **C:** the shared activity, first-person and floating views. Drag or use the look pad to look around. Camera choices remain active when entering or leaving a helm.
- At the yacht, approach the **stern swim platform** slowly. “Secure boat & climb aboard” moors the visiting craft and moves you the short distance onto the platform. Return to that boat from the same platform.
- On foot, use the stairs and nearby doors to explore. **Space jumps; another press while airborne opens or retracts the parachute.** Falling beside the fleet leads to swimming; approach the stern ladder to climb aboard.
- The helm is on the upper deck. Take it, raise the anchor using the nearby action or **Q**, and drive. Leaving the helm idles the engine while the vessel coasts and carries its occupants. Lower the anchor to bring it to rest for exploring or future cooking.

| Craft | Use | Character |
| --- | --- | --- |
| Tandem kayak | Quiet exploration | Slow, close to the water, tight turning; either seat can operate it |
| Dinghy | Yacht tender | Compact and forgiving at low speed |
| Motorboat | Travel | Fastest, stronger acceleration, broader turns at speed |
| Yacht | Floating destination | Slow acceleration, broad turns and deliberate stopping |

Both kayak seats are usable. An optional local companion uses the existing character figure in the other seat; this is not networked multiplayer.

## A connected yacht

A single 44 m by 14 m hull contains three connected levels. The lower deck contains the owner’s cabin, two guest cabins, bathroom, shower, crew accommodation, utility storage and engine compartment. The main deck connects the salon, indoor dining, galley, foredeck and shaded aft dining. The upper deck provides a sun deck and usable bridge. The stern platform, ladder and tender moorings remain physically connected to these spaces.

Boarding, swimming recovery, stairs, 14 doors, three seats, helm control and anchoring function now. Beds, sanitary fittings, storage dressing and engine machinery are environmental detail. The hull and interiors share the same dimensions used for collision; there are no separate room scenes.

## Galley integration points

The galley has usable 0.9 m counters and two circulation routes. A central preparation island, side counters and service pass support collection → preparation → cooking → plating → serving → dish return → washing. Indoor and aft dining are physically reachable from the galley.

Ten stable station identifiers in `movers/fleet/layout.ts` expose a work surface, approach point, facing and size: `yacht.galley.pantry`, `cold`, `prep-port`, `hob`, `plate`, `wash`, `waste`, `prep-island`, `serve` and `return` (all use the `yacht.galley.` prefix). The matching named scene objects include `.surface` attachment anchors and station metadata. Stations can be inspected now. Recipe logic, orders, timers, scoring, movable ingredients and multiplayer are intentionally not implemented.

Activity/floating views cut away obstructing decks and wall tops while aboard; first person retains the enclosing rooms. Classic Hearth, Taylor’s Scrapbook and Newfoundland have distinct material and interface treatments.

## Persistence and limits

Fleet positions, moorings, doors and supported occupancy save locally under the app’s existing identity scope. Reload validates the complete snapshot before applying it, restores boats stopped, and restores a yacht pilot on foot at the helm. Unsupported or corrupt saved states fall back safely. Device storage failure is visible in the interface.

This does not introduce cloud fleet synchronization. The existing shared wind source is currently constant; the fleet uses it and adds smooth surface motion, with ambient motion suppressed by comfort settings. There is no fuel, damage, maintenance or capsize system.

The retained browser replays use the actual Horizon runtime with a local initial-position fixture, then normal controller input and nearby interactions. They cover full outward/return trips for all three smaller craft, all 15 yacht areas and ten stations, doors and stairs, seats, moving/turning deck carry, jumping, anchoring, reload, repeated swimming recovery, airborne arrivals and all camera modes. Desktop and phone-sized browser layouts were inspected in all three themes. These are local browser checks, not physical-phone, screen-reader, live hosted or two-device acceptance. See the [worksession](../worksessions/2026-09-27-offshore-fleet.md) for measured check results.
