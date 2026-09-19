import type { CommandOutcome } from "./core/commandOutcome.ts";
import { guaranteesPostedExactlyOnce, guaranteesPostedNothing } from "./claude/commandContract.ts";

/** T3-S1 optimistic lifecycle — UI only; CommandOutcome remains authoritative. */
export type CommandProgressPhase =
  | "idle"
  | "confirming"
  | "accepted-local"
  | "cloud-ack"
  | "failed";

export type CommandProgressAudience = "household" | "personal";

export type CommandProgressStepState = "pending" | "active" | "done" | "failed";

export type CommandProgressStep = {
  id: "local" | "cloud" | "household";
  label: string;
  state: CommandProgressStepState;
};

export type CommandProgressDisplay = {
  visible: boolean;
  phase: CommandProgressPhase;
  steps: CommandProgressStep[];
  summary: string;
  liveAnnouncement: string | null;
};

const HIDDEN: CommandProgressDisplay = {
  visible: false,
  phase: "idle",
  steps: [],
  summary: "",
  liveAnnouncement: null,
};

function stepStatesForPhase(phase: CommandProgressPhase): CommandProgressStepState[] {
  switch (phase) {
    case "confirming":
      return ["active", "pending", "pending"];
    case "accepted-local":
      return ["done", "active", "pending"];
    case "cloud-ack":
      return ["done", "done", "done"];
    case "failed":
      return ["failed", "pending", "pending"];
    default:
      return ["pending", "pending", "pending"];
  }
}

export function buildCommandProgress(input: {
  phase: CommandProgressPhase;
  transportRequested: boolean;
  failedAt?: "local" | "cloud";
  audience?: CommandProgressAudience;
}): CommandProgressDisplay {
  if (input.phase === "idle" || !input.transportRequested) return HIDDEN;

  const personal = input.audience === "personal";
  const states = stepStatesForPhase(input.phase);
  const steps: CommandProgressStep[] = [
    { id: "local", label: "This phone", state: input.failedAt === "local" ? "failed" : states[0] ?? "pending" },
    { id: "cloud", label: "Cloud", state: input.failedAt === "cloud" ? "failed" : states[1] ?? "pending" },
    { id: "household", label: personal ? "Private books" : "Household", state: states[2] ?? "pending" },
  ];

  let summary = "";
  let liveAnnouncement: string | null = null;

  if (input.phase === "confirming") {
    summary = personal ? "Saving to your private books…" : "Saving on this phone…";
    liveAnnouncement = personal ? "Saving to your private books." : "Saving.";
  } else if (input.phase === "accepted-local") {
    summary = personal ? "Saved here. Syncing your private books…" : "Posted here. Sharing to the cloud…";
    liveAnnouncement = personal ? "Saved on this phone. Syncing your private books." : "Posted on this phone. Sharing to the cloud.";
  } else if (input.phase === "cloud-ack") {
    summary = personal ? "Saved to your private books." : "Shared with the household books.";
    liveAnnouncement = summary;
  } else if (input.phase === "failed") {
    summary = personal ? "Could not finish saving to your private books." : "Could not finish sharing.";
    liveAnnouncement = summary;
  }

  return {
    visible: true,
    phase: input.phase,
    steps,
    summary,
    liveAnnouncement,
  };
}

export function commandProgressPhaseAfterOutcome(
  outcome: CommandOutcome,
  transportRequested: boolean,
): CommandProgressPhase {
  if (!transportRequested) return "idle";
  if (guaranteesPostedNothing(outcome) || !outcome.ok) return "failed";
  if (outcome.kind === "synchronized") return "cloud-ack";
  if (guaranteesPostedExactlyOnce(outcome)) return "accepted-local";
  return "idle";
}

export function shouldShowCommandProgress(input: {
  phase: CommandProgressPhase;
  transportRequested: boolean;
  linkedHousehold: boolean;
}): boolean {
  return input.linkedHousehold && input.transportRequested && input.phase !== "idle";
}
