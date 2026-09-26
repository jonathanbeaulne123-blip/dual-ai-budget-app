/**
 * The ground kernel (RIDE §2): one velocity writer, one heading writer, one lateral force,
 * one energy input, one landing, one collision response. Fixed step GROUND_DT with an
 * accumulator; no clock, no RNG; every mover hands it a GroundProfile and a ContactQuery.
 *
 * Step order (§2.2): (1) sample contact, (2) input → kick, grip, boost bookkeeping,
 * (3) gravity, roll, drag, (4) legs, (5) tyre + yaw torques, (6) integrate v, p, yaw,
 * (7) resolve contact (solids, lip, crest, water, landing, offbed), (8) events (pushed as they happen).
 *
 * The footprint (R2-05): the ground is read under wheels, not under one point. The centre is the median
 * of three samples across the deck (0, ±width/4); each truck is the highest of three (its centre line and
 * both wheels at ±width/2), carried to the truck's centre line through the centre plane's cross tilt.
 * A support point that reads a hole whose rims ±WHEEL_R along the travel both stand higher is bridged
 * (a wheel rolls over a seam narrower than itself); a gap wider than a wheel still reads as a drop.
 */
import {GROUND_DT, GROUND_MAX_SPEED, type ContactQuery, type ContactSample, type GroundEvent, type GroundInput, type GroundProfile, type GroundState, type XYZ} from './types.ts';
import {boardFrame, clamp, dot, gripStep, lateralGrip, anchorSwing, pendulumStep, slideEntry, slipOf, tangentSpeed, twistCheck, tyreStep, wrapAngle, yawStep} from './tyre.ts';
import {boostStep, legsStep} from './legs.ts';

/** Tests set `strict` so a non-finite state throws; production restores the step's starting state. */
export const groundGuard = {strict: false};

const POP_COYOTE = 0.09, POP_BUFFER = 0.12, POP_H0 = 0.16, POP_HCROUCH = 0.4;
const LIP_EVENT = 0.1, AIR_EPS = 0.004, STOP_SPEED = 0.15, FADE_AFTER = 0.6, FRAME_CLAMP = 0.1, ACC_EPS = 1e-9, KAPPA_MAX = 5;
const UP: XYZ = [0, 1, 0];
/** kernel: the wheel radius the footprint bridges with (RIDE's 5 cm wheel), and the least hole it bothers to bridge. */
const WHEEL_R = 0.05, HOLE = 0.01;

export function createGroundState(p: XYZ, heading: number): GroundState {
  return {
    p: [p[0], p[1], p[2]], v: [0, 0, 0], heading: wrapAngle(heading), yawRate: 0, grip: 1, lead: 1,
    contact: {on: true, kind: 'ground', n: [0, 1, 0], material: '', pace: 'fast', slope: 0, legal: true, pitch: 0},
    legs: {stroke: -1, crouch: 0, charge: 0, window: 0, boost: 0, cooldown: 0},
    offbedFor: 0, stopped: 0, airborneFor: 0, slideFor: 0, step: 0,
    latch: {prevPush: false, prevPop: false, prevCrouch: 0, popBuffer: 0, popped: false, kicked: false, side: 1, sliding: false, intoFor: 0, swingRef: 0, boostAccel: 0, kappa: 0},
  };
}

/** Derived, never stored: signed slip angle (rad), lead-corrected. */
export function slipAngle(state: GroundState): number { return slipOf(state.v, boardFrame(state.heading, state.lead, state.contact.on ? state.contact.n : UP)); }
/** Derived, never stored: tangent-plane speed (horizontal speed in the air). */
export function groundSpeed(state: GroundState): number { return tangentSpeed(state.v, state.contact.on ? state.contact.n : UP); }

export function isGroundStateFinite(s: GroundState): boolean {
  return [...s.p, ...s.v, s.heading, s.yawRate, s.grip, s.legs.charge, s.legs.stroke, s.latch.kappa, s.latch.boostAccel, s.latch.swingRef].every(Number.isFinite);
}
export function cloneGroundState(s: GroundState): GroundState {
  return {...s, p: [...s.p], v: [...s.v], contact: {...s.contact, n: [...s.contact.n]}, legs: {...s.legs}, latch: {...s.latch}};
}
function restore(into: GroundState, from: GroundState): void {
  Object.assign(into, cloneGroundState(from), {step: into.step});
  into.v = [0, 0, 0]; into.yawRate = 0;
}

/** Pure. One fixed step. Reads contact through `query`. Returns events. */
export function stepGround(state: GroundState, input: GroundInput, query: ContactQuery, profile: GroundProfile, events: GroundEvent[] = []): GroundEvent[] {
  const snap = groundGuard.strict ? null : cloneGroundState(state);
  state.step++;
  const L = state.latch;
  const popEdge = input.pop && !L.prevPop, pushEdge = input.push && !L.prevPush;
  if (state.contact.kind === 'ground') groundStep(state, input, query, profile, events, popEdge, pushEdge);
  else if (state.contact.kind === 'air') airStep(state, input, query, profile, events, popEdge);
  // 'rail' / 'wall' belong to the mover's components (RIDE §6.1); the kernel leaves them alone.
  L.prevPush = input.push; L.prevPop = input.pop; L.prevCrouch = clamp(input.crouch, 0, 1);
  const v = state.v, m = Math.hypot(v[0], v[1], v[2]);
  if (m > GROUND_MAX_SPEED) { const k = GROUND_MAX_SPEED / m; v[0] *= k; v[1] *= k; v[2] *= k; }
  if (!isGroundStateFinite(state)) {
    if (!snap) throw new Error(`ground kernel: non-finite state at step ${state.step}`);
    restore(state, snap);
  }
  return events;
}

/** Accumulator: advances by up to 0.1 s of wall time in GROUND_DT steps, latching `input` for the whole frame. */
export function advanceGround(state: GroundState, input: GroundInput, query: ContactQuery, profile: GroundProfile, dt: number, acc: { t: number }): GroundEvent[] {
  const events: GroundEvent[] = [];
  acc.t += Number.isFinite(dt) ? clamp(dt, 0, FRAME_CLAMP) : 0;
  while (acc.t >= GROUND_DT - ACC_EPS) { stepGround(state, input, query, profile, events); acc.t -= GROUND_DT; }
  return events;
}

/* ───────────────────────────── ground */

function groundStep(state: GroundState, input: GroundInput, q: ContactQuery, P: GroundProfile, ev: GroundEvent[], popEdge: boolean, pushEdge: boolean): void {
  const dt = GROUND_DT, L = state.latch, v = state.v, p = state.p;
  // (1) contact under the board.
  const p0: XYZ = [p[0], p[1], p[2]];
  let c0 = q.sample(p0[0], p0[2], p0[1]);
  // The ride line already sits on the footprint's ground; only a centre that reads below it (a seam) asks the footprint again.
  if (!c0 || c0.y < p0[1] - HOLE) c0 = footprintCentre(q, P, state, p0, c0, (m) => !m || m.y < p0[1] - HOLE);
  if (!c0) { toAir(state, ev, 'void'); airStep(state, input, q, P, ev, false); return; }
  if (q.submerged(p0[0], p0[2], p0[1])) { water(state, q, ev); return; }
  applyContact(state, c0);
  if (P.pop && (popEdge || L.popBuffer > 0)) { doPop(state, input, P, ev); airStep(state, input, q, P, ev, false); return; }
  L.popBuffer = 0;
  const n0 = c0.n, legal = c0.legal, roll = legal ? c0.roll : P.roll.offbed, pushGrip = legal ? c0.pushGrip : 0;
  let f = boardFrame(state.heading, state.lead, n0);
  let s = tangentSpeed(v, n0), beta = slipOf(v, f);
  // (2) input → kick-out, grip state, charge / window / release.
  slideEntry(state, input, P, s, ev);
  const gripPrev = gripStep(state, input, P, s, beta, dt, ev);
  boostStep(state, input, P, {s, beta, gripPrev, pushEdge, dt}, ev);
  // (3) gravity (tangent plane), rolling resistance by pace, drag.
  const g = P.g;
  v[0] += g * n0[1] * n0[0] * dt; v[1] += g * (n0[1] * n0[1] - 1) * dt; v[2] += g * n0[1] * n0[2] * dt;
  s = Math.hypot(v[0], v[1], v[2]);
  if (s > 0) { const k = Math.max(0, s - (roll + P.drag * s * s) * dt) / s; v[0] *= k; v[1] *= k; v[2] *= k; }
  // (4) legs.
  legsStep(state, input, P, {f, s: Math.hypot(v[0], v[1], v[2]), pushGrip, slope: c0.slope, dt}, v);
  // (5) the tyre, then the yaw torques.
  const G = lateralGrip(c0.grip, state.grip, P);
  const removal = tyreStep(v, f, G, dt);
  s = tangentSpeed(v, n0); beta = slipOf(v, f);
  pendulumStep(state, input, P, s, beta, G);
  yawStep(state, input, P, {s, beta, G, removal, dt});
  // (6) integrate.
  p[0] += v[0] * dt; p[1] += v[1] * dt; p[2] += v[2] * dt;
  state.heading = wrapAngle(state.heading + state.yawRate * dt);
  f = boardFrame(state.heading, state.lead, n0);
  twistCheck(state, slipOf(v, f), ev, P);
  // (7) contact.
  resolveContact(state, q, P, ev, p0, n0);
}

function resolveContact(state: GroundState, q: ContactQuery, P: GroundProfile, ev: GroundEvent[], p0: XYZ, n0: XYZ): void {
  const dt = GROUND_DT, v = state.v, p = state.p, L = state.latch;
  if (solids(state, q, P, ev, p0)) return;
  // Centre: the median of three across the deck; a hole under it that a wheel spans is bridged.
  const yFree = p0[1] + v[1] * dt - 0.5 * P.g * dt * dt;
  const c1 = footprintCentre(q, P, state, p, undefined, (m) => !m || m.y < yFree - AIR_EPS);
  if (!c1) { toAir(state, ev, 'void'); return; }
  if (q.submerged(p[0], p[2], c1.y)) { water(state, q, ev); return; }
  // Crest / drop-off: the ground falls away faster than the ballistic path → airborne, velocity intact (§6.2).
  // Decided before the lip: a centre over a real gap flies it; the trucks beyond it are not a wall to a hole's floor.
  if (c1.y < yFree - AIR_EPS) { toAir(state, ev, 'crest'); return; }
  const n1 = c1.n, half = P.contact.wheelbase / 2, hx = Math.sin(state.heading), hz = Math.cos(state.heading);
  // Trucks: each wheel's height above the centre's plane at that wheel; a truck's ground is its highest.
  const along = v[0] * hx + v[2] * hz, ts = along >= 0 ? 1 : -1, yq = c1.y + P.contact.stepMax;
  const lead = truckGround(q, P, p, hx, hz, half * ts, yq, n1), tail = truckGround(q, P, p, hx, hz, -half * ts, yq, n1);
  const leadRise = c1.y + planeRise(n1, hx * half * ts, hz * half * ts);
  // Lip: the leading truck's highest wheel stands more than stepMax above the centre's plane → a wall for the wheels.
  const leadLip = lead !== null && Math.abs(along) > 1e-3 && lead - leadRise > P.contact.stepMax;
  const centreLip = c1.y - p[1] > P.contact.stepMax;   // met side-on: the centre itself steps up
  if (leadLip || centreLip) {
    const f0 = boardFrame(state.heading, 1, n0);
    let into: number;
    if (leadLip) { into = dot(v, f0.a); v[0] -= f0.a[0] * into; v[1] -= f0.a[1] * into; v[2] -= f0.a[2] * into; }
    else { const dx = p[0] - p0[0], dz = p[2] - p0[2], m = Math.hypot(dx, dz) || 1; into = (v[0] * dx + v[2] * dz) / m; v[0] -= dx / m * into; v[2] -= dz / m * into; }
    p[0] = p0[0]; p[1] = p0[1]; p[2] = p0[2];
    if (Math.abs(into) > LIP_EVENT) ev.push({kind: 'lip', step: state.step, data: {speed: Math.abs(into)}});   // resting against it is silent
    if (Math.abs(into) > P.landing.wallBail) bail(state, ev, 'wall');
    return;
  }
  // Stay on the ground: project onto the new plane, keep the energy the height change allows (0.5–2× guard).
  const e2 = dot(v, v) - 2 * P.g * (c1.y - p[1]);
  const vn = dot(v, n1);
  v[0] -= vn * n1[0]; v[1] -= vn * n1[1]; v[2] -= vn * n1[2];
  const m = Math.hypot(v[0], v[1], v[2]);
  if (e2 > 0 && m > 0.2) { const k = clamp(Math.sqrt(e2) / m, 0.5, 2); v[0] *= k; v[1] *= k; v[2] *= k; }
  p[1] = c1.y;
  applyContact(state, c1);
  // Pitch from the trucks; a truck over a seam is bridged like the centre (else the pose would nod for a step).
  const [dx, dz] = travelDir(state);
  const truckAt = (y: number | null, o: number): number | null => {
    const want = c1.y + planeRise(n1, hx * o, hz * o);
    if (y !== null && y >= want - HOLE) return y;
    const b = bridgeAt(q, p[0] + hx * o, p[2] + hz * o, yq, dx, dz, y ?? -Infinity);
    return b ? b.y : y;
  };
  const ly = truckAt(lead, half * ts), ty = truckAt(tail, -half * ts);
  state.contact.pitch = ly !== null && ty !== null ? Math.atan2((ly - ty) * ts, P.contact.wheelbase) : 0;
  // Curvature proxy for the pump: how fast the normal turns toward the travel (concave > 0), smoothed.
  const s = tangentSpeed(v, n1);
  let kNew = 0;
  if (s > 0.3) { const dn: XYZ = [n1[0] - n0[0], n1[1] - n0[1], n1[2] - n0[2]]; kNew = clamp(-dot(dn, v) / (s * s * dt), -KAPPA_MAX, KAPPA_MAX); }
  L.kappa += (kNew - L.kappa) * (1 - Math.exp(-10 * dt));
  // Standstill and the bed's edge (§6.5).
  state.stopped = s < STOP_SPEED ? state.stopped + dt : 0;
  state.offbedFor = c1.legal ? 0 : state.offbedFor + dt;
  if (!c1.legal && Math.min(state.stopped, state.offbedFor) >= FADE_AFTER) fadeBack(state, q, ev, 'offbed');
}

/* ───────────────────────────── the footprint (R2-05) */

type Probe = ContactSample | null;
const yOf = (s: Probe): number => (s ? s.y : -Infinity);
/** The rise of the plane with normal n over a horizontal offset (ox, oz). */
function planeRise(n: XYZ, ox: number, oz: number): number { return -(n[0] * ox + n[2] * oz) / (Math.abs(n[1]) > 1e-6 ? n[1] : 1e-6); }
/** The horizontal travel direction (the heading when all but stopped): the axis the bridge probes lie on. */
function travelDir(state: GroundState): [number, number] {
  const m = Math.hypot(state.v[0], state.v[2]);
  return m > 1e-3 ? [state.v[0] / m, state.v[2] / m] : [Math.sin(state.heading), Math.cos(state.heading)];
}
/** Median of three by height, void lowest; a tie keeps the centre (c). */
function median3(c: Probe, l: Probe, r: Probe): Probe {
  const yc = yOf(c), yl = yOf(l), yr = yOf(r);
  if ((yl <= yc && yc <= yr) || (yr <= yc && yc <= yl)) return c;
  if ((yc <= yl && yl <= yr) || (yr <= yl && yl <= yc)) return l;
  return r;
}
/** A sample taken at a horizontal offset (ox, oz) from a point, carried back to that point through its own plane. */
function carried(s: Probe, ox: number, oz: number): Probe { return s && {...s, y: s.y + planeRise(s.n, -ox, -oz)}; }
/**
 * A wheel over a hole: probes ±WHEEL_R along (dx, dz). When both rims stand more than HOLE above `below`,
 * the point is bridged: the lower rim's sample, its height carried to (x, z) through its own plane. Else null.
 */
function bridgeAt(q: ContactQuery, x: number, z: number, y: number, dx: number, dz: number, below: number): Probe {
  const b = q.sample(x - dx * WHEEL_R, z - dz * WHEEL_R, y), f = q.sample(x + dx * WHEEL_R, z + dz * WHEEL_R, y);
  if (!b || !f) return null;
  const low = b.y <= f.y ? b : f, k = low === b ? WHEEL_R : -WHEEL_R;
  if (low.y - below <= HOLE) return null;
  return {...low, y: low.y + planeRise(low.n, dx * k, dz * k)};
}
/**
 * The centre's ground: the median of (centre, ±width/4 across the heading, each carried to the centre).
 * When `suspect(median)` (it would launch the board, or it reads below the ride line), the along probes
 * may bridge it. `c` reuses a centre sample already taken.
 */
function footprintCentre(q: ContactQuery, P: GroundProfile, state: GroundState, at: XYZ, c: Probe | undefined, suspect: (m: Probe) => boolean): Probe {
  const w = P.contact.width / 4, ax = Math.cos(state.heading), az = -Math.sin(state.heading), y = at[1];
  // The side samples are carried to the centre through their own planes: on a bank or a grade they read the centre's height.
  const m = median3(c === undefined ? q.sample(at[0], at[2], y) : c,
    carried(q.sample(at[0] + ax * w, at[2] + az * w, y), ax * w, az * w), carried(q.sample(at[0] - ax * w, at[2] - az * w, y), -ax * w, -az * w));
  if (!suspect(m)) return m;
  const [dx, dz] = travelDir(state);
  return bridgeAt(q, at[0], at[2], y, dx, dz, yOf(m)) ?? m;
}
/**
 * A truck at `o` metres along the heading: its centre-line point and both wheels (±width/2 across), each
 * carried to the truck's centre line through the centre plane n (a bank is not a lip); the highest. Null = void.
 */
function truckGround(q: ContactQuery, P: GroundProfile, p: XYZ, hx: number, hz: number, o: number, y: number, n: XYZ): number | null {
  const w = P.contact.width / 2, ax = hz, az = -hx, x0 = p[0] + hx * o, z0 = p[2] + hz * o, tilt = planeRise(n, ax * w, az * w);
  const c = q.sample(x0, z0, y), l = q.sample(x0 + ax * w, z0 + az * w, y), r = q.sample(x0 - ax * w, z0 - az * w, y);
  const best = Math.max(yOf(c), l ? l.y - tilt : -Infinity, r ? r.y + tilt : -Infinity);
  return best === -Infinity ? null : best;
}

/** Solids from the query: remove the into-component (axis-separated so the board slides along a wall). */
function solids(state: GroundState, q: ContactQuery, P: GroundProfile, ev: GroundEvent[], p0: XYZ): boolean {
  const p = state.p, v = state.v, dx = p[0] - p0[0], dz = p[2] - p0[2], r = P.contact.width / 2;
  if ((dx === 0 && dz === 0) || !q.blocked(p[0], p[2], p0[1], r, [dx, dz])) return false;
  let into: number;
  if (dx !== 0 && !q.blocked(p[0], p0[2], p0[1], r, [dx, 0])) { into = Math.abs(v[2]); v[2] = 0; p[2] = p0[2]; }
  else if (dz !== 0 && !q.blocked(p0[0], p[2], p0[1], r, [0, dz])) { into = Math.abs(v[0]); v[0] = 0; p[0] = p0[0]; }
  else { into = Math.hypot(v[0], v[2]); v[0] = 0; v[2] = 0; p[0] = p0[0]; p[2] = p0[2]; }
  p[1] = p0[1];
  if (into > LIP_EVENT) ev.push({kind: 'lip', step: state.step, data: {speed: into, solid: 1}});
  if (into > P.landing.wallBail) bail(state, ev, 'wall');
  return true;
}

function applyContact(state: GroundState, c: ContactSample): void {
  const k = state.contact;
  k.on = true; k.kind = 'ground'; k.n = [c.n[0], c.n[1], c.n[2]]; k.material = c.material; k.slope = c.slope; k.legal = c.legal;
  k.pace = c.legal ? c.pace : 'offbed';
}

/* ───────────────────────────── air */

function toAir(state: GroundState, ev: GroundEvent[], reason: string): void {
  const k = state.contact;
  k.on = false; k.kind = 'air'; k.n = [0, 1, 0]; k.pitch = 0;
  state.airborneFor = 0; state.latch.popped = false;
  ev.push({kind: 'airborne', step: state.step, data: {reason}});
}

function doPop(state: GroundState, input: GroundInput, P: GroundProfile, ev: GroundEvent[]): void {
  const h = POP_H0 + POP_HCROUCH * clamp(input.crouch, 0, 1), vp = Math.sqrt(2 * P.g * h);
  state.v[1] = Math.max(state.v[1], 0) + vp;
  toAir(state, ev, 'pop');
  state.latch.popped = true; state.latch.popBuffer = 0;
  const last = ev[ev.length - 1];
  if (last) last.data = {reason: 'pop', h};
}

function airStep(state: GroundState, input: GroundInput, q: ContactQuery, P: GroundProfile, ev: GroundEvent[], popEdge: boolean): void {
  const dt = GROUND_DT, v = state.v, p = state.p, L = state.latch;
  state.airborneFor += dt;
  if (popEdge && P.pop) {
    if (state.airborneFor <= POP_COYOTE && !L.popped) { doPop(state, input, P, ev); state.airborneFor = dt; }
    else L.popBuffer = POP_BUFFER;
  } else L.popBuffer = Math.max(0, L.popBuffer - dt);
  const p0: XYZ = [p[0], p[1], p[2]];
  v[1] -= P.g * dt;
  p[0] += v[0] * dt; p[1] += v[1] * dt; p[2] += v[2] * dt;
  state.heading = wrapAngle(state.heading + state.yawRate * dt);   // yawRate is the air spin
  if (solids(state, q, P, ev, p0)) { p[1] = p0[1] + v[1] * dt; if (state.contact.kind !== 'air') return; }
  if (q.submerged(p[0], p[2], p[1])) { water(state, q, ev); return; }
  let c = q.sample(p[0], p[2], p[1]);
  // The footprint lands too: a centre over a seam lands on the deck its wheels meet, not on what lies below.
  if (!c || c.y < p[1]) c = footprintCentre(q, P, state, p, c, (m) => !m || m.y < p[1]);
  if (c && c.y >= p[1] && state.airborneFor > dt * 0.5) land(state, input, c, P, ev);
}

/**
 * One landing rule (§6.3): remove the normal component, keep speed by the impact rule, bail on hard impact only.
 * grip = min(grip, cos²β): a sideways landing lands in a slide, and a landing never re-grips a slide (a deck
 * micro-hop mid-slide neither ends it nor skips the release window's grip crossing).
 */
function land(state: GroundState, input: GroundInput, c: ContactSample, P: GroundProfile, ev: GroundEvent[]): void {
  const v = state.v, n = c.n, vn = -dot(v, n), impact = Math.max(0, vn);
  state.p[1] = c.y; applyContact(state, c);
  const airTime = state.airborneFor;
  state.airborneFor = 0;
  const crouched = input.crouch >= 0.5, fg = clamp(P.landing.forgiveness, 0, 1);
  const limit = (crouched ? P.landing.hardImpactCrouched : P.landing.hardImpact) * (1 + fg);
  ev.push({kind: 'land', step: state.step, data: {impact, airTime}});
  if (impact > limit) { bail(state, ev, 'impact'); return; }
  if (vn > 0) { v[0] += n[0] * vn; v[1] += n[1] * vn; v[2] += n[2] * vn; }
  const keep = clamp(1 - P.landing.impactLoss * Math.max(0, impact - 3) * (crouched ? 0.6 : 1) * (1 - fg), 0.45, 1);
  v[0] *= keep; v[1] *= keep; v[2] *= keep;
  let beta = slipOf(v, boardFrame(state.heading, state.lead, n));
  if (Math.abs(beta) > Math.PI / 2) { state.lead = state.lead === 1 ? -1 : 1; beta = wrapAngle(beta + Math.PI); }
  const cb = Math.cos(beta);
  state.grip = Math.min(state.grip, cb * cb);
  state.latch.kicked = input.slide; state.latch.side = beta < 0 ? -1 : 1; anchorSwing(state, P);
  if (state.grip < 0.7 && !state.latch.sliding) { state.latch.sliding = true; ev.push({kind: 'slideStart', step: state.step, data: {dir: 0}}); }
}

/* ───────────────────────────── bails and fades */

function bail(state: GroundState, ev: GroundEvent[], reason: string): void {
  state.v = [0, 0, 0]; state.yawRate = 0; state.grip = 1;
  const k = state.contact;
  if (k.kind === 'air') { k.kind = 'ground'; k.on = true; }
  Object.assign(state.legs, {stroke: -1, charge: 0, window: 0, boost: 0});
  Object.assign(state.latch, {kicked: false, sliding: false, intoFor: 0, boostAccel: 0});
  ev.push({kind: 'bail', step: state.step, data: {reason}});
}

function water(state: GroundState, q: ContactQuery, ev: GroundEvent[]): void {
  ev.push({kind: 'water', step: state.step});
  fadeBack(state, q, ev, 'water');
}

/** The fade back (§6.4–6.5): on the board, stopped, gripped, at the nearest point of the bed. The 300 ms visual fade is the controller's. */
function fadeBack(state: GroundState, q: ContactQuery, ev: GroundEvent[], reason: string): void {
  const pt = q.nearestBedPoint(state.p[0], state.p[2]);
  state.v = [0, 0, 0]; state.yawRate = 0; state.grip = 1;
  if (pt) state.p = [pt[0], pt[1], pt[2]];
  const k = state.contact;
  k.on = true; k.kind = 'ground'; k.pitch = 0;
  state.legs = {stroke: -1, crouch: 0, charge: 0, window: 0, boost: 0, cooldown: 0};
  Object.assign(state.latch, {popBuffer: 0, popped: false, kicked: false, sliding: false, intoFor: 0, boostAccel: 0, kappa: 0});
  state.offbedFor = 0; state.stopped = 0; state.airborneFor = 0; state.slideFor = 0;
  ev.push({kind: 'fadeBack', step: state.step, data: {reason, found: pt ? 1 : 0}});
}
