import type { CommandOutcome } from "./core/commandOutcome.ts";
import { guaranteesPostedExactlyOnce, guaranteesPostedNothing } from "./claude/commandContract.ts";

/** T3-S1 optimistic lifecycle — UI only; CommandOutcome remains authoritative. */
export type CommandProgressPhase =
  | "idle"
  | "confirming"
  | "accepted-local"
  | "cloud-ack"
  | "failed";

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
}): CommandProgressDisplay {
  if (input.phase === "idle" || !input.transportRequested) return HIDDEN;

  const states = stepStatesForPhase(input.phase);
  const steps: CommandProgressStep[] = [
    { id: "local", label: "This phone", state: input.failedAt === "local" ? "failed" : states[0] ?? "pending" },
    { id: "cloud", label: "Cloud", state: input.failedAt === "cloud" ? "failed" : states[1] ?? "pending" },
    { id: "household", label: "Household", state: states[2] ?? "pending" },
  ];

  let summary = "";
  let liveAnnouncement: string | null = null;

  if (input.phase === "confirming") {
    summary = "Saving on this phone…";
    liveAnnouncement = "Saving.";
  } else if (input.phase === "accepted-local") {
    summary = "Posted here. Sharing to the cloud…";
    liveAnnouncement = "Posted on this phone. Sharing to the cloud.";
  } else if (input.phase === "cloud-ack") {
    summary = "Shared with the household books.";
    liveAnnouncement = "Shared with the household books.";
  } else if (input.phase === "failed") {
    summary = "Could not finish sharing.";
    liveAnnouncement = "Could not finish sharing.";
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
