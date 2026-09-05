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

export type PracticeRealDraft = {
  kind: "expense";
  amountCents: 4500;
  date: DateKey;
  note: "Groceries";
  requiresReviewAndConfirm: true;
  practiceReceiptId: string;
};

/** Defensive receipt check for a proof that crossed an async UI boundary. */
export function isCorrectionPracticeProof(
  value: unknown,
  memberId: string,
  date: DateKey,
): value is CorrectionPracticeProof {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<CorrectionPracticeProof>;
  return row.version === 1
    && row.memberId === memberId
    && row.date === date
    && row.fictional === true
    && row.discarded === true
    && row.mistakeCents === 4500
    && row.mistakeEntryCount === 1
    && row.reversalEntryCount === 2
    && row.trialInBalance === true
    && row.equationHolds === true
    && row.netIncomeCents === 0
    && Array.isArray(row.persistedIds)
    && row.persistedIds.length === 0
    && typeof row.receiptId === "string"
    && /^PRACTICE-[A-F0-9]{20}$/.test(row.receiptId);
}

/**
 * Practice can prefill review, never accepted books. The returned value has
 * no id, command, or posting authority; the ordinary Add flow must still
 * collect review and Confirm before it becomes real.
 */
export function practiceProofToRealDraft(proof: CorrectionPracticeProof): PracticeRealDraft {
  if (!isCorrectionPracticeProof(proof, proof.memberId, proof.date)) {
    throw new Error("Finish the isolated Practice correction before making a draft.");
  }
  return {
    kind: "expense",
    amountCents: 4500,
    date: proof.date,
    note: "Groceries",
    requiresReviewAndConfirm: true,
    practiceReceiptId: proof.receiptId,
  };
}

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
