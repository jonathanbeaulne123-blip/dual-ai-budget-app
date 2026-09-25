import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import type { ThemeId } from "../../theme/scenes.ts";
import { glassMode, labelAtRest, useGlassEnvironment, type GlassEnvironment } from "./glassMode.ts";
import { countUse, readUsedCount } from "./usage.ts";
import "./bubbles.css";

/**
 * A glass bubble (brief §4.1): a 56 px circle (48 on desktop) with a 24 px
 * stroke icon, and its word on a glass pill below the circle — outside it,
 * never clipped, growing with the text size.
 *
 * - **Anchored by the viewport**, never by the card (`placement="fixed"`):
 *   Record right 16 / above the dock, All tools left 16 / above the dock,
 *   Simple view right 16 / top 100. `--dock-height` sets "above the dock".
 *   Each wrapper carries `data-camera-deadzone="44"`: the orbit controller
 *   ignores a gesture that starts within 44 px of it (see `deadzone.ts`).
 * - **The label rule** (§4.2): the pill shows until this person has used the
 *   bubble five times; then the bubble is icon-only and the word comes back
 *   on long-press (350 ms), keyboard focus and hover, dismissible with Escape.
 *   The accessible name is the word throughout. A long press never activates.
 * - **Solid** under reduced transparency / motion, more contrast, forced
 *   colours, Save-Data, calm, lite, or a missed frame budget; blur is off
 *   while the camera moves and back 120 ms after it stops.
 * - **Disabled** is `aria-disabled` (still focusable) with the reason in
 *   `aria-describedby`, shown on focus, hover and on activation.
 *
 * It opens things; it never posts, and it imports nothing that could.
 */
export type BubbleKind = "record" | "tools" | "flip";
export type Writer = Pick<Storage, "getItem" | "setItem">;

export type BubbleProps = {
  kind: BubbleKind;
  /** The visible word, and the start of the accessible name. */
  label: string;
  icon: ReactNode;
  onActivate?: () => void;
  /** `fixed`: anchored to the viewport by kind. `inline`: laid out by a bar. */
  placement?: "fixed" | "inline";
  /** Whose count the label rule reads (`hearth:atlas:used:<memberId>:<kind>`). */
  memberId?: string | null;
  /** Overrides the stored count (tests, or an integrator that keeps its own). */
  usedCount?: number;
  alwaysShowLabels?: boolean;
  calm?: boolean;
  lite?: boolean;
  frameOverBudget?: boolean;
  cameraMoving?: boolean;
  theme?: ThemeId;
  night?: boolean;
  /** Present → `aria-disabled`, and these words are the reason. */
  disabledReason?: string | null;
  expanded?: boolean;
  haspopup?: "dialog" | "menu" | "true";
  /** Extra description (e.g. the dial's "Purchase, shift, income, bill paid, or move money"). */
  description?: string;
  /** The Record accent: an opaque disc with a paper ring. */
  accent?: boolean;
  /** Replaces the button with the given control (the Record dial); the pill still shows. */
  children?: ReactNode;
  /** Injected storage (tests). */
  storage?: Writer;
  /** Injected environment (tests); defaults to the browser's. */
  environment?: GlassEnvironment;
  /** Extra data attributes on the button, e.g. `{ "data-glass-flip": "island" }`. */
  data?: Record<string, string>;
};

export const LONG_PRESS_MS = 350;
export const BLUR_RESTORE_MS = 120;
export const DEAD_MARGIN_PX = 44;

export function Bubble(props: BubbleProps) {
  const { kind, label, icon, placement = "fixed", memberId = null, accent = kind === "record", disabledReason = null } = props;
  const browser = useGlassEnvironment();
  const env = props.environment ?? browser;
  const tipId = useId();
  const reasonId = useId();
  const descId = useId();
  const [stored, setStored] = useState(() => readUsedCount(memberId, kind, props.storage));
  useEffect(() => { setStored(readUsedCount(memberId, kind, props.storage)); }, [memberId, kind, props.storage]);
  const used = props.usedCount ?? stored;
  const pill = labelAtRest({ usedCount: used, alwaysShowLabels: props.alwaysShowLabels, calm: props.calm, env });
  const [tip, setTip] = useState(false);
  const [toast, setToast] = useState(false);
  const pressedAt = useRef<number | null>(null);
  const longPressed = useRef(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Blur is skipped while the camera moves and restored 120 ms after it stops.
  const [blurOff, setBlurOff] = useState(Boolean(props.cameraMoving));
  useEffect(() => {
    if (props.cameraMoving) { setBlurOff(true); return; }
    const timer = setTimeout(() => setBlurOff(false), BLUR_RESTORE_MS);
    return () => clearTimeout(timer);
  }, [props.cameraMoving]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(false), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => () => { if (pressTimer.current) clearTimeout(pressTimer.current); }, []);

  const mode = glassMode(env, { calm: props.calm, lite: props.lite, frameOverBudget: props.frameOverBudget });
  const disabled = Boolean(disabledReason);

  function onPointerDown() {
    pressedAt.current = Date.now();
    longPressed.current = false;
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => { longPressed.current = true; setTip(true); }, LONG_PRESS_MS);
  }
  function endPress() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
    if (pressedAt.current !== null && Date.now() - pressedAt.current >= LONG_PRESS_MS) longPressed.current = true;
    pressedAt.current = null;
  }
  /** Capture: a long press shows the word and never activates, whatever control sits inside. */
  function onClickCapture(event: ReactMouseEvent) {
    if (longPressed.current) {
      longPressed.current = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (disabled) {
      event.preventDefault();
      event.stopPropagation();
      setToast(true);
      return;
    }
    if (props.children) {
      // The dial counts as used when its own button opens it.
      const target = event.target as Element | null;
      if (target?.closest?.(".fab")) setStored(countUse(memberId, kind, props.storage));
    }
  }
  function activate() {
    if (disabled) { setToast(true); return; }
    setStored(countUse(memberId, kind, props.storage));
    props.onActivate?.();
  }
  function onKeyDown(event: ReactKeyboardEvent) {
    if (event.key === "Escape" && tip && !pill) { setTip(false); }
  }

  const describedBy = [disabled ? reasonId : null, props.description ? descId : null].filter(Boolean).join(" ") || undefined;
  const labelClass = `glass-bubble__label${pill ? "" : " glass-bubble__label--tip"}`;

  return (
    <div
      className={`glass-bubble-anchor glass-bubble-anchor--${kind}${placement === "fixed" ? " is-fixed" : " is-inline"}${mode === "solid" ? " is-solid" : ""}${blurOff ? " is-blur-off" : ""}${accent ? " is-accent" : ""}${disabled ? " is-disabled" : ""}`}
      data-glass-bubble={kind}
      data-glass={mode}
      data-glass-blur={blurOff || mode === "solid" ? "off" : "on"}
      data-glass-label={pill ? "pill" : "tip"}
      data-glass-tip={tip ? "on" : undefined}
      data-glass-theme={props.theme}
      data-glass-night={props.night ? "" : undefined}
      data-glass-calm={props.calm ? "" : undefined}
      data-camera-deadzone={String(DEAD_MARGIN_PX)}
      onPointerDown={onPointerDown}
      onPointerUp={endPress}
      onPointerCancel={endPress}
      onPointerLeave={() => { endPress(); setTip(false); }}
      onPointerEnter={() => setTip(true)}
      onFocus={() => setTip(true)}
      onBlur={() => setTip(false)}
      onClickCapture={onClickCapture}
      onKeyDown={onKeyDown}
      onContextMenu={(event) => { if (longPressed.current) event.preventDefault(); }}
    >
      {props.children ? (
        <>
          <div className="glass-bubble glass-bubble--host">{props.children}</div>
          <span className={labelClass} aria-hidden="true" id={tipId}>{label}</span>
        </>
      ) : (
        <button
          type="button"
          className="glass-bubble"
          aria-disabled={disabled ? true : undefined}
          aria-describedby={describedBy}
          aria-expanded={props.expanded}
          aria-haspopup={props.haspopup}
          onClick={activate}
          {...props.data}
        >
          <span className="glass-bubble__icon">{icon}</span>
          <span className={labelClass} id={tipId}>{label}</span>
        </button>
      )}
      {props.description && <span className="glass-bubble__sr" id={descId} hidden>{props.description}</span>}
      {disabled && <span className="glass-bubble__reason" id={reasonId} data-glass-reason={tip || toast ? "shown" : undefined}>{disabledReason}</span>}
      {disabled && <span className="glass-bubble__toast" role="status">{toast ? disabledReason : ""}</span>}
    </div>
  );
}
