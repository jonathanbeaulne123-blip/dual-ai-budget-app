/**
 * This week (rulings 7, 13): Monday to Sunday around today, anchored to the Monday of the current week, today
 * highlighted within it. Sizes: today's tile is "today"; a day with at least one in/out stop is "money"; any other
 * day is a "stone" (still a real, selectable day). The pile is the "to check" stops dated OUTSIDE the week (before
 * Monday, or a needs-review bill after Sunday), pinned to the first tile; a "to check" stop inside the week stays on
 * its own day. Pile + the week's own "to check" stops = every "to check" stop, each once. Pinned is not paid.
 */
import { addDays, weekdaySunday0, type DateKey } from "../../core/calendar.ts";
import { isToCheck, type JourneyWeek, type Stop, type WeekDay } from "../contracts.ts";
import { directionOf } from "./money.ts";
import { relationOf } from "./stopKit.ts";

/** The Monday on or before `today` (Hearth's books weeks run Sunday–Saturday; the Week map runs Monday–Sunday). */
export function mondayOf(today: DateKey): DateKey {
  return addDays(today, -((weekdaySunday0(today) + 6) % 7));
}

export function weekOf(stops: readonly Stop[], today: DateKey): JourneyWeek {
  const from = mondayOf(today), to = addDays(from, 6);
  const days: WeekDay[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDays(from, offset);
    const onDay = stops.filter(stop => stop.date === date);
    const relation = relationOf(date, today);
    days.push({
      date, relation, stopIds: onDay.map(stop => stop.id),
      size: relation === "today" ? "today" : onDay.some(stop => directionOf(stop) !== "none") ? "money" : "stone",
    });
  }
  return { from, to, days, pileStopIds: stops.filter(stop => isToCheck(stop) && (stop.date < from || stop.date > to)).map(stop => stop.id) };
}
