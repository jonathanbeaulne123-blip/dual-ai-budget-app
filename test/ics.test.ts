import { describe, expect, it } from "vitest";
import { seedDemoHousehold } from "../src/core/seed.ts";
import { buildHouseholdIcs } from "../src/core/ics.ts";
import { googleRrule } from "../src/core/recurrence.ts";
import { hearthGoogleEvent, overlayFromGoogleEvent } from "../src/calendar/google.ts";
import { addRecurrence } from "../src/core/commands.ts";
import { catalogHousehold } from "../src/core/seed.ts";

const TODAY = "2026-08-21";

describe("ICS export", () => {
  it("emits Toronto timed events with two alarms and does not post money", () => {
    const household = seedDemoHousehold({ today: TODAY });
    const before = household.transactions.length;
    const ics = buildHouseholdIcs(household, TODAY);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("TZID:America/Toronto");
    expect(ics).toContain("BEGIN:VALARM");
    expect(ics).toContain("TRIGGER:-PT24H");
    expect(ics).toContain("TRIGGER:PT0S");
    expect(ics).toMatch(/SUMMARY:.*Rent/);
    expect(ics).toContain("STATUS:TENTATIVE");
    expect(ics).toContain("detected");
    expect(household.transactions).toHaveLength(before);
  });
});

describe("Google reminder payloads", () => {
  it("builds a RRULE event that reminds 24 hours ahead and at 9:00 Toronto", () => {
    const household = addRecurrence(catalogHousehold(), {
      cadence: "monthly",
      nextDate: "2026-09-01",
      type: "expense",
      amount: 1850,
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-HOUSING-RENT",
      note: "Rent",
    }).household;
    const item = household.recurrences[0]!;
    expect(googleRrule(item.nextDate, item.cadence)).toBe("RRULE:FREQ=MONTHLY;BYMONTHDAY=1");
    const event = hearthGoogleEvent(item, "Rent");
    expect(event.summary).toContain("Hearth · Rent");
    expect(event.start).toEqual({ dateTime: "2026-09-01T09:00:00", timeZone: "America/Toronto" });
    expect(event.recurrence).toEqual(["RRULE:FREQ=MONTHLY;BYMONTHDAY=1"]);
    expect(event.reminders).toEqual({
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 1440 },
        { method: "popup", minutes: 0 },
      ],
    });
    expect((event.extendedProperties as { private: { hearth: string } }).private.hearth).toBe("1");
  });

  it("parses Google overlay events onto a Toronto date key", () => {
    const overlay = overlayFromGoogleEvent({
      id: "abc",
      summary: "Dentist",
      start: { dateTime: "2026-08-22T14:00:00-04:00" },
    }, "MEM-001", "#c45c26");
    expect(overlay).toEqual({
      id: "abc",
      date: "2026-08-22",
      title: "Dentist",
      memberId: "MEM-001",
      memberColor: "#c45c26",
      hearthOwned: false,
    });
  });
});
