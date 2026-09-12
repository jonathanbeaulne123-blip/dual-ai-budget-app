/**
 * Named spots on the clay and the canvas size of each paintable part.
 * Its own module so artwork and the paint replay can both read it without a cycle.
 */
import type { KittyAnchor, KittyPart } from "../../core/types.ts";

export const PART_CANVAS_SIZE: Record<KittyPart, number> = { body: 512, head: 512, earL: 256, earR: 256, tail: 256, paws: 256 };
/** Part-local uv for every named anchor. Front centre of every part is u = 0.5. */
export const KITTY_ANCHOR_UV: Record<KittyAnchor, { part: KittyPart; u: number; v: number }> = {
  forehead: { part: "head", u: 0.5, v: 0.74 },
  leftCheek: { part: "head", u: 0.36, v: 0.46 },
  rightCheek: { part: "head", u: 0.64, v: 0.46 },
  chin: { part: "head", u: 0.5, v: 0.2 },
  chest: { part: "body", u: 0.5, v: 0.82 },
  belly: { part: "body", u: 0.5, v: 0.64 },
  back: { part: "body", u: 0.0, v: 0.62 },
  leftFlank: { part: "body", u: 0.25, v: 0.55 },
  rightFlank: { part: "body", u: 0.75, v: 0.55 },
  rump: { part: "body", u: 0.0, v: 0.3 },
  leftEar: { part: "earL", u: 0.5, v: 0.45 },
  rightEar: { part: "earR", u: 0.5, v: 0.45 },
  tailTip: { part: "tail", u: 0.9, v: 0.5 },
};
export const mirrorU = (u: number) => 1 - u;
export const mirrorPart = (part: KittyPart): KittyPart => (part === "earL" ? "earR" : part === "earR" ? "earL" : part);
