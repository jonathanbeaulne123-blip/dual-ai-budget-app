import {readFileSync} from 'node:fs';
import {beforeAll, describe, expect, it} from 'vitest';
import {parseHorizonDefinition} from '../src/house/world/horizonAssets.ts';
import {decodeTerrainAsset} from '../src/harbour/horizon/land/terrain/asset.ts';
import {createHorizonGeography} from '../src/harbour/horizon/runtime/geography.ts';
import {HORIZON_MANIFEST as M} from '../src/harbour/horizon/world/manifest.ts';
import type {WorldDefinition} from '../src/harbour/horizon/world/definition.ts';
import type {MoverDeps} from '../src/harbour/horizon/movers/shared/registry.ts';
import {offersAt, type ThresholdOffer} from '../src/harbour/horizon/movers/shared/threshold.ts';
import {BOARD_TEST_PROFILE} from '../src/harbour/horizon/movers/shared/ground/synthetic.ts';
import {groundGuard, groundSpeed} from '../src/harbour/horizon/movers/shared/ground/kernel.ts';
import {BOARD_PARK_PROFILE, BOARD_PROFILE, boardProfileAt, parkBox, PARK_FORGIVENESS} from '../src/harbour/horizon/movers/board/profile.ts';
import {createBoardController, type BoardController} from '../src/harbour/horizon/movers/board/controller.ts';
import {bedClass} from '../src/harbour/horizon/movers/shared/ground/contact.ts';
import {bedPath, moverInputOf, pointAt, progressOf, runLine, type BedPath, type LineId} from '../src/harbour/horizon/movers/board/situations.ts';

// The real baked world, loaded the way test/horizonBoardPace.test.ts loads it.
let deps: MoverDeps, world: WorldDefinition, board: BoardController;
beforeAll(() => {
  const bytes = readFileSync('public/horizon/world/horizon-geo-1.json.gz'), terrain = readFileSync('public/horizon/terrain/horizon-geo-1.bin');
  const loaded = parseHorizonDefinition(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  const field = decodeTerrainAsset(terrain.buffer.slice(terrain.byteOffset, terrain.byteOffset + terrain.byteLength) as ArrayBuffer, 'full');
  const geography = createHorizonGeography(field, {...loaded.collision, solids: loaded.geometry.solids, diagnostics: loaded.diagnostics ?? []} as Parameters<typeof createHorizonGeography>[1]);
  world = loaded;
  deps = {world, geography, manifest: M, reducedMotion: false, calm: false, tier: 'full'};
  board = createBoardController(deps);
  groundGuard.strict = true;
}, 120000);

const DT = 1 / 120;
const offerAt = (id: string, from: 'feet' | 'board', to: 'feet' | 'board'): ThresholdOffer => {
  const t = world.thresholds.find(x => x.id === id)!;
  return {id: `${id}:${from}→${to}`, thresholdId: id, at: [t.at[0], t.height ?? 0, t.at[1]], from, to, action: t.action, label: to === 'feet' ? 'Park' : 'Pick up the board', padId: t.padId};
};
/** Rolls with no input until stopped (or `limit` s); returns the plan distance and the paces met. */
function coast(c: BoardController, limit = 6, input = {}): {dist: number; t: number; paces: Set<string>; events: string[]} {
  let t = 0, dist = 0, prev = [...c.state().p];
  const paces = new Set<string>(), events: string[] = [];
  while (t < limit && (t === 0 || groundSpeed(c.state()) > 0.02)) {
    const f = c.update(DT, moverInputOf(input), t);
    events.push(...f.events);
    const p = c.state().p;
    dist += Math.hypot(p[0] - prev[0]!, p[2] - prev[2]!); prev = [...p];
    paces.add(c.state().contact.pace);
    t += DT;
  }
  return {dist, t, paces, events};
}

describe('the board profile (RIDE §8.1)', () => {
  it('is the kernel\'s board column, with forgiving landings only inside the Tideline park', () => {
    expect(JSON.parse(JSON.stringify(BOARD_PROFILE))).toEqual(JSON.parse(JSON.stringify(BOARD_TEST_PROFILE)));
    expect(BOARD_PROFILE.landing.forgiveness).toBe(0);
    expect(BOARD_PARK_PROFILE.landing.forgiveness).toBe(PARK_FORGIVENESS);
    expect({...BOARD_PARK_PROFILE, landing: null}).toEqual({...BOARD_PROFILE, landing: null});
    const box = parkBox(world, M);
    expect(boardProfileAt(BOARD_PROFILE, box, box.x, box.z)).toBe(BOARD_PARK_PROFILE);
    expect(boardProfileAt(BOARD_PROFILE, box, box.x + box.hw + 1, box.z)).toBe(BOARD_PROFILE);
  });
});

describe('pick up and park at the thresholds (RIDE §6.5, P17)', () => {
  it('picks the board up at skateLineStarts.1 under the rider, clamped into the pad, stopped, gripped, facing down S1, at S1\'s pace', () => {
    const rider = {x: 1310, y: 154, z: 500, yaw: 2};
    const offer = offersAt(world, rider, 'feet', (x, z) => deps.geography.ground(x, z)).find(o => o.thresholdId === 'skateLineStarts.1')!;
    expect(offer).toMatchObject({from: 'feet', to: 'board'});
    board.enter(offer, rider, 0);
    const st = board.state(), s1 = bedPath(world.beds.find(b => b.id === 'S1')!), down = pointAt(s1, 2).heading;
    expect(groundSpeed(st)).toBe(0);
    expect(st.grip).toBe(1);
    expect(st.contact.on).toBe(true);
    expect(Math.abs(Math.atan2(Math.sin(st.heading - down), Math.cos(st.heading - down)))).toBeLessThan(0.05);
    // A pick-up pad (no →feet pair) samples at its line's pace (contact fix round 3): S1 starts `fast`. The start is still stopped.
    expect(board.contact.sample(st.p[0], st.p[2], st.p[1] + 0.1)).toMatchObject({pace: 'fast', legal: true});
    // RIDE §6.5 (review R2-11): on the pad, and no further from the rider than the pad's centre is — no hop to the centre.
    expect(board.contact.padAt(st.p[0], st.p[2], st.p[1])?.padId).toBe(offer.padId);
    expect(Math.hypot(st.p[0] - rider.x, st.p[2] - rider.z)).toBeLessThanOrEqual(Math.hypot(offer.at[0] - rider.x, offer.at[2] - rider.z) + 1e-9);
    // Standing still on the pad with no input, it stays there.
    const at = [...st.p], f = board.update(0.5, moverInputOf({}), 0.5);
    expect(Math.hypot(f.body.x - at[0]!, f.body.z - at[2]!)).toBeLessThan(0.05);
    expect(groundSpeed(board.state())).toBe(0);
    expect(f.hud.pace).toMatch(/^fast · /);
    // A rider standing on the pad gets the board exactly under their feet.
    const pad = world.collision!.pads.find(p => p.id === offer.padId)!, on = {x: pad.centre[0] + 1, y: pad.centre[1], z: pad.centre[2] - 1, yaw: 0};
    board.enter(offer, on, 1);
    expect([board.state().p[0], board.state().p[2]]).toEqual([on.x, on.z]);
  });

  it('makes every board→feet pad threshold pace, and three real pads stop a 4.5 m/s board inside 6 m', () => {
    const pads = new Map(world.collision!.pads.map(p => [p.id, p]));
    const parks = world.thresholds.filter(t => t.built && t.modes.some(m => m === 'board→feet' || m === 'wheels→feet'));
    expect(parks.length).toBeGreaterThan(50);
    for (const t of parks) {
      const pad = pads.get(t.padId!)!;
      // A park pad that shares its spot with a pick-up pad (upperStreetSpur under skateLineStarts.3): the board's own
      // pick-up wins the tie and samples at the line's pace (contact fix round 3).
      if (board.contact.padAt(pad.centre[0], pad.centre[2], pad.centre[1])?.pickup) continue;
      expect(board.contact.sample(pad.centre[0], pad.centre[2], pad.centre[1] + 0.1), t.id).toMatchObject({pace: 'threshold', legal: true});
    }
    for (const id of ['stairTop', 'quayWest', 'landingQuay']) {
      // Along the pad's 6 m axis, from 3 m before its centre: threshold pace (roll 1.8) stops 4.5 m/s in 4.5²/3.6 = 5.6 m.
      const pad = pads.get(`threshold.${id}`)!, a = pad.rotationDegrees * Math.PI / 180, heading = Math.atan2(Math.cos(a), Math.sin(a));
      board.place({x: pad.centre[0] - Math.sin(heading) * 3, z: pad.centre[2] - Math.cos(heading) * 3, y: pad.centre[1], heading, speed: 4.5});
      const run = coast(board);
      expect(run.dist, id).toBeLessThanOrEqual(6);
      expect([...run.paces], id).toEqual(['threshold']);
      expect(run.events, id).not.toContain('bail');
    }
  });

  it('overruns the landingQuay pad without S, digs in within 10 m, and fades back onto the bed stopped', () => {
    // 20 m before the pad: the Reach boardwalk's rails close S1's run-out 25 m before it (a land defect, HANDOFF-notes/board.md).
    const s1 = bedPath(world.beds.find(b => b.id === 'S1')!), pad = world.collision!.pads.find(p => p.id === 'threshold.landingQuay')!;
    const padD = progressOf(s1, pad.centre[0], pad.centre[2]).d, p = pointAt(s1, padD - 2.5 - 20);
    board.place({x: p.x, z: p.z, y: p.y, heading: p.heading, speed: 10});
    let t = 0, offAt: number[] | null = null, dig = 0, prev = [...board.state().p], fade: {label: string} | null = null, fadeAt: number[] | null = null;
    while (t < 8 && !fade) {
      const f = board.update(DT, moverInputOf({}), t), st = board.state();
      if (!st.contact.legal && !offAt) offAt = [...st.p];
      if (offAt && !f.fade) dig += Math.hypot(st.p[0] - prev[0]!, st.p[2] - prev[2]!);
      if (f.fade) { fade = f.fade; fadeAt = [f.fade.to.x, f.fade.to.y, f.fade.to.z]; expect(f.events).toContain('fadeBack'); }
      prev = [...st.p]; t += DT;
    }
    expect(offAt).not.toBeNull();
    expect(dig).toBeLessThanOrEqual(10);
    expect(fade?.label).toBe("the bed's edge");
    const st = board.state();
    expect(groundSpeed(st)).toBe(0);
    expect(st.p.map(v => +v.toFixed(3))).toEqual(fadeAt!.map(v => +v.toFixed(3)));
    expect(board.contact.sample(st.p[0], st.p[2], st.p[1] + 0.1)).toMatchObject({legal: true});
  });

  it('brakes for the landingQuay pad with S held from 10 m/s (the pendulum), on the line, and stops on the pad', () => {
    const s1 = bedPath(world.beds.find(b => b.id === 'S1')!), pad = world.collision!.pads.find(p => p.id === 'threshold.landingQuay')!;
    const padD = progressOf(s1, pad.centre[0], pad.centre[2]).d, p = pointAt(s1, padD - 2.5 - 20);
    // S held with the stick centred is the kernel's pendulum speed check: the board swings ±70° across a travel that
    // keeps its line, so the run-out brake stays on the 4 m bed. RIDE §6.5 promised walking pace at the pad from 25 m;
    // measured from 20 m (the Reach boardwalk's rails close the run-out at 25 m): 2.7 m/s at the pad's edge, and the
    // pad's threshold pace stops it there.
    board.place({x: p.x, z: p.z, y: p.y, heading: p.heading, speed: 10});
    let t = 0, padSpeed: number | null = null, offbed = 0;
    const events: string[] = [];
    while (t < 6) {
      events.push(...board.update(DT, moverInputOf({slide: true}), t).events);
      const st = board.state();
      if (!st.contact.legal) offbed++;
      if (padSpeed === null && board.contact.padAt(st.p[0], st.p[2], st.p[1])?.padId === 'threshold.landingQuay') padSpeed = groundSpeed(st);
      t += DT;
    }
    expect(padSpeed).not.toBeNull();
    expect(padSpeed!).toBeLessThan(3);
    expect(offbed).toBe(0);
    expect(events).not.toContain('bail');
    const st = board.state();
    expect(groundSpeed(st)).toBe(0);
    expect(board.contact.padAt(st.p[0], st.p[2], st.p[1])?.padId).toBe('threshold.landingQuay');
    // The line rider, braking for the pad with its speed plan, reaches it under 5 m/s, on the bed, no bail.
    const rider = runLine(deps, 'S1', {from: padD - 2.5 - 20, speed: 10, arrive: 0.5, brake: 2});
    const at = rider.log.find(r => board.contact.padAt(r.p[0], r.p[2], r.p[1])?.padId === 'threshold.landingQuay');
    expect(at).toBeDefined();
    expect(at!.s).toBeLessThan(5);
    expect(rider.bails).toBe(0);
    expect(rider.log.every(r => r.pace !== 'offbed')).toBe(true);
  });

  it('puts terrain 3 m off S1 offbed, where the wheels dig in', () => {
    // The first nearly flat grass 3 m beyond S1's edge (so gravity does not mask the dig-in).
    const s1 = bedPath(world.beds.find(b => b.id === 'S1')!), off = (s1.bed.width ?? 4) / 2 + 3;
    let spot: {x: number; z: number; y: number; heading: number} | null = null;
    for (let d = 10; d < s1.length && !spot; d += 10) for (const side of [1, -1]) {
      const p = pointAt(s1, d), x = p.x + Math.cos(p.heading) * off * side, z = p.z - Math.sin(p.heading) * off * side, g = deps.geography.surface(x, z, p.y + 5, 0.5);
      if (g && g.id === 'terrain' && g.slope < 4 && !deps.geography.submerged(x, z, g.y) && deps.geography.surface(x + Math.sin(p.heading) * 2, z + Math.cos(p.heading) * 2, g.y + 1, 0.5)?.id === 'terrain') { spot = {x, z, y: g.y, heading: p.heading}; break; }
    }
    expect(spot).not.toBeNull();
    const {x, z, y, heading} = spot!;
    expect(board.contact.sample(x, z, y + 0.1)).toMatchObject({pace: 'offbed', legal: false, pushGrip: 0, material: 'grass'});
    board.place({x, z, y, heading, speed: 4});
    const s0 = groundSpeed(board.state());
    let f = board.update(DT, moverInputOf({}), 0);
    for (let i = 1; i < 30; i++) f = board.update(DT, moverInputOf({}), i * DT);
    // Roll 6.0 on grass under 4°: at least 5 m/s² of dig-in (from 4 m/s it stops in about a board length and a bit).
    expect((s0 - groundSpeed(board.state())) / (30 * DT)).toBeGreaterThan(5);
    expect(f.hud).toMatchObject({glyph: 'offline', label: 'off the line'});
  });

  it('parks: exit() puts the rider on foot where the board stopped', () => {
    const offer = offerAt('landingQuay', 'board', 'feet'), pad = world.collision!.pads.find(p => p.id === 'threshold.landingQuay')!;
    board.place({x: pad.centre[0] + 1, z: pad.centre[2], y: pad.centre[1], heading: 0.3, speed: 0});
    board.update(0.2, moverInputOf({}), 0);
    const st = board.state(), out = board.exit(offer);
    expect(out).toEqual({x: st.p[0], y: st.p[1], z: st.p[2], yaw: st.heading});
    expect(offersAt(world, out, 'board', (x, z) => deps.geography.ground(x, z)).some(o => o.thresholdId === 'landingQuay' && o.to === 'feet')).toBe(true);
  });
});

/**
 * P17 (RIDE §6.5, REVIEW-BRIEF P17: "every bed that meets a threshold stops at it"). A board bed meets a
 * board→feet pad when its centreline enters the pad. Where the bed ENDS at the pad (a door, a line's start or
 * end), nothing of that bed continues past it: 3 m and 6 m beyond the pad along the bed's end tangent the
 * contact is offbed or another bed (another line, the Tideline park). Where the bed runs THROUGH the pad, the
 * threshold must be an at-grade crossing (`crossing.*`: RIDE §6.5 "the far side of it is the line again");
 * a door a line runs through is a land/design conflict and is named here, so a new one fails.
 */
const THROUGH_DOORS = [
  // S3 runs straight past the market stair's top at 100 m: stairTop is a board→feet door (RIDE §1), not a
  // crossing, and S3 carries on at `fast` 3 m beyond it. HANDOFF-notes/board.md "Fix round 2" (design lead).
  'stairTop × S3 at 100 m',
  // S3 at 257 m crosses the quayWest pad's edge, 3.3 m off its centre (crossing.20 shares the spot): a door a line
  // runs across. Same ruling.
  'quayWest × S3 at 257 m',
];

describe('no bed passes a threshold (RIDE §6.5, P17)', () => {
  it('ends every board bed at the board→feet pad it meets (offbed or another bed 3 m and 6 m beyond), and runs through pads only at crossings', () => {
    const pads = new Map(world.collision!.pads.map(p => [p.id, p]));
    const parks = world.thresholds.filter(t => t.built && t.modes.some(m => m === 'board→feet' || m === 'wheels→feet'));
    const lines = world.beds.filter(b => (BOARD_PROFILE.beds as readonly string[]).includes(bedClass(b))).map(bedPath);
    const ends: string[] = [], through: string[] = [], passes: string[] = [];
    for (const t of parks) {
      const pad = pads.get(t.padId!)!, a = pad.rotationDegrees * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
      const hw = pad.size[0] / 2, hd = pad.size[1] / 2;
      const local = (x: number, z: number) => { const rx = x - pad.centre[0], rz = z - pad.centre[2]; return {u: rx * c + rz * sn, v: -rx * sn + rz * c}; };
      const inside = (x: number, z: number, m = 0) => { const q = local(x, z); return Math.abs(q.u) <= hw + m && Math.abs(q.v) <= hd + m; };
      /** Distance along (dx, dz) from (x, z) to the pad's edge (0 when already outside). */
      const exit = (x: number, z: number, dx: number, dz: number) => {
        if (!inside(x, z)) return 0;
        const q = local(x, z), du = dx * c + dz * sn, dv = -dx * sn + dz * c;
        const tu = Math.abs(du) > 1e-9 ? ((du > 0 ? hw : -hw) - q.u) / du : Infinity, tv = Math.abs(dv) > 1e-9 ? ((dv > 0 ? hd : -hd) - q.v) / dv : Infinity;
        return Math.min(tu, tv);
      };
      for (const line of lines) {
        const pr = progressOf(line, pad.centre[0], pad.centre[2]), at = pointAt(line, pr.d);
        if (!inside(at.x, at.z)) continue;   // the pad sits beside the line: it does not meet it
        const first = line.bed.points[0]!, last = line.bed.points[line.bed.points.length - 1]!;
        const outward: {x: number; z: number; h: number; tag: string}[] = [];
        if (inside(first[0], first[2], 1)) outward.push({x: first[0], z: first[2], h: pointAt(line, 0).heading + Math.PI, tag: 'start'});
        if (inside(last[0], last[2], 1)) outward.push({x: last[0], z: last[2], h: pointAt(line, line.length).heading, tag: 'end'});
        if (!outward.length) {
          through.push(`${t.id} × ${line.bed.id}`);
          if (!t.id.startsWith('crossing.')) passes.push(`${t.id} × ${line.bed.id} at ${Math.round(pr.d)} m`);
          continue;
        }
        for (const o of outward) {
          const dx = Math.sin(o.h), dz = Math.cos(o.h), e = exit(o.x, o.z, dx, dz);
          ends.push(`${t.id} × ${line.bed.id} ${o.tag}`);
          for (const k of [3, 6]) {
            const x = o.x + dx * (e + k), z = o.z + dz * (e + k), smp = board.contact.sample(x, z, pad.centre[1] + 1);
            const ok = smp === null || !smp.legal || smp.bedId !== line.bed.id;
            expect(ok, `${t.id}: ${line.bed.id} continues ${k} m past its ${o.tag} (${smp?.bedId} ${smp?.pace})`).toBe(true);
          }
        }
      }
    }
    // The doors that end a line are checked (not a vacuous pass): S1 at landingQuay, S3 at upperStreetSpur, and the three
    // lines that end at the Tideline park's crossing.
    expect(ends).toEqual(expect.arrayContaining(['landingQuay × S1 end', 'upperStreetSpur × S3 start', 'crossing.crossS2S3n805hv × S2 end', 'crossing.crossS2S3n805hv × S3 end', 'crossing.crossS2S3n805hv × S4 end']));
    expect(through.length).toBeGreaterThan(10);   // the at-grade crossings, RIDE §6.5
    expect(passes).toEqual(THROUGH_DOORS);
  });
});

/**
 * P19 (REVIEW-BRIEF P19: no invisible collider on a line). Along S1–S4's centreline every 2 m, at the deck's own
 * height (the contact under the polyline), `contact.blocked(x, z, y + 0.3, 0.3, tangent)` names every solid that
 * stands in the deck's clearance. Each is a named land defect (HANDOFF-notes/board.md "Land" and "Fix round 2",
 * the review's §9), listed here with its sample metres, so a new collider on a line — visible or not — fails
 * this test, and a land fix that clears one updates this table. The render-vs-collider half of P19 needs render
 * meshes and stays with the browser pass.
 */
const LINE_BLOCKERS: Record<LineId, Record<string, number[]>> = {
  S1: {
    'S1.retaining.lakeside@lakeside': [498, 500, 518, 520, 526, 534, 536, 596, 598, 600, 624, 626, 628, 630, 632],   // across the switchback flights
    'station.feb.slab@lakeside': [722, 724],   // overhangs the deck 0.78 m up
    'dam.apron@lakeside': [846, 848, 850],   // the dam/apron crossing, 837–879 m
    'apronBridge.rails@lakeside': [878],
    'apronBridge.rails@notch': [880],
    'S1.retaining.notch@notch': [1004, 1006, 1016, 1018, 1020, 1022, 1024, 1026],
    'yearWalk.retaining.reach@reach': [1186],
    'yearWalk.shoulders.reach@reach': [1188],
    'reachBoardwalk.rails@reach': [1240],   // across the run-out, 25 m before landingQuay
  },
  S2: {
    // V01's shoulder and retaining walls and the Bight Bridge deck at the V01 junction, 656–740 m.
    'V01.retaining.offshore@bight': [656, 662, 668, 674, 720, 722],
    'bightBridge.deck@bight': [658, 660, 664, 666, 678, 684, 688],
    'V01.shoulders.offshore@bight': [670, 672, 676],
    'V01.bed.offshore@bight': [680, 682, 686],
    'V01.retaining.bight@bight': [734, 740],
  },
  S3: {
    'town.upperStreet.slab@harbour': [12, 14, 16, 18],   // fix round 2: the slab overlays S3's first 18 m up to 1.8 m above its deck (the rider rides its top)
    'quayBridge.deck@reach': [370, 394, 396, 398, 400, 402, 404],
    'V01.retaining.landing@reach': [434],   // fix round 2: into the right half of the deck at the landing junction
    'zipLanding.ramp.retaining.landing@landing': [638, 640, 642, 644, 646, 648, 650],   // fix round 2: into the deck's right half (the rider passes on the left)
  },
  S4: {
    'crossing.crossYearWalkBrookuefyx8.rails@hollow': [126],   // the garden-walk crossing, 124 m
    'hollowBridge.deck@hollow': [146],
    'host.cottage.approach.retaining.hollow@hollow': [172, 176],
    'crossing.crossS4HostCottageApproach1ha399.supports@hollow': [182],   // fix round 2: beside the cottage approach walls
    'yearWalk.retaining.lakeside@hollow': [304],
    'host.glasshouse.approach.retaining.lakeside@lakeside': [362],
    'plot.bight.1.retaining@bight': [472, 486],
    'plot.bight.1.service.bed.bight@bight': [484],
    'duneCulvert.roof@landing': [956, 958, 960, 962, 964],   // 0.5–1.7 m clear against 01-land's 3 m
  },
};

describe('no invisible collider on a line (P19)', () => {
  it('blocks S1–S4 only at the named land defects, sampled every 2 m along the centreline', () => {
    const found: Record<string, Record<string, number[]>> = {};
    let blocked = 0;
    for (const id of ['S1', 'S2', 'S3', 'S4'] as LineId[]) {
      const line: BedPath = bedPath(world.beds.find(b => b.id === id)!), m: Record<string, number[]> = {};
      for (let d = 0; d <= line.length; d += 2) {
        const p = pointAt(line, d), smp = board.contact.sample(p.x, p.z, p.y + 0.5), y = smp?.y ?? p.y, tangent: [number, number] = [Math.sin(p.heading), Math.cos(p.heading)];
        if (!board.contact.blocked(p.x, p.z, y + 0.3, 0.3, tangent)) continue;
        blocked++;
        (m[deps.geography.blocker(p.x, p.z, y + 0.3, 0.3, tangent) ?? '?'] ??= []).push(d);
      }
      found[id] = m;
    }
    expect(found).toEqual(LINE_BLOCKERS);
    expect(blocked).toBe(Object.values(LINE_BLOCKERS).reduce((n, line) => n + Object.values(line).reduce((k, ds) => k + ds.length, 0), 0));
  });
});
