import { describe, expect, it } from "vitest";
import {
  abandonOpenShift,
  activeOpenShift,
  clockOutShift,
  chooseOpenShiftTimeline,
  catalogHousehold,
  ceremonyFields,
  clockInShift,
  endShiftBreak,
  formatPreviewHours,
  mergeKitchen,
  openShiftConflicts,
  postShift,
  previewHoursExact,
  previewHoursQuarter,
  shapeKitchen,
  startShiftBreak,
  workedHoursFromOpenShift,
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
    expect(wiped.household.kitchen.openShifts[0]?.status).toBe("cleared");
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
    
      customersServed: 40,
      staffingCount: 4,
      eventTag: "regular",
    });
    expect(posted.postedIds.length).toBeGreaterThan(0);
    expect(activeOpenShift(posted.household.kitchen)).toBeNull();
    expect(posted.household.shifts.at(-1)?.hours).toBe(4);
  });

  it("lets two members clock independently and refuses a second clock-in for one member", () => {
    const left = clockInShift(catalogHousehold(), { memberId: "MEM-002" }).household;
    const both = clockInShift(left, { memberId: "MEM-001" }).household;
    expect(activeOpenShift(both.kitchen, "MEM-002")?.memberId).toBe("MEM-002");
    expect(activeOpenShift(both.kitchen, "MEM-001")?.memberId).toBe("MEM-001");
    expect(() => clockInShift(left, { memberId: "MEM-002" })).toThrow(ValidationError);
    expect(shapeKitchen({}).openShift).toBeNull();
  });

  it("tracks paid and unpaid breaks before clock-out review without posting money", () => {
    const first = clockInShift(catalogHousehold(), { memberId: "MEM-002" });
    const paid = startShiftBreak(first.household, { memberId: "MEM-002", kind: "paid" });
    expect(activeOpenShift(paid.household.kitchen, "MEM-002")?.breaks[0]?.kind).toBe("paid");
    const resumed = endShiftBreak(paid.household, { memberId: "MEM-002" });
    const out = clockOutShift(resumed.household, { memberId: "MEM-002" });
    const punch = activeOpenShift(out.household.kitchen, "MEM-002");
    expect(out.postedIds).toEqual([]);
    expect(out.household.transactions).toHaveLength(first.household.transactions.length);
    expect(punch?.status).toBe("confirming");
    expect(punch?.endedAt).not.toBeNull();
    expect(punch && workedHoursFromOpenShift(punch).elapsedHours).toBeGreaterThanOrEqual(0);
  });

  it("merges distinct device punches without hiding a same-worker conflict", () => {
    const server = clockInShift(catalogHousehold(), { memberId: "MEM-002", sourceDeviceId: "phone" }).household;
    const client = clockInShift(catalogHousehold(), { memberId: "MEM-002", sourceDeviceId: "laptop" }).household;
    const clientPunch = client.kitchen.openShifts[0]!;
    client.kitchen.openShifts[0] = { ...clientPunch, id: `${clientPunch.id}-LAPTOP` };
    const merged = mergeKitchen(server.kitchen, client.kitchen, []);
    expect(openShiftConflicts(merged, "MEM-002")).toHaveLength(2);
    const kept = openShiftConflicts(merged, "MEM-002")[0]!;
    const chosen = chooseOpenShiftTimeline({ ...server, kitchen: merged }, { memberId: "MEM-002", keepId: kept.id });
    expect(openShiftConflicts(chosen.household.kitchen, "MEM-002")).toEqual([kept]);
    expect(chosen.postedIds).toEqual([]);
  });
});
