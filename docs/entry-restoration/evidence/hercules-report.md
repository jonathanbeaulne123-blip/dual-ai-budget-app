# Hercules and Fund component verification

Final source build: 2026-09-09T02:04:12.765Z. Source manifest SHA-256: 86a818e23f2310356621bab3319a17623bddc6c0982ba674565f3f31f6449713. Per-file hashes and original CSS import order are in source-snapshots.json. Current source was a moving parent-owned worktree, so this identifies the exact compiled snapshot rather than claiming its HEAD includes every edit.

## Scope

Actual HerculesPresence, HerculesSetup, FundDrawer and their current dependencies; baseline HerculesPresence at76e486a142987ed5d6fbc065367fadf4c896de26. Synthetic catalog, fictional member names, synthetic Shared household ID, no transactions, configured Fund and offered onboarding; inert optional navigation and synthetic in-memory accepted callbacks. No authenticated environment, live household, real statement or hosted provider. Original/current main.tsx global CSS import order used respectively. App itself and the full Home are not rendered.

## Final responsive matrix

15cases: Classic/Taylor/Newfoundland ×320,390,719,1100,1440px. Heights844px for phone,1000px desktop.45screenshots capture closed presence, open setup and open Fund. Every case has zero closed setup dimensions, zero closed setup commands, unchanged Home sentinel after close, zero document horizontal overflow, and zero Fund control horizontal overflow. Setup and Fund forward/backward Tab containment passed. Setup Escape returns to the phone pill or desktop cat; Fund Escape returns to its trigger. Phone slot selection shows6places; desktop8. All measured controls have minimum44px height. Zero page errors and nonfont external requests.

A broad global geometry scan includes the decorative offscreen Hercules z on phone, which does not widen the document or the drawer. This is distinct from a content overflow.

## Reproduced and corrected finding

Phone setup close initially left focus on BODY because the pill unmounted before useDialog captured its return target. Supplying a fallback alone still failed because BODY was treated as a valid connected target. The parent corrected return-target validity; rebuilt final matrix passes all15cases. Pre-fix measurements and source manifests remain in this directory.

## Opening latency

Pointerdown to visible component DOM at the next animation frame,10samples per version/width,700ms between interactions. This is local synthetic component timing, not physical-device input-to-paint certification.

| Version | Width | Median ms | First sample ms | Max ms |
|---|---:|---:|---:|---:|
|baseline|390|14.50|226.80|226.80|
|baseline|1440|296.45|489.30|489.30|
|current|390|14.35|157.10|157.10|
|current|1440|10.45|310.40|310.40|

Timing snapshot is recorded separately in source-snapshots-latency-and-pre-final-focus.json; final functional rebuild changes the dialog return-target validity. Baseline desktop has an intentional280ms tap/double-tap decision delay. Cold first samples include initial view work and are reported, not discarded. Shared machine load was not controlled.

## Quietness and ambient work

Each timing context had a10second real idle Shared Home observation: zero conversational requests on both versions. A separate60second virtual-clock jump recorded scheduled timers and due callbacks in reduced and normal motion. This fastForward operation fires due intervals at most once; it is not a real60second throughput benchmark or proof of every45second mutter branch. Normal-motion Home retained the same8scheduled/7fired timers. Reduced-motion baseline had3scheduled/2fired, current2scheduled/1fired; the extra9000ms ambient interval is gone. No visible conversational surface or provider request appeared in any timer specimen. Static call-path tests remain necessary for other tabs and fixtures.

See summary.json, measurements-final-matrix.json, measurements-latency-and-pre-final-focus.json, ambient-timers.json and screenshots/. All scripts and outputs are locally ignored; no tracked file was written by the verifier.

## Overview layout recheck

After the compact journey / conversation-first presentation change, all15 structural cases still pass. Screenshots were regenerated from the updated snapshot; previous layout measurements and source hashes are preserved in measurements-before-overview-layout.json and source-snapshots-before-overview-layout.json. The paired latency results above remain explicitly associated with their prior timing snapshot and were not rerun for this presentation-only update.

Visual inspection confirms conversation is prominent on desktop and appears before the stages on phones. Two actionable details remain in this snapshot:

- At390×844, Start together spans y814.89–862.89 (Newfoundland815.89–863.89), so roughly19px is below the viewport. At320×844 it spans y996.92–1044.92 (Newfoundland997.92–1045.92), entirely below the fold. The scroll container and keyboard navigation still reach this content; the issue is initial discoverability, not an unreachable action.719/1100/1440 show the complete button.
- The invitation renders “Three sittings, about an hour all in” above “Five stages,9required learning checkpoints.” The stale invite.explain copy contradicts the accepted curriculum and should be updated.

## Embedded preparation and invitation fix recheck

The later embedded preparation disclosure and updated five-stage invitation resolve both overview findings above. measurements-start-recheck.json and start-action-recheck.json record a fresh15case matrix. Start together is fully visible in every case: around y573–621 at320px and499–547 at390px. The complete button, conversation and Close are visible together. Stale one-hour copy is absent in the rendered invitation. All prior structural/focus checks still pass. Latest screenshots and source-snapshots.json now refer to this recheck; earlier paired timing remains separately labeled.
