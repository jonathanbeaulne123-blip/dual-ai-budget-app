import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  HOUSEHOLD_FUND_ID,
  catalogHousehold,
  configureHouseholdFund,
  confirmHouseholdFundContribution,
  postEntry,
  proposeHouseholdFundContribution,
  type Household,
} from "../src/core/index.ts";
import { clerkReading } from "../src/core/clerkReading.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const SINCE = "2026-09-01";
const TODAY = "2026-09-12";
const PROPOSAL_LANGUAGE = /\b(should|need to|recommend|suggest)\b/i;
const WORK_INSTRUCTION = /\b(shift|hours|work more)\b/i;
const MONEY_WRITER = /(?:from\s+["'][^"']*(?:commands|commandRuntime|core\/index|ledger\/engine|storage|supabase)[^"']*["']|\b(?:postEntry|postTransfer|postWorkShift|confirmHouseholdFundContribution|acceptHouseholdWrite|reversePostedMoney|commit|runKitchen)\s*\()/i;

function postSyntheticActivity(): Household {
  let household = catalogHousehold();
  household = postEntry(household, {
    date: "2026-09-03",
    type: "income",
    amount: "2100",
    accountId: "ACC-CHEQUING",
    subcategoryId: "SUB-INCOME-WAGES",
    createdBy: BIANCA,
    visibility: "household",
    confirmDuplicate: true,
  }).household;
  return postEntry(household, {
    date: "2026-09-05",
    type: "expense",
    amount: "92.40",
    accountId: "ACC-VISA",
    subcategoryId: "SUB-FOOD-GROCERIES",
    createdBy: JONATHAN,
    visibility: "household",
    confirmDuplicate: true,
  }).household;
}

function postSyntheticFundMonth(): Household {
  let household = configureHouseholdFund(catalogHousehold(), {
    custodianMemberId: BIANCA,
    openedOn: SINCE,
    createdBy: BIANCA,
  }).household;
  const proposed = proposeHouseholdFundContribution(household, {
    memberId: JONATHAN,
    contributorMemberId: JONATHAN,
    amount: "150",
    date: "2026-09-02",
  });
  household = confirmHouseholdFundContribution(proposed.household, {
    memberId: BIANCA,
    proposalEventId: proposed.postedIds[0]!,
  }).household;
  household = postEntry(household, {
    date: "2026-09-06",
    type: "expense",
    amount: "120",
    accountId: "ACC-VISA",
    subcategoryId: "SUB-FOOD-GROCERIES",
    createdBy: BIANCA,
    visibility: "household",
    confirmDuplicate: true,
    funding: {
      fundId: HOUSEHOLD_FUND_ID,
      fundedCents: 12000,
      destinationAccountId: "ACC-VISA",
    },
  }).household;
  return proposeHouseholdFundContribution(household, {
    memberId: JONATHAN,
    contributorMemberId: JONATHAN,
    amount: "40",
    date: TODAY,
  }).household;
}

function clerkOwnedSourcePaths(directory = join(process.cwd(), "src")): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...clerkOwnedSourcePaths(path));
    else if (/^clerk.*\.(?:ts|tsx)$/i.test(entry.name)) files.push(path);
  }
  return files.sort();
}

describe("Clerk proposal and write fences", () => {
  it.each([
    ["empty record", () => catalogHousehold()],
    ["posted household activity", postSyntheticActivity],
    ["confirmed Fund month", postSyntheticFundMonth],
  ])("keeps every %s reading cited, descriptive, and free of work instructions", (_name, build) => {
    const reading = clerkReading(build(), SINCE, TODAY);
    for (const sentence of reading.sentences) {
      expect(sentence.transactionIds.length + sentence.fundEventIds.length).toBeGreaterThan(0);
      expect(sentence.text).not.toMatch(PROPOSAL_LANGUAGE);
      expect(sentence.text).not.toMatch(WORK_INSTRUCTION);
    }
  });

  it("keeps every Clerk-owned source outside advice and money-writing paths", () => {
    const paths = clerkOwnedSourcePaths();
    expect(paths.map((path) => relative(process.cwd(), path).replaceAll("\\", "/"))).toEqual([
      "src/ClerkReading.tsx",
      "src/core/clerkReading.ts",
    ]);
    for (const path of paths) {
      const source = readFileSync(path, "utf8");
      expect(source).not.toMatch(PROPOSAL_LANGUAGE);
      expect(source).not.toMatch(WORK_INSTRUCTION);
      expect(source).not.toMatch(MONEY_WRITER);
    }
  });

  it("makes the Clerk fence part of the build-level AI verifier", () => {
    const verifier = readFileSync(join(process.cwd(), "scripts/verify-ai-surface.mjs"), "utf8");
    expect(verifier).toContain("clerkOwned");
    expect(verifier).toContain("clerkAdvice");
    expect(verifier).toContain("clerkWorkInstruction");
    expect(verifier).toContain("clerkMoneyWriter");
    expect(verifier).toContain("reaches a money-writing code path");
  });
});
