import type { BookDivision } from "./HouseBooks.tsx";

/**
 * The Bindery — the five machines on the Library's bench, and the division of
 * the Standing Book each one opens.
 *
 * The Library hall (LITTLE_HARBOUR_v2 §6) stands five named machines on the
 * Bindery bench, and its own plate has always said "one machine per divider".
 * This table is that sentence, written down: a machine carries a door object
 * (`books` + `bindery/<id>`, the same `surface/objectId` grammar the atlas and
 * the loft already use) and the book turns to the division it names.
 *
 * The divisions are `HouseBooks`' own ribbons — presentation, remembered per
 * member in that component's state. Nothing here is a `FundWidgetId`, a
 * `DeskPlateId` or any other synced id: a deep link is a place in a book, not
 * a setting, and it invents no persisted name.
 *
 * The pairing is the one the pop-up work already agreed
 * (`claude/POPUP-BEACONS-AND-RULE.md`, "the five binder dividers map to
 * scenes"): the accounts → Cut Bank, where it goes → Lantern Row, what's
 * leaving → Low Water, the shelf (goals) → the Glasshouse pane, between us
 * (who put in what) → the Handoff bench.
 */
export type BinderyMachineId = "lantern-row" | "low-water" | "cut-bank" | "glasshouse-pane" | "handoff-bench";

export type BinderyMachine = {
  id: BinderyMachineId;
  /** The vision's own words, in the vision's own order. */
  name: string;
  /** The division of the Standing Book this machine opens. */
  division: BookDivision;
  /** What the machine is for, in the room's voice. */
  line: string;
};

/** The five machines, in the vision's own order and words. */
export const BINDERY_MACHINES: readonly BinderyMachine[] = Object.freeze([
  { id: "lantern-row", name: "Lantern Row", division: "Spending", line: "did we spend what we meant" },
  { id: "low-water", name: "Low Water", division: "Bills", line: "what is leaving, and whether it lasts" },
  { id: "cut-bank", name: "Cut Bank", division: "Accounts", line: "what a balance is made of" },
  { id: "glasshouse-pane", name: "The Glasshouse pane", division: "Goals", line: "the shelf, and what is growing on it" },
  { id: "handoff-bench", name: "The Handoff bench", division: "Contributions", line: "between us — who put in what" },
] as const satisfies readonly BinderyMachine[]);

/** The prefix a Bindery door's object carries, so nothing else is mistaken for one. */
export const BINDERY_DOOR_PREFIX = "bindery/";

/** The door object for a machine: `bindery/<id>`, the house's `surface/objectId` grammar. */
export function binderyDoorObject(id: BinderyMachineId): string {
  return `${BINDERY_DOOR_PREFIX}${id}`;
}

/** The machine a route object names, or null for every other address the books surface carries. */
export function binderyMachine(object: string | null | undefined): BinderyMachine | null {
  if (typeof object !== "string" || !object.startsWith(BINDERY_DOOR_PREFIX)) return null;
  const id = object.slice(BINDERY_DOOR_PREFIX.length);
  return BINDERY_MACHINES.find((machine) => machine.id === id) ?? null;
}

/**
 * The division the books surface should arrive on, for a route object. Null
 * when the address names no machine — the book then opens where its reader
 * left it, exactly as before.
 */
export function binderyDivisionFor(object: string | null | undefined): BookDivision | null {
  if(object === "chapter/today")return "Today";
  if(object === "chapter/record")return "Record";
  return binderyMachine(object)?.division ?? null;
}
