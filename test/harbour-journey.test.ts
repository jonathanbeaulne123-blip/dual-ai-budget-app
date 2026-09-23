import { describe, expect, it } from "vitest";
import { openChapter } from "../src/core/chapters.ts";
import { catalogHousehold } from "../src/core/index.ts";
import { entersHarbourFromJourneyZoom, harbourJourneyAnchor, isHarbourJourneyMonth } from "../src/path/harbourJourney.ts";

describe("the Journey Harbour anchor", () => {
  it("uses an open Chapter's intended month rather than its opened date", () => {
    const household = openChapter(catalogHousehold(), { memberId: "MEM-001", foundationId: "make-rent-boring", at: "2026-08-29T12:00:00.000Z", intendedMonth: "2026-09" }).household;
    const anchor = harbourJourneyAnchor(household, "2026-08-29");
    expect(anchor).toMatchObject({ month: "2026-09", date: "2026-09-01", source: "open-chapter" });
    expect(isHarbourJourneyMonth(anchor, "2026-09-30")).toBe(true);
    expect(isHarbourJourneyMonth(anchor, "2026-08-29")).toBe(false);
  });

  it("falls back to Toronto today and only accepts the final inward zoom at that month", () => {
    const anchor = harbourJourneyAnchor(catalogHousehold(), "2026-09-23");
    expect(anchor).toMatchObject({ month: "2026-09", source: "today" });
    expect(entersHarbourFromJourneyZoom(0, -1, anchor, "2026-09-02")).toBe(true);
    expect(entersHarbourFromJourneyZoom(1, -1, anchor, "2026-09-02")).toBe(false);
    expect(entersHarbourFromJourneyZoom(0, 1, anchor, "2026-09-02")).toBe(false);
    expect(entersHarbourFromJourneyZoom(0, -1, anchor, "2026-10-02")).toBe(false);
  });
});
