import * as THREE from "three";
import type { ThemeId } from "../../theme/scenes.ts";
import type { HarbourPlaceId } from "../flag.ts";
import type { HarbourReadingLike } from "../flat/CourtFlat.tsx";
import type { RenderTier } from "./quality.ts";

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

/** Colours are CSS hex strings; the scene makes a `THREE.Color` of each once. */
export type PlaceLight = { sun: string; hemiSky: string; hemiGround: string; intensity: number };
export type PlaceDressing = {
  stone: string; joint: string; moss: string; plinth: string; timber: string; metal: string; gate: string;
  sky: string; fog: string; sea: string;
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

/** A touchable part of the Queen (or another body). Every mesh in `objects` carries `userData.region = id` so a raycast resolves it. */
export type Region = {
  id: string;
  /** The body the region belongs to; the twins rove inside one group. */
  group: string;
  label: string;
  objects: THREE.Object3D[];
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
  update(reading: HarbourReadingLike | null): void;
  /** `t` seconds since mount, `dt` seconds since the last animated frame. Only called when the frame policy animates. */
  animate(t: number, dt: number): void;
  dispose(): void;
  anchors(): Anchor[];
  poses(): Record<PoseKey, Pose>;
  regions(): Region[];
}

export interface Place {
  readonly id: HarbourPlaceId;
  build(scene: THREE.Scene, dressing: PlaceDressing, reading: HarbourReadingLike | null, quality: RenderTier, context: PlaceBuildContext): PlaceHandle;
}

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

/**
 * The court's dressing by theme (BUILD_PLAN §6), used until writer D's
 * `court/dressing.ts` derives the same fields from `resolveThemeScene`.
 */
export const SCENE_DRESSING: Readonly<Record<ThemeId, PlaceDressing>> = Object.freeze({
  classic: { stone: "#cbb48f", joint: "#8f7d60", moss: "#6d7f4f", plinth: "#b9a07a", timber: "#6b4a32", metal: "#caa252", gate: "#6b4a32", sky: "#d9c9a8", fog: "#d9c9a8", sea: "#7fa9a4", light: { sun: "#ffe6be", hemiSky: "#fff1df", hemiGround: "#5c4230", intensity: 2.2 } },
  taylor: { stone: "#ead8d2", joint: "#d9b8c4", moss: "#9fae86", plinth: "#e0c5c9", timber: "#8a6a72", metal: "#d9b8c4", gate: "#8a6a72", sky: "#f2e3ea", fog: "#f2e3ea", sea: "#a9c7cc", light: { sun: "#ffd9e4", hemiSky: "#fff4f7", hemiGround: "#7a5a66", intensity: 2.0 } },
  newfoundland: { stone: "#7d8d93", joint: "#c9b48c", moss: "#5f7f6a", plinth: "#5c6b70", timber: "#45686d", metal: "#c9ae5a", gate: "#b75a4e", sky: "#dfe9ec", fog: "#dfe9ec", sea: "#6f9aa3", light: { sun: "#fff3e0", hemiSky: "#e9f2f4", hemiGround: "#4d7582", intensity: 2.4 } },
});

/** Resolves a pose for the composition: `key@phone` wins over `key` on a phone, and so on. */
export function poseFor(poses: Record<PoseKey, Pose>, key: PoseKey, composition: Composition): Pose | undefined {
  return poses[`${key}@${composition}`] ?? poses[key];
}
