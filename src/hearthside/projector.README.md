# Theatre Projector

`TheatreProjector` is a scoped view over exact, mutually kept `MemoryComposition` values. It persists only the ordered memory ids/revisions and display options in a device-local draft partitioned by environment, household, member and audience. Playback and export remain temporary. It does not persist captions, publish media, load private Vault objects, mutate designs, or dispatch ledger commands.

## Host integration

Lazy-load `TheatreProjector.tsx` at the Theatre action. Its stylesheet is scoped to `.htp`; no App, package or global configuration changes are required.

Required props:

- `memories`, `activeMemberIds`, `theme`: canonical current records and active roster. The component decodes records, excludes duplicate IDs and withdrawn/unapproved versions, and freezes the selected exact compositions. At least two distinct active members must have approved the current revision.
- `scopeKey`: environment + household + member + authorization epoch. Change it whenever any of those changes. `publicationEpoch` additionally invalidates prepared media and exports when publication or canonical shared-state authority advances. Both must come from the host's current authority, not a cached UI filter.
- `resolveMedia(reference, { memoryId, memoryRevision, scopeKey, signal })`: authorize the exact approved composition and reviewed publication, then return an immutable Blob with the identical normalized media reference and `{ id, revision, manifestDigest }` publication receipt. Never return recipient-only letters, capsules or private media. Denied, missing or withdrawn sources return a bounded status, never a private URL/error string. Reference mismatches are unavailable.
- `loadDesignSnapshot(reference, scope)`: authorize and load the exact `documentId`/`pieceId`/`revision`, then rasterize that immutable authored design to an image Blob. Return `rendering: 'authored-flat' | 'authored-sculpture'`. Use the host's `snapshotKittyDesignRevision`/MemoryArtwork approach; no current-balance fill, squash, substitute revision or presentation pose. Any revision may be referenced; do not invent a firing receipt on an arbitrary snapshot.
- **`validateDownload(proof, { scopeKey, signal })`**: on every Download click, perform fresh authoritative access validation. Return true only if each selected memory still has the exact revision, current mutual approval and canonical JSON SHA-256; every retained available asset still belongs to that composition and exact reviewed publication/design revision. Check the current membership/environment scope. Reject withdrawal, any changed composition/digest/reference/publication, missing permission, stale scope, offline or failed validation. A cached allow result is insufficient. The proof contains normalized exact-composition hashes and the prepared asset references, byte hashes, publication receipts and statuses, never asset Blobs. A caption-only export still requires this check. This is the host authorization boundary; the view cannot determine server access independently.
- `onClose`: close the host's projector surface. The component cancels current work and disposes its media on close.

Optional `authorLabels` supplies current visible names; `onReviewMemory(id, exactRevision)` returns to the canonical composition review. There is no inline editing or re-authoring of either person's recollection. Optional `amountSnapshots` must be caller-provided immutable historical amounts with provenance, CAD integer cents and a valid as-of date. They remain hidden by default, require an explicit checkbox, and are always omitted when the kept composition has `hideAmounts`. Never supply current balances as historical snapshots.

The ready file has a button, not an exposed Blob URL anchor. A fresh validation must succeed before the temporary download anchor is created. Access changes without a prop update therefore still deny download. A failed validation removes the ready file; it must be prepared again. Already downloaded files are ordinary local copies and cannot be revoked remotely.

## Output and playback

The three authored theatre treatments use a working illustrated projector, curtains or paper framing and a readable paired-caption area. Selected compositions can be reordered without changing their records. Each author retains a separate column; longer captions continue across pages without ellipsis. Every selected saved image, exact design raster and voice note gets a page. Missing/withdrawn media is explicitly represented. The complete DOM captions remain readable at phone sizes; the canvas has a keyboard-accessible playback target.

Film uses an origin-clean 1280×720 canvas at 24 fps and a browser-supported MediaRecorder MIME, including its final emitted MIME. Audio is decoded and mixed into the stream before recording starts. A voice note waits for the audio source's actual end, followed by a bounded encoder drain; wall time alone never cuts it off. All recorder chunks must complete into one playable container. It is a still-image story with original voice notes, not generated personal footage. The rendered source order, captions and design references are frozen before recording.

`Create story file` produces a real, self-contained HTML document with embedded image/audio bytes, escaped original captions and an inspectable exact-composition/asset manifest. It has a restrictive CSP and no script. It is labelled **not a video**. Unsupported MIME/API, failed encoder initialization, decode failure or a recording limit produces this readable fallback when the source remains authorized. Cancel, background hiding and scope changes never produce a partial fallback or partial film.

## Limits and cleanup

- Source media: 64 MiB each, 256 MiB total; supported raster image and audio MIME only. Design input must be a raster snapshot, not executable SVG.
- Decoded audio: 128 MiB; total film duration: 30 minutes; encoded retained chunks: **64 MiB**. A chunk exceeding the cap is not retained. These are guardrails, not a claim that every device can export that maximum.
- Host loads: 30-second bounded waits; audio resume: 8 seconds; decode: 20 seconds; final audio end and recorder stop: 8 seconds; fresh download check: 15 seconds. All listed timed waits race AbortSignal, including a host promise which ignores cancellation.
- Cancel, Escape during export, source/scope changes, document hiding, close, unmount and errors terminate capture. Tracks stop, audio sources disconnect, dedicated AudioContexts close, recorder handlers clear, preview/ready ObjectURLs revoke, detached audio elements pause and clear their source. Background export asks the user to return and retry.
- Download validation is a fresh online access check; it is not a replacement for host-side publication/approval/ACL enforcement. Real-device Safari/Firefox, native WebView encoding, authenticated Vault integration and complete-App keyboard/return behavior require host acceptance.

## Verification

`test/hearthside-projector.test.ts` exercises exact approvals/order/attribution, unknown-accessor rejection, duplicate IDs, full-caption pagination, amount omission, exact asset bindings, escaped readable files, stale/never-resolving loaders, changed access without new props, immutable composition hashes, encoded-byte limits, stalled resume/decode/stop cancellation, tracks/handlers and all three empty themes.

`node scripts/hearthside/projector-proof.mjs` runs an in-memory production component build and a synthetic Chrome harness. It records screenshots at 320, 390, 719, 720, 1100, 1440 and 1920 px in every theme, reduced motion, empty states, 390/1440 accessibility checks, native keyboard/order/review callbacks, missing media, enlarged long captions, actual film download and complete decoded audio/video playback, readable fallback downloads, revoked-access denial without React prop changes, and capture/URL/audio cleanup. `PROJECTOR_RECORDING_ONLY=1` runs the recorder/interactions subset while diagnosing encoding, without repeating the matrix. All committed media is explicitly synthetic fixture evidence, including the 1.2-second test tone and existing KittyFlat design fixture.

Evidence lives in `docs/evidence/hearthside-projector/`; gate outcomes are in `docs/worksessions/2026-09-12-hearthside-projector.md`. This component proof does not certify authenticated media access, actual App integration, native capture or physical devices.

Platform references checked 2026-09-12: [W3C MediaStream Recording](https://www.w3.org/TR/mediastream-recording/) and [Media Capture from DOM Elements](https://www.w3.org/TR/mediacapture-fromelement/). MIME support is advisory; successful construction and playable final output are separately verified.
