import { householdFundMarker } from "../core/fundRules.ts";
import type { Household } from "../core/types.ts";

/**
 * The money-model stamp (D-269, review R2-H1).
 *
 * Release N (this flag off) sends `fundModelVersion: 1`; release N+1 (flag on)
 * sends 2 and is the only build that migrates. The authority refuses every
 * command below 2 once the household marker exists, so a phone that is still
 * on N — or a code rollback to N — fails closed (writes pause behind a reload
 * banner) instead of writing old meaning onto new data.
 */
export function clientFundModelVersion(flag: string | undefined = readFlag()): 1 | 2 {
  return flag === "1" ? 2 : 1;
}
function readFlag(): string | undefined {
  try {
    return (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_FUND_MODEL_V2;
  } catch {
    return undefined;
  }
}

/** Command kinds that write the fund-model collection (and its undo/continuity kind). */
export const FUND_MODEL_COMMAND_KINDS = [
  "migrateFundModel", "migrateMyFundModel", "setFundOverride", "setCategoryHome",
  "proposeFundDivision", "agreeFundDivision", "declineFundDivision",
  "proposeProtectRefill", "agreeProtectRefill", "declineProtectRefill", "withdrawFundProposal",
  // Category writes check the umbrella lock server-side; they carry the stamp once migrated like every other command.
  "updateFundModel",
];

/**
 * The read-side detector: the snapshot was sorted by a newer money model than
 * this build writes. Money screens show "Hearth has updated how money is
 * sorted — reload" and stay read-only until the phone reloads.
 */
export function fundModelReloadRequired(household: Pick<Household, "fundModelRows">, clientVersion: 1 | 2 = clientFundModelVersion()): boolean {
  const marker = householdFundMarker(household);
  return Boolean(marker && marker.version > clientVersion);
}

export const FUND_MODEL_RELOAD_MESSAGE = "Hearth has updated how money is sorted. Reload to keep going; nothing you saved is lost.";
