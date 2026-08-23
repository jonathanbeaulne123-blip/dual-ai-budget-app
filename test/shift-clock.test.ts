import { describe, expect, it } from "vitest";
import {
  abandonOpenShift,
  activeOpenShift,
  catalogHousehold,
  ceremonyFields,
  clockInShift,
  formatPreviewHours,
  mergeKitchen,
  postShift,
  previewHoursExact,
  previewHoursQuarter,
  shapeKitchen,
} from "../src/core/index.ts";
import { ValidationError } from "../src/core/types.ts";

describe("shift punch clock", () => {
  it("clocks in without posting wages or tips", () => {
    const household = catalogHousehold();
    const before = household.transactions.length;
    const punched = clockInShift(household, { memberId: "MEM-002" });
    expect(punched.postedIds).toEqual([]);
    expect(punched.household.transactions).toHaveLength(before);
    expect(punched.household.shifts).toHaveLength(household.shifts.length);
    const punch = activeOpenShift(punched.household.kitchen);
    expect(punch?.memberId).toBe("MEM-002");
    expect(punch?.status).toBe("open");
  });

  it("keeps hours as a live preview until sign-out Confirm", () => {
    const started = new Date("2026-08-21T16:00:00.000Z").toISOString();
    const fourHoursLater = Date.parse(started) + 4 * 3_600_000;
    expect(previewHoursExact(started, fourHoursLater)).toBe(4);
    expect(previewHoursQuarter(started, fourHoursLater + 8 * 60_000)).toBe(4.25);
    expect(formatPreviewHours(4.25)).toBe("4.25");
    expect(ceremonyFields("signOut")[0]).toBe("hours");
    expect(ceremonyFields("finished")[3]).toBe("hours");
    expect(ceremonyFields("choose")).toEqual([]);
  });

  it("abandoning a punch is not a reverse", () => {
    const household = clockInShift(catalogHousehold(), { memberId: "MEM-002" }).household;
    const wiped = abandonOpenShift(household);
    expect(wiped.postedIds).toEqual([]);
    expect(activeOpenShift(wiped.household.kitchen)).toBeNull();
    expect(wiped.household.kitchen.openShift?.status).toBe("cleared");
  });

  it("postShift still does the money math and clears the matching punch", () => {
    const clocked = clockInShift(catalogHousehold(), { memberId: "MEM-002" }).household;
    const posted = postShift(clocked, {
      date: "2026-08-21",
      memberId: "MEM-002",
      accountId: "ACC-CASH",
      sales: "100",
      cashTips: "10",
      ccTips: "5",
      hours: "4",
      confirmDuplicate: true,
    });
    expect(posted.postedIds.length).toBeGreaterThan(0);
    expect(activeOpenShift(posted.household.kitchen)).toBeNull();
    expect(posted.household.shifts.at(-1)?.hours).toBe(4);
  });

  it("merges the open punch last-write-wins and refuses a second clock-in for the same member", () => {
    const left = clockInShift(catalogHousehold(), { memberId: "MEM-002" }).household;
    const right = clockInShift(catalogHousehold(), { memberId: "MEM-001" }).household;
    right.kitchen.openShift = {
      ...right.kitchen.openShift!,
      updatedAt: "2099-01-01T00:00:00.000Z",
    };
    const merged = mergeKitchen(left.kitchen, right.kitchen, []);
    expect(merged.openShift?.memberId).toBe("MEM-001");
    expect(() => clockInShift(left, { memberId: "MEM-002" })).toThrow(ValidationError);
    expect(shapeKitchen({}).openShift).toBeNull();
  });
});
