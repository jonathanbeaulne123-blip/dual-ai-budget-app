# Shared Workspace archive integration

This package stacks on `81bc9db` and its already integrated
`workspace-workers-integration.patch`. Local dependency commit `6b2fb5c` applies
that patch only to establish a reviewable base; cherry-pick only the final archive
commit. Root's newer canonical acceptance code remains the authority for receipts.
Local dependency `54d5441` also applies the already integrated Chapter authority
patch and P9 test type correction; skip that dependency when integrating.

## Runtime boundary

`HerculesSharedWorkspace` now uses the existing private `HERCULES_FILES` R2
binding. The binding must be available to the shared Agent's Worker environment.
There is no new bucket, public endpoint, bearer URL or activation in this change.
Absent or failing R2 denies success with `SHARED_ARCHIVE_UNAVAILABLE`.
Keep existing Workspace disclosure/execution activation gates. No provider or
external disclosure is performed by archive operations.

The dedicated prefix is
`hearthside-shared-workspace-archive-v1/<environment>/<household>/`. It is separate
from personal Workspace source keys and the Vault archive. Private source cleanup
must never match this prefix. No object lifecycle rule may remove these objects
while shared copies, withdrawals or their recovery history remain authoritative.

No Env/config change is needed if the existing `HERCULES_FILES` binding is
already supplied to this shared Agent. The new `SharedWorkspaceArchiveEnv` is
narrow and optional at the type boundary; missing storage fails closed at runtime.
If a host assembles a reduced environment for the Agent, pass its existing
private R2 binding as `HERCULES_FILES`. Do not substitute a public asset bucket.

## Durable transitions

The existing `shared_workspace_artifacts` and `shared_experience_artifacts`
tables remain the live source. Their existing contents are preserved and adopted
as immutable journal baseline entries before new work succeeds. A shared scope
cannot initialize over an existing remote archive: it requires explicit restore.

Initial metadata, adopted rows' outbox entries and the owner row with its outbox
entry commit in one SQLite transaction. Failure creating the first owner rolls
back the complete initialization, so retry cannot acknowledge an ownerless
archive. Existing metadata with no matching owner fails closed as corrupt;
this code does not guess an owner or rewrite an already damaged archive.

Each actual state change and its monotonically sequenced outbox entry commit
together in SQLite. The service serializes each operation, writes content chunks
and the immutable journal manifest, advances the R2 head with an ETag condition,
then acknowledges the local outbox. A lost reply retries the same copy identity.
Neither an uncertain head write nor an uncertain head reply creates another copy.
Prepare, activation and withdrawal all wait for this durable path before success.
Read paths first drain pending durable work and fail closed when storage is down.

Only approved copy content enters this namespace. Root household metadata keeps
its existing compact publication reference and authoritative receipt. Auth tokens,
subjects, private source/project IDs and source attachment bytes are not archived
by the shared-copy service.

Copy content retains the existing 500,000-character contract. UTF-8 bytes are
split into 256 KiB immutable chunks and recombined before strict UTF-8 decoding;
a character crossing a chunk boundary is never truncated. Each chunk, whole row,
journal and checkpoint has a checksum. Four MiB is the row serialization ceiling,
which covers the full text limit even when JSON escaping expands its bytes.

Optional checkpoints contain only row references, never an unbounded concatenated
content blob. Restore pages decode and stage one row at a time. Journals and
tombstones are never flattened away or garbage-collected here.

## Explicit restore

The trusted-only RPC is:

```ts
restoreSharedCopiesFromArchive(scope, maxEntries = 32)
  : Promise<{ complete: boolean; sequence: number; target: number }>
```

There is no browser/HTTP restore command. Invoke only through the controlled
recovery procedure for the correct lost shared authority. The process accepts no
caller-supplied backup, sequence or old checkpoint. It repairs a durable journal
tail after an uncertain head publication, stages the latest complete checkpoint
and tail, checks again for newer entries, then adopts the rows atomically.
Repeated calls resume the private staged cursor. Incomplete/corrupt staging is
never readable as a published copy.

Restore refuses any nonempty live namespace. Stop/fence the prior lost authority
before assigning its recovered namespace; a stale live instance cannot silently
overwrite a remote tip beyond its locally known sequence. This is an explicit
service recovery action, independent from financial or shared-life snapshot
restoration. Do not connect it to a financial restore.

Transitions retain immutable copy identity/content, and withdrawal is terminal.
Original source deletion remains a separate operation and does not withdraw a
previously reviewed shared copy. Root's canonical withdrawal checks must still
require the shared copy to be revoked before accepting its withdrawal reference.

## Evidence boundary

`hearthside-workspace-archive.test.ts` uses the actual shared Agent, SQLite and R2,
with synthetic authenticated scope. It exercises migration, maximum-length text,
head failures, restart with persisted storage, checkpoints, latest-only restore,
withdrawal and corrupted content. The existing P9 runtime test still exercises
real private/shared Agents, source deletion and acceptance/withdrawal ordering.
Additional fault-injection coverage aborts the first owner INSERT, verifies no
metadata/outbox remains, then retries and restores both fresh and adopted legacy
copies into an empty namespace. A stale-head tail longer than 128 entries and a
withdrawal arriving between recovery pages both finish at the latest terminal
state without exposing staged rows.

These are local synthetic checks. Hosted object lifecycle, runtime activation,
authenticated cross-device continuity and integrated release remain separate gates.
