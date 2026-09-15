import { memories } from "../core/chapters.ts";
import type { Household } from "../core/types.ts";

/**
 * The message in a bottle (a sea cove at least a year old). Pure: the shared
 * calendar note of the trip that carved the cove, else a kept Memory's own
 * words from that month, else a quiet line. Words only: amounts and digit runs
 * are taken out, and only household-visibility events are read.
 */

export const BOTTLE_NOTE_LIMIT = 200;
export const BOTTLE_SILENT = "The sea kept this one to itself.";
const MONEYISH = /\$?\d[\d,]*(\.\d+)?/g;

/** Strip anything that reads like an amount or a number, then tidy the spaces. */
export function bottleWords(text: string | null | undefined): string {
  return String(text ?? "")
    .replace(MONEYISH, "")
    .replace(/\$/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function clip(text: string): string {
  return text.length <= BOTTLE_NOTE_LIMIT ? text : `${text.slice(0, BOTTLE_NOTE_LIMIT - 1).trimEnd()}…`;
}

/** `monthKey` is the YYYY-MM of the month the cove was first carved. */
export function bottleNote(household: Pick<Household, "nativeEvents" | "wins" | "members">, cove: { name: string }, monthKey: string): string {
  const events = (household.nativeEvents ?? []).filter((row) => row.visibility === "household" && !row.deleted && typeof row.start === "string" && row.start.startsWith(monthKey));
  const trip = events.find((row) => (row.title ?? "").slice(0, 60) === cove.name) ?? null;
  const fromTrip = bottleWords(trip?.notes);
  if (fromTrip) return clip(fromTrip);
  for (const memory of memories(household)) {
    if (!memory.shownAt?.startsWith(monthKey)) continue;
    const words = bottleWords(memory.authoredNote);
    if (words) return clip(words);
  }
  return BOTTLE_SILENT;
}
