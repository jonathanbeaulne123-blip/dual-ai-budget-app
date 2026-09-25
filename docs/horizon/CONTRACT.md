# The Horizon — CONTRACT

Version 1.5 · 25 September 2026 · Owner: Jonathan (product) · Author: Claude (design lead, review) · Builders: Codex (terraforming), Claude subagents (movers, kit, neighbourhoods, pastimes)

This file is the law of the island. Every agent on every pass reads it first. If a brief, a chat, or a good idea conflicts with this file, this file wins until Jonathan changes it here.

The three files every agent reads: `CONTRACT.md` (this: schema and hard rules), `MANIFEST.json` (every number), `STYLE.md` (how it looks). `LIGHT.md` is the fourth: the sun, which touches all three. `SCALES.md` is the fifth: the Journey map and the world as two scales of one place, which decides the first screen, the zoom and the world overlay.

---

## 1. What is fixed and what is being built

### Fixed (never touched by any island pass)
- Money semantics, commands, owners, scope checks, `BasinReading`, the Fund/Kitty/Prepare rules in `src/core/`. No island pass edits `src/core/`.
- The seven building hosts from `src/harbour/village/layout.ts` (`VILLAGE_SITES`) and the twelve Harbour place IDs: `court`, `kitchen`, `tower`, `cellar`, `atlas`, `bank`, `library`, `glasshouse`, `kiln`, `cottage`, `boathouse`, `campfire`. Their tools, owners and room projections (`src/harbour/data/reading.ts`) are unchanged.
- The Mandevilla Queen and chess-piece asset masters. Hercules's figure and wardrobe.
- Presence, streaming, gate and surface/collision contracts from Mountain v2 (`CONTRACT.md` in `~/Downloads/hearth-mountain-v2`), extended per §4, never replaced.
- Auth, RLS, schema, sync envelope, Worker, deployment. Any change there is a Codex trust review, not an island pass.
- Reduced motion, calm view and the flat/Reading edition (the Desk). The 3D island never gates the flat edition.

### Being built
- One island: the Horizon, per `MANIFEST.json`. One `WorldDefinition` (§4), one ground lattice, one light rig, one sea.
- Ten modes of movement, four skate lines, one ring road with spurs, seven neighbourhoods, the Undercroft, the sky, fourteen pastimes, the year, the sun.

---

## 2. Hard rules (apply to every pass, every file)

1. **Play earns nothing.** No pastime, view, lantern, race, flight or find changes, unlocks, scores, nudges or displays any financial state. No streaks, no daily rewards, no "come back tomorrow".
2. **Nature never encodes money.** Only `L01` (the Fund instrument beside the dam) reads `BasinReading`. The lake, river, sea, weather, sun, bloom and snow follow the calendar and the almanac, never a balance.
3. **No fake life.** Never counterfeit the partner's presence, activity or position. A peer on another geography revision is shown as *unavailable*, never at a wrong place.
4. **You always choose the switch.** No silent mode change. Every mode boundary is a visible threshold with a deliberate action (park, dismount, untie, clip in, step off, walk the gangway). "Board by proximity" means the offer appears by proximity; the action is still yours. No invisible walls: an edge is a lip you can see, a slope you cannot walk, or water you fade back from.
5. **Structures are real.** Every bridge has a thickness, supports and an underside you can stand beneath. Every tunnel has a ceiling and a camera-compatible interior. Every ramp, kicker, rail or bowl is landscape or architecture that would be there anyway; no floating props.
6. **The empty centre is protected.** The Green's inner 160 m radius (`MANIFEST.json → protected.green`) holds no building, no plot, no prop taller than a bench. Reserves (§5) are the only future-building land.
7. **Every crossing is resolved.** Where two lines meet on the map, the crossing is either separated in height (a listed structure) or a threshold. The crossing register in `MANIFEST.json → crossings` is complete; an unlisted crossing is a bug.
8. **Step-free twin.** Every stair on a required route has a ramp or a path alternative. The seven doors are reachable on foot without stairs.
9. **Money is one tap away everywhere**, including underground, in the air and on the water: the quick layer is never hidden by a mode.
10. **Accessibility is not a tier.** Reduced motion turns flights and rides into cuts, freezes the sun at afternoon (`LIGHT.md`), stills the flock; calm view keeps the island still, silent and lit. Every fact and destination remains reachable in the Reading edition.
11. **Three dressings are authored, not tinted.** Classic, Taylor and Newfoundland each have their own material language per `STYLE.md`. Palette-only differences are a defect.
12. **Fictional data only** in every test, render, harness and evidence capture. The `mountain` review household or a successor; never Jonathan and Bianca's data.
13. **Names are frozen.** `MANIFEST.json → names` is the ID vocabulary. No agent renames; Jonathan changes names in the manifest and a migration follows.
14. **One geography revision per pass**, never per commit. Saved body positions carry `geo`; a mismatch migrates to the nearest path node. The presence `world` string bumps with it, browser and Worker together (a Codex trust review each time).
15. **The Journey map is home, and the world is the same place at another scale.** Sign-in lands on the Journey map (the Horizon at LOD 0); every ordinary task is done from it; stepping in is a change of scale on shared coordinates, never a different island (`SCALES.md`).
16. **One world model.** Household state and history derive a `WorldOverlay` on read, pure and never stored; the Journey renderer, the world renderer and the Desk read the same overlay. Nothing about the land is stored or synced. Editing, deleting, refunding or reclassifying re-derives; "what changed here" is a read of the receipt log.
17. **The world always shows now.** The detailed world renders today's sun, today's beds and today's facts; entering from a past period lands at that period's bed with a banner, never a past world pretending to be present.
18. **The household's own things may show wear; the island never does.** Physical condition appears only on the homestead's timber and plants, under eligible evidence, rule-bound, explained and repaired on the same site (`SCALES.md` §5, D19, D24). The seven hosts, the terrain, the water, the weather and the sun never encode money.
19. **The day is the unit of time.** One `dayLedger` read model (pure) is the only source of what a day holds; the stones, the strip, the Calendar, the Desk's Leaving page and the camp card read it. Nothing on the ground encodes money; scheduled things are explicit markers on their stone (`TIME.md`).
20. **A plan is a recipe card with four views** (wall, stake, slip, cat), all derived from one `PlanLine`; the card never posts money; the month closes only at the Campfire's five-beat ritual (`TIME.md` Part 2).
21. **Evidence or it didn't happen.** A pass is complete when its acceptance renders (`§7`) exist from a real phone and a real Mac, not from a headless harness alone.

---

## 3. Coordinates and scale

- Concept space: `x` east, `y` south, origin top-left of `MANIFEST.json → extent` (2000 × 1800 concept metres). In the engine `y` becomes `z`; `up` is `+y`.
- **Engine units = concept metres × `MANIFEST.json → scale.factor`** (confirmed 1.0 by Jonathan, 25 September 2026; D13), applied to x, y and height alike. The manifest selects the full-scale journey estimates and retains the 0.6 comparison; original timing targets remain acceptance targets. Heights are metres above sea level; sea level is `0`.
- North is `−z`. The sun rises over the Needle's Eye (east) and sets over the Flats (west); see `LIGHT.md`.
- Route control points are centrelines; widths come from `MANIFEST.json → profiles`. Control points are design intent for the land pass to solve into splines; they are not navigation or collision data until baked.

---

## 4. WorldDefinition v3

The single authoritative description of the island. Terrain surfaces, collision, the path graph, plot doors, overlays, streaming bounds, the guide map, the flight envelope, presence bounds and saved-position validation all derive from it. Nothing reads geometry from anywhere else.

```ts
interface WorldDefinition {
  id: 'horizon';                       // presence world id prefix
  geographyRevision: string;           // 'horizon-geo-1' … bumps once per pass
  extent: { w: 2000; h: 1800 };        // concept metres
  seaLevel: 0;
  heightfield: HeightfieldRef;         // baked asset, cache key = geographyRevision
  water: WaterBody[];                  // lake, tarn, river, brooks, sea, the Deep
  landforms: Landform[];               // named bands with min/max height and polygon
  districts: District[];               // streaming + guide-map regions (13)
  hosts: Host[];                       // the 7 buildings, door anchor, apron, arrival mode thresholds
  places: OutdoorPlace[];              // court, campfire, L01, L02
  beds: Bed[];                         // road, skate, rail, cable, cave, stair, boardwalk — geometry the land pass cuts
  lines: Line[];                       // movers ride on beds: V*, S*, W*, G1, ORE, ZIP, FERRY, ROW
  structures: Structure[];             // bridges, tunnels, dam, jetties, stations, hoardings
  crossings: Crossing[];               // every intersection and how it is resolved
  thresholds: Threshold[];             // mode boundaries with the action required
  reserves: Reserve[];                 // 7 plots + 2 small, with reserved place ids
  sky: FlightEnvelope;                 // ceiling, launches, lift fields, landing fields, gates
  underground: UndercroftDef;          // doors, rooms, the Deep's water body, skylight
  lights: LightAnchor[];               // lanterns, windows, the Lamp, runway lamps, fires — see LIGHT.md
  views: SketchbookPose[];             // 12 authored poses
  lanterns: LanternSpot[];             // 64 hunt spots, 60 fill the cave (never inside a reserve)
  protected: ProtectedArea[];          // the Green's centre and any other no-build zone
  journey: {                            // SCALES.md §3
    stations: Station[];               // 12, one per calendar month, with bed pads
    yearWalk: Bed;                     // the trail through them; stretches of day-stones (TIME.md §1.3)
    homestead: HomesteadSite[];        // the household's own sites in Little Harbour
    kittyPlaza: Anchor;
    lod: LodBudgets;                   // L0/L1 budgets; L2/L3 are §6
  };
}

interface WorldOverlay {               // derived on read, pure, never stored (SCALES.md §3.1)
  beds: Bed[];                         // one per month of history: station, yearIndex, cards[], factIds[]
  camp: { station; bed; lit: true };
  eraGates: Gate[];
  kittySteps: number[];                // ≤ 6, 0–10
  signposts: Signpost[];               // agreed plan decisions at their month's station
  flags: Flag[];                       // kept memories
  homestead: HomesteadState;           // maturities, cargo, pavilion state, crossing wear stage, evidence status
  foundLanterns: string[];             // the Hunt (household)
  condition: ConditionWords;           // explicit words, eligible evidence only
  timeline: TimelineStrip;             // the current stretch from the day ledger
  stakes: Stake[]; slips: Slip[];      // plan cards' views on the Walk (TIME.md §2.2)
  provenance: Record<string, FactId[]>;// every visible thing → the facts that produced it
}
```

Rules for the definition:
- Landform bands nest: where polygons overlap, the innermost (higher) band wins (`MANIFEST.json → landformRule`).
- `districts` are listed in `MANIFEST.json → districts` (13 including the offshore ring; the Undercroft is the Crown's underground child).
- Every `id` is a string from `MANIFEST.json → names` or a stable pattern (`plot.terraces.1`). IDs never change once merged.
- `hosts[*].door` is the destination for arrival; cameras frame the door, not the plot centre.
- `beds[*]` carry a `profile` id (`profiles` in the manifest) and a `surface` id that sets pace and footstep sound (`STYLE.md → surfaces`).
- `districts` are the streaming unit. A district is at most one neighbourhood plus its surrounding land; the Undercroft is the Crown's child district; the sky streams by the districts under it.
- `crossings[*].resolution` is one of `over`, `under`, `threshold`. Nothing else. In the manifest, district metadata stays on the actual crossing; `routePairNotes` preserves nearby-endpoint and shared-plan-point evidence for the land pass to verify. DEEP_RUN and ORE share [1300,420]; their vertical clearance must be solved and every actual intersection registered during land construction. These notes never exempt a computed intersection from resolution.
- `reserves[*]` reserve a `placeId` per plot in the same namespace as hosts so a future building slots in without renumbering.
- The definition is data. A pass that needs a new field adds it to the interface in the same PR and updates this section.
- The overlay is a function. No module that computes it imports a `captureCommand`; a static test enforces it (pass 02c).

---

## 5. Reserves

Two areas: three Terraces plots and four Bight Shore plots, plus two small reserves, built in the land pass and dressed in the kit pass:
- **The Terraces** (`plot.terraces.1–3`): above Little Harbour on the Prow side along Horizon Drive's first climb. Stepped, retaining walls, a lay-by per plot, the upper-street walk passing above, Town Weave below.
- The removed `plot.terraces.4` ID is retired and must not be reused.
- **Bight Shore** (`plot.bight.1–4`): the Bight's east shore between the Hollow and the Green, on the Bight Shore spur off Green Road, a jetty.
- **Sealed drift** (`plot.under.1`) beside the Lantern Cave; **hangar bay** (`plot.flats.1`).
- Plot size: 1.5 × the Library footprint (64 × 44 concept metres), plus 6 m clear on all sides; plot spacing ≥ 56 m. The Terraces sit on the uphill side of the Prow cliff drive; Bight Shore sits outside the Green's protected radius (160 m). Graded flat, walled, served (spur or lay-by, apron facing the door-to-be, threshold marker), reserved `placeId`.
- Dressing: hoarding, stakes and string, timber stack, one sign per dressing; meanwhile wildflowers and a bench. No lantern spot inside a plot. No Sketchbook pose depends on a plot being empty.

---

## 6. Performance budget (numbers, not intentions)

| Item | Full tier (desktop) | Lite tier (phone) |
|---|---|---|
| Sustained frame rate | ≥ 60 fps | ≥ 30 fps |
| Triangles per streamed district | ≤ 150 k | ≤ 60 k |
| Draw calls on screen | ≤ 400 | ≤ 180 |
| Districts resident | ≤ 4 + the sky ring | ≤ 3 |
| Journey L0 (whole island) | ≤ 40 k tris, ≤ 60 draw calls | ≤ 25 k, ≤ 40 |
| Journey L1 (a neighbourhood) | ≤ 80 k | ≤ 45 k |
| Zoom tier change | continuous; the cloud cover only if a tier load exceeds 400 ms | same |
| Terrain | baked asset, ≤ 2.5 MB, loaded async; **no bake at module evaluation** | same asset, lower LOD |
| Shadow map | re-rendered on sun step (every 60 s real time) and on district load, never per frame | static per sun step, half resolution |
| Walk↔Look switch | no synchronous district rebuild; ≤ 1 district built per frame; 4 s release delay | same |
| First interactive after sign-in | ≤ 2.5 s on a 2022 laptop | ≤ 4 s on iPhone 13 |
| Entry stall from the flat edition | 0 ms (the Desk never imports the heightfield) | 0 ms |

Mountain v2's A2 and A3 findings are the reason these exist; they are prerequisites of pass 0, not polish.

---

## 7. Acceptance: the twelve pages

The twelve Sketchbook poses in `MANIFEST.json → views` are the acceptance shots for every pass, captured at 1440 × 900 (full) and 390 × 844 (lite), in Classic at least, and in all three dressings from pass 2b on. Each pass's brief says which state the island must be in (no props, greybox, dressed). Captures come from a real Mac and a real iPhone; the headless harness is for the builder's own checks. Every capture has a one-line verdict.

Plus, per pass: `tsc` at 0 errors, the focused suites named in the brief green, no new failures against the pre-existing list, and the quick gate (`pnpm test -- --risk=high …`) on the final SHA only, within its five-minute budget.

---

## 8. Roles

- **Jonathan**: approves the deck, gates pass 1 (the land) by eye, plays the acceptance on devices, owns names and money.
- **Codex**: pass 0 merges and trust reviews; pass 1 terraforming from `MANIFEST.json` and `passes/01-land.md`; Worker/presence changes.
- **Claude**: writes the deck, reviews Codex's land with the dissection method (`REVIEW-BRIEF.md`), orchestrates passes 2–4 with subagents, keeps the artifact and this deck current.
- **Subagents**: one per track, never two on one file; an integrator per pass; a reviewer per pass who has not seen the work.
