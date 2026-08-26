import { RIG_PIVOTS } from "./parts.ts";
import type { RigPartId, RigPartTransform } from "./types.ts";

export function transformToCss(transform: RigPartTransform): string {
  const tx = transform.translateX ?? 0;
  const ty = transform.translateY ?? 0;
  const rot = transform.rotate ?? 0;
  const sx = transform.scaleX ?? 1;
  const sy = transform.scaleY ?? 1;
  return `translate(${tx}px, ${ty}px) rotate(${rot}deg) scale(${sx}, ${sy})`;
}

export function partStyle(part: RigPartId, transform: RigPartTransform): Record<string, string | number | undefined> {
  const pivot = RIG_PIVOTS[part];
  const style: Record<string, string | number | undefined> = {
    transform: transformToCss(transform),
    transformOrigin: `${pivot.x}px ${pivot.y}px`,
  };
  if (transform.opacity != null) style.opacity = transform.opacity;
  if (transform.visible === false) style.display = "none";
  return style;
}
