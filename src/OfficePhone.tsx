import { useMemo, useState, type ReactNode } from "react";
import {
  auditOpinion,
  formatDateLabel,
  householdWallet,
  mailOverdue,
  phoneDeskKey,
  phoneDrawerIds,
  phoneDueBill,
  phoneRailOrder,
  phoneStoryIds,
  instrumentIsOpen,
  revealPhoneInstrument,
  toggleInstrumentPin,
  runHealthCheck,
  shiftPostingStreak,
  walletWarn,
} from "./core/index.ts";
import type { Household, Account, Category, CommitResult, InstrumentId, OfficeLayout, WeatherReading } from "./core/index.ts";
import type { Dashboard } from "./core/insights.ts";
import type { HearthTab } from "./core/hercules.ts";
import type { SillOverview } from "./core/sillOverview.ts";

import { BlotterBody, BlotterGlance } from "./widgets/Blotter.tsx";
import { CalculatorBody, CalculatorGlance } from "./widgets/CalculatorPad.tsx";
import { TimesheetBody, TimesheetGlance } from "./widgets/Timesheet.tsx";
import { ChalkboardBody } from "./widgets/ChalkboardDesk.tsx";
import { WindowBand } from "./widgets/WindowBand.tsx";
import { JarsBody, JarsGlance } from "./widgets/Jars.tsx";
import { LampBody, LampGlance, lampAria } from "./widgets/Lamp.tsx";
import { MailBody, MailGlance } from "./widgets/Mail.tsx";
import { WalletBody, WalletGlance } from "./widgets/WalletTray.tsx";
import { NotebookBody, PaperTile, StoryStrip, WaxSeal } from "./theme/PaperTheme.tsx";
import type { DeskForm, DeskMode } from "./widgets/deskTypes.ts";

/**
 * OfficePhone — mobile Home board (< 720px). Draft C shell:
 * weather ribbon → wax seals → 2×2 story strip → one notebook expand.
 */

type Spec = {
  kind: string;
  name: string;
  glance: ReactNode;
  aria: string;
  body: ReactNode;
  warn?: boolean;
};

export function OfficePhone({
  household, dashboard, sill, reading, layout, onLayout,
  today, memberId, busy, adding, form, mode, error, categories, postLabel,
  onForm, onPost, onMore, onMilk, onCoffee, onClockIn, onAbandonShift,
  onStartBreak, onEndBreak, onChooseShiftTimeline, onSignOut, onFinishedShift, onPayCard, onOpenAccount,
  onKitchen, onMarkPaid, onGo,
}: {
  household: Household;
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
  onKitchen: (fn: (current: Household) => CommitResult) => void;
  onMarkPaid: (recurrenceId: string, summary: string) => void;
  onGo: (tab: HearthTab) => void;
}) {
  const [chalkShrunk, setChalkShrunk] = useState(false);
  const opinion = useMemo(() => auditOpinion(household), [household]);
  const findings = useMemo(() => runHealthCheck(household), [household]);
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

  const postedToday = household.transactions.some((tx) => tx.date === today);
  const bill = phoneDueBill(dashboard.upcoming);
  const closeNeeds = findings.length > 0;

  function tapSeal(go: InstrumentId) {
    onLayout(revealPhoneInstrument(layout, go));
  }

  const kindLabel: Partial<Record<InstrumentId, string>> = {
    blotter: "Month",
    wallet: "Wallet",
    mail: "Mail",
    timesheet: "Shifts",
    jars: "Jars",
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
      aria: `Pad. ${form.note || "Post milk."}`,
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
      kind: kindLabel.timesheet ?? "Shifts",
      name: "Shifts",
      warn: streak.waiting,
      glance: <TimesheetGlance household={household} streak={streak} memberId={memberId} />,
      aria: "Shifts.",
      body: (
        <TimesheetBody
          household={household} streak={streak} memberId={memberId} memberName={memberName} today={today} busy={busy}
          onClockIn={onClockIn} onAbandon={onAbandonShift}
          onStartBreak={onStartBreak} onEndBreak={onEndBreak}
          onChooseTimeline={onChooseShiftTimeline}
          onSignOut={onSignOut} onFinished={onFinishedShift}
        />
      ),
    },
    jars: {
      kind: kindLabel.jars ?? "Jars",
      name: "Jars",
      glance: <JarsGlance dashboard={dashboard} />,
      aria: "Jars.",
      body: <JarsBody dashboard={dashboard} household={household} today={today} busy={busy} onPlan={() => onGo("plan")} onCommand={onKitchen} />,
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

  return (
    <div className={`office-phone office-phone-c ${adding ? "is-adding" : ""}`} data-desk={deskKey}>
      <WindowBand
        reading={reading}
        chalkboardBody={
          <ChalkboardBody
            household={household}
            memberId={memberId}
            busy={busy}
            onCommand={onKitchen}
            reading={reading}
            shrinkable
            shrunk={chalkShrunk}
            onToggleShrink={() => setChalkShrunk((on) => !on)}
          />
        }
      />

      {sill.needsMe && (
        <div className="ph-sill">
          <span className="ph-needs">{sill.needsMe}</span>
        </div>
      )}

      <div className="hearth-wax-seals ph-seals" role="group" aria-label="Desk seals">
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
          label="Close"
          tone="close"
          pending={closeNeeds}
          value={closeNeeds ? String(findings.length) : "—"}
          sub={closeNeeds ? "needs you" : "books agree"}
          onClick={() => tapSeal("lamp")}
        />
      </div>

      <StoryStrip>
        {storyIds.map((id) => {
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
  );
}
