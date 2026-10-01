import {readFileSync} from 'node:fs';
import {beforeAll, describe, expect, it} from 'vitest';
import {parseHorizonDefinition} from '../src/house/world/horizonAssets.ts';
import {decodeTerrainAsset} from '../src/harbour/horizon/land/terrain/asset.ts';
import {createHorizonGeography} from '../src/harbour/horizon/runtime/geography.ts';
import {HORIZON_MANIFEST as M} from '../src/harbour/horizon/world/manifest.ts';
import type {WorldDefinition} from '../src/harbour/horizon/world/definition.ts';
import type {MoverDeps} from '../src/harbour/horizon/movers/shared/registry.ts';
import {offersAt, type ThresholdOffer} from '../src/harbour/horizon/movers/shared/threshold.ts';
import {BOARD_TEST_PROFILE, syntheticQuery} from '../src/harbour/horizon/movers/shared/ground/synthetic.ts';
import {groundGuard, groundSpeed} from '../src/harbour/horizon/movers/shared/ground/kernel.ts';
import {BOARD_PARK_PROFILE, BOARD_PROFILE, boardProfileAt, parkBox, PARK_FORGIVENESS} from '../src/harbour/horizon/movers/board/profile.ts';
import {createBoardController, type BoardController} from '../src/harbour/horizon/movers/board/controller.ts';
import {BICYCLE_PROFILE} from '../src/harbour/horizon/movers/bicycle/profile.ts';
import {bedClass} from '../src/harbour/horizon/movers/shared/ground/contact.ts';
import {bedPath, moverInputOf, pointAt, progressOf, runLine, type BedPath, type LineId} from '../src/harbour/horizon/movers/board/situations.ts';
import {sampleTerrain} from '../src/harbour/horizon/land/terrain/index.ts';
import {createMountainV2Region, terraceBedExclusion} from '../src/harbour/horizon/regions/mountainV2/index.ts';

// The real baked world, loaded the way test/horizonBoardPace.test.ts loads it.
let deps: MoverDeps, world: WorldDefinition, board: BoardController;
beforeAll(() => {
  const bytes = readFileSync('public/horizon/world/horizon-geo-1.json.gz'), terrain = readFileSync('public/horizon/terrain/horizon-geo-1.bin');
  const loaded = parseHorizonDefinition(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  const field = decodeTerrainAsset(terrain.buffer.slice(terrain.byteOffset, terrain.byteOffset + terrain.byteLength) as ArrayBuffer, 'full');
  const geography = createHorizonGeography(field, {...loaded.collision, solids: loaded.geometry.solids, diagnostics: loaded.diagnostics ?? []} as Parameters<typeof createHorizonGeography>[1]);
  // v2.6 (D-M1/D-M2): as mountHorizon does, the Mountain v2 region owns the ground, decks and solids inside its footprint.
  geography.addDynamic(createMountainV2Region({walkingJoinSolids:loaded.geometry.solids,horizonGround: (x, z) => sampleTerrain(field, x, z), yield: terraceBedExclusion(loaded.beds), terrainStep: field.step}).provider);
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
    // v2.6: skateLineStarts[0] is v2's start gate [1325,470.5] h 158.2 (D-M5); was [1310,154,500], S1's old start.
    const rider = {x: 1325, y: 158.2, z: 470.5, yaw: 2};
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
    // Candidate 5: the market stair's head pad (stairTop, [1480,18,1150]) stood 6 m over the square and a board bailed at its
    // lip. Candidate 6 (v2.3, W7-A): the stair's head moved to the upper street's edge [1472,18,1115]; the stairTop THRESHOLD
    // still stands at [1480,1150], now a pad on the square 0.52 under the square beside it (a lip: 'airborne', 'land'). It
    // stops a 4.5 m/s board in 5.4 m at threshold pace, no bail. Open (W7-A): move stairTop to the v2.3 head.
    {
      const pad = pads.get('threshold.stairTop')!, a = pad.rotationDegrees * Math.PI / 180, heading = Math.atan2(Math.cos(a), Math.sin(a));
      board.place({x: pad.centre[0] - Math.sin(heading) * 3, z: pad.centre[2] - Math.cos(heading) * 3, y: pad.centre[1], heading, speed: 4.5});
      const run = coast(board);
      expect(run.events, 'stairTop').not.toContain('bail'); expect(run.events).toEqual(['airborne', 'land']); expect(run.dist).toBeCloseTo(5.41, 1); expect([...run.paces]).toEqual(['threshold']);
      const beside = board.contact.sample(pad.centre[0], pad.centre[2] - 3, pad.centre[1] + .1)!;
      expect(beside.y - pad.centre[1], 'stairTop sits a lip under the square').toBeCloseTo(.52, 1);
    }
    for (const id of ['quayWest', 'landingQuay']) {
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

  it('brakes for the landingQuay pad with S held from 10 m/s (the pendulum), on the line, and stops on the line before it (v2.4)', () => {
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
    // v2.4 (integrator 4): the finish sits on the islet's natural ground (4.7, MANIFEST structures.landingQuay.finish_h; it was
    // dug to 3), so S1's last 20 m are near level: the S-held pendulum stops the board ON the line 6.7 m before the pad (it used
    // to roll down onto it at 2.7 m/s). The line rider below still arrives on the pad under 5 m/s. RIDE owner: re-tune if the
    // pendulum should carry to the pad.
    expect(padSpeed).toBeNull();
    expect(offbed).toBe(0);
    expect(events).not.toContain('bail');
    const st = board.state();
    expect(groundSpeed(st)).toBe(0);
    expect(Math.hypot(st.p[0] - pad.centre[0], st.p[2] - pad.centre[2])).toBeCloseTo(6.76, 1);
    expect(board.contact.sample(st.p[0], st.p[2], st.p[1] + 0.1)).toMatchObject({legal: true});
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
    // v2.2: the Tideline park crossing's pad is named by its register row key (Stage A R1-68), not the old hash id.
    expect(ends).toEqual(expect.arrayContaining(['landingQuay × S1 end', 'upperStreetSpur × S3 start', 'crossing.cross.s2.s3.1 × S2 end', 'crossing.cross.s2.s3.1 × S3 end', 'crossing.cross.s2.s3.1 × S4 end']));
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
// v2.2 (reconciled with Stage A candidate 5): re-measured on the v2.1 land. S2 and S3 run clear end to end (the Bight
// Bridge carries S2 on its deck, D-A1; the upper-street slab and the quay/landing retaining walls no longer stand in S3);
// blocked samples S1 33 → 7, S2 21 → 0, S3 19 → 0, S4 15 → 8. The table on main (v1.6 land) is in git history.
const LINE_BLOCKERS: Record<LineId, Record<string, number[]>> = {
  // Candidate 6: the dam apron is a quarter-pipe with a level bay S1 comes onto (W7-S), so dam.apron no longer stands in S1
  // (846–850 cleared); the apron bridge's rails are all in the notch district now. S4's VBS / walk bight / bight.1 lay-by
  // blockers at 510–522 are gone (W7-A: S4 × VBS one tread at 21.2; the spur trestle carries VBS). Blocked samples 7 + 8 → 4 + 2.
  // v2.6: S1's upper half is v2's race course (D-M5), 434 m longer to the Notch, so the lower blockers move 878/880 → 1312/1314
  // and 1252 → 1686; the s1Flyover is retired (D-M5), its 534 sample is gone.
  S1: {
    // v2.6: the library balcony's landing ramp (a region deck) stood in S1's clearance at 614–616 m; PR #566 CodeRabbit: the
    // region applies v2's own junction rule (a branch's mouth is open road), so it stops nobody on S1 — no entry here.
    // Bridge rebuild clears the old Apron rail contacts at 1312/1314; no replacement exception.
    'reachBoardwalk.rails@reach': [1686],   // across the run-out before landingQuay
  },
  S2: {},
  S3: {},
  S4: {
    // The old rail contact at 148 is clear. At 150 the bridge now owns the same carried
    // surface and blocker location (board y35.95915937): the Hollow neck (D-C10) remains.
    'hollowBridge.deck@hollow': [150],
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


// A controlled graded contact isolates the handover lifecycle from the real summit's
// changing geometry. The existing skateLineStarts.1 case above remains the baked-world proof.
describe.each([
  {id: 'board' as const, profile: BOARD_PROFILE},
  {id: 'bicycle' as const, profile: BICYCLE_PROFILE},
])('$id pickup on a 4.8% slope', ({id, profile}) => {
  function setup(enter = true, surface: 'legal' | 'illegal' | 'air' = 'legal') {
    const query = syntheticQuery({gradePct: 4.8});
    let steps = 0;
    const c = createBoardController({...deps, geography: {...deps.geography,
      ground: (x, z) => query.sample(x, z, 0)!.y, cameraBlocked: () => false,
    }}, profile, {id, contact: {...query, sample: (x, z, y) => {
      const sample = query.sample(x, z, y)!;
      return surface === 'air' ? null : surface === 'illegal'
        ? {...sample, legal: false, pace: 'offbed', roll: 6, pushGrip: 0} : sample;
    }, bedAt: () => null, padAt: () => null}, onStep: () => {steps++;}});
    const pickup: ThresholdOffer = {id: 'graded-pickup', thresholdId: 'graded-pickup',
      at: [0, 0, 0], from: 'feet', to: id, action: 'Pick up', label: 'Pick up'};
    if (enter) c.enter(pickup, {x: 0, y: 0, z: 0, yaw: 0}, 0);
    return {c, pickup, steps: () => steps};
  }

  it('holds only the initial idle handover, without physics backlog or losing the first push', () => {
    const held = setup(), ordinary = setup(false);
    ordinary.c.place({x: 0, y: 0, z: 0, heading: 0, speed: 0});
    for (let i = 0; i < 120; i++) held.c.update(1 / 60,
      {...moverInputOf({}), look: {dx: .01, dy: 0}}, i / 60);
    expect(held.c.state().p).toEqual([0, 0, 0]);
    expect(groundSpeed(held.c.state())).toBe(0);
    expect(held.steps()).toBe(0);
    held.c.update(.1, moverInputOf({push: true}), 2);
    ordinary.c.update(.1, moverInputOf({push: true}), 0);
    expect(held.steps()).toBe(12);
    expect(held.c.state().p).toEqual(ordinary.c.state().p);
    expect(held.c.state().v).toEqual(ordinary.c.state().v);
    held.c.update(.1, moverInputOf({}), 2.1);
    ordinary.c.update(.1, moverInputOf({}), .1);
    expect(held.steps()).toBe(24);
    expect(held.c.state().v).toEqual(ordinary.c.state().v);
  });

  it.each([{steer: .1}, {steer: -.1}, {slide: true}])('releases on an ordinary supported action %j', action => {
    const {c, steps} = setup();
    c.update(.1, moverInputOf(action), 0);
    expect(steps()).toBe(12);
    if (action.steer) expect(Math.abs(c.state().heading)).toBeGreaterThan(0);
    c.update(.1, moverInputOf({}), .1);
    expect(steps()).toBe(24);
  });

  it.each(['illegal', 'air'] as const)('does not freeze an unsupported or illegal pickup (%s)', surface => {
    const {c, steps} = setup(true, surface);
    c.update(.1, moverInputOf({}), 0);
    expect(steps()).toBe(12);
    if (surface === 'air') expect(c.state().p[1]).toBeLessThan(0);
  });

  it('place and successful physical resume clear a pending hold even at zero speed', () => {
    const placed = setup();
    placed.c.place({x: 0, y: 0, z: 0, heading: 0, speed: 0});
    placed.c.update(.1, moverInputOf({}), 0);
    expect(placed.steps()).toBe(12);
    expect(groundSpeed(placed.c.state())).toBeGreaterThan(0);
    const resumed = setup();
    expect(resumed.c.resumeAt!({x: 0, y: 0, z: 0, yaw: 0, velocity: [0, 0, 0]})).toBe(true);
    resumed.c.update(.1, moverInputOf({}), 0);
    expect(resumed.steps()).toBe(12);
    expect(groundSpeed(resumed.c.state())).toBeGreaterThan(0);
  });

  it('charges the board pop while held and respects the bicycle no-pop profile', () => {
    const {c, steps} = setup();
    for (let i = 0; i < 30; i++) c.update(1 / 60, {...moverInputOf({}), jump: true}, i / 60);
    expect(steps()).toBe(0);
    expect(c.state().p).toEqual([0, 0, 0]);
    const frame = c.update(DT, moverInputOf({}), .5);
    if (profile.pop) {
      expect(steps()).toBe(1);
      expect(frame.events).toContain('airborne');
      expect(c.state().contact.on).toBe(false);
      expect(c.state().p[1]).toBeGreaterThan(0);
    } else {
      expect(steps()).toBe(0);
      expect(frame.events).not.toContain('airborne');
    }
  });
});
