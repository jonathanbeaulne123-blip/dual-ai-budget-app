import { describe, expect, it } from "vitest";
import {
  HOUSEHOLD_FUND_ID,
  addAccount,
  addGoal,
  bindHouseholdFundBackingAccount,
  catalogHousehold,
  closeBooksMonth,
  compileHousehold,
  configureHouseholdFund,
  confirmHouseholdFundContribution,
  findingsSafeForView,
  ledgerRouteContract,
  postEntry,
  projectLedgerExperience,
  proposeHouseholdFundContribution,
  recordHouseholdFundReconciliation,
  restoreAcceptedSnapshot,
  seedDemoHousehold,
  splitForSync,
} from "../src/core/index.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const DATE = "2026-09-01";

function configuredFund() {
  return configureHouseholdFund(catalogHousehold(), {
    custodianMemberId: BIANCA,
    openedOn: DATE,
    createdBy: BIANCA,
  }).household;
}

function withPrivateBacking(household = configuredFund()) {
  let next = addAccount(household, {
    name: "Bianca savings backing",
    kind: "savings",
    ownerMemberId: BIANCA,
    scope: "personal",
    institution: "Private bank",
    last4: "1234",
  }).household;
  const backing = next.accounts.find((row) => row.name === "Bianca savings backing")!;
  next = bindHouseholdFundBackingAccount(next, { memberId: BIANCA, accountId: backing.id }).household;
  next = recordHouseholdFundReconciliation(next, {
    memberId: BIANCA,
    date: DATE,
    bankTotal: "2500",
    personalRemainder: "2500",
  }).household;
  return { household: next, backingId: backing.id };
}

describe("projectLedgerExperience", () => {
  it("refuses a missing member instead of broadening scope", () => {
    const household = catalogHousehold();
    const result = projectLedgerExperience(household, "MEM-MISSING", "household", DATE);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.reason).toBe("missing-member");
  });

  it("scopes Shared presentation without Personal accounts or private recon", () => {
    const { household, backingId } = withPrivateBacking();
    const result = projectLedgerExperience(household, JONATHAN, "household", DATE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.scopedHousehold.accounts.some((row) => row.id === backingId)).toBe(false);
    expect(result.scopedHousehold.accounts.some((row) => row.scope === "personal")).toBe(false);
    expect(result.scopedHousehold.fundPrivate?.bankBindings).toEqual([]);
    expect(result.scopedHousehold.fundPrivate?.reconciliations).toEqual([]);
    expect(JSON.stringify(result.scopedHousehold)).not.toContain("Private bank");
    expect(JSON.stringify(result.exportHousehold)).not.toContain("Private bank");
    expect(JSON.stringify(result.exportHousehold)).not.toContain("bankTotalCents");
    expect(JSON.stringify(result.herculesHousehold)).not.toContain("Private bank");
    expect(result.custodyDisclosure).toContain("Hearth cannot move it");
    expect(result.capabilities.canConfirmFund).toBe(false);
    expect(result.capabilities.canSeePrivateFundRecon).toBe(false);
  });

  it("scopes Personal presentation to this member’s folio, not the accepted household", () => {
    const { household, backingId } = withPrivateBacking();
    const jonathan = projectLedgerExperience(household, JONATHAN, "personal", DATE);
    const bianca = projectLedgerExperience(household, BIANCA, "personal", DATE);
    expect(jonathan.ok && bianca.ok).toBe(true);
    if (!jonathan.ok || !bianca.ok) return;
    expect(jonathan.scopedHousehold.accounts.some((row) => row.scope !== "personal")).toBe(false);
    expect(jonathan.scopedHousehold.accounts.some((row) => row.id === backingId)).toBe(false);
    expect(bianca.scopedHousehold.accounts.some((row) => row.id === backingId)).toBe(true);
    expect(bianca.capabilities.canSeePrivateFundRecon).toBe(true);
    expect(jonathan.capabilities.canSeePrivateFundRecon).toBe(false);
    expect(JSON.stringify(jonathan.scopedHousehold)).not.toContain("Private bank");
    expect(JSON.stringify(jonathan.exportHousehold)).not.toContain("1234");
  });

  it("lets Personal presentation compile without the accepted Visa rows", () => {
    const household = seedDemoHousehold({ today: DATE });
    const personal = projectLedgerExperience(household, JONATHAN, "personal", DATE);
    if (!personal.ok) throw new Error("expected ok");
    expect(() => compileHousehold(personal.scopedHousehold)).not.toThrow();
    expect(() => compileHousehold(personal.booksHousehold)).not.toThrow();
    expect(personal.booksHousehold.transactions.length).toBeGreaterThan(personal.scopedHousehold.transactions.length);
  });

  it("restores partner Personal rows when a Shared presentation write is persisted", () => {
    const { household, backingId } = withPrivateBacking();
    const shared = projectLedgerExperience(household, JONATHAN, "household", DATE);
    if (!shared.ok) throw new Error("expected ok");
    expect(shared.scopedHousehold.accounts.some((row) => row.id === backingId)).toBe(false);
    const posted = addGoal(shared.scopedHousehold, { name: "Trip jar", target: "100", shared: true });
    expect(posted.household.accounts.some((row) => row.id === backingId)).toBe(false);
    expect(posted.household.goals.some((goal) => goal.name === "Trip jar")).toBe(true);
    const restored = restoreAcceptedSnapshot(shared.booksHousehold, posted.household);
    expect(restored.accounts.some((row) => row.id === backingId)).toBe(true);
    expect(restored.transactions.length).toBe(household.transactions.length);
    expect(restored.goals.some((goal) => goal.name === "Trip jar")).toBe(true);
  });

  it("closes months from the accepted snapshot, not the Personal folio clone", () => {
    const household = seedDemoHousehold({ today: DATE });
    const personal = projectLedgerExperience(household, JONATHAN, "personal", DATE);
    if (!personal.ok) throw new Error("expected ok");
    const closed = closeBooksMonth(personal.booksHousehold, { monthKey: "2026-08", createdBy: JONATHAN });
    expect(closed.household.transactions.length).toBe(household.transactions.length);
    expect(closed.household.kitchen.books.closedMonths.some((row) => row.monthKey === "2026-08")).toBe(true);
  });

  it("keeps Health on the accepted books while redacting Personal facts from Shared findings", () => {
    const household = catalogHousehold();
    const leaked = findingsSafeForView(
      [{ section: "Accounts", message: "Bianca savings backing is missing CAD.", id: "ACC-SECRET" }],
      {
        ...household,
        accounts: [
          ...household.accounts,
          {
            ...household.accounts[0]!,
            id: "ACC-SECRET",
            name: "Bianca savings backing",
            scope: "personal",
            ownerMemberId: BIANCA,
            institution: "Private bank",
            last4: "1234",
          },
        ],
      },
      JONATHAN,
      "household",
    );
    expect(leaked[0]?.message).toContain("Personal account needs review");
    expect(leaked[0]?.message).not.toContain("Bianca savings backing");
  });

  it("does not use split Shared envelopes as a reason to skip Personal denial", () => {
    const { household } = withPrivateBacking();
    const parts = splitForSync(household, JONATHAN);
    expect(JSON.stringify(parts.shared)).not.toContain("Private bank");
    const result = projectLedgerExperience(household, JONATHAN, "household", DATE);
    if (!result.ok) throw new Error("expected ok");
    expect(result.exportHousehold.transactions.every((tx) => tx.visibility !== "personal" || tx.createdBy === JONATHAN)).toBe(true);
  });
});

describe("ledgerRouteContract", () => {
  it("names a distinct purpose for every tab and refuses silent mode ignore", () => {
    const tabs = ["home", "plan", "calendar", "shift", "ledger", "more"] as const;
    for (const tab of tabs) {
      const shared = ledgerRouteContract(tab, "household");
      const personal = ledgerRouteContract(tab, "personal");
      expect(shared.purpose.length).toBeGreaterThan(20);
      expect(personal.purpose.length).toBeGreaterThan(20);
      if (tab !== "shift") expect(shared.heading).not.toBe(personal.heading);
      expect(shared.projector === "shared" || shared.memberSpecific).toBe(true);
    }
    expect(ledgerRouteContract("shift", "household").memberSpecific).toBe(true);
    expect(ledgerRouteContract("shift", "household").purpose).toMatch(/worker-centered/i);
  });
});

describe("Fund-funded personal visibility stays out of Shared presentation", () => {
  it("keeps a personal-visibility Fund purchase out of Jonathan Shared activity", () => {
    let household = configuredFund();
    const proposal = proposeHouseholdFundContribution(household, {
      memberId: BIANCA,
      contributorMemberId: BIANCA,
      amount: "100",
      date: DATE,
    });
    household = confirmHouseholdFundContribution(proposal.household, {
      memberId: BIANCA,
      proposalEventId: proposal.postedIds[0]!,
    }).household;
    household = postEntry(household, {
      date: "2026-09-02",
      type: "expense",
      amount: "80",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      createdBy: JONATHAN,
      visibility: "personal",
      confirmDuplicate: true,
      funding: { fundId: HOUSEHOLD_FUND_ID, fundedCents: 3000, destinationAccountId: "ACC-VISA" },
    }).household;
    const shared = projectLedgerExperience(household, BIANCA, "household", "2026-09-02");
    if (!shared.ok) throw new Error("expected ok");
    expect(shared.scopedHousehold.transactions.some((tx) => tx.visibility === "personal")).toBe(false);
  });
});
