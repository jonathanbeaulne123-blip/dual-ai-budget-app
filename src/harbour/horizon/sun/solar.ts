import type { XYZ } from '../land/interfaces';

const rad = Math.PI / 180, deg = 180 / Math.PI, day = 86_400_000;
const modulo = (n: number, by: number) => ((n % by) + by) % by;
const clamp = (n: number) => Math.max(-1, Math.min(1, n));
export interface SolarOptions { timeZone?: string; latitude?: number }
export interface SolarPosition {
  azimuth: number; elevation: number; geometricElevation: number; direction: XYZ;
  sunrise: number; sunset: number; civilDawn: number; civilDusk: number; solarNoon: number;
  latitude: number; longitude: number; timeZone: string; offsetMinutes: number; standardOffsetMinutes: number;
  daylight: boolean; date: string; localMinutes: number;
}
const formatters = new Map<string, Intl.DateTimeFormat>();
function parts(date: Date, timeZone: string): Record<string, number> {
  let f = formatters.get(timeZone);
  if (!f) { f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }); formatters.set(timeZone, f); }
  return Object.fromEntries(f.formatToParts(date).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
}
export function timeZoneOffset(date: Date, timeZone: string): number {
  const p = parts(date, timeZone);
  return (Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!) - Math.floor(date.getTime() / 1000) * 1000) / 60_000;
}
export function standardTimeZoneOffset(year: number, timeZone: string): number {
  return Math.min(timeZoneOffset(new Date(Date.UTC(year, 0, 15, 12)), timeZone), timeZoneOffset(new Date(Date.UTC(year, 6, 15, 12)), timeZone));
}
/** NOAA/Meeus solar terms. Reference: https://gml.noaa.gov/grad/solcalc/calcdetails.html
 * Longitude is the device zone's STANDARD meridian, not geolocation. */
function terms(epoch: number): { declination: number; equation: number } {
  const t = (epoch / day + 2440587.5 - 2451545) / 36525;
  const meanLong = modulo(280.46646 + t * (36000.76983 + t * 0.0003032), 360) * rad;
  const meanAnomaly = (357.52911 + t * (35999.05029 - 0.0001537 * t)) * rad;
  const ecc = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const centre = Math.sin(meanAnomaly) * (1.914602 - t * (0.004817 + 0.000014 * t)) + Math.sin(2 * meanAnomaly) * (0.019993 - 0.000101 * t) + Math.sin(3 * meanAnomaly) * 0.000289;
  const omega = (125.04 - 1934.136 * t) * rad;
  const lambda = meanLong + (centre - 0.00569 - 0.00478 * Math.sin(omega)) * rad;
  const epsilon = (23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - 0.001813 * t))) / 60) / 60 + 0.00256 * Math.cos(omega)) * rad;
  const y = Math.tan(epsilon / 2) ** 2;
  const equation = 4 * deg * (y * Math.sin(2 * meanLong) - 2 * ecc * Math.sin(meanAnomaly) + 4 * ecc * y * Math.sin(meanAnomaly) * Math.cos(2 * meanLong) - 0.5 * y * y * Math.sin(4 * meanLong) - 1.25 * ecc * ecc * Math.sin(2 * meanAnomaly));
  return { declination: Math.asin(Math.sin(epsilon) * Math.sin(lambda)), equation };
}
function geometry(epoch: number, latitude: number, longitude: number): { elevation: number; azimuth: number } {
  const { declination: d, equation } = terms(epoch), lat = latitude * rad;
  const utcMinutes = modulo(epoch / 60_000, 1440), angle = (modulo(utcMinutes + equation + longitude * 4, 1440) / 4 - 180) * rad;
  const elevation = Math.asin(clamp(Math.sin(lat) * Math.sin(d) + Math.cos(lat) * Math.cos(d) * Math.cos(angle))) * deg;
  const azimuth = modulo(Math.atan2(Math.sin(angle), Math.cos(angle) * Math.sin(lat) - Math.tan(d) * Math.cos(lat)) * deg + 180, 360);
  return { elevation, azimuth };
}
function refraction(e: number): number {
  if (e > 85) return 0;
  const tangent = Math.tan(e * rad);
  if (e > 5) return (58.1 / tangent - 0.07 / tangent ** 3 + 0.000086 / tangent ** 5) / 3600;
  if (e > -0.575) return (1735 + e * (-518.2 + e * (103.4 + e * (-12.79 + e * 0.711)))) / 3600;
  return -20.774 / tangent / 3600;
}
function eventMinutes(midnight: number, noon: number, rising: boolean, elevation: number, lat: number, lon: number): number {
  let lo = noon + (rising ? -720 : 0), hi = noon + (rising ? 0 : 720);
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2, above = geometry(midnight + mid * 60_000, lat, lon).elevation > elevation;
    if (above === rising) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}
/** Angles are degrees; sunrise/sunset are minutes after this civil day's midnight.
 * Values may cross 0/1440 in unusual zones. North is −z in the returned unit vector. */
export function solarPosition(date: Date, options: SolarOptions = {}): SolarPosition {
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid solar date');
  const timeZone = options.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const latitude = options.latitude ?? 44;
  if (latitude !== 44 && Math.abs(latitude) > 66) throw new Error('Horizon solar clock supports non-polar latitudes');
  const p = parts(date, timeZone), offsetMinutes = timeZoneOffset(date, timeZone), standardOffsetMinutes = standardTimeZoneOffset(p.year!, timeZone);
  const longitude = standardOffsetMinutes / 4;
  const civilUtc = Date.UTC(p.year!, p.month! - 1, p.day!), midnight = civilUtc - offsetMinutes * 60_000;
  let solarNoon = 720 + offsetMinutes - 4 * longitude;
  for (let i = 0; i < 3; i++) solarNoon = 720 + offsetMinutes - 4 * longitude - terms(midnight + solarNoon * 60_000).equation;
  // On a clock-change day, an event can use a different UTC offset than "now".
  // Convert each event with the zone rules at that event, not at this invocation.
  const civilEvent = (minutes: number): number => minutes + timeZoneOffset(new Date(midnight + minutes * 60_000), timeZone) - offsetMinutes;
  const g = geometry(date.getTime(), latitude, longitude), elevation = g.elevation + refraction(g.elevation), e = elevation * rad, a = g.azimuth * rad;
  return {
    azimuth: g.azimuth, elevation, geometricElevation: g.elevation, direction: [Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)],
    sunrise: civilEvent(eventMinutes(midnight, solarNoon, true, -0.833, latitude, longitude)), sunset: civilEvent(eventMinutes(midnight, solarNoon, false, -0.833, latitude, longitude)),
    civilDawn: civilEvent(eventMinutes(midnight, solarNoon, true, -6, latitude, longitude)), civilDusk: civilEvent(eventMinutes(midnight, solarNoon, false, -6, latitude, longitude)), solarNoon: civilEvent(solarNoon),
    latitude, longitude, timeZone, offsetMinutes, standardOffsetMinutes, daylight: g.elevation >= -0.833,
    date: `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`, localMinutes: p.hour! * 60 + p.minute! + p.second! / 60,
  };
}
export interface SolarOverrideOptions extends SolarOptions { dev: boolean; reducedMotion?: boolean; calm?: boolean }
/** Dev harness inputs are inert in production; frozen accessibility light is universal. */
export function solarReviewDate(now: Date, search: string, options: SolarOverrideOptions): Date {
  const zone = options.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone, p = parts(now, zone);
  const params = new URLSearchParams(options.dev ? search : '');
  const frozen = options.reducedMotion || options.calm;
  const date = frozen ? `${p.year}-06-21` : params.get('date'), time = frozen ? '15:30' : params.get('sun');
  let year = p.year!, month = p.month!, dateDay = p.day!, hour = p.hour!, minute = p.minute!;
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split('-').map(Number), candidate = new Date(Date.UTC(y!, m! - 1, d!));
    if (candidate.getUTCFullYear() === y && candidate.getUTCMonth() + 1 === m && candidate.getUTCDate() === d) { year = y!; month = m!; dateDay = d!; }
  }
  if (time && /^([01]\d|2[0-3]):[0-5]\d$/.test(time)) [hour, minute] = time.split(':').map(Number) as [number, number];
  if (!frozen && (!options.dev || (!date && !time))) return new Date(now);
  const target = Date.UTC(year, month - 1, dateDay, hour, minute);
  let epoch = target - timeZoneOffset(now, zone) * 60_000;
  for (let i = 0; i < 3; i++) epoch = target - timeZoneOffset(new Date(epoch), zone) * 60_000;
  return new Date(epoch);
}
