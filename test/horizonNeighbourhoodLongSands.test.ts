// The Water's Way, Long Sands (STORY place 5; STYLE §2.5 Direction B; D-WW150…159): the `landing` module's Long Sands half
// on the committed bake — determinism, validation, the place's own contracts (palms never in the Reach, the glider field,
// the wheel's sight lines and the ferry line, page D's foreground, the night order) and the per-district budget.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { decodeTerrainAsset } from '../src/harbour/horizon/land/terrain/asset.ts';
import { terrainHeight } from '../src/harbour/horizon/world/geometry.ts';
import { districtAt } from '../src/harbour/horizon/world/districts.ts';
import { protectedGreenOutline } from '../src/harbour/horizon/world/views.ts';
import { pointInPolygon } from '../src/harbour/horizon/world/geometry.ts';
import { HORIZON_MANIFEST } from '../src/harbour/horizon/world/manifest.ts';
import { PLANT_FORM } from '../src/harbour/horizon/land/corridor/plan/species.ts';
import { NF_BENT_PALMS } from '../src/harbour/horizon/runtime/corridorPlanting.ts';
import { buildFarLandmarks } from '../src/harbour/horizon/runtime/dressingLayer.ts';
import { createDressingContext, validateDressing, buildingHeight, PROP_HEIGHT, type DressingContextImpl } from '../src/harbour/horizon/neighbourhoods/bake.ts';
import { NEIGHBOURHOOD_MODULES } from '../src/harbour/horizon/neighbourhoods/index.ts';
import { buildSands, buildSandsParts, NIGHT_ORDER, SANDS } from '../src/harbour/horizon/neighbourhoods/landing/sands.ts';
import { storyEye, storyLandmark, validateStoryAgainstDressing, aimPoint } from '../src/harbour/horizon/world/story.ts';
import type { NeighbourhoodDressing, PlantRecord } from '../src/harbour/horizon/neighbourhoods/types.ts';
import type { Point2, Point3 } from '../src/harbour/horizon/world/definition.ts';

type World = { ctx: DressingContextImpl; json: any; dressing: NeighbourhoodDressing; again: NeighbourhoodDressing; notes: Record<string, number | string> };
let W: World | null = null;
/** The bake-time context rebuilt from the committed bake (the module's own `dressing.*` solids left out: it is what the
 *  bake handed the module), and the module's output on it — built once, in an async beforeAll that yields between the heavy
 *  steps (CI runs four workers: a worker held synchronously for long fails the gate with "Timeout calling onTaskUpdate"). */
const world = (): World => { if (!W) throw new Error('Long Sands: the world fixture did not build'); return W; };
const tick = () => new Promise(r => setTimeout(r, 0));
beforeAll(async () => {
  const json = JSON.parse(readFileSync('public/horizon/world/horizon-geo-1.json', 'utf8')); await tick();
  const bytes = readFileSync('public/horizon/terrain/horizon-geo-1.bin');
  const field = decodeTerrainAsset(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), 'full'); await tick();
  const solids = json.geometry.solids.map((q: any) => ({ ...q, id: q.sourceId ?? q.id.split('@')[0] })).filter((s: any) => !s.id.startsWith('dressing.'));
  const ctx = createDressingContext({ ground: (x, z) => terrainHeight(field, x, z), beds: json.collision.beds, pads: json.collision.pads, waters: json.collision.waters, solids,
    hosts: json.hosts.map((h: any) => ({ id: h.id, footprint: h.footprint, door: h.door?.xy ? { xy: h.door.xy } : {}, height: h.height })),
    protectedAreas: [{ id: 'green', outline: protectedGreenOutline() }], districtAt: (x, z) => districtAt(x, z) }); await tick();
  const dressing = buildSands(ctx); await tick();
  const again = buildSands(ctx); await tick();
  const notes = buildSandsParts(ctx).notes; await tick();
  W = { ctx, json, dressing, again, notes };
}, 300_000);
const isTree = (p: PlantRecord) => PLANT_FORM[p.species as keyof typeof PLANT_FORM]?.tree ?? false;
/** A plant's drawn top: the fan palm's height comes from its trunk stretch (kit/plants/species.ts wwStretch: 19 × (0.92 + 0.34 t)). */
const plantTop = (p: PlantRecord) => p.at[1] + (p.species === 'fanPalm' ? 19 * (0.92 + 0.34 * ((p.tint ?? 0) % 1)) + 1 : PLANT_FORM[p.species as keyof typeof PLANT_FORM].height * p.scale);
/** Vertical clearance of a sight line over a point (x, z) with top y; +Infinity when the point is not under the segment. */
function lineClearance(eye: Point3, aim: Point3, x: number, z: number, y: number, radius: number): number {
  const dx = aim[0] - eye[0], dz = aim[2] - eye[2], L2 = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((x - eye[0]) * dx + (z - eye[2]) * dz) / L2));
  if (Math.hypot(eye[0] + dx * t - x, eye[2] + dz * t - z) > radius) return Infinity;
  return eye[1] + (aim[1] - eye[1]) * t - y;
}

describe('Long Sands (landing · Direction B): the module', () => {
  it('is registered in the landing neighbourhood and builds deterministically', () => {
    expect(NEIGHBOURHOOD_MODULES.map(m => m.id)).toContain('landing');
    const { dressing, again } = world();
    expect(JSON.stringify(again)).toBe(JSON.stringify(dressing));
    expect(dressing.id).toBe('landing');
    for (const r of [...dressing.buildings, ...dressing.props.filter(p => p.id)]) expect(r.id ?? '').toMatch(/^sands\./);
  }, 60_000);
  it('validates clean against the bake-time world (beds, pads, water, solids, hosts, the protected Green)', () => {
    const { ctx, dressing } = world();
    expect(validateDressing([{ module: 'landing', dressing }], ctx)).toEqual([]);
  }, 60_000);
  it('places the boardwalk: storefronts, towers, courts, palms, the wheel, the shack, the gate, the Boathouse re-dress', () => {
    const { dressing } = world(), kinds = (k: string) => dressing.buildings.filter(b => b.kind === k);
    expect(kinds('storefront').length).toBeGreaterThanOrEqual(8);
    expect(kinds('lifeguardTower').length).toBe(4);
    expect(kinds('ferrisWheel')).toHaveLength(1); expect(kinds('shack')).toHaveLength(1); expect(kinds('gate')).toHaveLength(1);
    expect(dressing.props.filter(p => p.kind === 'volleyNet' && p.fixture === 'volleyball')).toHaveLength(3);
    const palms = dressing.plants.filter(p => p.species === 'fanPalm');
    expect(palms.length).toBeGreaterThanOrEqual(40);
    expect(dressing.plants.filter(p => p.species === 'canaryPalm')).toHaveLength(4);
    // Storefronts: collidable facades with shallow porches, never hosts; no lettering anywhere (no string params but tokens).
    for (const s of kinds('storefront')) { expect(s.collide).toBe(true); expect(s.hostId).toBeUndefined(); expect(Object.values(s.params ?? {}).every(v => typeof v !== 'string')).toBe(true); }
    // The Boathouse: the host re-dress, no collider, the boat doors on its east gable (page L's face).
    const bh = dressing.buildings.find(b => b.hostId === 'boathouse')!;
    expect(bh.kind).toBe('boathouse'); expect(bh.collide).toBe(false); expect(bh.roof.form).toBe('gable'); expect(bh.params?.boatFace).toBe('right'); expect(bh.yaw).toBe(0);
  }, 60_000);
});

describe('Long Sands: the place\'s contracts', () => {
  it('stands every palm in Long Sands: district landing, west of the Quay Bridge, never in the Reach; Newfoundland bends them', () => {
    const { ctx, dressing } = world();
    for (const p of dressing.plants.filter(q => q.species === 'fanPalm' || q.species === 'canaryPalm')) {
      expect(ctx.districtAt(p.at[0], p.at[2]), `${p.at}`).toBe('landing');
      expect(p.at[0]).toBeLessThan(SANDS.quayBridgeX);
    }
    // The kit rule (D-R4, STYLE §2.5): Newfoundland draws a wind-bent pine for every fan and Canary palm.
    expect(NF_BENT_PALMS.has('fanPalm') && NF_BENT_PALMS.has('canaryPalm')).toBe(true);
  }, 60_000);
  it('keeps the glider\'s sands field clear (MANIFEST sky.landings.sands r 35, D-WW90): nothing over 1 eu within r + 10', () => {
    const { dressing } = world(), f = HORIZON_MANIFEST.sky.landings.sands as unknown as { xy: Point2; r: number };
    expect([f.xy, f.r]).toEqual([SANDS.glider.at, SANDS.glider.r]);
    const tall: [string, number, number][] = [
      ...dressing.buildings.map(b => [b.id, b.at[0], b.at[2]] as [string, number, number]),
      ...dressing.plants.filter(p => (PLANT_FORM[p.species as keyof typeof PLANT_FORM]?.height ?? 1) * p.scale > 1).map(p => [p.species, p.at[0], p.at[2]] as [string, number, number]),
      ...dressing.props.filter(p => PROP_HEIGHT[p.kind] * (p.scale ?? 1) > 1).map(p => [p.kind, p.at[0], p.at[2]] as [string, number, number]),
    ];
    for (const [id, x, z] of tall) expect(Math.hypot(x - f.xy[0], z - f.xy[1]), id).toBeGreaterThanOrEqual(f.r + SANDS.glider.keep);
  }, 60_000);
  it('keeps the wheel\'s sight lines clear of its own planting: belfry → wheel and the top of the wheel → elevator', () => {
    const { dressing } = world();
    const wheel = dressing.landmarks.find(l => l.id === 'wheel')!, belfry = storyEye('belfry'), top = dressing.lookouts.find(l => l.id === 'wheelTop')!;
    const lines: [string, Point3, Point3][] = [
      ['belfry → wheel', [belfry.at[0], belfry.y!, belfry.at[1]], [wheel.top[0], wheel.top[1] - 2, wheel.top[2]]],
      ['wheelTop → elevator', top.eye, aimPoint(storyLandmark('elevator'))],
    ];
    for (const [name, eye, aim] of lines) for (const p of dressing.plants.filter(isTree)) {
      const c = lineClearance(eye, aim, p.at[0], p.at[2], plantTop(p), PLANT_FORM[p.species as keyof typeof PLANT_FORM].canopy * p.scale + 1);
      expect(c, `${name}: ${p.species} at ${p.at}`).toBeGreaterThanOrEqual(0.5);
    }
    for (const [name, eye, aim] of lines) for (const b of dressing.buildings.filter(q => q.id !== 'sands.wheel')) {
      const c = lineClearance(eye, aim, b.at[0], b.at[2], b.at[1] + buildingHeight(b), Math.hypot(b.size.w, b.size.d) / 2);
      expect(c, `${name}: ${b.id}`).toBeGreaterThanOrEqual(0.5);
    }
  }, 60_000);
  it('keeps the ferry line clear: the wheel\'s sweep and every record ≥ 6 eu off FERRY (MANIFEST structures.longSandsPier.ferryMargin_min)', () => {
    const { dressing } = world(), pts = (HORIZON_MANIFEST.water_routes.FERRY.pts as number[][]).map(p => [p[0]!, p[1]!] as Point2);
    const dist = (x: number, z: number) => Math.min(...pts.slice(1).map((b, i) => { const a = pts[i]!, dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z); }));
    const [hx, , hz] = SANDS.wheel.hub, ax = Math.cos(SANDS.wheel.yaw), az = -Math.sin(SANDS.wheel.yaw); // the wheel's plane (its local x)
    for (const s of [-1, 1]) expect(dist(hx + s * ax * (SANDS.wheel.r + 1), hz + s * az * (SANDS.wheel.r + 1))).toBeGreaterThanOrEqual(6);
    for (const r of [...dressing.buildings, ...dressing.props].filter(r => !(r.id ?? '').startsWith('sands.wreck.'))) expect(dist(r.at[0], r.at[2]), (r as { id?: string }).id ?? '').toBeGreaterThanOrEqual(6);
  }, 60_000);
  it('keeps page D\'s foreground open (no tower, umbrella or court within 22 eu of the eye) and gives it its bench', () => {
    const { dressing } = world(), [ex, ez] = SANDS.pageD.eye;
    for (const r of [...dressing.buildings, ...dressing.props.filter(p => ['umbrella', 'towel', 'volleyNet', 'kite'].includes(p.kind))]) expect(Math.hypot(r.at[0] - ex, r.at[2] - ez), r.id ?? r.kind).toBeGreaterThanOrEqual(SANDS.pageD.clear);
    const bench = dressing.props.find(p => p.id === 'sands.bench.pageD')!;
    expect(Math.hypot(bench.at[0] - ex, bench.at[2] - ez)).toBeLessThan(35);
  }, 60_000);
  it('lands tree cover near the sheet\'s ~8 % of Long Sands (± 5 points)', () => {
    const { dressing } = world(), poly = (HORIZON_MANIFEST.landforms as unknown as { id: string; poly: Point2[] }[]).find(l => l.id === 'sands')!.poly;
    let area = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i]!, b = poly[(i + 1) % poly.length]!; area += a[0] * b[1] - b[0] * a[1]; } area = Math.abs(area) / 2;
    const canopy = dressing.plants.filter(isTree).filter(p => pointInPolygon(p.at[0], p.at[2], poly)).reduce((s, p) => s + Math.PI * (PLANT_FORM[p.species as keyof typeof PLANT_FORM].canopy * p.scale) ** 2, 0);
    const cover = canopy / area * 100;
    expect(cover).toBeGreaterThanOrEqual(3); expect(cover).toBeLessThanOrEqual(13);
  }, 60_000);
  it('keeps the corridor palm list (site.ts) the bake\'s own R10/R11 groves', () => {
    const { json } = world(), baked: Point2[] = [];
    for (const c of json.corridors) for (const g of c.planting ?? []) for (const it of g.items) if (it.species === 'palm' && it.at[0] > 760 && it.at[0] < 1320 && it.at[2] > 1340 && it.at[2] < 1560) baked.push([it.at[0], it.at[2]]);
    expect(baked.length).toBe(SANDS.corridorPalms.length);
    for (const p of baked) expect(Math.min(...SANDS.corridorPalms.map(q => Math.hypot(q[0] - p[0], q[1] - p[1])))).toBeLessThan(0.2);
  }, 60_000);
  it('lights in the night order (one run, emissive cards only) and keeps life within 24 (the first 10 for lite)', () => {
    const { dressing } = world(), ls = dressing.lights;
    expect(new Set(ls.map(l => l.line))).toEqual(new Set(['landing:sands']));
    expect(ls.map(l => l.order)).toEqual(ls.map((_, i) => i));
    const rank = ls.map(l => NIGHT_ORDER.findIndex(re => re.test(l.id)));
    expect(rank.every(r => r >= 0)).toBe(true); expect(rank).toEqual([...rank].sort((a, b) => a - b));
    expect(ls[0]!.id).toBe('landing.sands.boathouse.lantern'); expect(ls.at(-1)!.id).toBe('landing.sands.wheel');
    for (const l of ls) expect(l.kind.startsWith('dressing:') || !/^(roadLantern|bridgeLantern|tunnelLamp|bollard)$/.test(l.kind)).toBe(true);
    const total = dressing.life.reduce((s, l) => s + l.count, 0);
    expect(total).toBeLessThanOrEqual(24);
  }, 60_000);
  it('emits the wheel and the top of the wheel as the story registry has them', () => {
    const { dressing } = world();
    expect(validateStoryAgainstDressing({ dressing })).toEqual({ skipped: false, checked: 2, problems: [] });
    const wheel = dressing.buildings.find(b => b.landmarkId === 'wheel')!, lm = dressing.landmarks[0]!;
    expect(wheel.at[1] + (wheel.params!.hubH as number) + (wheel.params!.radius as number)).toBeCloseTo(lm.top[1], 6);
    expect(lm.relayOrder).toBe(storyLandmark('wheel').relayOrder);
    // From the top of the wheel: the Flats' grain elevator (the next landmark) and the Lamp (every binocular's target).
    const top = dressing.lookouts.find(l => l.id === 'wheelTop')!;
    expect(top.targets).toEqual(expect.arrayContaining(['elevator', 'lamp']));
    expect([top.eye[0], top.eye[2]]).toEqual([SANDS.wheel.hub[0], SANDS.wheel.hub[2]]);
  }, 60_000);
  it('draws the wheel\'s far shape as its rim on the A-frame (the belfry sees a wheel, not a pyramid)', () => {
    const { json } = world(), far = buildFarLandmarks(json.dressing, 'classic', (x, z) => districtAt(x, z));
    const mesh = far.silhouettes.find(f => f.district === 'landing')!.mesh, pos = mesh.geometry.getAttribute('position');
    const [hx, hy, hz] = SANDS.wheel.hub, R = SANDS.wheel.r;
    let top = -Infinity, rimAtHub = 0;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); if (Math.hypot(x - hx, z - hz) > R + 1) continue;
      top = Math.max(top, y); if (Math.abs(y - hy) < 0.05 && Math.abs(Math.hypot(x - hx, z - hz) - R) < 0.05) rimAtHub++;
    }
    expect(top).toBeCloseTo(hy + R, 3); expect(rimAtHub).toBeGreaterThan(0);
    far.material.dispose(); for (const f of far.silhouettes) f.mesh.geometry.dispose();
  }, 60_000);
  it('reports its counts (handoff)', () => {
    const n = world().notes;
    console.log(JSON.stringify(n));
    expect(n.storefronts).toBeGreaterThan(0);
  }, 60_000);
});

describe('Long Sands on the bake (after pnpm horizon:bake)', () => {
  it('carries the dressing in the landing district within the per-district budget (land + dressing ≤ 150k / 60k)', () => {
    const { json } = world();
    for (const id of ['landing', 'reach']) {
      const d = json.districts.find((q: { id: string }) => q.id === id);
      expect(d.dressing, id).toBeTruthy();
      expect(d.triangles.full, id).toBeLessThanOrEqual(150_000); expect(d.triangles.lite, id).toBeLessThanOrEqual(60_000);
    }
    expect(json.dressing.landmarks.map((l: { id: string }) => l.id)).toContain('wheel');
    expect(json.dressing.redressedHosts).toContain('boathouse');
  });
});
