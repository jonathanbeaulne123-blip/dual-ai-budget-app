import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  contributionRegister,
  hostedTransportAllowed,
  householdAsk,
  householdFundContributionMotions,
  monthKeyFromDateKey,
  seedDemoHousehold,
} from "../src/core/index.ts";

const TODAY = "2026-09-12";
const GENERATED_ON = "2026-09-30";
const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const MONTHS = ["2026-06", "2026-07", "2026-08", "2026-09"];

describe("Demo Slice 1 seed", () => {
  it("builds a four-month rough-to-settled Register/Ask story that ties throughout", () => {
    const household = seedDemoHousehold({ today: GENERATED_ON, environment: "development" });
    const historyMonths = [...new Set(household.budgetPlans.map((row) => row.monthKey))].sort();
    const registers = MONTHS.map((monthKey) => contributionRegister(household, monthKey, TODAY));

    expect(historyMonths).toEqual(MONTHS);
    expect(registers.every((register) => register.tiesToProjection)).toBe(true);
    expect(registers.map((register) => register.unfundedCents)).toEqual([52_000, 52_000, 0, 34_000]);
    expect(householdAsk(household, "2026-08-12").askCents).toBe(0);
    expect(householdAsk(household, TODAY).askCents).toBe(34_000);

    const biancaByMonth = MONTHS.map((monthKey) => contributionRegister(household, monthKey, TODAY)
      .byMember.find((row) => row.memberId === BIANCA)?.amountCents ?? 0);
    expect(biancaByMonth).toEqual([60_000, 82_000, 98_000, 196_000]);
  });

  it("matches the current canonical September register exactly", () => {
    const household = seedDemoHousehold({ today: GENERATED_ON, environment: "development" });
    const register = contributionRegister(household, monthKeyFromDateKey(TODAY), TODAY);

    expect(register).toMatchObject({
      carriedCents: 24_000,
      byMember: [
        { memberId: BIANCA, amountCents: 196_000 },
        { memberId: JONATHAN, amountCents: 53_500 },
      ],
      owedCents: 307_500,
      unfundedCents: 34_000,
      tiesToProjection: true,
    });
    expect(register.sources.map(({ kind, memberId, date, amountCents }) => ({ kind, memberId, date, amountCents }))).toEqual([
      { kind: "carried", memberId: null, date: "2026-09-01", amountCents: 24_000 },
      { kind: "contribution", memberId: BIANCA, date: "2026-09-04", amountCents: 98_000 },
      { kind: "contribution", memberId: JONATHAN, date: "2026-09-06", amountCents: 31_000 },
      { kind: "contribution", memberId: JONATHAN, date: "2026-09-11", amountCents: 22_500 },
      { kind: "contribution", memberId: BIANCA, date: "2026-09-18", amountCents: 98_000 },
    ]);
    expect(register.rows.map((row) => ({
      label: row.label,
      date: row.date,
      amountCents: row.amountCents,
      segments: row.segments,
      unfundedCents: row.unfundedCents,
    }))).toEqual([
      { label: "Hydro", date: "2026-09-04", amountCents: 12_800, segments: [{ sourceIndex: 0, amountCents: 12_800 }], unfundedCents: 0 },
      { label: "Rent · our share", date: "2026-09-05", amountCents: 145_000, segments: [{ sourceIndex: 0, amountCents: 11_200 }, { sourceIndex: 1, amountCents: 98_000 }, { sourceIndex: 2, amountCents: 31_000 }, { sourceIndex: 3, amountCents: 4_800 }], unfundedCents: 0 },
      { label: "Insurance", date: "2026-09-10", amountCents: 18_600, segments: [{ sourceIndex: 3, amountCents: 17_700 }, { sourceIndex: 4, amountCents: 900 }], unfundedCents: 0 },
      { label: "Groceries · planned", date: "2026-09-15", amountCents: 52_000, segments: [{ sourceIndex: 4, amountCents: 52_000 }], unfundedCents: 0 },
      { label: "Internet", date: "2026-09-20", amountCents: 9_200, segments: [{ sourceIndex: 4, amountCents: 9_200 }], unfundedCents: 0 },
      { label: "Gas", date: "2026-09-22", amountCents: 7_400, segments: [{ sourceIndex: 4, amountCents: 7_400 }], unfundedCents: 0 },
      { label: "Phone", date: "2026-09-25", amountCents: 11_000, segments: [{ sourceIndex: 4, amountCents: 11_000 }], unfundedCents: 0 },
      { label: "Vet · Marmalade", date: "2026-09-26", amountCents: 21_500, segments: [{ sourceIndex: 4, amountCents: 17_500 }], unfundedCents: 4_000 },
      { label: "Winter reserve · goal claim", date: "2026-09-30", amountCents: 30_000, segments: [], unfundedCents: 30_000 },
    ]);
  });

  it("keeps the story synthetic and preserves command-owned Hold, deferral, and signature facts", () => {
    const household = seedDemoHousehold({ today: GENERATED_ON, environment: "development" });
    const source = readFileSync(new URL("../src/core/seed.ts", import.meta.url), "utf8");

    expect(householdFundContributionMotions(household).some((motion) => motion.status === "held")).toBe(true);
    expect(household.activity.some((row) => row.summary === "Moved Porch table to next month")).toBe(true);
    expect(household.charter?.signatures).toEqual([
      { memberId: BIANCA, signedAt: expect.any(String) },
      { memberId: JONATHAN, signedAt: null },
    ]);
    expect(hostedTransportAllowed(household)).toBe(false);
    expect(source).not.toMatch(/\b(fetch|localStorage|sessionStorage|supabase)\b/);
    expect(() => seedDemoHousehold({ today: TODAY, environment: "production" }))
      .toThrow("The demo kitchen is Development-only.");
    const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
    expect(appSource).toContain('!welcomeSignedIn && environment === "development"');
  });

  it("never confirms or posts Fund money to the right of the demo date", () => {
    const moneyKinds = new Set([
      "contribution-confirmed",
      "settlement-confirmed",
      "kitty-allocated",
      "kitty-released",
      "purchase-funded",
      "refund-funded",
    ]);
    for (const generatedOn of ["2026-09-02", TODAY, GENERATED_ON]) {
      const household = seedDemoHousehold({ today: generatedOn, environment: "development" });
      expect(household.transactions.every((transaction) => transaction.date <= generatedOn)).toBe(true);
      expect((household.fundEvents ?? [])
        .filter((event) => moneyKinds.has(event.kind))
        .every((event) => event.date <= generatedOn)).toBe(true);
    }
  });

  it("keeps future obligations planned while the early-month Ask waits for later contributions", () => {
    const household = seedDemoHousehold({ today: TODAY, environment: "development" });
    const register = contributionRegister(household, monthKeyFromDateKey(TODAY), TODAY);

    expect(register.rows.map((row) => row.label)).toEqual([
      "Hydro",
      "Rent · our share",
      "Insurance",
      "Demo return",
      "Groceries · planned",
      "Internet",
      "Gas",
      "Phone",
      "Vet · Marmalade",
      "Winter reserve · goal claim",
    ]);
    expect(register.owedCents).toBe(308500);
    expect(register.sources.map((source) => source.amountCents)).toEqual([24000, 98000, 31000, 22500]);
    expect(register.unfundedCents).toBe(133000);
  });
});
