/**
 * The "+" dial (L4): the record verbs on paper petals and a row of Open chips, over a scrim.
 *
 * Verbs (each opens the App's Add flow, which keeps its own named Confirm — nothing here records), from the App's
 * `recordModes` (its `fabActionsFor` list, trust M4) when given, else purchase · bill · income:
 *   Record a purchase… → openRecord("expense") · Record a shift… → openRecord("shift") · Mark paid… → openRecord("bill")
 *   · Record income… → openRecord("income") · Move money… → openRecord("transfer").
 * Open chips: Calendar (today), Books (register), Kitchen table (plan-studio), Simple view (`chooseSimpleView`),
 * All tools (`openAllTools`), Enter Horizon (the `enterHorizonCentre` call: only the dial's own run handles it, so the
 * item list never carries a made-up location) — a chip whose callback is absent is not drawn.
 * Escape or the scrim closes it and returns focus to "+". While open, the rest of the board is `inert` (the view).
 */
import { useEffect, useRef, type ReactNode } from "react";
import { runJourneyAction, type DateKey, type JourneyBoardActions } from "../contracts.ts";
import { COPY } from "./copy.ts";
import type { DialCall, JourneyRecordMode } from "./mergeShim.ts";

export type DialItem = { id: string; label: string; call: DialCall };

const VERB: Record<JourneyRecordMode, { id: string; label: string }> = {
  expense: { id: "purchase", label: COPY.recordPurchase },
  shift: { id: "shift", label: COPY.recordShift },
  bill: { id: "paid", label: COPY.markPaid },
  income: { id: "income", label: COPY.recordIncome },
  transfer: { id: "transfer", label: COPY.moveMoney },
};
const DEFAULT_MODES: readonly JourneyRecordMode[] = ["expense", "bill", "income"];
/** Petal order: money out, then money in, then the move that is neither (the App's dial order). */
const ORDER: readonly JourneyRecordMode[] = ["expense", "shift", "bill", "income", "transfer"];

/** The dial's verbs and chips, as data (the tests read the same list). */
export function dialItems(actions: JourneyBoardActions, today: DateKey, canEnterHorizon: boolean, recordModes?: readonly JourneyRecordMode[]): { verbs: DialItem[]; chips: DialItem[] } {
  const modes = recordModes && recordModes.length ? ORDER.filter((m) => recordModes.includes(m)) : DEFAULT_MODES;
  const verbs: DialItem[] = modes.map((mode) => ({ ...VERB[mode], call: { name: "openRecord", mode } }));
  const chips: DialItem[] = [
    { id: "calendar", label: COPY.chipCalendar, call: { name: "openCalendar", date: today } },
    { id: "books", label: COPY.chipBooks, call: { name: "openBooks", ref: { kind: "register" } } },
    { id: "kitchen", label: COPY.chipKitchen, call: { name: "openPlace", target: "plan-studio" } },
  ];
  if (actions.chooseSimpleView) chips.push({ id: "simple", label: COPY.chipSimple, call: { name: "chooseSimpleView" } });
  if (actions.openAllTools) chips.push({ id: "all-tools", label: COPY.chipAllTools, call: { name: "openAllTools" } });
  if (canEnterHorizon) chips.push({ id: "enter-horizon", label: COPY.enterHorizonChip, call: { name: "enterHorizonCentre" } });
  return { verbs, chips };
}

const ICONS: Record<string, ReactNode> = {
  purchase: <><path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>,
  shift: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>,
  paid: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="m9 11 2 2 4-4" /></>,
  income: <><circle cx="12" cy="13" r="7" /><path d="M12 10v6M9.5 12.5 12 10l2.5 2.5" /></>,
  transfer: <><path d="M5 9h13l-3-3M19 15H6l3 3" /></>,
};

export type AddDialProps = {
  open: boolean;
  onToggle(open: boolean): void;
  actions: JourneyBoardActions;
  today: DateKey;
  canEnterHorizon: boolean;
  /** "Enter Horizon" from the dial lands at the island's centre ground (the map supplies where that is). */
  onEnterHorizon(): void;
  /** The App's record modes (`fabActionsFor`), shift and transfer included when present. */
  recordModes?: readonly JourneyRecordMode[];
};

export function AddDial({ open, onToggle, actions, today, canEnterHorizon, onEnterHorizon, recordModes }: AddDialProps) {
  const plus = useRef<HTMLButtonElement | null>(null);
  const first = useRef<HTMLButtonElement | null>(null);
  const { verbs, chips } = dialItems(actions, today, canEnterHorizon, recordModes);
  const close = () => { onToggle(false); plus.current?.focus(); };
  const run = (item: DialItem) => {
    onToggle(false);
    if (item.call.name === "enterHorizonCentre") { onEnterHorizon(); return; }
    runJourneyAction(actions, item.call);
  };
  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onToggle(false); plus.current?.focus(); } };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onToggle]);
  return (
    <>
      {open ? <div className="journey-scrim" aria-hidden="true" data-journey-scrim="" onClick={close} /> : null}
      {open ? (
        <div className="journey-radial" role="group" aria-label={COPY.add} data-journey-radial="">
          <div className="journey-radial__petals" data-count={verbs.length}>
            {verbs.map((v, i) => (
              <button key={v.id} ref={i === 0 ? first : undefined} type="button" className={["journey-petal", `journey-petal--${v.id}`, verbs.length === 3 && i === 1 ? "journey-petal--mid" : ""].filter(Boolean).join(" ")} data-dial-verb={v.id} onClick={() => run(v)}>
                <i aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{ICONS[v.id]}</svg></i>
                <span className="journey-petal__label">{v.label}</span>
              </button>
            ))}
          </div>
          <div className="journey-radial__opens">
            <span className="journey-radial__lead"><span>{COPY.addLead}</span></span>
            {chips.map((c) => <button key={c.id} type="button" className="journey-toy journey-chip" data-dial-chip={c.id} onClick={() => run(c)}>{c.label}</button>)}
          </div>
        </div>
      ) : null}
      <button ref={plus} type="button" className={["journey-plus", open ? "is-open" : ""].filter(Boolean).join(" ")} aria-label={COPY.add} aria-expanded={open} data-journey-plus="" onClick={() => (open ? close() : onToggle(true))}>
        <span aria-hidden="true">+</span>
      </button>
    </>
  );
}
