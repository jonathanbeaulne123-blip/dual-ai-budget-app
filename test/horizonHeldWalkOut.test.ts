// PR #561 review (Codex P2): Look → Walk before the page's chunk has arrived must not open the parachute. The body stays
// held under the eye (no movement, no airborne physics) until the chunk lands; then the dry walk-out runs. All twelve pages ×
// both tiers, each with its own page chunk delayed, on the committed bake (index footprints = the runtime's gate).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { LandCuts, StructureSolid, TerrainField } from '../src/harbour/horizon/land/interfaces';
import { decodeTerrainAsset } from '../src/harbour/horizon/land/terrain/asset';
import { createHorizonGeography, HORIZON_WALKABLE_DEGREES } from '../src/harbour/horizon/runtime/geography';
import { createChunkGate } from '../src/harbour/horizon/runtime/chunkGate';
import { horizonFootFrame, horizonWalkOut, type HorizonWalkProbe } from '../src/harbour/horizon/runtime/walkOut';
import { createHorizonChunkLoader, parseHorizonIndex } from '../src/house/world/horizonAssets';
import type { HorizonPathGraph } from '../src/harbour/horizon/world/pathGraph';

type Point3 = [number, number, number];
type World = { collision: Omit<LandCuts, 'solids' | 'diagnostics'>; geometry: { solids: StructureSolid[] }; pathGraph: HorizonPathGraph; views: { id: string; eye: Point3; target: Point3; ground?: Point3 }[] };
const world = JSON.parse(readFileSync('public/horizon/world/horizon-geo-1.json', 'utf8')) as World;
const indexBytes = readFileSync('public/horizon/world/horizon-geo-1.index.json.gz');
const loader = createHorizonChunkLoader(parseHorizonIndex(indexBytes.buffer.slice(indexBytes.byteOffset, indexBytes.byteOffset + indexBytes.byteLength) as ArrayBuffer))!;
const terrain = (tier: 'full' | 'lite'): TerrainField => { const bytes = readFileSync('public/horizon/terrain/horizon-geo-1.bin'); return decodeTerrainAsset(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), tier); };
/** The runtime's collision with only the resident chunks' solids (chunk loader: a chunk appends its district's solids). */
const geographyWithout = (field: TerrainField, delayed: ReadonlySet<string>) => createHorizonGeography(field, { ...world.collision, solids: world.geometry.solids.filter(s => !delayed.has(s.districtId ?? '')), diagnostics: [] } as LandCuts);
const probeOf = (geo: ReturnType<typeof createHorizonGeography>): HorizonWalkProbe => (x, z, y) => { const at = geo.surface(x, z, y); return at && at.slope <= HORIZON_WALKABLE_DEGREES && !geo.submerged(x, z, at.y) && !geo.blocked(x, z, at.y) ? { y: at.y } : null; };
/** runtime step(): the body leaves support (→ beginAirborne → parachute) when no floor is within 5 cm under it. */
const unsupported = (geo: ReturnType<typeof createHorizonGeography>, b: { x: number; y: number; z: number }) => { const floor = geo.surface(b.x, b.z, b.y, .02); return !floor || b.y - floor.y > .05; };
const FRAMES_5S = 100;   // 5 s of 0.05 s steps

describe('Codex P2 · Look → Walk with the page chunk delayed 5 s: held, never airborne, then the dry walk-out', () => {
  const wouldFall: Record<string, string[]> = {}, wrongPlace: Record<string, string[]> = {};
  for (const tier of ['full', 'lite'] as const) {
    const field = terrain(tier), full = geographyWithout(field, new Set());
    for (const view of world.views) it(`page ${view.id} · ${tier}`, () => {
      const loaded = horizonWalkOut({ eye: view.eye, target: view.target, ground: view.ground }, world.pathGraph, probeOf(full));
      // The page's chunk(s): what the runtime's gate names at the eye and at the walk-out's destination (index footprints,
      // 1 eu probe) — G: undercroft (+ crown at its ground); J: prow, undercroft at its ground (its eye is bare cliff). Delayed;
      // every other chunk resident.
      const none = createChunkGate({ ready: () => false, covering: loader.covering }, () => 'harbour');
      const delayed = new Set([...none.missingAt(view.eye[0], view.eye[2]), ...none.missingAt(loaded.x, loaded.z)]);
      expect(delayed.size, 'the page stands on at least one chunk').toBeGreaterThan(0);
      const gate = createChunkGate({ ready: id => !delayed.has(id), covering: loader.covering }, () => 'harbour'), resident = (x: number, z: number) => gate.missingAt(x, z).length === 0;
      const partial = geographyWithout(field, delayed);
      // shot(): the body under the eye. Before the fix: the next Walk step fell (beginAirborne → chute) where the eye's floor is
      // in the delayed chunk, and the walk-out chose its place on the partial collision.
      const body = { x: view.eye[0], y: view.eye[1] - 1.6, z: view.eye[2] }, placed = { ...body };
      if (unsupported(partial, body)) (wouldFall[tier] ??= []).push(view.id);
      const blind = horizonWalkOut({ eye: view.eye, target: view.target, ground: view.ground }, world.pathGraph, probeOf(partial));
      if (Math.hypot(blind.x - loaded.x, blind.y - loaded.y, blind.z - loaded.z) > .01) (wrongPlace[tier] ??= []).push(view.id);
      // setMode('walk') → walkOut(): the first point it must probe has no collision yet → `wait` there; the body is held.
      const first = horizonWalkOut({ eye: view.eye, target: view.target, ground: view.ground }, world.pathGraph, probeOf(partial), resident);
      expect(first.how).toBe('wait'); expect(resident(first.x, first.z)).toBe(false);
      // 5 s of frames: every one is `held` (step() returns before movement and before the airborne branch); the body never moves.
      for (let f = 0; f < FRAMES_5S; f++) expect(horizonFootFrame({ walkOut: true, restore: false, resnap: true }, () => resident(first.x, first.z))).toBe('held');
      expect(body).toEqual(placed);
      // The chunk arrives: that frame re-seats (reseat → walkOut(true)) before any physics; the walk-out is the loaded one — dry.
      delayed.clear();
      expect(horizonFootFrame({ walkOut: true, restore: false, resnap: true }, () => resident(first.x, first.z))).toBe('reseat');
      const out = horizonWalkOut({ eye: view.eye, target: view.target, ground: view.ground }, world.pathGraph, probeOf(full), resident), at = full.surface(out.x, out.z, out.y + .1);
      expect(out).toEqual(loaded);
      expect(at).not.toBeNull(); expect(Math.abs(at!.y - out.y)).toBeLessThan(.05); expect(full.submerged(out.x, out.z, out.y)).toBe(false);
      expect(unsupported(full, out), 'stands on the floor it landed on').toBe(false);
      if (view.id === 'G' || view.id === 'J') { expect(out.how).toBe('ground'); expect([out.x, out.z]).toEqual([view.ground![0], view.ground![2]]); }
    });
  }
  it('before the fix: G (floor only in `undercroft`) fell into the chute, and J walked out to a node instead of its ground', () => {
    expect(wouldFall.full).toContain('G'); expect(wouldFall.lite).toContain('G');
    expect(wrongPlace.full).toContain('J'); expect(wrongPlace.lite).toContain('J');
    // Measured on the committed bake (candidate 6): pages whose first Walk step had no floor within 5 cm without their chunk,
    // and pages whose walk-out landed elsewhere (or at another height) on the partial collision.
    expect(wouldFall).toEqual({ full: ['A', 'B', 'C', 'E', 'F', 'G', 'H', 'L'], lite: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'K', 'L'] });
    expect(wrongPlace).toEqual({ full: ['A', 'B', 'C', 'E', 'F', 'G', 'H', 'I', 'J', 'L'], lite: ['A', 'B', 'C', 'E', 'F', 'G', 'H', 'I', 'J', 'L'] });
  });
});

describe('Codex P2 · a restore into a missing chunk is held too, then validated', () => {
  it('Bight Bridge deck (bight delayed): the saved body over water is held, not dropped; the deck carries it once bight lands', () => {
    const field = terrain('full'), saved = { x: 469.6, y: 12, z: 1039.9 };
    const delayed = new Set(createChunkGate({ ready: () => false, covering: loader.covering }, () => 'harbour').missingAt(saved.x, saved.z));
    expect([...delayed]).toContain('bight');
    const gate = createChunkGate({ ready: id => !delayed.has(id), covering: loader.covering }, () => 'harbour');
    expect(unsupported(geographyWithout(field, delayed), saved), 'without its chunk the deck is not there').toBe(true);
    for (let f = 0; f < FRAMES_5S; f++) expect(horizonFootFrame({ walkOut: false, restore: true, resnap: true }, () => gate.missingAt(saved.x, saved.z).length === 0)).toBe('held');
    delayed.clear();
    expect(horizonFootFrame({ walkOut: false, restore: true, resnap: true }, () => gate.missingAt(saved.x, saved.z).length === 0)).toBe('reseat');
    expect(unsupported(geographyWithout(field, delayed), saved)).toBe(false);
  });
  it('nothing pending is a free frame (the gate is not even consulted)', () => {
    let asked = 0; expect(horizonFootFrame({ walkOut: false, restore: false, resnap: false }, () => { asked++; return false; })).toBe('free'); expect(asked).toBe(0);
  });
});

describe('Codex P2 · runtime wiring', () => {
  const runtime = readFileSync('src/harbour/horizon/runtime/index.ts', 'utf8');
  const step = runtime.slice(runtime.indexOf('function step(dt:number,now:number){'), runtime.indexOf('function tick(now:number){'));
  it('step() holds the body before any movement or airborne branch; the hold is horizonFootFrame', () => {
    const held = step.indexOf('if(bodyHeld()){'), move = step.indexOf('moved=move('), air = step.indexOf('beginAirborne(');
    expect(held).toBeGreaterThan(0); expect(held).toBeLessThan(move); expect(held).toBeLessThan(air);
    expect(step).toMatch(/if\(bodyHeld\(\)\)\{velocityY=0;jumpRequested=false;holdStatus\(\);/);
    expect(runtime).toMatch(/const at=holdPoint\(\),frame=horizonFootFrame\(\{walkOut:pendingWalkOut,restore:pendingRestore!==null,resnap\},\(\)=>gateOpen\(at\[0\],at\[1\]\)\);/);
    // walkOut asks the gate at every point it probes; a `wait` holds the body where it is (no relocation onto partial collision).
    expect(runtime).toMatch(/world\.pathGraph!,walkProbe,\(x,z\)=>gateOpen\(x,z\)\);/);
    expect(runtime).toMatch(/if\(out\.how==='wait'\)\{pendingWalkOut=true;walkOutWait=\[out\.x,out\.z\];resnap=true;scheduler\?\.retry\(heldNow\);return false;\}/);
  });
  it('leaving Walk with a walk-out pending keeps the page choice (the eye is not a physical body); re-seats wait for Walk', () => {
    expect(runtime).toMatch(/function leaveWalk\(\)\{if\(pendingWalkOut\)\{pendingWalkOut=false;walkOutWait=null;pageChosen=true;\}else physicalBody=\{\.\.\.body\};resnap=false;\}/);
    expect(runtime).toMatch(/if\(resnap&&mode==='walk'&&gate\)\{const at=holdPoint\(\);if\(!gate\.missingAt\(at\[0\],at\[1\]\)\.length\)\{resnap=false;reseat\(\);\}\}/);
  });
});
