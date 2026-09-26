import {readFileSync} from 'node:fs';
import {beforeAll, describe, expect, it} from 'vitest';
import {parseHorizonDefinition} from '../src/house/world/horizonAssets.ts';
import {HORIZON_MANIFEST} from '../src/harbour/horizon/world/manifest.ts';
import type {WorldDefinition} from '../src/harbour/horizon/world/definition.ts';
import {createMoverRegistry, type HorizonGeography} from '../src/harbour/horizon/movers/shared/registry.ts';
import {thresholdPairs} from '../src/harbour/horizon/movers/shared/threshold.ts';
import type {ModeController, MoverBody} from '../src/harbour/horizon/movers/shared/mode.ts';
import {moverInputFrom, moverFadeMs, MOVER_FADE_MS, moverBlendMs, moverBlendEase, MOVER_PICKUP_BLEND_MS, MOVER_PARK_BLEND_MS, riderSlip, savedRideBody, offerToShow, offerBubbleText, sameHud, paceWord, createRideHold, RIDING_STATUS, type HorizonViewMode, type MoverInputSources} from '../src/harbour/horizon/runtime/moverInput.ts';
import {statusTextFor, WALK_STATUS, RIDE_PAUSED_STATUS} from '../src/harbour/horizon/HorizonStage.tsx';
import type {MoverFrame} from '../src/harbour/horizon/movers/shared/mode.ts';
import type {MoverPose} from '../src/harbour/horizon/movers/shared/mode.ts';

let world: WorldDefinition;
beforeAll(() => {
  const bytes = readFileSync('public/horizon/world/horizon-geo-1.json.gz');
  world = parseHorizonDefinition(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
});
const geography = {ground: () => 0} as unknown as HorizonGeography;
const src = (over: Partial<MoverInputSources> = {}): MoverInputSources => ({keys: new Set(), controls: {forward: 0, strafe: 0, run: false}, jumpHeld: false, jumpEdge: false, accept: false, look: {dx: 0, dy: 0}, ...over});
const at = (id: string, dx = 0): MoverBody => { const t = world.thresholds.find(t => t.id === id)!; return {x: t.at[0] + dx, y: t.height ?? 0, z: t.at[1], yaw: .3}; };
const idle = (): ModeController => {
  let body: MoverBody = {x: 0, y: 0, z: 0, yaw: 0};
  return {id: 'board', enter(_o, b) { body = {...b}; }, update() { throw new Error('not driven here'); }, exit(o) { return o ? {x: o.at[0], y: o.at[1], z: o.at[2], yaw: body.yaw} : body; }, reducedMotion() {}, calm() {}, tier() {}, dispose() {}};
};

describe('MoverInput mapping (RIDE §10.5)', () => {
  it('maps W A S D and the arrows to forward and steer (+1 = right)', () => {
    expect(moverInputFrom(src({keys: new Set(['w', 'd'])}))).toMatchObject({forward: 1, steer: 1, jump: false, sprint: false, crouch: 0, accept: false});
    expect(moverInputFrom(src({keys: new Set(['arrowdown', 'arrowleft'])}))).toMatchObject({forward: -1, steer: -1});
    expect(moverInputFrom(src({keys: new Set(['w', 's', 'a', 'd'])}))).toMatchObject({forward: 0, steer: 0});
  });
  it('adds the Move pad and clamps to -1..1', () => {
    expect(moverInputFrom(src({controls: {forward: .6, strafe: -.4, run: false}}))).toMatchObject({forward: .6, steer: -.4});
    expect(moverInputFrom(src({keys: new Set(['w', 'd']), controls: {forward: .8, strafe: .9, run: false}}))).toMatchObject({forward: 1, steer: 1});
    expect(moverInputFrom(src({keys: new Set(['a']), controls: {forward: 0, strafe: .5, run: false}})).steer).toBeCloseTo(-.5);
  });
  it('reads Space held, the Jump bubble held or a jump edge as jump; Shift or run as sprint; passes accept and look through', () => {
    expect(moverInputFrom(src({keys: new Set([' '])})).jump).toBe(true);
    expect(moverInputFrom(src({jumpHeld: true})).jump).toBe(true);
    expect(moverInputFrom(src({jumpEdge: true})).jump).toBe(true);
    expect(moverInputFrom(src({keys: new Set(['shift'])})).sprint).toBe(true);
    expect(moverInputFrom(src({controls: {forward: 0, strafe: 0, run: true}})).sprint).toBe(true);
    const i = moverInputFrom(src({accept: true, look: {dx: .02, dy: -.01}}));
    expect(i.accept).toBe(true); expect(i.look).toEqual({dx: .02, dy: -.01});
  });
});

describe('The mover fade', () => {
  it('is 300 ms, and a cut under reduced motion or calm view', () => {
    expect(moverFadeMs(false)).toBe(MOVER_FADE_MS); expect(MOVER_FADE_MS).toBe(300);
    expect(moverFadeMs(true)).toBe(0); expect(moverFadeMs(false, true)).toBe(0);
  });
});

describe('The walk ↔ ride camera blends (RIDE §10.2)', () => {
  it('are 800 ms at pick-up and 600 ms at park, and cuts under reduced motion or calm view', () => {
    expect(MOVER_PICKUP_BLEND_MS).toBe(800); expect(MOVER_PARK_BLEND_MS).toBe(600);
    expect(moverBlendMs('pickup', false)).toBe(800); expect(moverBlendMs('park', false)).toBe(600);
    expect(moverBlendMs('pickup', true)).toBe(0); expect(moverBlendMs('park', true)).toBe(0);
    expect(moverBlendMs('pickup', false, true)).toBe(0); expect(moverBlendMs('park', false, true)).toBe(0);
  });
  it('eases with the Look/Walk smoothstep, clamped, and a zero duration is already there', () => {
    expect(moverBlendEase(0, 800)).toBe(0); expect(moverBlendEase(400, 800)).toBeCloseTo(.5, 12); expect(moverBlendEase(800, 800)).toBe(1);
    expect(moverBlendEase(200, 800)).toBeCloseTo(.15625, 12); expect(moverBlendEase(-50, 600)).toBe(0); expect(moverBlendEase(900, 600)).toBe(1);
    expect(moverBlendEase(0, 0)).toBe(1);
  });
});

describe('The slip the figure shows over the deck', () => {
  const pose = (over: Partial<MoverPose> = {}): MoverPose => ({lean: 0, roll: 0, pitch: 0, crouch: 0, slide: 0, speed: 5, ...over});
  const kernel = (heading: number, lead: 1 | -1, v: [number, number, number]) => ({state: () => ({p: [0, 0, 0], v, heading, yawRate: 0, grip: 1, lead, contact: {on: true, kind: 'ground', n: [0, 1, 0], material: '', pace: 'fast', slope: 0, legal: true, pitch: 0}})});
  it('reads pose.slip when the mover sends it (wrapped to ±π)', () => {
    expect(riderSlip(pose({slip: .4}), kernel(0, 1, [5, 0, 0]))).toBeCloseTo(.4, 12);
    expect(riderSlip(pose({slip: 2 * Math.PI + .1}))).toBeCloseTo(.1, 12);
  });
  it("else derives it from the controller's kernel state: travel yaw minus the nose, fakie reads π", () => {
    expect(riderSlip(pose(), kernel(0, 1, [5, 0, 0]))).toBeCloseTo(Math.PI / 2, 9);    // nose +z, rolling +x: slipping right
    expect(riderSlip(pose(), kernel(.3, 1, [5 * Math.sin(.1), 0, 5 * Math.cos(.1)]))).toBeCloseTo(-.2, 9);
    expect(Math.abs(riderSlip(pose(), kernel(0, -1, [0, 0, -5])))).toBeCloseTo(Math.PI, 9);
    expect(riderSlip(pose())).toBe(0); expect(riderSlip(pose(), {})).toBe(0);
  });
});

describe('Saved position while riding (RIDE §6.5)', () => {
  it('lands on foot at a board→feet threshold, in reach first, else the nearest anywhere', () => {
    const registry = createMoverRegistry({world, geography, manifest: HORIZON_MANIFEST, reducedMotion: false, calm: false, tier: 'full'});
    const pick = {id: 'skateLineStarts.1:feet→board', thresholdId: 'skateLineStarts.1', at: [1310, 154, 500] as [number, number, number], from: 'feet' as const, to: 'board' as const, action: 'pick up', label: 'Pick up the board'};
    registry.attach(idle(), pick, at('skateLineStarts.1'), 0);
    expect(registry.mode()).toBe('board');
    const parks = new Set(world.thresholds.filter(t => thresholdPairs(t).some(p => (p.from === 'board' || p.from === 'wheels') && p.to === 'feet')).map(t => `${t.at[0]},${t.at[1]}`));
    // In reach of landingQuay: the park there.
    const near = savedRideBody(world, at('landingQuay', 1.5), registry.mode(), geography.ground);
    expect([near.x, near.y, near.z]).toEqual([1270, 3, 1330]); expect(near.yaw).toBe(.3);
    // Mid-line, nothing in reach: still a board→feet threshold, the nearest one.
    const mid: MoverBody = {x: 1100, y: 60, z: 700, yaw: 0}, far = savedRideBody(world, mid, registry.mode(), geography.ground);
    expect(parks.has(`${far.x},${far.z}`)).toBe(true);
    const best = Math.min(...world.thresholds.filter(t => parks.has(`${t.at[0]},${t.at[1]}`)).map(t => Math.hypot(t.at[0] - mid.x, t.at[1] - mid.z)));
    expect(Math.hypot(far.x - mid.x, far.z - mid.z)).toBeCloseTo(best, 6);
    // On foot the body is kept as is.
    expect(savedRideBody(world, mid, 'feet')).toEqual(mid);
  });
});

describe('The Enter bubble offer and the pace bubble', () => {
  it('names only offers the registry can accept', () => {
    const registry = createMoverRegistry({world, geography, manifest: HORIZON_MANIFEST, reducedMotion: false, calm: false, tier: 'full'});
    const body = at('skateLineStarts.1', 1);
    expect(offerToShow(registry.offers(body), registry.canAccept)).toBeNull();
    registry.register('board', idle);
    expect(offerToShow(registry.offers(body), registry.canAccept)).toMatchObject({to: 'board', label: 'Pick up the board'});
  });
  it('reads the pace word and throttles HUD changes', () => {
    expect(paceWord({pace: 'fast · paved', arc: 0, glyph: null, label: null})).toBe('fast');
    expect(paceWord({pace: 'threshold · the square', arc: 0, glyph: null, label: null})).toBe('threshold');
    expect(paceWord({pace: 'off the line', arc: 0, glyph: null, label: null})).toBe('offline');
    expect(paceWord({pace: null, arc: 0, glyph: 'offline', label: null})).toBe('offline');
    const a = {pace: 'flow · boardwalk', arc: .5, glyph: null, label: null};
    expect(sameHud(a, {...a, arc: .505})).toBe(true); expect(sameHud(a, {...a, arc: .6})).toBe(false); expect(sameHud(null, a)).toBe(false); expect(sameHud(null, null)).toBe(true);
  });
});

describe('A mode ends only at a threshold (R2-01): Look / Island / a page pause the ride, Walk resumes it, a reload parks', () => {
  /** A controller that counts update() calls and moves 1 m per call; exit reports what it was given. */
  const counting = (log: string[]) => {
    let body: MoverBody = {x: 0, y: 0, z: 0, yaw: 0};
    const c: ModeController = {id: 'board', enter(_o, b) { body = {...b}; log.push('enter'); },
      update() { log.push('update'); body = {...body, x: body.x + 1}; return {body, camera: null, pose: {lean: 0, roll: 0, pitch: 0, crouch: 0, slide: 0, speed: 1}, hud: {pace: 'flow · paved', arc: 0, glyph: null, label: null}, sound: {slide: 0, roll: 0, bite: false, boost: false}, fade: null, events: []} as MoverFrame; },
      exit(o) { log.push(`exit:${o?.thresholdId ?? 'here'}`); return body; }, reducedMotion() {}, calm() {}, tier() {}, dispose() { log.push('dispose'); }};
    return c;
  };
  const riding = () => {
    const log: string[] = [], registry = createMoverRegistry({world, geography, manifest: HORIZON_MANIFEST, reducedMotion: false, calm: false, tier: 'full'});
    registry.register('board', () => counting(log));
    const start = at('skateLineStarts.1', 1), pick = registry.offers(start).find(o => o.to === 'board')!;
    expect(registry.accept(pick, start, 0)).toBe(true);
    const hold = createRideHold(registry, world, geography.ground);
    let body = {...start};
    /** One runtime frame in `mode`: the mover is stepped only when the hold says so (runtime/index.ts tick). */
    const frame = (mode: HorizonViewMode) => { if (hold.steps(mode)) body = {...registry.active()!.update(1 / 60, moverInputFrom(src()), 0).body}; };
    return {log, registry, hold, frame, body: () => body, setBody: (b: MoverBody) => { body = b; }};
  };
  const updates = (log: string[]) => log.filter(l => l === 'update').length;

  it('Look while riding pauses the mover: the mode stays board, update stops, the body is kept', () => {
    const r = riding();
    r.frame('walk'); r.frame('walk');
    expect(updates(r.log)).toBe(2);
    const before = r.body();
    expect(r.hold.pause(before)).toBe(true);
    expect(r.hold.pause(before)).toBe(false);   // already paused
    for (const m of ['look', 'journey', 'look'] as const) r.frame(m);
    expect(updates(r.log)).toBe(2);
    expect(r.hold.steps('walk')).toBe(false);    // still paused until Walk resumes it
    expect(r.registry.mode()).toBe('board'); expect(r.registry.active()).not.toBeNull();
    expect(r.log.some(l => l.startsWith('exit') || l === 'dispose')).toBe(false);
    expect(r.hold.body).toEqual(before);
  });
  it('Walk resumes it where it paused, even after a page moved the runtime body for streaming', () => {
    const r = riding();
    r.frame('walk');
    const before = r.body();
    r.hold.pause(before);
    r.setBody({x: 999, y: 99, z: 999, yaw: 2});   // shot(): the Look camera's eye
    const back = r.hold.resume()!;
    expect(back).toEqual(before);
    expect(r.hold.paused()).toBe(false); expect(r.hold.resume()).toBeNull();
    r.setBody(back); r.frame('walk');
    expect(updates(r.log)).toBe(2); expect(r.body().x).toBeCloseTo(before.x + 1, 9);
    expect(r.registry.mode()).toBe('board');
  });
  it('a reload / arrive while riding parks at a board→feet threshold through accept, and disposes the mover', () => {
    const r = riding();
    r.frame('walk');
    const mid: MoverBody = {x: 1100, y: 60, z: 700, yaw: .7};
    r.hold.pause(mid);
    const parked = r.hold.park({x: 5, y: 5, z: 5, yaw: 0}, 10)!;   // the paused rider, not the page's eye, decides the threshold
    const t = world.thresholds.find(t => t.id === parked.offer.thresholdId)!;
    expect(thresholdPairs(t).some(p => ['board', 'wheels'].includes(p.from) && p.to === 'feet')).toBe(true);
    expect(parked.offer).toMatchObject({from: 'board', to: 'feet'});
    expect([parked.body.x, parked.body.z]).toEqual([t.at[0], t.at[1]]); expect(parked.body.yaw).toBe(.7);
    expect(parked.body).toEqual(savedRideBody(world, mid, 'board', geography.ground));   // the saved-body rule
    expect(r.registry.mode()).toBe('feet'); expect(r.registry.active()).toBeNull();
    expect(r.log.slice(-2)).toEqual([`exit:${t.id}`, 'dispose']);
    expect(r.hold.paused()).toBe(false); expect(r.hold.park(mid, 11)).toBeNull();
    // In reach of a park, that park wins.
    const q = riding(), quayBody = at('landingQuay', 1.5), inReach = q.registry.offers(quayBody).find(o => o.to === 'feet')!, quay = q.hold.park(quayBody, 0)!;
    expect(inReach).toBeDefined(); expect(quay.offer).toEqual(inReach); expect(quay.body).toEqual({x: inReach.at[0], y: inReach.at[1], z: inReach.at[2], yaw: quayBody.yaw});
  });
  it('on foot there is nothing to pause, resume or park', () => {
    const registry = createMoverRegistry({world, geography, manifest: HORIZON_MANIFEST, reducedMotion: false, calm: false, tier: 'full'});
    const hold = createRideHold(registry, world);
    expect(hold.pause({x: 0, y: 0, z: 0, yaw: 0})).toBe(false); expect(hold.resume()).toBeNull();
    expect(hold.steps('walk')).toBe(false); expect(hold.park({x: 0, y: 0, z: 0, yaw: 0}, 0)).toBeNull();
  });
  it('the runtime has no path that ends a mode in place', () => {
    const src = readFileSync('src/harbour/horizon/runtime/index.ts', 'utf8');
    expect(src).not.toMatch(/exitInPlace|leaveRide|exit\(null\)/);
    expect(src).toMatch(/attachMover\([^)]*\)\{if\(!HARBOUR_DEV\)throw/);
    expect(src).toMatch(/detachMover\([^)]*\)\{if\(!HARBOUR_DEV\)throw/);
  });
});

describe('The stage status line names a pick-up/park offer on foot', () => {
  it('reads the offer ("E · <label>") on foot when one is in reach, else the plain walk/door text', () => {
    expect(statusTextFor({riding: false, offerLabel: null})).toBe(WALK_STATUS);
    expect(statusTextFor({riding: false, offerLabel: 'Pick up the board'})).toBe('E · Pick up the board');
    expect(statusTextFor({riding: false, offerLabel: 'Park'})).toBe('E · Park');
  });
  it('leaves riding (and a paused ride) to the runtime\'s own status text', () => {
    expect(statusTextFor({riding: true, offerLabel: null})).toBe(RIDING_STATUS);
    expect(statusTextFor({riding: true, offerLabel: 'Park'})).toBe(RIDING_STATUS);   // an offer never shows while riding
    expect(statusTextFor({riding: true, offerLabel: null, paused: true})).toBe(RIDE_PAUSED_STATUS);
  });
});

describe('The desktop offer bubble (R2-03)', () => {
  it('names the key and the offer, and is empty with no offer', () => {
    expect(offerBubbleText({label: 'Pick up the board'})).toBe('E · Pick up the board');
    expect(offerBubbleText({label: 'Park'})).toBe('E · Park');
    expect(offerBubbleText(null)).toBe('');
  });
  it('shows only on a fine-pointer desktop (the Enter bubble is the offer on touch), 44 px, glass, safe-area aware, no transition under reduced motion', () => {
    const css = readFileSync('src/harbour/horizon/horizon.css', 'utf8');
    const rule = css.match(/\.horizon-offer\{[^}]*\}/)![0];
    expect(rule).toMatch(/display:none/); expect(rule).toMatch(/min-height:44px/); expect(rule).toMatch(/min-width:44px/);
    expect(rule).toMatch(/env\(safe-area-inset-bottom\)/); expect(rule).toMatch(/backdrop-filter/); expect(rule).toMatch(/left:50%/);
    expect(css).toMatch(/@media\(min-width:800px\) and \(pointer:fine\)\{\.horizon-touch-controls\{display:none\}\}/);
    expect(css).toMatch(/@media\(min-width:800px\) and \(pointer:fine\)\{\.horizon-offer\{display:flex\}\}/);
    expect(css).toMatch(/@media\(prefers-reduced-motion:reduce\)\{\.horizon-offer\{transition:none\}\}/);
    expect(css).toMatch(/:root\[data-motion="reduced"\] \.horizon-offer\{transition:none\}/);
    const stage = readFileSync('src/harbour/horizon/HorizonStage.tsx', 'utf8');
    expect(stage).toMatch(/className="horizon-offer" role="status"/);
  });
});
