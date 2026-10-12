/**
 * The Water's Way plant geometry's drawing core (shared by `wwGeometry.ts` and the Old Oak's `oak.ts`): the unit-frame
 * vector type, the look a geometry is built for, the body + ink-shell writer pair and the deterministic hash stream.
 * Its own module so that `oak.ts` does not import `wwGeometry.ts` (which dispatches to the oak): an import cycle between
 * them deadlocks the bake's bundled async module inits (esbuild `__esm`, under terrainBase's top-level await; D-WW119).
 */
import * as THREE from 'three';
import { Writer } from './geometry.ts';
import type { RGB } from '../../../art/cardKit.ts';
import type { PlantSeason } from './archetypes.ts';
import type { BloomStage } from './sets.ts';

export type V = readonly [number, number, number];
export type WWLook = { season: PlantSeason; month: number; stage: BloomStage };
export type WWGeometry = { body: THREE.BufferGeometry; shell: THREE.BufferGeometry | null };

/** aInk length for v2's 0.09 eu rim (the shader pushes by aInk × 0.07). */
export const INK_RIM = 0.09 / 0.07;
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a: V): V => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const hashRand = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

/** Body and shell writers for one unit geometry. `crown` flags vertices that ride a palm's trunk stretch. */
export class Draw {
  readonly body = new Writer();
  readonly shell: Writer | null;
  crown = 0;
  constructor(readonly full: boolean, withShell: boolean) { this.shell = full && withShell ? new Writer() : null; }
  /** One triangle facing away from `centre` (or along `hint`), with an optional shell copy pushed out by `ink`. */
  tri(a: V, b: V, c: V, ca: RGB, cb: RGB, cc: RGB, centre: V | null, hint?: V, ink = 0) {
    const mid: V = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3], h = hint ?? (centre ? sub(mid, centre) : undefined);
    this.body.tri(a, b, c, ca, cb, cc, h, { crown: this.crown });
    if (ink && this.shell && centre) {
      const d = (p: V): V => { const n = norm(sub(p, centre)); return [n[0] * ink, n[1] * ink, n[2] * ink]; };
      const k: RGB = [0, 0, 0]; this.shell.tri(a, b, c, k, k, k, h, { crown: this.crown, ink: [d(a), d(b), d(c)] });
    }
  }
  result(stretch: boolean): WWGeometry {
    return { body: this.body.geometry({ crown: stretch }), shell: this.shell && this.shell.p.length ? this.shell.geometry({ crown: stretch, ink: true }) : null };
  }
}
