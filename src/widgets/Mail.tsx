import { formatCad, formatDateLabel, isOutgoingBill, MAIL_EMPTY } from "../core/index.ts";
import type { Dashboard } from "../core/insights.ts";

export function MailGlance({ dashboard, today }: { dashboard: Dashboard; today: string }) {
  const next = dashboard.upcoming.find(isOutgoingBill);
  if (!next) return <span>closed</span>;
  const late = next.due || next.date < today;
  return <span>{formatDateLabel(next.date)} · {next.title}{late ? " ·" : ""}</span>;
}

export function MailBody({
  dashboard,
  today,
  onMarkPaid,
  onCalendar,
}: {
  dashboard: Dashboard;
  today: string;
  onMarkPaid: (recurrenceId: string, summary: string) => void;
  onCalendar: () => void;
}) {
  const rows = dashboard.upcoming.filter(isOutgoingBill).slice(0, 3);
  if (!rows.length) return <p className="muted">{MAIL_EMPTY}</p>;
  return (
    <>
      {rows.map((item) => (
        <div className="row" key={item.id}>
          <span>
            {formatDateLabel(item.date)} · {item.title}
            {item.due || item.date < today ? " · lifted" : ""}
          </span>
          <span>{item.direction === "out" ? formatCad(item.amountCents) : formatCad(item.amountCents)}</span>
        </div>
      ))}
      {rows.filter((item) => item.recurrenceId && (item.due || item.date <= today)).map((item) => (
        <button
          key={`pay-${item.id}`}
          type="button"
          className="chip"
          onClick={() => onMarkPaid(item.recurrenceId!, `${item.title} · ${formatCad(item.amountCents)}`)}
        >
          Mark paid
        </button>
      ))}
      <button type="button" className="cabinet-handle" onClick={onCalendar}>Calendar</button>
    </>
  );
}
