# Household board photo contract

This service/client is shared by Classic, Taylor and Newfoundland. It has no UI,
financial writer, snapshot serializer, theme preference, crop command, or ledger
schema. Budget delta (5): 0. Engagement delta (3): +2. Risk: Medium-High (private
media and identity-bound retry). The parent owns integrated review and worksession.

## Browser integration

Import `createBoardMediaClient` and its documented TypeScript types from
`src/boardMedia/index.ts`. Construct one client for the current room/auth lifetime:

```ts
const client = createBoardMediaClient({
  scope: { environment, householdId, actorId: memberId, authIdentity: session.userId },
  getSession: async () => {
    // The adapter resolves the current Supabase session, refreshing when possible.
    // Use cached matching auth while offline so local queue/recovery remains usable.
    const current = loadSupabaseSession(environment);
    return current ? {
      accessToken: current.accessToken,
      actorId: currentMemberId,
      authIdentity: current.userId,
    } : null;
  },
  isCurrent: () => capturedRoomAuthGeneration === currentRoomAuthGeneration,
});
```

`authIdentity` is `HearthSupabaseSession.userId` / `ledgerSync.Scope.subject`,
**not** `googleSubject`, email, JWT, or a concatenation with `sessionId`.
The parent must include Auth `sessionId` and room navigation in its generation,
synchronously retire the old client on changes, and call `dispose()` on unmount.
A→B→A navigation needs a new generation even when identifiers become equal again.
Token refresh for the same identity may keep the client. Local pending storage is
keyed by environment, household, actor and Auth user id so the same person can
recover after signing in again; bearer/refresh tokens are never persisted there.

Methods:

| Method | Result / meaning |
| --- | --- |
| `getBoardPhoto(mediaId)` | `Promise<Blob>`; authenticated, bounded JPEG read. UI creates and revokes an object URL. Never store the object URL in the household. |
| `uploadBoardPhoto(file, intent?)` | `Promise<BoardPhotoReference>`; prepare → durably queue → upload. Failures have `BoardMediaError.code` and, after queuing, `pendingId`. |
| `queueBoardPhoto(file, intent?)` | `Promise<PendingBoardPhoto>`; prepare and durably queue without sending bytes. |
| `listPendingBoardPhotos()` | Current scope only, metadata and optional intent; no blobs or credentials exposed. |
| `retryPendingBoardPhoto(pendingId)` | Returns the same immutable media reference; duplicate concurrent calls coalesce. An already uploaded entry awaits metadata acceptance without re-uploading. |
| `discardPendingBoardPhoto(pendingId)` | Durable local removal. Cannot delete accepted media or revive from an in-flight completion. |
| `acknowledgeBoardPhoto(pendingId)` | Remove an uploaded pending entry **only after** the parent observes accepted metadata. Queued entries are not removed. |
| `deleteBoardPhoto(mediaId)` | Explicit authenticated deletion, only when the caller has established no accepted slot needs this id. No automatic former-photo deletion. |
| `dispose()` | Permanently retire this client and abort network requests; retain its scoped pending records. |

`BoardPhotoReference` contains `{mediaId, contentType:'image/jpeg', byteLength,
width, height, pendingId}`. IDs are `BM-<lowercase UUID v4>`.
`pendingId` is local bookkeeping and does not belong in board metadata.
`PendingBoardPhoto` additionally has `scope`, `createdAt`, `status: 'queued' |
'uploaded'`, `attempts`, optional `lastError` (code only) and optional `intent`.

`BoardPhotoIntent` is `{slot:1|2|3, caption:string, crop:{x,y,zoom},
expectedVersion:number}`. Intent is cloned at invocation and saved atomically
with the prepared blob, so editing controls during conversion/upload cannot
retarget it. The media client checks basic shape only; the parent metadata command
owns caption/crop policy and version validation.

An upload is **not** accepted household metadata. Keep the old photo displayed
until the upload succeeds **and** the accepted household slot matches its
`mediaId` in the initiating scope/current intent. `onCommand` is void: observe
accepted props instead of acknowledging when the callback returns. On conflict,
leave the uploaded pending entry available for deliberate recovery. Retry uses
its original slot/version intent, never an automatically advanced version.
No photo bytes, blob/data URLs, original filenames or credentials enter snapshots.

The queue is dedicated IndexedDB `hearth-board-media-v1`, up to 20 prepared photos
per exact scope. There is no volatile-memory or localStorage fallback. Storage
failure prevents upload. The parent triggers retries from an explicit Retry action
or a current-scope online/focus recovery flow; this module installs no global event
listeners. Discard is local: an already accepted or in-flight remote upload can
leave an unreferenced object. Safe orphan cleanup needs accepted-reference knowledge
and is a separate task; this service does not guess or delete someone else's photo.

## Image processing

Source files must match their JPEG/PNG/WebP MIME **and** signature and be nonempty,
no larger than 10 MiB. Unsupported formats (including HEIC/GIF/SVG) receive a clear
conversion error. Browser decoding validates pixels and applies image orientation.
A fresh canvas produces a white-backed JPEG at no more than 1600 pixels on its
longest side and no more than 2 MiB, reducing JPEG quality if needed. EXIF/IPTC/XMP,
ICC and other ancillary segments are removed after re-encoding (Chromium inserts
ICC itself). Original bytes are neither queued nor uploaded.

The worker independently checks MIME, streamed byte bounds, JPEG structure,
dimensions and ancillary metadata. It is not a second pixel decoder. Both request
and response streams are bounded; reads use `private, no-store`, `nosniff` and
same-origin resource policy. UI crop remains metadata only.

## Private worker API and unprovisioned binding

`GET|PUT|DELETE /api/board-media/:environment/:householdId/:mediaId`

All methods require `Authorization: Bearer ...`, `X-Board-Actor` (member id), and
`X-Board-Identity` (Auth user id). Every request calls existing
`workers/ledgerSyncAuth.authorizeRequest`, then compares the expected actor/subject.
Active household members may read/upload/delete shared photos. There are no public
URLs, anonymous reads, listing endpoints, signed URLs, CORS grants or bucket fallbacks.
Production is refused even if a bucket is supplied.

PUT accepts only processed JPEG bytes, returns 201 or an idempotent 200 with
metadata, and uses R2 conditional create plus SHA-256 comparison. A different
payload for an existing id returns 409. DELETE erases bytes with a zero-byte
tombstone that permanently reserves the id, preventing delayed retry resurrection.
Keys are `v1/development/<householdId>/<mediaId>` in **BOARD_MEDIA only**.
No ledger data is stored in this bucket; Evidence and ledger archive bindings are
never used for photos.

The optional typed binding is deliberately **not** added to live `wrangler.jsonc`:
no dedicated bucket is provisioned or enabled by this patch. Missing binding
returns actionable 503 `BOARD_MEDIA_UNAVAILABLE`. After separately authorized
provisioning, the operator must bind a dedicated private Development R2 bucket as
`BOARD_MEDIA`, with public access disabled. Do not reuse evidence/archive buckets.
The R2 test declares this binding only inside fully local Miniflare. No provisioning,
deploy, hosted write, secret or schema operation is part of this patch.

R2 conditional create semantics follow the [Cloudflare Workers R2 API reference](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/).

## Focused local proof

Run directly with the supplied Node runtime on PATH (linked dependencies must not
trigger pnpm installation):

```sh
node node_modules/vitest/vitest.mjs run test/board-media-worker.test.ts test/board-media-browser.test.ts test/board-media-r2.test.ts --maxWorkers=1
```

Tests use synthetic pixels, actual Chromium canvas/IndexedDB and fully local
workerd/R2; no household or hosted data. They cover credentials/live membership,
actor/subject mismatch, household and Production separation, missing binding,
MIME/signature/size/dimension/metadata rejection, idempotent immutable uploads and
delete tombstones; browser reload/offline recovery, all four local scope fields,
atomic slot intent, acceptance acknowledgement, concurrent retries, durable discard,
and retired room/auth outcomes. The parent owns integrated TypeScript/High quick
gate, UI/theme verification, and any later physical-browser or hosted acceptance.
