import type { KitchenCommand } from "./kitchenCommand.ts";
import type { ScenarioSourceContext } from "./scenarioSourceContext.ts";
import { PhoneSpread } from "./PhoneSpread.tsx";
import { ApronCard, useApronReceipt } from "./ApronCard.tsx";
import type { PhoneChapter } from "./core/phoneSpread.ts";
import type { FundDestination } from "./FundStage.tsx";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  auditOpinion,
  formatCad,
  householdWallet,
  mailOverdue,
  phoneDeskKey,
  phoneDrawerIds,
  phoneRailOrder,
  phoneStoryIds,
  phoneFoldOrder,
  activeOpenShift,
  instrumentIsOpen,
  revealPhoneInstrument,
  deskMonthSeals,
  toggleInstrumentPin,
  shiftPostingStreak,
  walletWarn,
} from "./core/index.ts";
import type { Household, Account, Category, Finding, InstrumentId, OfficeLayout, WeatherReading } from "./core/index.ts";
import type { Dashboard } from "./core/insights.ts";
import type { HearthTab } from "./core/hercules.ts";
import type { SillOverview } from "./core/sillOverview.ts";

import { BlotterBody, BlotterGlance } from "./widgets/Blotter.tsx";
import { CalculatorBody, CalculatorGlance } from "./widgets/CalculatorPad.tsx";
import { TimesheetBody, TimesheetGlance } from "./widgets/Timesheet.tsx";
import { SharedBoards } from "./widgets/SharedBoards.tsx";
import { WeatherRibbon } from "./widgets/WeatherRibbon.tsx";
import { JarsBody, JarsGlance } from "./widgets/Jars.tsx";
import { LampBody, LampGlance, lampAria } from "./widgets/Lamp.tsx";
import { MailBody, MailGlance } from "./widgets/Mail.tsx";
import { WalletBody, WalletGlance } from "./widgets/WalletTray.tsx";
import { NotebookBody, PaperTile, WaxSeal } from "./theme/PaperTheme.tsx";
import { PhoneFold } from "./PhoneFold.tsx";
import type { DeskForm, DeskMode } from "./widgets/deskTypes.ts";

/**
 * OfficePhone — mobile Home board (< 720px). Draft C shell:
 * weather ribbon → wax seals → 2×2 story strip → one notebook expand.
 */

type Spec = {
  kind: string;
  name: string;
  glance: ReactNode;
  valueKind?: "figure" | "sentence";
  aria: string;
  body: ReactNode;
  warn?: boolean;
};

export function OfficePhone({
  scenarioSource,
  household, booksHousehold = household, view = "household", onOpenFundDestination, dashboard, sill, reading, layout, onLayout,
  today, memberId, busy, adding, form, mode, error, categories, postLabel,
  integrityFindings = [],
  onForm, onPost, onMore, onMilk, onCoffee, onClockIn, onAbandonShift,
  onStartBreak, onEndBreak, onChooseShiftTimeline, onSignOut, onFinishedShift, onPayCard, onOpenAccount,
  onKitchen, onMarkPaid, onGo, onOpenDrawer,
}: {
  onOpenDrawer?: () => void;
  scenarioSource?: ScenarioSourceContext | null;
  household: Household;
  booksHousehold?: Household;
  view?: "household" | "personal";
  onOpenFundDestination?: (destination: FundDestination) => void;
  dashboard: Dashboard;
  sill: SillOverview;
  reading: WeatherReading;
  layout: OfficeLayout;
  onLayout: (next: OfficeLayout) => void;
  today: string;
  memberId: string;
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
  onKitchen: KitchenCommand;
  onMarkPaid: (recurrenceId: string, summary: string) => void;
  onGo: (tab: HearthTab) => void;
  integrityFindings?: Finding[];
}) {
  const [chalkOpen, setChalkOpen] = useState(false);
  useEffect(() => { if (layout.expanded === "chalkboard") setChalkOpen(true); }, [layout.expanded]);
  const receipt = useApronReceipt(booksHousehold, memberId);
  const [chapter, setChapter] = useState<PhoneChapter | null>(null);
  const cover = useRef<HTMLElement | null>(null);
  const officeRoot = useRef<HTMLDivElement>(null);
  const coverIndex = useRef(0);
  const spreadScope = `${booksHousehold.environment}:${booksHousehold.householdId}:${memberId}:${view}`;
  useEffect(() => { setChapter(null); }, [spreadScope, adding]);
  const closeChapter = () => {
    setChapter(null);
    queueMicrotask(() => {
      const current = cover.current?.isConnected ? cover.current : officeRoot.current?.querySelectorAll<HTMLButtonElement>(".ph-seals button")[coverIndex.current];
      current?.focus();
    });
  };
  const openChapter = (next: PhoneChapter, invokingCover: HTMLButtonElement) => {
    cover.current = invokingCover;
    coverIndex.current = next === "in" ? 0 : next === "out" ? 1 : 2;
    onLayout({ ...layout, expanded: null });
    setChapter(next);
  };
  const opinion = useMemo(() => auditOpinion(household), [household]);
  const findings = integrityFindings;
  const streak = useMemo(() => shiftPostingStreak(household, today), [household, today]);
  const wallet = useMemo(() => householdWallet(household, today), [household, today]);
  const memberName = household.members.find((m) => m.id === memberId)?.name ?? "";
  const mailWarn = mailOverdue(dashboard, today);
  const walletIsWarn = walletWarn(wallet);

  const hidden = useMemo(
    () => new Set(layout.items.filter((item) => item.hidden).map((item) => item.id)),
    [layout.items],
  );

  const deskKey = phoneDeskKey({
    shiftCount: household.shifts.length,
    chalkboardLength: household.kitchen?.chalkboard?.length ?? 0,
  });
  const lampLit = findings.length > 0;
  const order = phoneRailOrder({
    desk: deskKey,
    hidden,
    lampLit,
    expanded: layout.expanded,
  });
  const storyIds = phoneStoryIds(order);

  const expanded = layout.expanded;
  const setExpanded = (id: InstrumentId | null) =>
    onLayout({ ...layout, expanded: expanded === id ? null : id });

  const seals = deskMonthSeals(dashboard.month);

  const kindLabel: Partial<Record<InstrumentId, string>> = {
    blotter: "Month",
    wallet: "Wallet",
    mail: "Mail",
    timesheet: "Shifts",
    jars: "Goals",
    lamp: "Health",
    calculator: "Pad",
  };

  const specs: Partial<Record<InstrumentId, Spec>> = {
    blotter: {
      kind: kindLabel.blotter ?? "Month",
      name: "Month net",
      glance: <BlotterGlance dashboard={dashboard} opinion={opinion} findings={findings.length} />,
      aria: `Month net. ${dashboard.monthLabel}.`,
      body: <BlotterBody dashboard={dashboard} opinion={opinion} findings={findings.length} />,
    },
    calculator: {
      kind: kindLabel.calculator ?? "Pad",
      name: "Pad",
      glance: <CalculatorGlance amount={form.amount} />,
      aria: `Pad. ${form.note || "Post groceries."}`,
      body: (
        <CalculatorBody
          scopeKey={JSON.stringify([household.environment, household.householdId, memberId, view])}
          form={form} setForm={onForm} mode={mode} household={household}
          accounts={household.accounts} categories={categories} postLabel={postLabel}
          error={error} busy={busy} onPost={onPost} onMore={onMore}
          onMilk={onMilk} onCoffee={onCoffee}
        />
      ),
    },
    timesheet: {
      kind: kindLabel.timesheet ?? "Shifts",
      name: "Shifts",
      warn: streak.waiting,
      valueKind: activeOpenShift(household.kitchen, memberId) ? "figure" : "sentence",
      glance: <TimesheetGlance household={household} streak={streak} memberId={memberId} />,
      aria: "Shifts.",
      body: (
        <TimesheetBody view={view}
          household={household} streak={streak} memberId={memberId} memberName={memberName} today={today} busy={busy}
          onClockIn={onClockIn} onAbandon={onAbandonShift}
          onStartBreak={onStartBreak} onEndBreak={onEndBreak}
          onChooseTimeline={onChooseShiftTimeline}
          onSignOut={onSignOut} onFinished={onFinishedShift}
        />
      ),
    },
    jars: {
      kind: kindLabel.jars ?? "Goals",
      name: "Goals",
      valueKind: "sentence",
      glance: <JarsGlance dashboard={dashboard} />,
      aria: "Goals.",
      body: <JarsBody view={view} booksHousehold={booksHousehold} memberId={memberId} dashboard={dashboard} household={household} today={today} busy={busy} onPlan={() => onGo("plan")} onCommand={onKitchen} />,
    },
    lamp: {
      kind: kindLabel.lamp ?? "Health",
      name: "Health",
      warn: lampLit,
      glance: <LampGlance findings={findings} />,
      aria: lampAria(findings),
      body: <LampBody findings={findings} onMore={() => onGo("more")} />,
    },
    mail: {
      kind: kindLabel.mail ?? "Mail",
      name: "Next bill",
      warn: mailWarn,
      valueKind: "sentence",
      glance: <MailGlance dashboard={dashboard} today={today} />,
      aria: "Next bill.",
      body: <MailBody dashboard={dashboard} today={today} onMarkPaid={onMarkPaid} onCalendar={() => onGo("calendar")} />,
    },
    wallet: {
      kind: kindLabel.wallet ?? "Wallet",
      name: "Wallet",
      warn: walletIsWarn,
      glance: <WalletGlance wallet={wallet} />,
      aria: "Wallet.",
      body: <WalletBody wallet={wallet} onPayCard={onPayCard} onOpenAccount={onOpenAccount} />,
    },
  };

  const drawer = phoneDrawerIds(order.filter((id) => id !== "chalkboard"));
  const openSpec = expanded && expanded !== "window" ? specs[expanded as InstrumentId] : undefined;
  const openId = expanded && expanded !== "window" ? (expanded as InstrumentId) : null;
  const panelId = openId ? `ph-notebook-${openId}` : "ph-notebook";

  const foldItems = phoneFoldOrder({
    apron: !!receipt,
    stories: storyIds,
    ownShift: !!activeOpenShift(household.kitchen, memberId),
    overdue: mailWarn,
    health: lampLit,
    needs: !!sill.needsMe,
  });
  const foldContent = (id: typeof foldItems[number]["id"]) => {
    if (id === "apron") return receipt ? <ApronCard receipt={receipt} household={booksHousehold} today={today} /> : null;
    if (id === "weather") return <WeatherRibbon reading={reading} />;
    if (id === "needs") return <div className="ph-sill"><span className="ph-needs">{sill.needsMe}</span></div>;
    if (id === "seals") return sealsContent;
    const spec = specs[id];
    if (!spec) return null;
    return <PaperTile kind={spec.kind} name={spec.name} value={spec.glance} valueKind={spec.valueKind}
      warn={spec.warn} active={instrumentIsOpen(layout, id)}
      onClick={() => setExpanded(id)} ariaLabel={spec.aria} />;
  };
  const sealsContent = (
    <div className="hearth-wax-seals ph-seals" role="group" aria-label="Desk seals">
      <WaxSeal label="Money in" tone="post" pending={seals.inCents === 0}
        value={formatCad(seals.inCents)} sub="posted income this month" pressed={chapter === "in"} onClick={event => openChapter("in", event.currentTarget)} />
      <WaxSeal label="Money out" tone="due" pending={seals.outCents === 0}
        value={formatCad(seals.outCents)} sub="posted expenses only" pressed={chapter === "out"} onClick={event => openChapter("out", event.currentTarget)} />
      <WaxSeal label="Leftover spend" tone="close" value={formatCad(seals.leftoverCents)}
        sub="posted in minus posted expenses" pending={seals.inCents === 0 && seals.outCents === 0}
        pressed={chapter === "leftover"} onClick={event => openChapter("leftover", event.currentTarget)} />
    </div>
  );

  return (
    <div ref={officeRoot} className={`office-phone office-phone-c ${adding ? "is-adding" : ""}`} data-desk={deskKey}>
      <div inert={adding || undefined}><PhoneFold items={foldItems} render={foldContent} /></div>

      {chapter && !adding ? <PhoneSpread scenarioSource={scenarioSource} key={spreadScope} chapter={chapter} household={booksHousehold} memberId={memberId} view={view} today={today} busy={busy}
        onClose={closeChapter} onKitchen={onKitchen} onOpen={destination => { setChapter(null); if (onOpenFundDestination) onOpenFundDestination(destination); else onGo(destination === "shelf" ? "plan" : "ledger"); }} /> : null}

      {openSpec && openId && (
        <NotebookBody
          title={openSpec.name}
          open
          panelId={panelId}
          onClose={() => setExpanded(null)}
        >
          <div className={`ph-notebook-inner ${adding ? "is-inert" : ""}`}>
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

      <div className="ph-instrument-actions">
      {onOpenDrawer && <button type="button" className="ghost ph-desk-drawer" onClick={onOpenDrawer}>Drawer</button>}
      {drawer.length > 0 && (
        <details className="ph-drawer">
          <summary>
            More instruments
            <span aria-hidden="true"> · </span>
            {drawer.length}
          </summary>
          <div className="ph-drawer-grid">
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

      <details className="ph-chalk" open={chalkOpen} onToggle={(event) => {
        const open=event.currentTarget.open;setChalkOpen(open);
        if(!open&&layout.expanded==="chalkboard")onLayout({...layout,expanded:null});
      }}>
        <summary>Our boards · Notes, photos & plans</summary>
        <div className={`ph-chalk-body ${adding ? "is-inert" : ""}`}>
          <SharedBoards
            key={`${household.environment}:${household.householdId}:${memberId}:${view}`}
            household={booksHousehold}
            memberId={memberId}
            today={today}
            view={view}
            scenarioSource={scenarioSource}
            busy={busy}
            onCommand={onKitchen}
            onOpenGoals={() => onGo("plan")}
          />
        </div>
      </details>
    </div>
  );
}
