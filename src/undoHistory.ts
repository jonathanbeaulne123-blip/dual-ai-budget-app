import type { Environment, Household, UndoToken } from "./core/types.ts";
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

type StoredUndoToken = Omit<UndoToken, "snapshot">;

function hasCurrentFundFact(token: UndoToken, current: Household): boolean {
  const currentFundEventIds = new Set((current.fundEvents ?? []).map((event) => event.id));
  return token.postedIds.some((id) => currentFundEventIds.has(id));
}

function parseTokens(raw: string | null, current: Household): UndoToken[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row): row is StoredUndoToken => (
      Boolean(row)
      && typeof row === "object"
      && typeof (row as UndoToken).id === "string"
      && typeof (row as UndoToken).label === "string"
      && Array.isArray((row as UndoToken).postedIds)
    )).map((row) => ({ ...row, snapshot: current }));
  } catch {
    return [];
  }
}

export function loadUndoHistory(
  environment: Environment,
  householdId: string,
  memberId: string,
  current: Household,
): UndoToken[] {
  if (typeof localStorage === "undefined") return [];
  return parseTokens(localStorage.getItem(undoHistoryKey(environment, householdId, memberId)), current)
    .filter((token) => isLedgerWrite(token))
    // Older compact history rows did not keep command identity. Do not advertise
    // a funded Undo that cannot select its append-only correction path safely.
    .filter((token) => Boolean(token.commandKind) || !hasCurrentFundFact(token, current))
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
  const compact: StoredUndoToken[] = trimmed.map(({ id, label, postedIds, commandKind, actorMemberId }) => ({
    id,
    label,
    postedIds,
    ...(commandKind ? { commandKind } : {}),
    ...(actorMemberId ? { actorMemberId } : {}),
  }));
  const key = undoHistoryKey(environment, householdId, memberId);
  for (let start = 0; start <= compact.length; start += 1) {
    try {
      localStorage.setItem(key, JSON.stringify(compact.slice(start)));
      return;
    } catch {
      // Keep the newest confirmations if this browser's small backup quota is full.
    }
  }
}

export function clearUndoHistory(
  environment: Environment,
  householdId: string,
  memberId: string,
): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(undoHistoryKey(environment, householdId, memberId));
}

/** Drop every stored Undo list for one environment. */
export function clearUndoHistoryForEnvironment(environment: Environment): void {
  if (typeof localStorage === "undefined") return;
  const prefix = `${PREFIX}${environment}:`;
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  for (const key of keys) localStorage.removeItem(key);
}
