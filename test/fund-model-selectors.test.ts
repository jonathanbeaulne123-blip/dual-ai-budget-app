import { knownCents } from "./fixtures/knownCents.ts";
import { describe, expect, it } from "vitest";
import { addCategory, addRecurrence, catalogHousehold, postEntry, splitForSync } from "../src/core/index.ts";
import { activeHouseholdFundEvents } from "../src/core/householdFund.ts";
import { agreeFundDivision, agreeProtectRefill, declineFundDivision, proposeFundDivision, proposeProtectRefill, withdrawFundProposal } from "../src/core/fundModelCommands.ts";
import { cardPaymentChecks, categoryFilterOptions, fundModelNotice, fundSnapshot, proposedDivision, umbrellaChoices, umbrellaHueForCategory, undividedContributions } from "../src/core/fundModel.ts";
import { addCategory as addCat } from "../src/core/index.ts";
import { migrateFundModel, migrateMyFundModel } from "../src/core/fundModelCommands.ts";
import { projectKittyNest } from "../src/core/kittyNest.ts";
import { ALEX, SAM, TODAY, buffer, contribute, fundBill, fundedHousehold, migrated, reserveGoal } from "./fixtures/fund-model.ts";

function month() {
  let h = fundedHousehold("2000");
  let r = fundBill(h, { note: "Rent", amount: "1500", subcategoryId: "SUB-HOUSING-RENT", day: 25 }); h = r.household;
  r = fundBill(h, { note: "Hydro", amount: "300", subcategoryId: "SUB-HOUSING-ELECTRIC", day: 28 }); h = r.household;
  const trip = reserveGoal(h, "Trip to Halifax", "100", "build"); h = trip.household;
  h = buffer(h, "400");
  return migrated(h);
}
const contributionIds = (h: ReturnType<typeof month>) => activeHouseholdFundEvents(h, h.householdFund!.id).filter((row) => row.kind === "contribution-confirmed").map((row) => row.id);

describe("fundSnapshot (the Plan Studio v3 read)", () => {
  it("returns Now, Prepare coverage with the first short bill, Protect's target, Build goals and a per-day flow", () => {
    const h = month();
    const snap = fundSnapshot(h, { memberId: ALEX, view: "household", today: TODAY });
    expect(snap.mode).toBe(2);
    // King 2000 − 100 kitty pinned = 1900 operating: Prepare wants 1800 (fills), Protect wants 400 (gets 100).
    expect(snap.kingCents).toBe(200000);
    expect(snap.prepare).toMatchObject({ amountCents: 180000, targetCents: 180000, coveredThrough: "2026-09-28" });
    expect(snap.prepare.shortOn).toBeUndefined();
    expect(snap.protect).toMatchObject({ amountCents: 10000, targetCents: 40000 });
    expect(snap.build.amountCents).toBe(10000);
    expect(snap.build.goals.map((row) => row.name)).toEqual(["Trip to Halifax"]);
    expect(snap.now).toBe(0);
    expect(snap.owedBackCents + knownCents(snap.prepare.amountCents) + knownCents(snap.protect.amountCents) + knownCents(snap.build.amountCents) + knownCents(snap.everyday.amountCents)).toBe(snap.kingCents);
    expect(snap.flow.map((row) => [row.date, row.kind, row.fund])).toEqual([
      ["2026-09-01", "contribution", null],
      ["2026-09-25", "bill", "prepare"],
      ["2026-09-28", "bill", "prepare"],
    ]);
    expect(snap.undividedContributions.map((row) => row.amountCents)).toEqual([200000]);
  });
  it("names the first bill Prepare can't cover yet", () => {
    let h = month();
    h = fundBill(h, { note: "Insurance", amount: "500", subcategoryId: "SUB-HOUSING-RENT", day: 27 }).household;
    const snap = fundSnapshot(h, { memberId: ALEX, view: "household", today: TODAY });
    expect(snap.prepare.coveredThrough).toBe("2026-09-25");
    expect(snap.prepare.shortOn).toEqual({ date: "2026-09-27", label: "Insurance", shortCents: 10000 });
    expect(snap.protect.amountCents).toBe(0);
    expect(snap.build.amountCents).toBe(10000);
  });
  it("answers in v1 terms before the household is sorted", () => {
    let h = fundedHousehold("2000");
    h = fundBill(h, { note: "Rent", amount: "1500", subcategoryId: "SUB-HOUSING-RENT" }).household;
    const snap = fundSnapshot(h, { memberId: ALEX, view: "household", today: TODAY });
    expect(snap.mode).toBe(1);
    expect(snap.prepare.bills).toEqual([]);
    expect(snap.undividedContributions).toEqual([]);
    expect(umbrellaChoices(h)).toEqual([]);
    expect(snap.now).toBe(projectKittyNest(h, ALEX, "household", TODAY).categories.find((row) => row.category === "everyday")!.amountCents);
  });
  it("lists the 12 umbrella tiles and filters by the household's own children", () => {
    let h = migrated(catalogHousehold());
    h = addCategory(h, { name: "Pottery", type: "expense", parentId: "UMB-FUN" }).household;
    const tiles = umbrellaChoices(h);
    expect(tiles.map((row) => row.name)).toEqual(["Home", "Utilities", "Food", "Transport", "Health", "Personal", "Fun", "Travel", "Pets & family", "Gifts & giving", "Work & learning", "Money"]);
    expect(tiles.find((row) => row.id === "fun")!.childCount).toBe(2);
    const options = categoryFilterOptions(h, { memberId: ALEX, view: "household" });
    expect(options.find((row) => row.name === "Pottery")).toMatchObject({ own: true, umbrellaId: "fun" });
    expect(options.find((row) => row.name === "Groceries")).toMatchObject({ own: false, umbrellaId: "food" });
    expect(options.some((row) => row.id === "SUB-DEBT-VISA")).toBe(false);
  });
  it("flags card-payment bills privately and never converts them (Q-G)", () => {
    let h = catalogHousehold();
    const card = addRecurrence(h, { cadence: "monthly", nextDate: "2026-09-10", type: "expense", amount: "200", accountId: "ACC-CHEQUING", subcategoryId: "SUB-DEBT-VISA", note: "Visa" });
    h = migrated(card.household);
    expect(cardPaymentChecks(h, { memberId: ALEX, view: "household" })).toEqual([{ recurrenceId: card.postedIds[0], label: "Visa", amountCents: 20000, reason: "legacy-card-category" }]);
    expect(h.recurrences.find((row) => row.id === card.postedIds[0])!.type).toBe("expense");
    expect(JSON.stringify(splitForSync(h, ALEX).shared.fundModelRows)).not.toContain("legacy-card-category");
  });
});

describe("contribution division: both partners confirm (slice 5)", () => {
  it("drafts the split in fill order, needs both partners, and never posts money", () => {
    let h = month();
    const [eventId] = contributionIds(h);
    const draft = proposedDivision(h, eventId!, { memberId: ALEX, today: TODAY });
    if (!draft) throw new Error("Expected a readable division.");
    // Before this 2000 arrived the Fund held nothing to fill with: Prepare needs 1800, Protect takes the rest.
    expect(draft).toEqual({ prepare: 180000, protect: 20000, build: 0, everyday: 0 });
    expect(() => proposeFundDivision(h, { memberId: ALEX, contributionEventId: eventId!, split: { ...draft, everyday: 1 } })).toThrow(/to the cent/);
    expect(() => proposeFundDivision(h, { memberId: ALEX, contributionEventId: "nope", split: draft })).toThrow(/confirmed/);
    const before = { tx: h.transactions.length, events: h.fundEvents!.length };
    const proposed = proposeFundDivision(h, { memberId: ALEX, contributionEventId: eventId!, split: draft });
    expect(proposed.postedIds).toEqual([]);
    h = proposed.household;
    const row = undividedContributions(h, { view: "household", today: TODAY })[0]!;
    expect(row.proposal).toMatchObject({ state: "proposed", agreedBy: [ALEX], revision: 1 });
    expect(() => agreeFundDivision(h, { memberId: ALEX, id: row.proposal!.id, revision: 1 })).toThrow(/partner confirms/);
    expect(() => agreeFundDivision(h, { memberId: SAM, id: row.proposal!.id, revision: 2 })).toThrow(/changed/);
    h = agreeFundDivision(h, { memberId: SAM, id: row.proposal!.id, revision: 1 }).household;
    expect(undividedContributions(h, { view: "household", today: TODAY })).toEqual([]);
    expect({ tx: h.transactions.length, events: h.fundEvents!.length }).toEqual(before);
    expect(() => proposeFundDivision(h, { memberId: SAM, contributionEventId: eventId!, split: draft })).toThrow(/already divided/);
  });
  it("treats the partner proposing the same split as agreement, and a different split as a new revision", () => {
    let h = contribute(month(), SAM, "50", "2026-09-10");
    const eventId = contributionIds(h).at(-1)!;
    const split = { prepare: 0, protect: 5000, build: 0, everyday: 0 };
    h = proposeFundDivision(h, { memberId: ALEX, contributionEventId: eventId, split }).household;
    const other = proposeFundDivision(h, { memberId: SAM, contributionEventId: eventId, split: { ...split, protect: 0, everyday: 5000 } }).household;
    expect(undividedContributions(other, { view: "household", today: TODAY }).at(-1)!.proposal).toMatchObject({ revision: 2, agreedBy: [SAM], proposedBy: SAM });
    const same = proposeFundDivision(h, { memberId: SAM, contributionEventId: eventId, split }).household;
    expect(undividedContributions(same, { view: "household", today: TODAY }).map((row) => row.eventId)).not.toContain(eventId);
    const declined = declineFundDivision(h, { memberId: SAM, id: `FUND-DIV:${eventId}`, revision: 1 }).household;
    expect(undividedContributions(declined, { view: "household", today: TODAY }).at(-1)!.proposal).toBeNull();
    expect(() => withdrawFundProposal(h, { memberId: SAM, id: `FUND-DIV:${eventId}`, revision: 1, kind: "division" })).toThrow(/Only the person/);
  });
});

describe("Protect refill: custodian proposes, partner confirms (slice 10)", () => {
  it("lends the buffer to Build only after the partner confirms, and never more than the buffer", () => {
    let h = fundedHousehold("5000");
    h = fundBill(h, { note: "Rent", amount: "1000", subcategoryId: "SUB-HOUSING-RENT" }).household;
    h = buffer(h, "600");
    h = migrated(h);
    expect(() => proposeProtectRefill(h, { memberId: SAM, monthKey: "2026-09", toFund: "build", amountCents: 20000 })).toThrow(/custodian/);
    expect(() => proposeProtectRefill(h, { memberId: ALEX, monthKey: "2026-09", toFund: "prepare" as never, amountCents: 20000 })).toThrow(/Prepare already fills/);
    h = proposeProtectRefill(h, { memberId: ALEX, monthKey: "2026-09", toFund: "build", amountCents: 90000, note: "Trip deposit" }).household;
    const nest = () => projectKittyNest(h, ALEX, "household", TODAY).allocation!;
    expect(nest().amounts.protect).toBe(60000);
    const row = h.fundModelRows!.find((item) => item.kind === "refill")!;
    expect(() => agreeProtectRefill(h, { memberId: ALEX, id: row.id, revision: 1 })).toThrow(/partner confirms/);
    const events = h.fundEvents!.length;
    h = agreeProtectRefill(h, { memberId: SAM, id: row.id, revision: 1 }).household;
    expect(nest().amounts.protect).toBe(0);
    expect(nest().desired.build).toBe(60000);
    expect(h.fundEvents!.length).toBe(events);
    expect(fundSnapshot(h, { memberId: ALEX, view: "household", today: TODAY }).protect.refills.map((item) => item.state)).toEqual(["confirmed"]);
  });
});

it("does not count an unrelated personal posting in the household Now", () => {
  const h = month();
  const before = fundSnapshot(h, { memberId: ALEX, view: "household", today: TODAY }).now;
  const after = postEntry(h, { type: "expense", date: "2026-09-10", amount: "30", accountId: "ACC-VISA", subcategoryId: "SUB-FOOD-GROCERIES", createdBy: ALEX, visibility: "household" }).household;
  expect(fundSnapshot(after, { memberId: ALEX, view: "household", today: TODAY }).now).toBe(before);
});

it("names whose phone sorted the household, lists Needs a home, and gives hues by umbrella id", () => {
  let h = addCat(catalogHousehold(), { name: "Zorblax", type: "expense", parentId: "__new__", newGroupName: "Mystery" }).household;
  expect(fundModelNotice(h, { memberId: ALEX })).toBeNull();
  h = migrateFundModel(h, { memberId: SAM, at: "2026-09-16T00:00:00.000Z" }).household;
  const name = h.members.find((row) => row.id === SAM)!.name;
  const notice = fundModelNotice(h, { memberId: ALEX })!;
  expect(notice.title).toBe("Hearth sorted our money the new way");
  expect(notice.body).toContain(`Sorted on ${name}'s phone`);
  expect(notice.body).toContain("One category needs a home");
  expect(notice.body).not.toMatch(/\bwe sorted\b/i);
  expect(notice.needsHome.map((row) => row.name)).toEqual(["Zorblax"]);
  expect(notice.mine).toBe("waiting");
  expect(fundModelNotice(migrateMyFundModel(h, { memberId: ALEX }).household, { memberId: ALEX })!.mine).toBe("sorted");
  expect(umbrellaHueForCategory(h, "SUB-HEALTH-VET")).toBe("#b08a4f");
  expect(umbrellaHueForCategory(h, "nope")).toBeNull();
});
