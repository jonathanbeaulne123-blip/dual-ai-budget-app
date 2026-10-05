// The Water's Way prop kit (kit/props): every PropKind × dressing × tier draws finite card geometry near its record and
// within its triangle budget; lite keeps essential props only (and never adds); measured heights match the brief (island
// lantern 2.6 post, 0.8 bollard, 1.05 rail, 0.65 month stone, 0.83 hive, the osprey nest at 11.5); the geoglyph lies flat
// (≤ 0.2); collision exists only where asked and physically blocking, finite and matching what is drawn; the viewer has a
// free lever and no coin, slot or currency geometry; no prop writes a stencil (no lettering).
import { describe, expect, it } from 'vitest';
import { CardBuilder } from '../src/harbour/art/cardScene';
import { PROP_KINDS, VIEWER_PARTS, drawProp, propCollision, propIsEssential } from '../src/harbour/horizon/kit/props/index';
import type { DressingTheme, PropKind, PropRecord } from '../src/harbour/horizon/neighbourhoods/types';

const THEMES: DressingTheme[] = ['classic', 'taylor', 'newfoundland'];
type Cells = Map<string, { data: Record<string, { positions?: number[] }> }>;
const cellsOf = (b: CardBuilder) => (b as unknown as { cells: Cells }).cells;
function verts(b: CardBuilder, only?: string[]): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (const cell of cellsOf(b).values()) for (const [k, bucket] of Object.entries(cell.data)) { if (only && !only.includes(k)) continue; const p = bucket.positions; if (!p) continue; for (let i = 0; i < p.length; i += 3) out.push([p[i]!, p[i + 1]!, p[i + 2]!]); }
  return out;
}
const triangles = (b: CardBuilder) => { let n = 0; for (const cell of cellsOf(b).values()) for (const [k, bucket] of Object.entries(cell.data)) if (!['ink', 'shade'].includes(k)) n += (bucket.positions?.length ?? 0) / 9; return n; };
/** A gently sloping fixture ground (2 % east). */
const ground = (x: number, z: number) => 10 + (x - 500) * 0.02 + Math.sin(z * 0.05) * 0.3;
const AT: [number, number, number] = [500, ground(500, 500), 500];
const LINE = (y: (x: number, z: number) => number): PropRecord['line'] => [[494, y(494, 498), 498], [500, y(500, 500), 500], [507, y(507, 499), 499]];
function record(kind: PropKind, collide = true): PropRecord {
  const linear = ['railOpen', 'fence', 'drystoneWall', 'sheepFank', 'festoon', 'laundryLine'].includes(kind);
  const lineY = kind === 'festoon' ? (x: number, z: number) => ground(x, z) + 4 : kind === 'railOpen' ? (x: number, z: number) => ground(x, z) + 0.6 : ground;
  return { kind, at: AT, yaw: 0.6, ...(linear ? { line: LINE(lineY) } : {}), ...(kind === 'swing' ? { scale: 9.7 } : {}), ...(kind === 'kite' ? { line: [AT, [505, AT[1] + 22, 520]] } : {}), collide };
}
/** Per-kind triangle ceilings (full, lite); linear kinds on the 13.4 eu fixture line (walls ≤ ~26 / 8 per eu). */
const BUDGET: Partial<Record<PropKind, [number, number]>> = { geoglyph: [1400, 700], drystoneWall: [360, 120], sheepFank: [360, 120], railOpen: [600, 300], fence: [700, 300], festoon: [500, 300], ringBench: [640, 480], fountain: [500, 400], ospreyPole: [500, 200], readingTable: [500, 400], stall: [600, 300], volleyNet: [200, 100] };
const DEFAULT_BUDGET: [number, number] = [400, 260];
/** How far (plan) a kind's drawing may reach from its record (lines and kites reach further). */
const REACH: Partial<Record<PropKind, number>> = { geoglyph: 40, kite: 30, volleyNet: 10, ringBench: 7, bocceCourt: 8.5, skateBowl: 7, ospreyPole: 2.5, windsock: 3.5, fountain: 2.8, stall: 2.5, gozzo: 3.2, rowboat: 2.3, kayak: 2.1, snag: 3, rodHolder: 3.6, flag: 2 };
const LINEAR: PropKind[] = ['railOpen', 'fence', 'drystoneWall', 'sheepFank', 'festoon', 'laundryLine'];

describe("The Water's Way prop kit", () => {
  it('every kind × dressing × tier draws finite geometry near its record, within budget; lite draws only essential kinds and never more', () => {
    const table: Record<string, string> = {}, fails: string[] = [];
    for (const kind of PROP_KINDS) for (const theme of THEMES) {
      const counts: Record<string, number> = {};
      for (const tier of ['full', 'lite'] as const) {
        const b = new CardBuilder('t', tier, { ink: '#5b5447' }); drawProp(b, record(kind), theme, ground, tier);
        const v = verts(b), n = triangles(b); counts[tier] = n;
        if (tier === 'lite' && !propIsEssential(kind)) { if (v.length) fails.push(`${kind}/${theme} lite drew ${n}`); continue; }
        if (!n) fails.push(`${kind}/${theme}/${tier} drew nothing`);
        const reach = LINEAR.includes(kind) ? 12 : (REACH[kind] ?? 2) * (kind === 'swing' ? 1 : 1);
        for (const p of v) { if (!p.every(Number.isFinite)) { fails.push(`${kind} non-finite`); break; } if (Math.hypot(p[0] - AT[0], p[2] - AT[2]) > reach + 0.5) { fails.push(`${kind}/${theme} reaches ${Math.hypot(p[0] - AT[0], p[2] - AT[2]).toFixed(1)}`); break; } }
        const [cap, liteCap] = BUDGET[kind] ?? DEFAULT_BUDGET; if (n > (tier === 'full' ? cap : liteCap)) fails.push(`${kind}/${theme}/${tier} ${n} triangles > ${tier === 'full' ? cap : liteCap}`);
        if (verts(b, ['decals', 'wax']).length) fails.push(`${kind}/${theme} wrote a stencil`);
      }
      if (propIsEssential(kind) && counts.lite! > counts.full!) fails.push(`${kind}/${theme} lite ${counts.lite} > full ${counts.full}`);
      if (theme === 'classic') table[kind] = propIsEssential(kind) ? `${counts.full} / ${counts.lite}` : `${counts.full} / —`;
    }
    console.log('[ww props] triangles per prop, Classic, full / lite (— = dropped on lite):', JSON.stringify(table));
    expect(fails).toEqual([]);
  });

  it('measured heights match the brief', () => {
    const top = (kind: PropKind, rec: Partial<PropRecord> = {}, buckets?: string[]) => { const b = new CardBuilder('t', 'full', { ink: '#5b5447' }); drawProp(b, { ...record(kind), ...rec }, 'classic', ground, 'full'); return Math.max(...verts(b, buckets).map(p => p[1])) - AT[1]; };
    expect(top('lantern', {}, ['glow'])).toBeGreaterThan(2.5); expect(top('lantern', {}, ['glow'])).toBeLessThan(3.4); // the island lantern's head on its 2.6 post
    expect(top('bollard')).toBeLessThanOrEqual(0.85); expect(top('bollard')).toBeGreaterThan(0.75);
    expect(top('monthStone')).toBeCloseTo(0.65, 2); expect(top('hive')).toBeCloseTo(0.83, 2);
    expect(top('ringBench', {}, ['card'])).toBeCloseTo(0.85, 3); expect(top('bench', {}, ['card'])).toBeLessThanOrEqual(0.9);
    expect(top('ospreyPole')).toBeGreaterThan(11.9); expect(top('ospreyPole')).toBeLessThan(12.3);
    expect(top('viewer', {}, ['steel', 'card'])).toBeLessThan(1.35); expect(top('viewerSeated', {}, ['steel', 'card'])).toBeLessThan(1.05);
    expect(top('windsock')).toBeGreaterThan(6.1);
    // the open rail: 1.05 above its line
    const b = new CardBuilder('t', 'full', { ink: '#5b5447' }); const rail = record('railOpen'); drawProp(b, rail, 'classic', ground, 'full');
    const maxAbove = Math.max(...verts(b, ['card', 'steel']).map(p => p[1] - (ground(p[0], p[2]) + 0.6))); expect(maxAbove).toBeGreaterThan(1.0); expect(maxAbove).toBeLessThan(1.16);
    // the geoglyph lies flat: nothing over 0.2 above the ground
    for (const theme of THEMES) { const g = new CardBuilder('t', 'full', { ink: '#5b5447' }); drawProp(g, record('geoglyph'), theme, ground, 'full'); for (const p of verts(g)) expect(p[1] - ground(p[0], p[2])).toBeLessThanOrEqual(0.2 + 1e-6); }
    // the swing's ropes reach its scale (the limb) and its seat sits 0.5 up
    const s = new CardBuilder('t', 'full', { ink: '#5b5447' }); drawProp(s, record('swing'), 'classic', ground, 'full'); const ys = verts(s, ['card']).map(p => p[1] - AT[1]);
    expect(Math.max(...ys)).toBeGreaterThan(9.6); expect(Math.min(...ys)).toBeGreaterThan(0.4);
  });

  it('collision: only when asked and physically blocking; finite, sane boxes near what is drawn', () => {
    const none: PropKind[] = ['towel', 'umbrella', 'kite', 'swing', 'fireRing', 'rodHolder', 'buoy', 'net', 'festoon', 'bocceCourt', 'skateBowl', 'geoglyph'];
    for (const kind of PROP_KINDS) {
      expect(propCollision(record(kind, false), ground), kind).toEqual([]);
      const parts = propCollision(record(kind), ground);
      if (none.includes(kind)) { expect(parts, kind).toEqual([]); continue; }
      expect(parts.length, kind).toBeGreaterThan(0);
      for (const p of parts) {
        const ptop = p.kind === 'box' ? p.top : Math.max(...p.corners.map(q => q[1])); expect(ptop, kind).toBeGreaterThan(p.bottom); expect(p.walkable).toBe(false);
        if (p.kind === 'box') { expect(p.size.every(v => v > 0 && Number.isFinite(v)), kind).toBe(true); expect([...p.centre, p.yaw, p.bottom, p.top].every(Number.isFinite)).toBe(true);
          expect(Math.hypot(p.centre[0] - AT[0], p.centre[1] - AT[2]), kind).toBeLessThan(LINEAR.includes(kind) ? 8 : 7); expect(p.top - AT[1], kind).toBeLessThan(12); }
        else { expect(p.corners.length).toBeGreaterThanOrEqual(3); for (const c of p.corners) expect(c.every(Number.isFinite)).toBe(true); }
      }
    }
    // linear walls follow the ground under the line
    const wall = propCollision(record('drystoneWall'), ground);
    expect(wall).toHaveLength(2); for (const p of wall) if (p.kind === 'box') expect(p.top - p.bottom).toBeGreaterThan(1.1);
  });

  it('the viewer: a free lever where the coin box would be — no coin, slot or currency part, no stencil, both heights', () => {
    for (const part of VIEWER_PARTS) expect(part).not.toMatch(/coin|slot|currency|money|price|token|pay/i);
    expect(VIEWER_PARTS).toContain('lever'); expect(VIEWER_PARTS).toContain('leverBox');
    for (const theme of THEMES) for (const kind of ['viewer', 'viewerSeated'] as const) { const b = new CardBuilder('t', 'full', { ink: '#5b5447' }); drawProp(b, record(kind), theme, ground, 'full'); expect(verts(b, ['decals', 'wax'])).toEqual([]); }
  });

  it('non-finite records draw nothing and collide nothing', () => {
    const b = new CardBuilder('t', 'full', { ink: '#5b5447' }); drawProp(b, { kind: 'bench', at: [NaN, 0, 0], yaw: 0 }, 'classic', ground, 'full'); expect(triangles(b)).toBe(0);
    expect(propCollision({ kind: 'bench', at: [0, 0, NaN], yaw: 0, collide: true }, ground)).toEqual([]);
  });
});
