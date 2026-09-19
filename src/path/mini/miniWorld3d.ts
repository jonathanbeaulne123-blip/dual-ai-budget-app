import * as THREE from "three";
import type { PathEraHome, PathEraPlanKind } from "../../core/pathWorld.ts";
import type { ThemeId } from "../../theme/scenes.ts";

/**
 * The journey's simple view in 3D (D-284): one small tabletop model that the
 * camera pulls back from. Day and Week are a straight stepping-stone path over
 * the Everyday water with the Prepare, Protect and Build lanes beside it; the
 * path curls into a ring that ends at the Sitdown gate (Month), the ring becomes
 * that month's lap on its era's island with the other Chapters around it and the
 * finish-line Kitty Banks filling (Era), and the camera rises to see every era as
 * a floating island (Journey).
 *
 * The canvas is decorative (`aria-hidden`). Every label and control is a real
 * DOM button the page places at the anchors this module reports per frame. It
 * only draws when something changes (render on demand), stops when hidden or
 * scrolled away, and reports a lost WebGL context so the page can fall back.
 */

export type MiniWho = "a" | "b" | "both";
export type MiniSceneDay = {
  date: string;
  day: number;
  today: boolean;
  past: boolean;
  /** Bills (lane each is drawn from). */
  bills: ("prepare" | "protect" | "build")[];
  /** Contributions (expected ones are drawn lighter). */
  contributions: { expected: boolean; split?: Record<"prepare" | "protect" | "build" | "everyday", number> | null }[];
  tasks: { who: MiniWho; done: boolean }[];
};
export type MiniSceneLap = { key: string; status: "closed" | "open" | "ahead"; current: boolean };
export type MiniSceneBank = { id: string; fill: number | null; full: boolean; bought: boolean };
export type MiniSceneEra = {
  id: string;
  state: "crossed" | "current" | "future" | "sketched";
  home: PathEraHome;
  plans: { kind: PathEraPlanKind; fill: number | null }[];
  laps: number;
};
export type MiniSceneInput = {
  theme: ThemeId;
  monthKey: string;
  days: MiniSceneDay[];
  /** Day of month that sits at the top of the ring (today's day, so every month's lap lines up). */
  anchorDay: number;
  /** The Sitdown that closes this month. */
  gate: "closed" | "open" | "ahead";
  /** The Sitdown that closed the month before (drawn where this month's path begins), if any. */
  startGate?: "closed" | "open" | "ahead" | null;
  /** The focused month's era (index into `eras`), its laps, and which lap is this month. */
  eraIndex: number;
  laps: MiniSceneLap[];
  lap: number;
  banks: MiniSceneBank[];
  eras: MiniSceneEra[];
  /** The era we are in (index into `eras`), or -1. */
  currentEra: number;
};
export type MiniAnchor = { id: string; x: number; y: number; visible: boolean };
export type MiniFrame = { anchors: MiniAnchor[]; z: number; day: number; width: number; height: number };
export type MiniQuality = "full" | "low";

type Palette = Record<
  | "bg" | "sky" | "ground" | "groundSide" | "earth" | "water" | "stone" | "stonePast" | "stoneEdge"
  | "prepare" | "protect" | "build" | "channel" | "queen" | "pot" | "porcelain" | "bloom"
  | "herc" | "hercLight" | "today" | "flagA" | "flagB" | "flagBoth" | "wood" | "woodDark" | "gold" | "glass"
  | "tent" | "tentStripe" | "tree1" | "tree2" | "tree3" | "trunk" | "cloud" | "glow" | "roof" | "wall" | "bill" | "tuft" | "flower",
  string>;

/** Authored per theme; the lane colours match `journey-mini.css`. */
export const MINI_PALETTES: Record<ThemeId, Palette> = {
  classic: {
    bg: "#efe6d3", sky: "#f1e9da", ground: "#c9c28f", groundSide: "#a88a5f", earth: "#7d5d3f", water: "#b4d2d6",
    stone: "#d8cdb9", stonePast: "#b3a58f", stoneEdge: "#8f8170", prepare: "#8a5639", protect: "#3f5967", build: "#4a6840",
    channel: "#9c8260", queen: "#b4406a", pot: "#c0643a", porcelain: "#f7f1e8", bloom: "#e46f95",
    herc: "#9b6a43", hercLight: "#f1e3cc", today: "#2c6a4e", flagA: "#b4406a", flagB: "#3f5967", flagBoth: "#2c6a4e",
    wood: "#a8743f", woodDark: "#6e4a2b", gold: "#e0ab3e", glass: "#fbf4e6", tent: "#c45c26", tentStripe: "#f3e6cf",
    tree1: "#c0703a", tree2: "#6f8a55", tree3: "#8fa05e", trunk: "#6e4a2b", cloud: "#ffffff", glow: "#f0c96b",
    roof: "#a4523a", wall: "#f3eadb", bill: "#8c3f1c", tuft: "#9fae6a", flower: "#f2e2c0",
  },
  taylor: {
    bg: "#f8e8ec", sky: "#fbeff2", ground: "#ecd3dc", groundSide: "#cf9fb2", earth: "#a7708a", water: "#c9d1ef",
    stone: "#f6e2ea", stonePast: "#dcb8c8", stoneEdge: "#a86a8a", prepare: "#9b557c", protect: "#5a5f9e", build: "#3f6a4f",
    channel: "#d6a9bd", queen: "#a2386a", pot: "#d0708e", porcelain: "#fffafc", bloom: "#f08fb1",
    herc: "#a8744e", hercLight: "#f8ebe0", today: "#3f6a4f", flagA: "#a2386a", flagB: "#5a5f9e", flagBoth: "#b8862f",
    wood: "#e0a9bf", woodDark: "#946522", gold: "#e8b93f", glass: "#fff7fa", tent: "#b04a7c", tentStripe: "#fbe3ec",
    tree1: "#e79ab8", tree2: "#b98fcc", tree3: "#8fbf8a", trunk: "#946522", cloud: "#ffffff", glow: "#ffe38a",
    roof: "#c9677f", wall: "#fbf1e2", bill: "#8b2f6b", tuft: "#c7a3c9", flower: "#f7c85f",
  },
  newfoundland: {
    bg: "#e6ebe3", sky: "#e9eee8", ground: "#a9bb98", groundSide: "#6f7f6a", earth: "#5b5a52", water: "#9fc3cc",
    stone: "#e9e4d4", stonePast: "#c3bca7", stoneEdge: "#557e83", prepare: "#9a5236", protect: "#274e55", build: "#4f7a4a",
    channel: "#7a8a80", queen: "#a33b5a", pot: "#b8433a", porcelain: "#fbfaf0", bloom: "#e06f9a",
    herc: "#8f6541", hercLight: "#efe5d2", today: "#274e55", flagA: "#a33b5a", flagB: "#26766f", flagBoth: "#e07a3b",
    wood: "#8a7a64", woodDark: "#4c4238", gold: "#f2cf3b", glass: "#f7f7ed", tent: "#a33751", tentStripe: "#f2cf3b",
    tree1: "#2f6a6f", tree2: "#4f7a4a", tree3: "#3f6a52", trunk: "#4c4238", cloud: "#ffffff", glow: "#ffe08a",
    roof: "#283f50", wall: "#a33751", bill: "#9a3a26", tuft: "#7f9a73", flower: "#f2cf3b",
  },
};
type Key = keyof Palette;

export const MINI_LEVEL_COUNT = 5;
const SP = 1.5; // path length per day
const LANE_W = { everyday: 0, prepare: -1.2, protect: -1.72, build: -2.24 } as const;
const WATER = 0.72;
const ISLAND_R = 16.5;
const LAP_IN = 2.8;
const LAP_OUT = 13.4;
const ERA_GAP = 46;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** How strongly something that belongs to level `center` shows at zoom `z` (1 = fully). */
export function miniLevelWeight(z: number, center: number, inner = 0.35, outer = 0.8): number {
  return 1 - smooth(inner, outer, Math.abs(z - center));
}
/** Lap radius on an era island. */
export function miniLapRadius(lap: number, laps: number): number {
  const gap = laps > 1 ? Math.min(0.58, (LAP_OUT - LAP_IN) / (laps - 1)) : 0;
  return LAP_IN + lap * gap;
}

type Placed = { o: THREE.Object3D; s: number; w: number; y: number };
type Bead = { s: number; w: number; y: number; scale?: number };
type Fader = { weight: () => number; mats: THREE.Material[]; objs: THREE.Object3D[] };

export function createMiniWorld(host: HTMLElement, options: {
  reducedMotion: boolean;
  quality?: MiniQuality;
  compact?: boolean;
  onFrame?: (frame: MiniFrame) => void;
  onLost?: () => void;
  /** The camera settled on a new rounded level after a gesture (not after `setView`). */
  onSettle?: (z: number, day: number) => void;
}) {
  const probe = document.createElement("canvas");
  if (!(probe.getContext("webgl2") || probe.getContext("webgl"))) throw new Error("WebGL unavailable");
  const compact = Boolean(options.compact);
  const renderer = new THREE.WebGLRenderer({ antialias: !compact, alpha: false, powerPreference: "low-power", preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const el = renderer.domElement;
  el.setAttribute("aria-hidden", "true");
  el.className = "journey-mini__canvas";
  el.style.touchAction = "none";
  host.appendChild(el);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 2000);
  const hemi = new THREE.HemisphereLight(0xfff4e2, 0x7a6a55, 1.55);
  const sun = new THREE.DirectionalLight(0xffe9cc, 1.9);
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.02;
  scene.add(hemi, sun, sun.target);
  scene.fog = new THREE.Fog(0xefe6d3, 20, 80);
  const bgColor = new THREE.Color();
  scene.background = bgColor;

  let palette = MINI_PALETTES.classic;
  const root = new THREE.Group();
  scene.add(root);

  // ---------------------------------------------------------------- materials (keyed, so themes recolour in place)
  const mats: { m: THREE.MeshStandardMaterial; key: Key; mute: number }[] = [];
  const cache = new Map<string, THREE.MeshStandardMaterial>();
  function mat(key: Key, extra: THREE.MeshStandardMaterialParameters & { mute?: number; group?: string } = {}): THREE.MeshStandardMaterial {
    const { mute = 0, group = "", ...params } = extra;
    const id = `${key}|${mute}|${group}|${JSON.stringify(params)}`;
    let m = cache.get(id);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ roughness: 0.88, metalness: 0, flatShading: true, ...params });
      m.userData.baseOpacity = params.opacity ?? 1;
      m.userData.spec = { key, extra: { mute, ...params }, group };
      m.userData.glow = params.emissiveIntensity !== undefined;
      if (group) m.transparent = true;
      mats.push({ m, key, mute });
      cache.set(id, m);
      tint(m, key, mute);
    }
    return m;
  }
  function tint(m: THREE.MeshStandardMaterial, key: Key, mute: number) {
    m.color.set(palette[key]);
    if (mute) m.color.lerp(new THREE.Color(palette.sky), mute);
    if (m.userData.glow) m.emissive.copy(m.color);
  }
  const geos = new Set<THREE.BufferGeometry>();
  const G = <T extends THREE.BufferGeometry>(g: T): T => { geos.add(g); return g; };
  const shared = {
    stone: G(new THREE.CylinderGeometry(1, 1.1, 1, 7)),
    cyl: G(new THREE.CylinderGeometry(1, 1, 1, 10)),
    cyl6: G(new THREE.CylinderGeometry(1, 1, 1, 6)),
    cone: G(new THREE.ConeGeometry(1, 1, 7)),
    cone4: G(new THREE.ConeGeometry(1, 1, 4)),
    sph: G(new THREE.SphereGeometry(1, 10, 7)),
    ico: G(new THREE.IcosahedronGeometry(1, 0)),
    box: G(new THREE.BoxGeometry(1, 1, 1)),
    torus: G(new THREE.TorusGeometry(1, 0.09, 6, 28)),
    bead: G(new THREE.SphereGeometry(1, 6, 4)),
    dodeca: G(new THREE.DodecahedronGeometry(1, 0)),
    halo: G(new THREE.TorusGeometry(1, 0.022, 4, 72)),
  };
  function mesh(geo: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx): THREE.Mesh {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.scale.set(sx, sy, sz);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  }

  // ---------------------------------------------------------------- faders (level of detail by zoom)
  const faders = new Map<string, Fader>();
  let z = 2, zT = 2, day = 1, dayT = 1;
  faders.set("near", { weight: () => 1 - smooth(2.1, 2.8, z), mats: [], objs: [] });
  faders.set("trees", { weight: () => 1 - smooth(1.25, 1.85, z), mats: [], objs: [] });
  faders.set("laps", { weight: () => smooth(2.05, 2.75, z), mats: [], objs: [] });
  faders.set("glow", { weight: () => smooth(3.15, 3.85, z), mats: [], objs: [] });
  faders.set("pin", { weight: () => smooth(2.3, 2.9, z), mats: [], objs: [] });
  faders.set("far", { weight: () => smooth(2.6, 3.4, z), mats: [], objs: [] });
  function fade<T extends THREE.Object3D>(name: string, obj: T): T {
    const f = faders.get(name)!;
    f.objs.push(obj);
    obj.traverse((o) => {
      const item = o as THREE.Mesh;
      const m = item.material as THREE.MeshStandardMaterial | undefined;
      if (!m || Array.isArray(m)) return;
      const spec = m.userData.spec as { key: Key; extra: THREE.MeshStandardMaterialParameters & { mute?: number }; group: string } | undefined;
      // A shared material is swapped for this fader's own copy, so fading one group never fades another.
      const own = spec && spec.group !== name ? mat(spec.key, { ...spec.extra, group: name }) : m;
      if (own !== m) item.material = own;
      own.transparent = true;
      if (!f.mats.includes(own)) f.mats.push(own);
    });
    return obj;
  }
  const fmat = (key: Key, group: string, extra: THREE.MeshStandardMaterialParameters & { mute?: number } = {}) => {
    const m = mat(key, { ...extra, group });
    const f = faders.get(group)!;
    if (!f.mats.includes(m)) f.mats.push(m);
    return m;
  };

  // ---------------------------------------------------------------- the path (one month), curling with K
  let K = 0, lastK = -1;
  let R = 31 * SP / (2 * Math.PI);
  let anchor = 1;
  let dim = 31;
  const V = new THREE.Vector3();
  const sOf = (d: number) => (d - anchor) * SP;
  function mp(s: number, w: number, y: number, out: THREE.Vector3): THREE.Vector3 {
    let pt: number, pn: number, nt: number, nn: number;
    if (K < 1e-6) { pt = s; pn = 0; nt = 0; nn = 1; } else { const a = K * s; pt = Math.sin(a) / K; pn = (1 - Math.cos(a)) / K; nt = -Math.sin(a); nn = Math.cos(a); }
    return out.set(pt + w * nt, y, R - (pn + w * nn));
  }
  let path = new THREE.Group();
  root.add(path);
  let pathDisposables: (() => void)[] = [];
  let ribbons: THREE.Mesh[] = [];
  let placed: Placed[] = [];
  let beadSets: { im: THREE.InstancedMesh; list: Bead[] }[] = [];
  const pickables: THREE.Object3D[] = [];
  const anchors = new Map<string, { at: () => THREE.Vector3 }>();
  const dummy = new THREE.Object3D();

  function ribbon(w0: number, w1: number, y: number, m: THREE.Material, s0: number, s1: number, n = 140, parent: THREE.Object3D = path): THREE.Mesh {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array((n + 1) * 6), nor = new Float32Array((n + 1) * 6), idx: number[] = [];
    for (let i = 0; i <= n; i++) { nor[i * 6 + 1] = 1; nor[i * 6 + 4] = 1; }
    for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    g.setIndex(idx);
    pathDisposables.push(() => g.dispose());
    const o = new THREE.Mesh(g, m);
    o.receiveShadow = true;
    o.userData.rib = { w0, w1, y, s0, s1, n };
    o.frustumCulled = false;
    ribbons.push(o);
    parent.add(o);
    return o;
  }
  function place<T extends THREE.Object3D>(o: T, s: number, w: number, y: number, pickId?: string): T {
    placed.push({ o, s, w, y });
    if (pickId) { o.userData.pickId = pickId; pickables.push(o); }
    if (!o.parent) path.add(o);
    return o;
  }
  function beads(key: Key, list: Bead[], size: number, group = "near") {
    if (!list.length) return;
    const g = G(new THREE.SphereGeometry(size, 6, 4));
    const im = new THREE.InstancedMesh(g, fmat(key, group), list.length);
    im.frustumCulled = false;
    im.castShadow = false;
    path.add(im);
    fade(group, im);
    beadSets.push({ im, list });
    pathDisposables.push(() => { im.dispose(); g.dispose(); geos.delete(g); });
  }
  function curl() {
    for (const o of ribbons) {
      const r = o.userData.rib as { w0: number; w1: number; y: number; s0: number; s1: number; n: number };
      const p = (o.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
      for (let i = 0; i <= r.n; i++) {
        const s = lerp(r.s0, r.s1, i / r.n);
        mp(s, r.w0, r.y, V); p[i * 6] = V.x; p[i * 6 + 1] = V.y; p[i * 6 + 2] = V.z;
        mp(s, r.w1, r.y, V); p[i * 6 + 3] = V.x; p[i * 6 + 4] = V.y; p[i * 6 + 5] = V.z;
      }
      o.geometry.attributes.position!.needsUpdate = true;
      o.geometry.computeBoundingSphere();
    }
    for (const p of placed) { mp(p.s, p.w, p.y, p.o.position); p.o.rotation.y = K * p.s + (p.o.userData.spin as number ?? 0); }
    for (const set of beadSets) {
      set.list.forEach((b, i) => {
        mp(b.s, b.w, b.y, dummy.position);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(b.scale ?? 1);
        dummy.updateMatrix();
        set.im.setMatrixAt(i, dummy.matrix);
      });
      set.im.instanceMatrix.needsUpdate = true;
    }
  }

  // ---------------------------------------------------------------- figures
  function hercules(parent: THREE.Object3D): THREE.Group {
    const g = new THREE.Group();
    const coat = mat("herc"), light = mat("hercLight"), dark = mat("woodDark");
    mesh(shared.sph, coat, g, 0, 0.26, -0.02, 0.27, 0.23, 0.22);
    mesh(shared.sph, light, g, 0, 0.3, 0.13, 0.15, 0.16, 0.1);
    mesh(shared.sph, coat, g, 0, 0.55, 0.06, 0.18, 0.16, 0.16);
    mesh(shared.sph, light, g, 0, 0.51, 0.19, 0.08, 0.06, 0.05);
    for (const s of [-1, 1]) {
      const ear = mesh(shared.cone4, coat, g, s * 0.1, 0.71, 0.05, 0.06, 0.13, 0.05);
      ear.rotation.z = -s * 0.28;
      mesh(shared.cone4, dark, g, s * 0.12, 0.8, 0.05, 0.012, 0.05, 0.012);
      mesh(shared.sph, light, g, s * 0.07, 0.08, 0.16, 0.06, 0.05, 0.08);
      mesh(shared.sph, dark, g, s * 0.06, 0.58, 0.21, 0.018, 0.022, 0.012);
    }
    const tail = new THREE.Group();
    tail.position.set(-0.22, 0.14, -0.1);
    tail.rotation.z = 1.05;
    tail.rotation.y = 0.5;
    mesh(shared.sph, coat, tail, 0, 0.2, 0, 0.08, 0.26, 0.08);
    mesh(shared.sph, dark, tail, 0, 0.38, 0, 0.06, 0.1, 0.06);
    g.add(tail);
    parent.add(g);
    return g;
  }
  function queen(parent: THREE.Object3D, expected: boolean): THREE.Group {
    const g = new THREE.Group();
    const extra = expected ? { opacity: 0.6, transparent: true } : {};
    mesh(shared.cyl, mat("pot", extra), g, 0, 0.08, 0, 0.13, 0.16, 0.13);
    mesh(shared.cyl, mat("pot", extra), g, 0, 0.17, 0, 0.15, 0.03, 0.15);
    mesh(shared.sph, mat("porcelain", extra), g, 0, 0.27, 0, 0.08, 0.1, 0.075);
    mesh(shared.sph, mat("porcelain", extra), g, 0, 0.4, 0, 0.07, 0.065, 0.065);
    for (const s of [-1, 1]) { const e = mesh(shared.cone4, mat("porcelain", extra), g, s * 0.04, 0.47, 0, 0.022, 0.05, 0.02); e.rotation.z = -s * 0.3; }
    const bloom = mat("bloom", extra);
    for (const [x, y, zz] of [[-0.05, 0.47, 0.02], [0, 0.49, -0.03], [0.05, 0.47, 0.02], [0.02, 0.45, 0.05], [-0.03, 0.44, -0.04]] as const) mesh(shared.ico, bloom, g, x, y, zz, 0.026);
    parent.add(g);
    return g;
  }
  function flag(parent: THREE.Object3D, key: Key, h = 0.62, done = false): THREE.Group {
    const g = new THREE.Group();
    mesh(shared.cyl6, mat("woodDark"), g, 0, h / 2, 0, 0.014, h, 0.014);
    const f = mesh(shared.cone4, mat(key, done ? { opacity: 0.55, transparent: true } : {}), g, 0.1, h - 0.09, 0, 0.09, 0.2, 0.02);
    f.rotation.z = -Math.PI / 2;
    parent.add(g);
    return g;
  }
  function gate(parent: THREE.Object3D, state: "closed" | "open" | "ahead", scale = 1, group?: string): THREE.Group {
    const g = new THREE.Group();
    const wood = group ? fmat(state === "ahead" ? "stonePast" : "wood", group) : mat(state === "ahead" ? "stonePast" : "wood");
    for (const zz of [-0.62, 0.62]) mesh(shared.box, wood, g, 0, 0.5, zz, 0.1, 1, 0.1);
    mesh(shared.box, wood, g, 0, 1.02, 0, 0.16, 0.1, 1.46);
    mesh(shared.box, wood, g, 0, 0.9, 0, 0.06, 0.05, 1.28);
    const lampSpec = { emissiveIntensity: state === "open" ? 0.85 : 0.12 };
    mesh(shared.ico, group ? fmat("glow", group, lampSpec) : mat("glow", lampSpec), g, 0, 0.8, 0, 0.07);
    if (state === "closed") { const f = flag(g, "today", 0.5); f.position.set(0, 1.05, 0.55); }
    g.scale.setScalar(scale);
    parent.add(g);
    return g;
  }
  function kittyBank(parent: THREE.Object3D, bank: { fill: number | null; full: boolean; bought: boolean }, scale: number, group?: string): THREE.Group {
    const g = new THREE.Group();
    const m = (key: Key, extra: THREE.MeshStandardMaterialParameters = {}) => (group ? fmat(key, group, extra) : mat(key, extra));
    mesh(shared.cyl, m("woodDark"), g, 0, 0.05, 0, 0.42, 0.1, 0.42);
    const glass = mesh(shared.cyl, m("glass", { opacity: 0.45, depthWrite: false }), g, 0, 0.55, 0, 0.36, 0.9, 0.36);
    glass.castShadow = false;
    glass.userData.fadeBase = 0.45;
    const fill = mesh(shared.cyl, m(bank.bought ? "today" : "gold", { metalness: 0.25, roughness: 0.5 }), g, 0, 0.1, 0, 0.31, 1, 0.31);
    fill.userData.fill = bank.fill === null ? null : Math.max(0.04, bank.fill);
    mesh(shared.cyl, m("wood"), g, 0, 1.03, 0, 0.39, 0.08, 0.39);
    for (const s of [-1, 1]) { const e = mesh(shared.cone4, m("wood"), g, s * 0.2, 1.17, 0, 0.1, 0.22, 0.08); e.rotation.z = -s * 0.22; }
    if (bank.full) mesh(shared.ico, m("glow", { emissiveIntensity: 0.6 }), g, 0, 1.36, 0, 0.09);
    g.scale.setScalar(scale);
    parent.add(g);
    bankFills.push(fill);
    return g;
  }
  function tree(parent: THREE.Object3D, key: Key, x: number, zz: number, s: number, group?: string, mute = 0): THREE.Group {
    const g = new THREE.Group();
    const m = (k: Key) => (group ? fmat(k, group, mute ? { mute } : {}) : mat(k, mute ? { mute } : {}));
    mesh(shared.cyl6, m("trunk"), g, 0, 0.2, 0, 0.07, 0.4, 0.07);
    mesh(shared.cone, m(key), g, 0, 0.85, 0, 0.42, 1.1, 0.42);
    mesh(shared.cone, m(key), g, 0, 1.35, 0, 0.3, 0.8, 0.3);
    g.position.set(x, 0, zz);
    g.scale.setScalar(s);
    parent.add(g);
    return g;
  }
  function home(parent: THREE.Object3D, kind: PathEraHome, s: number, mute = 0): THREE.Group {
    const g = new THREE.Group();
    const wall = mat("wall", { mute }), roof = mat("roof", { mute }), wood = mat("wood", { mute });
    if (kind === "flat" || kind === "furnished") {
      mesh(shared.box, wall, g, 0, 0.9, 0, 1.3, 1.8, 1);
      mesh(shared.box, roof, g, 0, 1.86, 0, 1.4, 0.12, 1.1);
      for (const y of [0.55, 1.15, 1.55]) for (const x of [-0.3, 0.3]) mesh(shared.box, mat(kind === "furnished" ? "glow" : "stonePast", { mute }), g, x, y, 0.51, 0.22, 0.2, 0.02);
    } else if (kind === "boat") {
      mesh(shared.box, wood, g, 0, 0.25, 0, 1.8, 0.4, 0.7);
      mesh(shared.box, wall, g, -0.2, 0.7, 0, 0.8, 0.5, 0.55);
      mesh(shared.cyl6, wood, g, 0.4, 1.2, 0, 0.03, 1.6, 0.03);
    } else {
      mesh(shared.box, kind === "cabin" ? wood : wall, g, 0, 0.5, 0, 1.4, 1, 1.1);
      const r = mesh(shared.cone4, roof, g, 0, 1.35, 0, 1.15, 0.75, 0.95);
      r.rotation.y = Math.PI / 4;
      mesh(shared.box, mat("woodDark", { mute }), g, 0, 0.3, 0.56, 0.26, 0.55, 0.02);
      mesh(shared.box, mat("glow", { mute }), g, 0.4, 0.62, 0.56, 0.26, 0.22, 0.02);
      if (kind === "porch") { mesh(shared.box, wood, g, 0, 0.06, 0.85, 1.5, 0.08, 0.6); for (const x of [-0.65, 0.65]) mesh(shared.box, wood, g, x, 0.45, 1.1, 0.06, 0.8, 0.06); }
    }
    g.scale.setScalar(s);
    parent.add(g);
    return g;
  }
  function tent(parent: THREE.Object3D, s: number): THREE.Group {
    const g = new THREE.Group();
    const t = mesh(shared.cone, mat("tent"), g, 0, 0.6, 0, 0.85, 1.2, 0.85);
    t.rotation.y = 0.3;
    mesh(shared.cone, mat("tentStripe"), g, 0, 1.0, 0, 0.36, 0.45, 0.36);
    mesh(shared.cyl6, mat("woodDark"), g, 0, 1.35, 0, 0.02, 0.4, 0.02);
    const f = flag(g, "queen", 0.3);
    f.position.set(0, 1.35, 0);
    g.scale.setScalar(s);
    parent.add(g);
    return g;
  }
  function cloud(parent: THREE.Object3D, x: number, y: number, zz: number, s: number, opacity: number): THREE.Group {
    const g = new THREE.Group();
    const m = fmat("cloud", "far", { opacity, depthWrite: false });
    m.userData.baseOpacity = opacity;
    for (const [dx, dy, dz, r] of [[0, 0, 0, 1], [0.9, -0.2, 0.2, 0.75], [-0.9, -0.15, -0.1, 0.8], [0.3, 0.35, -0.3, 0.7]] as const) {
      const c = mesh(shared.ico, m, g, dx, dy, dz, r);
      c.castShadow = false;
    }
    g.position.set(x, y, zz);
    g.scale.setScalar(s);
    parent.add(g);
    return g;
  }

  // ---------------------------------------------------------------- build: the month path
  let bankFills: THREE.Mesh[] = [];
  let input: MiniSceneInput | null = null;
  let pathKey = "";
  let hercPos: THREE.Object3D | null = null;
  let weekStarts: { id: string; s: number }[] = [];
  function clearPath() {
    for (const d of pathDisposables.splice(0)) d();
    for (const f of faders.values()) { f.objs = f.objs.filter((o) => !isIn(o, path)); }
    for (let i = pickables.length - 1; i >= 0; i--) if (isIn(pickables[i]!, path)) pickables.splice(i, 1);
    for (const id of [...anchors.keys()]) if (/^(day|base|today|gate|lane|week|chapter):?/.test(id)) anchors.delete(id);
    path.removeFromParent();
    path = new THREE.Group();
    root.add(path);
    ribbons = []; placed = []; beadSets = []; hercPos = null; weekStarts = [];
  }
  function isIn(o: THREE.Object3D, parent: THREE.Object3D): boolean { for (let q: THREE.Object3D | null = o; q; q = q.parent) if (q === parent) return true; return false; }

  function buildPath(inp: MiniSceneInput) {
    clearPath();
    dim = inp.days.length || 30;
    anchor = clamp(inp.anchorDay, 1, dim);
    R = dim * SP / (2 * Math.PI);
    const s0 = sOf(0.5), s1 = sOf(dim + 0.5);
    // Ground strip (near), Everyday water, the lanes' channel and the three lanes.
    const ground = fmat("ground", "near");
    ribbon(-4.4, 0, -0.03, ground, s0 - 30, s1 + 30, 90);
    ribbon(0, Math.min(6.8, R - 0.8), -0.03, ground, s0 - 30, s1 + 30, 90);
    ribbon(-WATER - 0.12, WATER + 0.12, -0.02, mat("stonePast"), s0, s1);
    ribbon(-WATER, WATER, -0.005, mat("water", { roughness: 0.3, metalness: 0.05 }), s0, s1);
    ribbon(-2.48, -0.96, 0.0, fmat("channel", "near"), s0, s1);
    for (const lane of ["prepare", "protect", "build"] as const) {
      const w = LANE_W[lane];
      ribbon(w - 0.1, w + 0.1, 0.03, fmat(lane, "near", { roughness: 0.5 }), s0, s1);
    }
    // Stones.
    for (const d of inp.days) {
      const big = d.bills.length > 0 || d.contributions.length > 0 || d.today;
      const r = big ? 0.36 : 0.24;
      const stone = new THREE.Group();
      const top = mesh(shared.stone, mat(d.past && !d.today ? "stonePast" : "stone"), stone, 0, 0.06, 0, r, 0.12, r);
      top.userData.pickId = `day:${d.date}`;
      place(stone, sOf(d.day), 0, 0, `day:${d.date}`);
      stone.userData.spin = (d.day * 1.7) % 1;
      const lift = 0.12;
      if (d.contributions.length) {
        const expected = d.contributions.every((c) => c.expected);
        const q = queen(stone, expected);
        q.position.set(0, lift, 0);
        q.scale.setScalar(1.45);
        q.rotation.y = -((d.day * 1.7) % 1);
        const ring = mesh(shared.torus, mat("queen", expected ? { opacity: 0.55, transparent: true } : {}), stone, 0, 0.08, 0, r + 0.04, r + 0.04, 1.2);
        ring.rotation.x = Math.PI / 2;
      }
      d.tasks.forEach((t, i) => {
        const f = flag(stone, t.who === "a" ? "flagA" : t.who === "b" ? "flagB" : "flagBoth", 0.62 + i * 0.08, t.done);
        f.position.set(r * 0.55 - i * 0.1, lift - 0.02, -r * 0.45);
        f.rotation.y = -((d.day * 1.7) % 1);
      });
      if (d.today) {
        const h = hercules(stone);
        h.position.set(d.contributions.length ? -0.2 : 0, lift - 0.01, d.contributions.length ? 0.12 : 0);
        h.rotation.y = -((d.day * 1.7) % 1);
        h.scale.setScalar(d.contributions.length ? 0.72 : 0.92);
        const ring = mesh(shared.torus, mat("today"), stone, 0, 0.1, 0, r + 0.1, r + 0.1, 1.6);
        ring.rotation.x = Math.PI / 2;
        hercPos = stone;
        anchors.set("today", { at: () => worldOf(stone, 0, 1.05, 0) });
      }
      anchors.set(`day:${d.date}`, { at: () => worldOf(stone, 0, d.contributions.length ? 0.95 : d.tasks.length ? 0.78 : 0.3, 0) });
      anchors.set(`base:${d.date}`, { at: () => worldOf(path, ...local(sOf(d.day), -0.52, 0)) });
    }
    // Bills drop dotted lines into their lane; contributions branch only into their confirmed division.
    const billBeads: Bead[] = [];
    const streams: Record<"prepare" | "protect" | "build", Bead[]> = { prepare: [], protect: [], build: [] };
    for (const d of inp.days) {
      d.bills.forEach((lane, i) => {
        const s = sOf(d.day) + (i - (d.bills.length - 1) / 2) * 0.12;
        for (let u = 0.3; u < 0.99; u += 0.1) billBeads.push({ s, w: lerp(-0.2, LANE_W[lane], u), y: 0.05 });
      });
      if (d.contributions.length) {
        (["prepare", "protect", "build"] as const).forEach((lane, i) => {
          if (!d.contributions.some((row) => (row.split?.[lane] ?? 0) > 0)) return;
          const ds = SP * (0.55 + 0.32 * i);
          for (let u = 0.1; u <= 1.001; u += 0.06) {
            const e = u * u * (3 - 2 * u);
            streams[lane].push({ s: sOf(d.day) + ds * e, w: lerp(-0.2, LANE_W[lane], Math.sqrt(u)), y: 0.07 + 0.14 * Math.sin(Math.PI * u) });
          }
        });
      }
    }
    beads("bill", billBeads, 0.03);
    for (const lane of ["prepare", "protect", "build"] as const) beads(lane, streams[lane], 0.038);
    // Week posts and the Sitdown gate at the month's end.
    weekStarts = [];
    for (const d of inp.days) {
      if (d.day === 1 || new Date(`${d.date}T12:00:00Z`).getUTCDay() === 0) {
        weekStarts.push({ id: d.date, s: sOf(d.day) });
        if (d.day > 1) {
          const post = new THREE.Group();
          mesh(shared.box, fmat("woodDark", "near"), post, 0, 0.18, 0, 0.07, 0.36, 0.07);
          place(post, sOf(d.day - 0.5), -2.72, 0);
          fade("near", post);
        }
      }
    }
    if (inp.startGate) {
      const start = gate(path, inp.startGate, 0.8);
      place(start, sOf(0.5), 0, 0);
      fade("near", start);
    }
    const g = gate(path, inp.gate);
    place(g, sOf(dim + 0.5), 0, 0, "gate");
    g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.userData.pickId = "gate"; });
    anchors.set("gate", { at: () => worldOf(g, 0, 1.25, 0) });
    anchors.set("chapter", { at: () => worldOf(path, 0, 0.6, 0) });
    // Scenery on the strip: trees and tufts behind the water, pebbles by the lanes.
    let seed = hash(inp.monthKey);
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 70; i++) {
      const s = lerp(s0 - 4, s1 + 4, rnd());
      const w = 1.4 + rnd() * Math.min(4.6, R - 2.6);
      const t = tree(path, (["tree1", "tree2", "tree3"] as const)[Math.floor(rnd() * 3)]!, 0, 0, 0.5 + rnd() * 0.6, "trees");
      place(t, s, w, 0);
      fade("trees", t);
    }
    for (let i = 0; i < 90; i++) {
      const s = lerp(s0 - 2, s1 + 2, rnd());
      const w = rnd() < 0.6 ? 0.95 + rnd() * 0.4 : -2.8 - rnd() * 1.3;
      const tuft = new THREE.Group();
      const c = mesh(shared.cone, fmat(rnd() < 0.2 ? "flower" : "tuft", "near"), tuft, 0, 0.09, 0, 0.05 + rnd() * 0.04, 0.18 + rnd() * 0.1, 0.05);
      c.castShadow = false;
      place(tuft, s, w, 0);
      fade("near", tuft);
    }
    for (let i = 0; i < 26; i++) {
      const pebble = new THREE.Group();
      mesh(shared.dodeca, fmat("stonePast", "near"), pebble, 0, 0.03, 0, 0.05 + rnd() * 0.05, 0.04, 0.06);
      place(pebble, lerp(s0, s1, rnd()), -0.85 - rnd() * 0.05, 0);
      fade("near", pebble);
    }
    for (const lane of ["everyday", "prepare", "protect", "build"] as const) {
      anchors.set(`lane:${lane}`, { at: () => worldOf(path, ...laneLabelLocal(lane)) });
    }
    for (const w of weekStarts) {
      const end = weekStarts[weekStarts.indexOf(w) + 1]?.s ?? sOf(dim + 1);
      const mid = (w.s + end) / 2 - SP / 2;
      anchors.set(`week:${w.id}`, { at: () => worldOf(path, ...local(mid, -2.8, 0)) });
    }
    lastK = -1;
  }
  const L = new THREE.Vector3();
  function local(s: number, w: number, y: number): [number, number, number] { mp(s, w, y, L); return [L.x, L.y, L.z]; }
  function laneLabelLocal(lane: "everyday" | "prepare" | "protect" | "build"): [number, number, number] {
    // The left edge of what the camera sees along the path (the page keeps the label clear of its rail).
    const halfW = camDist * tanHalf * aspect() / Math.max(0.05, path.scale.x);
    const s = clamp(sOf(day) - halfW * 0.98, sOf(0.6), sOf(dim + 0.4));
    return local(s, lane === "everyday" ? -0.45 : LANE_W[lane], 0.04);
  }
  const W = new THREE.Vector3();
  function worldOf(o: THREE.Object3D, x: number, y: number, zz: number): THREE.Vector3 {
    o.updateWorldMatrix(true, false);
    return W.set(x, y, zz).applyMatrix4(o.matrixWorld);
  }
  function hash(text: string): number { let h = 7; for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 2147483647; return h || 7; }

  // ---------------------------------------------------------------- build: the era island (laps, banks) and the journey
  let island = new THREE.Group();
  let journey = new THREE.Group();
  scene.add(journey);
  root.add(island);
  let islandKey = "", journeyKey = "";
  let islandDisposables: (() => void)[] = [];
  let lapR = 7;
  let rowCenter = new THREE.Vector3();
  let pin: THREE.Group | null = null;
  const eraSpots = new Map<string, { x: number; y: number; z: number; r: number }>();
  function dropGroup(group: THREE.Group) {
    for (const f of faders.values()) f.objs = f.objs.filter((o) => !isIn(o, group));
    for (let i = pickables.length - 1; i >= 0; i--) if (isIn(pickables[i]!, group)) pickables.splice(i, 1);
    group.removeFromParent();
  }
  let journeyDisposables: (() => void)[] = [];
  function ringGeo(r0: number, r1: number, seg = 64, list = islandDisposables) { const g = new THREE.RingGeometry(r0, r1, seg); g.rotateX(-Math.PI / 2); list.push(() => g.dispose()); return g; }

  function buildIsland(inp: MiniSceneInput) {
    for (const d of islandDisposables.splice(0)) d();
    dropGroup(island);
    for (const id of [...anchors.keys()]) if (/^(bank|finish|lap):/.test(id) || id === "finish") anchors.delete(id);
    bankFills = [];
    island = new THREE.Group();
    root.add(island);
    const era = inp.eras[inp.eraIndex];
    // Ground: the island's top, side and underside.
    mesh(shared.cyl, mat("ground"), island, 0, -0.33, 0, ISLAND_R, 0.6, ISLAND_R).castShadow = false;
    const side = mesh(shared.cyl, mat("groundSide"), island, 0, -0.9, 0, ISLAND_R * 0.99, 0.6, ISLAND_R * 0.99);
    side.castShadow = false;
    const under = mesh(shared.cone, mat("earth"), island, 0, -1.2 - ISLAND_R * 0.32, 0, ISLAND_R * 0.97, ISLAND_R * 0.62, ISLAND_R * 0.97);
    under.rotation.x = Math.PI;
    for (let i = 0; i < 9; i++) { const a = i * 0.7; mesh(shared.dodeca, mat("stoneEdge"), island, Math.cos(a) * ISLAND_R * 0.55, -3 - i * 0.5, Math.sin(a) * ISLAND_R * 0.4, 1.1 + (i % 3) * 0.3); }
    if (era) { island.userData.pickId = `era:${era.id}`; pickables.push(island); }
    // Laps: every other Chapter of this era as a ring of stones, joined by gates on one spoke.
    const laps = inp.laps.length || 1;
    lapR = miniLapRadius(inp.lap, laps);
    const phiGate = Math.PI / 2 - (dim + 0.5 - anchor) * 2 * Math.PI / dim;
    const lapStone = new THREE.CylinderGeometry(0.12, 0.13, 0.05, 6);
    islandDisposables.push(() => lapStone.dispose());
    const stonePast = new THREE.InstancedMesh(lapStone, fmat("stonePast", "laps"), laps * 31);
    const stoneAhead = new THREE.InstancedMesh(lapStone, fmat("stone", "laps", { opacity: 0.7 }), laps * 31);
    let ip = 0, ia = 0;
    inp.laps.forEach((lap, j) => {
      if (j === inp.lap) return;
      const r = miniLapRadius(j, laps);
      const ahead = lap.status === "ahead";
      const band = new THREE.Mesh(ringGeo(r - 0.16, r + 0.16), fmat("water", "laps", { opacity: ahead ? 0.55 : 1, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 }));
      band.position.y = 0.005;
      band.receiveShadow = true;
      band.userData.pickId = `lap:${lap.key}`;
      pickables.push(band);
      island.add(band);
      fade("laps", band);
      for (let d = 1; d <= 30; d += 1) {
        if (d % 2 && laps > 18) continue;
        const p = Math.PI / 2 - (d - anchor) * 2 * Math.PI / 30;
        dummy.position.set(r * Math.cos(p), 0.03, r * Math.sin(p));
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(Math.min(1, 0.4 + r * 0.06));
        dummy.updateMatrix();
        if (ahead) stoneAhead.setMatrixAt(ia++, dummy.matrix); else stonePast.setMatrixAt(ip++, dummy.matrix);
      }
      const gg = gate(island, lap.status === "closed" ? "closed" : lap.status === "ahead" ? "ahead" : "open", 0.42, "laps");
      gg.position.set(r * Math.cos(phiGate), 0, r * Math.sin(phiGate));
      gg.rotation.y = Math.PI / 2 - phiGate;
      fade("laps", gg);
      anchors.set(`lap:${lap.key}`, { at: () => worldOf(island, r * Math.cos(Math.PI / 2 + 0.35), 0.2, r * Math.sin(Math.PI / 2 + 0.35)) });
    });
    stonePast.count = ip; stoneAhead.count = ia;
    for (const im of [stonePast, stoneAhead]) { im.frustumCulled = false; im.receiveShadow = true; island.add(im); fade("laps", im); islandDisposables.push(() => im.dispose()); }
    // The gate spoke (a boardwalk from the centre out through every gate).
    const spokeLen = LAP_OUT - LAP_IN + 1.2;
    const spoke = mesh(shared.box, fmat("wood", "laps", { opacity: 0.85 }), island, Math.cos(phiGate) * (LAP_IN + spokeLen / 2 - 0.6), 0.02, Math.sin(phiGate) * (LAP_IN + spokeLen / 2 - 0.6), spokeLen, 0.03, 0.3);
    spoke.rotation.y = -phiGate;
    fade("laps", spoke);
    // The Plan Studio tent in the middle, and trees round the rim.
    const t = tent(island, 1.4);
    fade("laps", t);
    let seed = hash(era?.id ?? "era");
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const bankArc = { from: 0.42, to: 1.36 };
    for (let i = 0; i < 64; i++) {
      const a = rnd() * Math.PI * 2;
      if (a > bankArc.from - 0.1 && a < bankArc.to + 0.1) continue;
      if (Math.abs(Math.atan2(Math.sin(a - phiGate), Math.cos(a - phiGate))) < 0.12) continue;
      const r = ISLAND_R - 1.6 + rnd() * 1.2;
      fade("laps", tree(island, (["tree1", "tree2", "tree3"] as const)[Math.floor(rnd() * 3)]!, Math.cos(a) * r, Math.sin(a) * r, 0.7 + rnd() * 0.7, "laps"));
    }
    // The finish line: this era's Kitty Banks, filling.
    const banks = inp.banks;
    banks.forEach((bank, i) => {
      const a = banks.length > 1 ? lerp(bankArc.from, bankArc.to, i / (banks.length - 1)) : (bankArc.from + bankArc.to) / 2;
      const r = ISLAND_R - 1.7;
      const b = kittyBank(island, bank, 1.05, "laps");
      b.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      b.userData.pickId = `bank:${bank.id}`;
      pickables.push(b);
      fade("laps", b);
      anchors.set(`bank:${bank.id}`, { at: () => worldOf(b, 0, 1.6, 0) });
    });
    if (banks.length) {
      const a = (bankArc.from + bankArc.to) / 2;
      const r = ISLAND_R - 0.4;
      const banner = new THREE.Group();
      banner.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      banner.rotation.y = -0.35;
      for (const x of [-1.4, 1.4]) mesh(shared.cyl6, fmat("woodDark", "laps"), banner, x, 1, 0, 0.06, 2, 0.06);
      const cloth = mesh(shared.box, fmat("queen", "laps"), banner, 0, 1.75, 0, 2.8, 0.42, 0.04);
      cloth.userData.pickId = "finish";
      pickables.push(cloth);
      island.add(banner);
      fade("laps", banner);
      anchors.set("finish", { at: () => worldOf(banner, 0, 2.3, 0) });
    }
    // Today's pin, visible from afar.
    pin = new THREE.Group();
    mesh(shared.cone, fmat("today", "pin"), pin, 0, 0.55, 0, 0.36, 1.1, 0.36).rotation.x = Math.PI;
    mesh(shared.sph, fmat("today", "pin"), pin, 0, 1.3, 0, 0.42);
    scene.add(pin);
    fade("pin", pin);
    islandDisposables.push(() => { pin?.removeFromParent(); dropGroup(pin!); });
    anchors.set("here", { at: () => pinTop() });
  }
  const PT = new THREE.Vector3();
  function pinTop(): THREE.Vector3 { if (!pin) return PT.set(0, 0, 0); pin.updateWorldMatrix(true, false); return PT.set(0, 1.9, 0).applyMatrix4(pin.matrixWorld); }

  function buildJourney(inp: MiniSceneInput) {
    for (const d of journeyDisposables.splice(0)) d();
    dropGroup(journey);
    for (const id of [...anchors.keys()]) if (id.startsWith("era:")) anchors.delete(id);
    eraSpots.clear();
    journey = new THREE.Group();
    scene.add(journey);
    const f = Math.max(0, inp.eraIndex);
    const spots = inp.eras.map((era, i) => {
      const k = i - f;
      const r = i === f ? ISLAND_R : era.state === "crossed" ? 10 : era.state === "current" ? 12.5 : 11;
      return { era, x: k * ERA_GAP + Math.sign(k) * (r - 11), y: i === f ? 0 : (i % 2 ? 2.5 : -1.5), z: -Math.abs(k) * 4 + (k > 0 ? -k * 6 : 0), r };
    });
    spots.forEach((s) => eraSpots.set(s.era.id, s));
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    spots.forEach(({ era, x, y, z: zz, r }, i) => {
      const future = era.state === "future" || era.state === "sketched";
      const mute = future ? 0.45 : era.state === "crossed" ? 0.15 : 0;
      if (i !== f) {
        const g = new THREE.Group();
        g.position.set(x, y, zz);
        g.userData.pickId = `era:${era.id}`;
        pickables.push(g);
        journey.add(g);
        mesh(shared.cyl, mat("ground", { mute }), g, 0, -0.3, 0, r, 0.6, r);
        mesh(shared.cyl, mat("groundSide", { mute }), g, 0, -0.8, 0, r * 0.99, 0.5, r * 0.99);
        const under = mesh(shared.cone, mat("earth", { mute }), g, 0, -1 - r * 0.32, 0, r * 0.95, r * 0.62, r * 0.95);
        under.rotation.x = Math.PI;
        for (let t = 0; t < 14; t++) {
          const a = rnd() * Math.PI * 2, rr = r * (0.55 + rnd() * 0.38);
          tree(g, (["tree1", "tree2", "tree3"] as const)[t % 3]!, Math.cos(a) * rr, Math.sin(a) * rr, 1 + rnd() * 0.8, undefined, mute);
        }
        home(g, era.home, 2, mute).position.set(-1.5, 0, -1.2);
        // Faint laps, as the era island will hold them.
        const laps = Math.min(12, Math.max(3, era.laps / 3));
        for (let j = 0; j < laps; j++) {
          const rr = 1.8 + j * (r * 0.5 / laps);
          const band = new THREE.Mesh(ringGeo(rr - 0.08, rr + 0.08, 40, journeyDisposables), mat(future ? "stone" : "stonePast", { mute, side: THREE.DoubleSide }));
          band.position.set(2, 0.01, 1.2);
          band.scale.setScalar(0.55);
          g.add(band);
        }
        era.plans.slice(0, 6).forEach((plan, p) => {
          const a = -0.4 + p * 0.55, rr = r * 0.62;
          const px = Math.cos(a) * rr, pz = Math.sin(a) * rr;
          if (plan.kind === "bank") { const b = kittyBank(g, { fill: plan.fill, full: (plan.fill ?? 0) >= 1, bought: false }, 1.5); b.position.set(px, 0, pz); }
          else if (plan.kind === "milestone") { const fl = flag(g, "queen", 1.8); fl.position.set(px, 0, pz); }
          else if (plan.kind === "trip") { const tt = tent(g, 0.9); tt.position.set(px, 0, pz); }
          else if (plan.kind === "chapter") { const c = mesh(shared.cone, mat("glow", { mute }), g, px, 0.3, pz, 0.3, 0.6, 0.3); c.castShadow = false; }
          else { mesh(shared.box, mat("wood", { mute }), g, px, 0.5, pz, 0.08, 1, 0.08); mesh(shared.box, mat("wood", { mute }), g, px, 0.9, pz, 0.8, 0.3, 0.06); }
        });
        if (era.state === "crossed") { const fl = flag(g, "today", 3.2); fl.position.set(r * 0.5, 0, r * 0.3); }
      }
      if (future) {
        for (let c = 0; c < 9; c++) {
          const a = rnd() * Math.PI * 2, rr = r * (0.3 + rnd() * 0.85);
          cloud(journey, x + Math.cos(a) * rr, y + 2 + rnd() * 5, zz + Math.sin(a) * rr, 2.2 + rnd() * 2.2, era.state === "sketched" ? 0.9 : 0.78);
        }
      }
      if (era.state === "current") {
        const halo = mesh(shared.halo, fmat("glow", "glow", { emissiveIntensity: 0.35 }), journey, x, 0.05, zz, r + 0.9, r + 0.9, 3);
        halo.rotation.x = Math.PI / 2;
        halo.castShadow = false;
        fade("glow", halo);
      }
      anchors.set(`era:${era.id}`, { at: () => V2.set(x, y + (i === f ? 4.5 : r * 0.35 + 3.4), zz) });
    });
    // Rope bridges between neighbours.
    for (let i = 0; i + 1 < spots.length; i++) {
      const a = spots[i]!, b = spots[i + 1]!;
      const start = new THREE.Vector3(a.x, a.y, a.z), end = new THREE.Vector3(b.x, b.y, b.z);
      const dir = end.clone().sub(start);
      const len = dir.length();
      dir.normalize();
      const from = start.clone().addScaledVector(dir, a.r - 0.6), to = end.clone().addScaledVector(dir, -(b.r - 0.6));
      const span = from.distanceTo(to);
      const n = Math.max(4, Math.round(span / 0.95));
      const future = b.era.state === "future" || b.era.state === "sketched";
      const plankMat = mat("wood", { mute: future ? 0.35 : 0 });
      const yaw = Math.atan2(dir.x, dir.z);
      for (let p = 0; p < n; p++) {
        const t = (p + 0.5) / n;
        const pos = from.clone().lerp(to, t);
        pos.y += -Math.sin(Math.PI * t) * Math.min(2.2, len * 0.05) - 0.05;
        const plank = mesh(shared.box, plankMat, journey, pos.x, pos.y, pos.z, 1.7, 0.12, span / n * 0.78);
        plank.rotation.y = yaw;
      }
    }
    // Where the row sits, for the Journey camera.
    const xs = spots.map((s) => s.x), zs = spots.map((s) => s.z);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    rowCenter = new THREE.Vector3((minX + maxX) / 2, 0, (Math.min(...zs) + Math.max(...zs)) / 2);
  }
  const V2 = new THREE.Vector3();

  // ---------------------------------------------------------------- theme
  function applyTheme() {
    for (const { m, key, mute } of mats) tint(m, key, mute);
    renderer.setClearColor(palette.bg);
    invalidate();
  }

  // ---------------------------------------------------------------- camera: one continuous pull-back
  let width = 0, height = 0, viewInset = 0;
  const KA = { t: new THREE.Vector3(), d: 1, p: 1, y: 0 };
  const KB = { t: new THREE.Vector3(), d: 1, p: 1, y: 0 };
  const FOV = 36;
  const wide = () => width >= 640;
  const aspect = () => (width && height ? width / height : 1);
  const tanHalf = Math.tan(FOV / 2 * Math.PI / 180);
  const fitW = (w: number) => w / 2 / (tanHalf * aspect());
  const fit = (w: number, h: number, p: number) => Math.max(fitW(w), h * Math.sin(p) * 1.22 / 2 / tanHalf) * 1.04;
  function viewSpan() { return compact ? 5 : wide() ? (width >= 1000 ? 11 : 9) : 5.6; }
  function keyframe(i: number, out: typeof KA) {
    out.y = 0;
    if (i === 0) {
      mp(sOf(day), compact ? -1.2 : -0.95, 0, out.t);
      out.d = fitW(viewSpan()); out.p = compact ? 0.78 : 0.62;
    } else if (i === 1) {
      mp(sOf(day), compact ? -1.4 : -1.25, 0, out.t);
      out.d = fitW(compact ? 9 : wide() ? (width >= 1000 ? 18 : 15) : 10.5); out.p = compact ? 0.86 : 0.7;
    } else if (i === 2) {
      out.t.set(0, 0, 0.9);
      const across = 2 * (R + 2.6) + 1.5;
      out.d = fit(across, across, 1.0) * 1.14; out.p = 1.0;
    } else if (i === 3) {
      out.t.set(0, -1, 1.2);
      out.d = fit(2 * ISLAND_R + 3, 2 * ISLAND_R + 3, 0.92); out.p = 0.92;
    } else {
      const f = journeyFrame();
      out.t.copy(f.t); out.y = f.yaw; out.d = f.d; out.p = f.p;
    }
    return out;
  }
  // The Journey framing: every island inside the view, found by trying distances with a probe camera (cached per size).
  const probeCam = new THREE.PerspectiveCamera(36, 1, 0.1, 4000);
  let journeyFit: { key: string; t: THREE.Vector3; d: number; p: number; yaw: number } | null = null;
  function journeyFrame() {
    const key = `${width}x${height}|${viewInset}|${journeyKey}`;
    if (journeyFit?.key === key) return journeyFit;
    const p = wide() ? 0.52 : 0.66;
    const yaw = wide() ? -0.28 : -0.82;
    const spots = [...eraSpots.values()];
    const pts: THREE.Vector3[] = [];
    for (const s of spots) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) pts.push(new THREE.Vector3(s.x + dx * s.r * 0.95, s.y + (dz ? -s.r * 0.35 : 3), s.z + dz * s.r * 0.95));
    const t = rowCenter.clone();
    t.y = -1;
    probeCam.aspect = aspect();
    if (viewInset > 0) probeCam.setViewOffset(width, height, -viewInset / 2, 0, width, height); else probeCam.clearViewOffset();
    const bounds = (d: number) => {
      probeCam.position.set(t.x + Math.sin(yaw) * Math.cos(p) * d, t.y + Math.sin(p) * d, t.z + Math.cos(yaw) * Math.cos(p) * d);
      probeCam.lookAt(t);
      probeCam.near = 0.1; probeCam.far = d * 10 + 500;
      probeCam.updateProjectionMatrix();
      probeCam.updateMatrixWorld();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const v of pts) { P2.copy(v).project(probeCam); x0 = Math.min(x0, P2.x); x1 = Math.max(x1, P2.x); y0 = Math.min(y0, P2.y); y1 = Math.max(y1, P2.y); }
      return { x0, x1, y0, y1 };
    };
    let d = 60;
    for (let pass = 0; pass < 2; pass++) {
      let lo = 20, hi = 1500;
      for (let i = 0; i < 22; i++) { const mid = (lo + hi) / 2; const b = bounds(mid); if (b.x0 < -0.9 || b.x1 > 0.9 || b.y0 < -0.78 || b.y1 > 0.72) lo = mid; else hi = mid; }
      d = hi;
      // Recentre on what is actually drawn, then fit again.
      const b = bounds(d);
      const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2 + 0.03;
      const right = new THREE.Vector3().setFromMatrixColumn(probeCam.matrixWorld, 0);
      const up = new THREE.Vector3(0, 1, 0).cross(right).normalize().negate();
      const halfH = Math.tan(18 * Math.PI / 180) * d;
      t.addScaledVector(right, cx * halfH * aspect()).addScaledVector(up, cy * halfH / Math.sin(p));
    }
    journeyFit = { key, t, d, p, yaw };
    return journeyFit;
  }
  const P2 = new THREE.Vector3();
  let camDist = 10;
  function updateCamera() {
    const i = Math.min(3, Math.floor(z)), f = z - i, e = f * f * (3 - 2 * f);
    keyframe(i, KA); keyframe(i + 1, KB);
    const t = KA.t.lerp(KB.t, e);
    const d = Math.exp(lerp(Math.log(KA.d), Math.log(KB.d), e));
    const p = lerp(KA.p, KB.p, e);
    const yw = lerp(KA.y, KB.y, e);
    camDist = d;
    camera.position.set(t.x + Math.sin(yw) * Math.cos(p) * d, t.y + Math.sin(p) * d, t.z + Math.cos(yw) * Math.cos(p) * d);
    camera.lookAt(t);
    camera.near = Math.max(0.05, d * 0.04);
    camera.far = d * 8 + 400;
    camera.updateProjectionMatrix();
    const fog = scene.fog as THREE.Fog;
    fog.near = d * (z < 1.5 ? 1.25 : 1.6);
    fog.far = d * (z < 1.5 ? 3.4 : z < 3.5 ? 4.2 : 3.2);
    // Near levels melt into the ground; far levels open onto the sky.
    const sky = smooth(1.9, 2.9, z);
    bgColor.set(palette.ground).lerp(new THREE.Color(palette.bg), 0.35).lerp(new THREE.Color(palette.sky), sky);
    fog.color.copy(bgColor);
    sun.position.set(t.x - d * 0.5, t.y + d * 1.2, t.z + d * 0.7);
    sun.target.position.copy(t);
    const cam = sun.shadow.camera;
    const extent = d * 0.9;
    cam.left = -extent; cam.right = extent; cam.top = extent; cam.bottom = -extent;
    cam.near = d * 0.2; cam.far = d * 4;
    cam.updateProjectionMatrix();
  }
  function updateLevelOfDetail() {
    for (const f of faders.values()) {
      const w = f.weight();
      for (const m of f.mats) {
        const base = (m.userData.baseOpacity as number | undefined) ?? 1;
        m.opacity = base * w;
        m.depthWrite = w > 0.97 && base >= 1;
        m.transparent = w < 0.999 || base < 1;
      }
      for (const o of f.objs) o.visible = w > 0.02;
    }
    // The month's ring shrinks (or grows) onto its lap on the era island.
    const e = smooth(2, 2.95, z);
    const sc = lerp(1, lapR / R, e);
    path.scale.setScalar(sc);
    path.position.y = lerp(0, 0.02, e);
    const fill = options.reducedMotion ? 1 : smooth(2.25, 2.95, z);
    for (const m of bankFills) {
      if (m.userData.fill === null) { m.visible = false; continue; }
      const h = 0.9 * (m.userData.fill as number) * (m.parent?.parent === island ? fill : 1);
      m.scale.y = Math.max(0.02, h);
      m.position.y = 0.1 + m.scale.y / 2;
    }
    if (pin) {
      const at = hercPos ? worldOf(hercPos, 0, 0.3, 0) : currentIslandSpot();
      pin.position.set(at.x, at.y + 0.6, at.z);
      pin.scale.setScalar(clamp(camDist * 0.03, 0.4, 3.2));
    }
  }
  function currentIslandSpot(): THREE.Vector3 {
    const era = input && input.currentEra >= 0 ? input.eras[input.currentEra] : null;
    const s = era ? eraSpots.get(era.id) : null;
    return s ? W.set(s.x, s.y + 0.4, s.z) : W.set(0, 0.4, 0);
  }

  // ---------------------------------------------------------------- frames (render on demand)
  let raf = 0, dead = false, offscreen = false, paused = false, lastT = 0, frames = 0, gesture = false;
  const P = new THREE.Vector3();
  function frame(now: number) {
    raf = 0;
    if (dead || !input) return;
    const dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 1 / 60;
    lastT = now;
    const k = options.reducedMotion ? 1 : 1 - Math.exp(-dt * 7);
    let moving = false;
    if (Math.abs(zT - z) > 1e-3) { z += (zT - z) * k; moving = true; } else z = zT;
    if (Math.abs(dayT - day) > 1e-3) { day += (dayT - day) * k; moving = true; } else day = dayT;
    const nextK = smooth(1, 2, z) / R;
    if (Math.abs(nextK - lastK) > 1e-7) { K = nextK; curl(); lastK = nextK; }
    updateCamera();
    updateLevelOfDetail();
    renderer.render(scene, camera);
    frames++;
    if (options.onFrame && width) {
      const list: MiniAnchor[] = [];
      for (const [id, a] of anchors) {
        P.copy(a.at()).project(camera);
        const visible = P.z < 1 && Math.abs(P.x) < 1.15 && Math.abs(P.y) < 1.15;
        list.push({ id, x: (P.x * 0.5 + 0.5) * width, y: (-P.y * 0.5 + 0.5) * height, visible });
      }
      options.onFrame({ anchors: list, z, day, width, height });
    }
    if (moving) raf = requestAnimationFrame(frame);
    else {
      lastT = 0;
      if (gesture) { gesture = false; options.onSettle?.(z, day); }
    }
  }
  function invalidate() {
    if (dead || raf || offscreen || paused || (typeof document !== "undefined" && document.hidden)) return;
    raf = requestAnimationFrame(frame);
  }
  const onHidden = () => { if (!document.hidden) invalidate(); };
  document.addEventListener("visibilitychange", onHidden);
  let io: IntersectionObserver | null = null;
  if (typeof IntersectionObserver === "function") {
    io = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      offscreen = !entry.isIntersecting;
      if (!offscreen) invalidate();
    });
    io.observe(host);
  }
  const lost = (event: Event) => { event.preventDefault(); options.onLost?.(); };
  el.addEventListener("webglcontextlost", lost);

  let quality: MiniQuality = "full";
  function applyQuality(next: MiniQuality) {
    quality = next;
    const full = next === "full" && !compact;
    renderer.setPixelRatio(Math.min(typeof devicePixelRatio === "number" ? devicePixelRatio : 1, full ? 1.75 : 1.25));
    renderer.shadowMap.enabled = full;
    sun.castShadow = full;
    scene.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m) m.needsUpdate = true; });
    if (width) renderer.setSize(width, height, false);
    invalidate();
  }
  applyQuality(options.quality ?? "full");

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function visibleChain(o: THREE.Object3D): boolean { for (let q: THREE.Object3D | null = o; q; q = q.parent) if (!q.visible) return false; return true; }

  return {
    setScene(next: MiniSceneInput) {
      const themeChanged = !input || input.theme !== next.theme;
      palette = MINI_PALETTES[next.theme] ?? MINI_PALETTES.classic;
      const pk = `${next.monthKey}|${next.anchorDay}|${next.gate}|${JSON.stringify(next.days)}`;
      const ik = `${next.eraIndex}|${next.lap}|${JSON.stringify(next.laps)}|${JSON.stringify(next.banks)}|${next.anchorDay}|${next.days.length}|${next.eras[next.eraIndex]?.id ?? ""}`;
      const jk = `${next.eraIndex}|${next.currentEra}|${JSON.stringify(next.eras)}`;
      input = next;
      if (pk !== pathKey) { buildPath(next); pathKey = pk; }
      if (ik !== islandKey) { buildIsland(next); islandKey = ik; }
      if (jk !== journeyKey) { buildJourney(next); journeyKey = jk; }
      if (themeChanged) applyTheme();
      lastK = -1;
      invalidate();
    },
    /** Aim at a zoom (0 Day … 4 Journey, fractional while gliding) and a day of the shown month. */
    setView(view: { z?: number; day?: number }, instant = false) {
      if (view.z !== undefined) zT = clamp(view.z, 0, 4);
      if (view.day !== undefined) dayT = clamp(view.day, 0.5, dim + 0.5);
      if (instant || options.reducedMotion) { z = zT; day = dayT; }
      invalidate();
    },
    /** A gesture moved the view; `onSettle` fires once it comes to rest. */
    nudge(view: { z?: number; day?: number }) {
      gesture = true;
      if (view.z !== undefined) zT = clamp(view.z, 0, 4);
      if (view.day !== undefined) dayT = clamp(view.day, 0.5, dim + 0.5);
      if (options.reducedMotion) { z = zT; day = dayT; }
      invalidate();
    },
    view() { return { z, day, zTarget: zT, dayTarget: dayT, days: dim }; },
    /** World units of path per screen pixel at the Day/Week levels (for dragging along the path). */
    daysPerPixel() { const span = 2 * camDist * tanHalf * aspect(); return span / Math.max(1, width) / SP; },
    resize(w: number, h: number, inset = 0) {
      if (!w || !h || (w === width && h === height && inset === viewInset)) return;
      width = w; height = h; viewInset = inset;
      camera.aspect = w / h;
      // A rail over the left edge: centre the model in what is left of the stage.
      if (inset > 0) camera.setViewOffset(w, h, -inset / 2, 0, w, h); else camera.clearViewOffset();
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      invalidate();
    },
    setQuality(next: MiniQuality) { if (next !== quality) applyQuality(next); },
    pick(clientX: number, clientY: number): string | null {
      const r = el.getBoundingClientRect();
      ndc.set((clientX - r.left) / r.width * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      for (const hit of ray.intersectObjects(pickables, true)) {
        if (!visibleChain(hit.object)) continue;
        const m = (hit.object as THREE.Mesh).material as THREE.Material | undefined;
        if (m && m.transparent && m.opacity < 0.4) continue;
        let o: THREE.Object3D | null = hit.object;
        while (o && !o.userData.pickId) o = o.parent;
        const id = o?.userData.pickId as string | undefined;
        if (!id) continue;
        // Up close the island is only ground: an era answers from the Era level out.
        if (id.startsWith("era:") && z < 2.5) continue;
        if ((id.startsWith("day:") || id === "gate") && z > 3.2) continue;
        return id;
      }
      return null;
    },
    refresh() { invalidate(); },
    /** Paused (the page copy behind the open world): no frames at all; the scene and view still update, and draw on resume. */
    setPaused(next: boolean) {
      if (next === paused) return;
      paused = next;
      if (paused && raf) { cancelAnimationFrame(raf); raf = 0; lastT = 0; }
      if (!paused) invalidate();
    },
    stats() { return { frames, z, day, quality, paused, pickables: pickables.length, anchors: anchors.size }; },
    dispose() {
      if (dead) return;
      dead = true;
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onHidden);
      io?.disconnect();
      el.removeEventListener("webglcontextlost", lost);
      for (const d of pathDisposables.splice(0)) d();
      for (const d of islandDisposables.splice(0)) d();
      for (const d of journeyDisposables.splice(0)) d();
      for (const g of geos) g.dispose();
      for (const { m } of mats) m.dispose();
      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss();
      el.remove();
    },
  };
}
export type MiniWorld = ReturnType<typeof createMiniWorld>;
