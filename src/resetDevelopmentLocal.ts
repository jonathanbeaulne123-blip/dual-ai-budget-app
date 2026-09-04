import type { Environment } from "./core/types.ts";
import { disconnectGoogle } from "./google/index.ts";
import { clearContinuityOutbox } from "./continuity.ts";
import { wipeBrowserBooks, wipeStagedBooksForEnvironment } from "./ledger/engine.ts";
import { clearSession } from "./session.ts";
import { clearAllHouseholdReplicas, listHouseholdReplicas } from "./storage.ts";
import { clearSyncAnchorsForEnvironment } from "./syncAnchor.ts";
import { clearUndoHistoryForEnvironment } from "./undoHistory.ts";

/**
 * Development-only local wipe: replicas, books, outbox, Undo, and member Google
 * tokens. Auth/Google welcome session stays so Create household can run next.
 */
export async function wipeLocalDevelopmentCopies(environment: Environment): Promise<void> {
  if (environment !== "development") {
    throw new Error("Start from scratch is Development only. Production stays.");
  }
  const catalog = await listHouseholdReplicas(environment);
  for (const item of catalog) {
    for (const memberId of item.memberIds) disconnectGoogle(environment, memberId);
  }
  clearUndoHistoryForEnvironment(environment);
  clearSyncAnchorsForEnvironment(environment);
  clearContinuityOutbox(environment);
  await wipeStagedBooksForEnvironment(environment, catalog.map((item) => item.householdId));
  await clearAllHouseholdReplicas(environment);
  await wipeBrowserBooks(environment);
  clearSession(environment);
}
