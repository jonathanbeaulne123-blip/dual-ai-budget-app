import { type DateKey } from "./calendar.ts";
import { sha256Hex } from "./commandIdentity.ts";
import { postEntry, reversePostedMoney } from "./commands.ts";
import { booksEquation, compileHousehold, trialBalance } from "./journal.ts";
import { catalogHousehold } from "./seed.ts";

export type CorrectionPracticeProof = {
  version: 1;
  memberId: string;
  receiptId: string;
  fictional: true;
  discarded: true;
  date: DateKey;
  mistakeCents: 4500;
  mistakeEntryCount: number;
  reversalEntryCount: number;
  trialInBalance: boolean;
  equationHolds: boolean;
  netIncomeCents: number;
  persistedIds: [];
};

/**
 * Runs the real posting, reversal, and journal compiler against a throwaway
 * fictional household. Only this proof object escapes; the practice household
 * is never returned to persistence or continuity.
 */
export async function runMonthRehearsalCorrectionPractice(input: {
  date: DateKey;
  memberId?: string;
}): Promise<CorrectionPracticeProof> {
  const practice = catalogHousehold("development");
  practice.householdId = "HH-FICTIONAL-CORRECTION-PRACTICE";
  practice.transactions = [];
  practice.shifts = [];
  practice.goalContributions = [];
  practice.goalPurchases = [];
  practice.fundEvents = [];
  practice.fundSettlementAllocations = [];
  practice.fundKittyAllocations = [];
  practice.commandReceipts = [];
  practice.activity = [];
  practice.kitchen.books.reconciliations = [];
  practice.kitchen.books.closedMonths = [];
  const memberId = input.memberId ?? "MEM-001";
  const practiceActorId = practice.members.find((member) => member.active)?.id ?? "MEM-001";
  const mistaken = postEntry(practice, {
    date: input.date,
    type: "expense",
    amount: 45,
    accountId: "ACC-CHEQUING",
    subcategoryId: "SUB-FOOD-GROCERIES",
    note: "Fictional practice mistake",
    createdBy: practiceActorId,
    visibility: "household",
    confirmDuplicate: true,
  });
  const reversed = reversePostedMoney(mistaken.household, mistaken.postedIds[0]!, {
    createdBy: practiceActorId,
    visibility: "household",
    reversalDate: input.date,
  });
  const books = compileHousehold(reversed.household);
  const trial = trialBalance(books, { recognizedOnly: true });
  const equation = booksEquation(books);
  const stableProof = {
    version: 1 as const,
    memberId,
    fictional: true as const,
    discarded: true as const,
    date: input.date,
    mistakeCents: 4500 as const,
    mistakeEntryCount: compileHousehold(mistaken.household).entries.length,
    reversalEntryCount: books.entries.length,
    trialInBalance: trial.inBalance,
    equationHolds: equation.holds,
    netIncomeCents: equation.netIncomeCents,
    persistedIds: [] as [],
  };
  const digest = await sha256Hex(stableProof);
  return { receiptId: `PRACTICE-${digest.slice(0, 20).toUpperCase()}`, ...stableProof };
}
