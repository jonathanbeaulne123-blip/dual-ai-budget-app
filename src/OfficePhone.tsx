import { useMemo, useState, type ReactNode, type Ref } from "react";
import { useFurniture } from "./widgets/useFurniture.ts";
import {
  INSTRUMENT_KIND,
  auditOpinion,
  formatDateLabel,
  householdWallet,
  mailOverdue,
  phoneDeskKey,
  phoneDrawerIds,
  phoneDueBill,
  phoneRailOrder,
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
import type { DeskForm, DeskMode } from "./widgets/deskTypes.ts";

/**
 * OfficePhone — the mobile Home board (< 720px only).
 *
 * Wide is untouched: Office.tsx branches to this component before it renders
 * the desk canvas, so every wide code path below that branch is unchanged.
 *
 * Three stamps carry wayfinding. Five objects at rest. Confirm still posts
 * through CalculatorBody. Stamps never write money.
 */

type Stamp = {
  key: "post" | "due" | "close";
  label: string;
  value: string;
  sub: string;
  pending: boolean;
  go: InstrumentId;
};

type Spec = {
  name: string;
  glance: ReactNode;
  aria: string;
  body: ReactNode;
  wide?: boolean;
  kind?: "text";
  warn?: boolean;
};

/** Stable per-object tilt, so the same thing is always askew the same way. */
function tilt(id: string): number {
  let n = 0;
  for (const ch of id) n += ch.charCodeAt(0);
  return ((n % 9) - 4) / 5.5;
}

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

  const expanded = layout.expanded;
  const setExpanded = (id: InstrumentId | null) =>
    onLayout({ ...layout, expanded: expanded === id ? null : id });

  const postedToday = household.transactions.some((tx) => tx.date === today);
  const bill = phoneDueBill(dashboard.upcoming);
  const closeNeeds = findings.length > 0;

  const stamps: Stamp[] = [
    {
      key: "post", label: "Post", pending: !postedToday, go: "calculator",
      value: postedToday ? "—" : "Milk",
      sub: postedToday ? "posted today" : "nothing yet today",
    },
    {
      key: "due", label: "Due", pending: Boolean(bill), go: "mail",
      value: bill ? bill.title : "—",
      sub: bill ? formatDateLabel(bill.date) : "nothing near",
    },
    {
      key: "close", label: "Close", pending: closeNeeds, go: "lamp",
      value: closeNeeds ? String(findings.length) : "—",
      sub: closeNeeds ? "needs you" : "books agree",
    },
  ];

  function tapStamp(stamp: Stamp) {
    onLayout(revealPhoneInstrument(layout, stamp.go));
  }

  const specs: Partial<Record<InstrumentId, Spec>> = {
    blotter: {
      name: "Month net", wide: true,
      glance: <BlotterGlance dashboard={dashboard} opinion={opinion} findings={findings.length} />,
      aria: `Month net. ${dashboard.monthLabel}.`,
      body: <BlotterBody dashboard={dashboard} opinion={opinion} findings={findings.length} />,
    },
    calculator: {
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
      kind: "text",
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
      kind: "text",
      name: "Jars",
      glance: <JarsGlance dashboard={dashboard} />,
      aria: "Jars.",
      body: <JarsBody dashboard={dashboard} household={household} today={today} busy={busy} onPlan={() => onGo("plan")} onCommand={onKitchen} />,
    },
    lamp: {
      name: "Health",
      warn: lampLit,
      glance: <LampGlance findings={findings} />,
      aria: lampAria(findings),
      body: <LampBody findings={findings} onMore={() => onGo("more")} />,
    },
    mail: {
      name: "Next bill",
      warn: mailWarn,
      glance: <MailGlance dashboard={dashboard} today={today} />,
      aria: "Next bill.",
      body: <MailBody dashboard={dashboard} today={today} onMarkPaid={onMarkPaid} onCalendar={() => onGo("calendar")} />,
    },
    wallet: {
      name: "Wallet",
      warn: walletIsWarn,
      glance: <WalletGlance wallet={wallet} />,
      aria: "Wallet.",
      body: (
        <WalletBody wallet={wallet} onPayCard={onPayCard} onOpenAccount={onOpenAccount} />
      ),
    },
  };

  const drawer = phoneDrawerIds(order.filter((id) => id !== "chalkboard"));

  return (
    <div className={`office-phone ${adding ? "is-adding" : ""}`} data-desk={deskKey}>
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

      <div className="ph-sill">
        <span className="ph-needs">{sill.needsMe}</span>
      </div>

      <div className="ph-stamps">
        {stamps.map((stamp) => (
          <button
            key={stamp.key}
            type="button"
            className={`ph-stamp ${stamp.pending ? "is-pending" : "is-clear"}`}
            onClick={() => tapStamp(stamp)}
            aria-label={`${stamp.label}. ${stamp.value}. ${stamp.sub}.`}
          >
            <span className="ph-lbl">{stamp.label}</span>
            <span className="ph-val">{stamp.value}</span>
            <span className="ph-sub">{stamp.sub}</span>
          </button>
        ))}
      </div>

      <div className="ph-rail">
        {order.filter((id) => id !== "chalkboard").map((id) => {
          const spec = specs[id];
          if (!spec) return null;
          return (
            <PhoneInstrument
              key={id}
              id={id}
              spec={spec}
              open={instrumentIsOpen(layout, id)}
              adding={adding}
              pinned={(layout.pinned ?? []).includes(id)}
              onToggle={() => setExpanded(id)}
              onPin={() => onLayout(toggleInstrumentPin(layout, id))}
            />
          );
        })}
      </div>

      {drawer.length > 0 && (
        <details className="ph-drawer">
          <summary>Drawer · {drawer.length}</summary>
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

/** One object on the phone desk. Publishes a corner seat so Hercules does not sit on the glance. */
function PhoneInstrument({
  id, spec, open, adding, pinned, onToggle, onPin,
}: {
  id: InstrumentId;
  spec: Spec;
  open: boolean;
  adding: boolean;
  pinned: boolean;
  onToggle: () => void;
  onPin: () => void;
}) {
  const ref = useFurniture(id, INSTRUMENT_KIND[id], true, Boolean(spec.warn), {
    enabled: !adding,
    seat: "corner",
  });
  return (
    <section
      ref={ref as unknown as Ref<HTMLElement>}
      className={`ph-inst ${spec.wide ? "is-wide" : ""} ${open ? "is-open" : ""} ${adding ? "is-inert" : ""} ${spec.warn ? "is-warn" : ""}`}
      style={{ ["--rot" as string]: `${tilt(id)}deg` }}
      data-kind={spec.kind ?? "figure"}
      aria-label={spec.aria}
    >
      <button type="button" className="ph-head" onClick={onToggle} aria-expanded={open}>
        <span className="ph-name">{spec.name}</span>
        <span className="ph-value">{spec.glance}</span>
      </button>
      <button type="button" className={`ph-pin ${pinned ? "is-on" : ""}`} onClick={onPin} aria-label={pinned ? `Unpin ${spec.name}` : `Pin ${spec.name} open`}>
        {pinned ? "pinned" : "pin"}
      </button>
      {open && <div className="ph-body">{spec.body}</div>}
    </section>
  );
}
