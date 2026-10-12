/**
 * The Reach and the Greenway — STORY place 3, late morning (docs/horizon/STORY.md; reach prototype SPEC; D-WW60…69 land,
 * D-WW120… dressing). The conservation marsh round the boardwalk (district `reach`, the Notch's lookouts in `notch`) and the
 * Greenway's marsh, the Bight crossing and the bluff end (districts `landing`, `green`, `bight`, `hollow` along the line).
 *
 * One pure, deterministic function of the bake-time world (`buildReach(ctx)`): the clearings and sightlines first (site.ts),
 * then what stands on the land (reach/fixtures.ts: the six lookouts' kit, the hides, the osprey pole, the Gate, the Greenway's
 * places, the rafts, the island lantern), then the planting by zonation (reach/marsh.ts) and the life. Partial records of the
 * shared `landing` module (neighbourhoods/landing/index.ts composes it with Long Sands).
 */
import type { DressingContext, LifeSpawn, NeighbourhoodDressing, PlantRecord } from '../types.ts';
import { greenwayGaps } from '../../land/structures/greenway.ts';
import { buildFixtures } from './reach/fixtures.ts';
import { plantMarsh, MAZE } from './reach/marsh.ts';
import { createSite, HERON, OSPREY, type Impl, type Site } from './reach/site.ts';

/**
 * Notch Bluff (D-WW62) stands on the Notch's east lip inside the Green's protected circle (r 166 about [1040, 1065]): its
 * Lookout kit (the viewers and the panel, 1.3–1.5 eu) is allowed there by name (the circle guards the Green's meadow; the
 * pad is the land's, 150 m from the oak). Nothing else of the Reach stands in a protected area.
 */
export const NOTCH_IN_GREEN = ['reach.notchBluff.viewer', 'reach.notchBluff.viewerSeated', 'reach.notchBluff.panel'] as const;

/** The Reach's tree cover over its unbuilt dry ground (%): an open conservation marsh — reedbeds and water, willow and
 * tamarack groves on the hummocks only (reach SPEC §3: ten groves ≥ 40 m apart). The test holds it within ±5 points. */
export const REACH_TREE_COVER = 5;

export interface ReachBuild { dressing: NeighbourhoodDressing; stats: Record<string, number> }

/** The Reach's life (STYLE §1.9; reach SPEC §3, §5): ≤ 24 animated per district, the essentials first (lite keeps 10). */
function reachLife(site: Site, pools: ReturnType<Site['edge']['bodies']>): LifeSpawn[] {
  const { ctx, L } = site, lvl = (x: number, z: number) => ctx.waterLevelAt(x, z) ?? ctx.heightAt(x, z), g = (x: number, z: number) => ctx.heightAt(x, z);
  const at = (x: number, y: number, z: number): [number, number, number] => [Math.round(x * 100) / 100, Math.round(y * 100) / 100, Math.round(z * 100) / 100];
  const life: LifeSpawn[] = [
    // the Reach (district reach): the heron near page I, the osprey on its nest, ducks on the channels, red-winged
    // blackbirds on the cattails by the boardwalk, painted turtles at the west channel, dragonflies (Jun–Aug).
    { kind: 'heron', at: at(HERON[0], lvl(...HERON), HERON[1]), radius: 1.5, count: 1, months: [4, 5, 6, 7, 8, 9, 10] },
    { kind: 'osprey', at: at(OSPREY[0], g(...OSPREY) + 12.1, OSPREY[1]), radius: 1, count: 1, months: [4, 5, 6, 7, 8, 9] },
    { kind: 'duck', at: at(1243, lvl(1243, 1269), 1269), radius: 3, count: 2 },
    { kind: 'duck', at: at(1239, lvl(1239, 1287), 1287), radius: 3, count: 2 },
    { kind: 'duck', at: at(1319, lvl(1319, 1287), 1287), radius: 3, count: 2 },
    { kind: 'duck', at: at(1333, lvl(1333, 1300), 1300), radius: 2, count: 1 },
    { kind: 'blackbird', at: at(1251, g(1251, 1232) + 2.3, 1232), radius: 12, count: 4, months: [4, 5, 6, 7, 8] },
    { kind: 'turtle', at: at(1236, lvl(1236, 1292), 1292), radius: 2, count: 2, months: [5, 6, 7, 8, 9] },
    { kind: 'dragonfly', at: at(1256, g(1256, 1240) + 1.2, 1240), radius: 18, count: 4, months: [6, 7, 8], hours: [10, 18] },
    // Fireflies over the wet meadow west of the boardwalk on summer nights (the prototype's night specks; never lights).
    { kind: 'firefly', at: at(1222, g(1222, 1250) + 1.0, 1250), radius: 22, count: 4, months: [6, 7, 8], hours: [21, 24] },
  ];
  // The Greenway (reach SPEC §5): the egret in the under-deck pool, the hide pool's heron, ducks and turtles, blackbirds on the
  // cattails by the deck, monarchs over the Reed Maze's milkweed. Split by district (each stays well under the cap).
  const near = (s: number, r = 30) => { const q = L.at(s).p; return pools.filter(p => p.cells < 600 && Math.hypot(p.c[0] - q[0], p.c[1] - q[2]) < r).sort((a, b) => b.cells - a.cells)[0]; };
  const under = near(362, 14), hide = (() => { const q = L.at(400).W(-19); return pools.filter(p => p.cells < 600 && Math.hypot(p.c[0] - q[0], p.c[1] - q[2]) < 14).sort((a, b) => b.cells - a.cells)[0]; })();
  const dip = pools.find(p => Math.hypot(p.c[0] - 1066, p.c[1] - 1329) < 4);
  if (under) life.push({ kind: 'egret', at: at(under.c[0] + under.r * 0.5, under.level, under.c[1] + under.r * 0.2), radius: 2, count: 1, months: [5, 6, 7, 8, 9] });
  if (hide) life.push({ kind: 'heron', at: at(hide.c[0] + 1.5, hide.level, hide.c[1] - 2), radius: 1.5, count: 1, months: [4, 5, 6, 7, 8, 9, 10] }, { kind: 'duck', at: at(hide.c[0] - hide.r * 0.35, hide.level, hide.c[1] + hide.r * 0.3), radius: 2.5, count: 2 }, { kind: 'turtle', at: at(hide.c[0] - hide.r * 0.35, hide.level, hide.c[1] + hide.r * 0.25), radius: 1.5, count: 2, months: [5, 6, 7, 8, 9] });
  if (dip) life.push({ kind: 'duck', at: at(dip.c[0] + 1.5, dip.level, dip.c[1]), radius: 2, count: 2 });
  for (const [s, n] of [[186, 2], [459, 2], [990, 1]] as const) { const q = L.at(s).W((s % 2 ? 1 : -1) * 5.2); life.push({ kind: 'blackbird', at: at(q[0], g(q[0], q[2]) + 2.4, q[2]), radius: 10, count: n, months: [4, 5, 6, 7, 8] }); }
  life.push({ kind: 'monarch', at: at(MAZE.c[0], g(...MAZE.c) + 1.4, MAZE.c[1]), radius: 16, count: 2, months: [7, 8, 9], hours: [9, 18] });
  return life;
}

export function buildReachDetailed(ctx: DressingContext): ReachBuild {
  const site = createSite(ctx as Impl), pools = site.edge.bodies();
  const fx = buildFixtures(site, pools), marsh = plantMarsh(site);
  // Planting keeps clear of what stands on the land: 0.8 eu round every prop and the footprint (+ 0.5) of every building.
  const occupied = [...fx.props.filter(p => p.kind !== 'raft' && p.kind !== 'duckBox').map(p => ({ x: p.at[0], z: p.at[2], r: p.kind === 'ospreyPole' ? 9 : p.kind === 'snag' ? 1.4 : p.kind === 'lodge' ? 1.6 * (p.scale ?? 1) : 0.8 })),
    ...fx.buildings.map(b => ({ x: b.at[0], z: b.at[2], r: Math.hypot(b.size.w, b.size.d) / 2 + 0.5 }))];
  const plants: PlantRecord[] = marsh.plants.filter(p => !occupied.some(o => Math.hypot(p.at[0] - o.x, p.at[2] - o.z) < o.r + (p.species === 'flowerBed' ? 2 * p.scale : 0)));
  void greenwayGaps;
  return {
    dressing: { id: 'landing', buildings: fx.buildings, plants, props: fx.props, ground: marsh.ground, pools: [], life: reachLife(site, pools), lights: fx.lights, landmarks: fx.landmarks, lookouts: fx.lookouts, allowInProtected: [...NOTCH_IN_GREEN] },
    stats: { ...marsh.stats, ...fx.stats, plants: plants.length, droppedByFixtures: marsh.plants.length - plants.length, pools: pools.length },
  };
}

/** The Reach and the Greenway's records (partial: the `landing` module adds Long Sands). */
export function buildReach(ctx: DressingContext): NeighbourhoodDressing { return buildReachDetailed(ctx).dressing; }
