import * as THREE from "three";
import { acquireGlb } from "../assets/loadGlb.ts";
import { BODY_HEIGHT } from "./obstacles.ts";
import { createBodyFigure, type BodyFigure, type BodyMotion, type FigureColours } from "./figure.ts";
import { PLAYABLE_AVATARS, type PlayableAvatar } from "./avatarDefinition.ts";

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
  const fallback = createBodyFigure(definition.colours);
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  let disposed = false;
  let release: (() => void) | null = null;
  let visual: THREE.Group | null = null;
  const carriage = fallback.group.getObjectByName("body-carriage") as THREE.Group | undefined;
  for (const side of ["left", "right"]) {
    const arm = fallback.group.getObjectByName(`body-arm-${side}`) as THREE.Group | undefined;
    if (!arm) continue;
    arm.position.x = Math.sign(arm.position.x) * definition.shoulderX;
    arm.scale.setScalar(definition.armScale);
  }

  void acquireGlb(definition, controller.signal).then((handle) => {
    if (disposed || controller.signal.aborted) { handle.release(); return; }
    release = handle.release;
    visual = handle.root.clone(true);
    // The source full-height bounds, captured by the build manifest, let a
    // torso-only surface sit in the same foot-root coordinate system as limbs.
    const scale = BODY_HEIGHT / definition.sourceHeight;
    visual.scale.setScalar(scale);
    visual.position.y = -definition.sourceMinY * scale;
    visual.name = `playable-${avatar}-${tier}`;
    (carriage ?? fallback.group).add(visual);
    for (const child of carriage?.children ?? []) {
      if (child.name === "body-torso" || child.name === "body-head" || (child as THREE.Mesh).isMesh && Math.abs(child.position.y - 0.494) < 0.002) child.visible = false;
    }
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
