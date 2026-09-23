import { VILLAGE_SITES, SITE_FOR_PLACE, FLOOR_HEIGHT, VILLAGE_WATERFRONT } from '../village/layout.ts';
import * as THREE from "three";
import type { ThemeId } from "../../theme/scenes.ts";
import { COURT_DRESSING, type CourtDressing } from "../court/dressing.ts";
import type { HarbourPlaceId } from "../flag.ts";
import type { HarbourReading } from "../data/reading.ts";
import type { RenderTier } from "./quality.ts";
import type { RoomHold } from "../camera/poses.ts";
import { groundHeightAt } from "./ground.ts";

/**
 * The contract between the harbour runtime and a place (BUILD_PLAN §2 #4).
 * The runtime owns the renderer lease, the light rig, the island ground, the
 * camera, the frame loop and pointer routing. A place owns everything that
 * stands on the ground: it builds once per theme, updates from the reading,
 * animates when the frame policy allows, and tells the runtime where its
 * anchors, camera poses and touchable regions are.
 *
 * Writer D's `court/CourtScene.ts` implements `Place`; this file stays stable.
 */

export type Vec3 = readonly [number, number, number];
export type Composition = "phone" | "desktop";

/**
 * A live position feed for the partner's body (`ledgerSync/worldPresence.ts`).
 * The object is stable for the life of a peer and is **polled once per
 * animated frame** by the place, so 12.5 samples a second never become 12.5
 * React renders a second. `null` means there is no live position to draw and
 * the place must fall back to its honest "was here recently" treatment.
 */
export type PlaceWalkSource = {
  pose(nowMs: number): { y?:number; x: number; z: number; yaw: number; moving: boolean; opacity: number; act?: string | null; p?: number; avatar?: "bianca" | "jonathan" } | null;
};

/** The partner's presence, from the App's soft-presence display (never from the books). */
export type PlacePartner = { fresh: boolean; name?: string; walk?: PlaceWalkSource | null };
/** What a place reads: writer B's `HarbourReading` plus the partner the shell adds. */
export type PlaceReading = HarbourReading & { partner?: PlacePartner | null };

/** Colours are CSS hex strings; the scene makes a `THREE.Color` of each once. */
export type PlaceLight = { sun: string; hemiSky: string; hemiGround: string; intensity: number };
export type PlaceDressing = {
  theme: ThemeId;
  stone: string; joint: string; moss: string; plinth: string; timber: string; metal: string; gate: string;
  /** The island around a place: the apron under its objects, the lawn ring, the sea and the air. */
  terrace: string; lawn: string; sky: string; sea: string;
  fog: string; fogNear: number; fogFar: number;
  light: PlaceLight;
};

/** A thing a tap can go to. `door` is what the tap opens through `onOpen(target, object)`; a `zone` groups anchors for the twins' focus order. */
export type Anchor = {
  id: string;
  position: Vec3;
  zone: string;
  /** In words, with the number when there is one ("The Rook, Build one thousand two hundred dollars. Open the Loft."). */
  label: string;
  door?: { target: string; object?: string };
};

/** A camera pose in the court's spherical language: look at `target` from distance `r`, heading `theta`, tilt `phi` from vertical. Matches `camera/poses.ts`. */
export type Pose = { target: Vec3; r: number; theta: number; phi: number };

/** Pose keys: `"sky"`, `"court"`, `` `object:${anchorId}` ``; a key may carry `@phone` or `@desktop` and the runtime prefers the composition's own. */
export type PoseKey = string;

/**
 * A touchable part of a body: the Queen's crown, a piece on its plinth. The
 * twins take their rect from `box` (world space) when given, else from the
 * union of `objects`. For a raycast to land, every mesh of a Queen region
 * carries `userData.region = id`; court objects carry `userData.anchor`.
 */
export type Region = {
  id: string;
  /** The body the region belongs to ("queen", "court"); the twins rove inside one group. */
  group: string;
  label: string;
  box?: THREE.Box3;
  objects?: THREE.Object3D[];
};

export type PlaceBuildContext = {
  composition: Composition;
  /** Aborted on dispose; progressive loaders pass it to fetches. */
  signal: AbortSignal;
  /** A place calls this when something arrived late (a GLB, a texture) so the runtime paints a frame. */
  invalidate: () => void;
};

export interface PlaceHandle {
  readonly group: THREE.Object3D;
  update(reading: PlaceReading | null): void;
  /** `t` seconds since mount, `dt` seconds since the last animated frame. Only called when the frame policy animates. May return true when something moved and a paint is worth it. */
  animate(t: number, dt: number): boolean | void;
  dispose(): void;
  anchors(): Anchor[];
  poses(): Record<PoseKey, Pose>;
  regions(): Region[];
}

export interface Place {
  readonly id: HarbourPlaceId;
  build(scene: THREE.Scene, dressing: PlaceDressing, reading: PlaceReading | null, quality: RenderTier, context: PlaceBuildContext): PlaceHandle;
}

/**
 * Each room's hold on the camera (`camera/poses.ts` `holdPoseInRoom`). The
 * Court is open sky and has none. The Tower's box reaches out through the
 * wall's open side (+z) to the doorway, so the room poses that stand in the
 * gap remain legal; the Cellar's box is its four walls less the thickness of
 * the stone. A hand on the camera, a restored return slot and every named
 * pose all pass through the standing place's hold, so a room can never be
 * seen from the lawn.
 */
export const PLACE_HOLDS: Readonly<Record<HarbourPlaceId, RoomHold | null>> = Object.freeze({
  court: null,
  bank: {eye:{min:[-4.5,0.3,-3.5],max:[4.5,5.5,6.2]},target:{min:[-4,0.2,-3],max:[4,3.5,3]},minR:1.4,maxR:10,minPhi:0.5,maxPhi:1.42},
  tower: Object.freeze({
    eye: { min: [-2.85, 0.3, -2.85] as Vec3, max: [2.85, 3.4, 4.6] as Vec3 },
    target: { min: [-2.2, 0.2, -2.2] as Vec3, max: [2.2, 3.0, 2.2] as Vec3 },
    minR: 1.4, maxR: 5.2, minPhi: 0.85, maxPhi: 1.38,
  }),
  cellar: Object.freeze({
    eye: { min: [-4.9, 0.3, -3.1] as Vec3, max: [4.9, 2.85, 3.15] as Vec3 },
    target: { min: [-4.2, 0.2, -2.9] as Vec3, max: [4.2, 2.2, 2.4] as Vec3 },
    minR: 1.4, maxR: 6.5, minPhi: 0.85, maxPhi: 1.38,
  }),
  glasshouse: Object.freeze({
    eye: { min: [-3.95, 0.35, -2.9] as Vec3, max: [3.95, 2.7, 3.1] as Vec3 },
    target: { min: [-3.2, 0.2, -2.8] as Vec3, max: [3.2, 2.1, 2.2] as Vec3 },
    minR: 1.4, maxR: 6.2, minPhi: 0.85, maxPhi: 1.38,
  }),
  kitchen: Object.freeze({
    eye: { min: [-3.75, 0.35, -2.7] as Vec3, max: [3.75, 2.45, 2.75] as Vec3 },
    target: { min: [-3.0, 0.2, -2.5] as Vec3, max: [3.0, 2.0, 2.0] as Vec3 },
    minR: 1.3, maxR: 5.8, minPhi: 0.85, maxPhi: 1.38,
  }),
  boathouse: Object.freeze({
    eye: { min: [-3.35, 0.3, -2.6] as Vec3, max: [3.35, 3.1, 2.7] as Vec3 },
    target: { min: [-2.8, 0.1, -2.4] as Vec3, max: [2.8, 2.4, 2.2] as Vec3 },
    minR: 1.3, maxR: 5.6, minPhi: 0.85, maxPhi: 1.38,
  }),
  kiln: Object.freeze({
    eye: { min: [-3.6, 0.3, -2.7] as Vec3, max: [3.6, 2.95, 2.78] as Vec3 },
    target: { min: [-3.0, 0.2, -2.5] as Vec3, max: [3.0, 2.3, 2.1] as Vec3 },
    minR: 1.2, maxR: 6.0, minPhi: 0.85, maxPhi: 1.38,
  }),
  library: Object.freeze({
    eye: { min: [-4.15, 0.35, -3.1] as Vec3, max: [4.15, 3.5, 3.05] as Vec3 },
    target: { min: [-3.4, 0.2, -2.9] as Vec3, max: [3.4, 2.9, 2.4] as Vec3 },
    minR: 1.3, maxR: 6.8, minPhi: 0.85, maxPhi: 1.38,
  }),
  cottage: Object.freeze({
    eye: { min: [-3.15, 0.3, -2.55] as Vec3, max: [3.15, 2.75, 2.5] as Vec3 },
    target: { min: [-2.6, 0.15, -2.35] as Vec3, max: [2.6, 2.1, 2.0] as Vec3 },
    minR: 1.3, maxR: 5.4, minPhi: 0.85, maxPhi: 1.38,
  }),
  // The Campfire has no walls — it is open shore and open sky. Its hold is not
  // a room but a clearing: near enough that the ring always fills the frame,
  // wide enough for the whole path of months and the Boathouse behind it.
  campfire: Object.freeze({
    eye: { min: [-7.2, 0.25, -7.6] as Vec3, max: [7.2, 5.4, 7.6] as Vec3 },
    target: { min: [-2.6, 0.1, -6.4] as Vec3, max: [2.6, 1.6, 3.8] as Vec3 },
    minR: 1.3, maxR: 7.4, minPhi: 0.82, maxPhi: 1.42,
  }),
  // The Atlas is a loft under the cottage's roof: lower than the rooms below
  // it, and the eye never rises past the rafters.
  atlas: Object.freeze({
    eye: { min: [-3.3, 0.35, -2.45] as Vec3, max: [3.3, 2.15, 2.45] as Vec3 },
    target: { min: [-2.7, 0.2, -2.2] as Vec3, max: [2.7, 1.9, 1.9] as Vec3 },
    minR: 1.2, maxR: 5.2, minPhi: 0.85, maxPhi: 1.38,
  }),
});

/** The registry the runtime reads the active place from. `court/CourtScene.ts` registers itself on import. */
export const PLACES: Partial<Record<HarbourPlaceId, Place>> = {};

export function registerPlace(place: Place): Place {
  PLACES[place.id] = place;
  return place;
}

/** The island with nothing on it: tests, and the frame before the Court module arrives. */
export const EMPTY_PLACE: Place = {
  id: "court",
  build(scene) {
    const group = new THREE.Group();
    group.name = "Empty place";
    scene.add(group);
    return {
      group,
      update() {},
      animate() {},
      dispose() { scene.remove(group); },
      anchors: () => [],
      poses: () => ({}),
      regions: () => [],
    };
  },
};

/** The island's dressing is the court's (`court/dressing.ts`, BUILD_PLAN §6) seen from the scene's side: one table, no second palette. */
export function sceneDressingFrom(court: CourtDressing): PlaceDressing {
  return {
    theme: court.theme,
    stone: court.stone, joint: court.joint, moss: court.moss, plinth: court.plinth, timber: court.timber, metal: court.metal, gate: court.gate.post,
    terrace: court.terrace, lawn: court.lawn, sky: court.sky, sea: court.sea,
    fog: court.light.fog.color, fogNear: court.light.fog.near, fogFar: court.light.fog.far,
    light: { sun: court.light.sun, hemiSky: court.light.hemiSky, hemiGround: court.light.hemiGround, intensity: court.light.sunIntensity },
  };
}

export const SCENE_DRESSING: Readonly<Record<ThemeId, PlaceDressing>> = Object.freeze({
  classic: sceneDressingFrom(COURT_DRESSING.classic),
  taylor: sceneDressingFrom(COURT_DRESSING.taylor),
  newfoundland: sceneDressingFrom(COURT_DRESSING.newfoundland),
});

/**
 * Resolves a pose for the composition. **The convention is `key:composition`**
 * — `court:phone`, `object:rook:desktop` — which is what every place's table
 * is written in. `key@composition` is still accepted so an older table keeps
 * working, and a bare `key` is the last resort.
 */
export function poseFor(poses: Record<PoseKey, Pose>, key: PoseKey, composition: Composition): Pose | undefined {
  return poses[`${key}:${composition}`] ?? poses[`${key}@${composition}`] ?? poses[key];
}

/* ──────────────────────────────────────────────────────────────────────────
 * Where a place **stands** (world-space, slice 1)
 *
 * Until now every interior built its root group at the scene origin, while the
 * Court stood that building's *exterior* out on the island — so the Library's
 * hall was at (−4.7, −11.6) and the Library's inside was a separate object
 * sitting on the Court's terrace. Walking out of a door into the world was
 * geometrically impossible, because the door led from one coordinate system to
 * another one that happened to share an origin.
 *
 * A **placement** closes that gap: it is the transform a place's root group is
 * given so the inside of a building is built *where the building stands*. It
 * is data beside the registry, not a special case inside a scene module — a
 * place that declares no placement keeps exactly today's behaviour (group at
 * the origin, hold as written, disposed on navigate), which is how the eight
 * unplaced places stay untouched.
 *
 * The numbers are the Court's own (`court/CourtScene.ts`): the spot and the
 * yaw are copied from the expression that stands the exterior, and
 * `test/harbour-world-space.test.ts` proves they still agree.
 * ────────────────────────────────────────────────────────────────────────── */

/** A place's spot on the island, and the room it stands in, in island units. */
export type PlacePlacement = {
  /**
   * The name of the Court's exterior shell for this building
   * (`THREE.Object3D.name` in `court/CourtScene.ts`). While the interior is
   * resident the runtime hides the shell, so nothing is drawn twice.
   */
  exterior: string;
  /** Shared shell, one active floor. Interior stairs never count as street entrances. */
  building?: string;
  floorY?: number;
  internal?: boolean;
  outdoor?: boolean;
  /** Island coordinates (x, z) — the Court's own spot for the exterior. */
  spot: readonly [number, number];
  /** Which way the building faces, in radians — the Court's own `rotation.y`. */
  yaw: number;
  /** Half the interior's footprint, in the place's own coordinates. */
  halfWidth: number;
  halfDepth: number;
  /** The doorway, in the place's own coordinates: the threshold you cross. */
  door: Vec3;
  /** How near the doorway counts as "arrived", in island units. */
  doorRadius: number;
};

/**
 * How far a placed interior stands clear of the island under it. The island is
 * a sloped analytic surface (`scene/ground.ts`) and an interior's floor is one
 * flat plane, so the floor is lifted to the highest ground its footprint
 * covers plus a doorstep — otherwise the uphill corner of a room sinks under
 * the lawn and the floor z-fights the terrain along the line where they meet.
 */
export const PLACEMENT_SILL = 0.06;

/** Every village room shares its building's world footprint; the campfire has
 * its own open shore clearing. A building's +z doorway faces the square. */
export const PLACE_PLACEMENTS: Readonly<Partial<Record<HarbourPlaceId, PlacePlacement>>> = Object.freeze({
  ...Object.fromEntries(Object.entries(SITE_FOR_PLACE).map(([id, building]) => {
    const site = VILLAGE_SITES[building!];
    return [id, Object.freeze({exterior:site.exterior,building,spot:site.spot,yaw:Math.atan2(-site.spot[0],-site.spot[1]),
      halfWidth:site.half[0],halfDepth:site.half[1],door:[site.door[0],0,site.door[1]] as Vec3,doorRadius:0.65,
      floorY:FLOOR_HEIGHT[id as HarbourPlaceId]??0,internal:id!==site.entry})];
  })) as Partial<Record<HarbourPlaceId,PlacePlacement>>,
  campfire: Object.freeze({ exterior: 'village-waterfront', outdoor: true, spot: VILLAGE_WATERFRONT.spot, yaw: VILLAGE_WATERFRONT.yaw,
    halfWidth: VILLAGE_WATERFRONT.half[0], halfDepth: VILLAGE_WATERFRONT.half[1], door: [VILLAGE_WATERFRONT.door[0], 0, VILLAGE_WATERFRONT.door[1]] as Vec3, doorRadius: .7 }),
});

/** Which places stand somewhere, in a stable order. */
export const PLACED_PLACE_IDS: readonly HarbourPlaceId[] = Object.freeze(Object.keys(PLACE_PLACEMENTS) as HarbourPlaceId[]);

/** The placement a place declares, or null when it keeps the origin. */
export function placementOf(place: HarbourPlaceId | null | undefined): PlacePlacement | null {
  return (place && PLACE_PLACEMENTS[place]) ?? null;
}

/** Half the diagonal of a placement's footprint: the radius the building itself fills. */
export function placementReach(placement: PlacePlacement): number {
  return Math.hypot(placement.halfWidth, placement.halfDepth);
}

/**
 * Stream in when the viewer is this far past the building's own reach, and let
 * go only this much further out again. The gap between the two is the
 * hysteresis: walking back and forth across one threshold cannot thrash,
 * because the threshold you leave by is two units beyond the one you came in
 * by, and a building costs its whole build to raise.
 *
 * The release radius is deliberately **shorter than the building's distance
 * from the Court's own centre**: standing in the Court, with the Queen in
 * front of you, every interior has been let go, so the Court still costs
 * exactly what the Court costs. A wider band would leave a room you visited
 * once standing behind you for the rest of the session.
 */
export const STREAM_MARGIN = 4, STREAM_RELEASE = 2;

/** How near the viewer must come before a placed interior is built. */
export const streamInRadius = (placement: PlacePlacement): number => placementReach(placement) + STREAM_MARGIN;
/** How far out the viewer must go before it is let go again. Always the larger. */
export const streamOutRadius = (placement: PlacePlacement): number => streamInRadius(placement) + STREAM_RELEASE;

/** A point turned from a placed place's own coordinates into the island's. */
export function placementToWorld(placement: PlacePlacement, local: Vec3, lift = placementLift(placement)): Vec3 {
  const cos = Math.cos(placement.yaw), sin = Math.sin(placement.yaw);
  const [x, y, z] = local;
  return [placement.spot[0] + x * cos + z * sin, y + lift, placement.spot[1] + z * cos - x * sin];
}

/**
 * Where a placed interior's floor sits: the highest island height its
 * footprint covers, plus the doorstep. Sampled at the footprint's corners, its
 * edge midpoints and its centre — enough for a surface this smooth, and pure,
 * so a test can read the same number the scene uses.
 */
export function placementLift(placement: PlacePlacement): number {
  const { halfWidth: w, halfDepth: d, yaw, spot } = placement;
  const cos = Math.cos(yaw), sin = Math.sin(yaw);
  let highest = -Infinity;
  for (const [lx, lz] of [[0, 0], [-w, -d], [w, -d], [-w, d], [w, d], [0, -d], [0, d], [-w, 0], [w, 0]] as const) {
    const x = spot[0] + lx * cos + lz * sin, z = spot[1] + lz * cos - lx * sin;
    const h = groundHeightAt(x, z);
    if (h > highest) highest = h;
  }
  return highest + PLACEMENT_SILL + (placement.floorY ?? 0);
}

/** The doorway of a placed building, in island coordinates: the threshold. */
export function placementDoor(placement: PlacePlacement): Vec3 {
  return placementToWorld(placement, placement.door);
}

/** Is a point on the island inside a placed building's doorway? */
export function atThreshold(placement: PlacePlacement, x: number, z: number): boolean {
  const door = placementDoor(placement);
  return Math.hypot(x - door[0], z - door[2]) <= placement.doorRadius;
}

/** Is a point on the island inside a placed building's walls? */
export function insidePlacement(placement: PlacePlacement, x: number, z: number): boolean {
  const cos = Math.cos(placement.yaw), sin = Math.sin(placement.yaw);
  const dx = x - placement.spot[0], dz = z - placement.spot[1];
  const lx = dx * cos - dz * sin, lz = dz * cos + dx * sin;
  return Math.abs(lx) <= placement.halfWidth && Math.abs(lz) <= placement.halfDepth;
}

/**
 * A pose written in a place's own coordinates, read in the island's. Poses
 * name a target and a heading; the target moves with the building and the
 * heading turns with it.
 */
export function placedPose<P extends Pose>(pose: P, placement: PlacePlacement | null): P {
  if (!placement) return pose;
  return { ...pose, target: placementToWorld(placement, pose.target), theta: pose.theta + placement.yaw };
}

/**
 * A room's hold, moved onto the island with its building (§4). The hold is
 * written as an axis-aligned box in the room's own coordinates; turned by the
 * building's yaw it stops being axis-aligned. The broad world envelope remains
 * available for framing, while `local` keeps the actual rotated eye limits.
 * `holdPoseInRoom` applies those limits to every shown camera pose. An
 * unplaced place passes `null` and keeps its original box.
 */
export function placedHold(hold: RoomHold | null, placement: PlacePlacement | null): RoomHold | null {
  if (!hold || !placement) return hold;
  const lift = placementLift(placement);
  const envelope = (box: { min: Vec3; max: Vec3 }): { min: Vec3; max: Vec3 } => {
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (const x of [box.min[0], box.max[0]]) for (const z of [box.min[2], box.max[2]]) {
      const [wx, , wz] = placementToWorld(placement, [x, 0, z], 0);
      minX = Math.min(minX, wx); maxX = Math.max(maxX, wx);
      minZ = Math.min(minZ, wz); maxZ = Math.max(maxZ, wz);
    }
    return { min: [minX, box.min[1] + lift, minZ] as Vec3, max: [maxX, box.max[1] + lift, maxZ] as Vec3 };
  };
  // The envelope is useful for broad framing, but the actual eye is held in
  // the room's own axes. Its edge stays inside the wall with near-plane space.
  const wallInset = 0.18;
  const localEye = {
    min: [Math.max(hold.eye.min[0], -placement.halfWidth + wallInset), hold.eye.min[1], Math.max(hold.eye.min[2], -placement.halfDepth + wallInset)] as Vec3,
    max: [Math.min(hold.eye.max[0], placement.halfWidth - wallInset), hold.eye.max[1], Math.min(hold.eye.max[2], placement.halfDepth - wallInset)] as Vec3,
  };
  return {
    ...hold, eye: envelope(hold.eye), target: envelope(hold.target),
    local: { x: placement.spot[0], y: lift, z: placement.spot[1], yaw: placement.yaw, eye: localEye, target: hold.target },
  };
}

/**
 * The camera envelope for a placed building.  A scene's authored hold may be
 * smaller than its exterior footprint; once the room stands on the island the
 * camera needs the whole floor plus the open doorway, in world coordinates.
 * This is pure so runtime and navigation tests use the same transform.
 */
export function placedFootprintHold(hold: RoomHold | null, placement: PlacePlacement | null): RoomHold | null {
  if (!hold || !placement) return hold;
  const hx = placement.halfWidth, hz = placement.halfDepth;
  return placedHold({
    ...hold,
    eye: { min: [-hx - .3, .25, -hz - .3], max: [hx + .3, 7, hz + 6] },
    target: { min: [-hx + .2, .2, -hz + .2], max: [hx - .2, 3, hz - .2] },
    maxR: 12,
    minPhi: .5,
  }, placement);
}
export type StreamStep = { id: HarbourPlaceId; action: "raise" | "release" };

/**
 * What the streamer should do, from where the viewer is standing. Pure, so the
 * hysteresis is a thing a test can hold still and walk back and forth across.
 *
 * `resident` is what stands now; `keep` is what may never be let go however far
 * away it is — the place the route says you are in, and the place a journey is
 * still flying out of.
 */
export function streamPlaces(
  focus: readonly [number, number],
  resident: Iterable<HarbourPlaceId>,
  keep: Iterable<HarbourPlaceId> = [],
): StreamStep[] {
  const standing = new Set(resident), held = new Set(keep);
  const steps: StreamStep[] = [];
  for (const id of PLACED_PLACE_IDS) {
    const placement = PLACE_PLACEMENTS[id]!;
    const distance = Math.hypot(focus[0] - placement.spot[0], focus[1] - placement.spot[1]);
    const inside = standing.has(id);
    if ((placement.internal || placement.outdoor) && !held.has(id)) { if (inside) steps.push({id,action:"release"}); continue; }
    if (!inside && distance <= streamInRadius(placement)) steps.push({ id, action: "raise" });
    else if (inside && !held.has(id) && distance >= streamOutRadius(placement)) steps.push({ id, action: "release" });
  }
  return steps;
}
