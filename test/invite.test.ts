import { describe, expect, it } from "vitest";
import {
  formatInvitePhrase,
  inviteFromLocation,
  inviteFromText,
  isValidInviteToken,
  joinUrlFor,
  randomInvitePhrase,
} from "../src/core/invite.ts";
import { applyHearthPass, makeHearthPass, parseHearthPass } from "../src/core/pass.ts";
import { catalogHousehold } from "../src/core/seed.ts";
import {
  addGoal,
  configureHouseholdFund,
  contributeToGoal,
  postEntry,
  proposeHouseholdFundContribution,
} from "../src/core/commands.ts";

describe("household invite phrases", () => {
  it("creates a three-word kitchen phrase instead of a six-character code", () => {
    const phrase = randomInvitePhrase();
    expect(isValidInviteToken(phrase)).toBe(true);
    expect(phrase.split("-")).toHaveLength(3);
    expect(formatInvitePhrase(phrase)).toMatch(/ · /);
  });

  it("accepts spoken spacing, a join URL, and a leftover six-character code", () => {
    const phrase = "cedar lantern maple";
    expect(inviteFromText(phrase)).toBe("cedar-lantern-maple");
    expect(inviteFromText("Cedar, lantern, maple!")).toBe("cedar-lantern-maple");
    expect(inviteFromText("https://hearth.example/?join=cedar-lantern-maple")).toBe("cedar-lantern-maple");
    expect(inviteFromText("https://hearth.example/join/maple-hearth-linen")).toBe("maple-hearth-linen");
    expect(isValidInviteToken("K7M2PS")).toBe(true);
    expect(inviteFromText("k7m-2ps")).toBe("K7M2PS");
    expect(isValidInviteToken("cedar lantern maple")).toBe(true);
    expect(isValidInviteToken("not a household")).toBe(false);
  });

  it("reads a join token from the page location", () => {
    expect(inviteFromLocation("https://hearth-books.jonathan-beaulne123.workers.dev/?join=cedar-lantern-maple")).toBe("cedar-lantern-maple");
    expect(inviteFromLocation("https://hearth-books.pages.dev/?join=cedar-lantern-maple")).toBe("cedar-lantern-maple");
    expect(inviteFromLocation("https://hearth-books.example.workers.dev/?join=cedar-lantern-maple")).toBe("cedar-lantern-maple");
    expect(joinUrlFor("cedar lantern maple", "https://hearth.example")).toBe("https://hearth.example/?join=cedar-lantern-maple");
  });
});

describe("Hearth Pass", () => {
  it("shares household rows and keeps personal rows off the pass", () => {
    let household = catalogHousehold();
    household = postEntry(household, {
      date: "2026-08-18",
      type: "expense",
      amount: "12.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Shared milk",
      createdBy: "MEM-002",
      visibility: "household",
      confirmDuplicate: true,
    }).household;
    household = postEntry(household, {
      date: "2026-08-18",
      type: "expense",
      amount: "9.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-LIFE-FUN",
      note: "Jonathan only",
      createdBy: "MEM-002",
      visibility: "personal",
      confirmDuplicate: true,
    }).household;

    const pass = makeHearthPass(household);
    expect(pass.kind).toBe("hearth-pass");
    expect(pass.shared.transactions.map((tx) => tx.note)).toEqual(["Shared milk"]);
    const parsed = parseHearthPass(JSON.stringify(pass));
    const joined = applyHearthPass(null, parsed, "MEM-001");
    expect(joined.transactions.map((tx) => tx.note)).toEqual(["Shared milk"]);
    expect(joined.transactions.some((tx) => tx.note === "Jonathan only")).toBe(false);
    expect(joined.members.map((member) => member.name).sort()).toEqual(["Bianca", "Jonathan"]);
    expect(joined.linked).toBe(false);
  });

  it("keeps both people's local personal rows when a Hearth Pass updates the shared envelope", () => {
    let household = catalogHousehold();
    household = postEntry(household, {
      date: "2026-08-18",
      type: "expense",
      amount: "12.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Shared milk",
      createdBy: "MEM-002",
      visibility: "household",
      confirmDuplicate: true,
    }).household;
    household = postEntry(household, {
      date: "2026-08-18",
      type: "expense",
      amount: "9.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-LIFE-FUN",
      note: "Jonathan only",
      createdBy: "MEM-002",
      visibility: "personal",
      confirmDuplicate: true,
    }).household;
    household = postEntry(household, {
      date: "2026-08-18",
      type: "expense",
      amount: "14.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-LIFE-FUN",
      note: "Bianca only",
      createdBy: "MEM-001",
      visibility: "personal",
      confirmDuplicate: true,
    }).household;
    const pass = makeHearthPass(household);
    expect(pass.shared.transactions.some((tx) => tx.visibility === "personal")).toBe(false);
    const joined = applyHearthPass(household, pass, "MEM-002");
    expect(joined.transactions.map((tx) => tx.note).sort()).toEqual(["Bianca only", "Jonathan only", "Shared milk"]);
  });

  it("refuses to last-write-wins a different shared journal", () => {
    let household = catalogHousehold();
    household = postEntry(household, {
      date: "2026-08-18",
      type: "expense",
      amount: "12.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Shared milk",
      createdBy: "MEM-002",
      visibility: "household",
      confirmDuplicate: true,
    }).household;
    const pass = makeHearthPass(household);
    const other = postEntry(household, {
      date: "2026-08-18",
      type: "expense",
      amount: "8.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Shared bread",
      createdBy: "MEM-002",
      visibility: "household",
      confirmDuplicate: true,
    }).household;
    expect(() => applyHearthPass(other, pass, "MEM-001")).toThrow(/different journal facts/);
    expect(other.transactions.some((row) => row.note === "Shared bread")).toBe(true);
  });

  it("refuses a Pass from another environment", () => {
    const household = catalogHousehold();
    const pass = makeHearthPass({ ...household, environment: "development" });
    expect(() => applyHearthPass(null, pass, "MEM-001", "production")).toThrow(/different environment/);
  });

  it("refuses to last-write-wins a later Household Fund contribution", () => {
    const funded = configureHouseholdFund(catalogHousehold(), {
      custodianMemberId: "MEM-001",
      openedOn: "2026-08-01",
      createdBy: "MEM-001",
    }).household;
    const pass = makeHearthPass(funded);
    const contributed = proposeHouseholdFundContribution(funded, {
      memberId: "MEM-002",
      contributorMemberId: "MEM-002",
      amount: "40",
      date: "2026-08-25",
      source: {
        version: 1,
        kind: "external-received",
        explanation: "E-transfer into shared savings",
      },
    }).household;
    expect(() => applyHearthPass(contributed, pass, "MEM-001")).toThrow(/different journal facts/);
    expect(contributed.fundEvents?.some((event) => event.kind === "contribution-proposed" && event.amountCents === 4000)).toBe(true);
  });

  it("refuses to last-write-wins a later shared goal contribution", () => {
    const withGoal = addGoal(catalogHousehold(), { name: "Trip", target: "100.00" }).household;
    const pass = makeHearthPass(withGoal);
    const contributed = contributeToGoal(withGoal, withGoal.goals[0]!.id, "25.00", {
      createdBy: "MEM-001",
      date: "2026-08-25",
    }).household;
    expect(() => applyHearthPass(contributed, pass, "MEM-001")).toThrow(/different journal facts/);
    expect(contributed.goalContributions.some((row) => row.amountCents === 2500)).toBe(true);
  });
});
