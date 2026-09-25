# The Horizon — NOT THIS

The Mountain v2 dissection, turned into a checklist. Every builder ticks it before handoff; every reviewer ticks it again (`REVIEW-BRIEF.md`). A ticked box means "we did not do this"; an unticked box is a MAJOR at least.

## Land

- [ ] **Terrain as cones, flat discs, a sine ripple and trenches.** Instead: one continuous authored heightfield, each landform in its `MANIFEST.landforms[*].h` band, blended over 8–20 m.
- [ ] **Plateau-cones** (districts as flat discs on 0.8-slope cones). Instead: each place sits in its landform's shape: a bowl, a rise, a terrace, a gorge, a plateau.
- [ ] **Equal bands** (every level the same height step). Instead: bands from the manifest, asymmetric, contour radius varying ≥ 25 % around the compass.
- [ ] **A summit sheared by an edge fade.** Instead: the Crown's summit at `landforms.crown.summit`, the island's highest point, whole.
- [ ] **A gorge 2–9 u deep.** Instead: the Notch cut 25–45 m below the terrace, 40–70 m wide, strata walls, the river on its bed.
- [ ] **A river floating above its banks.** Instead: water in its bed, below both banks, descending downstream.
- [ ] **Sea showing through inland ground.** Instead: terrain above sea level everywhere inside the outline except named water.
- [ ] **Climbable 77° cliffs.** Instead: a walkable-slope limit; steeper faces are rock with strata you cannot walk.

## Roads and lines

- [ ] **Ladder roads** (near-straight traverses stacked with hairpins). Instead: roads that follow the land, 4–6 % typical, every stretch over 8 % listed, nothing over 12 %.
- [ ] **Ribbons** (zero-thickness FrontSide roads). Instead: decks ≥ 0.6 eu with kerbs, shoulders and an underside.
- [ ] **Drops with no edge.** Instead: a parapet with coping on every edge whose drop exceeds body height.
- [ ] **Destinations off the road on two-point planks aimed at building centres.** Instead: every door on an apron on a bed, approached square to the door.
- [ ] **No path between districts; no stairs.** Instead: walks and trails between every neighbourhood, stairs with a ramp twin, the seven doors step-free.
- [ ] **Plots off the road with no link, one at 73 %.** Instead: every reserve pad graded, walled and served by a lay-by or spur.
- [ ] **A 1.4 u lip blocking town from mountain.** Instead: every bed joins the next flush or at a threshold.
- [ ] **Every crossing a collision.** Instead: every crossing in the register, `over`, `under` or `threshold`, built.

## Structures

- [ ] **Floating planks** (rail-less skill branches 26 u in the air). Instead: shelves and lines on supports, with rails, or on the ground.
- [ ] **Invisible grind rails.** Instead: rails that are kerbs, walls, bollards, logs and bridge rails you can see.
- [ ] **A buried dam** (5/16 u above the rim, in a pit, a land bridge through the basin). Instead: the dam standing proud, its south face to the square, nothing in the basin.
- [ ] **Furniture inside the basin.** Instead: the lake is water; `L01` beside the dam is the only instrument.
- [ ] **Floating pennants, tori, text planes, labels in the sky.** Instead: nothing hovers; names on signs, milestones and plates in the world, and on the screen-space guide map.
- [ ] **A cable bowing upward.** Instead: every cable sags between visible towers.

## Movement

- [ ] **Boarding as a form and a teleport.** Instead: walk onto the platform, accept the ride, sit in the cabin.
- [ ] **The rider not in the cabin.** Instead: seated, clipped or standing in the vehicle, visible.
- [ ] **Invisible dead-stop walls.** Instead: a lip you can see, a slope you cannot climb, or water you fade back from.
- [ ] **Edge teleports.** Instead: a 300 ms fade to the nearest dock, apron or shore, and only at water or a landing.
- [ ] **No downhill on the board** (travel assist everywhere). Instead: a slope term; assist only in the Tideline park.
- [ ] **The finish in the sea.** Instead: the Landing quay finish (`structures.landingQuay`, on the islet between the Reach's west channel and the river) with a 25 m run-out on land, kerb-separated from the road.
- [ ] **Retry cancelling the race.** Instead: Retry restarts from the start gate in every state.
- [ ] **A funicular reversing seven times.** Instead: progress that never reverses mid-line.
- [ ] **Feet off the ground on the phone lattice.** Instead: the body on the surface query at every tier.

## Camera

- [ ] **A camera that cannot look above the horizon** (the dam and the mountain never in frame). Instead: the horizon in frame on every walk, ride and flight camera; the dam and the Crown visible from the square.
- [ ] **A walking camera 29° down.** Instead: Walk 12° (Grand Plan ch. 6).
- [ ] **Handoffs whipping 190 u.** Instead: a handoff swings ≤ 30 eu or cuts.
- [ ] **Leaving a building parks the camera in town.** Instead: return to the apron, facing out.
- [ ] **No ride camera.** Instead: every mode its own camera (Grand Plan ch. 6).
- [ ] **Zoom-out ejecting to Journey.** Instead: overview never triggers Journey.
- [ ] **Overlooks facing away from the buildings.** Instead: poses that frame their subjects (the twelve pages).
- [ ] **The Look camera ignoring terrain** (eye under ground). Instead: the eye always above ground and outside solids.

## Art

- [ ] **Cone trees the colour of the grass.** Instead: species cards with archetypes on visible trunks, crowns ≥ 10 L* darker than the turf.
- [ ] **Uniform scatter with bald rings around districts.** Instead: clearings first, then groves and drifts; no bare band wider than 3 eu round any structure.
- [ ] **Bullseye rings of flowers.** Instead: single-species drifts 3–8 eu with a second species threading the edge.
- [ ] **Tint-only districts** (nearest-centre colour plus 0–7 props). Instead: each neighbourhood its own ground, planting, materials, light, sound and weather (`STYLE §2`).
- [ ] **Box-plus-pyramid storefronts; a glassless glasshouse.** Instead: plinth, walls, recessed door, window with depth, eave with underside, sign on brackets; glazing bars and panes.
- [ ] **A dressing that is a palette swap.** Instead: Classic, Taylor and Newfoundland change materials, roofs, joinery and ornament.
- [ ] **The sun lighting slopes head-on; no shadows.** Instead: one sun from the clock, stacked shadows that swing with `?sun=`.
- [ ] **Fog so far the island reads flat.** Instead: `STYLE §1.8` fog: the Crown a silhouette from the square, never a void.
- [ ] **District pop-in at 75/99 u, synchronous.** Instead: districts fade in from the fog colour over 0.8 s; ≤ 1 built per frame.
- [ ] **A terrain bake at module evaluation.** Instead: a baked asset under `public/`, keyed by the geography revision, loaded async.
- [ ] **The card kit existing and unused.** Instead: every object on screen from the painted-card kit.

## Reconciled to MANIFEST v1.1 (reviewer)

- "The finish in the sea": the quay finish is now the Landing quay on the river's west bank (`structures.landingQuay`), not the town quay.

### v1.2 deltas (reviewer, MANIFEST v1.2)

- The S1 finish is on the Reach islet, not the west bank.
