import type { DateKey } from "./calendar.ts";
import type { InstrumentId } from "./officeLayout.ts";
import type { LedgerView } from "./types.ts";

export type HerculesSourceRoute = "home" | "plan" | "calendar" | "ledger" | "more";

/**
 * A number shown by Hercules is clickable only when the books code supplies one
 * of these records. UI code must never infer a source by scanning arbitrary
 * prose for digits or currency symbols.
 */
export type HerculesNumberSource = {
  route: HerculesSourceRoute;
  view: LedgerView;
  label: string;
  surface?: InstrumentId | "window";
  memberId?: string;
  accountId?: string;
  categoryId?: string;
  transactionId?: string;
  recurrenceId?: string;
  claimId?: string;
  goalId?: string;
  shiftId?: string;
  from?: DateKey;
  to?: DateKey;
};

export type HerculesGroundedFact = {
  id: string;
  label: string;
  value: string;
  source: HerculesNumberSource;
  basis: "journal" | "projection";
};

export function herculesFactId(label: string, value: string, index: number): string {
  return `${index}:${label}:${value}`;
}
