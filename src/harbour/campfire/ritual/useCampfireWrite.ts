import { useCallback, useState } from "react";
import type { CommitResult, Household } from "../../../core/types.ts";

/**
 * The App's `run` (`runKitchen`), as the Campfire needs it: a command in, an
 * outcome (or nothing) back. Looser than `KitchenCommand` so a test harness or
 * the Chapter proof can hand in its own synthetic run.
 */
export type CampfireRun = (fn: (current: Household) => CommitResult) => unknown;

/** A command outcome the App's `run` handed back: `ok: false` is a refusal, `null` is "not saved", anything else is accepted. */
export function outcomeRefusal(outcome: unknown): string | null {
  if (outcome === null) return "Not saved yet. Read the latest and try again.";
  if (outcome && typeof outcome === "object" && "ok" in outcome && (outcome as { ok?: unknown }).ok === false) {
    const message = (outcome as { userMessage?: unknown }).userMessage;
    return typeof message === "string" && message ? message : "Not saved. Nothing changed.";
  }
  return null;
}

/**
 * Every write at the Campfire goes through here: the App's own `run`
 * (`runKitchen`) with an existing captured command, then one `role="status"`
 * line that says what happened ("Books closed for September"), or one
 * `role="alert"` line that says why nothing changed.
 */
export function useCampfireWrite(onCommand: CampfireRun) {
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const write = useCallback(async (fn: (current: Household) => CommitResult, message: string): Promise<boolean> => {
    setError(null);
    try {
      const outcome = await onCommand(fn);
      const refusal = outcomeRefusal(outcome);
      if (refusal) { setError(refusal); return false; }
      setStatus(message);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Not saved. Nothing changed.");
      return false;
    }
  }, [onCommand]);
  /** For the shared Chapter controls, which read the outcome themselves: pass it through, and announce acceptance. */
  const relay = useCallback(async (fn: (current: Household) => CommitResult): Promise<unknown> => {
    setError(null);
    const outcome = await onCommand(fn);
    if (!outcomeRefusal(outcome)) setStatus("Saved at the Campfire");
    return outcome;
  }, [onCommand]);
  return { write, relay, status, setStatus, error, setError };
}
