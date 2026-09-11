import type { BoardItem } from "../core/board.ts";

export const calendarLayers = [
  ["bill", "Bills"], ["paycheck", "Paycheques"], ["subscription", "Subscriptions"],
  ["potential-expense", "Potential expenses"], ["event", "Hearth events"],
  ["work", "Shifts and work pay"], ["visit", "Appointments and claims"],
  ["detected", "Suggested patterns"], ["other", "Other reminders"], ["google", "Google events"],
] as const;
export type CalendarVisibility = Record<string, boolean>;
export function calendarItemVisible(item: BoardItem, visibility: CalendarVisibility): boolean {
  const layer = item.source === "work-settlement" || item.source === "shift" || item.source === "shift-envelope" ? "work"
    : item.source === "appointment" || item.source === "claim" ? "visit" : item.kind;
  return visibility[layer] !== false && (item.source !== "google" || !item.calendarId || visibility[`google:${item.calendarId}`] !== false);
}
export function loadCalendarVisibility(key: string): CalendarVisibility {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([, setting]) => typeof setting === "boolean"));
  } catch { return {}; }
}
