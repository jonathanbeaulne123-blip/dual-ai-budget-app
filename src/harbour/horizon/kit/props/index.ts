/**
 * The Water's Way prop kit (neighbourhoods/types.ts `PropKind`, `PropRecord`): every prop drawn in the card kit in three
 * dressings, its collision (only where `collide` and physically blocking, matching what is drawn) and the lite rule.
 *
 *   drawProp(b, rec, theme, ground, tier)   draw one record into a CardBuilder (world space)
 *   propCollision(rec, ground)              its collision parts ([] unless `rec.collide`)
 *   propDraws(rec, tier) / propIsEssential   lite draws an essential kind, or any prop that collides or carries a fixture (one rule, here)
 *
 * Frame and scale: kit.ts. Linear kinds (railOpen, fence, drystoneWall, sheepFank, laundryLine, festoon) follow
 * `rec.line`; rails, festoons and laundry sit on the line's own heights (decks, wall fixings), fences and walls on the
 * ground under it. `scale` exceptions: ringBench radius = 6.2 × scale (heights fixed), swing rope top = scale eu above
 * `at` (default 2.6), geoglyph wingspan = 63 × scale. `variant`: viewer pictograms, boat and buoy colours, rail
 * style (railOpen 1 = steel pickets), stacked crates, bell kind (1 = ship's bell), parasols, month (monthStone 0–11).
 */
import type { CardBuilder } from '../../../art/cardScene.ts';
import type { DressingTheme, PropKind, PropRecord } from '../../neighbourhoods/types.ts';
import type { CollisionPart } from './collision.ts';
import { boxPart, ctxOf, lineParts, type Ctx, type Ground } from './kit.ts';
import { bench, drystoneWall, fence, mapBoard, panel, picnicTable, railOpen, ringBench, sheepFank, viewer } from './lookout.ts';
import { beacon, bell, bollard, festoon, flag, lantern, lanternLow, windsock } from './lights.ts';
import {
  birdFeeder, bikeRack, bocceCourt, bollardQuay, bookCart, buoy, cafeTable, cairn, crate, duckBox, fireRing, fountain, geoglyph, gozzo, hayBale, hive, kayak, kite,
  laundryLine, lifeRing, monthStone, net, ospreyPole, planter, readingTable, rodHolder, rowboat, skateBowl, snag, stall, sundial, swing, towel, umbrella, volleyNet,
} from './things.ts';

export type { CollisionPart } from './collision.ts';
export { propPalette } from './kit.ts';
export { VIEWER_PARTS } from './lookout.ts';

const DRAW: Record<PropKind, (c: Ctx) => void> = {
  viewer: c => viewer(c, false), viewerSeated: c => viewer(c, true), bench, ringBench, picnicTable, panel, lantern, lanternLow, bollard,
  railOpen, fence, drystoneWall: c => drystoneWall(c), hive, hayBale, kayak, rowboat, gozzo, umbrella, towel,
  laundryLine, stall, cafeTable, fountain, planter, bikeRack, mapBoard, sundial, monthStone,
  kite, swing, windsock, beacon, fireRing, volleyNet, lifeRing, rodHolder, duckBox,
  ospreyPole, snag, buoy, bollardQuay, net, crate, cairn, sheepFank, festoon, flag,
  bocceCourt, skateBowl, geoglyph, readingTable, bookCart, birdFeeder, bell,
};
export const PROP_KINDS = Object.keys(DRAW) as PropKind[];

/** Draw one prop record (world space) into a card builder. Non-finite records draw nothing. */
export function drawProp(b: CardBuilder, rec: PropRecord, theme: DressingTheme, ground: Ground, tier: 'full' | 'lite'): void {
  if (![rec.at[0], rec.at[1], rec.at[2], rec.yaw, rec.scale ?? 1].every(Number.isFinite) || (rec.scale ?? 1) <= 0) return;
  if (!propDraws(rec, tier)) return;
  DRAW[rec.kind](ctxOf(b, rec, theme, ground, tier));
}

/**
 * Lite keeps the props that carry the island's sense or its play: what you sit on, look through, walk beside or are stopped
 * by (seats, viewers, rails, walls, lanterns and bollards), the story's markers (the osprey pole, the beacon, the bell,
 * the windsock, the geoglyph, the month stones, the swing), route markers (buoys, cairns) and pastime fixtures (bocce, the
 * volleyball net, the skate bowl's rim, the fire rings, reading tables). Set dressing (boats, umbrellas, laundry, crates,
 * hives …) goes whole.
 */
const ESSENTIAL: ReadonlySet<PropKind> = new Set<PropKind>([
  'viewer', 'viewerSeated', 'bench', 'ringBench', 'picnicTable', 'lantern', 'lanternLow', 'bollard', 'railOpen', 'fence', 'drystoneWall', 'sheepFank',
  'fountain', 'stall', 'monthStone', 'swing', 'windsock', 'beacon', 'fireRing', 'volleyNet', 'ospreyPole', 'buoy', 'cairn', 'festoon',
  'bocceCourt', 'skateBowl', 'geoglyph', 'readingTable', 'bell', 'bollardQuay', 'lifeRing',
]);
export function propIsEssential(kind: PropKind): boolean { return ESSENTIAL.has(kind); }
/**
 * The one lite rule (lite drops, never substitutes; collision is what is drawn): lite draws an essential kind, and ANY prop
 * that collides or carries a pastime fixture — a collider is never invisible. Full draws everything.
 */
export function propDraws(rec: Pick<PropRecord, 'kind' | 'collide' | 'fixture'>, tier: 'full' | 'lite'): boolean {
  return tier === 'full' || ESSENTIAL.has(rec.kind) || !!rec.collide || !!rec.fixture;
}

/** Collision parts for one record: none unless `rec.collide`, and only for kinds that physically block (what is drawn). */
export function propCollision(rec: PropRecord, ground: Ground): CollisionPart[] {
  if (!rec.collide || ![rec.at[0], rec.at[1], rec.at[2], rec.yaw].every(Number.isFinite)) return [];
  const B = (lx: number, lz: number, w: number, d: number, y0: number, y1: number, role: CollisionPart['role'], surface: string, turn = 0) => boxPart(rec, lx, lz, w, d, y0, y1, role, surface, false, turn);
  const onLine = (h: number, w: number, role: CollisionPart['role'], surface: string, floor: 'line' | 'ground') => {
    const pts = (rec.line && rec.line.length >= 2 ? rec.line : null)?.map(p => [p[0], p[1], p[2]] as [number, number, number]);
    const line = pts ?? (() => { const c = Math.cos(rec.yaw), s = Math.sin(rec.yaw), k = 2 * (rec.scale ?? 1); return [[rec.at[0] - c * k, rec.at[1], rec.at[2] + s * k], [rec.at[0] + c * k, rec.at[1], rec.at[2] - s * k]] as [number, number, number][]; })();
    return lineParts(line, w, h, role, surface, floor === 'line' ? p => p[1] : p => ground(p[0], p[2]));
  };
  switch (rec.kind) {
    case 'viewer': return [B(0, 0, 0.44, 0.44, 0, 1.2, 'support', 'metal')];
    case 'viewerSeated': return [B(0, 0, 0.44, 0.44, 0, 0.9, 'support', 'metal')];
    case 'bench': return [B(0, -0.02, 1.84, 0.56, 0, 0.86, 'support', 'timber')];
    case 'ringBench': {
      const R = 6.2 * (rec.scale ?? 1), n = 16, chord = 2 * R * Math.sin(Math.PI / n);
      return Array.from({ length: n }, (_, k) => { const a = (k / n) * Math.PI * 2; return { kind: 'box', centre: [rec.at[0] + Math.sin(a) * (R - 0.06), rec.at[2] + Math.cos(a) * (R - 0.06)], size: [chord, 0.62], yaw: a, bottom: rec.at[1], top: rec.at[1] + 0.85, role: 'support', walkable: false, surface: 'timber' } as CollisionPart; });
    }
    case 'picnicTable': return [B(0, 0, 1.9, 1.78, 0, 0.78, 'support', 'timber')];
    case 'panel': return [B(0, 0, 0.84, 0.3, 0, 1.15, 'support', 'timber')];
    case 'mapBoard': return [B(0, 0, 1.84, 0.16, 0, 2.15, 'wall', 'timber')];
    case 'lantern': return [B(0, 0, 0.32, 0.32, 0, 2.6, 'support', 'metal')];
    case 'lanternLow': return [B(0, 0, 0.2, 0.2, 0, 1.15, 'support', 'metal')];
    case 'bollard': return [B(0, 0, 0.34, 0.34, 0, 0.8, 'support', 'metal')];
    case 'bollardQuay': return [B(0, 0, 0.54, 0.54, 0, 0.62, 'support', 'metal')];
    case 'railOpen': return onLine(1.05, 0.12, 'rail', 'timber', 'line');
    case 'fence': return onLine(1.15, 0.12, 'rail', 'timber', 'ground');
    case 'drystoneWall': return onLine(1.1 + 0.16, 0.7, 'wall', 'stone', 'ground');
    case 'sheepFank': return onLine(1.0 + 0.16, 0.7, 'wall', 'stone', 'ground');
    case 'fountain': { const R = 2.3 * (rec.scale ?? 1), corners: [number, number, number][] = Array.from({ length: 8 }, (_, k) => { const a = (k / 8) * Math.PI * 2; return [rec.at[0] + Math.sin(a) * R, rec.at[1] + 0.7 * (rec.scale ?? 1), rec.at[2] + Math.cos(a) * R]; });
      return [{ kind: 'prism', corners, bottom: rec.at[1], role: 'wall', walkable: false, surface: 'stone' }, B(0, 0, 0.6, 0.6, 0.7, 2.3, 'support', 'stone')]; }
    case 'planter': return [B(0, 0, 1.4, 1.4, 0, 0.55, 'support', 'stone')];
    case 'stall': return [B(0, 0.6, 2.9, 0.8, 0, 0.98, 'support', 'timber'), ...[[-1.6, -1.2], [1.6, -1.2], [-1.6, 1.2], [1.6, 1.2]].map(([x, z]) => B(x!, z!, 0.1, 0.1, 0, 2.3, 'support', 'timber'))];
    case 'cafeTable': return [B(0, 0, 0.8, 0.8, 0, 0.75, 'support', 'metal')];
    case 'bikeRack': return [B(0, 0, 2.6, 0.66, 0, 0.78, 'rail', 'metal')];
    case 'sundial': return [B(0, 0, 0.64, 0.64, 0, 1.0, 'support', 'stone')];
    case 'monthStone': return [B(0, 0, 0.66, 0.44, 0, 0.65, 'support', 'stone')];
    case 'hive': return [B(0, 0, 0.58, 0.52, 0, 0.83, 'support', 'timber')];
    case 'hayBale': return [B(0, 0, 1.2, 1.5, 0, 1.5, 'support', 'straw')];
    case 'crate': return [B(0, 0, 0.6, 0.6, 0, (rec.variant ?? 0) === 1 ? 1.18 : 0.58, 'support', 'timber')];
    case 'cairn': return [B(0, 0, 1.4, 1.4, 0, 1.6, 'rock', 'stone')];
    case 'windsock': return [B(0, 0, 0.36, 0.36, 0, 6.2, 'support', 'metal')];
    case 'beacon': return [B(0, 0, 0.64, 0.64, 0, 1.5, 'support', 'metal')];
    case 'flag': return [B(0, 0, 0.14, 0.14, 0, 6, 'support', 'metal')];
    case 'bell': return (rec.variant ?? 0) === 1 ? [B(0, 0, 0.14, 0.14, 0, 1.9, 'support', 'timber')] : [B(-0.6, 0, 0.16, 0.16, 0, 2.4, 'support', 'timber'), B(0.6, 0, 0.16, 0.16, 0, 2.4, 'support', 'timber')];
    case 'volleyNet': return [B(-5, 0, 0.1, 0.1, 0, 2.6, 'support', 'metal'), B(5, 0, 0.1, 0.1, 0, 2.6, 'support', 'metal')];
    case 'lifeRing': return [B(0, 0, 0.84, 0.3, 0, 1.56, 'support', 'timber')];
    case 'duckBox': return [B(0, 0, 0.1, 0.1, 0, 1.9, 'support', 'timber')];
    case 'birdFeeder': return [B(0, 0, 0.1, 0.1, 0, 1.6, 'support', 'timber')];
    case 'ospreyPole': return [B(0, 0, 0.36, 0.36, -0.3, 11.5, 'support', 'timber')];
    case 'snag': return [B(0, 0, 0.7, 0.7, 0, 7.5, 'support', 'timber')];
    case 'readingTable': return [B(0, 0, 1.56, 1.56, 0, 0.76, 'support', 'timber')];
    case 'bookCart': return [B(0, 0, 1.12, 0.6, 0, 1.05, 'support', 'timber')];
    case 'kayak': return [B(0, 0, 0.62, 3.6, 0, 0.35, 'support', 'timber')];
    case 'rowboat': return [B(0, 0, 1.35, 3.8, 0, 0.62, 'support', 'timber')];
    case 'gozzo': return [B(0, 0, 1.75, 5.6, 0, 0.8, 'support', 'timber')];
    case 'laundryLine': {
      const l = rec.line; if (!l || l.length < 2) return [];
      const ends = [l[0]!, l[l.length - 1]!]; if (ends[0]![1] > ground(ends[0]![0], ends[0]![2]) + 1.5) return [];
      return ends.map(p => ({ kind: 'box', centre: [p[0], p[2]], size: [0.12, 0.12], yaw: rec.yaw, bottom: p[1], top: p[1] + 2.3, role: 'support', walkable: false, surface: 'timber' }) as CollisionPart);
    }
    // Not physically blocking (flat, overhead, floating or step-over): no solid even when asked.
    case 'towel': case 'umbrella': case 'kite': case 'swing': case 'fireRing': case 'rodHolder': case 'buoy': case 'net': case 'festoon':
    case 'bocceCourt': case 'skateBowl': case 'geoglyph': return [];
  }
}
