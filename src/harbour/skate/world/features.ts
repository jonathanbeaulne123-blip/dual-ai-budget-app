/**
 * Tideline Skate Club v2 · world — feature primitives.
 *
 * Every rideable shape is an analytic height function in its own local frame
 * (lx across, lz along its "forward"), returning height above its pad plane
 * AND the exact local gradient, so normals never come from finite differences.
 * The same instances drive `field.ts` (physics) and `meshes.ts` (render).
 *
 * Authoring types (`*Def`) are plain data in `layout.ts`, in the spot's frame.
 */
import type { GrindableKind, SurfaceKind } from '../contract.ts';
import { arcFor, arcHeight, arcSlope, bankFor, bankHeight, bankSlope, sdRoundRect, type Arc, type Bank, type Frame } from './profiles.ts';

/** Width of the strip at the top of a transition that carries `lip` (world units). Wider than one 1/120 s step at 13 u/s. */
export const LIP_BAND = 0.15;
/**
 * Authored "true vert" angle (the Chimney, the Kettle). Every COPING lip —
 * quarterpipe, mini and bowl — is flagged `vert` whatever its angle (integration
 * decision 2026-09-23, per the sim's contract: airs off a transition go straight
 * up and come back in, as in a skate game); only kicker lips launch along the
 * tangent. Kept for the kicker arc clamp and for tests.
 */
export const VERT_DEG = 80;
/** Coping pipe top above the lip line, and its radius. */
export const COPE_TOP = 0.03;
export const COPE_RADIUS = 0.042;
export const RAIL_RADIUS = 0.034;

/* ------------------------------------------------------------------ authoring */

type Base = { id: string; name: string; at: readonly [number, number]; yaw?: number; kind?: SurfaceKind };
export type LedgeSide = { side: '+x' | '-x' | '+z' | '-z'; name?: string; kind?: GrindableKind; span?: readonly [number, number] };
/** Rises along +lz from its toe at `at`; lip at lz = T; deck behind to lz = T + deck. */
export type QuarterDef = Base & { type: 'quarter'; width: number; height: number; angle: number; deck: number };
/** Two facing quarters, centred on `at`, flat bottom along lz. */
export type MiniDef = Base & { type: 'mini'; width: number; height: number; angle: number; flat: number; deck: number };
/** A raised block with a rounded-rectangle bowl sunk into it (floor at the pad). */
export type BowlDef = Base & { type: 'bowl'; floor: readonly [number, number]; corner: number; depth: number; angle: number; block: readonly [number, number] };
/** Rises along +lz from 0 at its toe (`at`) to `rise` at lz = run. */
export type BankDef = Base & { type: 'bank'; width: number; run: number; rise: number; fillet?: number };
/** A launch ramp: arc from its toe at `at` to a non-vert lip; open back. */
export type KickerDef = Base & { type: 'kicker'; width: number; height: number; angle: number };
export type BoxRole = 'ledge' | 'manual' | 'platform' | 'bench' | 'curb' | 'landing' | 'deck';
export type BoxDef = Base & { type: 'box'; half: readonly [number, number]; height: number; role: BoxRole; ledges?: readonly LedgeSide[] };
/** Descends along +lz from its top nosing at `at` (lz = 0, height steps·rise, owned by the platform) in `steps` risers. */
export type StairsDef = Base & { type: 'stairs'; width: number; steps: number; rise: number; run: number };
/** A ledge whose top follows a piecewise-linear [lz, h] profile (a hubba down a stair). */
export type HubbaDef = Base & { type: 'hubba'; width: number; profile: readonly (readonly [number, number])[]; ledges?: readonly ('+x' | '-x')[] };
/** A flat-topped box with C1 banks on any side that has a run (hips where two meet). */
export type FunboxDef = Base & { type: 'funbox'; half: readonly [number, number]; height: number; runs: { px?: number; nx?: number; pz?: number; nz?: number }; fillet?: number; ledges?: readonly LedgeSide[] };
/** Rails are authored in the spot's frame: [x, z, height above the pad plane]. */
export type RailDef = { type: 'rail'; id: string; name: string; kind: 'round-rail' | 'kinked-rail'; points: readonly (readonly [number, number, number])[] };
/** Never rideable: planters (with grindable rims), posts, bollards, lanterns. */
export type PlanterDef = { type: 'planter'; id: string; name: string; at: readonly [number, number]; yaw?: number; half: readonly [number, number]; height: number; ledges?: readonly LedgeSide[] };
export type PostDef = { type: 'post'; id: string; at: readonly [number, number]; r: number; height: number; look: 'lantern' | 'bollard' | 'sign' | 'bin' };

export type SurfaceDef = QuarterDef | MiniDef | BowlDef | BankDef | KickerDef | BoxDef | StairsDef | HubbaDef | FunboxDef;
export type FeatureDef = SurfaceDef | RailDef | PlanterDef | PostDef;

/* ------------------------------------------------------------------ runtime */

/** Scratch written by `evalLocal`. Heights are above the pad plane; gradient is local. */
export type Hit = {
  h: number; gx: number; gz: number; kind: SurfaceKind;
  lip: boolean; lipX: number; lipZ: number; vert: boolean;
};
export const newHit = (): Hit => ({ h: 0, gx: 0, gz: 0, kind: 'concrete', lip: false, lipX: 0, lipZ: 0, vert: false });

/** A linear pad plane in world coordinates: y = y0 + gx·(x − x0) + gz·(z − z0). */
export type Plane = { readonly x0: number; readonly z0: number; readonly y0: number; readonly gx: number; readonly gz: number };
export const planeAt = (p: Plane, x: number, z: number): number => p.y0 + p.gx * (x - p.x0) + p.gz * (z - p.z0);

export type SurfaceShape = {
  readonly def: SurfaceDef;
  readonly id: string;
  readonly frame: Frame;
  readonly plane: Plane;
  /** Local bounds of the footprint. */
  readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number;
  /** Returns false outside the footprint. */
  evalLocal(lx: number, lz: number, o: Hit): boolean;
};

const kindOf = (def: SurfaceDef): SurfaceKind => def.kind ?? (def.type === 'quarter' || def.type === 'mini' || def.type === 'kicker' ? 'wood' : def.type === 'box' && def.role === 'bench' ? 'wood' : 'concrete');

function flat(o: Hit, h: number, kind: SurfaceKind): true {
  o.h = h; o.gx = 0; o.gz = 0; o.kind = kind; o.lip = false; o.vert = false; return true;
}

export class QuarterShape implements SurfaceShape {
  readonly id: string; readonly arc: Arc; readonly minX: number; readonly maxX: number; readonly minZ = 0; readonly maxZ: number; readonly vert: boolean; private readonly kind: SurfaceKind;
  constructor(readonly def: QuarterDef, readonly frame: Frame, readonly plane: Plane) {
    this.id = def.id; this.arc = arcFor(def.height, def.angle); this.minX = -def.width / 2; this.maxX = def.width / 2; this.maxZ = this.arc.T + def.deck;
    this.vert = true; this.kind = kindOf(def);
  }
  evalLocal(lx: number, lz: number, o: Hit): boolean {
    if (lx < this.minX || lx > this.maxX || lz < 0 || lz > this.maxZ) return false;
    const a = this.arc;
    if (lz >= a.T) return flat(o, a.H, this.kind);
    o.h = arcHeight(a, lz); o.gx = 0; o.gz = arcSlope(a, lz); o.kind = this.kind;
    o.lip = lz >= a.T - LIP_BAND; o.lipX = 0; o.lipZ = 1; o.vert = this.vert; return true;
  }
}

export class MiniShape implements SurfaceShape {
  readonly id: string; readonly arc: Arc; readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number; readonly vert: boolean; private readonly kind: SurfaceKind; readonly half: number;
  constructor(readonly def: MiniDef, readonly frame: Frame, readonly plane: Plane) {
    this.id = def.id; this.arc = arcFor(def.height, def.angle); this.minX = -def.width / 2; this.maxX = def.width / 2;
    this.half = def.flat / 2 + this.arc.T + def.deck; this.minZ = -this.half; this.maxZ = this.half; this.vert = true; this.kind = kindOf(def);
  }
  evalLocal(lx: number, lz: number, o: Hit): boolean {
    if (lx < this.minX || lx > this.maxX || lz < this.minZ || lz > this.maxZ) return false;
    const sign = lz < 0 ? -1 : 1, s = Math.abs(lz) - this.def.flat / 2, a = this.arc;
    if (s <= 0) return flat(o, 0, this.kind);
    if (s >= a.T) return flat(o, a.H, this.kind);
    o.h = arcHeight(a, s); o.gx = 0; o.gz = sign * arcSlope(a, s); o.kind = this.kind;
    o.lip = s >= a.T - LIP_BAND; o.lipX = 0; o.lipZ = sign; o.vert = this.vert; return true;
  }
}

export class BowlShape implements SurfaceShape {
  readonly id: string; readonly arc: Arc; readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number; readonly vert: boolean; private readonly kind: SurfaceKind;
  private readonly sd = new Float64Array(3);
  constructor(readonly def: BowlDef, readonly frame: Frame, readonly plane: Plane) {
    this.id = def.id; this.arc = arcFor(def.depth, def.angle);
    this.minX = -def.block[0]; this.maxX = def.block[0]; this.minZ = -def.block[1]; this.maxZ = def.block[1]; this.vert = true; this.kind = kindOf(def);
    if (def.floor[0] + this.arc.T > def.block[0] - 0.2 || def.floor[1] + this.arc.T > def.block[1] - 0.2) throw new Error(`bowl ${def.id}: deck too narrow`);
  }
  evalLocal(lx: number, lz: number, o: Hit): boolean {
    if (lx < this.minX || lx > this.maxX || lz < this.minZ || lz > this.maxZ) return false;
    const d = this.def, sd = this.sd;
    sdRoundRect(lx, lz, d.floor[0], d.floor[1], d.corner, sd);
    const dist = sd[0]!, a = this.arc;
    if (dist <= 0) return flat(o, 0, this.kind);
    if (dist >= a.T) return flat(o, a.H, this.kind);
    const slope = arcSlope(a, dist);
    o.h = arcHeight(a, dist); o.gx = slope * sd[1]!; o.gz = slope * sd[2]!; o.kind = this.kind;
    o.lip = dist >= a.T - LIP_BAND; o.lipX = sd[1]!; o.lipZ = sd[2]!; o.vert = this.vert; return true;
  }
}

export class BankShape implements SurfaceShape {
  readonly id: string; readonly bank: Bank; readonly minX: number; readonly maxX: number; readonly minZ = 0; readonly maxZ: number; private readonly kind: SurfaceKind;
  constructor(readonly def: BankDef, readonly frame: Frame, readonly plane: Plane) {
    this.id = def.id; this.bank = bankFor(def.run, def.rise, def.fillet ?? 0.3); this.minX = -def.width / 2; this.maxX = def.width / 2; this.maxZ = def.run; this.kind = kindOf(def);
  }
  evalLocal(lx: number, lz: number, o: Hit): boolean {
    if (lx < this.minX || lx > this.maxX || lz < 0 || lz > this.maxZ) return false;
    o.h = bankHeight(this.bank, lz); o.gx = 0; o.gz = bankSlope(this.bank, lz); o.kind = this.kind; o.lip = false; o.vert = false; return true;
  }
}

export class KickerShape implements SurfaceShape {
  readonly id: string; readonly arc: Arc; readonly minX: number; readonly maxX: number; readonly minZ = 0; readonly maxZ: number; private readonly kind: SurfaceKind;
  constructor(readonly def: KickerDef, readonly frame: Frame, readonly plane: Plane) {
    this.id = def.id; this.arc = arcFor(def.height, Math.min(def.angle, VERT_DEG - 20)); this.minX = -def.width / 2; this.maxX = def.width / 2; this.maxZ = this.arc.T; this.kind = kindOf(def);
  }
  evalLocal(lx: number, lz: number, o: Hit): boolean {
    if (lx < this.minX || lx > this.maxX || lz < 0 || lz > this.maxZ) return false;
    const a = this.arc, lip = lz >= a.T - LIP_BAND;
    o.h = arcHeight(a, lz); o.gx = 0; o.gz = arcSlope(a, lz); o.kind = lip ? 'metal' : this.kind;
    o.lip = lip; o.lipX = 0; o.lipZ = 1; o.vert = false; return true;
  }
}

export class BoxShape implements SurfaceShape {
  readonly id: string; readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number; private readonly kind: SurfaceKind;
  constructor(readonly def: BoxDef, readonly frame: Frame, readonly plane: Plane) {
    this.id = def.id; this.minX = -def.half[0]; this.maxX = def.half[0]; this.minZ = -def.half[1]; this.maxZ = def.half[1]; this.kind = kindOf(def);
  }
  evalLocal(lx: number, lz: number, o: Hit): boolean {
    if (lx < this.minX || lx > this.maxX || lz < this.minZ || lz > this.maxZ) return false;
    return flat(o, this.def.height, this.kind);
  }
}

export class StairsShape implements SurfaceShape {
  readonly id: string; readonly minX: number; readonly maxX: number; readonly minZ = 0; readonly maxZ: number; private readonly kind: SurfaceKind;
  constructor(readonly def: StairsDef, readonly frame: Frame, readonly plane: Plane) {
    this.id = def.id; this.minX = -def.width / 2; this.maxX = def.width / 2; this.maxZ = (def.steps - 1) * def.run; this.kind = kindOf(def);
  }
  /** Height of tread k (0 = top landing … steps = bottom). */
  tread(k: number): number { return (this.def.steps - k) * this.def.rise; }
  evalLocal(lx: number, lz: number, o: Hit): boolean {
    if (lx < this.minX || lx > this.maxX || lz < 0 || lz >= this.maxZ) return false;
    const k = Math.min(this.def.steps - 1, Math.floor(lz / this.def.run) + 1);
    return flat(o, this.tread(k), this.kind);
  }
}

export class HubbaShape implements SurfaceShape {
  readonly id: string; readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number; private readonly kind: SurfaceKind;
  constructor(readonly def: HubbaDef, readonly frame: Frame, readonly plane: Plane) {
    this.id = def.id; this.minX = -def.width / 2; this.maxX = def.width / 2; this.minZ = def.profile[0]![0]; this.maxZ = def.profile[def.profile.length - 1]![0]; this.kind = kindOf(def);
  }
  heightAt(lz: number): number {
    const p = this.def.profile;
    for (let i = 1; i < p.length; i++) { const a = p[i - 1]!, b = p[i]!; if (lz <= b[0]) return a[1] + (b[1] - a[1]) * (lz - a[0]) / (b[0] - a[0]); }
    return p[p.length - 1]![1];
  }
  evalLocal(lx: number, lz: number, o: Hit): boolean {
    if (lx < this.minX || lx > this.maxX || lz < this.minZ || lz > this.maxZ) return false;
    const p = this.def.profile;
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1]!, b = p[i]!;
      if (lz <= b[0] || i === p.length - 1) { const m = (b[1] - a[1]) / (b[0] - a[0]); o.h = a[1] + m * (lz - a[0]); o.gx = 0; o.gz = m; break; }
    }
    o.kind = this.kind; o.lip = false; o.vert = false; return true;
  }
}

export class FunboxShape implements SurfaceShape {
  readonly id: string; readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number; private readonly kind: SurfaceKind;
  readonly banks: { px: Bank | null; nx: Bank | null; pz: Bank | null; nz: Bank | null };
  constructor(readonly def: FunboxDef, readonly frame: Frame, readonly plane: Plane) {
    this.id = def.id; this.kind = kindOf(def);
    const r = def.runs, f = def.fillet ?? 0.25, b = (run?: number) => run && run > 0 ? bankFor(run, def.height, f) : null;
    this.banks = { px: b(r.px), nx: b(r.nx), pz: b(r.pz), nz: b(r.nz) };
    this.minX = -def.half[0] - (r.nx ?? 0); this.maxX = def.half[0] + (r.px ?? 0); this.minZ = -def.half[1] - (r.nz ?? 0); this.maxZ = def.half[1] + (r.pz ?? 0);
  }
  evalLocal(lx: number, lz: number, o: Hit): boolean {
    if (lx < this.minX || lx > this.maxX || lz < this.minZ || lz > this.maxZ) return false;
    let h = this.def.height, gx = 0, gz = 0;
    const { px, nx, pz, nz } = this.banks;
    if (px) { const e = this.maxX - lx; if (e < px.run) { const v = bankHeight(px, e); if (v < h) { h = v; gx = -bankSlope(px, e); gz = 0; } } }
    if (nx) { const e = lx - this.minX; if (e < nx.run) { const v = bankHeight(nx, e); if (v < h) { h = v; gx = bankSlope(nx, e); gz = 0; } } }
    if (pz) { const e = this.maxZ - lz; if (e < pz.run) { const v = bankHeight(pz, e); if (v < h) { h = v; gz = -bankSlope(pz, e); gx = 0; } } }
    if (nz) { const e = lz - this.minZ; if (e < nz.run) { const v = bankHeight(nz, e); if (v < h) { h = v; gz = bankSlope(nz, e); gx = 0; } } }
    o.h = h; o.gx = gx; o.gz = gz; o.kind = this.kind; o.lip = false; o.vert = false; return true;
  }
}

export function makeShape(def: SurfaceDef, frame: Frame, plane: Plane): SurfaceShape {
  switch (def.type) {
    case 'quarter': return new QuarterShape(def, frame, plane);
    case 'mini': return new MiniShape(def, frame, plane);
    case 'bowl': return new BowlShape(def, frame, plane);
    case 'bank': return new BankShape(def, frame, plane);
    case 'kicker': return new KickerShape(def, frame, plane);
    case 'box': return new BoxShape(def, frame, plane);
    case 'stairs': return new StairsShape(def, frame, plane);
    case 'hubba': return new HubbaShape(def, frame, plane);
    case 'funbox': return new FunboxShape(def, frame, plane);
  }
}

export const isSurfaceDef = (d: FeatureDef): d is SurfaceDef => d.type !== 'rail' && d.type !== 'planter' && d.type !== 'post';
