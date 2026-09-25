import { useEffect, useId, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import type { ThemeId } from "../../theme/scenes.ts";
import { CloseIcon } from "../bubbles/icons.tsx";
import "./panels.css";

/**
 * A compact panel (brief §3.2, `SCALES` §4 tier 2): at most a third of the
 * screen, anchored above the dock, two or three likely actions, one "Open …"
 * and a **Step in**. A `dialog` that takes focus, contains it, and returns it
 * to whoever opened it on Escape or "Put it back".
 *
 * It reads what it is handed and calls what it is handed. It never imports a
 * command (A12); every write is an existing flow the integrator routes to.
 */
export type CompactPanelProps = {
  /** Which host, for styling and tests. */
  host: string;
  title: string;
  subtitle?: string;
  onClose: () => void;
  /** Step in: walk into the place. Absent → shown disabled with `stepInReason`. */
  onStepIn?: () => void;
  stepInReason?: string | null;
  /** Hide Step in entirely (Hercules's bubble has Visit instead). */
  noStepIn?: boolean;
  returnFocusTo?: HTMLElement | null;
  theme?: ThemeId;
  children: ReactNode;
  /** The panel's own buttons (Record, Mark paid, Open …). */
  actions?: ReactNode;
};

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function CompactPanel(props: CompactPanelProps) {
  const { host, title, subtitle, onClose } = props;
  const ref = useRef<HTMLDivElement | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const subId = useId();
  const reasonId = useId();

  useEffect(() => {
    opener.current = props.returnFocusTo ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const first = ref.current?.querySelector<HTMLElement>("[data-panel-first]") ?? ref.current;
    first?.focus();
    return () => { if (opener.current?.isConnected) opener.current.focus(); };
    // Mount-only: a panel is keyed by its host, so a new host is a new panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.stopPropagation(); onClose(); return; }
    if (event.key !== "Tab" || !ref.current) return;
    const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (items.length === 0) return;
    const first = items[0]!, last = items[items.length - 1]!;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === ref.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
  }

  const stepInDisabled = !props.onStepIn;
  return (
    <div
      ref={ref}
      className="compact-panel"
      data-compact-panel={host}
      data-glass-theme={props.theme}
      data-camera-deadzone="0"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={subtitle ? subId : undefined}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <header className="compact-panel__head">
        <div>
          <h2 id={titleId} className="compact-panel__title">{title}</h2>
          {subtitle && <p id={subId} className="compact-panel__subtitle">{subtitle}</p>}
        </div>
        <button type="button" className="compact-panel__close" data-panel-close="" onClick={onClose}>
          <CloseIcon /><span>Put it back</span>
        </button>
      </header>
      <div className="compact-panel__body">{props.children}</div>
      <footer className="compact-panel__actions">
        {props.actions}
        {!props.noStepIn && (
          <button
            type="button"
            className="compact-panel__step-in"
            data-panel-step-in=""
            aria-disabled={stepInDisabled ? true : undefined}
            aria-describedby={stepInDisabled ? reasonId : undefined}
            onClick={() => { if (!stepInDisabled) props.onStepIn?.(); }}
          >
            Step in
          </button>
        )}
        {!props.noStepIn && stepInDisabled && <span id={reasonId} className="compact-panel__reason">{props.stepInReason ?? "Step in needs the illustrated island"}</span>}
      </footer>
    </div>
  );
}
