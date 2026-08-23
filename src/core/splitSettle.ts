import { COMPANION, JOINT, type Household, type PartyId } from "./types.ts";
import { formatCad } from "./money.ts";

export type SettlePosition = {
  memberId: string;
  name: string;
  paidCents: number;
  ownedCents: number;
  /** Positive: they are owed. Negative: they owe. */
  netCents: number;
};

export type SettleSuggestion = {
  fromMemberId: string;
  fromName: string;
  toMemberId: string;
  toName: string;
  amountCents: number;
  spoken: string;
};

export type HouseholdSettle = {
  positions: SettlePosition[];
  suggested: SettleSuggestion | null;
};

function isMemberParty(party: PartyId, memberIds: Set<string>): boolean {
  return memberIds.has(party);
}

/**
 * Who owes whom inside this household.
 * Personal-account expenses (and refunds) vs ownership splits.
 * Joint-paid rows settle at the house — they do not create a spouse IOU.
 * Settlement is a transfer both people can already see. Not Interac (D-039).
 */
export function householdSettle(household: Household): HouseholdSettle {
  const members = household.members.filter((member) => member.active);
  const memberIds = new Set(members.map((member) => member.id));
  const paid = new Map<string, number>();
  const owned = new Map<string, number>();
  for (const member of members) {
    paid.set(member.id, 0);
    owned.set(member.id, 0);
  }

  const accounts = new Map(household.accounts.map((account) => [account.id, account]));

  for (const tx of household.transactions) {
    if (tx.isDuplicate) continue;
    if (tx.type !== "expense" && tx.type !== "refund") continue;
    const sign = tx.type === "refund" ? -1 : 1;
    const account = accounts.get(tx.accountId);
    if (!account) continue;
    const payer = account.ownerMemberId;
    // Joint / companion / unowned payers are household money. Do not create a spouse IOU.
    if (!isMemberParty(payer, memberIds)) continue;
    paid.set(payer, (paid.get(payer) ?? 0) + sign * tx.amountCents);
    for (const split of tx.splits) {
      if (split.party === JOINT || split.party === COMPANION) continue;
      if (!isMemberParty(split.party, memberIds)) continue;
      owned.set(split.party, (owned.get(split.party) ?? 0) + sign * split.amountCents);
    }
  }

  const positions: SettlePosition[] = members.map((member) => {
    const paidCents = paid.get(member.id) ?? 0;
    const ownedCents = owned.get(member.id) ?? 0;
    return {
      memberId: member.id,
      name: member.name,
      paidCents,
      ownedCents,
      netCents: paidCents - ownedCents,
    };
  });

  const owed = positions.filter((row) => row.netCents > 0).sort((left, right) => right.netCents - left.netCents);
  const owing = positions.filter((row) => row.netCents < 0).sort((left, right) => left.netCents - right.netCents);
  const creditor = owed[0];
  const debtor = owing[0];
  let suggested: SettleSuggestion | null = null;
  if (creditor && debtor) {
    const amountCents = Math.min(creditor.netCents, -debtor.netCents);
    if (amountCents > 0) {
      suggested = {
        fromMemberId: debtor.memberId,
        fromName: debtor.name,
        toMemberId: creditor.memberId,
        toName: creditor.name,
        amountCents,
        spoken: `${debtor.name} owes ${creditor.name} ${formatCad(amountCents)}. Settle with a transfer. Confirm still writes.`,
      };
    }
  }

  return { positions, suggested };
}
