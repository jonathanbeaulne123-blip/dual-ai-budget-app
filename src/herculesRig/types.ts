/** Controllable rig parts. Head, tail, and each leg are independently addressable. */
export type RigPartId =
  | "root"
  | "tail"
  | "body"
  | "ruff"
  | "head"
  | "ears"
  | "legs"
  | "legFront"
  | "legBack"
  | "bag"
  | "whiskers"
  | "eye"
  | "eyeShut";

export type RigPartTransform = {
  rotate?: number;
  translateX?: number;
  translateY?: number;
  scaleX?: number;
  scaleY?: number;
  opacity?: number;
  visible?: boolean;
};

export type RigSnapshot = Record<RigPartId, RigPartTransform>;

export type RigKeyframe = {
  /** Normalized time 0–1 within the clip. */
  t: number;
  parts: Partial<RigSnapshot>;
};

export type RigClip = {
  id: string;
  label?: string;
  durationMs: number;
  loop?: boolean;
  keyframes: RigKeyframe[];
};

export type RigEase = "linear" | "easeInOut" | "easeOut" | "spring";

export type HerculesRigPose =
  | "loaf" | "walk" | "jump" | "stretch" | "wash" | "sleep" | "hide"
  | "pace" | "celebrate" | "pounce" | "perch" | "lick" | "bump" | "attack"
  | "sit" | "beg" | "bag";

export type HerculesRigMood = "glowing" | "content" | "restless" | "hiding";

/** AI-facing command vocabulary. Never posts money or touches the ledger. */
export type HerculesRigCommand =
  | { type: "setPart"; part: RigPartId; transform: Partial<RigPartTransform>; holdMs?: number }
  | { type: "setParts"; parts: Partial<RigSnapshot>; holdMs?: number }
  | { type: "playPose"; pose: HerculesRigPose; loop?: boolean }
  | { type: "playClip"; clipId: string; loop?: boolean }
  | { type: "blendTo"; parts: Partial<RigSnapshot>; durationMs: number; ease?: RigEase }
  | { type: "clearOverrides" }
  | { type: "clearOverride"; part: RigPartId }
  | { type: "queue"; commands: HerculesRigCommand[] }
  | { type: "wait"; ms: number }
  | { type: "reset" };

export type RigEngineState = {
  pose: HerculesRigPose;
  mood: HerculesRigMood;
  clipId: string | null;
  parts: RigSnapshot;
  reducedMotion: boolean;
};

export type RigListener = (state: RigEngineState) => void;
