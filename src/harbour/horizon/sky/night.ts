import { blendColor } from './gradient';

/**
 * The night floor (LIGHT §1 "Night is readable"; P28: at 02:00 on a 390 px capture the L* histogram
 * mode sits in 12–35 and doors, thresholds and edge lips read at ≥ 3:1). STYLE §1.2.1 forbids dynamic
 * point lights, so night is carried by three uniforms and one batch of light cards:
 *
 * - a moonlit hemisphere floor (cool sky, warm-grey ground) that never falls below `floor`;
 * - the paper moon, a directional light with the real phase's direction (`skyGradient().moonDirection`);
 * - light cards: an unlit warm pool on the ground and a bead at every door lamp and threshold lamp
 *   (`WorldDefinition.lights`), one instanced draw, the nearest `NIGHT_LIGHT_CARDS[tier]` only (LIGHT §6);
 *   the seven lit doorways (LIGHT §3); and the moon-chalk lip line on lips, kerbs, parapets and rails.
 *
 * `nightness` is 0 at sunset (elevation 0) and 1 from astronomical dusk (−12°).
 */
export const NIGHT_FLOOR = {
  sky: '#8190b4',
  ground: '#4b4a55',
  /** Hemisphere intensity at full night (before the day ambient takes over). */
  floor: 0.85,
  moon: '#b9c6e2',
  moonIntensity: 0.4,
} as const;
/** Light cards and the moon-chalk lip line (STYLE §1.3.3; darkness floor: lips at ≥ 3:1 "carried by a chalk lip line"). */
export const NIGHT_LIGHT_CARDS = { full: 160, lite: 48, poolRadius: 2.4, beadRadius: 0.32, pool: '#f6c779', bead: '#fff0c8', poolOpacity: 0.78, chalk: '#c9d0de', /** Per-role night colour of retaining/kerb/parapet FACES (dimmer than the lip line). */ faceChalk: '#7d8597', door: '#ffc978', doorSize: [1.6, 2.5] as const } as const;
export interface NightLight { nightness: number; hemisphereSky: string; hemisphereGround: string; hemisphereIntensity: number; moonIntensity: number; lightCards: boolean }
export function nightLight(elevation: number, day: { zenith: string; ambient: number }): NightLight {
  const nightness = Math.min(1, Math.max(0, -elevation / 12));
  const dayIntensity = day.ambient * 2.3;
  return {
    nightness,
    hemisphereSky: blendColor(day.zenith, NIGHT_FLOOR.sky, nightness),
    hemisphereGround: elevation < 0 ? blendColor('#b8a580', NIGHT_FLOOR.ground, nightness) : '#b8a580',
    hemisphereIntensity: Math.max(dayIntensity, NIGHT_FLOOR.floor * nightness + dayIntensity * (1 - nightness)),
    moonIntensity: elevation < 0 ? NIGHT_FLOOR.moonIntensity * Math.max(0.35, nightness) : 0,
    lightCards: elevation < 0,
  };
}
