# Google-account cloud continuity

> **Accepted product direction — 2026-08-24.** This file supersedes language that describes hosted sync as optional publishing, a three-word phrase as the normal access model, or one phone as the durable home of the ledger.

## Implementation status — D-113 through D-115 Development slices

The first working continuity slice is implemented without applying hosted schema:

- **Continue with Google** is available even when a fresh device has no local household;
- Development scans the deliberately open snapshot rows, accepts only exact Google subject membership (email is a legacy fallback only when the stored subject is empty), and offers every matching household;
- pulled/reconciled snapshots pass the same PGlite/accounting acceptance boundary before display or persistence;
- signed-in accepted writes enter a durable per-device outbox before transport; later offline writes compact into the latest snapshot while keeping the earliest expected hosted revision and all confirmation ids;
- launch, focus, and reconnect retry the outbox and then pull newer matching snapshots;
- stale hosted revisions stop automatic replay, keep the queued local snapshot, retain the remote snapshot, and surface a conflict instead of overwriting either side;
- Production discovery is deliberately disabled until the Auth/RLS cutover.
- each environment now keeps a catalog of household replicas keyed by household id; opening one ledger no longer overwrites another, and the header switcher changes the active replica explicitly;
- the active session remembers its household id, legacy `hearth:v1:<environment>` snapshots migrate automatically, and reset removes only the selected ledger;
- every signed-in member gets a durable member-only personal replica keyed by environment, household, and member. The Personal view reads that replica while the existing full-snapshot sync envelope remains lossless.
- D-115 adds an unapplied hosted migration for explicit Google membership rows and member-personal snapshots. When those tables exist, discovery filters by Google subject on the server, fetches only matching households, and overlays that member's hosted Personal scope. Signed-in transport writes the membership and member-only Personal payload before advancing the household snapshot.

Migration 003 is **not applied**, so deployed clients continue using D-113 open-snapshot discovery until Jonathan separately approves the schema change. This is not completion of D-112: hosted authority remains snapshot-based, CAS remains GET-then-compare-then-POST, the outbox is localStorage-sized, membership selectors are not Supabase Auth, and explicit acknowledgement/backoff remains. No peer device must remain online for a snapshot that has reached the cloud.

## Household promise

A person signs into Hearth with their Google account on any supported device and can immediately open:

- their personal ledger; and
- every household ledger that Google identity belongs to.

No phone or computer is the host. Turning off, losing, or replacing one device must not make either ledger unavailable. A connected device reads and writes through the cloud-backed account. Each device may keep a PGlite replica/cache and may queue offline work, but another device never depends on that replica being online.

## Authority and synchronization

- Google identity is the account-entry and recovery identity. Household membership determines which household ledgers appear.
- The cloud is the durable cross-device continuity layer for both personal and household data.
- PGlite validates double-entry books and supports fast local/offline use; it is not the only copy required for another device to work.
- After sign-in and membership discovery, synchronization is automatic. `linked: true`, a separate **Publish to the cloud** action, a three-word phrase, or a Hearth Pass must not be required for ordinary ongoing access.
- Pairing phrases, join links, and Hearth Pass files may remain invitation, bootstrap, backup, export, or recovery tools. They are not the primary storage or authentication model.
- Offline writes use durable command identity/outbox records and synchronize when connectivity returns. Two devices may work independently; neither silently overwrites the other.
- Every pulled or merged money state must pass the same command, accounting, environment, and idempotency checks as a local write before it becomes the visible or durable accepted snapshot.

## Development-data window

Through **2026-09-30**, Hearth is operating with disposable development data:

- information entered before October is not important household data and may be fully readable and writable to accelerate development;
- open hosted read/write access, incomplete Auth/RLS, and weak privacy controls are disclosed temporary development conditions, not blockers for building and testing cloud continuity;
- do not describe this data as private, secure, or production-ready;
- credentials, service-role keys, database passwords, third-party secrets, and unrelated personal accounts are never disposable and must still stay out of the repository and browser bundle;
- Development and Production remain separate, and accounting integrity, idempotency, recovery, and conflict safety remain mandatory.

The relaxed development-data policy does not authorize silent destructive cleanup, schema application, Production deployment, or secret changes. Those remain explicit release actions.

## Late-September security milestone

Before **2026-10-01** and before meaningful household information is entered, ship and verify the security update:

- Google-authenticated user identity and session recovery;
- durable user-to-personal-ledger and user-to-household membership mapping;
- least-privilege, deny-by-default RLS for personal and household records;
- invitation, membership removal, recovery, and cross-household denial tests;
- protected secrets and an atomic hosted command/CAS boundary;
- a reviewed migration, rollback, and cutover plan;
- proof that pre-October disposable rows are either intentionally retained as fixtures or removed through an approved recovery-aware cleanup.

Security is a scheduled September milestone. It must not be misused to justify a device-dependent architecture, and temporary openness must not be carried into October by accident.

## Acceptance tests

The continuity work is complete only when automated and manual tests prove:

1. Sign into a new device with Google and see the correct personal and household ledgers without the old device online.
2. Write on device A, turn A off, and read/write the accepted result on device B.
3. Work offline on either device, reconnect, and synchronize without duplicate posting or silent loss.
4. A pulled snapshot with changed amounts but the same entry count cannot bypass PGlite/accounting validation.
5. Personal and household ledgers remain distinct data scopes even during the temporary open-development window.
6. Development and Production never cross.
7. After the security cutover, unauthorized and cross-household access is denied.
