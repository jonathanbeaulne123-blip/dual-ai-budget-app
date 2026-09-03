import { useId, type Ref } from "react";
import {
  WEEKDAY_SHORT,
  formatCad,
  formatDayLabel,
  type FundWeek,
  type WeekDay,
  type WeekEntry,
} from "./core/index.ts";

/**
 * What the week contains — due, posted, whose turn. A forward view, not a
 * record: nothing here is a task, and nothing here gets ticked off. Every
 * figure comes straight off `fundWeek`; this component only lays it out.
 */

const KIND_CHIP_CLASS: Record<WeekEntry["kind"], string> = {
  due: "week-chip is-due",
  posted: "week-chip is-posted",
  payday: "week-chip is-payday",
  shift: "week-chip is-shift",
  sitdown: "week-chip is-sitdown",
};

function entryText(entry: WeekEntry, nameOf: (id: string | null | undefined) => string): string {
  if (entry.kind === "shift") return `${nameOf(entry.memberId)} · shift`;
  if (entry.kind === "sitdown") return "Sit down";
  if (entry.kind === "payday") {
    return entry.amountCents != null ? `${nameOf(entry.memberId)} paid · ${formatCad(entry.amountCents)}` : `${nameOf(entry.memberId)} paid`;
  }
  return entry.amountCents != null ? `${entry.label} · ${formatCad(entry.amountCents)}` : entry.label;
}

/** The day money is expected to land, for the glance line — a confirmed payday first, else the next projected one. */
function landingDay(week: FundWeek): WeekDay | null {
  const confirmed = week.days.find((day) => day.entries.some((entry) => entry.kind === "payday" && entry.amountCents != null));
  if (confirmed) return confirmed;
  return week.days.find((day) => day.entries.some((entry) => entry.kind === "payday")) ?? null;
}

export function WeekStage({
  week, nameOf, headingRef,
}: {
  week: FundWeek;
  nameOf: (id: string | null | undefined) => string;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const headingId = useId();
  const first = week.days[0];
  const last = week.days[week.days.length - 1];
  const range = first && last ? `${formatDayLabel(first.date)} – ${formatDayLabel(last.date)}` : "";
  const landing = landingDay(week);
  const landingWeekday = landing ? WEEKDAY_SHORT[landing.weekday] : null;

  return (
    <section className="week-stage" aria-labelledby={headingId}>
      <p className="desk-plate-kicker">This week</p>
      <h2 ref={headingRef} id={headingId} tabIndex={-1} className="fund-stage-heading">
        {week.outCents > 0 ? `−${formatCad(week.outCents)}` : "Quiet"}
      </h2>
      <p className="desk-plate-detail">
        {week.outCents > 0 ? `${formatCad(week.outCents)} leaves this week` : "Nothing leaves this week"}
        {week.inCents > 0
          ? ` and ${formatCad(week.inCents)}${landingWeekday ? ` lands ${landingWeekday}` : " lands"}.`
          : "."}
      </p>
      <p className="week-range">{range} · Copper is leaving, ink is already posted, felt is a payday or a shift. Nothing here is a task.</p>
      <div className="week-grid" role="list">
        {week.days.map((day) => (
          <div key={day.date} className={`week-day${day.isToday ? " is-today" : ""}`} role="listitem">
            <p className="week-day-name">{WEEKDAY_SHORT[day.weekday]}{day.isToday ? " · today" : ""}</p>
            <p className="week-day-number">{Number(day.date.slice(8, 10))}</p>
            {day.entries.length > 0 ? (
              <ul className="week-day-entries">
                {day.entries.map((entry, index) => (
                  <li key={`${entry.kind}-${index}`} className={KIND_CHIP_CLASS[entry.kind]}>
                    {entryText(entry, nameOf)}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
