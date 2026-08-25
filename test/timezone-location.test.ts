import { describe, expect, it } from "vitest";
import { dateKeyInZone, isValidIanaTimeZone, todayKey, TIMEZONE } from "../src/core/calendar.ts";
import { postEntry, setHouseholdTimezone } from "../src/core/commands.ts";
import { catalogHousehold } from "../src/core/seed.ts";
import { requireTimezone } from "../src/core/catalog.ts";
import { runHealthCheck } from "../src/core/health.ts";
import { loadPhonePlacePrefs, savePhonePlacePrefs } from "../src/core/locationPrefs.ts";
import { shapeTransactionLocation } from "../src/core/transactionLocation.ts";
import { householdForAiDisclosure } from "../src/core/visibility.ts";
import { ValidationError } from "../src/core/types.ts";

function memoryStore(): Storage {
  const memory = new Map<string, string>();
  return {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value); },
    removeItem: (key: string) => { memory.delete(key); },
    clear: () => memory.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

describe("D-126 Q2 C books stay Toronto", () => {
  it("keeps catalog books on America/Toronto and rejects other household zones for posting", () => {
    const household = catalogHousehold();
    expect(household.timezone).toBe(TIMEZONE);
    requireTimezone(household);
    expect(() => setHouseholdTimezone(household, "America/Vancouver")).toThrow(/Books civil dates stay/);
    const broken = { ...household, timezone: "America/Vancouver" };
    expect(() => requireTimezone(broken)).toThrow(ValidationError);
    expect(runHealthCheck(broken).some((row) => row.section === "Timezone")).toBe(true);
  });

  it("still derives display civil keys in arbitrary IANA zones", () => {
    expect(isValidIanaTimeZone("America/Vancouver")).toBe(true);
    expect(dateKeyInZone(new Date("2026-08-22T03:30:00Z"), "America/Toronto")).toBe("2026-08-21");
    expect(todayKey(new Date("2026-08-21T16:00:00Z"), "UTC")).toBe("2026-08-21");
  });
});

describe("D-126 location stamps and disclosure", () => {
  it("stores optional coords and occurredAt on the transaction (Q5 A)", () => {
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

  it("strips coordinates from AI disclosure unless the member opts in (Q6 C)", () => {
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
    expect(householdForAiDisclosure(household, "MEM-001").transactions.some((tx) => tx.location)).toBe(false);
    expect(
      householdForAiDisclosure(household, "MEM-001", { shareCoordsWithModel: true })
        .transactions.some((tx) => tx.location),
    ).toBe(true);
  });

  it("keeps phone place prefs local with stamp and model toggles (Q3/Q4/Q6)", () => {
    const store = memoryStore();
    const fresh = loadPhonePlacePrefs("development", store);
    expect(fresh.locationAllowed).toBe(false);
    expect(fresh.stampTime).toBe(true);
    expect(fresh.stampCoords).toBe(true);
    expect(fresh.shareCoordsWithModel).toBe(false);
    const saved = savePhonePlacePrefs("development", {
      locationAllowed: true,
      stampTime: false,
      stampCoords: true,
      shareCoordsWithModel: true,
      addPromptSeen: true,
      displayTimeZone: "America/Vancouver",
    }, store, new Date("2026-08-24T12:00:00Z"));
    expect(saved.locationAllowed).toBe(true);
    expect(saved.stampTime).toBe(false);
    expect(saved.shareCoordsWithModel).toBe(true);
    expect(loadPhonePlacePrefs("development", store).displayTimeZone).toBe("America/Vancouver");
  });
});
