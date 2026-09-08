export const CALENDAR_INTENT_KEY = "hearth.calendar.intent";

export type CalendarPane = "calendar" | "board" | "visits" | "bills";

/** board remains the Month deep link; google targets its integration section. */
export type CalendarIntent = CalendarPane | "google";

export function requestCalendarPane(
  pane: CalendarIntent,
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
): CalendarIntent | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(CALENDAR_INTENT_KEY);
    storage.removeItem?.(CALENDAR_INTENT_KEY);
    if (raw === "calendar" || raw === "board" || raw === "visits" || raw === "bills" || raw === "google") return raw;
  } catch {
    /* private mode */
  }
  return null;
}
