/**
 * Track P — the corridor plan (ROAD.md §3–§6) on the real island. Stations come from a TEST-ONLY adapter over the
 * committed bake (`test/helpers/corridorStations.ts`) until the stations track lands; the rules checked here are the
 * plan's own (markings follow stations, lamp pools overlap, planting in its bands and out of gaps / sight / water,
 * palms only on R10/R11, the Green ≤ 0.85, stops flat and flush) and determinism.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { env as processEnv } from 'node:process';
import { beforeAll, describe, expect, it } from 'vitest';
import { planCorridor, type CorridorPlan, type PlanEnv, type PlanInput } from '../src/harbour/horizon/land/corridor/plan.ts';
import { CORRIDOR, type CorridorStation, type PlantSpecies } from '../src/harbour/horizon/land/corridor/types.ts';
import { Analysis, LAMP_SIGHT_KINDS, reachNumber } from '../src/harbour/horizon/land/corridor/plan/context.ts';
import { LAMP } from '../src/harbour/horizon/land/corridor/plan/lamps.ts';
import { MARK } from '../src/harbour/horizon/land/corridor/plan/markings.ts';
import { canopyOf, heightOf, PLANT_FORM } from '../src/harbour/horizon/land/corridor/plan/species.ts';
import { planeFit, STOP } from '../src/harbour/horizon/land/corridor/plan/stops.ts';
import { contains } from '../src/harbour/horizon/land/terrain/geometry.ts';
import { adaptRoad, loadIsland } from './helpers/corridorStations.ts';
import { renderPlanMap } from './helpers/corridorPlanMap.ts';

type Road = 'V01' | 'VG' | 'V03';
const ROADS: Road[] = ['V01', 'VG', 'V03'];
const runs: Record<Road, { input: PlanInput; env: PlanEnv; plan: CorridorPlan; A: Analysis; ms: number }> = {} as never;

beforeAll(() => {
  loadIsland();
  for (const id of ROADS) {
    const { input, env } = adaptRoad(id, { median: id === 'V01' });
    const t0 = performance.now(), plan = planCorridor(input, env), ms = performance.now() - t0;
    runs[id] = { input, env, plan, A: new Analysis(input.id, input.closed, input.stations, input.reaches), ms };
  }
}, 180000);

const styleOf = (id: Road, st: CorridorStation) => runs[id].A.style(st);
/** (s, signed offset, distance) of a world point relative to a road. */
const where = (id: Road, x: number, z: number) => { const { A } = runs[id], F = A.frame; let best = { s: 0, o: 0, d: Infinity }; for (let k = 0; k < F.n; k += 12) { const p = F.project(x, z, k, 12); if (p.d < best.d) best = p; } return best; };
const stationAt = (id: Road, s: number) => { const F = runs[id].A.frame; return F.st(F.nearestIndex(s)); };

describe('the corridor plan (Track P) on adapter stations from the committed bake', () => {
  it('is deterministic: same stations, reaches and seed → the same plan; another seed moves planting only', () => {
    for (const id of ROADS) {
      const { input, env, plan } = runs[id];
      expect(JSON.stringify(planCorridor(input, env))).toBe(JSON.stringify(plan));
      const other = planCorridor(input, { ...env, seed: 'another' });
      expect(JSON.stringify(other.markings)).toBe(JSON.stringify(plan.markings));
      expect(JSON.stringify(other.lamps)).toBe(JSON.stringify(plan.lamps));
    }
    // A stub-free plan on the empty input.
    expect(planCorridor({ id: 'X', closed: false, step: 2, stations: [], reaches: [] }, { ground: () => 0, seed: 's' })).toMatchObject({ markings: [], lamps: [], planting: [], stops: [] });
  });

  it('markings follow the stations: offsets inside the paved half, dashes 3/6 0.12 wide, no centre line in junction boxes', () => {
    for (const id of ROADS) {
      const { plan, A } = runs[id];
      expect(plan.markings.filter(m => m.kind === 'centreDash').length).toBeGreaterThan(0);
      for (const m of plan.markings) {
        expect(m.to).toBeGreaterThan(m.from);
        for (let s = m.from; s <= m.to; s += 2) {
          const st = stationAt(id, s), paved = m.offset >= 0 ? st.right.paved : st.left.paved;
          expect(Math.abs(m.offset) + m.width / 2).toBeLessThanOrEqual(paved + 1e-6);
          if (m.span) { expect(m.span[0]).toBeGreaterThanOrEqual(-st.left.paved - 1e-6); expect(m.span[1]).toBeLessThanOrEqual(st.right.paved + 1e-6); }
          if (m.kind === 'centreDash' || m.kind === 'centreSolid') { expect(A.inBox(s)).toBe(false); expect(st.median).toBeUndefined(); }
          if (m.kind === 'edgeLine') expect((m.offset >= 0 ? st.right : st.left).edge).toBe('shoulder');
        }
        if (m.kind === 'centreDash') { expect(m.dash).toEqual([3, 6]); expect(m.width).toBe(0.12); }
      }
      // Zebras only in developed / boulevard reaches; give-way only at this road's own mouth.
      for (const z of plan.markings.filter(m => m.kind === 'zebra')) {
        const st = stationAt(id, (z.from + z.to) / 2), ctx = st.context === 'structure' ? A.reachOf(st)?.context : st.context;
        expect(['developed', 'boulevard']).toContain(ctx);
        expect(A.nearMouth((z.from + z.to) / 2, null, 2, ['crossing'])).not.toBeNull();
      }
    }
    expect(runs.V01.plan.markings.some(m => m.kind === 'giveWay')).toBe(false);
    expect(runs.VG.plan.markings.filter(m => m.kind === 'giveWay').length).toBe(2);
  });

  it('solid centre where the forward sight distance is under 60 eu, dashed where it is long', () => {
    const { plan } = runs.V01;
    const solid = plan.markings.filter(m => m.kind === 'centreSolid'), dash = plan.markings.filter(m => m.kind === 'centreDash');
    const len = (l: typeof solid) => l.reduce((a, m) => a + m.to - m.from, 0);
    // Horizon Drive is mostly open: most of its length is dashed, blind bends and the median noses solid.
    expect(len(dash)).toBeGreaterThan(len(solid));
    expect(len(solid)).toBeGreaterThan(0);
    for (const m of solid) expect(m.to - m.from).toBeGreaterThanOrEqual(MARK.minSolid - 2);
  });

  it('lamps stand behind the kerb, never in the carriageway, a gap or a sight triangle; heads over the carriageway edge', () => {
    for (const id of ROADS) {
      const { plan, A } = runs[id];
      for (const l of plan.lamps) {
        const w = where(id, l.at[0], l.at[2]), st = stationAt(id, w.s), sd0 = w.o >= 0 ? st.right : st.left;
        // The widest paved edge within a station either way (a lamp at a widening measures against the wider side).
        const near = [stationAt(id, w.s - 2), st, stationAt(id, w.s + 2)].map(q => (w.o >= 0 ? q.right : q.left));
        const sd = { ...sd0, paved: Math.max(...near.map(q => q.paved)) };
        if (st.median && Math.abs(w.o) < st.median.half) { expect(l.kind).toBe('roadLantern'); continue; }
        expect(Math.abs(w.o), l.id).toBeGreaterThan(sd.paved - (l.kind === 'tunnelLamp' ? 0 : 1e-6));
        expect(l.poolRadius).toBe(CORRIDOR.lampPoolRadius);
        expect(l.head[1] - l.at[1]).toBeGreaterThan(3);
        // The head reaches over the carriageway edge (the median lantern stands over its median).
        const h = where(id, l.head[0], l.head[2]);
        expect(Math.abs(h.o), l.id).toBeLessThan(sd.paved + 0.5);
        if (l.kind === 'roadLantern') {
          expect(A.nearMouth(w.s, w.o >= 0 ? 'right' : 'left', LAMP.gapClear - 0.3)).toBeNull();
          expect(A.inSight(w.s, w.o, 0.1, LAMP_SIGHT_KINDS)).toBe(false);
          // Behind the kerb at the setback, or on the guard line where the ground falls away (a rail-mounted post).
          const off = Math.abs(w.o) - Math.min(...near.map(q => q.paved));
          expect(Math.min(Math.abs(off - CORRIDOR.lampSetback), Math.abs(off - CORRIDOR.guardSetback)), l.id).toBeLessThan(1.6);
        }
      }
    }
  });

  it('lamp pools overlap inside lit reaches: no dark gap longer than 6 eu along either lane', () => {
    for (const id of ROADS) {
      const { plan, A } = runs[id], F = A.frame;
      const inLit = (s: number) => (plan.litRuns ?? []).some(r => { const d = F.delta(r.from, s), len = (r.to - r.from + F.length) % F.length || F.length; return d >= -0.5 && d <= len + 0.5; });
      const lamps = plan.lamps.map(l => ({ l, s: where(id, l.pool[0], l.pool[2]).s })).sort((a, b) => a.s - b.s);
      let worst = 0, checked = 0, where0 = '';
      for (let k = 0; k < lamps.length; k++) {
        const a = lamps[k]!, b = lamps[(k + 1) % lamps.length]!, gap = F.delta(a.s, b.s);
        if (!F.closed && k === lamps.length - 1) break;
        // Both lamps and the whole stretch between them inside one lit run (the tails beyond a run are meant to thin out).
        if (gap <= 0 || !inLit(a.s) || !inLit(b.s) || !inLit(a.s + gap / 2)) continue;
        const st = stationAt(id, a.s + gap / 2), lane = st.median ? st.median.half + (st.half - st.median.half) / 2 : st.half / 2;
        const near = lamps.filter(q => Math.abs(F.delta(a.s, q.s)) < 40).map(q => q.l);
        for (const o of [-lane, lane]) {
          let dark = 0;
          for (let d = 0; d <= gap; d += 0.25) {
            const p = F.point(a.s + d, o), lit = near.some(l => Math.hypot(p[0] - l.pool[0], p[2] - l.pool[2]) <= l.poolRadius);
            dark = lit ? 0 : dark + 0.25; if (dark > worst) { worst = dark; where0 = `${a.l.id}→${b.l.id}`; }
          }
        }
        checked++;
      }
      expect(checked).toBeGreaterThan(id === 'V01' ? 60 : 5);
      expect(worst, where0).toBeLessThanOrEqual(6);
    }
  });

  it('bridge lanterns stand on the kerb rail on the footway side of a deck (never the open edge); tunnels carry tunnel lamps', () => {
    const { plan } = runs.V01;
    const bridge = plan.lamps.filter(l => l.kind === 'bridgeLantern'), tunnel = plan.lamps.filter(l => l.kind === 'tunnelLamp');
    expect(bridge.length).toBeGreaterThan(6);
    expect(tunnel.length).toBeGreaterThan(4);
    const bySid = new Map<string, typeof bridge>();
    for (const l of bridge) {
      const w = where('V01', l.at[0], l.at[2]), st = stationAt('V01', w.s), sd = w.o >= 0 ? st.right : st.left;
      expect(st.structureId, l.id).toBeTruthy();
      expect(Math.abs(Math.abs(w.o) - sd.paved - CORRIDOR.guardSetback), l.id).toBeLessThan(0.1);
      const list = bySid.get(st.structureId!) ?? []; list.push(l); bySid.set(st.structureId!, list);
    }
    // The Bight Bridge carries the Year Walk footway on one side: every lantern is on that side's rail.
    const bight = bySid.get('bightBridge') ?? [];
    expect(bight.length).toBeGreaterThan(6);
    const sides = new Set(bight.map(l => l.side));
    expect(sides.size).toBe(1);
    const fwSide = [...sides][0]!;
    for (const l of bight) { const st = stationAt('V01', where('V01', l.at[0], l.at[2]).s); expect(st[fwSide].footway || st.left.footway || st.right.footway).toBeTruthy(); }
    expect(runs.V03.plan.lamps.some(l => l.kind === 'tunnelLamp')).toBe(true);
  });

  it('planting: in its band, clear of the carriageway, gaps, sight triangles, water and occupied ground', () => {
    const I = loadIsland();
    for (const id of ROADS) {
      const { plan, A } = runs[id];
      for (const g of plan.planting) {
        expect(g.items.length).toBeGreaterThanOrEqual(3);
        for (const it of g.items) {
          const w = where(id, it.at[0], it.at[2]), st = stationAt(id, w.s), canopy = canopyOf(it.species, it.scale), height = heightOf(it.species, it.scale);
          if (g.side === 'median') { expect(st.median).toBeTruthy(); expect(Math.abs(w.o) + canopy).toBeLessThanOrEqual(st.median!.half); }
          else {
            const sd = w.o >= 0 ? st.right : st.left;
            // No canopy over the carriageway (+ setback).
            expect(Math.abs(w.o) - canopy).toBeGreaterThanOrEqual(sd.paved + CORRIDOR.plantingSetback - 0.05);
            // Not in a gap on its side.
            expect(A.nearMouth(w.s, w.o >= 0 ? 'right' : 'left', canopy)).toBeNull();
          }
          if (height > CORRIDOR.sightlineMaxHeight) expect(A.inSight(w.s, g.side === 'median' ? 0 : w.o, canopy * 0.9)).toBe(false);
          expect(I.water(it.at[0], it.at[2])).toBe(false);
          if (g.side !== 'median') { expect(I.occupied(it.at[0], it.at[2])).toBe(false); expect(Math.abs(it.at[1] - I.ground(it.at[0], it.at[2]))).toBeLessThan(0.01); }
          if (PLANT_FORM[it.species].tree && st.context === 'mountain') expect(Math.abs(w.o) - (w.o >= 0 ? st.right : st.left).paved).toBeGreaterThanOrEqual(6 - 0.05);
        }
      }
    }
  });

  it('palms only on R10 / R11; the Green\'s protected centre holds nothing over 0.85', () => {
    for (const id of ROADS) for (const g of runs[id].plan.planting) for (const it of g.items) {
      if (it.species === 'palm') { expect(id).toBe('V01'); expect(['R10', 'R11']).toContain(styleOf(id, stationAt(id, where(id, it.at[0], it.at[2]).s))); }
      if (Math.hypot(it.at[0] - 1040, it.at[2] - 1065) < 160 + canopyOf(it.species, it.scale)) expect(heightOf(it.species, it.scale)).toBeLessThanOrEqual(0.85);
    }
    const vgLow = runs.VG.plan.planting.flatMap(g => g.items).filter(it => Math.hypot(it.at[0] - 1040, it.at[2] - 1065) < 160);
    expect(vgLow.length).toBeGreaterThan(0);
  });

  it('scenic stops: 1–3, each flat (≤ 8 %) and flush beside the road on the view side; the Crown placed or proposed with its grading', () => {
    const { plan, A } = runs.V01, I = loadIsland();
    expect(plan.stops.length).toBeGreaterThanOrEqual(1);
    expect(plan.stops.length).toBeLessThanOrEqual(3);
    // The Crown Lookout (R4) is placed where the ground holds it; otherwise the plan says why and proposes the pad.
    const crown = plan.stops.find(s => s.id.endsWith('crownLookout'));
    if (!crown) {
      expect(plan.notes?.some(n => n.startsWith('Crown Lookout (R4) skipped'))).toBe(true);
      const p = plan.stopProposals?.find(x => x.slug === 'crownLookout');
      expect(p, plan.notes?.join('\n')).toBeTruthy();
      expect(reachNumber(A.reachOf(stationAt('V01', p!.s)))).toBe(4);
      expect(p!.entrance).toBeLessThanOrEqual(0.7);
    }
    for (const stop of plan.stops) {
      const e = plan.stopEntrances!.find(x => x.stopId === stop.id)!;
      const mid = A.frame.delta(e.from, e.to) / 2 + e.from, st = stationAt('V01', mid);
      if (stop === crown) expect(reachNumber(A.reachOf(st))).toBe(4);
      // Flat: fit a plane through the outline's ground (every point of the 10-point outline).
      const g = stop.outline.map(p => [p[0], p[1], I.ground(p[0], p[1])] as const);
      expect(planeFit(g).slope).toBeLessThanOrEqual(STOP.maxSlope + 1e-9);
      expect(planeFit(g).residual).toBeLessThanOrEqual(STOP.rough + 1e-9);
      // Flush: the entrance edge's ground within STOP.flush of the road there.
      for (const p of stop.outline.slice(0, 5)) { const w = where('V01', p[0], p[1]); expect(Math.abs(I.ground(p[0], p[1]) - A.frame.frameAt(w.s).at[1])).toBeLessThanOrEqual(STOP.flush + 0.02); }
      // Beside the road: the outline's road edge on the paved edge (or the footway's outer edge), on dry, open ground.
      const inner = where('V01', stop.outline[2]![0], stop.outline[2]![1]), sd = inner.o >= 0 ? st.right : st.left;
      expect(Math.abs(Math.abs(inner.o) - (sd.footway ? sd.footway.outer : sd.paved))).toBeLessThan(0.3);
      for (const p of stop.outline) expect(I.water(p[0], p[1])).toBe(false);
      if (stop.connectsTo) expect(stop.connectsTo).toEqual(['yearWalk']);
      // No lamp post or tree inside the outline; a lantern pair stands at its ends.
      for (const l of plan.lamps) expect(contains(stop.outline, l.at[0], l.at[2])).toBe(false);
      for (const g2 of plan.planting) for (const it of g2.items) expect(contains(stop.outline, it.at[0], it.at[2])).toBe(false);
      expect(plan.lamps.filter(l => Math.hypot(l.at[0] - stop.at[0], l.at[2] - stop.at[2]) < 16).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('reports per-reach counts within sensible bounds', () => {
    const rows: string[] = [], report: Record<string, unknown> = {};
    for (const id of ROADS) {
      const { plan, input, A, ms } = runs[id];
      const reaches = input.reaches.map(r => r.id);
      for (const rid of reaches) {
        const r = input.reaches.find(x => x.id === rid)!;
        const len = A.frame.closed || r.to > r.from ? (r.to - r.from + A.frame.length) % A.frame.length || A.frame.length : 0;
        const lamps = plan.lamps.filter(l => l.reachId === rid);
        const groups = plan.planting.filter(g => g.reachId === rid);
        const species: Partial<Record<PlantSpecies, number>> = {};
        for (const g of groups) for (const it of g.items) species[it.species] = (species[it.species] ?? 0) + 1;
        const items = groups.reduce((a, g) => a + g.items.length, 0);
        const stops = plan.stops.filter(s => stationAt(id, where(id, s.at[0], s.at[2]).s).reachId === rid).length;
        report[rid] = { length: Math.round(len), lamps: Object.fromEntries(['roadLantern', 'bridgeLantern', 'tunnelLamp'].map(k => [k, lamps.filter(l => l.kind === k).length])), groups: groups.length, items, species, stops };
        rows.push(`${rid.padEnd(8)} ${String(Math.round(len)).padStart(5)} m  lamps ${String(lamps.length).padStart(3)}  groups ${String(groups.length).padStart(3)}  items ${String(items).padStart(4)}  ${JSON.stringify(species)}${stops ? `  stops ${stops}` : ''}`);
        // Density bounds: a composed corridor, not a refill — ≤ 0.8 items per eu of road (drifts are many small beds).
        expect(items / Math.max(1, len)).toBeLessThanOrEqual(0.8);
      }
      rows.push(`${id} total: markings ${plan.markings.length}, lamps ${plan.lamps.length}, groups ${plan.planting.length}, items ${plan.planting.reduce((a, g) => a + g.items.length, 0)}, stops ${plan.stops.length}; plan ${ms.toFixed(0)} ms`);
      for (const n of plan.notes ?? []) rows.push(`  note: ${n}`);
    }
    const v01 = (rid: string) => report[`V01.${rid}`] as { lamps: Record<string, number>; groups: number; items: number; species: Partial<Record<PlantSpecies, number>> };
    // Mountain and coastal stay restrained; developed and boulevard reaches carry the lamps; the groves are in R5.
    expect(v01('R3').lamps.roadLantern).toBeLessThanOrEqual(6);
    expect(v01('R3').groups).toBeLessThanOrEqual(6);
    expect(v01('R1').lamps.roadLantern).toBeGreaterThan(4);
    expect(v01('R10').lamps.roadLantern).toBeGreaterThan(8);
    expect(v01('R10').species.palm ?? 0).toBeGreaterThan(8);
    expect(v01('R5').species.pine ?? 0).toBeGreaterThan(10);
    expect(v01('R7').species.palm ?? 0).toBe(0);
    expect(v01('R4').groups).toBeGreaterThan(2);
    console.log(rows.join('\n'));
    if (processEnv.CORRIDOR_PLAN_REPORT === '1') { mkdirSync('docs/horizon/evidence/road/plan', { recursive: true }); writeFileSync('docs/horizon/evidence/road/plan/counts.json', JSON.stringify(report, null, 1) + '\n'); }
  });

  it.runIf(processEnv.CORRIDOR_PLAN_MAP === '1')('renders the plan map (evidence)', async () => {
    mkdirSync('docs/horizon/evidence/road/plan', { recursive: true });
    await renderPlanMap(loadIsland(), ROADS.map(id => ({ input: runs[id].input, plan: runs[id].plan })), 'docs/horizon/evidence/road/plan/plan-map.png', [
      { name: 'R1 Harbour Gate · R13 Harbour Avenue · VG start', centre: [1420, 1090], size: 260 },
      { name: 'R4 Crown Coast (the Crown Lookout site)', centre: [1470, 380], size: 240 },
      { name: 'R5 Scholars\' Crest · library junction', centre: [870, 290], size: 300 },
      { name: 'R10 Long Sands Boulevard (median)', centre: [860, 1320], size: 300 },
      { name: 'R7 Flats Coast · station.jul', centre: [385, 720], size: 300 },
      { name: 'VG through the Green (≤ 0.85)', centre: [1010, 960], size: 300 },
    ]);
  }, 120000);
});
