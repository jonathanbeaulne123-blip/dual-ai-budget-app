/**
 * Bridges at map scale (ROAD.md §7): the road's spans — the Quay Bridge, the Bight Bridge, the High Span, the Mountain
 * Road's canal bridge — as small low-poly decks so the road reads as CROSSING water, not as a line painted on the sea.
 *
 * One merged, vertex-coloured, unlit mesh (`journey-land:bridges`), in painter's order: the soft shadow the deck casts
 * down-sun on the water or ground (the under-gap), slender piers, the deck's sides (with a low parapet lip), the deck
 * top, then a thin rail line along each parapet (screen-constant width, clamped in eu, like the land's lines). The deck
 * keeps its TRUE width; heights are the board's compressed heights.
 *
 * Draw order (legibility first): after the ground lines, before the board — and it writes NO depth. The board overlay is
 * drawn later and depth-tests against the land only, so a bridge can never hide a station, a day space, the piece or a
 * stop (the board route passes right under the High Span). The road on the deck is `lines.ts`'s deck mesh, drawn next.
 * Budget: one draw call, a few hundred triangles.
 */
import * as THREE from "three";
import type { JourneyLandDressing, Point2 } from "../contracts.ts";
import { hexRgb, landExtras } from "./dressing.ts";
import type { LandViewUniforms } from "./lines.ts";
import { landViewUniforms } from "./lines.ts";
import { topAt, type BridgePlan } from "./road.ts";
import type { LandSurface } from "./surface.ts";

export const BRIDGES_NAME = "journey-land:bridges";
/** Draw order: after the ground lines (1.3), before the deck lines (1.6) and the board (ghost 1 is before; board 2). */
export const BRIDGES_ORDER = 1.5;
/** Deck slab thickness and the parapet lip above the deck top (compressed eu). */
export const DECK_THICKNESS = 0.9;
export const PARAPET_LIP = 0.45;
/** Piers stand about this far apart along the deck (eu), never at the very ends (the abutments meet the land). */
const PIER_SPACING = 36;
const PIER_SIZE = 1.8;
/** The deck's shadow: pushed down-sun (the board's low north-west light) by this fraction of the deck's height. */
const SHADOW_SHIFT: Point2 = [0.55, 0.45];
const SHADOW_ALPHA = 0.2;
/** Above the sea plane (which stands `SEA_RISE` 0.25 over the drawn surface) and level water (0.05). */
const SHADOW_LIFT = 0.4;
/** Rails: screen width (px) clamped in eu, set just inside each deck edge. */
const RAIL_PX = 1.4, RAIL_EU = { min: 0.45, max: 1.2 };
const RAIL_INSET = 0.35;
/** Shades of the deck colour. */
const SIDE_SHADE = 0.74, UNDER_SHADE = 0.6, PIER_SHADE = 0.66;

type Role = "top" | "side" | "under" | "pier" | "rail" | "shadow";

const VERTEX = /* glsl */ `
attribute vec2 aSide; attribute vec3 aWidth; attribute vec4 aColor;
uniform float uWpp;
varying vec4 vColor;
void main() {
  float w = aWidth.x > 0.0 ? clamp(aWidth.x * uWpp, aWidth.y, aWidth.z) : 0.0;
  vec3 p = position + vec3(aSide.x, 0.0, aSide.y) * (0.5 * w);
  vColor = aColor;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.0);
}`;
const FRAGMENT = /* glsl */ `
varying vec4 vColor;
void main() { gl_FragColor = vColor; }`;

type Build = { positions: number[]; side: number[]; width: number[]; roles: Role[]; index: number[] };

export type BridgeMeshes = { mesh: THREE.Mesh | null; recolour(d: JourneyLandDressing): void; dispose(): void };

/** Plan offset along the deck's section at arc s: the axis point and its unit right normal (mitred at axis joints). */
function frameAt(b: BridgePlan, i: number): { p: Point2; n: Point2; miter: number } {
  const prev = b.plan[Math.max(0, i - 1)]!, next = b.plan[Math.min(b.plan.length - 1, i + 1)]!;
  const tx = next[0] - prev[0], tz = next[1] - prev[1], len = Math.hypot(tx, tz) || 1;
  let n: Point2 = [-tz / len, tx / len], miter = 1;
  if (i > 0 && i < b.plan.length - 1) {
    const a = b.plan[i - 1]!, p = b.plan[i]!, c = b.plan[i + 1]!;
    const l1 = Math.hypot(p[0] - a[0], p[1] - a[1]) || 1, l2 = Math.hypot(c[0] - p[0], c[1] - p[1]) || 1;
    const n1: Point2 = [-(p[1] - a[1]) / l1, (p[0] - a[0]) / l1], n2: Point2 = [-(c[1] - p[1]) / l2, (c[0] - p[0]) / l2];
    const sx = n1[0] + n2[0], sz = n1[1] + n2[1], sl = Math.hypot(sx, sz) || 1;
    n = [sx / sl, sz / sl];
    miter = Math.min(1.5, 1 / Math.max(0.3, n[0] * n1[0] + n[1] * n1[1]));
  }
  return { p: b.plan[i]!, n, miter };
}

export function buildBridges(bridges: readonly BridgePlan[], surface: Pick<LandSurface, "surfaceAt">, dressing: JourneyLandDressing, view: LandViewUniforms = landViewUniforms()): BridgeMeshes {
  const out: Build = { positions: [], side: [], width: [], roles: [], index: [] };
  const vert = (x: number, y: number, z: number, role: Role, side: Point2 = [0, 0], width: readonly [number, number, number] = [0, 0, 0]) => {
    out.positions.push(x, y, z); out.side.push(side[0], side[1]); out.width.push(width[0], width[1], width[2]); out.roles.push(role);
    return out.positions.length / 3 - 1;
  };
  const quad = (a: number, b: number, c: number, d: number) => { out.index.push(a, b, c, a, c, d); };

  // Painter's order across ALL bridges: shadows, then piers, then sides, then tops, then rails.
  const layers: Record<Role, (() => void)[]> = { shadow: [], pier: [], under: [], side: [], top: [], rail: [] };
  for (const b of bridges) {
    const frames = b.plan.map((_, i) => frameAt(b, i));
    const edge = (i: number, s: 1 | -1, inset = 0): Point2 => {
      const f = frames[i]!, r = (b.half - inset) * f.miter * s;
      return [f.p[0] + f.n[0] * r, f.p[1] + f.n[1] * r];
    };
    const top = (i: number) => b.tops[i]!;
    // The shadow: the deck's plan outline pushed down-sun by its height over the surface, laid on that surface.
    layers.shadow.push(() => {
      const ids: number[][] = [];
      for (let i = 0; i < frames.length; i++) {
        ids.push(([1, -1] as const).map((s) => {
          const [x, z] = edge(i, s), ground = surface.surfaceAt(x, z), h = Math.max(0, top(i) - ground);
          const sx = x + SHADOW_SHIFT[0] * h, sz = z + SHADOW_SHIFT[1] * h;
          return vert(sx, surface.surfaceAt(sx, sz) + SHADOW_LIFT, sz, "shadow");
        }));
      }
      for (let i = 0; i + 1 < ids.length; i++) quad(ids[i]![0]!, ids[i]![1]!, ids[i + 1]![1]!, ids[i + 1]![0]!);
    });
    // Piers: evenly along the deck (not at the ends), down to the drawn surface.
    layers.pier.push(() => {
      const count = Math.max(0, Math.round(b.length / PIER_SPACING) - 1);
      for (let k = 1; k <= count; k++) {
        const s = (b.length * k) / (count + 1);
        let seg = 1;
        while (seg < b.arc.length - 1 && b.arc[seg]! < s) seg++;
        const a = b.plan[seg - 1]!, c = b.plan[seg]!, len = b.arc[seg]! - b.arc[seg - 1]!, t = len > 0 ? (s - b.arc[seg - 1]!) / len : 0;
        const x = a[0] + (c[0] - a[0]) * t, z = a[1] + (c[1] - a[1]) * t, dx = (c[0] - a[0]) / (len || 1), dz = (c[1] - a[1]) / (len || 1);
        const y0 = surface.surfaceAt(x, z) - 0.2, y1 = topAt(b, s) - DECK_THICKNESS;
        if (y1 - y0 < 0.6) continue;
        // Two slender legs across the deck, each a four-sided post.
        for (const off of [-0.55, 0.55]) {
          const cx = x - dz * b.half * off, cz = z + dx * b.half * off, h = PIER_SIZE / 2;
          const c4: Point2[] = [[cx - dx * h + dz * h, cz - dz * h - dx * h], [cx + dx * h + dz * h, cz + dz * h - dx * h], [cx + dx * h - dz * h, cz + dz * h + dx * h], [cx - dx * h - dz * h, cz - dz * h + dx * h]];
          for (let e = 0; e < 4; e++) {
            const p = c4[e]!, q = c4[(e + 1) % 4]!;
            quad(vert(p[0], y0, p[1], "pier"), vert(q[0], y0, q[1], "pier"), vert(q[0], y1, q[1], "pier"), vert(p[0], y1, p[1], "pier"));
          }
        }
      }
    });
    // The deck's sides and end walls (slab + parapet lip), and its soffit edge.
    layers.side.push(() => {
      for (const s of [1, -1] as const) {
        for (let i = 0; i + 1 < frames.length; i++) {
          const p = edge(i, s), q = edge(i + 1, s);
          quad(vert(p[0], top(i) - DECK_THICKNESS, p[1], "side"), vert(q[0], top(i + 1) - DECK_THICKNESS, q[1], "side"), vert(q[0], top(i + 1) + PARAPET_LIP, q[1], "side"), vert(p[0], top(i) + PARAPET_LIP, p[1], "side"));
        }
      }
      // End walls: from the deck down to the land (an abutment), so a raised end never floats.
      for (const i of [0, frames.length - 1]) {
        const l = edge(i, 1), r = edge(i, -1), ground = Math.min(surface.surfaceAt(l[0], l[1]), surface.surfaceAt(r[0], r[1]));
        const y0 = Math.min(top(i) - DECK_THICKNESS, ground - 0.2);
        quad(vert(l[0], y0, l[1], "under"), vert(r[0], y0, r[1], "under"), vert(r[0], top(i), r[1], "under"), vert(l[0], top(i), l[1], "under"));
      }
    });
    layers.top.push(() => {
      const ids = frames.map((_, i) => ([1, -1] as const).map((s) => { const [x, z] = edge(i, s); return vert(x, top(i), z, "top"); }));
      for (let i = 0; i + 1 < ids.length; i++) quad(ids[i]![0]!, ids[i]![1]!, ids[i + 1]![1]!, ids[i + 1]![0]!);
    });
    // A rail line along each parapet: screen-constant width, extruded in plan across the deck.
    layers.rail.push(() => {
      for (const s of [1, -1] as const) {
        const ids = frames.map((f, i) => {
          const [x, z] = edge(i, s, RAIL_INSET), side: Point2 = [f.n[0] * f.miter, f.n[1] * f.miter], y = top(i) + PARAPET_LIP + 0.05;
          const w = [RAIL_PX, RAIL_EU.min, RAIL_EU.max] as const;
          return [vert(x, y, z, "rail", side, w), vert(x, y, z, "rail", [-side[0], -side[1]], w)];
        });
        for (let i = 0; i + 1 < ids.length; i++) quad(ids[i]![0]!, ids[i]![1]!, ids[i + 1]![1]!, ids[i + 1]![0]!);
      }
    });
  }
  for (const role of ["shadow", "pier", "under", "side", "top", "rail"] as const) for (const draw of layers[role]) draw();

  if (!out.index.length) return { mesh: null, recolour() {}, dispose() {} };
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(out.positions, 3));
  geometry.setAttribute("aSide", new THREE.Float32BufferAttribute(out.side, 2));
  geometry.setAttribute("aWidth", new THREE.Float32BufferAttribute(out.width, 3));
  const colours = new Float32Array(out.roles.length * 4);
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colours, 4));
  geometry.setIndex(out.index);
  const material = new THREE.ShaderMaterial({
    uniforms: { uWpp: view.uWpp }, vertexShader: VERTEX, fragmentShader: FRAGMENT, side: THREE.DoubleSide,
    // Opaque list, painter's order, alpha only for the shadow; no depth write, so the board is never hidden.
    transparent: false, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
  });
  material.name = "journey-land-bridge";
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = BRIDGES_NAME;
  mesh.renderOrder = BRIDGES_ORDER;
  // Rails widen in the vertex shader.
  mesh.frustumCulled = false;
  const recolour = (d: JourneyLandDressing) => {
    const x = landExtras(d), deck = hexRgb(x.deck), rail = hexRgb(x.deckRail);
    const shade = (k: number): [number, number, number, number] => [deck[0] * k, deck[1] * k, deck[2] * k, 1];
    const byRole: Record<Role, [number, number, number, number]> = {
      top: [...deck, 1], side: shade(SIDE_SHADE), under: shade(UNDER_SHADE), pier: shade(PIER_SHADE), rail: [...rail, 1], shadow: [0.16, 0.13, 0.08, SHADOW_ALPHA],
    };
    out.roles.forEach((role, n) => colours.set(byRole[role], n * 4));
    (geometry.getAttribute("aColor") as THREE.BufferAttribute).needsUpdate = true;
  };
  recolour(dressing);
  return { mesh, recolour, dispose() { geometry.dispose(); material.dispose(); } };
}
