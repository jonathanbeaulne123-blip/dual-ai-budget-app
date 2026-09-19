import { knownCents } from "./fixtures/knownCents.ts";
import { describe, expect, it } from "vitest";
import { addCategory, addPotentialExpense, financialAuditHash, postEntry, splitForSync, assembleHousehold } from "../src/core/index.ts";
import {
  allocateFunds, fundFor, fundModelMode, FUND_IDS, UMBRELLAS, SPENDING_UMBRELLAS, v1FundForName, v2FundForName,
  umbrellaForName, shapeFundModelRows, mergeFundModelRows, type FundId,
} from "../src/core/fundRules.ts";
import { planFundMigration, setFundOverride } from "../src/core/fundModelCommands.ts";
import { projectKittyNest } from "../src/core/kittyNest.ts";
import { saveKittyNestDesign } from "../src/core/kittyNestDesigns.ts";
import { ALEX, TODAY, buffer, fundBill, fundedHousehold, migrated, reserveGoal } from "./fixtures/fund-model.ts";

/** The regex Hearth shipped before D-269, copied verbatim so v1 can never drift. */
function legacyNestCategoryFor(name: string): FundId {
  if (/vacation|holiday|trip|travel|wedding|renovat|home deposit|date night|concert/i.test(name)) return "build";
  if (/annual|yearly|christmas|birthday|tax|insurance|repair|school/i.test(name)) return "prepare";
  if (/rent|mortgage|hydro|phone|internet|electric|utility|emergency|buffer/i.test(name)) return "protect";
  return "everyday";
}
const WORDS = ["Rent", "Hydro One", "Netflix", "Costco", "Vet visit", "Car insurance (annual)", "Date night", "Christmas gifts", "RRSP contribution", "Credit card payment",
  "Rogers phones", "Loblaws", "Tim Hortons", "Petro-Canada", "PRESTO reload", "Prescription", "Dental cleaning", "Haircut", "Winter boots", "Flights to Halifax",
  "Anniversary dinner", "Tenant insurance", "IKEA bookshelf", "Emergency fund top-up", "Tip-out to bussers", "CRA balance owing", "SPCA donation", "Transfer to chequing",
  "Cash tips", "Visa interest charge", "Wedding gift", "Summer vacation", "Home deposit", "Buffer", "School fees", "Car loan payment", "Mortgage", "Internet", "Electric", "Concert"];
const corpus = Array.from({ length: 200 }, (_, i) => `${WORDS[i % WORDS.length]}${i % 3 ? "" : " extra"}${i % 7 ? "" : " YEARLY"}`);

describe("fund rules (slice 1)", () => {
  it("v1 is byte-for-byte the old regex on a 200-name corpus", () => {
    for (const name of corpus) expect(v1FundForName(name)).toBe(legacyNestCategoryFor(name));
  });
  it("v2 never defaults to Protect", () => {
    for (const name of [...corpus, "emergency", "buffer", "rainy day", "safety cushion"]) expect(v2FundForName(name)).not.toBe("protect");
  });
  it("answers the sorting-test key (§2b): #24 not Protect, #25 Build, #30 Prepare, gifts before holidays", () => {
    expect(v2FundForName("Emergency fund top-up")).toBe("everyday");
    expect(v2FundForName("Tip-out to bussers")).toBe("build");
    expect(v2FundForName("Visa interest charge")).toBe("prepare");
    expect(v2FundForName("Holiday gifts")).toBe("prepare");
    expect(v2FundForName("Christmas trip")).toBe("prepare");
    expect(v2FundForName("Summer holiday")).toBe("build");
    expect(v2FundForName("RRSP contribution")).toBe("build");
    expect(v2FundForName("Car loan payment")).toBe("prepare");
    expect(v2FundForName("Netflix subscription")).toBe("prepare");
    expect(v2FundForName("Date night")).toBe("everyday");
    expect(v2FundForName("Interest", "income")).toBe("everyday");
  });
  it("files the sorting test's lines under the balanced 12 (+2)", () => {
    const expected: Record<string, string> = {
      "Hydro One": "utilities", "Netflix": "fun", "Costco": "food", "Vet — Hercules (checkup)": "pets-family", "Car insurance (annual)": "transport",
      "Christmas gifts": "gifts-giving", "RRSP contribution": "money", "Credit card payment": "moving-money", "Rent": "home", "Rogers (phones)": "utilities",
      "Tim Hortons coffee": "food", "Petro-Canada gas": "transport", "PRESTO reload": "transport", "Dental cleaning": "health", "Haircut": "personal",
      "Winter boots": "personal", "Flights to Halifax": "travel", "Tenant insurance": "home", "IKEA bookshelf": "home", "Tip-out to bussers": "work-learning",
      "CRA balance owing": "money", "SPCA monthly donation": "gifts-giving", "Transfer to Bianca's chequing": "moving-money", "Visa interest charge": "money",
    };
    for (const [name, umbrella] of Object.entries(expected)) expect([name, umbrellaForName(name)]).toEqual([name, umbrella]);
    expect(umbrellaForName("Cash tips", "income")).toBe("coming-in");
  });
  it("has 12 fixed spending umbrellas and 2 that are not spending, with stable unique row ids", () => {
    expect(SPENDING_UMBRELLAS).toHaveLength(12);
    expect(UMBRELLAS.filter((row) => !row.spending).map((row) => row.id)).toEqual(["coming-in", "moving-money"]);
    expect(new Set(UMBRELLAS.map((row) => row.rowId)).size).toBe(14);
    expect(UMBRELLAS.find((row) => row.id === "home")!.rowId).toBe("CAT-HOUSING");
    expect(UMBRELLAS.find((row) => row.id === "health")!.name).toBe("Health");
  });
  it("conserves the King to the cent for every fuzz total, and never re-uses pinned goal money for bills", () => {
    let seed = 7;
    const rnd = (max: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % max; };
    for (let i = 0; i < 500; i += 1) {
      const pinned = { prepare: rnd(3000), protect: rnd(2000), build: rnd(9000), everyday: rnd(500) };
      const pinnedTotal = Object.values(pinned).reduce((a, b) => a + b, 0);
      const king = pinnedTotal + rnd(40000) - 15000;
      const owed = rnd(4000) - 1000;
      const a = allocateFunds({ kingCents: king, pinned, owedBackCents: owed, desired: { prepare: rnd(30000), protect: rnd(8000), build: rnd(9000) } });
      expect(a.owedBackCents + a.amounts.prepare + a.amounts.protect + a.amounts.build + a.amounts.everyday).toBe(king);
      for (const fund of FUND_IDS) expect(a.amounts[fund] - (fund === "everyday" ? a.nowCents : a.filled[fund])).toBe(pinned[fund]);
      // Fill order: nothing reaches Protect while Prepare is short; nothing reaches Build while Protect is short.
      if (a.filled.prepare < a.desired.prepare) expect(a.filled.protect + a.filled.build).toBe(0);
      if (a.filled.protect < a.desired.protect) expect(a.filled.build).toBe(0);
    }
  });
});

describe("fundFor precedence (v2)", () => {
  function setup() {
    let h = fundedHousehold();
    const rent = fundBill(h, { note: "Rent", amount: "900", subcategoryId: "SUB-HOUSING-RENT", day: 25 }); h = rent.household;
    const stream = fundBill(h, { note: "Streaming", amount: "20", subcategoryId: "SUB-LIFE-FUN", day: 26, kind: "subscription" }); h = stream.household;
    const groceries = fundBill(h, { note: "Groceries planned", amount: "300", subcategoryId: "SUB-FOOD-GROCERIES", day: 27, kind: "bill" }); h = groceries.household;
    h = migrated(h);
    return { h, rent: rent.id, stream: stream.id, groceries: groceries.id };
  }
  const viewer = { memberId: ALEX, view: "household" as const };
  it("resolves subscription → Prepare before the child's Everyday default, and a bill's category default before 'bill'", () => {
    const { h, rent, stream, groceries } = setup();
    expect(fundModelMode(h)).toBe(2);
    expect(fundFor(h, { kind: "recurrence", id: rent }, viewer)).toBe("prepare");
    expect(fundFor(h, { kind: "recurrence", id: stream }, viewer)).toBe("prepare");
    expect(fundFor(h, { kind: "recurrence", id: groceries }, viewer)).toBe("everyday");
  });
  it("lets an override beat the design, the design beat the category, and a goal purchase follow its goal", () => {
    let { h, rent } = setup();
    expect(fundFor(h, { kind: "recurrence", id: rent }, viewer, "build")).toBe("build");
    h = setFundOverride(h, { memberId: ALEX, view: "household", sourceKind: "recurrence", sourceId: rent, fund: "protect" }).household;
    expect(fundFor(h, { kind: "recurrence", id: rent }, viewer, "build")).toBe("protect");
    const posted = postEntry(h, { type: "expense", date: "2026-09-10", amount: "12", accountId: "ACC-VISA", subcategoryId: "SUB-FOOD-GROCERIES", createdBy: ALEX, visibility: "household" });
    h = posted.household;
    const tx = posted.postedIds[0]!;
    expect(fundFor(h, { kind: "transaction", id: tx }, viewer)).toBe("everyday");
    const goal = reserveGoal(h, "Anniversary dinner", "50", "build"); h = goal.household;
    h = { ...h, goalPurchases: [...(h.goalPurchases ?? []), { id: "GP-1", goalId: goal.id, spentCents: 1200, vaultAccountId: "ACC-X", transactionIds: [tx], lines: [], memberId: ALEX, date: "2026-09-10", createdAt: "x", updatedAt: "x" }] };
    expect(fundFor(h, { kind: "transaction", id: tx }, viewer)).toBe("build");
  });
  it("keeps an untyped goal where it showed before the migration (Q-F) and uses v2 for new ones", () => {
    let h = fundedHousehold();
    const old = reserveGoal(h, "Emergency fund", "100"); h = old.household;
    h = migrated(h, "2099-01-01T00:00:00.000Z");
    expect(fundFor(h, { kind: "goal", id: old.id }, viewer)).toBe("protect");
    const created = reserveGoal(h, "Emergency cushion", "50"); h = created.household;
    h.goals = h.goals.map((g) => g.id === created.id ? { ...g, createdAt: "2099-02-01T00:00:00.000Z" } : g);
    expect(fundFor(h, { kind: "goal", id: created.id }, viewer)).toBe("everyday");
  });
  it("applies a member's personal override only for that member", () => {
    let h = migrated(fundedHousehold());
    h = addPotentialExpense(h, { date: "2026-09-28", title: "Gift for a friend", amount: "40", accountId: "ACC-CHEQUING", subcategoryId: "SUB-LIFE-FUN", createdBy: ALEX, visibility: "both" }).household;
    const id = h.potentialExpenses.at(-1)!.id;
    expect(fundFor(h, { kind: "potential", id }, viewer)).toBe("everyday");
    h = setFundOverride(h, { memberId: ALEX, view: "personal", sourceKind: "potential", sourceId: id, fund: "build" }).household;
    expect(fundFor(h, { kind: "potential", id }, { memberId: ALEX, view: "personal" })).toBe("build");
    expect(fundFor(h, { kind: "potential", id }, { memberId: "MEM-002", view: "household" })).toBe("everyday");
  });
});

describe("the nest under v2 (slice 2)", () => {
  function month() {
    let h = fundedHousehold("3000");
    h = addCategory(h, { name: "Car loan", type: "expense", parentId: "CAT-TRANSPORT" }).household;
    const loanCategory = h.categories.find((row) => row.name === "Car loan")!.id;
    let r = fundBill(h, { note: "Rent", amount: "1500", subcategoryId: "SUB-HOUSING-RENT", day: 25 }); h = r.household; const rent = r.id;
    r = fundBill(h, { note: "Car payment", amount: "300", subcategoryId: loanCategory, day: 26, kind: "bill" }); h = r.household;
    r = fundBill(h, { note: "Hydro", amount: "100", subcategoryId: "SUB-HOUSING-ELECTRIC", day: 27 }); h = r.household;
    const trip = reserveGoal(h, "A slower week away", "400", "build"); h = trip.household;
    h = buffer(h, "500");
    return { h: migrated(h), rent, trip: trip.id };
  }
  it("puts rent, a loan payment and hydro in Prepare, each jar filling from its own fund, and Now reconciles to the cent", async () => {
    const { h } = month();
    const before = await financialAuditHash(h);
    const nest = projectKittyNest(h, ALEX, "household", TODAY);
    const byFund = Object.fromEntries(nest.categories.map((row) => [row.category!, row] as const));
    expect(nest.mode).toBe(2);
    expect(byFund.prepare!.children.map((row) => row.name).sort()).toEqual(["Car payment", "Hydro", "Rent"]);
    expect(byFund.protect!.children).toHaveLength(0);
    expect(byFund.prepare!.amountCents).toBe(190000);
    expect(byFund.protect!.amountCents).toBe(50000);
    expect(byFund.build!.amountCents).toBe(40000);
    const a = nest.allocation!;
    expect(a.owedBackCents + a.amounts.prepare + a.amounts.protect + a.amounts.build + a.amounts.everyday).toBe(nest.king.amountCents);
    expect(a.nowCents).toBe(a.amounts.everyday);
    expect(nest.categories.reduce((sum, row) => sum + knownCents(row.amountCents), 0) + a.owedBackCents).toBe(knownCents(nest.king.amountCents));
    for (const bank of nest.categories) expect(bank.children.reduce((sum, row) => sum + knownCents(row.amountCents), 0)).toBeLessThanOrEqual(Math.max(0, knownCents(bank.amountCents)));
    expect(byFund.prepare!.children.every((row) => row.amountCents === row.targetCents)).toBe(true);
    expect(await financialAuditHash(h)).toBe(before);
  });
  it("keeps goal-bank money in Build when the month is short: bills show short and Now goes negative (Q-A)", () => {
    let { h } = month();
    let r = fundBill(h, { note: "Insurance", amount: "1500", subcategoryId: "SUB-HOUSING-RENT", day: 28 }); h = r.household;
    const nest = projectKittyNest(h, ALEX, "household", TODAY);
    const byFund = Object.fromEntries(nest.categories.map((row) => [row.category!, row] as const));
    expect(byFund.build!.amountCents).toBe(40000);
    expect(byFund.build!.children.find((row) => row.goal)!.amountCents).toBe(40000);
    expect(byFund.prepare!.amountCents).toBe(260000);
    expect(nest.allocation!.desired.prepare).toBe(340000);
    expect(byFund.protect!.amountCents).toBe(0);
    expect(nest.allocation!.nowCents).toBe(0);
    const ids = nest.categories.flatMap((row) => row.children.map((child) => child.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("moves a Protect bill design the couple chose to Prepare on migration, and keeps flag-off goldens", () => {
    let h = fundedHousehold();
    const r = fundBill(h, { note: "Rent", amount: "900", subcategoryId: "SUB-HOUSING-RENT" }); h = r.household;
    const v1 = projectKittyNest(h, ALEX, "household", TODAY);
    expect(v1.mode).toBeUndefined();
    expect(v1.categories.find((row) => row.category === "protect")!.children.map((row) => row.name)).toEqual(["Rent"]);
    h = saveKittyNestDesign(h, { memberId: ALEX, view: "household", bankKey: `recurrence:${r.id}`, expectedRevision: 0, name: "Rent pot", glaze: "rose", category: "protect" } as never).household;
    const plan = planFundMigration(h, "2026-09-16T00:00:00.000Z");
    expect(plan.designs).toHaveLength(1);
    h = migrated(h);
    expect(h.kittyNestDesigns!.find((row) => row.bankKey === `recurrence:${r.id}`)!.category).toBe("prepare");
    expect(projectKittyNest(h, ALEX, "household", TODAY).categories.find((row) => row.category === "prepare")!.children.map((row) => row.name)).toEqual(["Rent pot"]);
  });
});

describe("the synced collection", () => {
  it("shapes strictly, merges by revision, and splits personal rows out of Shared", () => {
    let h = migrated(fundedHousehold());
    expect(() => setFundOverride(h, { memberId: ALEX, view: "personal", sourceKind: "recurrence", sourceId: "REC-none", fund: "build" })).toThrow(/isn't available/);
    h = addPotentialExpense(h, { date: "2026-09-28", title: "Private gift", amount: "40", accountId: "ACC-CHEQUING", subcategoryId: "SUB-LIFE-FUN", createdBy: ALEX, visibility: "personal" }).household;
    const privateId = h.potentialExpenses.at(-1)!.id;
    h = setFundOverride(h, { memberId: ALEX, view: "personal", sourceKind: "potential", sourceId: privateId, fund: "build", at: "2026-09-17T00:00:00.000Z" }).household;
    const alex = splitForSync(h, ALEX), sam = splitForSync(h, "MEM-002");
    expect(alex.shared.fundModelRows!.every((row) => row.visibility === "household")).toBe(true);
    expect(JSON.stringify(alex.shared)).not.toContain(privateId);
    expect(alex.personal.fundModelRows!.map((row) => row.kind)).toEqual(["override"]);
    expect(sam.personal.fundModelRows ?? []).toEqual([]);
    const back = assembleHousehold(alex.shared, alex.personal, { linked: true });
    expect(back.fundModelRows).toEqual(h.fundModelRows);
    expect(() => shapeFundModelRows([{ ...h.fundModelRows![0]!, version: 3 }])).toThrow();
    expect(() => shapeFundModelRows([{ ...h.fundModelRows![0]!, extra: 1 }])).toThrow();
    const older = { ...h.fundModelRows!.find((row) => row.kind === "override")!, fund: "prepare" as const, updatedAt: "2026-09-16T00:00:00.000Z" };
    expect(mergeFundModelRows(h.fundModelRows, [older]).find((row) => row.id === older.id)).toMatchObject({ fund: "build" });
  });
  it("leaves the financial audit hash unchanged by the migration and every override", async () => {
    const h = fundedHousehold();
    const before = await financialAuditHash(h);
    const after = migrated(h);
    expect(await financialAuditHash(after)).toBe(before);
  });
});
