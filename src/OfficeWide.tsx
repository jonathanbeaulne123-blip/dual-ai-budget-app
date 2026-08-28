import { useMemo, type ReactNode } from "react";
import {
  auditOpinion,
  categorySpendBars,
  claimsOverdue,
  formatDateLabel,
  householdWallet,
  instrumentIsOpen,
  mailOverdue,
  monthInOutBars,
  phoneDueBill,
  revealPhoneInstrument,
  runHealthCheck,
  shiftPostingStreak,
  tipWeekdaySpark,
  toggleInstrumentPin,
  walletWarn,
  wideDrawerIds,
  wideMosaicIds,
  WIDE_HERO_ID,
  cookOffScore,
  sitDownPostcard,
} from "./core/index.ts";
import type { Account, Category, CommitResult, Household, InstrumentId, OfficeLayout, UndoToken } from "./core/index.ts";
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
import { NotebookBody, PaperBars, PaperSpark, PaperTile, StoryStrip, WaxSeal } from "./theme/PaperTheme.tsx";
import { useFurniture } from "./widgets/useFurniture.ts";
import type { DeskForm, DeskMode } from "./widgets/deskTypes.ts";

type Spec = {
  kind: string;
  name: string;
  glance: ReactNode;
  aria: string;
  body: ReactNode;
  warn?: boolean;
};

/**
 * OfficeWide — composed paper office (≥720px). Draft C grammar in two columns:
 * seals + mosaic | hero blotter + side notebook. Not a stretched phone.
 */
export function OfficeWide({
  household, dashboard, layout, onLayout,
  today, memberId, view, busy, adding, form, mode, error, categories, postLabel,
  onForm, onPost, onMore, onMilk, onCoffee, onClockIn, onAbandonShift,
  onStartBreak, onEndBreak, onChooseShiftTimeline, onSignOut, onFinishedShift, onPayCard, onOpenAccount,
  onKitchen, onMarkPaid, onAskSettle, onAskStartJar, onSitDown, onGo,
}: {
  household: Household;
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
  onGo: (tab: HearthTab) => void;
}) {
  const sealsRef = useFurniture("wide-seals", "tray", true, false);
  const heroRef = useFurniture("blotter", "board", true, false);
  const mosaicRef = useFurniture("wide-mosaic", "card", true, false);
  const noteRef = useFurniture("wide-notebook", "pad", true, false);

  const opinion = useMemo(() => auditOpinion(household), [household]);
  const findings = useMemo(() => runHealthCheck(household), [household]);
  const streak = useMemo(() => shiftPostingStreak(household, today), [household, today]);
  const wallet = useMemo(() => householdWallet(household, today), [household, today]);
  const postcard = useMemo(() => sitDownPostcard(household), [household]);
  const cook = useMemo(() => cookOffScore(household, today), [household, today]);
  const memberName = household.members.find((m) => m.id === memberId)?.name ?? "";
  const mailWarn = mailOverdue(dashboard, today);
  const walletIsWarn = walletWarn(wallet);
  const claimsWarn = claimsOverdue(household);
  const lampLit = findings.length > 0;
  const hidden = useMemo(
    () => new Set(layout.items.filter((item) => item.hidden).map((item) => item.id)),
    [layout.items],
  );
  const mosaicIds = wideMosaicIds({ hidden, lampLit, expanded: layout.expanded });
  const drawer = wideDrawerIds(mosaicIds);

  const expanded = layout.expanded;
  const setExpanded = (id: InstrumentId | null) =>
    onLayout({ ...layout, expanded: expanded === id ? null : id });

  const postedToday = household.transactions.some((tx) => tx.date === today);
  const bill = phoneDueBill(dashboard.upcoming);
  const closeNeeds = findings.length > 0;
  const inOut = monthInOutBars(dashboard.month);
  const spend = categorySpendBars(dashboard.month.categories);
  const tipSpark = tipWeekdaySpark(dashboard.tipWeather);

  function tapSeal(go: InstrumentId) {
    onLayout(revealPhoneInstrument(layout, go));
  }

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
      body: <PostcardBody household={household} card={postcard} viewPersonal={view === "personal"} onApply={onSitDown} />,
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
      body: <ChalkboardBody household={household} memberId={memberId} busy={busy} onCommand={onKitchen} />,
    },
  };

  const heroSpec = specs[WIDE_HERO_ID];
  const openId = expanded && expanded !== "window" ? (expanded as InstrumentId) : WIDE_HERO_ID;
  const openSpec = specs[openId] ?? heroSpec;
  const panelId = `wide-notebook-${openId}`;

  return (
    <div className={`office-wide ${adding ? "is-adding" : ""}`}>
      <div className="office-wide-desk">
        <div className="office-wide-left">
          <div ref={sealsRef} className="hearth-wax-seals office-wide-seals" role="group" aria-label="Desk seals">
            <WaxSeal
              label="Post"
              tone="post"
              pending={!postedToday}
              value={postedToday ? "—" : "Add"}
              sub={postedToday ? "posted today" : "nothing yet today"}
              onClick={() => tapSeal("calculator")}
            />
            <WaxSeal
              label="Due"
              tone="due"
              pending={Boolean(bill)}
              value={bill ? bill.title : "—"}
              sub={bill ? formatDateLabel(bill.date) : "nothing near"}
              onClick={() => tapSeal("mail")}
            />
            <WaxSeal
              label="Health"
              tone="close"
              pending={closeNeeds}
              value={closeNeeds ? String(findings.length) : "—"}
              sub={closeNeeds ? "needs you" : "books agree"}
              onClick={() => tapSeal("lamp")}
            />
          </div>
          <div ref={mosaicRef}>
            <StoryStrip heading="Today's stories" className="office-wide-mosaic">
              {mosaicIds.map((id) => {
                const spec = specs[id];
                if (!spec) return null;
                return (
                  <PaperTile
                    key={id}
                    kind={spec.kind}
                    name={spec.name}
                    value={spec.glance}
                    warn={spec.warn}
                    active={instrumentIsOpen(layout, id)}
                    onClick={() => setExpanded(id)}
                    ariaLabel={spec.aria}
                  />
                );
              })}
            </StoryStrip>
          </div>
        </div>

        <div className="office-wide-right">
          {heroSpec && (
            <div ref={heroRef} className="office-wide-hero-wrap">
              <button
                type="button"
                className={`office-wide-hero hearth-paper-tile ${instrumentIsOpen(layout, WIDE_HERO_ID) ? "is-active" : ""}`}
                onClick={() => setExpanded(WIDE_HERO_ID)}
                aria-label={heroSpec.aria}
                aria-pressed={instrumentIsOpen(layout, WIDE_HERO_ID)}
              >
                <span className="hearth-tile-kind">{heroSpec.kind}</span>
                <span className="hearth-tile-name">{dashboard.monthLabel}</span>
                <span className="office-wide-hero-net">{heroSpec.glance}</span>
                <PaperBars rows={inOut} empty="Nothing posted this month yet." caption="In and out" />
              </button>
            </div>
          )}
          <div ref={noteRef} className={`office-wide-notebook ${adding ? "is-inert" : ""}`}>
            {openSpec && (
              <NotebookBody
                title={openSpec.name}
                open
                panelId={panelId}
                onClose={() => setExpanded(null)}
              >
                <div className="office-wide-notebook-inner">
                  <button
                    type="button"
                    className={`ph-pin ${(layout.pinned ?? []).includes(openId) ? "is-on" : ""}`}
                    onClick={() => onLayout(toggleInstrumentPin(layout, openId))}
                    aria-label={(layout.pinned ?? []).includes(openId) ? `Unpin ${openSpec.name}` : `Pin ${openSpec.name} open`}
                  >
                    {(layout.pinned ?? []).includes(openId) ? "pinned" : "pin"}
                  </button>
                  {openSpec.body}
                </div>
              </NotebookBody>
            )}
          </div>
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
                onClick={() => onLayout(revealPhoneInstrument(layout, id))}
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
