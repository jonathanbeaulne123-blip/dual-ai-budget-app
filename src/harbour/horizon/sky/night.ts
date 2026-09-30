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
/**
 * Wave 6 (P28 regression: the R2-110 sky dome drew the night zenith, #121a2e = L* 9.5, over most of a 390 × 844 frame — the
 * histogram mode fell from 34 to 10 on pages A, C and L): the dome's zenith never falls below the night floor's sky,
 * #2b3757 (L* 23, just over the fog/horizon colour's 20), so a portrait frame's sky sits inside 12–35 and rails and lips
 * (face chalk Y 0.23) keep ≥ 3:1 against it. Dusk skies lighter than the floor are untouched.
 */
export const NIGHT_DOME = { zenithFloor: '#2b3757' } as const;
export function nightDome<T extends { zenith: string }>(colors: T, nightness: number): T {
  const floor = blendColor(colors.zenith, NIGHT_DOME.zenithFloor, Math.min(1, Math.max(0, nightness)));
  return luminance(floor) > luminance(colors.zenith) ? { ...colors, zenith: floor } : colors;
}
/** Relative luminance (sRGB → linear, Rec. 709) of a #rrggbb colour. */
export function luminance(hex: string): number {
  const c = [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
/** Light cards and the moon-chalk lip line (STYLE §1.3.3; darkness floor: lips at ≥ 3:1 "carried by a chalk lip line"). */
export const NIGHT_LIGHT_CARDS = { full: 160, lite: 48, poolRadius: 2.4, beadRadius: 0.32, pool: '#f6c779', bead: '#fff0c8', poolOpacity: 0.78, chalk: '#c9d0de', /** Per-role night colour of retaining/kerb/parapet FACES (dimmer than the lip line). */ faceChalk: '#7d8597', door: '#ffc978', doorSize: [1.6, 2.5] as const, /** Wave 6: a threshold marker's top at night — dark ink against its lamp's warm pool (≥ 3:1). */ markerInk: '#262a36' } as const;
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
/**
 * D-A5 (MANIFEST v2.0 `lights`, LIGHT §2): an emissive face card (the dam's glass face) is ON from golden hour (sunset − 60 min)
 * until sunrise, OFF by day, and never under the calm view (its frozen 15:30 has no night). No dynamic light: an unlit quad.
 * `localMinutes`, `sunrise` and `sunset` are minutes after the civil day's midnight (sun/solar.ts SolarPosition).
 */
export const FACE_CARD_LIGHT = { goldenHourMinutes: 60, colour: '#f2c47e', opacity: 0.92 } as const;
export function faceCardOn(sun: { localMinutes: number; sunrise: number; sunset: number }, calm = false): boolean {
  if (calm) return false;
  return sun.localMinutes >= sun.sunset - FACE_CARD_LIGHT.goldenHourMinutes || sun.localMinutes < sun.sunrise;
}

/**
 * Road lamps on the world clock (ROAD.md §6, D-R3; LIGHT §3; STYLE §1.11 lantern post). One ramp, read from the sun's
 * elevation only (so dawn and dusk are the same curve and a reload mid-evening lands on the same value):
 * `k` = smoothstep from +2° (off) to −6° (civil dusk, full). Tunnel lamps ignore it (STYLE tunnel portal: interior lamps
 * always on). A line switches on (and off at dawn) in sequence along its `order`, `sequenceMs` apart, the whole line
 * settling within `settleMs`; a lamp warms over `warmMs`. The point-light pool (D-R3, overriding STYLE §1.2 rule 1 for
 * road lamps only) is a FIXED number of shadowless lights that never leave the scene: intensity 0 by day, so dusk never
 * changes the light count and never recompiles a shader.
 */
export const ROAD_LIGHTS = {
  colour: '#ffd98e',
  /** Sun elevation (degrees) where the ramp starts (k = 0) and where it is full (k = 1). */
  rampOn: 2,
  rampFull: -6,
  sequenceMs: 1000,
  settleMs: 5000,
  warmMs: 300,
  /** How fast the displayed ramp follows the clock's (per second); the first reading is taken as-is (no blink on reload). */
  rampRate: 1,
  /** D-R3 pool: fixed count, candela, cut-off distance (eu), decay, cross-fade (s), and the distance it fades out over (eu). */
  pointLights: { full: 6, lite: 2 } as const,
  pointIntensity: 30,
  pointDistance: 26,
  pointDecay: 2,
  pointFadeS: 0.4,
  pointFade: [48, 84] as const,
  /** Glow core / halo radius (eu) and pool strength per lamp kind (STYLE §1.11: lantern post 0.35 / 1.2). */
  kinds: {
    roadLantern: { glow: 0.35, halo: 1.2, pool: 0.24 },
    bridgeLantern: { glow: 0.3, halo: 1.1, pool: 0.22 },
    tunnelLamp: { glow: 0.25, halo: 1.0, pool: 0.2 },
    bollard: { glow: 0.15, halo: 0.6, pool: 0.18 },
  } as const,
  /** Pool decals fade out by this distance (eu) on the full tier; the lite tier draws them only near (ROAD.md §8: glow cards only beyond 30 eu). */
  poolFade: { full: [150, 220] as const, lite: [22, 30] as const },
  /** Glow cards fade out as they approach the pick radius (fraction of it), so a lamp leaving the nearest set is already dark. */
  glowFadeFraction: 0.25,
  /** A pool decal sits this far above the station surface (plus polygon offset). */
  poolLift: 0.02,
} as const;
export type RoadLampKind = keyof typeof ROAD_LIGHTS.kinds;
/** The light-card cap (NIGHT_LIGHT_CARDS full 160 / lite 48) split so road lamps and door/threshold lamps each keep a share;
 * a share the other class does not need is lent to it, and the total never exceeds the cap. */
export const LIGHT_CARD_SHARES = { full: { road: 112, anchor: 48 }, lite: { road: 32, anchor: 16 } } as const;
/** The road-lamp ramp k ∈ [0, 1] from the sun's elevation (degrees): smoothstep +2° → −6°, the same at dawn and dusk. */
export function roadLampRamp(elevation: number): number {
  const t = Math.min(1, Math.max(0, (ROAD_LIGHTS.rampOn - elevation) / (ROAD_LIGHTS.rampOn - ROAD_LIGHTS.rampFull)));
  return t * t * (3 - 2 * t);
}
/** Delay (ms) of lamp `order` on a line of `count` lamps: 1 s apart, compressed so the line settles within `settleMs`. */
export function roadLampDelay(order: number, count: number): number {
  const step = count > 1 ? Math.min(ROAD_LIGHTS.sequenceMs, ROAD_LIGHTS.settleMs / (count - 1)) : 0;
  return Math.max(0, order) * step;
}
