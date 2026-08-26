import { useMemo, useState } from "react";
import {
  APPOINTMENT_KINDS,
  HOSTED_DISCLOSURE,
  addAppointment,
  agedReceivables,
  appointmentPublicTitle,
  claimPublicLabel,
  craMedicalLog,
  estimateRecoveryCents,
  formatAgingBucket,
  formatAppointmentCadence,
  formatCad,
  formatClaimStatus,
  formatCoverage,
  formatDayLabel,
  groupAgedReceivables,
  groupUpcomingVisits,
  pickVisitAccountId,
  pickVisitMember,
  pickVisitSubcategory,
  postedVisitsFor,
  proposeVisitGoal,
  shapeCadence,
  submitClaim,
  suggestedAppointmentCadence,
  suggestedAppointmentSensitivity,
  sumDraftLineCents,
  typicalVisitDraft,
  upcomingVisitBoard,
  updateAppointment,
  visitCadenceCompare,
  visitPostSummary,
  type Appointment,
  type AppointmentCadence,
  type AppointmentCoverage,
  type AppointmentKind,
  type AppointmentSensitivity,
  type BillLine,
  type CommitResult,
  type DateKey,
  type Household,
  type VisitDraftLine,
  type VisitPostDraft,
} from "./core/index.ts";

type Screen = "upcoming" | "owed" | "medical" | "add" | "detail" | "edit";

const CADENCE_KINDS: { id: AppointmentCadence["kind"]; label: string }[] = [
  { id: "once", label: "Office calls you" },
  { id: "weekly", label: "Every N weeks" },
  { id: "monthly", label: "Every N months" },
  { id: "days", label: "Every N days" },
  { id: "nthWeekday", label: "Nth weekday" },
];

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const NTHS: { id: number; label: string }[] = [
  { id: 1, label: "1st" },
  { id: 2, label: "2nd" },
  { id: 3, label: "3rd" },
  { id: 4, label: "4th" },
  { id: -1, label: "Last" },
];

function kindLabel(kind: string): string {
  return APPOINTMENT_KINDS.find((item) => item.id === kind)?.label ?? "Visit";
}

function partyLabel(household: Household, memberId: string): string {
  if (memberId === "joint") return "Both of you";
  if (memberId === "companion") return household.kitchen.companion.name || "Hercules";
  return household.members.find((member) => member.id === memberId)?.name ?? memberId;
}

function healthFallback(household: Household): string {
  return household.categories.find((item) => item.parentId === "CAT-HEALTH" && item.recordType === "category" && item.active)?.id
    ?? household.categories.find((item) => item.recordType === "category" && item.transactionType === "expense" && item.active)?.id
    ?? "";
}

function BillLinesList({ lines }: { lines: BillLine[] }) {
  if (!lines.length) return null;
  return (
    <ul className="visit-lines">
      {lines.map((line) => (
        <li key={line.id}>
          <span>{line.code ? `${line.code} · ` : ""}{line.description}</span>
          <span>{formatCad(line.amountCents)}</span>
        </li>
      ))}
    </ul>
  );
}

function CadenceFields(props: {
  cadence: AppointmentCadence;
  onChange: (cadence: AppointmentCadence) => void;
}) {
  const { cadence } = props;
  return (
    <>
      <label>Cadence</label>
      <select
        value={cadence.kind}
        onChange={(event) => props.onChange(shapeCadence({
          ...cadence,
          kind: event.target.value as AppointmentCadence["kind"],
          interval: "interval" in cadence ? cadence.interval : 1,
          weekday: cadence.kind === "nthWeekday" ? cadence.weekday : 2,
          nth: cadence.kind === "nthWeekday" ? cadence.nth : 3,
          intervalMonths: cadence.kind === "nthWeekday" ? cadence.intervalMonths : 1,
        }))}
      >
        {CADENCE_KINDS.map((item) => (
          <option key={item.id} value={item.id}>{item.label}</option>
        ))}
      </select>
      {(cadence.kind === "weekly" || cadence.kind === "monthly" || cadence.kind === "days") && (
        <>
          <label>{cadence.kind === "weekly" ? "Weeks" : cadence.kind === "monthly" ? "Months" : "Days"}</label>
          <input
            type="number"
            min={1}
            value={cadence.interval}
            onChange={(event) => props.onChange(shapeCadence({ ...cadence, interval: Number(event.target.value) || 1 }))}
          />
        </>
      )}
      {cadence.kind === "nthWeekday" && (
        <div className="visit-cadence-nth">
          <label>
            Which
            <select value={cadence.nth} onChange={(event) => props.onChange(shapeCadence({ ...cadence, nth: Number(event.target.value) }))}>
              {NTHS.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <label>
            Weekday
            <select value={cadence.weekday} onChange={(event) => props.onChange(shapeCadence({ ...cadence, weekday: Number(event.target.value) }))}>
              {WEEKDAYS.map((label, index) => (
                <option key={label} value={index}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            Every N months
            <input
              type="number"
              min={1}
              value={cadence.intervalMonths}
              onChange={(event) => props.onChange(shapeCadence({ ...cadence, intervalMonths: Number(event.target.value) || 1 }))}
            />
          </label>
        </div>
      )}
      <p className="muted">{formatAppointmentCadence(cadence)}</p>
    </>
  );
}

function AppointmentForm(props: {
  household: Household;
  today: DateKey;
  memberId: string;
  busy: boolean;
  existing?: Appointment;
  submitLabel: string;
  onCancel?: () => void;
  onSave: (input: Parameters<typeof addAppointment>[1] & { appointmentId?: string }) => void;
}) {
  const fallbackCategory = healthFallback(props.household);
  const existing = props.existing;
  const [title, setTitle] = useState(existing?.title ?? "");
  const [kind, setKind] = useState<AppointmentKind>(existing?.kind ?? "dentist");
  const [nextDate, setNextDate] = useState(existing?.nextDate ?? props.today);
  const [cadence, setCadence] = useState<AppointmentCadence>(existing?.cadence ?? suggestedAppointmentCadence(existing?.kind ?? "dentist"));
  const [cost, setCost] = useState(existing?.typicalCostCents ? (existing.typicalCostCents / 100).toFixed(2) : "");
  const [recovery, setRecovery] = useState(existing?.typicalRecoveryCents ? (existing.typicalRecoveryCents / 100).toFixed(2) : "");
  const [practitioner, setPractitioner] = useState(existing?.practitioner ?? "");
  const [place, setPlace] = useState(existing?.place ?? "");
  const [coverage, setCoverage] = useState<AppointmentCoverage>(existing?.coverage ?? "private");
  const [sensitivity, setSensitivity] = useState<AppointmentSensitivity>(existing?.sensitivity ?? suggestedAppointmentSensitivity(existing?.kind ?? "dentist"));
  const [memberId, setMemberId] = useState(existing?.memberId ?? pickVisitMember(props.household, existing?.kind ?? "dentist", props.memberId));
  const [accountId, setAccountId] = useState(existing?.accountId ?? pickVisitAccountId(props.household));
  const subcategoryId = existing?.subcategoryId ?? pickVisitSubcategory(props.household, kind, fallbackCategory);
  const paying = props.household.accounts.filter((account) => account.active && account.kind !== "receivable");

  function applyKind(next: AppointmentKind) {
    setKind(next);
    if (!existing) {
      setCadence(suggestedAppointmentCadence(next));
      setSensitivity(suggestedAppointmentSensitivity(next));
      setMemberId(pickVisitMember(props.household, next, props.memberId));
    }
  }

  return (
    <section className="card visit-form">
      <header>
        <h2>{existing ? "Edit visit" : "Add a visit"}</h2>
        <span className="muted">Reminder, not a post</span>
      </header>
      <label htmlFor="visit-title">Title</label>
      <input id="visit-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Hygienist, therapy, spa…" />
      <label htmlFor="visit-kind">Kind</label>
      <select id="visit-kind" value={kind} onChange={(event) => applyKind(event.target.value as AppointmentKind)}>
        {APPOINTMENT_KINDS.map((item) => (
          <option key={item.id} value={item.id}>{item.label}</option>
        ))}
      </select>
      <label htmlFor="visit-who">Who</label>
      <select id="visit-who" value={memberId} onChange={(event) => setMemberId(event.target.value)}>
        <option value="joint">Both of you</option>
        <option value="companion">{props.household.kitchen.companion.name || "Hercules"}</option>
        {props.household.members.filter((member) => member.active).map((member) => (
          <option key={member.id} value={member.id}>{member.name}</option>
        ))}
      </select>
      <label htmlFor="visit-date">Next date</label>
      <input id="visit-date" type="date" value={nextDate} onChange={(event) => setNextDate(event.target.value)} />
      <CadenceFields cadence={cadence} onChange={setCadence} />
      <label htmlFor="visit-cost">Typical cost</label>
      <input id="visit-cost" value={cost} onChange={(event) => setCost(event.target.value)} inputMode="decimal" placeholder="0.00" />
      <label htmlFor="visit-recovery">Typical recovery</label>
      <input id="visit-recovery" value={recovery} onChange={(event) => setRecovery(event.target.value)} inputMode="decimal" placeholder="0.00" />
      <label htmlFor="visit-coverage">Coverage</label>
      <select id="visit-coverage" value={coverage} onChange={(event) => setCoverage(event.target.value as AppointmentCoverage)}>
        <option value="private">Private plan</option>
        <option value="ohip">OHIP</option>
        <option value="none">No coverage</option>
      </select>
      <label htmlFor="visit-practitioner">Practitioner</label>
      <input id="visit-practitioner" value={practitioner} onChange={(event) => setPractitioner(event.target.value)} placeholder="Optional" />
      <label htmlFor="visit-place">Place</label>
      <input id="visit-place" value={place} onChange={(event) => setPlace(event.target.value)} placeholder="Optional" />
      <label htmlFor="visit-quiet">What Hercules says</label>
      <select id="visit-quiet" value={sensitivity} onChange={(event) => setSensitivity(event.target.value as AppointmentSensitivity)}>
        <option value="household">The title they typed</option>
        <option value="quiet">A quiet label — “the Tuesday visit”</option>
      </select>
      {paying.length > 1 && (
        <>
          <label htmlFor="visit-account">Usually paid with</label>
          <select id="visit-account" value={accountId} onChange={(event) => setAccountId(event.target.value)}>
            {paying.map((account) => (
              <option key={account.id} value={account.id}>{account.name}</option>
            ))}
          </select>
        </>
      )}
      <p className="visit-disclosure">{HOSTED_DISCLOSURE}</p>
      <div className="chips">
        {props.onCancel && (
          <button type="button" className="chip" disabled={props.busy} onClick={props.onCancel}>Cancel</button>
        )}
        <button
          type="button"
          className="primary"
          disabled={props.busy}
          onClick={() => props.onSave({
            appointmentId: existing?.id,
            title,
            kind,
            memberId,
            place,
            practitioner,
            sensitivity,
            coverage,
            nextDate,
            cadence,
            typicalCost: cost || 0,
            typicalRecovery: recovery || 0,
            subcategoryId: pickVisitSubcategory(props.household, kind, subcategoryId || fallbackCategory),
            accountId,
          })}
        >
          {props.submitLabel}
        </button>
      </div>
    </section>
  );
}

function PostVisitForm(props: {
  household: Household;
  appointment: Appointment;
  today: DateKey;
  busy: boolean;
  onAskVisit: (draft: VisitPostDraft, summary: string) => void;
}) {
  const starter = typicalVisitDraft(props.appointment, props.today, props.household);
  const [date, setDate] = useState(starter.date);
  const [amount, setAmount] = useState(starter.amount);
  const [expectedRecovery, setExpectedRecovery] = useState(starter.expectedRecovery);
  const [lines, setLines] = useState<VisitDraftLine[]>([]);
  const lineCents = sumDraftLineCents(lines);
  const postedAmount = lineCents > 0 ? (lineCents / 100).toFixed(2) : amount;
  const estimated = estimateRecoveryCents(props.household, props.appointment);

  function setLine(index: number, patch: Partial<VisitDraftLine>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  const draft: VisitPostDraft = {
    appointmentId: props.appointment.id,
    date,
    amount: postedAmount,
    expectedRecovery,
    lines: lines.filter((line) => line.amount.trim() || line.description.trim() || line.code.trim()),
  };

  return (
    <section className="card visit-post">
      <header>
        <h2>Post this visit</h2>
        <span className="muted">Confirm still writes</span>
      </header>
      <label htmlFor="post-visit-date">Date</label>
      <input id="post-visit-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      <label htmlFor="post-visit-amount">Amount paid</label>
      <input
        id="post-visit-amount"
        value={postedAmount}
        onChange={(event) => setAmount(event.target.value)}
        inputMode="decimal"
        readOnly={lineCents > 0}
      />
      {lineCents > 0 && <p className="muted">Amount follows the itemized lines. They must sum to the posted total.</p>}
      <label htmlFor="post-visit-back">Expected back</label>
      <input id="post-visit-back" value={expectedRecovery} onChange={(event) => setExpectedRecovery(event.target.value)} inputMode="decimal" />
      {estimated > 0 && !props.appointment.typicalRecoveryCents && (
        <p className="muted">Books guess {formatCad(estimated)} from landed claims. Type over it if this visit is different.</p>
      )}
      <div className="visit-lines-head">
        <h3>Itemized bill</h3>
        <button type="button" className="chip" onClick={() => setLines((current) => [...current, { code: "", description: "", amount: "" }])}>
          Add line
        </button>
      </div>
      {lines.length === 0 ? (
        <p className="muted">Optional. Cleaning + x-rays + fluoride belong here so the medical log can defend the year.</p>
      ) : lines.map((line, index) => (
        <div className="bill-line-row" key={`line-${index}`}>
          <input aria-label="Fee code" placeholder="01204" value={line.code} onChange={(event) => setLine(index, { code: event.target.value })} />
          <input aria-label="Description" placeholder="Exam" value={line.description} onChange={(event) => setLine(index, { description: event.target.value })} />
          <input aria-label="Amount" placeholder="0.00" inputMode="decimal" value={line.amount} onChange={(event) => setLine(index, { amount: event.target.value })} />
          <button type="button" className="chip" onClick={() => setLines((current) => current.filter((_, i) => i !== index))}>Remove</button>
        </div>
      ))}
      <button
        type="button"
        className="primary"
        disabled={props.busy || !postedAmount}
        onClick={() => props.onAskVisit(draft, visitPostSummary(props.appointment, draft))}
      >
        Post visit
      </button>
    </section>
  );
}

export function AppointmentsPage(props: {
  household: Household;
  today: DateKey;
  memberId: string;
  busy: boolean;
  onCommand: (fn: (current: Household) => CommitResult) => void;
  onAskVisit: (draft: VisitPostDraft, summary: string) => void;
  onAskSettle: (claimId: string, summary: string) => void;
  onAskWriteOff: (claimId: string, summary: string) => void;
  onAskStartJar: (appointmentId: string, summary: string) => void;
}) {
  const { household, today } = props;
  const [screen, setScreen] = useState<Screen>("upcoming");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const log = useMemo(() => craMedicalLog(household, today), [household, today]);
  const upcoming = useMemo(() => groupUpcomingVisits(upcomingVisitBoard(household, today)), [household, today]);
  const owed = useMemo(() => groupAgedReceivables(agedReceivables(household, today)), [household, today]);
  const proposals = useMemo(() => household.appointments.filter((item) => item.active && !item.savingGoalId).map((item) => proposeVisitGoal(household, item.id, today)).filter((item): item is NonNullable<typeof item> => Boolean(item)), [household, today]);
  const listedIds = new Set(upcoming.flatMap((group) => group.rows.map((row) => row.appointmentId)));
  const later = household.appointments.filter((item) => item.active && !listedIds.has(item.id));
  const selected = household.appointments.find((item) => item.id === selectedId);
  const history = selected ? postedVisitsFor(household, selected.id) : [];
  const cadence = selected ? visitCadenceCompare(household, selected) : null;
  const jar = selected?.savingGoalId ? household.goals.find((goal) => goal.id === selected.savingGoalId) : undefined;

  function openDetail(id: string) {
    setSelectedId(id);
    setScreen("detail");
  }

  return (
    <div className="visit-world">
      {screen !== "detail" && screen !== "edit" && (
        <>
          <section className="hero visit-hero">
            <div className="label">{log.year} eligible medical</div>
            <div className="money">{formatCad(log.eligibleCents)}</div>
            <div className="sub">
              Net of reimbursements received and still expected. CRA keeps the lesser of 3% of net income or {formatCad(log.capCents)}. Pending Sun Life stays out. We do not file taxes.
            </div>
            <div className="calendar-hero-actions">
              <button type="button" className="ghost" onClick={() => setScreen("medical")}>Open the log</button>
            </div>
          </section>
          <p className="visit-disclosure">{HOSTED_DISCLOSURE}</p>
          <div className="tabs">
            {([
              ["upcoming", "Upcoming"],
              ["owed", "Owed"],
              ["medical", "Log"],
              ["add", "Add"],
            ] as const).map(([id, label]) => (
              <button key={id} type="button" className={screen === id ? "active" : ""} onClick={() => setScreen(id)}>{label}</button>
            ))}
          </div>
        </>
      )}

      {screen === "upcoming" && (
        <>
          {household.appointments.filter((item) => item.active).length === 0 ? (
            <section className="card">
              <header><h2>No visits yet</h2></header>
              <p>Dentist, therapy, vet, spa. Add the first one. Quiet labels hide the title from Hercules, not from this ledger.</p>
              <button type="button" className="primary" onClick={() => setScreen("add")}>Add a visit</button>
            </section>
          ) : (
            <>
              {upcoming.map((group) => (
                <section className="card" key={group.monthKey}>
                  <header>
                    <h2>{group.monthLabel}</h2>
                    <span className="muted">{group.rows.length}</span>
                  </header>
                  {group.rows.map((row) => (
                    <article className="visit-card" key={`${row.appointmentId}-${row.date}`}>
                      <button type="button" className="visit-card-hit" onClick={() => openDetail(row.appointmentId)}>
                        <div className="row">
                          <span>
                            <span className="kind-pill visit">{kindLabel(row.kind)}</span> {row.title}
                            {row.overdue ? " · overdue" : ""}
                          </span>
                          <span>{row.typicalCostCents ? formatCad(row.typicalCostCents) : ""}</span>
                        </div>
                        <p className="muted">
                          {formatDayLabel(row.date)}
                          {row.estimatedRecoveryCents ? ` · ${formatCad(row.estimatedRecoveryCents)} expected back` : ""}
                        </p>
                      </button>
                    </article>
                  ))}
                </section>
              ))}
              {later.length > 0 && (
                <section className="card">
                  <header>
                    <h2>Later</h2>
                    <span className="muted">Past the next 90 days</span>
                  </header>
                  {later.map((item) => (
                    <article className="visit-card" key={item.id}>
                      <button type="button" className="visit-card-hit" onClick={() => openDetail(item.id)}>
                        <div className="row">
                          <span>
                            <span className="kind-pill visit">{kindLabel(item.kind)}</span> {appointmentPublicTitle(item, "card")}
                          </span>
                          <span>{item.typicalCostCents ? formatCad(item.typicalCostCents) : ""}</span>
                        </div>
                        <p className="muted">{formatAppointmentCadence(item.cadence)} · next {formatDayLabel(item.nextDate)}</p>
                      </button>
                    </article>
                  ))}
                </section>
              )}
            </>
          )}
          {proposals[0] && (
            <section className="card">
              <header>
                <h2>Hercules noticed</h2>
                <span className="muted">Propose, don&apos;t post</span>
              </header>
              {proposals.map((proposal) => (
                <div className="row" key={proposal.appointmentId}>
                  <span>{proposal.hercules}{proposal.drift ? ` ${proposal.drift}` : ""}</span>
                  <button type="button" className="chip selected" disabled={props.busy} onClick={() => props.onAskStartJar(proposal.appointmentId, `${proposal.hercules} This creates a shared jar. Hercules does not write it.`)}>
                    Start this goal
                  </button>
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {screen === "owed" && (
        <section className="card">
          <header>
            <h2>Owed to us</h2>
            <span className="muted">{owed.length ? `${owed.reduce((sum, group) => sum + group.rows.length, 0)} open` : "Clear"}</span>
          </header>
          <p className="muted">Insurance, a workplace claim, a friend, a tax refund. Settlement is a transfer into the account that received the money. Never income.</p>
          {owed.length === 0 ? (
            <p className="muted">Nothing outstanding.</p>
          ) : owed.map((group) => (
            <div key={group.status} className="visit-owed-group">
              <h3>{group.label}</h3>
              {group.rows.map((row) => {
                const appointment = row.claim.appointmentId
                  ? household.appointments.find((item) => item.id === row.claim.appointmentId)
                  : undefined;
                return (
                  <article className="visit-card" key={row.claim.id}>
                    <div className="row">
                      <span>
                        {claimPublicLabel(household, row.claim, "card")}
                        {appointment ? "" : ` · ${row.claim.kind}`}
                      </span>
                      <span>{formatCad(row.remainingCents)}</span>
                    </div>
                    <p className="muted">{formatAgingBucket(row.bucket)} · {formatClaimStatus(row.claim.status)}</p>
                    <BillLinesList lines={row.claim.lines} />
                    <div className="chips">
                      {appointment && (
                        <button type="button" className="chip" onClick={() => openDetail(appointment.id)}>Visit</button>
                      )}
                      {!row.claim.submittedAt && (
                        <button type="button" className="chip" disabled={props.busy} onClick={() => props.onCommand((current) => submitClaim(current, row.claim.id))}>
                          Submitted
                        </button>
                      )}
                      <button
                        type="button"
                        className="chip selected"
                        disabled={props.busy}
                        onClick={() => props.onAskSettle(row.claim.id, `This transfers ${formatCad(row.remainingCents)} from Benefits owing into chequing. Never income.`)}
                      >
                        Landed
                      </button>
                      <button
                        type="button"
                        className="chip"
                        disabled={props.busy}
                        onClick={() => props.onAskWriteOff(row.claim.id, `This writes ${formatCad(row.remainingCents)} back to the visit category because the claim was denied.`)}
                      >
                        Denied
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ))}
        </section>
      )}

      {screen === "medical" && (
        <section className="card visit-log">
          <header>
            <h2>{log.year} medical log</h2>
            <span className="muted">CRA METC</span>
          </header>
          <p>
            Eligible after reimbursements: <strong>{formatCad(log.eligibleCents)}</strong>.
            Still expected back: {formatCad(log.outstandingCents)}.
            Already landed: {formatCad(log.reimbursedCents)}.
          </p>
          <p className="muted">{log.hercules}</p>
          {log.rows.length === 0 ? (
            <p className="muted">No CRA-eligible medical in {log.year} yet. Itemize a dentist or therapy visit and it will land here, net of what is still coming back.</p>
          ) : (
            <div className="books-scroll">
              <table className="books-table visit-log-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Visit</th>
                    <th className="num">Paid</th>
                    <th className="num">Back</th>
                    <th className="num">Still owed</th>
                    <th className="num">Eligible</th>
                  </tr>
                </thead>
                <tbody>
                  {log.rows.map((row) => (
                    <tr key={`${row.claimId ?? row.appointmentId}-${row.date}`}>
                      <td>{formatDayLabel(row.date)}</td>
                      <td>
                        {row.appointmentId ? (
                          <button type="button" className="visit-link" onClick={() => openDetail(row.appointmentId!)}>{row.label}</button>
                        ) : row.label}
                        <BillLinesList lines={row.lines} />
                      </td>
                      <td className="num">{formatCad(row.expenseCents)}</td>
                      <td className="num">{formatCad(row.receivedCents)}</td>
                      <td className="num">{formatCad(row.remainingCents)}</td>
                      <td className="num">{formatCad(row.eligibleCents)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5}>Eligible this year</td>
                    <td className="num">{formatCad(log.eligibleCents)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          {log.omitted.length > 0 && (
            <>
              <h3>Kept off the list</h3>
              {log.omitted.map((row) => (
                <div className="row" key={`${row.label}-${row.date}`}>
                  <span>{formatDayLabel(row.date)} · {row.label} · {row.reason}</span>
                  <span>{formatCad(row.expenseCents)}</span>
                </div>
              ))}
            </>
          )}
        </section>
      )}

      {screen === "add" && (
        <AppointmentForm
          household={household}
          today={today}
          memberId={props.memberId}
          busy={props.busy}
          submitLabel="Save visit"
          onSave={(input) => {
            props.onCommand((current) => addAppointment(current, input));
            setScreen("upcoming");
          }}
        />
      )}

      {(screen === "detail" || screen === "edit") && selected && (
        <>
          <div className="chips visit-back">
            <button type="button" className="chip" onClick={() => setScreen(screen === "edit" ? "detail" : "upcoming")}>Back</button>
            {screen === "detail" && (
              <button type="button" className="chip" onClick={() => setScreen("edit")}>Edit</button>
            )}
          </div>
          {screen === "edit" ? (
            <AppointmentForm
              key={selected.id}
              household={household}
              today={today}
              memberId={props.memberId}
              busy={props.busy}
              existing={selected}
              submitLabel="Save changes"
              onCancel={() => setScreen("detail")}
              onSave={(input) => {
                props.onCommand((current) => updateAppointment(current, {
                  appointmentId: selected.id,
                  title: input.title,
                  kind: input.kind,
                  memberId: input.memberId,
                  place: input.place,
                  practitioner: input.practitioner,
                  sensitivity: input.sensitivity,
                  coverage: input.coverage,
                  nextDate: input.nextDate,
                  cadence: typeof input.cadence === "string" ? shapeCadence({ kind: input.cadence }) : input.cadence,
                  typicalCost: input.typicalCost,
                  typicalRecovery: input.typicalRecovery,
                  subcategoryId: input.subcategoryId,
                  accountId: input.accountId,
                }));
                setScreen("detail");
              }}
            />
          ) : (
            <>
              <section className="card">
                <header>
                  <h2>{appointmentPublicTitle(selected, "card")}</h2>
                  <span className="muted">{kindLabel(selected.kind)}</span>
                </header>
                <p>
                  {partyLabel(household, selected.memberId)}
                  {selected.practitioner ? ` · ${selected.practitioner}` : ""}
                  {selected.place ? ` · ${selected.place}` : ""}
                  {` · ${formatCoverage(selected.coverage)}`}
                  {selected.sensitivity === "quiet" ? " · quiet for Hercules" : ""}
                </p>
                <p className="visit-drift">{cadence?.sentence}</p>
                <p className="muted">
                  Next {formatDayLabel(selected.nextDate)}
                  {selected.lastVisitDate ? ` · last posted ${formatDayLabel(selected.lastVisitDate)}` : " · not posted yet"}
                  {selected.typicalCostCents ? ` · typical ${formatCad(selected.typicalCostCents)}` : ""}
                  {selected.typicalRecoveryCents ? ` · ${formatCad(selected.typicalRecoveryCents)} expected back` : ""}
                </p>
                {jar && (
                  <p>Jar: {jar.name} · {formatCad(jar.savedCents)} of {formatCad(jar.targetCents)}</p>
                )}
                {!jar && proposeVisitGoal(household, selected.id, today) && (
                  <button
                    type="button"
                    className="chip selected"
                    disabled={props.busy}
                    onClick={() => {
                      const proposal = proposeVisitGoal(household, selected.id, today);
                      if (proposal) props.onAskStartJar(selected.id, `${proposal.hercules} This creates a shared jar. Hercules does not write it.`);
                    }}
                  >
                    Start this goal
                  </button>
                )}
              </section>

              <section className="card">
                <header>
                  <h2>History</h2>
                  <span className="muted">{history.length ? `${history.length}` : "None yet"}</span>
                </header>
                {history.length === 0 ? (
                  <p className="muted">Nothing posted for this visit yet. Itemized lines show here after Confirm.</p>
                ) : history.map((visit) => (
                  <article className="visit-card" key={visit.expenseId}>
                    <div className="row">
                      <span>{formatDayLabel(visit.date)}{visit.place ? ` · ${visit.place}` : ""}</span>
                      <span>{formatCad(visit.amountCents)}</span>
                    </div>
                    <p className="muted">
                      {visit.expectedCents ? `${formatCad(visit.receivedCents)} back of ${formatCad(visit.expectedCents)}` : "No claim"}
                      {visit.remainingCents ? ` · ${formatCad(visit.remainingCents)} still owed` : ""}
                      {visit.claim ? ` · ${formatClaimStatus(visit.claim.status)}` : ""}
                    </p>
                    <BillLinesList lines={visit.lines} />
                    {visit.claim && visit.remainingCents > 0 && (
                      <div className="chips">
                        {!visit.claim.submittedAt && (
                          <button type="button" className="chip" disabled={props.busy} onClick={() => props.onCommand((current) => submitClaim(current, visit.claim!.id))}>
                            Submitted
                          </button>
                        )}
                        <button type="button" className="chip selected" disabled={props.busy} onClick={() => props.onAskSettle(visit.claim!.id, `This transfers ${formatCad(visit.remainingCents)} from Benefits owing into chequing. Never income.`)}>
                          Landed
                        </button>
                        <button type="button" className="chip" disabled={props.busy} onClick={() => props.onAskWriteOff(visit.claim!.id, `This writes ${formatCad(visit.remainingCents)} back to the visit category because the claim was denied.`)}>
                          Denied
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </section>

              <PostVisitForm
                household={household}
                appointment={selected}
                today={today}
                busy={props.busy}
                onAskVisit={props.onAskVisit}
              />
            </>
          )}
        </>
      )}

      {(screen === "detail" || screen === "edit") && !selected && (
        <section className="card">
          <p>That visit is gone.</p>
          <button type="button" className="chip" onClick={() => setScreen("upcoming")}>Back</button>
        </section>
      )}
    </div>
  );
}
