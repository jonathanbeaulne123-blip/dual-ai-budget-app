import { decodeCompanionPresentation, type CompanionPresentationV2 } from "./herculesCompanionContracts.ts";
import type { HerculesRigCommand } from "../herculesRig/types.ts";

/** Invalid optional cues never become arbitrary rig instructions or actions. */
export function readCompanionPresentation(value: unknown, factIds: readonly string[] = [], actionIds: readonly string[] = []): CompanionPresentationV2 | undefined {
  try { return decodeCompanionPresentation(value, new Set(factIds), new Set(actionIds)); } catch { return undefined; }
}
export function companionCueCommands(presentation: CompanionPresentationV2 | undefined, reducedMotion = false): HerculesRigCommand[] {
  if (!presentation || reducedMotion) return [];
  if (presentation.expression === "calm") return [{ type: "playPose", pose: "loaf" }];
  if (presentation.gesture === "head-tilt") return [{ type: "setPart", part: "head", transform: { rotate: -5 }, holdMs: 1100 }];
  if (presentation.gesture === "ear-perk") return [{ type: "setPart", part: "ears", transform: { translateY: -2 }, holdMs: 900 }];
  if (["slow-blink", "breathe-blink"].includes(presentation.gesture)) return [{ type: "setPart", part: "eye", transform: { scaleY: 0.15 }, holdMs: 600 }];
  if (presentation.gesture === "pleased-posture") return [{ type: "playPose", pose: "sit" }];
  // Closet-only gestures become available with their authored assets in slice 4.
  return [];
}
