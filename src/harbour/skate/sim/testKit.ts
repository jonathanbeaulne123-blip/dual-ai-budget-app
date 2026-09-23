/**
 * SIM · test kit: a small reference catalog, a driver loop and a seeded RNG,
 * shared by test/skate-sim*.test.ts and usable by integration tests. Not
 * imported by the runtime.
 */
import { SKATE_NO_INTENT, type FlipTrickDef, type GrabDef, type GrindDef, type SkateField, type SkateIntent, type SkatePresent, type SkateSimEvent } from '../contract.ts';
import { createSkateSim, type SkateSim, type SkateSimOptions } from './index.ts';

const flip = (id: string, roll: number, yaw: number, duration: number, difficulty: number): FlipTrickDef =>
  ({ id, name: id, gesture: ['tail'], roll, yaw, pitch: 0, duration, points: 100, difficulty });
export const FLIPS: ReadonlyMap<string, FlipTrickDef> = new Map([
  flip('kickflip', 1, 0, 0.36, 0.3), flip('heelflip', -1, 0, 0.36, 0.3), flip('pop-shuvit', 0, 1, 0.3, 0.2), flip('360-flip', 1, 2, 0.5, 0.7),
].map((d) => [d.id, d]));
const grind = (id: string, contact: GrindDef['contact'], deckYaw: number, deckPitch: number, difficulty = 0.3): GrindDef =>
  ({ id, name: id, contact, deckYaw, deckPitch, points: 100, difficulty });
const Q = Math.PI / 2;
export const GRINDS: ReadonlyMap<string, GrindDef> = new Map([
  grind('50-50', 'both-trucks', 0, 0, 0.2), grind('5-0', 'back-truck', 0, -0.25), grind('nosegrind', 'front-truck', 0, 0.25),
  grind('boardslide', 'deck', Q, 0), grind('lipslide', 'deck', -Q, 0, 0.4), grind('tailslide', 'tail', Q, -0.2, 0.5), grind('noseslide', 'nose', -Q, 0.2, 0.5),
  grind('smith', 'back-truck', -0.45, -0.2, 0.6), grind('feeble', 'back-truck', 0.45, -0.2, 0.5),
  grind('crooked', 'front-truck', 0.3, 0.2, 0.5), grind('overcrook', 'front-truck', -0.3, 0.2, 0.6),
].map((d) => [d.id, d]));
export const GRABS: ReadonlyMap<string, GrabDef> = new Map([
  { id: 'indy', name: 'Indy', hand: 'back', edge: 'toe', points: 100 } as GrabDef,
  { id: 'melon', name: 'Melon', hand: 'front', edge: 'heel', points: 100 } as GrabDef,
].map((d) => [d.id, d]));
export const CATALOGS = { flips: FLIPS, grinds: GRINDS, grabs: GRABS };

export const intent = (extra: Partial<SkateIntent> = {}): SkateIntent => ({ ...SKATE_NO_INTENT, ...extra });

export function makeSim(field: SkateField, o: Partial<SkateSimOptions> = {}): SkateSim {
  return createSkateSim(field, CATALOGS, { x: 0, z: 0, yaw: 0, stance: 'regular', ...o });
}

/** Give the rider a velocity (and optionally board yaw / height) through the checkpoint API. */
export function kick(sim: SkateSim, v: { vx?: number; vy?: number; vz?: number; yaw?: number; y?: number }): void {
  const s = sim.save() as Record<string, unknown>;
  if (v.vx !== undefined) s.vx = v.vx;
  if (v.vy !== undefined) s.vy = v.vy;
  if (v.vz !== undefined) s.vz = v.vz;
  if (v.yaw !== undefined) s.boardYaw = v.yaw;
  if (v.y !== undefined) s.y = v.y;
  sim.load(s);
}

export type Frame = { t: number; p: SkatePresent; events: SkateSimEvent[] };
/**
 * Drive the sim for `seconds` at `hz`. `drive` gives the intent for each
 * frame (time since start, current present). Returns every event (copied)
 * and a per-frame trace of copied presents when `trace` is set.
 */
export function ride(sim: SkateSim, seconds: number, drive: SkateIntent | ((t: number, p: SkatePresent) => SkateIntent), hz = 60, trace = false) {
  const events: SkateSimEvent[] = [];
  const frames: Frame[] = [];
  const n = Math.round(seconds * hz);
  for (let i = 0; i < n; i++) {
    const t = i / hz;
    const it = typeof drive === 'function' ? drive(t, sim.present()) : drive;
    const r = sim.step(it, 1 / hz);
    events.push(...r.events);
    if (trace) frames.push({ t: (i + 1) / hz, p: { ...r.present, trick: r.present.trick && { ...r.present.trick }, grab: r.present.grab && { ...r.present.grab }, grind: r.present.grind && { ...r.present.grind }, bail: r.present.bail && { ...r.present.bail } }, events: [...r.events] });
  }
  return { events, frames, present: sim.present() };
}

export const kinds = (events: readonly SkateSimEvent[]): string[] => events.map((e) => e.kind);
export function first<K extends SkateSimEvent['kind']>(events: readonly SkateSimEvent[], kind: K): Extract<SkateSimEvent, { kind: K }> | undefined {
  return events.find((e) => e.kind === kind) as Extract<SkateSimEvent, { kind: K }> | undefined;
}
export function all<K extends SkateSimEvent['kind']>(events: readonly SkateSimEvent[], kind: K): Extract<SkateSimEvent, { kind: K }>[] {
  return events.filter((e) => e.kind === kind) as Extract<SkateSimEvent, { kind: K }>[];
}

/** Deterministic LCG for fuzzing (no Math.random in sim tests either). */
export function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
