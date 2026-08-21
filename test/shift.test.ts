import { describe, expect, it } from "vitest";
import { calcShiftAmounts, shiftSettingsFingerprint } from "../src/core/shift.ts";
import { DEFAULT_SHIFT_SETTINGS } from "../src/core/shift.ts";

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
});
