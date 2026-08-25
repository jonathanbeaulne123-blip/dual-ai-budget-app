import { DEFAULT_TIMEZONE, isValidIanaTimeZone } from "./calendar.ts";

/** Curated zones for the More picker. Full IANA remains valid via free-text/detect. */
export const COMMON_TIME_ZONES = [
  "America/Toronto",
  "America/Vancouver",
  "America/Edmonton",
  "America/Winnipeg",
  "America/Halifax",
  "America/St_Johns",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Asia/Kolkata",
  "Australia/Sydney",
  "Pacific/Auckland",
  "UTC",
] as const;

export function listPickerTimeZones(): string[] {
  const supported =
    typeof Intl !== "undefined" && "supportedValuesOf" in Intl
      ? (Intl as typeof Intl & { supportedValuesOf(key: "timeZone"): string[] }).supportedValuesOf("timeZone")
      : [];
  const merged = new Set<string>([...COMMON_TIME_ZONES, ...supported]);
  return [...merged].filter((zone) => isValidIanaTimeZone(zone)).sort((left, right) => left.localeCompare(right));
}

/** Best-effort device zone. Falls back to America/Toronto when the runtime zone is missing or invalid. */
export function detectDeviceTimeZone(now = new Date()): string {
  try {
    const guessed = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (guessed && isValidIanaTimeZone(guessed, now)) return guessed;
  } catch {
    // ignore
  }
  return DEFAULT_TIMEZONE;
}

export function formatZoneLabel(timeZone: string, now = new Date()): string {
  if (!isValidIanaTimeZone(timeZone, now)) return timeZone;
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      timeZoneName: "shortOffset",
      hour: "numeric",
      minute: "2-digit",
    }).formatToParts(now);
    const offset = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
    return offset ? `${timeZone} (${offset})` : timeZone;
  } catch {
    return timeZone;
  }
}
