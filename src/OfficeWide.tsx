import { useMemo, useState, useEffect, useRef, type ReactNode } from "react";
import {
  auditOpinion,
  categorySpendBars,
  claimsOverdue,
  formatCad,
  householdWallet,
  mailOverdue,
  monthPostedRows,
  personalPlates,
  revealPhoneInstrument,
  shiftPostingStreak,
  deskMonthSeals,
  sharedPlates,
  tipWeekdaySpark,
  toggleInstrumentPin,
  transactionTypeLabel,
  formatDateLabel,
  walletWarn,
  wideDrawerIds,
  cookOffScore,
  sitDownPostcard,
  sharedMonthCourse,
  askBelongsOnDesk,
  fundWidgetIdForPlateId,
  isFundWidgetId,
  railFor,
  moveAskGoalClaimToNextMonth,
  fundWalk,
  fundWeek,
  categoryShape,
  twoStreams,
  monthKeyFromDateKey,
  shapeHouseholdFundConfig,
  type CategoryShape,
  type DeskPlateId,
  type DeskPlateModel,
  type FundWidgetId,
  type MemberStream,
  type PersonalLedgerStory as PersonalLedgerStoryModel,
  type SharedLedgerStory as SharedLedgerStoryModel,
} from "./core/index.ts";
import type { Account, Category, CommitResult, Environment, Finding, Household, InstrumentId, OfficeLayout, Transaction, UndoToken } from "./core/index.ts";
import type { Dashboard } from "./core/insights.ts";
import type { HearthTab } from "./core/hercules.ts";
import { requestCalendarPane } from "./core/calendarIntent.ts";

import { BlotterBody, BlotterGlance } from "./widgets/Blotter.tsx";
import { CalculatorBody, CalculatorGlance } from "./widgets/CalculatorPad.tsx";
import { TimesheetBody, TimesheetGlance } from "./widgets/Timesheet.tsx";
import { ChalkboardBody, chalkboardGlance } from "./widgets/ChalkboardDesk.tsx";
import { JarsBody, JarsGlance } from "./widgets/Jars.tsx";
import { LampBody, LampGlance, lampAria } from "./widgets/Lamp.tsx";
import { MailBody, MailGlance } from "./widgets/Mail.tsx";
import { WalletBody, WalletGlance } from "./widgets/WalletTray.tsx";
import { ClaimsBody, ClaimsGlance } from "./widgets/ClaimsTray.tsx";
import { AccountsBody, AccountsGlance } from "./widgets/AccountsDesk.tsx";
import { CalendarBody, CalendarGlance } from "./widgets/CalendarDesk.tsx";
import { AppointmentsBody, AppointmentsGlance } from "./widgets/AppointmentsDesk.tsx";
import { PostcardBody, PostcardGlance } from "./widgets/Postcard.tsx";
import { CookOffBody, CookOffGlance } from "./widgets/CookOffKettle.tsx";
import { WardrobeBody, wardrobeGlance } from "./widgets/WardrobeDesk.tsx";
import { HangmanBody, HangmanGlance, TicTacToeBody, TicTacToeGlance } from "./widgets/GamesDesk.tsx";
import { NotebookBody, PaperBars, PaperSpark, StoryStrip, WaxSeal } from "./theme/PaperTheme.tsx";
import { MonthSpread } from "./MonthSpread.tsx";
import { Ask } from "./Ask.tsx";
import { DeskPlate, PlateFigureView } from "./DeskPlates.tsx";
import { FundDrawer } from "./FundDrawer.tsx";
import { Level } from "./Level.tsx";
import { NextOutStage } from "./NextOutStage.tsx";
import { WeekStage } from "./WeekStage.tsx";
import { WaitingStage } from "./WaitingStage.tsx";
import { SettleStage } from "./SettleStage.tsx";
import { ShapeStage } from "./ShapeStage.tsx";
import { StreamsStage } from "./StreamsStage.tsx";
import { AccountsStage } from "./AccountsStage.tsx";
import { KittyBanks } from "./KittyBanks.tsx";
import { useFurniture } from "./widgets/useFurniture.ts";
import type { DeskForm, DeskMode } from "./widgets/deskTypes.ts";

type MonthListKind = "income" | "expenses";

function fundStageStorageKey(environment: Environment, householdId: string, memberId: string, today: string): string {
  return `hearth:fund-stage:${environment}:${householdId}:${memberId}:${today}`;
}

function storedFundStage(environment: Environment, householdId: string, memberId: string, today: string): FundWidgetId {
  try {
    const stored = sessionStorage.getItem(fundStageStorageKey(environment, householdId, memberId, today));
    return isFundWidgetId(stored) ? stored : "level";
  } catch {
    return "level";
  }
}

function MonthPostedList({
  household,
  today,
  section,
}: {
  household: Household;
  today: string;
  section: MonthListKind;
}) {
  const rows = monthPostedRows(household, today, section);
  const title = section === "income" ? "Income this month" : "Expenses this month";
  const empty = section === "income" ? "No income posted this month." : "No expenses posted this month.";
  return (
    <section className="month-posted-list" aria-label={title}>
      <p className="muted">{title}. Posted rows only. Nothing posts from here.</p>
      {rows.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ul className="month-posted-rows">
          {rows.map((tx: Transaction) => (
            <li key={tx.id} className="month-posted-row">
              <span className="month-posted-note">{tx.note || transactionTypeLabel(tx.type)}</span>
              <span className="month-posted-date">{formatDateLabel(tx.date)}</span>
              <span className="month-posted-amount">{formatCad(tx.amountCents)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type Spec = {
  kind: string;
  name: string;
  glance: ReactNode;
  aria: string;
  body: ReactNode;
  warn?: boolean;
};

/**
 * OfficeWide — composed paper office (≥720px).
 * Seals span; mosaic plates | stage | Kitty Banks at laptop width.
 */
export function OfficeWide({
  household, booksHousehold, dashboard, layout, onLayout,
  today, memberId, view, busy, adding, form, mode, error, categories, postLabel,
  environment, clinkOn, integrityFindings = [],
  sharedStory = null,
  onForm, onPost, onMore, onMilk, onCoffee, onClockIn, onAbandonShift,
  onStartBreak, onEndBreak, onChooseShiftTimeline, onSignOut, onFinishedShift, onPayCard, onOpenAccount,
  onKitchen, onMarkPaid, onAskSettle, onAskStartJar, onSitDown, onOpenRegister, onGo, onClinkOn,
}: {
  household: Household;
  booksHousehold: Household;
  dashboard: Dashboard;
  layout: OfficeLayout;
  onLayout: (next: OfficeLayout) => void;
  today: string;
  memberId: string;
  view: "household" | "personal";
  busy: boolean;
  adding: boolean;
  form: DeskForm;
  mode: DeskMode;
  error: string;
  categories: Category[];
  postLabel: string;
  environment: Environment;
  clinkOn: boolean;
  onForm: (next: DeskForm) => void;
  onPost: () => void;
  onMore: () => void;
  onMilk: () => void;
  onCoffee: () => void;
  onClockIn: () => void;
  onAbandonShift: () => void;
  onStartBreak: (kind: "paid" | "unpaid" | "custom") => void;
  onEndBreak: () => void;
  onChooseShiftTimeline: (openShiftId: string) => void;
  onSignOut: () => void;
  onFinishedShift: () => void;
  onPayCard: (account: Account) => void;
  onOpenAccount: (accountId: string) => void;
  onKitchen: (fn: (current: Household) => CommitResult) => void;
  onMarkPaid: (recurrenceId: string, summary: string) => void;
  onAskSettle: (claimId: string, summary: string) => void;
  onAskStartJar: (appointmentId: string, summary: string) => void;
  onSitDown: (next: Household, token?: UndoToken) => void;
  onOpenRegister: () => void;
  onGo: (tab: HearthTab) => void;
  onClinkOn: (on: boolean) => void;
  integrityFindings?: Finding[];
  sharedStory?: SharedLedgerStoryModel | null;
  personalStory?: PersonalLedgerStoryModel | null;
}) {
  const sealsRef = useFurniture("wide-seals", "tray", true, false);
  const heroRef = useFurniture("blotter", "board", true, false);
  const mosaicRef = useFurniture("wide-mosaic", "card", true, false);
  const noteRef = useFurniture("wide-notebook", "pad", true, false);
  const [openPlateIds, setOpenPlateIds] = useState<Set<DeskPlateId>>(() => new Set());
  const [monthList, setMonthList] = useState<MonthListKind | null>(null);
  const [selectedFundWidget, setSelectedFundWidget] = useState<FundWidgetId>(() => (
    storedFundStage(environment, household.householdId, memberId, today)
  ));
  const [fundDrawerOpen, setFundDrawerOpen] = useState(false);
  const fundStageHeadingRef = useRef<HTMLHeadingElement>(null);

  const opinion = useMemo(() => auditOpinion(household), [household]);
  const findings = integrityFindings;
  const streak = useMemo(() => shiftPostingStreak(household, today), [household, today]);
  const wallet = useMemo(() => householdWallet(household, today), [household, today]);
  const postcard = useMemo(() => sitDownPostcard(booksHousehold), [booksHousehold]);
  const cook = useMemo(() => cookOffScore(household, today), [household, today]);
  const memberName = household.members.find((m) => m.id === memberId)?.name ?? "";
  const course = useMemo(() => sharedMonthCourse(booksHousehold, today), [booksHousehold, today]);
  const nameOf = (id: string | null | undefined) => (
    id ? household.members.find((member) => member.id === id)?.name ?? "A member" : "A member"
  );
  const custodianName = nameOf(household.householdFund?.custodianMemberId) === "A member"
    ? "the custodian"
    : nameOf(household.householdFund?.custodianMemberId);
  const mailWarn = mailOverdue(dashboard, today);
  const walletIsWarn = walletWarn(wallet);
  const claimsWarn = claimsOverdue(household);
  const lampLit = findings.length > 0;
  const unarrangedPlates = useMemo(
    () => view === "household"
      ? sharedPlates({ household: booksHousehold, memberId, dashboard, today, findings })
      : personalPlates({ household, dashboard, today, memberId, streak }),
    [view, booksHousehold, household, dashboard, today, findings, memberId, streak],
  );
  const fundConfigured = view === "household" && unarrangedPlates.some((plate) => plate.id === "fund-level");
  const plates = useMemo(() => {
    if (!fundConfigured) return unarrangedPlates;
    const byWidget = new Map(unarrangedPlates.flatMap((plate) => {
      const id = fundWidgetIdForPlateId(plate.id);
      return id ? [[id, plate] as const] : [];
    }));
    const arranged = railFor(household, memberId).flatMap((id) => {
      const plate = byWidget.get(id);
      if (!plate) return [];
      byWidget.delete(id);
      return [plate];
    });
    return [...arranged, ...unarrangedPlates.filter((plate) => {
      const id = fundWidgetIdForPlateId(plate.id);
      return id ? byWidget.has(id) : false;
    })];
  }, [fundConfigured, unarrangedPlates, household, memberId]);
  const fundWalkToday = useMemo(() => (
    fundConfigured && shapeHouseholdFundConfig(booksHousehold.householdFund)
      ? fundWalk(booksHousehold, monthKeyFromDateKey(today), today)
      : null
  ), [fundConfigured, booksHousehold, today]);
  const fundWeekToday = useMemo(() => (
    fundConfigured && shapeHouseholdFundConfig(booksHousehold.householdFund)
      ? fundWeek(booksHousehold, today)
      : null
  ), [fundConfigured, booksHousehold, today]);
  const categoryShapeToday: CategoryShape[] = useMemo(() => (
    fundConfigured && shapeHouseholdFundConfig(booksHousehold.householdFund)
      ? categoryShape(booksHousehold, monthKeyFromDateKey(today), today)
      : []
  ), [fundConfigured, booksHousehold, today]);
  const twoStreamsToday: MemberStream[] = useMemo(() => (
    fundConfigured && shapeHouseholdFundConfig(booksHousehold.householdFund)
      ? twoStreams(booksHousehold, today)
      : []
  ), [fundConfigured, booksHousehold, today]);
  const selectedFundPlate = useMemo(() => (
    plates.find((plate) => fundWidgetIdForPlateId(plate.id) === selectedFundWidget)
    ?? plates.find((plate) => fundWidgetIdForPlateId(plate.id) === "level")
    ?? null
  ), [plates, selectedFundWidget]);
  const activeFundWidget = selectedFundPlate
    ? fundWidgetIdForPlateId(selectedFundPlate.id)
    : null;
  const mosaicInstrumentIds = [...new Set(plates.map((plate) => plate.cabinet))];
  const drawer = wideDrawerIds(mosaicInstrumentIds, { includeHero: false });

  const expanded = layout.expanded;

  useEffect(() => {
    setOpenPlateIds(new Set());
    setMonthList(null);
    setFundDrawerOpen(false);
  }, [view]);

  useEffect(() => {
    setSelectedFundWidget(storedFundStage(environment, household.householdId, memberId, today));
  }, [environment, household.householdId, memberId, today]);

  useEffect(() => {
    if (!fundConfigured || !activeFundWidget || selectedFundWidget === activeFundWidget) return;
    setSelectedFundWidget(activeFundWidget);
    try {
      sessionStorage.setItem(
        fundStageStorageKey(environment, household.householdId, memberId, today),
        activeFundWidget,
      );
    } catch {
      // A blocked storage surface still gets the corrected React state.
    }
  }, [fundConfigured, activeFundWidget, selectedFundWidget, environment, household.householdId, memberId, today]);

  function togglePlate(id: DeskPlateId) {
    setOpenPlateIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function stageFundPlate(plate: DeskPlateModel) {
    const widgetId = fundWidgetIdForPlateId(plate.id);
    if (!widgetId) return;
    setMonthList(null);
    setFundDrawerOpen(false);
    if (layout.expanded && layout.expanded !== "window") onLayout({ ...layout, expanded: null });
    setSelectedFundWidget(widgetId);
    try {
      sessionStorage.setItem(fundStageStorageKey(environment, household.householdId, memberId, today), widgetId);
    } catch {
      // A blocked storage surface still gets a correct in-session React state.
    }
    queueMicrotask(() => fundStageHeadingRef.current?.focus());
  }

  function openPlateCabinet(id: DeskPlateId) {
    const plate = plates.find((row) => row.id === id);
    if (!plate) return;
    setMonthList(null);
    onLayout({ ...layout, expanded: plate.cabinet });
  }

  function openFundDrawer() {
    setMonthList(null);
    if (layout.expanded && layout.expanded !== "window") onLayout({ ...layout, expanded: null });
    setFundDrawerOpen(true);
    queueMicrotask(() => fundStageHeadingRef.current?.focus());
  }

  function closeFundDrawer() {
    setFundDrawerOpen(false);
    queueMicrotask(() => fundStageHeadingRef.current?.focus());
  }

  const spend = categorySpendBars(dashboard.month.categories);
  const tipSpark = tipWeekdaySpark(dashboard.tipWeather);

  function openMonthList(section: MonthListKind) {
    setMonthList((current) => (current === section ? null : section));
    if (layout.expanded && layout.expanded !== "window") {
      onLayout({ ...layout, expanded: null });
    }
  }

  const seals = deskMonthSeals(dashboard.month);

  const specs: Partial<Record<InstrumentId, Spec>> = {
    blotter: {
      kind: "Month",
      name: "Month net",
      glance: <BlotterGlance dashboard={dashboard} opinion={opinion} findings={findings.length} />,
      aria: `Month net. ${dashboard.monthLabel}.`,
      body: (
        <>
          <BlotterBody dashboard={dashboard} opinion={opinion} findings={findings.length} />
          <PaperBars rows={spend} caption="Top spend this month" empty="No expenses posted this month yet." />
        </>
      ),
    },
    calculator: {
      kind: "Pad",
      name: "Pad",
      glance: <CalculatorGlance amount={form.amount} />,
      aria: `Pad. ${form.note || "Post groceries."}`,
      body: (
        <CalculatorBody
          form={form} setForm={onForm} mode={mode} household={household}
          accounts={household.accounts} categories={categories} postLabel={postLabel}
          error={error} busy={busy} onPost={onPost} onMore={onMore}
          onMilk={onMilk} onCoffee={onCoffee}
        />
      ),
    },
    timesheet: {
      kind: "Shifts",
      name: "Shifts",
      warn: streak.waiting,
      glance: <TimesheetGlance household={household} streak={streak} memberId={memberId} />,
      aria: "Shifts.",
      body: (
        <>
          <TimesheetBody
            household={household} streak={streak} memberId={memberId} memberName={memberName} today={today} busy={busy}
            onClockIn={onClockIn} onAbandon={onAbandonShift}
            onStartBreak={onStartBreak} onEndBreak={onEndBreak}
            onChooseTimeline={onChooseShiftTimeline}
            onSignOut={onSignOut} onFinished={onFinishedShift}
          />
          <PaperSpark points={tipSpark} projection={false} />
        </>
      ),
    },
    jars: {
      kind: "Goals",
      name: "Goals",
      glance: <JarsGlance dashboard={dashboard} />,
      aria: "Goals.",
      body: <JarsBody dashboard={dashboard} household={household} today={today} busy={busy} onPlan={() => onGo("plan")} onCommand={onKitchen} />,
    },
    lamp: {
      kind: "Health",
      name: "Health",
      warn: lampLit,
      glance: <LampGlance findings={findings} />,
      aria: lampAria(findings),
      body: <LampBody findings={findings} onMore={() => onGo("more")} />,
    },
    mail: {
      kind: "Mail",
      name: "Next bill",
      warn: mailWarn,
      glance: <MailGlance dashboard={dashboard} today={today} />,
      aria: "Next bill.",
      body: <MailBody dashboard={dashboard} today={today} onMarkPaid={onMarkPaid} onCalendar={() => onGo("calendar")} />,
    },
    wallet: {
      kind: "Wallet",
      name: "Wallet",
      warn: walletIsWarn,
      glance: <WalletGlance wallet={wallet} />,
      aria: "Wallet.",
      body: <WalletBody wallet={wallet} onPayCard={onPayCard} onOpenAccount={onOpenAccount} />,
    },
    claims: {
      kind: "Claims",
      name: "Claims",
      warn: claimsWarn,
      glance: <ClaimsGlance household={household} today={today} />,
      aria: "Claims.",
      body: (
        <ClaimsBody
          household={household}
          today={today}
          busy={busy}
          onAskSettle={onAskSettle}
          onCalendar={() => {
            requestCalendarPane("visits", localStorage);
            onGo("calendar");
          }}
        />
      ),
    },
    accounts: {
      kind: "Accounts",
      name: "Accounts",
      glance: <AccountsGlance household={household} today={today} />,
      aria: "Accounts.",
      body: <AccountsBody household={household} today={today} onPayCard={onPayCard} onOpenAccount={onOpenAccount} />,
    },
    calendar: {
      kind: "Calendar",
      name: "Calendar",
      glance: <CalendarGlance household={household} today={today} />,
      aria: "Calendar.",
      body: (
        <CalendarBody
          household={household}
          today={today}
          onCalendar={() => {
            requestCalendarPane("board", localStorage);
            onGo("calendar");
          }}
        />
      ),
    },
    appointments: {
      kind: "Visits",
      name: "Appointments",
      glance: <AppointmentsGlance household={household} today={today} />,
      aria: "Appointments.",
      body: (
        <AppointmentsBody
          household={household}
          today={today}
          busy={busy}
          onStartJar={onAskStartJar}
          onAppointments={() => {
            requestCalendarPane("visits", localStorage);
            onGo("calendar");
          }}
        />
      ),
    },
    postcard: {
      kind: "Sit-down",
      name: "Sit-down",
      glance: <PostcardGlance card={postcard} />,
      aria: "Sit-down.",
      body: <PostcardBody household={booksHousehold} displayHousehold={household} dashboard={dashboard} view={view} memberId={memberId} card={postcard} onApply={onSitDown} />,
    },
    cookoff: {
      kind: "Kitchen",
      name: "Kitchen vs takeout",
      glance: <CookOffGlance score={cook} />,
      aria: "Kitchen vs takeout.",
      body: <CookOffBody score={cook} />,
    },
    chalkboard: {
      kind: "Notes",
      name: "Notes",
      glance: <span>{chalkboardGlance(household)}</span>,
      aria: "Notes.",
      body: <ChalkboardBody liveSurface household={household} memberId={memberId} busy={busy} onCommand={onKitchen} />,
    },
    wardrobe: {
      kind: "Outfits",
      name: "Hercules outfits",
      glance: <span>{wardrobeGlance(household, today)}</span>,
      aria: "Hercules outfits.",
      body: (
        <WardrobeBody
          household={household}
          today={today}
          busy={busy}
          environment={environment}
          clinkOn={clinkOn}
          onClinkOn={onClinkOn}
          onCommand={onKitchen}
        />
      ),
    },
    tictactoe: {
      kind: "Game",
      name: "Tic-tac-toe",
      glance: <TicTacToeGlance household={household} />,
      aria: "Tic-tac-toe.",
      body: <TicTacToeBody household={household} memberId={memberId} busy={busy} onCommand={onKitchen} />,
    },
    hangman: {
      kind: "Game",
      name: "Hangman",
      glance: <HangmanGlance household={household} />,
      aria: "Hangman.",
      body: <HangmanBody household={household} memberId={memberId} busy={busy} onCommand={onKitchen} />,
    },
  };

  const openId = expanded && expanded !== "window" ? (expanded as InstrumentId) : null;
  const openSpec = openId ? specs[openId] : null;
  /** Shared Home's default centre is the Month Spread. Left plates grow in the mosaic. */
  const spreadIsStage = view === "household" && !openSpec && !monthList;
  const showAsk = spreadIsStage
    && (!fundConfigured || fundWidgetIdForPlateId(selectedFundPlate?.id ?? "") === "level")
    && askBelongsOnDesk(memberId, household.householdFund?.custodianMemberId);
  const panelId = monthList
    ? `wide-notebook-month-${monthList}`
    : `wide-notebook-${openId ?? "blotter"}`;
  const chalkOpen = openId === "chalkboard";

  function closeStage() {
    setMonthList(null);
    if (layout.expanded && layout.expanded !== "window") {
      onLayout({ ...layout, expanded: null });
    }
  }

  return (
    <div className={`office-wide ${adding ? "is-adding" : ""} ${view === "household" ? "is-shared-home" : ""}`}>
      <div className="office-wide-desk">
        <div ref={sealsRef} className="hearth-wax-seals office-wide-seals" role="group" aria-label="Desk seals">
          <WaxSeal
            label="Money in"
            tone="post"
            pending={seals.inCents === 0}
            pressed={monthList === "income"}
            value={formatCad(seals.inCents)}
            sub="posted income this month"
            onClick={() => openMonthList("income")}
          />
          <WaxSeal
            label="Money out"
            tone="due"
            pending={seals.outCents === 0}
            pressed={monthList === "expenses"}
            value={formatCad(seals.outCents)}
            sub="posted expenses only"
            onClick={() => openMonthList("expenses")}
          />
          <WaxSeal
            label="Leftover spend"
            tone="close"
            value={formatCad(seals.leftoverCents)}
            sub="posted in minus posted expenses"
            pending={seals.inCents === 0 && seals.outCents === 0}
            onClick={() => onGo("plan")}
          />
        </div>
        <div ref={mosaicRef} className="office-wide-mosaic-wrap">
          <StoryStrip heading="Today's stories" className="office-wide-mosaic office-wide-plates">
            <div className="fund-rail-list" role={fundConfigured && spreadIsStage ? "tablist" : undefined} aria-label={fundConfigured && spreadIsStage ? "Your Fund board" : undefined}>
              {plates.map((plate) => {
                const active = fundConfigured && spreadIsStage && selectedFundPlate?.id === plate.id;
                return (
                  <DeskPlate
                    key={plate.id}
                    plate={plate}
                    active={active}
                    tab={fundConfigured && spreadIsStage}
                    open={!fundConfigured && openPlateIds.has(plate.id)}
                    onSelect={() => fundConfigured ? stageFundPlate(plate) : togglePlate(plate.id)}
                    onOpenCabinet={() => openPlateCabinet(plate.id)}
                  />
                );
              })}
            </div>
            {fundConfigured && spreadIsStage ? (
              <button
                type="button"
                className="fund-rail-arrange"
                aria-current={fundDrawerOpen ? "true" : undefined}
                onClick={openFundDrawer}
              >
                Arrange
              </button>
            ) : null}
          </StoryStrip>
        </div>
        <div
          ref={heroRef}
          className={`office-wide-stage ${adding ? "is-inert" : ""} ${chalkOpen ? "is-chalk" : ""}`}
          role={spreadIsStage && fundConfigured ? "tabpanel" : undefined}
          id={spreadIsStage && fundConfigured ? "fund-stage-panel" : undefined}
          aria-labelledby={spreadIsStage && fundConfigured && !fundDrawerOpen && selectedFundPlate ? `fund-rail-tab-${selectedFundPlate.id}` : undefined}
        >
          {spreadIsStage && fundConfigured && fundDrawerOpen ? (
            <FundDrawer
              household={household}
              memberId={memberId}
              busy={busy}
              onKitchen={onKitchen}
              onClose={closeFundDrawer}
            />
          ) : spreadIsStage && fundConfigured && fundWalkToday
            && (activeFundWidget === "next-out" || activeFundWidget === "spoken-for") ? (
            <NextOutStage walk={fundWalkToday} today={today} headingRef={fundStageHeadingRef} />
          ) : spreadIsStage && fundConfigured && fundWeekToday && activeFundWidget === "week" ? (
            <WeekStage week={fundWeekToday} nameOf={nameOf} headingRef={fundStageHeadingRef} />
          ) : spreadIsStage && fundConfigured && activeFundWidget === "waiting" ? (
            <WaitingStage
              household={booksHousehold}
              memberId={memberId}
              today={today}
              onKitchen={onKitchen}
              headingRef={fundStageHeadingRef}
            />
          ) : spreadIsStage && fundConfigured && activeFundWidget === "settle" ? (
            <SettleStage
              household={booksHousehold}
              memberId={memberId}
              today={today}
              busy={busy}
              onKitchen={onKitchen}
              headingRef={fundStageHeadingRef}
            />
          ) : spreadIsStage && fundConfigured && activeFundWidget === "shape" ? (
            <ShapeStage rows={categoryShapeToday} headingRef={fundStageHeadingRef} />
          ) : spreadIsStage && fundConfigured && activeFundWidget === "streams" ? (
            <StreamsStage streams={twoStreamsToday} today={today} nameOf={nameOf} headingRef={fundStageHeadingRef} />
          ) : spreadIsStage && fundConfigured && activeFundWidget === "accounts" ? (
            <AccountsStage
              household={booksHousehold}
              memberId={memberId}
              today={today}
              onOpenAccount={onOpenAccount}
              onKitchen={onKitchen}
              headingRef={fundStageHeadingRef}
            />
          ) : spreadIsStage && fundConfigured && selectedFundPlate && fundWidgetIdForPlateId(selectedFundPlate.id) !== "level" ? (
            <section className="fund-plate-stage" data-fund-stage={fundWidgetIdForPlateId(selectedFundPlate.id)}>
              <p className="desk-plate-kicker">{selectedFundPlate.kicker}</p>
              <h2 ref={fundStageHeadingRef} tabIndex={-1} className="fund-stage-heading">{selectedFundPlate.glance}</h2>
              <p className={`desk-plate-detail${selectedFundPlate.copperVerdict ? " is-copper" : ""}`}>{selectedFundPlate.verdict}</p>
              {selectedFundPlate.empty ? (
                <p className="desk-plate-empty">{selectedFundPlate.empty}</p>
              ) : (
                <div className="fund-stage-figure"><PlateFigureView figure={selectedFundPlate.figure} /></div>
              )}
              <p className="desk-plate-foot">{selectedFundPlate.footing}</p>
              <button type="button" className="desk-plate-handle" onClick={() => openPlateCabinet(selectedFundPlate.id)}>
                Open {selectedFundPlate.cabinetName}
              </button>
            </section>
          ) : spreadIsStage && fundConfigured && fundWalkToday && activeFundWidget === "level" ? (
            <>
              <Level walk={fundWalkToday} household={booksHousehold} headingRef={fundStageHeadingRef} />
              {showAsk ? (
                <Ask
                  household={booksHousehold}
                  today={today}
                  memberId={memberId}
                  busy={busy}
                  onMove={(alternative) => onKitchen((current) => moveAskGoalClaimToNextMonth(current, {
                    today,
                    memberId,
                    goalId: alternative.goalId,
                    recurrenceId: alternative.recurrenceId,
                    claimDate: alternative.claimDate,
                  }))}
                />
              ) : null}
            </>
          ) : spreadIsStage && sharedStory ? (
            <>
              <MonthSpread
                story={sharedStory}
                course={course}
                household={booksHousehold}
                nameOf={nameOf}
                custodianName={custodianName}
                onOpenFund={() => onGo("ledger")}
                onOpenRegister={onOpenRegister}
                onOpenHealth={() => onGo("more")}
              />
              {showAsk ? (
                <Ask
                  household={booksHousehold}
                  today={today}
                  memberId={memberId}
                  busy={busy}
                  onMove={(alternative) => onKitchen((current) => moveAskGoalClaimToNextMonth(current, {
                    today,
                    memberId,
                    goalId: alternative.goalId,
                    recurrenceId: alternative.recurrenceId,
                    claimDate: alternative.claimDate,
                  }))}
                />
              ) : null}
            </>
          ) : (
          <NotebookBody
            title={
              monthList === "income"
                ? "Money in"
                : monthList === "expenses"
                  ? "Money out"
                  : (openSpec?.name ?? (view === "household" && sharedStory ? "The month" : "Desk"))
            }
            open
            bare={chalkOpen}
            panelId={panelId}
            onClose={closeStage}
          >
            <div className="office-wide-notebook-inner">
              {monthList ? (
                <MonthPostedList household={household} today={today} section={monthList} />
              ) : openSpec ? (
                <>
                  {!chalkOpen && openId ? (
                    <button
                      type="button"
                      className={`ph-pin ${(layout.pinned ?? []).includes(openId) ? "is-on" : ""}`}
                      onClick={() => onLayout(toggleInstrumentPin(layout, openId))}
                      aria-label={(layout.pinned ?? []).includes(openId) ? `Unpin ${openSpec.name}` : `Pin ${openSpec.name} open`}
                    >
                      {(layout.pinned ?? []).includes(openId) ? "pinned" : "pin"}
                    </button>
                  ) : null}
                  {openSpec.body}
                </>
              ) : (
                <p className="muted">Touch a plate. Kitty Banks stay on this desk.</p>
              )}
            </div>
          </NotebookBody>
          )}
        </div>
        <div ref={noteRef} className="office-wide-notebook office-wide-banks">
          <KittyBanks
            household={household}
            booksHousehold={booksHousehold}
            view={view}
            createdBy={memberId}
            busy={busy}
            surface="home"
            onCommand={onKitchen}
            onAskStartJar={onAskStartJar}
            onOpenPlan={() => onGo("plan")}
          />
        </div>
      </div>

      {drawer.length > 0 && (
        <details className="office-wide-drawer">
          <summary>
            More on this desk
            <span aria-hidden="true"> · </span>
            {drawer.length}
          </summary>
          <div className="office-wide-drawer-grid">
            {drawer.map((id) => (
              <button
                key={id}
                type="button"
                className="ph-chip"
                onClick={() => {
                  setMonthList(null);
                  onLayout(revealPhoneInstrument(layout, id));
                }}
              >
                <b>{specs[id]?.name ?? id}</b>
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
