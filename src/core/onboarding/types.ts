/**
 * Onboarding Slice A — declarative types (D-128 / D-129).
 * Pure contracts only; no React, network, or money writes.
 */

export type OnboardingShellKind = "phone" | "desktop";

export type HearthOnboardingTab = "home" | "plan" | "calendar" | "ledger" | "more" | "add";

export type OnboardingEntrance = "bag" | "current" | "nav" | "page-edge";

export type OnboardingCamera = "focus" | "wide" | "celebration";

export type OnboardingSafety = "no-write" | "draft-only" | "practice" | "real-confirm";

export type OnboardingResumePolicy = "same-step" | "last-safe-step" | "chapter-start";

export type HerculesPose =
  | "idle"
  | "walk"
  | "paw"
  | "hop"
  | "confused"
  | "celebrate"
  | "perch";

export type DialogueTone = "gentle" | "classic" | "cheeky";

export type OnboardingExpectedAction =
  | { kind: "tap-target"; targetId: string }
  | { kind: "nav-tab"; tab: HearthOnboardingTab }
  | { kind: "semantic"; code: string }
  | { kind: "reveal-only" }
  | { kind: "finish-practice" }
  | { kind: "ready-for-september" }
  | { kind: "skip" };

export type HerculesRouteSegment = {
  id: string;
  from: "bag" | "current" | "nav" | { x: number; y: number };
  to: "target" | "nav" | { x: number; y: number };
  durationMs?: number;
};

export type SemanticDialogue = {
  key: string;
  meaning: string;
  tones: Record<DialogueTone, string>;
};

export type OnboardingScene = {
  id: string;
  chapterId: string;
  route: HearthOnboardingTab;
  targetId?: string;
  entrance: OnboardingEntrance;
  routePlan: HerculesRouteSegment[];
  dialogueKey: string;
  dialoguePlacement: "auto-opposite-target";
  camera: OnboardingCamera;
  expectedAction: OnboardingExpectedAction;
  safety: OnboardingSafety;
  resume: OnboardingResumePolicy;
  successPose: HerculesPose;
  mistakePose?: HerculesPose;
  /** When true, completing this scene is a safe resume checkpoint. */
  safeCheckpoint?: boolean;
};

export type OnboardingChapter = {
  id: string;
  title: string;
  sceneIds: string[];
  /** Concept progress shared across shells for the same member. */
  conceptShared: boolean;
};

export type OnboardingRegistry = {
  version: string;
  chapters: OnboardingChapter[];
  scenes: OnboardingScene[];
  dialogue: SemanticDialogue[];
};

export type OnboardingProgressIdentity = {
  environment: "development" | "production";
  householdId: string;
  /** Authenticated Google subject when available; else stable member id. */
  memberKey: string;
  registryVersion: string;
  shell: OnboardingShellKind;
};

export type OnboardingProgressRecord = {
  identity: OnboardingProgressIdentity;
  status: "in-progress" | "skipped" | "completed";
  /** Last scene id that is safe to resume from. */
  lastSafeSceneId: string | null;
  /** All completed scene ids for this identity (concept + shell lessons). */
  completedSceneIds: string[];
  completedChapterIds: string[];
  updatedAtIso: string;
};

export type OnboardingCoordinatorState =
  | { kind: "idle" }
  | { kind: "eligibility"; eligible: boolean; reason: string }
  | { kind: "entering"; sceneId: string }
  | { kind: "routing"; sceneId: string; segmentIndex: number }
  | { kind: "focusing"; sceneId: string }
  | { kind: "typing"; sceneId: string; revealed: boolean }
  | { kind: "waiting-action"; sceneId: string }
  | { kind: "reacting"; sceneId: string; outcome: "success" | "mistake" }
  | { kind: "saving-progress"; sceneId: string }
  | { kind: "paused-conflict"; sceneId: string; reason: string }
  | { kind: "target-missing"; sceneId: string; targetId: string }
  | { kind: "skipped" }
  | { kind: "completed" };

export type OnboardingEvent =
  | { type: "CHECK_ELIGIBILITY"; eligible: boolean; reason: string }
  | { type: "START"; sceneId: string }
  | { type: "ROUTE_SEGMENT_DONE" }
  | { type: "FOCUS_DONE" }
  | { type: "TYPE_DONE" }
  | { type: "REVEAL_DIALOGUE" }
  | { type: "SEMANTIC_ACTION"; action: OnboardingExpectedAction; sceneId: string; memberKey: string; householdId: string; environment: string }
  | { type: "MISTAKE" }
  | { type: "REACTION_DONE" }
  | { type: "PROGRESS_SAVED"; nextSceneId: string | null }
  | { type: "TARGET_MISSING"; targetId: string }
  | { type: "TARGET_RECOVERED" }
  | { type: "PAUSE_CONFLICT"; reason: string }
  | { type: "RESUME_AFTER_CONFLICT" }
  | { type: "SKIP" }
  | { type: "REPLAY" }
  | { type: "COMPLETE" };

export type OnboardingDiagnostic = {
  atIso: string;
  code: string;
  stateKind: OnboardingCoordinatorState["kind"];
  sceneId?: string;
  targetId?: string;
  geometryReason?: string;
};

export const ONBOARDING_FOUNDATION_FLAG = "VITE_ONBOARDING_FOUNDATION";
