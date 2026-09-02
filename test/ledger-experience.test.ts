import { describe, expect, it } from "vitest";
import {
  HOUSEHOLD_FUND_ID,
  addAccount,
  addGoal,
  addRecurrence,
  bindHouseholdFundBackingAccount,
  buildSharedLedgerStory,
  catalogHousehold,
  closeBooksMonth,
  compileHousehold,
  configureHouseholdFund,
  confirmHouseholdFundContribution,
  creditCardView,
  findingsSafeForView,
  kitchenPrimaryNav,
  ledgerRouteContract,
  personalBooksFloor,
  postCardInterest,
  postEntry,
  JOINT,
  postDueRecurrences,
  projectHouseholdFund,
  projectLedgerExperience,
  proposeHouseholdFundContribution,
  recordHouseholdFundReconciliation,
  restoreAcceptedSnapshot,
  seedDemoHousehold,
  sitDownPreview,
  splitForSync,
  walletForListedAccounts,
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

  it("gives Personal Books household-visible rooms without partner-personal envelopes", () => {
    const { household, backingId } = withPrivateBacking();
    const floor = personalBooksFloor(household, JONATHAN);
    expect(floor.accounts.some((row) => row.id === "ACC-CHEQUING" || row.kind === "chequing")).toBe(true);
    expect(floor.accounts.some((row) => row.id === backingId)).toBe(false);
    expect(floor.accounts.some((row) => row.scope === "personal" && row.ownerMemberId === BIANCA)).toBe(false);
    expect(floor.fundPrivate?.reconciliations ?? []).toEqual([]);
    expect(JSON.stringify(floor)).not.toContain("Private bank");
    expect(JSON.stringify(floor)).not.toContain("bankTotalCents");
    expect(JSON.stringify(floor)).not.toContain("1234");
    const experience = projectLedgerExperience(household, JONATHAN, "personal", DATE);
    if (!experience.ok) throw new Error("expected ok");
    expect(experience.scopedHousehold.accounts.some((row) => row.id === backingId)).toBe(false);
    expect(experience.scopedHousehold.accounts.some((row) => row.scope !== "personal")).toBe(false);
  });

  it("keeps partner-personal goals and recurrences off the Personal Books floor clone", () => {
    let { household, backingId } = withPrivateBacking();
    household = addGoal(household, {
      name: "Bianca secret trip",
      target: 400,
      shared: false,
      ownerMemberId: BIANCA,
    }).household;
    household = addGoal(household, {
      name: "Jonathan bike",
      target: 200,
      shared: false,
      ownerMemberId: JONATHAN,
    }).household;
    household = addGoal(household, {
      name: "Shared trip",
      target: 800,
      shared: true,
    }).household;
    household = addRecurrence(household, {
      cadence: "monthly",
      nextDate: DATE,
      type: "expense",
      amount: 15,
      accountId: backingId,
      subcategoryId: "SUB-LIFE-FUN",
      note: "Bianca secret due",
    }).household;
    const floor = personalBooksFloor(household, JONATHAN);
    expect(floor.goals.some((goal) => goal.name === "Bianca secret trip")).toBe(false);
    expect(floor.goals.some((goal) => goal.name === "Jonathan bike")).toBe(true);
    expect(floor.goals.some((goal) => goal.name === "Shared trip" && goal.shared)).toBe(true);
    expect(floor.recurrences.some((row) => row.note === "Bianca secret due")).toBe(false);
    expect(floor.recurrences.some((row) => row.accountId === backingId)).toBe(false);
    expect(floor.goalContributions.some((row) => (
      household.goals.find((goal) => goal.id === row.goalId)?.name === "Bianca secret trip"
    ))).toBe(false);
  });

  it("lets Personal Books include household-visibility posts on shared rooms", () => {
    let household = catalogHousehold();
    household = postEntry(household, {
      date: DATE,
      type: "expense",
      amount: 40,
      accountId: "ACC-VISA",
      subcategoryId: "SUB-LIFE-FUN",
      note: "Shared dinner",
      splits: [{ party: JOINT, amountCents: 4000 }],
      createdBy: BIANCA,
      visibility: "household",
      confirmDuplicate: true,
    }).household;
    household = postEntry(household, {
      date: DATE,
      type: "expense",
      amount: 12,
      accountId: "ACC-VISA",
      subcategoryId: "SUB-LIFE-FUN",
      note: "Bianca secret",
      splits: [{ party: BIANCA, amountCents: 1200 }],
      createdBy: BIANCA,
      visibility: "personal",
      confirmDuplicate: true,
    }).household;
    const floor = personalBooksFloor(household, JONATHAN);
    expect(floor.accounts.some((row) => row.id === "ACC-VISA")).toBe(true);
    expect(floor.transactions.some((tx) => tx.note === "Shared dinner")).toBe(true);
    expect(floor.transactions.some((tx) => tx.note === "Bianca secret")).toBe(false);
    const scoped = projectLedgerExperience(household, JONATHAN, "personal", DATE);
    if (!scoped.ok) throw new Error("expected ok");
    expect(scoped.scopedHousehold.transactions.some((tx) => tx.note === "Shared dinner")).toBe(false);
    const demo = seedDemoHousehold({ today: DATE });
    const demoFloor = personalBooksFloor(demo, JONATHAN);
    expect(demoFloor.accounts.some((row) => row.id === "ACC-CHEQUING")).toBe(true);
    expect(demoFloor.accounts.some((row) => row.id === "ACC-VISA")).toBe(true);
    expect(demoFloor.accounts.some((row) => row.id === "ACC-TFSA" && row.institution === "Wealthsimple")).toBe(true);
  });

  it("keeps Personal Books room CAD and interest Confirm on accepted books, not the floor clone", () => {
    const postedOn = "2026-08-15";
    let household = catalogHousehold();
    household = postEntry(household, {
      date: postedOn,
      type: "expense",
      amount: 500,
      accountId: "ACC-VISA",
      subcategoryId: "SUB-LIFE-FUN",
      note: "Shared dinner",
      splits: [{ party: JOINT, amountCents: 50_000 }],
      createdBy: BIANCA,
      visibility: "household",
      confirmDuplicate: true,
    }).household;
    household = postEntry(household, {
      date: postedOn,
      type: "expense",
      amount: 400,
      accountId: "ACC-VISA",
      subcategoryId: "SUB-LIFE-FUN",
      note: "Bianca secret",
      splits: [{ party: BIANCA, amountCents: 40_000 }],
      createdBy: BIANCA,
      visibility: "personal",
      confirmDuplicate: true,
    }).household;
    const visa = household.accounts.find((row) => row.id === "ACC-VISA");
    if (!visa) throw new Error("expected Visa");
    const floor = personalBooksFloor(household, JONATHAN);
    const accepted = creditCardView(household, visa, DATE);
    const clone = creditCardView(floor, visa, DATE);
    expect(clone.owedCents).toBeLessThan(accepted.owedCents);
    expect(accepted.estimatedInterestCents).toBeGreaterThan(0);
    expect(clone.estimatedInterestCents).not.toBe(accepted.estimatedInterestCents);
    const listed = walletForListedAccounts(household, floor.accounts.map((account) => account.id), DATE);
    const tile = listed.tiles.find((row) => row.account.id === "ACC-VISA");
    expect(tile?.credit?.owedCents).toBe(accepted.owedCents);
    expect(tile?.credit?.estimatedInterestCents).toBe(accepted.estimatedInterestCents);
    expect(listed.tiles.some((row) => row.account.scope === "personal" && row.account.ownerMemberId === BIANCA)).toBe(false);
    const posted = postCardInterest(household, { accountId: "ACC-VISA", date: DATE, createdBy: JONATHAN, confirmDuplicate: true });
    expect(posted.postedIds.length).toBeGreaterThan(0);
    const interest = posted.household.transactions.find((tx) => tx.id === posted.postedIds[0]);
    expect(interest?.amountCents).toBe(accepted.estimatedInterestCents);
  });

  it("lets Personal presentation compile without the accepted Visa rows", () => {
    const household = seedDemoHousehold({ today: DATE });
    const personal = projectLedgerExperience(household, JONATHAN, "personal", DATE);
    if (!personal.ok) throw new Error("expected ok");
    expect(() => compileHousehold(personal.scopedHousehold)).not.toThrow();
    expect(() => compileHousehold(personal.booksHousehold)).not.toThrow();
    expect(personal.booksHousehold.transactions.length).toBeGreaterThan(personal.scopedHousehold.transactions.length);
  });

  it("compiles Shared sit-down leftover and Visa owed from accepted books, not the presentation clone", () => {
    let household = catalogHousehold();
    household = postEntry(household, {
      date: DATE,
      type: "expense",
      amount: 42,
      accountId: "ACC-VISA",
      subcategoryId: "SUB-LIFE-FUN",
      note: "Haircut",
      splits: [{ party: BIANCA, amountCents: 4200 }],
      createdBy: BIANCA,
      visibility: "personal",
      confirmDuplicate: true,
    }).household;
    household = postEntry(household, {
      date: DATE,
      type: "expense",
      amount: 28.5,
      accountId: "ACC-VISA",
      subcategoryId: "SUB-LIFE-FUN",
      note: "Gym drop-in",
      splits: [{ party: JONATHAN, amountCents: 2850 }],
      createdBy: JONATHAN,
      visibility: "personal",
      confirmDuplicate: true,
    }).household;
    const shared = projectLedgerExperience(household, JONATHAN, "household", DATE);
    if (!shared.ok) throw new Error("expected ok");
    const visa = household.accounts.find((row) => row.id === "ACC-VISA");
    const scopedVisa = shared.scopedHousehold.accounts.find((row) => row.id === "ACC-VISA");
    if (!visa || !scopedVisa) throw new Error("expected Visa");
    expect(creditCardView(shared.booksHousehold, visa, DATE).owedCents
      - creditCardView(shared.scopedHousehold, scopedVisa, DATE).owedCents).toBe(7050);
    const funSuggested = (books: typeof household) => (
      sitDownPreview(books, "2026-09").rows.find((row) => row.subcategoryId === "SUB-LIFE-FUN")?.suggestedCents ?? 0
    );
    expect(funSuggested(shared.booksHousehold)).toBeGreaterThan(funSuggested(shared.scopedHousehold));
    expect(compileHousehold(shared.booksHousehold).entries.length)
      .toBeGreaterThan(compileHousehold(shared.scopedHousehold).entries.length);
  });

  it("reserves Fund-backed personal-scope recurrences on accepted books, not Shared presentation", () => {
    const { household: seeded, backingId } = withPrivateBacking();
    const household = addRecurrence(seeded, {
      cadence: "monthly",
      nextDate: DATE,
      type: "expense",
      amount: 50,
      accountId: backingId,
      subcategoryId: "SUB-LIFE-FUN",
      note: "Personal Fund-backed",
      fundingDefault: { fundId: HOUSEHOLD_FUND_ID, fundedCents: "full", destinationAccountId: "ACC-VISA" },
    }).household;
    const shared = projectLedgerExperience(household, JONATHAN, "household", DATE);
    if (!shared.ok) throw new Error("expected ok");
    const accepted = projectHouseholdFund(shared.booksHousehold, DATE);
    const scoped = projectHouseholdFund(shared.scopedHousehold, DATE);
    expect(accepted.upcomingReserveCents).toBe(5000);
    expect(scoped.upcomingReserveCents).toBe(0);
    expect(accepted.freeToSpendCents).toBe(scoped.freeToSpendCents - 5000);
    expect(buildSharedLedgerStory(shared.booksHousehold, DATE).opening.upcomingReserveCents).toBe(5000);
  });

  it("posts only Shared-visible due recurrences so a hidden Personal row cannot void Confirm", () => {
    const { household: seeded, backingId } = withPrivateBacking();
    let household = addRecurrence(seeded, {
      cadence: "monthly",
      nextDate: DATE,
      type: "expense",
      amount: 10,
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-LIFE-FUN",
      note: "Shared due",
    }).household;
    household = addRecurrence(household, {
      cadence: "monthly",
      nextDate: DATE,
      type: "expense",
      amount: 50,
      accountId: backingId,
      subcategoryId: "SUB-LIFE-FUN",
      note: "Personal Fund-backed",
      fundingDefault: { fundId: HOUSEHOLD_FUND_ID, fundedCents: "full", destinationAccountId: "ACC-VISA" },
    }).household;
    const shared = projectLedgerExperience(household, JONATHAN, "household", DATE);
    if (!shared.ok) throw new Error("expected ok");
    const visibleIds = shared.scopedHousehold.recurrences
      .filter((item) => item.active && item.nextDate <= DATE)
      .map((item) => item.id);
    expect(visibleIds.length).toBeGreaterThan(0);
    expect(() => postDueRecurrences(shared.booksHousehold, DATE)).toThrow(/Personal account/);
    const posted = postDueRecurrences(shared.booksHousehold, DATE, visibleIds);
    expect(posted.postedIds.length).toBeGreaterThan(0);
    expect(posted.household.recurrences.find((item) => item.accountId === backingId)?.nextDate).toBe(DATE);
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
    expect(ledgerRouteContract("ledger", "household").heading).toMatch(/Household table/i);
    expect(kitchenPrimaryNav("household")).toEqual(["home", "calendar", "plan", "more"]);
    expect(kitchenPrimaryNav("personal")).toEqual(["home", "calendar", "shift", "ledger", "plan", "more"]);
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
      createdBy: BIANCA,
      visibility: "personal",
      confirmDuplicate: true,
      funding: { fundId: HOUSEHOLD_FUND_ID, fundedCents: 3000, destinationAccountId: "ACC-VISA" },
    }).household;
    const shared = projectLedgerExperience(household, BIANCA, "household", "2026-09-02");
    if (!shared.ok) throw new Error("expected ok");
    expect(shared.scopedHousehold.transactions.some((tx) => tx.visibility === "personal")).toBe(false);
  });
});
