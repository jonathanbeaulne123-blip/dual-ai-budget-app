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
          aria-invalid={!!parsed.error} aria-describedby={`${fieldId}-help${parsed.error ? ` ${fieldId}-error` : ""}`}
          onChange={event => changeText(event.currentTarget.value)}
          onKeyDown={event => {
            if (event.key !== "Enter" || event.nativeEvent.isComposing || event.repeat || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
            event.preventDefault(); event.stopPropagation();
            if (!enterDisabled && !parsed.error && onEnter) onEnter();
          }} />
        <p id={`${fieldId}-help`} className="cad-pad-help">Type {unit === "hours" ? "hours" : "dollars"}, for example 12.50. Tab moves to the next control.</p>
        {parsed.error && <p id={`${fieldId}-error`} className="cad-pad-error" role="status">{parsed.error}</p>}
      </div>
      <p hidden={typing} className="cad-pad-display" aria-live="polite">{display}</p>
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
          disabled={enterDisabled || !!parsed.error}
          onClick={onEnter}
        >
          {enterLabel}
        </button>
      ) : null}
    </div>
  );
}
