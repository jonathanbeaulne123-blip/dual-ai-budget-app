import { useEffect, useId, useRef, useState } from "react";

export const FAB_ADD_ACTIONS = [
  { mode: "shift", label: "Shift", aria: "Add shift" },
  { mode: "income", label: "Income", aria: "Add income" },
  { mode: "expense", label: "Expense", aria: "Add expense" },
  { mode: "transfer", label: "Transfer", aria: "Add transfer" },
] as const;

export type FabAddMode = (typeof FAB_ADD_ACTIONS)[number]["mode"];

/** Vertical linear speed dial from the nav + . Actions open Add; they never post. */
export function FabSpeedDial({
  closed = false,
  onPick,
  onOpenChange,
}: {
  closed?: boolean;
  onPick: (mode: FabAddMode) => void;
  onOpenChange?: (open: boolean) => void;
}) {
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
        {FAB_ADD_ACTIONS.map((action) => (
          <li key={action.mode} role="none">
            <button
              type="button"
              role="menuitem"
              data-fab-action={action.mode}
              className={`fab-dial-action tone-${action.mode}`}
              aria-label={action.aria}
              onClick={() => {
                setDial(false);
                onPick(action.mode);
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
        aria-label={shown ? "Close add menu" : "Add money"}
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
