import {readFileSync} from 'node:fs';
import {beforeAll, describe, expect, it} from 'vitest';
import {parseHorizonDefinition} from '../src/house/world/horizonAssets.ts';
import {HORIZON_MANIFEST} from '../src/harbour/horizon/world/manifest.ts';
import type {WorldDefinition} from '../src/harbour/horizon/world/definition.ts';
import {createMoverRegistry, type HorizonGeography, type MoverDeps} from '../src/harbour/horizon/movers/shared/registry.ts';
import {offersAt, parkOfferFor, thresholdPairs, OFFER_REACH, type ThresholdOffer} from '../src/harbour/horizon/movers/shared/threshold.ts';
import {isModeId, type AirborneBody, type ModeController, type ModeId, type MoverBody, type MoverFrame} from '../src/harbour/horizon/movers/shared/mode.ts';
import {decodeTerrainAsset} from '../src/harbour/horizon/land/terrain/asset.ts';
import {createHorizonGeography} from '../src/harbour/horizon/runtime/geography.ts';
import {HORIZON_MOVERS, registerHorizonMovers, riderSlip} from '../src/harbour/horizon/runtime/moverInput.ts';
import type {BoardController} from '../src/harbour/horizon/movers/board/controller.ts';

// The real baked world (the same asset the runtime loads); the registry only reads thresholds and ground.
let world: WorldDefinition;
beforeAll(() => {
  const bytes = readFileSync('public/horizon/world/horizon-geo-1.json.gz');
  world = parseHorizonDefinition(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
});
const geography = {ground: () => 0} as unknown as HorizonGeography;
const deps = (): MoverDeps => ({world, geography, manifest: HORIZON_MANIFEST, reducedMotion: false, calm: false, tier: 'full'});
const at = (id: string, dx = 0, dy = 0): MoverBody => {
  const t = world.thresholds.find(t => t.id === id)!;
  return {x: t.at[0] + dx, y: (t.height ?? 0) + dy, z: t.at[1], yaw: 0};
};

/** A controller that records every call and parks the rider where the offer says. */
function fakeController(id: ModeId, log: string[]): ModeController {
  let body: MoverBody = {x: 0, y: 0, z: 0, yaw: 0};
  return {
    id,
    enter(offer, b) { log.push(`enter:${offer.thresholdId}`); body = {...b}; },
    update(dt) {
      log.push('update'); body = {...body, x: body.x + dt};
      const frame: MoverFrame = {body, camera: null, pose: {lean: 0, roll: 0, pitch: 0, crouch: 0, slide: 0, speed: 0}, hud: {pace: 'flow · paved', arc: 0, glyph: null, label: null}, sound: {slide: 0, roll: 0, bite: false, boost: false}, fade: null, events: []};
      return frame;
    },
    exit(offer) { log.push(`exit:${offer?.thresholdId ?? 'here'}`); return offer ? {x: offer.at[0], y: offer.at[1], z: offer.at[2], yaw: body.yaw} : body; },
    reducedMotion(on) { log.push(`reducedMotion:${on}`); }, calm(on) { log.push(`calm:${on}`); }, tier(t) { log.push(`tier:${t}`); },
    dispose() { log.push('dispose'); },
  };
}

describe('Horizon threshold offers (RIDE §10.2, 02-movers rule 1)', () => {
  it('offers the pick-up at skateLineStarts.1 [1325,470.5] on foot, and nothing there on the board', () => {
    const feet = offersAt(world, at('skateLineStarts.1', 1.5), 'feet');
    // v2.6: skateLineStarts[0] is v2's start gate (D-M5); was [1310, 154, 500].
    expect(feet[0]).toMatchObject({thresholdId: 'skateLineStarts.1', from: 'feet', to: 'board', label: 'Pick up the board', at: [1325, 158.2, 470.5]});
    expect(offersAt(world, at('skateLineStarts.1', 1.5), 'board').some(o => o.thresholdId === 'skateLineStarts.1')).toBe(false);
  });
  it('offers the park at landingQuay on the board, and respects the reach and |dy| rule', () => {
    const board = offersAt(world, at('landingQuay', 2), 'board');
    expect(board.find(o => o.thresholdId === 'landingQuay')).toMatchObject({from: 'board', to: 'feet', label: 'Park', at: [1270, 4.7, 1330]});   // v2.4: the quay finish on the islet's natural ground (was 3)
    expect(offersAt(world, at('landingQuay', OFFER_REACH + .2), 'board').some(o => o.thresholdId === 'landingQuay')).toBe(false);
    expect(offersAt(world, at('landingQuay', 0, 1.5), 'board').some(o => o.thresholdId === 'landingQuay')).toBe(false);
  });
  it('sorts offers nearest first', () => {
    const body = at('skateLineStarts.3', .5), offers = offersAt(world, body, 'feet');
    const d = offers.map(o => Math.hypot(o.at[0] - body.x, o.at[2] - body.z));
    expect(d).toEqual([...d].sort((a, b) => a - b));
  });
  it('wires every threshold in the world to modes the registry knows', () => {
    for (const t of world.thresholds) {
      const pairs = thresholdPairs(t);
      expect(pairs.length, t.id).toBeGreaterThan(0);
      for (const p of pairs) {
        // The Water's Way (PR 2 land, D-WW56): the drag lift's two station thresholds name 'lift' now and its ride comes with
        // PR 5; until a 'lift' mode is registered they offer nothing (proved below), so 'lift' is the one named placeholder.
        const sides = [p.from, p.to].filter(s => !isModeId(s) && !['wheels', 'boat', 'cable', 'lift'].includes(s));
        expect(sides, `${t.id} ${p.from}→${p.to}`).toEqual([]);
      }
    }
  });
  it('offers nothing at the drag lift\'s stations until its ride exists (PR 5)', () => {
    for (const id of ['glacierLiftFoot', 'glacierLiftHead']) {
      expect(world.thresholds.some(t => t.id === id), id).toBe(true);
      for (const mode of ['feet', 'board', 'bicycle'] as const) expect(offersAt(world, at(id), mode).filter(o => o.thresholdId === id), `${id} on ${mode}`).toEqual([]);
    }
  });
});

describe('Horizon mover registry', () => {
  it('keeps exactly one active mode and changes it only through offers, calling enter/update/exit in order', () => {
    const log: string[] = [], registry = createMoverRegistry(deps());
    registry.register('board', () => fakeController('board', log));
    expect(registry.mode()).toBe('feet'); expect(registry.active()).toBeNull();
    const pick = registry.offers(at('skateLineStarts.1', 1))[0]!;
    expect(registry.canAccept(pick)).toBe(true);
    expect(registry.accept(pick, at('skateLineStarts.1', 1), 0)).toBe(true);
    expect(registry.mode()).toBe('board'); expect(registry.active()!.id).toBe('board');
    registry.active()!.update(1 / 60, {steer: 0, forward: 1, jump: false, sprint: false, crouch: 0, accept: false, look: {dx: 0, dy: 0}}, 16);
    // A second pick-up while riding is a from-mismatch: refused, still one controller.
    const again = offersAt(world, at('skateLineStarts.1', 1), 'feet')[0]!;
    expect(registry.accept(again, at('skateLineStarts.1', 1), 20)).toBe(false);
    const park = registry.offers(at('landingQuay', 1)).find(o => o.thresholdId === 'landingQuay')!;
    expect(park.to).toBe('feet');
    expect(registry.accept(park, at('landingQuay', 1), 40)).toBe(true);
    expect(registry.mode()).toBe('feet'); expect(registry.active()).toBeNull();
    expect(registry.lastExit()).toEqual({x: 1270, y: 4.7, z: 1330, yaw: 0});
    expect(log).toEqual(['reducedMotion:false', 'calm:false', 'tier:full', 'enter:skateLineStarts.1', 'update', 'exit:landingQuay', 'dispose']);
  });
  it('refuses an offer whose from is not the current mode', () => {
    const registry = createMoverRegistry(deps());
    registry.register('board', () => fakeController('board', []));
    const park = offersAt(world, at('landingQuay'), 'board').find(o => o.thresholdId === 'landingQuay')!;
    expect(registry.canAccept(park)).toBe(false);
    expect(registry.accept(park, at('landingQuay'), 0)).toBe(false);
    expect(registry.mode()).toBe('feet');
  });
  it('refuses an offer to a mode with no registered factory (M2–M9 come later)', () => {
    const registry = createMoverRegistry(deps());
    const glide = registry.offers(at('crownLaunch', .5)).find(o => o.to === 'glider')!;
    expect(glide).toBeDefined();
    expect(registry.canAccept(glide)).toBe(false);
    expect(registry.accept(glide, at('crownLaunch'), 0)).toBe(false);
    const madeUp: ThresholdOffer = {...glide, to: 'balloon'};
    expect(registry.accept(madeUp, at('crownLaunch'), 0)).toBe(false);
    expect(registry.mode()).toBe('feet'); expect(registry.active()).toBeNull();
  });
  it('constructs a fresh controller per accept and forwards live reduced motion and calm', () => {
    const log: string[] = [], registry = createMoverRegistry(deps());
    let made = 0;
    registry.register('board', () => { made++; return fakeController('board', log); });
    const pick = () => registry.offers(at('skateLineStarts.2', .5))[0]!;
    registry.accept(pick(), at('skateLineStarts.2'), 0);
    registry.setReducedMotion(true); registry.setCalm(true);
    expect(registry.accept(parkOfferFor(world, at('skateLineStarts.2'), 'board')!, at('skateLineStarts.2'), 1)).toBe(true);   // park at a threshold (R2-01: never in place)
    registry.accept(pick(), at('skateLineStarts.2'), 1);
    expect(made).toBe(2);
    expect(log).toContain('reducedMotion:true'); expect(log).toContain('calm:true');
    expect(log.filter(l => l === 'dispose')).toHaveLength(1);
    expect(log.slice(-4)).toEqual(['reducedMotion:true', 'calm:true', 'tier:full', 'enter:skateLineStarts.2']);
  });
  it('has no way to end a mode in place (R2-01): no exitInPlace, and attach is refused while a mode is active (R2-22)', () => {
    const log: string[] = [], registry = createMoverRegistry(deps());
    expect('exitInPlace' in registry).toBe(false);
    const pick = offersAt(world, at('skateLineStarts.1', 1), 'feet')[0]!;
    expect(registry.attach(fakeController('board', log), pick, at('skateLineStarts.1', 1), 0)).toBe(true);
    expect(registry.attach(fakeController('board', log), pick, at('skateLineStarts.1', 1), 1)).toBe(false);
    expect(log.filter(l => l.startsWith('exit') || l === 'dispose')).toEqual([]);   // the first ride was not ended in place
    expect(registry.mode()).toBe('board');
  });
  it('parkOfferFor: a board→feet offer in reach first, else one at the nearest board→feet threshold; null on foot', () => {
    const near = parkOfferFor(world, at('landingQuay', 2), 'board')!;
    expect(near).toEqual(offersAt(world, at('landingQuay', 2), 'board').find(o => o.to === 'feet'));   // the nearest park in reach
    expect(near).toMatchObject({from: 'board', to: 'feet', label: 'Park'});
    const far = parkOfferFor(world, {x: 1100, y: 60, z: 700, yaw: 0}, 'board')!;
    expect(far).toMatchObject({from: 'board', to: 'feet', label: 'Park'});
    const t = world.thresholds.find(t => t.id === far.thresholdId)!;
    expect(thresholdPairs(t).some(p => ['board', 'wheels'].includes(p.from) && p.to === 'feet')).toBe(true);
    expect(parkOfferFor(world, at('landingQuay'), 'feet')).toBeNull();
  });
});

describe('The runtime registers the board and the bicycle (fix round)', () => {
  // The real geography, built the way test/horizonBoardThresholds.test.ts builds it: the board's contact adapter needs it.
  let realDeps: MoverDeps;
  beforeAll(() => {
    const terrain = readFileSync('public/horizon/terrain/horizon-geo-1.bin');
    const field = decodeTerrainAsset(terrain.buffer.slice(terrain.byteOffset, terrain.byteOffset + terrain.byteLength) as ArrayBuffer, 'full');
    const geo = createHorizonGeography(field, {...world.collision, solids: world.geometry?.solids ?? [], diagnostics: world.diagnostics ?? []} as Parameters<typeof createHorizonGeography>[1]);
    realDeps = {world, geography: geo, manifest: HORIZON_MANIFEST, reducedMotion: false, calm: false, tier: 'full'};
  }, 120000);
  it('lists the board, bicycle, shared cruiser and the two cable rides as the default movers', () => {
    // v2.6: the gondola and the funicular ride Mountain v2's lines (pass 5, D-M6).
    expect(Object.keys(HORIZON_MOVERS).sort()).toEqual(['bicycle', 'board', 'cruiser', 'funicular', 'gondola']);
  });
  it('accepts skateLineStarts.1 on foot and rides an active board controller', () => {
    const registry = createMoverRegistry(realDeps);   // as mountHorizon does, then registerHorizonMovers(registry, options.movers)
    registerHorizonMovers(registry, undefined);
    const body = at('skateLineStarts.1', 1.5);
    const pick = registry.offers(body).find(o => o.thresholdId === 'skateLineStarts.1')!;
    expect(pick).toMatchObject({from: 'feet', to: 'board', label: 'Pick up the board'});
    expect(registry.canAccept(pick)).toBe(true);
    expect(registry.accept(pick, body, 0)).toBe(true);
    expect(registry.mode()).toBe('board');
    const board = registry.active() as BoardController;
    expect(board.id).toBe('board'); expect(typeof board.state).toBe('function');
    // v2.6: the pad is v2's start gate [1325,470.5] (D-M5); was [1310,500].
    expect(Math.hypot(board.state().p[0] - 1325, board.state().p[2] - 470.5)).toBeLessThanOrEqual(OFFER_REACH);   // on the pad (under the rider since R2-11)
    let frame: MoverFrame | null = null;
    for (let i = 0; i < 60; i++) frame = board.update(1 / 60, {steer: 0, forward: 1, jump: false, sprint: false, crouch: 0, accept: false, look: {dx: 0, dy: 0}}, i * 16);
    expect(frame!.camera).not.toBeNull();
    expect(Number.isFinite(frame!.body.x) && Number.isFinite(frame!.body.y) && Number.isFinite(riderSlip(frame!.pose, board))).toBe(true);
    expect(Math.hypot(frame!.body.x - 1325, frame!.body.z - 470.5)).toBeGreaterThan(0);   // W pushed it off the pad (v2.6: was [1310,500])
    // The bicycle is registered too (it has no pick-up threshold of its own yet).
    expect(registry.accept(parkOfferFor(world, frame!.body, 'board', realDeps.geography.ground)!, frame!.body, 1000)).toBe(true);
    expect(registry.canAccept({...pick, id: 'x:feet→bicycle', to: 'bicycle'})).toBe(true);
  });
  it('lets HorizonOptions.movers replace a default', () => {
    const log: string[] = [], registry = createMoverRegistry(realDeps);
    registerHorizonMovers(registry, {board: () => fakeController('board', log)});
    const body = at('skateLineStarts.1', 1.5), pick = registry.offers(body)[0]!;
    expect(registry.accept(pick, body, 0)).toBe(true);
    expect(log).toContain('enter:skateLineStarts.1');
    expect('state' in registry.active()!).toBe(false);
  });
});

describe('airborne ownership and retained equipment',()=>{
  const launch={x:100,y:60,z:200,yaw:.4,velocity:[12,-3,8] as [number,number,number]};
  const pick={id:'test:feet→board',thresholdId:'test',at:[100,20,200] as [number,number,number],from:'feet' as const,to:'board' as const,action:'pick up',label:'Pick up the board'};
  function setup(rideable=true){
    const boardLog:string[]=[],chuteLog:string[]=[],registry=createMoverRegistry(deps());
    let received:AirborneBody|null=null,grounded=false,resumed:AirborneBody|null=null;
    const board:ModeController={...fakeController('board',boardLog),airborne:()=>grounded?null:launch,resumeAt:at=>{resumed=at;return rideable;}};
    registry.register('board',()=>{throw new Error('retained equipment must be reused');});
    registry.register('parachute',()=>({...fakeController('parachute',chuteLog),enterAirborne:b=>{received=b;},landingMotion:()=>({...launch,y:20,velocity:[9,0,6]})}));
    registry.attach(board,pick,launch,0);
    return{registry,board,boardLog,chuteLog,received:()=>received,resumed:()=>resumed,ground:()=>{grounded=true;}};
  }
  it('hands full motion to exactly one owner and resumes the identical board at touchdown',()=>{
    const h=setup();expect(h.registry.deploy(launch,0)).toBe(true);expect(h.received()).toEqual(launch);expect(h.registry.stowed()).toBe('board');expect(h.registry.active()).not.toBe(h.board);expect(h.boardLog).not.toContain('dispose');
    expect(h.registry.deploy(launch,1)).toBe(false);h.registry.finish();expect(h.registry.active()).toBe(h.board);expect(h.registry.stowed()).toBeNull();expect(h.resumed()?.velocity).toEqual([9,0,6]);
    h.registry.dispose();expect(h.boardLog.filter(x=>x==='dispose')).toHaveLength(1);expect(h.chuteLog.filter(x=>x==='dispose')).toHaveLength(1);
  });
  it('keeps equipment after a nonrideable landing and reuses it on ordinary pickup',()=>{
    const h=setup(false);h.registry.deploy(launch,0);h.registry.finish();expect(h.registry.mode()).toBe('feet');expect(h.registry.stowed()).toBe('board');expect(h.registry.resumeStowed(launch)).toBe(false);
    expect(h.registry.accept(pick,launch,1)).toBe(true);expect(h.registry.active()).toBe(h.board);expect(h.registry.stowed()).toBeNull();h.registry.dispose();expect(h.boardLog.filter(x=>x==='dispose')).toHaveLength(1);
  });
  it('rejects grounded movers and keeps settings live while equipment is stowed',()=>{
    const h=setup();h.ground();expect(h.registry.deploy(launch,0)).toBe(false);expect(h.registry.active()).toBe(h.board);
    const airborne=setup();airborne.registry.deploy(launch,0);airborne.registry.setReducedMotion(true);airborne.registry.setCalm(true);airborne.registry.setTier('lite');expect(airborne.boardLog.slice(-3)).toEqual(['reducedMotion:true','calm:true','tier:lite']);
  });
});
