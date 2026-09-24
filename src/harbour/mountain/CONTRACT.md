# Hearth Mountain v2 geography contract (T1, branch `claude/mv2-geo`)

Status: **Phase 0 draft** — shapes are fixed, numbers will move while the geography is tuned.
Everything below is exported from `src/harbour/mountain/definition.ts` (the facade) unless a
different module is named. Existing export names keep working; new names are additive.
Coordinates: metres/world units, `x` east, `y` up, `z` south (town at the origin, summit at
`z ≈ -290`). "Uphill" arc length `s = 0` is the road foot in town.

## 1. Terrain

| Export | Shape | Notes |
|---|---|---|
| `mountainBaseHeight(x,z)` | `number` | Authored heightfield baked once to a 1-unit grid and sampled bilinearly (cheap per frame). Terrain only — decks/bridges are surfaces. |
| `groundHeightAt(x,z)` (`scene/ground.ts`) | `number` | Island + mountain; physics and the render lattice both read it. No vertical cut-walls: every terrain slope the lattice has to draw is continuous. |
| `TERRAIN_LATTICE_BOUNDS` (`scene/ground.ts`) | `{minX,maxX,minZ,maxZ}` | Rendered lattice now extends past `WORLD_BOUNDS` so the coast and the summit's back slope are real terrain, not a cut edge. `WORLD_BOUNDS` (presence/walk bounds) is unchanged. |
| `TERRACES` | `{id,district?,plot?,at:Point3,radii:[a,b],yaw,level,bank}` | Authored plateau primitives (alternate across the slopes). |
| `GORGE` | `{points:Point3[] (river surface, uphill→downhill), depthAt(s)}` | The carved channel; `RIVER` is its water line. |
| `RETAINING_WALLS` | `{id,of:'road'|'terrace'|'path', side:'left'|'right', foot:Point3[], top:Point3[], thickness}` | Explicit wall objects wherever a cut or terrace needs one. Art draws them; movement/camera collide with `EDGE_SOLIDS`. |

## 2. Road (the main mountain road)

```ts
type EdgeKind='open'|'kerb'|'parapet'|'wall'|'bridge';
type SupportKind='ground'|'embankment'|'bridge'|'tunnel';
type RoadSample={s:number;at:Point3;tangent:Point3;/* unit, 3D, uphill */ normal:Point3;/* unit horizontal, to the LEFT of uphill travel */
  halfWidth:number;grade:number;curvature:number;/* 1/radius, signed, + = left */
  left:EdgeKind;right:EdgeKind;support:SupportKind;bridgeId:string|null};
type RoadLine={id:string;length:number;step:number;samples:readonly RoadSample[]};
```

| Export | Shape |
|---|---|
| `MOUNTAIN_ROAD_LINE` | `RoadLine`, uphill, samples every 1 unit, foot ramps to town grade. |
| `roadSampleAt(s, line?)` | interpolated `RoadSample` at arc length `s`. |
| `MOUNTAIN_ROAD` | legacy `Point3[]` (uphill polyline, ~3 u spacing) derived from the line. |
| `ROAD_HALF_WIDTH` | 4.8 (mountain width); per-sample `halfWidth` tapers to town lanes. |
| `ROAD_LENGTH` | rideable length. |
| `BRIDGES` | `{id,name,type:'timber'|'masonry'|'metal-glass',carries:'road'|'path'|'funicular'|'race-lane',s0,s1,a:Point3,b:Point3,span,deckThickness,clearance,piers:Point3[],crosses:string[]}` |
| `EDGE_RUNS` | `{id,side,kind:EdgeKind,s0,s1,line:Point3[] (edge at deck height),height}` — parapets 1.1 high, kerbs 0.22. |
| `EDGE_SOLIDS` | oriented segments `{id,a:[x,z],b:[x,z],bottom,top,thickness}` for parapets/walls/bridge rails. **Movement/camera tracks: collide with these** (they are not in `WORLD_SOLIDS`, which stays AABB-only). |
| `DAM_OVERLOOK` | `{s, at:Point3, facing:number (yaw), look:Point3}` on the road/race line. |

## 3. Paths

```ts
type PathNodeKind='junction'|'door'|'station'|'overlook'|'stair-top'|'stair-bottom'|'plot-gate'|'district'|'town';
type PathNode={id:string;kind:PathNodeKind;at:Point3;facing?:number;label?:string;district?:string};
type PathEdgeKind='road'|'path'|'stair'|'bridge'|'promenade';
type PathEdge={id:string;kind:PathEdgeKind;from:string;to:string;halfWidth:number;points:readonly Point3[];length:number};
```

| Export | Shape |
|---|---|
| `MOUNTAIN_PATH_GRAPH` | `{nodes:PathNode[];edges:PathEdge[]}` — road edges are included so routes can mix. |
| `mountainWalkRoute(from,to)` (`surfaces.ts`, unchanged signature) | `{x,z}[]|null` shortest-by-time over the graph (stairs allowed). |
| `mountainWalkPlan(from,to,opts?)` (`pathGraph.ts`) | `{points:Point3[];edges:string[];length:number;seconds:number}|null`, `opts.speed` (default walk 2.1). |
| `DOOR_APRONS` | `{site,door:Point3,facing,apron:{at:Point3,half:[w,d]}}` — every mountain building. |
| `OVERLOOKS` | `{id,name,at:Point3,facing:number,look:Point3}` (≥3, authored facing). |
| `FOOTPATHS` | legacy `{id,points}` (now the elevated path/stair/bridge edges). |

## 4. Places

`DISTRICTS`, `RESERVED_PLOTS` (now also `level`, `envelope:{half:[w,d],height}`, `gate:Point3`),
`BUILDING_SITES`, `BASIN` (legacy circle: arc centre/radius of the dam; water cylinder still valid),
new `DAM` `{centre:Point3,crest:number,foot:number,arc:Point3[] (crest line W→E),face:[nx,nz] (toward town),
abutments:{at:Point3,size:Point3}[],apron:{at:Point3,half:[w,d]},promenade:Point3[]}`,
`RESERVOIR` `{level:number,bottom:number,shore:Point3[]}`, `KITTY_CHAMBERS` `{id,at:Point3,radius,depth}[]`
(beside the dam on the slope), `SUMMIT_OBSERVATORY_SITE` `{at:Point3}`.

## 5. Transport

```ts
type TransportFrame={s:number;at:Point3;tangent:Point3;up:Point3;side:Point3};
type TransportLine={kind:TransportKind;length:number;cruise:number;stations:{id:string;name:string;s:number;at:Point3;platform:{at:Point3;yaw:number;half:[number,number]}}[];
  at(s:number):TransportFrame;frames(step?:number):TransportFrame[];towers:Point3[];rails?:[Point3[],Point3[]]};
```

`transportSpline(kind)` — arc-length parameterised, constant cruise speed. Funicular: monotonic
incline (no vertical reversals), two rails, platforms aligned to the track, clearance over the road.
Gondola: catenary spans between towers, crosses the gorge at height. `transportPoint(kind,from,to,t)` is
**deprecated** (kept for one release; it now eases along arc length instead of equal time per segment).
`TRANSPORT_STOPS`/`FUNICULAR_STOPS`/`GONDOLA_STOPS` keep `{id,name,at}` (`at` = platform boarding point).

## 6. Race

`MOUNTAIN_COURSE_POINTS` (downhill), `MOUNTAIN_GATES` (`RaceGate` + optional `name`, `segment`),
`MOUNTAIN_RACE` (unchanged `RouteLike`), new `MOUNTAIN_RACE_SEGMENTS` `{id,name,i0,i1,s0,s1}` in the plan's
order, `RACE_FINISH` `{at,heading:[x,z],runout}`, `TOWN_RACE_ROAD` (now draped on town ground).
`SKILL_BRANCHES` keep `{id,entry,exit,halfWidth,material,points}` and add
`{name,kind:'rail'|'balcony'|'awning',segments:{kind:'ramp'|'deck'|'rail'|'landing',points}[],branchLength,roadLength}`.

## 7. Town square

`TOWN_SQUARE` (`townSquare.ts`, re-exported): `{plaza,channels,crossings,storefronts,vacated,roadTaper,arrivals}`.

## 8. Guide map

`MOUNTAIN_MAP` data (`MountainPanel.tsx` reads it); `MountainPanel` gains an optional `here?:Point3` prop.

## Notes for other tracks (filled in as the work lands)

- Art: redraw from `MOUNTAIN_ROAD_LINE`, `BRIDGES`, `EDGE_RUNS`, `RETAINING_WALLS`, `DAM`, `RESERVOIR`,
  `KITTY_CHAMBERS`, `TRANSPORT` lines, `TOWN_SQUARE`; `artGeometry.ts` constants that hard-code the old
  summit/observatory need to read `SUMMIT_OBSERVATORY_SITE`.
- Movement: collide with `EDGE_SOLIDS`; stair edges are walkable ramps regardless of slope.
