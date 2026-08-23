import { formatDateLabel, CALENDAR_EMPTY, calendarDeskFacts, formatCad } from "../core/index.ts";
import type { Household } from "../core/types.ts";
import type { DateKey } from "../core/calendar.ts";

export function CalendarGlance({ household, today }: { household: Household; today: DateKey }) {
  const facts = calendarDeskFacts(household, today);
  if (facts.empty || !facts.next) return <span>month</span>;
  return <span>{formatDateLabel(facts.next.date)} · {facts.next.title}</span>;
}

export function CalendarBody({
  household,
  today,
  onCalendar,
}: {
  household: Household;
  today: DateKey;
  onCalendar: () => void;
}) {
  const facts = calendarDeskFacts(household, today);
  if (facts.empty) {
    return (
      <>
        <p className="muted">{CALENDAR_EMPTY}</p>
        <button type="button" className="cabinet-handle" onClick={onCalendar}>Calendar</button>
      </>
    );
  }
  return (
    <>
      {facts.items.map((item) => (
        <div className="row" key={item.id}>
          <span>{formatDateLabel(item.date)} · {item.title}</span>
          <span>{item.kind === "visit" || item.kind === "shift" || item.kind === "google" ? item.kind : formatCad(item.amountCents)}</span>
        </div>
      ))}
      <p className="muted">Dates remind. Mark paid still lives on Calendar.</p>
      <button type="button" className="cabinet-handle" onClick={onCalendar}>Open month</button>
    </>
  );
}
