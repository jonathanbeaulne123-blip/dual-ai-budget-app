import { describe, expect, it } from "vitest";
import { dateKeyInZone, isValidIanaTimeZone, todayKey } from "../src/core/calendar.ts";
import { postEntry, setHouseholdTimezone } from "../src/core/commands.ts";
import { catalogHousehold } from "../src/core/seed.ts";
import { requireTimezone } from "../src/core/catalog.ts";
import { runHealthCheck } from "../src/core/health.ts";
import { loadLocationServicesPrefs, saveLocationServicesPrefs } from "../src/core/locationPrefs.ts";
import { shapeTransactionLocation } from "../src/core/transactionLocation.ts";
import { householdForAiDisclosure } from "../src/core/visibility.ts";
import { ValidationError } from "../src/core/types.ts";

describe("household timezone (D-126)", () => {
  it("accepts non-Toronto IANA zones for posting", () => {
    expect(isValidIanaTimeZone("America/Vancouver")).toBe(true);
    let household = catalogHousehold();
    household = setHouseholdTimezone(household, "America/Vancouver").household;
    expect(household.timezone).toBe("America/Vancouver");
    requireTimezone(household);
    expect(runHealthCheck(household).some((row) => row.section === "Timezone")).toBe(false);
    const posted = postEntry(household, {
      date: "2026-08-24",
      type: "expense",
      amount: "12.50",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Milk",
      createdBy: "MEM-001",
    });
    expect(posted.postedIds).toHaveLength(1);
  });

  it("rejects invalid IANA zones", () => {
    const household = catalogHousehold();
    expect(() => setHouseholdTimezone(household, "Mars/Olympus")).toThrow(ValidationError);
  });

  it("derives civil dates in the chosen zone", () => {
    // 2026-08-22T03:30Z is still Aug 21 in Toronto, already Aug 21 evening in Vancouver.
    expect(dateKeyInZone(new Date("2026-08-22T03:30:00Z"), "America/Toronto")).toBe("2026-08-21");
    expect(dateKeyInZone(new Date("2026-08-22T06:30:00Z"), "America/Vancouver")).toBe("2026-08-21");
    expect(todayKey(new Date("2026-08-21T16:00:00Z"), "UTC")).toBe("2026-08-21");
  });
});

describe("transaction location stamps (D-126)", () => {
  it("stores optional coords and occurredAt without changing money identity", () => {
    const household = catalogHousehold();
    const location = shapeTransactionLocation({
      latitude: 43.6532,
      longitude: -79.3832,
      accuracyMeters: 12,
      capturedAt: "2026-08-24T18:00:00.000Z",
      label: "near downtown",
    });
    const posted = postEntry(household, {
      date: "2026-08-24",
      type: "expense",
      amount: "4.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-COFFEE",
      note: "Coffee",
      place: "Cafe",
      occurredAt: "2026-08-24T18:00:00.000Z",
      location,
      createdBy: "MEM-001",
    });
    const tx = posted.household.transactions.find((row) => row.id === posted.postedIds[0]);
    expect(tx?.location?.latitude).toBeCloseTo(43.6532);
    expect(tx?.occurredAt).toBe("2026-08-24T18:00:00.000Z");
  });

  it("strips coordinates from AI disclosure projection", () => {
    let household = catalogHousehold();
    household = postEntry(household, {
      date: "2026-08-24",
      type: "expense",
      amount: "4.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-COFFEE",
      note: "Coffee",
      location: {
        latitude: 43.65,
        longitude: -79.38,
        capturedAt: "2026-08-24T18:00:00.000Z",
      },
      createdBy: "MEM-001",
    }).household;
    const disclosed = householdForAiDisclosure(household, "MEM-001");
    expect(disclosed.transactions.some((tx) => tx.location)).toBe(false);
  });

  it("keeps location-services preference phone-local", () => {
    const memory = new Map<string, string>();
    const store = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value); },
      removeItem: (key: string) => { memory.delete(key); },
      clear: () => memory.clear(),
      key: () => null,
      length: 0,
    } as Storage;
    expect(loadLocationServicesPrefs("development", store).allowed).toBe(false);
    saveLocationServicesPrefs("development", true, store, new Date("2026-08-24T12:00:00Z"));
    expect(loadLocationServicesPrefs("development", store).allowed).toBe(true);
  });
});
