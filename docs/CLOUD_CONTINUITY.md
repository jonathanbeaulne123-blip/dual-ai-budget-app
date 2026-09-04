# Google-account cloud continuity

> **Accepted product direction — 2026-08-24.** This file supersedes language that describes hosted sync as optional publishing, a three-word phrase as the normal access model, or one phone as the durable home of the ledger.

## Implementation status — D-114 continuity, D-117 scopes, D-122 CAS, D-123 repair, D-149 T1 atomic push, D-176 Development-verified access controls, D-180 pilot, D-186 automatic reconciliation

The working continuity slices are implemented. Migrations **002, 003, 004, 005, 006, 007, 008, 010, 012, 013, 014, 015, 016, and 017** are recorded applied in the shared Supabase project; Development command-log and Realtime proof specifically depend on **013** and **014**. Migration **012** (`publish_continuity_snapshot`) is **applied on Development** (2026-08-26) for Auth-signed-in continuity. Migration **014** (Realtime publication) is **applied on Development** (2026-08-26). The D-180 Development pilot and D-182 Google-first chooser/invitation repair are deployed; the complete live two-device matrix and fourteen-day rehearsal remain open. D-182 added no schema or hosted API. See [`SYNC_PILOT.md`](SYNC_PILOT.md).

**SF-02 / D-176 boundary:** migration **017 is applied to disposable Development**. Its release packet adds co-owner invites, a session-id-backed Auth device registry, sanitized access inventory, device/member revocation, safe leave/last-owner rules, and metadata-only identity audit. Existing snapshot `household.devices` remains non-authoritative soft presence. Cloud membership checks require a live Supabase `auth.sessions` row and, once registered, a non-revoked matching session. A transactional hosted smoke with two distinct Google principals passed the invite, isolation, revoke, leave, last-owner, audit, and fail-closed matrix and rolled back all synthetic state. The server can deny a revoked device immediately; it cannot erase an offline browser's cached replica. Rendered two-browser client and assistive-technology evidence remain open until live-origin verification.

- **Continue with Google** is available even when a fresh device has no local household;
- Development discovers memberships through Auth JWT / continuity membership rows (legacy open snapshot scan remains only when membership tables are missing);
- pulled/reconciled snapshots pass the same PGlite/accounting acceptance boundary before display or persistence;
- signed-in accepted writes enter a durable per-device outbox before transport; D-177 returns local Confirm after balanced PGlite acceptance, durable device persistence, and an awaited slim outbox write, while Auth refresh/CAS continues in the background with truthful Sharing/Synced/conflict state. Automatic flush makes zero request unless refreshed Auth matches the queued Google identity. Later offline writes compact into the latest snapshot while keeping the earliest expected hosted revision and all confirmation ids; generation-checked acknowledgement prevents an older in-flight request from erasing a newer tip. The **first** hosted write (`expectedRevision === 0`) still calls `hearth_create_household` so the creator is `role='owner'`; command-log append starts only after that membership exists. If create returns `household-already-exists`, the next CAS uses the hosted snapshot revision — it does not treat expected 0 as “another phone” (**live** Worker `cc694eee-3462-4fff-8f71-8675e8ad2ecf`, merge `48b1716` / #210);
- **D-145:** the durable outbox (IndexedDB-first, slim `localStorage` metadata) stores tip revision + identity only — never the full journal. Flush resolves the newest eligible live household (memory, Retry tip, or `loadHousehold`) and refuses tips older than `tipRevision`. Shared `household_snapshots.payload` stays plain JSON for live CAS/create SQL guards; personal envelopes may use an optional gzip envelope (`hearthPayload: 1`); legacy plain JSON remains readable forever;
- launch, focus, and reconnect retry the outbox (with exponential `nextAttemptAt` backoff) and then pull newer matching snapshots;
- successful hosted CAS (including idempotent duplicate delivery) **acknowledges** by removing the outbox item; failed/stale writes never erase locally accepted books;
- command events are the normal accepted-command path after household creation. Snapshots are reserved for first creation, initial catch-up, revision-gap recovery, and integrity repair. On the receiver, command acceptance and snapshot recovery share one coordinator: snapshot signals coalesce for 300 ms so their matching command row can cross PGlite first. If that websocket notification is delayed, the receiver reads the command rows already committed by the atomic publish before permitting a full snapshot replay; only a locally accepted command at the signaled hosted revision suppresses recovery. Missing, unknown, hidden, invalid, conflicted, and revision-gap paths still pull/reconcile/accept the snapshot. Disjoint ids remain additive; duplicate/out-of-order delivery is exactly-once; the later canonical same-id event wins automatically. Snapshot recovery uses record-level recency rather than replacing a whole replica. Reversals remain immutable and corrections remain reversal plus replacement;
- stale hosted revisions stop automatic replay, keep the queued local snapshot, retain the remote snapshot, and surface a conflict instead of overwriting either side;
- The D-180 pilot workflow bakes Google Auth, Development Realtime, and command log on while baking `VITE_PRODUCTION_CONTINUITY=0`; Production discovery, transport, Realtime, and pilot diagnostics are refused. Discovery never bulk-scans snapshots, membership INSERT is refused from the client, and shared pushes use Personal projection.
- **D-182 entry repair (Development-deployed at `244bc67c`):** normal Google sign-in is chooser-first even for one membership. Authorized household cards use the accepted snapshot's `lastCommittedAt`; Auth invitations survive redirect, redeem safely, refresh discovery, and highlight the joined household before an explicit Open. Three-word/Pass entry remains Advanced recovery. Device-local header time does not change Toronto posting dates. Live two-account acceptance remains canary evidence, not a deployment claim.
- each environment now keeps a catalog of household replicas keyed by household id; opening one ledger no longer overwrites another, and the header switcher changes the active replica explicitly;
- the active session remembers its household id, legacy `hearth:v1:<environment>` snapshots migrate automatically, and reset removes only the selected ledger;
- every signed-in member gets a durable member-only personal replica keyed by environment, household, and member. Shared cloud projection excludes Personal transactions, shifts, and private goals; only that member's Personal envelope overlays them on read.
- Migration 003 is applied. D-117 explicit Google membership rows and member-personal snapshots are live in Development: discovery filters by Google subject on the server, fetches only matching households, and overlays that member's hosted Personal scope.
- **D-149 T1-S1 / T1-S2 (Auth session):** `pushSupabaseHousehold` calls **`rpc/publish_continuity_snapshot`** — one SQL transaction CAS-advances Shared `household_snapshots` and upserts the member Personal envelope. The “Shared succeeded, Personal failed” split window is gone on Auth continuity paths. Missing Migration 012 → fail closed (no two-trip fallback). See [`SYNC_ARCHITECTURE.md`](SYNC_ARCHITECTURE.md).
- **D-149 T1-S3 / D-192 (Realtime push and repair):** `VITE_CONTINUITY_REALTIME=1` is baked into the live kitchen build (`.github/workflows/pages.yml`, merged #175). When subscribed, `continuityLivePull` demotes the 4 s REST poll to fallback. On supported browsers the client uses worker-backed heartbeat scheduling; heartbeat error/timeout and terminal channel status trigger one bounded authenticated, membership-checked channel recreation. Focus, visibility, and online accelerate an unhealthy connection without scheduling a competing full resume first. Resubscription checks committed command rows through the same coordinator/PGlite acceptance lane before ordinary snapshot recovery. Migration **014** added `household_snapshots` and `continuity_personal_snapshots` to the `supabase_realtime` publication on Development (2026-08-26); command events are also published. Two-phone Realtime smoke passed 2026-08-27; the D-192 repair still requires a fresh deployed 100-sample run.
- **T3-S4 scale envelope:** member-scaled poll bands (4 s / 5 s / 8 s) and the anti-claim that 100 open kitchens are not Production-ready on poll alone live in [`SYNC_ARCHITECTURE.md`](SYNC_ARCHITECTURE.md) § Scale envelope. D-121 Hercules chat limits are unchanged.
- **D-122 / D-147 client (Auth-off bridge):** when no Auth session is present, `rpc/publish_household_snapshot` then a separate Personal POST remains the Advanced-recovery two-trip path; D-147 treats Personal fail after Shared CAS as pending (never ack). The pure CAS contract lives in `src/ledger/snapshotCas.ts`. When PostgREST reports the RPC missing (`PGRST202`), Auth/continuity paths **refuse** the legacy GET-then-compare-then-POST race. That legacy path remains only for explicit Auth-off `legacyLinkedPublish` recovery without continuity/Auth.
- **D-123 Auth/RLS:** Google Auth is live. Feature-flagged Supabase Auth stores/refreshes the session and sends its user JWT through discovery, replay, and commits. Additive prepare 004, CAS hardening 005, SELECT bridge 008, and deny-by-default cutover **006 are applied**. Anon household REST is revoked. Migration **010** bind-on-discover is live (2026-08-26 anon EXECUTE denial proof). **D-143 / D-147:** automatic client transport requires a resolved continuity membership identity and an explicit `transportRequested` path; `linked` alone no longer publishes; Auth-off **Publish** is Advanced recovery only. **D-146:** automatic discovery/pull/persist/outbox assert Google subject/member when a continuity identity is present; PGlite audit hashes use the same `financialAuditHash` as accept/CAS. **D-147 honesty:** Personal fail after Shared CAS does not ack; Auth/continuity refuse legacy GET-compare-POST when CAS RPC is missing. QR two-device smoke passed; email/revoke and the complete signed-in/negative lifecycle smoke remain open before October-ready claims.

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
- **D-208 Development launch policy:** cached books remain readable offline, but shared writes require connectivity and Google Auth resolving to the exact locally selected member. An isolated, reusable PGlite staging replica applies the real Postgres schema and double-entry checks before transport; the authenticated atomic cloud acknowledgement is the shared commit/Saved boundary, and only then does the active PGlite replica advance. Startup, ordinary catch-up, ambiguous acknowledgement, and manual restore all read Shared, then the signed-in member's revisioned Personal envelope, then Shared again. Hearth adopts both scopes together and reopens writes only for that exact environment/household/member/revision tuple; a missing or moving Personal generation leaves durable replay markers intact and writes blocked. A blocked arbitrary projection mismatch validates that same assembled pair in isolation before replacing the disposable active projection. Pending outbox work or unresolved conflicts refuse that restore. Clear-this-phone and Development reset await staged-replica erasure.
- **Sync feel target (D-149):** on Development, the recorded two-phone smoke passed at **≤500 ms p95** via Supabase Realtime push and atomic hosted SQL (Tier 1 in [`SYNC_ARCHITECTURE.md`](SYNC_ARCHITECTURE.md)). Visibility-aware REST poll remains a **4 s fallback** when Realtime is unavailable. Production Realtime remains refused.
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
3. Keep accepted books readable offline on either device, refuse shared mutation, then reconnect and synchronize a retried Confirm without duplicate posting or silent loss.
4. A pulled snapshot with changed amounts but the same entry count cannot bypass PGlite/accounting validation.
5. Personal and household ledgers remain distinct data scopes even during the temporary open-development window.
6. Development and Production never cross.
7. After the security cutover, unauthorized and cross-household access is denied.
8. With both devices online on Development, a shared post on device A becomes visible on device B within **500 ms p95** through Tier 1 ([`SYNC_ARCHITECTURE.md`](SYNC_ARCHITECTURE.md)); recorded two-phone smoke passed 2026-08-27. Poll fallback remains ≤ 4 s when Realtime is unavailable.
9. Migration 017 session/device authority denies a revoked device immediately at the cloud boundary, while the client truthfully warns that cached offline data cannot be remotely erased.
10. A browser restart, expired-session refresh, additive second-device join, failed pull, and old-device-off recovery preserve the last accepted local books and converge without duplicate posting.
11. At least 100 live Shared command-event samples meet **≤500 ms p95**, and an honest Realtime failure falls back to polling and recovers without a duplicate.
12. Jonathan and Bianca complete the fourteen-day disposable Development rehearsal in [`SYNC_PILOT.md`](SYNC_PILOT.md) with no open P0/P1 sync, privacy, accounting, or recovery finding.

Items 9–12 are D-180 pilot exit gates and remain pending. The historical 2026-08-27 smoke does not by itself earn the daily-use claim.

## SF-01 reconciliation note — 2026-08-30

The machine and human baselines are [`shared-money-baseline.json`](shared-money-baseline.json) and [`SHARED_MONEY_BASELINE.md`](SHARED_MONEY_BASELINE.md). This correction distinguishes a baked Production REST flag from runtime or Release proof, records Development Realtime/command-log evidence as complete, and keeps Production Realtime and lifecycle smoke explicitly open. No runtime behavior, schema, secret, or hosted row changed.

## D-180 pilot note — 2026-08-31

The local pilot packet makes command events the proven normal path, adds a bounded privacy-safe Development diagnostic, and changes the proposed kitchen workflow to bake Production continuity off. D-186 supersedes its conflict chooser: true same-id divergence now reconciles automatically in canonical order, while reversal immutability and all existing acceptance gates remain. Fresh read-only inventory found migrations 001–017 and the three intended continuity Realtime tables; no schema or hosted row changed. Jonathan authorized the current-main Development release; live two-device proof and the fourteen-day rehearsal remain open.
