import { describe, expect, it } from "vitest";
import { addCategory, addPotentialExpense, addRecurrence, catalogHousehold, postEntry, postOneRecurrence, postPotentialExpense, splitForSync, type Household } from "../src/core/index.ts";
import { householdFundMarker, personalFundMarker, pickableExpenseGroups, umbrellaOfCategory, UMBRELLAS } from "../src/core/fundRules.ts";
import { migrateFundModel, migrateMyFundModel, setCategoryHome } from "../src/core/fundModelCommands.ts";
import { saveKittyNestDesign } from "../src/core/kittyNestDesigns.ts";
import { householdForHerculesContext } from "../src/core/visibility.ts";
import { capturedIntent } from "../src/ledgerSync/capture.ts";
import { commandFromCapture, type Scope } from "../src/ledgerSync/protocol.ts";
import { prepareCommand, type AuthorityState } from "../src/ledgerSync/authority.ts";
import { clientFundModelVersion, fundModelReloadRequired } from "../src/ledgerSync/fundModelStamp.ts";
import { planLifeFixture } from "./fixtures/plan-life.ts";
import { ALEX, SAM, fundedHousehold, migrated } from "./fixtures/fund-model.ts";

const AT = "2026-09-16T12:00:00.000Z";
function withPrivateRows(h: Household): Household {
  h.accounts = h.accounts.map((row) => row.id === "ACC-CHEQUING" ? { ...row, scope: "personal", ownerMemberId: ALEX } : row);
  h = addPotentialExpense(h, { date: "2026-09-28", title: "Secret spa day", amount: "80", accountId: "ACC-CHEQUING", subcategoryId: "SUB-LIFE-FUN", createdBy: ALEX, visibility: "personal" }).household;
  const id = h.potentialExpenses.at(-1)!.id;
  h = saveKittyNestDesign(h, { memberId: ALEX, view: "personal", bankKey: `potential:${id}`, expectedRevision: 0, name: "Spa pot", glaze: "rose", category: "protect" } as never).household;
  return h;
}

describe("household migration (slice 4)", () => {
  it("builds the 14 locked umbrellas, re-homes every seed child, retires Life and Debt, and keeps the card child posting", () => {
    let h = catalogHousehold();
    const card = addRecurrence(h, { cadence: "monthly", nextDate: "2026-09-10", type: "expense", amount: "200", accountId: "ACC-CHEQUING", subcategoryId: "SUB-DEBT-VISA", note: "Visa payment" });
    h = card.household;
    const phone = addRecurrence(h, { cadence: "monthly", nextDate: "2026-09-12", type: "expense", amount: "60", accountId: "ACC-CHEQUING", subcategoryId: "SUB-LIFE-PHONE", note: "Phone" });
    h = phone.household;
    h = addPotentialExpense(h, { date: "2026-09-13", title: "Birthday dinner", amount: "90", accountId: "ACC-CHEQUING", subcategoryId: "SUB-LIFE-FUN", createdBy: ALEX, visibility: "household" }).household;
    const potential = h.potentialExpenses.at(-1)!.id;
    const old = postEntry(h, { type: "expense", date: "2026-09-02", amount: "5", accountId: "ACC-CHEQUING", subcategoryId: "SUB-LIFE-FUN", createdBy: ALEX, visibility: "household" });
    h = old.household;
    const oldTx = h.transactions.find((row) => row.id === old.postedIds[0])!;
    const result = migrateFundModel(h, { memberId: ALEX, at: AT });
    h = result.household;
    for (const umbrella of UMBRELLAS) {
      const row = h.categories.find((item) => item.id === umbrella.rowId)!;
      expect([row.id, row.name, row.umbrellaId, row.active, row.recordType]).toEqual([umbrella.rowId, umbrella.name, umbrella.id, true, "group"]);
    }
    expect(h.categories.find((row) => row.id === "CAT-LIFE")!.active).toBe(false);
    expect(h.categories.find((row) => row.id === "CAT-DEBT")!.active).toBe(false);
    expect(h.categories.some((row) => row.id === "CAT-LIFE")).toBe(true);
    const child = (id: string) => h.categories.find((row) => row.id === id)!;
    expect([child("SUB-LIFE-PHONE").parentId, child("SUB-LIFE-PHONE").defaultFund]).toEqual(["UMB-UTILITIES", "prepare"]);
    expect([child("SUB-HEALTH-VET").parentId, child("SUB-HEALTH-VET").defaultFund]).toEqual(["UMB-PETS-FAMILY", "prepare"]);
    expect([child("SUB-DEBT-INTEREST").parentId, child("SUB-DEBT-INTEREST").defaultFund]).toEqual(["UMB-MONEY", "prepare"]);
    expect([child("SUB-FOOD-GROCERIES").parentId, child("SUB-FOOD-GROCERIES").defaultFund]).toEqual(["CAT-FOOD", "everyday"]);
    expect([child("SUB-DEBT-VISA").parentId, child("SUB-DEBT-VISA").active, child("SUB-DEBT-VISA").defaultFund]).toEqual(["UMB-MOVING-MONEY", true, undefined]);
    expect(child("SUB-INCOME-INTEREST").parentId).toBe("INCOME");
    expect(child("INCOME").name).toBe("Coming in");
    expect(h.categories.filter((row) => row.recordType === "category").every((row) => h.categories.find((g) => g.id === row.parentId)?.active)).toBe(true);
    // Posted rows are never rewritten; the umbrella resolves through the child's current parent.
    expect(h.transactions.find((row) => row.id === oldTx.id)).toEqual(oldTx);
    expect(umbrellaOfCategory(h, "SUB-LIFE-FUN")).toBe("fun");
    // Every existing repeating item and planned expense still posts (R2-H3).
    expect(() => postOneRecurrence(h, card.postedIds[0]!, "2026-09-10", { createdBy: ALEX })).not.toThrow();
    expect(() => postOneRecurrence(h, phone.postedIds[0]!, "2026-09-12", { createdBy: ALEX })).not.toThrow();
    expect(() => postPotentialExpense(h, { id: potential, createdBy: ALEX })).not.toThrow();
    // Pickers offer exactly the 12 spending umbrellas in order, never Moving money.
    expect(pickableExpenseGroups(h).map((row) => row.umbrellaId)).toEqual(UMBRELLAS.filter((u) => u.spending).map((u) => u.id));
    expect(householdFundMarker(h)!.changes.length).toBeGreaterThan(10);
    expect(result.postedIds).toContain("UMB-UTILITIES");
    expect(result.undo.commandKind).toBe("updateFundModel");
  });
  it("is idempotent and refuses when a household plan still keeps bills in Protect", () => {
    const h = migrated(fundedHousehold());
    expect(() => migrateFundModel(h, { memberId: ALEX })).toThrow(/already sorted/);
    expect(() => migrateFundModel(planLifeFixture("household"), { memberId: ALEX })).toThrow(/keeps bills in Protect/);
  });
  it("puts an unmatched household child under 'Needs a home' without retiring its group, then retires the group once it is re-homed", () => {
    let h = addCategory(catalogHousehold(), { name: "Zorblax", type: "expense", parentId: "__new__", newGroupName: "Mystery" }).household;
    const id = h.categories.find((row) => row.name === "Zorblax")!.id;
    h = migrateFundModel(h, { memberId: ALEX, at: AT }).household;
    expect(householdFundMarker(h)!.needsHome).toEqual([id]);
    const group = h.categories.find((row) => row.name === "Mystery")!;
    expect(group.active).toBe(true);
    expect(() => postEntry(h, { type: "expense", date: "2026-09-03", amount: "1", accountId: "ACC-CHEQUING", subcategoryId: id, createdBy: ALEX, visibility: "household" })).not.toThrow();
    h = setCategoryHome(h, { memberId: ALEX, categoryId: id, umbrellaId: "fun", defaultFund: "build" }).household;
    expect(h.categories.find((row) => row.id === group.id)!.active).toBe(false);
    expect(householdFundMarker(h)!.needsHome).toEqual([]);
    expect(() => setCategoryHome(h, { memberId: ALEX, categoryId: "CAT-FOOD", name: "Eats" })).toThrow(/Umbrellas are fixed/);
    expect(() => setCategoryHome(h, { memberId: ALEX, categoryId: id, defaultFund: "protect" })).toThrow(/Nothing starts in Protect/);
    expect(() => setCategoryHome(h, { memberId: ALEX, categoryId: id, umbrellaId: "moving-money" })).toThrow(/doesn't hold/);
  });
  it("never puts a personal row in the shared marker, the shared envelope, or Hercules context", () => {
    let h = withPrivateRows(catalogHousehold());
    h = migrateFundModel(h, { memberId: ALEX, at: AT }).household;
    const privateIds = [...h.potentialExpenses.filter((row) => row.visibility === "personal").map((row) => row.id), ...(h.kittyNestDesigns ?? []).filter((row) => row.visibility === "personal").map((row) => row.id)];
    const shared = JSON.stringify(splitForSync(h, ALEX).shared);
    for (const id of privateIds) {
      expect(JSON.stringify(householdFundMarker(h))).not.toContain(id);
      expect(shared).not.toContain(id);
    }
    // The household step never touched the private design.
    expect(h.kittyNestDesigns!.find((row) => row.visibility === "personal")!.category).toBe("protect");
    const context = householdForHerculesContext(h, ALEX, "household").fundModelRows!;
    expect(context).toEqual([{ ...householdFundMarker(h)!, changes: [], needsHome: [] }]);
    for (const id of privateIds) expect(JSON.stringify(householdForHerculesContext(h, ALEX, "personal"))).not.toContain(`"sourceId":"${id}"`);
  });
  it("lets each owner sort their own rows on their own device only", () => {
    let h = withPrivateRows(catalogHousehold());
    expect(() => migrateMyFundModel(h, { memberId: ALEX })).toThrow(/hasn't sorted/);
    h = migrateFundModel(h, { memberId: SAM, at: AT }).household;
    const mine = migrateMyFundModel(h, { memberId: ALEX, at: AT });
    expect(mine.persistenceScope).toBe("member-personal");
    expect(mine.postedIds).toEqual([]);
    h = mine.household;
    expect(h.kittyNestDesigns!.find((row) => row.visibility === "personal")!.category).toBe("prepare");
    expect(personalFundMarker(h, ALEX)).not.toBeNull();
    expect(personalFundMarker(h, SAM)).toBeNull();
    const alex = splitForSync(h, ALEX), sam = splitForSync(h, SAM);
    expect(alex.personal.fundModelRows!.map((row) => row.id)).toEqual(["FUND-MODEL:personal:MEM-001"]);
    expect(sam.personal.fundModelRows).toEqual([]);
    expect(alex.shared.fundModelRows!.map((row) => row.id)).toEqual(["FUND-MODEL:household"]);
    expect(() => migrateMyFundModel(h, { memberId: ALEX })).toThrow(/already sorted/);
  });
});

describe("the umbrella lock (slice 4)", () => {
  it("refuses new groups and non-spending parents once sorted, and gives new children a default fund", () => {
    const v1 = addCategory(catalogHousehold(), { name: "Pottery", type: "expense", parentId: "__new__", newGroupName: "Hobbies" }).household;
    expect(v1.categories.some((row) => row.name === "Hobbies" && row.recordType === "group")).toBe(true);
    expect(() => addCategory(catalogHousehold(), { name: "Pottery", type: "expense", parentId: "CAT-LIFE", defaultFund: "build" })).toThrow(/Nothing starts in Protect/);
    const h = migrated(catalogHousehold());
    expect(() => addCategory(h, { name: "Pottery", type: "expense", parentId: "__new__", newGroupName: "Hobbies" })).toThrow(/12 umbrellas/);
    expect(() => addCategory(h, { name: "Pottery", type: "expense" })).toThrow(/12 umbrellas/);
    expect(() => addCategory(h, { name: "Pottery", type: "expense", parentId: "CAT-LIFE" })).toThrow(/12 umbrellas/);
    expect(() => addCategory(h, { name: "Loan shuffle", type: "expense", parentId: "UMB-MOVING-MONEY" })).toThrow(/12 umbrellas/);
    expect(() => addCategory(h, { name: "Pottery", type: "expense", parentId: "UMB-FUN", defaultFund: "protect" })).toThrow(/Nothing starts in Protect/);
    const pottery = addCategory(h, { name: "Pottery", type: "expense", parentId: "UMB-FUN" });
    expect(pottery.household.categories.find((row) => row.id === pottery.postedIds[0])).toMatchObject({ parentId: "UMB-FUN", defaultFund: "everyday" });
    const flights = addCategory(h, { name: "Flights", type: "expense", parentId: "UMB-TRAVEL" });
    expect(flights.household.categories.find((row) => row.id === flights.postedIds[0])!.defaultFund).toBe("build");
    const chosen = addCategory(h, { name: "Streaming", type: "expense", parentId: "UMB-FUN", defaultFund: "prepare" });
    expect(chosen.household.categories.find((row) => row.id === chosen.postedIds[0])!.defaultFund).toBe("prepare");
    const pay = addCategory(h, { name: "Bonus", type: "income" });
    expect(pay.household.categories.find((row) => row.id === pay.postedIds[0])).toMatchObject({ parentId: "INCOME" });
    expect(pay.household.categories.find((row) => row.id === pay.postedIds[0])!.defaultFund).toBeUndefined();
  });
});

describe("stamps and mixed versions (slice 3, R2-H1)", () => {
  function authority(h: Household) {
    const one = splitForSync(h, ALEX), two = splitForSync(h, SAM);
    const state: AuthorityState = { sequence: h.revision, shared: one.shared, personal: new Map([[ALEX, one.personal], [SAM, two.personal]]) };
    const scope: Scope = { environment: h.environment, householdId: h.householdId, memberId: ALEX, subject: "fictional-one", role: "owner", expires: Date.now() + 60000, aclEpoch: 1 };
    return { state, scope };
  }
  const grocery = (h: Household) => postEntry(h, { date: "2026-09-07", type: "expense", amount: "4.00", accountId: "ACC-VISA", subcategoryId: "SUB-FOOD-GROCERIES", note: "milk", createdBy: ALEX, confirmDuplicate: true });
  it("defaults the client stamp to release N and only the flag turns on N+1", () => {
    expect(clientFundModelVersion(undefined)).toBe(1);
    expect(clientFundModelVersion("0")).toBe(1);
    expect(clientFundModelVersion("1")).toBe(2);
  });
  it("accepts N and N+1 writes before migration, refuses the migration from N, and accepts it from N+1", async () => {
    const h = catalogHousehold();
    const { state, scope } = authority(h);
    const n = await commandFromCapture(capturedIntent(grocery(h).household)!, scope, crypto.randomUUID());
    expect(n.fundModelVersion).toBe(1);
    await expect(prepareCommand(state, n, scope, () => {})).resolves.toBeTruthy();
    const migrate = await commandFromCapture(capturedIntent(migrateFundModel(h, { memberId: ALEX, at: AT }).household)!, scope, crypto.randomUUID());
    await expect(prepareCommand(state, migrate, scope, () => {})).rejects.toThrow("CLIENT_RELOAD_REQUIRED");
    const accepted = await prepareCommand(state, { ...migrate, fundModelVersion: 2 }, scope, () => {});
    expect(accepted.shared.fundModelRows!.map((row) => row.id)).toEqual(["FUND-MODEL:household"]);
    expect(accepted.shared.categories.find((row) => row.id === "UMB-UTILITIES")).toBeTruthy();
  });
  it("after migration refuses an N phone (and a rollback to N), accepts N+1, and refuses a second racing migration", async () => {
    const before = catalogHousehold();
    const { state, scope } = authority(before);
    const first = await commandFromCapture(capturedIntent(migrateFundModel(before, { memberId: ALEX, at: AT }).household)!, scope, crypto.randomUUID());
    const racing = await commandFromCapture(capturedIntent(migrateFundModel(before, { memberId: SAM, at: AT }).household)!, scope, crypto.randomUUID());
    const done = await prepareCommand(state, { ...first, fundModelVersion: 2 }, scope, () => {});
    const after: AuthorityState = { sequence: done.receipt.sequence, shared: done.shared, personal: new Map([...state.personal, [ALEX, done.personal]]) };
    await expect(prepareCommand(after, { ...racing, fundModelVersion: 2 }, { ...scope, memberId: SAM, subject: "fictional-two" }, () => {})).rejects.toThrow(/already sorted/);
    const n = await commandFromCapture(capturedIntent(grocery(catalogHousehold()).household)!, scope, crypto.randomUUID());
    await expect(prepareCommand(after, n, scope, () => {})).rejects.toThrow("CLIENT_RELOAD_REQUIRED");
    const { fundModelVersion: _drop, ...older } = n;
    await expect(prepareCommand(after, older, scope, () => {})).rejects.toThrow("CLIENT_RELOAD_REQUIRED");
    await expect(prepareCommand(after, { ...n, fundModelVersion: 2 }, scope, () => {})).resolves.toBeTruthy();
    await expect(prepareCommand(after, { ...n, fundModelVersion: 3 }, scope, () => {})).rejects.toThrow("INVALID_COMMAND");
  });
  it("prompts a release-N phone to reload once the household is sorted", () => {
    const h = migrated(catalogHousehold());
    expect(fundModelReloadRequired(catalogHousehold(), 1)).toBe(false);
    expect(fundModelReloadRequired(h, 1)).toBe(true);
    expect(fundModelReloadRequired(h, 2)).toBe(false);
  });
});

describe("adopt on patch: the boot step (slice 4/7)", () => {
  it("does nothing on release N, sorts the household then the member on N+1, and saves a snapshot first", async () => {
    const { fundModelBootStep, saveFundModelSnapshot, fundModelSnapshotKey } = await import("../src/fundModelBoot.ts");
    let h = withPrivateRows(catalogHousehold());
    expect(fundModelBootStep(h, ALEX, 1)).toBeNull();
    const first = fundModelBootStep(h, ALEX, 2)!;
    expect(first.kind).toBe("household");
    const store = new Map<string, string>();
    expect(saveFundModelSnapshot(h, ALEX, { setItem: (k, v) => void store.set(k, v) })).toBe(true);
    expect(JSON.parse(store.get(fundModelSnapshotKey(h, ALEX))!).household.householdId).toBe(h.householdId);
    expect(saveFundModelSnapshot(h, ALEX, { setItem: () => { throw new Error("quota"); } })).toBe(false);
    h = first.run(h).household;
    const second = fundModelBootStep(h, ALEX, 2)!;
    expect(second.kind).toBe("personal");
    h = second.run(h).household;
    expect(fundModelBootStep(h, ALEX, 2)).toBeNull();
    expect(fundModelBootStep(h, "MEM-404", 2)).toBeNull();
    expect(fundModelBootStep(planLifeFixture("household"), ALEX, 2)).toBeNull();
  });
});

describe("the island after sorting (slice 4 side effects)", () => {
  it("names a household vet bill on the weather once it moves to Pets & family (accepted, M1), and keeps Health unnamed", async () => {
    const { pathWeather } = await import("../src/core/pathWeather.ts");
    let h = fundedHousehold();
    for (const [note, subcategoryId, date] of [["Vet visit", "SUB-HEALTH-VET", "2026-09-17"], ["Therapy session", "SUB-HEALTH-THERAPY", "2026-09-18"]] as const) {
      h = addRecurrence(h, { cadence: "monthly", nextDate: date, type: "expense", amount: "80", accountId: "ACC-VISA", subcategoryId, note, fundingDefault: { fundId: h.householdFund!.id, fundedCents: "full", destinationAccountId: "ACC-VISA" } }).household;
    }
    const labels = (x: Household) => pathWeather(x, "2026-09-15").days.map((day) => day.label).join(" | ");
    expect(labels(h)).not.toContain("Vet visit");
    const after = migrated(h);
    expect(labels(after)).toContain("Vet visit");
    expect(labels(after)).not.toContain("Therapy");
  });
  it("does not grow new cottages just because Housing became Home", async () => {
    const { pathCategoryMappings } = await import("../src/core/pathWorld.ts");
    let h = addCategory(catalogHousehold(), { name: "Cleaning supplies", type: "expense", parentId: "CAT-HOUSING" }).household;
    h = addCategory(h, { name: "Pottery", type: "expense", parentId: "CAT-LIFE" }).household;
    const signals = (x: Household) => Object.fromEntries(pathCategoryMappings(x).map((row) => [row.category.id, row.signal]));
    const before = signals(h), after = signals(migrated(h));
    const homeBefore = Object.keys(before).filter((id) => before[id] === "home");
    const homeAfter = Object.keys(after).filter((id) => after[id] === "home");
    expect(homeAfter).toEqual(homeBefore);
    expect(after["SUB-HEALTH-VET"]).toBe("pets");
    expect(Object.keys(after).filter((id) => after[id] !== before[id])).toEqual(Object.keys(after).filter((id) => after[id] !== before[id] && ["pets", "joy", "generosity", "travel"].includes(String(after[id]))));
  });
});
