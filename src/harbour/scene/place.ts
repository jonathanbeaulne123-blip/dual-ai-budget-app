import * as THREE from "three";
import type { ThemeId } from "../../theme/scenes.ts";
import { COURT_DRESSING, type CourtDressing } from "../court/dressing.ts";
import type { HarbourPlaceId } from "../flag.ts";
import type { HarbourReading } from "../data/reading.ts";
import type { RenderTier } from "./quality.ts";
import type { RoomHold } from "../camera/poses.ts";

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

/** The partner's presence, from the App's soft-presence display (never from the books). */
export type PlacePartner = { fresh: boolean; name?: string };
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
