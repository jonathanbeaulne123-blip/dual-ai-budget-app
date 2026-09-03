import type { HearthTab } from "../hercules.ts";

export type OnboardingTrack = "household" | "personal";
export type OnboardingSitting = 1 | 2 | 3 | null;
export type MemberRole = "conductor" | "witness" | "both" | "joint";
export type ApprovalMode = "none" | "member" | "joint";
export type SkipPolicy =
  | "household-required"
  | "member-required"
  | "member-skippable"
  | "auto-completable"
  | "blocked";
export type SemanticActionKind =
  | "navigate"
  | "pause"
  | "stop-setup"
  | "skip-personal"
  | "continue"
  | "submit"
  | "approve"
  | "edit"
  | "reopen";

export type ChapterId = string;
export type NavTarget = { tab: HearthTab; view?: string };

export type OnboardingChapter = {
  id: ChapterId;
  registryVersion: number;
  track: OnboardingTrack;
  order: number;
  sitting: OnboardingSitting;
  copyKey: string;
  flavorKeys: string[];
  target: NavTarget | null;
  conductor: "self" | "partner" | "either" | "both";
  approval: ApprovalMode;
  skip: SkipPolicy;
  timeBudgetSeconds: number;
  pausePoints: string[];
  actions: SemanticActionKind[];
  dependsOn: ChapterId[];
  contributesToFinalGate: boolean;
};

export type RegistryProblemCode =
  | "duplicate-id"
  | "duplicate-order"
  | "order-gap"
  | "target-without-navigate"
  | "navigate-without-target"
  | "unknown-tab"
  | "joint-and-skippable"
  | "personal-contributes-to-gate"
  | "household-policy-on-personal"
  | "budget-without-pause"
  | "flavor-count"
  | "dependency-cycle"
  | "forward-dependency";

export type RegistryProblem = {
  code: RegistryProblemCode;
  chapterId: ChapterId;
  detail: string;
};
