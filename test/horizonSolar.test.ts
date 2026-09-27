import { describe, expect, it } from 'vitest';
import { solarPosition, solarReviewDate } from '../src/harbour/horizon/sun/solar';
import { skyGradient } from '../src/harbour/horizon/sky/gradient';
import { horizonFog } from '../src/harbour/horizon/sky/fog';

describe('Horizon real solar clock', () => {
  // Independent US Naval Observatory reference, queried 2026-09-25. Coordinates 44,-75.
  // https://aa.usno.navy.mil/api/rstt/oneday?date=2026-06-21&coords=44,-75&tz=-4
  // June: 05:17 / 20:46; December (tz=-5): 07:32 / 16:25. Tolerance ±2 min.
  it.each([
    ['2026-06-21T16:00:00Z', 317, 1246], ['2026-12-21T17:00:00Z', 452, 985],
  ])('matches the independent solstice sunrise and sunset %s', (date, rise, set) => {
    const sun = solarPosition(new Date(date), { timeZone: 'America/Toronto' });
    expect(Math.abs(sun.sunrise - rise)).toBeLessThan(2); expect(Math.abs(sun.sunset - set)).toBeLessThan(2);
    expect(sun.longitude).toBe(-75);
    expect(sun.civilDawn).toBeLessThan(sun.sunrise); expect(sun.civilDusk).toBeGreaterThan(sun.sunset);
  });
  it('uses the standard meridian and includes daylight saving, including half-hour zones', () => {
    const june = solarPosition(new Date('2026-06-21T16:00:00Z'), { timeZone: 'America/Toronto' });
    const winter = solarPosition(new Date('2026-12-21T17:00:00Z'), { timeZone: 'America/Toronto' });
    expect(june.solarNoon).toBeGreaterThan(770); expect(june.solarNoon).toBeLessThan(790);
    expect(winter.solarNoon).toBeGreaterThan(710); expect(winter.solarNoon).toBeLessThan(730);
    const nf = solarPosition(new Date('2026-06-21T16:00:00Z'), { timeZone: 'America/St_Johns' });
    expect(nf.standardOffsetMinutes).toBe(-210); expect(nf.longitude).toBe(-52.5);
  });
  it('points east in the morning, south at noon, and places the sun below the ground at 02:00', () => {
    const opts = { timeZone: 'America/Toronto' };
    expect(solarPosition(new Date('2026-06-21T13:00:00Z'), opts).direction[0]).toBeGreaterThan(0);
    expect(solarPosition(new Date('2026-06-21T17:02:00Z'), opts).direction[2]).toBeGreaterThan(0);
    expect(solarPosition(new Date('2026-06-21T06:00:00Z'), opts).elevation).toBeLessThan(-12);
  });
  it('reports the same civil sunrise before and after the spring clock change', () => {
    const before = solarPosition(new Date('2026-03-08T06:00:00Z'), { timeZone: 'America/Toronto' });
    const after = solarPosition(new Date('2026-03-08T12:00:00Z'), { timeZone: 'America/Toronto' });
    expect(before.offsetMinutes).toBe(-300); expect(after.offsetMinutes).toBe(-240);
    expect(before.sunrise).toBeCloseTo(after.sunrise, 3);
    expect(before.sunset).toBeCloseTo(after.sunset, 3);
    expect(before.solarNoon).toBeCloseTo(after.solarNoon, 3);
  });
  it('accepts valid dev overrides and ignores every URL override in production', () => {
    const now = new Date('2026-09-25T18:20:00Z'), opts = { timeZone: 'America/Toronto', dev: true };
    expect(solarReviewDate(now, '?date=2026-12-21&sun=02:00', opts).toISOString()).toBe('2026-12-21T07:00:00.000Z');
    expect(solarReviewDate(now, '?date=2026-12-21&sun=02:00', { ...opts, dev: false })).toEqual(now);
    expect(solarReviewDate(now, '?date=2026-02-31&sun=28:15', opts)).toEqual(new Date('2026-09-25T18:20:00Z'));
    expect(solarReviewDate(now, '', { ...opts, dev: false, calm: true }).toISOString()).toBe('2026-06-21T19:30:00.000Z');
  });
  it('holds readable night fill and the exact height-dependent fog distances', () => {
    expect(skyGradient(-25).ambient).toBeGreaterThanOrEqual(0.32);
    expect(skyGradient(-25).sunIntensity).toBe(0);
    expect(skyGradient(60).zenith).toBe('#8fbbe0');
    // Scale-1.0 lite pair 180 / 1230 (sky/fog.ts derivation), +0.9 / +1.35 per eu of eye height (was 110 / 520: 200 / 655).
    expect(horizonFog({ tier: 'lite', eyeAboveGround: 100, elevation: 30, heading: 0, sunAzimuth: 0 })).toMatchObject({ near: 270, far: 1365, horizonMaxOpacity: 0.7 });
  });
});

describe('D-A5 the dam glass face light card (MANIFEST v2.0 lights, views.A.lightRule)', () => {
  it('is on from golden hour (sunset - 60 min) to sunrise, off by day and always off under the calm view', async () => {
    const { faceCardOn, FACE_CARD_LIGHT } = await import('../src/harbour/horizon/sky/night');
    const sun = (localMinutes: number) => ({ localMinutes, sunrise: 330, sunset: 1260 });
    expect(FACE_CARD_LIGHT.goldenHourMinutes).toBe(60);
    expect(faceCardOn(sun(1199))).toBe(false); expect(faceCardOn(sun(1200))).toBe(true); expect(faceCardOn(sun(1439))).toBe(true);
    expect(faceCardOn(sun(0))).toBe(true); expect(faceCardOn(sun(329))).toBe(true); expect(faceCardOn(sun(330))).toBe(false); expect(faceCardOn(sun(930))).toBe(false);
    expect(faceCardOn(sun(1300), true)).toBe(false);
  });
  it('is one quad on the upper band of the dam wall\'s south face, 0.1 in front, from the manifest lights list', async () => {
    const { buildFaceCards } = await import('../src/harbour/horizon/world/build');
    const { HORIZON_MANIFEST } = await import('../src/harbour/horizon/world/manifest');
    expect((HORIZON_MANIFEST as unknown as { lights: { id: string }[] }).lights.map(l => l.id)).toEqual(['dam.glassFace']);
    // A 44 × 32 south face (x 1118–1162, y 20–52) battered back 1.5 over its height, as candidate 3 builds dam.wall.
    const positions = [1118, 20, 909, 1162, 20, 909, 1162, 52, 907.5, 1118, 52, 907.5], wall = { id: 'dam.wall@lakeside', sourceId: 'dam.wall', kind: 'wall', positions, indices: [0, 1, 2, 0, 2, 3], surface: 'stone', districtId: 'lakeside', bedIds: [], walkable: false, role: 'wall' as const };
    const [card] = buildFaceCards([wall]);
    expect(card!.id).toBe('dam.glassFace'); expect(card!.on).toBe('goldenHourToDawn');
    const [bl, br, tr, tl] = card!.corners;
    expect(bl[0]).toBeCloseTo(1119, 6); expect(br[0]).toBeCloseTo(1161, 6); expect(bl[1]).toBeCloseTo(20 + 32 * .55, 6); expect(tl[1]).toBeCloseTo(51, 6);
    // In front of the face by 0.1 at both heights (z = 909 − 1.5·(y − 20)/32).
    expect(bl[2] - (909 - 1.5 * (bl[1] - 20) / 32)).toBeCloseTo(.1, 6); expect(tr[2] - (909 - 1.5 * (tr[1] - 20) / 32)).toBeCloseTo(.1, 6);
    expect(card!.normal[2]).toBeGreaterThan(.99);
  });
});
