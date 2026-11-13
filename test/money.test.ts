import { describe, expect, it } from "vitest";
import {
  centsToDollars,
  dollarsToCents,
  formatCad,
  formatCadGrouped,
  parseHours,
  parseWholeCents,
  roundToCents,
  sumCents,
} from "../src/core/money.ts";

describe("roundToCents", () => {
  it("stores dollars as integer cents", () => {
    expect(roundToCents(10)).toBe(1000);
    expect(roundToCents(0)).toBe(0);
    expect(roundToCents(-12.34)).toBe(-1234);
    expect(dollarsToCents(1.15)).toBe(115);
    expect(centsToDollars(115)).toBe(1.15);
  });

  it("rounds binary-float dollars the way a two-decimal CAD figure must", () => {
    // 1.005 and 2.675 are the classic IEEE traps: without the +1e-9 nudge they land a cent low.
    expect(roundToCents(1.005)).toBe(101);
    expect(roundToCents(2.675)).toBe(268);
    expect(roundToCents(-1.005)).toBe(-101);
    expect(roundToCents(-2.675)).toBe(-268);
  });
});

describe("parseWholeCents", () => {
  it("accepts trimmed dollars and at most two decimal places", () => {
    expect(parseWholeCents("12.50", "Amount")).toBe(1250);
    expect(parseWholeCents(" 8 ", "Amount")).toBe(800);
    expect(parseWholeCents(".5", "Amount")).toBe(50);
    expect(parseWholeCents(20, "Amount")).toBe(2000);
  });

  it("allows zero or negative only when asked", () => {
    expect(parseWholeCents("0", "Sales", { allowZero: true })).toBe(0);
    expect(parseWholeCents("-4.10", "Adjustment", { allowNegative: true })).toBe(-410);
    expect(() => parseWholeCents("0", "Amount")).toThrow("Amount must be greater than zero.");
    expect(() => parseWholeCents("-1", "Amount")).toThrow("Amount cannot be negative.");
  });

  it("rejects blank, non-numeric, extra decimals, a cap, and an unsafe magnitude", () => {
    expect(() => parseWholeCents("", "Amount")).toThrow("Amount is required.");
    expect(() => parseWholeCents("12.345", "Amount")).toThrow("Amount must use no more than two decimal places.");
    expect(() => parseWholeCents("1.005", "Amount")).toThrow("Amount must use no more than two decimal places.");
    expect(() => parseWholeCents("abc", "Amount")).toThrow("Amount must use no more than two decimal places.");
    expect(() => parseWholeCents("50", "Amount", { max: 40 })).toThrow("Amount cannot exceed 40.");
    expect(() => parseWholeCents("90071992547410", "Amount")).toThrow(
      "Amount is too large to represent safely in cents.",
    );
  });
});

describe("parseHours", () => {
  it("keeps two-decimal hours and refuses empty, zero, over-24, and extra decimals", () => {
    expect(parseHours("4")).toBe(4);
    expect(parseHours("0.25")).toBe(0.25);
    expect(parseHours(8.5)).toBe(8.5);
    expect(() => parseHours("")).toThrow("Hours worked is required.");
    expect(() => parseHours("0")).toThrow("Hours worked must be greater than zero.");
    expect(() => parseHours("24.01")).toThrow("Hours worked cannot exceed 24.");
    expect(() => parseHours("2.005")).toThrow("Hours worked must use no more than two decimal places.");
  });
});

describe("CAD display", () => {
  it("prints a signed two-decimal dollar figure", () => {
    expect(formatCad(1250)).toBe("$12.50");
    expect(formatCad(0)).toBe("$0.00");
    expect(formatCad(-100)).toBe("-$1.00");
  });

  it("groups thousands the way the Horizon Clock and money panels print a figure", () => {
    expect(formatCadGrouped(0)).toBe("$0.00");
    expect(formatCadGrouped(999)).toBe("$9.99");
    expect(formatCadGrouped(100_000)).toBe("$1,000.00");
    expect(formatCadGrouped(471_680)).toBe("$4,716.80");
    expect(formatCadGrouped(-12_345_678)).toBe("-$123,456.78");
  });

  it("sums cents without converting through dollars", () => {
    expect(sumCents([100, -40, 7])).toBe(67);
    expect(sumCents([])).toBe(0);
  });
});
