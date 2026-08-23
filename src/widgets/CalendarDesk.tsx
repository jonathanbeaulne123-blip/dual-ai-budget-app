import { useState } from "react";
import {
  addDays,
  CALENDAR_EMPTY,
  calendarDeskModel,
  formatCad,
  formatDayLabel,
  formatTorontoTime,
  monthKeyFromDateKey,
  shiftMonthKey,
  weekBounds,
  WEEKDAY_SHORT,
  type CalendarDeskView,
} from "../core/index.ts";
import type { BoardItem } from "../core/board.ts";
import type { Household } from "../core/types.ts";
import type { DateKey } from "../core/calendar.ts";

function kindLabel(kind: string): string {
  if (kind === "paycheck") return "Pay";
  if (kind === "subscription") return "Sub";
  if (kind === "detected") return "New";
  if (kind === "shift") return "Shift";
  if (kind === "google") return "GCal";
  if (kind === "visit") return "Visit";
  if (kind === "claim") return "Owed";
  return "Bill";
}

function amountFor(item: BoardItem): string {
  if (!item.amountCents) return item.kind;
  if (item.kind === "shift") return formatCad(item.amountCents);
  if (item.kind === "visit" || item.kind === "google") return item.kind;
  return formatCad(item.amountCents);
}

export function CalendarGlance({ household, today }: { household: Household; today: DateKey }) {
  const model = calendarDeskModel(household, today, "day", today);
  if (model.empty || !model.next) return <span>today</span>;
  return <span>{formatDayLabel(model.next.date)} · {model.next.title}</span>;
}

function ItemRow({ item }: { item: BoardItem }) {
  return (
    <div className="row cal-desk-row">
      <span>
        <span className={`kind-pill ${item.kind}`}>{kindLabel(item.kind)}</span>
        {" "}{formatDayLabel(item.date)} · {item.title}
      </span>
      <span className={item.direction === "out" ? "right" : "muted"}>{amountFor(item)}</span>
    </div>
  );
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
  const [view, setView] = useState<CalendarDeskView>("day");
  const [focus, setFocus] = useState<DateKey>(today);
  const model = calendarDeskModel(household, today, view, focus);

  function step(delta: number) {
    if (view === "day") setFocus(addDays(focus, delta));
    else if (view === "week") setFocus(addDays(focus, delta * 7));
    else setFocus(`${shiftMonthKey(monthKeyFromDateKey(focus), delta)}-01`);
  }

  const heading = view === "day"
    ? formatDayLabel(focus)
    : view === "week"
      ? `${formatDayLabel(weekBounds(focus).start)}–${formatDayLabel(weekBounds(focus).end)}`
      : model.board.monthLabel;

  return (
    <>
      <div className="chips cal-desk-views">
        {(["day", "week", "month"] as const).map((id) => (
          <button key={id} type="button" className={`chip ${view === id ? "selected" : ""}`} onClick={() => setView(id)}>
            {id}
          </button>
        ))}
      </div>
      <div className="cal-desk-nav">
        <button type="button" className="chip" onClick={() => step(-1)} aria-label="Previous">‹</button>
        <strong>{heading}</strong>
        <button type="button" className="chip" onClick={() => step(1)} aria-label="Next">›</button>
      </div>
      {view === "day" && focus === today && (
        <p className="muted">Today’s board. Shifts show take-home. Owed is when a claim should land.</p>
      )}
      {view === "month" && (
        <div className="cal-desk-grid" aria-hidden="true">
          {WEEKDAY_SHORT.map((label) => <span key={label}>{label[0]}</span>)}
          {model.board.days.map((day) => (
            <button
              key={day.date}
              type="button"
              className={[
                "cal-desk-cell",
                day.inMonth ? "" : "outside",
                day.date === today ? "today" : "",
                day.date === focus ? "selected" : "",
              ].join(" ")}
              onClick={() => {
                setFocus(day.date);
                setView("day");
              }}
            >
              {Number(day.date.slice(8))}
              {day.items.length > 0 && <i />}
            </button>
          ))}
        </div>
      )}
      {model.items.length === 0 ? (
        <p className="muted">{CALENDAR_EMPTY}</p>
      ) : (
        model.items.map((item) => <ItemRow key={item.id} item={item} />)
      )}
      {view === "day" && model.items.some((item) => item.kind === "shift") && (
        <p className="muted">
          Shift income is wages plus net tips.
          {model.items.filter((item) => item.kind === "shift").map((item) => (
            item.memberId ? ` Posted ${formatTorontoTime(household.shifts.find((row) => `shift:${row.id}` === item.id)?.createdAt || "")}.` : ""
          )).join("")}
        </p>
      )}
      <p className="muted">Dates remind. Mark paid still lives on Calendar.</p>
      <button type="button" className="cabinet-handle" onClick={onCalendar}>Open month</button>
    </>
  );
}