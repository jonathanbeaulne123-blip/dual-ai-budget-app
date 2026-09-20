/**
 * Little Harbour · the Queen in the Court (BUILD_PLAN §3, §2 #16).
 *
 * Loads her for a quality tier, stands her 2.05 units tall on her own pot's
 * base — the model's pot, nothing drawn over it — tags every mesh with its
 * touch region, seats the supported-history stems at her roots, and hands
 * back a breathing driver and two close poses. The caller decides when to
 * breathe (visible, no tool open, no gesture, never under reduced motion).
 *
 * Tiers: `full` is the Living Presence master through `createBloomQueen`
 * (shared, ref-counted, `decoration:false`); `lite` is the decimated court
 * copy (same node names) and falls back to the v1 Queen when that file is not
 * there yet. Materials are never recoloured. No money is read here.
 */
import * as THREE from "three";
import type { QueenStyle } from "../../house/queenStyle.ts";
import { BLOOM_QUEEN_HEIGHT, createBloomGrowth, createBloomQueen, disposeObject, type BloomEvidence } from "../../house/world/bloom.ts";
import { parseQueenModel, readQueenModel } from "../../queen/world/queenModel.ts";
import { QUEEN_ASSETS as QUEEN_MANIFEST } from "../assets/manifest.ts";
import { QUEEN_REGION_ORDER, queenNodeKey, regionBoxes, regionOfNode, type QueenRegion, type RegionBoxes } from "./queenTouch.ts";

export type QueenTier = "full" | "lite";
export type QueenSource = "presence" | "court" | "v1";

/** The Queen's files by source: the manifest's two (`assets/manifest.ts`, hash-fenced) and the v1 fallback the house already ships. */
export const QUEEN_ASSETS: Record<QueenSource, string> = {
  presence: QUEEN_MANIFEST.presence.url,
  court: QUEEN_MANIFEST.court.url,
  v1: "/models/queen/mandevilla-queen.v1.glb",
};

/** She stands 2.05 units, base at y = 0 (the house's `bloom.ts` normalisation). */
export const QUEEN_STANDING_HEIGHT = BLOOM_QUEEN_HEIGHT;
export const QUEEN_BREATH_PERIOD_S = 6;
export const QUEEN_BREATH_AMPLITUDE = 0.006;
/** Where the growth stems' bases sit in `createBloomGrowth`'s own space. */
const GROWTH_STEM_BASE_Y = 0.15;

/** A close pose for the court camera: look at `target` from distance `r`, heading `theta`, tilt `phi` from vertical. */
export type QueenPose = { target: [number, number, number]; r: number; theta: number; phi: number };

export type QueenPlace = {
  group: THREE.Group;
  tier: QueenTier;
  source: QueenSource;
  /** The nodes that breathe: her ceramic body (skull, torso, face, paws), never the gardens or the pot. */
  breathing: THREE.Object3D[];
  /** World-space region bounds, recomputed from the group's current transform. */
  regions(): RegionBoxes;
  /** `t` in seconds. Scales the body's y by ±0.6 % on a 6 s period about her base. */
  breathe(t: number): void;
  /** Back to stillness (reduced motion, tool open, gesture in progress). */
  rest(): void;
  poses(): Record<"portrait" | "roots", QueenPose>;
  dispose(): void;
};

const BREATHING_GROUPS: Record<QueenSource, string[]> = {
  presence: ["Anatomy", "Face", "Gesture"],
  court: ["Anatomy", "Face", "Gesture"],
  v1: ["Glazed ceramic bank"],
};

function findNode(root: THREE.Object3D, name: string): THREE.Object3D | null {
  const wanted = queenNodeKey(name);
  let found: THREE.Object3D | null = null;
  root.traverse((node) => { if (!found && queenNodeKey(node.name) === wanted) found = node; });
  return found;
}

/** Centre her on x/z, base at y = 0, height `QUEEN_STANDING_HEIGHT` — `bloom.ts`'s normalisation for a freshly parsed model. */
export function normaliseQueen(sculpture: THREE.Object3D): THREE.Group {
  const box = new THREE.Box3().setFromObject(sculpture), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  sculpture.position.set(-center.x, -box.min.y, -center.z);
  const normal = new THREE.Group(); normal.name = "Normalised master"; normal.add(sculpture);
  normal.scale.setScalar(QUEEN_STANDING_HEIGHT / Math.max(size.y, 0.01));
  sculpture.traverse((node) => { if (node instanceof THREE.Mesh) { node.castShadow = true; node.receiveShadow = true; } });
  return normal;
}

/** Tag every node under `root` with `userData.region` from the touch tables. Returns how many meshes were tagged per region. */
export function tagQueenRegions(root: THREE.Object3D): Record<QueenRegion, number> {
  const counts = Object.fromEntries(QUEEN_REGION_ORDER.map((region) => [region, 0])) as Record<QueenRegion, number>;
  root.traverse((node) => {
    const region = regionOfNode(node);
    if (!region) return;
    node.userData.region = region;
    if (node instanceof THREE.Mesh) counts[region] += 1;
  });
  return counts;
}

/** Move the growth group so its stem bases sit on top of the roots' bounds (group-local space). */
export function seatGrowthAtRoots(group: THREE.Group, growth: THREE.Object3D, boxes: RegionBoxes): void {
  const roots = boxes.roots ?? boxes.potRim;
  if (!roots || roots.isEmpty()) { growth.position.set(0, 0, 0); return; }
  group.updateWorldMatrix(true, false);
  const local = roots.clone().applyMatrix4(group.matrixWorld.clone().invert());
  const center = local.getCenter(new THREE.Vector3());
  growth.position.set(center.x, local.max.y - GROWTH_STEM_BASE_Y, center.z);
}

export type DressQueenInput = { tier: QueenTier; source: QueenSource; style: QueenStyle; evidence: BloomEvidence[] };

/**
 * Turn a normalised Queen group into a `QueenPlace`: region tags, growth at
 * the roots, breathing driver, poses. `group` must already stand at 2.05 units
 * with its base at y = 0 (from `createBloomQueen` or `normaliseQueen`).
 */
export function dressQueenPlace(group: THREE.Group, input: DressQueenInput): QueenPlace {
  group.name = `Queen · ${input.source}`;
  tagQueenRegions(group);
  group.traverse((node) => { if (node instanceof THREE.Mesh) { node.castShadow = true; node.receiveShadow = true; } });
  let growth = group.children.find((child) => child.name === "Supported history · identity anchored") ?? null;
  if (!growth) { growth = createBloomGrowth(input.style, input.evidence); group.add(growth); }
  const seat = () => seatGrowthAtRoots(group, growth!, regionBoxes(group));
  seat();
  const breathing = BREATHING_GROUPS[input.source].map((name) => findNode(group, name)).filter((node): node is THREE.Object3D => node !== null);
  const still = breathing.map((node) => node.scale.y);
  const rest = () => { breathing.forEach((node, i) => { node.scale.y = still[i]!; }); };
  const breathe = (t: number) => {
    const breath = 1 + QUEEN_BREATH_AMPLITUDE * Math.sin((t / QUEEN_BREATH_PERIOD_S) * Math.PI * 2);
    breathing.forEach((node, i) => { node.scale.y = still[i]! * breath; });
  };
  const poses = (): Record<"portrait" | "roots", QueenPose> => {
    const boxes = regionBoxes(group);
    const whole = new THREE.Box3().setFromObject(group);
    const at = (box: THREE.Box3 | undefined, fallbackY: number): [number, number, number] => {
      const center = (box && !box.isEmpty() ? box : whole).getCenter(new THREE.Vector3());
      return [center.x, box && !box.isEmpty() ? center.y : fallbackY, center.z];
    };
    return {
      portrait: { target: at(boxes.face, whole.min.y + (whole.max.y - whole.min.y) * 0.82), r: 1.3, theta: 0, phi: 1.35 },
      roots: { target: at(boxes.roots, whole.min.y + (whole.max.y - whole.min.y) * 0.18), r: 1.8, theta: 0.35, phi: 1.1 },
    };
  };
  return {
    group, tier: input.tier, source: input.source, breathing,
    regions: () => regionBoxes(group),
    breathe, rest, poses,
    dispose() { rest(); disposeObject(group); },
  };
}

async function loadLite(signal?: AbortSignal): Promise<{ scene: THREE.Group; source: QueenSource }> {
  try {
    return { scene: await parseQueenModel(await readQueenModel(signal, QUEEN_ASSETS.court)), source: "court" };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { scene: await parseQueenModel(await readQueenModel(signal, QUEEN_ASSETS.v1)), source: "v1" };
  }
}

/** Load the Queen for a tier and place her. `full` shares the house's master; `lite` prefers the court copy and falls back to v1. */
export async function loadQueenPlace(tier: QueenTier, style: QueenStyle, evidence: BloomEvidence[], signal?: AbortSignal): Promise<QueenPlace> {
  if (tier === "full") {
    const group = await createBloomQueen(style, evidence, { decoration: false, growth: true });
    if (signal?.aborted) { disposeObject(group); throw new DOMException("Closed", "AbortError"); }
    return dressQueenPlace(group, { tier, source: "presence", style, evidence });
  }
  const { scene, source } = await loadLite(signal);
  const group = new THREE.Group();
  group.add(normaliseQueen(scene));
  group.userData.evidence = evidence;
  return dressQueenPlace(group, { tier, source, style, evidence });
}
