import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { appReducedMotion, horizonMotion, HORIZON_DISTRICT_FADE_MS } from '../src/harbour/horizon/sun/comfort';
import { solarPosition, solarReviewDate } from '../src/harbour/horizon/sun/solar';
import { nightLight } from '../src/harbour/horizon/sky/night';
import { skyGradient } from '../src/harbour/horizon/sky/gradient';

const zone = 'America/Toronto', night = new Date('2026-06-21T06:00:00Z'); // 02:00 in Toronto
const localClock = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
afterEach(() => { delete (globalThis as { document?: unknown }).document; });

describe('Horizon comfort (R1-16, R1-104)', () => {
  it('calm view freezes the sun at 15:30 on the solstice: no night, no sun step, nothing moving on its own', () => {
    const motion = horizonMotion({ calm: true, reducedMotion: false });
    expect(motion.sunFollowsClock).toBe(false); expect(motion.ambientMotion).toBe(false);
    // Even a dev review asking for 02:00 gets the frozen 15:30 while calm is on.
    const frozen = solarReviewDate(night, '?date=2026-12-21&sun=02:00', { dev: true, timeZone: zone, calm: true });
    expect(localClock(frozen)).toBe('15:30');
    const sun = solarPosition(frozen, { timeZone: zone });
    expect(sun.elevation).toBeGreaterThan(30);
    expect(nightLight(sun.elevation, skyGradient(sun.elevation)).lightCards).toBe(false);
    // Without calm the same request is night.
    const live = solarPosition(solarReviewDate(night, '?date=2026-06-21&sun=02:00', { dev: true, timeZone: zone }), { timeZone: zone });
    expect(live.elevation).toBeLessThan(0);
  });
  it('reduced motion is a cut: no Walk↔Look tween, no district fade (the 300 ms tweens are gone)', () => {
    const reduced = horizonMotion({ calm: false, reducedMotion: true }), full = horizonMotion({ calm: false, reducedMotion: false });
    expect(reduced.transitionMs).toBe(0); expect(reduced.districtFadeMs).toBe(0); expect(reduced.sunFollowsClock).toBe(false);
    expect(full.transitionMs).toBe(1100); expect(full.districtFadeMs).toBe(HORIZON_DISTRICT_FADE_MS); expect(HORIZON_DISTRICT_FADE_MS).toBe(800);
    const runtime = readFileSync('src/harbour/horizon/runtime/index.ts', 'utf8');
    expect(runtime).not.toMatch(/reducedMotion\?300/); expect(runtime).toMatch(/duration:relocated\?0:motion\.transitionMs/);   // R3-130: a walk-out that moves the body fades (fadeCut), never tweens expect(runtime).toMatch(/motion\.districtFadeMs/);
  });
  it('reads the app setting html[data-motion="reduced"] as the Mountain runtime does', () => {
    (globalThis as { document?: unknown }).document = { documentElement: { dataset: { motion: 'reduced' } } };
    expect(appReducedMotion()).toBe(true);
    (globalThis as { document?: unknown }).document = { documentElement: { dataset: { motion: 'system' } } };
    expect(appReducedMotion()).toBe(false);
  });
  it('threads useComfort from the Horizon world into the stage and the runtime', () => {
    const world = readFileSync('src/harbour/horizon/HorizonWorld.tsx', 'utf8'), stage = readFileSync('src/harbour/horizon/HorizonStage.tsx', 'utf8');
    expect(world).toMatch(/useComfort\(household\.environment\)/); expect(world).toMatch(/calm=\{comfort\.quiet\}/); expect(world).toMatch(/reducedMotion=\{comfort\.motion==='reduced'\}/);
    expect(stage).toMatch(/setComfort\(/); expect(stage).toMatch(/attributeFilter:\['data-motion','data-quiet'\]/);
  });
});
