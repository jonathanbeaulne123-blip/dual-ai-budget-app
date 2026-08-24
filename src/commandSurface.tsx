import {
  guaranteesPostedExactlyOnce,
  guaranteesPostedNothing,
  retryRuleFor,
  toCommandSurface,
  type CommandSurfaceState,
} from "./claude/commandContract.ts";
import type { CommandOutcome } from "./core/commandOutcome.ts";

export type CommandChromeContext = {
  offline?: boolean;
  pendingCount?: number;
  lastError?: string | null;
  /** Set when runtime auto-merged compatible goal-jar changes. */
  autoMerged?: boolean;
  amountLabel?: string | null;
  ledgerName?: string | null;
};

export type CommandChromeChip = {
  primary: string;
  secondary?: string;
  actionLabel?: string;
  tone: "neutral" | "warning" | "success" | "danger";
};

export type CommandChromeBanner = {
  primary: string;
  secondary?: string;
  actionLabel?: string;
  blocking?: boolean;
  tone: "neutral" | "warning" | "danger";
};

export type CommandChromeToast = {
  primary: string;
  secondary?: string;
  showUndo?: boolean;
};

export type CommandChromeResult = {
  chip: CommandChromeChip | null;
  banner: CommandChromeBanner | null;
  toast: CommandChromeToast | null;
  liveAnnouncement: string | null;
  showAutoMergeMessage?: boolean;
};

export const AUTO_MERGE_MESSAGE = "Goal jar amounts were combined. Journals already matched.";

export { toCommandSurface };

function postedPrimary(amountLabel?: string | null): string {
  return amountLabel ? `Posted ${amountLabel}` : "Posted";
}

function chipForSharingMode(state: CommandSurfaceState, ctx: CommandChromeContext): CommandChromeChip {
  const mode = state.sharingMode;
  if (state.kind === "saving") {
    return { primary: "Saving…", tone: "neutral" };
  }
  if (mode === "local") {
    return { primary: "This phone", secondary: "Not shared yet.", tone: "neutral" };
  }
  if (mode === "invite-draft") {
    return { primary: "Draft", tone: "neutral" };
  }
  if (mode === "publish-confirming") {
    return { primary: "Publishing…", tone: "neutral" };
  }
  if (mode === "linked") {
    return { primary: "Linked", tone: "neutral" };
  }
  if (mode === "pending-transport" || state.kind === "pending-transport") {
    const secondary = ctx.offline || mode === "disconnected" ? "· offline" : undefined;
    return {
      primary: "Waiting to share",
      secondary,
      actionLabel: "Retry now",
      tone: "warning",
    };
  }
  if (mode === "synchronized" || state.kind === "synchronized") {
    const secondary = ctx.ledgerName ? `· ${ctx.ledgerName}` : undefined;
    return { primary: "Up to date", secondary, tone: "success" };
  }
  if (mode === "conflicted" || state.kind === "conflict-needs-attention") {
    return { primary: "Needs attention", secondary: "· conflict", actionLabel: "Review", tone: "warning" };
  }
  if (mode === "disconnected") {
    return { primary: "Offline", secondary: "· waiting to share", tone: "warning" };
  }
  if (mode === "transport-error") {
    return { primary: "Share paused", tone: "warning" };
  }
  return { primary: "This phone", tone: "neutral" };
}

function pendingBannerVisible(state: CommandSurfaceState, ctx: CommandChromeContext): boolean {
  if (state.kind !== "pending-transport") return false;
  return Boolean(
    ctx.offline ||
      ctx.lastError ||
      state.sharingMode === "disconnected" ||
      state.sharingMode === "transport-error" ||
      state.errorClass === "disconnected",
  );
}

export function renderCommandChrome(state: CommandSurfaceState, ctx: CommandChromeContext = {}): CommandChromeResult {
  const retryRule = retryRuleFor(state);
  const posted = guaranteesPostedExactlyOnce(state);
  const nothingPosted = guaranteesPostedNothing(state);
  const showAutoMergeMessage = Boolean(ctx.autoMerged && state.kind === "accepted-local" && posted);

  if (state.kind === "saving") {
    return {
      chip: chipForSharingMode(state, ctx),
      banner: null,
      toast: null,
      liveAnnouncement: "Saving.",
    };
  }

  if (nothingPosted) {
    const live =
      state.kind === "recovery-available"
        ? "Recovery needed. Do not confirm again."
        : state.userMessage
          ? `Not posted. ${state.userMessage}`
          : "Not posted.";
    let banner: CommandChromeBanner | null = null;
    if (state.kind === "recovery-available") {
      banner = {
        primary: "Recovery needed.",
        secondary:
          "The books may have accepted this entry, but this phone couldn't save safely. Do not Confirm again.",
        actionLabel: "Open recovery",
        blocking: true,
        tone: "danger",
      };
    } else if (state.kind === "retryable-failure") {
      banner = {
        primary: "Couldn't save.",
        secondary: "The previous household is still here.",
        actionLabel: "Retry",
        tone: "warning",
      };
    }
    return {
      chip: state.kind === "recovery-available" ? { primary: "Recovery needed", tone: "danger" } : null,
      banner,
      toast: null,
      liveAnnouncement: live,
    };
  }

  if (state.kind === "conflict-needs-attention") {
    return {
      chip: chipForSharingMode(state, ctx),
      banner: {
        primary: "Both copies kept.",
        secondary: "This phone and the cloud each have new work. Nothing was overwritten.",
        actionLabel: "Review conflict",
        blocking: true,
        tone: "warning",
      },
      toast: posted
        ? {
            primary: "Posted on this phone",
            secondary: "Share is paused until you choose.",
          }
        : null,
      liveAnnouncement: "Conflict. Both copies kept. Review required.",
    };
  }

  if (state.kind === "pending-transport") {
    const pendingCount = ctx.pendingCount ?? 0;
    const pendingLine =
      pendingCount > 0 ? `${pendingCount} update${pendingCount === 1 ? "" : "s"} waiting` : undefined;
    return {
      chip: chipForSharingMode(state, ctx),
      banner: pendingBannerVisible(state, ctx)
        ? {
            primary: "Saved here. Not shared yet.",
            secondary: ctx.lastError ?? "Hearth will retry when you're back online.",
            actionLabel: "Review pending",
            tone: "warning",
          }
        : null,
      toast: posted
        ? {
            primary: postedPrimary(ctx.amountLabel),
            secondary: pendingLine ?? "Waiting to share.",
          }
        : null,
      liveAnnouncement: posted
        ? `${postedPrimary(ctx.amountLabel)}. Waiting to share.`
        : "Waiting to share.",
    };
  }

  if (state.kind === "accepted-local") {
    return {
      chip: chipForSharingMode(state, ctx),
      banner: null,
      toast: posted
        ? {
            primary: postedPrimary(ctx.amountLabel),
            secondary: showAutoMergeMessage ? AUTO_MERGE_MESSAGE : "On this phone.",
            showUndo: true,
          }
        : null,
      liveAnnouncement: posted ? `${postedPrimary(ctx.amountLabel)}. On this phone.` : null,
      showAutoMergeMessage,
    };
  }

  if (state.kind === "synchronized") {
    return {
      chip: chipForSharingMode(state, ctx),
      banner: null,
      toast: posted
        ? {
            primary: postedPrimary(ctx.amountLabel),
            secondary: "Up to date.",
            showUndo: true,
          }
        : null,
      liveAnnouncement: posted ? `${postedPrimary(ctx.amountLabel)}. Up to date.` : null,
    };
  }

  if (retryRule === "open-recovery") {
    return {
      chip: { primary: "Recovery needed", tone: "danger" },
      banner: {
        primary: "Recovery needed.",
        secondary: state.userMessage ?? "Do not Confirm again.",
        actionLabel: "Open recovery",
        blocking: true,
        tone: "danger",
      },
      toast: null,
      liveAnnouncement: "Recovery needed. Do not confirm again.",
    };
  }

  return {
    chip: chipForSharingMode(state, ctx),
    banner: null,
    toast: null,
    liveAnnouncement: state.userMessage,
  };
}

export function renderCommandSurface(outcome: CommandOutcome, ctx: CommandChromeContext = {}): CommandChromeResult {
  return renderCommandChrome(toCommandSurface(outcome), ctx);
}
