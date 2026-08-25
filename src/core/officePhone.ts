import { isOutgoingBill, type BoardItem } from "./board.ts";
import {
  PINNED_INSTRUMENTS,
  type InstrumentId,
  type OfficeLayout,
} from "./officeLayout.ts";

/** Which phone desk is honest for this household. Not persisted. */
export type PhoneDeskKey = "household" | "tracker";

/**
 * The objects that can live on the phone Home board.
 * Calendar and games stay in the nav; they are not a sixth tile.
 */
export const PHONE_SHELL_IDS = [
  "blotter",
  "calculator",
  "timesheet",
  "chalkboard",
  "jars",
  "lamp",
  "mail",
  "wallet",
] as const satisfies readonly InstrumentId[];

export type PhoneShellId = (typeof PHONE_SHELL_IDS)[number];

/** Five or fewer at rest. The pad can never leave. */
export const PHONE_DESKS: Record<PhoneDeskKey, InstrumentId[]> = {
  household: ["blotter", "calculator", "timesheet", "chalkboard", "jars"],
  tracker: ["blotter", "calculator", "wallet", "mail"],
};

export function isPhoneShellId(id: string): id is PhoneShellId {
  return (PHONE_SHELL_IDS as readonly string[]).includes(id);
}

/** Household unless there are no shifts and no chalk — then Tracker is honest. */
export function phoneDeskKey(input: { shiftCount: number; chalkboardLength: number }): PhoneDeskKey {
  return input.shiftCount === 0 && input.chalkboardLength === 0 ? "tracker" : "household";
}

/**
 * Visible phone rail. Pins the calculator (D-070). Appends Health when it is
 * lit. Guest-appends a stamp or drawer target so Due can open Mail on a
 * Household desk that does not otherwise show it.
 */
export function phoneRailOrder(input: {
  desk: PhoneDeskKey;
  hidden: Iterable<InstrumentId>;
  lampLit: boolean;
  expanded?: InstrumentId | "window" | null;
}): InstrumentId[] {
  const hidden = input.hidden instanceof Set ? input.hidden : new Set(input.hidden);
  const rail = PHONE_DESKS[input.desk].filter((id) => PINNED_INSTRUMENTS.includes(id) || !hidden.has(id));
  if (input.lampLit && !hidden.has("lamp") && !rail.includes("lamp")) rail.push("lamp");
  const guest = input.expanded;
  if (guest && guest !== "window" && isPhoneShellId(guest) && !rail.includes(guest)) {
    rail.push(guest);
  }
  return rail;
}

/** Un-hide (or insert) an instrument and expand it. Phone layout key only. */
export function revealPhoneInstrument(layout: OfficeLayout, id: InstrumentId): OfficeLayout {
  const items = layout.items.some((item) => item.id === id)
    ? layout.items.map((item) => (item.id === id ? { ...item, hidden: false } : item))
    : [...layout.items, { id }];
  return { ...layout, items, expanded: id };
}

/** Next outgoing bill for the Due stamp. Visits and income never win (D-054 / D-076). */
export function phoneDueBill<T extends Pick<BoardItem, "kind" | "direction">>(upcoming: T[]): T | undefined {
  return upcoming.find(isOutgoingBill);
}

export function phoneDrawerIds(rail: InstrumentId[]): PhoneShellId[] {
  return PHONE_SHELL_IDS.filter((id) => !rail.includes(id));
}
