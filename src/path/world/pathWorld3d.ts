import * as THREE from "three";
import type { ThemeId } from "../../theme/scenes.ts";
import type { KittyPieceV1 } from "../../core/types.ts";
import { createKittySculpture, type KittySculpture } from "../../kitty/sculpture.ts";
import { CELL, GRID, HALF, SIZE, heightAt, idx, islandHash, type GrownIsland, type Piece } from "../grow.ts";
import { walkPath, walkSeconds, type WalkPoint } from "../walk.ts";
import { COIN_POOL, landmarkStepChange } from "../landmarks.ts";

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
  campfires: { id: string; month: number; lit: boolean; state: string }[];
  moves: { id: string; state: "done" | "waiting" | "next" | "open" }[];
  goals: { id: string; step: number; piece: KittyPieceV1 | null; fired: boolean }[];
  lamps: { id: string; month: number }[];
  memories: { id: string; month: number }[];
  weather: { id: string; big: boolean }[];
  unknown: { id: string; month: number }[];
  name: string | null;
  layers: { weather: boolean; story: boolean; rhythm: boolean };
  /** The kiln hut beside the landmarks: present once a shared bank exists; warm when one was fired lately. */
  kiln?: { warm: boolean } | null;
};
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
  function radialTexture(inner: string, outer: string): THREE.Texture {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d");
    if (g) { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, inner); gr.addColorStop(1, outer); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }
    const t = new THREE.CanvasTexture(c); decorDisposables.push(() => t.dispose()); return t;
  }

  function paintTerrain(island: GrownIsland, season: string) {
    const c = new THREE.Color();
    const P = {
      grass: new THREE.Color(palette.grass), dry: new THREE.Color(palette.dry), sand: new THREE.Color(palette.sand), rock: new THREE.Color(palette.rock),
      deep: new THREE.Color(palette.deep), snow: new THREE.Color(palette.snow), autumn: new THREE.Color("#c98a4a"),
      bloomA: new THREE.Color(palette.blooms[0]), bloomB: new THREE.Color(palette.blooms[1]),
    };
    for (let k = 0; k < GRID * GRID; k++) {
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
      }
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
        const light = new THREE.PointLight(0xffa040, 6, 12, 2); light.position.y = 1.4;
        g.add(f1, f2, light);
        tickers.push((t) => { const k = 1 + 0.15 * Math.sin(t * 11) + 0.1 * Math.sin(t * 17.3); f1.scale.y = 1.2 * k; f2.scale.y = 0.8 * (2 - k); light.intensity = 5 + 1.5 * Math.sin(t * 9); });
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
    for (const dispose of sceneDisposables.splice(0)) dispose();
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
      if (fire.lit) {
        const f = part(G.cone, "#ffb347", 0.5, 1.4, 0.5, 0, 1, 0, { emissive: "#ff8a1f", emissiveIntensity: 1.2 }); f.castShadow = false;
        const light = new THREE.PointLight(0xffa040, 6, 16, 2); light.position.y = 1.6;
        g.add(f, light);
        tickers.push((t) => { f.scale.y = 1.4 * (1 + 0.15 * Math.sin(t * 11)); light.intensity = 5 + 1.5 * Math.sin(t * 9); });
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
      g.add(part(G.cyl, "#8a6a4a", 0.05, 3.2, 0.05, 0, 1.6, 0), part(G.box, "#ffffff", 1.5, 1.75, 0.04, 0.8, 2.6, 0), part(G.box, palette.blooms[i % palette.blooms.length]!, 1.3, 1.2, 0.05, 0.8, 2.75, 0));
      const photo = g.children[1]!;
      tickers.push((t) => { photo.rotation.y = 0.25 * Math.sin(t * 1.3 + i); });
      anchor(memory.id, g, 4); dynamic.add(g);
    });
    // Weather: upcoming bills as clouds ahead of this month
    if (input.layers.weather) input.weather.forEach((bill, i) => {
      const p = island.spot(island.cur), q = island.spot(island.cur + 1);
      const k = 0.3 + i * 0.22;
      const x = p.x + (q.x - p.x) * k + Math.cos(p.a) * 3, z = p.z + (q.z - p.z) * k + Math.sin(p.a) * 3;
      const g = new THREE.Group();
      for (let c = 0; c < (bill.big ? 7 : 4); c++) { const s = part(G.sph, bill.big ? "#bfc9d6" : "#e3e8ee", 0.9 + ((c * 37) % 7) * 0.08, 0.8, 0.9, (c - 2) * 0.8, ((c * 13) % 5) * 0.1, 0, { flatShading: false }); s.castShadow = false; g.add(s); }
      g.position.set(x, heightAt(island, x, z) + 7 + i * 0.6, z);
      const x0 = x;
      tickers.push((t) => { g.position.x = x0 + Math.sin(t * 0.3 + i * 2) * 0.8; });
      anchor(bill.id, g, 1.4); dynamic.add(g);
    });
    // Landmarks: shared Kitty Banks at their real backing step
    const seen = new Set<string>();
    const arcs = !options.reducedMotion && quality === "full";
    const landmarkCount = Math.min(6, input.goals.length);
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
      anchor("kiln", k, 3.6); dynamic.add(k);
    }
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

    placeFoliage(island, monthSeason, reserved);
    for (const obj of appearing) { obj.userData.pop = options.reducedMotion || !animate ? 1 : 0; obj.scale.setScalar(obj.userData.pop ? 1 : 0.01); }
    sun.intensity = monthSeason === "winter" ? 1.8 : 2.2;
    dynamic.updateMatrixWorld(true);
    us.updateMatrixWorld(true);
    syncAnchors();
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
  let walk: { pts: WalkPoint[]; from: number; to: number; t: number; dur: number; len: number; nextStep: number; left: boolean } | null = null;
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
    walk = { pts, from, to: cur, t: 0, dur: Math.max(0.35, walkSeconds(from, cur)), len, nextStep: STRIDE * 0.5, left: false };
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
    if (walk && island) {
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
      if (walk.t >= 1) {
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
    glow.intensity = drifting && atNow && quality === "full" && !walk
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
    const ground = current ? heightAt(current.island, cam.tx, cam.tz) : 0;
    camera.position.set(cam.tx + h * Math.sin(cam.theta), Math.max(ground + 3, y + ground), cam.tz + h * Math.cos(cam.theta));
    camera.lookAt(cam.tx, ground + 1.5, cam.tz);
    const next = levelOf(cam.r);
    if (next !== level) { level = next; options.onLevel?.(level); }
  }
  function clampTarget() { const d = Math.hypot(cam.tx, cam.tz); if (d > 84) { cam.tx *= 84 / d; cam.tz *= 84 / d; } }

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
      if (pinch) cam.r = Math.max(14, Math.min(200, cam.r * pinch / d));
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
  const onWheel = (e: WheelEvent) => { e.preventDefault(); fly = null; cam.r = Math.max(14, Math.min(200, cam.r * Math.exp(e.deltaY * 0.001))); invalidate(); };
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
    },
    resize,
    setAmbient(on: boolean) { ambient = on && !options.reducedMotion; invalidate(); },
    setQuality(next: PathQuality) { applyQuality(next); invalidate(); },
    /** The tent is open: stop drawing, keep the context and every buffer. */
    sleep() { if (dead) return; sleeping = true; halt(); },
    /** Back from the tent: re-measure (the host was display:none), draw, and re-report anchors. */
    wake(w?: number, h?: number) {
      if (dead) return;
      sleeping = false;
      if (w && h) resize(w, h);
      invalidate();
    },
    /** Re-report anchors after the page changed what it shows (lantern, layers). */
    refresh() { invalidate(); },
    /** Travel to an anchor, or to "now" (the current month). */
    focus(id: string, levelHint?: PathLevel) {
      const target = id === "now" && current ? (() => { const p = current.island.spot(current.island.cur); return new THREE.Vector3(p.x, 0, p.z); })() : anchors.get(id);
      if (!target) return;
      flyTo(target.x, target.z, PATH_LEVEL_RADIUS[levelHint ?? 3]!);
    },
    setLevel(next: PathLevel) { flyTo(next === 0 ? 0 : cam.tx, next === 0 ? 0 : cam.tz, PATH_LEVEL_RADIUS[next]!); },
    zoom(factor: number) { fly = null; cam.r = Math.max(14, Math.min(200, cam.r * factor)); invalidate(); },
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
