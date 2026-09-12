# Reviewed shared-life restoration

Status: local implementation and integration candidate. No hosted mutation, migration, new flag, provider call or activation. This is an explicit user restore workflow, separate from financial restore and operator archive repair.

Budget delta (5): the existing LedgerRoom command writer remains the only writer; shared-life restoration cannot alter anything outside `household.hearthside`. Money, Tasks, Calendar records, Chapter/Ritual operations and existing plan links remain current.

Engagement delta (3): both members can review exact earlier words, saved design references and authored furniture arrangements, then bring selected fields into today's home as new revisions. Three authored review treatments support phone and desktop, keyboard navigation and reduced motion.

Risk: High. Base checkout `2e8fe69bff235edd45541d15796785408dd4b7f9` plus exact current root program dependencies copied read-only. Only the new restore modules, tests, this document and integration patch belong to this change. Dependency overlays are deliberately excluded from the commit.

## Product and operation boundary

| Selection | Restored as a new revision | Preserved from today |
| --- | --- | --- |
| Existing active intention | title, intention, horizon | state, author, identity, references and operational/funding links |
| Existing nonarchived note, same active author | words, room | author, identity and intention link |
| Existing occasion | name, annual month/day and leap-day choice | every prepared occurrence and current link |
| Existing same-object/room placement | x/y | object identity, room and current available source |
| Canonical furniture | x/y for the selected stable room/piece identity | other furniture and all room history |
| Existing, nonwithdrawn words/design-only memory | title, date, recollections, exact shared design references, hide-amount choice | identity, intention link and immutable legacy Win provenance; approvals are cleared for a fresh Keep from each member |

Missing identities are not recreated; later-created identities survive. Archived/withdrawn source or current content remains unavailable. No saved design document, stroke journal or historical room frame is overwritten. The design authority must confirm the exact historical snapshot exists in a currently shared document and that its piece is not archived. Source index membership alone is insufficient.

A memory with media or a publication binding in either version is an explicit blocked selection. Its review offers the normal memory editor and explains the fresh publication/Keep step. No old media capability, publication binding or hidden earlier caption is returned for that selection. A blocked selection prevents the entire requested apply; it is never silently dropped.

Every current memory/note/experience withdrawal, guest/publication/artifact record, room history withdrawal, Studio handoff and Encounter guard participates in the affected-current digest. This feature never calls Vault/Guest/Workspace grant restoration. Existing terminal withdrawals remain current even when their earlier source point predates withdrawal.

## Authority and integration

Apply `shared-life-restore.integration.patch` to the matching current root files after cherry-picking this commit. `shared-life-restore.integration-base.json` records exact pre-patch blobs and resulting blobs. Root files are not committed by this subtask. Review/adapt hunks if root has moved; do not overwrite whole files.

The optional `hearthside.restoreReviews` collection stores compact reviewed identities/digests, the current pair, approvals and a final receipt summary. It contains no copied historical text or browser-provided snapshot. Four strict operations (`propose`, `approve`, `cancel`, `apply`) use `commitSharedLifeRestore`, a capture-only client command. The generic registry executor deliberately refuses to execute it. `prepareCommand` invokes the dedicated authority helper with the existing checksum-verified R2 restore-point loader and synchronous canonical design access, then uses the ordinary serialized event/receipt/archive writer. All non-Hearthside fields must compare equal before acceptance.

Review identity binds:

- An existing retained restore point in the same environment and household, with the same historical/current active member pair.
- SHA-256 of the exact server source snapshot; clients send only its digest and point ID.
- Exact selected current content, dependencies, withdrawal guard and resulting material changes.
- The current pair and **LedgerRoom's stored ACL floor**, not `Scope.aclEpoch`'s per-request authorization timestamp.

Live Auth, current pair and canonical ACL checks bracket asynchronous source reads. A changed point, selected content, shared access or member pair requires a new review. Both members approve the exact same digest; neither the browser nor an operator may supply the partner's approval. Exact command retries use the existing receipt mechanism and cannot apply twice. The normal retained point expiry still applies; expired points cannot be imported from a browser.

New seams:

- `readSharedLifeRestorePreview(input, ports)`: read-only checked projection.
- `applySharedLifeRestoreIntent(h, intent, ports)`: server authority transition; `ports.point`, `ports.assertCurrent`, `ports.designAccess`, and canonical `ports.audienceEpoch` are trusted callbacks.
- `LedgerRoom.sharedLifeRestorePreview(scope,input)` and `POST /ledger-sync/v2/:env/:household/shared-life-restore`: authenticated, strict 32 KiB request limit and current roster reconciliation.
- `LedgerSyncClient.sharedLifeRestorePoints/Preview`: scope-checked, abort-aware reads; no alternate writer.
- `SharedLifeRestore`: current household/member/identity/theme/connection, source getter, ordinary KitchenCommand, normal-memory-editor callback and optional exact design renderer. Root integration supplies `SavedPiecePreview` and exposes `/hearthside/rooms/<room>?household=<id>&room=<room>&mode=present&surface=restore` from the room's restore action. Existing Bank, Encounter, wardrobe, guest and Workspace surfaces are preserved.

Limits: at most 100 selected records per review, 200 retained compact reviews, a 2 MiB preview, existing 4 MiB shared metadata/event/snapshot limits and normal retained restore-point policy. Capacity failures fail closed; no automatic deletion of recorded review identities. No new dependency or migration is needed.

## Verification and acceptance boundary

The owned unit suite covers exact field selection, operational truth, current/source/audience invalidation, request reauthentication, source-scope denial, media and archived design exclusion, immutable Win provenance, strict unknown/accessor input and withdrawn publication preservation.

The actual Miniflare Worker suite exercises LedgerRoom, SQLite, R2 and WebSocket authority (only identity is synthetic): paired approval/apply, original ACK replay, forged actor and outsider denial, changed current/source bytes, actual ACL revocation, replacement-member source denial, terminal Workspace/memory/note/room withdrawals, later identities, unchanged money, exact canonical design snapshot and post-review design archival denial.

The browser suite runs the actual React review against that Worker via a local test bridge. It covers an uncertain accepted reply, reload and household return with the same receipt, both actors, offline withholding, apply and cancel. The bridge does not substitute a mock restore transition. Authentication, parent App receipt transport and physical devices remain root's integration acceptance.

Theme/layout matrix: Classic, Taylor, Newfoundland × 320/390/719/720/1100/1440/1920 px; visible controls at least 44 px, no horizontal overflow, native keyboard selection/focus, 200% text, reduced motion and axe AA. Representative captures are local synthetic evidence under `/tmp/hearthside-shared-life-restore-proof/`; do not commit real household data.

Final measured gate and artifact hashes are recorded below after the scoped gate. This evidence is not full-suite, deployment, Production or activation approval.

## Final local evidence (2026-09-12)

- Owned source/authority/browser suite: **12 tests, 3 files passed**, 10.75 seconds, then included in the final High run.
- Scoped High: **584 tests across 58 files passed**, 95.449 seconds; app TypeScript passed in 27.283 seconds; **no 300-second time-budget breach**. Includes actual App startup and command/permission/rehearsal regressions selected by the repository gate. This is still a focused gate, not the exhaustive full suite.
- An earlier High attempt failed on four copied stale root fixtures in Home/Planner/legacy Win consent, with no time-budget breach. Those tests were refreshed from the root integrator's current intended behavior, then the entire scoped gate passed. No owned assertion was weakened to hide that failure.
- Final High change fingerprint: `14232e90f700b65e318bc6fd01880cf39cdd749d2eb570eee894d353035fc71b`; base/head before commit: `2e8fe69bff235edd45541d15796785408dd4b7f9`; dirty state reflects read-only root dependency overlays plus these owned additions. Evidence prose was appended after verification; the executable source below stayed frozen.
- Root integration patch passed `git apply --check` against the then-current `hearthside-program` checkout. No patch was applied there by this agent.
- Browser captures: `/tmp/hearthside-shared-life-restore-proof/{classic,taylor,newfoundland}-{390,1440}.png`. All 21 theme/width combinations passed overflow and minimum control size checks, all three themes passed scoped axe WCAG AA, and keyboard, 200% text, reduced motion, offline, scope return, lost ACK, both approvals and cancellation passed.
- Build: app + Workspace TypeScript and Vite build passed. Existing large-chunk warnings remain; this is not a runtime-performance or physical-device claim.

Frozen executable SHA-256 hashes:

| File | SHA-256 |
| --- | --- |
| `src/hearthside/sharedLifeRestore.ts` | `477388a43ca5c2a488b4f9cff121eaefb43f6cabd0eb88eb4addcc9e48ed8a22` |
| `src/hearthside/sharedLifeRestoreContracts.ts` | `1f7ada08455a8fee52b7dd2fff2d73444aa05def0fd8661cd8dabdb8d38d10ef` |
| `src/hearthside/SharedLifeRestore.tsx` | `1fbab0f53c391ac5c2f2a55fb82aef6e41cc9834adf1f3b40aa1cc7a17581d5f` |
| `src/hearthside/useSharedLifeRestore.ts` | `bea20f9f2d2d8c4891e8239a2532f99dc099277370425ecc81c36ca4f2586b6b` |
| `src/hearthside/sharedLifeRestore.css` | `c05bf8a00447359e97275e44e2936f371b1bab0731d752378d2692abe966c3ef` |
| `test/hearthside-shared-life-restore.test.ts` | `19dafc3b72d03e84df008d790a3ea31480a56539cfc8fb99617b2f6b5130d8d6` |
| `test/hearthside-shared-life-restore-runtime.test.ts` | `afc69765bfc3dee0702b34b56c97399ed163f897021220978638155e597560d4` |
| `test/hearthside-shared-life-restore-browser.test.ts` | `c54154a5229d431b2174de50e21ed15f73ef11345aadc9f6bdb569cb69447bc8` |
| `test/fixtures/hearthsideSharedLifeRestoreRuntime.ts` | `bdf2ea76723c401b035ffd4d356e2eabdb53c7efa9d60d36e165c4c52311abf5` |
| `test/fixtures/hearthsideSharedLifeRestoreProof.tsx` | `320b84ac7fa13a2a74a12673330ffe7fc86a319566823b5d365cd575b0fd9204` |
