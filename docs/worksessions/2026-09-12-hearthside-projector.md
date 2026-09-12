# Theatre Projector

Isolated implementation assignment from root after the RoomScene commit. Base `429db8ef0447dac6347e89e945dd04aad05e84fb`; branch `codex/hearthside-projector`. One writer; root owns App, canonical contracts, approvals and integration. New projector files only. The integration checkout's uncommitted `contracts.ts` is temporarily copied as a read-only compile dependency and will not be committed by this branch.

Risk: Medium-High. Budget delta (5): the projector has no ledger or money authority; amount display is off by default and can only use explicit immutable, provenance-bearing snapshots for an approved composition. Engagement delta (3): couples can order their deliberately kept memories into a theatre experience and download a real film or readable offline story file, retaining each author's exact words and each saved design revision.

Scope: verified kept-composition projection, selection/order, native playback/keyboard controls, scoped asynchronous media loading, exact saved design image loading, themed projector, cancellation and cleanup, real canvas recording with browser-supported MIME, readable story fallback, focused tests and actual browser download/playback evidence. No generation of personal memorabilia, background sharing, external upload, publishing, ordering or financial commands.

Applied existing Hearth worksession/implementation packet and page-theme standards. Official platform references checked on 2026-09-12: W3C MediaStream Recording (https://www.w3.org/TR/mediastream-recording/) and Media Capture from DOM Elements (https://www.w3.org/TR/mediacapture-fromelement/), plus MDN MediaRecorder/captureStream. Supported MIME is advisory; constructor/runtime errors still need a truthful fallback. Canvas capture must remain origin-clean, and final data is collected through recorder stop/dataavailable events.

Implementation is complete in the bounded component scope. Root independently reviewed the source and required fresh download authorization, an encoded-byte cap, and abort-responsive audio/stop waits. All three were fixed, including a required host `validateDownload` callback. A deeper saved-file check also found a 1.2-second voice note cut to 1.08 seconds; waiting for the actual audio-source end and draining the encoder now preserves its full 1.200 seconds.

## Verification outcome

- Final scoped quick gate passed in **102.823 seconds**, within its 300-second budget. TypeScript took 87.500 seconds; all 21 focused tests passed (1.089 seconds test work). AI surface, whitespace and dependency-related test discovery passed. No full/exhaustive repository gate was run or claimed.
- An earlier gate failed at 41.948 seconds on a TypeScript-only fake-recorder test-double type. The test was corrected before the successful rerun. This was a failure, not a time-budget breach.
- Final Chrome synthetic component proof: **38 passing records**, **27 screenshots**, seven widths (320/390/719/720/1100/1440/1920) in Classic/Taylor/Newfoundland, three 390px empty states and nine axe audits with no violations. No horizontal overflow, undersized component buttons, reduced-motion reel animation or browser page errors. Full paired DOM captions remain readable on phones; long captions and enlarged text were separately checked.
- Saved real WebM: **168,398 bytes**, **1280×720**, **3.546 seconds**, played to ended. Its decoded synthetic 1.2-second voice note measured **1.200 seconds**, two channels, peak 0.15579. The file is `docs/evidence/hearthside-projector/synthetic-kept-story.webm`; it is actual browser output, not a renamed placeholder.
- Actual readable HTML downloads passed for unsupported MediaRecorder and a supported-MIME constructor failure. Fresh download access denied a ready file after resolver access changed without any React prop change, with no download event. Active cancel/withdraw stopped all six observed capture tracks and revoked both created URLs. A simulated document-hidden event during real recording stopped both tracks without returning partial output. Scope changes paused and cleared a detached voice-note element.
- Browser interactions covered selection, order, theme retention, revision-specific review callback, keyboard next/previous, play/pause, real film download/playback, fallback downloads, unavailable media, close, cancellation and withdrawal. Root's source review and representative screenshots supplied independent bounded review.

Exact final gate command (PATH includes the bundled Node and fallback pnpm):

```sh
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never test -- --risk=medium-high --focus=test/hearthside-projector.test.ts --focus-reason='Bounded Theatre Projector approved composition rendering, fresh publication download validation, recorder limits and abort cleanup'
```

Gate base/head while validating the new uncommitted files: `429db8ef0447dac6347e89e945dd04aad05e84fb`; gate fingerprint `63a4c9dbe236c1801478a2d0b1873d17efc1e27fb7c1c5f37ebb7839d3ad7810`. No executable source or test changed after that passing run; only this evidence note/README wording and removal of the temporary compile dependency followed. During TypeScript, another independently coordinated Kitty Nest compiler briefly overlapped; the measured scoped gate still stayed below budget.

## Integration boundary and provenance

Root must integrate this commit after canonical P1 contracts and wire `scopeKey`, `publicationEpoch`, exact asset loaders and **fresh `validateDownload` authority**. The temporary `contracts.ts` copy is deliberately not in this commit. It matched root's canonical Memory/Media/Design decoder signatures; root's sole intervening difference was an unrelated `decodePlacement` field rejection. No package/config/App file changed and no additional dependency is required.

All committed media is synthetic test evidence. The picture comes from a labelled test canvas; the voice is a generated 440Hz WAV test tone, not a person; the design image rasterizes the existing authored KittyFlat shape at an explicit synthetic revision with no financial scaling. No household books, private references, real memorabilia, credentials or external uploads are present.

This establishes a tested component and real local export. It does not claim full App integration, authenticated publication/Vault access, native/Safari/Firefox encoders, restored host focus, physical devices, CI, Development deployment or Production readiness. Host acceptance must close those relevant integration gates. The complete loader/validator API, resource limits, export format and cleanup behavior are documented in `src/hearthside/projector.README.md`.
