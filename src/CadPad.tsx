import { useEffect, useId, useRef, useState } from "react";
import { PAD_KEYS, dollarsFromCentsDigits, parsePadDecimal, tapCentsDigits, type PadKey } from "./core/cadPad.ts";
import { formatCad } from "./core/money.ts";

export function CadPad({
  digits,
  onDigits,
  onInvalid,
  label,
  unit = "cad",
  maxCents,
  emptyDisplay,
  giant = false,
  onEnter,
  enterLabel = "Enter",
  enterDisabled = false,
}: {
  digits: string;
  onDigits: (next: string) => void;
  onInvalid?: (raw: string) => void;
  label: string;
  unit?: "cad" | "hours";
  maxCents?: number;
  emptyDisplay?: string;
  giant?: boolean;
  onEnter?: () => void;
  enterLabel?: string;
  enterDisabled?: boolean;
}) {
  const fieldId = useId();
  const [typing, setTyping] = useState(() => typeof window !== "undefined" && window.innerWidth >= 720);
  const [text, setText] = useState(() => digits ? dollarsFromCentsDigits(digits) : "");
  const lastEmitted = useRef(digits);
  const inputRef = useRef<HTMLInputElement>(null);
  const cap = maxCents ?? (unit === "hours" ? 2400 : 99_999_999);
  const cents = Number(digits || "0");
  const display = digits === "" && emptyDisplay
    ? emptyDisplay
    : unit === "hours"
      ? `${dollarsFromCentsDigits(digits)} h`
      : formatCad(cents);

  const parsed = parsePadDecimal(text, cap);
  // A30: Enter on an amount that is not above zero (or does not read) shows why, marks the field invalid and
  // moves focus to it; the message is linked by aria-describedby. Changing the amount clears it.
  const displayRef = useRef<HTMLParagraphElement>(null);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => { setBlocked(false); }, [digits, text]);
  const amountInvalid = Boolean(parsed.error) || (enterDisabled && cents <= 0);
  const invalidWords = parsed.error || (unit === "hours" ? "Enter hours above 0." : "Enter an amount above $0.00.");
  const showError = Boolean(parsed.error) || blocked;
  function enter() {
    if (!onEnter) return;
    if (amountInvalid) {
      setBlocked(true);
      requestAnimationFrame(() => (typing ? inputRef.current : displayRef.current)?.focus());
      return;
    }
    if (!enterDisabled) onEnter();
  }
  useEffect(() => {
    if (digits !== lastEmitted.current) {
      setText(digits ? dollarsFromCentsDigits(digits) : "");
      lastEmitted.current = digits;
    }
  }, [digits]);
  function changeText(value: string) {
    setText(value);
    const next = parsePadDecimal(value, cap).digits;
    lastEmitted.current = next;
    onDigits(next);
    if (parsePadDecimal(value, cap).error) onInvalid?.(value);
  }
  function tap(key: PadKey) {
    const next = tapCentsDigits(digits, key, cap);
    lastEmitted.current = next;
    setText(next ? dollarsFromCentsDigits(next) : "");
    onDigits(next);
  }

  return (
    <div className={`cad-pad${giant ? " is-giant" : ""}${typing ? " is-typing" : " is-touch"}`}>
      <label className="cad-pad-label" htmlFor={fieldId}>{label}{unit === "cad" ? " (CAD)" : " (hours)"}</label>
      <div hidden={!typing} className="cad-pad-typing">
        <input id={fieldId} ref={inputRef} type="text" inputMode="decimal" autoComplete="off" spellCheck={false}
          className="cad-pad-input" value={text} placeholder={emptyDisplay || "0.00"}
          aria-invalid={showError} aria-describedby={`${fieldId}-help${showError ? ` ${fieldId}-error` : ""}`}
          onChange={event => changeText(event.currentTarget.value)}
          onKeyDown={event => {
            if (event.key !== "Enter" || event.nativeEvent.isComposing || event.repeat || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
            event.preventDefault(); event.stopPropagation();
            enter();
          }} />
        <p id={`${fieldId}-help`} className="cad-pad-help">Type {unit === "hours" ? "hours" : "dollars"}, for example 12.50. Tab moves to the next control.</p>
        {typing && showError && <p id={`${fieldId}-error`} className="cad-pad-error" role="status">{invalidWords}</p>}
      </div>
      <p hidden={typing} ref={displayRef} tabIndex={-1} className="cad-pad-display" aria-live="polite"
        aria-describedby={!typing && showError ? `${fieldId}-error` : undefined} data-invalid={!typing && showError ? "" : undefined}>{display}</p>
      {!typing && showError && <p id={`${fieldId}-error`} className="cad-pad-error" role="status">{invalidWords}</p>}
      {!typing && <p className="cad-pad-help">Keypad enters {unit === "hours" ? "hundredths" : "cents"}: 1 2 5 0 = {unit === "hours" ? "12.50 h" : "$12.50"}.</p>}
      <div hidden={typing} className="cad-pad-keys">
        {PAD_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className={key === "back" ? "cad-pad-back" : ""}
            aria-label={key === "back" ? "Delete last digit" : key === "00" ? "Add 00" : key}
            onClick={() => tap(key)}
          >
            {key === "back" ? "⌫" : key}
          </button>
        ))}
      </div>
      <button type="button" className="cad-pad-mode" aria-pressed={typing} onClick={() => {
        setTyping(!typing);
        if (!typing) requestAnimationFrame(() => inputRef.current?.focus());
      }}>{typing ? "Use keypad" : "Type amount"}</button>
      {onEnter ? (
        <button
          type="button"
          className="primary post-big cad-pad-enter"
          aria-disabled={enterDisabled || amountInvalid ? true : undefined}
          onClick={enter}
        >
          {enterLabel}
        </button>
      ) : null}
    </div>
  );
}
