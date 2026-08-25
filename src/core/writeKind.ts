import type { UndoToken } from "./types.ts";

/** Money/books writes get undo + sync urgency. Kitchen/UX stays quiet. */
export type CommitWriteKind = "ledger-write" | "kitchen-local";

/**
 * Ledger writes are commands that posted journal/shift money ids.
 * Hercules talk, chalk, cosmetics, clock chrome, presence, and most catalog
 * tweaks use empty postedIds and stay kitchen-local (no undo toast).
 */
export function classifyCommitWrite(
  token: Pick<UndoToken, "postedIds"> | null | undefined,
): CommitWriteKind {
  const ids = token?.postedIds ?? [];
  if (ids.some((id) => /^(TXN|SHF)/.test(id))) return "ledger-write";
  return "kitchen-local";
}

export function isLedgerWrite(token: Pick<UndoToken, "postedIds"> | null | undefined): boolean {
  return classifyCommitWrite(token) === "ledger-write";
}
