import { parseHours, parseWholeCents, roundToCents } from "./money.ts";
import { isValidDateKey, isValidIanaTimeZone } from "./calendar.ts";
import type { ShiftSettings } from "./types.ts";
import { ValidationError } from "./types.ts";

export const DEFAULT_SHIFT_SETTINGS: ShiftSettings = {
  floorPct: 6,
  barPct: 1,
  barRoundCents: 500,
  ccPct: 2,
  hourlyRateCents: 1760,
};

export function normalizeShiftSettings(settings: ShiftSettings): ShiftSettings {
  if (!settings || typeof settings !== "object") throw new ValidationError("Tip Tracker settings are unavailable.");
  const number = (value: number, label: string, min: number, max: number | null, wholeCents: boolean): number => {
    if (!Number.isFinite(value) || value < min || (max !== null && value > max)) {
      throw new ValidationError(
        max === null ? `${label} must be at least ${min}.` : `${label} must be between ${min} and ${max}.`,
      );
    }
    if (wholeCents && Math.abs(value * 100 - Math.round(value * 100)) > 0.0000001) {
      throw new ValidationError(`${label} must use no more than two decimal places.`);
    }
    return wholeCents ? Math.round(value * 100) / 100 : value;
  };
  return {
    floorPct: number(settings.floorPct, "Floor tip-out percentage", 0, 100, false),
    barPct: number(settings.barPct, "Bar tip-out percentage", 0, 100, false),
    barRoundCents: Math.round(number(settings.barRoundCents / 100, "Bar tip-out rounding", 0, null, true) * 100),
    ccPct: number(settings.ccPct, "Credit-card tip-out percentage", 0, 100, false),
    hourlyRateCents: Math.round(number(settings.hourlyRateCents / 100, "Hourly wage rate", 0.01, null, true) * 100),
  };
}

export function shiftSettingsFingerprint(settings: ShiftSettings): string {
  const normalized = normalizeShiftSettings(settings);
  return ["v1-cent-rounded", normalized.floorPct, normalized.barPct, normalized.barRoundCents, normalized.ccPct, normalized.hourlyRateCents].join("|");
}

export function calcShiftAmounts(
  input: { salesCents: number; cashTipsCents: number; ccTipsCents: number; hours: number },
  settings: ShiftSettings,
): {
  floorTipOutCents: number;
  barTipOutCents: number;
  ccTipOutCents: number;
  netTipsCents: number;
  wagesCents: number;
} {
  const normalized = normalizeShiftSettings(settings);
  const sales = input.salesCents / 100;
  const cashTips = input.cashTipsCents / 100;
  const ccTips = input.ccTipsCents / 100;
  const floorTipOut = roundToCents(sales * normalized.floorPct / 100);
  const barRaw = sales * normalized.barPct / 100;
  const barRoundDollars = normalized.barRoundCents / 100;
  const barTipOut = barRoundDollars > 0 && barRaw > 0
    ? roundToCents(Math.ceil((barRaw - 1e-9) / barRoundDollars) * barRoundDollars)
    : roundToCents(barRaw);
  const ccTipOut = roundToCents(ccTips * normalized.ccPct / 100);
  return {
    floorTipOutCents: floorTipOut,
    barTipOutCents: barTipOut,
    ccTipOutCents: ccTipOut,
    netTipsCents: roundToCents(cashTips + ccTips - floorTipOut / 100 - barTipOut / 100 - ccTipOut / 100),
    wagesCents: roundToCents(input.hours * (normalized.hourlyRateCents / 100)),
  };
}

export function parseShiftInput(form: {
  date: string;
  sales?: string | number;
  cashTips?: string | number;
  ccTips?: string | number;
  hours: string | number;
  timeZone?: string;
}): { date: string; salesCents: number; cashTipsCents: number; ccTipsCents: number; hours: number } {
  if (!isValidDateKey(form.date)) throw new ValidationError("Date must be a valid calendar date in YYYY-MM-DD format.");
  if (form.timeZone && !isValidIanaTimeZone(form.timeZone)) {
    throw new ValidationError("Timezone must be a valid IANA zone before adding a shift.");
  }
  return {
    date: form.date.trim(),
    salesCents: parseWholeCents(form.sales ?? 0, "Sales", { allowZero: true }),
    cashTipsCents: parseWholeCents(form.cashTips ?? 0, "Cash tips", { allowZero: true }),
    ccTipsCents: parseWholeCents(form.ccTips ?? 0, "Credit-card tips", { allowZero: true }),
    hours: parseHours(form.hours),
  };
}
