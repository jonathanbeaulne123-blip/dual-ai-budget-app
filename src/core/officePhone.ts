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

/** Up to four story scraps for the 2×2 strip — pad and chalk stay elsewhere. */
export function phoneStoryIds(order: InstrumentId[]): InstrumentId[] {
  return order.filter((id) => id !== "chalkboard" && id !== "calculator").slice(0, 4);
}

/** Seals are an indivisible row of three objects, never one disguised slot. */
export type PhoneFoldId = InstrumentId | "weather" | "needs" | "seals" | "apron";
export type PhoneFoldItem = { id: PhoneFoldId; slots: number; wide: boolean };

/** Presentation only. Urgency cannot be hidden by an old layout preference. */
export function phoneFoldOrder(input: {
  stories: InstrumentId[];
  ownShift: boolean;
  overdue: boolean;
  health: boolean;
  needs: boolean;
  apron?: boolean;
}): PhoneFoldItem[] {
  const urgent: InstrumentId[] = [
    ...(input.ownShift ? ["timesheet" as const] : []),
    ...(input.health ? ["lamp" as const] : []),
    ...(input.overdue ? ["mail" as const] : []),
  ];
  const ids: PhoneFoldId[] = [...(input.apron ? ["apron" as const] : []), ...urgent, ...(input.needs ? ["needs" as const] : []),
    "weather", "seals", ...input.stories];
  return [...new Set(ids)].map((id) => ({
    id, slots: id === "seals" ? 3 : 1,
    wide: id === "weather" || id === "needs" || id === "seals" || id === "apron",
  }));
}

/** Admit a ranked prefix: four objects at most, and only whole measured rows. */
export function phoneFoldCount(items: PhoneFoldItem[], heights?: ReadonlyMap<PhoneFoldId, number>, maxHeight = Infinity, gap = 12): number {
  let slots = 0, used = 0, rowHeight = 0, halfRow = false, count = 0;
  for (const item of items) {
    if (slots + item.slots > 4) break;
    const height = heights?.get(item.id) ?? 0;
    let nextUsed = used, nextRow = rowHeight;
    if (item.wide || !halfRow) {
      nextUsed += (count ? gap : 0) + height;
      nextRow = height;
    } else {
      nextUsed += Math.max(0, height - rowHeight);
      nextRow = Math.max(rowHeight, height);
    }
    if (nextUsed > maxHeight) break;
    used = nextUsed; rowHeight = nextRow;
    halfRow = !item.wide && !halfRow;
    slots += item.slots; count++;
  }
  return count;
}
