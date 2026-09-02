import { useEffect, useRef } from "react";
import { PAD_KEYS, dollarsFromCentsDigits, tapCentsDigits, type PadKey } from "./core/cadPad.ts";
import { formatCad } from "./core/money.ts";

export function CadPad({
  digits,
  onDigits,
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
  label: string;
  unit?: "cad" | "hours";
  maxCents?: number;
  emptyDisplay?: string;
  giant?: boolean;
  onEnter?: () => void;
  enterLabel?: string;
  enterDisabled?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const cap = maxCents ?? (unit === "hours" ? 2400 : 99_999_999);
  const cents = Number(digits || "0");
  const display = digits === "" && emptyDisplay
    ? emptyDisplay
    : unit === "hours"
      ? `${dollarsFromCentsDigits(digits)} h`
      : formatCad(cents);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const block = (event: WheelEvent) => event.preventDefault();
    el.addEventListener("wheel", block, { passive: false });
    return () => el.removeEventListener("wheel", block);
  }, []);

  useEffect(() => {
    if (!onEnter) return;
    const submit = onEnter;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Enter" || event.repeat) return;
      const target = event.target;
      if (target instanceof Element && target.closest("button, a, input, textarea, select, [role='button'], [contenteditable='true']")) return;
      if (enterDisabled) return;
      event.preventDefault();
      submit();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onEnter, enterDisabled]);

  return (
    <div className={`cad-pad${giant ? " is-giant" : ""}`} ref={root}>
      <p className="cad-pad-label">{label}</p>
      <p className="cad-pad-display" aria-live="polite">{display}</p>
      <div className="cad-pad-keys">
        {PAD_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className={key === "back" ? "cad-pad-back" : ""}
            aria-label={key === "back" ? "Delete last digit" : key === "00" ? "Add 00" : key}
            onClick={() => onDigits(tapCentsDigits(digits, key as PadKey, cap))}
          >
            {key === "back" ? "⌫" : key}
          </button>
        ))}
      </div>
      {onEnter ? (
        <button
          type="button"
          className="primary post-big cad-pad-enter"
          disabled={enterDisabled}
          onClick={onEnter}
        >
          {enterLabel}
        </button>
      ) : null}
    </div>
  );
}
