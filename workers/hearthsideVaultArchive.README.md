# Private Vault recovery

This package adds local implementation and synthetic runtime proof. It does not
provision a bucket, activate a service, apply SQL, create keys or perform a hosted
restore. Financial restore never calls this path.

## Acknowledgement and storage

`VaultJournalStorage` commits each changed private record and a monotonic sequence
entry in one SQLite transaction. An identical retry does not allocate another
revision or journal entry. `HearthsideVaultArchive` drains that durable outbox to
private R2 before any successful command, upload receipt or snapshot response.
Each journal entry includes the preceding SHA-256 digest. The immutable journal
object is written conditionally, then an ETag compare-and-set advances `head.json`.
Only then is the SQL outbox entry acknowledged. Lost journal/head responses are
resolved by comparing the same sequence and digest on retry.

The archive uses `HEARTHSIDE_VAULT_ARCHIVE` when supplied, otherwise the existing
private `HEARTHSIDE_VAULT_MEDIA` bucket. Metadata lives beneath
`hearthside-vault-archive-v1/development/<household>/`; original private media bytes
remain beneath `vault-v1/development/<household>/`. Neither prefix is public or
cache-backed. Records contain private content and recipient identity subjects;
they must never be copied into a household archive, shared snapshot, logs or a
downloadable public backup. Transient authentication tokens, HMAC keys and bearer
URLs are never part of the journal schema.

The protocol depends on direct Worker binding reads and conditional writes under
R2's [strong consistency guarantee](https://developers.cloudflare.com/r2/reference/consistency/)
and [Workers API conditional operations](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/).
There is no Cache API or public-domain read path. Checksums detect damaged or
conflicting data; they do not defend against a malicious bucket administrator who
can rewrite the entire history.

Archive I/O is serialized independently of user actions. A withdrawal can still
interleave with a waiting publication acceptance. Revocation blocks access in SQL
immediately and is archived before acknowledgement. Cleanup additionally archives
the irreversible media tombstone before deleting its bytes. Reads recheck access
after storage awaits. Failed archive persistence produces an unavailable response;
it cannot claim a successful private mutation. The durable outbox remains retryable.

## Trusted, latest-only recovery

`HearthsideVault.restoreFromArchive(scope, maxEntries = 128)` is a trusted internal
RPC, excluded from the HTTP command vocabulary and HTTP binding interface. An
operator must explicitly isolate/fence the old authority before recovery. The
method refuses any nonempty SQL replica; it cannot roll a working Vault backward.
Production remains disabled. No automatic financial or browser restore invokes it.

An empty DO refuses ordinary access when private archive evidence exists. Recovery
verifies the latest head, repairs a contiguous durable journal tail after a lost
head write, and stages at most 128 entries per call in separate SQL tables. Call
again while `{ complete: false, sequence, target }` is returned. Staged content is
unreadable until the full hash chain reaches the latest verified head and is
atomically promoted. Revocation and deletion tombstones cannot transition back to
live content. A stale head cannot hide a later retained withdrawal journal.

A journal write that reached R2 but lost acknowledgement can appear after recovery;
it retains its original identity and receipt. A write that never reached R2 and
was never acknowledged is not promised recoverable after total SQL loss. A corrupt
or conflicting archive fails closed. Repairing the private archive and resuming
the explicit recovery is required; there is no public reset/bypass operation.

Optional checkpoints accelerate recovery every 32 entries when there are no more
than 128 records and the checkpoint fits within 8 MiB. Journal entries are bounded
to 512 KiB. Larger stores retain the complete journal and use paged replay; they do
not silently discard records to meet a checkpoint limit. Checkpoints retain all
current tombstones, approvals and receipts. Journals are never flattened or deleted.

R2 lifecycle rules must retain the archive prefix and required media. Source draft
deletion clears current content, while older private journal revisions remain in
the recovery archive. Backup retention, erasure policy, storage growth limits and
operator access are explicit Release decisions, not implemented lifecycle deletion.
Any future pruning must preserve the latest withdrawal/deletion evidence. A legacy
pre-archive SQL store is journalled as a preserved baseline on first access only
when no archive exists; this has no hosted migration claim.

## Authority assembly

The real Vault constructor builds `createVaultPublicationAuthority` when its
Supabase URL/publishable key, dedicated authority key/id and `LEDGER_ROOMS` bindings
are configured. Tests may inject a server-only authority. The production-shaped
assembly calls only these trusted room RPCs, using the exact environment/household
DO identity:

```ts
acceptVaultPublication(scope: Scope, reference: VaultReference): Promise<VaultAcceptance>
vaultMediaReferenced(scope: Scope, mediaId: string): Promise<boolean>
```

The constructor uses a narrow structural type, with no LedgerRoom runtime import
or circular dependency. It installs no default guest resolver. The fresh token
travels only through the audience adapter during this request; LedgerRoom receipt
storage never receives it. The actual receipt writer and its private recovery
archive are owned by the integration package.

## Evidence and remaining gates

The actual Miniflare SQLite/R2 suite tests lost head writes and acknowledgements,
same-identity retries, uploaded bytes, sealed capsules, withdrawal during waiting
acceptance, stale-head repair, paged empty-DO restore, tombstone-before-byte cleanup,
checkpoint restore and checksum corruption. A second real runtime test assembles
the configured audience adapter and a canonical-shaped LedgerRoom RPC, using a
local synthetic control-plane Worker. It caught and fixes unsupported workerd
`redirect: 'error'`: the adapter now uses `manual` and rejects redirects without
following them. Unit coverage verifies no redirected credential request occurs.

These are synthetic runtime proofs. Hosted R2 recovery drills, final retention and
authority-fencing operations, provisioned HMAC rotation, live authenticated roster
continuity and physical devices remain separate integration/Release gates. No new
deployment bindings or migrations are applied by this package.
