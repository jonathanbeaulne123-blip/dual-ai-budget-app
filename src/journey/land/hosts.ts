/**
 * Hosts and reserves (T2; silhouettes T7). The seven hosts are small low-poly landmarks with their own silhouettes,
 * so each reads by SHAPE first and colour second:
 *
 * | host | silhouette |
 * |---|---|
 * | `home` — Our home (shared) | gabled house, the theme's warm "our home" roof, chimney, a door on its door side |
 * | `bank` — the Fund bank | stone block, flat slate roof, a pediment and columns on the door side |
 * | `library` | a big hall under a hipped roof with a cupola |
 * | `glasshouse` | a long glass house: pale glass walls and roof, dark ridge and end frames |
 * | `studio` — the pottery | a workshop and its bottle kiln with a chimney |
 * | `cottage` — Hercules's cottage | a small cottage, steep thatch-coloured roof, chimney |
 * | `boathouse` | timber on the water's edge, a wide gable facing the water and a jetty running out |
 *
 * All seven are ONE merged mesh (one draw call) with baked, unlit shading (the same low north-west sun as the
 * terrain). Each vertex carries its host's anchor and size, and the vertex shader grows a host about its anchor to a
 * SCREEN-CONSTANT MINIMUM (`uHostPx` × world-per-pixel, set by `setJourneyLandView`): hosts read at Sky, and are
 * their true footprint from Region inward. The nine reserve plots are one set of hoarding outlines.
 */
import * as THREE from "three";
import type { JourneyLandData, JourneyLandDressing, Point2 } from "../contracts.ts";
import { compressHeight, HEIGHT_COMPRESSION } from "../contracts.ts";
import { hexRgb, landExtras, type JourneyLandExtras } from "./dressing.ts";
import { landViewUniforms, type LandViewUniforms } from "./lines.ts";
import { closedRing, densify, polygonCentroid } from "./simplify.ts";
import type { LandSurface } from "./surface.ts";

/** A host whose roof height is not baked still reads as a building. */
const DEFAULT_ROOF = 8;
/** Hosts stand taller than the land's compression would make them (they are landmarks, not the route's rivals). */
const HOST_HEIGHT_SCALE = 0.85;
const EAVE = 0.72, SINK = 0.4, RESERVE_LIFT = 0.5;
/** Host walls stop at this share of the host's height; the rest is roof (a readable pitch). */
const HOST_EAVE = 0.52;
/** A host never grows past this many times its footprint (a phone at Sky). */
export const HOST_MAX_GROWTH = 4.5;
/** Minimum on-screen size (px) of a host's footprint diagonal; the board scene sets it per tier. */
export const HOST_MIN_PX = { sky: 36, region: 28, stop: 0 } as const;

export type HostMeshes = { hosts: THREE.Mesh | null; shadows: THREE.Mesh | null; reserves: THREE.LineSegments | null; recolour(d: JourneyLandDressing): void; dispose(): void };

/** Board-space box of each host, for tests and the board's anchors: door, base and top. */
export function hostShape(host: JourneyLandData["hosts"][number], surface: LandSurface) {
  const ring = host.footprint ? closedRing(host.footprint) : square(host.door, 6);
  const pad = compressHeight(host.height);
  const base = Math.min(pad, ...ring.map((p) => surface.heightAt(p[0], p[1]))) - SINK;
  const rise = (host.roofHeight ?? DEFAULT_ROOF) * HEIGHT_COMPRESSION.buildingScale;
  return { ring, base, eave: pad + rise * EAVE, apex: pad + rise };
}

const square = (c: Point2, half: number): Point2[] => [[c[0] - half, c[1] - half], [c[0] + half, c[1] - half], [c[0] + half, c[1] + half], [c[0] - half, c[1] + half]];

// --- a tiny local kit (metres, host-local frame: x along the long axis, z across, y up from the pad) -----------------

type Paint = keyof JourneyLandExtras | "hostWall" | "hostRoof" | "door";
type V3 = [number, number, number];
/** `o`: the local plan centre a wall faces away from (default the host's middle). */
type Tri = { a: V3; b: V3; c: V3; paint: Paint; o?: Point2 };
const SUN = new THREE.Vector3(-0.62, 0.7, -0.55).normalize();

const quad = (out: Tri[], a: V3, b: V3, c: V3, d: V3, paint: Paint) => { out.push({ a, b, c, paint }, { a, b: c, c: d, paint }); };

function box(out: Tri[], cx: number, cz: number, w: number, d: number, y0: number, y1: number, paint: Paint, top: Paint = paint): void {
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
  quad(out, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], top);
  quad(out, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], paint);
  quad(out, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], paint);
  quad(out, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], paint);
  quad(out, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], paint);
}

/** A gable roof along x over a w × d box from eave to ridge, with a little overhang. */
function gable(out: Tri[], cx: number, cz: number, w: number, d: number, eave: number, ridge: number, paint: Paint, ends: Paint): void {
  const o = 0.9, x0 = cx - w / 2 - o, x1 = cx + w / 2 + o, z0 = cz - d / 2 - o, z1 = cz + d / 2 + o;
  quad(out, [x0, eave, z1], [x1, eave, z1], [x1, ridge, cz], [x0, ridge, cz], paint);
  quad(out, [x1, eave, z0], [x0, eave, z0], [x0, ridge, cz], [x1, ridge, cz], paint);
  out.push({ a: [x1, eave, z1], b: [x1, eave, z0], c: [x1, ridge, cz], paint: ends });
  out.push({ a: [x0, eave, z0], b: [x0, eave, z1], c: [x0, ridge, cz], paint: ends });
}

/** A hipped roof (four slopes to a short ridge). */
function hipped(out: Tri[], w: number, d: number, eave: number, ridge: number, paint: Paint): void {
  const o = 1, x0 = -w / 2 - o, x1 = w / 2 + o, z0 = -d / 2 - o, z1 = d / 2 + o, r = Math.max(0, (w - d) / 2);
  quad(out, [x0, eave, z1], [x1, eave, z1], [r, ridge, 0], [-r, ridge, 0], paint);
  quad(out, [x1, eave, z0], [x0, eave, z0], [-r, ridge, 0], [r, ridge, 0], paint);
  out.push({ a: [x1, eave, z1], b: [x1, eave, z0], c: [r, ridge, 0], paint });
  out.push({ a: [x0, eave, z0], b: [x0, eave, z1], c: [-r, ridge, 0], paint });
}

/** A tapered n-gon tower (kiln, cupola), optional cap. */
function tower(out: Tri[], cx: number, cz: number, r0: number, r1: number, y0: number, y1: number, sides: number, paint: Paint, cap: Paint | null): void {
  const at = (r: number, y: number, i: number): V3 => { const a = (i / sides) * Math.PI * 2; return [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r]; };
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    out.push({ a: at(r0, y0, j), b: at(r0, y0, i), c: at(r1, y1, i), paint, o: [cx, cz] }, { a: at(r0, y0, j), b: at(r1, y1, i), c: at(r1, y1, j), paint, o: [cx, cz] });
    if (cap) out.push({ a: [cx, y1, cz], b: at(r1, y1, j), c: at(r1, y1, i), paint: cap });
  }
}

/** One host's silhouette in its local frame. `door` = the door side (+1 = +z, −1 = −z); `water` = local direction to water. */
function silhouette(id: string, w: number, d: number, h: number, door: 1 | -1, water: { dir: Point2; reach: number } | null): Tri[] {
  const t: Tri[] = [], y0 = -SINK * 3;
  const eave = h * HOST_EAVE;
  switch (id) {
    case "home": {
      box(t, 0, 0, w, d, y0, eave, "hostWall");
      gable(t, 0, 0, w, d, eave, h * 1.25, "homeRoof", "hostWall");
      box(t, w * 0.28, -d * 0.18, w * 0.12, w * 0.12, eave, h * 1.42, "chimney");
      box(t, -w * 0.12, door * (d / 2 + 0.05), w * 0.16, 0.3, 0, eave * 0.62, "homeDoor");
      break;
    }
    case "bank": {
      box(t, 0, 0, w, d * 0.8, y0, eave * 1.08, "bankWall");
      box(t, 0, 0, w + 1.2, d * 0.8 + 1.2, eave * 1.08, eave * 1.22, "bankRoof");
      // Portico on the door side: a pediment over four columns.
      const front = door * (d * 0.4 + d * 0.09);
      for (const x of [-0.36, -0.12, 0.12, 0.36]) box(t, x * w, front, w * 0.07, w * 0.07, y0, eave * 1.08, "bankWall", "bankRoof");
      const pz0 = door * d * 0.4, pz1 = door * (d * 0.4 + d * 0.2), py = eave * 1.08, pt = eave * 1.5;
      quad(t, [-w / 2, py, pz1], [w / 2, py, pz1], [0, pt, pz1], [0, pt, pz1], "bankWall");
      quad(t, [-w / 2, py, pz0], [-w / 2, py, pz1], [0, pt, pz1], [0, pt, pz0], "bankRoof");
      quad(t, [w / 2, py, pz1], [w / 2, py, pz0], [0, pt, pz0], [0, pt, pz1], "bankRoof");
      break;
    }
    case "library": {
      box(t, 0, 0, w * 0.86, d * 0.86, y0, eave, "libraryWall");
      hipped(t, w * 0.86, d * 0.86, eave, h * 1.35, "libraryRoof");
      tower(t, 0, 0, w * 0.1, w * 0.1, h * 1.2, h * 1.65, 6, "libraryWall", null);
      tower(t, 0, 0, w * 0.12, 0, h * 1.65, h * 1.95, 6, "libraryRoof", null);
      break;
    }
    case "glasshouse": {
      box(t, 0, 0, w, d, y0, eave * 0.8, "glass");
      gable(t, 0, 0, w, d, eave * 0.8, h * 1.05, "glass", "glass");
      box(t, 0, 0, w + 1.6, 0.6, h * 1.02, h * 1.12, "glassFrame");
      for (const x of [-w / 2, 0, w / 2]) box(t, x, 0, 0.6, d + 0.4, eave * 0.8, eave * 0.86, "glassFrame");
      box(t, 0, 0, w + 0.4, d + 0.4, y0, 0.5, "glassFrame");
      break;
    }
    case "studio": {
      box(t, -w * 0.14, 0, w * 0.7, d, y0, eave, "hostWall");
      gable(t, -w * 0.14, 0, w * 0.7, d, eave, h * 1.1, "studioRoof", "hostWall");
      // The bottle kiln: a round-shouldered brick tower and its chimney, taller than the roof.
      tower(t, w * 0.32, 0, d * 0.34, d * 0.24, y0, h * 1.05, 8, "kiln", null);
      tower(t, w * 0.32, 0, d * 0.24, d * 0.1, h * 1.05, h * 1.5, 8, "kiln", null);
      tower(t, w * 0.32, 0, d * 0.1, d * 0.1, h * 1.5, h * 2, 6, "chimney", "chimney");
      break;
    }
    case "cottage": {
      box(t, 0, 0, w, d, y0, eave * 0.9, "cottageWall");
      gable(t, 0, 0, w, d, eave * 0.9, h * 1.45, "cottageRoof", "cottageWall");
      box(t, -w * 0.3, d * 0.12, w * 0.14, w * 0.14, eave, h * 1.55, "chimney");
      break;
    }
    case "boathouse": {
      box(t, 0, 0, w, d, y0, eave, "timber");
      gable(t, 0, 0, w, d, eave, h * 1.2, "boathouseRoof", "timber");
      if (water) {
        // A jetty from the house to the water's edge and a little past it, on piles, with a slip ramp.
        const [ux0, uz0] = water.dir, along = Math.abs(ux0) > Math.abs(uz0);
        const ux = along ? Math.sign(ux0) : 0, uz = along ? 0 : Math.sign(uz0);
        const edge = (along ? w : d) / 2, len = Math.max(8, water.reach - edge + 8);
        const mx = ux * (edge + len / 2), mz = uz * (edge + len / 2);
        box(t, mx, mz, along ? len : 3.4, along ? 3.4 : len, 0.3, 1.1, "timber");
        for (let k = 0.2; k < 1; k += 0.3) for (const side of [-1.4, 1.4]) box(t, ux * (edge + len * k) + (along ? 0 : side), uz * (edge + len * k) + (along ? side : 0), 0.8, 0.8, -3, 0.4, "chimney");
      }
      break;
    }
    default: {
      box(t, 0, 0, w, d, y0, eave, "hostWall");
      gable(t, 0, 0, w, d, eave, h, "hostRoof", "hostWall");
    }
  }
  return t;
}

function paintOf(paint: Paint, d: JourneyLandDressing, x: JourneyLandExtras): string {
  if (paint === "hostWall") return d.hostWall;
  if (paint === "hostRoof") return d.hostRoof;
  if (paint === "door") return x.homeDoor;
  return x[paint];
}

/** Hosts grow about their anchor to a screen-constant minimum (never shrink below their footprint). */
const HOST_VERTEX = /* glsl */ `
attribute vec3 aAnchor; attribute float aSize; attribute vec3 aColor;
uniform float uWpp; uniform float uHostPx;
varying vec3 vColor;
void main() {
  float s = clamp(uHostPx * uWpp / max(aSize, 1.0), 1.0, ${HOST_MAX_GROWTH.toFixed(1)});
  vColor = aColor;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(aAnchor + position * s, 1.0);
}`;

export function buildHosts(data: JourneyLandData, surface: LandSurface, dressing: JourneyLandDressing, view: LandViewUniforms = landViewUniforms()): HostMeshes {
  const local: number[] = [], anchor: number[] = [], size: number[] = [], shades: number[] = [], paints: Paint[] = [];
  // A soft cast shadow per host (a darkened quad to the south-east, away from the low north-west sun).
  const shadowLocal: number[] = [], shadowAnchor: number[] = [], shadowSize: number[] = [];
  const n = new THREE.Vector3(), u1 = new THREE.Vector3(), u2 = new THREE.Vector3();
  for (const host of data.hosts) {
    const ring = host.footprint ? closedRing(host.footprint) : square(host.door, 6);
    const [cx, cz] = polygonCentroid(ring);
    // The local x axis is the footprint edge that runs closest to north–south, so a gable END faces the board's
    // camera (which looks north): the house-shaped silhouette reads at a glance.
    const a = ring[0]!, b = ring[1]!, c = ring[2] ?? ring[1]!;
    const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]) || 12, l2 = Math.hypot(c[0] - b[0], c[1] - b[1]) || 12;
    const e1: Point2 = [(b[0] - a[0]) / l1, (b[1] - a[1]) / l1], e2: Point2 = [(c[0] - b[0]) / l2, (c[1] - b[1]) / l2];
    const firstNS = Math.abs(e1[1]) >= Math.abs(e2[1]);
    const axis = firstNS ? e1 : e2;
    const w = firstNS ? l1 : l2, dd = firstNS ? l2 : l1;
    const across = [-axis[1]!, axis[0]!];
    const toLocal = (px: number, pz: number): Point2 => [(px - cx) * axis[0]! + (pz - cz) * axis[1]!, (px - cx) * across[0]! + (pz - cz) * across[1]!];
    const doorLocal = toLocal(host.door[0], host.door[1]);
    const door: 1 | -1 = doorLocal[1] >= 0 ? 1 : -1;
    // The water side (boathouse): the nearest water in sixteen directions (≤ 60 m), and how far it is.
    let water: { dir: Point2; reach: number } | null = null;
    if (host.id === "boathouse") {
      for (let r = 10; r <= 60 && !water; r += 5) for (let k = 0; k < 16 && !water; k++) {
        const ang = (k / 16) * Math.PI * 2, wx = Math.cos(ang), wz = Math.sin(ang);
        if (!surface.isLand(cx + wx * r, cz + wz * r)) { const l = toLocal(cx + wx, cz + wz); water = { dir: [l[0], l[1]], reach: r }; }
      }
    }
    // Landmarks need a pitch you can see from the board's 58° view: never lower than ~0.6 of the footprint's depth.
    const h = Math.max((host.roofHeight ?? DEFAULT_ROOF) * HOST_HEIGHT_SCALE, Math.min(w, dd) * 0.72);
    const pad = compressHeight(host.height);
    const tris = silhouette(host.id, w, dd, h, door, water);
    const diag = Math.hypot(w, dd);
    {
      const off = h * 0.45, grow = 1.5, sx = off * 0.8, sz = off * 0.7;
      const corners: V3[] = [[-w / 2 - grow, 0, -dd / 2 - grow], [w / 2 + grow, 0, -dd / 2 - grow], [w / 2 + grow, 0, dd / 2 + grow], [-w / 2 - grow, 0, dd / 2 + grow]];
      const wc = corners.map((p) => { const q = [p[0] * axis[0]! + p[2] * -axis[1]!, 0.25, p[0] * axis[1]! + p[2] * axis[0]!] as V3; return q; });
      // Two copies: the footprint itself and the footprint pushed down-sun; their hull is close enough for a soft read.
      for (const shift of [[0, 0], [sx, sz]] as const) {
        for (const k of [0, 1, 2, 0, 2, 3]) { const q = wc[k]!; shadowLocal.push(q[0] + shift[0], q[1], q[2] + shift[1]); shadowAnchor.push(cx, pad, cz); shadowSize.push(diag); }
      }
    }
    const world = (p: V3): V3 => [p[0] * axis[0]! + p[2] * across[0]!, p[1], p[0] * axis[1]! + p[2] * across[1]!];
    for (const tri of tris) {
      const A = world(tri.a), B = world(tri.b), C = world(tri.c), O = world([tri.o?.[0] ?? 0, 0, tri.o?.[1] ?? 0]);
      u1.set(B[0] - A[0], B[1] - A[1], B[2] - A[2]); u2.set(C[0] - A[0], C[1] - A[1], C[2] - A[2]);
      n.crossVectors(u1, u2);
      if (n.lengthSq() < 1e-9) continue;
      n.normalize();
      // Face outward (up for roofs, away from the host's middle for walls) whatever the authored winding.
      const mx = (A[0] + B[0] + C[0]) / 3 - O[0], mz = (A[2] + B[2] + C[2]) / 3 - O[2];
      if (Math.abs(n.y) > 0.35 ? n.y < 0 : n.x * mx + n.z * mz < 0) n.negate();
      const lit = 0.76 + 0.34 * Math.max(0, n.dot(SUN));
      for (const p of [A, B, C]) { local.push(p[0], p[1], p[2]); anchor.push(cx, pad, cz); size.push(diag); shades.push(lit); }
      paints.push(tri.paint);
    }
  }
  let hosts: THREE.Mesh | null = null, hostGeometry: THREE.BufferGeometry | null = null, hostMaterial: THREE.ShaderMaterial | null = null;
  const colours = new Float32Array(local.length);
  if (local.length) {
    hostGeometry = new THREE.BufferGeometry();
    hostGeometry.setAttribute("position", new THREE.Float32BufferAttribute(local, 3));
    hostGeometry.setAttribute("aAnchor", new THREE.Float32BufferAttribute(anchor, 3));
    hostGeometry.setAttribute("aSize", new THREE.Float32BufferAttribute(size, 1));
    hostGeometry.setAttribute("aColor", new THREE.BufferAttribute(colours, 3));
    hostMaterial = new THREE.ShaderMaterial({
      uniforms: { uWpp: view.uWpp, uHostPx: view.uHostPx },
      vertexShader: HOST_VERTEX,
      fragmentShader: /* glsl */ `varying vec3 vColor; void main() { gl_FragColor = vec4(vColor, 1.0); }`,
      side: THREE.DoubleSide,
    });
    hostMaterial.name = "journey-land-host";
    hosts = new THREE.Mesh(hostGeometry, hostMaterial);
    hosts.name = "journey-land:hosts";
    // The shader grows hosts past their authored box at Sky.
    hosts.frustumCulled = false;
  }

  let shadows: THREE.Mesh | null = null, shadowGeometry: THREE.BufferGeometry | null = null, shadowMaterial: THREE.ShaderMaterial | null = null;
  if (shadowLocal.length) {
    shadowGeometry = new THREE.BufferGeometry();
    shadowGeometry.setAttribute("position", new THREE.Float32BufferAttribute(shadowLocal, 3));
    shadowGeometry.setAttribute("aAnchor", new THREE.Float32BufferAttribute(shadowAnchor, 3));
    shadowGeometry.setAttribute("aSize", new THREE.Float32BufferAttribute(shadowSize, 1));
    shadowMaterial = new THREE.ShaderMaterial({
      uniforms: { uWpp: view.uWpp, uHostPx: view.uHostPx },
      vertexShader: HOST_VERTEX.replace("attribute vec3 aColor;", "").replace("vColor = aColor;", "vColor = vec3(0.0);"),
      fragmentShader: /* glsl */ `varying vec3 vColor; void main() { gl_FragColor = vec4(0.16, 0.13, 0.08, 0.16); }`,
      side: THREE.DoubleSide, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
    });
    shadowMaterial.name = "journey-land-host-shadow";
    shadows = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadows.name = "journey-land:host-shadows";
    shadows.frustumCulled = false;
    shadows.renderOrder = 1;
  }

  const segments: number[] = [];
  for (const reserve of data.reserves) {
    const ring = closedRing(reserve.outline), path = densify([...ring, ring[0]!], 10);
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i]!, b = path[i + 1]!;
      segments.push(a[0], surface.heightAt(a[0], a[1]) + RESERVE_LIFT, a[1], b[0], surface.heightAt(b[0], b[1]) + RESERVE_LIFT, b[1]);
    }
  }
  let reserves: THREE.LineSegments | null = null, reserveGeometry: THREE.BufferGeometry | null = null;
  const reserveMaterial = new THREE.LineBasicMaterial({ color: dressing.reserve });
  if (segments.length) {
    reserveGeometry = new THREE.BufferGeometry();
    reserveGeometry.setAttribute("position", new THREE.Float32BufferAttribute(segments, 3));
    reserves = new THREE.LineSegments(reserveGeometry, reserveMaterial);
    reserves.name = "journey-land:reserves";
    reserves.renderOrder = 2;
  }

  const recolour = (d: JourneyLandDressing) => {
    const x = landExtras(d);
    paints.forEach((paint, t) => {
      const [r, g, b] = hexRgb(paintOf(paint, d, x));
      for (let v = 0; v < 3; v++) { const k = (t * 3 + v), s = shades[k]!; colours[k * 3] = r * s; colours[k * 3 + 1] = g * s; colours[k * 3 + 2] = b * s; }
    });
    if (hostGeometry) (hostGeometry.getAttribute("aColor") as THREE.BufferAttribute).needsUpdate = true;
    reserveMaterial.color.set(d.reserve);
  };
  recolour(dressing);
  return { hosts, shadows, reserves, recolour, dispose() { hostGeometry?.dispose(); hostMaterial?.dispose(); shadowGeometry?.dispose(); shadowMaterial?.dispose(); reserveGeometry?.dispose(); reserveMaterial.dispose(); } };
}
