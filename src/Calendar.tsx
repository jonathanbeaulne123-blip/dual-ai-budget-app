import { useEffect, useMemo, useState } from "react";
import {
  WEEKDAY_SHORT,
  addRecurrence,
  adoptRhythm,
  buildHouseholdIcs,
  buildMonthBoard,
  describeClash,
  dismissRhythm,
  findActiveGoogleLink,
  formatCad,
  formatDayLabel,
  icsFilename,
  linkGoogleIdentity,
  monthKeyFromDateKey,
  pauseRecurrence,
  setRecurrenceGoogleSync,
  shiftMonthKey,
  skipOccurrence,
  typicalVisitDraft,
  unlinkGoogleIdentity,
  visitPostSummary,
  ValidationError,
  type CommitResult,
  type DateKey,
  type Environment,
  type Household,
  type Recurrence,
  type VisitPostDraft,
} from "./core/index.ts";
import type { OverlayEvent } from "./core/board.ts";
import {
  disconnectGoogleAccount,
  googleConfigured,
  loadGoogleAccounts,
  listGoogleOverlays,
  upsertHearthReminders,
  type GoogleAccount,
} from "./calendar/google.ts";
import { connectGoogle } from "./google/index.ts";
import { AppointmentsPage } from "./Appointments.tsx";
import { takeCalendarPane, type CalendarPane } from "./core/calendarIntent.ts";

type Pane = CalendarPane;

function kindLabel(kind: string): string {
  if (kind === "paycheck") return "Pay";
  if (kind === "subscription") return "Sub";
  if (kind === "detected") return "New";
  if (kind === "shift") return "Shift";
  if (kind === "google") return "GCal";
  if (kind === "claim") return "Owed";
  return "Bill";
}

function downloadIcs(household: Household, today: DateKey) {
  const blob = new Blob([buildHouseholdIcs(household, today)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = icsFilename(household);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function CalendarPage(props: {
  household: Household;
  today: DateKey;
  environment: Environment;
  memberId: string;
  busy: boolean;
  onCommand: (fn: (current: Household) => CommitResult) => void;
  onAskPost: (recurrenceId: string, summary: string) => void;
  onAskPostDue: (count: number, summary: string) => void;
  onAskVisit: (draft: VisitPostDraft, summary: string) => void;
  onAskSettle: (claimId: string, summary: string) => void;
  onAskWriteOff: (claimId: string, summary: string) => void;
  onAskStartJar: (appointmentId: string, summary: string) => void;
  onOpenPlan: () => void;
}) {
  const { household, today, environment } = props;
  const [monthKey, setMonthKey] = useState(() => monthKeyFromDateKey(today));
  const [selected, setSelected] = useState<DateKey>(today);
  const [pane, setPane] = useState<Pane>("board");
  const [accounts, setAccounts] = useState<GoogleAccount[]>([]);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleError, setGoogleError] = useState("");
  const [overlays, setOverlays] = useState<OverlayEvent[]>([]);

  const board = useMemo(
    () => buildMonthBoard(household, monthKey, today, overlays),
    [household, monthKey, today, overlays],
  );
  const selectedDay = board.days.find((day) => day.date === selected) ?? board.days.find((day) => day.isToday);
  const due = household.recurrences.filter((item) => item.active && item.nextDate <= today);
  const suggested = board.rhythms.filter((item) => item.status === "suggested");
  const configured = googleConfigured();
  const calendarGoogleOn = household.google.enabledServices.includes("calendar");

  function refreshAccounts() {
    setAccounts(loadGoogleAccounts(environment, household.members.filter((member) => member.active).map((member) => member.id)));
  }

  useEffect(() => {
    refreshAccounts();
  }, [environment, household.members]);

  useEffect(() => {
    const next = takeCalendarPane(localStorage);
    if (next) setPane(next);
  }, []);

  useEffect(() => {
    let live = true;
    if (!calendarGoogleOn || !accounts.length) {
      setOverlays([]);
      return;
    }
    const from = board.days[0]?.date;
    const to = board.days[board.days.length - 1]?.date;
    if (!from || !to) return;
    setGoogleBusy(true);
    void listGoogleOverlays({
      environment,
      accounts,
      memberColor: (memberId) => household.members.find((member) => member.id === memberId)?.color ?? "#2f6b4f",
      from,
      to,
      enabledServices: household.google.enabledServices,
    }).then((items) => {
      if (live) {
        setOverlays(items);
        setGoogleError("");
      }
    }).catch((caught) => {
      if (live) setGoogleError(caught instanceof Error ? caught.message : String(caught));
    }).finally(() => {
      if (live) setGoogleBusy(false);
    });
    return () => { live = false; };
  }, [accounts, environment, monthKey, household.members, calendarGoogleOn, household.google.enabledServices]);

  async function connectMember(memberId: string) {
    setGoogleBusy(true);
    setGoogleError("");
    try {
      const session = await connectGoogle({
        memberId,
        environment,
        services: ["identity", "calendar"],
        enabledServices: household.google.enabledServices,
      });
      props.onCommand((current) => linkGoogleIdentity(current, {
        memberId,
        email: session.identity.email,
        subject: session.identity.subject,
        displayName: session.identity.displayName,
        grantedScopes: session.grantedScopes,
      }));
      refreshAccounts();
    } catch (caught) {
      setGoogleError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setGoogleBusy(false);
    }
  }

  async function remindOnGoogle() {
    if (!accounts.length) {
      setPane("google");
      setGoogleError("Connect a Google account first, or download the .ics file.");
      return;
    }
    setGoogleBusy(true);
    setGoogleError("");
    try {
      const patches: { recurrenceId: string; memberId: string; calendarId: string; eventId: string }[] = [];
      for (const account of accounts) {
        const written = await upsertHearthReminders({
          environment,
          account,
          recurrences: household.recurrences,
          titleFor: (item) => item.note.trim() || household.categories.find((row) => row.id === item.subcategoryId)?.name || "Bill",
          enabledServices: household.google.enabledServices,
        });
        patches.push(...written);
      }
      if (patches.length) {
        props.onCommand((current) => setRecurrenceGoogleSync(current, patches));
      }
    } catch (caught) {
      setGoogleError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setGoogleBusy(false);
    }
  }

  return (
    <>
      {pane !== "visits" && (
        <section className="hero calendar-hero">
          <div className="label">Money dates · {board.monthLabel}</div>
          <div className={`money ${board.weekPressure && board.weekPressure.outCents > board.weekPressure.inCents ? "negative" : ""}`}>
            {board.weekPressure ? formatCad(board.weekPressure.inCents - board.weekPressure.outCents) : formatCad(0)}
          </div>
          <div className="sub">
            This week on the board
            {due.length ? ` · ${due.length} due` : ""}
            {suggested.length ? ` · ${suggested.length} spotted in the ledger` : ""}
          </div>
          <div className="calendar-hero-actions">
            <button className="ghost" onClick={props.onOpenPlan}>Open plan</button>
            {due.length > 0 && (
              <button className="ghost" onClick={() => props.onAskPostDue(due.length, `This posts ${due.length} due repeating ${due.length === 1 ? "item" : "items"} into the books.`)}>
                Mark due paid
              </button>
            )}
          </div>
        </section>
      )}

      {pane !== "visits" && board.clashes[0] && (
        <article className="pulse-banner warn">{describeClash(board.clashes[0])}</article>
      )}

      <div className="tabs">
        {([
          ["board", "Month"],
          ["visits", "Appointments"],
          ["bills", "Bills"],
          ["google", "Google"],
        ] as const).map(([id, label]) => (
          <button key={id} className={pane === id ? "active" : ""} onClick={() => setPane(id)}>{label}</button>
        ))}
      </div>

      {pane === "board" && (
        <>
          <section className="card calendar-card">
            <header>
              <button className="chip" onClick={() => setMonthKey(shiftMonthKey(monthKey, -1))} aria-label="Previous month">‹</button>
              <h2>{board.monthLabel}</h2>
              <button className="chip" onClick={() => setMonthKey(shiftMonthKey(monthKey, 1))} aria-label="Next month">›</button>
            </header>
            <div className="cal-weekdays">
              {WEEKDAY_SHORT.map((label) => <span key={label}>{label}</span>)}
            </div>
            <div className="cal-grid">
              {board.days.map((day) => (
                <button
                  key={day.date}
                  className={[
                    "cal-day",
                    day.inMonth ? "" : "outside",
                    day.isToday ? "today" : "",
                    selected === day.date ? "selected" : "",
                    day.heat > 0.55 ? "hot" : "",
                  ].join(" ")}
                  onClick={() => setSelected(day.date)}
                  style={day.heat ? { background: `rgba(196, 92, 38, ${0.06 + day.heat * 0.22})` } : undefined}
                >
                  <span className="num">{Number(day.date.slice(8))}</span>
                  <span className="dots">
                    {day.items.slice(0, 3).map((item) => (
                      <i
                        key={item.id}
                        className={item.direction}
                        style={item.memberColor ? { background: item.memberColor } : undefined}
                      />
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {selectedDay && (
            <section className="card">
              <header>
                <h2>{formatDayLabel(selectedDay.date)}</h2>
                <span className="muted">
                  {selectedDay.inCents ? `${formatCad(selectedDay.inCents)} in` : ""}
                  {selectedDay.inCents && selectedDay.outCents ? " · " : ""}
                  {selectedDay.outCents ? `${formatCad(selectedDay.outCents)} out` : selectedDay.items.length ? "on the board" : "quiet"}
                </span>
              </header>
              {selectedDay.items.length === 0 ? (
                <p className="muted">Nothing on this day.</p>
              ) : selectedDay.items.map((item) => (
                <DayRow
                  key={item.id}
                  title={item.title}
                  amountCents={item.amountCents}
                  kind={item.kind}
                  due={item.due && (item.source === "recurrence" || item.source === "appointment")}
                  recurrenceId={item.recurrenceId}
                  appointmentId={item.appointmentId}
                  rhythmKey={item.rhythmKey}
                  today={today}
                  household={household}
                  busy={props.busy}
                  onAdopt={(key) => props.onCommand((current) => adoptRhythm(current, key, today))}
                  onAskPost={props.onAskPost}
                  date={selectedDay.date}
                  onAskVisit={props.onAskVisit}
                />
              ))}
            </section>
          )}

          <section className="card">
            <header>
              <h2>Coming up</h2>
              <span className="muted">21 days</span>
            </header>
            {board.upcoming.length === 0 ? (
              <p className="muted">Quiet three weeks.</p>
            ) : board.upcoming.map((item) => (
              <div className="row" key={item.id}>
                <span>
                  <span className={`kind-pill ${item.kind}`}>{kindLabel(item.kind)}</span>
                  {" "}{formatDayLabel(item.date)} · {item.title}
                </span>
                <span className={item.direction === "out" ? "right" : "muted"}>{formatCad(item.amountCents)}</span>
              </div>
            ))}
          </section>
        </>
      )}

      {pane === "visits" && (
        <AppointmentsPage
          household={household}
          today={today}
          memberId={props.memberId}
          busy={props.busy}
          onCommand={props.onCommand}
          onAskVisit={props.onAskVisit}
          onAskSettle={props.onAskSettle}
          onAskWriteOff={props.onAskWriteOff}
          onAskStartJar={props.onAskStartJar}
        />
      )}

      {pane === "bills" && (
        <>
          {suggested.length > 0 && (
            <section className="card">
              <header>
                <h2>Spotted in the ledger</h2>
                <span className="muted">Not money yet</span>
              </header>
              <p className="muted">Adopt is a reminder. Mark paid posts.</p>
              {suggested.map((rhythm) => (
                <article className="rhythm-card" key={rhythm.key}>
                  <div className="row">
                    <span>
                      <span className={`kind-pill ${rhythm.kind}`}>{kindLabel(rhythm.kind)}</span> {rhythm.note}
                    </span>
                    <span>{formatCad(rhythm.amountCents)}</span>
                  </div>
                  <p className="muted">
                    {rhythm.cadence} · {rhythm.count} times · next {formatDayLabel(rhythm.nextDate)} · {Math.round(rhythm.confidence * 100)}% match
                  </p>
                  <div className="chips">
                    <button className="chip selected" disabled={props.busy} onClick={() => props.onCommand((current) => adoptRhythm(current, rhythm.key, today))}>
                      Adopt
                    </button>
                    <button className="chip" disabled={props.busy} onClick={() => props.onCommand((current) => dismissRhythm(current, rhythm.key))}>
                      Not a bill
                    </button>
                  </div>
                </article>
              ))}
            </section>
          )}

          <FirstBillForm
            household={household}
            today={today}
            busy={props.busy}
            onCommand={props.onCommand}
          />

          <section className="card">
            <header>
              <h2>Repeating</h2>
              <span className="muted">{household.recurrences.length ? `${household.recurrences.filter((item) => item.active).length} active` : "None yet"}</span>
            </header>
            {household.recurrences.length === 0 ? (
              <p className="muted">Add a bill that has never posted, or adopt one spotted in the ledger. Mark paid posts.</p>
            ) : household.recurrences.map((item) => (
              <RecurrenceCard
                key={item.id}
                item={item}
                today={today}
                busy={props.busy}
                onPause={() => props.onCommand((current) => pauseRecurrence(current, item.id))}
                onSkip={() => props.onCommand((current) => skipOccurrence(current, item.id))}
                onAskPost={props.onAskPost}
              />
            ))}
          </section>
        </>
      )}

      {pane === "google" && (
        <section className="card">
          <header>
            <h2>Google calendars</h2>
            <span className={`pill ${accounts.length ? "good" : ""}`}>{accounts.length ? `${accounts.length} connected` : "Optional"}</span>
          </header>
          <p className="muted">
            Google never posts. Overlay and 9:00 Toronto reminders. Link in More.
          </p>
          {household.members.filter((member) => member.active).sort((left, right) => {
            if (left.id === props.memberId) return -1;
            if (right.id === props.memberId) return 1;
            return left.name.localeCompare(right.name);
          }).map((member) => {
            const account = accounts.find((item) => item.memberId === member.id);
            const link = findActiveGoogleLink(household, member.id);
            const label = account?.email || link?.email || "not connected";
            return (
              <div className="row" key={member.id}>
                <span>
                  <i className="swatch" style={{ background: member.color }} /> {member.name}
                  <span className="muted"> {label}{link && !account ? " · connect on this phone" : ""}</span>
                </span>
                {account ? (
                  <button className="chip" onClick={() => {
                    disconnectGoogleAccount(environment, member.id);
                    if (findActiveGoogleLink(household, member.id)) {
                      props.onCommand((current) => unlinkGoogleIdentity(current, member.id));
                    }
                    refreshAccounts();
                    setOverlays((items) => items.filter((item) => item.memberId !== member.id));
                  }}>
                    Disconnect
                  </button>
                ) : (
                  <button className="chip selected" disabled={googleBusy || !configured || !calendarGoogleOn} onClick={() => void connectMember(member.id)}>
                    Connect
                  </button>
                )}
              </div>
            );
          })}
          {!calendarGoogleOn && (
            <p className="muted">Calendar Google is off. Turn it on in More → Google household bridge.</p>
          )}
          {!configured && (
            <p className="muted">Add <code>VITE_GOOGLE_CLIENT_ID</code> to this build (Google Cloud web client, this site as an authorized origin). Until then, download the calendar file.</p>
          )}
          {googleError && <p className="danger" style={{ marginTop: 12 }}>{googleError}</p>}
          <button className="primary" disabled={googleBusy || !calendarGoogleOn || !household.recurrences.some((item) => item.active)} onClick={() => void remindOnGoogle()}>
            {googleBusy ? "Talking to Google…" : "Write reminders to Google"}
          </button>
          <button className="ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => downloadIcs(household, today)}>
            Download .ics with alarms
          </button>
        </section>
      )}
    </>
  );
}

function DayRow(props: {
  title: string;
  amountCents: number;
  kind: string;
  due: boolean;
  recurrenceId?: string;
  appointmentId?: string;
  rhythmKey?: string;
  date: DateKey;
  today: DateKey;
  household: Household;
  busy: boolean;
  onAdopt: (key: string) => void;
  onAskPost: (recurrenceId: string, summary: string) => void;
  onAskVisit: (draft: VisitPostDraft, summary: string) => void;
}) {
  const rec = props.recurrenceId ? props.household.recurrences.find((item) => item.id === props.recurrenceId) : undefined;
  const visit = props.appointmentId ? props.household.appointments.find((item) => item.id === props.appointmentId) : undefined;
  return (
    <div className="row">
      <span>
        <span className={`kind-pill ${props.kind}`}>{kindLabel(props.kind)}</span> {props.title}
        {props.due ? " · due" : ""}
      </span>
      <span>
        {props.amountCents ? formatCad(props.amountCents) : ""}
        {props.rhythmKey && (
          <button className="chip" disabled={props.busy} onClick={() => props.onAdopt(props.rhythmKey!)}>Adopt</button>
        )}
        {rec && rec.nextDate <= props.today && (
          <button
            className="chip"
            disabled={props.busy}
            onClick={() => props.onAskPost(rec.id, `This posts ${formatCad(rec.amountCents)} ${rec.note || "recurring"} on ${rec.nextDate} into the books.`)}
          >
            Paid
          </button>
        )}
        {visit && (
          <button
            className="chip"
            disabled={props.busy}
            onClick={() => {
              const draft = typicalVisitDraft(visit, props.date, props.household);
              props.onAskVisit(draft, visitPostSummary(visit, draft));
            }}
          >
            Post
          </button>
        )}
      </span>
    </div>
  );
}

function FirstBillForm({
  household,
  today,
  busy,
  onCommand,
}: {
  household: Household;
  today: DateKey;
  busy: boolean;
  onCommand: (fn: (current: Household) => CommitResult) => void;
}) {
  const expenseCategories = household.categories.filter((category) => (
    category.active && category.recordType === "category" && category.transactionType === "expense"
  ));
  const accounts = household.accounts.filter((account) => account.active);
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts.find((account) => account.id === "ACC-CHEQUING")?.id ?? accounts[0]?.id ?? "");
  const [subcategoryId, setSubcategoryId] = useState(expenseCategories.find((category) => category.id === "SUB-HOUSING-RENT")?.id ?? expenseCategories[0]?.id ?? "");
  const [nextDate, setNextDate] = useState(today);
  const [cadence, setCadence] = useState<Recurrence["cadence"]>("monthly");
  const [postNow, setPostNow] = useState(false);
  const [error, setError] = useState("");

  function save() {
    try {
      onCommand((current) => addRecurrence(current, {
        cadence,
        nextDate,
        type: "expense",
        amount,
        accountId,
        subcategoryId,
        note,
        origin: "manual",
        kind: "bill",
        postNow,
      }));
      setNote("");
      setAmount("");
      setError("");
    } catch (caught) {
      setError(caught instanceof ValidationError ? caught.message : String(caught));
    }
  }

  return (
    <section className="card first-bill">
      <header>
        <h2>New bill</h2>
        <span className="muted">Never posted</span>
      </header>
      <p className="muted">
        A first-time bill is a reminder until Mark paid. You do not need a detected rhythm. Post now only if it is due today.
      </p>
      <label>
        Name
        <input value={note} placeholder="Rent, hydro, phone…" onChange={(event) => setNote(event.target.value)} />
      </label>
      <label>
        Amount (CAD)
        <input inputMode="decimal" value={amount} placeholder="0.00" onChange={(event) => setAmount(event.target.value)} />
      </label>
      <label>
        Next date
        <input type="date" value={nextDate} onChange={(event) => setNextDate(event.target.value)} />
      </label>
      <label>
        Cadence
        <select value={cadence} onChange={(event) => setCadence(event.target.value as Recurrence["cadence"])}>
          <option value="weekly">Weekly</option>
          <option value="biweekly">Every two weeks</option>
          <option value="monthly">Monthly</option>
        </select>
      </label>
      <label>
        Account
        <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>{account.name}</option>
          ))}
        </select>
      </label>
      <label>
        Category
        <select value={subcategoryId} onChange={(event) => setSubcategoryId(event.target.value)}>
          {expenseCategories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
      </label>
      <label className="row">
        <input type="checkbox" checked={postNow} onChange={(event) => setPostNow(event.target.checked)} />
        Post now if due today
      </label>
      {error && <p className="danger">{error}</p>}
      <button className="primary" type="button" disabled={busy} onClick={save}>Save bill</button>
    </section>
  );
}

function RecurrenceCard(props: {
  item: Recurrence;
  today: DateKey;
  busy: boolean;
  onPause: () => void;
  onSkip: () => void;
  onAskPost: (recurrenceId: string, summary: string) => void;
}) {
  const { item } = props;
  const due = item.active && item.nextDate <= props.today;
  return (
    <article className="rhythm-card">
      <div className="row">
        <span>
          <span className={`kind-pill ${item.kind}`}>{kindLabel(item.kind)}</span> {item.note || "Recurring"}
          {!item.active ? " · paused" : due ? " · due" : ""}
        </span>
        <span>{formatCad(item.amountCents)}</span>
      </div>
      <p className="muted">
        {item.cadence} · next {formatDayLabel(item.nextDate)}
        {item.origin === "detected" ? " · spotted in the ledger" : ""}
        {Object.keys(item.googleSync).length ? " · on Google" : ""}
      </p>
      <div className="chips">
        {due && (
          <button
            className="chip selected"
            disabled={props.busy}
            onClick={() => props.onAskPost(item.id, `This posts ${formatCad(item.amountCents)} ${item.note || "recurring"} on ${item.nextDate} into the books.`)}
          >
            Mark paid
          </button>
        )}
        <button className="chip" disabled={props.busy} onClick={props.onSkip}>Skip once</button>
        <button className="chip" disabled={props.busy} onClick={props.onPause}>{item.active ? "Pause" : "Resume"}</button>
      </div>
    </article>
  );
}
