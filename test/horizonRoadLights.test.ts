import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { corridorLightAnchors, stationS } from '../src/harbour/horizon/land/corridor/lights';
import type { Corridor, CorridorSide, CorridorStation, LampKind, LampSpot } from '../src/harbour/horizon/land/corridor/types';
import { CORRIDOR } from '../src/harbour/horizon/land/corridor/types';
import { createRoadLights, ROAD_LIGHT_SWITCH, type RoadLightsWorld } from '../src/harbour/horizon/runtime/roadLights';
import { LIGHT_CARD_SHARES, NIGHT_LIGHT_CARDS, ROAD_LIGHTS, roadLampDelay, roadLampRamp } from '../src/harbour/horizon/sky/night';
import type { LightAnchor, Point3 } from '../src/harbour/horizon/world/definition';

// ---- a synthetic corridor: a straight road along +x at y = 10, lamps every 24 eu on the right, a tunnel lamp at the end ----
const side = (paved: number): CorridorSide => ({ edge: 'kerb', guard: 'none', drop: 0, waterEu: null, paved });
function corridor(opts: { id?: string; length?: number; spacing?: number; closed?: boolean; tunnelAt?: number; reachSplit?: number } = {}): Corridor {
  const id = opts.id ?? 'V01', length = opts.length ?? 240, spacing = opts.spacing ?? 24, stations: CorridorStation[] = [];
  for (let s = 0; s <= length; s += CORRIDOR.step) stations.push({ s, at: [s, 10, 0], tangent: [1, 0], grade: 0, context: 'developed', reachId: s < (opts.reachSplit ?? Infinity) ? 'R1' : 'R2', half: 4, left: side(5), right: side(5) });
  const lamps: LampSpot[] = [];
  // Authored out of order on purpose: `order` must follow s, not the array.
  const positions: number[] = []; for (let s = spacing / 2; s < length; s += spacing) positions.push(s);
  positions.reverse();
  for (const s of positions) lamps.push(lamp(`${id}.lamp.${s}`, 'roadLantern', s, s < (opts.reachSplit ?? Infinity) ? 'R1' : 'R2'));
  if (opts.tunnelAt !== undefined) lamps.push(lamp(`${id}.tunnel`, 'tunnelLamp', opts.tunnelAt, 'R1'));
  const reaches = opts.reachSplit ? [{ id: 'R1', label: 'one', from: 0, to: opts.reachSplit, context: 'developed' as const }, { id: 'R2', label: 'two', from: opts.reachSplit, to: length, context: 'developed' as const }] : [{ id: 'R1', label: 'one', from: 0, to: length, context: 'developed' as const }];
  return { id, closed: opts.closed ?? false, step: CORRIDOR.step, stations, reaches, markings: [], guards: [], lamps, planting: [], stops: [] };
}
function lamp(id: string, kind: LampKind, s: number, reachId: string): LampSpot {
  const off = 5 + CORRIDOR.lampSetback;
  return { id, kind, at: [s, 10, off], head: [s, 10 + CORRIDOR.lampHeight, off - 1.4], pool: [s, 10, 2.5], poolRadius: CORRIDOR.lampPoolRadius, yaw: 0, side: 'right', reachId };
}
const worldOf = (corridors: Corridor[], extra: LightAnchor[] = []): RoadLightsWorld => ({ lights: [...extra, ...corridorLightAnchors(corridors)], corridors, beds: [] });
function camera(at: Point3 = [0, 12, 0], look: Point3 = [100, 12, 0]) {
  const c = new THREE.PerspectiveCamera(58, 1, 0.1, 1000); c.position.set(...at); c.lookAt(...look); c.updateMatrixWorld(); return c;
}
const lightCount = (scene: THREE.Scene) => { let n = 0; scene.traverse(o => { if ((o as THREE.Light).isLight) n++; }); return n; };

describe('the clock ramp (ROAD.md §6)', () => {
  it('is 0 by day, full by civil dusk, smooth in between', () => {
    expect(roadLampRamp(30)).toBe(0); expect(roadLampRamp(2)).toBe(0); expect(roadLampRamp(-6)).toBe(1); expect(roadLampRamp(-20)).toBe(1);
    expect(roadLampRamp(-2)).toBeCloseTo(0.5, 6);
    let prev = 0; for (let e = 2; e >= -6; e -= 0.25) { const k = roadLampRamp(e); expect(k).toBeGreaterThanOrEqual(prev); prev = k; }
  });
  it('dusk and dawn trace the same curve (symmetric in elevation, one function of the sun)', () => {
    // A day's elevations rise and fall; the lamps at a given elevation are the same whichever way the sun moves.
    const run = (elevations: number[]) => {
      const scene = new THREE.Scene(), lights = createRoadLights(scene, worldOf([corridor()]), { tier: 'full' }), cam = camera(), out: number[] = [];
      let t = 0; for (const e of elevations) { for (let i = 0; i < 600; i++) { lights.update(cam, e, t); t += 50; } out.push(lights.intensity('V01.lamp.12')); }
      return out;
    };
    // −1° sits inside the switch's hysteresis band (k between ROAD_LIGHT_SWITCH.off and .on): a run already on stays on
    // (dawn), a run still off stays off (dusk) — the only asymmetry, and it is what keeps a stepped sun from flickering.
    const dusk = [10, 4, 1, 0, -1, -3, -5, -8], dawn = [...dusk].reverse(), band = dusk.indexOf(-1);
    const a = run(dusk), b = run(dawn).reverse();
    for (let i = 0; i < a.length; i++) if (i !== band) expect(a[i]).toBeCloseTo(b[i]!, 6); else { expect(a[i]).toBe(0); expect(b[i]).toBeCloseTo(roadLampRamp(-1), 6); }
    // A lamp is dark until its run switches on (k ≥ ROAD_LIGHT_SWITCH.on), then warms in and follows k.
    for (let i = 0; i < a.length; i++) if (i !== band) expect(a[i]).toBeCloseTo(roadLampRamp(dusk[i]!) >= ROAD_LIGHT_SWITCH.on ? roadLampRamp(dusk[i]!) : 0, 6);
    expect(roadLampRamp(-1)).toBeGreaterThan(ROAD_LIGHT_SWITCH.off); expect(roadLampRamp(-1)).toBeLessThan(ROAD_LIGHT_SWITCH.on);
    expect(a[0]).toBe(0); expect(a.at(-1)).toBe(1);
  });
  it('keeps tunnel lamps on by day (STYLE tunnel portal: interior lamps always on)', () => {
    const scene = new THREE.Scene(), lights = createRoadLights(scene, worldOf([corridor({ tunnelAt: 100 })]), { tier: 'full' });
    lights.update(camera(), 45, 0);
    expect(lights.intensity('V01.tunnel')).toBe(1); expect(lights.intensity('V01.lamp.12')).toBe(0);
    expect(lights.stats().roadCards).toBe(1);
  });
  it('a reload mid-evening lands lit: the first reading is the clock, nothing blinks or replays', () => {
    const scene = new THREE.Scene(), lights = createRoadLights(scene, worldOf([corridor()]), { tier: 'full' }), cam = camera();
    lights.update(cam, -10, 123_456);
    for (const l of corridor().lamps) expect(lights.intensity(l.id)).toBe(1);
    let min = 1; for (let t = 123_456; t < 130_000; t += 16) { lights.update(cam, -10, t); for (const l of corridor().lamps) min = Math.min(min, lights.intensity(l.id)); }
    expect(min).toBe(1);
    expect(lights.busy(130_000)).toBe(false);
  });
});

describe('sequencing (LIGHT §3: 1 s apart along the line, never all at once)', () => {
  it('orders anchors along s per run, whatever the authored order', () => {
    const anchors = corridorLightAnchors([corridor({ reachSplit: 120 })]);
    const r1 = anchors.filter(a => a.line === 'V01:R1').sort((a, b) => a.order! - b.order!), r2 = anchors.filter(a => a.line === 'V01:R2').sort((a, b) => a.order! - b.order!);
    expect(r1.map(a => a.at[0])).toEqual([12, 36, 60, 84, 108]); expect(r2.map(a => a.at[0])).toEqual([132, 156, 180, 204, 228]);
    expect(r1.map(a => a.order)).toEqual([0, 1, 2, 3, 4]);
  });
  it('switches a run on in sequence ~1 s apart and settles within a few seconds', () => {
    const c = corridor({ length: 120 }), scene = new THREE.Scene(), lights = createRoadLights(scene, worldOf([c]), { tier: 'full' }), cam = camera();
    lights.update(cam, 10, 0);
    const reached = new Map<string, number>();
    for (let t = 16; t < 12_000; t += 16) {
      lights.update(cam, -10, t);
      for (const l of c.lamps) if (!reached.has(l.id) && lights.intensity(l.id) > 0.5) reached.set(l.id, t);
    }
    const byS = [...c.lamps].sort((a, b) => a.at[0] - b.at[0]).map(l => reached.get(l.id)!);
    expect(byS.every(Number.isFinite)).toBe(true);
    for (let i = 1; i < byS.length; i++) { expect(byS[i]! - byS[i - 1]!).toBeGreaterThan(800); expect(byS[i]! - byS[i - 1]!).toBeLessThan(1200); }
    // The switch fires when the displayed ramp crosses ROAD_LIGHT_SWITCH.on (the ramp follows the clock at 1/s): the whole run is on by then + settle.
    expect(byS.at(-1)! - byS[0]!).toBeLessThanOrEqual(ROAD_LIGHTS.settleMs);
    expect(byS.at(-1)!).toBeLessThan(ROAD_LIGHT_SWITCH.on * 1000 + ROAD_LIGHTS.settleMs + ROAD_LIGHTS.warmMs + 500);
    expect(lights.busy(12_000)).toBe(false);
  });
  it('compresses a long run so it still settles within settleMs', () => {
    expect(roadLampDelay(1, 3)).toBe(1000); expect(roadLampDelay(29, 30)).toBeLessThanOrEqual(ROAD_LIGHTS.settleMs); expect(roadLampDelay(0, 30)).toBe(0);
  });
  it('switches off at dawn along the same order, and a stepped sun near the threshold never flickers a run', () => {
    const c = corridor({ length: 72 }), scene = new THREE.Scene(), lights = createRoadLights(scene, worldOf([c]), { tier: 'full' }), cam = camera();
    lights.update(cam, -10, 0);
    // Hover around the switch value: k between off and on thresholds keeps the run on.
    const eAt = (k: number) => { let lo = -6, hi = 2; for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (roadLampRamp(mid) > k) lo = mid; else hi = mid; } return (lo + hi) / 2; };
    const mid = eAt((ROAD_LIGHT_SWITCH.on + ROAD_LIGHT_SWITCH.off) / 2);
    let t = 0; for (let i = 0; i < 400; i++) { lights.update(cam, i % 2 ? mid : mid + 0.05, t += 16); }
    expect(lights.stats().linesOn).toBe(1);
    for (let i = 0; i < 800; i++) lights.update(cam, 10, t += 16);
    expect(lights.stats().linesOn).toBe(0);
    for (const l of c.lamps) expect(lights.intensity(l.id)).toBe(0);
    for (let i = 0; i < 400; i++) lights.update(cam, 10, t += 16);
    expect(lights.stats().roadCards).toBe(0); expect(lights.pointIntensities().every(v => v === 0)).toBe(true);   // by day the fixtures are just objects
  });
});

describe('the D-R3 point-light pool', () => {
  it('holds a fixed number of shadowless point lights across day and night (no add/remove)', () => {
    for (const tier of ['full', 'lite'] as const) {
      const scene = new THREE.Scene(), lights = createRoadLights(scene, worldOf([corridor({ tunnelAt: 60 })]), { tier }), cam = camera();
      const count = lightCount(scene), ids = lights.lights.map(l => l.uuid);
      expect(count).toBe(ROAD_LIGHTS.pointLights[tier]);
      let t = 0;
      for (const e of [30, 5, 0, -3, -8, -20, -3, 10, 40]) for (let i = 0; i < 200; i++) {
        lights.update(cam, e, t += 16, { hidden: i === 100 && e === -20 });
        expect(lightCount(scene)).toBe(count);
      }
      expect(lights.lights.map(l => l.uuid)).toEqual(ids);
      for (const l of lights.lights) { expect(l.castShadow).toBe(false); expect(l.visible).toBe(true); expect(l.parent).not.toBeNull(); expect(l.color.getHexString()).toBe('ffd98e'); }
    }
  });
  it('adds no point lights to a world without road lamps (the committed bake before the corridor lands)', () => {
    const scene = new THREE.Scene(), lights = createRoadLights(scene, { lights: [{ id: 'door.a.lamp', at: [0, 2.2, 0], kind: 'door' }] }, { tier: 'full' });
    lights.update(camera(), -12, 0); expect(lightCount(scene)).toBe(0); expect(lights.stats().anchorCards).toBe(1);
  });
  it('is dark by day (tunnel lamps included) and lights the nearest lamps ahead at night', () => {
    const scene = new THREE.Scene(), lights = createRoadLights(scene, worldOf([corridor({ tunnelAt: 50 })]), { tier: 'full' }), cam = camera([100, 12, 0], [200, 12, 0]);
    let t = 0; for (let i = 0; i < 100; i++) lights.update(cam, 30, t += 16);
    expect(lights.pointIntensities().every(v => v === 0)).toBe(true);
    for (let i = 0; i < 800; i++) lights.update(cam, -12, t += 16);
    const s = lights.stats();
    expect(s.pointLightsLit).toBe(6);
    // Nearest first, lamps ahead preferred over lamps behind at the same distance (the tunnel lamp at 50 is behind: not picked).
    const ids = new Set(s.pointAssigned);
    for (const id of ['V01.lamp.108', 'V01.lamp.132', 'V01.lamp.156', 'V01.lamp.84']) expect(ids.has(id)).toBe(true);
    expect(ids.has('V01.tunnel')).toBe(false);
  });
  it('lights an 8 m carriageway under a lamp and falls off toward the next pool', () => {
    // Irradiance of three's physically based point light (decay 2, cut-off distance) at the road surface.
    const E = (dx: number, dz: number) => { const h = CORRIDOR.lampHeight, d = Math.hypot(dx, dz, h), cut = Math.max(0, 1 - (d / ROAD_LIGHTS.pointDistance) ** 4) ** 2; return ROAD_LIGHTS.pointIntensity / (d * d) * cut * (h / d); };
    expect(E(0, 0)).toBeGreaterThan(0.9);            // under the lamp: a clearly lit patch (the day sun is ≈ 4.4)
    expect(E(0, 0)).toBeLessThan(1.6);               // …but not a second sun (ACES at exposure 1.25 blows out above ~2)
    expect(E(0, 8.5)).toBeGreaterThan(0.15);          // the far lane edge of an 8 m carriageway (head 4.5 eu off the centreline)
    expect(E(12, 0)).toBeLessThan(E(0, 0) * 0.2);    // half-way to the next lamp: the pool decals carry it
    expect(E(ROAD_LIGHTS.pointDistance, 0)).toBe(0); // bounded: nothing beyond the cut-off
  });
  it('cross-fades reassignment without popping as the camera drives the road', () => {
    const c = corridor({ length: 600 }), scene = new THREE.Scene(), lights = createRoadLights(scene, worldOf([c]), { tier: 'full' });
    let t = 0, prev = lights.pointIntensities(), maxJump = 0, reassigned = 0, prevIds = lights.stats().pointAssigned;
    const dt = 1000 / 60, bound = ROAD_LIGHTS.pointIntensity * (dt / 1000) / ROAD_LIGHTS.pointFadeS;
    for (let x = -20; x < 620; x += 16 * dt / 1000) {       // 16 m/s, the cruiser's top speed
      const cam = camera([x, 12, 0], [x + 50, 12, 0]);
      lights.update(cam, -12, t += dt);
      const now = lights.pointIntensities(), ids = lights.stats().pointAssigned;
      for (let i = 0; i < now.length; i++) { maxJump = Math.max(maxJump, Math.abs(now[i]! - prev[i]!)); if (ids[i] !== prevIds[i]) reassigned++; }
      prev = now; prevIds = ids;
    }
    expect(reassigned).toBeGreaterThan(10);
    // Per frame, a slot moves by at most the cross-fade rate plus the distance fade (a few % of the fade band per frame).
    expect(maxJump).toBeLessThan(bound * 1.6);
  });
});

describe('light-card caps', () => {
  const thresholds = (n: number): LightAnchor[] => Array.from({ length: n }, (_, i) => ({ id: `t${i}.lamp`, at: [i * 3, 10.8, 20] as Point3, kind: 'threshold' }));
  it('respects the lite cap of 48 in total and keeps each class its share', () => {
    const many = corridor({ length: 4000, spacing: 20 });
    for (const tier of ['lite', 'full'] as const) {
      const scene = new THREE.Scene(), lights = createRoadLights(scene, worldOf([many], thresholds(300)), { tier });
      lights.update(camera([200, 12, 0]), -12, 0);
      const s = lights.stats();
      expect(s.cards).toBeLessThanOrEqual(NIGHT_LIGHT_CARDS[tier]);
      expect(s.cards).toBe(NIGHT_LIGHT_CARDS[tier]);
      expect(s.roadCards).toBe(LIGHT_CARD_SHARES[tier].road); expect(s.anchorCards).toBe(LIGHT_CARD_SHARES[tier].anchor);
    }
  });
  it('lends an unused share to the other class, never exceeding the cap', () => {
    const scene = new THREE.Scene(), lights = createRoadLights(scene, worldOf([corridor({ length: 120 })], thresholds(300)), { tier: 'lite' });
    lights.update(camera(), -12, 0);
    const s = lights.stats();
    expect(s.roadCards).toBe(5); expect(s.anchorCards).toBe(43); expect(s.cards).toBe(48);
    // By day only always-on lamps draw; door/threshold cards are night only.
    const day = createRoadLights(new THREE.Scene(), worldOf([corridor({ length: 120 })], thresholds(300)), { tier: 'lite' });
    day.update(camera(), 20, 0); expect(day.stats().cards).toBe(0);
  });
});

describe('anchors from a synthetic corridor (land/corridor/lights.ts)', () => {
  it('carries kind, head, pool, radius, corridor id, run and order', () => {
    const c = corridor({ length: 96, tunnelAt: 40 }), anchors = corridorLightAnchors([c]);
    expect(anchors).toHaveLength(c.lamps.length);
    const a = anchors.find(x => x.id === 'V01.lamp.36')!;
    expect(a).toMatchObject({ kind: 'roadLantern', head: [36, 15.2, 4.5], pool: [36, 10, 2.5], poolRadius: CORRIDOR.lampPoolRadius, corridorId: 'V01', line: 'V01:R1' });
    expect(anchors.find(x => x.id === 'V01.tunnel')!.kind).toBe('tunnelLamp');
    expect(stationS(c.stations, 37.3, 5)).toBeCloseTo(37.3, 6);
    // Deterministic: same corridors → identical anchors.
    expect(corridorLightAnchors([corridor({ length: 96, tunnelAt: 40 })])).toEqual(anchors);
  });
  it('orders a reach that wraps a closed corridor across its seam', () => {
    const c = corridor({ length: 200, spacing: 40, closed: true });
    c.reaches = [{ id: 'R1', label: 'wrap', from: 150, to: 50, context: 'developed' }, { id: 'R2', label: 'rest', from: 50, to: 150, context: 'open' }];
    c.lamps = [20, 60, 100, 140, 180].map(s => lamp(`L${s}`, 'roadLantern', s, s >= 150 || s < 50 ? 'R1' : 'R2'));
    const r1 = corridorLightAnchors([c]).filter(a => a.line === 'V01:R1').sort((a, b) => a.order! - b.order!);
    expect(r1.map(a => a.id)).toEqual(['L180', 'L20']);
  });
});

describe('pool decals conform to the road (no floating discs)', () => {
  it('follows a sloped surface and fades out where the ground drops away', () => {
    const c = corridor({ length: 48, spacing: 48 });   // one lamp at s = 24
    const ground = (x: number, z: number) => z > 8 ? 10 - 6 : 10 + (x - 24) * 0.08;   // an 8 % grade; a 6 m drop beyond z = 8
    const scene = new THREE.Scene(), lights = createRoadLights(scene, worldOf([c]), { tier: 'full', ground });
    lights.update(camera([24, 12, -20], [24, 10, 0]), -12, 0);
    const pools = scene.getObjectByName('lightCards.roadPools') as THREE.Mesh, pos = pools.geometry.getAttribute('position'), col = pools.geometry.getAttribute('color');
    const drawn = pools.geometry.drawRange.count; expect(drawn).toBeGreaterThan(0);
    let onSlope = 0, dropped = 0;
    for (let i = 0; i < 65; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (z > 8) { expect(col.getX(i)).toBe(0); dropped++; continue; }
      expect(y).toBeCloseTo(10 + (x - 24) * 0.08 + ROAD_LIGHTS.poolLift, 5); onSlope++;
    }
    expect(onSlope).toBeGreaterThan(30); expect(dropped).toBeGreaterThan(0);
    expect((pools.material as THREE.MeshBasicMaterial).blending).toBe(THREE.AdditiveBlending);
    expect((pools.material as THREE.MeshBasicMaterial).polygonOffset).toBe(true);
  });
  it('drops a road threshold lamp\'s floating bead to a flush stud on its pad (LOOK.md 27–28)', () => {
    const world: RoadLightsWorld = { lights: [{ id: 'on.lamp', at: [10, 10.8, 0], kind: 'threshold' }, { id: 'off.lamp', at: [10, 10.8, 40], kind: 'threshold' }],
      beds: [{ id: 'V01', profile: 'road', surface: 'paved', kind: 'road', width: 8, districtIds: [], points: [[0, 10, 0], [100, 10, 0]] }] };
    const scene = new THREE.Scene(), lights = createRoadLights(scene, world, { tier: 'full' });
    lights.update(camera([10, 12, -20]), -12, 0);
    const beads = scene.getObjectByName('lightCards.beads') as THREE.InstancedMesh, m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    const ys = [0, 1].map(i => { beads.getMatrixAt(i, m); m.decompose(p, q, s); return { z: p.z, y: p.y, sy: s.y }; }).sort((a, b) => a.z - b.z);
    expect(ys[0]!.y).toBeLessThan(10.1); expect(ys[0]!.sy).toBeLessThan(0.3);   // on the road: flush with the pad
    expect(ys[1]!.y).toBeCloseTo(10.8, 5); expect(ys[1]!.sy).toBe(1);            // off the road: unchanged
  });
});
