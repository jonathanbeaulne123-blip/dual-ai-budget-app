/**
 * The road corridor (ROAD.md §1–§3; track L2): stations, reaches, guards and the corridor's solids.
 * Part 1 builds corridors on small synthetic lands (fast, exact). Part 2 reads the committed bake (the real island).
 */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { BedCut, LandCuts, PadCut, StructureSolid, XYZ } from '../src/harbour/horizon/land/interfaces';
import { bed } from '../src/harbour/horizon/land/beds/profiles';
import { box, solid } from '../src/harbour/horizon/land/structures/mesh';
import { buildCorridors, applyCorridors } from '../src/harbour/horizon/land/corridor/index';
import { CORRIDOR, type Corridor, type CorridorStation, type GuardRun } from '../src/harbour/horizon/land/corridor/types';
import { V01_REACHES, isCorridorRoad } from '../src/harbour/horizon/land/corridor/reaches';
import { MIN_RUN } from '../src/harbour/horizon/land/corridor/guards';
import { GUARD_PANEL } from '../src/harbour/horizon/land/corridor/solids';
import { createHorizonGeography } from '../src/harbour/horizon/runtime/geography';
import { corridorLightAnchors } from '../src/harbour/horizon/land/corridor/lights';
import { parseHorizonDefinition } from '../src/house/world/horizonAssets';

const empty = (): LandCuts => ({ beds: [], pads: [], solids: [], mouths: [], waters: [], diagnostics: [] });
/** A road bed under a corridor-road id (VG: open context, one reach), graded as given. */
const road = (id: string, points: XYZ[]): BedCut => bed(id, id.startsWith('spur') ? 'spur' : 'road', points);
const line = (from: [number, number], to: [number, number], h: number | ((t: number) => number), n = 40): XYZ[] => Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return [from[0] + (to[0] - from[0]) * t, typeof h === 'number' ? h : h(t), from[1] + (to[1] - from[1]) * t] as XYZ; });
/** Triangle list of a solid set as [a, b, c] vertices. */
function tris(solids: readonly StructureSolid[]): { id: string; kind: string; role: string; v: XYZ[] }[] {
  const out: { id: string; kind: string; role: string; v: XYZ[] }[] = [];
  for (const s of solids) for (let i = 0; i < s.indices.length; i += 3) out.push({ id: s.id, kind: s.kind, role: s.role, v: [0, 1, 2].map(k => { const j = s.indices[i + k]! * 3; return [s.positions[j]!, s.positions[j + 1]!, s.positions[j + 2]!] as XYZ; }) });
  return out;
}
const field = (w = 400) => ({ revision: 'horizon-geo-1' as const, width: w, depth: w, step: 10, columns: w / 10 + 1, rows: w / 10 + 1, heights: new Float32Array((w / 10 + 1) ** 2), surfaces: new Uint8Array((w / 10 + 1) ** 2) });

describe('corridor on a synthetic land', () => {
  // VG north along x = 200 over flat ground at 10. Facing +z, right(t) = (-t.z, t.x) = (-1, 0): the RIGHT side is x < 200.
  // A 4 eu drop on the left (x > 205) from z 60 to 100; a 1.5 eu bank on the right (x < 195) from z 130 to 170.
  const ground = (x: number, z: number) => x > 205 && z > 60 && z < 100 ? 6 : x < 195 && z > 130 && z < 170 ? 11.5 : 10;
  const make = () => {
    const cuts = empty(), vg = road('VG', line([200, 0], [200, 200], 10));
    // A walk joins at grade from the right (x < 200) at z 40 (a mouth); a pad sits flush on the left (x > 200) at z 150.
    const walk = bed('walk join', 'walk', [[180, 10, 40], [196, 10, 40]]);
    const pad: PadCut = { id: 'place.test', kind: 'place', centre: [212, 10, 150], size: [14, 10], rotationDegrees: 0, margin: 0, blend: 0 };
    cuts.beds.push(vg, walk); cuts.pads.push(pad);
    // The road's old strip (replaced by the corridor), and another bed's solid (kept).
    const old = solid('VG.bed', 'bed', 'paved', 'deck', ['VG']); box(old, [200, 100], 10, [8, 200], 9.4); cuts.solids.push(old);
    const keep = solid('walk join.bed', 'bed', 'gravel', 'deck', ['walk join']); box(keep, [188, 40], 10, [16, 2.5], 9.65); cuts.solids.push(keep);
    return { cuts, build: buildCorridors(cuts, ground) };
  };
  it('places stations every CORRIDOR.step along the final bed, continuous, with tangents, grades and one reach', () => {
    const { build } = make(), c = build.corridors[0]!;
    expect(build.corridors.map(c => c.id)).toEqual(['VG']);
    expect(c.closed).toBe(false); expect(c.stations).toHaveLength(101); expect(c.step).toBeCloseTo(2, 6);
    c.stations.forEach((st, k) => { expect(st.s).toBeCloseTo(k * 2, 3); expect(st.at[1]).toBeCloseTo(10, 6); expect(st.tangent[1]).toBeCloseTo(1, 6); expect(st.grade).toBeCloseTo(0, 6); expect(st.half).toBe(4); expect(st.left.paved).toBe(5); expect(st.reachId).toBe('VG'); });
    for (let k = 1; k < c.stations.length; k++) expect(Math.hypot(c.stations[k]!.at[0] - c.stations[k - 1]!.at[0], c.stations[k]!.at[2] - c.stations[k - 1]!.at[2])).toBeCloseTo(2, 3);
  });
  it('measures drops beyond the paved edge, marks mouths and flush pads as gaps, and a cutting side as retaining', () => {
    const { build } = make(), c = build.corridors[0]!, at = (z: number) => c.stations.find(st => Math.abs(st.at[2] - z) < 1e-6)!;
    expect(at(80).left.drop).toBeCloseTo(4, 3); expect(at(80).right.drop).toBeCloseTo(0, 3);
    expect(at(40).right.gap).toBe('entrance'); expect(at(150).left.gap).toBe('entrance'); expect(at(20).right.gap).toBeUndefined();
    expect(at(150).right.drop).toBeCloseTo(-1.5, 3);
    const runs = c.guards.map(r => [r.side, r.kind]); expect(runs).toContainEqual(['left', 'postRail']); expect(runs).toContainEqual(['right', 'retaining']);
  });
  it('guards every station with a drop over CORRIDOR.guardDrop outside gaps, with deliberate ends and ≥ MIN_RUN', () => {
    const { build } = make(), c = build.corridors[0]!;
    for (const st of c.stations) for (const side of ['left', 'right'] as const) if (st[side].drop > CORRIDOR.guardDrop && !st[side].gap && !st.structureId) expect(st[side].guard, `${side} at ${st.s}`).not.toBe('none');
    for (const r of c.guards) { expect(r.to - r.from).toBeGreaterThanOrEqual(MIN_RUN - 1e-6); expect(r.line.length).toBeGreaterThan(1); expect(r.ends.every(e => ['flare', 'buried', 'pier', 'abutment', 'continues'].includes(e))).toBe(true); }
    const rail = c.guards.find(r => r.kind === 'postRail')!;
    expect(rail.offset).toBeCloseTo(5 + CORRIDOR.guardSetback, 6); expect(rail.height).toBe(CORRIDOR.postRailHeight);
    for (const p of rail.line) expect(p[0]).toBeCloseTo(200 + rail.offset, 3);   // the left side is x > 200 facing +z
  });
  it('builds one continuous deck ribbon whose top is the station surface and whose sections are shared (no crack)', () => {
    const { build } = make(), decks = build.solids.filter(s => s.kind === 'corridorDeck');
    expect(decks.length).toBe(1); const d = decks[0]!;
    expect(d.role).toBe('deck'); expect(d.walkable).toBe(true); expect(d.surface).toBe('paved');
    // Every prism's end face coincides with the next prism's start face (shared cross-sections).
    const P = d.positions, prisms = P.length / 24;
    for (let j = 1; j < prisms; j++) for (const [a, b] of [[7, 4], [6, 5], [3, 0], [2, 1]] as const) for (let c = 0; c < 3; c++) expect(P[(j - 1) * 24 + a * 3 + c]).toBe(P[j * 24 + b * 3 + c]);
    // The top is flat at the station height across the paved width.
    const top = tris([d]).filter(t => t.v.every(v => Math.abs(v[1] - 10) < 1e-9)); expect(top.length).toBeGreaterThan(0);
    const xs = top.flatMap(t => t.v.map(v => v[0])); expect(Math.min(...xs)).toBeLessThanOrEqual(195 + 1e-6); expect(Math.max(...xs)).toBeGreaterThanOrEqual(205 - 1e-6);
  });
  it('keeps the guard collider inside the visible guard line and never across a declared gap', () => {
    const { build } = make(), c = build.corridors[0]!;
    for (const run of c.guards.filter(r => r.kind !== 'retaining')) {
      const col = build.solids.filter(s => s.id.startsWith(run.colliderId));
      expect(col.length).toBeGreaterThan(0);
      for (const t of tris(col)) for (const v of t.v) {
        // Within the panel's half thickness of the line, within the run's arc span.
        const d = Math.min(...run.line.slice(1).map((p, i) => { const a = run.line[i]!, dx = p[0] - a[0], dz = p[2] - a[2], u = Math.max(0, Math.min(1, ((v[0] - a[0]) * dx + (v[2] - a[2]) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(v[0] - a[0] - dx * u, v[2] - a[2] - dz * u); }));
        expect(d).toBeLessThanOrEqual(GUARD_PANEL.thickness / 2 + 1e-6);
      }
      const gapS = c.stations.filter(st => st[run.side].gap).map(st => st.s);
      for (const s of gapS) expect(s < run.from - 1e-6 || s > run.to + 1e-6, `${run.id} over the gap at ${s}`).toBe(true);
    }
  });
  it('puts nothing but the deck inside the carriageway, replaces the old strip and keeps other beds\' solids', () => {
    const { cuts, build } = make();
    for (const t of tris(build.solids)) if (t.kind !== 'corridorDeck') for (const v of t.v) if (Math.abs(v[0] - 200) < 4 - 1e-6) expect(v[1], `${t.id} inside the lanes`).toBeLessThan(10 - .05);
    expect(build.replacedIds).toEqual(['VG.bed']);
    applyCorridors(cuts, build);
    expect(cuts.solids.some(s => s.id === 'VG.bed')).toBe(false); expect(cuts.solids.some(s => s.id === 'walk join.bed')).toBe(true);
  });
  it('drives the collision the rider meets: the deck carries the body, the guard stops it, the gap does not', () => {
    const { cuts, build } = make(); applyCorridors(cuts, build);
    const g = createHorizonGeography(field(), cuts);
    expect(g.surface(200, 50, 10.2)!.y).toBeCloseTo(10, 6); expect(g.surface(204.5, 80, 10.2)!.y).toBeCloseTo(10, 6);
    const run = build.corridors[0]!.guards.find(r => r.kind === 'postRail')!;
    expect(run.side).toBe('left');
    expect(g.blocker(200 + run.offset - .3, 80, 10, .3)).not.toBeNull();   // into the rail at the drop
    expect(g.blocker(203, 80, 10, .3)).toBeNull();                          // on the shoulder, clear of it
    expect(g.blocker(196, 40, 10, .3)).toBeNull();                          // the walk's mouth is open
  });
  it('is deterministic: the same land gives byte-identical corridors and solids', () => {
    const a = make().build, b = make().build;
    expect(JSON.stringify(a.corridors)).toBe(JSON.stringify(b.corridors)); expect(JSON.stringify(a.solids)).toBe(JSON.stringify(b.solids));
  });
});

describe('sidewalks on a developed reach', () => {
  it('lays a kerbed sidewalk with dropped kerbs (≤ 8 %) at a crossing and a walk bed the path graph can use', () => {
    // Horizon Drive's R1 (developed) runs from [1400,1060] to [1543.2,1001.4]: a straight V01 through it, flat ground at 20.
    const cuts = empty(), pts = line([1400, 1060], [1543.2, 1001.4], 20, 60), v01 = road('V01', pts);
    const cross = bed('walk crossing', 'walk', [[1460, 20, 1005], [1480, 20, 1060]]);
    cuts.beds.push(v01, cross);
    const build = buildCorridors(cuts, () => 20), c = build.corridors[0]!;
    expect(c.reaches[0]!.id).toBe('R1');
    const walks = c.stations.filter(st => st.right.edge === 'sidewalk' || st.left.edge === 'sidewalk');
    expect(walks.length).toBeGreaterThan(20);
    expect(build.walks.length).toBeGreaterThan(0);
    for (const w of build.walks) { expect(w.kind).toBe('walk'); expect(w.id).toMatch(/^V01\.walk\.[LR]\.\d+$/); }
    // Kerb heights along each sidewalk side: flush at the crossing and the ends, ramps ≤ 8 %.
    for (const side of ['left', 'right'] as const) {
      const sts = c.stations.filter(st => st[side].edge === 'sidewalk');
      for (let i = 1; i < sts.length; i++) {
        const a = sts[i - 1]!, b = sts[i]!; if (Math.abs(b.s - a.s - c.step) > 1e-6) continue;
        expect(Math.abs((b[side].footway!.height - b.at[1]) - (a[side].footway!.height - a.at[1])) / c.step).toBeLessThanOrEqual(.08 + 1e-9);
      }
      if (sts.length) { expect(sts[0]![side].footway!.height).toBeCloseTo(sts[0]!.at[1], 6); expect(sts.at(-1)![side].footway!.height).toBeCloseTo(sts.at(-1)!.at[1], 6); }
    }
    const crossing = c.stations.filter(st => st.left.gap === 'crossing' || st.right.gap === 'crossing');
    expect(crossing.length).toBeGreaterThan(0);
    for (const st of crossing) for (const side of ['left', 'right'] as const) if (st[side].footway && st[side].edge === 'sidewalk') expect(st[side].footway!.height).toBeCloseTo(st.at[1], 6);
  });
});

describe('the reach table (ROAD.md §3)', () => {
  it('covers Horizon Drive with the thirteen named reaches in order and names only the corridor roads', () => {
    expect([...new Set(V01_REACHES.map(r => r.id.replace(/[a-c]$/, '')))]).toEqual(['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12', 'R13']);
    for (const id of ['V01', 'VG', 'V03', 'VBS', 'spur library', 'plot.bight.1.service']) expect(isCorridorRoad({ id, kind: 'road', terrainCut: true })).toBe(true);
    for (const id of ['strip', 'structure.quayBridge', 'mountainV2.road', 'prowTunnel']) expect(isCorridorRoad({ id, kind: 'road', terrainCut: true })).toBe(false);
  });
});

describe('the baked corridors (public/horizon)', () => {
  let world: ReturnType<typeof parseHorizonDefinition>, corridors: Corridor[];
  beforeAll(() => { const bytes = readFileSync('public/horizon/world/horizon-geo-1.json.gz'); world = parseHorizonDefinition(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer); corridors = world.corridors ?? []; }, 120000);
  const solidsOf = (prefix: string) => world.geometry.solids.filter(s => (s.sourceId ?? s.id).startsWith(prefix));
  /** The solids of one corridor piece: `<id>.<district>` (never `<id>0.…`, another run). */
  const pieceOf = (id: string) => world.geometry.solids.filter(s => { const src = s.sourceId ?? s.id; return src === id || src.startsWith(`${id}.`) && !/^\d/.test(src.slice(id.length + 1)); });
  it('carries one corridor per road bed with continuous stations and contiguous reaches', () => {
    expect(corridors.map(c => c.id).slice(0, 4)).toEqual(['V01', 'VG', 'VBS', 'V03']);
    expect(corridors.length).toBe(17);
    for (const c of corridors) {
      for (let k = 1; k < c.stations.length; k++) { const a = c.stations[k - 1]!, b = c.stations[k]!; expect(Math.abs(b.s - a.s - c.step)).toBeLessThanOrEqual(2e-3); expect(Math.hypot(b.at[0] - a.at[0], b.at[2] - a.at[2])).toBeLessThanOrEqual(c.step + 2e-3); }
      expect(c.step).toBeGreaterThan(1.8); expect(c.step).toBeLessThanOrEqual(CORRIDOR.step);
      for (let i = 1; i < c.reaches.length; i++) expect(c.reaches[i]!.from).toBeCloseTo(c.reaches[i - 1]!.to, 3);
    }
    const v01 = corridors[0]!; expect(v01.closed).toBe(true); expect(v01.reaches.map(r => r.id)[0]).toBe('R1');
    expect(v01.stations.some(st => st.structureId === 'quayBridge')).toBe(true); expect(v01.stations.some(st => st.structureId === 'bightBridge')).toBe(true); expect(v01.stations.some(st => st.structureId === 'prowTunnel')).toBe(true);
  });
  it('guards every station with a drop over CORRIDOR.guardDrop (outside gaps, structures and Year Walk footways)', () => {
    const missing: string[] = [];
    for (const c of corridors) for (const st of c.stations) for (const side of ['left', 'right'] as const) {
      const s = st[side]; if (s.drop <= CORRIDOR.guardDrop || s.gap || st.structureId || s.edge === 'structure' || s.edge === 'yearWalk') continue;
      if (s.guard === 'none') missing.push(`${c.id} ${side} ${st.s}`);
    }
    expect(missing).toEqual([]);
  });
  it('builds each guard collider inside its visible line, never across a declared gap, and lists it by id', () => {
    for (const c of corridors) for (const run of c.guards) {
      const col = pieceOf(run.colliderId); expect(col.length, run.colliderId).toBeGreaterThan(0);
      if (run.kind === 'retaining') continue;
      const gaps = c.stations.filter(st => st[run.side].gap).map(st => st.s);
      expect(gaps.filter(s => (run.from <= run.to ? s >= run.from - 1e-6 && s <= run.to + 1e-6 : s >= run.from - 1e-6 || s <= run.to + 1e-6)), run.id).toEqual([]);
      for (const t of tris(col)) for (const v of t.v) {
        let d = Infinity; for (let i = 1; i < run.line.length; i++) { const a = run.line[i - 1]!, p = run.line[i]!, dx = p[0] - a[0], dz = p[2] - a[2], u = Math.max(0, Math.min(1, ((v[0] - a[0]) * dx + (v[2] - a[2]) * dz) / (dx * dx + dz * dz || 1))); d = Math.min(d, Math.hypot(v[0] - a[0] - dx * u, v[2] - a[2] - dz * u)); }
        expect(d, run.id).toBeLessThanOrEqual(GUARD_PANEL.thickness / 2 + 1e-3);
      }
    }
  });
  it('has no road-kind strip, shoulder, kerb, parapet or retaining solid of the old emitter on a corridor road', () => {
    const roads = corridors.map(c => c.id), old = world.geometry.solids.filter(s => roads.some(r => /^(bed|surface|shoulders|kerbs|edges|retaining|batter)(\.|$)/.test((s.sourceId ?? s.id).startsWith(`${r}.`) ? (s.sourceId ?? s.id).slice(r.length + 1) : '')));
    expect(old.map(s => s.id)).toEqual([]);
  });
  it('writes the corridor deck top at the station surface, and appends corridor lamps to world.lights', () => {
    const v01 = corridors[0]!, deck = solidsOf('V01.corridor.deck.');
    const tops = new Map<string, number>(); for (const s of deck) for (let i = 0; i < s.positions.length; i += 3) tops.set(`${s.positions[i]!.toFixed(3)}:${s.positions[i + 2]!.toFixed(3)}`, Math.max(tops.get(`${s.positions[i]!.toFixed(3)}:${s.positions[i + 2]!.toFixed(3)}`) ?? -Infinity, s.positions[i + 1]!));
    const heights = new Set(v01.stations.filter(st => !st.structureId).map(st => st.at[1].toFixed(3)));
    let matched = 0; for (const y of tops.values()) if (heights.has(y.toFixed(3))) matched++;
    expect(matched).toBeGreaterThan(v01.stations.filter(st => !st.structureId).length);
    const anchors = corridorLightAnchors(corridors); for (const a of anchors) expect(world.lights.some(l => l.id === a.id)).toBe(true);
  });
});
void (null as unknown as CorridorStation | GuardRun);
