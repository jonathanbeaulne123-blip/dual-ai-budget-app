export const CURRENCY = "CAD" as const;
export type Currency = typeof CURRENCY;

const MAX_CENTS = 9007199254740991;

export function roundToCents(dollars: number): number {
  const scaled = dollars * 100;
  const rounded = scaled < 0 ? -Math.round(-scaled + 1e-9) : Math.round(scaled + 1e-9);
  return rounded;
}

export function dollarsToCents(dollars: number): number {
  return roundToCents(dollars);
}

export function centsToDollars(cents: number): number {
  return cents / 100;
}

export function parseWholeCents(
  value: string | number,
  label: string,
  options: { allowZero?: boolean; allowNegative?: boolean; max?: number } = {},
): number {
  if (value === "" || value === null || value === undefined) {
    throw new Error(`${label} is required.`);
  }
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error(`${label} must be a number.`);
  }
  const text = typeof value === "string" ? value.trim() : String(value);
  if (!/^-?(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(text)) {
    throw new Error(`${label} must use no more than two decimal places.`);
  }
  const number = Number(text);
  if (!Number.isFinite(number)) throw new Error(`${label} must be a number.`);
  if (!options.allowNegative && number < 0) throw new Error(`${label} cannot be negative.`);
  if (!options.allowZero && number === 0) throw new Error(`${label} must be greater than zero.`);
  if (options.max !== undefined && number > options.max) throw new Error(`${label} cannot exceed ${options.max}.`);
  const cents = roundToCents(number);
  if (Math.abs(number * 100 - cents) > 0.0000001) {
    throw new Error(`${label} must use no more than two decimal places.`);
  }
  if (Math.abs(cents) > MAX_CENTS) throw new Error(`${label} is too large to represent safely in cents.`);
  return cents;
}

export function parseHours(value: string | number): number {
  if (value === "" || value === null || value === undefined) throw new Error("Hours worked is required.");
  const text = typeof value === "string" ? value.trim() : String(value);
  if (!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(text)) {
    throw new Error("Hours worked must use no more than two decimal places.");
  }
  const hours = Number(text);
  if (!Number.isFinite(hours) || hours <= 0) throw new Error("Hours worked must be greater than zero.");
  if (hours > 24) throw new Error("Hours worked cannot exceed 24.");
  return Math.round(hours * 100) / 100;
}

export function formatCad(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

export function formatCadCompact(cents: number): string {
  const abs = Math.abs(cents);
  if (abs >= 1000000) return `${cents < 0 ? "-" : ""}$${(abs / 100000).toFixed(1)}k`;
  return formatCad(cents);
}

export function sumCents(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
