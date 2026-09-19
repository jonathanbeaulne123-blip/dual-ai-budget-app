import {
  vaultAssert, vaultContent, vaultDigest, vaultId, vaultInteger, vaultObject,
  vaultPrincipalEqual, vaultPrincipals, vaultPublicationInput, VAULT_MEDIA_LIMIT,
  type VaultAcceptance, type VaultAudiencePolicy, type VaultDraft, type VaultMedia,
  type VaultPrincipal, type VaultPublication, type VaultPublicationReceipt, type VaultMailCard,
  type VaultReference, type VaultScope,
} from '../src/hearthside/vaultContracts.ts';
import { decodeMemoryPublicationBinding, memoryCompositionDigest, memoryPublicationBinding,
  type MemoryPublicationCandidate, type MemoryPublicationBinding, type VaultMemoryEvidence, type VaultMemoryReview } from '../src/hearthside/memoryPublication.ts';

/** Implementations must provide a synchronous, atomic transaction (SQLite in the DO). */
export interface VaultStorage {
  get<T>(key: string): T | undefined;
  put(key: string, value: unknown): void;
  list<T>(prefix: string): T[];
  transaction<T>(action: () => T): T;
}
const principal = (s: VaultScope): VaultPrincipal => ({ memberId: s.memberId, subject: s.subject });
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Pure authority, independently tested with clock and durable-storage adapters. */
export class HearthsideVaultStore {
  constructor(private readonly storage: VaultStorage, private readonly clock: () => number = Date.now) {}

  check(scope: VaultScope): void {
    vaultAssert(scope.environment === 'development', 'ENVIRONMENT_DISABLED');
    vaultAssert(Number.isFinite(scope.expires) && scope.expires > this.clock(), 'UNAUTHENTICATED');
    vaultAssert(/^HH-[A-Za-z0-9_-]{1,96}$/.test(scope.householdId), 'INVALID_SCOPE');
    vaultPrincipals([principal(scope)]);
    const scopeKey = `${scope.environment}/${scope.householdId}`;
    const bound = this.storage.get<string>('scope');
    vaultAssert(!bound || bound === scopeKey, 'FORBIDDEN');
    if (!bound) this.storage.put('scope', scopeKey);
  }
  private owned<T extends { owner: VaultPrincipal }>(scope: VaultScope, key: string): T {
    this.check(scope);
    const item = this.storage.get<T>(key);
    // The same response for an absent object and somebody else's private object.
    vaultAssert(item && vaultPrincipalEqual(item.owner, scope), 'NOT_FOUND');
    return item;
  }
  saveDraft(scope: VaultScope, input: unknown): VaultDraft {
    this.check(scope);
    const v = vaultObject(input, ['id', 'expectedRevision', 'content']);
    const id = vaultId(v.id), expected = vaultInteger(v.expectedRevision), content = vaultContent(v.content);
    for (const mediaId of content.mediaIds) {
      const media = this.owned<VaultMedia>(scope, `media/${mediaId}`);
      vaultAssert(media.status !== 'deleted', 'MEDIA_UNAVAILABLE');
    }
    return this.storage.transaction(() => {
      const old = this.storage.get<VaultDraft>(`draft/${id}`);
      vaultAssert(!old || vaultPrincipalEqual(old.owner, scope), 'NOT_FOUND');
      vaultAssert(old?.deletedAt === undefined, 'DRAFT_REMOVED');
      if (old && old.revision === expected + 1 && same(old.content, content)) return old;
      vaultAssert((old?.revision ?? 0) === expected, 'DRAFT_CHANGED');
      const draft: VaultDraft = { version: 1, id, revision: expected + 1, owner: principal(scope), content, updatedAt: this.clock() };
      this.storage.put(`draft/${id}`, draft);
      return draft;
    });
  }
  readDraft(scope: VaultScope, id: string): VaultDraft {
    const draft = this.owned<VaultDraft>(scope, `draft/${vaultId(id)}`);
    vaultAssert(draft.deletedAt === undefined, 'NOT_FOUND');
    return draft;
  }
  deleteDraft(scope: VaultScope, input: unknown): { id: string; revision: number; deletedAt: number } {
    const v = vaultObject(input, ['id', 'expectedRevision']), id = vaultId(v.id), expected = vaultInteger(v.expectedRevision, 1);
    const draft = this.owned<VaultDraft>(scope, `draft/${id}`);
    if (draft.deletedAt !== undefined) return { id, revision: draft.revision, deletedAt: draft.deletedAt };
    vaultAssert(draft.revision === expected, 'DRAFT_CHANGED');
    const deletedAt = this.clock(), revision = draft.revision + 1;
    this.storage.put(`draft/${id}`, { ...draft, revision, deletedAt, updatedAt: deletedAt, content: { title: '', text: '', mediaIds: [] } });
    return { id, revision, deletedAt };
  }
  listDrafts(scope: VaultScope): VaultDraft[] {
    this.check(scope);
    return this.storage.list<VaultDraft>('draft/').filter(d => d.deletedAt === undefined && vaultPrincipalEqual(d.owner, scope));
  }
  prepareMedia(scope: VaultScope, input: unknown): VaultMedia {
    this.check(scope);
    const v = vaultObject(input, ['id', 'sha256', 'byteLength', 'contentType']);
    const id = vaultId(v.id), byteLength = vaultInteger(v.byteLength, 1);
    vaultAssert(byteLength <= VAULT_MEDIA_LIMIT, 'MEDIA_TOO_LARGE');
    vaultAssert(typeof v.sha256 === 'string' && /^[a-f0-9]{64}$/.test(v.sha256), 'INVALID_DIGEST');
    vaultAssert(['image/jpeg', 'image/png', 'audio/webm', 'audio/mp4', 'audio/ogg'].includes(String(v.contentType)), 'INVALID_MEDIA_TYPE');
    const media: VaultMedia = { version: 1, id, owner: principal(scope), byteLength, sha256: v.sha256,
      contentType: v.contentType as VaultMedia['contentType'], status: 'pending', createdAt: this.clock(), uploadedAt: null };
    const old = this.storage.get<VaultMedia>(`media/${id}`);
    if (old) {
      vaultAssert(vaultPrincipalEqual(old.owner, scope), 'NOT_FOUND');
      vaultAssert(old.status !== 'deleted' && old.byteLength === media.byteLength && old.sha256 === media.sha256 &&
        old.contentType === media.contentType, 'MEDIA_ID_REUSED');
      return old;
    }
    this.storage.put(`media/${id}`, media);
    return media;
  }
  mediaForUpload(scope: VaultScope, id: string): VaultMedia {
    const media = this.owned<VaultMedia>(scope, `media/${vaultId(id)}`);
    vaultAssert(media.status !== 'deleted', 'MEDIA_UNAVAILABLE');
    return media;
  }
  mediaCopy(scope: VaultScope, id: string, source: NonNullable<VaultMedia['copySource']>): VaultMedia | undefined {
    this.check(scope); const media = this.storage.get<VaultMedia>(`media/${vaultId(id)}`);
    if (!media) return undefined;
    vaultAssert(vaultPrincipalEqual(media.owner, scope), 'NOT_FOUND');
    vaultAssert(same(media.copySource, source) && media.status !== 'deleted', 'MEDIA_ID_REUSED');
    return media;
  }
  prepareMediaCopy(scope: VaultScope, id: string, source: NonNullable<VaultMedia['copySource']>, manifest: VaultMedia): VaultMedia {
    const existing = this.mediaCopy(scope, id, source); if (existing) return existing;
    const media = this.prepareMedia(scope, { id, sha256: manifest.sha256, byteLength: manifest.byteLength, contentType: manifest.contentType });
    const copy = { ...media, copySource: source }; this.storage.put(`media/${id}`, copy); return copy;
  }
  abortMediaCopy(scope: VaultScope, id: string): void {
    const media = this.owned<VaultMedia>(scope, `media/${vaultId(id)}`);
    // Pending copies cannot be part of an accepted publication. A private draft
    // may retain the unavailable reference so the author can replace it.
    if (media.copySource && media.status === 'pending') this.storage.put(`media/${id}`, { ...media, status: 'deleted' });
  }
  completeMedia(scope: VaultScope, id: string, sha256: string, byteLength: number): VaultMedia {
    const media = this.mediaForUpload(scope, id);
    vaultAssert(media.sha256 === sha256 && media.byteLength === byteLength, 'MEDIA_BYTES_CHANGED');
    if (media.status === 'uploaded') return media;
    const next: VaultMedia = { ...media, status: 'uploaded', uploadedAt: this.clock() };
    this.storage.put(`media/${id}`, next);
    return next;
  }
  async preparePublication(scope: VaultScope, input: unknown, policy: VaultAudiencePolicy, memory?: VaultMemoryReview): Promise<VaultPublication> {
    this.check(scope);
    const v = vaultPublicationInput(input);
    vaultAssert(!memory || v.kind === 'shared-memory', 'INVALID_KIND');
    const recipients = vaultPrincipals(policy.recipients), approvers = vaultPrincipals(policy.approvers);
    vaultAssert(same(recipients.map(p => p.memberId).sort(), v.recipientMemberIds), 'AUDIENCE_CHANGED');
    vaultAssert(approvers.some(p => vaultPrincipalEqual(p, scope)), 'INVALID_APPROVERS');
    if (v.kind === 'shared-memory' || v.kind === 'guest') vaultAssert(approvers.length >= 2, 'MUTUAL_APPROVAL_REQUIRED');
    else vaultAssert(approvers.length === 1, 'INVALID_APPROVERS');
    const old = this.storage.get<VaultPublication>(`publication/${v.id}`);
    if (old) {
      vaultAssert(vaultPrincipalEqual(old.owner, scope), 'NOT_FOUND');
      vaultAssert(old.draftId === v.draftId && old.draftRevision === v.draftRevision && old.kind === v.kind &&
        old.releaseAt === v.releaseAt && same(old.recipients, recipients) && same(old.approvers, approvers) && same(old.memory, memory), 'PUBLICATION_ID_REUSED');
      return old;
    }
    const draft = this.readDraft(scope, v.draftId);
    vaultAssert(draft.revision === v.draftRevision, 'DRAFT_CHANGED');
    if (v.releaseAt !== null) vaultAssert(v.releaseAt > this.clock() && v.releaseAt <= this.clock() + 20 * 366 * 86400000, 'INVALID_RELEASE');
    const media = draft.content.mediaIds.map(id => this.mediaForUpload(scope, id));
    vaultAssert(media.every(m => m.status === 'uploaded'), 'MEDIA_PENDING');
    if (memory) vaultAssert(same(memory.composition.media.map(m => m.contentId), media.map(m => m.id)) &&
      memory.composition.media.every((m, i) => m.revision === 1 && m.kind === (media[i]!.contentType.startsWith('image/') ? 'image' : 'audio')), 'COMPOSITION_CHANGED');
    const immutable = { version: 1 as const, id: v.id, owner: draft.owner, draftId: draft.id, draftRevision: draft.revision,
      kind: v.kind, content: draft.content, media, recipients, approvers, releaseAt: v.releaseAt, ...(memory ? { memory } : {}) };
    const digest = await vaultDigest(immutable);
    return this.storage.transaction(() => {
      this.check(scope);
      vaultAssert(this.readDraft(scope, draft.id).revision === draft.revision, 'DRAFT_CHANGED');
      const competing = this.storage.get<VaultPublication>(`publication/${v.id}`);
      if (competing) { vaultAssert(competing.digest === digest, 'PUBLICATION_ID_REUSED'); return competing; }
      const publication: VaultPublication = { ...immutable, digest, preparedAt: this.clock(), approvals: [], state: 'prepared',
        acceptance: null, activatedAt: null, revokedAt: null };
      this.storage.put(`publication/${v.id}`, publication);
      return publication;
    });
  }
  /** Media were authorized by the service as owned or current same-memory review material. */
  async prepareMemoryPublication(scope: VaultScope, id: string, memory: VaultMemoryReview, media: VaultMedia[], policy: VaultAudiencePolicy,
    recheckSources: () => void): Promise<VaultPublication & { memory: VaultMemoryReview }> {
    this.check(scope); vaultId(id);
    const recipients = vaultPrincipals(policy.recipients), approvers = vaultPrincipals(policy.approvers);
    vaultAssert(approvers.length >= 2 && same(recipients, approvers) && approvers.some(p => vaultPrincipalEqual(p, scope)), 'INVALID_APPROVERS');
    vaultAssert(same(memory.composition.media.map(m => m.contentId), media.map(m => m.id)) && media.every(m => m.status === 'uploaded') &&
      memory.composition.media.every((m, i) => m.revision === 1 && m.kind === (media[i]!.contentType.startsWith('image/') ? 'image' : 'audio')), 'COMPOSITION_CHANGED');
    // The memory has its own immutable source manifest; no private draft is
    // created or disclosed. The internal source key shares publication identity.
    const immutable = { version: 1 as const, id, owner: principal(scope), draftId: id, draftRevision: 1,
      kind: 'shared-memory' as const, content: { title: memory.composition.title.slice(0, 180), text: '', mediaIds: media.map(m => m.id) },
      media, recipients, approvers, releaseAt: null, memory };
    const digest = await vaultDigest(immutable);
    return this.storage.transaction(() => {
      this.check(scope); recheckSources();
      const old = this.storage.get<VaultPublication & { memory: VaultMemoryReview }>(`publication/${id}`);
      if (old) { vaultAssert(vaultPrincipalEqual(old.owner, scope) && old.digest === digest, 'PUBLICATION_ID_REUSED'); vaultAssert(old.state !== 'revoked', 'PUBLICATION_REVOKED'); return old; }
      const p = { ...immutable, digest, preparedAt: this.clock(), approvals: [], state: 'prepared' as const, acceptance: null, activatedAt: null, revokedAt: null };
      this.storage.put(`publication/${id}`, p); return p;
    });
  }
  private publication(scope: VaultScope, id: string): VaultPublication {
    this.check(scope);
    const p = this.storage.get<VaultPublication>(`publication/${vaultId(id)}`);
    vaultAssert(p, 'NOT_FOUND');
    return p;
  }
  review(scope: VaultScope, id: string): VaultPublication {
    const p = this.publication(scope, id);
    vaultAssert(p.approvers.some(a => vaultPrincipalEqual(a, scope)), 'NOT_FOUND');
    vaultAssert(p.state === 'prepared', 'REVIEW_CLOSED');
    return p;
  }
  resumeReview(scope: VaultScope, id: string): VaultPublication {
    const p = this.owned<VaultPublication>(scope, `publication/${vaultId(id)}`);
    vaultAssert(p.state === 'prepared' || p.state === 'accepted', 'REVIEW_CLOSED');
    return p;
  }
  approve(scope: VaultScope, id: string, digest: string): VaultPublicationReceipt {
    const p = this.publication(scope, id);
    vaultAssert(p.approvers.some(a => vaultPrincipalEqual(a, scope)), 'NOT_FOUND');
    vaultAssert(p.digest === digest, 'COMPOSITION_CHANGED');
    vaultAssert(p.state !== 'revoked', 'PUBLICATION_REVOKED');
    if (!p.approvals.some(a => vaultPrincipalEqual(a.principal, scope))) {
      vaultAssert(p.state === 'prepared', 'REVIEW_CLOSED');
      p.approvals.push({ principal: principal(scope), digest, approvedAt: this.clock() });
      this.storage.put(`publication/${id}`, p);
    }
    return this.receipt(scope, p);
  }
  readyForAcceptance(scope: VaultScope, id: string): VaultPublication {
    const p = this.owned<VaultPublication>(scope, `publication/${vaultId(id)}`);
    vaultAssert(p.state !== 'revoked', 'PUBLICATION_REVOKED');
    vaultAssert(p.approvers.every(a => p.approvals.some(approval => vaultPrincipalEqual(a, approval.principal) && approval.digest === p.digest)), 'APPROVAL_REQUIRED');
    return p;
  }
  reference(scope: VaultScope, p: VaultPublication): VaultReference {
    return { version: 1, publicationId: p.id, digest: p.digest, kind: p.kind, environment: scope.environment, householdId: scope.householdId,
      ...(p.memory ? { memory: memoryPublicationBinding(p.id, p.digest, p.memory) } : {}) };
  }
  markAccepted(scope: VaultScope, id: string, acceptance: VaultAcceptance): VaultPublicationReceipt {
    const p = this.readyForAcceptance(scope, id), reference = this.reference(scope, p);
    vaultAssert(Object.entries(reference).every(([key, value]) => same(acceptance[key as keyof VaultReference], value)) &&
      typeof acceptance.receiptId === 'string' && !!vaultId(acceptance.receiptId) && Number.isSafeInteger(acceptance.acceptedAt), 'INVALID_ACCEPTANCE');
    if (p.acceptance) vaultAssert(same(p.acceptance, acceptance), 'ACCEPTANCE_CHANGED');
    else {
      p.acceptance = acceptance;
      p.state = 'accepted';
      this.storage.put(`publication/${id}`, p);
    }
    return this.receipt(scope, p);
  }
  activate(scope: VaultScope, id: string): VaultPublicationReceipt {
    const p = this.readyForAcceptance(scope, id);
    vaultAssert(p.acceptance && (p.state === 'accepted' || p.state === 'active'), 'ACCEPTANCE_REQUIRED');
    if (p.state !== 'active') {
      p.state = 'active'; p.activatedAt = this.clock();
      this.storage.put(`publication/${id}`, p);
    }
    return this.receipt(scope, p);
  }
  withdraw(scope: VaultScope, id: string): VaultPublicationReceipt {
    const p = this.publication(scope, id);
    vaultAssert(p.approvers.some(a => vaultPrincipalEqual(a, scope)), 'NOT_FOUND');
    if (p.state !== 'revoked') {
      // Persist denial before any reference cleanup or cross-service I/O.
      p.state = 'revoked'; p.revokedAt = this.clock();
      this.storage.put(`publication/${id}`, p);
    }
    return this.receipt(scope, p);
  }
  memoryRevoked(scope:VaultScope,rawBinding:MemoryPublicationBinding):boolean{
    const binding=decodeMemoryPublicationBinding(rawBinding),p=this.publication(scope,binding.publicationId);
    vaultAssert(p.kind==='shared-memory'&&p.memory&&p.approvers.some(a=>vaultPrincipalEqual(a,scope)),'NOT_FOUND');
    vaultAssert(same(binding,memoryPublicationBinding(p.id,p.digest,p.memory)),'COMPOSITION_CHANGED');
    return p.state==='revoked';
  }
  memoryActive(scope:VaultScope,rawBinding:MemoryPublicationBinding):boolean{
    const binding=decodeMemoryPublicationBinding(rawBinding);
    if(this.memoryRevoked(scope,binding))return false;
    const p=this.readPublication(scope,binding.publicationId);
    return p.approvers.every(principal=>p.approvals.some(a=>vaultPrincipalEqual(a.principal,principal)&&a.digest===p.digest));
  }
  readPublication(scope: VaultScope, id: string): VaultPublication {
    const p = this.publication(scope, id);
    vaultAssert(p.state === 'active' && (p.recipients.some(a => vaultPrincipalEqual(a, scope)) || vaultPrincipalEqual(p.owner, scope)), 'NOT_FOUND');
    // No sender/admin bypass after sealing. Dates from requests never affect this clock.
    vaultAssert(p.releaseAt === null || this.clock() >= p.releaseAt, 'SEALED');
    return p;
  }
  readMedia(scope: VaultScope, id: string, publicationId: string | null, mode: 'active' | 'review' = 'active'): VaultMedia {
    const mediaId = vaultId(id);
    if (publicationId === null) {
      vaultAssert(mode === 'active', 'NOT_FOUND');
      const m = this.mediaForUpload(scope, mediaId);
      vaultAssert(m.status === 'uploaded', 'MEDIA_PENDING');
      return m;
    }
    const p = mode === 'review' ? this.reviewMemory(scope, publicationId) : this.readPublication(scope, publicationId), m = p.media.find(m => m.id === mediaId);
    vaultAssert(m, 'NOT_FOUND');
    return m;
  }
  reviewMemory(scope: VaultScope, id: string): VaultPublication & { memory: VaultMemoryReview } {
    const p = this.publication(scope, id);
    vaultAssert(p.kind === 'shared-memory' && p.memory && p.state !== 'revoked' &&
      p.approvers.some(a => vaultPrincipalEqual(a, scope)), 'NOT_FOUND');
    return p as VaultPublication & { memory: VaultMemoryReview };
  }
  /** Local immutable evidence only: never calls back into a waiting LedgerRoom writer. */
  async memoryEvidence(scope: VaultScope, rawBinding: MemoryPublicationBinding, candidate: MemoryPublicationCandidate,
    mode: 'compose' | 'keep'): Promise<VaultMemoryEvidence> {
    const binding = decodeMemoryPublicationBinding(rawBinding), digest = await memoryCompositionDigest(candidate);
    this.check(scope);
    const p = this.reviewMemory(scope, binding.publicationId);
    vaultAssert(same(binding, memoryPublicationBinding(p.id, p.digest, p.memory)) && digest === binding.compositionDigest, 'COMPOSITION_CHANGED');
    if (mode === 'compose') vaultAssert(vaultPrincipalEqual(p.owner, scope) && p.state === 'prepared', 'NOT_FOUND');
    else vaultAssert(mode === 'keep' && p.approvals.some(a => vaultPrincipalEqual(a.principal, scope) && a.digest === p.digest), 'APPROVAL_REQUIRED');
    return { binding, approvedMemberId: mode === 'keep' ? scope.memberId : null, mediaIds: p.media.map(m => m.id) };
  }
  listReceipts(scope: VaultScope): VaultPublicationReceipt[] {
    this.check(scope);
    return this.storage.list<VaultPublication>('publication/').filter(p =>
      p.approvers.some(a => vaultPrincipalEqual(a, scope)) ||
      (p.state === 'active' && p.recipients.some(a => vaultPrincipalEqual(a, scope))))
      .map(p => this.receipt(scope, p));
  }
  listMail(scope: VaultScope): VaultMailCard[] {
    this.check(scope);
    return this.storage.list<VaultPublication>('publication/').filter(p =>
      vaultPrincipalEqual(p.owner, scope) || (p.state === 'active' && p.recipients.some(a => vaultPrincipalEqual(a, scope))))
      .map(p => ({ id: p.id, kind: p.kind, state: p.state,
        title: p.releaseAt !== null && this.clock() < p.releaseAt ? null : p.content.title,
        ownerMemberId: p.owner.memberId, recipientMemberIds: p.recipients.map(a => a.memberId),
        role: vaultPrincipalEqual(p.owner, scope) ? 'sent' : 'received', releaseAt: p.releaseAt, preparedAt: p.preparedAt,
        sealed: p.releaseAt !== null && this.clock() < p.releaseAt }));
  }
  private receipt(scope: VaultScope, p: VaultPublication): VaultPublicationReceipt {
    return { ...this.reference(scope, p), state: p.state, acceptedReceiptId: p.acceptance?.receiptId ?? null,
      preparedAt: p.preparedAt, activatedAt: p.activatedAt, revokedAt: p.revokedAt };
  }
  cleanupCandidate(scope: VaultScope, mediaId: string): VaultMedia {
    const m = this.owned<VaultMedia>(scope, `media/${vaultId(mediaId)}`);
    vaultAssert(!this.storage.list<VaultDraft>('draft/').some(d => d.content.mediaIds.includes(mediaId)), 'MEDIA_REFERENCED');
    vaultAssert(!this.storage.list<VaultPublication>('publication/').some(p =>
      p.state !== 'revoked' && p.media.some(m => m.id === mediaId)), 'MEDIA_REFERENCED');
    return m;
  }
  tombstoneMedia(scope: VaultScope, id: string): void {
    const m = this.cleanupCandidate(scope, id);
    this.storage.put(`media/${id}`, { ...m, status: 'deleted' });
  }
}
