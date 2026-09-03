import { claimPublicLabel, claimRemainingCents, outstandingClaims } from "./appointments.ts";
import { isValidDateKey, type DateKey } from "./calendar.ts";
import { projectHouseholdFund, shapeHouseholdFundConfig } from "./householdFund.ts";
import type { Household, Transaction } from "./types.ts";

export type SettleOut = {
  destinationAccountId: string;
  name: string;
  dueCents: number;
  creditCents: number;
  transactionIds: string[];
  oldestDate: DateKey;
};

export type SettleIn = {
  claimId: string;
  label: string;
  remainingCents: number;
  sinceDate: DateKey;
};

export type SettleView = {
  out: SettleOut[];
  in: SettleIn[];
  outTotalCents: number;
  inTotalCents: number;
  custodianCanSettle: boolean;
};

function transactionForPosition(household: Household, positionId: string): Transaction | undefined {
  return household.transactions.find((transaction) => (
    transaction.id === positionId || transaction.funding?.positionId === positionId
  ));
}

function safeDate(value: string | undefined, fallback: DateKey): DateKey {
  return value && isValidDateKey(value) ? value : fallback;
}

/**
 * The two settlement directions, kept separate. Destination amounts come
 * verbatim from the authoritative Fund projection; claim amounts come from
 * the existing receivable fold. This view never nets them or recomputes a
 * Fund position.
 */
export function settleView(household: Household, memberId: string, today: DateKey): SettleView {
  const projection = projectHouseholdFund(household, today);
  const fund = shapeHouseholdFundConfig(household.householdFund);
  const accountById = new Map(household.accounts.map((account) => [account.id, account]));

  const out = projection.destinationPositions
    .filter((position) => position.dueCents > 0 || position.creditCents > 0)
    .flatMap((position): SettleOut[] => {
      const account = accountById.get(position.destinationAccountId);
      // Settlement destinations are Shared by command law. If malformed or
      // historical data names a Personal account, fail closed on Shared Home.
      if (account?.scope === "personal") return [];
      const transactionIds = position.dueCents > 0
        ? projection.transactionPositions
          .filter((row) => (
            row.destinationAccountId === position.destinationAccountId
            && row.outstandingCents > 0
          ))
          .map((row) => row.transactionId)
          .sort()
        : [];
      const oldestDate = transactionIds
        .map((transactionId) => safeDate(transactionForPosition(household, transactionId)?.date, today))
        .sort()[0] ?? today;
      return [{
        destinationAccountId: position.destinationAccountId,
        name: account?.name ?? "Account on the books",
        dueCents: position.dueCents,
        creditCents: position.creditCents,
        transactionIds,
        oldestDate,
      }];
    })
    .sort((left, right) => (
      right.dueCents - left.dueCents
      || left.oldestDate.localeCompare(right.oldestDate)
      || left.destinationAccountId.localeCompare(right.destinationAccountId)
    ));

  const sharedExpenseById = new Map(household.transactions
    .filter((transaction) => transaction.type === "expense" && transaction.visibility !== "personal")
    .map((transaction) => [transaction.id, transaction]));
  const incoming = outstandingClaims(household)
    .flatMap((claim): SettleIn[] => {
      const expense = sharedExpenseById.get(claim.expenseTransactionId);
      if (!expense) return [];
      return [{
        claimId: claim.id,
        label: claimPublicLabel(household, claim, "card"),
        remainingCents: claimRemainingCents(claim),
        sinceDate: safeDate(expense.date, today),
      }];
    })
    .sort((left, right) => (
      left.sinceDate.localeCompare(right.sinceDate)
      || left.claimId.localeCompare(right.claimId)
    ));

  return {
    out,
    in: incoming,
    outTotalCents: out.reduce((sum, row) => sum + row.dueCents, 0),
    inTotalCents: incoming.reduce((sum, row) => sum + row.remainingCents, 0),
    custodianCanSettle: Boolean(
      fund
      && fund.custodianMemberId === memberId
      && household.members.some((member) => member.id === memberId && member.active),
    ),
  };
}
