import type { XYZ } from '../land/interfaces';
import { clamp, mix } from '../land/terrain/geometry';

export interface SkyGradient { zenith: string; horizonSun: string; horizonAway: string; sunColor: string; sunIntensity: number; ambient: number; moonDirection: XYZ }
const stops = [
  { e: -18, zenith: '#121a2e', sun: '#27304a', away: '#27304a', light: '#c8d6ed', intensity: 0 },
  { e: -9, zenith: '#26335a', sun: '#4f5478', away: '#3a4262', light: '#c8d6ed', intensity: 0 },
  { e: -3, zenith: '#4d6390', sun: '#e59a78', away: '#7d7fa3', light: '#ffd6ae', intensity: 0 },
  { e: 3, zenith: '#86a9cc', sun: '#f4bf86', away: '#c9ccd6', light: '#ffc58a', intensity: 0.7 },
  { e: 18, zenith: '#9cc3e0', sun: '#f0d9b0', away: '#dfe0d6', light: '#ffdcaa', intensity: 0.9 },
  { e: 30, zenith: '#8fbbe0', sun: '#e8dcc4', away: '#e8dcc4', light: '#ffe6be', intensity: 1 },
];
export function blendColor(a: string, b: string, t: number): string {
  const value = (hex: string, shift: number) => (Number.parseInt(hex.slice(1), 16) >> shift) & 255;
  return '#' + [16, 8, 0].map(shift => Math.round(mix(value(a, shift), value(b, shift), clamp(t))).toString(16).padStart(2, '0')).join('');
}
/** Classic's continuous table; minimum fill is a render input, never zero at night. */
export function skyGradient(elevation: number, moonAzimuth = 135): SkyGradient {
  const e = clamp(elevation, -18, 30);
  const hi = Math.max(1, stops.findIndex(s => s.e >= e)), a = stops[hi - 1]!, b = stops[hi]!;
  const t = clamp((e - a.e) / (b.e - a.e)), az = moonAzimuth * Math.PI / 180;
  return { zenith: blendColor(a.zenith, b.zenith, t), horizonSun: blendColor(a.sun, b.sun, t), horizonAway: blendColor(a.away, b.away, t), sunColor: blendColor(a.light, b.light, t), sunIntensity: elevation <= 0 ? 0 : mix(a.intensity, b.intensity, t), ambient: mix(0.32, 0.62, clamp((elevation + 6) / 20)), moonDirection: [Math.sin(az) * 0.82, 0.572, -Math.cos(az) * 0.82] };
}
