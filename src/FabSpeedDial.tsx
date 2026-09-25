import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import type { FabAction, FabAddMode, FabIcon } from "./core/fabActions.ts";
import { fabActionsFor } from "./core/fabActions.ts";
import "./fab-speed-dial.css";

export type { FabAddMode, FabVerbMode } from "./core/fabActions.ts";

/** The dial's verbs, nearest the thumb first (Purchase · Shift · Income · Bill paid · Move money). */
export const FAB_ADD_ACTIONS = fabActionsFor("personal").map((action) => ({ mode: action.mode, label: action.label, aria: action.aria }));

/** One stroke set: 24-grid, 2 px, round caps, `currentColor` so forced colours paint it (§4.2). */
const ICON_PATHS: Record<FabIcon, { title: string; body: ReactNode }> = {
  receipt: { title: "Receipt", body: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6M9 16h3" /></> },
  "clock-tray": { title: "Clock with a tray", body: <><circle cx="12" cy="10" r="6" /><path d="M12 7v3l2 2" /><path d="M4 18h16l-2 3H6z" /></> },
  "hand-coin": { title: "Hand receiving a coin", body: <><circle cx="15" cy="6" r="3" /><path d="M3 15h4l4 2h4a2 2 0 0 0 0-4h-3" /><path d="M7 15v5M7 20h9l5-4" /></> },
  "slip-stamp": { title: "Slip with a paid stamp", body: <><path d="M5 3h10l4 4v14H5z" /><path d="M15 3v4h4" /><circle cx="12" cy="14" r="3.5" /><path d="M10.5 14l1 1 2-2" /></> },
  "two-arrows": { title: "Two arrows", body: <><path d="M4 8h14M14 4l4 4-4 4" /><path d="M20 16H6M10 12l-4 4 4 4" /></> },
};

function DialIcon({ icon }: { icon: FabIcon }) {
  const { title, body } = ICON_PATHS[icon];
  return (
    <svg className="record-dial__icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <title>{title}</title>
      {body}
    </svg>
  );
}

function RecordGlyph() {
  return (
    <svg className="record-bubble__icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** "Purchase, shift, income, bill paid, or move money" — from the verbs actually shown. */
export function fabDescription(actions: readonly Pick<FabAction, "label">[]): string {
  const words = actions.map((action, index) => (index === 0 ? action.label : action.label.toLowerCase()));
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")}, or ${words.at(-1)}`;
}

/**
 * The Record speed dial (§3.3). A column of verbs that opens upward from the
 * Record bubble; each verb opens an Add flow and never posts — Final Confirm
 * posts (D-164). Purchase is the row nearest the bubble and first in DOM and
 * focus order.
 *
 * Keyboard: the bubble opens it with focus on Purchase; ↑/↓ move between
 * verbs (↑ is away from the bubble), Home/End jump; Tab or Escape closes and
 * returns focus to the bubble. A tap outside closes it. While open, its root
 * carries `data-camera-deadzone` so the harbour ignores pointerdowns inside.
 * While an Add sheet is open (`closed`), it is shut and `inert`.
 */
export function FabSpeedDial({
  closed = false,
  actions,
  closedLabel = "Record",
  mirror = false,
  onPick,
  onBillPaid,
  onGo,
  onOpenChange,
}: {
  closed?: boolean;
  actions?: readonly FabAction[];
  closedLabel?: string;
  /** Comfort setting "Record on the left": the column mirrors toward the left thumb. */
  mirror?: boolean;
  /** Purchase, Shift, Income and Move money: open that Add flow (`openAddFor(null, mode)`). */
  onPick: (mode: FabAddMode) => void;
  /**
   * Bill paid: open the Add flow in its bill mode (the next due bills as
   * slips). Until the App wires it, the Bill paid row is not shown — a verb
   * that does nothing would be worse than a stable four.
   */
  onBillPaid?: () => void;
  /** @deprecated The dial no longer navigates (D-246). Accepted and ignored for one release. */
  onGo?: (tab: never) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  void onGo;
  const rows: readonly FabAction[] = (actions ?? fabActionsFor("personal")).filter((action) => action.mode !== "bill" || Boolean(onBillPaid));
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const fabRef = useRef<HTMLButtonElement | null>(null);
  const groupId = useId();
  const descriptionId = useId();
  const shown = open && !closed;
  const openChange = useRef(onOpenChange);
  openChange.current = onOpenChange;

  function setDial(next: boolean) {
    setOpen(next);
    openChange.current?.(next);
  }

  function closeToBubble() {
    setDial(false);
    fabRef.current?.focus();
  }

  useEffect(() => {
    if (!closed) return;
    setOpen(false);
    openChange.current?.(false);
  }, [closed]);

  useEffect(() => {
    if (!shown) return;
    rootRef.current?.querySelector<HTMLButtonElement>("[data-fab-action]")?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      closeToBubble();
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [shown]);

  function onColumnKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    const buttons = [...(event.currentTarget.querySelectorAll<HTMLButtonElement>("[data-fab-action]"))];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const focus = (index: number) => buttons[(index + buttons.length) % buttons.length]?.focus();
    // The column opens upward: ↑ moves away from the bubble (the next verb), ↓ back toward it.
    if (event.key === "ArrowUp") { event.preventDefault(); focus(at + 1); }
    else if (event.key === "ArrowDown") { event.preventDefault(); focus(at - 1); }
    else if (event.key === "Home") { event.preventDefault(); focus(0); }
    else if (event.key === "End") { event.preventDefault(); focus(buttons.length - 1); }
    else if (event.key === "Tab") { event.preventDefault(); closeToBubble(); }
  }

  const description = fabDescription(rows);

  return (
    <div
      ref={rootRef}
      className={`fab-dial record-dial-root${shown ? " is-open" : ""}${mirror ? " is-mirrored" : ""}`}
      data-fab-dial={shown ? "open" : "closed"}
      data-fab-mirror={mirror ? "left" : "right"}
      data-camera-deadzone={shown ? "" : undefined}
      inert={closed || undefined}
    >
      {shown ? (
        <button
          className="fab-dial-scrim"
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={closeToBubble}
        />
      ) : null}
      <div
        id={groupId}
        className="fab-dial-actions record-dial"
        role="group"
        aria-label="What to record"
        hidden={!shown}
        onKeyDown={onColumnKey}
      >
        {rows.map((action) => (
          <button
            key={action.id}
            type="button"
            data-fab-action={action.mode}
            data-fab-kind={action.kind}
            className={`fab-dial-action record-dial__row tone-${action.mode}`}
            aria-label={action.aria}
            onClick={() => {
              setDial(false);
              // The row becomes hidden. Give the entry dialog a stable return
              // target before it captures the current focus.
              fabRef.current?.focus();
              if (action.mode === "bill") onBillPaid?.();
              else onPick(action.mode);
            }}
          >
            <DialIcon icon={action.icon} />
            <span className="record-dial__label">{action.label}</span>
          </button>
        ))}
      </div>
      <button
        ref={fabRef}
        className="fab record-bubble"
        type="button"
        aria-label={closedLabel}
        aria-haspopup="true"
        aria-expanded={shown}
        aria-controls={groupId}
        aria-describedby={descriptionId}
        onClick={() => setDial(!shown)}
      >
        {shown ? <span className="record-bubble__close" aria-hidden="true">×</span> : <RecordGlyph />}
        <span className="record-bubble__label">{closedLabel}</span>
      </button>
      <span id={descriptionId} className="record-bubble__description" hidden>{description}</span>
    </div>
  );
}
