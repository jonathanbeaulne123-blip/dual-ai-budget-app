/**
 * Water (T2; shore pass T7): one sea plane (the deep-water colour) and one merged, vertex-coloured mesh for the eleven
 * surface water bodies plus the shallows rim along the coastline. Level bodies (lakes, the Bight lagoon) lie flat at
 * their compressed level; graded ones (rivers, the brook, the dry wash) are draped on the compressed ground. Unlit, so
 * each theme's water colour is exact. Rivers are authored a shade deeper than lakes so they read at Sky.
 */
import * as THREE from "three";
import type { JourneyLandData, JourneyLandDressing } from "../contracts.ts";
import { compressHeight } from "../contracts.ts";
import { closedRing, pointInPolygon } from "./simplify.ts";
import { LEVEL_WATER_KINDS, type LandSurface } from "./surface.ts";

/** How far past the island the sea runs (eu), so no tier ever sees its edge. */
const SEA_MARGIN = 4000;
/**
 * The sea plane stands a little ABOVE the flattened seabed (terrain y = 0 at sea level and below), so the shore is the
 * contour where the drawn terrain rises through it — smooth, not the 20 m lattice's staircase.
 */
const SEA_RISE = 0.25;
/** The shallows rim: a band this wide (eu) outward from the coastline, just above the sea. */
export const SHALLOWS_EU = 24;
const SHALLOWS_LIFT = 0.04;
const GRADED_LIFT = 0.8, LEVEL_LIFT = 0.05;

export type WaterMeshes = { sea: THREE.Mesh; bodies: THREE.Mesh | null; recolour(d: JourneyLandDressing): void; dispose(): void };

const waterColour = (kind: string, d: JourneyLandDressing) => (kind === "shallows" ? d.shallows : kind === "dry" ? d.sand : LEVEL_WATER_KINDS.has(kind) ? d.lake : d.river);

export function buildWater(data: JourneyLandData, surface: LandSurface, dressing: JourneyLandDressing): WaterMeshes {
  const { w, h } = data.extent;
  const seaGeometry = new THREE.PlaneGeometry(w + SEA_MARGIN * 2, h + SEA_MARGIN * 2, 1, 1);
  seaGeometry.rotateX(-Math.PI / 2);
  const seaY = compressHeight(data.seaLevel) + SEA_RISE;
  seaGeometry.translate(w / 2, seaY, h / 2);
  const seaMaterial = new THREE.MeshBasicMaterial({ color: dressing.sea });
  const sea = new THREE.Mesh(seaGeometry, seaMaterial);
  sea.name = "journey-land:sea";
  sea.renderOrder = -1;

  const positions: number[] = [], index: number[] = [], kinds: string[] = [];
  for (const body of data.water) {
    const ring = closedRing(body.outline);
    if (ring.length < 3) continue;
    const contour = ring.map((p) => new THREE.Vector2(p[0], p[1]));
    const triangles = THREE.ShapeUtils.triangulateShape(contour, []);
    const base = positions.length / 3, level = LEVEL_WATER_KINDS.has(body.kind);
    for (const p of ring) {
      const y = level ? compressHeight(body.level) + LEVEL_LIFT : surface.heightAt(p[0], p[1]) + GRADED_LIFT;
      positions.push(p[0], y, p[1]);
      kinds.push(body.kind);
    }
    // triangulateShape winds with the contour; face +y (counter-clockwise seen from above) either way.
    for (const triangle of triangles) {
      const a = triangle[0]!, b = triangle[1]!, c = triangle[2]!;
      const pa = ring[a]!, pb = ring[b]!, pc = ring[c]!;
      const upward = (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pb[1] - pa[1]) * (pc[0] - pa[0]) < 0;
      if (upward) index.push(base + a, base + b, base + c); else index.push(base + a, base + c, base + b);
    }
  }
  // The shallows rim: a strip from the coastline outward (its inner half lies under the rising shore and is hidden).
  const coast = closedRing(data.coastline);
  if (coast.length >= 3) {
    const a0 = coast[0]!, a1 = coast[1]!, len0 = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]) || 1;
    const probe = [(a0[0] + a1[0]) / 2 - ((a1[1] - a0[1]) / len0) * 2, (a0[1] + a1[1]) / 2 + ((a1[0] - a0[0]) / len0) * 2] as const;
    // Left normal (−dy, dx) of the ring's direction points inward when the probe lands inside: flip it outward.
    const out = pointInPolygon(probe[0], probe[1], coast) ? -1 : 1;
    const base = positions.length / 3, n = coast.length, y = seaY + SHALLOWS_LIFT;
    for (let i = 0; i < n; i++) {
      const p = coast[i]!, prev = coast[(i + n - 1) % n]!, next = coast[(i + 1) % n]!;
      const l1 = Math.hypot(p[0] - prev[0], p[1] - prev[1]) || 1, l2 = Math.hypot(next[0] - p[0], next[1] - p[1]) || 1;
      const n1x = -(p[1] - prev[1]) / l1, n1y = (p[0] - prev[0]) / l1, n2x = -(next[1] - p[1]) / l2, n2y = (next[0] - p[0]) / l2;
      let nx = n1x + n2x, ny = n1y + n2y; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      const miter = Math.min(1.8, 1 / Math.max(0.3, nx * n1x + ny * n1y)) * SHALLOWS_EU * out;
      positions.push(p[0] - nx * out * 4, y, p[1] - ny * out * 4, p[0] + nx * miter, y, p[1] + ny * miter);
      kinds.push("shallows", "shallows");
    }
    for (let i = 0; i < n; i++) {
      const a = base + i * 2, b = base + ((i + 1) % n) * 2;
      index.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  let bodies: THREE.Mesh | null = null;
  let bodyGeometry: THREE.BufferGeometry | null = null, bodyMaterial: THREE.MeshBasicMaterial | null = null;
  const colours = new Float32Array(kinds.length * 3);
  if (index.length) {
    bodyGeometry = new THREE.BufferGeometry();
    bodyGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    bodyGeometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
    bodyGeometry.setIndex(index);
    bodyMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
    bodies = new THREE.Mesh(bodyGeometry, bodyMaterial);
    bodies.name = "journey-land:water";
    bodies.renderOrder = 1;
  }
  const recolour = (d: JourneyLandDressing) => {
    seaMaterial.color.set(d.sea);
    const c = new THREE.Color();
    kinds.forEach((kind, n) => { c.set(waterColour(kind, d)); colours[n * 3] = c.r; colours[n * 3 + 1] = c.g; colours[n * 3 + 2] = c.b; });
    if (bodyGeometry) (bodyGeometry.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
  };
  recolour(dressing);
  return {
    sea, bodies, recolour,
    dispose() { seaGeometry.dispose(); seaMaterial.dispose(); bodyGeometry?.dispose(); bodyMaterial?.dispose(); },
  };
}
