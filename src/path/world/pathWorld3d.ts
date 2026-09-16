import * as THREE from "three";
import type { ThemeId } from "../../theme/scenes.ts";
import type { KittyPieceV1 } from "../../core/types.ts";
import { createKittySculpture, type KittySculpture } from "../../kitty/sculpture.ts";
import { CELL, GRID, HALF, SIZE, heightAt, idx, islandHash, type GrownIsland, type Piece } from "../grow.ts";
import { walkPath, walkSeconds, type WalkPoint } from "../walk.ts";
import { COIN_POOL, landmarkStepChange } from "../landmarks.ts";
import { charterSpot, cottageSpot, forkAngle, type PathSitdown } from "../together.ts";
import type { PathEraHome, PathEraPlanKind } from "../../core/pathWorld.ts";

/**
 * The Our Path world (D-262): one renderer, one island, an orbiting camera
 * whose distance decides how much the page says. The canvas is decorative
 * (`aria-hidden`); every thing you can open is a real button the page draws
 * over the canvas at the anchor positions this module reports each frame.
 */

export type PathCharacter = "steady" | "bloom" | "milestone" | "uphill" | "storm" | "paused";
export type PathWorldInput = {
  island: GrownIsland;
  theme: ThemeId;
  characters: PathCharacter[];
  /** `sitdown`: the Shared Sitdown in this Chapter's months. Open blazes; closed settles to embers. */
  campfires: { id: string; month: number; lit: boolean; state: string; sitdown: PathSitdown }[];
  moves: { id: string; state: "done" | "waiting" | "next" | "open" }[];
  goals: { id: string; step: number; piece: KittyPieceV1 | null; fired: boolean }[];
  lamps: { id: string; month: number }[];
  /** Kept Memories. `photo`: an object URL of the household board photo that hangs on this flag (the page owns and revokes it). */
  memories: { id: string; month: number; photo?: string }[];
  /**
   * The Calendar as weather, ahead of the current month along the road to the next one.
   * `dayOffset`: days from today (0–31 maps to 0–1.2 of that road segment). `weight`: 0–1 shape only.
   * The `mist` entry is anchored as the mark `mist` (a signpost with an "i").
   */
  weather: PathWeatherInput[];
  /** Covered stretches of the next month's road, as day offsets: a warm tint on the thread. */
  sunlit?: { fromOffset: number; toOffset: number }[];
  /** Household planner tasks as stepping stones beside their month (a different thing from Chapter Moves). */
  stones?: PathStoneInput[];
  /**
   * My private footpaths (the signed-in member's own personal tasks). The page derives them on read
   * from this device's Personal envelope only; the world just draws a dashed trail inland to a cairn.
   */
  footpaths?: PathFootpathInput[];
  /** "Share with Our Home" as a footbridge beside its month: planks appear by stage (0 = stumps). */
  bridges?: PathBridgeInput[];
  unknown: { id: string; month: number }[];
  name: string | null;
  layers: { weather: boolean; story: boolean; rhythm: boolean };
  /** The kiln hut beside the landmarks: present once a shared bank exists; warm when one was fired lately. */
  kiln?: { warm: boolean } | null;
  /** Permanent land: closed books (paved kerb), a closed Sitdown (kerb), stamped weeks (small lanterns, max 5). */
  land?: { month: number; closed: boolean; stamps: number; set?: boolean }[];
  /** 1 = just me; 2 = both of us live. Nothing is stored. */
  presentMembers?: number;
  /** The Charter's stone square: lit when signed, leaning while someone has not signed, one carved line per amendment. */
  charter?: { signed: boolean; leaning: boolean; amendments: number } | null;
  /** Agreed decisions as short road stubs off their acceptance month. */
  forks?: { id: string; month: number; index: number }[];
  /** Hercules's cottage (Play): present only when the page can open Play. Anchored as `cottage`. */
  cottage?: boolean;
  /**
   * The Journey of Life (D-268). The main island is the current era; every other era floats around it.
   * Absent or empty: the island draws exactly as before (a household that has not laid out a journey).
   */
  eras?: PathEraIslandInput[];
  /** The current era's home, standing at the centre of the main island. Anchored as `era-home`. */
  home?: PathEraHome | null;
  /**
   * The bridge out of the current era toward the next era island (offset 1). One lantern per part of the finish line.
   * `open`: every lantern lit. `crossing`: one of us has agreed to cross (planks half down). Anchored as `era-gate`.
   */
  gate?: { lanterns: boolean[]; open: boolean; crossing: boolean } | null;
};
/**
 * One floating era island (D-268). Anchors: `era:<id>` for the island, `era:<id>:plan:<planId>` for each plan.
 * `offset` is the era's place relative to the current era: negative = past (behind), positive = future (ahead);
 * sketched eras (only one of us agreed) come after the last future era.
 */
export type PathEraIslandInput = {
  id: string;
  state: "past" | "future" | "sketched";
  offset: number;
  name: string;
  home: PathEraHome;
  /** Past eras: their own island grown from their own months (the page grows it with `growIsland`). Future: null. */
  island: GrownIsland | null;
  plans: { id: string; kind: PathEraPlanKind; step: number | null; bought: boolean; sketched: boolean }[];
  /** Future and sketched islands sit in fog unless focused. */
  focused: boolean;
};
export type PathWeatherInput = { id: string; kind: "cloud" | "storm" | "sunrise" | "mist"; weight: number; dayOffset: number };
export type PathFootpathInput = { id: string; month: number; done: boolean };
export type PathBridgeInput = { id: string; month: number; stage: 0 | 1 | 2 | 3 };
export type PathStoneInput = { id: string; month: number; state: "open" | "done" | "waiting"; lit: boolean; money: boolean; owner: boolean; backup: boolean };
/** Days ahead covered by one road segment: 31 days reach 1.2 of the way to the next month. */
export const PATH_WEATHER_DAYS = 31;
export const PATH_WEATHER_REACH = 1.2;
export function weatherAlong(dayOffset: number): number {
  return Math.max(0, Math.min(PATH_WEATHER_DAYS, dayOffset)) / PATH_WEATHER_DAYS * PATH_WEATHER_REACH;
}
/**
 * The Journey of Life layout (D-268). The journey is one line through the main island: at the default camera
 * (theta 0.7) the future lies straight ahead, beyond the island, and the past lies behind it, on the viewer's side.
 * Each further era turns the same way around the ring and a little further out, so the two ends never meet.
 */
export const ERA_AXIS = -2.27;
export const ERA_RING = 150;
export const ERA_STEP = 0.3;
export const ERA_SPREAD = 24;
/** Past islands: the grown island scaled down to a finished, smaller land (heights flattened a little more), never wider than ERA_PAST_MAX. */
export const ERA_PAST_SCALE = 0.42;
export const ERA_PAST_MAX = 24;
export const ERA_PAST_LIFT = 0.55;
/** Footprint radius of a future (rock) and a sketched (ghost) islet. */
export const ERA_FUTURE_RADIUS = 13;
export const ERA_SKETCH_RADIUS = 10;
/** Where an era island floats: `a` is the world angle (x = cos a · r, z = sin a · r). Offset 0 is the main island. */
export function eraRingSpot(offset: number): { a: number; r: number } {
  const k = Math.abs(Math.round(offset));
  if (!k) return { a: ERA_AXIS, r: 0 };
  const raw = ERA_AXIS + (offset < 0 ? Math.PI : 0) + (k - 1) * ERA_STEP;
  return { a: Math.atan2(Math.sin(raw), Math.cos(raw)), r: ERA_RING + (k - 1) * ERA_SPREAD };
}
/** Coarse sampling of a past island's grid: every `step`-th cell (Full 3 → 51×51, Lite 5 → 31×31). */
export function eraSampleStep(quality: PathQuality): number { return quality === "lite" ? 5 : 3; }
export function eraSampleDims(step: number): number { return Math.floor((GRID - 1) / Math.max(1, Math.floor(step))) + 1; }
/** How much a past island grown to month `cur` is scaled down (the coast grows 1.45 per month from 30). */
export function eraPastScale(cur: number): number { return Math.min(ERA_PAST_SCALE, ERA_PAST_MAX / (30 + Math.max(0, cur) * 1.45)); }
/** Footprint radius of that past island. */
export function eraPastRadius(cur: number): number { return (30 + Math.max(0, cur) * 1.45) * eraPastScale(cur); }
/** The Sky camera turn for a screen shape: phones look down the journey (future ahead), wide screens see it across (past left, future right). */
export function eraSkyTheta(aspect: number): number { return aspect >= 1.2 ? 1.77 : aspect >= 0.8 ? 1.2 : 0.7; }
export const ERA_SKY_MIN = 220;
export const ERA_SKY_MAX = 600;
/** The share of the stage (0–0.4 per side) the page's own controls cover; the Sky frame keeps the journey clear of it. */
export type PathSafeArea = { top: number; right: number; bottom: number; left: number };
const NO_SAFE: PathSafeArea = { top: 0, right: 0, bottom: 0, left: 0 };
/**
 * The Sky frame that holds every island (`r`: footprint radius, `y`: how high it floats) for a camera turned to `theta`
 * at tilt `phi` (from vertical) with a 40° vertical field of view. Islands are projected the way the camera sees them
 * (nearer islands look bigger), and the journey is fitted inside the part of the stage the page's controls leave clear.
 */
export function eraSkyFrame(islands: { x: number; z: number; r: number; y?: number }[], aspect: number, theta: number, phi = 0.95, safe: PathSafeArea = NO_SAFE): { tx: number; tz: number; r: number } {
  if (!islands.length) return { tx: 0, tz: 0, r: ERA_SKY_MIN };
  const clampSide = (v: number) => Math.max(0, Math.min(0.4, Number.isFinite(v) ? v : 0));
  const inset = { top: clampSide(safe.top), right: clampSide(safe.right), bottom: clampSide(safe.bottom), left: clampSide(safe.left) };
  const tanV = Math.tan(20 * Math.PI / 180), tanH = tanV * Math.max(0.2, aspect);
  // The clear box in normalised screen units (−1…1), with a small margin so labels above the islands fit too.
  const bx0 = -1 + 2 * inset.left + 0.04, bx1 = 1 - 2 * inset.right - 0.04;
  const by0 = -1 + 2 * inset.bottom + 0.04, by1 = 1 - 2 * inset.top - 0.1;
  const ux = (bx0 + bx1) / 2, uy = (by0 + by1) / 2;
  // Sample each island's rim at its height, and a little above (homes and signposts).
  const points = islands.flatMap((p) => Array.from({ length: 8 }, (_, i) => {
    const a = i / 8 * Math.PI * 2, y = p.y ?? 0;
    return [{ x: p.x + Math.cos(a) * p.r, y, z: p.z + Math.sin(a) * p.r }, { x: p.x + Math.cos(a) * p.r * 0.5, y: y + 6, z: p.z + Math.sin(a) * p.r * 0.5 }];
  }).flat());
  const sinT = Math.sin(theta), cosT = Math.cos(theta), sinP = Math.sin(phi), cosP = Math.cos(phi);
  // Camera basis (independent of the target and distance): forward, right, up.
  const F = { x: -sinP * sinT, y: -cosP, z: -sinP * cosT };
  const R = { x: -F.z, z: F.x }, rl = Math.hypot(R.x, R.z) || 1; R.x /= rl; R.z /= rl;
  const U = { x: -R.z * F.y, y: R.z * F.x - R.x * F.z, z: R.x * F.y };
  // Ground-forward: moving the target this way moves every island down the screen by about `gu` per unit.
  const G = { x: -sinT, z: -cosT };
  const gu = Math.max(0.2, G.x * U.x + G.z * U.z);
  const box = (tx: number, tz: number, r: number) => {
    const cx = tx + r * sinP * sinT, cy = r * cosP, cz = tz + r * sinP * cosT;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of points) {
      const dx = p.x - cx, dy = p.y - cy, dz = p.z - cz;
      const depth = Math.max(1, dx * F.x + dy * F.y + dz * F.z);
      const sx = (dx * R.x + dz * R.z) / (depth * tanH), sy = (dx * U.x + dy * U.y + dz * U.z) / (depth * tanV);
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    return { x0, x1, y0, y1 };
  };
  // Centre the journey in the clear box at distance r (a few refinement steps), then report whether it fits.
  const centre = (r: number) => {
    let tx = islands.reduce((a, p) => a + p.x, 0) / islands.length, tz = islands.reduce((a, p) => a + p.z, 0) / islands.length;
    let b = box(tx, tz, r);
    for (let i = 0; i < 8; i++) {
      const ex = (b.x0 + b.x1) / 2 - ux, ey = (b.y0 + b.y1) / 2 - uy;
      const dr = ex * r * tanH, dg = ey * r * tanV / gu;
      tx += R.x * dr + G.x * dg; tz += R.z * dr + G.z * dg;
      b = box(tx, tz, r);
    }
    return { tx, tz, fits: b.x1 - b.x0 <= bx1 - bx0 && b.y1 - b.y0 <= by1 - by0 };
  };
  let lo = ERA_SKY_MIN, hi = ERA_SKY_MAX;
  if (centre(lo).fits) hi = lo;
  else for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (centre(mid).fits) hi = mid; else lo = mid; }
  const r = Math.round(hi);
  const at = centre(r);
  // Never aim far out past the journey (a very lopsided safe area could ask for it).
  const reach = Math.max(1, ...islands.map((p) => Math.hypot(p.x, p.z)));
  const d = Math.hypot(at.tx, at.tz), k = d > reach ? reach / d : 1;
  return { tx: at.tx * k, tz: at.tz * k, r };
}
export type PathAnchor = { id: string; x: number; y: number; depth: number; visible: boolean };
export type PathLevel = 0 | 1 | 2 | 3;
export const PATH_LEVEL_RADIUS: readonly number[] = [150, 82, 44, 20];
export type PathQuality = "full" | "lite";
export type PathWorldStats = {
  frames: number; lastFrameMs: number; pieces: number; level: PathLevel; ambient: boolean;
  quality: PathQuality;
  /** The page asked the world to sleep (the tent is open): nothing renders, everything stays allocated. */
  sleeping: boolean;
  /** Ambient motion is on but nobody has touched the island for a while, so the loop has stopped. */
  idle: boolean;
  /** The two walkers are on the road between months. */
  walking: boolean;
};
/** With ambient motion on, the loop still stops after this long without interaction or a scene change. */
export const IDLE_MS = 20_000;
/** Pixel-ratio caps: Full keeps today's 1.5; Lite draws fewer pixels on dense phone screens. */
const PIXEL_RATIO_CAP: Record<PathQuality, number> = { full: 1.5, lite: 1.25 };

type Palette = {
  sky: [string, string, string]; fog: string; grass: string; dry: string; sand: string; rock: string; sea: string; deep: string;
  thread: string; leaves: string[]; blooms: string[]; roofs: string[]; walls: string[]; snow: string; accent: string; second: string;
};
const PALETTES: Record<ThemeId, Palette> = {
  classic: {
    sky: ["#e9e1d0", "#f4ecdc", "#efe3cf"], fog: "#efe6d6", grass: "#7aa866", dry: "#d3b176", sand: "#ecdab0", rock: "#a39a8c",
    sea: "#9cc6bf", deep: "#7fb1aa", thread: "#b5653e", leaves: ["#6f9a5c", "#8aab68", "#5f8a62", "#a4b46e"],
    blooms: ["#c96e4a", "#f2e2c0", "#e7b86a", "#ffffff"], roofs: ["#b5653e", "#4f6b4a", "#8a5a3e", "#c98a4a"], walls: ["#f6efe2", "#efe4cf", "#e8ddc8", "#f3e6cc"],
    snow: "#f5f2ec", accent: "#b5653e", second: "#4f6b4a",
  },
  taylor: {
    sky: ["#e7d5cf", "#f7e6d2", "#f5dbe2"], fog: "#f5e4d8", grass: "#72ab62", dry: "#d6ae6a", sand: "#efdcaa", rock: "#9c9387",
    sea: "#8ccfca", deep: "#6fb2ae", thread: "#b8862f", leaves: ["#78a566", "#96b66c", "#6c9a72", "#aab874", "#d99aab"],
    blooms: ["#f08fb1", "#f7c85f", "#ffffff", "#c79be0", "#f5a07a"], roofs: ["#c9677f", "#946522", "#6d8aa6", "#7f9a73"], walls: ["#fbf1e2", "#f3d7dc", "#e6eef2", "#f5e3b8"],
    snow: "#f4f1ec", accent: "#946522", second: "#a63968",
  },
  newfoundland: {
    sky: ["#c9d5da", "#dfe7e6", "#e9ede8"], fog: "#dde5e4", grass: "#648f5e", dry: "#bfa56c", sand: "#d9cfb3", rock: "#8a8a86",
    sea: "#6ea7b8", deep: "#4f8a9e", thread: "#a33751", leaves: ["#4f7a5c", "#5f8a62", "#6b9160", "#3f6a52"],
    blooms: ["#b04f8f", "#f2cf3b", "#ffffff", "#8f6fc2"], roofs: ["#283f50", "#3d4b53", "#4c5a5f", "#2f3e46"], walls: ["#a33751", "#26766f", "#f2cf3b", "#3c6ea3", "#e07a3b"],
    snow: "#f1f4f4", accent: "#a33751", second: "#26766f",
  },
};
const CHARACTER_COLOR: Record<PathCharacter, string> = {
  steady: "#a9b98f", bloom: "#e79ab2", milestone: "#e0ad3c", uphill: "#c9a36a", storm: "#7f8fa8", paused: "#cfc5b3",
};

export function createPathWorld(host: HTMLElement, options: {
  reducedMotion: boolean;
  onLost?: () => void;
  onAnchors?: (anchors: PathAnchor[]) => void;
  onLevel?: (level: PathLevel) => void;
  onPick?: (id: string) => void;
  brass?: string;
  wood?: string;
  /** Full: soft shadows and every decorative ticker. Lite: no shadows, fewer pixels, no ambient decor. */
  quality?: PathQuality;
  /** Proof pages only: override the idle pause (Infinity disables it, to measure the old behaviour). */
  idleMs?: number;
}) {
  const idleMs = options.idleMs ?? IDLE_MS;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power", preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.className = "path-world__canvas";
  renderer.domElement.style.touchAction = "none";
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 900);
  const hemi = new THREE.HemisphereLight(0xfff0dc, 0x8e8272, 1.35);
  const sun = new THREE.DirectionalLight(0xffe6c4, 2.2);
  sun.position.set(-60, 90, 40);
  sun.shadow.mapSize.set(1536, 1536);
  Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 10, far: 260 });
  sun.shadow.bias = -0.0006;
  scene.add(hemi, sun);

  const cleanup: (() => void)[] = [];
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Map<string, THREE.Material>();
  const G = {
    cone: track(new THREE.ConeGeometry(1, 1, 6)),
    roof: track(new THREE.ConeGeometry(1, 1, 4)),
    ico: track(new THREE.IcosahedronGeometry(1, 0)),
    cyl: track(new THREE.CylinderGeometry(1, 1, 1, 8)),
    box: track(new THREE.BoxGeometry(1, 1, 1)),
    sph: track(new THREE.SphereGeometry(1, 12, 8)),
    disc: track(new THREE.CircleGeometry(1, 12)),
    ring: track(new THREE.TorusGeometry(1, 0.12, 6, 24)),
    plane: track(new THREE.PlaneGeometry(1, 1)),
    /** A triangular prism (pitched roofs on era homes). */
    prism: track(new THREE.CylinderGeometry(1, 1, 1, 3)),
    star: track((() => {
      const s = new THREE.Shape();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.42 : 1, a = i / 10 * Math.PI * 2 - Math.PI / 2; if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
      return new THREE.ExtrudeGeometry(s, { depth: 0.25, bevelEnabled: false });
    })()),
  };
  function track<T extends THREE.BufferGeometry>(g: T): T { geometries.add(g); return g; }
  function mat(color: string, extra: THREE.MeshStandardMaterialParameters = {}): THREE.Material {
    const key = color + JSON.stringify(extra);
    let m = materials.get(key);
    if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: 0.82, flatShading: true, ...extra }); materials.set(key, m); }
    return m;
  }
  function part(geo: THREE.BufferGeometry, color: string, sx: number, sy: number, sz: number, x: number, y: number, z: number, extra?: THREE.MeshStandardMaterialParameters): THREE.Mesh {
    const m = new THREE.Mesh(geo, mat(color, extra));
    m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  // Sky
  const skyCanvas = document.createElement("canvas");
  skyCanvas.width = 4; skyCanvas.height = 256;
  const skyTexture = new THREE.CanvasTexture(skyCanvas);
  skyTexture.colorSpace = THREE.SRGBColorSpace;
  scene.background = skyTexture;
  cleanup.push(() => skyTexture.dispose());
  scene.fog = new THREE.Fog(0xf5e4d8, 190, 420);

  // Sea
  const sea = new THREE.Mesh(track(new THREE.CircleGeometry(420, 64)), new THREE.MeshStandardMaterial({ color: "#8ccfca", roughness: 0.35, metalness: 0.05, transparent: true, opacity: 0.92 }));
  sea.rotation.x = -Math.PI / 2; sea.receiveShadow = true; scene.add(sea);
  cleanup.push(() => (sea.material as THREE.Material).dispose());

  // Terrain
  const tGeo = track(new THREE.PlaneGeometry(SIZE, SIZE, GRID - 1, GRID - 1));
  tGeo.rotateX(-Math.PI / 2);
  const tCol = new Float32Array(GRID * GRID * 3);
  tGeo.setAttribute("color", new THREE.BufferAttribute(tCol, 3));
  const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
  const terrain = new THREE.Mesh(tGeo, terrainMat);
  terrain.receiveShadow = true; scene.add(terrain);
  cleanup.push(() => terrainMat.dispose());
  const shownH = new Float32Array(GRID * GRID);
  const sceneDisposables: (() => void)[] = [];
  function strack<T extends THREE.BufferGeometry>(g: T): T { sceneDisposables.push(() => g.dispose()); return g; }
  function smat<T extends THREE.Material>(m: T): T { sceneDisposables.push(() => m.dispose()); return m; }
  // Board photos on memory flags: one texture per object URL, loaded once, kept while a flag still uses it.
  const photoTextures = new Map<string, Promise<THREE.Texture | null>>();
  const photoLoader = new THREE.TextureLoader();
  let sceneGeneration = 0;
  function photoTexture(url: string): Promise<THREE.Texture | null> {
    let entry = photoTextures.get(url);
    if (!entry) {
      entry = new Promise((resolve) => {
        try {
          photoLoader.load(url, (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            // Cover the card: crop the longer side around the centre.
            const img = tex.image as { width?: number; height?: number } | undefined;
            const aspect = img?.width && img?.height ? img.width / img.height : 1, card = 1.12 / 1.03;
            if (aspect > card) { tex.repeat.set(card / aspect, 1); tex.offset.set((1 - card / aspect) / 2, 0); }
            else { tex.repeat.set(1, aspect / card); tex.offset.set(0, (1 - aspect / card) / 2); }
            resolve(tex);
          }, undefined, () => resolve(null));
        } catch { resolve(null); }
      });
      photoTextures.set(url, entry);
    }
    return entry;
  }
  function prunePhotos(keep: Set<string>) {
    for (const [url, entry] of photoTextures) {
      if (keep.has(url)) continue;
      photoTextures.delete(url);
      void entry.then((tex) => tex?.dispose());
    }
  }
  cleanup.push(() => prunePhotos(new Set()));
  const fromH = new Float32Array(GRID * GRID), toH = new Float32Array(GRID * GRID);
  const fromC = new Float32Array(GRID * GRID * 3), toC = new Float32Array(GRID * GRID * 3);
  let morph = 1;

  // Foliage
  const MAXT = 700, MAXF = 1800, MAXD = 500;
  const leafMat = new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true });
  const flowerMat = new THREE.MeshStandardMaterial({ roughness: 0.6, flatShading: true });
  const treeTop = new THREE.InstancedMesh(G.cone, leafMat, MAXT);
  const treeTrunk = new THREE.InstancedMesh(G.cyl, mat("#8a6a4a"), MAXT);
  const flowers = new THREE.InstancedMesh(G.ico, flowerMat, MAXF);
  const tufts = new THREE.InstancedMesh(G.cone, mat("#d6b36e"), MAXD);
  for (const m of [treeTop, treeTrunk]) { m.castShadow = true; m.receiveShadow = true; }
  scene.add(treeTop, treeTrunk, flowers, tufts);
  cleanup.push(() => { leafMat.dispose(); flowerMat.dispose(); for (const m of [treeTop, treeTrunk, flowers, tufts]) m.dispose(); });
  const CAND = (() => { const out: { x: number; z: number; s: number; c: number; t: number }[] = []; let s = 42; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; for (let i = 0; i < 3600; i++) out.push({ x: (r() - 0.5) * 172, z: (r() - 0.5) * 172, s: r(), c: r(), t: r() }); return out; })();

  // Everything rebuilt per input
  const dynamic = new THREE.Group();
  scene.add(dynamic);
  // Light cap (review fix, D-264). three.js compiles the light count into every shader, so a Chapter-count-driven
  // number of PointLights meant a shader recompile storm on each rebuild (Replay rebuilds per month). Real lights are
  // a fixed pool created once: the lit/blazing campfire (max 1), the stage-3 bridge lantern (max 1) and the cottage
  // window, plus the walkers' lantern below. Ember fires, the first fire and sunrises are emissive-only.
  // A pooled light that is not claimed this build is parked at intensity 0 but stays in the count.
  // Full: hemi + sun + 4 point lights, always. Lite: hemi + sun + the walkers' lantern only.
  const firePool = new THREE.PointLight(0xffa040, 0, 16, 2);
  const bridgePool = new THREE.PointLight(0xffc070, 0, 6, 2);
  const cottagePool = new THREE.PointLight(0xffc860, 0, 6, 2);
  const lightPool = [firePool, bridgePool, cottagePool];
  let fireClaimed = false, bridgeClaimed = false;
  scene.add(...lightPool);
  const poolAt = (light: THREE.PointLight, group: THREE.Object3D, local: THREE.Vector3, intensity: number, distance: number) => {
    group.updateMatrixWorld(true);
    light.position.copy(group.localToWorld(local.clone()));
    light.intensity = intensity;
    light.distance = distance;
  };
  const decor = new THREE.Group();
  scene.add(decor);
  const decorDisposables: (() => void)[] = [];
  let tickers: ((t: number) => void)[] = [];
  let appearing: THREE.Object3D[] = [];
  const anchors = new Map<string, THREE.Vector3>();
  const pickables: THREE.Object3D[] = [];
  const sculptures = new Map<string, { sculpture: KittySculpture; key: string; height: number; shown: number }>();
  /** The step each landmark showed in the previous scene, so a change can send coins. */
  const lastSteps = new Map<string, number>();
  let current: PathWorldInput | null = null;
  let palette = PALETTES.taylor;
  let themeKey = "";

  function seasonOf(key: string | undefined): "winter" | "spring" | "summer" | "autumn" {
    const m = Number((key ?? "2026-06").slice(5, 7));
    return m === 12 || m <= 2 ? "winter" : m >= 9 && m <= 11 ? "autumn" : m >= 3 && m <= 5 ? "spring" : "summer";
  }

  function applyTheme(theme: ThemeId) {
    if (themeKey === theme) return;
    themeKey = theme;
    palette = PALETTES[theme];
    coatA.color.set(palette.accent); coatB.color.set(palette.second);
    const g = skyCanvas.getContext("2d");
    if (g) {
      const gr = g.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, palette.sky[0]); gr.addColorStop(0.5, palette.sky[1]); gr.addColorStop(1, palette.sky[2]);
      g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
      skyTexture.needsUpdate = true;
    }
    (scene.fog as THREE.Fog).color.set(palette.fog);
    (scene.fog as THREE.Fog).near = theme === "newfoundland" ? 120 : 190;
    (sea.material as THREE.MeshStandardMaterial).color.set(palette.sea);
    // Authored motifs: Taylor's floating stars, Newfoundland's fog bank and gulls, Classic's paper pennants.
    while (decor.children.length) decor.remove(decor.children[0]!);
    for (const dispose of decorDisposables.splice(0)) dispose();
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    if (theme === "taylor") {
      for (let i = 0; i < 40; i++) {
        const s = new THREE.Mesh(G.star, mat("#e9b949", { metalness: 0.6, roughness: 0.3, emissive: "#6b4a10", emissiveIntensity: 0.35 }));
        const a = rnd() * Math.PI * 2, r = 25 + rnd() * 75;
        s.position.set(Math.cos(a) * r, 28 + rnd() * 30, Math.sin(a) * r);
        s.scale.setScalar(0.4 + rnd() * 0.6); s.userData.spin = 0.2 + rnd() * 0.6;
        decor.add(s);
      }
    } else if (theme === "newfoundland") {
      const fogTex = radialTexture("rgba(236,240,240,.9)", "rgba(236,240,240,0)");
      for (let i = 0; i < 26; i++) {
        const spriteMat = new THREE.SpriteMaterial({ map: fogTex, transparent: true, opacity: 0.7, depthWrite: false });
        decorDisposables.push(() => spriteMat.dispose());
        const sp = new THREE.Sprite(spriteMat);
        const a = rnd() * Math.PI * 2, r = 70 + rnd() * 60;
        sp.position.set(Math.cos(a) * r, 2 + rnd() * 8, Math.sin(a) * r);
        const k = 30 + rnd() * 30; sp.scale.set(k, k * 0.4, 1); decor.add(sp);
      }
      for (let i = 0; i < 5; i++) {
        const gull = new THREE.Group();
        const wing = part(G.box, "#f4f4f2", 1.4, 0.06, 0.25, -0.6, 0, 0); wing.rotation.z = 0.35; gull.add(wing);
        const wing2 = part(G.box, "#f4f4f2", 1.4, 0.06, 0.25, 0.6, 0, 0); wing2.rotation.z = -0.35; gull.add(wing2);
        gull.position.set((rnd() - 0.5) * 80, 22 + rnd() * 10, (rnd() - 0.5) * 80);
        gull.userData.orbit = { r: 30 + rnd() * 40, speed: 0.05 + rnd() * 0.05, phase: rnd() * 6, y: gull.position.y };
        decor.add(gull);
      }
    } else {
      for (let i = 0; i < 18; i++) {
        const b = new THREE.Group();
        const w1 = part(G.disc, ["#f2e2c0", "#e7b86a", "#c96e4a"][i % 3]!, 0.35, 0.25, 1, -0.2, 0, 0, { side: THREE.DoubleSide });
        const w2 = w1.clone(); w2.position.x = 0.2;
        b.add(w1, w2);
        b.userData.flutter = { x: (rnd() - 0.5) * 70, z: (rnd() - 0.5) * 70, phase: rnd() * 6 };
        decor.add(b);
      }
    }
  }
  function radialTexture(inner: string, outer: string, owner: (() => void)[] = decorDisposables): THREE.Texture {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d");
    if (g) { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, inner); gr.addColorStop(1, outer); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }
    const t = new THREE.CanvasTexture(c); owner.push(() => t.dispose()); return t;
  }

  type LandPaint = Record<"grass" | "dry" | "sand" | "rock" | "deep" | "snow" | "autumn" | "bloomA" | "bloomB", THREE.Color>;
  function landPaint(): LandPaint {
    return {
      grass: new THREE.Color(palette.grass), dry: new THREE.Color(palette.dry), sand: new THREE.Color(palette.sand), rock: new THREE.Color(palette.rock),
      deep: new THREE.Color(palette.deep), snow: new THREE.Color(palette.snow), autumn: new THREE.Color("#c98a4a"),
      bloomA: new THREE.Color(palette.blooms[0]), bloomB: new THREE.Color(palette.blooms[1]),
    };
  }
  /** The colour of one grid cell of a grown island (the main terrain and the past era islands share it). */
  function landColour(island: GrownIsland, k: number, season: string, P: LandPaint, c: THREE.Color): THREE.Color {
    const h = island.H[k]!;
    if (h < 0.05) c.copy(P.deep).lerp(P.sand, Math.max(0, 1 + h / 1.2) * 0.6);
    else {
      c.copy(P.dry).lerp(P.grass, Math.max(0, Math.min(1, (island.M[k]! - 0.22) / 0.36)));
      if (season === "autumn") c.lerp(P.autumn, 0.1);
      const b = Math.min(1, island.B[k]! * 0.9);
      if (b > 0.05) c.lerp(k % 3 ? P.bloomA : P.bloomB, b * 0.5);
      c.lerp(P.rock, island.R[k]!);
      c.lerp(P.sand, island.S[k]!);
      if (season === "winter") c.lerp(P.snow, Math.min(0.75, 0.35 + h * 0.05) * (1 - island.S[k]!));
      // The first winter's frost: a thin white stamp that stays in every season.
      const frost = island.F?.[k] ?? 0;
      if (frost > 0.02) c.lerp(P.snow, Math.min(0.72, frost * 0.72) * (1 - island.S[k]!));
    }
    return c;
  }
  function paintTerrain(island: GrownIsland, season: string) {
    const c = new THREE.Color();
    const P = landPaint();
    for (let k = 0; k < GRID * GRID; k++) {
      landColour(island, k, season, P, c);
      toC[k * 3] = c.r; toC[k * 3 + 1] = c.g; toC[k * 3 + 2] = c.b;
    }
    toH.set(island.H);
  }
  function applyMorph(e: number) {
    const pos = tGeo.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < GRID * GRID; k++) {
      const h = fromH[k]! + (toH[k]! - fromH[k]!) * e;
      shownH[k] = h;
      pos.setY(k, h);
      for (let c = 0; c < 3; c++) tCol[k * 3 + c] = fromC[k * 3 + c]! + (toC[k * 3 + c]! - fromC[k * 3 + c]!) * e;
    }
    pos.needsUpdate = true;
    (tGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    tGeo.computeVertexNormals();
  }

  const dummy = new THREE.Object3D(), tmp = new THREE.Color();
  function placeFoliage(island: GrownIsland, season: string, reserved: [number, number][]) {
    const leaves = season === "autumn" ? ["#d0894a", "#c9a14e", "#9aa56a", "#d97a5a"] : season === "winter" ? ["#8ea596", "#a9b8ab", "#e9ece6"] : palette.leaves;
    let t = 0, f = 0, d = 0;
    const cellAt = (x: number, z: number) => idx(Math.max(0, Math.min(GRID - 1, Math.round((x + HALF) / CELL))), Math.max(0, Math.min(GRID - 1, Math.round((z + HALF) / CELL))));
    const nearPath = (x: number, z: number) => { for (let m = 0; m <= island.cur; m++) { const p = island.spot(m); if ((p.x - x) ** 2 + (p.z - z) ** 2 < 12) return true; } return false; };
    for (const p of CAND) {
      const k = cellAt(p.x, p.z), h = island.H[k]!;
      if (h < 0.8 || island.S[k]! > 0.35 || island.R[k]! > 0.5) {
        if (island.R[k]! > 0.4 && h > 2 && t < MAXT && p.t < 0.5) {
          const s = 0.8 + p.s * 0.8;
          dummy.position.set(p.x, h + 1.4 * s, p.z); dummy.scale.set(0.9 * s, 3.2 * s, 0.9 * s); dummy.rotation.set(0, p.c * 6, 0); dummy.updateMatrix();
          treeTop.setMatrixAt(t, dummy.matrix); treeTop.setColorAt(t, tmp.set(season === "winter" ? "#dfe6e2" : "#4f7a5c"));
          dummy.position.y = h + 0.3 * s; dummy.scale.set(0.16 * s, 0.8 * s, 0.16 * s); dummy.updateMatrix(); treeTrunk.setMatrixAt(t, dummy.matrix); t++;
        }
        continue;
      }
      if (nearPath(p.x, p.z) || reserved.some(([x, z]) => (x - p.x) ** 2 + (z - p.z) ** 2 < 14)) continue;
      const moist = island.M[k]!, bloom = island.B[k]!;
      if (p.t < 0.28 && t < MAXT && p.s < moist * 1.25) {
        const s = (0.55 + p.s * 0.6) * (0.8 + Math.min(0.9, moist - 0.3));
        const tall = (0.8 + islandHash(k, 3) * 0.5) * (1 + Math.min(0.6, island.cur / 17 * 0.4));
        dummy.position.set(p.x, h + 1.3 * s * tall, p.z); dummy.scale.set(1.1 * s, 2.6 * s * tall, 1.1 * s); dummy.rotation.set(0, p.c * 6, 0); dummy.updateMatrix();
        treeTop.setMatrixAt(t, dummy.matrix); treeTop.setColorAt(t, tmp.set(leaves[Math.floor(p.c * leaves.length)]!));
        dummy.position.y = h + 0.35 * s; dummy.scale.set(0.16 * s, 0.8 * s, 0.16 * s); dummy.updateMatrix(); treeTrunk.setMatrixAt(t, dummy.matrix);
        t++;
      } else if (bloom > 0.18 && f < MAXF && p.t < 0.28 + bloom * 0.9 && season !== "winter") {
        for (let q = 0; q < 3 && f < MAXF; q++) {
          const ox = (islandHash(k, q) - 0.5) * 1.6, oz = (islandHash(q, k) - 0.5) * 1.6, s = 0.16 + islandHash(k + q, 7) * 0.14;
          dummy.position.set(p.x + ox, heightAt(island, p.x + ox, p.z + oz) + 0.25, p.z + oz); dummy.scale.set(s, s, s); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
          flowers.setMatrixAt(f, dummy.matrix);
          flowers.setColorAt(f, tmp.set(palette.blooms[Math.floor(islandHash(k, q + 1) * palette.blooms.length)]!));
          f++;
        }
      } else if (moist < 0.36 && d < MAXD && p.t < 0.6) {
        const s = 0.25 + p.s * 0.25;
        dummy.position.set(p.x, h + s * 0.5, p.z); dummy.scale.set(s * 0.6, s, s * 0.6); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
        tufts.setMatrixAt(d, dummy.matrix); d++;
      }
    }
    treeTop.count = t; treeTrunk.count = t; flowers.count = f; tufts.count = d;
    for (const m of [treeTop, treeTrunk, flowers, tufts]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  }

  // ------------------------------------------------------------------ pieces
  function anchor(id: string, obj: THREE.Object3D, lift: number) {
    obj.userData.pickId = id;
    pickables.push(obj);
    const v = new THREE.Vector3();
    anchors.set(id, v);
    obj.userData.anchor = { v, lift };
  }
  function syncAnchors() {
    for (const obj of pickables) {
      const a = obj.userData.anchor as { v: THREE.Vector3; lift: number } | undefined;
      if (!a) continue;
      obj.getWorldPosition(a.v); a.v.y += a.lift;
    }
  }

  function buildPiece(piece: Piece, island: GrownIsland, id: string): THREE.Object3D | null {
    const g = new THREE.Group();
    const y = heightAt(island, piece.x, piece.z);
    g.position.set(piece.x, y, piece.z);
    const P = palette;
    switch (piece.kind) {
      case "grove": {
        const k = Math.min(1, 0.25 + piece.age / 12);
        for (let i = 0; i < 5; i++) {
          const a = i * 1.26, r = i ? 1.8 : 0, s = (0.6 + 0.5 * k) * (i ? 1 : 1.25);
          g.add(part(G.cyl, "#8a6a4a", 0.14 * s, s, 0.14 * s, Math.cos(a) * r, 0.5 * s, Math.sin(a) * r));
          g.add(part(G.ico, P.leaves[i % P.leaves.length]!, 0.9 * s * k + 0.2, 1.1 * s * k + 0.2, 0.9 * s * k + 0.2, Math.cos(a) * r, 1.4 * s + 0.6 * k, Math.sin(a) * r));
        }
        g.add(part(G.box, "#f3dcc0", 0.5, 0.3, 0.05, 0, 0.9, 0.24));
        anchor(id, g, 3.2); break;
      }
      case "cottage": {
        const n = piece.n ?? 0;
        g.add(part(G.box, P.walls[n % P.walls.length]!, 2.2, 1.6, 1.9, 0, 0.8, 0));
        const roof = part(G.roof, P.roofs[n % P.roofs.length]!, 1.8, 1.2, 1.8, 0, 2.2, 0); roof.rotation.y = Math.PI / 4; g.add(roof);
        g.add(part(G.box, "#ffe7a8", 0.4, 0.4, 0.05, 0.5, 1, 0.96, { emissive: "#e9b949", emissiveIntensity: 0.5 }));
        g.rotation.y = n * 1.1;
        anchor(id, g, 3.2); break;
      }
      case "observatory": {
        const floors = piece.floors ?? 1;
        for (let i = 0; i < floors; i++) g.add(part(G.cyl, i % 2 ? "#f3e6cc" : "#e9d5b0", 2.2 - i * 0.12, 1.3, 2.2 - i * 0.12, 0, 0.65 + i * 1.3, 0));
        const top = floors * 1.3;
        g.add(part(G.sph, P.second, 1.7 - floors * 0.08, 1.2, 1.7 - floors * 0.08, 0, top + 0.1, 0));
        const scope = part(G.cyl, P.accent, 0.18, 1.6, 0.18, 0.5, top + 1, 0); scope.rotation.z = -0.7; g.add(scope);
        anchor(id, g, top + 2); break;
      }
      case "monument": {
        g.add(part(G.box, "#efe4cf", 0.5, 3.2, 0.5, -1.1, 1.6, 0), part(G.box, "#efe4cf", 0.5, 3.2, 0.5, 1.1, 1.6, 0), part(G.box, "#efe4cf", 2.8, 0.5, 0.6, 0, 3.35, 0));
        const star = part(G.star, "#e9b949", 0.55, 0.55, 0.55, 0, 4.2, 0, { metalness: 0.6, roughness: 0.3, emissive: "#7a5410", emissiveIntensity: 0.4 });
        g.add(star); tickers.push((t) => { star.rotation.y = t * 0.8; });
        g.rotation.y = -piece.ang;
        anchor(id, g, 5); break;
      }
      case "bench":
        g.add(part(G.box, "#9c7a55", 1.6, 0.12, 0.5, 0, 0.55, 0), part(G.box, "#9c7a55", 1.6, 0.5, 0.1, 0, 0.85, -0.22), part(G.box, "#6b523a", 0.1, 0.55, 0.4, -0.7, 0.27, 0), part(G.box, "#6b523a", 0.1, 0.55, 0.4, 0.7, 0.27, 0));
        anchor(id, g, 1.8); break;
      case "lanterns": {
        g.add(part(G.cyl, "#7a5436", 0.06, 2.6, 0.06, -1.6, 1.3, 0), part(G.cyl, "#7a5436", 0.06, 2.6, 0.06, 1.6, 1.3, 0));
        for (let i = 0; i < 6; i++) g.add(part(G.cone, P.blooms[i % P.blooms.length]!, 0.18, 0.3, 0.05, -1.3 + i * 0.52, 2.3 - Math.sin((i + 0.5) / 6 * Math.PI) * 0.35, 0));
        for (let i = 0; i < 3; i++) g.add(part(G.sph, "#fff0c0", 0.14, 0.18, 0.14, -0.8 + i * 0.8, 1.6, 0, { emissive: "#ffc860", emissiveIntensity: 0.9 }));
        g.rotation.y = piece.ang;
        anchor(id, g, 3); break;
      }
      case "giftTree":
        g.add(part(G.cyl, "#8a6a4a", 0.2, 1.6, 0.2, 0, 0.8, 0), part(G.ico, P.leaves[0]!, 1.4, 1.3, 1.4, 0, 2.3, 0));
        P.blooms.slice(0, 4).forEach((c, i) => g.add(part(G.box, c, 0.08, 0.5, 0.03, Math.cos(i * 1.6) * 1.1, 1.6, Math.sin(i * 1.6) * 1.1)));
        anchor(id, g, 3.8); break;
      case "loop":
        for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2, x = Math.cos(a) * 4, z = Math.sin(a) * 2.6; const d = part(G.cyl, "#d8c49a", 0.28, 0.05, 0.28, x, heightAt(island, piece.x + x, piece.z + z) - y + 0.06, z); d.castShadow = false; g.add(d); }
        anchor(id, g, 1.2); break;
      case "cafe":
        for (let i = 0; i < 2; i++) g.add(part(G.cyl, "#fbf1e2", 0.5, 0.06, 0.5, -1 + i * 2, 0.75, 0), part(G.cyl, "#6b523a", 0.06, 0.75, 0.06, -1 + i * 2, 0.37, 0));
        g.add(part(G.cyl, "#6b523a", 0.05, 2.4, 0.05, -2, 1.2, 0), part(G.cyl, "#6b523a", 0.05, 2.4, 0.05, 2, 1.2, 0));
        for (let i = 0; i < 7; i++) g.add(part(G.sph, "#fff2c4", 0.08, 0.08, 0.08, -1.8 + i * 0.6, 2.2 - Math.sin(i / 6 * Math.PI) * 0.4, 0, { emissive: "#ffd070", emissiveIntensity: 1 }));
        g.rotation.y = piece.ang + 1;
        anchor(id, g, 2.8); break;
      case "rows":
        for (let r = 0; r < 4; r++) {
          g.add(part(G.box, "#8a6a4a", 3.2, 0.15, 0.45, 0, 0.08, -1 + r * 0.7));
          for (let c = 0; c < 5; c++) g.add(part(G.ico, r % 2 ? "#6fa35d" : "#9cc26b", 0.22, 0.22, 0.22, -1.3 + c * 0.65, 0.3, -1 + r * 0.7));
        }
        g.rotation.y = piece.ang;
        anchor(id, g, 1.2); break;
      case "pond": {
        const pond = new THREE.Mesh(G.disc, mat("#8cc6d4", { roughness: 0.2, metalness: 0.1, flatShading: false }));
        pond.rotation.x = -Math.PI / 2; pond.scale.setScalar(2.2); pond.position.y = 0.12; g.add(pond);
        anchor(id, g, 1); break;
      }
      case "star": {
        g.add(part(G.cyl, "#7a5436", 0.06, 2.2, 0.06, 0, 1.1, 0));
        const s = part(G.star, "#e9b949", 0.4, 0.4, 0.4, 0, 2.5, 0, { metalness: 0.5, roughness: 0.3, emissive: "#7a5410", emissiveIntensity: 0.4 });
        g.add(s); tickers.push((t) => { s.rotation.y = t; });
        anchor(id, g, 3.2); break;
      }
      case "firstFire": {
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.add(part(G.ico, "#9c8f7d", 0.3, 0.25, 0.3, Math.cos(a), 0.15, Math.sin(a))); }
        const f1 = part(G.cone, "#ffb347", 0.45, 1.2, 0.45, 0, 0.9, 0, { emissive: "#ff8a1f", emissiveIntensity: 1.2 }); f1.castShadow = false;
        const f2 = part(G.cone, "#ffe39a", 0.25, 0.8, 0.25, 0, 0.8, 0, { emissive: "#ffd060", emissiveIntensity: 1.4 }); f2.castShadow = false;
        // Emissive only (the light cap): the flames glow without a PointLight.
        g.add(f1, f2);
        tickers.push((t) => { const k = 1 + 0.15 * Math.sin(t * 11) + 0.1 * Math.sin(t * 17.3); f1.scale.y = 1.2 * k; f2.scale.y = 0.8 * (2 - k); });
        anchor(id, g, 2); break;
      }
      case "dogMeadow": {
        g.add(part(G.box, P.roofs[0]!, 1.3, 1, 1.2, 0, 0.5, 0));
        const roof = part(G.roof, "#7a5436", 1.1, 0.8, 1.1, 0, 1.4, 0); roof.rotation.y = Math.PI / 4; g.add(roof);
        for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const s = 0.18 + Math.min(0.2, piece.age * 0.03); const d = part(G.cyl, "#b99d77", s, 0.04, s, 3 + Math.cos(a) * 2.4, 0.06, Math.sin(a) * 1.6); d.castShadow = false; g.add(d); }
        const pet = new THREE.Group();
        pet.add(part(G.sph, "#c8914f", 0.45, 0.3, 0.28, 0, 0.45, 0), part(G.sph, "#c8914f", 0.22, 0.22, 0.22, 0.45, 0.7, 0));
        g.add(pet);
        tickers.push((t) => { const a = t * 1.4; pet.position.set(3 + Math.cos(a) * 2.4, Math.abs(Math.sin(t * 6)) * 0.15, Math.sin(a) * 1.6); pet.rotation.y = -a - Math.PI / 2; });
        anchor(id, g, 2.4); break;
      }
      case "kiln": {
        g.add(part(G.cyl, "#c98a6a", 1.1, 1.4, 1.1, 0, 0.7, 0), part(G.sph, "#b5735a", 1.1, 0.8, 1.1, 0, 1.4, 0), part(G.cyl, "#8a5a3e", 0.25, 1, 0.25, 0.5, 2.2, 0));
        const puffs = [0, 1, 2, 3].map((i) => { const p = part(G.sph, "#e8e2da", 0.3, 0.3, 0.3, 0.5, 2.8 + i * 0.5, 0); p.castShadow = false; g.add(p); return p; });
        const on = Boolean(piece.active);
        tickers.push((t) => puffs.forEach((p, i) => { const k = (t * 0.4 + i / 4) % 1; p.visible = on; p.position.set(0.5 + k * 0.8, 2.7 + k * 2.2, 0); p.scale.setScalar(0.2 + k * 0.45); }));
        anchor(id, g, 3); break;
      }
      case "workshop": {
        g.add(part(G.box, P.walls[1 % P.walls.length]!, 2, 1.4, 1.6, 0, 0.7, 0));
        const roof = part(G.roof, P.accent, 1.6, 0.9, 1.6, 0, 1.85, 0); roof.rotation.y = Math.PI / 4; g.add(roof);
        g.add(part(G.box, "#6b523a", 0.6, 0.9, 0.05, 0, 0.45, 0.81));
        anchor(id, g, 2.8); break;
      }
      case "creek": {
        const dir = piece.ang + Math.PI / 2;
        const water = new THREE.Mesh(strack(new THREE.PlaneGeometry(9, 1.2)), mat("#7fb6c4", { roughness: 0.2, flatShading: false }));
        water.rotation.x = -Math.PI / 2; water.rotation.z = -dir; water.position.y = 0.18; g.add(water);
        const log = part(G.cyl, "#7a5436", 0.25, 2.6, 0.25, Math.cos(dir) * 3.4 - 1, 0.3, Math.sin(dir) * 3.4); log.rotation.z = Math.PI / 2; g.add(log);
        if (piece.bridge !== null && piece.bridge !== undefined && piece.bridge <= island.cur) {
          const br = new THREE.Group();
          br.add(part(G.box, "#b8925f", 1.2, 0.14, 2.4, 0, 0.55, 0));
          for (let i = 0; i < 5; i++) br.add(part(G.box, "#9c7a55", 1.3, 0.05, 0.3, 0, 0.64, -1 + i * 0.5));
          for (const s of [-1, 1]) br.add(part(G.cyl, "#6b523a", 0.05, 0.9, 0.05, s * 0.6, 0.9, -1.1), part(G.cyl, "#6b523a", 0.05, 0.9, 0.05, s * 0.6, 0.9, 1.1), part(G.box, "#6b523a", 0.05, 0.05, 2.3, s * 0.6, 1.3, 0));
          br.rotation.y = -piece.ang; g.add(br);
          if (island.cur - piece.bridge <= 1) {
            const rb = new THREE.Group();
            [P.blooms[0]!, "#e9b949", "#9cc3de"].forEach((c, i) => rb.add(new THREE.Mesh(strack(new THREE.TorusGeometry(4.2 - i * 0.35, 0.12, 6, 40, Math.PI)), smat(new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.75 })))));
            rb.rotation.y = -piece.ang; g.add(rb);
          }
        }
        anchor(id, g, 1.8); break;
      }
      case "frost": {
        // A frosted boulder with a few ice crystals: static.
        g.add(part(G.ico, P.rock, 0.9, 0.6, 0.8, 0, 0.35, 0));
        const cap = part(G.ico, P.snow, 0.8, 0.28, 0.72, 0, 0.72, 0, { roughness: 0.5 }); cap.castShadow = false; g.add(cap);
        for (let i = 0; i < 4; i++) {
          const a = i * 1.7 + 0.3;
          const c = part(G.cone, "#e8f1f6", 0.14, 0.5 + (i % 2) * 0.25, 0.14, Math.cos(a) * 1.1, 0.25, Math.sin(a) * 1.1, { roughness: 0.3, metalness: 0.1, emissive: "#b9d3e0", emissiveIntensity: 0.2 });
          c.castShadow = false; g.add(c);
        }
        anchor(id, g, 2); break;
      }
      default: return null;
    }
    if (piece.born === island.cur) appearing.push(g);
    return g;
  }

  function landmarkPosition(i: number, count: number, island: GrownIsland): { x: number; z: number } {
    const a = (i / Math.max(1, count)) * Math.PI * 2 + 2.1;
    const r = island.radiusAt(a) - 9;
    return { x: Math.cos(a) * r, z: Math.sin(a) * r };
  }

  function buildScene(input: PathWorldInput, animate: boolean) {
    const { island } = input;
    applyTheme(input.theme);
    while (dynamic.children.length) dynamic.remove(dynamic.children[0]!);
    for (const bank of sculptures.values()) bank.sculpture.group.removeFromParent();
    pickables.length = 0; anchors.clear(); tickers = []; appearing = [];
    for (const light of lightPool) light.intensity = 0;
    fireClaimed = false; bridgeClaimed = false;
    for (const dispose of sceneDisposables.splice(0)) dispose();
    const generation = ++sceneGeneration;
    prunePhotos(new Set(input.memories.flatMap((m) => (m.photo ? [m.photo] : []))));
    const monthSeason = seasonOfIndex(input);

    if (animate && !options.reducedMotion) { fromH.set(shownH); fromC.set(tCol); morph = 0; }
    paintTerrain(island, monthSeason);
    if (!animate || options.reducedMotion) { fromH.set(toH); fromC.set(toC); morph = 1; applyMorph(1); }

    const reserved: [number, number][] = [];
    island.pieces.forEach((piece, i) => {
      const obj = buildPiece(piece, island, `piece:${i}`);
      if (obj) { dynamic.add(obj); reserved.push([piece.x, piece.z]); }
    });

    // Coves
    island.coves.forEach((cove, i) => {
      const R = island.radiusAt(cove.a);
      const g = new THREE.Group();
      if (cove.type === "city") {
        const x = Math.cos(cove.a) * (R - 1), z = Math.sin(cove.a) * (R - 1);
        g.position.set(x, 0, z); g.rotation.y = -cove.a;
        g.add(part(G.box, "#b8925f", 9, 0.25, 1.6, 4, 0.9, 0));
        for (let k = 0; k < 3; k++) g.add(part(G.cyl, "#4c3b24", 0.06, 2, 0.06, 2 + k * 3, 2, 0.7), part(G.sph, "#fff0c0", 0.2, 0.2, 0.2, 2 + k * 3, 3, 0.7, { emissive: "#ffc860", emissiveIntensity: 1.2 }));
        for (let k = 0; k < 5; k++) g.add(part(G.box, palette.walls[k % palette.walls.length]!, 1.4, 2 + (k % 3) * 1.2, 1.4, -2 - (k % 2) * 1.6, 1 + (k % 3) * 0.6 + heightAt(island, x, z), -3 + k * 1.5));
      } else if (cove.type === "sea") {
        const x = Math.cos(cove.a) * (R - 4), z = Math.sin(cove.a) * (R - 4);
        g.position.set(x, heightAt(island, x, z), z);
        g.add(part(G.cyl, "#fbf1e2", 0.05, 2.4, 0.05, 0, 1.2, 0), part(G.cone, palette.blooms[0]!, 1.4, 0.6, 1.4, 0, 2.5, 0));
        // One shell per visit, lined up along the shore.
        cove.visits.forEach((_, k) => g.add(part(G.sph, "#f7e1d6", 0.18, 0.1, 0.14, -1.5 + k * 0.5, 0.1, 1.2)));
      } else {
        const x = Math.cos(cove.a) * (R - 6), z = Math.sin(cove.a) * (R - 6);
        g.position.set(x, heightAt(island, x, z), z);
        g.add(part(G.box, "#8a5a3e", 1.6, 1.1, 1.3, 0, 0.55, 0));
        const roof = part(G.roof, palette.snow, 1.4, 0.9, 1.2, 0, 1.5, 0); roof.rotation.y = Math.PI / 4; g.add(roof);
      }
      anchor(`cove:${i}`, g, 3);
      dynamic.add(g);
      if (cove.month === island.cur) appearing.push(g);
      // A year on, the sea brings something back.
      if (island.cur >= cove.month + 12 && cove.type === "sea") {
        const bx = Math.cos(cove.a) * (R - 1.5), bz = Math.sin(cove.a) * (R - 1.5);
        const bottle = part(G.cyl, "#a9d6c8", 0.18, 0.6, 0.18, bx, Math.max(0.1, heightAt(island, bx, bz)) + 0.2, bz, { transparent: true, opacity: 0.8, roughness: 0.1 });
        bottle.rotation.z = 1.4;
        anchor(`bottle:${i}`, bottle, 0.8);
        dynamic.add(bottle);
      }
    });

    // The thread of months
    const pts: THREE.Vector3[] = [];
    for (let m = 0; m <= island.cur; m++) { const p = island.spot(m); pts.push(new THREE.Vector3(p.x, 0, p.z)); }
    if (pts.length < 2) pts.push(pts[0]!.clone().add(new THREE.Vector3(0.1, 0, 0.1)));
    const curve = new THREE.CatmullRomCurve3(pts);
    const segs = Math.max(1, island.cur);
    for (let m = 1; m <= island.cur; m++) {
      const sub: THREE.Vector3[] = [];
      for (let k = 0; k <= 10; k++) { const p = curve.getPoint((m - 1 + k / 10) / segs); p.y = heightAt(island, p.x, p.z) + 0.15; sub.push(p); }
      const tube = new THREE.Mesh(strack(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sub), 20, island.widths[m] ?? 0.22, 6, false)), mat(palette.thread, { metalness: 0.45, roughness: 0.4, flatShading: false }));
      tube.castShadow = true; dynamic.add(tube);
      if (input.layers.rhythm && (island.widths[m] ?? 0) >= 0.45) {
        for (let k = 1; k < 10; k += 2) { const p = sub[k]!; const c = part(G.cyl, "#e3d2aa", 0.5, 0.12, 0.5, p.x + 0.9, p.y - 0.08, p.z + 0.2); c.castShadow = false; dynamic.add(c); }
      }
    }
    // Month stones in their character colours
    for (let m = 0; m <= island.cur; m++) {
      const p = island.spot(m), y = heightAt(island, p.x, p.z);
      const now = m === island.cur;
      const stone = part(G.cyl, CHARACTER_COLOR[input.characters[m] ?? "steady"], 0.75, 0.3, 0.75, p.x, y + 0.25, p.z, now ? { emissive: palette.second, emissiveIntensity: 0.25 } : {});
      if (now) { stone.userData.pickId = `month:${m}`; pickables.push(stone); } else anchor(`month:${m}`, stone, 1.2);
      dynamic.add(stone);
    }
    // Set land: a closed Sitdown or closed books ring the month stone with a low kerb (paved and a shade darker for closed books);
    // each stamped week lights a small lantern along that month's road. All static.
    if (input.land?.length) {
      const rock = new THREE.Color(palette.rock);
      const paved = `#${rock.clone().lerp(new THREE.Color("#2b2622"), 0.28).getHexString()}`;
      const pave = `#${rock.clone().lerp(new THREE.Color("#2b2622"), 0.12).getHexString()}`;
      for (const row of input.land) {
        if (row.month < 0 || row.month > island.cur) continue;
        const p = island.spot(row.month), y = heightAt(island, p.x, p.z);
        if (row.closed || row.set) {
          const colour = row.closed ? paved : palette.rock;
          if (row.closed) { const slab = part(G.cyl, pave, 1.55, 0.08, 1.55, p.x, y + 0.08, p.z); slab.castShadow = false; dynamic.add(slab); }
          for (let i = 0; i < 8; i++) {
            const a = i / 8 * Math.PI * 2 + 0.2;
            const x = p.x + Math.cos(a) * 1.5, z = p.z + Math.sin(a) * 1.5;
            const stone = part(G.ico, colour, 0.26, 0.2, 0.26, x, heightAt(island, x, z) + 0.12, z);
            stone.rotation.y = i * 0.9; stone.castShadow = false; dynamic.add(stone);
          }
        }
        const stamps = Math.max(0, Math.min(5, Math.floor(row.stamps)));
        if (stamps) {
          const q = row.month > 0 ? island.spot(row.month - 1) : island.spot(row.month + 1);
          const dx = p.x - q.x, dz = p.z - q.z, len = Math.hypot(dx, dz) || 1;
          const nx = -dz / len, nz = dx / len;
          for (let i = 0; i < stamps; i++) {
            const k = (i + 1) / (stamps + 1) * 0.85;
            const x = p.x - dx * k + nx * 0.9, z = p.z - dz * k + nz * 0.9, ly = heightAt(island, x, z);
            const pole = part(G.cyl, "#3d3a38", 0.04, 1.5, 0.04, x, ly + 0.75, z); pole.castShadow = false;
            const bulb = part(G.sph, "#fff0c0", 0.14, 0.17, 0.14, x, ly + 1.55, z, { emissive: "#ffc860", emissiveIntensity: 1 }); bulb.castShadow = false;
            dynamic.add(pole, bulb);
          }
        }
      }
    }
    // "We are here" is wherever the two walkers are, so its mark follows them along the road.
    anchor(`month:${island.cur}`, us, US_MARK_LIFT);
    arrive(island);

    // Campfires at each Chapter's opening month
    for (const fire of input.campfires) {
      if (fire.month < 0 || fire.month > island.cur) continue;
      const p = island.spot(fire.month);
      const x = p.x + Math.cos(p.a + 1.9) * 3, z = p.z + Math.sin(p.a + 1.9) * 3;
      const g = new THREE.Group(); g.position.set(x, heightAt(island, x, z), z);
      for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; g.add(part(G.ico, "#9c8f7d", 0.35, 0.3, 0.35, Math.cos(a) * 1.1, 0.2, Math.sin(a) * 1.1)); }
      for (let i = 0; i < 3; i++) { const l = part(G.cyl, "#7a5436", 0.12, 1.6, 0.12, 0, 0.3, 0); l.rotation.z = Math.PI / 2; l.rotation.y = i * 1.05; g.add(l); }
      if (fire.sitdown === "closed") {
        // The Sitdown closed: steady embers, no flicker.
        for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const e = part(G.ico, "#ff9a3c", 0.22, 0.14, 0.22, Math.cos(a) * 0.35, 0.28, Math.sin(a) * 0.35, { emissive: "#ff6a1a", emissiveIntensity: 0.9 }); e.castShadow = false; g.add(e); }
        // Emissive only (the light cap).
      } else if (fire.lit && !fireClaimed) {
        fireClaimed = true;
        const blaze = fire.sitdown === "open", both = (input.presentMembers ?? 1) >= 2;
        const tall = blaze ? 2.1 : 1.4, width = blaze ? 0.7 : 0.5;
        const power = (blaze ? 9 : 6) * (both ? 1.4 : 1);
        const amp = Math.min(0.5, (blaze ? 0.25 : 0.15) * (both ? 2 : 1));
        const f = part(G.cone, "#ffb347", width, tall, width, 0, 0.3 + tall / 2, 0, { emissive: "#ff8a1f", emissiveIntensity: 1.2 }); f.castShadow = false;
        const core = part(G.cone, "#ffc860", width * 0.55, tall * 0.62, width * 0.55, 0, 0.3 + tall * 0.31, 0, { emissive: "#ffc860", emissiveIntensity: 1.4 }); core.castShadow = false;
        const light = firePool;
        poolAt(light, g, new THREE.Vector3(0, 0.6 + tall * 0.7, 0), power, blaze ? 22 : 16);
        g.add(f, core);
        // Reduced motion: the fire stands still. Lite: only the base flicker.
        if (!options.reducedMotion) tickers.push((t) => {
          const a = quality === "full" ? amp : 0.15;
          const k = 1 + a * Math.sin(t * 11) + (quality === "full" && blaze ? a * 0.4 * Math.sin(t * 17.3) : 0);
          f.scale.y = tall * k;
          f.scale.x = f.scale.z = width * (quality === "full" && blaze ? 1 + a * 0.5 * Math.sin(t * 7.1) : 1);
          core.scale.y = tall * 0.62 * (2 - k);
          light.intensity = power * (1 + Math.min(0.35, a * 1.2) * Math.sin(t * 9));
        });
      }
      anchor(fire.id, g, 2.6);
      dynamic.add(g);
      if (fire.lit) {
        // The two of you, and the tent that holds today's Plan Studio.
        const people = [["#3c6989", 1.2], [palette.second, -1.2]] as const;
        for (const [color, side] of people) {
          const px = x + Math.cos(p.a + side) * 1.8, pz = z + Math.sin(p.a + side) * 1.8, py = heightAt(island, px, pz);
          const tok = new THREE.Group();
          tok.add(part(G.cyl, color, 0.35, 1.2, 0.45, 0, 0.6, 0, { flatShading: false }), part(G.sph, "#f3dcc6", 0.38, 0.38, 0.38, 0, 1.5, 0, { flatShading: false }));
          tok.position.set(px, py, pz); dynamic.add(tok);
          tickers.push((t) => { tok.position.y = py + Math.abs(Math.sin(t * 1.6 + side)) * 0.1; });
        }
        const tx = x + Math.cos(p.a + 3) * 5, tz = z + Math.sin(p.a + 3) * 5;
        const tent = new THREE.Group(); tent.position.set(tx, heightAt(island, tx, tz), tz);
        for (let i = 0; i < 8; i++) {
          if (i === 2) continue;
          const seg = new THREE.Mesh(strack(new THREE.ConeGeometry(2.2, 3, 8, 1, true, i / 8 * Math.PI * 2, Math.PI * 2 / 8)), mat(i % 2 ? palette.walls[0]! : palette.blooms[0]!, { side: THREE.DoubleSide }));
          seg.position.y = 1.5; seg.castShadow = true; tent.add(seg);
        }
        tent.add(part(G.cyl, "#7a5436", 0.04, 1.2, 0.04, 0, 3.3, 0));
        const flag = part(G.box, palette.accent, 0.7, 0.4, 0.02, 0.35, 3.7, 0); tent.add(flag);
        tickers.push((t) => { flag.rotation.y = 0.3 * Math.sin(t * 2); });
        anchor("tent", tent, 4.2);
        dynamic.add(tent);
        // Move stones on the way to next month
        const q = island.spot(island.cur + 1);
        input.moves.forEach((move, i) => {
          const k = (i + 1) / (input.moves.length + 1);
          const mx = p.x + (q.x - p.x) * k * 0.8, mz = p.z + (q.z - p.z) * k * 0.8;
          const colour = move.state === "done" ? "#f1d48a" : move.state === "waiting" ? "#efd0dc" : "#e9e1cf";
          const extra = move.state === "done" ? { emissive: "#e0a82e", emissiveIntensity: 0.55 } : move.state === "waiting" ? { emissive: palette.second, emissiveIntensity: 0.25 } : {};
          const s = part(G.cyl, colour, 0.95, 0.35, 1.05, mx, heightAt(island, mx, mz) + 0.18, mz, extra);
          anchor(move.id, s, 1);
          dynamic.add(s);
          if (move.state === "next") {
            const ring = new THREE.Mesh(strack(new THREE.TorusGeometry(1.35, 0.06, 6, 32)), smat(new THREE.MeshBasicMaterial({ color: palette.second })));
            ring.rotation.x = Math.PI / 2; ring.position.set(mx, s.position.y + 0.25, mz);
            dynamic.add(ring);
            tickers.push((t) => ring.scale.setScalar(1 + 0.12 * Math.sin(t * 2.4)));
          }
        });
      }
    }
    // Ritual lampposts (Our Rhythm)
    if (input.layers.rhythm) input.lamps.forEach((lamp, i) => {
      const p = island.spot(Math.min(island.cur, Math.max(0, lamp.month)));
      const x = p.x + Math.cos(p.a - 2.6) * (2.4 + i * 0.4), z = p.z + Math.sin(p.a - 2.6) * (2.4 + i * 0.4);
      const g = new THREE.Group(); g.position.set(x, heightAt(island, x, z), z);
      g.add(part(G.cyl, "#3d3a38", 0.07, 2.8, 0.07, 0, 1.4, 0), part(G.sph, "#fff0c0", 0.25, 0.3, 0.25, 0, 2.9, 0, { emissive: "#ffc860", emissiveIntensity: 1 }));
      anchor(lamp.id, g, 3.4); dynamic.add(g);
    });
    // Memory flags (Our Story)
    if (input.layers.story) input.memories.forEach((memory, i) => {
      const p = island.spot(Math.min(island.cur, Math.max(0, memory.month)));
      const x = p.x + Math.cos(p.a - 1.2) * (3.6 + i * 0.3), z = p.z + Math.sin(p.a - 1.2) * (3.6 + i * 0.3);
      const g = new THREE.Group(); g.position.set(x, heightAt(island, x, z), z);
      const border = part(G.box, palette.blooms[i % palette.blooms.length]!, 1.3, 1.2, 0.05, 0.8, 2.75, 0);
      g.add(part(G.cyl, "#8a6a4a", 0.05, 3.2, 0.05, 0, 1.6, 0), part(G.box, "#ffffff", 1.5, 1.75, 0.04, 0.8, 2.6, 0), border);
      if (memory.photo) {
        // The board photo sits inside the coloured border, on the front face. It appears once loaded; a failure keeps the plain card.
        const faceMat = smat(new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.9 }));
        const face = new THREE.Mesh(G.plane, faceMat);
        face.scale.set(0.86, 0.86, 1); face.position.z = 0.62; face.visible = false; face.castShadow = false;
        border.add(face);
        void photoTexture(memory.photo).then((tex) => {
          if (!tex || dead || generation !== sceneGeneration) return;
          faceMat.map = tex; faceMat.needsUpdate = true; face.visible = true;
          invalidate();
        });
      }
      const photo = g.children[1]!;
      tickers.push((t) => { photo.rotation.y = 0.25 * Math.sin(t * 1.3 + i); });
      anchor(memory.id, g, 4); dynamic.add(g);
    });
    // Weather: the Calendar ahead of this month, along the road toward the next one.
    if (input.layers.weather) buildWeather(input, island);
    // Stepping stones: household planner tasks beside their month.
    buildStones(input, island);
    // Private footpaths and bridges: static geometry beside their month.
    buildFootpaths(input, island);
    buildBridges(input, island);
    // Landmarks: shared Kitty Banks at their real backing step
    const seen = new Set<string>();
    const arcs = !options.reducedMotion && quality === "full";
    const landmarkCount = Math.min(6, input.goals.length);
    let kilnAt: { x: number; z: number } | null = null;
    input.goals.slice(0, 6).forEach((goal, i) => {
      seen.add(goal.id);
      const pos = landmarkPosition(i, Math.min(6, input.goals.length), island);
      const g = new THREE.Group(); g.position.set(pos.x, heightAt(island, pos.x, pos.z), pos.z);
      g.add(part(G.cyl, "#e4d4b4", 2.2, 0.25, 2.2, 0, 0.12, 0));
      const key = JSON.stringify([goal.piece?.id ?? null, goal.piece?.paint ?? null, goal.fired]);
      let bank = sculptures.get(goal.id);
      if (!bank || bank.key !== key) {
        if (bank) bank.sculpture.dispose();
        try {
          const sculpture = createKittySculpture(goal.piece, { brass: options.brass ?? "#bda375", wood: options.wood ?? "#62412b", fired: goal.fired, reducedMotion: true });
          sculpture.setOpen(false); sculpture.setSpin(0); sculpture.setIdle(false);
          const box = new THREE.Box3().setFromObject(sculpture.group);
          bank = { sculpture, key, height: Math.max(0.5, box.max.y - box.min.y), shown: -1 };
          sculptures.set(goal.id, bank);
        } catch { bank = undefined; }
      }
      const previous = lastSteps.get(goal.id);
      const change = landmarkStepChange(previous, goal.step);
      lastSteps.set(goal.id, goal.step);
      if (bank) {
        if (change && arcs) {
          // A freshly made sculpture starts from where the old one stood.
          if (bank.shown < 0 && previous !== undefined) { bank.sculpture.setFill(previous, false); bank.shown = previous; }
          // Coins carry the change; the bank squashes and stretches when they land (or as they leave).
          const top = g.position.y + 3.4;
          if (change.dir === "up") launchCoins(change.n, us.position.x, us.position.y + 1.2, us.position.z, pos.x, top, pos.z, goal.id, goal.step, 1);
          else { const p = island.spot(island.cur); launchCoins(change.n, pos.x, top, pos.z, p.x, heightAt(island, p.x, p.z) + 1, p.z, goal.id, goal.step, 0); }
        } else if (bank.shown !== goal.step && !(arcs && fillPending(goal.id, goal.step))) {
          bank.sculpture.setFill(goal.step, false);
          bank.shown = goal.step;
        }
        bank.sculpture.group.scale.setScalar(3.2 / bank.height);
        bank.sculpture.group.position.set(0, 0.25, 0);
        g.add(bank.sculpture.group);
      } else {
        g.add(part(G.sph, palette.blooms[0]!, 1, 1, 1, 0, 1.2, 0, { flatShading: false }));
      }
      anchor(goal.id, g, 4.2); dynamic.add(g);
    });
    for (const [id, bank] of sculptures) if (!seen.has(id)) { bank.sculpture.group.removeFromParent(); bank.sculpture.dispose(); sculptures.delete(id); }
    for (const id of lastSteps.keys()) if (!seen.has(id)) lastSteps.delete(id);
    // The kiln: a brick hut just past the first landmark, where banks are fired.
    if (input.kiln && landmarkCount > 0) {
      const first = landmarkPosition(0, landmarkCount, island);
      const a0 = Math.atan2(first.z, first.x) + Math.min(0.42, Math.PI / landmarkCount * 0.5);
      const r = island.radiusAt(a0) - 14;
      const kx = Math.cos(a0) * r, kz = Math.sin(a0) * r;
      const k = new THREE.Group(); k.position.set(kx, heightAt(island, kx, kz), kz);
      k.rotation.y = Math.atan2(-Math.cos(a0), -Math.sin(a0));
      k.add(part(G.cyl, palette.walls[0]!, 1.5, 1.1, 1.5, 0, 0.55, 0));
      k.add(part(G.sph, palette.roofs[0]!, 1.5, 1.35, 1.5, 0, 1.1, 0));
      k.add(part(G.cyl, palette.roofs[0]!, 0.28, 1.4, 0.28, 0.7, 2.2, -0.3));
      k.add(part(G.cyl, palette.walls[0]!, 0.34, 0.14, 0.34, 0.7, 2.95, -0.3));
      const warm = input.kiln.warm;
      k.add(part(G.box, warm ? "#ffb347" : "#4c3b24", 0.7, 0.8, 0.08, 0, 0.45, 1.46, warm ? { emissive: "#ff8a1f", emissiveIntensity: 1.1 } : {}));
      if (warm) {
        for (let i = 0; i < 3; i++) {
          const puff = part(G.sph, "#e8e2da", 0.25, 0.25, 0.25, 0.7, 3.2, -0.3, { transparent: true, opacity: 0.85 });
          puff.castShadow = false; puff.visible = false; k.add(puff);
          tickers.push((t) => {
            const on = ambient && quality === "full";
            puff.visible = on;
            if (!on) return;
            const f = (t * 0.35 + i / 3) % 1;
            puff.position.set(0.7 + f * 0.6, 3.1 + f * 2.4, -0.3 - f * 0.2);
            puff.scale.setScalar(0.18 + f * 0.42);
          });
        }
      }
      reserved.push([kx, kz]);
      kilnAt = { x: kx, z: kz };
      anchor("kiln", k, 3.6); dynamic.add(k);
    }
    // The Charter: a paved stone square with a plinth and a standing tablet, off the first month.
    if (input.charter) {
      // The slab's half-diagonal is ~3.5 and charterSpot adds 3 more to every radius: keep a clear gap from landmark discs and the kiln.
      const avoid = Array.from({ length: landmarkCount }, (_, i) => ({ ...landmarkPosition(i, landmarkCount, island), r: 5 }));
      if (kilnAt) avoid.push({ ...kilnAt, r: 4.5 });
      const spot = charterSpot(island, avoid);
      const rock = new THREE.Color(palette.rock);
      const light = `#${rock.clone().lerp(new THREE.Color("#ffffff"), 0.22).getHexString()}`;
      const dark = `#${rock.clone().lerp(new THREE.Color("#2b2622"), 0.2).getHexString()}`;
      const sq = new THREE.Group();
      sq.position.set(spot.x, heightAt(island, spot.x, spot.z), spot.z);
      sq.rotation.y = -spot.a + Math.PI / 2;
      const slab = part(G.box, light, 5, 0.22, 5, 0, 0.11, 0); slab.castShadow = false; sq.add(slab);
      for (let i = 0; i < 3; i++) {
        const across = part(G.box, dark, 5, 0.02, 0.05, 0, 0.23, (i - 1) * 1.25); across.castShadow = false;
        const along = part(G.box, dark, 0.05, 0.02, 5, (i - 1) * 1.25, 0.23, 0); along.castShadow = false;
        sq.add(across, along);
      }
      sq.add(part(G.box, dark, 1.9, 0.45, 1.1, 0, 0.44, 0));
      const tablet = new THREE.Group();
      tablet.position.set(0, 0.66, 0);
      tablet.add(part(G.box, palette.rock, 1.4, 1.9, 0.26, 0, 0.95, 0));
      const signed = input.charter.signed;
      tablet.add(part(G.box, signed ? "#fff0c0" : dark, 0.5, 0.5, 0.04, 0, 1.5, 0.14, signed ? { emissive: "#ffc860", emissiveIntensity: 1.1 } : {}));
      for (let i = 0; i < Math.min(6, input.charter.amendments); i++) tablet.add(part(G.box, dark, 0.9, 0.05, 0.03, 0, 1.0 - i * 0.14, 0.14));
      if (input.charter.leaning) tablet.rotation.x = -8 * Math.PI / 180;
      sq.add(tablet);
      anchor("charter", sq, 3.4); dynamic.add(sq);
      reserved.push([spot.x, spot.z]);
    }
    // Hercules's cottage (Play): a small house with a cat door and a lit window, off the first month.
    if (input.cottage) {
      const avoid = Array.from({ length: landmarkCount }, (_, i) => ({ ...landmarkPosition(i, landmarkCount, island), r: 5 }));
      if (kilnAt) avoid.push({ ...kilnAt, r: 4.5 });
      if (input.name) { const p0 = island.spot(0); avoid.push({ x: p0.x + Math.cos(p0.a + 2.4) * 4, z: p0.z + Math.sin(p0.a + 2.4) * 4, r: 3 }); }
      const spot = cottageSpot(island, avoid, Boolean(input.charter));
      const wall = palette.walls[1] ?? palette.walls[0]!, roof = palette.roofs[1] ?? palette.roofs[0]!;
      const c = new THREE.Group();
      c.position.set(spot.x, heightAt(island, spot.x, spot.z), spot.z);
      // Face the first month (spot.a points from the cottage toward it).
      c.rotation.y = Math.PI / 2 - spot.a;
      c.add(part(G.box, wall, 2.4, 1.8, 2, 0, 0.9, 0));
      const top = part(G.roof, roof, 2.05, 1.3, 1.75, 0, 2.45, 0); top.rotation.y = Math.PI / 4; c.add(top);
      c.add(part(G.box, "#7a5436", 0.28, 0.9, 0.28, 0.7, 2.9, -0.3));
      // The door, with a small round cat door in it.
      c.add(part(G.box, "#6b4a30", 0.62, 1.1, 0.06, -0.5, 0.55, 1.01));
      const flap = part(G.cyl, "#3a2a1c", 0.17, 0.05, 0.17, -0.5, 0.26, 1.06); flap.rotation.x = Math.PI / 2; c.add(flap);
      // The lit window: someone is home.
      const lit = part(G.box, "#ffe2a0", 0.62, 0.52, 0.05, 0.55, 1.05, 1.02, { emissive: "#ffc860", emissiveIntensity: 1.15 }); lit.castShadow = false; c.add(lit);
      c.add(part(G.box, "#7a5436", 0.7, 0.06, 0.07, 0.55, 0.77, 1.04));
      poolAt(cottagePool, c, new THREE.Vector3(0.55, 1.05, 1.6), 1.6, 6);
      anchor("cottage", c, 3.6); dynamic.add(c);
      reserved.push([spot.x, spot.z]);
    }
    // Agreed decisions: short road stubs branching off the month they were agreed, each with a signpost.
    (input.forks ?? []).slice(0, 8).forEach((fork) => {
      if (fork.month < 0 || fork.month > island.cur) return;
      const p = island.spot(fork.month);
      const a = forkAngle(p, fork.index);
      const g = new THREE.Group();
      for (let k = 0; k < 5; k++) {
        const d = 1.6 + k * 0.85, x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
        const step = part(G.cyl, "#d8c49a", 0.36, 0.05, 0.36, x, heightAt(island, x, z) + 0.06, z); step.castShadow = false; g.add(step);
      }
      const sx = p.x + Math.cos(a) * 5.9, sz = p.z + Math.sin(a) * 5.9;
      const post = new THREE.Group(); post.position.set(sx, heightAt(island, sx, sz), sz); post.rotation.y = -a;
      post.add(part(G.cyl, "#7a5436", 0.06, 1.9, 0.06, 0, 0.95, 0), part(G.box, palette.walls[0]!, 0.95, 0.34, 0.06, 0.3, 1.6, 0), part(G.box, palette.accent, 0.12, 0.34, 0.07, 0.8, 1.6, 0));
      g.add(post);
      anchor(fork.id, post, 2.3); dynamic.add(g);
      reserved.push([sx, sz]);
    });
    // New parts of life with no recipe yet: a "?" signpost, with Hercules's pawprints leading to it.
    input.unknown.forEach((u, i) => {
      const p = island.spot(Math.min(island.cur, Math.max(0, u.month)));
      const x = p.x + Math.cos(p.a - 2) * (3 + i * 0.8), z = p.z + Math.sin(p.a - 2) * (3 + i * 0.8);
      const g = new THREE.Group(); g.position.set(x, heightAt(island, x, z), z);
      g.add(part(G.cyl, "#7a5436", 0.07, 2.2, 0.07, 0, 1.1, 0), part(G.box, "#fdf1f5", 1.2, 0.7, 0.08, 0, 2.1, 0), part(G.sph, palette.second, 0.12, 0.12, 0.12, 0, 2.1, 0.08));
      anchor(u.id, g, 2.8); dynamic.add(g);
      if (i === 0) pawTrail(island, island.spot(island.cur), { x, z });
    });
    // The island's name, carved beside the first month.
    if (input.name) {
      const p = island.spot(0);
      const x = p.x + Math.cos(p.a + 2.4) * 4, z = p.z + Math.sin(p.a + 2.4) * 4;
      const g = new THREE.Group(); g.position.set(x, heightAt(island, x, z), z);
      g.add(part(G.cyl, "#7a5436", 0.08, 2.4, 0.08, -1.3, 1.2, 0), part(G.cyl, "#7a5436", 0.08, 2.4, 0.08, 1.3, 1.2, 0));
      const c = document.createElement("canvas"); c.width = 512; c.height = 160;
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#fbf1e2"; ctx.fillRect(0, 0, 512, 160); ctx.strokeStyle = palette.accent; ctx.lineWidth = 8; ctx.strokeRect(6, 6, 500, 148);
        ctx.fillStyle = "#4c3b24"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        let fs = 64; ctx.font = `italic 600 ${fs}px Georgia, serif`;
        while (ctx.measureText(input.name).width > 470 && fs > 24) { fs -= 4; ctx.font = `italic 600 ${fs}px Georgia, serif`; }
        ctx.fillText(input.name, 256, 84);
      }
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const faceMat = new THREE.MeshStandardMaterial({ map: tex });
      const board = new THREE.Mesh(G.box, [mat("#d9c29a"), mat("#d9c29a"), mat("#d9c29a"), mat("#d9c29a"), faceMat, faceMat]);
      board.scale.set(3, 0.95, 0.1); board.position.y = 2; board.castShadow = true; g.add(board);
      g.rotation.y = -p.a + Math.PI / 2;
      smat(faceMat); sceneDisposables.push(() => tex.dispose());
      anchor("name", g, 3); dynamic.add(g);
    }

    // The Journey of Life: the other eras float around this one (nothing is drawn without a journey).
    buildJourney(input, island, reserved, Array.from({ length: landmarkCount }, (_, i) => landmarkPosition(i, landmarkCount, island)));
    placeFoliage(island, monthSeason, reserved);
    for (const obj of appearing) { obj.userData.pop = options.reducedMotion || !animate ? 1 : 0; obj.scale.setScalar(obj.userData.pop ? 1 : 0.01); }
    sun.intensity = monthSeason === "winter" ? 1.8 : 2.2;
    dynamic.updateMatrixWorld(true);
    us.updateMatrixWorld(true);
    syncAnchors();
  }
  /** A point on the road ahead of the current month, `along` of the way to the next month, and the side away from the island's centre. */
  function roadAhead(island: GrownIsland, along: number) {
    const p = island.spot(island.cur), q = island.spot(island.cur + 1);
    const dx = q.x - p.x, dz = q.z - p.z, len = Math.hypot(dx, dz) || 1;
    let nx = -dz / len, nz = dx / len;
    const x = p.x + dx * along, z = p.z + dz * along;
    if (nx * x + nz * z < 0) { nx = -nx; nz = -nz; }
    return { x, z, nx, nz, yaw: Math.atan2(dx, dz) };
  }

  function buildWeather(input: PathWorldInput, island: GrownIsland) {
    const clouds = input.weather.filter((row) => row.kind === "cloud" || row.kind === "storm").slice(0, 8);
    clouds.forEach((row, i) => {
      const storm = row.kind === "storm";
      const w = Math.max(0, Math.min(1, row.weight));
      const at = roadAhead(island, weatherAlong(row.dayOffset));
      const side = 3 + ((i % 3) - 1) * 1.6;
      const x = at.x + at.nx * side, z = at.z + at.nz * side;
      const g = new THREE.Group();
      const puffs = storm ? 7 : 4;
      const colour = storm ? "#8f9aab" : "#e3e8ee";
      for (let c = 0; c < puffs; c++) {
        const s = part(G.sph, colour, 0.9 + ((c * 37) % 7) * 0.08, 0.8, 0.9, (c - (puffs - 1) / 2) * 0.8, ((c * 13) % 5) * 0.1, 0, { flatShading: false });
        s.castShadow = false; g.add(s);
      }
      g.scale.setScalar((storm ? 1.15 : 0.75) + w * 0.8);
      g.position.set(x, heightAt(island, x, z) + 7 + (i % 4) * 0.7 + w * 1.5, z);
      const x0 = x;
      // Drift only with ambient motion on Full; reduced motion and Lite keep the clouds still.
      tickers.push((t) => { g.position.x = ambient && quality === "full" ? x0 + Math.sin(t * 0.3 + i * 2) * 0.8 : x0; });
      if (storm) {
        const boltMat = smat(new THREE.MeshBasicMaterial({ color: "#fff6c8", transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
        const bolt = new THREE.Mesh(strack(new THREE.PlaneGeometry(0.5, 3.2)), boltMat);
        bolt.position.set(0.2, -1.8, 0); bolt.rotation.z = 0.25; bolt.visible = false;
        g.add(bolt);
        // One slow flicker every ~6 s, only on Full with ambient motion.
        tickers.push((t) => {
          if (!ambient || quality !== "full" || options.reducedMotion) { bolt.visible = false; return; }
          const f = (t + i * 2.3) % 6;
          const o = f < 0.1 ? 0.85 : f > 0.18 && f < 0.26 ? 0.5 : 0;
          bolt.visible = o > 0; boltMat.opacity = o;
        });
      }
      anchor(row.id, g, 1.4); dynamic.add(g);
    });

    // Paydays: a low warm sun on the horizon side of the road, with a still light shaft.
    input.weather.filter((row) => row.kind === "sunrise").slice(0, 4).forEach((row) => {
      const at = roadAhead(island, weatherAlong(row.dayOffset));
      const x = at.x + at.nx * 9, z = at.z + at.nz * 9;
      const g = new THREE.Group(); g.position.set(x, Math.max(0, heightAt(island, x, z)), z);
      const disc = part(G.sph, "#ffcf7a", 1.3, 1.3, 1.3, 0, 1.4, 0, { emissive: "#ffa040", emissiveIntensity: 1.2, flatShading: false }); disc.castShadow = false;
      // Emissive only (the light cap): the sun disc glows, no PointLight.
      const shaft = new THREE.Mesh(strack(new THREE.PlaneGeometry(1.6, 9)), smat(new THREE.MeshBasicMaterial({ color: "#ffe2b0", transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide })));
      shaft.position.set(0, 5, 0); shaft.rotation.set(0, at.yaw, 0.35);
      g.add(disc, shaft);
      anchor(row.id, g, 2.4); dynamic.add(g);
    });

    // Covered stretches: a warm ribbon along the road for each range.
    for (const range of (input.sunlit ?? []).slice(0, 6)) {
      const from = weatherAlong(range.fromOffset), to = Math.max(from + 0.02, weatherAlong(range.toOffset + 1));
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 8; k++) { const at = roadAhead(island, from + (to - from) * k / 8); pts.push(new THREE.Vector3(at.x, heightAt(island, at.x, at.z) + 0.14, at.z)); }
      const ribbon = new THREE.Mesh(strack(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.2, 6, false)), mat("#ffd27a", { emissive: "#ffb347", emissiveIntensity: 0.6, roughness: 0.5, flatShading: false }));
      ribbon.castShadow = false; dynamic.add(ribbon);
    }

    // Mist: a flat fog over the road from where the forecast turns, and a signpost with an "i".
    const mist = input.weather.find((row) => row.kind === "mist");
    if (mist) {
      const from = weatherAlong(mist.dayOffset), to = Math.max(from + 0.15, PATH_WEATHER_REACH);
      const a = roadAhead(island, from), b = roadAhead(island, to);
      const len = Math.max(2, Math.hypot(b.x - a.x, b.z - a.z) + 3);
      const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      const top = Math.max(heightAt(island, a.x, a.z), heightAt(island, mx, mz), heightAt(island, b.x, b.z), 0);
      const fog = new THREE.Mesh(strack(new THREE.PlaneGeometry(7, len)), smat(new THREE.MeshBasicMaterial({ color: palette.fog, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide })));
      fog.rotation.order = "YXZ"; fog.rotation.set(-Math.PI / 2, a.yaw, 0);
      fog.position.set(mx, top + 1.2, mz);
      dynamic.add(fog);
      // The signpost stands a little along the road on the inland side, clear of the walkers at "now".
      const s = roadAhead(island, Math.min(PATH_WEATHER_REACH, from + 0.45));
      const sx = s.x - s.nx * 3.5, sz = s.z - s.nz * 3.5;
      const post = new THREE.Group(); post.position.set(sx, heightAt(island, sx, sz), sz); post.rotation.y = a.yaw;
      post.add(part(G.cyl, "#7a5436", 0.07, 2.2, 0.07, 0, 1.1, 0), part(G.box, "#fdf1f5", 1.2, 0.7, 0.08, 0, 2.1, 0));
      for (const face of [1, -1]) post.add(part(G.box, palette.second, 0.09, 0.3, 0.03, 0, 2.0, face * 0.06), part(G.sph, palette.second, 0.06, 0.06, 0.03, 0, 2.28, face * 0.06));
      anchor(mist.id, post, 2.8); dynamic.add(post);
    }
  }

  function buildStones(input: PathWorldInput, island: GrownIsland) {
    const perMonth = new Map<number, number>();
    for (const stone of input.stones ?? []) {
      if (stone.month < 0 || stone.month > island.cur) continue;
      const j = perMonth.get(stone.month) ?? 0;
      perMonth.set(stone.month, j + 1);
      const p = island.spot(stone.month);
      const a = p.a + 0.6 + j * 0.55, d = 2.3 + (j % 2) * 0.9;
      const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d, y = heightAt(island, x, z);
      const done = stone.state === "done";
      const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = -a;
      const h = done ? 0.08 : 0.3;
      const top = done ? 0.06 : 0.36;
      const disc = part(G.cyl, done ? "#9d9483" : "#e4dccb", 0.55, h, 0.55, 0, top - h / 2, 0); disc.castShadow = !done; g.add(disc);
      if (stone.money || stone.state === "waiting") {
        const ring = part(G.ring, stone.lit ? "#e0ad3c" : "#bda375", 0.42, 0.42, 0.42, 0, top + 0.02, 0, stone.lit ? { metalness: 0.6, roughness: 0.35, emissive: "#ffb347", emissiveIntensity: 1.1 } : { metalness: 0.6, roughness: 0.4 });
        ring.rotation.x = Math.PI / 2; ring.castShadow = false; g.add(ring);
      }
      // Footprints: the owner's, and a fainter one for the backup.
      const feet: [boolean, number, number][] = [[stone.owner, -0.14, 0.62], [stone.backup, 0.14, 0.28]];
      for (const [on, ox, opacity] of feet) {
        if (!on) continue;
        const foot = part(G.disc, "#6b5a44", 0.09, 0.14, 1, ox, top + 0.015, 0, { transparent: true, opacity, depthWrite: false });
        foot.rotation.x = -Math.PI / 2; foot.castShadow = false; foot.receiveShadow = false; g.add(foot);
      }
      anchor(stone.id, g, 1.1); dynamic.add(g);
    }
  }

  function tint(from: string, to: string, t: number): string {
    return `#${new THREE.Color(from).lerp(new THREE.Color(to), t).getHexString()}`;
  }

  function buildFootpaths(input: PathWorldInput, island: GrownIsland) {
    const perMonth = new Map<number, number>();
    for (const path of input.footpaths ?? []) {
      if (path.month < 0 || path.month > island.cur) continue;
      const j = perMonth.get(path.month) ?? 0;
      perMonth.set(path.month, j + 1);
      const p = island.spot(path.month);
      // Inland from the month spot, fanning out so several footpaths do not overlap.
      const inland = Math.atan2(-p.z, -p.x);
      const fan = (j % 2 ? 1 : -1) * (0.5 + Math.floor(j / 2) * 0.45);
      const len = 7 + (j % 3) * 1.4;
      const colour = path.done ? tint(palette.dry, palette.grass, 0.65) : tint(palette.dry, "#ffffff", 0.2);
      const dash = { transparent: true, opacity: path.done ? 0.85 : 0.7, depthWrite: false };
      let x = p.x, z = p.z;
      for (let d = 1.4, k = 0; d <= len; d += 1.2, k++) {
        const dir = inland + fan + Math.sin(k * 0.9 + j) * 0.18;
        x = p.x + Math.cos(inland + fan) * d + Math.cos(dir + Math.PI / 2) * Math.sin(k * 0.9) * 0.25;
        z = p.z + Math.sin(inland + fan) * d + Math.sin(dir + Math.PI / 2) * Math.sin(k * 0.9) * 0.25;
        const mark = part(G.disc, colour, 0.34, 0.12, 1, x, heightAt(island, x, z) + 0.05, z, dash);
        mark.rotation.x = -Math.PI / 2; mark.rotation.z = -dir;
        mark.castShadow = false; mark.receiveShadow = false;
        dynamic.add(mark);
      }
      const end = new THREE.Group();
      const ex = p.x + Math.cos(inland + fan) * (len + 0.8), ez = p.z + Math.sin(inland + fan) * (len + 0.8);
      end.position.set(ex, heightAt(island, ex, ez), ez);
      if (path.done) {
        end.add(part(G.cyl, "#7a5436", 0.03, 0.9, 0.03, 0, 0.45, 0));
        const flag = part(G.box, palette.grass, 0.34, 0.2, 0.02, 0.17, 0.78, 0); flag.castShadow = false; end.add(flag);
      } else {
        // A small cairn: three stacked stones.
        end.add(part(G.ico, palette.rock, 0.3, 0.2, 0.3, 0, 0.12, 0), part(G.ico, palette.rock, 0.22, 0.15, 0.22, 0.02, 0.36, 0), part(G.ico, palette.rock, 0.13, 0.1, 0.13, 0, 0.53, 0));
      }
      anchor(path.id, end, 1);
      dynamic.add(end);
    }
  }

  function buildBridges(input: PathWorldInput, island: GrownIsland) {
    const perMonth = new Map<number, number>();
    const wood = "#9c7a55", dark = "#6b523a";
    for (const bridge of input.bridges ?? []) {
      if (bridge.month < 0 || bridge.month > island.cur) continue;
      const j = perMonth.get(bridge.month) ?? 0;
      perMonth.set(bridge.month, j + 1);
      const p = island.spot(bridge.month);
      const a = p.a - 0.9 - j * 0.6, d = 3.6 + (j % 2) * 1.1;
      const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      const g = new THREE.Group(); g.position.set(x, heightAt(island, x, z), z); g.rotation.y = -a;
      // The shallow dip the bridge crosses (drawn, never carved): a wet hollow.
      const dip = part(G.disc, palette.deep, 0.9, 1.5, 1, 0, 0.04, 0, { transparent: true, opacity: 0.55, depthWrite: false, roughness: 0.3 });
      dip.rotation.x = -Math.PI / 2; dip.castShadow = false; dip.receiveShadow = false; g.add(dip);
      for (const end of [-1, 1]) g.add(part(G.ico, palette.rock, 0.4, 0.2, 0.3, 0, 0.1, end * 1.75));
      if (bridge.stage === 0) {
        // Set aside: two old stumps, no planks.
        for (const end of [-1, 1]) g.add(part(G.cyl, dark, 0.14, 0.35, 0.14, end * 0.45, 0.18, end * 1.5), part(G.cyl, dark, 0.14, 0.2, 0.14, -end * 0.45, 0.1, end * 1.5));
      } else {
        const planks = bridge.stage === 1 ? 1 : bridge.stage === 2 ? 4 : 8;
        const ghost = bridge.stage === 1 ? { transparent: true, opacity: 0.5, depthWrite: false } : undefined;
        for (let i = 0; i < planks; i++) {
          const plank = part(G.box, wood, 1.2, 0.08, 0.34, 0, 0.42, -1.4 + i * 0.4, ghost);
          if (ghost) plank.castShadow = false;
          g.add(plank);
        }
        if (bridge.stage >= 2) g.add(part(G.box, dark, 0.1, 0.12, bridge.stage === 3 ? 3.1 : 1.6, 0, 0.32, bridge.stage === 3 ? 0 : -0.75));
        if (bridge.stage === 2) {
          // Offered: a small pennant where the planks stop.
          g.add(part(G.cyl, dark, 0.03, 0.9, 0.03, 0.55, 0.85, -0.1));
          const pennant = part(G.cone, palette.accent, 0.12, 0.36, 0.04, 0.72, 1.18, -0.1); pennant.rotation.z = -Math.PI / 2; pennant.castShadow = false; g.add(pennant);
        }
        if (bridge.stage === 3) {
          for (const s of [-1, 1]) {
            for (const zz of [-1.4, 0, 1.4]) g.add(part(G.cyl, dark, 0.04, 0.6, 0.04, s * 0.58, 0.72, zz));
            g.add(part(G.box, dark, 0.05, 0.05, 2.9, s * 0.58, 1.02, 0));
          }
          // A lantern on the far post. It flickers only on Full with ambient motion.
          g.add(part(G.cyl, dark, 0.04, 0.5, 0.04, 0.58, 1.27, 1.4));
          const glow = smat(new THREE.MeshStandardMaterial({ color: "#ffd27a", emissive: "#ffb347", emissiveIntensity: 1.1, roughness: 0.4 }));
          const lamp = new THREE.Mesh(G.sph, glow); lamp.scale.setScalar(0.13); lamp.position.set(0.58, 1.6, 1.4); g.add(lamp);
          if (!bridgeClaimed) { bridgeClaimed = true; poolAt(bridgePool, g, new THREE.Vector3(0.58, 1.6, 1.4), 1.2, 6); }
          const phase = j * 1.3 + bridge.month;
          tickers.push((t) => {
            const on = ambient && quality === "full" && !options.reducedMotion;
            glow.emissiveIntensity = on ? 1.1 + 0.25 * Math.sin(t * 7 + phase) + 0.1 * Math.sin(t * 13.1 + phase) : 1.1;
          });
        }
      }
      anchor(bridge.id, g, 1.6);
      dynamic.add(g);
    }
  }

  // ------------------------------------------------------------------ the Journey of Life (D-268): era islands, the gate, the home
  const PENCIL = "#b3ada4";
  const PENCIL_EXTRA: THREE.MeshStandardMaterialParameters = { transparent: true, opacity: 0.5, wireframe: true, depthWrite: false, emissive: "#6f6a63", emissiveIntensity: 0.4 };
  const eraFogTexture = radialTexture("rgba(255,255,255,.95)", "rgba(255,255,255,0)", cleanup);
  /** How much fog each era island showed last frame (0–1), so a focus change fades from where it was. */
  const eraFogShown = new Map<string, number>();
  let gateSwing: number | null = null;
  /** Per-build: step functions (dt) that return true while still moving. */
  let fades: ((dt: number) => boolean)[] = [];
  /** Per-build: the floating islands' tops, for the camera's ground and target limits. */
  let eraTops: { x: number; z: number; r: number; y: number }[] = [];
  let eraExtent = 0;
  /** Per-build: every island on the journey (the main one included), for the Sky frame. */
  let eraFrame: { x: number; z: number; r: number; y: number }[] = [];
  /** What the page's controls cover (fractions of the stage); the Sky frame keeps the journey clear of it. */
  let safeArea: PathSafeArea = NO_SAFE;
  const hasJourney = () => eraExtent > 0;
  const aspectNow = () => (width && height ? width / height : 1);
  const skyFrame = () => eraSkyFrame(eraFrame, aspectNow(), eraSkyTheta(aspectNow()), cam.phi, safeArea);
  const maxRadius = () => (hasJourney() ? Math.max(200, skyFrame().r + 40) : 200);
  // A sea bed under the wider sea (journey only), so the main terrain's square floor does not show once the haze moves out.
  const seaBed = new THREE.Mesh(track(new THREE.CircleGeometry(1260, 48)), new THREE.MeshStandardMaterial({ color: "#6fb2ae", roughness: 0.95, flatShading: true }));
  seaBed.rotation.x = -Math.PI / 2; seaBed.position.y = -3.2; seaBed.visible = false; scene.add(seaBed);
  cleanup.push(() => (seaBed.material as THREE.Material).dispose());
  /** The haze reaches past the Sky camera when there is a journey (and comes back to today's values without one). */
  function journeyHaze() {
    const fog = scene.fog as THREE.Fog;
    if (hasJourney()) {
      const r = skyFrame().r;
      fog.near = Math.max(themeKey === "newfoundland" ? 300 : 380, r * 1.05); fog.far = fog.near + 750;
      sea.scale.setScalar(3); seaBed.visible = true;
      (seaBed.material as THREE.MeshStandardMaterial).color.set(palette.deep);
      if (camera.far !== 1600) { camera.far = 1600; camera.updateProjectionMatrix(); }
    } else {
      fog.near = themeKey === "newfoundland" ? 120 : 190; fog.far = 420;
      sea.scale.setScalar(1); seaBed.visible = false;
      if (camera.far !== 900) { camera.far = 900; camera.updateProjectionMatrix(); }
    }
  }

  /** One era part: a normal mesh, or the same shape in pencil (pale wireframe). Era parts never cast shadows. */
  function ep(pencil: boolean, geo: THREE.BufferGeometry, color: string, sx: number, sy: number, sz: number, x: number, y: number, z: number, extra?: THREE.MeshStandardMaterialParameters): THREE.Mesh {
    const m = pencil ? part(geo, PENCIL, sx, sy, sz, x, y, z, PENCIL_EXTRA) : part(geo, color, sx, sy, sz, x, y, z, extra);
    m.castShadow = false;
    return m;
  }
  const LIT_WINDOW: THREE.MeshStandardMaterialParameters = { emissive: "#ffc860", emissiveIntensity: 1.1 };
  const DARK_GLASS: THREE.MeshStandardMaterialParameters = { metalness: 0.35, roughness: 0.25 };

  /** A household home, about 4 units across at scale 1, facing +z. */
  function buildHome(kind: PathEraHome, pencil: boolean): THREE.Group {
    const g = new THREE.Group();
    const P = palette;
    const seed = ["flat", "furnished", "house", "porch", "cabin", "boat"].indexOf(kind);
    const wall = P.walls[(seed + 1) % P.walls.length]!, roof = P.roofs[seed % P.roofs.length]!;
    const add = (geo: THREE.BufferGeometry, color: string, sx: number, sy: number, sz: number, x: number, y: number, z: number, extra?: THREE.MeshStandardMaterialParameters) => {
      const m = ep(pencil, geo, color, sx, sy, sz, x, y, z, extra); g.add(m); return m;
    };
    const win = (x: number, y: number, z: number, lit: boolean) => add(G.box, lit ? "#ffe2a0" : "#3d4c5a", 0.5, 0.55, 0.06, x, y, z, lit ? LIT_WINDOW : DARK_GLASS);
    // A pitched roof: the prism's ridge runs along x, the triangle spans the depth.
    const pitched = (w: number, d: number, h: number, base: number, color: string) => {
      const r = add(G.prism, color, d / 2 / 0.866, w, h / 1.5, 0, base + 0.5 * h / 1.5, 0);
      r.rotation.set(-Math.PI / 2, Math.PI / 2, 0, "YXZ");
      return r;
    };
    const door = (z: number) => add(G.box, "#6b4a30", 0.6, 1.1, 0.06, 0, 0.55, z);
    if (kind === "flat" || kind === "furnished") {
      const lit = kind === "furnished";
      add(G.box, wall, 3, 3.6, 2.4, 0, 1.8, 0);
      add(G.box, roof, 3.2, 0.2, 2.6, 0, 3.7, 0);
      for (const y of [1.1, 2.7]) for (const x of [-0.8, 0.8]) win(x, y, 1.23, lit && !(y < 2 && x < 0));
      add(G.box, "#6b4a30", 0.5, 0.8, 0.06, 0, 0.4, 1.23);
      if (lit) {
        // The balcony: a tiny sofa and two plant pots.
        add(G.box, "#d8c49a", 2.4, 0.12, 0.9, 0, 2.0, 1.65);
        add(G.box, P.rock, 2.4, 0.4, 0.05, 0, 2.26, 2.08);
        add(G.box, P.second, 0.9, 0.22, 0.34, 0, 2.17, 1.5);
        add(G.box, P.second, 0.9, 0.34, 0.1, 0, 2.3, 1.36);
        for (const x of [-0.95, 0.95]) {
          add(G.cyl, "#c0704a", 0.13, 0.22, 0.13, x, 2.17, 1.6);
          add(G.ico, P.leaves[0]!, 0.2, 0.24, 0.2, x, 2.4, 1.6);
        }
      }
    } else if (kind === "house" || kind === "porch") {
      add(G.box, wall, 3.2, 2.2, 2.6, 0, 1.1, 0);
      pitched(3.5, 3, 1.9, 2.2, roof);
      door(1.31);
      win(-1, 1.25, 1.31, true); win(1, 1.25, 1.31, false);
      add(G.box, "#8a5a3e", 0.35, 1.1, 0.35, 0.9, 3.1, -0.45);
      if (kind === "porch") {
        const deck = "#b8925f";
        add(G.box, deck, 4.6, 0.18, 1.3, 0.3, 0.09, 1.95);
        add(G.box, deck, 1.3, 0.18, 3.9, 2.25, 0.09, 0.65);
        for (const [x, z] of [[-1.9, 2.5], [2.8, 2.5], [2.8, -1.2]] as const) add(G.cyl, "#fbf1e2", 0.06, 1.8, 0.06, x, 1.0, z);
        add(G.box, roof, 4.9, 0.1, 1.5, 0.35, 1.95, 2.0);
        add(G.box, roof, 1.5, 0.1, 3.8, 2.35, 1.95, 0.65);
        for (const x of [-1.25, -0.45]) {
          add(G.box, "#7a5436", 0.4, 0.06, 0.4, x, 0.52, 2.05);
          add(G.box, "#7a5436", 0.4, 0.5, 0.06, x, 0.78, 1.86);
          for (const s of [-0.16, 0.16]) { const r = add(G.box, "#6b4a30", 0.04, 0.06, 0.6, x + s, 0.24, 2.05); r.rotation.x = 0.1; }
        }
        for (const x of [-1.3, 1.3]) {
          add(G.box, "#7a5436", 1.5, 0.25, 0.6, x, 0.12, 3.3);
          for (let i = 0; i < 3; i++) add(G.ico, P.blooms[i % P.blooms.length]!, 0.18, 0.18, 0.18, x - 0.45 + i * 0.45, 0.34, 3.3);
        }
      }
    } else if (kind === "cabin") {
      add(G.box, "#8a5a3e", 3, 1.8, 2.4, 0, 0.9, 0);
      for (let i = 0; i < 4; i++) { const log = add(G.cyl, "#6b4a30", 0.12, 3.2, 0.12, 0, 0.25 + i * 0.45, 1.22); log.rotation.z = Math.PI / 2; }
      pitched(3.4, 2.9, 1.6, 1.8, P.roofs[1 % P.roofs.length]!);
      add(G.box, P.rock, 0.5, 2.9, 0.5, -1.6, 1.45, -0.3);
      door(1.36);
      win(0.9, 1.0, 1.36, true);
    } else {
      // The houseboat on a little pond.
      add(G.disc, "#7fb6c4", 3.3, 3.3, 1, 0, 0.06, 0, { roughness: 0.2, flatShading: false }).rotation.x = -Math.PI / 2;
      add(G.box, "#7a5436", 3.6, 0.6, 1.5, 0, 0.35, 0);
      add(G.box, P.accent, 3.62, 0.1, 1.52, 0, 0.55, 0);
      const bow = add(G.prism, "#7a5436", 0.87, 0.6, 0.5, 2.05, 0.35, 0); bow.rotation.y = Math.PI / 2;
      add(G.box, wall, 2, 1, 1.2, -0.2, 1.15, 0);
      add(G.box, roof, 2.3, 0.12, 1.5, -0.2, 1.71, 0);
      for (let i = 0; i < 3; i++) { const w = add(G.cyl, i === 1 ? "#ffe2a0" : "#3d4c5a", 0.14, 0.05, 0.14, -0.8 + i * 0.6, 1.2, 0.61, i === 1 ? LIT_WINDOW : DARK_GLASS); w.rotation.x = Math.PI / 2; }
    }
    return g;
  }

  /** A plan silhouette (about 2 units tall), facing +z. */
  function buildPlan(plan: PathEraIslandInput["plans"][number], ghost: boolean): THREE.Group {
    const g = new THREE.Group();
    const pencil = ghost || plan.sketched;
    const add = (geo: THREE.BufferGeometry, color: string, sx: number, sy: number, sz: number, x: number, y: number, z: number, extra?: THREE.MeshStandardMaterialParameters) => {
      const m = ep(pencil, geo, color, sx, sy, sz, x, y, z, extra); g.add(m); return m;
    };
    switch (plan.kind) {
      case "bank": {
        // A squat cat bank: unlit stone, warming with each step, gold once bought.
        const k = Math.max(0, Math.min(10, Math.round(plan.step ?? 0))) / 10;
        const colour = plan.bought ? "#e0ad3c" : tint("#8f8a84", "#e9a86a", k);
        const extra: THREE.MeshStandardMaterialParameters = plan.bought
          ? { metalness: 0.6, roughness: 0.35, emissive: "#8a5a10", emissiveIntensity: 0.5 }
          : k > 0 ? { emissive: "#ff9a3c", emissiveIntensity: Math.round(k * 45) / 100 } : {};
        add(G.cyl, P0(), 0.95, 0.12, 0.95, 0, 0.06, 0);
        add(G.sph, colour, 0.72, 0.62, 0.6, 0, 0.72, 0, extra);
        add(G.sph, colour, 0.42, 0.4, 0.4, 0, 1.4, 0.3, extra);
        for (const s of [-1, 1]) add(G.cone, colour, 0.12, 0.28, 0.12, s * 0.22, 1.82, 0.28, extra);
        const tail = add(G.cyl, colour, 0.08, 0.9, 0.08, 0, 0.95, -0.7, extra); tail.rotation.x = -0.6;
        add(G.box, "#3a2a1c", 0.08, 0.04, 0.34, 0, 1.33, -0.15);
        break;
      }
      case "milestone": {
        add(G.ico, palette.rock, 0.35, 0.25, 0.35, 0, 0.12, 0);
        add(G.cyl, "#7a5436", 0.06, 2.4, 0.06, 0, 1.2, 0);
        add(G.box, palette.accent, 0.9, 0.55, 0.04, 0.45, 2.1, 0);
        break;
      }
      case "trip": {
        // A folded map on the ground and a pennant on a short pole.
        for (let i = 0; i < 3; i++) { const p = add(G.box, i % 2 ? "#e8d5b0" : "#f3e6cc", 0.5, 0.03, 0.72, -0.48 + i * 0.48, 0.1, 0.3); p.rotation.z = i % 2 ? -0.25 : 0.25; }
        add(G.box, palette.second, 0.9, 0.02, 0.05, 0, 0.18, 0.3);
        add(G.cyl, "#7a5436", 0.04, 1.6, 0.04, 0.6, 0.8, -0.4);
        const pen = add(G.cone, palette.second, 0.18, 0.6, 0.05, 0.9, 1.45, -0.4); pen.rotation.z = -Math.PI / 2;
        break;
      }
      case "chapter": {
        // A small campfire ring, not yet lit.
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(G.ico, "#9c8f7d", 0.25, 0.2, 0.25, Math.cos(a) * 0.8, 0.12, Math.sin(a) * 0.8); }
        for (let i = 0; i < 3; i++) { const l = add(G.cyl, "#7a5436", 0.09, 1.1, 0.09, 0, 0.22, 0); l.rotation.z = Math.PI / 2; l.rotation.y = i * 1.05; }
        break;
      }
      default: {
        add(G.cyl, "#7a5436", 0.06, 1.8, 0.06, 0, 0.9, 0);
        add(G.box, "#fbf1e2", 1.0, 0.5, 0.06, 0, 1.5, 0);
        add(G.box, palette.accent, 0.1, 0.5, 0.07, 0.45, 1.5, 0);
      }
    }
    return g;
  }
  const P0 = () => tint(palette.rock, "#ffffff", 0.25);

  /** Each era island's signpost, with each theme's authored touch (Taylor's gold star, Classic's paper pennant, Newfoundland's painted board). */
  function eraSign(pencil: boolean, index: number): THREE.Group {
    const g = new THREE.Group();
    const add = (geo: THREE.BufferGeometry, color: string, sx: number, sy: number, sz: number, x: number, y: number, z: number, extra?: THREE.MeshStandardMaterialParameters) => {
      const m = ep(pencil, geo, color, sx, sy, sz, x, y, z, extra); g.add(m); return m;
    };
    const board = themeKey === "newfoundland" ? palette.walls[index % palette.walls.length]! : "#fbf1e2";
    add(G.cyl, "#7a5436", 0.08, 2.6, 0.08, 0, 1.3, 0);
    add(G.box, board, 1.5, 0.55, 0.08, 0.55, 2.1, 0);
    if (themeKey === "taylor") add(G.star, "#e9b949", 0.28, 0.28, 0.28, 0, 2.85, -0.05, { metalness: 0.6, roughness: 0.3, emissive: "#6b4a10", emissiveIntensity: 0.4 });
    else if (themeKey === "classic") { const p = add(G.cone, "#f2e2c0", 0.2, 0.7, 0.04, 0.35, 2.45, 0); p.rotation.z = -Math.PI / 2; }
    else add(G.box, "#f1f4f4", 1.5, 0.08, 0.1, 0.55, 1.8, 0);
    return g;
  }

  type EraNode = { offset: number; x: number; z: number; y: number; r: number; edge: (towardX: number, towardZ: number) => THREE.Vector3; state: PathEraIslandInput["state"] | "current" };

  /** A past island's land: the grown heightfield sampled coarsely, scaled down, cut along its coast. */
  function pastLand(island: GrownIsland): THREE.Mesh {
    const step = eraSampleStep(quality), n = eraSampleDims(step), S = eraPastScale(island.cur), V = ERA_PAST_LIFT;
    const P = landPaint(), c = new THREE.Color(), cliff = new THREE.Color(palette.rock).lerp(new THREE.Color("#2b2622"), 0.25);
    const vx = new Float32Array(n * n), vy = new Float32Array(n * n), vz = new Float32Array(n * n), sea = new Uint8Array(n * n);
    const col = new Float32Array(n * n * 3);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const v = j * n + i, k = idx(i * step, j * step), h = island.H[k]!;
      vx[v] = (-HALF + i * step * CELL) * S; vz[v] = (-HALF + j * step * CELL) * S;
      sea[v] = h < 0.05 ? 1 : 0;
      vy[v] = sea[v] ? -1.6 : h * V;
      if (sea[v]) c.copy(cliff); else landColour(island, k, "summer", P, c);
      col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b;
    }
    const pos: number[] = [], rgb: number[] = [];
    const tri = (a: number, b: number, d: number) => {
      if (sea[a] && sea[b] && sea[d]) return;
      for (const v of [a, b, d]) { pos.push(vx[v]!, vy[v]!, vz[v]!); rgb.push(col[v * 3]!, col[v * 3 + 1]!, col[v * 3 + 2]!); }
    };
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
      const a = j * n + i, b = a + 1, d = a + n, e = d + 1;
      tri(a, d, b); tri(b, d, e);
    }
    const geo = strack(new THREE.BufferGeometry());
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(rgb, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, smat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true, side: THREE.DoubleSide })));
    mesh.receiveShadow = false; mesh.castShadow = false;
    return mesh;
  }

  /** A few trees and blooms from a past island's fields, as two capped instanced meshes. */
  function pastGrowth(island: GrownIsland, g: THREE.Group, avoid: [number, number][]) {
    const S = eraPastScale(island.cur), V = ERA_PAST_LIFT, cap = quality === "lite" ? 18 : 40;
    const trees = new THREE.InstancedMesh(G.cone, mat(palette.leaves[0]!), cap);
    const blooms = new THREE.InstancedMesh(G.ico, mat(palette.blooms[0]!), cap);
    sceneDisposables.push(() => { trees.dispose(); blooms.dispose(); });
    let t = 0, b = 0;
    for (const p of CAND) {
      if (t >= cap && b >= cap) break;
      const k = idx(Math.max(0, Math.min(GRID - 1, Math.round((p.x + HALF) / CELL))), Math.max(0, Math.min(GRID - 1, Math.round((p.z + HALF) / CELL))));
      const h = island.H[k]!;
      if (h < 0.8 || island.S[k]! > 0.35 || island.R[k]! > 0.5) continue;
      const x = p.x * S, z = p.z * S;
      if (avoid.some(([ax, az]) => (ax - x) ** 2 + (az - z) ** 2 < 4)) continue;
      const y = heightAt(island, p.x, p.z) * V;
      if (t < cap && p.t < 0.12 && p.s < island.M[k]! * 1.25) {
        const s = 0.35 + p.s * 0.3;
        dummy.position.set(x, y + 1.2 * s, z); dummy.scale.set(0.9 * s, 2.6 * s, 0.9 * s); dummy.rotation.set(0, p.c * 6, 0); dummy.updateMatrix();
        trees.setMatrixAt(t++, dummy.matrix);
      } else if (b < cap && island.B[k]! > 0.18 && p.t < 0.2 + island.B[k]! * 0.5) {
        const s = 0.14 + p.s * 0.08;
        dummy.position.set(x, y + 0.12, z); dummy.scale.setScalar(s); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
        blooms.setMatrixAt(b++, dummy.matrix);
      }
    }
    trees.count = t; blooms.count = b;
    g.add(trees, blooms);
  }

  /** A past island's pieces as small simple markers (capped). */
  function pastPieces(island: GrownIsland, g: THREE.Group, avoid: [number, number][]) {
    const S = eraPastScale(island.cur), V = ERA_PAST_LIFT;
    let shown = 0;
    for (const piece of island.pieces) {
      if (shown >= (quality === "lite" ? 5 : 10)) break;
      const x = piece.x * S, z = piece.z * S;
      if (avoid.some(([ax, az]) => (ax - x) ** 2 + (az - z) ** 2 < 9)) continue;
      const y = heightAt(island, piece.x, piece.z) * V;
      const m = new THREE.Group(); m.position.set(x, y, z);
      switch (piece.kind) {
        case "grove": case "giftTree":
          m.add(ep(false, G.cyl, "#8a6a4a", 0.08, 0.6, 0.08, 0, 0.3, 0), ep(false, G.ico, palette.leaves[1 % palette.leaves.length]!, 0.55, 0.65, 0.55, 0, 0.9, 0));
          break;
        case "cottage": case "workshop": case "dogMeadow": case "kiln": case "cafe": {
          m.add(ep(false, G.box, palette.walls[(piece.n ?? shown) % palette.walls.length]!, 0.9, 0.7, 0.8, 0, 0.35, 0));
          const r = ep(false, G.roof, palette.roofs[(piece.n ?? shown) % palette.roofs.length]!, 0.75, 0.55, 0.75, 0, 0.97, 0); r.rotation.y = Math.PI / 4; m.add(r);
          break;
        }
        case "observatory": case "monument": case "star": case "lanterns": case "firstFire":
          m.add(ep(false, G.cyl, "#efe4cf", 0.18, 1.3, 0.18, 0, 0.65, 0), ep(false, G.sph, palette.second, 0.25, 0.25, 0.25, 0, 1.4, 0));
          break;
        default: {
          const d = ep(false, G.cyl, piece.kind === "pond" || piece.kind === "creek" ? "#8cc6d4" : "#d8c49a", 0.9, 0.05, 0.9, 0, 0.05, 0);
          m.add(d);
        }
      }
      g.add(m);
      avoid.push([x, z]);
      shown++;
    }
  }

  /** Where the camera stands over the sea, the main island or a floating island. */
  function groundUnder(x: number, z: number): number {
    if (!current) return 0;
    const d = Math.hypot(x, z);
    if (!hasJourney() || d < 90) return heightAt(current.island, x, z);
    let g = 0;
    for (const top of eraTops) {
      const dd = Math.hypot(x - top.x, z - top.z);
      const w = Math.max(0, Math.min(1, (top.r + 15 - dd) / 15));
      g = Math.max(g, top.y * w);
    }
    return g;
  }

  /** A rope-and-plank crossing between two points, sagging a little. */
  type CrossingStyle = "built" | "open" | "crossing" | "locked" | "faint" | "pencil";
  function crossing(a: THREE.Vector3, b: THREE.Vector3, style: CrossingStyle) {
    const flat = Math.hypot(b.x - a.x, b.z - a.z);
    if (flat < 1) return;
    const n = Math.max(2, Math.floor(flat / 1.1));
    const sag = Math.min(4, flat * 0.05);
    const at = (t: number, out = new THREE.Vector3()) => out.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - sag * Math.sin(Math.PI * t), a.z + (b.z - a.z) * t);
    const yaw = Math.atan2(b.x - a.x, b.z - a.z);
    const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const g = new THREE.Group();
    const planksWanted = style === "built" || style === "open" ? n : style === "crossing" ? Math.ceil(n / 2) : style === "faint" ? Math.ceil(n / 3) : 0;
    const p = new THREE.Vector3(), q = new THREE.Vector3();
    if (planksWanted) {
      const faint = style === "faint";
      const planks = new THREE.InstancedMesh(G.box, faint ? mat(tint(palette.dry, "#ffffff", 0.35), { transparent: true, opacity: 0.45, depthWrite: false }) : mat("#9c7a55"), planksWanted);
      sceneDisposables.push(() => planks.dispose());
      let c = 0;
      for (let i = 0; i < n && c < planksWanted; i++) {
        if (faint && i % 3) continue;
        const t = (i + 0.5) / n;
        at(t, p); at(Math.min(1, t + 0.01), q);
        dummy.position.copy(p); dummy.scale.set(1.7, 0.12, 0.8); dummy.rotation.set(0, 0, 0); dummy.lookAt(q.x, q.y, q.z); dummy.updateMatrix();
        planks.setMatrixAt(c++, dummy.matrix);
      }
      planks.count = c;
      g.add(planks);
    }
    const pencil = style === "pencil", faint = style === "faint";
    if (pencil || faint) {
      // A dashed rope (pencil: two of them, graphite).
      for (const s of pencil ? [-0.8, 0.8] : [0]) {
        const pts: THREE.Vector3[] = [];
        for (let k = 0; k <= 24; k++) pts.push(at(k / 24).addScaledVector(side, s).add(new THREE.Vector3(0, 0.6, 0)));
        const line = new THREE.Line(strack(new THREE.BufferGeometry().setFromPoints(pts)), smat(new THREE.LineDashedMaterial({ color: pencil ? PENCIL : palette.accent, dashSize: 1.2, gapSize: 0.9, transparent: true, opacity: pencil ? 0.7 : 0.6 })));
        line.computeLineDistances();
        g.add(line);
      }
    } else {
      // Rails and posts.
      const posts = Math.max(2, Math.round(flat / 7));
      const postMesh = new THREE.InstancedMesh(G.cyl, mat("#6b523a"), (posts + 1) * 2);
      sceneDisposables.push(() => postMesh.dispose());
      let c = 0;
      for (let i = 0; i <= posts; i++) for (const s of [-0.85, 0.85]) {
        at(i / posts, p).addScaledVector(side, s);
        dummy.position.set(p.x, p.y + 0.5, p.z); dummy.scale.set(0.08, 1.2, 0.08); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
        postMesh.setMatrixAt(c++, dummy.matrix);
      }
      g.add(postMesh);
      for (const s of [-0.85, 0.85]) {
        const pts: THREE.Vector3[] = [];
        for (let k = 0; k <= 16; k++) pts.push(at(k / 16).addScaledVector(side, s).add(new THREE.Vector3(0, style === "locked" ? 0.8 : 1.05, 0)));
        const rope = new THREE.Mesh(strack(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.05, 4, false)), mat(style === "locked" ? "#8a7a62" : "#6b523a"));
        rope.castShadow = false; g.add(rope);
      }
      if (style === "built") {
        // A lantern on the far post: emissive only (the light cap).
        at(0.97, p).addScaledVector(side, 0.85);
        g.add(ep(false, G.cyl, "#3d3a38", 0.05, 0.7, 0.05, p.x, p.y + 1.4, p.z), ep(false, G.sph, "#fff0c0", 0.2, 0.24, 0.2, p.x, p.y + 1.85, p.z, { emissive: "#ffc860", emissiveIntensity: 1.2 }));
      }
    }
    dynamic.add(g);
  }

  /** Fade something between shown values over ~0.8 s (instantly under reduced motion). */
  function fadeTo(from: number, to: number, apply: (v: number) => void, remember: (v: number) => void) {
    apply(from);
    if (from === to || options.reducedMotion) { apply(to); remember(to); return; }
    let v = from;
    fades.push((dt) => {
      v = to > v ? Math.min(to, v + dt / 0.8) : Math.max(to, v - dt / 0.8);
      apply(v); remember(v);
      return v !== to;
    });
  }

  /** The main island's widest reach (for the Sky frame). */
  const mainRadius = (island: GrownIsland) => Math.max(...Array.from({ length: 12 }, (_, i) => island.radiusAt(i / 12 * Math.PI * 2)));
  function buildJourney(input: PathWorldInput, island: GrownIsland, reserved: [number, number][], landmarkSpots: { x: number; z: number }[]) {
    fades = []; eraTops = []; eraExtent = 0; eraFrame = [];
    const eras = (input.eras ?? []).filter((era) => era && Math.round(era.offset) !== 0).slice(0, 12);
    const bob = (obj: THREE.Object3D, y0: number, phase: number) => tickers.push((t) => {
      obj.position.y = y0 + (ambient && quality === "full" && !options.reducedMotion ? Math.sin(t * 0.45 + phase) * 0.45 : 0);
    });
    const nodes: EraNode[] = [{
      offset: 0, x: 0, z: 0, y: 0, r: 0, state: "current",
      edge: (tx, tz) => {
        const a = Math.atan2(tz, tx), R = island.radiusAt(a) - 2;
        const x = Math.cos(a) * R, z = Math.sin(a) * R;
        return new THREE.Vector3(x, Math.max(0.2, heightAt(island, x, z)) + 0.3, z);
      },
    }];
    const seenFog = new Set<string>();
    eras.forEach((era, index) => {
      const spot = eraRingSpot(era.offset);
      const cx = Math.cos(spot.a) * spot.r, cz = Math.sin(spot.a) * spot.r;
      const past = era.state === "past" && era.island;
      const ghost = era.state === "sketched";
      const baseY = era.state === "past" ? 20 : era.state === "future" ? 24 : 27;
      const R = past ? eraPastRadius(era.island!.cur) : ghost ? ERA_SKETCH_RADIUS : ERA_FUTURE_RADIUS;
      const g = new THREE.Group(); g.position.set(cx, baseY, cz);
      const inward = Math.atan2(-cx, -cz);
      const topAt = past
        ? (lx: number, lz: number) => Math.max(0, heightAt(era.island!, lx / eraPastScale(era.island!.cur), lz / eraPastScale(era.island!.cur))) * ERA_PAST_LIFT
        : () => 0;
      // The rocky underside: an inverted cone and a few hanging stones.
      const rock = tint(palette.rock, "#2b2622", 0.12);
      const depth = R * 1.25;
      const cone = ep(ghost, G.cone, rock, R * 1.02, depth, R * 1.02, 0, -0.45 - depth / 2, 0); cone.rotation.x = Math.PI; g.add(cone);
      for (let i = 0; i < 4; i++) {
        const a = i * 1.7 + index;
        g.add(ep(ghost, G.ico, i % 2 ? palette.rock : rock, R * 0.32, R * 0.28, R * 0.3, Math.cos(a) * R * 0.55, -depth * (0.25 + i * 0.08), Math.sin(a) * R * 0.55));
      }
      g.add(ep(ghost, G.ico, rock, R * 0.18, R * 0.3, R * 0.18, R * 0.05, -depth - 0.8, 0));
      const avoid: [number, number][] = [[0, 0]];
      if (past) {
        g.add(pastLand(era.island!));
      } else {
        g.add(ep(ghost, G.cyl, tint(palette.grass, palette.dry, 0.15), R, 1.0, R, 0, -0.5, 0));
        g.add(ep(ghost, G.cyl, palette.dry, R * 1.01, 0.3, R * 1.01, 0, -1.05, 0));
        for (let i = 0; i < 3; i++) {
          const a = i * 2.3 + 0.7 + index;
          g.add(ep(ghost, G.ico, i === 1 ? palette.rock : tint(palette.grass, "#2b2622", 0.2), R * 0.26, R * 0.12, R * 0.22, Math.cos(a) * R * 0.62, 0, Math.sin(a) * R * 0.62));
        }
      }
      // The era's home at the centre, smaller than the current one.
      const home = buildHome(era.home, ghost);
      home.scale.setScalar(0.6); home.position.set(0, topAt(0, 0), 0); home.rotation.y = inward;
      g.add(home);
      // Plans around the home.
      const plans = era.plans.slice(0, 10);
      const ring = R * (past ? 0.5 : 0.62);
      plans.forEach((plan, i) => {
        const a = inward + Math.PI / 2 + (i / Math.max(1, plans.length)) * Math.PI * 2 + 0.35;
        const px = Math.sin(a) * ring, pz = Math.cos(a) * ring;
        const obj = buildPlan(plan, ghost);
        obj.position.set(px, topAt(px, pz), pz);
        obj.rotation.y = Math.atan2(px, pz);
        obj.scale.setScalar(past ? 0.75 : 1);
        g.add(obj);
        avoid.push([px, pz]);
        anchor(`era:${era.id}:plan:${plan.id}`, obj, 2.6);
      });
      // The signpost at the edge that faces the main island.
      const sx = Math.sin(inward) * R * 0.72 + Math.cos(inward) * 2.2, sz = Math.cos(inward) * R * 0.72 - Math.sin(inward) * 2.2;
      const sign = eraSign(ghost, index); sign.position.set(sx, topAt(sx, sz), sz); sign.rotation.y = inward + Math.PI / 2;
      g.add(sign);
      avoid.push([sx, sz]);
      if (past) { pastPieces(era.island!, g, avoid); pastGrowth(era.island!, g, avoid); }
      anchor(`era:${era.id}`, g, 5 + (past ? topAt(0, 0) : 0));
      dynamic.add(g);
      bob(g, baseY, index * 1.3);
      // Fog: future and sketched islands, unless focused. Full: soft sprites; Lite: one pale shell. Not pickable.
      if (!past) {
        seenFog.add(era.id);
        const fog = new THREE.Group(); fog.position.set(cx, baseY, cz);
        const spriteMat = smat(new THREE.SpriteMaterial({ map: eraFogTexture, color: palette.fog, transparent: true, opacity: 0, depthWrite: false }));
        const sprites = new THREE.Group();
        for (let i = 0; i < 10; i++) {
          const a = i / 10 * Math.PI * 2 + index;
          const sp = new THREE.Sprite(spriteMat);
          const k = R * (2 + (i % 3) * 0.3);
          sp.position.set(Math.cos(a) * R * 0.7, -R * 0.55 + (i % 4) * R * 0.35, Math.sin(a) * R * 0.7);
          sp.scale.set(k, k * 0.75, 1);
          sprites.add(sp);
        }
        for (const y of [-R * 0.4, R * 0.25]) { const mid = new THREE.Sprite(spriteMat); mid.position.set(0, y, 0); mid.scale.set(R * 3.2, R * 2, 1); sprites.add(mid); }
        const shellMat = smat(new THREE.MeshBasicMaterial({ color: palette.fog, transparent: true, opacity: 0, depthWrite: false }));
        const shell = new THREE.Mesh(G.sph, shellMat); shell.scale.set(R * 1.3, R * 1.1, R * 1.3); shell.position.y = -R * 0.2;
        fog.add(sprites, shell);
        tickers.push(() => { sprites.visible = quality === "full"; shell.visible = quality !== "full"; });
        const target = era.focused ? 0 : 1;
        fadeTo(eraFogShown.get(era.id) ?? target, target, (v) => {
          spriteMat.opacity = 0.95 * v; shellMat.opacity = 0.7 * v; fog.visible = v > 0.01;
        }, (v) => eraFogShown.set(era.id, v));
        dynamic.add(fog);
        bob(fog, baseY, index * 1.3);
      }
      eraTops.push({ x: cx, z: cz, r: R, y: baseY + 1.5 });
      eraExtent = Math.max(eraExtent, spot.r + R);
      nodes.push({
        offset: Math.round(era.offset), x: cx, z: cz, y: baseY, r: R, state: era.state,
        edge: (tx, tz) => {
          const a = Math.atan2(tz - cz, tx - cx), lx = Math.cos(a) * R * 0.86, lz = Math.sin(a) * R * 0.86;
          return new THREE.Vector3(cx + lx, baseY + topAt(lx, lz) + 0.1, cz + lz);
        },
      });
    });
    for (const id of eraFogShown.keys()) if (!seenFog.has(id)) eraFogShown.delete(id);
    nodes.sort((a, b) => a.offset - b.offset);
    const next = nodes.find((node) => node.offset > 0) ?? null;

    // The home at the centre of the main island.
    if (input.home) {
      // The clearest spot near the centre: pieces, landmarks, the kiln, the Charter, the cottage, signposts and the road all keep their room.
      const blockers: { x: number; z: number }[] = [...reserved.map(([x, z]) => ({ x, z })), ...landmarkSpots];
      for (let m = 0; m <= island.cur; m++) blockers.push(island.spot(m));
      if (input.name) { const p0 = island.spot(0); blockers.push({ x: p0.x + Math.cos(p0.a + 2.4) * 4, z: p0.z + Math.sin(p0.a + 2.4) * 4 }); }
      for (const fire of input.campfires) {
        if (fire.month < 0 || fire.month > island.cur) continue;
        const p = island.spot(fire.month), x = p.x + Math.cos(p.a + 1.9) * 3, z = p.z + Math.sin(p.a + 1.9) * 3;
        blockers.push({ x, z }, { x: x + Math.cos(p.a + 3) * 5, z: z + Math.sin(p.a + 3) * 5 });
      }
      let best = { x: 0, z: 0 }, bestScore = -Infinity;
      for (const r of [0, 2.5, 5, 7.5, 10, 13]) for (let i = 0; i < (r ? 12 : 1); i++) {
        const x = Math.cos(i / 12 * Math.PI * 2) * r, z = Math.sin(i / 12 * Math.PI * 2) * r;
        const gap = blockers.reduce((m, b) => Math.min(m, Math.hypot(b.x - x, b.z - z)), Infinity);
        const score = Math.min(gap, 8.5) - r * 0.12;
        if (score > bestScore + 0.01) { best = { x, z }; bestScore = score; }
      }
      const home = buildHome(input.home, false);
      home.position.set(best.x, heightAt(island, best.x, best.z), best.z);
      // Face the way the journey goes.
      home.rotation.y = Math.atan2(Math.cos(ERA_AXIS), Math.sin(ERA_AXIS));
      home.scale.setScalar(1.1);
      home.traverse((o) => { o.castShadow = true; });
      const pad = part(G.cyl, tint(palette.dry, palette.sand, 0.5), 3.3, 0.14, 3.3, 0, 0.02, 0); pad.castShadow = false; home.add(pad);
      anchor("era-home", home, 5.2);
      dynamic.add(home);
      reserved.push([best.x, best.z]);
    }

    // The gate out of this era, and its crossing to the next island.
    let gateAt: THREE.Vector3 | null = null;
    if (input.gate) {
      const toward = next ? Math.atan2(next.z, next.x) : ERA_AXIS;
      const blockers = [...reserved.map(([x, z]) => ({ x, z })), ...landmarkSpots];
      let angle = toward, bestGap = -1;
      for (const da of [0, 0.1, -0.1, 0.2, -0.2]) {
        const a = toward + da, R = island.radiusAt(a) - 3;
        const x = Math.cos(a) * R, z = Math.sin(a) * R;
        const gap = blockers.reduce((m, b) => Math.min(m, Math.hypot(b.x - x, b.z - z)), Infinity);
        if (gap > bestGap + 1.5) { angle = a; bestGap = gap; }
      }
      const R = island.radiusAt(angle) - 3;
      const gx = Math.cos(angle) * R, gz = Math.sin(angle) * R;
      const gy = Math.max(0.2, heightAt(island, gx, gz));
      const gate = new THREE.Group(); gate.position.set(gx, gy, gz);
      gate.rotation.y = Math.atan2(Math.cos(angle), Math.sin(angle));
      const open = input.gate.open;
      const post = themeKey === "newfoundland" ? palette.walls[0]! : themeKey === "taylor" ? "#fbf1e2" : "#efe4cf";
      const add = (geo: THREE.BufferGeometry, color: string, sx: number, sy: number, sz: number, x: number, y: number, z: number, extra?: THREE.MeshStandardMaterialParameters, into: THREE.Object3D = gate) => {
        const m = part(geo, color, sx, sy, sz, x, y, z, extra); into.add(m); return m;
      };
      add(G.box, palette.rock, 5.6, 0.25, 1.6, 0, 0.1, 0);
      for (const s of [-1, 1]) add(G.box, post, 0.5, 4.2, 0.5, s * 2.25, 2.1, 0);
      add(G.box, open ? "#ffe7a8" : post, 5.3, 0.45, 0.62, 0, 4.35, 0, open ? { emissive: "#e9b949", emissiveIntensity: 0.7 } : {});
      if (themeKey === "taylor") add(G.star, "#e9b949", 0.4, 0.4, 0.4, 0, 5.0, 0, { metalness: 0.6, roughness: 0.3, emissive: "#6b4a10", emissiveIntensity: 0.4 });
      else if (themeKey === "classic") { const p = add(G.cone, "#f2e2c0", 0.3, 0.9, 0.05, 0.45, 5.0, 0); p.rotation.z = -Math.PI / 2; add(G.cyl, "#7a5436", 0.04, 0.9, 0.04, 0, 4.9, 0); }
      else add(G.box, palette.walls[1 % palette.walls.length]!, 5.3, 0.12, 0.64, 0, 4.05, 0);
      // One lantern per part of the finish line, hanging under the lintel.
      const lanterns = input.gate.lanterns.slice(0, 12);
      const size = lanterns.length > 8 ? 0.16 : 0.21;
      lanterns.forEach((lit, i) => {
        const x = lanterns.length > 1 ? -1.9 + i * 3.8 / (lanterns.length - 1) : 0;
        add(G.cyl, "#3d3a38", 0.02, 0.35, 0.02, x, 3.95, 0.34);
        const l = add(G.sph, lit ? "#ffd27a" : "#2e3a44", size, size * 1.25, size, x, 3.7, 0.34, lit ? { emissive: "#ffb347", emissiveIntensity: 1.7 } : { metalness: 0.4, roughness: 0.25, transparent: true, opacity: 0.9 });
        l.castShadow = false;
      });
      // The doors swing outward when the gate opens.
      const doors: THREE.Group[] = [];
      for (const s of [-1, 1]) {
        const pivot = new THREE.Group(); pivot.position.set(s * 2.0, 0, 0);
        add(G.box, "#8a6a4a", 1.95, 3.1, 0.12, -s * 0.98, 1.75, 0, undefined, pivot);
        add(G.box, palette.accent, 1.95, 0.14, 0.14, -s * 0.98, 2.6, 0.02, undefined, pivot);
        gate.add(pivot); doors.push(pivot);
      }
      const arch = new THREE.Mesh(strack(new THREE.TorusGeometry(2.5, 0.14, 6, 28, Math.PI)), smat(new THREE.MeshBasicMaterial({ color: "#ffd27a", transparent: true, opacity: 0, depthWrite: false })));
      arch.position.set(0, 2.1, -0.1); gate.add(arch);
      const target = open ? 1 : 0;
      fadeTo(gateSwing ?? target, target, (v) => {
        doors[0]!.rotation.y = -1.25 * v; doors[1]!.rotation.y = 1.25 * v;
        arch.visible = v > 0.01; (arch.material as THREE.MeshBasicMaterial).opacity = 0.85 * v;
      }, (v) => { gateSwing = v; });
      anchor("era-gate", gate, 5.6);
      dynamic.add(gate);
      reserved.push([gx, gz]);
      gateAt = new THREE.Vector3(gx + Math.cos(angle) * 1.2, gy + 0.3, gz + Math.sin(angle) * 1.2);
      const style: CrossingStyle = open ? "open" : input.gate.crossing ? "crossing" : "locked";
      if (next) crossing(gateAt, next.edge(gx, gz), style);
      else crossing(gateAt, new THREE.Vector3(gx + Math.cos(angle) * 12, 0.9, gz + Math.sin(angle) * 12), "locked");
    } else gateSwing = null;

    // The journey's crossings, in order.
    for (let i = 1; i < nodes.length; i++) {
      const a = nodes[i - 1]!, b = nodes[i]!;
      if (a.offset === 0 && gateAt) continue;
      const pencil = a.state === "sketched" || b.state === "sketched";
      const style: CrossingStyle = pencil ? "pencil" : b.offset <= 0 ? "built" : "faint";
      crossing(a.edge(b.x, b.z), b.edge(a.x, a.z), style);
    }

    eraFrame = hasJourney() ? nodes.map((node) => (node.offset === 0 ? { x: 0, z: 0, r: mainRadius(island), y: 0 } : { x: node.x, z: node.z, r: node.r, y: node.y })) : [];
    // The haze and the sea reach further when there is a journey to see.
    journeyHaze();
    if (!hasJourney()) clampTarget();
  }

  function seasonOfIndex(input: PathWorldInput): string {
    return input.characters.length ? seasonOf(currentKey) : "summer";
  }
  let currentKey: string | undefined;

  function pawTrail(island: GrownIsland, from: { x: number; z: number }, to: { x: number; z: number }) {
    const dx = to.x - from.x, dz = to.z - from.z, len = Math.hypot(dx, dz);
    if (len < 3) return;
    const ux = dx / len, uz = dz / len, nx = -uz, nz = ux, yaw = Math.atan2(ux, uz);
    const trail = new THREE.Group();
    for (let d = 1.6, i = 0; d < len - 0.8; d += 0.75, i++) {
      const side = i % 2 ? 0.22 : -0.22, x = from.x + ux * d + nx * side, z = from.z + uz * d + nz * side;
      const paw = new THREE.Group(); paw.position.set(x, heightAt(island, x, z) + 0.07, z); paw.rotation.y = yaw;
      const pad = new THREE.Mesh(G.disc, mat("#6b4a30")); pad.rotation.x = -Math.PI / 2; pad.scale.set(0.13, 0.16, 1); paw.add(pad);
      for (const o of [-0.09, 0, 0.09]) { const toe = new THREE.Mesh(G.disc, mat("#6b4a30")); toe.rotation.x = -Math.PI / 2; toe.scale.setScalar(0.045); toe.position.set(o, 0, 0.17 - Math.abs(o) * 0.4); paw.add(toe); }
      trail.add(paw);
    }
    dynamic.add(trail);
  }

  // ------------------------------------------------------------------ us: two small walkers sharing one lantern
  const US_LIFT = 0.4, US_SCALE = 1.35, US_MARK_LIFT = 2.2, US_SIDE = 0.42, STRIDE = 0.55, FOOT_LIFE = 6, FEET = 24, LANTERN_GLOW = 2.4;
  const coatA = new THREE.MeshStandardMaterial({ roughness: 0.75 });
  const coatB = new THREE.MeshStandardMaterial({ roughness: 0.75 });
  const glowMat = new THREE.MeshStandardMaterial({ color: "#fff0c0", emissive: "#ffc860", emissiveIntensity: 1.3, roughness: 0.4 });
  cleanup.push(() => { coatA.dispose(); coatB.dispose(); glowMat.dispose(); });
  const us = new THREE.Group();
  us.name = "us";
  const walkers: THREE.Group[] = [];
  for (const [coat, side] of [[coatA, -1], [coatB, 1]] as const) {
    const f = new THREE.Group();
    f.position.x = side * US_SIDE;
    const body = new THREE.Mesh(G.cone, coat); body.scale.set(0.26, 0.82, 0.26); body.position.y = 0.41; body.castShadow = true;
    const head = part(G.sph, "#f3dcc6", 0.17, 0.17, 0.17, 0, 0.98, 0, { flatShading: false });
    // The inner arm reaches toward the shared lantern.
    const arm = part(G.cyl, "#f3dcc6", 0.035, 0.36, 0.035, -side * 0.16, 0.6, 0.08, { flatShading: false });
    arm.rotation.z = side * 1.05; arm.castShadow = false;
    f.add(body, head, arm);
    walkers.push(f); us.add(f);
  }
  const handle = part(G.cyl, "#6b523a", 0.02, 0.16, 0.02, 0, 0.62, 0.1); handle.castShadow = false;
  const globe = new THREE.Mesh(G.sph, glowMat); globe.scale.setScalar(0.1); globe.position.set(0, 0.48, 0.1);
  const glow = new THREE.PointLight(0xffc860, LANTERN_GLOW, 8, 2); glow.position.set(0, 0.5, 0.18);
  us.add(handle, globe, glow);
  us.scale.setScalar(US_SCALE);
  us.visible = false;
  scene.add(us);

  // Footprints: a fixed pool, reused oldest-first; nothing is allocated while walking.
  const trailGroup = new THREE.Group();
  scene.add(trailGroup);
  const feet: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; age: number }[] = [];
  for (let i = 0; i < FEET; i++) {
    const m = new THREE.MeshBasicMaterial({ color: "#6b5a44", transparent: true, opacity: 0, depthWrite: false });
    const mesh = new THREE.Mesh(G.disc, m);
    mesh.rotation.order = "YXZ"; mesh.rotation.x = -Math.PI / 2; mesh.scale.set(0.09, 0.14, 1); mesh.visible = false;
    trailGroup.add(mesh); feet.push({ mesh, mat: m, age: FOOT_LIFE });
  }
  cleanup.push(() => { for (const f of feet) f.mat.dispose(); });
  let footNext = 0, footLive = 0;
  const shownGround = { H: shownH };

  let lastCur = -1, usMonth = 0, usYaw = 0, usYawTarget = 0;
  /** The walkers stop briefly at each campfire month they pass, and the lantern brightens. */
  const CAMPFIRE_PAUSE = 0.4, CAMPFIRE_GLOW = 1.8;
  let walk: { pts: WalkPoint[]; from: number; to: number; t: number; dur: number; len: number; nextStep: number; left: boolean; stops: number[]; hold: number } | null = null;
  function groundAt(island: GrownIsland, x: number, z: number): number { return morph < 1 ? heightAt(shownGround, x, z) : heightAt(island, x, z); }
  function forwardYaw(island: GrownIsland, m: number): number {
    const p = island.spot(m), q = island.spot(m + 1);
    return Math.atan2(q.x - p.x, q.z - p.z);
  }
  function standAt(island: GrownIsland, m: number) {
    const p = island.spot(m);
    us.position.set(p.x, heightAt(island, p.x, p.z) + US_LIFT, p.z);
    usYaw = usYawTarget = forwardYaw(island, m);
    us.rotation.y = usYaw;
    for (const f of walkers) f.position.y = 0;
    usMonth = m;
  }
  function clearFeet() { for (const f of feet) { f.age = FOOT_LIFE; f.mesh.visible = false; f.mat.opacity = 0; } footLive = 0; }
  /** The shown month changed (or the scene was rebuilt): walk there, or simply stand there. */
  function arrive(island: GrownIsland) {
    const cur = island.cur;
    us.visible = true;
    if (cur === lastCur) {
      // Same month, rebuilt scene (theme, layers, a new piece): stay put, or keep walking.
      if (!walk) standAt(island, cur);
      return;
    }
    const from = walk ? usMonth : lastCur;
    lastCur = cur;
    // Reduced motion, the first scene, or a change that arrived while the world slept: no walk from a stale spot.
    if (options.reducedMotion || from < 0 || sleeping) { walk = null; clearFeet(); standAt(island, cur); return; }
    const pts = walkPath(island, from, cur, Math.max(8, Math.ceil(Math.abs(cur - from) * 16)));
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.z - pts[i - 1]!.z);
    const lo = Math.min(from, cur), hi = Math.max(from, cur);
    const stops = [...new Set((current?.campfires ?? []).map((f) => f.month).filter((m) => m >= lo && m <= hi && m !== from))];
    walk = { pts, from, to: cur, t: 0, dur: Math.max(0.35, walkSeconds(from, cur)), len, nextStep: STRIDE * 0.5, left: false, stops, hold: 0 };
  }
  function dropFeet(x: number, y: number, z: number, yaw: number, left: boolean) {
    const cx = Math.cos(yaw), cz = -Math.sin(yaw), fx = Math.sin(yaw), fz = Math.cos(yaw);
    for (let s = 0; s < 2; s++) {
      const foot = feet[footNext]!;
      footNext = (footNext + 1) % FEET;
      if (foot.age >= FOOT_LIFE) footLive++;
      const side = (s ? 1 : -1) * US_SIDE * US_SCALE + ((s === 0) === left ? -0.08 : 0.08);
      const along = (s === 0) === left ? 0.12 : -0.12;
      foot.mesh.position.set(x + cx * side + fx * along, y + 0.03, z + cz * side + fz * along);
      foot.mesh.rotation.y = yaw;
      foot.age = 0; foot.mat.opacity = 0.5; foot.mesh.visible = true;
    }
  }
  /** One frame of the walkers. Returns true while anything of theirs still moves. */
  function stepUs(dt: number, drifting: boolean): boolean {
    let moving = false;
    const island = current?.island;
    if (walk && island && walk.hold > 0) {
      walk.hold = Math.max(0, walk.hold - dt);
      walkers[0]!.position.y = walkers[1]!.position.y = 0;
      moving = true;
    } else if (walk && island) {
      const before = usMonth;
      walk.t = Math.min(1, walk.t + dt / walk.dur);
      const e = 0.5 - 0.5 * Math.cos(Math.PI * walk.t);
      const last = walk.pts.length - 1, f = e * last, i = Math.min(last - 1, Math.floor(f)), u = f - i;
      const a = walk.pts[i]!, b = walk.pts[i + 1]!;
      const x = a.x + (b.x - a.x) * u, z = a.z + (b.z - a.z) * u;
      const y = groundAt(island, x, z) + US_LIFT;
      us.position.set(x, y, z);
      usMonth = walk.from + (walk.to - walk.from) * e;
      if (Math.abs(b.x - a.x) + Math.abs(b.z - a.z) > 1e-6) usYawTarget = Math.atan2(b.x - a.x, b.z - a.z);
      const travelled = e * walk.len;
      const phase = travelled / STRIDE * Math.PI;
      walkers[0]!.position.y = Math.abs(Math.sin(phase)) * 0.07;
      walkers[1]!.position.y = Math.abs(Math.cos(phase)) * 0.07;
      while (travelled >= walk.nextStep) { dropFeet(x, y - US_LIFT, z, usYawTarget, walk.left); walk.left = !walk.left; walk.nextStep += STRIDE; }
      const stop = walk.stops.findIndex((m) => (m - before) * (m - usMonth) <= 0 && m !== before);
      if (stop >= 0) { walk.stops.splice(stop, 1); walk.hold = CAMPFIRE_PAUSE; }
      else if (walk.t >= 1) {
        walk = null;
        usMonth = island.cur;
        for (const w of walkers) w.position.y = 0;
        usYawTarget = forwardYaw(island, island.cur);
      }
      moving = true;
    }
    const turn = Math.atan2(Math.sin(usYawTarget - usYaw), Math.cos(usYawTarget - usYaw));
    if (Math.abs(turn) > 0.003) { usYaw += turn * Math.min(1, dt * 9); moving = true; } else usYaw = usYawTarget;
    us.rotation.y = usYaw;
    if (footLive) {
      footLive = 0;
      for (const foot of feet) {
        if (foot.age >= FOOT_LIFE) continue;
        foot.age += dt;
        if (foot.age >= FOOT_LIFE) { foot.mesh.visible = false; foot.mat.opacity = 0; continue; }
        foot.mat.opacity = 0.5 * (1 - foot.age / FOOT_LIFE);
        footLive++;
      }
      if (footLive) moving = true;
    }
    // At "now" the lantern breathes a little, only with ambient motion on Full.
    const atNow = Boolean(current && current.island.cur === current.characters.length - 1);
    glow.intensity = walk && walk.hold > 0 ? LANTERN_GLOW * CAMPFIRE_GLOW
      : drifting && atNow && quality === "full" && !walk
        ? LANTERN_GLOW * (1 + 0.09 * Math.sin(clock * 13.1) + 0.05 * Math.sin(clock * 7.7))
        : LANTERN_GLOW;
    return moving;
  }

  // ------------------------------------------------------------------ coins: a fixed pool that arcs between the two of you and a bank
  const COIN_SECONDS = 0.9, COIN_GAP = 0.08, COIN_HOP = 4;
  const coinMat = new THREE.MeshStandardMaterial({ color: "#e0ad3c", emissive: "#8a5a10", emissiveIntensity: 0.55, metalness: 0.6, roughness: 0.35 });
  cleanup.push(() => coinMat.dispose());
  const coinGroup = new THREE.Group();
  scene.add(coinGroup);
  type Coin = { mesh: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; t: number; live: boolean; fill: { goalId: string; step: number; at: number } | null };
  const coins: Coin[] = [];
  for (let i = 0; i < COIN_POOL; i++) {
    const mesh = new THREE.Mesh(G.cyl, coinMat);
    mesh.scale.set(0.32, 0.06, 0.32); mesh.visible = false; mesh.castShadow = false;
    coinGroup.add(mesh);
    coins.push({ mesh, from: new THREE.Vector3(), to: new THREE.Vector3(), t: 0, live: false, fill: null });
  }
  let coinsLive = 0;
  /** Send up to `n` coins; the first one carries the bank's new fill (at = 1 on landing, 0 as it leaves). */
  function launchCoins(n: number, fx: number, fy: number, fz: number, tx: number, ty: number, tz: number, goalId: string, step: number, at: number) {
    let sent = 0;
    for (const coin of coins) {
      if (sent >= n) break;
      if (coin.live) continue;
      coin.from.set(fx, fy, fz); coin.to.set(tx, ty, tz);
      coin.t = -sent * COIN_GAP / COIN_SECONDS;
      coin.live = true; coin.mesh.visible = false;
      coin.fill = sent === 0 ? { goalId, step, at } : null;
      sent++; coinsLive++;
    }
    // The pool was full: the bank still shows its new size, without a flourish.
    if (!sent) { const bank = sculptures.get(goalId); if (bank) { bank.sculpture.setFill(step, false); bank.shown = step; } }
  }
  function fillPending(goalId: string, step: number): boolean {
    return coins.some((coin) => coin.live && coin.fill?.goalId === goalId && coin.fill.step === step);
  }
  function landFill(fill: { goalId: string; step: number }) {
    const bank = sculptures.get(fill.goalId);
    // A later scene already asked for another size: that change carries its own fill.
    if (!bank || bank.shown === fill.step || lastSteps.get(fill.goalId) !== fill.step) return;
    bank.sculpture.setFill(fill.step, true);
    bank.shown = fill.step;
  }
  /** One frame of flying coins. Returns true while any is in the air. */
  function stepCoins(dt: number): boolean {
    if (!coinsLive || dt <= 0) return coinsLive > 0;
    for (const coin of coins) {
      if (!coin.live) continue;
      coin.t += dt / COIN_SECONDS;
      if (coin.fill && coin.t > 0 && coin.t >= coin.fill.at) { landFill(coin.fill); coin.fill = null; }
      if (coin.t >= 1) { coin.live = false; coin.mesh.visible = false; coinsLive--; continue; }
      if (coin.t <= 0) continue;
      const e = coin.t;
      coin.mesh.visible = true;
      coin.mesh.position.lerpVectors(coin.from, coin.to, e);
      coin.mesh.position.y += Math.sin(Math.PI * e) * COIN_HOP;
      coin.mesh.rotation.set(Math.PI / 2, e * 9, 0);
    }
    return coinsLive > 0;
  }

  // ------------------------------------------------------------------ camera
  const cam = { tx: 0, tz: 0, r: 118, theta: 0.7, phi: 0.95 };
  let fly: { t: number; from: typeof cam; to: typeof cam } | null = null;
  let width = 0, height = 0;
  let level: PathLevel = 0;
  const levelOf = (r: number): PathLevel => (r > 110 ? 0 : r > 62 ? 1 : r > 30 ? 2 : 3);
  function place() {
    const phi = Math.max(0.35, Math.min(1.35, cam.phi + (1 - Math.min(1, cam.r / 120)) * 0.35));
    const y = cam.r * Math.cos(phi), h = cam.r * Math.sin(phi);
    const ground = groundUnder(cam.tx, cam.tz);
    camera.position.set(cam.tx + h * Math.sin(cam.theta), Math.max(ground + 3, y + ground), cam.tz + h * Math.cos(cam.theta));
    camera.lookAt(cam.tx, ground + 1.5, cam.tz);
    const next = levelOf(cam.r);
    if (next !== level) { level = next; options.onLevel?.(level); }
  }
  function clampTarget() {
    // With a journey, the target may travel out to the farthest era island.
    const limit = hasJourney() ? eraExtent + 20 : 84;
    const d = Math.hypot(cam.tx, cam.tz); if (d > limit) { cam.tx *= limit / d; cam.tz *= limit / d; }
  }

  const pointers = new Map<number, { x: number; y: number }>();
  let moved = 0, pinch = 0, panMode = false;
  const el = renderer.domElement;
  const onDown = (e: PointerEvent) => { el.setPointerCapture?.(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; panMode = e.button === 2 || e.shiftKey; fly = null; };
  const onMove = (e: PointerEvent) => {
    const prev = pointers.get(e.pointerId); if (!prev) return;
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved += Math.abs(dx) + Math.abs(dy);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) cam.r = Math.max(14, Math.min(maxRadius(), cam.r * pinch / d));
      pinch = d; invalidate(); return;
    }
    if (panMode) {
      const k = cam.r * 0.0018;
      cam.tx += (-dx * Math.cos(cam.theta) - dy * Math.sin(cam.theta)) * k;
      cam.tz += (dx * Math.sin(cam.theta) - dy * Math.cos(cam.theta)) * k;
      clampTarget();
    } else { cam.theta -= dx * 0.006; cam.phi = Math.max(0.35, Math.min(1.3, cam.phi + dy * 0.004)); }
    invalidate();
  };
  const onUp = (e: PointerEvent) => {
    const single = pointers.size === 1;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = 0;
    if (single && moved < 6) pick(e.clientX, e.clientY);
  };
  const onWheel = (e: WheelEvent) => { e.preventDefault(); fly = null; cam.r = Math.max(14, Math.min(maxRadius(), cam.r * Math.exp(e.deltaY * 0.001))); invalidate(); };
  const onContext = (e: Event) => e.preventDefault();
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onUp);
  el.addEventListener("wheel", onWheel, { passive: false });
  el.addEventListener("contextmenu", onContext);
  cleanup.push(() => { el.removeEventListener("pointerdown", onDown); el.removeEventListener("pointermove", onMove); el.removeEventListener("pointerup", onUp); el.removeEventListener("pointercancel", onUp); el.removeEventListener("wheel", onWheel); el.removeEventListener("contextmenu", onContext); });

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(x: number, y: number) {
    const r = el.getBoundingClientRect();
    ndc.set((x - r.left) / r.width * 2 - 1, -(y - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    for (const hit of ray.intersectObjects(pickables, true)) {
      let o: THREE.Object3D | null = hit.object;
      while (o && !o.userData.pickId) o = o.parent;
      if (o) { options.onPick?.(o.userData.pickId as string); return; }
    }
  }

  // ------------------------------------------------------------------ quality
  let quality: PathQuality = "full";
  function applyQuality(next: PathQuality, first = false) {
    if (!first && next === quality) return;
    quality = next;
    const full = next === "full";
    renderer.setPixelRatio(Math.min(typeof devicePixelRatio === "number" ? devicePixelRatio : 1, PIXEL_RATIO_CAP[next]));
    renderer.shadowMap.enabled = full;
    sun.castShadow = full;
    // Lite keeps only the walkers' lantern as a real light (the program recompile below covers the count change).
    for (const light of lightPool) light.visible = full;
    if (!full && sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    if (first) return;
    // Shadow code is compiled into each program: ask three.js to rebuild them.
    scene.traverse((obj) => {
      const m = (obj as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(m)) for (const x of m) x.needsUpdate = true;
      else if (m) m.needsUpdate = true;
    });
  }
  applyQuality(options.quality ?? "full", true);

  // ------------------------------------------------------------------ frames
  let raf = 0, dead = false, ambient = false, clock = 0, last = 0, frames = 0, lastFrameMs = 0;
  let sleeping = false, offscreen = false, idle = false, lastActivity = performance.now();
  const projected = new THREE.Vector3();
  function frame(now: number) {
    raf = 0;
    if (dead) return;
    const started = performance.now();
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    let busy = false;
    const drifting = ambient && !idle;
    if (drifting) { clock += dt; busy = true; cam.theta += dt * 0.012; }
    for (const t of tickers) t(clock);
    if (quality === "full") for (const obj of decor.children) {
      if (obj.userData.spin) obj.rotation.y += dt * (obj.userData.spin as number);
      const orbit = obj.userData.orbit as { r: number; speed: number; phase: number; y: number } | undefined;
      if (orbit) { const a = clock * orbit.speed + orbit.phase; obj.position.set(Math.cos(a) * orbit.r, orbit.y, Math.sin(a) * orbit.r); obj.rotation.y = -a; }
      const flutter = obj.userData.flutter as { x: number; z: number; phase: number } | undefined;
      if (flutter && current) { obj.position.set(flutter.x + Math.sin(clock * 0.4 + flutter.phase) * 3, heightAt(current.island, flutter.x, flutter.z) + 2 + Math.sin(clock * 2 + flutter.phase) * 0.5, flutter.z + Math.cos(clock * 0.3 + flutter.phase) * 3); obj.children.forEach((w, i) => { w.rotation.y = (i ? -1 : 1) * Math.abs(Math.sin(clock * 12 + flutter.phase)); }); }
    }
    if (morph < 1) { morph = Math.min(1, morph + dt / 0.9); const e = morph < 0.5 ? 2 * morph * morph : 1 - (-2 * morph + 2) ** 2 / 2; applyMorph(e); busy = true; }
    for (const obj of appearing) {
      const p = obj.userData.pop as number;
      if (p < 1) { const n = Math.min(1, p + dt * 1.6); obj.userData.pop = n; obj.scale.setScalar(Math.max(0.01, n < 0.7 ? n / 0.7 * 1.12 : 1.12 - (n - 0.7) / 0.3 * 0.12)); busy = true; }
    }
    if (fly) {
      fly.t = Math.min(1, fly.t + dt / 1.1);
      const e = fly.t < 0.5 ? 4 * fly.t ** 3 : 1 - (-2 * fly.t + 2) ** 3 / 2;
      const hop = Math.sin(e * Math.PI) * Math.min(40, Math.hypot(fly.to.tx - fly.from.tx, fly.to.tz - fly.from.tz) * 0.5);
      cam.tx = fly.from.tx + (fly.to.tx - fly.from.tx) * e;
      cam.tz = fly.from.tz + (fly.to.tz - fly.from.tz) * e;
      cam.r = fly.from.r + (fly.to.r - fly.from.r) * e + hop;
      cam.theta = fly.from.theta + (fly.to.theta - fly.from.theta) * e;
      if (fly.t >= 1) fly = null;
      busy = true;
    }
    if (fades.length) { fades = fades.filter((f) => f(dt)); if (fades.length) busy = true; }
    if (stepCoins(dt)) busy = true;
    for (const bank of sculptures.values()) if (bank.sculpture.update(now)) busy = true;
    // A walk (and its fading footprints) keeps the loop awake even with ambient motion on, then lets it rest.
    const walking = stepUs(dt, drifting);
    if (walking) busy = true;
    // Idle is counted from when the island last settled or was touched.
    const settling = (busy && !drifting) || walking || coinsLive > 0;
    if (settling || pointers.size) lastActivity = performance.now();
    place();
    renderer.render(scene, camera);
    syncAnchors();
    if (options.onAnchors && width) {
      const list: PathAnchor[] = [];
      for (const [id, v] of anchors) {
        projected.copy(v).project(camera);
        const visible = projected.z < 1 && Math.abs(projected.x) < 1.1 && Math.abs(projected.y) < 1.1;
        list.push({ id, x: (projected.x * 0.5 + 0.5) * width, y: (-projected.y * 0.5 + 0.5) * height, depth: camera.position.distanceTo(v), visible });
      }
      options.onAnchors(list);
    }
    frames++; lastFrameMs = performance.now() - started;
    if (drifting && !settling && !pointers.size && performance.now() - lastActivity >= idleMs) { idle = true; busy = false; }
    if (busy || pointers.size) raf = requestAnimationFrame(frame);
    else last = 0;
  }
  function halt() { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; }
  /** Something changed or someone touched the island: leave idle and draw (unless asleep or scrolled away). */
  function invalidate() {
    if (dead) return;
    lastActivity = performance.now();
    idle = false;
    if (!raf && !sleeping && !offscreen) raf = requestAnimationFrame(frame);
  }
  const onHidden = () => { if (document.hidden) halt(); else invalidate(); };
  document.addEventListener("visibilitychange", onHidden);
  cleanup.push(() => document.removeEventListener("visibilitychange", onHidden));
  // Keyboard and touch count as interaction too (the page's controls are DOM buttons, not the canvas).
  const onActivity = () => { if (idle) invalidate(); else lastActivity = performance.now(); };
  window.addEventListener("keydown", onActivity, { passive: true });
  host.addEventListener("touchstart", onActivity, { passive: true });
  cleanup.push(() => { window.removeEventListener("keydown", onActivity); host.removeEventListener("touchstart", onActivity); });
  // Scrolled fully out of view: stop drawing until any of it comes back.
  if (typeof IntersectionObserver === "function") {
    const io = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      offscreen = !entry.isIntersecting;
      if (offscreen) halt();
      else invalidate();
    });
    io.observe(host);
    cleanup.push(() => io.disconnect());
  }
  const lost = (event: Event) => { event.preventDefault(); options.onLost?.(); };
  el.addEventListener("webglcontextlost", lost);
  cleanup.push(() => el.removeEventListener("webglcontextlost", lost));

  /** A hidden host measures 0×0; those sizes are ignored so the last real size is kept. */
  function resize(w: number, h: number) {
    if (!w || !h || (w === width && h === height)) return;
    width = w; height = h;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    if (hasJourney()) journeyHaze();
    renderer.setSize(w, h, false);
    invalidate();
  }
  function flyTo(tx: number, tz: number, r: number, theta = cam.theta) {
    const to = { ...cam, tx, tz, r };
    let dth = theta - cam.theta; dth = Math.atan2(Math.sin(dth), Math.cos(dth));
    to.theta = cam.theta + dth;
    if (options.reducedMotion) { Object.assign(cam, to); invalidate(); return; }
    fly = { t: 0, from: { ...cam }, to };
    invalidate();
  }

  return {
    setScene(input: PathWorldInput, monthKey: string | undefined, animate: boolean) {
      currentKey = monthKey;
      current = input;
      buildScene(input, animate);
      invalidate();
      // One more draw once the first frame's shaders have compiled: a slow first frame (a big household on a
      // software renderer) was seen to leave a stale terrain on screen until something else asked for a frame.
      const generation = sceneGeneration;
      setTimeout(() => { if (!dead && generation === sceneGeneration) invalidate(); }, 400);
    },
    resize,
    setAmbient(on: boolean) { ambient = on && !options.reducedMotion; invalidate(); },
    setQuality(next: PathQuality) {
      const changed = next !== quality;
      applyQuality(next);
      // Era islands sample their land and fog by quality: rebuild them (only when there is a journey).
      if (changed && current && hasJourney()) buildScene(current, false);
      invalidate();
    },
    /** The tent is open: stop drawing, keep the context and every buffer. */
    sleep() { if (dead) return; sleeping = true; halt(); },
    /** Back from the tent: re-measure (the host was display:none), draw, and re-report anchors. */
    wake(w?: number, h?: number) {
      if (dead) return;
      sleeping = false;
      if (w && h) resize(w, h);
      invalidate();
    },
    /** The page's controls cover these shares of the stage (per side); the next Sky trip frames the journey clear of them. */
    setSafeArea(next: PathSafeArea) {
      const same = (["top", "right", "bottom", "left"] as const).every((k) => Math.abs((next[k] ?? 0) - safeArea[k]) < 0.01);
      if (!same) safeArea = { top: next.top ?? 0, right: next.right ?? 0, bottom: next.bottom ?? 0, left: next.left ?? 0 };
    },
    /** Re-report anchors after the page changed what it shows (lantern, layers). */
    refresh() { invalidate(); },
    /** Travel to an anchor, or to "now" (the current month). */
    focus(id: string, levelHint?: PathLevel) {
      const target = id === "now" && current ? (() => { const p = current.island.spot(current.island.cur); return new THREE.Vector3(p.x, 0, p.z); })() : anchors.get(id);
      if (!target) return;
      flyTo(target.x, target.z, PATH_LEVEL_RADIUS[levelHint ?? 3]!);
    },
    setLevel(next: PathLevel) {
      // With a journey, Sky frames every era island: the future straight ahead (wide screens turn a little to see it across).
      if (next === 0 && hasJourney()) { const f = skyFrame(); flyTo(f.tx, f.tz, f.r, eraSkyTheta(aspectNow())); return; }
      flyTo(next === 0 ? 0 : cam.tx, next === 0 ? 0 : cam.tz, PATH_LEVEL_RADIUS[next]!);
    },
    zoom(factor: number) { fly = null; cam.r = Math.max(14, Math.min(maxRadius(), cam.r * factor)); invalidate(); },
    turn(delta: number) { cam.theta += delta; invalidate(); },
    stats(): PathWorldStats { return { frames, lastFrameMs, pieces: pickables.length, level, ambient, quality, sleeping, idle, walking: walk !== null }; },
    dispose() {
      if (dead) return;
      dead = true;
      cancelAnimationFrame(raf);
      for (const bank of sculptures.values()) bank.sculpture.dispose();
      sculptures.clear();
      for (const dispose of sceneDisposables.splice(0)) dispose();
      for (const dispose of decorDisposables.splice(0)) dispose();
      for (let i = cleanup.length - 1; i >= 0; i--) cleanup[i]!();
      for (const g of geometries) g.dispose();
      for (const m of materials.values()) m.dispose();
      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss();
      el.remove();
    },
  };
}
export type PathWorld = ReturnType<typeof createPathWorld>;
