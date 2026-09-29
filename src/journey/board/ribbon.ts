/**
 * The route ribbon (T3): one strip geometry for the whole window, three vertices across (edge · centre · edge), draped
 * on the compressed land 1.2 eu up. Width is a uniform (screen-constant, `ribbonWidth`), so zoom never rebuilds it.
 * Per vertex: its chapter's state (past worn solid / open bright / upcoming stakes-and-string), the distance to the
 * nearest crossing where this stretch passes UNDER (the gap), a lift near crossings where it passes OVER, whether the
 * point is over water (drawn as a boardwalk — the ribbon is presentation over real geography, and says so), and the
 * arc length (plank spacing).
 */
import * as THREE from "three";
import type { Point2, Point3, RouteSpace } from "../contracts.ts";
import { RENDER_ORDER } from "./layers.ts";
import { createRibbonMaterials, ribbonUniforms, type RibbonUniforms } from "./materials.ts";

/** Screen-constant ribbon width: clamp(14 px × world-per-pixel, 3, 40) eu (PLAN §A). */
export const RIBBON_PX = 14;
export function ribbonWidth(worldPerPixel: number): number {
  return Math.min(Math.max(RIBBON_PX * worldPerPixel, 3), 40);
}

const STATE_CODE = { past: 0, open: 1, upcoming: 2 } as const;
const OVER_REACH = 26;
const FAR = 1e6;

type Strip = { centre: Point3[]; state: number[]; gap: number[]; over: number[] };

/** Insert the exact crossing points into a centreline so the gap / lift are sharp there. */
function withCrossings(points: readonly Point3[], crossings: readonly Point2[]): Point3[] {
  if (!crossings.length) return [...points];
  const out: Point3[] = [points[0]!];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!, b = points[i]!;
    const dx = b[0] - a[0], dz = b[2] - a[2], len2 = dx * dx + dz * dz;
    const inserts: { t: number; p: Point3 }[] = [];
    for (const c of crossings) {
      if (len2 <= 0) continue;
      const t = ((c[0] - a[0]) * dx + (c[1] - a[2]) * dz) / len2;
      if (t <= 0 || t >= 1) continue;
      const px = a[0] + dx * t, pz = a[2] + dz * t;
      if (Math.hypot(px - c[0], pz - c[1]) > 0.5) continue;
      inserts.push({ t, p: [px, a[1] + (b[1] - a[1]) * t, pz] });
    }
    inserts.sort((x, y) => x.t - y.t);
    for (const ins of inserts) out.push(ins.p);
    out.push(b);
  }
  return out;
}

/** Is this board point over water (a boardwalk)? Default: never. */
export type WaterTest = (x: number, z: number) => boolean;

export function ribbonGeometry(route: RouteSpace, isWater: WaterTest = () => false): THREE.BufferGeometry {
  const positions: number[] = [], side: number[] = [], edge: number[] = [], state: number[] = [], gap: number[] = [], over: number[] = [];
  const water: number[] = [], arcs: number[] = [];
  const index: number[] = [];
  const stateOf = new Map(route.months.map((m) => [m.chapterId, STATE_CODE[m.state]]));
  let base = 0;
  for (const stretch of route.stretches) {
    const unders = route.crossings.filter((c) => c.underChapterId === stretch.chapterId).map((c) => c.at);
    const overs = route.crossings.filter((c) => c.overChapterId === stretch.chapterId).map((c) => c.at);
    const centre = withCrossings(stretch.points, [...unders, ...overs]);
    if (centre.length < 2) continue;
    const strip: Strip = { centre, state: [], gap: [], over: [] };
    const code = stateOf.get(stretch.chapterId) ?? 1;
    for (const p of centre) {
      strip.state.push(code);
      strip.gap.push(unders.reduce((m, c) => Math.min(m, Math.hypot(p[0] - c[0], p[2] - c[1])), FAR));
      const o = overs.reduce((m, c) => Math.min(m, Math.hypot(p[0] - c[0], p[2] - c[1])), FAR);
      strip.over.push(o < OVER_REACH ? 1 - (o / OVER_REACH) ** 2 : 0);
    }
    let arc = 0;
    for (let i = 0; i < centre.length; i += 1) {
      if (i > 0) arc += Math.hypot(centre[i]![0] - centre[i - 1]![0], centre[i]![2] - centre[i - 1]![2]);
      const wet = isWater(centre[i]![0], centre[i]![2]) ? 1 : 0;
      const prev = centre[Math.max(0, i - 1)]!, next = centre[Math.min(centre.length - 1, i + 1)]!;
      let tx = next[0] - prev[0], tz = next[2] - prev[2];
      const len = Math.hypot(tx, tz) || 1;
      tx /= len; tz /= len;
      const p = centre[i]!;
      for (const e of [-1, 0, 1]) {
        positions.push(p[0], p[1], p[2]);
        side.push(-tz, 0, tx);
        edge.push(e);
        state.push(strip.state[i]!);
        gap.push(strip.gap[i]!);
        over.push(strip.over[i]!);
        water.push(wet);
        arcs.push(arc);
      }
      if (i > 0) {
        const a = base + (i - 1) * 3, b = base + i * 3;
        index.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
      }
    }
    base += centre.length * 3;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("aSide", new THREE.Float32BufferAttribute(side, 3));
  g.setAttribute("aEdge", new THREE.Float32BufferAttribute(edge, 1));
  g.setAttribute("aState", new THREE.Float32BufferAttribute(state, 1));
  g.setAttribute("aGap", new THREE.Float32BufferAttribute(gap, 1));
  g.setAttribute("aOver", new THREE.Float32BufferAttribute(over, 1));
  g.setAttribute("aWater", new THREE.Float32BufferAttribute(water, 1));
  g.setAttribute("aArc", new THREE.Float32BufferAttribute(arcs, 1));
  g.setIndex(index);
  return g;
}

export type RibbonLayer = {
  group: THREE.Group;
  uniforms: RibbonUniforms;
  setRoute(route: RouteSpace): void;
  dispose(): void;
};

export function createRibbon(route: RouteSpace, isWater?: WaterTest): RibbonLayer {
  const uniforms = ribbonUniforms();
  const materials = createRibbonMaterials(uniforms);
  const group = new THREE.Group();
  group.name = "journey-board:ribbon";
  let geometry: THREE.BufferGeometry | null = null;
  const set = (r: RouteSpace) => {
    group.clear();
    geometry?.dispose();
    geometry = ribbonGeometry(r, isWater);
    const main = new THREE.Mesh(geometry, materials.main), ghost = new THREE.Mesh(geometry, materials.occluded);
    main.name = "journey-board:ribbon:main"; ghost.name = "journey-board:ribbon:ghost";
    main.frustumCulled = ghost.frustumCulled = false;
    main.renderOrder = RENDER_ORDER.board; ghost.renderOrder = RENDER_ORDER.ghost;
    group.add(main, ghost);
  };
  set(route);
  return {
    group, uniforms, setRoute: set,
    dispose() { geometry?.dispose(); materials.main.dispose(); materials.occluded.dispose(); group.removeFromParent(); group.clear(); },
  };
}
