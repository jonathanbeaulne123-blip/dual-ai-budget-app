# Hearth Mountain v2 geography contract (T1, branch `claude/mv2-geo`)

Status: **final for the geography track.** The shapes below are shipped; numbers are the tuned values.
Everything is exported from `src/harbour/mountain/definition.ts` (the facade) unless another module is
named. Existing export names keep working; new names are additive.
Coordinates: world units, `x` east, `y` up, `z` south (town at the origin, summit at `z ≈ -294`).
"Uphill" arc length `s = 0` is the road foot in town (`(-26,-44)`).

Versions: `MOUNTAIN_VERSION` stays `'hearth-mountain-1'` (the presence wire). The geography carries
`GEOGRAPHY_REVISION = 'hearth-mountain-geo-2'`. `MOUNTAIN_RACE_REVISION` (`'hearth-mountain-1-<course hash>'`) changes with the course, so replays recorded on the old course are rejected.

## 1. Terrain

| Export | Shape | Notes |
|---|---|---|
| `mountainBaseHeight(x,z)` | `number` | Final mountain ground, baked once to a 1-unit grid (`TERRAIN_GRID_BOUNDS` x −200..200, z −396..−30) and sampled bilinearly. It returns −0.75 for `z > −48`, as before. Terrain only: decks, bridges and platforms are surfaces. |
| `mountainGround(x,z)` (`mountainGround.ts`) | `number` | The same baked grid without the island guard. |
| `groundHeightAt(x,z)` (`scene/ground.ts`) | `number` | Island, mountain and town channel. For `z < −48` it is `max(island, mountain)`. Between z −48 and −30 the benches can only raise the island. Cost is about 0.13 µs per call. |
| `TERRAIN_LATTICE_BOUNDS` (`scene/ground.ts`) | `{minX:-200,maxX:200,minZ:-396,maxZ:84}` | The render lattice (full 200×240, lite 134×160) covers the coast and the back slope. `WORLD_BOUNDS` is unchanged. |
| `TERRACES` | `Terrace[]` = `{id,at,radii:[a,b],yaw,level,bank}` | One plateau for each district and plot, plus two meadow steps. |
| `RIVER`, `RIVER_HALF_WIDTH` (2.2), `RIVER_BED_DEPTH` (0.28) | `Point3[]` water line, from the dam foot down to the sea | The gorge is carved from `GORGE_POINTS` (`places.ts`: `[x,waterY,z,wallSlope]`). The water is never more than 0.28 above the bed. |
| `RETAINING_WALLS_ROAD` | `RetainingWall[]` = `{id,of,side,foot:Point3[],top:Point3[],thickness}` | One wall for every road or lane `wall` edge run. There are no terrace walls, because the terraces use banks. |
| `islandHeight`, `SEA_LEVEL`, `TERRACE_LEVEL`, island radii (`islandShape.ts`) | | The pure island shape, with no mountain imports. |

The draft `GORGE {points, depthAt}` and generic `RETAINING_WALLS` were not shipped. Use `GORGE_POINTS` or `RIVER`, and `RETAINING_WALLS_ROAD`.

## 2. Road

```ts
type EdgeKind='open'|'kerb'|'parapet'|'wall'|'bridge';
type SupportKind='ground'|'embankment'|'bridge'|'tunnel';
type RoadSample={s;at:Point3;tangent:Point3 /*unit 3D uphill*/;normal:Point3 /*unit horizontal, LEFT of uphill*/;
  halfWidth;grade;curvature /*+ = left*/;left:EdgeKind;right:EdgeKind;support:SupportKind;bridgeId:string|null};
type RoadLine={id;length;step;samples:readonly RoadSample[]};
```

| Export | Shape |
|---|---|
| `MOUNTAIN_ROAD_LINE` | `RoadLine`. Uphill, 945.9 long, one sample per unit. The foot is at town grade and the half-width tapers 3.5→4.8 over the first 18 units. |
| `ORCHARD_LANE_LINE` | `RoadLine`. Orchard Lane leaves the road above hairpin 2 and crosses the lower gorge on the masonry bridge. |
| `roadSampleAt(s,line?)`, `roadSampleAtPlan(s)` | interpolated `RoadSample` |
| `MOUNTAIN_ROAD` | Legacy uphill `Point3[]` (every third sample). |
| `ROAD_HALF_WIDTH` (4.8), `ROAD_LENGTH` | |
| `GORGE_BRIDGES` | `Bridge[]` for the road and lane. |
| `BRIDGES` | Every bridge: the gorge bridges, the funicular viaducts and the canal bridge. `Bridge={id,name,type:'timber'|'masonry'|'metal-glass',carries:'road'|'lane'|'path'|'funicular'|'race-lane',s0,s1,a,b,span,deckThickness,clearance,piers,crosses,halfWidth,deck}` |
| `EDGE_RUNS` | `{id,line,side,kind,s0,s1,points (edge at deck height),height}`. Parapets are 1.1 high and kerbs 0.22. Guarded runs overlap one sample into their neighbours. |
| `EDGE_RULES` | The thresholds used to classify edges. |
| `EDGE_SOLIDS` | About 2-unit segments `{id,a:[x,z],b:[x,z],bottom,top,thickness}` for every parapet, bridge rail and wall. `worldCollisionAt` already includes them for `z < −40`. |
| `TRANSPORT_CROSSINGS` | `Crossing={id,over,under,at,overY,underY,clearance}`: the funicular over the road (3 places) and over the lane (1). |
| `DAM_OVERLOOK` | `{s,at,facing,look}` on the road and race line. |

## 3. Paths

`MOUNTAIN_PATH_GRAPH` `{nodes:PathNode[],edges:PathEdge[]}`. The edges include the road and the lane, so a route can mix them.
- `PathNode={id,kind:'junction'|'door'|'station'|'overlook'|'stair-top'|'stair-bottom'|'plot-gate'|'district'|'town',at,facing?,label?,district?}`
- `PathEdge={id,kind:'road'|'path'|'stair'|'bridge'|'promenade',from,to,halfWidth,points,length}`

| Export | Notes |
|---|---|
| `mountainWalkRoute(from,to)` (`surfaces.ts`) | Signature unchanged. Returns `{x,z}[]` or null, shortest by time over the graph. |
| `mountainWalkPlan(from,to,{speed?})` | `WalkPlan={points,edges,length,seconds}`. Stairs are counted at a 1.3× time factor. |
| `DOOR_APRONS` | `{site,door,facing,apron:{at,half,yaw}}`. Every mountain door has a level apron, and the path arrives along the door axis. |
| `OVERLOOKS` | `{id,name,at,facing,look}`. There are 5, each with an authored facing. |
| `PATH_EDGES`, `FOOTPATHS` | Non-road edges (legacy `FOOTPATHS` is `{id,points,kind,halfWidth}`). |

## 4. Places

- **`DISTRICTS`**: same shape; new positions in the plan's uphill order.
- **`RESERVED_PLOTS`**: adds `half`, `envelope:{half,height}` and `gate:Point3`.
- **Buildings**:
  - `BUILDING_SITES` and `BUILDING_FORMS` (half and door), for `village/layout.ts`.
  - `buildingDoor(id)` returns `{at,facing,yaw}`.
  - `buildingYaw(id)`.
- **`SUMMIT_OBSERVATORY_SITE`** `{at,radius}` and **`GOAL_PAVILION_SITE`** `{at}`.
- **Dam and reservoir**:
  - `DAM` `{centre,radius,halfAngle,crest:88,foot:33,face:[0,1]}`.
  - `DAM_PARTS` `{arc (crest, west→east), face, abutments[{side,at,size}], apron{at,half}, promenade}`.
  - `RESERVOIR` `{bottom,level:86,shore}`.
  - `RESERVOIR_BOWL`, `RESERVOIR_LEVEL_MAX`.
  - `BASIN` is the legacy circle and is kept.
- **`KITTY_CHAMBERS`** `{id,at,radius,depth}[]`: on the west abutment slope beside the dam.

## 5. Transport

```ts
type TransportFrame={s;at;tangent;up;side};
type TransportStation={id;name;s;at;platform:{at;yaw;half:[w,d]}};
type TransportLine={kind;length;cruise;stations;at(s):TransportFrame;frames(step?):TransportFrame[];towers;path;rails?};
```

- **`transportSpline(kind)`, `FUNICULAR_LINE`, `GONDOLA_LINE`, `TRANSPORT_LINES`.**
  - Funicular stations: town (−17,−36) → lower neighbourhood (6,−87) → Library Woods → Reservoir Heights.
  - The funicular runs on a monotonic incline with two rails. It passes over the harbour bridge, over Orchard Lane and over the road twice.
  - Gondola: quay (−26,46) → 3 towers → Summit Commons. Its spans follow a parabolic catenary and cross the gorge high up.
- **`TRANSPORT_STOPS`, `FUNICULAR_STOPS`, `GONDOLA_STOPS`** keep `{id,name,at}`. `at` is now the platform boarding point.
- **`transportPoint(kind,from,to,t)`** is deprecated. It still starts and ends at the exact platform.

## 6. Race

- **Course data:** `MOUNTAIN_COURSE_POINTS` (downhill), `MOUNTAIN_GATES` (17 gates, each `RaceGate` plus `name` and `segment`), and `MOUNTAIN_RACE` (unchanged `RouteLike`).
- **`MOUNTAIN_RACE_SEGMENTS`** `RaceSegment={id,name,i0,i1,s0,s1}`, 9 in the plan's order.
- **`RACE_FINISH`** `{at,heading,runout,laneRunout}`.
- **`TOWN_RACE_ROAD`** is draped exactly on the island ground. `TOWN_LANE_DECK` is the only town deck: the canal bridge, which spans the whole channel cut.
- **`CANAL_BRIDGE`** `{id,name,type,at,span,halfWidth,a,b}`.
- **`SKILL_BRANCHES`** keep `{id,entry,exit,halfWidth,material,points}` and add `{name,kind,segments,branchLength,roadLength}`:
  - `dam-promenade` is a rail down the dam face that lands on the metal-and-glass bridge.
  - `library-balcony` crosses the Library roof deck.
  - `hearth-awning` runs inside hairpin 2.
- **Also exported:** `crossesRaceGate` and `courseIndexAt`.

## 7. Town square

`TOWN_SQUARE` (`townSquare.ts`):
- `{plaza,channels,crossings,storefronts,vacated,roadTaper,arrivals}`.
- The Outfitters (−15,−6) and Potter's Supply (−15,8.5) storefronts face the square.
- `STOREFRONT_SOLIDS` are oriented boxes. They are **not** in `WORLD_SOLIDS`.
- `TOWN_STOREFRONT_APRONS` are protected from the channel cut.

## 8. Guide map

`mountainMap()` (`mapData.ts`) returns `{viewBox,lines:MapLine[],points:MapPoint[]}`:
- The map is built lazily.
- It has marching-squares contours (the coast and every 25 units).
- It includes the road, lane, bridges, paths, dam, reservoir, transport, districts, plots, gates and overlooks.

`MountainPanel` draws it as an `<svg role="img">` with `<title>` and `<desc>`, and accepts an optional `here?:Point3` prop.

## Final export list (the facade, `definition.ts`)

Values:
- **Versions and bounds:** `MOUNTAIN_VERSION`, `GEOGRAPHY_REVISION`, `WORLD_BOUNDS`.
- **Places:** `DISTRICTS`, `RESERVED_PLOTS`, `BUILDING_SITES`, `BUILDING_FORMS`, `buildingDoor`, `buildingYaw`, `BASIN`, `DAM`, `RIVER`, `RIVER_HALF_WIDTH`, `TERRACES`, `RESERVOIR_BOWL`, `RESERVOIR_LEVEL_MAX`, `SUMMIT_OBSERVATORY_SITE`, `GOAL_PAVILION_SITE`.
- **Road and edges:** `MOUNTAIN_ROAD_LINE`, `ORCHARD_LANE_LINE`, `roadSampleAt`, `roadSampleAtPlan`, `GORGE_BRIDGES`, `EDGE_RUNS`, `EDGE_SOLIDS`, `EDGE_RULES`, `RETAINING_WALLS_ROAD`, `DAM_OVERLOOK`, `ROAD_HALF_WIDTH`, `ROAD_LENGTH`.
- **Race:** `MOUNTAIN_ROAD`, `TOWN_RACE_ROAD`, `TOWN_LANE_HALF_WIDTH`, `CANAL_BRIDGE`, `SKILL_BRANCHES`, `RACE_FINISH`, `MOUNTAIN_COURSE_LENGTH`.
- **Paths:** `MOUNTAIN_PATH_GRAPH`, `DOOR_APRONS`, `OVERLOOKS`, `mountainWalkPlan`, `FOOTPATHS`.
- **Transport:** `FUNICULAR_STOPS`, `GONDOLA_STOPS`, `TRANSPORT_STOPS`, `TRANSPORT_LINES`, `FUNICULAR_LINE`, `GONDOLA_LINE`, `transportSpline`, `transportPoint` (deprecated).
- **Dam parts and crossings:** `RESERVOIR`, `DAM_PARTS`, `KITTY_CHAMBERS`, `BRIDGES`, `TRANSPORT_CROSSINGS`.
- **Queries and helpers:** `nearestOnRoute`, `districtAt`, `mountainBaseHeight`, `mountainContains`, `WORLD_DEFINITION` (now with `revision`, `terraces`, `roadLine`, `lanes`, `bridges`, `edges`, `pathGraph`, `doors`, `overlooks`, `dam`, `damOverlook`, `transportLines`), `clamp`, `smooth`.

Types: `Point3`, `District`, `ReservedPlot`, `Biome`, `MountainBuilding`, `Terrace`, `RoadSample`, `RoadLine`, `EdgeKind`, `SupportKind`, `Bridge`, `EdgeRun`, `EdgeSolid`, `RetainingWall`, `SkillBranch`, `BranchSegment`, `PathNode`, `PathEdge`, `PathNodeKind`, `PathEdgeKind`, `WalkPlan`, `DoorApron`, `TransportKind`, `TransportLine`, `TransportFrame`, `TransportStation`, `Crossing`, `RouteProjection`.

Exports from other modules:
- `surfaces.ts`: `WORLD_SURFACES`, `WORLD_SOLIDS`, `queryWorldSurface`, `worldCeilingAt`, `worldCollisionAt`, `mountainWalkRoute`.
- `race.ts` / `course.ts`: `MOUNTAIN_COURSE_POINTS`, `MOUNTAIN_GATES`, `MOUNTAIN_RACE`, `MOUNTAIN_RACE_SEGMENTS`, `MOUNTAIN_RACE_REVISION`, `crossesRaceGate`, `courseIndexAt`, `TOWN_LANE_DECK`.
- `townSquare.ts`: `TOWN_SQUARE`, `STOREFRONT_SOLIDS`, `TOWN_STOREFRONT_APRONS`.
- `mapData.ts`: `mountainMap`.
- `scene/ground.ts`: `groundHeightAt`, `TERRAIN_LATTICE_BOUNDS`.
- `islandShape.ts`: `islandHeight`.
- `places.ts`: `GORGE_POINTS`, `RIVER_BED_DEPTH`.

## Notes for other tracks

- **Art (landscape, architecture, artGeometry, districtArt):**
  - Redraw from `MOUNTAIN_ROAD_LINE` and `EDGE_RUNS` (parapets, kerbs, rails), `RETAINING_WALLS_ROAD`, `BRIDGES` (piers, deck, type), `DAM_PARTS`, `RESERVOIR`, `KITTY_CHAMBERS`, `TRANSPORT_LINES` (`frames()`, `rails`, `towers`, `platform`) and `TOWN_SQUARE`.
  - `artGeometry.ts` still hard-codes the old summit and observatory. Read `SUMMIT_OBSERVATORY_SITE` and `GOAL_PAVILION_SITE` instead.
  - `STATION_SOLIDS` must follow `station.platform`. The stations moved: funicular town station to (−17,−36) and hearth station to (6,−87); gondola quay to (−26,46).
  - `landscape.ts` still reads the legacy `BASIN` and the cabin `transportPoint`. Move it to `RESERVOIR`, `DAM_PARTS` and `transportSpline`.
  - District art at `hearth:13` (≈(75,−118)) sits beside the east-arm race chord. The gates were moved to keep it clear.
- **Movement and camera:**
  - `worldCollisionAt` already includes `EDGE_SOLIDS`. The camera should also treat them as occluders.
  - Stair edges are walkable decks (surface kind `stair`), whatever their slope.
  - Positions saved against the old mountain need re-validation (`mountainContains` and `queryWorldSurface`) before they are restored.
- **Skate:** the field registers every non-road `WORLD_SURFACES` entry, including branch decks and rails, as grindable. That is expected for the branches. Filter out `promenade` and `bridge` path decks if they grind oddly.
- **Island:** `STOREFRONT_SOLIDS` still need to join the island obstacle tables (`body/obstacles.ts` is not T1's file).
- **HarbourWorld:** pass the rider's position to `MountainPanel`'s `here` prop so the guide map shows "you are here".
