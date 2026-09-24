import type { DateKey } from "../../core/calendar.ts";
import type { Household, LedgerView } from "../../core/types.ts";
import type { HarbourReading } from "../data/reading.ts";

/**
 * What every Desk page is handed. A page reads selectors over these and opens
 * existing doors through `onOpen`; nothing a page receives can post money.
 */
export type DeskPageProps = {
  household: Household;
  memberId: string;
  scope: LedgerView;
  today: DateKey;
  /** The harbour's read-model, for door-sign parity. Null before the books answer. */
  reading: HarbourReading | null;
  /** `openHouseObject(target, object)` — the same doors the harbour's buttons open. */
  onOpen: (target: string, object?: string) => void;
  /** Opens the existing Hercules panel. */
  onTalk: () => void;
};

/** What a chip's subtitle reads: the door-sign sentence for that page. */
export type DeskSignContext = { reading: HarbourReading | null; scope: LedgerView };
