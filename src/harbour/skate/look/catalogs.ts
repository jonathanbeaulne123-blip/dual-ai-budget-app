import type { FlipTrickDef, GrabDef, GrindDef } from '../contract.ts';

/**
 * The trick catalogs as the look consumes them. The TRICKS track owns the
 * real tables; the look accepts them as records, maps or arrays and falls
 * back to a few built-in shapes (so a partner off the wire, or an id the
 * catalog does not know, still animates plausibly).
 */
type Table<T extends { id: string }> = Readonly<Record<string, T>> | ReadonlyMap<string, T> | readonly T[];
export type SkateLookCatalogs = { flips?: Table<FlipTrickDef>; grabs?: Table<GrabDef>; grinds?: Table<GrindDef> };

export type LookDefs = {
  flip(id: string): FlipTrickDef | null;
  grab(id: string): GrabDef | null;
  grind(id: string): GrindDef | null;
};

const flip = (id: string, roll: number, yaw: number, pitch: number, duration = .5): FlipTrickDef =>
  ({ id, name: id, gesture: [], roll, yaw, pitch, duration, points: 0, difficulty: .5 });
/** Shapes for ids the catalog lacks (and for the v1 wire acts). */
export const FALLBACK_FLIPS: Readonly<Record<string, FlipTrickDef>> = Object.freeze({
  ollie: flip('ollie', 0, 0, 0, .1), kickflip: flip('kickflip', 1, 0, 0), heelflip: flip('heelflip', -1, 0, 0),
  shuvit: flip('shuvit', 0, 1, 0, .4), 'pop-shuvit': flip('pop-shuvit', 0, 1, 0, .4), 'fs-shuvit': flip('fs-shuvit', 0, -1, 0, .4),
  '360-shuvit': flip('360-shuvit', 0, 2, 0, .6), '360-flip': flip('360-flip', 1, 2, 0, .66), 'varial-kickflip': flip('varial-kickflip', 1, 1, 0, .56),
  'varial-heelflip': flip('varial-heelflip', -1, -1, 0, .56), hardflip: flip('hardflip', 1, -1, 0, .6), 'double-kickflip': flip('double-kickflip', 2, 0, 0, .7),
  impossible: flip('impossible', 0, 0, 1, .6), 'laser-flip': flip('laser-flip', -1, -2, 0, .7),
});
const grab = (id: string, hand: GrabDef['hand'], edge: GrabDef['edge']): GrabDef => ({ id, name: id, hand, edge, points: 0 });
export const FALLBACK_GRABS: Readonly<Record<string, GrabDef>> = Object.freeze({
  indy: grab('indy', 'back', 'toe'), melon: grab('melon', 'front', 'heel'), stalefish: grab('stalefish', 'back', 'heel'),
  mute: grab('mute', 'front', 'toe'), method: grab('method', 'front', 'heel'), 'nose-grab': grab('nose-grab', 'front', 'nose'),
  'tail-grab': grab('tail-grab', 'back', 'tail'), crail: grab('crail', 'back', 'nose'), grab: grab('grab', 'front', 'heel'),
});
const grind = (id: string, contact: GrindDef['contact'], deckYaw: number, deckPitch: number): GrindDef => ({ id, name: id, contact, deckYaw, deckPitch, points: 0, difficulty: .5 });
export const FALLBACK_GRINDS: Readonly<Record<string, GrindDef>> = Object.freeze({
  '50-50': grind('50-50', 'both-trucks', 0, 0), '5-0': grind('5-0', 'back-truck', 0, -.2), nosegrind: grind('nosegrind', 'front-truck', 0, .2),
  crooked: grind('crooked', 'front-truck', .3, .18), overcrook: grind('overcrook', 'front-truck', -.3, .18), smith: grind('smith', 'back-truck', .25, .22),
  feeble: grind('feeble', 'back-truck', -.25, .22), boardslide: grind('boardslide', 'deck', Math.PI / 2, 0), lipslide: grind('lipslide', 'deck', Math.PI / 2, 0),
  noseslide: grind('noseslide', 'nose', Math.PI / 2, .15), tailslide: grind('tailslide', 'tail', Math.PI / 2, -.15), grind: grind('grind', 'both-trucks', 0, 0),
});

function lookup<T extends { id: string }>(table: Table<T> | undefined, fallback: Readonly<Record<string, T>>): (id: string) => T | null {
  const map = new Map<string, T>();
  if (table) {
    if (table instanceof Map) for (const [k, v] of table) map.set(k, v);
    else if (Array.isArray(table)) for (const v of table as readonly T[]) map.set(v.id, v);
    else for (const [k, v] of Object.entries(table as Record<string, T>)) map.set(k, v);
  }
  return (id) => map.get(id) ?? fallback[id] ?? fallback[id.replace(/^(bs|fs|backside|frontside|switch|nollie|fakie)[-_ ]/, '')] ?? null;
}

export function resolveCatalogs(c: SkateLookCatalogs | LookDefs | undefined): LookDefs {
  if (c && typeof (c as LookDefs).flip === 'function') return c as LookDefs;
  const t = (c ?? {}) as SkateLookCatalogs;
  return { flip: lookup(t.flips, FALLBACK_FLIPS), grab: lookup(t.grabs, FALLBACK_GRABS), grind: lookup(t.grinds, FALLBACK_GRINDS) };
}

/* ------------------------------------------------------------------ grind styles */

/**
 * How a grind or slide is *worn*: the look's reading of a GrindDef. Everything
 * is in rider terms — `hz` weight toward the nose (+) or tail (−), `press`
 * extra bend in the front (+) or back (−) knee, `lift*` how far a foot rides
 * up off its bolts, `roll` the deck's roll toward the ledge face, `straddle`
 * a board across the rail with the body looking down the line.
 */
export type GrindStyle = {
  kind: 'truck' | 'board' | 'lip' | 'nose' | 'tail';
  hz: number; press: number; frontLift: number; backLift: number;
  roll: number; straddle: number; arms: number;
  /** Board height offset so the contact sits on the grindable's top line (board units). */
  seat: number;
  /** Pivot of the deck pitch along z. */
  pivotZ: number;
  /** Which way the board crosses the rail: +1 chest leads, −1 back leads (boardslide vs lipslide). */
  crossing: 1 | -1;
};

export function grindStyle(def: GrindDef, truckZ: number, halfLength: number, axleY: number, deckBottom: number): GrindStyle {
  const id = def.id.toLowerCase();
  const across = Math.abs(Math.sin(def.deckYaw)) > .7;
  const base: GrindStyle = { kind: 'truck', hz: 0, press: 0, frontLift: 0, backLift: 0, roll: 0, straddle: 0, arms: .75, seat: -(axleY - .012), pivotZ: 0, crossing: 1 };
  if (def.contact === 'back-truck') { base.hz = -.07; base.pivotZ = -truckZ; base.press = -.25; }
  if (def.contact === 'front-truck') { base.hz = .07; base.pivotZ = truckZ; base.press = .25; }
  if (def.contact === 'deck') { base.kind = /lip/.test(id) ? 'lip' : 'board'; base.seat = -deckBottom; base.straddle = 1; base.arms = 1; base.crossing = base.kind === 'lip' ? -1 : 1; }
  if (def.contact === 'nose') { base.kind = 'nose'; base.seat = -deckBottom - .03; base.pivotZ = halfLength * .8; base.hz = .11; base.press = .4; base.straddle = across ? .6 : 0; }
  if (def.contact === 'tail') { base.kind = 'tail'; base.seat = -deckBottom - .03; base.pivotZ = -halfLength * .8; base.hz = -.11; base.press = -.4; base.straddle = across ? .6 : 0; base.crossing = -1; }
  if (/crook|crooked/.test(id)) { base.press = .7; base.hz = .1; base.roll = .12; base.arms = .6; }
  if (/overcrook/.test(id)) { base.roll = -.18; }
  if (/smith/.test(id)) { base.press = -.8; base.frontLift = .05; base.roll = .32; base.hz = -.09; }
  if (/feeble/.test(id)) { base.press = -.6; base.frontLift = .03; base.roll = -.28; base.hz = -.08; }
  if (/5-?0|five/.test(id) && !/50-50/.test(id)) { base.hz = -.1; base.press = -.35; }
  if (/nosegrind/.test(id)) { base.hz = .1; base.press = .35; }
  if (/blunt/.test(id)) { base.press *= 1.3; base.hz *= 1.3; }
  return base;
}

/* ------------------------------------------------------------------ grab points */

/**
 * Where on the board a grab's hand goes, in board space for a rider whose toes
 * face +x (`toeSign` flips it) with the nose at +z. Indy between the feet on
 * the toe edge; stalefish behind the back leg on the heel edge; method pulls
 * the board up behind; nose/tail grabs at the tips.
 */
export type GrabPose = { x: number; z: number; hand: 'front' | 'back'; boardRoll: number; boardPitch: number; lift: number; boardX: number; lean: number; tip: number };
export function grabPose(def: GrabDef, toeSign: number, halfWidth: number, halfLength: number): GrabPose {
  const id = def.id.toLowerCase();
  const side = def.edge === 'toe' ? toeSign : def.edge === 'heel' ? -toeSign : 0;
  const zEdge = def.edge === 'nose' ? halfLength * .86 : def.edge === 'tail' ? -halfLength * .86 : def.hand === 'front' ? .05 : -.04;
  const p: GrabPose = {
    x: side * halfWidth * .92, z: zEdge, hand: def.hand,
    // Toe grabs tweak the toe edge up; heel grabs the heel edge. (Board roll +z raises +x.)
    boardRoll: side * .22, boardPitch: def.edge === 'nose' ? -.3 : def.edge === 'tail' ? .3 : 0,
    lift: .06, boardX: 0, lean: def.edge === 'heel' ? -.15 : .35, tip: 0,
  };
  if (id === 'stalefish') p.z = -.13;
  if (id === 'indy') p.z = -.01;
  if (id === 'mute') p.z = .07;
  if (id === 'method') { p.boardRoll = side * .62; p.boardX = -toeSign * .07; p.lift = .1; p.z = .02; p.lean = -.25; }
  if (id === 'crail') { p.boardPitch = -.25; }
  return p;
}
