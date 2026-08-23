export const CALENDAR_INTENT_KEY = "hearth.calendar.intent";

export type CalendarPane = "board" | "visits" | "bills" | "google";

export function requestCalendarPane(
  pane: CalendarPane,
  storage?: { setItem(key: string, value: string): void },
): void {
  if (!storage) return;
  try {
    storage.setItem(CALENDAR_INTENT_KEY, pane);
  } catch {
    /* private mode */
  }
}

export function takeCalendarPane(
  storage?: { getItem(key: string): string | null; removeItem?(key: string): void },
): CalendarPane | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(CALENDAR_INTENT_KEY);
    storage.removeItem?.(CALENDAR_INTENT_KEY);
    if (raw === "board" || raw === "visits" || raw === "bills" || raw === "google") return raw;
  } catch {
    /* private mode */
  }
  return null;
}
