import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import {
  INSTRUMENT_KIND,
  auditOpinion,
  blotterFacts,
  cookOffScore,
  defaultWidePosition,
  fallbackWeather,
  hourInToronto,
  householdWallet,
  instrumentRotation,
  kettlePhase,
  lampIsDark,
  levelLayoutItems,
  loadOfficeLayout,
  loadOfficeRings,
  mailOverdue,
  claimsOverdue,
  claimsTraySentence,
  promoteRail,
  railRows,
  readTorontoWeather,
  resolveRoom,
  runHealthCheck,
  saveOfficeLayout,
  saveOfficeRings,
  shiftPostingStreak,
  sitDownPostcard,
  snapGrid,
  subscribeOfficeIntent,
  tidyOfficeLayout,
  visibleInstruments,
  walletWarn,
  requestCalendarPane,
  sillOverview,
  type DeskRing,
  type Environment,
  type Household,
  type InstrumentId,
  type OfficeBreakpoint,
  type OfficeLayout,
} from "./core/index.ts";
import type { Dashboard } from "./core/insights.ts";
import type { HearthTab } from "./core/hercules.ts";
import type { Account, Category, CommitResult, UndoToken } from "./core/index.ts";
import { WindowBand } from "./widgets/WindowBand.tsx";
import { DeskItem } from "./widgets/DeskItem.tsx";
import { BlotterBody, BlotterGlance } from "./widgets/Blotter.tsx";
import { WalletBody, WalletGlance } from "./widgets/WalletTray.tsx";
import { CalculatorBody, CalculatorGlance } from "./widgets/CalculatorPad.tsx";
import { ChalkboardBody, chalkboardGlance } from "./widgets/ChalkboardDesk.tsx";
import { MailBody, MailGlance } from "./widgets/Mail.tsx";
import { ClaimsBody, ClaimsGlance } from "./widgets/ClaimsTray.tsx";
import { TimesheetBody, TimesheetGlance } from "./widgets/Timesheet.tsx";
import { PostcardBody, PostcardGlance } from "./widgets/Postcard.tsx";
import { CookOffBody, CookOffGlance } from "./widgets/CookOffKettle.tsx";
import { JarsBody, JarsGlance } from "./widgets/Jars.tsx";
import { LampBody, LampGlance, lampAria } from "./widgets/Lamp.tsx";
import { Cabinets } from "./widgets/Cabinets.tsx";
import { CalendarBody, CalendarGlance } from "./widgets/CalendarDesk.tsx";
import { AppointmentsBody, AppointmentsGlance } from "./widgets/AppointmentsDesk.tsx";
import { SillOverviewPlate } from "./widgets/SillOverview.tsx";
import type { DeskForm, DeskMode } from "./widgets/deskTypes.ts";

const WIDE = 720;

function useBreakpoint(): OfficeBreakpoint {
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.innerWidth >= WIDE);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${WIDE}px)`);
    const onChange = () => setWide(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return wide ? "wide" : "phone";
}

export function Office({
  household,
  dashboard,
  today,
  environment,
  memberId,
  view,
  busy,
  clinkOn,
  adding,
  form,
  mode,
  error,
  categories,
  postLabel,
  onClinkOn,
  onForm,
  onPost,
  onMore,
  onMilk,
  onCoffee,
  onShift,
  onClockIn,
  onAbandonShift,
  onSignOut,
  onFinishedShift,
  onPayCard,
  onOpenAccount,
  onBuyNote,
  onKitchen,
  onMarkPaid,
  onAskSettle,
  onAskStartJar,
  onSitDown,
  onGo,
}: {
  household: Household;
  dashboard: Dashboard;
  today: string;
  environment: Environment;
  memberId: string;
  view: "household" | "personal";
  busy: boolean;
  clinkOn: boolean;
  adding: boolean;
  form: DeskForm;
  mode: DeskMode;
  error: string;
  categories: Category[];
  postLabel: string;
  onClinkOn: (on: boolean) => void;
  onForm: (next: DeskForm) => void;
  onPost: () => void;
  onMore: () => void;
  onMilk: () => void;
  onCoffee: () => void;
  onShift: () => void;
  onClockIn: () => void;
  onAbandonShift: () => void;
  onSignOut: () => void;
  onFinishedShift: () => void;
  onPayCard: (account: Account) => void;
  onOpenAccount: (accountId: string) => void;
  onBuyNote: (text: string) => void;
  onKitchen: (fn: (current: Household) => CommitResult) => void;
  onMarkPaid: (recurrenceId: string, summary: string) => void;
  onAskSettle: (claimId: string, summary: string) => void;
  onAskStartJar: (appointmentId: string, summary: string) => void;
  onSitDown: (next: Household, token?: UndoToken) => void;
  onGo: (tab: HearthTab) => void;
}) {
  const breakpoint = useBreakpoint();
  const [layout, setLayout] = useState<OfficeLayout>(() => loadOfficeLayout(environment, breakpoint, localStorage));
  const [rings, setRings] = useState<DeskRing[]>(() => loadOfficeRings(environment, localStorage));
  const [weather] = useState(() => fallbackWeather(today));
  const [reading, setReading] = useState(weather);
  const [bumpId, setBumpId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<InstrumentId | null>(null);
  const [lifted, setLifted] = useState<InstrumentId | null>(null);
  const drag = useRef<{
    id: InstrumentId;
    px: number;
    py: number;
    x: number;
    y: number;
    moved: boolean;
    timer: number | null;
  } | null>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  useEffect(() => {
    setLayout(loadOfficeLayout(environment, breakpoint, localStorage));
  }, [environment, breakpoint]);

  useEffect(() => {
    saveOfficeLayout(environment, breakpoint, layout, localStorage);
  }, [environment, breakpoint, layout]);

  useEffect(() => {
    return () => {
      saveOfficeLayout(environment, breakpoint, { ...layoutRef.current, expanded: null }, localStorage);
    };
  }, [environment, breakpoint]);

  useEffect(() => {
    setRings(loadOfficeRings(environment, localStorage));
  }, [environment]);

  useEffect(() => {
    saveOfficeRings(environment, rings, localStorage);
  }, [environment, rings]);

  useEffect(() => {
    let live = true;
    void readTorontoWeather({ environment, today, storage: localStorage }).then((next) => {
      if (live) setReading(next);
    });
    return () => { live = false; };
  }, [environment, today]);

  useEffect(() => {
    return subscribeOfficeIntent((intent) => {
      if (intent.type === "expand") {
        setLayout((current) => ({ ...current, expanded: intent.id, windowMinimized: false }));
      }
      if (intent.type === "collapse") {
        setLayout((current) => ({ ...current, expanded: null }));
      }
      if (intent.type === "tidy") {
        setLayout((current) => tidyOfficeLayout(current, breakpoint));
      }
      if (intent.type === "bump") {
        setBumpId(intent.id);
        window.setTimeout(() => setBumpId((id) => (id === intent.id ? null : id)), 220);
      }
    });
  }, [breakpoint]);

  const findings = useMemo(() => runHealthCheck(household), [household]);
  const opinion = useMemo(() => auditOpinion(household), [household]);
  const wallet = useMemo(() => householdWallet(household, today), [household, today]);
  const streak = useMemo(() => shiftPostingStreak(household, today), [household, today]);
  const postcard = useMemo(() => sitDownPostcard(household), [household]);
  const cook = useMemo(() => cookOffScore(household, today), [household, today]);
  const phase = kettlePhase(today, hourInToronto());
  const room = resolveRoom(phase, reading.glass);
  const lampLit = !lampIsDark(findings);
  const blotter = blotterFacts(dashboard, opinion, findings.length);
  const sill = useMemo(() => sillOverview(household, dashboard, today), [household, dashboard, today]);
  const order = promoteRail(visibleInstruments(layout), room.promoted, lampLit);
  const inert = adding;

  function toggle(id: InstrumentId) {
    setLayout((current) => ({
      ...current,
      expanded: current.expanded === id ? null : id,
    }));
  }

  function cycleWindow() {
    setLayout((current) => {
      if (current.windowMinimized) return { ...current, windowMinimized: false, expanded: null };
      if (current.expanded === "window") return { ...current, expanded: null, windowMinimized: true };
      return { ...current, expanded: "window", windowMinimized: false };
    });
  }

  function reorder(id: InstrumentId, dir: -1 | 1) {
    setLayout((current) => {
      const ids = visibleInstruments(current);
      const at = ids.indexOf(id);
      if (at < 0) return current;
      const nextAt = Math.max(0, Math.min(ids.length - 1, at + dir));
      if (nextAt === at) return current;
      const next = [...ids];
      const [row] = next.splice(at, 1);
      next.splice(nextAt, 0, row!);
      const hidden = current.items.filter((item) => item.hidden);
      return {
        ...current,
        items: [...next.map((itemId) => current.items.find((item) => item.id === itemId) ?? { id: itemId }), ...hidden],
      };
    });
  }

  function onHeaderDown(id: InstrumentId, event: PointerEvent<HTMLButtonElement>) {
    const item = layout.items.find((row) => row.id === id);
    drag.current = {
      id,
      px: event.clientX,
      py: event.clientY,
      x: item?.x ?? 0,
      y: item?.y ?? 0,
      moved: false,
      timer: breakpoint === "phone"
        ? window.setTimeout(() => {
            setDragging(id);
            setLifted(id);
            if (drag.current) drag.current.moved = true;
          }, 400)
        : null,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onHeaderMove(id: InstrumentId, event: PointerEvent<HTMLButtonElement>) {
    const start = drag.current;
    if (!start || start.id !== id) return;
    const dx = event.clientX - start.px;
    const dy = event.clientY - start.py;
    if (breakpoint === "wide") {
      if (Math.abs(dx) + Math.abs(dy) > 8) {
        start.moved = true;
        setDragging(id);
        setLayout((current) => ({
          ...current,
          items: current.items.map((item) => item.id === id
            ? { ...item, x: snapGrid(start.x + dx), y: snapGrid(start.y + dy) }
            : item),
        }));
      }
      return;
    }
    if (dragging === id && Math.abs(dy) > 12) start.moved = true;
  }

  function onHeaderUp(id: InstrumentId, event: PointerEvent<HTMLButtonElement>) {
    const start = drag.current;
    if (start?.timer) window.clearTimeout(start.timer);
    if (breakpoint === "phone" && start?.moved && dragging === id) {
      const ids = order;
      const from = ids.indexOf(id);
      const rowH = 56;
      const delta = Math.round((event.clientY - (start.py)) / rowH);
      const to = Math.max(0, Math.min(ids.length - 1, from + delta));
      if (to !== from) {
        const dir = to > from ? 1 : -1;
        let steps = Math.abs(to - from);
        while (steps--) reorder(id, dir);
      }
    }
    if (breakpoint === "wide" && start?.moved) {
      setLayout((current) => ({
        ...current,
        items: levelLayoutItems(current.items),
      }));
      const item = layout.items.find((row) => row.id === id);
      setRings((current) => [{ id, x: start.x, y: start.y, at: Date.now() }, ...current.filter((row) => row.id !== id)].slice(0, 8));
      if (item && (item.x == null || item.y == null)) {
        /* saved in move */
      }
    }
    drag.current = null;
    setDragging(null);
  }

  function onHeaderKey(id: InstrumentId, event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      setLifted((current) => (current === id ? null : id));
      return;
    }
    if (event.key === "Escape") {
      setLifted(null);
      return;
    }
    if (lifted === id && (event.key === "ArrowUp" || event.key === "ArrowLeft")) {
      event.preventDefault();
      reorder(id, -1);
    }
    if (lifted === id && (event.key === "ArrowDown" || event.key === "ArrowRight")) {
      event.preventDefault();
      reorder(id, 1);
    }
  }

  function frame(
    id: InstrumentId,
    name: string,
    glance: ReactNode,
    aria: string,
    body: ReactNode,
    extra?: { warn?: boolean; extraClass?: string; perchable?: boolean; pair?: boolean; index: number },
  ) {
    const item = layout.items.find((row) => row.id === id);
    const pos = extra
      ? { x: item?.x ?? defaultWidePosition(extra.index).x, y: item?.y ?? defaultWidePosition(extra.index).y }
      : { x: 8, y: 8 };
    return (
      <DeskItem
        key={id}
        id={id}
        kind={INSTRUMENT_KIND[id]}
        perchable={extra?.perchable !== false}
        warn={Boolean(extra?.warn)}
        name={name}
        glance={glance}
        aria={aria}
        expanded={layout.expanded === id}
        minimized={layout.minimized.includes(id)}
        rotation={instrumentRotation(id)}
        bump={bumpId === id}
        inert={inert}
        dragging={dragging === id || lifted === id}
        breakpoint={breakpoint}
        x={pos.x}
        y={pos.y}
        pair={extra?.pair}
        extraClass={extra?.extraClass}
        onToggle={() => toggle(id)}
        onHeaderPointerDown={(event) => onHeaderDown(id, event)}
        onHeaderPointerMove={(event) => onHeaderMove(id, event)}
        onHeaderPointerUp={(event) => onHeaderUp(id, event)}
        onHeaderPointerCancel={() => {
          if (drag.current?.timer) window.clearTimeout(drag.current.timer);
          drag.current = null;
          setDragging(null);
        }}
        onHeaderKeyDown={(event) => onHeaderKey(id, event)}
      >
        {body}
      </DeskItem>
    );
  }

  const mailWarn = mailOverdue(dashboard, today);
  const claimsWarn = claimsOverdue(household);
  const walletIsWarn = walletWarn(wallet);

  const renderers: Record<InstrumentId, (index: number, pair?: boolean) => ReactNode> = {
    calculator: (index, pair) => frame(
      "calculator",
      "Calculator",
      <CalculatorGlance amount={form.amount} />,
      `Calculator. ${form.note || "Desk pad."}`,
      <CalculatorBody
        form={form}
        setForm={onForm}
        mode={mode}
        accounts={household.accounts}
        categories={categories}
        postLabel={postLabel}
        error={error}
        busy={busy}
        onPost={onPost}
        onMore={onMore}
        onMilk={onMilk}
        onCoffee={onCoffee}
        onShift={onShift}
      />,
      { index, pair, perchable: true },
    ),
    blotter: (index, pair) => frame(
      "blotter",
      "Blotter",
      <BlotterGlance dashboard={dashboard} opinion={opinion} findings={findings.length} />,
      `Blotter. Month net ${blotter.glance}. ${opinion.kind} opinion.`,
      <BlotterBody dashboard={dashboard} opinion={opinion} findings={findings.length} />,
      { index, pair },
    ),
    wallet: (index, pair) => frame(
      "wallet",
      "Wallet",
      <WalletGlance wallet={wallet} />,
      `Wallet tray. Cash ${wallet.cashCents}.`,
      <WalletBody wallet={wallet} onPayCard={onPayCard} onOpenAccount={onOpenAccount} />,
      { index, pair, warn: wallet.hottestCard?.daysUntilDue != null && wallet.hottestCard.daysUntilDue < 0, extraClass: walletIsWarn ? "instrument-wallet" : undefined },
    ),
    chalkboard: (index, pair) => frame(
      "chalkboard",
      "Chalkboard",
      chalkboardGlance(household),
      `Chalkboard. ${chalkboardGlance(household)}`,
      <ChalkboardBody
        household={household}
        memberId={memberId}
        today={today}
        busy={busy}
        environment={environment}
        clinkOn={clinkOn}
        onClinkOn={onClinkOn}
        onCommand={onKitchen}
        onBuyNote={onBuyNote}
      />,
      { index, pair },
    ),
    mail: (index, pair) => frame(
      "mail",
      "Mail",
      <MailGlance dashboard={dashboard} today={today} />,
      `Mail. ${dashboard.upcoming[0] ? dashboard.upcoming[0].title : "No money dates in the next while."}`,
      <MailBody dashboard={dashboard} today={today} onMarkPaid={onMarkPaid} onCalendar={() => onGo("calendar")} />,
      { index, pair, warn: mailWarn, extraClass: mailWarn ? "is-overdue" : undefined },
    ),
    claims: (index, pair) => frame(
      "claims",
      "Claims",
      <ClaimsGlance household={household} today={today} />,
      `Claims tray. ${claimsTraySentence(household, today)}`,
      <ClaimsBody
        household={household}
        today={today}
        busy={busy}
        onAskSettle={onAskSettle}
        onCalendar={() => {
          requestCalendarPane("visits", localStorage);
          onGo("calendar");
        }}
      />,
      { index, pair, warn: claimsWarn, extraClass: claimsWarn ? "is-overdue" : undefined },
    ),
    timesheet: (index, pair) => frame(
      "timesheet",
      "Timesheet",
      <TimesheetGlance household={household} streak={streak} />,
      `Timesheet. ${streak.spoken}`,
      <TimesheetBody
        household={household}
        streak={streak}
        memberName={household.members.find((member) => member.id === memberId)?.name ?? "You"}
        busy={busy}
        onClockIn={onClockIn}
        onAbandon={onAbandonShift}
        onSignOut={onSignOut}
        onFinished={onFinishedShift}
      />,
      { index, pair, warn: streak.waiting, extraClass: streak.waiting ? "clock-droop" : undefined },
    ),
    calendar: (index, pair) => frame(
      "calendar",
      "Calendar",
      <CalendarGlance household={household} today={today} />,
      "Calendar. Upcoming dates.",
      <CalendarBody
        household={household}
        today={today}
        onCalendar={() => {
          requestCalendarPane("board", localStorage);
          onGo("calendar");
        }}
      />,
      { index, pair },
    ),
    appointments: (index, pair) => frame(
      "appointments",
      "Appointments",
      <AppointmentsGlance household={household} today={today} />,
      "Appointments. Upcoming visits.",
      <AppointmentsBody
        household={household}
        today={today}
        busy={busy}
        onStartJar={onAskStartJar}
        onAppointments={() => {
          requestCalendarPane("visits", localStorage);
          onGo("calendar");
        }}
      />,
      { index, pair },
    ),
    postcard: (index, pair) => frame(
      "postcard",
      "Postcard",
      <PostcardGlance card={postcard} />,
      `Postcard. ${postcard.sentence}`,
      <PostcardBody household={household} card={postcard} viewPersonal={view === "personal"} onApply={onSitDown} />,
      { index, pair },
    ),
    cookoff: (index, pair) => frame(
      "cookoff",
      "Cook-off",
      <CookOffGlance score={cook} />,
      `Cook-off. ${cookOffEmptySafe(cook)}`,
      <CookOffBody score={cook} />,
      { index, pair, extraClass: cook.winner === "kitchen" ? "steam" : undefined },
    ),
    jars: (index, pair) => frame(
      "jars",
      "Jars",
      <JarsGlance dashboard={dashboard} />,
      `Jars. ${dashboard.goals[0]?.goal.name ?? "No jars on the shelf yet."}`,
      <JarsBody dashboard={dashboard} today={today} onPlan={() => onGo("plan")} />,
      { index, pair },
    ),
    lamp: (index, pair) => frame(
      "lamp",
      "Lamp",
      <LampGlance findings={findings} />,
      lampAria(findings),
      <LampBody findings={findings} onMore={() => onGo("more")} />,
      { index, pair, warn: lampLit, extraClass: lampLit ? "is-lit" : undefined },
    ),
  };

  const rows = breakpoint === "phone" ? railRows(order) : order.map((id) => id);

  return (
    <div
      className={`office glass-${reading.glass} ${adding ? "is-adding" : ""} ${breakpoint === "wide" && layout.expanded && layout.expanded !== "window" ? "is-wide-dim" : ""}`}
      style={{ ["--room-dim" as string]: String(room.roomDim), ["--room-cool" as string]: String(room.roomCool) }}
    >
      <WindowBand
        reading={reading}
        expanded={layout.expanded === "window"}
        minimized={layout.windowMinimized}
        stale={dashboard.stale}
        onToggle={cycleWindow}
      />
      <SillOverviewPlate overview={sill} compact={layout.windowMinimized} />
      <div className={`desk-canvas ${breakpoint === "wide" ? "desk-wide" : "desk-rail"} ${dragging && breakpoint === "wide" ? "is-grid" : ""}`}>
        {breakpoint === "wide" && rings.map((ring) => (
          <div key={`${ring.id}-${ring.at}`} className="desk-ring" style={{ left: ring.x, top: ring.y }} />
        ))}
        {breakpoint === "phone"
          ? rows.map((row, index) => {
              if (Array.isArray(row)) {
                return (
                  <div className="desk-row pair" key={`${row[0]}-${row[1]}`}>
                    {renderers[row[0]](index, true)}
                    {renderers[row[1]](index, true)}
                  </div>
                );
              }
              return <div className="desk-row" key={row}>{renderers[row](index)}</div>;
            })
          : order.map((id, index) => renderers[id](index))}
      </div>
      <Cabinets onGo={onGo} />
    </div>
  );
}

function cookOffEmptySafe(score: { groceryCents: number; coffeeCents: number; sentence: string }): string {
  if (score.groceryCents === 0 && score.coffeeCents === 0) return "Nothing cooked, nothing bought.";
  return score.sentence;
}
