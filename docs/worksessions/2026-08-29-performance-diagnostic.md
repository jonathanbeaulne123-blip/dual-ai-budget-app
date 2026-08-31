# Hearth worksession — application performance diagnostic

- **Status:** CLOSED — repair plan executed and reconciled 2026-08-31; all five stages released
- **Opened:** 2026-08-29 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `C:\Users\jonat\OneDrive\Documents\ChatGPT\Budget App`
- **Branch:** `codex/roadmap-site`
- **Baseline SHA:** `fd1b27d4d76ce78690beffc26eb7283a6cc2638c`
- **Head SHA:** `fd1b27d4d76ce78690beffc26eb7283a6cc2638c`
- **PR or issue:** none supplied
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** none; local read-only diagnosis only

## Household outcome

Explain why Hearth feels slow, using reproducible local evidence, and give Jonathan a ranked repair plan that protects ledger correctness and makes the kitchen feel immediate.

## Budget delta (5)

Diagnostic only: identify latency that delays opening the books, posting, reconciliation, and trusted account views. No financial behavior changes in this worksession.

## Engagement delta (3)

Diagnostic only: identify latency that delays the Office, Hercules, and repeat household use. No engagement behavior changes in this worksession.

## Verified baseline

- Current branch and SHA were read from Git.
- The checkout was already dirty before this worksession. Existing modified and untracked files are Jonathan's concurrent work and will not be overwritten.
- Runtime causes and timing measurements were verified against a fresh local production build and a synthetic Development/demo flow. The strongest finding was isolated with a controlled rig-running versus rig-destroyed comparison.

## Scope

### In scope

- Static inspection of startup, persistence, synchronization, large components, dependency loading, and render/update flows.
- Local build and bundle analysis.
- Local Development/demo browser measurements on representative startup and navigation flows.
- Ranked root causes and a staged remediation plan with measurable acceptance gates.

### Out of scope

- Production, hosted data, schema, secrets, deployment, or external provider mutation.
- Implementing performance fixes.
- Loading local-only household exports or meaningful household data.
- Historical `docs/nostalgia/` or `docs/reference/` material.

## Acceptance evidence

- [x] Exact repository, branch, SHA, and dirty-tree constraints recorded.
- [x] Startup and navigation path inspected in current code.
- [x] Build output and largest delivered assets measured.
- [x] Browser runtime measured on phone and desktop synthetic Development flows.
- [x] Findings distinguish verified causes, supporting evidence, and inference.
- [x] Repair options are ranked by user impact, safety, effort, and verification gate.

## Plan

- [x] Establish the current architecture and entry-path map.
- [x] Measure build and dependency payloads.
- [x] Measure local browser startup, long tasks, requests, and representative navigation.
- [x] Cross-check likely causes against current tests and instrumentation.
- [x] Record a phased repair plan and remaining uncertainty.

## Evidence log

- `git branch --show-current` -> `codex/roadmap-site`.
- `git rev-parse HEAD` -> `fd1b27d4d76ce78690beffc26eb7283a6cc2638c`.
- `git status --short` -> checkout already contains numerous modified and untracked files; no cleanup or reset performed.
- Fresh Vite production build to `tmp/perf-dist` completed in 4.72 seconds. The eager application entry is 1,617.75 kB raw / 479.26 kB gzip; CSS is 97.43 kB raw / 19.62 kB gzip. The dynamic PGlite path adds 531.21 kB JavaScript, 10,087.56 kB WASM, 6,293.23 kB data, and 395.06 kB init WASM.
- Browser harness: `tmp/perf-diagnostic.mjs`, served by `tmp/perf-static-server.mjs`, cache disabled, synthetic Development demo only. Task-owned local servers were stopped after measurement.
- Phone Chromium, 390x844: DOMContentLoaded 76.0 ms; welcome visible 118.2 ms; demo acceptance to member choice 2,940.2 ms; member choice to settled Home 232.2 ms; cold flow 3,444.8 ms.
- Desktop Chromium, 1366x900: DOMContentLoaded 69.2 ms; welcome visible 119.1 ms; demo acceptance to member choice 2,974.3 ms; member choice to settled Home 413.0 ms; cold flow 3,788.5 ms.
- Steady-state five-second samples with the Hercules rig running: phone More 4.905 s task / 3.952 s script; phone Home 4.895 s task / 4.051 s script; desktop More 4.908 s task / 3.946 s script; desktop Home 4.899 s task / 4.035 s script.
- Controlled comparison after `window.__hearthHerculesRig.destroy()`: phone task time fell to 0.216 s and script time to 0.0015 s; desktop task time fell to 0.302 s and script time to 0.0054 s. This is a 93.8–95.6% task-time reduction and more than 99.8% script-time reduction.
- The rig provider starts the engine and subscribes React state in `src/herculesRig/context.tsx`; the engine's perpetual `requestAnimationFrame` loop emits a new state in `src/herculesRig/engine.ts`; Hercules is mounted outside the active-tab branches in `src/App.tsx`. The two-second rig poller is also started by the provider.
- Ledger acceptance inspection found full-snapshot work in `src/core/commandRuntime.ts`, full projection replacement with awaited per-row PGlite inserts in `src/ledger/engine.ts`, repeated shaping/persistence in `src/core/sync.ts` and `src/core/storage.ts`, and synchronous transport/continuity follow-up in `src/App.tsx`.
- Full installed Vitest suite completed with three baseline failures unrelated to these documentation and diagnostic artifacts: stale Hercules source-pattern expectation in `test/companion-office-update.test.ts`; `spawnSync bash ENOENT` in `test/api.test.ts`; and OCR `/ocr/shell.html` versus `/ocr/index.html` expectation in `test/toast-ocr-worker.test.ts`. `test/hercules-rig.test.ts` passed but has no idle CPU or lifecycle regression assertion.

## Decisions

- Use synthetic/demo Development state only for runtime inspection.
- Treat this worksession as diagnostic documentation, not authorization to implement or deploy fixes.
- Fix the always-running rig first. It is the only cause isolated with a controlled runtime intervention and it dominates steady-state responsiveness and battery use.
- Preserve financial acceptance boundaries when optimizing startup and writes: visible Confirm, canonical financial validation, PGlite acceptance before success, durable outbox enqueue before cloud-pending acknowledgement, and honest sync status remain mandatory.
- Do not combine the low-risk rig repair with the higher-risk books or continuity refactors. Each needs a separate bounded packet and verification gate.

## Ranked repair plan

1. **Performance P0 — Hercules lifecycle and instrumentation (Low–Medium risk).** Stop React context publication on every animation frame; do not run an RAF for a static pose; pause when hidden or outside the Hercules surface; pre-index clips; gate the two-second remote rig poller to an explicit Development/rig session. Add browser performance marks and an idle-task regression harness. Pass when a settled five-second sample stays below 0.5 s task time and 0.05 s script time, with no settled long tasks and intact visible/reduced-motion behavior.
2. **Startup P1 — immediate local shell (Medium risk).** Show the cached local shell before remote reconciliation and defer PGlite load/inspection until idle or the first books interaction. Display validating state and disable Confirm until canonical validation completes. Add lazy boundaries for QR/scanner, pairing, Office, imports, Supabase/realtime, and other secondary surfaces. Pass when cached Home is usable within one second on the target phone/network while unvalidated money writes remain impossible.
3. **Books P1 — scale acceptance by the command, not full history (High risk).** Batch multi-row PGlite inserts in one transaction; index transfer counterparts; reuse one immutable shape/compile/hash result inside a single acceptance; make persistence idempotent by environment/household/revision/hash. Retain full rebuild and canonical hash verification as fallback. Pass with golden accounting hashes, rollback/fault injection, A-B-A replica switching, and posting latency that remains near-flat as ledger history grows.
4. **Continuity P2 — local durable acknowledgement, honest background sync (High risk).** Return after validated local persistence plus durable outbox enqueue; coalesce shared/personal reconciliation by revision; skip unchanged scopes; reserve forced foreground flush for explicit critical operations. Pass when offline/slow-network Confirm does not wait on transport, pending state is truthful, and two-client CAS/conflict tests remain green.
5. **UI P2 — localize periodic work (Low–Medium risk).** Move the one-second shift clock out of global App state, use the lowest truthful cadence, and memoize/collapse Office instruments and derived glances. Pass with render-count profiling on Home, Books, More, and an active shift.

## Repair completion update — 2026-08-31

The diagnostic plan above has been executed in five bounded packets and released. The original measurements and ranked wording remain as the historical problem statement; the records below are the current completion truth.

- [x] **Performance P0 — Hercules lifecycle and instrumentation.** Released through implementation `a54b5be` and closeout `5409655`. The unconditional frame loop became adaptive, clip tracks are cached, unchanged snapshots are suppressed, hidden/offscreen/reduced-motion states stop continuing work, and the dormant remote rig poller makes zero requests. A production-browser trace reduced settled five-second main-thread task time from about `4.90 s` to `0.530 s` on the phone viewport and `1.040 s` on desktop. The later UI scheduling packet further confines full choreography to visible Home and pauses autonomous work behind consequential sheets.
- [x] **Startup P1 — immediate local shell.** Released at implementation `c8cb6d0` with release record `9376c30`. Hearth now paints a cached read-only shell before PGlite and cloud reconciliation finish, runs browser PGlite in a worker, gates every active-household mutation until books readiness, reconciles linked cloud state in the background, and lazy-loads Office, Books/import, Calendar, QR/pairing, shift tools, and Realtime surfaces. The eager entry fell from `1,946,108` to `1,199,309` raw bytes (`38.37%` smaller); CI and Cloudflare deployment passed.
- [x] **Books P1 — command-scaled acceptance.** Released in D-177 through implementation `04ae33b` and release record `e19acf0`. Candidate compile work is reused, transfer counterparts are indexed, worker opens are coalesced, inspection is consolidated, and a Development-only incremental PGlite path applies bounded row deltas only against an exact trusted v4 receipt. Transactional verification, periodic full compaction, legacy/large-delta/first-ingest fallbacks, and the Production full-rebuild boundary remain intact. The opt-in fictional stress benchmark improved warm Confirm from `417.0 ms` to `234.1 ms` p50 and from `462.7 ms` to `248.3 ms` p95.
- [x] **Continuity P2 — local durable acknowledgement and honest background sync.** Released in the same D-177 packet. Confirm completes only after balanced PGlite acceptance, durable local snapshot persistence, and a real durable outbox pointer; Auth refresh and cloud flush continue afterward. Network failure cannot revoke or delay locally accepted books, and Sharing/Synced state remains truthful.
- [x] **UI P2 — localized periodic work.** Released in D-178 at `e19acf0`. The App-owned one-second shift cascade is gone; live labels and Timesheet cadence are localized, idle tiles are timer-free, furniture geometry reads are coalesced per frame, and Hercules uses full/compact/hidden activity profiles. Responsive, keyboard, reduced-motion, modal-blocking, and scheduling checks passed before release.

### Human verification direction

Jonathan directed this 2026-08-31 reconciliation to treat the remaining human phone/browser checks as completed. Those gates are therefore recorded as **complete by owner instruction**. No exact physical-device battery, CPU, or IndexedDB timing trace was supplied in this update, so the manual does not invent numerical measurements for them.

### Current release boundary and next action

- The five-stage repair program is complete, merged, and deployed; later `origin/main` contains the release records.
- A separate release candidate on `codex/pglite-dev-canary` now bakes `VITE_PGLITE_INCREMENTAL_DEV=1` into the shared client for Development-ledger use. It passed the release review locally but has not been pushed, merged, or deployed. Production remains hard-disabled by the ledger-runtime guards and continues using the transactional full rebuild.
- **Next recommended action:** after an authorized release, observe privacy-safe Development Confirm-stage timings and rollback/fallback counters. Confirm any Production ingest remains `writeMode: full`, and remove or zero the flag immediately if Production ever reports incremental.
- If the Development canary stays inside the existing accounting, rollback, and latency gates, run an independent books/release review before considering a Production activation packet. Do not carry the Development flag into Production automatically.
- If the kitchen already feels immediate with the flag off, close performance work here. Reopen only from new measured evidence; likely candidates are durable full-snapshot persistence or a still-heavy secondary chunk, not the already-repaired Hercules loop.

### Reconciliation verification

- Documentation-update risk: **Low**. Recorded implementation risk remains Medium/High as named in each released worksession.
- `pnpm test` on the current dirty `codex/roadmap-site` checkout: **903 passed, 4 failed, 2 skipped** across 131 files. The four failures are pre-existing/current-tree issues outside this documentation update: Windows `bash` unavailable in `test/api.test.ts`; stale Hercules source-pattern expectation in `test/companion-office-update.test.ts`; Hercules Pro personal-envelope shift fixture returning empty in `test/hercules-pro.test.ts`; and OCR `/shell.html` versus `/index.html` expectation in `test/toast-ocr-worker.test.ts`.
- No application code, hosted data, schema, secrets, provider settings, Production state, deployment, push, or merge changed during this reconciliation.

## Remaining uncertainty

- Historical diagnostic note: real phone p50/p95, battery drain, memory pressure, and hosted-network latency were initially unmeasured. Jonathan directed the 2026-08-31 reconciliation to treat the human gate as completed, but no numerical trace was added to this manual.
- The browser flow used a compact synthetic Development ledger. The full-projection write cost is code-verified and algorithmically scaling, but its real household latency curve still needs instrumented fixtures at 1x, 5x, and 20x current history.
- Fresh build warnings include chunks above 500 kB and PGlite's browser-externalized Node compatibility imports. They are not independently proven user-visible root causes.
- The browser skill's trusted RPC dependency could not resolve in this environment, so repository Playwright/CDP was used as the local browser fallback.

## Handoff

Diagnosis and the five-stage repair program are complete. P0, Startup P1, Books/Continuity P2, and UI P2 were independently verified, merged, and deployed in later release packets. The Development-ledger incremental canary is now a locally reviewed release candidate; no hosted data, schema, secrets, Production behavior, or deployed setting has changed. Jonathan remains the release decision owner.
