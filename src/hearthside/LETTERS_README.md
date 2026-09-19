# Private Letters surface

`Letters` is the usable writing and reading surface for recipient letters, photos,
voice notes and time capsules. The Common Room or Theatre supplies an authenticated
`HearthsideVaultClient`, its exact `VaultClientScope`, the current display roster,
theme, `onClose`, and a `publishReviewed` callback. `publishLettersReview` provides
the exact approval/activation sequence when the service's trusted publication
authority is bound. Keep `publicationEnabled` false until that release gate closes.
The roster prop supplies labels only; the server resolves authenticated principals.

Classic Hearth uses a warm writing desk, Taylor's Scrapbook a ribbon-bound paper
folio, and Newfoundland a harbour window and logbook. All use semantic controls,
keyboard focus return, dark appearance and reduced motion. Set
`--hearthside-tool-clearance` to the real navigation/Fund clearance; its fallback is
140px plus safe-area inset. Scene composition follows the integration owner's
`docs/briefs/HEARTHSIDE_ART_DIRECTION.md`.

## Private state and explicit publication

- Typing persists to an account-and-household scoped IndexedDB cache. Saving a
  private cloud draft is explicit. Storage failure blocks save/review, preserving
  current words in memory and showing a recovery message.
- Photos are decoded to fresh pixels with the existing bounded board-photo
  normalizer, then stripped of EXIF/IPTC/XMP/ICC markers. Microphone recording is
  requested only by the record button, stops after two minutes, and closes tracks
  on stop, error, cancel and unmount. Playback never autoplays.
- Normalized photo/voice bytes enter the private upload queue before network work.
  Only the selected draft's attachments upload during save/review. Blob URLs are
  temporary rendering handles; none are stored in drafts or household records.
- Publication identity is persisted before prepare. Exact content, recipient and
  opening-time review stays immutable across lost acknowledgements and remounts.
  Retry reuses the same publication and digest. Editing explicitly withdraws the
  old review before making another publication.
- A sender can recover a prepared/accepted review on another device. Its local
  working-copy identity is separate from the original private source, so recovery
  cannot overwrite newer source words. The original publication/source reference
  is retained for retry. Active capsules have no source-content recovery endpoint.
- Active capsule titles and contents stay hidden until server time permits access.
  The countdown is an estimate from the last server clock; reading always asks the
  server. Sender and recipient lists have no read receipts or reciprocity metrics.
- Deleting a private draft removes its local queued attachments and tombstones the
  private source. A published copy survives until explicit withdrawal. Withdrawal
  revokes access before cleanup and does not erase a private source.

Dispose the supplied Vault client on authentication or household-scope changes.
The surface keys state by exact account/household scope, cancels recording on
unmount and closes its owned draft-cache connection after queued writes finish.
An injected cache remains owned by its caller.

## Narrow service additions

`snapshot` adds owner/recipient scoped `mail` cards and `serverTime`. Sealed cards
omit titles. `resume-publication` is owner-only and accepts only prepared/accepted
publications. These remain private Vault responses; `VaultReference` and household
metadata are unchanged. `resumeUploads(ids)` supports a selected attachment set;
`removeQueuedMedia(ids)` removes only this exact scope's pending private bytes.
Prepare and recovery return `VaultAuthorReview`, an explicit projection containing
member IDs and reviewed content; recipient authentication subjects stay server-side.

## Local evidence and remaining gates

The focused UI tests cover storage failure, private save, exact review, lost-ack
remount recovery, new-device review recovery, withdrawal/edit, private deletion,
sealed recipients, microphone permission denial and recording failure. The real
Chromium fixture exercises the component in all three themes at 320, 390, 719,
720, 1100, 1440 and 1920px, keyboard focus, dark/enlarged text, axe checks, canvas
photo normalization and a synthetic microphone. Temporary media URL cleanup is
checked after component exit. The real device cache also survives React StrictMode
and a browser reload, including stable accessible names on restored text.

This is local component and authority evidence. Root App routing, hosted Vault
activation, authenticated two-device continuity, actual microphones and physical
phone acceptance remain separate integration/release gates. No hosted binding,
schema, deployment, notification or external invitation is changed here.
