import { useEffect, useId, useRef, useState } from "react";
import type { FabAction, FabAddMode } from "./core/fabActions.ts";
import { fabActionsFor } from "./core/fabActions.ts";

export type { FabAddMode } from "./core/fabActions.ts";

/** My Money's direct four, in their known order. The household set comes from `fabActionsFor`. */
export const FAB_ADD_ACTIONS = fabActionsFor("personal", "home")
  .filter((action): action is Extract<FabAction, { kind: "add" }> => action.kind === "add")
  .map((action) => ({ mode: action.mode, label: action.label, aria: action.aria }));

/**
 * Vertical linear speed dial from the nav + . Actions open a flow; they never post.
 * `actions` adapts the verb set to the space and destination (Vision v2 §4.5);
 * `onGo` receives the non-money verbs that only navigate.
 */
export function FabSpeedDial({
  closed = false,
  actions,
  closedLabel = "Add money",
  onPick,
  onGo,
  onOpenChange,
}: {
  closed?: boolean;
  actions?: readonly FabAction[];
  closedLabel?: string;
  onPick: (mode: FabAddMode) => void;
  onGo?: (tab: Extract<FabAction, { kind: "go" }>["tab"]) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const rows: readonly FabAction[] = actions ?? fabActionsFor("personal", "home");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const fabRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();
  const shown = open && !closed;

  function setDial(next: boolean) {
    setOpen(next);
    onOpenChange?.(next);
  }

  useEffect(() => {
    if (!closed) return;
    setOpen(false);
    onOpenChange?.(false);
  }, [closed, onOpenChange]);

  useEffect(() => {
    if (!shown) return;
    const first = rootRef.current?.querySelector<HTMLButtonElement>("[data-fab-action]");
    first?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        setDial(false);
        fabRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [shown]);

  return (
    <div ref={rootRef} className={`fab-dial${shown ? " is-open" : ""}`} data-fab-dial={shown ? "open" : "closed"}>
      {shown ? (
        <button
          className="fab-dial-scrim"
          type="button"
          tabIndex={-1}
          aria-label="Close add menu"
          onClick={() => {
            setDial(false);
            fabRef.current?.focus();
          }}
        />
      ) : null}
      <ul
        id={menuId}
        className="fab-dial-actions"
        role="menu"
        aria-label="Add"
        hidden={!shown}
      >
        {rows.map((action) => (
          <li key={action.id} role="none">
            <button
              type="button"
              role="menuitem"
              data-fab-action={action.kind === "add" ? action.mode : action.id}
              data-fab-kind={action.kind}
              className={`fab-dial-action tone-${action.kind === "add" ? action.mode : "go"}`}
              aria-label={action.aria}
              onClick={() => {
                setDial(false);
                // The menu item becomes hidden. Give the entry dialog a stable
                // return target before it captures the current focus.
                fabRef.current?.focus();
                if (action.kind === "add") onPick(action.mode);
                else onGo?.(action.tab);
              }}
            >
              {action.label}
            </button>
          </li>
        ))}
      </ul>
      <button
        ref={fabRef}
        className="fab"
        type="button"
        aria-label={shown ? "Close add menu" : closedLabel}
        aria-haspopup="menu"
        aria-expanded={shown}
        aria-controls={menuId}
        onClick={() => setDial(!shown)}
      >
        {shown ? "×" : "+"}
      </button>
    </div>
  );
}
