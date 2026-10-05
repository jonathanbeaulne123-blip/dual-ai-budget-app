// STUB — replaced by E2/E3 at integration
/**
 * Temporary stand-in for the prop kit (E3, `kit/props/**`) so the dressing engine (E1) compiles and its tests run.
 * Integration takes E3's real file. Only the signatures are load-bearing: a small post or box per prop, and one box
 * collider for a prop that collides.
 */
import type {CardBuilder} from '../../../art/cardScene.ts';
import {rgb} from '../../../art/cardScene.ts';
import type {DressingTheme, PropRecord} from '../../neighbourhoods/types.ts';
import type {CollisionPart} from '../buildings/index.ts';

const WOOD: Record<DressingTheme, string> = { classic: '#8a6a4a', taylor: '#a07a55', newfoundland: '#6d6458' };

export function drawProp(b: CardBuilder, rec: PropRecord, theme: DressingTheme, ground: (x: number, z: number) => number, tier: 'full' | 'lite'): void {
  const s = rec.scale ?? 1, y = ground(rec.at[0], rec.at[2]);
  if (rec.line && rec.line.length > 1) { for (let i = 1; i < rec.line.length; i++) { const a = rec.line[i - 1]!, c = rec.line[i]!; b.beam([a[0], a[1] + 0.9 * s, a[2]], [c[0], c[1] + 0.9 * s, c[2]], 0.08, 0.08, rgb(WOOD[theme])); } return; }
  b.box(rec.at[0], rec.at[2], rec.yaw, 0.25 * s, 0.25 * s, y - 0.05, y + 0.9 * s, rgb(WOOD[theme]));
  void tier;
}

export function propCollision(rec: PropRecord, ground: (x: number, z: number) => number): CollisionPart[] {
  if (!rec.collide) return [];
  const s = rec.scale ?? 1, y = ground(rec.at[0], rec.at[2]);
  return [{ kind: 'box', centre: [rec.at[0], rec.at[2]], size: [0.5 * s, 0.5 * s], yaw: rec.yaw, bottom: y - 0.05, top: y + 0.9 * s, role: 'wall', walkable: false, surface: 'wood' }];
}
