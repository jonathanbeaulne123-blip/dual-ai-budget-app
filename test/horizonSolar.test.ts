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
    expect(horizonFog({ tier: 'lite', eyeAboveGround: 100, elevation: 30, heading: 0, sunAzimuth: 0 })).toMatchObject({ near: 200, far: 655, horizonMaxOpacity: 0.7 });
  });
});
