export type {
  HerculesRigCommand,
  HerculesRigMood,
  HerculesRigPose,
  RigClip,
  RigEase,
  RigEngineState,
  RigKeyframe,
  RigPartId,
  RigPartTransform,
  RigSnapshot,
} from "./types.ts";

export { RIG_PARTS, RIG_PART_CLASS, RIG_PIVOTS, emptySnapshot } from "./parts.ts";
export { transformToCss, partStyle } from "./transform.ts";
export { POSE_CLIPS, IDLE_CLIPS, MOOD_PARTS, poseClipId } from "./clips.ts";
export {
  registerRigClip,
  unregisterRigClip,
  getRigClip,
  listRigClips,
  installBuiltinClips,
} from "./registry.ts";
export { HerculesRigEngine, createHerculesRigEngine } from "./engine.ts";
export {
  bindHerculesRigEngine,
  getHerculesRigEngine,
  dispatchHerculesRig,
  readHerculesRigState,
  exposeHerculesRigConsole,
} from "./controller.ts";
export { HerculesRigProvider, useHerculesRig, useOptionalHerculesRig } from "./context.tsx";
export { snapshotToDomStyles, rigRootClassName } from "./dom.ts";

import { installBuiltinClips } from "./registry.ts";
import { IDLE_CLIPS, POSE_CLIPS } from "./clips.ts";

/** Call once at module load so AI-registered clips layer on built-ins. */
installBuiltinClips({ ...POSE_CLIPS, ...IDLE_CLIPS });
