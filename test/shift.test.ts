import { describe, expect, it } from "vitest";
import {
  calcShiftAmounts,
  DEFAULT_SHIFT_SETTINGS,
  normalizeShiftSettings,
  parseShiftInput,
  previewShiftAmounts,
  shiftSettingsFingerprint,
} from "../src/core/shift.ts";
import { ValidationError } from "../src/core/types.ts";

describe("shift calculation", () => {
  it("matches the verified cent-rounded household rules", () => {
    expect(calcShiftAmounts(
      { salesCents: 100000, cashTipsCents: 5000, ccTipsCents: 10000, hours: 4 },
      DEFAULT_SHIFT_SETTINGS,
    )).toEqual({
      floorTipOutCents: 6000,
      barTipOutCents: 1000,
      ccTipOutCents: 200,
      netTipsCents: 7800,
      wagesCents: 7040,
    });
  });

  it("keeps the negative net-tip behaviour on tiny sales", () => {
    expect(calcShiftAmounts(
      { salesCents: 101, cashTipsCents: 0, ccTipsCents: 0, hours: 0.25 },
      DEFAULT_SHIFT_SETTINGS,
    )).toEqual({
      floorTipOutCents: 6,
      barTipOutCents: 500,
      ccTipOutCents: 0,
      netTipsCents: -506,
      wagesCents: 440,
    });
  });

  it("changes fingerprint when wage rules change", () => {
    const original = shiftSettingsFingerprint(DEFAULT_SHIFT_SETTINGS);
    const changed = shiftSettingsFingerprint({ ...DEFAULT_SHIFT_SETTINGS, hourlyRateCents: 2000 });
    expect(original).not.toBe(changed);
  });

  it("refuses tip-out percents outside 0–100 and a zero hourly rate", () => {
    expect(() => normalizeShiftSettings({ ...DEFAULT_SHIFT_SETTINGS, floorPct: 101 })).toThrow(ValidationError);
    expect(() => normalizeShiftSettings({ ...DEFAULT_SHIFT_SETTINGS, floorPct: 101 })).toThrow(
      "Floor tip-out percentage must be between 0 and 100.",
    );
    expect(() => normalizeShiftSettings({ ...DEFAULT_SHIFT_SETTINGS, hourlyRateCents: 0 })).toThrow(
      "Hourly wage rate must be at least 0.01.",
    );
  });
});

describe("parseShiftInput", () => {
  const valid = {
    date: "2026-10-05",
    sales: "586.01",
    cashTips: "0",
    ccTips: "131.02",
    hours: "2.05",
    timeZone: "America/Toronto",
  };

  it("turns a kitchen form into integer cents on a real calendar day", () => {
    expect(parseShiftInput(valid)).toEqual({
      date: "2026-10-05",
      salesCents: 58601,
      cashTipsCents: 0,
      ccTipsCents: 13102,
      hours: 2.05,
    });
  });

  it("treats omitted sales and tips as zero, never as a missing required amount", () => {
    expect(parseShiftInput({ date: "2026-10-05", hours: "4" })).toEqual({
      date: "2026-10-05",
      salesCents: 0,
      cashTipsCents: 0,
      ccTipsCents: 0,
      hours: 4,
    });
  });

  it("rejects an impossible date, a fake zone, extra money decimals, and illegal hours", () => {
    expect(() => parseShiftInput({ ...valid, date: "2026-09-31" })).toThrow(ValidationError);
    expect(() => parseShiftInput({ ...valid, date: "2026-09-31" })).toThrow(
      "Date must be a valid calendar date in YYYY-MM-DD format.",
    );
    expect(() => parseShiftInput({ ...valid, date: "2025-02-29" })).toThrow(ValidationError);
    expect(() => parseShiftInput({ ...valid, timeZone: "Not/AZone" })).toThrow(
      "Timezone must be a valid IANA zone before adding a shift.",
    );
    expect(() => parseShiftInput({ ...valid, sales: "-1" })).toThrow("Sales cannot be negative.");
    expect(() => parseShiftInput({ ...valid, hours: "24.50" })).toThrow("Hours worked cannot exceed 24.");
    expect(() => parseShiftInput({ ...valid, hours: "" })).toThrow("Hours worked is required.");
  });
});

describe("previewShiftAmounts", () => {
  it("shows zeros when present settings are invalid, without throwing into the kitchen", () => {
    expect(
      previewShiftAmounts(
        { salesCents: 100000, cashTipsCents: 0, ccTipsCents: 0, hours: 4 },
        { ...DEFAULT_SHIFT_SETTINGS, floorPct: Number.NaN },
      ),
    ).toEqual({
      floorTipOutCents: 0,
      barTipOutCents: 0,
      ccTipOutCents: 0,
      netTipsCents: 0,
      wagesCents: 0,
    });
  });
});
