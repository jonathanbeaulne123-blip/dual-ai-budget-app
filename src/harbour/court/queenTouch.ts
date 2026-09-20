/**
 * Little Harbour · how you touch her (LITTLE_HARBOUR_v2 §1, BUILD_PLAN §3).
 *
 * Her anatomy is the control surface: six regions masked by the model's own
 * mesh names, one gesture classifier over pointer samples, and one grammar
 * table from (region, gesture) to at most one action. Everything here is
 * pure and reads no money. Touch feedback (`spark`) is a phrase and a colour,
 * never a number.
 *
 * Two name sets: the Living Presence master (and its decimated court copy,
 * same names) and the v1 Queen. Names are compared on letters and digits only
 * (`key`, as `src/queen/world/queenModel.ts`), because loaders turn spaces
 * into underscores. Every node in both GLBs is either in a region or in the
 * explicit `QUEEN_IGNORED_NODES` list — the test reads both files to prove it.
 */
import * as THREE from "three";

export type QueenRegion = "crown" | "vines" | "hands" | "face" | "roots" | "potRim";
export const QUEEN_REGION_ORDER: readonly QueenRegion[] = ["crown", "vines", "hands", "face", "roots", "potRim"];

export const QUEEN_REGIONS: Record<QueenRegion, { presence: string[]; v1: string[] }> = {
  crown: {
    presence: [
      "Crown growth",
      "Crown growth | shoots emerge directly from the ceramic scalp",
      "Crown growth | cupped living leaves",
      "Crown growth | raised leaf midribs",
      "Anatomy | integral scalloped queen skull and cat ears",
    ],
    v1: ["Living hair | crown vines", "Living hair | crown leaves", "Living hair | crown veins"],
  },
  vines: {
    presence: [
      "Left garden", "Right garden", "Back garden", "Flowers", "New growth", "Dew",
      ...["Left garden", "Right garden", "Back garden"].flatMap((garden) => [
        `${garden} | flowing crown-born stems`, `${garden} | winding companion tendrils`, `${garden} | attached leaf petioles`,
        `${garden} | cupped living leaves`, `${garden} | raised leaf midribs`, `${garden} | branching leaf veins`, `${garden} | unfurling tips`,
      ]),
      "Flowers | attached flower stalks", "Flowers | white five-lobed trumpet flowers", "Flowers | pointed calyx sepals", "Flowers | red five-lobed trumpet flowers",
      "New growth | reaching bud stems", "New growth | bud pedicels", "New growth | furled flower buds", "New growth | spiral bud seams",
      "Dew | small morning droplets on living leaves",
    ],
    v1: [
      ...["left", "right", "back"].flatMap((side) => [`Living hair | ${side} vines`, `Living hair | ${side} leaves`, `Living hair | ${side} veins`, `Living hair | ${side} white flowers`, `Living hair | ${side} red flowers`]),
      "Living hair | unopened buds", "Living hair | buds stems",
    ],
  },
  hands: {
    presence: [
      "Gesture",
      "Gesture | fine paw creases", "Gesture | seed resting in the cupped paws", "Gesture | the seedling she quietly nurtures",
      "Gesture | cupped living leaves", "Gesture | raised leaf midribs",
      "Anatomy | continuous queen torso and nurturing meditating paws",
    ],
    v1: ["Ceramic | torso and meditating paws", "Face | paw details"],
  },
  face: {
    presence: [
      "Face",
      "Face | warm rose ear interiors", "Face | long serene eyelids", "Face | quiet outer lashes", "Face | rose button nose",
      "Face | short feline philtrum", "Face | individual small W smile", "Face | familiar three whisker dimples",
      "Face | recessed coin-slot lip", "Face | dark floor inside coin well",
    ],
    v1: ["Face | enamel details", "Face | whisker dimples", "Face | nose", "Ceramic | cat head and ears", "Ceramic | rose ear insets"],
  },
  roots: {
    presence: [
      "Emergence", "Emergence | soft root flutes becoming ivory clay",
      "New life", "New life | young rooted shoots at the planter", "New life | cupped living leaves", "New life | raised leaf midribs",
      "Earthwork | soil visible around the living roots", "Earthwork | living moss cushions at the roots",
    ],
    v1: ["Pot | soil", "Pot | botanical inlay"],
  },
  potRim: {
    presence: [
      "Earthwork | warm terracotta planter with open interior", "Earthwork | quiet wheel-thrown ridges", "Earthwork | broad hand-thrown saucer",
      "Earthwork | embossed sprigs beside the family seal",
      "Crest", "Crest | shallow clay seal backing", "Crest | softly oval rim", "Crest | red five-petal mandevilla", "Crest | shared golden flower hearts",
      "Crest | intertwined stems form a heart", "Crest | paired enamel leaves", "Crest | white five-petal mandevilla",
    ],
    v1: ["Pot | hand-thrown terracotta", "Pot | saucer", "Pot | throwing rings"],
  },
};

/**
 * Named nodes that are deliberately not a control: structural groups that mix
 * regions, the bank hardware at her back, the tail and the snail. Touching them
 * does nothing; the ground behind them takes the gesture instead.
 */
export const QUEEN_IGNORED_NODES: { presence: string[]; v1: string[] } = {
  presence: [
    "Mandevilla Queen — The Living Presence", "Anatomy", "Earthwork",
    "Small lives", "Small lives | snail resting at the saucer", "Small lives | amber snail shell", "Small lives | sculpted shell spiral", "Small lives | two tiny antennae",
  ],
  v1: [
    "Mandevilla Queen", "Terracotta planter", "Glazed ceramic bank", "Living mandevilla hair",
    "Bank | coin slot rim", "Bank | recessed slot interior", "Bank | rear stopper", "Ceramic | curled tail",
  ],
};

/** Node names survive the loader with spaces turned to underscores; compare on letters and digits only. */
export const queenNodeKey = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]/g, "");

const REGION_BY_KEY: ReadonlyMap<string, QueenRegion> = (() => {
  const map = new Map<string, QueenRegion>();
  for (const region of QUEEN_REGION_ORDER) for (const name of [...QUEEN_REGIONS[region].presence, ...QUEEN_REGIONS[region].v1]) map.set(queenNodeKey(name), region);
  return map;
})();
const IGNORED_KEYS: ReadonlySet<string> = new Set([...QUEEN_IGNORED_NODES.presence, ...QUEEN_IGNORED_NODES.v1].map(queenNodeKey));

/** The region a node name belongs to, or `null` for an ignored or unknown node. */
export function regionOf(name: string): QueenRegion | null {
  return REGION_BY_KEY.get(queenNodeKey(name)) ?? null;
}
/** True when the name is on the explicit ignore list (structural group, bank hardware, tail, snail). */
export function isIgnoredQueenNode(name: string): boolean {
  return IGNORED_KEYS.has(queenNodeKey(name));
}

/** The region of a scene node: its own `userData.region` tag first, then its name, then the nearest tagged or named ancestor. */
export function regionOfNode(node: THREE.Object3D | null): QueenRegion | null {
  for (let current = node; current; current = current.parent) {
    const tagged = current.userData.region;
    if (typeof tagged === "string" && QUEEN_REGION_ORDER.includes(tagged as QueenRegion)) return tagged as QueenRegion;
    const named = regionOf(current.name);
    if (named) return named;
    if (isIgnoredQueenNode(current.name)) return null;
  }
  return null;
}

export type RegionBoxes = Partial<Record<QueenRegion, THREE.Box3>>;

/** World-space bounds of every region under `root`, from the meshes' geometry bounds. Empty regions are absent. */
export function regionBoxes(root: THREE.Object3D): RegionBoxes {
  root.updateWorldMatrix(true, true);
  const boxes: RegionBoxes = {};
  const box = new THREE.Box3();
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const region = regionOfNode(node);
    if (!region) return;
    const geometry = node.geometry as THREE.BufferGeometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (!geometry.boundingBox || geometry.boundingBox.isEmpty()) return;
    box.copy(geometry.boundingBox).applyMatrix4(node.matrixWorld);
    const current = boxes[region];
    if (current) current.union(box); else boxes[region] = box.clone();
  });
  return boxes;
}

export type ScreenRect = { x: number; y: number; width: number; height: number };
export type Viewport = { width: number; height: number };
export type RegionRects = Partial<Record<QueenRegion, ScreenRect>>;

/**
 * Screen rectangles (CSS px, origin top-left) for each region's box through
 * `camera`, clamped to the viewport. A region entirely behind the camera or
 * entirely off-screen is absent.
 */
export function projectRegions(boxes: RegionBoxes, camera: THREE.Camera, viewport: Viewport): RegionRects {
  camera.updateMatrixWorld(true);
  const rects: RegionRects = {};
  const corner = new THREE.Vector3();
  for (const region of QUEEN_REGION_ORDER) {
    const box = boxes[region];
    if (!box || box.isEmpty()) continue;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, seen = 0;
    for (let i = 0; i < 8; i += 1) {
      corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
      if (!Number.isFinite(corner.x) || !Number.isFinite(corner.y) || corner.z > 1) continue;
      const x = (corner.x + 1) / 2 * viewport.width, y = (1 - corner.y) / 2 * viewport.height;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); seen += 1;
    }
    if (!seen) continue;
    const x = Math.max(0, minX), y = Math.max(0, minY), right = Math.min(viewport.width, maxX), bottom = Math.min(viewport.height, maxY);
    if (right <= x || bottom <= y) continue;
    rects[region] = { x, y, width: right - x, height: bottom - y };
  }
  return rects;
}

// ---- gestures ----

export type GestureSample = { x: number; y: number; t: number; pointer?: number };
export type QueenGesture = "tap" | "stroke-up" | "stroke-down" | "drag-x" | "drag-y" | "pinch" | "long-press";

export const GESTURE_TAP_PX = 8;
export const GESTURE_TAP_MS = 350;
export const GESTURE_LONG_PRESS_MS = 500;
/** A stroke is a flick: over in under this many ms and faster than this many px/ms. Anything slower is a drag. */
export const GESTURE_STROKE_MS = 300;
export const GESTURE_STROKE_SPEED = 0.5;

/**
 * One gesture from a pointer's samples (first = down, last = up). Samples from
 * two or more `pointer` ids make a pinch. Empty input is `null`.
 */
export function classifyGesture(samples: readonly GestureSample[]): QueenGesture | null {
  if (!samples.length) return null;
  const pointers = new Set(samples.map((sample) => sample.pointer ?? 0));
  if (pointers.size >= 2) return "pinch";
  const first = samples[0]!, last = samples[samples.length - 1]!;
  const dx = last.x - first.x, dy = last.y - first.y, ms = Math.max(0, last.t - first.t);
  const distance = Math.hypot(dx, dy);
  if (distance < GESTURE_TAP_PX) return ms >= GESTURE_LONG_PRESS_MS ? "long-press" : "tap";
  if (Math.abs(dx) > Math.abs(dy)) return "drag-x";
  const flick = ms < GESTURE_STROKE_MS && distance / Math.max(1, ms) >= GESTURE_STROKE_SPEED;
  if (flick) return dy < 0 ? "stroke-up" : "stroke-down";
  return "drag-y";
}

// ---- the grammar ----

export type QueenAction =
  | "growth-lens"          // crown tap: Living → Growth → Shape
  | "botanical-presence"   // crown drag up/down: more or less botanical presence (caller reads the sign)
  | "weeks-forward"        // vines stroke up: forward through the weeks
  | "weeks-back"           // vines stroke down: back through the weeks
  | "held-item"            // hands tap: what she is holding for you
  | "turn-held-item"       // hands drag: turn it over
  | "portrait"             // face tap: portrait view; tap again: back
  | "roots-view"           // roots tap: what feeds her
  | "spin"                 // pot rim drag left/right: spin her
  | "distance";            // pot rim drag down/up: closer / farther

const GRAMMAR: Record<QueenRegion, Partial<Record<QueenGesture, QueenAction>>> = {
  crown: { tap: "growth-lens", "drag-y": "botanical-presence", "stroke-up": "botanical-presence", "stroke-down": "botanical-presence" },
  vines: { "stroke-up": "weeks-forward", "stroke-down": "weeks-back" },
  hands: { tap: "held-item", "drag-x": "turn-held-item", "drag-y": "turn-held-item" },
  face: { tap: "portrait" },
  roots: { tap: "roots-view" },
  potRim: { "drag-x": "spin", "drag-y": "distance" },
};

/** At most one action per (region, gesture); `null` for every combination the grammar leaves undefined (pinch and long-press on her are the court's, not hers). */
export function gestureAction(region: QueenRegion, gesture: QueenGesture): QueenAction | null {
  return GRAMMAR[region][gesture] ?? null;
}

export type QueenSpark = { region: QueenRegion; phrase: string; color: string; petals: number; durationMs: number };

const SPARKS: Record<QueenRegion, { phrase: string; color: string }> = {
  crown: { phrase: "She notices.", color: "#6d7f4f" },
  vines: { phrase: "The weeks stir.", color: "#527653" },
  hands: { phrase: "Held gently.", color: "#f8e9d6" },
  face: { phrase: "She looks back.", color: "#e39bae" },
  roots: { phrase: "What feeds her.", color: "#8a6a4a" },
  potRim: { phrase: "Warm clay.", color: "#b66547" },
};

/** Feedback only — six petals for 600 ms and a phrase. Never a number, never data. */
export function spark(region: QueenRegion): QueenSpark {
  return { region, ...SPARKS[region], petals: 6, durationMs: 600 };
}
