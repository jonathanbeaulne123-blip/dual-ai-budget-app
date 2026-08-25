import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import {
  INSTRUMENT_KIND,
  auditOpinion,
  blotterFacts,
  cookOffScore,
  fallbackWeather,
  hourInToronto,
  householdWallet,
  instrumentRotation,
  kettlePhase,
  lampIsDark,
  levelLayoutItems,
  loadOfficeLayout,
  loadOfficeLook,
  loadOfficeRings,
  mailOverdue,
  claimsOverdue,
  claimsTraySentence,
  promoteRail,
  readTorontoWeather,
  loadPhonePlacePrefs,
  resolveRoom,
  runHealthCheck,
  saveOfficeLayout,
  saveOfficeLook,
  saveOfficeRings,
  shiftPostingStreak,
  sitDownPostcard,
  snapGrid,
  subscribeOfficeIntent,
  emitOfficeIntent,
  tidyOfficeLayout,
  visibleInstruments,
  walletWarn,
  requestCalendarPane,
  sillOverview,
  formatCad,
  applyPersonality,
  buildDeskSyncPayload,
  cycleInstrumentSize,
  instrumentIsOpen,
  toggleInstrumentPin,
  MAX_USER_PINS,
  packWide,
  sizeOf,
  bumpLayoutForExpand,
  collapseExpandedLayout,
  expandShellFor,
  EXPAND_SIZE,
  SIZE_HEIGHT,
  DESK_GUTTER,
  INSTRUMENT_LABEL,
  PERSONALITY_BLURB,
  PERSONALITY_DESK,
  PERSONALITY_LABEL,
  PINNED_INSTRUMENTS,
  STOCK_LABEL,
  type DeskRing,
  type DeskPersonality,
  type Environment,
  type Household,
  type InstrumentId,
  type InstrumentSize,
  type OfficeBreakpoint,
  type OfficeLayout,
  type OfficeLook,
  type PaperStock,
} from "./core/index.ts";
import type { Dashboard } from "./core/insights.ts";
import type { HearthTab } from "./core/hercules.ts";
import type { Account, Category, CommitResult, UndoToken } from "./core/index.ts";
import { OfficePhone } from "./OfficePhone.tsx";
import { WindowBand } from "./widgets/WindowBand.tsx";
import { DeskItem } from "./widgets/DeskItem.tsx";
import { BlotterBody, BlotterGlance } from "./widgets/Blotter.tsx";
import { WalletBody, WalletGlance } from "./widgets/WalletTray.tsx";
import { CalculatorBody, CalculatorGlance } from "./widgets/CalculatorPad.tsx";
import { ChalkboardBody } from "./widgets/ChalkboardDesk.tsx";
import { MailBody, MailGlance } from "./widgets/Mail.tsx";
import { ClaimsBody, ClaimsGlance } from "./widgets/ClaimsTray.tsx";
import { TimesheetBody, TimesheetGlance } from "./widgets/Timesheet.tsx";
import { PostcardBody, PostcardGlance } from "./widgets/Postcard.tsx";
import { CookOffBody, CookOffGlance } from "./widgets/CookOffKettle.tsx";
import { JarsBody, JarsGlance } from "./widgets/Jars.tsx";
import { LampBody, LampGlance, lampAria } from "./widgets/Lamp.tsx";
import { Cabinets, type DeskSheet } from "./widgets/Cabinets.tsx";
import { CalendarBody, CalendarGlance } from "./widgets/CalendarDesk.tsx";
import { AppointmentsBody, AppointmentsGlance } from "./widgets/AppointmentsDesk.tsx";
import { SillOverviewPlate } from "./widgets/SillOverview.tsx";
import { AccountsBody, AccountsGlance } from "./widgets/AccountsDesk.tsx";
import { WardrobeBody, wardrobeGlance } from "./widgets/WardrobeDesk.tsx";
import { HangmanBody, HangmanGlance, TicTacToeBody, TicTacToeGlance } from "./widgets/GamesDesk.tsx";
import { pullDeskAppearance, pushDeskAppearance } from "./google/index.ts";
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
  onClockIn,
  onAbandonShift,
  onSignOut,
  onFinishedShift,
  onPayCard,
  onOpenAccount,
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
  onClockIn: () => void;
  onAbandonShift: () => void;
  onSignOut: () => void;
  onFinishedShift: () => void;
  onPayCard: (account: Account) => void;
  onOpenAccount: (accountId: string) => void;
  onKitchen: (fn: (current: Household) => CommitResult) => void;
  onMarkPaid: (recurrenceId: string, summary: string) => void;
  onAskSettle: (claimId: string, summary: string) => void;
  onAskStartJar: (appointmentId: string, summary: string) => void;
  onSitDown: (next: Household, token?: UndoToken) => void;
  onGo: (tab: HearthTab) => void;
}) {
  const breakpoint = useBreakpoint();
  const [layout, setLayout] = useState<OfficeLayout>(() => loadOfficeLayout(environment, breakpoint, localStorage, memberId));
  const [rings, setRings] = useState<DeskRing[]>(() => loadOfficeRings(environment, localStorage));
  const [weather] = useState(() => fallbackWeather(today));
  const [reading, setReading] = useState(weather);
  const [bumpId, setBumpId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<InstrumentId | null>(null);
  const [lifted, setLifted] = useState<InstrumentId | null>(null);
  const [look, setLook] = useState<OfficeLook>(() => loadOfficeLook(environment, localStorage, memberId));
  const [editing, setEditing] = useState(false);
  const [sheet, setSheet] = useState<DeskSheet>(null);
  const [deskWidth, setDeskWidth] = useState(900);
  const [canvasHeight, setCanvasHeight] = useState(720);
  const [deskNote, setDeskNote] = useState("");
  const canvasRef = useRef<HTMLDivElement | null>(null);
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
    setLayout(loadOfficeLayout(environment, breakpoint, localStorage, memberId));
  }, [environment, breakpoint, memberId]);

  useEffect(() => {
    saveOfficeLayout(environment, breakpoint, layout, localStorage, memberId);
  }, [environment, breakpoint, layout, memberId]);

  useEffect(() => {
    return () => {
      saveOfficeLayout(environment, breakpoint, { ...layoutRef.current, expanded: null }, localStorage, memberId);
    };
  }, [environment, breakpoint, memberId]);

  useEffect(() => {
    setRings(loadOfficeRings(environment, localStorage));
  }, [environment]);

  useEffect(() => {
    saveOfficeRings(environment, rings, localStorage);
  }, [environment, rings]);

  useEffect(() => {
    let live = true;
    const prefs = loadPhonePlacePrefs(environment);
    const apply = (latitude?: number, longitude?: number) => {
      void readTorontoWeather({
        environment,
        today,
        storage: localStorage,
        latitude,
        longitude,
        timeZone: prefs.displayTimeZone,
      }).then((next) => {
        if (live) setReading(next);
      });
    };
    if (
      prefs.locationAllowed
      && typeof navigator !== "undefined"
      && navigator.geolocation
    ) {
      navigator.geolocation.getCurrentPosition(
        (position) => apply(position.coords.latitude, position.coords.longitude),
        () => apply(),
        { enableHighAccuracy: false, timeout: 4000, maximumAge: 15 * 60_000 },
      );
    } else {
      apply();
    }
    return () => { live = false; };
  }, [environment, today]);

  useEffect(() => {
    saveOfficeLook(environment, look, localStorage, memberId);
  }, [environment, look, memberId]);

  useEffect(() => {
    const measure = () => setDeskWidth(canvasRef.current?.clientWidth ?? 900);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    return subscribeOfficeIntent((intent) => {
      if (intent.type === "expand") {
        setLayout((current) => ({ ...current, expanded: intent.id, windowMinimized: false }));
      }
      if (intent.type === "collapse") {
        setLayout((current) => ({ ...current, expanded: null }));
      }
      if (intent.type === "tidy") {
        setLayout((current) => tidyOfficeLayout(current, breakpoint, deskWidth));
      }
      if (intent.type === "bump") {
        setBumpId(intent.id);
        window.setTimeout(() => setBumpId((id) => (id === intent.id ? null : id)), 220);
      }
    });
  }, [breakpoint, deskWidth]);

  useEffect(() => {
    if (!household.google.enabledServices.includes("drive")) return;
    const timer = window.setTimeout(() => {
      const phone = breakpoint === "phone" ? layout : loadOfficeLayout(environment, "phone", localStorage, memberId);
      const wide = breakpoint === "wide" ? layout : loadOfficeLayout(environment, "wide", localStorage, memberId);
      void pushDeskAppearance({
        environment,
        memberId,
        enabledServices: household.google.enabledServices,
        payload: buildDeskSyncPayload({ look, phone, wide }),
        storage: localStorage,
      }).then((result) => {
        if (!result.ok) setDeskNote(result.detail);
      });
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [look, layout.items, layout.pinned, layout.minimized, layout.windowMinimized, environment, memberId, breakpoint, household.google.enabledServices]);

  useEffect(() => {
    setLook(loadOfficeLook(environment, localStorage, memberId));
  }, [environment, memberId]);

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
  const parked = layout.items.filter((item) => item.hidden).map((item) => item.id);
  const packed = useMemo(
    () => packWide(
      order.filter((id) => id !== "chalkboard").map((id) => ({ id, size: layout.items.find((item) => item.id === id)?.size })),
      deskWidth,
    ),
    [order, layout.items, deskWidth],
  );

  useEffect(() => {
    if (breakpoint !== "wide") return;
    const ids = order.filter((id) => id !== "chalkboard");
    let maxBottom = DESK_GUTTER;
    for (const id of ids) {
      const item = layout.items.find((row) => row.id === id);
      const fallback = packed[id] ?? { x: DESK_GUTTER, y: DESK_GUTTER };
      const y = item?.y ?? fallback.y;
      const size = sizeOf({ id, size: item?.size });
      const expanded = layout.expanded === id;
      const shell = expandShellFor(id);
      const h = expanded ? EXPAND_SIZE[shell].h : SIZE_HEIGHT[size];
      maxBottom = Math.max(maxBottom, y + h);
    }
    const viewportFloor = typeof window !== "undefined"
      ? Math.max(680, window.innerHeight - 260)
      : 680;
    setCanvasHeight(Math.max(maxBottom + DESK_GUTTER * 2, viewportFloor));
  }, [breakpoint, order, layout.items, layout.expanded, packed]);

  function cycleSize(id: InstrumentId) {
    setLayout((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.id !== id) return item;
        const next = cycleInstrumentSize(id, sizeOf(item));
        return { ...item, size: next, x: undefined, y: undefined };
      }),
    }));
  }

  function park(id: InstrumentId) {
    if (PINNED_INSTRUMENTS.includes(id)) return;
    setLayout((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, hidden: true } : item)),
      expanded: current.expanded === id ? null : current.expanded,
      pinned: (current.pinned ?? []).filter((row) => row !== id),
    }));
  }

  function restore(id: InstrumentId) {
    setLayout((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, hidden: false, x: undefined, y: undefined } : item)),
    }));
  }

  function pickDesk(key: Exclude<DeskPersonality, "custom">) {
    setLayout((current) => applyPersonality(current, key));
    setSheet(null);
    setEditing(false);
  }

  function toggle(id: InstrumentId) {
    setLayout((current) => {
      const opening = current.expanded !== id;
      if (opening) {
        queueMicrotask(() => emitOfficeIntent({ type: "expand", id }));
        return bumpLayoutForExpand(current, id, deskWidth);
      }
      queueMicrotask(() => emitOfficeIntent({ type: "collapse" }));
      return collapseExpandedLayout(current);
    });
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
      x: item?.x ?? packed[id]?.x ?? 0,
      y: item?.y ?? packed[id]?.y ?? 0,
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
    const fallback = packed[id] ?? { x: 16, y: 16 };
    const pos = extra
      ? { x: item?.x ?? fallback.x, y: item?.y ?? fallback.y }
      : { x: 8, y: 8 };
    const size: InstrumentSize = sizeOf({ id, size: item?.size });
    const userPinned = (layout.pinned ?? []).includes(id);
    const chips = (
      <div className="desk-chips">
        {editing && (
          <button
            type="button"
            className="desk-chip"
            onClick={(event) => { event.stopPropagation(); cycleSize(id); }}
            aria-label={`${name} size, currently ${size.toUpperCase()}`}
          >
            {size.toUpperCase()}
          </button>
        )}
        {editing && !PINNED_INSTRUMENTS.includes(id) && (
          <button
            type="button"
            className="desk-chip remove"
            onClick={(event) => { event.stopPropagation(); park(id); }}
            aria-label={`Put ${name} in the drawer`}
          >
            ×
          </button>
        )}
        <button
          type="button"
          className={`desk-chip ${userPinned ? "is-on" : ""}`}
          onClick={(event) => {
            event.stopPropagation();
            setLayout((current) => toggleInstrumentPin(current, id));
          }}
          aria-label={userPinned ? `Unpin ${name}` : `Pin ${name} open`}
          disabled={!userPinned && (layout.pinned ?? []).length >= MAX_USER_PINS}
        >
          {userPinned ? "pinned" : "pin"}
        </button>
      </div>
    );
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
        expanded={instrumentIsOpen(layout, id)}
        minimized={layout.minimized.includes(id)}
        rotation={instrumentRotation(id)}
        bump={bumpId === id}
        inert={inert}
        dragging={dragging === id || lifted === id}
        breakpoint={breakpoint}
        x={pos.x}
        y={pos.y}
        size={size}
        chips={chips}
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

  const renderers: Record<Exclude<InstrumentId, "chalkboard">, (index: number, pair?: boolean) => ReactNode> = {
    calculator: (index, pair) => frame(
      "calculator",
      "Calculator",
      <CalculatorGlance amount={form.amount} />,
      `Calculator. ${form.note || "Desk pad."}`,
      <CalculatorBody
        form={form}
        setForm={onForm}
        mode={mode}
        household={household}
        accounts={household.accounts}
        categories={categories}
        postLabel={postLabel}
        error={error}
        busy={busy}
        onPost={onPost}
        onMore={onMore}
        onMilk={onMilk}
        onCoffee={onCoffee}
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
        today={today}
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
      <JarsBody
        dashboard={dashboard}
        household={household}
        today={today}
        busy={busy}
        onPlan={() => onGo("plan")}
        onCommand={onKitchen}
      />,
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
    accounts: (index, pair) => frame(
      "accounts",
      "Accounts",
      <AccountsGlance household={household} today={today} />,
      `Accounts. ${formatCad(wallet.netWorthCents)} on the books.`,
      <AccountsBody
        household={household}
        today={today}
        onPayCard={onPayCard}
        onOpenAccount={onOpenAccount}
      />,
      { index, pair, warn: walletIsWarn },
    ),
    wardrobe: (index, pair) => frame(
      "wardrobe",
      "Accessories",
      <span>{wardrobeGlance(household, today)}</span>,
      `Hercules accessories. ${wardrobeGlance(household, today)}`,
      <WardrobeBody
        household={household}
        today={today}
        busy={busy}
        environment={environment}
        clinkOn={clinkOn}
        onClinkOn={onClinkOn}
        onCommand={onKitchen}
      />,
      { index, pair },
    ),
    tictactoe: (index, pair) => frame(
      "tictactoe",
      "Tic-tac-toe",
      <TicTacToeGlance household={household} />,
      "Tic-tac-toe. Two phones. No CAD.",
      <TicTacToeBody household={household} memberId={memberId} busy={busy} onCommand={onKitchen} />,
      { index, pair, extraClass: "instrument-game" },
    ),
    hangman: (index, pair) => frame(
      "hangman",
      "Hangman",
      <HangmanGlance household={household} />,
      "Hangman. Household words. Never a quiet visit title.",
      <HangmanBody household={household} memberId={memberId} busy={busy} onCommand={onKitchen} />,
      { index, pair, extraClass: "instrument-game" },
    ),
  };

  /* Mobile shell (< 720px). Wide falls through to the desk canvas below,
     unchanged — see docs/CLAUDE_MOBILE_SHELL.md §1. */
  if (breakpoint === "phone") {
    return (
      <OfficePhone
        household={household} dashboard={dashboard} sill={sill}
        reading={reading}
        layout={layout} onLayout={setLayout}
        today={today} memberId={memberId} busy={busy} adding={adding}
        form={form} mode={mode} error={error} categories={categories} postLabel={postLabel}
        onForm={onForm} onPost={onPost} onMore={onMore} onMilk={onMilk} onCoffee={onCoffee}
        onClockIn={onClockIn} onAbandonShift={onAbandonShift} onSignOut={onSignOut}
        onFinishedShift={onFinishedShift} onPayCard={onPayCard} onOpenAccount={onOpenAccount}
        onKitchen={onKitchen} onMarkPaid={onMarkPaid} onGo={onGo}
      />
    );
  }


  return (
    <div
      className={`office glass-${reading.glass} ${adding ? "is-adding" : ""} ${editing ? "is-editing" : ""} ${layout.expanded && layout.expanded !== "window" ? "is-wide-dim" : ""}`}
      data-stock={look.stock}
      data-density={look.density}
      style={{ ["--room-dim" as string]: String(room.roomDim), ["--room-cool" as string]: String(room.roomCool) }}
    >
      <WindowBand
        reading={reading}
        minimized={layout.windowMinimized}
        onToggle={cycleWindow}
        chalkboardBody={
          !layout.items.find((item) => item.id === "chalkboard")?.hidden
            ? (
              <ChalkboardBody
                household={household}
                memberId={memberId}
                busy={busy}
                onCommand={onKitchen}
                reading={reading}
              />
            )
            : null
        }
      />
      <SillOverviewPlate overview={sill} compact={layout.windowMinimized} />
      <div
        ref={canvasRef}
        className={`desk-canvas desk-wide ${dragging ? "is-grid" : ""}`}
        style={{ minHeight: `${canvasHeight}px` }}
      >
        {rings.map((ring) => (
          <div key={`${ring.id}-${ring.at}`} className="desk-ring" style={{ left: ring.x, top: ring.y }} />
        ))}
        {order.filter((id) => id !== "chalkboard").map((id, index) => renderers[id](index))}
      </div>
      <Cabinets
        editing={editing}
        sheet={sheet}
        parkedCount={parked.length}
        onToggleEdit={() => { setEditing((on) => !on); setSheet(null); }}
        onSheet={setSheet}
      />
      {sheet === "desks" && (
        <div className="desk-sheet">
          <h3>Desks — a starting point, not a cage</h3>
          <div className="desk-grid-opts">
            {(Object.keys(PERSONALITY_DESK) as Exclude<DeskPersonality, "custom">[]).map((key) => (
              <button key={key} type="button" className="desk-card" onClick={() => pickDesk(key)}>
                <b>{PERSONALITY_LABEL[key]}</b>
                <span>{PERSONALITY_BLURB[key]}</span>
                <span> · {PERSONALITY_DESK[key].length} instruments</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {sheet === "look" && (
        <div className="desk-sheet">
          <h3>Home theme</h3>
          <div className="desk-stock-row">
            {(Object.keys(STOCK_LABEL) as PaperStock[]).map((stock) => (
              <button
                key={stock}
                type="button"
                className={`desk-stock desk-stock--${stock} ${look.stock === stock ? "is-on" : ""}`}
                onClick={() => setLook({ ...look, stock })}
              >
                {STOCK_LABEL[stock]}
              </button>
            ))}
          </div>
          <h3>Names</h3>
          <div className="desk-stock-row">
            <button
              type="button"
              className={`desk-stock ${look.density === "names" ? "is-on" : ""}`}
              onClick={() => setLook({ ...look, density: "names" })}
            >
              Names on
            </button>
            <button
              type="button"
              className={`desk-stock ${look.density === "glance" ? "is-on" : ""}`}
              onClick={() => setLook({ ...look, density: "glance" })}
            >
              Glance only
            </button>
            <button
              type="button"
              className={`desk-stock ${look.density === "large" ? "is-on" : ""}`}
              onClick={() => setLook({ ...look, density: "large" })}
            >
              Large
            </button>
          </div>
          <p className="muted">Large density is the WCAG-friendly alternative to pinch-zoom on the locked phone viewport.</p>
          <p className="muted">Kitchen cream stays the house default. Other themes tint the widget board only.</p>
          <div className="desk-stock-row">
            <button
              type="button"
              className="desk-stock"
              onClick={() => {
                const phone = loadOfficeLayout(environment, "phone", localStorage, memberId);
                const wide = layout;
                void pushDeskAppearance({
                  environment,
                  memberId,
                  enabledServices: household.google.enabledServices,
                  payload: buildDeskSyncPayload({ look, phone, wide }),
                  storage: localStorage,
                }).then((result) => setDeskNote(result.detail));
              }}
            >
              Save desk
            </button>
            <button
              type="button"
              className="desk-stock"
              onClick={() => {
                void pullDeskAppearance({
                  environment,
                  memberId,
                  enabledServices: household.google.enabledServices,
                  storage: localStorage,
                }).then((result) => {
                  setDeskNote(result.detail);
                  if (!result.ok || !result.payload) return;
                  setLook(result.payload.look);
                  saveOfficeLook(environment, result.payload.look, localStorage, memberId);
                  saveOfficeLayout(environment, "phone", result.payload.phone, localStorage, memberId);
                  saveOfficeLayout(environment, "wide", result.payload.wide, localStorage, memberId);
                  setLayout(breakpoint === "wide" ? result.payload.wide : result.payload.phone);
                });
              }}
            >
              Pull previous desk
            </button>
          </div>
          {deskNote && <p className="muted">{deskNote}</p>}
        </div>
      )}
      {sheet === "drawer" && (
        <div className="desk-sheet">
          <h3>Drawer — parked instruments, one tap back onto the desk</h3>
          {parked.length === 0 ? (
            <p className="muted">Nothing parked. The desk has it all.</p>
          ) : (
            <div className="desk-drawer-grid">
              {parked.map((id) => (
                <button key={id} type="button" className="desk-stamp" onClick={() => restore(id)}>
                  {INSTRUMENT_LABEL[id]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function cookOffEmptySafe(score: { groceryCents: number; coffeeCents: number; sentence: string }): string {
  if (score.groceryCents === 0 && score.coffeeCents === 0) return "Nothing cooked, nothing bought.";
  return score.sentence;
}
