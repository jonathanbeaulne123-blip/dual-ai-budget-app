import * as THREE from "three";
import { acquireGlb } from "../assets/loadGlb.ts";
import { createBodyFigure, type BodyFigure, type BodyMotion, type FigureColours } from "./figure.ts";
import { PLAYABLE_AVATARS, type PlayableAvatar } from "./avatarDefinition.ts";
import { attachPlayableSurface } from "./playableSurface.ts";

export type { PlayableAvatar } from "./avatarDefinition.ts";
export type PlayableFigureOptions = { invalidate?: () => void; signal?: AbortSignal };

/**
 * Gives the walker a usable biped immediately, then layers the supplied
 * character's compact authored surface over it. The base figure owns every
 * walk/run/jump/slide/emote pose; the delivery's crossed legs are never
 * mistaken for an animation rig.
 */
export function createPlayableFigure(avatar: PlayableAvatar, tier: "full" | "lite", options: PlayableFigureOptions = {}): BodyFigure {
  const definition = PLAYABLE_AVATARS[avatar];
  const fallback = createBodyFigure(definition.colours, definition.anatomy);
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  let disposed = false;
  let release: (() => void) | null = null;
  let visual: THREE.Group | null = null;
  void acquireGlb(definition, controller.signal).then((handle) => {
    if (disposed || controller.signal.aborted) { handle.release(); return; }
    release = handle.release;
    visual = attachPlayableSurface(fallback, avatar, handle.root.clone(true));
    visual.name = `playable-${avatar}-${tier}`;
    options.invalidate?.();
  }).catch((error: unknown) => {
    if (!(error instanceof DOMException && error.name === "AbortError")) options.invalidate?.();
  });

  return {
    group: fallback.group,
    height: fallback.height,
    pose(phase: number, gait: number, t: number, motion?: BodyMotion) { fallback.pose(phase, gait, t, motion); },
    setColours(next: Partial<FigureColours>) { fallback.setColours(next); },
    dispose() {
      disposed = true;
      controller.abort();
      options.signal?.removeEventListener("abort", abort);
      visual?.removeFromParent();
      release?.(); release = null;
      fallback.dispose();
    },
  };
}
