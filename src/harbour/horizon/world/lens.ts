import type { Point3, SketchbookPose } from './definition.ts';

/** MANIFEST v1.7 `viewRule.portrait`: the horizontal FOV a portrait capture must never fall below. */
export const PORTRAIT_MIN_HORIZONTAL_FOV = 45;
export interface SketchbookLens { eye: Point3; target: Point3; horizontalFovDegrees: number; verticalFovDegrees: number; portrait: boolean }
const vertical = (horizontalDegrees: number, aspect: number) => 2 * Math.atan(Math.tan(horizontalDegrees * Math.PI / 360) / aspect) * 180 / Math.PI;
/**
 * The camera for a Sketchbook page at a viewport aspect (width / height).
 * - Landscape (aspect ≥ 1): the page's vertical FOV is its horizontal `fov_deg` at 16:9 (viewRule.landscape).
 * - Portrait (aspect < 1): the camera holds the page's HORIZONTAL FOV — `portrait.fov_deg`, never below 45° —
 *   aimed at `portrait.target` / `target_h`, from the landscape eye unless the page gives a portrait eye.
 * Before a re-bake carries `pose.portrait`, a portrait capture still holds max(45°, the page FOV) horizontally.
 */
export function sketchbookLens(pose: Pick<SketchbookPose, 'eye' | 'target' | 'fovDegrees' | 'aspect' | 'portrait'>, aspect: number): SketchbookLens {
  if (!(aspect < 1)) { const verticalFovDegrees = vertical(pose.fovDegrees, pose.aspect ?? 16 / 9); return { eye: pose.eye, target: pose.target, verticalFovDegrees, horizontalFovDegrees: 2 * Math.atan(Math.tan(verticalFovDegrees * Math.PI / 360) * aspect) * 180 / Math.PI, portrait: false }; }
  const p = pose.portrait, horizontalFovDegrees = Math.max(PORTRAIT_MIN_HORIZONTAL_FOV, p?.fovDegrees ?? pose.fovDegrees);
  return { eye: p?.eye ?? pose.eye, target: p?.target ?? pose.target, horizontalFovDegrees, verticalFovDegrees: vertical(horizontalFovDegrees, aspect), portrait: true };
}
