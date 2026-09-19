import { canonical } from '../ledgerSync/patch.ts';
import { sha256String } from './synchronousHash.ts';
import { ValidationError } from './types.ts';

/** The content is immutable; acknowledgement is always of this exact proposal. */
export type ChapterConsentProposal<T> = {
  id: string;
  sequence: number;
  terms: T;
  basis: string;
  audience: string[];
  proposedBy: string;
  proposedAt: string;
  digest: string;
  approvals: { memberId: string; at: string }[];
  state: 'pending' | 'accepted' | 'superseded';
  acceptedAt: string | null;
};
export type ChapterConsent<T> = {
  version: 1;
  revision: number;
  /** Earlier terms remain historical facts, with no invented approvals. */
  legacyBaseline: boolean;
  acceptedProposalId: string | null;
  proposals: ChapterConsentProposal<T>[];
};
export type ChapterParticipation = { version: 1; memberId: string; revision: number; paused: boolean; updatedAt: string };
export const chapterConsentDigest = (facts: unknown) => sha256String(canonical(facts));
export const consentRevision = (value: ChapterConsent<unknown> | undefined) => value?.revision ?? 0;
export function chapterConsentFail(message: string): never { throw new ValidationError(message); }
const isIso = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value));
const isId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 160;
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const digest = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

export function exactChapterRecord(value: unknown, keys: string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key)) || Object.values(Object.getOwnPropertyDescriptors(value)).some(descriptor => !('value' in descriptor))) chapterConsentFail('This shared Chapter record is not supported. Keep its original copy for recovery.');
}
function proposalDigest<T>(proposal: Omit<ChapterConsentProposal<T>, 'digest' | 'approvals' | 'state' | 'acceptedAt'>): string { return chapterConsentDigest(proposal); }
function proposalFacts<T>(proposal: ChapterConsentProposal<T>) { const { digest: _digest, approvals: _approvals, state: _state, acceptedAt: _acceptedAt, ...facts } = proposal; return facts; }
export function shapeChapterConsent<T>(raw: unknown, checkTerms: (value: unknown) => T): ChapterConsent<T> | undefined {
  if (raw === undefined) return undefined;
  exactChapterRecord(raw, ['version', 'revision', 'legacyBaseline', 'acceptedProposalId', 'proposals']);
  if (raw.version !== 1 || !integer(raw.revision) || raw.revision < 1 || typeof raw.legacyBaseline !== 'boolean' || raw.acceptedProposalId !== null && !isId(raw.acceptedProposalId) || !Array.isArray(raw.proposals) || raw.proposals.length > 256) chapterConsentFail('This shared agreement history needs recovery.');
  const ids = new Set<string>(); let previous = 0;
  const proposals = raw.proposals.map(value => {
    exactChapterRecord(value, ['id', 'sequence', 'terms', 'basis', 'audience', 'proposedBy', 'proposedAt', 'digest', 'approvals', 'state', 'acceptedAt']);
    if (!isId(value.id) || ids.has(value.id) || !integer(value.sequence) || value.sequence <= previous || value.sequence > Number(raw.revision) || !digest(value.basis) || !digest(value.digest) || !isId(value.proposedBy) || !isIso(value.proposedAt) || !Array.isArray(value.audience) || value.audience.length < 2 || value.audience.length > 16 || !value.audience.every(isId) || new Set(value.audience).size !== value.audience.length || !value.audience.includes(value.proposedBy) || !Array.isArray(value.approvals) || !['pending', 'accepted', 'superseded'].includes(String(value.state)) || value.acceptedAt !== null && !isIso(value.acceptedAt)) chapterConsentFail('This exact shared review is invalid.');
    const approvals = value.approvals.map(approval => {
      exactChapterRecord(approval, ['memberId', 'at']);
      if (!isId(approval.memberId) || !(value.audience as string[]).includes(approval.memberId) || !isIso(approval.at)) chapterConsentFail('This acknowledgement is not part of the reviewed audience.');
      return { memberId: approval.memberId, at: approval.at };
    });
    if (new Set(approvals.map(a => a.memberId)).size !== approvals.length || approvals.length > value.audience.length || !approvals.some(a => a.memberId === value.proposedBy) || (value.state === 'accepted') !== (value.acceptedAt !== null) || value.state === 'accepted' && approvals.length !== value.audience.length || value.state === 'pending' && approvals.length === value.audience.length) chapterConsentFail('This shared approval history is incomplete.');
    const proposal = { ...value, terms: checkTerms(value.terms), approvals } as ChapterConsentProposal<T>;
    if (proposalDigest(proposalFacts(proposal)) !== proposal.digest) chapterConsentFail('This shared review changed after it was prepared.');
    ids.add(proposal.id); previous = proposal.sequence; return proposal;
  });
  if (proposals.filter(p => p.state === 'pending').length > 1 || raw.acceptedProposalId !== (proposals.filter(p => p.state === 'accepted').at(-1)?.id ?? null)) chapterConsentFail('This shared agreement needs its current review restored.');
  return { version: 1, revision: raw.revision, legacyBaseline: raw.legacyBaseline, acceptedProposalId: raw.acceptedProposalId as string | null, proposals };
}
export function proposeChapterConsent<T>(existing: ChapterConsent<T> | undefined, input: { expectedRevision: number; identity: string; terms: T; basis: string; audience: string[]; memberId: string; at: string; legacyBaseline: boolean }): ChapterConsent<T> {
  if (consentRevision(existing) !== input.expectedRevision) chapterConsentFail('This shared review changed. Read its current version before proposing another.');
  if (input.audience.length < 2 || input.audience.length > 16 || !input.audience.includes(input.memberId) || new Set(input.audience).size !== input.audience.length || !input.audience.every(isId) || !isIso(input.at)) chapterConsentFail('Both active household members are needed for a shared agreement.');
  if ((existing?.proposals.length ?? 0) >= 256) chapterConsentFail('Keep this agreement history before adding another review.');
  const sequence = consentRevision(existing) + 1;
  const facts = { id: `${input.identity}-${sequence}`, sequence, terms: structuredClone(input.terms), basis: input.basis, audience: [...input.audience].sort(), proposedBy: input.memberId, proposedAt: input.at };
  return { version: 1, revision: sequence, legacyBaseline: existing?.legacyBaseline ?? input.legacyBaseline, acceptedProposalId: existing?.acceptedProposalId ?? null, proposals: [
    ...(existing?.proposals ?? []).map(proposal => proposal.state === 'pending' ? { ...proposal, state: 'superseded' as const } : proposal),
    { ...facts, digest: proposalDigest(facts), approvals: [{ memberId: input.memberId, at: input.at }], state: 'pending', acceptedAt: null },
  ] };
}
export function approveChapterConsent<T>(existing: ChapterConsent<T> | undefined, input: { expectedRevision: number; proposalId: string; digest: string; basis: string; audience: string[]; memberId: string; at: string }): { consent: ChapterConsent<T>; accepted: boolean; proposal: ChapterConsentProposal<T> } {
  if (!existing || existing.revision !== input.expectedRevision) chapterConsentFail('This shared review changed. Read its exact current version before agreeing.');
  const proposal = existing.proposals.find(p => p.id === input.proposalId && p.state === 'pending');
  if (!proposal || proposal.digest !== input.digest || proposal.basis !== input.basis || canonical(proposal.audience) !== canonical([...input.audience].sort()) || !proposal.audience.includes(input.memberId) || !isIso(input.at)) chapterConsentFail('The shared terms or participants changed. Prepare a fresh review together.');
  if (proposal.approvals.some(a => a.memberId === input.memberId)) chapterConsentFail('You already agreed to this exact review.');
  const approvals = [...proposal.approvals, { memberId: input.memberId, at: input.at }];
  const accepted = proposal.audience.every(id => approvals.some(a => a.memberId === id));
  const updated = { ...proposal, approvals, state: accepted ? 'accepted' as const : 'pending' as const, acceptedAt: accepted ? input.at : null };
  return { consent: { ...existing, revision: existing.revision + 1, acceptedProposalId: accepted ? proposal.id : existing.acceptedProposalId, proposals: existing.proposals.map(p => p.id === proposal.id ? updated : p) }, accepted, proposal: updated };
}
export function shapeChapterParticipation(raw: unknown): ChapterParticipation[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > 16) chapterConsentFail('This participation record needs recovery.');
  const rows = raw.map(value => {
    exactChapterRecord(value, ['version', 'memberId', 'revision', 'paused', 'updatedAt']);
    if (value.version !== 1 || !isId(value.memberId) || !integer(value.revision) || value.revision < 1 || typeof value.paused !== 'boolean' || !isIso(value.updatedAt)) chapterConsentFail('This participation record is invalid.');
    return value as ChapterParticipation;
  });
  if (new Set(rows.map(row => row.memberId)).size !== rows.length) chapterConsentFail('A participation identity appears twice.');
  return rows;
}

/** Merge only established authority versions, never manufacture approval unions. */
export function selectChapterConsent<T>(a: ChapterConsent<T> | undefined, b: ChapterConsent<T> | undefined): ChapterConsent<T> | undefined {
  if (!a) return b; if (!b) return a;
  if (a.revision === b.revision && canonical(a) !== canonical(b)) chapterConsentFail('Conflicting shared reviews need authoritative recovery.');
  const latest = a.revision >= b.revision ? a : b, previous = latest === a ? b : a;
  for (const old of previous.proposals) {
    const current = latest.proposals.find(row => row.id === old.id);
    if (!current || canonical(proposalFacts(current)) !== canonical(proposalFacts(old)) || old.approvals.some(approval => !current.approvals.some(row => canonical(row) === canonical(approval))) || old.state === 'accepted' && current.state !== 'accepted') chapterConsentFail('The newer shared review lost its immutable history.');
  }
  return latest;
}
export function mergeChapterParticipation(a: ChapterParticipation[] = [], b: ChapterParticipation[] = []): ChapterParticipation[] {
  const rows = new Map(a.map(row => [row.memberId, row]));
  for (const row of b) { const old = rows.get(row.memberId); if (old && old.revision === row.revision && canonical(old) !== canonical(row)) chapterConsentFail('Conflicting personal participation needs authoritative recovery.'); if (!old || row.revision > old.revision) rows.set(row.memberId, row); }
  return [...rows.values()].sort((x, y) => x.memberId.localeCompare(y.memberId));
}
