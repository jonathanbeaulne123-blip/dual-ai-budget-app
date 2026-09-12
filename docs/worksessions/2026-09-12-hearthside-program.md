# Hearth worksession — Hearthside full program

- **Status:** OPEN — implementation in progress; no package completion claimed yet
- **Opened:** 2026-09-12 (`America/Toronto`)
- **Owner / decision owner:** Jonathan
- **Integration owner:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/hearthside-program`
- **Baseline SHA:** `429db8ef0447dac6347e89e945dd04aad05e84fb`
- **Head SHA:** baseline plus local implementation; see evidence log
- **Risk:** High; hosted activation and native distribution require Release review
- **Environment impact:** local and synthetic Development

## Household outcome

Build the entire approved Hearthside program: a shared home connecting intentions, creative work, practical agreements, affectionate gestures and chosen memories. Free and funded experiences receive equally complete journeys. Intermediate releases do not replace this outcome.

## Budget delta (5)

One intention connects existing plans, responsibilities, backing and receipts without creating another source of financial truth. Creative changes do not invalidate unrelated financial reviews.

## Engagement delta (3)

Simultaneous making, affection, presence, discovery and four authored rooms in Classic Hearth, Taylor's Scrapbook and Newfoundland accumulate meaning chosen by the couple.

## Verified baseline

The requested baseline `5cc8c12` (#461) is an ancestor of current main. The only intervening commit, `429db8e` (#462), changes Hercules free-tier routing. Home's painted cats and selected-bank return flow are retained. This work uses a dedicated checkout; other active tasks remain independent.

## Scope and package register

All packages include changed-state tests, recovery, applicable theme treatments and independent review. Status is deliberately separate from deployment and physical proof.

| Package | Depends on | Scope | Status |
| --- | --- | --- | --- |
| P0 | — | Current baseline, six journey storyboards, 12 room compositions, synthetic fixtures | In progress |
| P1 | P0 | Shared identities, scoped commands, routes, capabilities, continuity and restore | In progress |
| P2 | P1 | Connected room shell, focused tools, stable addresses and returns | Integrated local room/object/tool routes; focus and app-chrome verification ongoing |
| P3 | P1 | Recipient-only Vault, media, drafts and recoverable publication | Vault letters/media/audience/archive and exact memory binding integrated; actual LedgerRoom admission proven locally |
| P4 | P1 | Canonical creative documents, operation history, migration and render projection | Canonical operations, migration, SQL/R2 history, delta reads and render projection integrated |
| P5 | P2, P4 | Simultaneous Studio, previews, individual undo, firing and handoff | Studio, live preview/receipt runtime, durable async handoff, shelf, keyboard draft and rejected-edit recovery integrated; physical concurrency proof open |
| P6 | P2, P3, P5 | Notes, chalkboard, letters, voice and cooperative encounters | Placed notes, chalkboard and recipient letters/voice/capsules integrated; private answers and all 12 encounters have actual authority proof; stable entry-to-Studio and exact paired memory bridge integrated |
| P7 | P1, P2, P4 | Wishes, banks, Plan, dates, canonical Tasks and consent | Plan Tasks linked; exact Chapter/Ritual mutual agreement, canonical occurrences and Planner responsibility integrated |
| P8 | P3, P6, P7 | Exact-version memories, paired recollections and recurring occasions | Paired text/design/media memories, private copies and recurring occasion preparation integrated; actual service admission verified |
| P9 | P1, P7, P8 | Scoped Hercules context, drafts and reviewed shared artifacts | Selected-intention compact/full Workspace, resumable drafts and reviewed shared artifact references integrated; shared-copy R2 archive and atomic initialization repair integrated; actual archive restart/recovery tests pass |
| P10 | P2, P5, P8 | Four complete rooms in three themes and imagined futures | 12 authored rooms, 14 semantic furniture pieces, arrangement recovery, canonical future horizons and recorded layouts integrated; final app/physical polish gates open |
| P11 | P3, P8, P10 | Four seasonal packs per theme, capsules, room history and projector film | Capsules, downloadable Projector and mutually kept room history integrated; all 12 seasonal encounters and connected entry integrated |
| P12 | P3, P8, P10 | Mutually published guest copies, visits, revocation and private street | Guest namespace, reviewed copies, own-auth Street and actual LedgerRoom/Vault source projection integrated; final whole-worker/application evidence open |
| P13 | P2, P4, P5, P10 | Capacitor 8 companions, native authentication, interactive AR and widget | Native source, interactive AR, secure startup/system-browser auth recovery, widget controls and actual Studio entry integrated; SDK builds, distribution and physical gates open |
| P14 | P4, P8 | Immutable STL, 3MF, GLB and paint/geometry production packages | Production kernels and Studio export surface integrated; integrated evidence and physical acceptance open |
| P15 | P0–P14 | Integrated acceptance, independent reviews and release evidence | Open; no integrated frozen-head high gate or root build yet |

## Locked decisions

- Shared metadata uses typed non-financial LedgerRoom commands. Private content uses a separate authenticated Vault; guests receive reviewed immutable copies only.
- Pottery supports concurrent same-surface work, server-authored ordering, individual gesture undo and immutable firing revisions.
- Existing money commands and exact review / Final Confirm remain the financial boundary.
- The existing Chapter is the Sitdown focus. Experiences may cross Chapters and do not automatically create banks, tasks or dates.
- Merge Play and Together entrances into Hearthside. Preserve Home, Fund, Our Path, money action and Status Centre.
- Native scope includes actual interactive iPhone and Android AR. A model viewer does not satisfy it.
- Physical scope ends with production files. No ordering, commissioning, pricing or fulfilment.
- Claude is authorized for second opinions and asset design. Consultations contain task context, not private household records or credentials.

## Acceptance evidence

- [ ] Complete connected journeys, including free evenings, practical goals, changed dates, paused dreams and photo-free memories.
- [ ] Two-member concurrency, individual undo, topology changes, pending firing and history recovery.
- [ ] Money integrity, receipt recovery and painting during an open funding review.
- [ ] Recipient isolation, exact-version approval, revocation and scope-switch cancellation.
- [ ] Canonical task completion, recurrence identities and recorded versus imagined state.
- [ ] Guest payload isolation and deterministic export geometry.
- [ ] Native sign-in, deep links, AR interaction, background/resume and physical-device proof.
- [ ] All themes; 320, 390, 719/720, 1100, 1440 and 1920px; accessibility, motion, error and performance evidence.
- [ ] Required high-risk focused gate and production build.

## Evidence log

- Initial checkout clean; remote main independently matched `429db8ef0447dac6347e89e945dd04aad05e84fb`.
- `git diff --stat 5cc8c12..origin/main`: #462 only, no Play/Home rewrite.
- Claude Desktop consultation completed in “Hearthside design second opinion”; art direction retains the full scope and three distinct authored themes.
- Canonical creative and shared-life runtime: 49 tests across seven suites passed before later room/surface integration, including actual SQLite/R2, actor separation, same-surface edits, own undo, deltas, legacy migration, private omission and recovery.
- Actual WebSocket preview test found and fixed a first-preview throttle collision with joining. Loopback delivery measured 27 ms in one fixture; this is not the declared two-device p95 network gate. Lost archive ACK retries wake peers with one accepted edit.
- Current room/occasion connected suite: 20 tests across contracts and journeys passed in 17.40 s. Free evening to both recollections and exact keeping, distinct yearly preparations, lost ACK and scoped draft recovery pass through command authority.
- Studio browser: actual authored 3D piece, keyboard paint, own undo/redo and firing pass at Classic desktop1440, no page error/overflow. Synthetic local authority only.
- RoomScene commit d5015af: 111 browser records, 84 theme/width views, 24 room axe checks plus arranger, 95 screenshots. Final component High gate functionally passed but took441.958 s (TypeScript382.651 s under contention): 300 s budget breached; not release-green.
- Export/native surface commit148de52: real browser capture, six textures, actual Worker and ZIP download; all requested widths/themes, enlarged text, dark controls, lifecycle and cancellation. Synthetic native plugin events only; no physical/native acceptance claim.
- Vault audience commit8adffe5: High focused78 tests/11 files in39.838 s passed. SQL023 is source only, not applied. Private recipient binding requires server HMAC attestation; no household-member fallback.
- Native source92b25db: targeted TypeScript,9 tests, Swift syntax and Capacitor discovery/update pass. Xcode/iOS SDK, JDK21/Android SDK and physical devices remain unavailable to this local proof.
- Export kernelc85d2ba:15 tests; explicit repair review and deterministic immutable output. Geometry reports preserve disconnected parts and unverified tolerances; no certified printer-ready claim.
- Integration remains baseline429db8e plus local/staged changes; evidence above belongs to the named scopes/commits, not a frozen integrated head.

## Release and remaining uncertainty

No hosted schema application, service activation, guest invitation, external-calendar write, provider disclosure, native signing/distribution or Production activation is authorized by this implementation request. Prepare concrete candidates and evidence before the corresponding release decision. Local implementation, Development deployment, authenticated continuity, native distribution, physical acceptance and Production readiness must be reported separately.

## Handoff

Codex continues integration. The full program remains open through P15. No deployment or whole-program completion is claimed.

## Integration evidence update — 2026-09-12

- Real LedgerRoom plus HearthsideVault runtime: exact media composition admission, forged-binding denial, separate Vault/canonical Keep, original receipt replay, explicit activation, fresh metadata omission, changed-caption access denial and revoke-before-withdraw all passed. Financial audit hash unchanged. No fixture authority substitutes for LedgerRoom in this test; the roster/auth identities remain synthetic/local.
- Chapter package ba10aa18 integrated with shared authority/capability/materialization patch. 37 integration tests (memory authority, Chapters, Hearthside contracts) passed in5.57s. Shared financial restoration now preserves the complete current operational and story graph; orphaned Chapter/Task restoration fails closed.
- Planner accepted-responsibility controls integrated; all5 UI tests passed. Six connected Hearthside journey tests passed in3.61s after updating fixture entrance/object IDs to the new room surface.
- Full root TypeScript check passed after explicitly including the repository Cloudflare platform declarations. This is not yet the frozen full-program gate or build.
- Actual room pointer arrangement:9 browser cases at320/390/1440, across all3themes, passed drag, cancel, accepted position, synthetic member switch and overflow. Native range precision now matches accepted drag coordinates. Evidence /tmp/hearthside-arrangement-proof/evidence.json.
- Fresh projector authorization checks passed for words-only memories, changed/revoked compositions, replaced audiences, ordered media and cancellation. Integrated downloads use fresh metadata and media access.
- Conservatory horizon selection and accepted Plan projection adapter implemented; dedicated verification in progress.

## Integrated authority and native entry update

- Accepted baseline remains `429db8ef0447dac6347e89e945dd04aad05e84fb` plus uncommitted integration; no root release SHA, push, deployment or activation.
- P5 durable handoff and shelf: actual LedgerRoom receipt recovery and recipient pickup pass; browser history/hand-off matrices recorded in `/tmp/hearthside-history-proof/evidence.json` and `/tmp/hearthside-handoff-proof/evidence.json`.
- Conservatory uses canonical bank backing and accepted Plan projections for tonight/season/someday. Unavailable backing remains unavailable.
- P9 current intention reaches compact/full Workspace and the local worktable. Shared copies and publication references use recoverable receipts. Archive commit `6a4040e` is integrated by exact patch; independent real Agent/SQLite/R2 review reproduced non-atomic first-owner initialization. The atomic initialization repair 2e8fe69 is now integrated; the original finding and its regression remain recorded.
- P12 `d6db17b` and P10 `af1d886` integrated. Guest source catalogue is detached current shared metadata only; private media callbacks run outside LedgerRoom serialization, with accepted-sequence validation afterward. Exact active original Vault memory publication is required, including both current Keeps. A replacement memory publication cannot revive the old guest copy.
- Furniture/room-history/Workspace/memory actual Worker suites: six tests across four files passed in 6.43 seconds. Same-piece conflict, independent-piece saves, lost ACK identity, immutable history, changed guest activation, old active visit, actor mismatch and financial restore preservation were exercised. Auth identities are synthetic local members.
- Encounter packages `aa4df60` and `e0c4709` integrated with dedicated fresh-auth HTTP admission and actual Vault audience evidence. Generic commands cannot bypass this lane. Both kept choices can create one canonical Studio document and outcome atomically with the receipt/archive. Copied marks belong to the accepting actor; source-member choices remain separate evidence. An initial 60-character piece-ID failure was fixed. Pure recipes and actual authority tests passed (3 tests, 2.87 seconds), including lost acknowledgement and second-member reuse.
- Native `ab724fb` integrated. Main awaits secure hydration; App is lazy-loaded only when the own-auth Street is not displayed. Native widget capture uses the same selected immutable revision as AR/exports, fixed authored scale, explicit image review and no financial metadata. Native UI/bootstrap five tests passed; actual main-entry Street browser proof passes. Native SDKs and physical devices remain unavailable.
- Guest image admission now rejects ancillary private PNG/JPEG metadata and trailing/corrupt PNG chunks; it never silently alters reviewed pixels. New parser tests passed. JPEG preparation reuses existing board-media rules.
- Full production TypeScript compiled before the last small entry changes; the only reported new test byte-access error was fixed. All tests/gates must be rerun against the final integrated source after pending packages land. No full-program completion claimed.


## Coupled completion and local performance update

- Win adoption `0d9741c` integrated with descriptor-only command dispatch. Deterministic canonical memories preserve labelled unattributed earlier captions while both people review the exact new composition; legacy Keep cannot silently bypass current consent. The root Win/contracts/guests/native/furniture group passed 60 tests across 7 files in 8.62 seconds. Updated existing Home and Planner regressions passed (11 tests).
- Workspace archive initialization repair `2e8fe69` integrated. Its isolated exact-head High gate passed 43 tests across 6 files in 35.681 seconds, plus the isolated build; root final gate remains separate.
- Own-account Street browser proof uses actual `main.tsx` and lazy App entry: four widths, account switching, sign-out, no App/PGlite/ledger requests and zero axe violations. One test passed in 3.46 seconds. No hosted account was used.
- Encounter Entry `f8942a1` and compatibility guard `907b2a6` integrated. Isolated High gate: 20 tests / 8 files, 56.020 seconds; fingerprint `2a6f23557598750da92533e5169ad274a796283c337ad2caad3d09420ea52f94`. Root actual Entry browser tests (3) and root actual encounter authority (1) passed after integration. Both are synthetic; their distinct authority boundaries remain explicit in the Entry handoff.
- Integration review added a scope check after asynchronous recovery-image hashing, before any draft/memory callback. An independent bounded review of the three Entry continuity helpers found no additional blocker; it was not a complete program review.
- Studio retains an immediate illustrated cat while 3D initializes. Lighting environment, instanced environment buffer and directional shadow are explicitly disposed. Off-screen idle rendering stays paused after the page becomes visible again. Discarding a rejected edit resumes already-submitted later edits; storage failures remain visible.
- Actual Studio local browser measurement: 5 entry/exit cycles alternating 1440/390px; 155 pointer events and 60 keyboard events. Per-cycle pointer p95 was 4.5–5.7 ms; keyboard p95 10.7–16 ms. All contexts released; authored buffers/shaders/vertex arrays reached zero before context loss; fixed renderer cache counts did not grow. Observed headless animation-frame cadence was 54–57 per second; this does not close the reference desktop 60-fps or physical-phone 30-fps gate. Rendering/client tests passed 8 tests in 10.10 seconds. Evidence: `/tmp/hearthside-making-performance/evidence.json`.
- Actual authenticated preview lane loopback: 30 samples, p95 14 ms; actor scope and durable edit receipts tested. This is not the declared physical two-device network fixture.
- Native launcher and launch art now derive reproducibly from the existing Hearth Hercules mark; 30 platform assets generated and the iOS icon visually inspected. Local doctor verified Node24.19 but reports no Xcode/iPhone SDK, JDK21 or Android SDK. No native compilation, signing, device acceptance or distribution is claimed.
- Intention-to-bank and explicit shared-life restore integrations are still pending their final patches. The whole guest service assembly proof is in progress. The full program remains OPEN.

## Bank continuity and guest assembly integration

- Bank journey `510ba99` is integrated. Existing bank creation entrances now review and Final Confirm with a durable identity; accepted receipts identify the exact new bank. Linking that bank to an intention is a separate versioned shared-life receipt. Root bank authority/UI/runtime, connected journeys and Encounter Entry browser tests passed 22 tests across 5 files in 30.09 seconds. New creation drafts include the actual account/household render scope.
- Encounter recovery now rechecks its scope after asynchronous image hashing; an actual browser race closes the controller during hashing and proves that neither navigation nor draft callbacks fire. The normal three-theme Entry journey remains green.
- Guest assembly `541cf85` is integrated: the production GuestRoom/Card/Index, LedgerRoom and Vault operate together through signed synthetic identities and real SQLite/R2/WebSocket receipts. Its isolated High gate passed 3 tests in 39.007 seconds. An untouched migrated piece at revision zero is now admissible only as a piece; memory revision zero remains invalid. Root integrated acceptance remains to run.
- Browser sculpture fallback loads the selected private GLB through a separately pinned viewer dependency, keeping Studio’s renderer version unchanged. The actual browser test passed in 7.28 seconds after installation settled. Model loading, keyboard rotation and scope-close Blob revocation pass. Quick Look/WebXR on physical phones remain unverified.
- A new Claude Desktop review could not run because the Mac session is locked. The earlier design consultation remains the only completed Claude evidence; local implementation and bounded independent code review continue.

## Current-main reconciliation checkpoint

- Remote main refreshed to `a96c1ffb0905957d20c16491846ff0ca4b9b5e3c`: five merged changes (#463–467) landed while implementation ran, including nesting banks, Calendar/navigation and Hercules recovery. These must be reconciled before any integrated acceptance claim.
- Shared-life restore `1521801` is integrated with its exact patch; a narrow resource-map adaptation preserves the bank-link review fix. Its isolated High passed 584 tests across 58 files in 95.449 seconds, plus the full build. This is scoped evidence on the agent’s copied root baseline.
- Independent bank review found a real authority race: client-only link checks missed bank-meaning changes after network handoff. New semantic command resources bind only newly linked banks to their reviewed name, target, purpose, visibility and availability. Creative paint remains independent. A separate lost-WebSocket-ACK busy-latch repair and legacy creation compatibility repair remain in progress.
- A local WIP checkpoint preserves implementation before merging current main. It is not a release candidate or a declaration that the program passes.
