import type { CommitResult, Household } from "../core/types.ts";
import { reviewedFacts } from "./reviewedFacts.ts";
import { snapshotResources } from "./resources.ts";
import { canonical } from "./patch.ts";
export type CapturedStep = {
  kind: string;
  args: unknown[];
  previewIds: string[];
  reviewed: unknown[];
  resources: { key: string; canonical: string }[];
};
export type CapturedIntent = {
  steps: CapturedStep[];
  observedRevision: number;
};
const captures = new WeakMap<Household, CapturedIntent>();
/** Captures explicit domain intent, never a serialized household. Nested calls collapse into the outer action. */
export function captureCommand<A extends unknown[], R extends CommitResult>(
  kind: string,
  command: (household: Household, ...args: A) => R,
): (household: Household, ...args: A) => R {
  return (household, ...args) => {
    const prior = captures.get(household);
    const result = command(household, ...args);
    let encoded: string;
    try {
      encoded = canonical(args);
    } catch {
      captures.delete(result.household);
      return result;
    }
    if (encoded.length > 128 * 1024) captures.delete(result.household);
    if (encoded.length <= 128 * 1024)
      captures.set(result.household, {
        observedRevision: prior?.observedRevision ?? household.revision,
        steps: [
          ...(prior?.steps ?? []),
          {
            kind,
            args: JSON.parse(encoded) as unknown[],
            previewIds: [...result.postedIds],
            reviewed: reviewedFacts(result),
            resources: snapshotResources(household, kind, args),
          },
        ],
      });
    return result;
  };
}
export function capturedIntent(
  household: Household,
): CapturedIntent | undefined {
  return captures.get(household);
}
export function clearCapturedIntent(household: Household): void {
  captures.delete(household);
}

export function captureExplicit(
  household: Household,
  result: CommitResult,
  kind: string,
  args: unknown[],
): CommitResult {
  captures.set(result.household, {
    observedRevision: household.revision,
    steps: [
      {
        kind,
        args,
        previewIds: [...result.postedIds],
        reviewed: reviewedFacts(result),
        resources: snapshotResources(household, kind, args),
      },
    ],
  });
  return result;
}
