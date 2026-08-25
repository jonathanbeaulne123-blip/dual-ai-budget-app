import { TIMEZONE, dateKeyInZone, type DateKey } from "./calendar.ts";
import { activeOpenShift } from "./shiftClock.ts";
import type { Household } from "./types.ts";

export type TorontoClockParts = {
  hour: number;
  minute: number;
  second: number;
  dateKey: DateKey;
};

export type AnalogAngles = {
  hour: number;
  minute: number;
  second: number;
};

export type ShiftClockSpan = {
  startedAt: string;
  endedAt: string;
  live: boolean;
  startAngle: number;
  endAngle: number;
};

function partNumber(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  return Number(parts.find((part) => part.type === type)?.value ?? 0);
}

/** Analog hands follow America/Toronto wall time, never the runtime zone. */
export function torontoClockParts(now = new Date(), timeZone: string = TIMEZONE): TorontoClockParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = String(partNumber(parts, "year")).padStart(4, "0");
  const month = String(partNumber(parts, "month")).padStart(2, "0");
  const day = String(partNumber(parts, "day")).padStart(2, "0");
  return {
    hour: partNumber(parts, "hour"),
    minute: partNumber(parts, "minute"),
    second: partNumber(parts, "second"),
    dateKey: `${year}-${month}-${day}`,
  };
}

export function analogAngles(parts: Pick<TorontoClockParts, "hour" | "minute" | "second">): AnalogAngles {
  const hour = (parts.hour % 12) * 30 + parts.minute * 0.5 + parts.second * (0.5 / 60);
  const minute = parts.minute * 6 + parts.second * 0.1;
  const second = parts.second * 6;
  return { hour, minute, second };
}

export function clockAngleFromInstant(iso: string, timeZone: string = TIMEZONE): number {
  return analogAngles(torontoClockParts(new Date(iso), timeZone)).hour;
}

function polar(cx: number, cy: number, radius: number, angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

/** SVG arc from one 12-hour clock angle to another. Sweep is clockwise. */
export function clockArcPath(startAngle: number, endAngle: number, cx = 50, cy = 50, radius = 34): string {
  const start = ((startAngle % 360) + 360) % 360;
  let sweep = ((endAngle % 360) + 360) % 360 - start;
  if (sweep <= 0) sweep += 360;
  if (sweep < 1) return "";
  const from = polar(cx, cy, radius, start);
  const to = polar(cx, cy, radius, start + sweep);
  const large = sweep > 180 ? 1 : 0;
  return `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
}

/**
 * Live punch always draws. A finished shift draws only when it started that Toronto day.
 * New days with no punch are a plain clock.
 */
export function todayShiftSpan(household: Household, today: DateKey, nowMs = Date.now()): ShiftClockSpan | null {
  const punch = activeOpenShift(household.kitchen);
  if (punch) {
    return {
      startedAt: punch.startedAt,
      endedAt: new Date(nowMs).toISOString(),
      live: true,
      startAngle: clockAngleFromInstant(punch.startedAt),
      endAngle: clockAngleFromInstant(new Date(nowMs).toISOString()),
    };
  }
  const posted = [...household.shifts]
    .filter((shift) => shift.date === today)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  if (!posted) return null;
  const endedAt = posted.createdAt || new Date(nowMs).toISOString();
  const startMs = Date.parse(endedAt) - posted.hours * 3_600_000;
  if (!Number.isFinite(startMs)) return null;
  const startedAt = new Date(startMs).toISOString();
  if (dateKeyInZone(new Date(startedAt)) !== today && posted.date !== today) return null;
  return {
    startedAt,
    endedAt,
    live: false,
    startAngle: clockAngleFromInstant(startedAt),
    endAngle: clockAngleFromInstant(endedAt),
  };
}
