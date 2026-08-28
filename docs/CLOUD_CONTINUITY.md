# Google-account cloud continuity

> **Accepted product direction — 2026-08-24.** This file supersedes language that describes hosted sync as optional publishing, a three-word phrase as the normal access model, or one phone as the durable home of the ledger.

## Implementation status — D-114 continuity, D-117 scopes, D-122 CAS, D-123 repair, D-149 T1 atomic push

The working continuity slices are implemented. Migrations **002, 003, 004, 005, 006, 007, 008, 012, and 014** are recorded live in the shared Supabase project. Migration **012** (`publish_continuity_snapshot`) is **applied on Development** (2026-08-26) for Auth-signed-in continuity. Migration **014** (Realtime publication) is **applied on Development** (2026-08-26):

- **Continue with Google** is available even when a fresh device has no local household;
- Development discovers memberships through Auth JWT / continuity membership rows (legacy open snapshot scan remains only when membership tables are missing);
- pulled/reconciled snapshots pass the same PGlite/accounting acceptance boundary before display or persistence;
- signed-in accepted writes enter a durable per-device outbox before transport; later offline writes compact into the latest snapshot while keeping the earliest expected hosted revision and all confirmation ids. The **first** hosted write (`expectedRevision === 0`) still calls `hearth_create_household` so the creator is `role='owner'`; command-log append starts only after that membership exists. If create returns `household-already-exists`, the next CAS uses the hosted snapshot revision — it does not treat expected 0 as “another phone” (**live** Worker `cc694eee-3462-4fff-8f71-8675e8ad2ecf`, merge `48b1716` / #210);
- **D-145:** the durable outbox (IndexedDB-first, slim `localStorage` metadata) stores tip revision + identity only — never the full journal. Flush resolves the newest eligible live household (memory, Retry tip, or `loadHousehold`) and refuses tips older than `tipRevision`. Shared `household_snapshots.payload` stays plain JSON for live CAS/create SQL guards; personal envelopes may use an optional gzip envelope (`hearthPayload: 1`); legacy plain JSON remains readable forever;
- launch, focus, and reconnect retry the outbox (with exponential `nextAttemptAt` backoff) and then pull newer matching snapshots;
- successful hosted CAS (including idempotent duplicate delivery) **acknowledges** by removing the outbox item; failed/stale writes never erase locally accepted books;
- stale hosted revisions stop automatic replay, keep the queued local snapshot, retain the remote snapshot, and surface a conflict instead of overwriting either side;
- Production discovery/transport stays off unless `VITE_PRODUCTION_CONTINUITY=1`. When enabled, discovery is membership-scoped only (no bulk snapshot scan), membership INSERT is refused from the client, and shared pushes use Personal projection.
- each environment now keeps a catalog of household replicas keyed by household id; opening one ledger no longer overwrites another, and the header switcher changes the active replica explicitly;
- the active session remembers its household id, legacy `hearth:v1:<environment>` snapshots migrate automatically, and reset removes only the selected ledger;
- every signed-in member gets a durable member-only personal replica keyed by environment, household, and member. Shared cloud projection excludes Personal transactions, shifts, and private goals; only that member's Personal envelope overlays them on read.
- Migration 003 is applied. D-117 explicit Google membership rows and member-personal snapshots are live in Development: discovery filters by Google subject on the server, fetches only matching households, and overlays that member's hosted Personal scope.
- **D-149 T1-S1 / T1-S2 (Auth session):** `pushSupabaseHousehold` calls **`rpc/publish_continuity_snapshot`** — one SQL transaction CAS-advances Shared `household_snapshots` and upserts the member Personal envelope. The “Shared succeeded, Personal failed” split window is gone on Auth continuity paths. Missing Migration 012 → fail closed (no two-trip fallback). See [`SYNC_ARCHITECTURE.md`](SYNC_ARCHITECTURE.md).
- **D-149 T1-S3 (Realtime push):** `VITE_CONTINUITY_REALTIME=1` is baked into the live kitchen build (`.github/workflows/pages.yml`, merged #175). When subscribed, `continuityLivePull` demotes the 4 s REST poll to fallback. Migration **014** added `household_snapshots` and `continuity_personal_snapshots` to the `supabase_realtime` publication on Development (2026-08-26). Two-phone Realtime smoke passed 2026-08-27.
- **T3-S4 scale envelope:** member-scaled poll bands (4 s / 5 s / 8 s) and the anti-claim that 100 open kitchens are not Production-ready on poll alone live in [`SYNC_ARCHITECTURE.md`](SYNC_ARCHITECTURE.md) § Scale envelope. D-121 Hercules chat limits are unchanged.
- **D-122 / D-147 client (Auth-off bridge):** when no Auth session is present, `rpc/publish_household_snapshot` then a separate Personal POST remains the Advanced-recovery two-trip path; D-147 treats Personal fail after Shared CAS as pending (never ack). The pure CAS contract lives in `src/ledger/snapshotCas.ts`. When PostgREST reports the RPC missing (`PGRST202`), Auth/continuity paths **refuse** the legacy GET-then-compare-then-POST race. That legacy path remains only for explicit Auth-off `legacyLinkedPublish` recovery without continuity/Auth.
- **D-123 Auth/RLS:** Google Auth is live. Feature-flagged Supabase Auth stores/refreshes the session and sends its user JWT through discovery, replay, and commits. Additive prepare 004, CAS hardening 005, SELECT bridge 008, and deny-by-default cutover **006 are applied**. Anon household REST is revoked. Migration **010** bind-on-discover is live (2026-08-26 anon EXECUTE denial proof). **D-143 / D-147:** automatic client transport requires a resolved continuity membership identity and an explicit `transportRequested` path; `linked` alone no longer publishes; Auth-off **Publish** is Advanced recovery only. **D-146:** automatic discovery/pull/persist/outbox assert Google subject/member when a continuity identity is present; PGlite audit hashes use the same `financialAuditHash` as accept/CAS. **D-147 honesty:** Personal fail after Shared CAS does not ack; Auth/continuity refuse legacy GET-compare-POST when CAS RPC is missing. Create / email / QR / revoke / signed-in smoke remains recommended before calling October-ready.

Migration 003 was applied to project `tykhocwacaxwquhynkok` on 2026-08-24 with Jonathan's explicit approval. **Migration 002 was applied to Development on 2026-08-25** (SQL editor; signature fix for 12-arg REVOKE/GRANT) and smoked with `pnpm books:smoke:cas` (create / duplicate / stale / advance). Migrations 004 and 005 were applied with Development approval on 2026-08-24. **Migration 007** (D-126 hosted IANA timezone CHECK) was applied 2026-08-25. **Migration 006** (deny-by-default RLS) and **008** were applied 2026-08-25 (path B NOTICE + ceiling 1). The approved cleanup deleted disposable Development households and their cascaded membership/Personal rows; empty Production was removed earlier. No peer device must remain online for a snapshot that has reached the cloud.

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
- **Sync feel target (D-148):** when both kitchens stay open, a partner's confirmed shared post should appear in **100–500 ms** via Supabase Realtime push and atomic hosted SQL (Tier 1 in [`SYNC_ARCHITECTURE.md`](SYNC_ARCHITECTURE.md)). Until Tier 1 ships, visibility-aware REST poll every **4 s** (fallback) applies when Realtime is unavailable.
- D-127 work jobs, confirmed shifts, member-keyed open Timesheet records, breaks, and settlement facts travel inside the same shaped household/personal continuity envelopes. They require no device host and no new hosted table. A competing punch is preserved for worker choice; cloud merge never chooses which device worked the shift or posts money automatically.
- D-161 Household Fund config, monthly plans, append-only events, transaction funding, and settlement/Kitty allocations travel in Shared. `Account.scope: personal`, Bianca's backing savings metadata/binding, bank total, Personal remainder, and unexplained reconciliation difference travel only in her Personal envelope. The shared reconciliation event exposes the Fund slice and whether it ties, never the full savings total. September adds no hosted table. D-162 raw bank rows/tokens remain outside both envelopes.
- Every pulled or merged money state must pass the same command, accounting, environment, and idempotency checks as a local write before it becomes the visible or durable accepted snapshot.

## Development-data window

Through **2026-09-30**, Hearth is operating with disposable development data:

- information entered before October is not important household data and may be replaced while continuity and Auth smoke finish;
- deny-by-default RLS (006) is live: do not describe hosted rows as anonymously open. Incomplete invite smoke, Production hardening, and device revoke still keep this window non-production;
- do not describe this data as private, secure, or production-ready for October household use;
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

Security is a scheduled September milestone. Deny-by-default 006 is applied; finish invite/Create smoke and Production readiness before meaningful October data. Temporary openness language must not be carried forward as if anon REST were still open.

## Acceptance tests

The continuity work is complete only when automated and manual tests prove:

1. Sign into a new device with Google and see the correct personal and household ledgers without the old device online.
2. Write on device A, turn A off, and read/write the accepted result on device B.
3. Work offline on either device, reconnect, and synchronize without duplicate posting or silent loss.
4. A pulled snapshot with changed amounts but the same entry count cannot bypass PGlite/accounting validation.
5. Personal and household ledgers remain distinct data scopes even during the temporary open-development window.
6. Development and Production never cross.
7. After the security cutover, unauthorized and cross-household access is denied.
8. With both devices online on Development, a shared post on device A becomes visible on device B within **500 ms p95** once Tier 1 ([`SYNC_ARCHITECTURE.md`](SYNC_ARCHITECTURE.md)) is complete; until then, poll fallback ≤ 4 s is the measured baseline.
