import type { RigEase, RigPartTransform } from "./types.ts";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function ease(t: number, kind: RigEase = "easeInOut"): number {
  const x = clamp(t, 0, 1);
  switch (kind) {
    case "linear":
      return x;
    case "easeOut":
      return 1 - (1 - x) ** 3;
    case "spring":
      return 1 - Math.cos(x * Math.PI * 0.5) * Math.exp(-x * 2.5);
    case "easeInOut":
    default:
      return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
  }
}

export function lerpTransform(from: RigPartTransform, to: RigPartTransform, t: number): RigPartTransform {
  const pick = <K extends keyof RigPartTransform>(key: K, fallback: NonNullable<RigPartTransform[K]>) => {
    const a = from[key] ?? fallback;
    const b = to[key] ?? fallback;
    if (typeof a === "number" && typeof b === "number") return lerp(a, b, t) as RigPartTransform[K];
    return t < 0.5 ? a : b;
  };
  return {
    rotate: pick("rotate", 0),
    translateX: pick("translateX", 0),
    translateY: pick("translateY", 0),
    scaleX: pick("scaleX", 1),
    scaleY: pick("scaleY", 1),
    opacity: pick("opacity", 1),
    visible: t < 0.5 ? (from.visible ?? true) : (to.visible ?? true),
  };
}

/** Sample a keyframe track at normalized time 0–1 (handles loop wrap). */
export function sampleKeyframes<T extends { t: number }>(
  keyframes: T[],
  time: number,
  loop: boolean,
): { left: T; right: T; localT: number } {
  if (!keyframes.length) throw new Error("keyframes required");
  const sorted = [...keyframes].sort((a, b) => a.t - b.t);
  const t = loop ? ((time % 1) + 1) % 1 : clamp(time, 0, 1);
  let rightIndex = sorted.findIndex((frame) => frame.t >= t);
  if (rightIndex <= 0) rightIndex = sorted.length - 1;
  const right = sorted[rightIndex]!;
  const left = sorted[(rightIndex - 1 + sorted.length) % sorted.length]!;
  const span = right.t - left.t || 1;
  const localT = right.t === left.t ? 0 : (t - left.t) / span;
  return { left, right, localT: clamp(localT, 0, 1) };
}
