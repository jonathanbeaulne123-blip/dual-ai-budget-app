import { ValidationError, type Household, type HouseholdFundEvent } from './types.ts';
import { activeHouseholdFundEvents, householdFundContributionMotions } from './householdFund.ts';

export type FundSourceDeclaration = {
  version: 1;
  kind: 'already-held' | 'external-received' | 'recorded-movement';
  explanation: string;
  declaredByMemberId: string;
  amountCents: number;
  effectiveDate: string;
  /** Random public reference; never derived from a private transaction. */
  claimId?: string;
};
export type FundContributionSourceClaim = {
  id: string; fundId: string; proposalEventId: string; ownerMemberId: string;
  sourceTransactionId: string; sourceFingerprint: string; amountCents: number;
  createdAt: string; updatedAt: string;
};
export type FundSourceInput = Pick<FundSourceDeclaration, 'version' | 'kind' | 'explanation'> & { sourceTransactionId?: string };

export function shapeFundSourceDeclaration(value: unknown): FundSourceDeclaration | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const row = value as FundSourceDeclaration;
  if (row.version !== 1 || !['already-held', 'external-received', 'recorded-movement'].includes(row.kind)
    || !Number.isSafeInteger(row.amountCents) || row.amountCents <= 0 || typeof row.effectiveDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.effectiveDate)
    || typeof row.explanation !== 'string' || !row.explanation.trim() || !row.declaredByMemberId
    || (row.kind === 'recorded-movement' && !row.claimId)) return undefined;
  return { version: 1, kind: row.kind, explanation: row.explanation.trim().slice(0, 240), declaredByMemberId: String(row.declaredByMemberId), amountCents:row.amountCents, effectiveDate:row.effectiveDate,
    ...(row.kind === 'recorded-movement' ? { claimId: String(row.claimId) } : {}) };
}
export function shapeFundSourceClaims(value: unknown, owner?: string): FundContributionSourceClaim[] {
  if (!Array.isArray(value)) return [];
  return value.filter((r): r is FundContributionSourceClaim => !!r && typeof r === 'object'
    && ['id','fundId','proposalEventId','ownerMemberId','sourceTransactionId','sourceFingerprint','createdAt','updatedAt'].every(k => typeof r[k] === 'string' && !!r[k])
    && Number.isSafeInteger(r.amountCents) && r.amountCents > 0 && (!owner || r.ownerMemberId === owner)).map(r => ({
      id:r.id, fundId:r.fundId, proposalEventId:r.proposalEventId, ownerMemberId:r.ownerMemberId,
      sourceTransactionId:r.sourceTransactionId, sourceFingerprint:r.sourceFingerprint, amountCents:r.amountCents, createdAt:r.createdAt, updatedAt:r.updatedAt,
    }));
}

/** Private exact facts, not a public hash or proof of remaining bank funds. */
export function fundSourceMovement(h: Household, owner: string, id: string, date: string) {
  const tx = h.transactions.find(t => t.id === id);
  const account = h.accounts.find(a => a.id === tx?.accountId);
  if (!tx || !account?.active || account.currency !== 'CAD' || !['cash','chequing','savings'].includes(account.kind)
    || (account.scope === 'personal' && account.ownerMemberId !== owner)
    || tx.createdBy !== owner || tx.isDuplicate || tx.reversalOfId || tx.source === 'opening'
    || tx.date > date || tx.amountCents <= 0
    || h.transactions.some(t => t.reversalOfId === tx.id)
    || !['income','refund','transfer'].includes(tx.type)) throw new ValidationError('Choose a current accepted incoming movement in your books.');
  const pair = tx.transferPairId ? h.transactions.find(t => t.id === tx.transferPairId) : undefined;
  if (tx.type === 'transfer' && (!pair || tx.accountId !== tx.transferToAccountId || pair.transferPairId !== tx.id
    || pair.amountCents !== tx.amountCents || pair.isDuplicate || h.transactions.some(t => t.reversalOfId === pair.id))) {
    throw new ValidationError('Choose the incoming leg of a complete, current transfer.');
  }
  const facts = (t: typeof tx) => ({ id:t.id, type:t.type, date:t.date, amount:t.amountCents, account:t.accountId,
    owner:t.createdBy, visibility:t.visibility, duplicate:t.isDuplicate,
    pair:t.transferPairId, from:t.transferFromAccountId, to:t.transferToAccountId, reversal:t.reversalOfId });
  return { tx, fingerprint: JSON.stringify({ transaction:facts(tx), pair:pair ? facts(pair):null, account:{id:account.id,active:account.active,kind:account.kind,scope:account.scope,owner:account.ownerMemberId,currency:account.currency} }) };
}
export function fundSourceReservedCents(h: Household, owner: string, transactionId: string, exceptClaimId?: string) {
  const motions = householdFundContributionMotions(h, h.householdFund?.id);
  const live = activeHouseholdFundEvents(h, h.householdFund?.id);
  return shapeFundSourceClaims(h.fundContributionSourceClaims, owner).filter(c => c.sourceTransactionId === transactionId && c.id !== exceptClaimId
    && motions.some(m => m.proposal.id === c.proposalEventId && (m.status === 'open' || m.status === 'held'
      || (m.status === 'confirmed' && live.some(e => e.kind === 'contribution-confirmed' && e.relatedEventId === m.proposal.id)))))
    .reduce((sum,c) => sum + c.amountCents, 0);
}
export function validateFundSourceClaim(h: Household, proposal: HouseholdFundEvent): void {
  const declaration = proposal.sourceDeclaration;
  if (declaration?.kind !== 'recorded-movement') return;
  const claim = shapeFundSourceClaims(h.fundContributionSourceClaims, declaration.declaredByMemberId).find(c => c.id === declaration.claimId);
  if (!claim || claim.proposalEventId !== proposal.id || claim.fundId !== proposal.fundId || claim.amountCents !== proposal.amountCents)
    throw new ValidationError('Source review unavailable. Reopen the contribution from current cloud books.');
  const reading = fundSourceMovement(h, claim.ownerMemberId, claim.sourceTransactionId, proposal.date);
  if (reading.fingerprint !== claim.sourceFingerprint
    || fundSourceReservedCents(h, claim.ownerMemberId, claim.sourceTransactionId, claim.id) + claim.amountCents > reading.tx.amountCents)
    throw new ValidationError('Source changed. Ask the contributor to review and replace this proposal.');
}
/** Exact public review identity. No Personal source facts enter this value. */
export function fundContributionReviewDigest(h: Household, proposalId: string): string {
  const motion = householdFundContributionMotions(h, h.householdFund?.id).find(m => m.proposal.id === proposalId);
  return JSON.stringify({ version:1, environment:h.environment, householdId:h.householdId, fund:h.householdFund,
    proposal:motion?.proposal ?? null, status:motion?.status ?? null, hold:motion?.activeHold?.id ?? null });
}

export function assertFundSourceTransition(previous: Household, candidate: Household, validatedClaimIds: ReadonlySet<string> = new Set(), actor?: string): void {
  const oldClaims = shapeFundSourceClaims(previous.fundContributionSourceClaims);
  const nextClaims = shapeFundSourceClaims(candidate.fundContributionSourceClaims);
  for (const claim of oldClaims) {
    if (JSON.stringify(nextClaims.find(c => c.id === claim.id)) !== JSON.stringify(claim)) throw new ValidationError("Accepted contribution source claims cannot be removed or edited.");
  }
  for (const claim of nextClaims.filter(c => !oldClaims.some(old => old.id === c.id))) {
    const proposal = candidate.fundEvents?.find(e => e.id === claim.proposalEventId);
    if ((!actor || claim.ownerMemberId !== actor) || !proposal || previous.fundEvents?.some(e => e.id === proposal.id)
      || proposal.kind !== "contribution-proposed" || proposal.sourceDeclaration?.claimId !== claim.id
      || proposal.sourceDeclaration.declaredByMemberId !== claim.ownerMemberId) throw new ValidationError("A source claim requires its owner's new contribution proposal.");
    validateFundSourceClaim(candidate, proposal);
  }
  const old = new Set((previous.fundEvents ?? []).map(e => e.id));
  for (const event of candidate.fundEvents ?? []) {
    if (old.has(event.id) || !['contribution-proposed','contribution-confirmed'].includes(event.kind)) continue;
    if (!actor || event.createdBy !== actor) throw new ValidationError("Only the acting member can declare or confirm a contribution.");
    const source = shapeFundSourceDeclaration(event.sourceDeclaration);
    if (!source || source.declaredByMemberId !== event.contributorMemberId) throw new ValidationError('Reload Hearth and declare the source before confirming this contribution.');
    if (event.kind === 'contribution-proposed' && (source.amountCents !== event.amountCents || source.effectiveDate !== event.date)) throw new ValidationError('Contribution source must declare its exact amount and effective date.');
    if (event.kind === 'contribution-proposed' && event.createdBy !== event.contributorMemberId) throw new ValidationError('Only the contributor can propose their own money.');
    if (event.kind === 'contribution-confirmed') {
      const original = candidate.fundEvents?.find(e => e.id === event.relatedEventId);
      if (!original || JSON.stringify(source) !== JSON.stringify(original.sourceDeclaration)) throw new ValidationError('Receipt source differs from the reviewed proposal.');
    }
    if (source.kind === 'recorded-movement') {
      const proposal = event.kind === 'contribution-proposed' ? event : candidate.fundEvents?.find(e => e.id === event.relatedEventId);
      if (!proposal) throw new ValidationError('Contribution source proposal is missing.');
      if (!validatedClaimIds.has(source.claimId!)) validateFundSourceClaim(candidate, proposal);
    }
  }
}
