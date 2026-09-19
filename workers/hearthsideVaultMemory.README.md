# Reviewed media memories — integration contract

This package is local implementation. It neither applies a schema nor activates
Vault publication, a key, a provider, notifications or guest visits. The real Vault
and browser code are tested here; the canonical-shaped reference authority in the
isolated two-DO test is a fixture. Actual LedgerRoom admission remains a separate
integrated proof owned by the integration package.

Budget delta: private letter lineage, authentication subjects, media bytes and
capabilities never enter a financial command or shared memory metadata. Engagement
delta: couples can deliberately copy a photo/voice into a memory, author their own
recollections, review the same entire composition and each choose to keep it.

## Exact shared contract

`src/hearthside/memoryPublication.ts` owns `MemoryPublicationBinding`, its strict
decoder, `memoryPublicationProjection` and `memoryCompositionDigest`. It imports
`MemoryComposition` as a type only, avoiding a runtime cycle. The root contract
must add `publication?: MemoryPublicationBinding` to `MemoryComposition`, allow
that key in `decodeMemory`, and call `decodeMemoryPublicationBinding` when present.
Legacy media-free memories omit it. A binding includes version, publication id and
digest, memory id and revision, and the complete composition digest.

The projection includes title, date, experience, ordered media ids/versions/kinds/
captions, historical design references, separately authored recollections and
amount visibility. Approvals, withdrawal state and the binding itself are excluded.
The root decoder validates the composition before hashing. The Vault also captures
the full immutable projection and private media manifests in its publication hash.
It never asks a second person to approve only a subset of the memory.

`VaultReference` gains optional `memory: MemoryPublicationBinding` for media
memories. The strict root `HearthsideAcceptanceStore` decoder must allow and decode
it, require `kind === 'shared-memory'`, and ensure its publication id/digest equal
the outer reference. Root acceptance checks the current exact bound memory and
all active members' same-revision choices before accepting. Ordinary letters and
capsules retain their existing reference shape and private receipt storage.

## Trusted RPCs and writer ordering

The Vault constructor assembles these callbacks from `LEDGER_ROOMS`, or tests may
inject the separate `HEARTHSIDE_MEMORY_AUTHORITY` capability:

```ts
validateVaultMemoryCandidate(
  scope: Scope, candidate: unknown, expectedRevision: number
): Promise<{ candidate: MemoryPublicationCandidate; compositionDigest: string }>

vaultMemoryAccess(
  scope: Scope, binding: MemoryPublicationBinding, mediaId: string | null
): Promise<{ current: boolean; kept: boolean }>
```

The candidate callback validates the current CAS revision, empty approval list,
non-withdrawn state, speaker-only recollection edits, canonical experience and
actual historical design snapshots. It performs no write. It must accept staged
media identities only as a proposal; Vault separately authorizes their manifests.

`current` requires an exact, non-withdrawn canonical memory, matching binding,
revision and composition digest, plus media inclusion when the id is non-null.
`kept` additionally requires the current active couple's exact-version choices.
Both callbacks recheck authenticated scope/membership. The null media id is used
for full review metadata. No letter-authentication subject enters this evidence.

The Vault exposes one additional **trusted-only** RPC:

```ts
checkMemoryPublicationFor(
  scope: Scope, binding: MemoryPublicationBinding,
  candidate: MemoryPublicationCandidate, mode: 'compose' | 'keep'
): Promise<{ binding: MemoryPublicationBinding;
  approvedMemberId: string | null; mediaIds: string[] }>
```

It validates local immutable Vault evidence, author/approver identity and the
caller's actual exact-digest approval. It makes **no** LedgerRoom callback. A root
serial writer may await this RPC without creating a writer-to-Vault-to-writer
cycle. Root must still revalidate its own current composition/CAS after that await
and before committing; the evidence is not a substitute for canonical admission.

Root `memory.compose` with media requires successful `compose` evidence, sets the
new binding and clears all prior approvals. Root `memory.keep` with media requires
successful `keep` evidence for the actor. Never accept a client-supplied approval
array. Root must track the exact source/publication reference in its shared memory
metadata and make withdrawal checks against that reference. Direct composition
changes without a new bound review must not preserve media approval or delivery.

## User-visible sequence

1. `prepare-memory` receives `{id, candidate, expectedRevision,
   recipientMemberIds, sourcePublicationId?}`. The service validates the prospective
   canonical composition, resolves the current whole couple and captures immutable
   manifests. Generic `prepare-publication` refuses shared memories. No fake private
   draft is created; memory source-manifest identity is its publication identity.
2. The browser calls canonical `memory.compose` with that binding. Only the exact
   prepared proposal becomes available for named joint-approver review. The
   prepared response exposes no private draft lineage or authentication subjects.
3. `review-memory` returns the exact projection and sanitized manifests. Review
   media uses the authenticated `X-Vault-Media-Mode: review` header and the exact
   publication id. It requires a named approver and current bound proposal.
4. Each explicit Keep calls Vault `approve` with its digest, then canonical
   `memory.keep`. The owner later retries `activate` with the same identity; root
   private acceptance verifies both choices. Lost responses do not manufacture
   another publication or approval.
5. Active delivery requires active Vault state, exact recipient identity and
   current, mutually kept root composition. Caption, photo, amount or recollection
   changes deny old delivery even if an older Vault record remains stored.
6. Withdrawal calls Vault first, then canonical `memory.withdraw`. It remains
   available while publication writes are disabled. Revoked reviews and media are
   denied. The UI removes cached attachment Blob URLs on withdrawal/unmount.

Extend the root-owned client method to
`media(id, publicationId?, mode: 'active' | 'review' = 'active')`; send the new header
only for explicit review. Invalid mode values are refused. No query or bearer URL
acts as an access grant.

## New copies and pending recollections

`copy-media` takes `{id, sourceMediaId, sourcePublicationId: string | null}`. Null
means an author-owned uploaded object; a publication id requires current active
recipient access and server release time. Ownership or household membership alone
cannot open somebody else's letter. The source is rechecked around object-store
awaits. An interrupted/withdrawn source cannot produce an acknowledged new copy.
Accepted private copies retain their identity through retry and become independent
of later source deletion/withdrawal. Failed copies cannot expose pending bytes.

Copy provenance stays in private Vault/IndexedDB records. The client returns only
`MediaReference` fields to the memory editor. A source letter id, its private words,
recipients, subjects and URLs never become shared memory metadata. New photos use
the existing decoded-pixel normalization/metadata removal before the private queue.

The other partner can also add their own recollection while a media proposal is
still pending. `prepare-memory` can reuse immutable media from the **current
proposal for the same memory and the same exact couple**, with fresh paired
approval. This grants no privately owned media copy and cannot be used to create
a letter or bypass publication. Source withdrawal is rechecked before capture.

## Component and recovery API

`MemoryPublication` takes `client`, exact `scope`, `theme`, `candidate`, `roster`,
optional `editable`, `enabled`, `artwork`, and these callbacks:

```ts
onChange(candidate: MemoryPublicationCandidate): void
compose(candidate: MemoryPublicationCandidate): Promise<boolean>
keep(binding: MemoryPublicationBinding): Promise<boolean>
withdraw(binding: MemoryPublicationBinding): Promise<boolean>
onActivated?(): void
```

Use editable mode inside the existing memory draft editor, and the canonical
selected memory in Theatre reading mode. Supply actual historical artwork through
`artwork`; include its readiness in `enabled`. Existing no-media composition and
keeping flows remain valid. When media are present, the component owns the review
buttons, so do not leave an adjacent legacy button able to bypass the handshake.
The root callbacks must recognize already accepted same-binding retries and
preserve their canonical command identities. Keep original object return/focus
handling in the root room flow.

Private IndexedDB recovery reserves publication/copy identities before network
requests and is keyed by environment, household, member and Auth subject. It stores
the original source publication for same-memory preparation retries, independently
of a newly assigned pending binding. Copy recovery works after a lost response and
reload; a changed caption does not create a duplicate byte copy. Source selection
and copy confirmation are separate UI steps. Upload bytes stay in the existing
private upload queue; temporary Blob URLs are revoked and never persisted.

The private intent store is bounded to 500 entries. A full/unavailable store refuses
new network work and keeps the visible draft. Product-level completed-intent
retention/cleanup must be reviewed with private recovery policy before long-lived
activation; it is not silently purged in this package.

## Local evidence and remaining gates

The pure contract/client tests check exact projection changes, strict binding,
private storage failure, same-identity retries, original-source retention, caption
edits, scope isolation and approval/withdrawal ordering. Real Miniflare tests cover
two-DO callback ordering, current audience, shared review media, spoofed approval,
source withdrawal during copy, original deletion versus independent copy, pending
partner recollections, canonical acceptance loss, changed caption and replacement
member denial.

Browser tests exercise both synthetic members, all three themes at 320, 390,
719/720, 1100, 1440 and 1920 pixels, keyboard, axe, dark/enlarged text, explicit
copy review and focus return, real IndexedDB reload recovery, normalized photos,
exact paired keeping, activation retry and Blob URL cleanup. Synthetic screenshots
are in `/tmp/hearthside-memory-proof`; the teal image is a labelled test fixture.

Actual LedgerRoom admission and receipt recovery, integrated room/navigation
clearance, authenticated devices, hosted key/service activation and physical-device
acceptance remain open until independently exercised. The isolated checkout uses
a read-only copy of the integration owner's uncommitted core contract for type
resolution; that copy/symlink is deliberately excluded from this package's commit.
