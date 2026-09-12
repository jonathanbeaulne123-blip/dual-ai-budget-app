# Hearthside Vault — P3 private-content foundation

Implementation base: `429db8ef0447dac6347e89e945dd04aad05e84fb`. Risk: High. This package is local, synthetic implementation evidence. It does not activate a service, apply a hosted schema, send a notification, publish a guest visit, or establish Production readiness.

Budget delta (5): intimate content and media cannot enter household financial snapshots or gain money-command authority. Engagement delta (3): private drafts, reviewed letters, voice/photo attachments and time capsules can survive interrupted uploads and publication without accidental disclosure.

## Files and authority

- `vaultContracts.ts`: closed, bounded v1 inputs and private content types. Media references contain immutable SHA-256, length and content type; no public URL, bearer capability or byte payload.
- `vaultClient.ts`: generation-scoped authenticated requests and durable IndexedDB upload queue. Dispose the instance on **every** environment, household, member, Auth subject or navigation-generation switch, including A → B → A. A failed queue write refuses network upload. Queue records hold bytes and exact identity scope, never Auth tokens.
- `workers/hearthsideVaultStore.ts`: transactional authority with owner-by-member-and-subject checks, private-draft CAS, content tombstones, immutable publication copies, exact-digest approvals, server-time capsule release and irrevocable publication withdrawal.
- `workers/hearthsideVault.ts`: separate SQLite Durable Object and fresh HTTP authentication, private conditional R2 writes and bounded streaming reads. The service does not import a financial writer.
- `workers/hearthsideVaultArchive.ts`: atomic SQL outbox, checksummed private R2 journal and trusted latest-only empty-DO recovery. See the [recovery protocol](../../workers/hearthsideVaultArchive.README.md).

The household DO key is `development/<householdId>`, but being a household member does **not** grant read access. Draft/media ownership and letter audiences each require both the exact member id and authenticated subject. No owner/admin role bypass exists. Review responses and disclosed copies omit private draft lineage and Auth subjects. Snapshot responses contain only the caller's drafts and entitled publication receipts.

## Integration API

Call `handleHearthsideVault` before the asset fallback. Route: `/api/hearthside-vault/:environment/:householdId`, with `Authorization`, `X-Vault-Actor` and `X-Vault-Identity` matching the freshly authorized scope. The identity header uses `Scope.subject` from `ledger_sync_scope`, not a display name or guessed Google field. Query parameters are refused. GET returns private drafts and entitled publication receipts. POST uses JSON:

| Operation | Fields beyond `operation` | Behavior |
| --- | --- | --- |
| `save-draft` | `input: {id, expectedRevision, content: {title, text, mediaIds}}` | Private, revision checked; identical uncertain retry retains its revision. |
| `delete-draft` | `input: {id, expectedRevision}` | Erases source content behind a durable tombstone. Reviewed publication copies persist until separately withdrawn. |
| `read-draft` | `id` | Owner only. |
| `prepare-media` | `input: {id, sha256, byteLength, contentType}` | Allocates an immutable, owner-scoped upload identity. |
| `prepare-publication` | `input: {id, draftId, draftRevision, kind, recipientMemberIds, releaseAt}` | Captures an immutable copy after trusted policy resolution. |
| `review-publication` | `id` | Approvers see the exact content, audience member ids, release time and digest. |
| `approve` | `id, digest` | Only an authenticated required approver can acknowledge that digest. |
| `activate` | `id` | Revalidates audience, accepts the exact canonical reference, then enables reads. |
| `read-publication` | `id` | Approved audience only, after activation and server release time. |
| `withdraw` | `id` | Any required approver can revoke immediately, including while publication is disabled. |
| `cleanup-media` | `id` | Explicit action; refuses private/live references and requires the authority reference check. |

Media uses authenticated PUT/GET at the same route plus `/media/:id`. PUT validates bounded bytes, declared digest, length, signature and type. A recipient supplies `X-Vault-Publication` on GET; knowing a media id grants no access. Media responses have private/no-store, nosniff, same-origin and sandbox headers. Bytes can be JPEG, PNG, WebM, MP4 or Ogg, at most 16 MiB each. These signature checks reject mislabeled executable markup; they do not replace browser decoding, image preparation, metadata stripping or playback validation in the P6 composer.

## Trusted publication adapter

`HEARTHSIDE_VAULT_AUTHORITY` is a **server-only capability**, never a client-controlled JSON object. The constructor now assembles the [trusted audience adapter](../../workers/hearthsideVaultAudience.README.md) from explicitly configured bindings; tests may inject it. Its integration contracts are:

1. `policy(scope, input)`: use the current canonical roster and consent rules to resolve exact recipient principals and required approvers. Letter/capsule/answer material requires its author. Shared memories and guest compositions require the canonical couple; the Vault additionally refuses fewer than two approvers. Reject ineligible or revoked recipients. Guest visitors require the separate invitation authority; they must not become household members or gain this API's household access.
2. `accept(scope, reference)`: atomically accept one typed, non-financial LedgerRoom publication reference, idempotently keyed by the publication id and digest. Return the same durable `VaultAcceptance` receipt on uncertain retries. No private text, media list, recipients or private capabilities travel in that reference. This callback is reachable only after the Vault has stored all exact approvals and revalidated current audience identity.
3. `isReferenced(scope, mediaId)`: fail closed using authoritative publication references during explicit cleanup. The integration must fence acceptance of new external references against cleanup. Local references are rechecked after this callback and a media tombstone is persisted before deleting bytes. Failed deletion is retryable and cannot restore read access.

Prepare → approve → accept → activate is recoverable across separate stores. If acceptance succeeds but its response is lost, readers stay denied until retry resolves that same receipt. If withdrawal races acceptance, withdrawal wins and the late acceptance cannot reactivate the copy. Existing publication identity and immutable composition are never overwritten by an edited draft. New material creates a new publication identity and fresh approvals. Root integration must handle replacement/withdrawal of previous shared arrangements explicitly.

## Runtime preparation and remaining gates

The following bindings are intentionally absent from committed deployment configuration: `HEARTHSIDE_VAULTS` (SQLite class `HearthsideVault` in a new namespace), `HEARTHSIDE_VAULT_MEDIA` (dedicated private R2), optional `HEARTHSIDE_VAULT_ARCHIVE` (otherwise the media bucket stores the private archive), and the authority adapter's dedicated key/id. Flags `HEARTHSIDE_VAULT_ENABLED` and `HEARTHSIDE_VAULT_PUBLICATION` must be explicitly `true`; Production is refused even then. Before release, generate environment types against reviewed bindings and include these files in the Worker build/typecheck. Do not copy household-photo read ACLs into the Vault.

This foundation does not close P3 on its own. The Letters package now supplies the composer, three theme treatments, normalization/playback and local accessibility/browser proof; the recovery package supplies private backup and explicit recovery preserving withdrawal tombstones. Still required in the integrated program: actual room wiring, canonical LedgerRoom receipt integration, authenticated live roster and hosted recovery proof, member lifecycle/device revocation proof, guest-copy service, paired private-answer reveal coordination, physical-device IndexedDB and interrupted upload checks. Sealing controls access to the published capsule; it cannot erase an author's already-known source content or a recipient's prior downloaded copy. No read-receipt or reciprocity tracking is introduced.

## Local evidence

The contract, client, service-race and local-runtime suites cover owner/recipient isolation, identity reassignment, stale revisions, immutable media, exact-version mutual approval, server-time sealing, audience changes, uncertain acceptance, revoke-during-acceptance, source deletion, cleanup references, durable upload recovery and scope-switch cancellation. `hearthside-vault-runtime.test.ts` exercises actual Miniflare SQLite DO RPC and R2 through the HTTP route. Its policy/acceptance adapter is explicitly synthetic, not live LedgerRoom proof.

The local workerd binary supports compatibility dates through `2026-08-27`; the runtime test names that ceiling. The implementation uses the repository's installed Workers types `5.20260906.1`. Service semantics were checked against the official [Durable Objects SQLite documentation](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/) and [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/).

Run all `test/hearthside-vault*.test.ts` and `test/hearthside-letters*.test.ts` files in the High quick gate. This package leaves shared verification focus-map edits to the integration owner. The constrained checkout uses the existing dependency tree and `pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never ...`; plain pnpm hit the noninteractive dependency-purge guard and stopped before testing. No shared dependency tree was changed.

Recorded validation: High quick gate passed in **88.112 seconds**, with no five-minute breach. TypeScript, diff-check and AI-surface checks passed; **52 tests across seven files passed**, including all 26 Vault tests plus selected continuity, environment-isolation and Hercules-context regressions. Evidence fingerprint for the tested implementation was `ae13821e7fa3895a8d935b1e55a6998dde080692d52306e537794d20a7dca2a7`. This final evidence paragraph was added afterward; executable files were unchanged.
