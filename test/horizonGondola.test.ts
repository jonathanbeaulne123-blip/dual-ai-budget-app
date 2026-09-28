/**
 * T3 Rides (pass 5, D-M6): the gondola and the funicular as Horizon modes, on v2's own lines placed by the one
 * offset. Runs standalone on `fallbackCableRegion()` (the same numbers T2's region publishes) with a world whose
 * thresholds are the ones the rides expect (`cableThresholds` + the legacy `gondolaBase` / `gondolaTop` ids).
 */
import {readFileSync, existsSync, statSync} from 'node:fs';
import {dirname, relative, resolve} from 'node:path';
import {afterEach, describe, expect, it} from 'vitest';
import {HORIZON_MANIFEST} from '../src/harbour/horizon/world/manifest.ts';
import type {Threshold, WorldDefinition} from '../src/harbour/horizon/world/definition.ts';
import {createMoverRegistry, type HorizonGeography, type MoverDeps} from '../src/harbour/horizon/movers/shared/registry.ts';
import {offersAt, OFFER_REACH, type ThresholdOffer} from '../src/harbour/horizon/movers/shared/threshold.ts';
import {isModeId, type MoverBody, type MoverFrame, type MoverInput} from '../src/harbour/horizon/movers/shared/mode.ts';
import {HORIZON_MOVERS, registerHorizonMovers} from '../src/harbour/horizon/runtime/moverInput.ts';
import {
  asCableRide, cableControls, cableThresholds, connectCableRegion, createCableRide, fallbackCableRegion, routeForOffer,
  CABLE_LINK, type CableKind, type CableRideController,
} from '../src/harbour/horizon/movers/gondola/index.ts';
import {terrainHeightAt} from '../src/harbour/body/geography.ts';
import {rideExitHeading} from '../src/harbour/camera/rideCamera.ts';
import {GONDOLA_LINE, FUNICULAR_LINE} from '../src/harbour/mountain/transport.ts';
import {MOUNTAIN_V2_OFFSET as O} from '../src/harbour/horizon/regions/mountainV2/placement.ts';

const region = fallbackCableRegion(), lines = region.rides.lines;
const station = (kind:CableKind, id:string) => lines[kind].stations.find(s => s.id === id)!;
const quay = station('gondola', 'quay'), summit = station('gondola', 'summit');
const legacy = (id:string, s:typeof quay, modes:Threshold['modes']):Threshold => ({id, at:[s.at[0], s.at[2]], height:s.at[1], modes, action:id === 'gondolaBase' ? 'board by offer' : 'step off onto the platform'});
// The thresholds the rides expect on the Horizon: T1's two legacy ids at v2's quay and summit platforms + the per-direction rows.
const thresholds:Threshold[] = [legacy('gondolaBase', quay, ['feet→cable']), legacy('gondolaTop', summit, ['cable→feet']), ...cableThresholds(lines)];
const world = {thresholds} as unknown as WorldDefinition;
// v2's ground, placed: the Horizon's ground inside the footprint after T1's re-bake (same numbers + offset).
const ground = (x:number, z:number) => terrainHeightAt(x - O.x, z - O.z) + O.y;
const geography = {ground, blocked:() => false, cameraBlocked:() => false, surface:() => null} as unknown as HorizonGeography;
const deps = (over:Partial<MoverDeps> = {}):MoverDeps => ({world, geography, manifest:HORIZON_MANIFEST, reducedMotion:false, calm:false, tier:'full', ...over});
const on = (s:typeof quay, dx = 0):MoverBody => ({x:s.at[0] + dx, y:s.at[1], z:s.at[2], yaw:0});
const idle = (over:Partial<MoverInput> = {}):MoverInput => ({steer:0, forward:0, jump:false, sprint:false, crouch:0, accept:false, look:{dx:0, dy:0}, ...over});

function registry(over:Partial<MoverDeps> = {}) {
  const r = createMoverRegistry(deps(over));
  registerHorizonMovers(r);
  return r;
}
/** Board at a threshold on foot and return the live ride. */
function board(r:ReturnType<typeof registry>, thresholdId:string, body:MoverBody) {
  const offer = r.offers(body).find(o => o.thresholdId === thresholdId)!;
  expect(offer, thresholdId).toBeTruthy();
  expect(r.canAccept(offer)).toBe(true);
  expect(r.accept(offer, body, 0)).toBe(true);
  return {offer, ride:asCableRide(r.active())!};
}
/** Step at 60 Hz until the ride finishes (or `seconds` pass); returns every frame. */
function run(ride:CableRideController, seconds:number, input:(i:number) => MoverInput = () => idle()):MoverFrame[] {
  const frames:MoverFrame[] = [];
  for (let i = 0; i < seconds * 60; i++) { frames.push(ride.update(1 / 60, input(i), i * 1000 / 60)); if (ride.finished?.()) break; }
  return frames;
}

let disconnect:(() => void)|null = null;
afterEach(() => { disconnect?.(); disconnect = null; });

describe('registration and offers', () => {
  it('registers gondola and funicular in HORIZON_MOVERS; funicular is a mode id', () => {
    expect(Object.keys(HORIZON_MOVERS)).toEqual(expect.arrayContaining(['gondola', 'funicular']));
    expect(isModeId('funicular')).toBe(true);
  });
  it('places v2 stations by the one offset (quay ≈ [1282,·,810], summit ≈ [1300,·,480])', () => {
    expect(quay.name).toBe('Waterfront'); expect(summit.name).toBe('Summit Commons');
    expect(quay.at[0]).toBeCloseTo(GONDOLA_LINE.stations[0]!.platform.at[0] + O.x, 6);
    expect(Math.hypot(quay.at[0] - 1282, quay.at[2] - 810)).toBeLessThan(6);
    expect(Math.hypot(summit.at[0] - 1300, summit.at[2] - 480)).toBeLessThan(6);
    expect(lines.funicular.stations.map(s => s.id)).toEqual(['town', 'hearth', 'library', 'reservoir']);
    expect(lines.funicular.stations[3]!.at[1]).toBeCloseTo(FUNICULAR_LINE.stations[3]!.platform.at[1] + O.y, 6);
  });
  it('offers the ride at both gondola platforms, in words, and nothing 10 m away', () => {
    const up = offersAt(world, on(quay, 1), 'feet'), down = offersAt(world, on(summit, 1), 'feet');
    expect(up.map(o => o.label)).toEqual(expect.arrayContaining(['Ride the gondola ↑ Summit Commons']));
    expect(up.find(o => o.thresholdId === 'gondolaBase')).toMatchObject({from:'feet', to:'gondola'});   // the manifest's 'cable' alias
    expect(down.map(o => o.label)).toEqual(['Ride the gondola ↓ Waterfront']);
    expect(down[0]).toMatchObject({from:'feet', to:'gondola', thresholdId:'gondola.summit.to.quay'});
    for (const s of [quay, summit]) {
      expect(offersAt(world, on(s, 10), 'feet').filter(o => o.to === 'gondola')).toEqual([]);
      expect(offersAt(world, on(s, OFFER_REACH + .1), 'feet').filter(o => o.to === 'gondola')).toEqual([]);
      expect(offersAt(world, {...on(s), y:s.at[1] + 1.5}, 'feet').filter(o => o.to === 'gondola')).toEqual([]);
    }
    const r = registry();
    expect(r.offers(on(quay, 1)).every(o => r.canAccept(o))).toBe(true);
  });
  it('the funicular offers the next and the previous station', () => {
    const hearth = station('funicular', 'hearth');
    expect(offersAt(world, on(hearth), 'feet').map(o => o.label).sort()).toEqual(['Ride the funicular ↑ Library Woods', 'Ride the funicular ↓ The square']);
    expect(offersAt(world, on(station('funicular', 'library')), 'feet').map(o => o.label)).toContain('Ride the funicular ↑ Reservoir Heights');
  });
  it('reads the trip from the threshold id, the legacy ids, or the nearest platform', () => {
    const at = quay.at;
    expect(routeForOffer(lines, 'gondola', {thresholdId:'gondolaBase', at})).toEqual({kind:'gondola', from:0, to:1});
    expect(routeForOffer(lines, 'gondola', {thresholdId:'gondolaTop', at})).toEqual({kind:'gondola', from:1, to:0});
    expect(routeForOffer(lines, 'funicular', {thresholdId:'funicular.hearth', at})).toEqual({kind:'funicular', from:1, to:2});
    expect(routeForOffer(lines, 'funicular', {thresholdId:'funicular.reservoir', at})).toEqual({kind:'funicular', from:3, to:2});
    expect(routeForOffer(lines, 'funicular', {thresholdId:'funicular.library.to.hearth', at})).toEqual({kind:'funicular', from:2, to:1});
    expect(routeForOffer(lines, 'gondola', {thresholdId:'somewhere', at:summit.at})).toEqual({kind:'gondola', from:1, to:0});
  });
});

describe('a stale threshold', () => {
  it('does not carry the rider across the island from a platform the line does not stand at', () => {
    const ride = createCableRide('gondola', deps(), CABLE_LINK), here = {x:1480, y:20, z:1090, yaw:1};
    ride.enter({id:'x', thresholdId:'gondolaBase', at:[1480, 20, 1090], from:'feet', to:'gondola', action:'', label:''} as ThresholdOffer, here, 0);
    const [frame] = run(ride, 1);
    expect(ride.finished?.()).toBe(true);
    expect(frame!.body).toEqual(here);
    expect(ride.exit(null)).toEqual(here);
  });
});

describe('a gondola ride in simulated time', () => {
  it('quay → summit: attached at cruise mid-ride, the eye over the ground, the cabin pushed to the region, alights facing away', () => {
    const transit:({at:[number,number,number]}|null)[] = [];
    disconnect = connectCableRegion(region, {setTransit:cabin => transit.push(cabin)});
    const r = registry(), {ride} = board(r, 'gondola.quay.to.summit', on(quay, .5));
    expect(r.mode()).toBe('gondola');
    const frames = run(ride, 180);
    expect(ride.finished?.()).toBe(true);
    const n = frames.length, seconds = n / 60;
    expect(seconds).toBeGreaterThan(30); expect(seconds).toBeLessThan(150);
    // Mid-ride: the body rides the cabin (seated on its bench) at the line's cruise.
    const mid = frames[Math.floor(n / 2)]!, cabin = transit[Math.floor(n / 2)]!;
    expect(cabin).not.toBeNull();
    expect(Math.hypot(mid.body.x - cabin.at[0], mid.body.y - cabin.at[1], mid.body.z - cabin.at[2])).toBeLessThan(1);
    expect(mid.pose.speed).toBeGreaterThan(GONDOLA_LINE.cruise * .9); expect(mid.pose.speed).toBeLessThan(GONDOLA_LINE.cruise * 1.1);
    expect(mid.pose.crouch).toBe(1);
    expect(mid.hud.place).toMatchObject({label:'↑ Summit Commons', action:'gate'});
    expect(mid.hud.place!.distance).toBeGreaterThan(50);
    // The camera is always over the land (v2's ride camera floors it at ground + 1.2 native).
    for (let i = 0; i < n; i += 30) { const e = frames[i]!.camera!.eye; expect(e[1], `frame ${i}`).toBeGreaterThan(ground(e[0], e[2])); }
    // The reveal widens the lens over the gorge.
    expect(Math.max(...frames.map(f => f.camera!.fov))).toBeGreaterThan(50 + 3);
    // Arrival: the last frame fades to the summit platform with its words; the region gets the cabin back.
    const last = frames[n - 1]!;
    expect(last.fade?.label).toBe('Arrived at Summit Commons by gondola.');
    expect(last.events).toContain('arrived');
    expect(transit[transit.length - 1]).toBeNull();
    const out = r.finish()!;
    expect(r.mode()).toBe('feet');
    expect(Math.hypot(out.x - summit.at[0], out.y - summit.at[1], out.z - summit.at[2])).toBeLessThan(.01);
    expect(out.yaw).toBeCloseTo(rideExitHeading('gondola', 1), 9);
  });
  it('summit → quay rides back down and E skips to the far platform', () => {
    const r = registry(), {ride} = board(r, 'gondola.summit.to.quay', on(summit));
    const frames = run(ride, 5, i => idle({accept:i === 60}));
    expect(frames.length).toBe(61);
    expect(frames[frames.length - 1]!.fade?.label).toBe('Arrived at Waterfront by gondola.');
    const out = r.finish()!;
    expect(Math.hypot(out.x - quay.at[0], out.z - quay.at[2])).toBeLessThan(.01);
  });
  it('the bench: seated at the start, Space stands and sits; walking stands you up', () => {
    const ride = createCableRide('gondola', deps(), CABLE_LINK);
    ride.enter({id:'x', thresholdId:'gondolaBase', at:quay.at, from:'feet', to:'gondola', action:'', label:''} as ThresholdOffer, on(quay), 0);
    run(ride, 4);                                    // aboard, leaving the platform
    expect(ride.state().seated).toBe(true);
    ride.update(1 / 60, idle({jump:true}), 0); ride.update(1 / 60, idle({jump:true}), 0);   // one press, held
    expect(ride.state().seated).toBe(false);
    ride.update(1 / 60, idle(), 0); ride.update(1 / 60, idle({jump:true}), 0);
    expect(ride.state().seated).toBe(true);
    ride.update(1 / 60, idle({forward:1}), 0);
    expect(ride.state().seated).toBe(false);
    expect(cableControls('gondola', ride.state()).map(c => c.id)).toEqual(['skip', 'seat']);
    expect(cableControls('funicular', ride.state()).map(c => c.id)).toEqual(['skip']);
    const f = createCableRide('funicular', deps(), CABLE_LINK);
    f.enter({id:'x', thresholdId:'funicular.town', at:station('funicular', 'town').at, from:'feet', to:'funicular', action:'', label:''} as ThresholdOffer, on(station('funicular', 'town')), 0);
    run(f, 4); expect(f.toggleSeat()).toBe(false);
  });
});

describe('comfort: reduced motion and calm view make the ride a cut', () => {
  it('reduced motion: the sheet lists the far platform and a stepped ride arrives on its first frame', () => {
    const r = registry({reducedMotion:true}), {ride} = board(r, 'gondola.quay.to.summit', on(quay));
    expect(ride.reducedMotionCut?.()).toEqual({landings:[{id:'gondola.summit', label:'Summit Commons, by gondola', xy:[summit.at[0], summit.at[2]], height:summit.at[1]}]});
    const frames = run(ride, 2);
    expect(frames).toHaveLength(1);
    expect(frames[0]!.fade?.label).toBe('Arrived at Summit Commons by gondola.');
    expect(Math.hypot(frames[0]!.body.x - summit.at[0], frames[0]!.body.z - summit.at[2])).toBeLessThan(.01);
    expect(cableControls('gondola', ride.state()).map(c => c.id)).toEqual([]);
  });
  it('turning reduced motion on mid-ride cuts to the far platform', () => {
    const r = registry(), {ride} = board(r, 'gondola.quay.to.summit', on(quay));
    run(ride, 10); expect(ride.finished?.()).toBe(false);
    r.setReducedMotion(true);
    const [frame] = run(ride, 1);
    expect(ride.finished?.()).toBe(true);
    expect(Math.hypot(frame!.body.x - summit.at[0], frame!.body.z - summit.at[2])).toBeLessThan(.01);
  });
  it('calm view parks the cabins (no transit pushed) and still arrives as a cut', () => {
    const transit:unknown[] = [];
    disconnect = connectCableRegion(region, {setTransit:cabin => transit.push(cabin)});
    const r = registry({calm:true}), {ride} = board(r, 'funicular.town.to.hearth', on(station('funicular', 'town')));
    const frames = run(ride, 2);
    expect(frames).toHaveLength(1);
    expect(transit.every(c => c === null)).toBe(true);
    expect(ride.finished?.()).toBe(true);
  });
});

describe('the funicular', () => {
  it('chains its four stations: the square → Lower neighbourhood → Library Woods → Reservoir Heights', () => {
    const r = registry(), ids = ['town', 'hearth', 'library', 'reservoir'];
    let body = on(station('funicular', 'town'));
    for (let k = 0; k < 3; k++) {
      const from = ids[k]!, to = ids[k + 1]!, {offer, ride} = board(r, `funicular.${from}.to.${to}`, body);
      expect(offer.label).toBe(`Ride the funicular ↑ ${station('funicular', to).name}`);
      expect(r.mode()).toBe('funicular');
      // The first leg rides in full; the others skip with E once aboard.
      const frames = run(ride, 120, i => idle({accept:k > 0 && i === 120}));
      expect(ride.finished?.()).toBe(true);
      if (k === 0) { const mid = frames[Math.floor(frames.length / 2)]!; expect(mid.pose.speed).toBeGreaterThan(FUNICULAR_LINE.cruise * .5); expect(mid.pose.crouch).toBe(0); }
      body = r.finish()!;
      const s = station('funicular', to);
      expect(Math.hypot(body.x - s.at[0], body.y - s.at[1], body.z - s.at[2])).toBeLessThan(.01);
    }
    // At the top only the way down is offered.
    expect(r.offers(body).map(o => o.label)).toEqual(['Ride the funicular ↓ Library Woods']);
  });
});

describe("T2's region rides (regions/mountainV2/rides.ts) against the fallback", () => {
  const path = resolve(__dirname, '../src/harbour/horizon/regions/mountainV2/rides.ts');
  it.skipIf(!existsSync(path))('publishes the same stations and curves, and drives the same ride', async () => {
    const mod = await import(/* @vite-ignore */ path) as {regionRides():{lines:unknown; createRide:unknown; curve(kind:CableKind, from:number, to:number):{at:readonly number[]}[]; offset:unknown}};
    const t2 = mod.regionRides();
    expect(t2.offset).toEqual(O);
    expect(t2.lines).toEqual(lines);
    expect(t2.createRide).toBe(region.rides.createRide);
    for (const [kind, from, to] of [['gondola', 0, 1], ['funicular', 2, 1]] as const) {
      const a = t2.curve(kind, from, to), b = region.rides.curve(kind, from, to);
      expect(a[0]!.at).toEqual(b[0]!.at); expect(a[a.length - 1]!.at).toEqual(b[b.length - 1]!.at);
    }
    // Connected as the region, a ride runs the same.
    disconnect = connectCableRegion({offset:O, rides:t2 as never});
    const r = registry(), {ride} = board(r, 'gondola.quay.to.summit', on(quay));
    run(ride, 180);
    expect(ride.finished?.()).toBe(true);
    expect(ride.state().remaining).toBeLessThan(.01);
  });
});

describe('the fences', () => {
  const GONDOLA = resolve(__dirname, '../src/harbour/horizon/movers/gondola');
  const RE = /(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
  const isFile = (p:string) => existsSync(p) && statSync(p).isFile();
  const resolveSpec = (from:string, spec:string) => { let t = resolve(dirname(from), spec); if (!isFile(t)) for (const e of ['.ts', '.tsx', '/index.ts']) if (isFile(t + e)) { t += e; break; } return t; };
  it('never imports src/core (directly, or through any value import it reaches)', () => {
    const seen = new Set<string>(), stack = [resolve(GONDOLA, 'index.ts')], hits:string[] = [];
    while (stack.length) {
      const file = stack.pop()!;
      if (seen.has(file) || !isFile(file)) continue;
      seen.add(file);
      for (const m of readFileSync(file, 'utf8').matchAll(RE)) {
        const spec = (m[1] ?? m[2] ?? m[3])!;
        if (!spec.startsWith('.')) continue;
        const target = resolveSpec(file, spec), rel = relative(resolve(__dirname, '..'), target);
        if (/^src\/(core|ledgerSync)\/|^workers\//.test(rel)) hits.push(`${relative(resolve(__dirname, '..'), file)} → ${rel}`);
        if (!/^(import|export)\s+type\b/.test(m[0])) stack.push(target);   // types erase; the fence is on what runs
      }
    }
    expect(seen.size).toBeGreaterThan(5);
    expect(hits).toEqual([]);
  });
});
