import type { CommandOutcome, CommitResult, Household } from "./core/index.ts";

// Optional receipt plumbing; older callers may still return void. An absent
// result is not a rejection: only the boundary can guarantee that nothing wrote.
export type KitchenCommandOptions = { confirmationId?: string; onDefinitiveRejected?: (rejection?: { retryable: boolean }) => void };
export type KitchenCommandResult = CommandOutcome | null | void;
export type KitchenCommand = (
  fn: (current: Household) => CommitResult,
  options?: KitchenCommandOptions,
) => KitchenCommandResult | Promise<KitchenCommandResult>;
