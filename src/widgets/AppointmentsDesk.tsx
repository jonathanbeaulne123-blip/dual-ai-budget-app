import { formatCad, formatDateLabel, APPOINTMENTS_EMPTY, appointmentsDeskFacts } from "../core/index.ts";
import type { Household } from "../core/types.ts";
import type { DateKey } from "../core/calendar.ts";

export function AppointmentsGlance({ household, today }: { household: Household; today: DateKey }) {
  const facts = appointmentsDeskFacts(household, today);
  if (facts.empty || !facts.next) return <span>visits</span>;
  return <span>{formatDateLabel(facts.next.date)} · {facts.quietTitle ?? facts.next.title}</span>;
}

export function AppointmentsBody({
  household,
  today,
  busy,
  onStartJar,
  onAppointments,
}: {
  household: Household;
  today: DateKey;
  busy: boolean;
  onStartJar: (appointmentId: string, summary: string) => void;
  onAppointments: () => void;
}) {
  const facts = appointmentsDeskFacts(household, today);
  if (facts.empty) {
    return (
      <>
        <p className="muted">{APPOINTMENTS_EMPTY}</p>
        <button type="button" className="cabinet-handle" onClick={onAppointments}>Appointments</button>
      </>
    );
  }
  return (
    <>
      <p className="muted">Visits, not bills. Claims stay in the tray. Quiet titles stay quiet here.</p>
      {facts.items.map((item) => (
        <div className="row" key={`${item.appointmentId}-${item.date}`}>
          <span>
            {formatDateLabel(item.date)} · {item.title}
            {item.overdue ? " · overdue" : ""}
          </span>
          <span>{formatCad(item.typicalCostCents)}</span>
        </div>
      ))}
      {facts.proposal && (
        <button
          type="button"
          className="primary"
          disabled={busy}
          onClick={() => onStartJar(facts.proposal!.appointmentId, facts.proposal!.hercules)}
        >
          Start jar · {formatCad(facts.proposal.weeklyCents)}/wk
        </button>
      )}
      <button type="button" className="cabinet-handle" onClick={onAppointments}>Appointments</button>
    </>
  );
}
