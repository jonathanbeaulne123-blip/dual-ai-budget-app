import type { CommitWriteKind } from "./writeKind.ts";

/** How a confirmed command may be corrected in the product. */
export type CommandCorrectionRoute =
  | "confirmation-undo"
  | "reverse-posted-money"
  | "owner-restore-point"
  | "kitchen-local-only"
  | "non-undoable";

export type CommandClassificationRow = {
  commandKind: string;
  writeKind: CommitWriteKind | "non-commit";
  correctionRoute: CommandCorrectionRoute;
  undoScope: string;
  uiLabel: string;
  partnerSafe: boolean;
};

/**
 * Product truth for Undo vs Reverse vs Restore (T2-S6 / D-119 / D-124).
 * Daily Undo is confirmation-scoped LIFO of this member's ledger Confirms only.
 */
export const COMMAND_CLASSIFICATION: readonly CommandClassificationRow[] = [
  {
    commandKind: "postEntry",
    writeKind: "ledger-write",
    correctionRoute: "confirmation-undo",
    undoScope: "This Confirm's posted transaction ids only",
    uiLabel: "Undo removes your post; partner rows stay",
    partnerSafe: true,
  },
  {
    commandKind: "postTransfer",
    writeKind: "ledger-write",
    correctionRoute: "confirmation-undo",
    undoScope: "Both transfer legs from this Confirm",
    uiLabel: "Undo removes your transfer; partner rows stay",
    partnerSafe: true,
  },
  {
    commandKind: "postShift",
    writeKind: "ledger-write",
    correctionRoute: "confirmation-undo",
    undoScope: "Shift row and its posted wage/tip transactions",
    uiLabel: "Undo removes your shift post; partner rows stay",
    partnerSafe: true,
  },
  {
    commandKind: "reversePostedMoney",
    writeKind: "ledger-write",
    correctionRoute: "confirmation-undo",
    undoScope: "Reversal lines from this Confirm (LIFO)",
    uiLabel: "Undo peels your reversal Confirm; original row stays until reversed again",
    partnerSafe: true,
  },
  {
    commandKind: "undoLedgerConfirm",
    writeKind: "ledger-write",
    correctionRoute: "non-undoable",
    undoScope: "Tombstones only; no nested Undo of Undo",
    uiLabel: "Undo already applied; use a fresh post or Reverse",
    partnerSafe: true,
  },
  {
    commandKind: "restorePoint",
    writeKind: "ledger-write",
    correctionRoute: "owner-restore-point",
    undoScope: "Owner replaces shared tip; personal rows on this phone stay",
    uiLabel: "Restore — not Undo",
    partnerSafe: false,
  },
  {
    commandKind: "hercules-pro-transaction",
    writeKind: "ledger-write",
    correctionRoute: "confirmation-undo",
    undoScope: "Hercules Pro draft ids from this Confirm",
    uiLabel: "Undo removes your Hercules Pro post",
    partnerSafe: true,
  },
  {
    commandKind: "commit",
    writeKind: "kitchen-local",
    correctionRoute: "kitchen-local-only",
    undoScope: "No money ids — kitchen/catalog tweak",
    uiLabel: "No Undo toast",
    partnerSafe: true,
  },
  {
    commandKind: "boot-reconcile",
    writeKind: "non-commit",
    correctionRoute: "non-undoable",
    undoScope: "Transport reconcile only",
    uiLabel: "Not user-facing",
    partnerSafe: true,
  },
  {
    commandKind: "google-discovery",
    writeKind: "non-commit",
    correctionRoute: "non-undoable",
    undoScope: "Membership discovery only",
    uiLabel: "Not user-facing",
    partnerSafe: true,
  },
  {
    commandKind: "continuity-pull",
    writeKind: "non-commit",
    correctionRoute: "non-undoable",
    undoScope: "Pull/merge transport",
    uiLabel: "Not user-facing",
    partnerSafe: true,
  },
] as const;

export function classifyCommandKind(commandKind: string): CommandClassificationRow {
  const row = COMMAND_CLASSIFICATION.find((candidate) => candidate.commandKind === commandKind);
  if (row) return row;
  return {
    commandKind,
    writeKind: "kitchen-local",
    correctionRoute: "kitchen-local-only",
    undoScope: "Unlisted command — treated as kitchen-local",
    uiLabel: "No Undo toast unless posted money ids",
    partnerSafe: true,
  };
}

/** Toast secondary line clarifying confirmation-scoped Undo. */
export function undoToastSecondaryCopy(): string {
  return "Only your latest money Confirm on this phone. Partner posts stay.";
}
