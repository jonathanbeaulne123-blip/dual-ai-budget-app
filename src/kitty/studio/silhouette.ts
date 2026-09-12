/**
 * The thrown silhouette, shared by the 3D lathe and the flat SVG (2026-09-12).
 *
 * One curve, two renderers: the sculpture spins these points on the wheel and
 * the flat cat draws the same outline, so a kitty looks like itself whether or
 * not WebGL is available. Pure geometry — no three.js, no money.
 */
import type { KittySculptV1 } from "../../core/types.ts";

/** Body silhouettes: [radius, height] pairs from base to neck; handles scale bands. */
export const BODY_OUTLINES: Record<KittySculptV1["body"], Array<[number, number]>> = {
  round: [[0, 0], [0.42, 0.03], [0.73, 0.22], [0.85, 0.56], [0.83, 0.86], [0.73, 1.18], [0.56, 1.46], [0.36, 1.67], [0, 1.71]],
  pear: [[0, 0], [0.5, 0.03], [0.86, 0.2], [0.94, 0.5], [0.86, 0.82], [0.68, 1.12], [0.5, 1.4], [0.33, 1.62], [0, 1.66]],
  loaf: [[0, 0], [0.6, 0.03], [0.9, 0.16], [0.97, 0.42], [0.95, 0.7], [0.86, 0.98], [0.68, 1.2], [0.44, 1.36], [0, 1.4]],
  tall: [[0, 0], [0.4, 0.03], [0.62, 0.24], [0.7, 0.66], [0.7, 1.06], [0.64, 1.44], [0.52, 1.76], [0.34, 1.98], [0, 2.02]],
  bean: [[0, 0], [0.46, 0.03], [0.78, 0.2], [0.9, 0.5], [0.8, 0.8], [0.7, 1.08], [0.66, 1.36], [0.4, 1.62], [0, 1.66]],
};
/** The outline with the four thrown handles (belly, waist, shoulder, neck) blended across its height. */
export function kittyBodyPoints(sculpt: KittySculptV1): Array<[number, number]> {
  const outline = BODY_OUTLINES[sculpt.body];
  const top = outline[outline.length - 1]![1];
  const [belly, waist, shoulder, neck] = sculpt.profile;
  return outline.map(([r, y]) => {
    const t = y / top;
    // Blend the four handles across height: belly 0.25, waist 0.5, shoulder 0.75, neck 1.
    const handle = t < 0.25 ? 1 + (belly - 1) * (t / 0.25) : t < 0.5 ? belly + (waist - belly) * ((t - 0.25) / 0.25) : t < 0.75 ? waist + (shoulder - waist) * ((t - 0.5) / 0.25) : shoulder + (neck - shoulder) * ((t - 0.75) / 0.25);
    return [r * handle, y];
  });
}

/** Head ellipsoid scale per head shape, in the same units as the body curve. */
export const KITTY_HEAD_SCALE: Record<KittySculptV1["head"], [number, number, number]> = {
  round: [1.04, 0.91, 0.79],
  wedge: [1.12, 0.82, 0.86],
  chubby: [1.22, 0.95, 0.88],
  heart: [1.16, 0.88, 0.8],
};
export const KITTY_HEAD_R = 0.59;
