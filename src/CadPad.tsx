import { useEffect, useRef } from "react";
import { PAD_KEYS, dollarsFromCentsDigits, tapCentsDigits, type PadKey } from "./core/cadPad.ts";
import { formatCad } from "./core/money.ts";

export function CadPad({
  digits,
  onDigits,
  label,
  unit = "cad",
  maxCents,
}: {
  digits: string;
  onDigits: (next: string) => void;
  label: string;
  unit?: "cad" | "hours";
  maxCents?: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  const cap = maxCents ?? (unit === "hours" ? 2400 : 99_999_999);
  const cents = Number(digits || "0");
  const display = unit === "hours"
    ? `${dollarsFromCentsDigits(digits)} h`
    : formatCad(cents);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const block = (event: WheelEvent) => event.preventDefault();
    el.addEventListener("wheel", block, { passive: false });
    return () => el.removeEventListener("wheel", block);
  }, []);

  return (
    <div className="cad-pad" ref={root}>
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
    </div>
  );
}
