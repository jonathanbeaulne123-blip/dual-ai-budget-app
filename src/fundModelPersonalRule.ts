import { splitForSync } from "./core/sync.ts";
import type { Household } from "./core/types.ts";

/**
 * The cloud-authority rule for a member's own money-model step (D-281, review H3).
 * `migrateMyFundModel` and a personal `setFundOverride` come back as
 * member-personal `updateFundModel` results. They may change only this
 * member's own Personal envelope, and only its money-model rows, its own
 * bank designs and its own Plan drafts. The Shared envelope stays byte-equal.
 */
export function fundModelPersonalUpdateAllowed(current: Household, next: Household, who: string): boolean {
  if (current.environment !== next.environment || current.householdId !== next.householdId) return false;
  const before = splitForSync(current, who);
  const after = splitForSync(next, who);
  if (JSON.stringify(after.shared) !== JSON.stringify(before.shared)) return false;
  const normalized = structuredClone(after.personal) as unknown as Record<string, unknown>;
  const original = before.personal as unknown as Record<string, unknown>;
  for (const key of ["fundModelRows", "kittyNestDesigns", "planDrafts"]) {
    if (key in original) normalized[key] = original[key];
    else delete normalized[key];
  }
  if (JSON.stringify(normalized) !== JSON.stringify(original)) return false;
  // Every personal money-model row in the result is this member's own.
  const rows = (after.personal as unknown as { fundModelRows?: Array<{ visibility?: string; setBy?: string }> }).fundModelRows ?? [];
  return rows.every((row) => row.visibility !== "personal" || row.setBy === who);
}
