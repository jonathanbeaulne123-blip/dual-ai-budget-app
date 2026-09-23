import type * as THREE from "three";
import { FIGURE_RIG_HEIGHT, type BodyFigure } from "./figure.ts";
import { PLAYABLE_AVATARS, type PlayableAvatar } from "./avatarDefinition.ts";

/** Fit the authored coat and face to the same moving body in the game and
 * offline viewer. The caller owns the surface and its resource lifetime. */
export function attachPlayableSurface(body: BodyFigure, avatar: PlayableAvatar, surface: THREE.Group): THREE.Group {
  const definition = PLAYABLE_AVATARS[avatar];
  const carriage = body.group.getObjectByName("body-carriage") as THREE.Group;
  const scale = FIGURE_RIG_HEIGHT / definition.sourceHeight;
  surface.scale.setScalar(scale);
  surface.position.y = -definition.sourceMinY * scale;
  surface.name = `playable-${avatar}`;
  carriage.add(surface);

  for (const child of carriage.children) {
    if (["body-torso", "body-head", "body-hair"].includes(child.name)) child.visible = false;
  }
  return surface;
}
