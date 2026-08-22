/** Cash App–style cents buffer. Typing 1, 2, 5, 0 → $12.50. No floating zeros, no mouse-wheel CAD. */

export const PAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "back"] as const;
export type PadKey = (typeof PAD_KEYS)[number];

export function dollarsFromCentsDigits(digits: string): string {
  const cents = Number((digits || "0").replace(/\D/g, "") || "0");
  if (!Number.isFinite(cents) || cents < 0) return "0.00";
  return (cents / 100).toFixed(2);
}

export function centsDigitsFromDollars(value: string): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const cents = Math.round(Number(text) * 100);
  if (!Number.isFinite(cents) || cents <= 0) return "";
  return String(cents);
}

/** Empty pad stays empty so Confirm still refuses a blank amount. Zero is not a post. */
export function padToDollars(digits: string): string {
  const n = Number((digits || "0").replace(/\D/g, "") || "0");
  if (!Number.isFinite(n) || n <= 0) return "";
  return dollarsFromCentsDigits(String(n));
}

export function tapCentsDigits(digits: string, key: string, maxCents = 99_999_999): string {
  const current = (digits || "").replace(/\D/g, "");
  if (key === "back") return current.slice(0, -1);
  if (key === "00") {
    const next = `${current || "0"}00`.replace(/^0+(\d)/, "$1");
    const n = Number(next);
    return !Number.isFinite(n) || n > maxCents ? current : String(n);
  }
  if (!/^\d$/.test(key)) return current;
  const next = `${current === "0" ? "" : current}${key}`;
  const n = Number(next || "0");
  return !Number.isFinite(n) || n > maxCents ? current : String(n);
}

/** Hours use the same hundredths buffer. 400 → 4.00. Cap 24.00. */
export const MAX_HOURS_HUNDREDTHS = 2400;

export function hoursFromDigits(digits: string): string {
  return dollarsFromCentsDigits(digits);
}
