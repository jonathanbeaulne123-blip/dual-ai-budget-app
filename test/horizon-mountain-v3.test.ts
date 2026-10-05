import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CIRQUE, GLACIER, GLACIER_PEAK, V2_SUMMIT_HEIGHT, V3_BENCHES, V3_CEILING, V3_PLACES, VEIL, glacierSurface, insideV3Reach, mountainV3Height, v3Freedom, v3Paint } from '../src/harbour/horizon/land/mountainV3/landform';
import { V3_BASINS, V3_FALLS, V3_FLOW, V3_REACHES, V3_SEEPS, buildMountainV3Falls, buildMountainV3Waters, isMountainV3Water } from '../src/harbour/horizon/land/mountainV3/water';
import { baseHeight, biomeGround } from '../src/harbour/horizon/land/terrain/index';
import { mountainV2Rule } from '../src/harbour/horizon/land/mountainV2/ground';
import { buildWaterCuts } from '../src/harbour/horizon/land/water';
import { CONFLUENCE_LEVEL_EU } from '../src/harbour/horizon/world/crossings';
import { HORIZON_MANIFEST as M } from '../src/harbour/horizon/world/manifest';

const m = M as unknown as Record<string, any>;

describe('Mountain V3 · the Highlands and the Falls (D-M11)', () => {
  it('is one definition: Glacier Peak is the ring\'s high point, under v2\'s summit, and v2\'s own land south of its summit line is untouched', () => {
    expect(GLACIER_PEAK.top).toBe(156);
    expect(GLACIER_PEAK.top).toBeLessThan(V2_SUMMIT_HEIGHT);
    expect(V3_CEILING).toBeLessThan(V2_SUMMIT_HEIGHT);
    const [px, pz] = GLACIER_PEAK.at;
    const peak = baseHeight(px, pz);
    expect(peak).toBeGreaterThan(150);
    expect(peak).toBeLessThanOrEqual(V3_CEILING + .01);
    // The horn is the high point of V3's own ground (a 60 m ring around it, off v2's land).
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) for (const r of [30, 60]) {
      const x = px + r * Math.cos(a), z = pz + r * Math.sin(a);
      if (mountainV2Rule(x, z).kind === 'land') continue;
      expect(baseHeight(x, z), `${x.toFixed(0)},${z.toFixed(0)}`).toBeLessThan(peak);
    }
    // v2's land south of the summit line keeps v2's ground exactly (the live world, D-M1).
    for (const [x, z] of [[1300, 520], [1260, 600], [1340, 640], [1200, 560]] as const) {
      const rule = mountainV2Rule(x, z);
      if (rule.kind !== 'land' || rule.north) continue;
      expect(mountainV3Height(x, z, 100)).toBe(100);
    }
    // Outside the reach V3 does nothing at all.
    expect(v3Freedom(700, 700)).toBe(0);
    expect(mountainV3Height(700, 700, 33.3)).toBe(33.3);
    expect(insideV3Reach(1402, 398)).toBe(true);
    expect(insideV3Reach(700, 700)).toBe(false);
  });

  it('fills the cirque with ice the terrain carries, painted snow with a scree moraine, and never a floating sheet', () => {
    const [cx, cz] = GLACIER.at;
    const ice = glacierSurface(cx, cz);
    expect(ice).not.toBeNull();
    expect(ice!).toBeGreaterThan(CIRQUE.floor);
    expect(baseHeight(cx, cz)).toBeGreaterThanOrEqual(ice! - .01);
    expect(v3Paint(cx, cz, baseHeight(cx, cz))).toBe('snow');
    expect(biomeGround(cx, cz, baseHeight(cx, cz))).toBe(biomeGround(cx + 1, cz, baseHeight(cx + 1, cz)));
    // The tongue descends to its snout at Glacier Springs, where the Crown Rill begins.
    const [sx, sz] = GLACIER.tongue.to;
    expect(baseHeight(sx, sz)).toBeLessThan(ice!);
    const springs = V3_BASINS.find(b => b.id === 'water.v3.glacierSprings')!;
    expect(Math.hypot(springs.at[0] - sx, springs.at[1] - sz)).toBeLessThan(12);
    expect(glacierSurface(700, 700)).toBeNull();
    expect(v3Paint(700, 700, 30)).toBeNull();
  });

  it('keeps the highland benches uneven (no two at one level) and the hamlet bench walkable', () => {
    // Neighbouring benches (within 150 m) never share a level: the highlands read as steps, not bands.
    for (const a of V3_BENCHES) for (const b of V3_BENCHES) if (a !== b && Math.hypot(a.at[0] - b.at[0], a.at[1] - b.at[1]) < 150) expect(a.level, `${a.id} vs ${b.id}`).not.toBe(b.level);
    const hamlet = V3_BENCHES.find(b => b.id === 'bench.hamlet')!;
    for (const dx of [-20, 0, 20]) for (const dz of [-10, 0, 10]) expect(Math.abs(baseHeight(hamlet.at[0] + dx, hamlet.at[1] + dz) - hamlet.level), `${dx},${dz}`).toBeLessThan(4);   // a plateau that still rolls (≤ 10 % across the hamlet), never a flat band
  });

  it('is one water system: every reach and fall flows to a named body, falls drop from lip to pool, and no water reads money', () => {
    // Two waters outside the network receive it: Stillwater (by Veil Pool's outlet) and, V3.1 (D-WW55, the second stream), Orchard
    // Brook (by the Hollow Beck from the Hollow Tarn).
    const ids = new Set([...V3_REACHES.map(r => r.id), ...V3_BASINS.map(b => b.id), ...V3_FALLS.map(f => f.id), 'water.stillwater', 'water.brook']);
    for (const [a, b] of V3_FLOW) { expect(ids.has(a), a).toBe(true); expect(ids.has(b), b).toBe(true); }
    const feeds = new Set(V3_FLOW.map(([a]) => a)), fed = new Set([...V3_FLOW.map(([, b]) => b), ...V3_SEEPS.map(s => s.to)]);
    // Every reach hands its water on; every basin but the springs, the tarns' seep source and the terminal meres is fed by something.
    for (const r of V3_REACHES) expect(feeds.has(r.id), `${r.id} flows nowhere`).toBe(true);
    for (const f of V3_FALLS) { expect(feeds.has(f.id), f.id).toBe(true); expect(fed.has(f.id), f.id).toBe(true); }
    const sources = new Set(['water.v3.glacierSprings', 'water.v3.colRill']);
    for (const b of V3_BASINS) if (!sources.has(b.id)) expect(fed.has(b.id), `${b.id} is fed by nothing`).toBe(true);
    for (const f of V3_FALLS) {
      const pool = V3_BASINS.find(b => b.id === f.pool)!;
      expect(pool, f.id).toBeDefined();
      expect(f.top, f.id).toBeGreaterThan(f.foot);
      expect(Math.abs(f.foot - pool.level), `${f.id} foot vs pool`).toBeLessThan(.5);
      expect(f.top - f.foot, f.id).toBeGreaterThanOrEqual(14);
    }
    // Downhill: each reach ends no higher than it starts, and a reach that feeds a basin arrives at the basin's level ± 1.
    for (const r of V3_REACHES) {
      expect(r.pts[0]![2], r.id).toBeGreaterThanOrEqual(r.pts.at(-1)![2]);
      const next = V3_FLOW.find(([a]) => a === r.id)![1];
      const basin = V3_BASINS.find(b => b.id === next);
      if (basin) expect(Math.abs(r.pts.at(-1)![2] - basin.level), `${r.id} → ${basin.id}`).toBeLessThan(1);
    }
    const source = readFileSync(new URL('../src/harbour/horizon/land/mountainV3/water.ts', import.meta.url), 'utf8') + readFileSync(new URL('../src/harbour/horizon/land/mountainV3/landform.ts', import.meta.url), 'utf8');
    for (const word of ['Fund', 'balance', 'cents', 'BasinReading', 'ledger', 'snapshot', 'import.*money']) expect(new RegExp(word).test(source), word).toBe(false);
  });

  it('builds its water cuts and falls into the shared water list, scaled, with its own id prefix', () => {
    const one = buildMountainV3Waters(1), two = buildMountainV3Waters(2);
    expect(one.length).toBe(V3_REACHES.length + V3_BASINS.length);
    for (const w of one) expect(isMountainV3Water(w.id), w.id).toBe(true);
    expect(two.find(w => w.id === 'water.v3.veilPool')!.level).toBeCloseTo(one.find(w => w.id === 'water.v3.veilPool')!.level * 2, 6);
    const shared = buildWaterCuts();
    for (const w of one) expect(shared.some(s => s.id === w.id), w.id).toBe(true);
    const falls = buildMountainV3Falls(1);
    expect(falls.map(f => f.id)).toEqual(V3_FALLS.map(f => f.id));
    const veil = falls.find(f => f.id === 'fall.veil')!;
    expect(veil.lip[0]![1]).toBe(VEIL.lip.z);
    expect(veil.top).toBeLessThanOrEqual(VEIL.lip.height);
  });

  it('is deterministic', () => {
    const probe = () => [[1402, 398], [1356, 410], [1086, 418], [1111, 690], [1492, 576], [1436, 694], [1566, 545]].map(([x, z]) => baseHeight(x!, z!));
    expect(probe()).toEqual(probe());
    expect(JSON.stringify(buildMountainV3Waters())).toBe(JSON.stringify(buildMountainV3Waters()));
  });

  it('is wired through the manifest: Rim Bridge, Rim Steps, the glacier walks, the footbridges and the Year Walk re-route', () => {
    expect(m.version).toBe('3.0');
    for (const id of ['rimWalk', 'glacierWalk', 'eastRim', 'hamletLane', 'fallswatch', 'ranchLane']) expect(m.walks[id], id).toBeDefined();
    expect(m.structures.rimTunnel).toMatchObject({ kind: 'tunnel', route: 'V01', xy: [1566, 545] });
    expect(m.structures.rimTunnelWalk).toMatchObject({ kind: 'tunnel', route: 'yearWalk' });
    for (const id of ['colFootbridge', 'shielingFootbridge', 'hamletFootbridge', 'rillcutFootbridge', 'veilFootbridge']) expect(m.structures[id], id).toBeDefined();
    const stairs = Object.entries(m.structures).filter(([, v]) => (v as any)?.kind === 'stair').map(([k]) => k);
    expect(stairs).toEqual(expect.arrayContaining(['rimSteps', 'colSteps', 'shielingSteps']));
    const yw = m.journey.yearWalk;
    expect(yw.pts).toContainEqual([1052, 662]);   // north of the September pad the Year Walk keeps its v2.7 line (the pad's level pins would pull it to 40)
    expect(yw.pts).toContainEqual([1037, 542]);   // then crosses the Hollow Rill on the Rillcut Footbridge
    expect(yw.levels.some((l: any) => l.xy[0] === 1062 && l.xy[1] === 712 && l.h === 55.2)).toBe(true);
    expect(CONFLUENCE_LEVEL_EU).toBe(6);
    for (const [k, xy] of Object.entries(V3_PLACES)) expect(insideV3Reach(xy[0], xy[1]), k).toBe(true);
  });
});
