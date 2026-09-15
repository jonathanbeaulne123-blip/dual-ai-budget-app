import { describe, expect, it } from "vitest";
import { catalogHousehold, stampWeeklyDocument } from "../src/core/index.ts";
import { closeBooksMonth } from "../src/core/commands.ts";
import { pathLand } from "../src/core/pathLand.ts";
import type { Household } from "../src/core/types.ts";

const B = "MEM-001", J = "MEM-002";
const TODAY = "2026-09-15";
const stamp = (h: Household, memberId: string, today: string) => stampWeeklyDocument(h, { memberId, today, now: `${today}T16:00:00.000Z` }).household;

describe("Our Path permanent land (closed months and weekly stamps)", () => {
  it("never throws on an empty household and has no land", () => {
    expect(pathLand(catalogHousehold(), TODAY)).toEqual({});
  });

  it("reads a closed month as permanent land and leaves quiet months absent", () => {
    const h = closeBooksMonth(catalogHousehold(), { monthKey: "2026-07", createdBy: B }).household;
    const land = pathLand(h, TODAY);
    expect(Object.keys(land)).toEqual(["2026-07"]);
    expect(land["2026-07"]).toMatchObject({ key: "2026-07", closed: true, stampedWeeks: [], stampShape: 0, why: "Books closed" });
    expect(land["2026-07"]!.closedAt).toBe(h.kitchen.books.closedMonths[0]!.closedAt);
    expect(land["2026-06"]).toBeUndefined();
  });

  it("lights one lamp per stamped week, in the month the week names", () => {
    let h = catalogHousehold();
    h = stamp(h, B, "2026-09-02"); // week of Sunday 2026-08-30: an August lamp
    h = stamp(h, B, "2026-09-08"); // week of 2026-09-06
    h = stamp(h, J, "2026-09-15"); // week of 2026-09-13
    h = stamp(h, B, "2026-09-16"); // same week, second member: still one lamp
    const land = pathLand(h, "2026-09-16");
    expect(land["2026-09"]).toMatchObject({ closed: false, closedAt: null, stampedWeeks: ["2026-09-06", "2026-09-13"], stampShape: 0.5, why: "Stamped 2 of 4 weeks" });
    expect(land["2026-08"]).toMatchObject({ stampedWeeks: ["2026-08-30"], stampShape: 0.2, why: "Stamped 1 of 5 weeks" });
    expect(land["2026-07"]).toBeUndefined();
    const closed = pathLand(closeBooksMonth(h, { monthKey: "2026-08", createdBy: J }).household, "2026-09-16");
    expect(closed["2026-08"]).toMatchObject({ closed: true, why: "Books closed · Stamped 1 of 5 weeks" });
  });

  it("ignores stamps from unknown members and malformed closes", () => {
    const h = catalogHousehold();
    const odd: Household = {
      ...h,
      weeklyDocumentStamps: [{ id: "WSTAMP-X", weekStart: "2026-09-06", memberId: "MEM-NOBODY", stampedAt: "2026-09-07T12:00:00.000Z", createdAt: "2026-09-07T12:00:00.000Z", updatedAt: "2026-09-07T12:00:00.000Z" }],
      kitchen: { ...h.kitchen, books: { ...h.kitchen.books, closedMonths: [{ id: "CLOSE-bad", monthKey: "not-a-month", closedAt: "2026-09-01T00:00:00.000Z", closedBy: B }] } },
    };
    expect(pathLand(odd, TODAY)).toEqual({});
  });
});
