import { blendColor, skyGradient } from './gradient';

export function horizonFog(options: { tier: 'full' | 'lite'; eyeAboveGround: number; elevation: number; sunAzimuth: number; heading: number; fogDay?: boolean }): { near: number; far: number; color: string; horizonMaxOpacity: number } {
  const { tier, fogDay, elevation, sunAzimuth, heading } = options;
  const h = Math.max(0, options.eyeAboveGround), colors = skyGradient(elevation);
  const towardSun = (1 + Math.cos((heading - sunAzimuth) * Math.PI / 180)) / 2;
  return { near: (fogDay ? 40 : tier === 'full' ? 150 : 110) + h * 0.9, far: (fogDay ? 220 : tier === 'full' ? 700 : 520) + h * 1.35, color: blendColor(colors.horizonAway, colors.horizonSun, towardSun), horizonMaxOpacity: 0.7 };
}
