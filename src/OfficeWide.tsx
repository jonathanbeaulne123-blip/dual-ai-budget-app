import { useMemo, useState, useEffect, type ReactNode } from "react";
import {
  auditOpinion,
  categorySpendBars,
  claimsOverdue,
  formatCad,
  formatDateLabel,
  householdWallet,
  instrumentIsOpen,
  isLedgerStoryTileId,
  mailOverdue,
  monthInOutBars,
  paperHomeMosaic,
  phoneDueBill,
  revealPhoneInstrument,
  shiftPostingStreak,
  kittyBankBars,
  kittyBankGlance,
  kittyBanksInView,
  tipWeekdaySpark,
  toggleInstrumentPin,
  walletWarn,
  wideDrawerIds,
  WIDE_HERO_ID,
  cookOffScore,
  sitDownPostcard,
  type LedgerStoryTileId,
  type PaperHomeMosaicItem,
  type PersonalLedgerStory as PersonalLedgerStoryModel,
  type SharedLedgerStory as SharedLedgerStoryModel,
} from "./core/index.ts";
import type { Account, Category, CommitResult, Environment, Finding, Household, InstrumentId, OfficeLayout, UndoToken } from "./core/index.ts";
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
import { NotebookBody, PaperBars, PaperSpark, PaperTile, StoryStrip, WaxSeal } from "./theme/PaperTheme.tsx";
import { SharedLedgerStory } from "./SharedLedgerStory.tsx";
import { PersonalLedgerFolio } from "./PersonalLedgerFolio.tsx";
import { KittyBanks } from "./KittyBanks.tsx";
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
 * OfficeWide — composed paper office (≥720px).
 * Seals span; mosaic | hero | notebook at laptop width. Story lives in the notebook.
 */
export function OfficeWide({
  household, booksHousehold, dashboard, layout, onLayout,
  today, memberId, view, busy, adding, form, mode, error, categories, postLabel,
  environment, clinkOn, integrityFindings = [],
  sharedStory = null, personalStory = null,
  onForm, onPost, onMore, onMilk, onCoffee, onClockIn, onAbandonShift,
  onStartBreak, onEndBreak, onChooseShiftTimeline, onSignOut, onFinishedShift, onPayCard, onOpenAccount,
  onKitchen, onMarkPaid, onAskSettle, onAskStartJar, onSitDown, onGo, onClinkOn,
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
  const defaultStory: LedgerStoryTileId = view === "personal" ? "mine" : "now";
  const [storyPanel, setStoryPanel] = useState<LedgerStoryTileId | null>(defaultStory);

  const opinion = useMemo(() => auditOpinion(household), [household]);
  const findings = integrityFindings;
  const streak = useMemo(() => shiftPostingStreak(household, today), [household, today]);
  const wallet = useMemo(() => householdWallet(household, today), [household, today]);
  const postcard = useMemo(() => sitDownPostcard(booksHousehold), [booksHousehold]);
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
  const mosaicItems = paperHomeMosaic({ view, hidden, lampLit, expanded: layout.expanded });
  const mosaicInstrumentIds = mosaicItems
    .filter((item): item is Extract<PaperHomeMosaicItem, { slot: "instrument" }> => item.slot === "instrument")
    .map((item) => item.id);
  const drawer = wideDrawerIds(mosaicInstrumentIds, { includeHero: view !== "household" });

  const expanded = layout.expanded;

  useEffect(() => {
    setStoryPanel(view === "personal" ? "mine" : "now");
  }, [view]);

  function openStory(id: LedgerStoryTileId) {
    setStoryPanel(id);
    if (layout.expanded && layout.expanded !== "window") {
      onLayout({ ...layout, expanded: null });
    }
  }

  function openInstrument(id: InstrumentId) {
    setStoryPanel(null);
    onLayout({ ...layout, expanded: layout.expanded === id ? null : id });
  }

  const postedToday = household.transactions.some((tx) => tx.date === today);
  const bill = phoneDueBill(dashboard.upcoming);
  const closeNeeds = findings.length > 0;
  const inOut = monthInOutBars(dashboard.month);
  const spend = categorySpendBars(dashboard.month.categories);
  const tipSpark = tipWeekdaySpark(dashboard.tipWeather);

  function tapSeal(go: InstrumentId) {
    setStoryPanel(null);
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
      body: <PostcardBody household={booksHousehold} displayHousehold={household} dashboard={dashboard} view={view} card={postcard} onApply={onSitDown} />,
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

  const heroSpec = specs[WIDE_HERO_ID];
  const notebookIsStory = Boolean(storyPanel);
  const openId = notebookIsStory
    ? null
    : (expanded && expanded !== "window" ? (expanded as InstrumentId) : WIDE_HERO_ID);
  const openSpec = openId ? (specs[openId] ?? heroSpec) : null;
  const panelId = notebookIsStory ? `wide-notebook-story-${storyPanel}` : `wide-notebook-${openId ?? "blotter"}`;
  const chalkOpen = openId === "chalkboard";
  const storyTitle = storyPanel === "now" ? "Kitty Banks"
    : storyPanel === "attention" ? "Attention"
    : storyPanel === "change" ? "Change"
    : storyPanel === "mine" ? "Mine"
    : storyPanel === "position" ? "Position"
    : storyPanel === "movement" ? "Movement"
    : "Story";

  function storyTile(id: LedgerStoryTileId): { kind: string; name: string; glance: ReactNode; figure?: ReactNode; aria: string; warn?: boolean } {
    if (id === "now") {
      const banks = kittyBanksInView(household, "household");
      const glance = kittyBankGlance(banks);
      const bars = kittyBankBars(banks);
      return {
        kind: "Now",
        name: "Kitty Banks",
        glance: glance.label,
        figure: bars.length ? <PaperBars rows={bars} empty="" /> : undefined,
        aria: `Now. Kitty Banks. ${glance.label}.`,
      };
    }
    if (id === "attention") {
      const waiting = sharedStory?.queue.length ?? 0;
      return {
        kind: "Attention",
        name: "Needs someone",
        glance: waiting ? `${waiting} waiting` : "Clear",
        aria: waiting ? `Attention. ${waiting} items need a person.` : "Attention. Nothing is waiting.",
        warn: waiting > 0,
      };
    }
    if (id === "change") {
      const kitty = sharedStory?.monthly.kittyCents ?? 0;
      return {
        kind: "Change",
        name: "This month",
        glance: `Kitty ${formatCad(kitty)}`,
        figure: inOut.length ? <PaperBars rows={inOut} empty="" caption="In and out" /> : undefined,
        aria: `Change. Kitty ${formatCad(kitty)}.`,
      };
    }
    if (id === "mine") {
      return {
        kind: "Mine",
        name: "My folio",
        glance: personalStory?.headline ?? "Personal",
        aria: personalStory?.headline ?? "Mine.",
      };
    }
    if (id === "position") {
      const count = personalStory?.position.length ?? 0;
      return {
        kind: "Position",
        name: "My accounts",
        glance: count ? `${count} accounts` : "None yet",
        aria: "Position. My Personal accounts.",
      };
    }
    const moved = personalStory?.activity[0];
    return {
      kind: "Movement",
      name: "In and out",
      glance: moved ? formatCad(moved.amountCents) : "Quiet",
      aria: "Movement. What came in or went out.",
    };
  }

  return (
    <div className={`office-wide ${adding ? "is-adding" : ""} ${view === "household" ? "is-shared-home" : ""}`}>
      <div className="office-wide-desk">
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
        <div ref={mosaicRef} className="office-wide-mosaic-wrap">
          <StoryStrip heading="Today's stories" className="office-wide-mosaic">
            {mosaicItems.map((item) => {
              if (item.slot === "story") {
                const tile = storyTile(item.id);
                return (
                  <PaperTile
                    key={`story-${item.id}`}
                    kind={tile.kind}
                    name={tile.name}
                    value={tile.glance}
                    figure={tile.figure}
                    warn={tile.warn}
                    active={storyPanel === item.id}
                    onClick={() => openStory(item.id)}
                    ariaLabel={tile.aria}
                  />
                );
              }
              const spec = specs[item.id];
              if (!spec) return null;
              return (
                <PaperTile
                  key={item.id}
                  kind={spec.kind}
                  name={spec.name}
                  value={spec.glance}
                  warn={spec.warn}
                  active={!notebookIsStory && instrumentIsOpen(layout, item.id)}
                  onClick={() => openInstrument(item.id)}
                  ariaLabel={spec.aria}
                />
              );
            })}
          </StoryStrip>
        </div>
        {heroSpec && view !== "household" && (
          <div ref={heroRef} className="office-wide-hero-wrap">
            <button
              type="button"
              className={`office-wide-hero hearth-paper-tile ${!notebookIsStory && instrumentIsOpen(layout, WIDE_HERO_ID) ? "is-active" : ""}`}
              onClick={() => openInstrument(WIDE_HERO_ID)}
              aria-label={heroSpec.aria}
              aria-pressed={!notebookIsStory && instrumentIsOpen(layout, WIDE_HERO_ID)}
            >
              <span className="hearth-tile-kind">{heroSpec.kind}</span>
              <span className="hearth-tile-name">{dashboard.monthLabel}</span>
              <span className="office-wide-hero-net">{heroSpec.glance}</span>
              <PaperBars rows={inOut} empty="Nothing posted this month yet." caption="In and out" />
            </button>
          </div>
        )}
        <div ref={noteRef} className={`office-wide-notebook ${adding ? "is-inert" : ""} ${chalkOpen ? "is-chalk" : ""}`}>
          <NotebookBody
            title={notebookIsStory ? storyTitle : (openSpec?.name ?? "Notebook")}
            open
            bare={chalkOpen}
            panelId={panelId}
            onClose={() => {
              setStoryPanel(view === "personal" ? "mine" : "now");
              if (layout.expanded && layout.expanded !== "window") {
                onLayout({ ...layout, expanded: null });
              }
            }}
          >
            <div className="office-wide-notebook-inner">
              {notebookIsStory && view === "household" && storyPanel === "now" ? (
                <KittyBanks
                  household={household}
                  booksHousehold={booksHousehold}
                  view="household"
                  createdBy={memberId}
                  busy={busy}
                  surface="home"
                  onCommand={onKitchen}
                  onAskStartJar={onAskStartJar}
                  onOpenPlan={() => onGo("plan")}
                />
              ) : notebookIsStory && sharedStory && view === "household" && isLedgerStoryTileId(storyPanel ?? "") ? (
                <SharedLedgerStory
                  story={sharedStory}
                  panel={storyPanel === "attention" || storyPanel === "change" ? storyPanel : "attention"}
                  onOpenFund={() => onGo("ledger")}
                  onOpenHealth={() => onGo("more")}
                />
              ) : notebookIsStory && personalStory && view === "personal" ? (
                <PersonalLedgerFolio
                  story={personalStory}
                  panel={storyPanel === "position" || storyPanel === "movement" || storyPanel === "mine" ? storyPanel : "mine"}
                  onOpenBooks={() => onGo("ledger")}
                  onOpenFund={() => onGo("ledger")}
                />
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
              ) : null}
            </div>
          </NotebookBody>
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
                  setStoryPanel(null);
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
