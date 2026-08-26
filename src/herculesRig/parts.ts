import type { RigPartId, RigPartTransform, RigSnapshot } from "./types.ts";

/** Stable part ids for AI agents and DOM `data-herc-part` hooks. */
export const RIG_PARTS: readonly RigPartId[] = [
  "root",
  "tail",
  "body",
  "ruff",
  "head",
  "ears",
  "legs",
  "legFront",
  "legBack",
  "bag",
  "whiskers",
  "eye",
  "eyeShut",
] as const;

/** SVG transform-origin in viewBox units (200×200). Mirrors hercules.css pivots. */
export const RIG_PIVOTS: Record<RigPartId, { x: number; y: number }> = {
  root: { x: 100, y: 180 },
  tail: { x: 140, y: 155 },
  body: { x: 120, y: 140 },
  ruff: { x: 70, y: 95 },
  head: { x: 72, y: 92 },
  ears: { x: 68, y: 46 },
  legs: { x: 76, y: 178 },
  legFront: { x: 68, y: 140 },
  legBack: { x: 86, y: 142 },
  bag: { x: 146, y: 140 },
  whiskers: { x: 30, y: 85 },
  eye: { x: 52, y: 63 },
  eyeShut: { x: 52, y: 64 },
};

export const EMPTY_TRANSFORM: RigPartTransform = {
  rotate: 0,
  translateX: 0,
  translateY: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
  visible: true,
};

export function emptySnapshot(): RigSnapshot {
  const snap = Object.fromEntries(RIG_PARTS.map((part) => [part, { ...EMPTY_TRANSFORM }])) as RigSnapshot;
  snap.eyeShut.visible = false;
  snap.bag.opacity = 0;
  return snap;
}

/** Maps engine part id → HerculesFigure group className. */
export const RIG_PART_CLASS: Partial<Record<RigPartId, string>> = {
  root: "herc",
  tail: "herc-tail",
  body: "herc-body",
  ruff: "herc-ruff",
  head: "herc-head",
  ears: "herc-ears",
  legs: "herc-legs",
  legFront: "herc-leg herc-leg-front",
  legBack: "herc-leg herc-leg-back",
  bag: "herc-bag",
  whiskers: "herc-whiskers",
  eye: "herc-eye",
  eyeShut: "herc-eye-shut",
};
