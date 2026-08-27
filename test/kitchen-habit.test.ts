import { describe, expect, it } from "vitest";
import {
  applySitDown,
  catalogHousehold,
  centsDigitsFromDollars,
  dollarsFromCentsDigits,
  herculesIdle,
  herculesMutters,
  padToDollars,
  planHerculesTurn,
  postShift,
  shiftPostingStreak,
  tapCentsDigits,
  type Household,
} from "../src/core/index.ts";
import { MAX_HOURS_HUNDREDTHS } from "../src/core/cadPad.ts";

const today = "2026-08-21";
const afterShift = new Date("2026-08-21T18:30:00.000Z");
const morning = new Date("2026-08-21T14:00:00.000Z");

function logShift(household: Household, date: string): Household {
  return postShift(household, {
    date,
    memberId: "MEM-002",
    accountId: "ACC-CASH",
    sales: "100",
    cashTips: "10",
    ccTips: "5",
    hours: "4",
    confirmDuplicate: true,
  
    customersServed: 40,
    staffingCount: 4,
    eventTag: "regular",
  }).household;
}

describe("CAD cents pad", () => {
  it("types 1, 2, 5, 0 into $12.50 and leaves a blank pad blank", () => {
    const digits = ["1", "2", "5", "0"].reduce((current, key) => tapCentsDigits(current, key), "");
    expect(digits).toBe("1250");
    expect(dollarsFromCentsDigits(digits)).toBe("12.50");
    expect(centsDigitsFromDollars("12.50")).toBe("1250");
    expect(padToDollars("")).toBe("");
    expect(padToDollars("0")).toBe("");
    expect(tapCentsDigits("1", "00")).toBe("100");
    expect(tapCentsDigits("1250", "back")).toBe("125");
  });

  it("caps hours at 24.00 hundredths", () => {
    expect(tapCentsDigits("2400", "1", MAX_HOURS_HUNDREDTHS)).toBe("2400");
    expect(dollarsFromCentsDigits("400")).toBe("4.00");
  });
});

describe("shift posting streak", () => {
  it("walks consecutive posted shift dates from the latest shift, not from today", () => {
    let household = catalogHousehold();
    household = logShift(household, "2026-08-14");
    household = logShift(household, "2026-08-15");
    household = logShift(household, "2026-08-16");
    const monday = shiftPostingStreak(household, "2026-08-17");
    expect(monday.count).toBe(3);
    expect(monday.lastDate).toBe("2026-08-16");
    expect(monday.fresh).toBe(true);
    expect(monday.waiting).toBe(false);
    expect(monday.lesson).toMatch(/Vacation does not kill me/);
  });

  it("prompts when the latest shift is older than two days, and never guilt-kills", () => {
    let household = catalogHousehold();
    household = logShift(household, "2026-08-17");
    const streak = shiftPostingStreak(household, today);
    expect(streak.waiting).toBe(true);
    expect(streak.fresh).toBe(false);
    expect(`${streak.spoken} ${streak.lesson}`).not.toMatch(/broke|dead|died|hunger|you missed/i);
    expect(streak.lesson).toMatch(/will not fake a missed day/i);
  });
});

describe("Hercules kitchen habit", () => {
  it("jumps after a fresh streak and pounces when waiting after-shift", () => {
    let household = catalogHousehold();
    household = logShift(household, "2026-08-19");
    household = logShift(household, "2026-08-20");
    household = logShift(household, today);
    const jump = herculesIdle(household, "home", today, afterShift);
    expect(jump.topic).toBe("shift");
    expect(jump.pose).toBe("celebrate");
    expect(jump.replies).toContain("Log shift");

    let waiting = catalogHousehold();
    waiting = logShift(waiting, "2026-08-17");
    const pounce = herculesIdle(waiting, "home", today, afterShift);
    expect(pounce.pose).toBe("pounce");
    expect(herculesMutters(waiting, today, afterShift)).toBe(true);
    expect(herculesMutters(waiting, today, morning)).toBe(false);
  });

  it("opens Add for Log shift and never posts from sit-down", () => {
    const household = catalogHousehold();
    const plan = planHerculesTurn(household, "Log shift", today, "home");
    expect(plan.draft).toEqual({ kind: "shift", note: "" });
    expect(plan.talk.lesson).toMatch(/confirm still posts/i);
    const sit = applySitDown(household, "2026-07", {});
    expect(sit.postedIds).toEqual([]);
    expect(sit.household.transactions).toEqual(household.transactions);
  });
});
