/**
 * The Water's Way on the Journey map: the neighbourhood buildings at or above the Journey height (`JOURNEY_MIN_HEIGHT`)
 * as plain blocks under a pyramid roof on their baked footprint (the grammar's `buildingJourneyShape`, carried by the
 * index), and every story landmark as a slim needle glyph rising to its sighted top. One merged, unlit mesh (one draw
 * call), baked shading from the land's low north-west sun, heights compressed like the hosts (`HEIGHT_COMPRESSION`).
 * Full: blocks and glyphs (12 + 16 triangles each). Lite: the glyphs only.
 */
import * as THREE from "three";
import type { JourneyLandData, JourneyLandDressing } from "../contracts.ts";
import { compressHeight, HEIGHT_COMPRESSION } from "../contracts.ts";
import type { LandSurface } from "./surface.ts";

export const DRESSING_MAP_NAME = "journey-land-dressing";
const SINK = 0.4, SUN = new THREE.Vector3(-0.62, 0.7, -0.55).normalize();
/** Landmark glyph: base half-width, top half-width (eu at map scale) and the diamond cap's height. */
export const LANDMARK_GLYPH = { base: 1.6, top: 0.5, cap: 2.4 } as const;

type Paint = 0 | 1 | 2; // wall, roof, landmark
type V3 = [number, number, number];
export type DressingMapMeshes = { mesh: THREE.Mesh | null; recolour(d: JourneyLandDressing): void; dispose(): void };

export function buildDressingMap(data: Pick<JourneyLandData, "dressing">, surface: Pick<LandSurface, "heightAt">, dressing: JourneyLandDressing, tier: "full" | "lite" = "full"): DressingMapMeshes {
  const d = data.dressing;
  if (!d || (!d.buildings.length && !d.landmarks.length)) return { mesh: null, recolour() {}, dispose() {} };
  // Lite keeps the landmarks (the story's verticals) and drops the blocks: the lite land is within a few hundred
  // triangles of its 15k budget (lite drops, never substitutes).
  const blocks = tier === "full" ? d.buildings : [];
  const pos: number[] = [], shadeOf: number[] = [], paintOf: number[] = [];
  const tri = (a: V3, b: V3, c: V3, paint: Paint) => {
    const n = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).cross(new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2])).normalize();
    const lit = 0.62 + 0.38 * Math.max(0, Math.abs(n.y) > 0.99 ? 1 : n.dot(SUN));
    for (const p of [a, b, c]) { pos.push(p[0], p[1], p[2]); shadeOf.push(lit); paintOf.push(paint); }
  };
  for (const b of blocks) {
    const ring = b.footprint, n = ring.length, pad = compressHeight(b.base);
    const base = Math.min(pad, ...ring.map((p) => surface.heightAt(p[0], p[1]))) - SINK, eave = pad + b.height * HEIGHT_COMPRESSION.buildingScale, apex = eave + b.roofHeight * HEIGHT_COMPRESSION.buildingScale;
    const cx = ring.reduce((s, p) => s + p[0], 0) / n, cz = ring.reduce((s, p) => s + p[1], 0) / n;
    for (let i = 0; i < n; i++) {
      const p = ring[i]!, q = ring[(i + 1) % n]!;
      tri([p[0], base, p[1]], [q[0], base, q[1]], [q[0], eave, q[1]], 0); tri([p[0], base, p[1]], [q[0], eave, q[1]], [p[0], eave, p[1]], 0);
      tri([p[0], eave, p[1]], [q[0], eave, q[1]], [cx, apex, cz], 1);
    }
  }
  for (const l of d.landmarks) {
    const y0 = compressHeight(l.at[1]) - SINK, y1 = compressHeight(l.at[1]) + Math.max(2, l.top[1] - l.at[1]) * HEIGHT_COMPRESSION.buildingScale, x = l.top[0], z = l.top[2];
    const g = LANDMARK_GLYPH, at = (r: number, y: number, k: number): V3 => [x + Math.cos(k * Math.PI / 2 + Math.PI / 4) * r, y, z + Math.sin(k * Math.PI / 2 + Math.PI / 4) * r];
    for (let k = 0; k < 4; k++) {
      tri(at(g.base, y0, k), at(g.base, y0, k + 1), at(g.top, y1, k + 1), 2); tri(at(g.base, y0, k), at(g.top, y1, k + 1), at(g.top, y1, k), 2);
      // The diamond cap: four facets up to a point, four down to the needle's top (reads at Sky as a marker).
      tri(at(g.top * 2.2, y1 + g.cap * 0.45, k), at(g.top * 2.2, y1 + g.cap * 0.45, k + 1), [x, y1 + g.cap, z], 1);
      tri(at(g.top * 2.2, y1 + g.cap * 0.45, k + 1), at(g.top * 2.2, y1 + g.cap * 0.45, k), [x, y1, z], 1);
    }
  }
  const geometry = new THREE.BufferGeometry(), colours = new Float32Array(pos.length);
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  geometry.computeBoundingSphere();
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  material.name = DRESSING_MAP_NAME;
  const mesh = new THREE.Mesh(geometry, material); mesh.name = DRESSING_MAP_NAME;
  const recolour = (theme: JourneyLandDressing) => {
    const swatch = [new THREE.Color(theme.hostWall), new THREE.Color(theme.hostRoof), new THREE.Color(theme.hostRoof).lerp(new THREE.Color(theme.hostWall), 0.25)];
    for (let i = 0; i < paintOf.length; i++) { const c = swatch[paintOf[i]!]!, k = shadeOf[i]!; colours[i * 3] = c.r * k; colours[i * 3 + 1] = c.g * k; colours[i * 3 + 2] = c.b * k; }
    (geometry.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
  };
  recolour(dressing);
  return { mesh, recolour, dispose() { geometry.dispose(); material.dispose(); } };
}
