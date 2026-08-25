import type { Environment, UndoToken } from "./core/types.ts";
import { isLedgerWrite } from "./core/writeKind.ts";

const PREFIX = "hearth:undo-history:v1:";
const MAX = 20;

export function undoHistoryKey(
  environment: Environment,
  householdId: string,
  memberId: string,
): string {
  return `${PREFIX}${environment}:${encodeURIComponent(householdId)}:${encodeURIComponent(memberId)}`;
}

function parseTokens(raw: string | null): UndoToken[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row): row is UndoToken => (
      Boolean(row)
      && typeof row === "object"
      && typeof (row as UndoToken).id === "string"
      && typeof (row as UndoToken).label === "string"
      && Array.isArray((row as UndoToken).postedIds)
      && Boolean((row as UndoToken).snapshot)
    ));
  } catch {
    return [];
  }
}

export function loadUndoHistory(
  environment: Environment,
  householdId: string,
  memberId: string,
): UndoToken[] {
  if (typeof localStorage === "undefined") return [];
  return parseTokens(localStorage.getItem(undoHistoryKey(environment, householdId, memberId)))
    .filter((token) => isLedgerWrite(token))
    .slice(-MAX);
}

export function saveUndoHistory(
  environment: Environment,
  householdId: string,
  memberId: string,
  history: UndoToken[],
): void {
  if (typeof localStorage === "undefined") return;
  const trimmed = history.filter((token) => isLedgerWrite(token)).slice(-MAX);
  localStorage.setItem(
    undoHistoryKey(environment, householdId, memberId),
    JSON.stringify(trimmed),
  );
}

export function clearUndoHistory(
  environment: Environment,
  householdId: string,
  memberId: string,
): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(undoHistoryKey(environment, householdId, memberId));
}
