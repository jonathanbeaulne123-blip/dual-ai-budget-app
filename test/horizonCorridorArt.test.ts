import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CardBuilder } from '../src/harbour/art/cardScene';
import { finishBuild } from '../src/house/world/buildTask';
import { roadFixture, FIXTURE } from '../src/harbour/horizon/kit/road/fixture';
import { roadKitPalette, type RoadTheme } from '../src/harbour/horizon/kit/road/palette';
import { corridorIndex, corridorSampler } from '../src/harbour/horizon/kit/road/frames';
import { addCorridorSolidSteps, pavementBands, isCorridorSolid } from '../src/harbour/horizon/kit/road/pavement';
import { markingQuads } from '../src/harbour/horizon/kit/road/markings';
import { buildGuardRun, railPosts, GUARD_KIT } from '../src/harbour/horizon/kit/road/guards';
import { drawLamp, lampPlacement, LAMP_HEAD } from '../src/harbour/horizon/kit/road/lamps';
import { buildScenicStop, stopLayout } from '../src/harbour/horizon/kit/road/stops';
import { addCorridorOrSolidSteps, addSolidSteps } from '../src/harbour/horizon/runtime/cards';
import { createCorridorArt } from '../src/harbour/horizon/runtime/corridorArt';

const THEMES: RoadTheme[] = ['classic', 'taylor', 'newfoundland'];
type Cells = Map<string, { data: Record<string, { positions: number[] }> }>;
const cellsOf = (b: CardBuilder) => (b as unknown as { cells: Cells }).cells;
/** Every vertex a builder holds (all buckets, lines included). */
function vertices(b: CardBuilder, buckets?: string[]): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (const cell of cellsOf(b).values()) for (const [key, bucket] of Object.entries(cell.data)) {
    if (buckets && !buckets.includes(key)) continue; const p = (bucket as { positions?: number[] }).positions; if (!p) continue;
    for (let i = 0; i < p.length; i += 3) out.push([p[i]!, p[i + 1]!, p[i + 2]!]);
  }
  return out;
}
const triangles = (b: CardBuilder) => { let n = 0; for (const cell of cellsOf(b).values()) for (const [k, bucket] of Object.entries(cell.data)) if (!['ink', 'shade'].includes(k)) n += ((bucket as { positions?: number[] }).positions?.length ?? 0) / 9; return n; };
const finiteAndBounded = (v: [number, number, number][], box: { min: number[]; max: number[] }) => {
  for (const p of v) { expect(p.every(Number.isFinite)).toBe(true); for (let k = 0; k < 3; k++) { expect(p[k]!).toBeGreaterThanOrEqual(box.min[k]!); expect(p[k]!).toBeLessThanOrEqual(box.max[k]!); } }
};
/** Plan distance from a point to a polyline. */
function distToLine(p: readonly number[], line: readonly (readonly number[])[]) {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) { const a = line[i - 1]!, b = line[i]!, dx = b[0]! - a[0]!, dz = b[2]! - a[2]!, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((p[0]! - a[0]!) * dx + (p[2]! - a[2]!) * dz) / l2)); best = Math.min(best, Math.hypot(p[0]! - a[0]! - dx * t, p[2]! - a[2]! - dz * t)); }
  return best;
}

describe('Horizon road kit (ROAD.md §4)', () => {
  const fx = roadFixture(), sampler = corridorSampler(fx.corridor);
  const box = { min: [-40, -4, -80], max: [180, 30, 80] };

  it('the corridor frame follows the stations (right = (-t.z, t.x)) and round-trips (s, o)', () => {
    const index = corridorIndex([fx.corridor]);
    for (const [s, o] of [[10, 3], [50, -4.5], [110, 2.2], [131, -1]] as const) {
      const p = sampler.point(s, o), hit = index.locate(p[0], p[2])!;
      expect(hit.s).toBeCloseTo(s, 1); expect(hit.o).toBeCloseTo(o, 1);
    }
  });

  it('pavement bands are ordered, inside the paved width, and lite subtracts the wheel lanes', () => {
    for (const st of [fx.corridor.stations[3]!, fx.corridor.stations[30]!, fx.corridor.stations[60]!]) {
      const full = pavementBands(st, 'full'), lite = pavementBands(st, 'lite');
      expect(full.bands.length).toBe(full.cuts.length + 1);
      for (let i = 1; i < full.cuts.length; i++) expect(full.cuts[i]!).toBeGreaterThan(full.cuts[i - 1]!);
      expect(full.cuts[0]!).toBeGreaterThan(-st.left.paved); expect(full.cuts.at(-1)!).toBeLessThan(st.right.paved);
      expect(full.bands).toContain('wheel'); expect(full.bands).toContain('crown'); expect(lite.bands).not.toContain('wheel'); expect(lite.cuts.length).toBeLessThan(full.cuts.length);
      expect(full.bands[0]).toBe(st.left.edge === 'sidewalk' ? 'gutter' : 'edge');
    }
  });

  it('corridor solids paint on their own triangles (finite, bounded, the deck on the collision surface) and guards are never drawn', () => {
    const index = corridorIndex(fx.world.corridors!);
    for (const tier of ['full', 'lite'] as const) {
      const b = new CardBuilder('t', tier, { ink: '#5b5447' });
      for (const solid of fx.solids) { expect(isCorridorSolid(solid)).toBe(true); finishBuild(addCorridorSolidSteps(b, solid, tier, index)); }
      const v = vertices(b); expect(v.length).toBeGreaterThan(1000); finiteAndBounded(v, box);
      // Every deck-top vertex lies on the deck (height = the station line's height at its s).
      const deckOnly = new CardBuilder('d', tier, { ink: '#5b5447' });
      finishBuild(addCorridorSolidSteps(deckOnly, fx.solids.find(s => s.id === 'fixture.V.deck')!, tier, index));
      for (const p of vertices(deckOnly, ['card'])) if (p[1] > 7.9) { const hit = index.locate(p[0], p[2])!; const y = sampler.at(hit.s).y; expect(Math.abs(p[1] - y) < .02 || p[1] < y - .05).toBe(true); }
      // A guard collider draws nothing.
      const g = new CardBuilder('g', tier, { ink: '#5b5447' });
      for (const solid of fx.solids.filter(s => s.kind === 'corridorGuard')) finishBuild(addCorridorOrSolidSteps(g, solid, tier, fx.world.corridors));
      expect(vertices(g).length).toBe(0);
    }
  });

  it('without corridors, corridor solids keep a plain colour and a guard is still not drawn', () => {
    const b = new CardBuilder('f', 'full', { ink: '#5b5447' }), plain = new CardBuilder('p', 'full', { ink: '#5b5447' });
    for (const solid of fx.solids) finishBuild(addCorridorOrSolidSteps(b, solid, 'full', undefined));
    for (const solid of fx.solids.filter(s => s.kind !== 'corridorGuard')) finishBuild(addSolidSteps(plain, solid, 'full'));
    expect(fx.solids.some(s => s.kind === 'corridorGuard')).toBe(true);
    expect(vertices(b, ['card']).length).toBe(vertices(plain, ['card']).length); expect(vertices(b).length).toBeGreaterThan(0);
  });

  it('markings lie flat on the paved half of their station and follow the stations', () => {
    for (const c of fx.world.corridors!) {
      const f = corridorSampler(c), index = corridorIndex([c]);
      for (const run of c.markings) {
        const quads = markingQuads(run, f); expect(quads.length).toBeGreaterThan(0);
        for (const q of quads) for (const p of q) {
          expect(p.every(Number.isFinite)).toBe(true);
          const hit = index.locate(p[0], p[2])!, st = f.station(hit.s), paved = hit.o >= 0 ? st.right.paved : st.left.paved;
          expect(Math.abs(hit.o)).toBeLessThanOrEqual(paved + 1e-3);
          expect(p[1] - f.at(hit.s).y).toBeGreaterThan(0); expect(p[1] - f.at(hit.s).y).toBeLessThan(.05);
        }
      }
    }
    // A centre dash is 3 on / 6 off: n dashes over its length.
    const dash = fx.corridor.markings.find(m => m.kind === 'centreDash')!, quads = markingQuads(dash, sampler);
    const dashes = Math.ceil((dash.to - dash.from) / 9); expect(quads.length).toBeGreaterThanOrEqual(dashes * 2); expect(quads.length).toBeLessThanOrEqual(dashes * 3);
  });

  it('guard art stays within the GuardRun line ± its kit half-width (collider line + thickness), in every dressing', () => {
    for (const theme of THEMES) for (const tier of ['full', 'lite'] as const) {
      const pal = roadKitPalette(theme);
      for (const run of fx.corridor.guards) {
        const b = new CardBuilder('g', tier, { ink: pal.ink }), out = buildGuardRun(b, pal, run, { tier, ground: fx.ground });
        const half = GUARD_KIT[run.kind as 'stoneParapet' | 'postRail'].half;
        const v = vertices(b, ['card', 'steel', 'ink', 'flat']); expect(v.length).toBeGreaterThan(0); finiteAndBounded(v, box);
        for (const p of v) expect(distToLine(p, run.line)).toBeLessThanOrEqual(half + 1e-3);
        // Posts (instanced) stand on the line, never beyond it.
        for (const post of out.posts) { expect(distToLine(post.at, run.line)).toBeLessThan(1e-3); expect(post.height).toBeGreaterThan(.2); expect(post.height).toBeLessThanOrEqual(run.height + .1); }
        if (run.kind === 'postRail') { const every = tier === 'full' ? GUARD_KIT.postRail.postEvery : GUARD_KIT.postRail.postEveryLite, L = run.to - run.from; expect(out.posts.length).toBeGreaterThanOrEqual(Math.floor(L / every * .8)); expect(railPosts(run, tier).length).toBeLessThanOrEqual(out.posts.length); }
        // Visible height never above the kit's height (a rail below the rider's eye keeps the view: ROAD.md §3 R4).
        const top = Math.max(...v.map(p => p[1] - (run.line[0]![1]))); expect(top).toBeLessThan(run.kind === 'postRail' ? 1.2 + (run.line.at(-1)![1] - run.line[0]![1]) : 1.4 + (run.line.at(-1)![1] - run.line[0]![1]));
      }
    }
  });

  it('three dressings build every lamp kind, differently (materials, not tint), with the head where LAMP_HEAD says', () => {
    const sig: Record<string, number[]> = {};
    for (const theme of THEMES) {
      const pal = roadKitPalette(theme);
      for (const kind of ['roadLantern', 'bridgeLantern', 'tunnelLamp', 'bollard'] as const) {
        const b = new CardBuilder('l', 'full', { ink: pal.ink }); drawLamp(b, pal, kind, [0, 0, 0], 'full');
        const v = vertices(b); expect(v.length).toBeGreaterThan(20); finiteAndBounded(v, { min: [-1, -1, -1], max: [2, 6, 1] });
        const glow = vertices(b, ['glow']); expect(glow.length).toBeGreaterThan(0);
        const head = LAMP_HEAD[kind][theme], c = glow.reduce((a, p) => [a[0] + p[0] / glow.length, a[1] + p[1] / glow.length, a[2] + p[2] / glow.length], [0, 0, 0]);
        expect(Math.hypot(c[0] - head[0], c[1] - head[1], c[2] - head[2])).toBeLessThan(.25);
        (sig[kind] ??= []).push(triangles(b));
      }
    }
    // Dressings re-materialise (different construction), so triangle counts differ between at least two dressings.
    for (const kind of ['roadLantern', 'bridgeLantern', 'bollard']) expect(new Set(sig[kind]).size).toBeGreaterThan(1);
    // The road lantern: 5.2 eu post and an arm that reaches over the kerb.
    const road = LAMP_HEAD.roadLantern.classic; expect(road[0]).toBeGreaterThan(1); expect(road[1]).toBeGreaterThan(4);
    const place = lampPlacement(fx.corridor.lamps[0]!, 'classic'); expect(Math.hypot(place.head[0] - fx.corridor.lamps[0]!.head[0], place.head[1] - fx.corridor.lamps[0]!.head[1], place.head[2] - fx.corridor.lamps[0]!.head[2])).toBeLessThan(.05);
  });

  it('a scenic stop walls its view side only and seats its bench facing the view', () => {
    const stop = fx.corridor.stops[0]!, lay = stopLayout(stop, fx.ground);
    expect(lay.wall.length).toBeGreaterThan(0); expect(lay.bench).not.toBeNull(); expect(lay.lamp).not.toBeNull();
    const vx = Math.sin(stop.facing), vz = Math.cos(stop.facing), c = stop.outline.reduce((a, p) => [a[0] + p[0] / stop.outline.length, a[1] + p[1] / stop.outline.length], [0, 0]);
    for (const [a, b] of lay.wall) expect(((a[0] + b[0]) / 2 - c[0]!) * vx + ((a[2] + b[2]) / 2 - c[1]!) * vz).toBeGreaterThan(0);
    for (const theme of THEMES) { const pal = roadKitPalette(theme), b = new CardBuilder('s', 'full', { ink: pal.ink }); buildScenicStop(b, pal, stop, { tier: 'full', ground: fx.ground }); finiteAndBounded(vertices(b), box); }
  });

  it('the fixture stays within ROAD.md §8 (≤ 25k triangles full / 10k lite, ≤ 12 draw calls per district) in every dressing', () => {
    const report: Record<string, unknown> = {};
    for (const theme of THEMES) for (const tier of ['full', 'lite'] as const) {
      const art = createCorridorArt(fx.world, { tier, theme, districtOf: () => FIXTURE.district, ground: fx.ground });
      art.prebuild([FIXTURE.district]);
      const s = art.stats().districts[FIXTURE.district]!;
      // Plus the corridor solids' own paint (cards.ts), one card cell of the district's builder.
      const b = new CardBuilder('c', tier, { ink: '#5b5447', cell: 256 }), index = corridorIndex(fx.world.corridors!);
      for (const solid of fx.solids) finishBuild(addCorridorSolidSteps(b, solid, tier, index));
      const paint = triangles(b);
      report[`${theme}/${tier}`] = { art: s, solidsPaint: Math.round(paint), lamps: art.stats().lamps };
      expect(s.drawCalls).toBeLessThanOrEqual(12);
      expect(s.triangles + paint).toBeLessThanOrEqual(tier === 'full' ? 25_000 : 10_000);
      expect(art.lampHeads().length).toBe(fx.corridor.lamps.length + 1);
      for (const h of art.lampHeads()) expect(h.head.every(Number.isFinite)).toBe(true);
      art.setNight(1); expect(art.night.value).toBe(1); art.setNight(0);
      const cam = new THREE.PerspectiveCamera(); cam.position.set(60, 10, 0); art.update(cam, new Set([FIXTURE.district]));
      art.dispose();
    }
    console.info('[road kit fixture budget]', JSON.stringify(report));
  });

  it('shows only resident districts, builds cooperatively, and thins detail with hysteresis (nothing changes within 280 eu)', () => {
    const halves = (x: number) => (x < 60 ? 'fxA' : 'fxB');
    const art = createCorridorArt(fx.world, { tier: 'full', theme: 'classic', districtOf: (x) => halves(x), ground: fx.ground });
    const cam = new THREE.PerspectiveCamera(), near = new Set(['fxA']);
    cam.position.set(20, 12, 0);
    for (let i = 0; i < 400 && !art.stats().districts.fxA; i++) art.update(cam, near);
    expect(art.stats().districts.fxA).toBeDefined(); expect(art.stats().districts.fxB).toBeUndefined();
    const groupOf = (id: string) => art.group.children.find(o => o.name === `horizon.corridorArt.${id}`)!;
    expect(groupOf('fxA').visible).toBe(true);
    const detail = () => groupOf('fxA').children.filter(o => / (flat|shade)$/.test(o.name));
    expect(detail().length).toBeGreaterThan(0);
    // Distances are to the district's bounds: stand straight above them at a given height over the box top.
    const box = new THREE.Box3().setFromObject(groupOf('fxA')), c = box.getCenter(new THREE.Vector3()), at = (d: number) => { cam.position.set(c.x, box.max.y + d, c.z); art.update(cam, near); };
    at(300); expect(detail().every(o => o.visible)).toBe(true);    // inside the hide threshold (320)
    at(400); expect(detail().every(o => !o.visible)).toBe(true);
    at(300); expect(detail().every(o => !o.visible)).toBe(true);   // hysteresis: hidden until inside 280
    at(200); expect(detail().every(o => o.visible)).toBe(true);
    // Lamps, rails and walls never hide by distance.
    at(2000); expect(groupOf('fxA').children.filter(o => !/ (flat|shade)$/.test(o.name)).every(o => o.visible)).toBe(true);
    // Leaving residency hides the district at once.
    art.update(cam, new Set()); expect(groupOf('fxA').visible).toBe(false);
    art.dispose();
  });
});
