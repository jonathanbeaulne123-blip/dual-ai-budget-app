import type { CommitResult } from "../core/types.ts";
/** Preserve the amounts/ownership explicitly previewed at Confirm while IDs/times are server allocated. */
export function reviewedFacts(result: CommitResult): unknown[] {
  const posted = new Set(result.postedIds);
  return result.household.transactions
    .filter((t) => posted.has(t.id))
    .map((t) => ({
      type: t.type,
      date: t.date,
      amountCents: t.amountCents,
      ...(t.openingSignedBalanceCents !== undefined ? {openingSignedBalanceCents: t.openingSignedBalanceCents} : {}),
      accountId: t.accountId,
      subcategoryId: t.subcategoryId,
      visibility: t.visibility,
      createdBy: t.createdBy,
      splits: t.splits,
      funding: t.funding
        ? {
            fundId: t.funding.fundId,
            fundedCents: t.funding.fundedCents,
            destinationAccountId: t.funding.destinationAccountId,
          }
        : null,
    }));
}
