import { CalendarBinding } from "./theme/CalendarArtwork.tsx";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import "./calendar-boards.css";
import { CalendarWeight } from "./CalendarWeight.tsx";
import { calendarWeight } from "./core/calendarWeight.ts";
import { daysInMonthKey } from "./core/calendar.ts";
import { KitchenNotice } from "./KitchenNotice.tsx";
import {
  type HerculesNumberSource,
  WEEKDAY_SHORT,
  adoptRhythm,
  buildHouseholdIcs,
  buildMonthBoard,
  copy,
  describeClash,
  dismissRhythm,
  duePotentialExpenses,
  findActiveGoogleLink,
  formatCad,
  formatDayLabel,
  icsFilename,
  linkGoogleIdentity,
  monthKeyFromDateKey,
  onboardingRecurrencePauseDue,
  onboardingRecurrenceProbe,
  pauseRecurrence,
  addPotentialExpense,
  movePotentialExpense,
  removePotentialExpense,
  updatePotentialExpense,
  setRecurrenceGoogleSync,
  setGoogleServices,
  settleWorkReceivable,
  payDeferredWorkTipOut,
  shiftMonthKey,
  skipOccurrence,
  typicalVisitDraft,
  visitPostSummary,
  workOwedFacts,
  type CommitResult,
  type DateKey,
  type Environment,
  type Household,
  type LedgerView,
  type PotentialExpenseCalendarLink,
  type PotentialExpensePlan,
  type Recurrence,
  type VisitPostDraft,
  type WorkOwedFact,
} from "./core/index.ts";
import type { BoardItem, OverlayEvent } from "./core/board.ts";
import {
  disconnectGoogleAccount,
  googleConfigured,
  loadGoogleAccounts,
  readGoogleCalendars,
  upsertHearthReminders,
  type GoogleAccount,
} from "./calendar/google.ts";
import { connectGoogle } from "./google/index.ts";
import { AppointmentsPage } from "./Appointments.tsx";
import { takeCalendarPane, type CalendarPane } from "./core/calendarIntent.ts";
import {
  blankRepeatingDraft,
  draftFromRecurrence,
  repeatingConfirmSummary,
  RepeatingForm,
  type RepeatingDraft,
} from "./RepeatingForm.tsx";
import { WorkSettlementSheet } from "./WorkSettlementSheet.tsx";
import { useAsyncScope } from "./asyncScope.ts";
import { PotentialExpenseEditor, type PotentialExpenseEditorValue } from "./PotentialExpenseEditor.tsx";

type Pane = CalendarPane;

function kindLabel(kind: string): string {
  if (kind === "paycheck") return "Pay";
  if (kind === "subscription") return "Sub";
  if (kind === "detected") return "New";
  if (kind === "potential-expense") return "Planned";
  if (kind === "shift") return "Shift";
  if (kind === "shift-envelope") return "✉ Shift";
  if (kind === "google") return "GCal";
  if (kind === "claim") return "Owed";
  if (kind === "work-pay") return "Pay";
  if (kind === "work-tip") return "Tips";
  if (kind === "work-tipout") return "Tip-out";
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

type CalendarProps = {
  household: Household;
  view?: LedgerView;
  today: DateKey;
  environment: Environment;
  memberId: string;
  busy: boolean;
  onCommand: (fn: (current: Household) => CommitResult) => void;
  onAskPost: (recurrenceId: string, summary: string) => void;
  onAskPostDue: (recurrenceIds: string[], summary: string) => void;
  onAskSaveRepeating: (draft: RepeatingDraft, summary: string) => void;
  onAskVisit: (draft: VisitPostDraft, summary: string) => void;
  onAskSettle: (claimId: string, summary: string) => void;
  onAskWriteOff: (claimId: string, summary: string) => void;
  onAskStartJar: (appointmentId: string, summary: string) => void;
  onOpenPlan: () => void;
  onOpenShiftEnvelope: (envelopeId: string) => void;
  onAskQuickPotential?: (planId: string) => void;
  onReviewPotential?: (planId: string) => void;
  openPotentialEditorId?: string | null;
  onPotentialEditorOpened?: () => void;
  onboardingStandingFactOnly?: boolean;
  sourceFocus?: HerculesNumberSource | null;
};

export function CalendarPage(props: CalendarProps) {
  return <CalendarPageScope key={`${props.environment}:${props.household.householdId}:${props.memberId}:${props.view ?? "household"}`} {...props} />;
}

function CalendarPageScope(props: CalendarProps) {
  const { household, today, environment } = props;
  const [phone, setPhone] = useState(() => window.innerWidth < 720);
  useEffect(() => {
    const resize = () => setPhone(window.innerWidth < 720);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const [monthKey, setMonthKey] = useState(() => monthKeyFromDateKey(today));
  const [selected, setSelected] = useState<DateKey>(today);
  const [dayOpen, setDayOpen] = useState(true);
  const [mobileAddDate, setMobileAddDate] = useState<DateKey | null>(null);
  const [pane, setPane] = useState<Pane>("calendar");
  const tabsId = useId();
  const integrationRef = useRef<HTMLElement>(null);
  const [focusIntegration, setFocusIntegration] = useState(false);
  const [accounts, setAccounts] = useState<GoogleAccount[]>([]);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleError, setGoogleError] = useState("");
  const [readCalendars, setReadCalendars] = useState<string[]>([]);
  const [overlays, setOverlays] = useState<OverlayEvent[]>([]);
  const [repeatingDraft, setRepeatingDraft] = useState<RepeatingDraft | null>(null);
  const [workSettlement, setWorkSettlement] = useState<WorkOwedFact | null>(null);
  const [potentialEditor, setPotentialEditor] = useState<{ date: DateKey; plan?: PotentialExpensePlan; linkedCalendarItem?: PotentialExpenseCalendarLink } | null>(null);
  const [selectedCalendarItemId, setSelectedCalendarItemId] = useState<string | null>(null);
  const [draggedPotentialId, setDraggedPotentialId] = useState<string | null>(null);
  const [calendarAnnouncement, setCalendarAnnouncement] = useState("");
  const scopeKey = `${environment}:${household.householdId}:${props.memberId}:${props.view ?? "household"}`;
  const asyncScope = useAsyncScope(scopeKey);

  useEffect(() => {
    if (!props.openPotentialEditorId) return;
    const plan = household.potentialExpenses.find((item) => item.id === props.openPotentialEditorId && item.status === "planned");
    props.onPotentialEditorOpened?.();
    if (!plan) return;
    setPane("calendar");
    setMonthKey(monthKeyFromDateKey(plan.date));
    setSelected(plan.date);
    setDayOpen(true);
    setPotentialEditor({ date: plan.date, plan });
  }, [props.openPotentialEditorId]);

  const board = useMemo(
    () => buildMonthBoard(household, monthKey, today, overlays),
    [household, monthKey, today, overlays],
  );
  const weightDays = useMemo(() => pane === "board" ? calendarWeight(household, board, today) : [], [pane, household, board, today]);
  const changeMonth = (offset: number) => {
    const next = shiftMonthKey(monthKey, offset);
    setMonthKey(next);
    setSelected(`${next}-${String(Math.min(Number(selected.slice(8)), daysInMonthKey(next))).padStart(2, "0")}`);
    setDayOpen(false);
    setMobileAddDate(null);
  };
  const workFacts = useMemo(() => workOwedFacts(household, today), [household, today]);
  const selectedDay = board.days.find((day) => day.date === selected) ?? board.days.find((day) => day.isToday);
  const due = household.recurrences.filter((item) => item.active && item.nextDate <= today);
  const duePotential = useMemo(() => duePotentialExpenses(household.potentialExpenses, today), [household.potentialExpenses, today]);
  const suggested = board.rhythms.filter((item) => item.status === "suggested");
  const onboardingProbe = onboardingRecurrenceProbe(household);
  const configured = googleConfigured();
  const calendarGoogleOn = household.google.enabledServices.includes("calendar");

  function savePotential(value: PotentialExpenseEditorValue) {
    const editing = potentialEditor?.plan;
    setPotentialEditor(null);
    if (editing) {
      props.onCommand((current) => updatePotentialExpense(current, { ...value, id: editing.id, createdBy: props.memberId }));
      return;
    }
    props.onCommand((current) => addPotentialExpense(current, { ...value, createdBy: props.memberId }));
  }

  function movePotential(id: string, date: DateKey) {
    const plan = household.potentialExpenses.find((row) => row.id === id && row.status === "planned");
    if (!plan || plan.date === date) return;
    props.onCommand((current) => movePotentialExpense(current, { id, date, createdBy: props.memberId }));
    setSelected(date);
    setMonthKey(monthKeyFromDateKey(date));
    setDayOpen(true);
    setCalendarAnnouncement(`${plan.title} moved to ${formatDayLabel(date)}.`);
  }

  function addPotentialForItem(item: BoardItem) {
    if (item.source === "potential-expense") return;
    setPotentialEditor({
      date: item.date,
      linkedCalendarItem: { source: item.source, id: item.id, title: item.title },
    });
  }

  function refreshAccounts() {
    setAccounts(loadGoogleAccounts(
      environment,
      [props.memberId],
      household.householdId,
    ));
  }

  useEffect(() => {
    refreshAccounts();
    let refreshedAt = Date.now();
    const refreshOnReturn = () => {
      if (document.visibilityState === "hidden" || Date.now() - refreshedAt < 15000) return;
      refreshedAt = Date.now();
      refreshAccounts();
    };
    window.addEventListener("focus", refreshOnReturn);
    window.addEventListener("online", refreshOnReturn);
    document.addEventListener("visibilitychange", refreshOnReturn);
    return () => {
      window.removeEventListener("focus", refreshOnReturn);
      window.removeEventListener("online", refreshOnReturn);
      document.removeEventListener("visibilitychange", refreshOnReturn);
    };
  }, [environment, household.householdId, props.memberId, calendarGoogleOn]);

  useEffect(() => {
    const next = takeCalendarPane(localStorage);
    if (next === "google") {
      setPane("calendar");
      setFocusIntegration(true);
    } else if (next) setPane(next);
  }, []);

  useEffect(() => {
    if (props.openPotentialEditorId || potentialEditor) return;
    const source = props.sourceFocus;
    if (!source || source.route !== "calendar" || source.view !== (props.view ?? "household")) return;
    setPane("bills");
    if (source.from) { setMonthKey(monthKeyFromDateKey(source.from)); setSelected(source.from); }
  }, [props.sourceFocus]);
  useEffect(() => {
    if (props.openPotentialEditorId || potentialEditor) return;
    const source = props.sourceFocus;
    if (pane !== "bills" || !source || source.view !== (props.view ?? "household")) return;
    const node = source.recurrenceId ? [...document.querySelectorAll<HTMLElement>("[data-recurrence-id]")].find(row => row.dataset.recurrenceId === source.recurrenceId) : document.getElementById(`${tabsId}-panel`);
    node?.scrollIntoView?.({ block: "center" }); node?.focus({ preventScroll: true });
  }, [pane, props.sourceFocus, tabsId]);

  useEffect(() => {
    if (!focusIntegration || pane !== "calendar") return;
    integrationRef.current?.focus();
    integrationRef.current?.scrollIntoView?.({ block: "start" });
    setFocusIntegration(false);
  }, [focusIntegration, pane]);

  useEffect(() => {
    let live = true;
    setOverlays([]);
    setReadCalendars([]);
    setGoogleError("");
    if (!calendarGoogleOn || !accounts.length) {
      setGoogleBusy(false);
      return;
    }
    const from = board.days[0]?.date;
    const to = board.days[board.days.length - 1]?.date;
    if (!from || !to) return;
    setGoogleBusy(true);
    void readGoogleCalendars({
      environment,
      householdId: household.householdId,
      accounts,
      memberColor: (memberId) => household.members.find((member) => member.id === memberId)?.color ?? "#2f6b4f",
      from,
      to,
      timeZone: household.timezone,
      enabledServices: household.google.enabledServices,
    }).then((items) => {
      if (live) {
        setOverlays(items.overlays);
        setReadCalendars(items.calendars);
        setGoogleError(items.errors.join(" "));
      }
    }).catch((caught) => {
      if (live) setGoogleError(caught instanceof Error ? caught.message : String(caught));
    }).finally(() => {
      if (live) setGoogleBusy(false);
    });
    return () => { live = false; };
  }, [accounts, environment, household.householdId, monthKey, household.members, household.timezone, calendarGoogleOn, household.google.enabledServices]);

  async function connectMember(memberId: string) {
    const startedScope = asyncScope.capture();
    setGoogleBusy(true);
    setGoogleError("");
    try {
      if (memberId !== props.memberId) return;
      const session = await connectGoogle({
        memberId,
        environment,
        householdId: household.householdId,
        services: ["identity", "calendar"],
        enabledServices: [...household.google.enabledServices, "calendar"],
        loginHint: findActiveGoogleLink(household, memberId)?.email,
      });
      if (!asyncScope.isCurrent(startedScope)) return;
      props.onCommand((current) => linkGoogleIdentity(setGoogleServices(current, [...new Set([...current.google.enabledServices, "calendar"])]).household, {
        memberId,
        email: session.identity.email,
        subject: session.identity.subject,
        displayName: session.identity.displayName,
        grantedScopes: session.grantedScopes,
      }));
      refreshAccounts();
    } catch (caught) {
      if (asyncScope.isCurrent(startedScope)) setGoogleError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      if (asyncScope.isCurrent(startedScope)) setGoogleBusy(false);
    }
  }

  async function remindOnGoogle() {
    const startedScope = asyncScope.capture();
    if (!accounts.length) {
      setPane("calendar");
      setFocusIntegration(true);
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
          householdId: household.householdId,
          account,
          recurrences: household.recurrences,
          titleFor: (item) => item.note.trim() || household.categories.find((row) => row.id === item.subcategoryId)?.name || "Bill",
          enabledServices: household.google.enabledServices,
        });
        if (!asyncScope.isCurrent(startedScope)) return;
        patches.push(...written);
      }
      if (!asyncScope.isCurrent(startedScope)) return;
      if (patches.length) {
        props.onCommand((current) => setRecurrenceGoogleSync(current, patches));
      }
    } catch (caught) {
      if (asyncScope.isCurrent(startedScope)) setGoogleError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      if (asyncScope.isCurrent(startedScope)) setGoogleBusy(false);
    }
  }

  const monthTools = (
<div className="calendar-board-dock">
              {!phone && <p className="calendar-week-net">
                {(props.view ?? "household") === "personal" ? "My dates" : "Household dates"}
                {" · this week "}
                {board.weekPressure ? formatCad(board.weekPressure.inCents - board.weekPressure.outCents) : formatCad(0)}
                {due.length ? ` · ${due.length} due` : ""}
                {suggested.length ? ` · ${suggested.length} spotted` : ""}
              </p>}
              <div className="calendar-hero-actions">
                <button className="ghost" type="button" onClick={props.onOpenPlan}>Open plan</button>
                {due.length > 0 && !props.onboardingStandingFactOnly && (
                  <button
                    className="ghost"
                    type="button"
                    onClick={() => props.onAskPostDue(due.map((item) => item.id), `This posts ${due.length} due repeating ${due.length === 1 ? "item" : "items"} into the books.`)}
                  >
                    Mark due paid
                  </button>
                )}
              </div>
            </div>
  );

  return (
    <div
      className="calendar-stage"
      data-calendar-pane={pane}
      data-calendar-view={props.view ?? "household"}
      data-onboarding-standing-fact={props.onboardingStandingFactOnly ? "true" : undefined}
    >
      {pane !== "board" && pane !== "visits" && board.clashes[0] && !(props.onboardingStandingFactOnly && pane === "bills") && (
        <article className="pulse-banner warn">{describeClash(board.clashes[0])}</article>
      )}

      <div className="tabs calendar-tabs" role="tablist" aria-label="Calendar views">
        {([
          ["calendar", "Calendar"],
          ["board", "Month"],
          ["visits", "Appointments"],
          ["bills", "Bills"],
        ] as const).map(([id, label], index, tabs) => (
          <button key={id} type="button" role="tab" id={`${tabsId}-tab-${id}`}
            aria-selected={pane === id} aria-controls={`${tabsId}-panel`}
            tabIndex={pane === id ? 0 : -1} className={pane === id ? "active" : ""}
            onClick={() => { if (id === "board") setMonthKey(monthKeyFromDateKey(selected)); setPane(id); }} onKeyDown={event => {
              const next = event.key === "ArrowRight" ? (index + 1) % tabs.length
                : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length
                : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
              if (next === null) return;
              event.preventDefault();
              if (tabs[next]![0] === "board") setMonthKey(monthKeyFromDateKey(selected));
              setPane(tabs[next]![0]);
              document.getElementById(`${tabsId}-tab-${tabs[next]![0]}`)?.focus();
            }}>{label}</button>
        ))}
      </div>
      <div className="calendar-panel" role="tabpanel" id={`${tabsId}-panel`}
        aria-labelledby={`${tabsId}-tab-${pane}`} tabIndex={0}>
      {(pane === "calendar" || pane === "board") && (
        <>
          <div className="calendar-board-stack">
          <section className="card calendar-card">
            <CalendarBinding planner={pane === "board"}/>
            <header>
              <button className="chip" onClick={() => changeMonth(-1)} aria-label="Previous month">‹</button>
              <h2>{board.monthLabel}</h2>
              <button className="chip" onClick={() => changeMonth(1)} aria-label="Next month">›</button>
            </header>
            {pane === "calendar" && monthTools}
            {pane === "board" && <p className="weight-note">{props.view === "personal" ? "My dates" : "Household dates"}</p>}
            {pane === "board" ? <CalendarWeight key={`${scopeKey}:${monthKey}`} days={weightDays} selected={selected} onSelect={setSelected}
              renderItem={({item, allowPost, scheduledDate}) => <DayRow
                title={item.title} amountCents={item.amountCents} kind={item.kind}
                due={item.due && (item.source === "recurrence" || item.source === "appointment" || item.source === "work-settlement")}
                recurrenceId={allowPost && household.recurrences.some(row => row.id === item.recurrenceId && row.nextDate === item.date) ? item.recurrenceId : undefined}
                appointmentId={allowPost ? item.appointmentId : undefined} rhythmKey={item.rhythmKey}
                today={today} household={household} busy={props.busy}
                onAdopt={key => props.onCommand(current => adoptRhythm(current, key, today))}
                onAskPost={props.onAskPost} standingFactOnly={props.onboardingStandingFactOnly}
                date={item.date} onAskVisit={(draft, summary) => props.onAskVisit(draft, scheduledDate ? `${summary} Scheduled for ${scheduledDate}; this records the visit on ${item.date}.` : summary)}
                workSettlementId={item.source === "work-settlement" ? item.id : undefined}
                onAskWork={id => setWorkSettlement(workFacts.find(fact => fact.id === id) ?? null)}
                shiftEnvelopeId={item.shiftEnvelopeId} onOpenShiftEnvelope={props.onOpenShiftEnvelope}
              />} /> : <>
            <div className="cal-weekdays">
              {WEEKDAY_SHORT.map((label) => <span key={label}>{label}</span>)}
            </div>
            <div className="cal-grid">
              {board.days.map((day, index) => {
                const shown = day.items.slice(0, 3);
                const extra = day.items.length - shown.length;
                return (
                <div
                  key={day.date}
                  className="cal-cell"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => { event.preventDefault(); const id = draggedPotentialId || event.dataTransfer.getData("text/hearth-potential-expense"); if (id) movePotential(id, day.date); setDraggedPotentialId(null); }}
                >
                <button
                  type="button" data-calendar-date={day.date}
                  tabIndex={selected === day.date ? 0 : -1}
                  aria-label={`${new Intl.DateTimeFormat("en-CA", { dateStyle: "full", timeZone: "America/Toronto" }).format(new Date(`${day.date}T12:00:00Z`))}${day.items.length ? ` · ${day.items.map(item => item.title).join("; ")}` : " · Nothing scheduled"}`}
                  aria-current={day.isToday ? "date" : undefined}
                  aria-pressed={selected === day.date}
                  aria-controls={`${tabsId}-day`}
                  className={[
                    "cal-day",
                    day.inMonth ? "" : "outside",
                    day.isToday ? "today" : "",
                    selected === day.date ? "selected" : "",
                    selected === day.date && dayOpen ? "is-open" : "",
                    day.heat > 0.55 ? "hot" : "",
                  ].join(" ")}
                  onClick={() => {
                    setSelected(day.date);
                    setSelectedCalendarItemId(null);
                    if (phone) setMobileAddDate(day.date);
                    if (!day.inMonth) setMonthKey(monthKeyFromDateKey(day.date));
                    setDayOpen(phone ? true : selected === day.date ? !dayOpen : true);
                  }}
                  onKeyDown={event => {
                    const next = event.key === "ArrowRight" ? index + 1 : event.key === "ArrowLeft" ? index - 1
                      : event.key === "ArrowDown" ? index + 7 : event.key === "ArrowUp" ? index - 7
                      : event.key === "Home" ? index - index % 7 : event.key === "End" ? index + 6 - index % 7 : null;
                    if (next === null) return;
                    event.preventDefault();
                    const target = board.days[Math.max(0, Math.min(board.days.length - 1, next))]!;
                    setSelected(target.date);
                    setDayOpen(true);
                    if (phone) setMobileAddDate(target.date);
                    // Keep the focused week mounted; Month follows the chosen civil date on entry.
                    event.currentTarget.closest(".cal-grid")?.querySelector<HTMLButtonElement>(`[data-calendar-date="${target.date}"]`)?.focus();
                  }}
                  aria-expanded={selected === day.date && dayOpen}
                  style={day.heat ? { background: `color-mix(in srgb, var(--theme-calendar-heat, var(--copper)) ${(0.06 + Math.min(1, day.heat) * 0.22) * 100}%, var(--card))` } : undefined}
                >
                  <span className="num">{Number(day.date.slice(8))}</span>
                  <span className="cal-titles">
                    {shown.map((item) => (
                      <span key={item.id} className={`cal-title ${item.direction} kind-${item.kind}`} title={item.title}
                        draggable={item.source === "potential-expense" && !phone}
                        onDragStart={() => setDraggedPotentialId(item.potentialExpenseId ?? null)}
                        onDragEnd={() => setDraggedPotentialId(null)}>{item.title}</span>
                    ))}
                    {extra > 0 ? <span className="cal-title more">+{extra}</span> : null}
                  </span>
                </button>
                <button type="button" className={`cal-add ${phone ? mobileAddDate === day.date ? "is-revealed" : "" : selected === day.date ? "is-revealed" : ""}`} aria-label={`Add potential expense on ${formatDayLabel(day.date)}`}
                  tabIndex={phone && mobileAddDate !== day.date ? -1 : 0}
                  aria-hidden={phone && mobileAddDate !== day.date ? true : undefined}
                  onClick={() => { setSelected(day.date); setDayOpen(true); setPotentialEditor({ date: day.date }); }}>+</button>
                </div>
                );
              })}
            </div>
            </>}
            {pane === "board" && <details className="calendar-month-tools"><summary>Month tools</summary>
              {board.clashes[0] && <p className="weight-note">{describeClash(board.clashes[0])}</p>}{monthTools}
            </details>}
          </section>

          {pane === "calendar" && selectedDay && !dayOpen ? (
            <p className="muted">Select {formatDayLabel(selectedDay.date)} to reopen the day’s list.</p>
          ) : null}
          {pane === "calendar" && duePotential.length > 0 && (
            <section className="card calendar-due-potential" aria-label="Due potential expenses">
              <header><h2>Planned, not posted</h2><span className="muted">Due or overdue</span></header>
              {duePotential.map((plan) => (
                <PotentialExpenseRow key={`due:${plan.id}`}
                  plan={plan}
                  today={today}
                  busy={props.busy}
                  onEdit={(item) => setPotentialEditor({ date: item.date, plan: item })}
                  onMove={(item) => setPotentialEditor({ date: item.date, plan: item })}
                  onRemove={(item) => props.onCommand((current) => removePotentialExpense(current, { id: item.id, createdBy: props.memberId }))}
                  onQuick={(item) => props.onAskQuickPotential?.(item.id)}
                  onReview={(item) => props.onReviewPotential?.(item.id)}
                />
              ))}
            </section>
          )}
          {pane === "calendar" && selectedDay && (
            <section className="card calendar-selected-day" hidden={!dayOpen} id={`${tabsId}-day`} aria-label="Selected day">
              <header>
                <div>
                  <h2>{formatDayLabel(selectedDay.date)}</h2>
                  {(!phone || mobileAddDate === selectedDay.date) ? <button type="button" className="chip calendar-add-potential" onClick={() => setPotentialEditor({ date: selectedDay.date })}>+ Potential expense</button> : null}
                </div>
                <span className="muted">
                  {[
                    selectedDay.inCents ? `${formatCad(selectedDay.inCents)} in` : "",
                    selectedDay.outCents ? `${formatCad(selectedDay.outCents)} out` : "",
                    !selectedDay.inCents && !selectedDay.outCents
                      ? (selectedDay.items.length ? "on the board" : "quiet")
                      : "",
                  ].filter(Boolean).join(" · ")}
                </span>
              </header>
              {selectedDay.items.length === 0 ? (
                <p className="muted">Nothing on this day.</p>
              ) : selectedDay.items.map((item) => item.source === "potential-expense" && item.potentialExpenseId ? (
                <PotentialExpenseRow key={item.id}
                  plan={household.potentialExpenses.find((row) => row.id === item.potentialExpenseId)!}
                  today={today}
                  busy={props.busy}
                  onEdit={(plan) => setPotentialEditor({ date: plan.date, plan })}
                  onMove={(plan) => setPotentialEditor({ date: plan.date, plan })}
                  onRemove={(plan) => props.onCommand((current) => removePotentialExpense(current, { id: plan.id, createdBy: props.memberId }))}
                  onQuick={(plan) => props.onAskQuickPotential?.(plan.id)}
                  onReview={(plan) => props.onReviewPotential?.(plan.id)}
                />
              ) : (
                <DayRow
                  key={item.id}
                  title={item.title}
                  amountCents={item.amountCents}
                  kind={item.kind}
                  due={item.due && (item.source === "recurrence" || item.source === "appointment" || item.source === "work-settlement")}
                  recurrenceId={household.recurrences.some(row => row.id === item.recurrenceId && row.nextDate === item.date) ? item.recurrenceId : undefined}
                  appointmentId={item.appointmentId}
                  rhythmKey={item.rhythmKey}
                  today={today}
                  household={household}
                  busy={props.busy}
                  onAdopt={(key) => props.onCommand((current) => adoptRhythm(current, key, today))}
                  onAskPost={props.onAskPost}
                  standingFactOnly={props.onboardingStandingFactOnly}
                  date={selectedDay.date}
                  onAskVisit={props.onAskVisit}
                  workSettlementId={item.source === "work-settlement" ? item.id : undefined}
                  onAskWork={(id) => setWorkSettlement(workFacts.find((fact) => fact.id === id) ?? null)}
                  shiftEnvelopeId={item.shiftEnvelopeId}
                  onOpenShiftEnvelope={props.onOpenShiftEnvelope}
                  selected={selectedCalendarItemId === item.id}
                  onSelect={() => setSelectedCalendarItemId((current) => current === item.id ? null : item.id)}
                  onAddPotential={() => addPotentialForItem(item)}
                />
              ))}
            </section>
          )}
          </div>

          {pane === "calendar" && <details className="card hearth-collapse calendar-upcoming">
            <summary>
              <span className="hearth-collapse-title">Coming up</span>
              <span className="muted">{board.upcoming.length} in 21 days</span>
            </summary>
            {board.upcoming.length === 0 ? (
              <p className="muted">Quiet three weeks.</p>
            ) : board.upcoming.map((item) => item.source === "potential-expense" && item.potentialExpenseId ? (
              <PotentialExpenseRow key={`upcoming:${item.id}`}
                plan={household.potentialExpenses.find((row) => row.id === item.potentialExpenseId)!}
                today={today}
                busy={props.busy}
                onEdit={(plan) => setPotentialEditor({ date: plan.date, plan })}
                onMove={(plan) => setPotentialEditor({ date: plan.date, plan })}
                onRemove={(plan) => props.onCommand((current) => removePotentialExpense(current, { id: plan.id, createdBy: props.memberId }))}
                onQuick={(plan) => props.onAskQuickPotential?.(plan.id)}
                onReview={(plan) => props.onReviewPotential?.(plan.id)}
              />
            ) : (
              <div className="row" key={item.id}>
                <span><span className={`kind-pill ${item.kind}`}>{kindLabel(item.kind)}</span> {formatDayLabel(item.date)} · {item.title}</span>
                <span className={item.direction === "out" ? "right" : "muted"}>{formatCad(item.amountCents)}</span>
              </div>
            ))}
          </details>}
        </>
      )}

      {pane === "visits" && (
        <AppointmentsPage view={props.view}
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
          {props.onboardingStandingFactOnly && (
            <section className="card onboarding-recurrence-guide" aria-labelledby="regular-money-onboarding-title">
              <header>
                <h2 id="regular-money-onboarding-title">{copy("recurrences.title")}</h2>
                <span className={`pill ${onboardingProbe.complete ? "good" : ""}`}>
                  {copy("recurrences.count", { count: String(onboardingProbe.rows.length) })}
                </span>
              </header>
              <p>{copy("recurrences.guide")}</p>
              <p className="muted" role="status" aria-live="polite">
                {copy(onboardingProbe.complete ? "recurrences.ready" : "recurrences.minimum")}
              </p>
              {onboardingRecurrencePauseDue(onboardingProbe.rows.length) && (
                <p className="muted">{copy("recurrences.pause")}</p>
              )}
            </section>
          )}
          {repeatingDraft ? (
            <RepeatingForm
              key={repeatingDraft.id ?? "new-repeating"}
              household={household}
              today={today}
              initial={repeatingDraft}
              busy={props.busy}
              standingFactOnly={props.onboardingStandingFactOnly}
              onCancel={() => setRepeatingDraft(null)}
              onSubmit={(draft) => {
                setRepeatingDraft(null);
                props.onAskSaveRepeating(draft, repeatingConfirmSummary(draft, {
                  standingFactOnly: props.onboardingStandingFactOnly,
                }));
              }}
            />
          ) : (
            <div className="chips" style={{ marginBottom: 12 }}>
              <button
                type="button"
                className="chip selected"
                disabled={props.busy}
                onClick={() => setRepeatingDraft(blankRepeatingDraft(household, today))}
              >
                {props.onboardingStandingFactOnly ? copy("recurrences.add") : "Add repeating"}
              </button>
            </div>
          )}

          {suggested.length > 0 && !repeatingDraft && (
            <section className="card">
              <header>
                <h2>Spotted in the ledger</h2>
                <span className="muted">Not money yet</span>
              </header>
              <p className="muted">{props.onboardingStandingFactOnly
                ? copy("recurrences.adopt-explain")
                : "Adopt is a reminder. Mark paid posts."}</p>
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
                    <button className="chip" disabled={props.busy} onClick={() => setRepeatingDraft({ ...blankRepeatingDraft(household, today), type: rhythm.type, note: rhythm.note, amount: (rhythm.amountCents / 100).toFixed(2), cadence: rhythm.cadence, nextDate: rhythm.nextDate, accountId: rhythm.accountId, subcategoryId: rhythm.subcategoryId, kind: rhythm.kind, kindLocked: true })}>Edit suggested reminder</button>
                    <button className="chip" disabled={props.busy} onClick={() => props.onCommand((current) => dismissRhythm(current, rhythm.key))}>
                      Not a bill
                    </button>
                  </div>
                </article>
              ))}
            </section>
          )}

          <section className="card">
            <header>
              <h2>Repeating</h2>
              <span className="muted">{household.recurrences.length ? `${household.recurrences.filter((item) => item.active).length} active` : "None yet"}</span>
            </header>
            {household.recurrences.length === 0 ? (
              <p className="muted">{props.onboardingStandingFactOnly
                ? copy("recurrences.empty")
                : "Add repeating for a new bill, pay, or standing transfer. Mark paid posts."}</p>
            ) : household.recurrences.map((item) => (
              <RecurrenceCard
                key={item.id}
                item={item}
                today={today}
                busy={props.busy}
                onPause={() => props.onCommand((current) => pauseRecurrence(current, item.id))}
                onSkip={() => props.onCommand((current) => skipOccurrence(current, item.id))}
                onAskPost={props.onAskPost}
                standingFactOnly={props.onboardingStandingFactOnly}
                onEdit={() => setRepeatingDraft(draftFromRecurrence(item))}
              />
            ))}
          </section>
        </>
      )}

      {pane === "calendar" && (
        <section className="card calendar-integration" ref={integrationRef} tabIndex={-1} aria-label="Google calendar integration">
          <header>
            <h2>Google calendars</h2>
            <span className={`pill ${accounts.length ? "good" : ""}`}>{accounts.length ? `${accounts.length} connected` : "Optional"}</span>
          </header>
          <p className="muted">
            Connect Calendar separately from Hearth sign-in. Read your calendars and calendars shared with your Google account, including shared household calendars. These events appear only in your current browser and never post money.
          </p>
          {household.members.filter((member) => member.active && member.id === props.memberId).sort((left, right) => {
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
                  <span className="muted"> {label}{link && !account ? " · Calendar access needed on this device" : ""}</span>
                </span>
                {account ? (
                  <div className="row">
                  <button className="chip selected" disabled={googleBusy || !configured} onClick={() => void connectMember(member.id)}>Reconnect Calendar</button>
                  <button className="chip" onClick={() => {
                    disconnectGoogleAccount(environment, member.id, household.householdId);
                    // Removing this device token must not unlink household sign-in identity.
                    refreshAccounts();
                    setOverlays((items) => items.filter((item) => item.memberId !== member.id));
                  }}>
                    Disconnect
                  </button>
                  </div>
                ) : (
                  <button className="chip selected" disabled={googleBusy || !configured} onClick={() => void connectMember(member.id)}>
                    Connect Calendar
                  </button>
                )}
              </div>
            );
          })}
          {!calendarGoogleOn && (
            <p className="muted">Calendar access is off. Connect Calendar here to enable it.</p>
          )}
          {!configured && (
            <p className="muted">Google connection isn’t available here yet. You can still download your calendar with reminders.</p>
          )}
          <p className="muted" role="status">{googleBusy ? "Reading Google calendars…" : readCalendars.length ? `${overlays.length} events from ${readCalendars.length} calendars: ${readCalendars.join(", ")}` : accounts.length && calendarGoogleOn && !googleError ? "No readable Google calendars were returned." : "Connect or reconnect to read Google events."}</p>
          {accounts.length > 0 && <button className="ghost" disabled={googleBusy || !calendarGoogleOn} onClick={refreshAccounts}>Refresh Google events</button>}
          {googleError ? <KitchenNotice message={googleError} /> : null}
          <button className="primary" disabled={googleBusy || !calendarGoogleOn || !household.recurrences.some((item) => item.active)} onClick={() => void remindOnGoogle()}>
            {googleBusy ? "Talking to Google…" : "Write reminders to Google"}
          </button>
          <button className="ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => downloadIcs(household, today)}>
            Download .ics with alarms
          </button>
        </section>
      )}
      </div>
      <p className="sr-only" aria-live="polite">{calendarAnnouncement}</p>
      {potentialEditor && (
        <PotentialExpenseEditor
          key={`${potentialEditor.plan?.id ?? "new"}:${potentialEditor.date}`}
          household={household}
          memberId={props.memberId}
          view={props.view ?? "household"}
          date={potentialEditor.date}
          plan={potentialEditor.plan}
          linkedCalendarItem={potentialEditor.linkedCalendarItem}
          busy={props.busy}
          onCancel={() => setPotentialEditor(null)}
          onSave={savePotential}
        />
      )}
      {workSettlement && (
        <WorkSettlementSheet
          household={household}
          fact={workSettlement}
          busy={props.busy}
          onCancel={() => setWorkSettlement(null)}
          onConfirm={(input) => {
            const fact = workSettlement;
            setWorkSettlement(null);
            if (fact.kind === "deferred-tipout") {
              props.onCommand((current) => payDeferredWorkTipOut(current, { jobId: fact.jobId, ...input, createdBy: props.memberId }));
            } else {
              props.onCommand((current) => settleWorkReceivable(current, { jobId: fact.jobId, kind: fact.kind === "wages" ? "wages" : "card-tips", ...input, createdBy: props.memberId }));
            }
          }}
        />
      )}
    </div>
  );
}

function PotentialExpenseRow({ plan, today, busy, onEdit, onMove, onRemove, onQuick, onReview }: {
  plan: PotentialExpensePlan;
  today: DateKey;
  busy: boolean;
  onEdit: (plan: PotentialExpensePlan) => void;
  onMove: (plan: PotentialExpensePlan) => void;
  onRemove: (plan: PotentialExpensePlan) => void;
  onQuick: (plan: PotentialExpensePlan) => void;
  onReview: (plan: PotentialExpensePlan) => void;
}) {
  const due = plan.date <= today;
  return <article className={`potential-expense-row ${due ? "is-due" : ""}`} draggable={!busy}
    onDragStart={(event) => event.dataTransfer.setData("text/hearth-potential-expense", plan.id)}>
    <div className="row">
      <span><span className="kind-pill potential-expense">Planned</span> {plan.title}{due ? " · due" : ""}</span>
      <strong>{formatCad(plan.expectedAmountCents)}</strong>
    </div>
    <p className="muted">Planned—not posted · {plan.visibility === "personal" ? "Personal" : plan.visibility === "both" ? "Both" : "Shared"}{plan.linkedCalendarItem ? ` · For ${plan.linkedCalendarItem.title}` : ""}</p>
    <div className="chips">
      <button type="button" className="chip selected" disabled={busy} onClick={() => onQuick(plan)}>Quick Confirm</button>
      <button type="button" className="chip" disabled={busy} onClick={() => onReview(plan)}>Review in Add</button>
      <button type="button" className="chip" disabled={busy} onClick={() => onEdit(plan)}>Edit</button>
      <button type="button" className="chip" disabled={busy} onClick={() => onMove(plan)}>Move</button>
      <button type="button" className="chip" disabled={busy} onClick={() => onRemove(plan)}>Remove</button>
    </div>
  </article>;
}

function DayRow(props: {
  title: string;
  amountCents: number;
  kind: string;
  due: boolean;
  recurrenceId?: string;
  appointmentId?: string;
  rhythmKey?: string;
  workSettlementId?: string;
  shiftEnvelopeId?: string;
  date: DateKey;
  today: DateKey;
  household: Household;
  busy: boolean;
  onAdopt: (key: string) => void;
  onAskPost: (recurrenceId: string, summary: string) => void;
  onAskVisit: (draft: VisitPostDraft, summary: string) => void;
  onAskWork: (id: string) => void;
  onOpenShiftEnvelope: (envelopeId: string) => void;
  selected?: boolean;
  onSelect?: () => void;
  onAddPotential?: () => void;
  standingFactOnly?: boolean;
}) {
  const rec = props.recurrenceId ? props.household.recurrences.find((item) => item.id === props.recurrenceId) : undefined;
  const visit = props.appointmentId ? props.household.appointments.find((item) => item.id === props.appointmentId) : undefined;
  return (
    <div className={`calendar-event-row ${props.selected ? "is-selected" : ""}`}>
      {props.onSelect ? <button type="button" className="calendar-event-focus" aria-pressed={props.selected} onClick={props.onSelect}>
        <span className={`kind-pill ${props.kind}`}>{kindLabel(props.kind)}</span> {props.title}
        {props.due ? " · due" : ""}
      </button> : <span className="calendar-event-label"><span className={`kind-pill ${props.kind}`}>{kindLabel(props.kind)}</span> {props.title}{props.due ? " · due" : ""}</span>}
      <span className="calendar-event-actions">
        {props.amountCents ? formatCad(props.amountCents) : ""}
        {props.rhythmKey && (
          <button className="chip" disabled={props.busy} onClick={() => props.onAdopt(props.rhythmKey!)}>Adopt</button>
        )}
        {rec && rec.nextDate <= props.today && !props.standingFactOnly && (
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
        {props.workSettlementId && props.due && (
          <button className="chip selected" disabled={props.busy} onClick={() => props.onAskWork(props.workSettlementId!)}>Confirm</button>
        )}
        {props.shiftEnvelopeId && (
          <button className="chip selected" disabled={props.busy} onClick={() => props.onOpenShiftEnvelope(props.shiftEnvelopeId!)}>Open</button>
        )}
        {props.selected && props.onAddPotential && (
          <button type="button" className="chip calendar-event-add-potential" disabled={props.busy} onClick={props.onAddPotential}>+ Potential expense</button>
        )}
      </span>
    </div>
  );
}

function RecurrenceCard(props: {
  item: Recurrence;
  today: DateKey;
  busy: boolean;
  onPause: () => void;
  onSkip: () => void;
  onEdit: () => void;
  onAskPost: (recurrenceId: string, summary: string) => void;
  standingFactOnly?: boolean;
}) {
  const { item } = props;
  const due = item.active && item.nextDate <= props.today;
  return (
    <article className="rhythm-card" data-recurrence-id={item.id} tabIndex={-1}>
      <div className="row">
        <span>
          <span className={`kind-pill ${item.kind}`}>{kindLabel(item.kind)}</span> {item.note || "Recurring"}
          {!item.active ? " · paused" : due ? props.standingFactOnly ? " · next today" : " · due" : ""}
        </span>
        <span>{formatCad(item.amountCents)}</span>
      </div>
      <p className="muted">
        {item.cadence} · next {formatDayLabel(item.nextDate)}
        {item.type === "transfer" ? " · transfer" : item.type === "income" ? " · income" : ""}
        {item.origin === "detected" ? " · spotted in the ledger" : ""}
        {Object.keys(item.googleSync).length ? " · on Google" : ""}
      </p>
      <div className="chips">
        {due && !props.standingFactOnly && (
          <button
            className="chip selected"
            disabled={props.busy}
            onClick={() => props.onAskPost(item.id, `This posts ${formatCad(item.amountCents)} ${item.note || "recurring"} on ${item.nextDate} into the books.`)}
          >
            Mark paid
          </button>
        )}
        <button className="chip" disabled={props.busy} onClick={props.onEdit}>Edit</button>
        {!props.standingFactOnly && (
          <button className="chip" disabled={props.busy} onClick={props.onSkip}>Skip once</button>
        )}
        <button className="chip" disabled={props.busy} onClick={props.onPause}>{item.active ? "Pause" : "Resume"}</button>
      </div>
    </article>
  );
}
