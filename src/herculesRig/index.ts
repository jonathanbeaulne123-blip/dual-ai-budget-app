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
export { HerculesRigEngine, createHerculesRigEngine, type RigEngineDiagnostics, type RigVisibilityProfile } from "./engine.ts";
export {
  bindHerculesRigEngine,
  getHerculesRigEngine,
  dispatchHerculesRig,
  readHerculesRigState,
  exposeHerculesRigConsole,
} from "./controller.ts";
export { HerculesRigProvider, useHerculesRig, useOptionalHerculesRig } from "./context.tsx";
export { snapshotToDomStyles, rigRootClassName } from "./dom.ts";
export {
  rigSessionId,
  submitHerculesRigCommands,
  pollHerculesRigQueue,
  startHerculesRigPoller,
} from "./transport.ts";
export { validateRigCommands, validateRigPayload, sanitizeRigSessionId, HERCULES_RIG_PATH, HERCULES_RIG_POLL_PATH } from "./validate.ts";
export { EXPAND_RIG_MACROS, IDLE_FLY_POUNCE_CLIP_ID, expandRigMacro } from "./macros.ts";
export {
  HUMAN_IDLE_FLY_CHASE_MS,
  IDLE_FLY_CAPTURE_AT_MS,
  IDLE_FLY_POUNCE_MS,
  idleFlyPounceLanding,
  type FlyPoint,
} from "./idleChase.ts";
export {
  BUDGET_CHAT_TRIGGERS,
  CAT_CHAT_TRIGGERS,
  matchChatRigTriggers,
  rigCommandsForChatText,
  dispatchChatRigTriggers,
  type ChatRigTrigger,
  type ChatRigTriggerCategory,
} from "./chatTriggers.ts";

import { installBuiltinClips } from "./registry.ts";
import { IDLE_CLIPS, POSE_CLIPS } from "./clips.ts";
import "./macros.ts";
import "./chatTriggers.ts";

/** Call once at module load so AI-registered clips layer on built-ins. */
installBuiltinClips({ ...POSE_CLIPS, ...IDLE_CLIPS });
