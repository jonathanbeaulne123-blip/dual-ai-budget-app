import type { InstrumentId } from "../core/officeLayout.ts";
import type { HerculesRigCommand } from "./types.ts";
import { registerRigClip } from "./registry.ts";

/** Per-instrument expand macros — layered on top of playPose from herculesInstrumentSurface. */
export const EXPAND_RIG_MACROS: Partial<Record<InstrumentId | "window", HerculesRigCommand[]>> = {
  window: [
    { type: "playClip", clipId: "macro-ear-twitch", loop: false },
    { type: "setPart", part: "tail", transform: { rotate: -18 }, holdMs: 800 },
  ],
  wallet: [
    { type: "playPose", pose: "perch" },
    { type: "blendTo", durationMs: 320, parts: { head: { rotate: -10, translateY: -4 }, ears: { rotate: 8 } } },
    { type: "setPart", part: "legFront", transform: { rotate: -6 }, holdMs: 700 },
  ],
  accounts: [
    { type: "playPose", pose: "perch" },
    { type: "setPart", part: "head", transform: { rotate: -5, translateY: -2 }, holdMs: 900 },
  ],
  calculator: [
    { type: "playPose", pose: "pounce" },
    { type: "setPart", part: "tail", transform: { rotate: -38 }, holdMs: 600 },
  ],
  calendar: [
    { type: "playPose", pose: "stretch" },
    { type: "setPart", part: "head", transform: { rotate: 6, translateY: 2 }, holdMs: 900 },
  ],
  blotter: [
    { type: "playPose", pose: "loaf" },
    { type: "setPart", part: "whiskers", transform: { opacity: 0.55 }, holdMs: 1200 },
  ],
  lamp: [
    { type: "playClip", clipId: "macro-ear-twitch", loop: false },
    { type: "setPart", part: "head", transform: { rotate: 4 }, holdMs: 700 },
  ],
  mail: [
    { type: "playPose", pose: "perch" },
    { type: "setPart", part: "ears", transform: { rotate: -14, scaleY: 0.82 }, holdMs: 900 },
  ],
  timesheet: [
    { type: "playPose", pose: "stretch" },
    { type: "setPart", part: "tail", transform: { rotate: -28 }, holdMs: 800 },
  ],
  jars: [
    { type: "playPose", pose: "beg" },
  ],
  chalkboard: [
    { type: "playPose", pose: "perch" },
    { type: "setPart", part: "head", transform: { rotate: -7 }, holdMs: 900 },
  ],
  appointments: [
    { type: "playPose", pose: "loaf" },
    { type: "setPart", part: "tail", transform: { rotate: 12 }, holdMs: 1000 },
  ],
};

export function expandRigMacro(id: InstrumentId | "window"): HerculesRigCommand[] {
  return EXPAND_RIG_MACROS[id] ? [...EXPAND_RIG_MACROS[id]!] : [{ type: "playPose", pose: "perch" }];
}

export function installRigMacroClips(): void {
  registerRigClip({
    id: "macro-ear-twitch",
    label: "Ear twitch",
    durationMs: 420,
    keyframes: [
      { t: 0, parts: { ears: { rotate: 0, scaleY: 1 } } },
      { t: 0.35, parts: { ears: { rotate: -18, scaleY: 0.78 } } },
      { t: 0.7, parts: { ears: { rotate: 10, scaleY: 0.92 } } },
      { t: 1, parts: { ears: { rotate: 0, scaleY: 1 } } },
    ],
  });
}

installRigMacroClips();
