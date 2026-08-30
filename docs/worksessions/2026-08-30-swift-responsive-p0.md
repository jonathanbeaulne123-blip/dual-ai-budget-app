# Hearth worksession — Swift responsive P0

- **Status:** CLOSED
- **Opened:** 2026-08-30 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `C:\Users\jonat\OneDrive\Documents\ChatGPT\Budget App\tmp\hearth-hercules-release`
- **Branch:** `codex/app-swift-p0`
- **Baseline SHA:** `54096553825bdaa331dca26c2dc963d754e1c583`
- **Head SHA:** `54096553825bdaa331dca26c2dc963d754e1c583`
- **PR or issue:** none supplied
- **Risk:** High; the PGlite projection writer is changed without changing its acceptance boundary
- **Decision owner:** Jonathan
- **Environment impact:** none; synthetic Development verification only

## Household outcome

Hearth responds immediately to opening the demo, changing rooms, and ordinary kitchen actions. Hercules remains alive without making the books wait.

## Budget delta (5)

Faster access to Books and Confirm while preserving PGlite acceptance, double-entry, persistence-before-ack, environment separation, and visible Confirm.

## Engagement delta (3)

Room changes and Hercules reactions feel immediate; autonomous life remains bounded and non-blocking.

## Verified baseline

- Live `main` is `5409655`; the first Hercules P0 reduced settled task time but Jonathan reports the app still feels too slow.
- Previous code audit identified boot PGlite inspection, full projection rebuild/persistence, broad Office mounting, and redundant snapshot serialization as credible remaining causes; fresh current-main timing is not yet captured.
- Current source still ships a roughly 1.9 MB minified main bundle and a PGlite runtime/data payload; exact live request and interaction costs remain to be measured in this worksession.

## Scope

### In scope

- Fresh live and current-main production traces for cold entry, room changes, settled CPU, and one synthetic local acceptance path.
- The smallest high-impact fixes supported by those traces.
- Focused regression tests, current-main build, privacy/books review, and independent verification.

### Out of scope

- Removing Hercules or the animation engine.
- Weakening PGlite validation, accounting hashes, visible Confirm, durable local acceptance, or environment/Auth/privacy boundaries.
- Schema, secrets, hosted household data, Production ledger data, or deployment without a new explicit release decision.

## Acceptance evidence

- [x] Live baseline names the slow interaction(s), main-thread cost, and dominant execution paths.
- [x] Home idle task time remains bounded without making Hercules lifeless (about 0.42 s phone / 0.56 s desktop task time over five settled seconds in the local production build).
- [x] Room changes paint within a perceptibly immediate budget on desktop and phone (about 45–94 ms except a 143 ms desktop Home outlier).
- [x] Synthetic local acceptance retains balanced PGlite and durable persistence semantics.
- [x] Focused tests, current-main build, auditors, verifier, and aggregate gate are recorded honestly.

## Plan

- [x] Capture current live timings and network/CPU evidence.
- [x] Trace the dominant current-main call paths.
- [x] Implement the smallest coherent P0.
- [x] Rebuild, remeasure, stress-test, audit, and close.

## Evidence log

- Branch created clean from deployed `main@54096553825bdaa331dca26c2dc963d754e1c583`.
- Deployed baseline: demo tap waited about 3.46–3.48 s before member choice while PGlite loaded and rebuilt; room paints were already about 23–101 ms.
- Local production build: demo tap paints member choice in 26 ms desktop / 36 ms phone. The cold PGlite gate still takes about 3.0–3.35 s when a member is chosen immediately, but it is visibly acknowledged and remains fail-closed.
- Direct synthetic demo ingest in memory PGlite improved from 337–395 ms on the deployed writer to 77–80 ms with bounded batching (same process and machine).
- Focused books/storage/command gate: 4 files, 43 tests passed; the PGlite replacement and rollback tests passed.
- Post-review focused gate: App fast entry + books + Fund PGlite, 3 files / 16 tests passed; TypeScript passed.
- Manual `pnpm check` equivalent passed: AI surface, TypeScript, Vite production build, Hercules Pro UI build, and no `dist/_redirects`.
- Aggregate `pnpm test` completed with two failures reproduced outside this patch: the known Windows `bash`/Python harness dependency and the existing Hercules Pro personal-envelope fixture. All changed-surface tests passed.
- Independent books audit: PASS WITH NOTES; transaction boundary, ordering, parameter ceiling, rollback, and privacy preserved. Follow-up is an explicit later-batch rollback fixture.
- Independent UX audit: PASS after rapid-double-click guarding and failure-path proof were added.
- Independent verifier: PASS; 33 focused tests, manual production build equivalent, no tracked secret/workbook/export, and clean diff.

## Decisions

- Responsiveness is the product requirement; a lower CPU number alone is insufficient.
- Books remain weight 5 and win any tradeoff with Hercules weight 3.

## Remaining uncertainty

- Cold PGlite WASM initialization remains the largest unavoidable first-use cost; moving it to a Worker or redesigning the projection lifecycle is a separate architecture packet.

## Handoff

Closed locally. Codex completed one-writer implementation and proof; Jonathan owns any commit, push, or deployment decision.
