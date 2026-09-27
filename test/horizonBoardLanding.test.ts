import {readFileSync} from 'node:fs';
import {beforeAll, describe, expect, it} from 'vitest';
import {parseHorizonDefinition} from '../src/house/world/horizonAssets.ts';
import {decodeTerrainAsset} from '../src/harbour/horizon/land/terrain/asset.ts';
import {createHorizonGeography} from '../src/harbour/horizon/runtime/geography.ts';
import {HORIZON_MANIFEST as M} from '../src/harbour/horizon/world/manifest.ts';
import type {MoverDeps} from '../src/harbour/horizon/movers/shared/registry.ts';
import type {GroundEvent} from '../src/harbour/horizon/movers/shared/ground/types.ts';
import {groundGuard, groundSpeed, slipAngle} from '../src/harbour/horizon/movers/shared/ground/kernel.ts';
import {BOARD_PROFILE} from '../src/harbour/horizon/movers/board/profile.ts';
import {BAIL_HOLD_S, BAIL_HOLD_STEPS, createBoardController, FADE_LABELS, type BoardController} from '../src/harbour/horizon/movers/board/controller.ts';
import {bedPath, moverInputOf, pointAt, type BedPath} from '../src/harbour/horizon/movers/board/situations.ts';

// The real baked world, loaded the way test/horizonBoardPace.test.ts loads it.
let deps: MoverDeps, s1: BedPath, s2: BedPath;
const events: GroundEvent[] = [];
let board: BoardController;
beforeAll(() => {
  const bytes = readFileSync('public/horizon/world/horizon-geo-1.json.gz'), terrain = readFileSync('public/horizon/terrain/horizon-geo-1.bin');
  const world = parseHorizonDefinition(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  const field = decodeTerrainAsset(terrain.buffer.slice(terrain.byteOffset, terrain.byteOffset + terrain.byteLength) as ArrayBuffer, 'full');
  const geography = createHorizonGeography(field, {...world.collision, solids: world.geometry.solids, diagnostics: world.diagnostics ?? []} as Parameters<typeof createHorizonGeography>[1]);
  deps = {world, geography, manifest: M, reducedMotion: false, calm: false, tier: 'full'};
  board = createBoardController(deps, BOARD_PROFILE, {onStep: (_s, _i, ev) => events.push(...ev)});
  s1 = bedPath(world.beds.find(b => b.id === 'S1')!);
  s2 = bedPath(world.beds.find(b => b.id === 'S2')!);
  groundGuard.strict = true;
}, 120000);

const DT = 1 / 120;
/** Rides `seconds` with `input`, collecting the kernel events; returns the event kinds and the state when it first touched down. */
function ride(seconds: number, input = {}): {kinds: string[]; landing: {speedBefore: number; speedAfter: number; grip: number; beta: number; impact: number} | null} {
  events.length = 0;
  let before = groundSpeed(board.state()), landing: ReturnType<typeof ride>['landing'] = null;
  for (let t = 0; t < seconds; t += DT) {
    const airborne = !board.state().contact.on, v = board.state().v, speed = Math.hypot(v[0], v[1], v[2]);
    const from = events.length;
    board.update(DT, moverInputOf(input), t);
    const land = events.slice(from).find(e => e.kind === 'land');
    if (airborne && land && !landing) {
      const st = board.state();
      landing = {speedBefore: speed, speedAfter: groundSpeed(st), grip: st.grip, beta: slipAngle(st), impact: Number(land.data?.impact ?? 0)};
    }
    before = speed;
  }
  void before;
  return {kinds: events.map(e => e.kind), landing};
}
/** Airborne above S1 at `d` m, `h` m above the deck, rolling at `speed` along `heading` (default: along the line). */
function above(path: BedPath, d: number, h: number, speed: number, headingOffset = 0, velocityOffset = 0): void {
  const p = pointAt(path, d);
  board.place({x: p.x, z: p.z, y: p.y + h, heading: p.heading + headingOffset, speed: 0});
  const a = p.heading + velocityOffset;
  board.state().v = [Math.sin(a) * speed, 0, Math.cos(a) * speed];
}

describe('landing — one rule (RIDE §6.3)', () => {
  it('starts airborne when placed above the deck', () => {
    above(s1, 30, 1.2, 8);
    expect(board.state().contact).toMatchObject({on: false, kind: 'air'});
  });

  it('lands a 1.2 m drop onto S1 and keeps at least 45 % of its speed, no bail', () => {
    above(s1, 30, 1.2, 8);
    const {kinds, landing} = ride(1.2);
    expect(landing).not.toBeNull();
    expect(kinds).not.toContain('bail');
    // Impact is the normal speed (≈ √(2·g·1.2) plus the grade's share of the travel); keep = 1 − 0.05·(impact − 3).
    expect(landing!.impact).toBeGreaterThan(4.5);
    expect(landing!.impact).toBeLessThan(BOARD_PROFILE.landing.hardImpact);
    expect(landing!.speedAfter / landing!.speedBefore).toBeGreaterThanOrEqual(0.45);
    expect(landing!.speedAfter / 8).toBeGreaterThanOrEqual(0.45);
    expect(landing!.grip).toBeGreaterThan(0.95);
  });

  it('lands sideways (45° across the travel) with grip ≈ cos²β and resolves it as a slide, not a bail', () => {
    above(s1, 30, 0.3, 6, -Math.PI / 4);
    const {kinds, landing} = ride(2.5);
    expect(landing).not.toBeNull();
    const c = Math.cos(landing!.beta);
    expect(Math.abs(landing!.beta)).toBeGreaterThan(35 * Math.PI / 180);
    expect(landing!.grip).toBeCloseTo(c * c, 6);
    expect(landing!.grip).toBeGreaterThan(0.4); expect(landing!.grip).toBeLessThan(0.7);
    expect(kinds).toContain('slideStart');
    expect(kinds).toContain('slideEnd');
    expect(kinds).not.toContain('bail');
    expect(kinds).not.toContain('twist');
    // The tyre resolves it: grip back and the board tracking its travel again.
    expect(board.state().grip).toBeGreaterThan(0.95);
    expect(Math.abs(slipAngle(board.state()))).toBeLessThan(5 * Math.PI / 180);
  });

  it('bails on a landing at 9 m/s of normal speed, and holds the rider still for the recovery', () => {
    above(s1, 30, 0.6, 5);
    board.state().v[1] = -9;
    const {kinds} = ride(0.2);
    expect(kinds).toContain('bail');
    expect(board.bailHold()).toBeGreaterThan(BAIL_HOLD_S - 0.2);
    const at = [...board.state().p];
    // Input is ignored while the rider is down; then the board is gripped and stopped.
    for (let t = 0; board.bailHold() > 0 && t < 2; t += DT) { board.update(DT, moverInputOf({push: true, steer: 1}), t); expect(board.state().p).toEqual(at); }
    expect(board.bailHold()).toBe(0);
    expect(board.state().grip).toBe(1);
    expect(groundSpeed(board.state())).toBe(0);
  });

  it('counts the bail hold in kernel steps: a bail and its recovery take the same steps at 30, 60, 120 and 144 fps (review R2-10)', () => {
    const runs = [30, 60, 120, 144].map(fps => {
      const c = createBoardController(deps), p = pointAt(s1, 30);
      c.place({x: p.x, z: p.z, y: p.y + 0.6, heading: p.heading, speed: 0});
      c.state().v = [Math.sin(p.heading) * 5, -9, Math.cos(p.heading) * 5];
      let bails = 0;
      for (let i = 0; i < 3 * fps; i++) bails += c.update(1 / fps, moverInputOf({push: true}), i / fps).events.filter(e => e === 'bail').length;
      return {fps, bails, step: c.state().step, p: [...c.state().p], hold: c.bailHold()};
    });
    for (const r of runs) {
      expect(r.bails, `${r.fps} fps`).toBe(1);
      expect(r.hold, `${r.fps} fps`).toBe(0);
      expect(r.step, `${r.fps} fps`).toBe(runs[0]!.step);
      r.p.forEach((v, k) => expect(Math.abs(v - runs[0]!.p[k]!), `${r.fps} fps p[${k}]`).toBeLessThan(1e-6));
    }
    // The kernel stepped for 3 s less the hold: 360 − BAIL_HOLD_STEPS.
    expect(runs[0]!.step).toBe(360 - BAIL_HOLD_STEPS);
  });

  it('forgives a 9 m/s landing crouched (11.5) — the charge never counts as the crouch', () => {
    above(s1, 30, 0.6, 5);
    board.state().v[1] = -9;
    const {kinds} = ride(0.2, {crouch: 1});
    expect(kinds).toContain('land');
    expect(kinds).not.toContain('bail');
  });
});

describe('water (RIDE §6.4)', () => {
  it('fades a board that goes off the Bight Bridge lane into the Bight back onto the lane, stopped', () => {
    // S2 at 690 m: the Bight Bridge lane stands ~10 m over the Bight; start 1 m beyond the lane's edge, rolling off it.
    const p = pointAt(s2, 690), off = (s2.bed.width ?? 4) / 2 + 1;
    const x = p.x + Math.cos(p.heading) * off, z = p.z - Math.sin(p.heading) * off;
    board.place({x, z, y: p.y, heading: p.heading, speed: 2});
    events.length = 0;
    let fade: {label: string; to: {x: number; y: number; z: number}} | null = null;
    for (let t = 0; t < 3 && !fade; t += DT) { const f = board.update(DT, moverInputOf({}), t); if (f.fade) fade = f.fade; }
    const kinds = events.map(e => e.kind);
    expect(kinds).toContain('water');
    expect(kinds).toContain('fadeBack');
    expect(kinds).not.toContain('bail');
    expect(fade?.label).toBe(FADE_LABELS.water);
    const st = board.state(), sample = board.contact.sample(st.p[0], st.p[2], st.p[1] + 0.1)!;
    expect(sample).toMatchObject({legal: true, bedId: 'S2'});
    expect(deps.geography.submerged(st.p[0], st.p[2], st.p[1])).toBe(false);
    expect(Math.hypot(st.p[0] - p.x, st.p[2] - p.z)).toBeLessThan(6);
    expect(groundSpeed(st)).toBe(0);
    expect(st.grip).toBe(1);
  });
});
