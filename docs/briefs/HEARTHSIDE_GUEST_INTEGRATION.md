# P12 integration contract — guest copies and private street

This package contains new files only. No production bindings, flags, secrets, schema application, external email or invitation sending are enabled. Root owns the following insertion points and must run the integrated canonical authority test before enabling anything.

## Worker assembly

In the existing Worker module, import/re-export `HearthsideGuestRoom`, `HearthsideGuestCard`, `HearthsideGuestIndex` and `handleHearthsideGuests` from `workers/hearthsideGuests.ts`. Extend the existing environment type with `GuestEnv` from `workers/hearthsideGuestTypes.ts`. Near the existing private Vault routing, before assets, add:

```ts
const guestResponse = await handleHearthsideGuests(request, env);
if (guestResponse) return guestResponse;
```

`workers/hearthsideGuestEntry.ts` is also a complete standalone assembly for local verification. The test-only `TestControl` / `TestSource` / `__test` routes are not exported by that assembly and must never enter the deployed entry.

Prepared configuration fields (all optional; both flags remain `false`):

- `HEARTHSIDE_GUESTS_ENABLED=false`, `HEARTHSIDE_GUEST_PUBLICATION=false`.
- SQLite DO bindings: `HEARTHSIDE_GUEST_ROOMS` → `HearthsideGuestRoom`; `HEARTHSIDE_GUEST_CARDS` → `HearthsideGuestCard`; `HEARTHSIDE_GUEST_INDEXES` → `HearthsideGuestIndex`. Add a separately reviewed DO class migration when activation is authorized.
- Private R2 bindings: `HEARTHSIDE_GUEST_ARCHIVE` and `HEARTHSIDE_GUEST_MEDIA`. No public/custom-domain media exposure.
- Existing `LEDGER_ROOMS`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`.
- Dedicated server-only `HEARTHSIDE_GUEST_AUTHORITY_KEY_ID`, `HEARTHSIDE_GUEST_AUTHORITY_KEY` (32 bytes represented by 64 lowercase hex characters). Never reuse the Vault key. Never put either key in Vite/browser config.
- Optional `HEARTHSIDE_GUEST_CONTROL_PLANE` is a server fetch binding for a private proxy/test authority; absent means the configured Supabase RPC URL is used directly.

Migration `024_hearthside_guest_authority.sql` is prepared source only. It inserts no secret and enables no key. The caller's live Auth session plus a short-lived HMAC bound to exact token hash, environment and requested household is required. Visitor membership in the host household is deliberately not required. Host mutations still require canonical `own_member_id` and the exact active member/subject. The HMAC-bearing authority result and Auth subjects never reach a browser response.

## LedgerRoom callbacks

Add only these trusted DO RPC methods; do not add them as browser HTTP commands:

```ts
captureGuestSource(scope: Scope, input: GuestPrepareInput): Promise<GuestSourceCapture>;
validateGuestSource(scope: Scope, proof: GuestSourceProof,
  mode: 'activation' | 'visit'): Promise<boolean>;
// Existing method, with kind:'guest', remains a private receipt:
acceptVaultPublication(scope: Scope, reference: Omit<GuestAcceptance,'receiptId'|'acceptedAt'>): Promise<GuestAcceptance>;
```

Import `captureGuestSources`, `validateGuestSources`, and `GuestSourceCatalogue` from `src/hearthside/guestProjection.ts`; the strict contracts live in `guestContracts.ts`. Construct the catalogue from current accepted Hearthside metadata and shared design authority. Never let HTTP JSON provide a catalogue or shared/private booleans.

Catalogue requirements:

1. `activeMemberIds`: canonical active household members. The guest service also independently obtains the currently bound Auth principals from migration 024 and compares the exact original roster.
2. `experience(id)`: only shared Hearthside experience records; return revision/title/intention and `archived: state === 'archived'`. No banks, references, target or financial evidence.
3. `note(id)`: only shared placed notes; return revision/text/archived. Do not resolve private Workspace notes or letters.
4. `memory(id)`: only current mutually kept, non-withdrawn MemoryComposition. Return exact title, recollections, approvals, revision, publicationId, approved media references, and `designs: memory.designs.map(d => ({designId:d.documentId,pieceId:d.pieceId,revision:d.revision}))`. The publication ID is server-private. For media-backed memories require the current exact MemoryPublicationBinding. For words/design-only compositions with no media, publicationId is null and no Vault publication is required.
5. `memoryAccess({id,revision,publicationId})`: For publicationId null, verify the exact canonical no-media composition revision, both current approvals and non-withdrawal (plus current shared-design access). For a non-null publication ID, additionally verify that exact original publication is active/current and has not been withdrawn in Vault. A new publication cannot substitute for a withdrawn original. Returning false closes guest access; it does not rewrite the immutable copy.
6. `piece(designId,pieceId,revision)`: load the exact historical authored revision using `snapshotKittyDesignRevision`; require `document.scope.ownerMemberId === null`, environment and household match, and current shared piece is not hidden/deleted/archived. Return only the historical piece and permission flags. Do not call `setFill`, choose goal scaling, or use presentation poses.
7. `media(reference)`: fetch only the exact mutually reviewed, currently active shared-memory publication media. Return copied metadata-clean bytes, allowed MIME and SHA256. Never read private drafts, recipient letters/capsules or broad Vault media by content ID alone. `GuestSourceMedia.publicationId` is the permission boundary.

**Avoid callback deadlock:** snapshot the narrow canonical catalogue under `LedgerRoom.serial`; release the lock before calling Vault methods that call `vaultMemoryAccess` back into LedgerRoom. Load media outside that lock, then build a fresh catalogue and revalidate before returning. The guest service validates again before the private acceptance receipt and once more after acceptance before marking a publication active. Visit validation returns a boolean only; it does not give visitors LedgerRoom snapshots.

The private proof contains the exact selection, original memory publication bindings and digest. It stays in the private guest archive. `GuestArrangement` is the entire visitor allowlist and contains new object/media IDs only. Cat/stamp source IDs are remapped; cat sizes are fixed. A receipt returned by `acceptVaultPublication` is durability evidence, not source-read permission. No household command vocabulary, accounting event or backup financial restore needs a new guest authority path.

## UI / route integration

Import `GuestVisits` from `src/hearthside/GuestVisits.tsx` and its props from the same module.

```tsx
<GuestVisits
  auth={{ scopeKey: stableOwnIdentityAndSessionPartition,
          token: () => getCurrentOwnAccessToken() }}
  theme={theme}
  host={isHouseholdMember ? {householdId, choices: eligibleSharedGuestChoices} : undefined}
  onClose={returnToHearthside}
/>
```

`GuestSourceChoice` includes `{kind,id,revision,designId?,label,detail?}`. Populate it from current accepted shared metadata only. Passing a choice does not grant access: the service independently captures and validates it. No household object is passed to this component. GuestRoomView imports the already integrated authored RoomScene/CSS and supplies only sanitized copies; no live room navigation, arrangement callback or private intention graph is passed. A guest who has no host membership must be able to open their own private Street immediately after their own Google sign-in, without running host household onboarding or fetching a host replica. Add the private Street route at that own-authenticated level; the host entry can be an intentional Hearthside doorway.

The top-level surface is keyed by Auth scope partition plus host household. Its durable pending intent uses IndexedDB partitioned by the same identity. A mutation is saved before transmission; only explicit user retry resubmits the same command. No tokens or source snapshots are stored in that intent. On scope change, all active fetches, URLs/audio, view state and presence leases are closed. Old pending actions are shown only when that exact identity returns.

No unsolicited recipients, discovery/search, generated personal memorabilia, financial amounts, ordering or external uploads appear. Calling cards are created manually by their recipient; the recipient copies the high-entropy code themselves. Opening an approved invitation only changes the recipient's in-app Street.

## Recovery, lifetime and limits

Private SQL records + monotonic outbox acknowledge only after immutable R2 journal and conditional head persistence. Lost acknowledgements retry the same IDs/digests. Publication/invitation/calling-card revocation is monotonic. Street/host indexes are private and repairable through stable retries. Card revocation denies access before cross-room cleanup, and retries complete fan-out cleanup.

Trusted `restoreGuestArchive(name,maxEntries)` is not reachable through HTTP. Recovery requires an operator-fenced **empty** replacement DO, reads the latest journal including any tail beyond a stale head, stages bounded pages, then atomically exposes all restored state. Restore every affected namespace; keep private media in its dedicated bucket. Do not import an older selected backup over a live guest namespace. Financial restore must never reset these records. Keep revocation tombstones and do not recycle namespace identifiers.

Presence is authenticated polling with a 15-second lease and a 3-second browser refresh, not WebSockets. Revoke removes server presence immediately; a connected client closes on its next poll. Hosted rooms require a live host for both room and media access. Backgrounding closes the local visit; the user deliberately re-enters. Chime/firefly/ball are bounded ephemeral events and never source mutations. Reduced motion retains all controls and shows static toy results.

Limits: 12 objects; 192KiB guest manifest; 8MiB each copied image/voice file, 24MiB total, 16 media entries; 8 design snapshots per Memory; 40 grants per room; 80 Street pointers; 200 host publication/card grant entries; 24 present sessions. Calling-card redemption lasts seven days; a manual grant can last up to 366 days (UI offers 1/7/30). Limits fail closed rather than silently truncating the reviewed copy.

## Required integrated acceptance

The isolated tests execute the actual Guest Worker and DO/R2 implementation plus a synthetic signed control-plane service, and independently execute migration 024 using PGlite/pgcrypto and canonical session functions from migration 017. Root still must test the inserted callbacks against actual LedgerRoom + Vault and current shared design documents. Include an exact memory publication replacement/withdrawal case and a media callback re-entry case. Hosted activation and meaningful-data readiness are separate from this local proof.
