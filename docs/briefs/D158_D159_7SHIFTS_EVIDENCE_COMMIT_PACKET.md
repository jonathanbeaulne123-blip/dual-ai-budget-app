# D-158/D-159 7shifts Evidence commit and PR packet

## Decision

- **Branch:** `codex/7shifts-evidence-mesh`
- **Exact base:** `4a7ea7e18468caee8c1c6efac8750af98d03011a`
- **Risk:** Release
- **Budget delta (5):** `+5`
- **Engagement delta (3):** `+3`
- **Recommended commit title:** `Add encrypted 7shifts evidence mesh and deterministic reconciliation`
- **Push/merge/deploy:** Jonathan authorized PR #231 push and merge on 2026-08-28. The automatic `main` deployment must remain inert; Production and capture/automation activation are prohibited.

Main assigns D-156 to Wide Home and D-157 to the roadmap museum. The stale evidence draft's useful behavior was manually rebuilt and renumbered as D-158 (Evidence Mesh) and D-159 (opt-in deterministic work authority); no stale-packet cherry-pick is part of this change.

## What changes

1. Adds one versioned, canonical 7shifts evidence bundle to Shift commands and rejects every legacy dual-evidence combination at the command boundary.
2. Covers the complete bundle in command identity, financial audit facts, replay/material-drift checks, balanced correction checks, and PGlite integrity facts.
3. Internally hard-binds Hercules shift/tip reads to the requesting member while retaining that member's legitimate legacy Personal rows; raw/source evidence is stripped.
4. Adds cancellable, exact-member private calendar handling and an owner-visible Shift Evidence Center.
5. Adds a separate Development Evidence Worker contract, D1 migration, private-R2 envelope encryption, opaque Queue messages, cryptographic deletion, and exact membership/ownership checks.
6. Adds deterministic extraction for official JSON/CSV, ICS, timesheet/tip report text, MIME/attachments, independent local/cloud screen results, conflicts, and separately retained unknown schema fields.
7. Adds explicit Chromium and iPhone companion scaffolds without password/cookie/token/background mailbox authority.
8. Adds off-by-default, member/job-scoped automation receipts plus payroll-week correction planning through the ordinary Hearth work compiler, PGlite acceptance, and authenticated command log.

## Proof

- Current-main reconciliation: the branch merged `origin/main@4a7ea7e`; the shared Worker entrypoint retains Toast OCR, the live roadmap/museum, disabled-queue acknowledgement, and Evidence handlers. Reconciliation also replaced Toast OCR learning's wildcard CORS with exact Hearth/preview/local origin checks.
- Focused current-main proof: 16 files / 93 tests passed, including Toast OCR, vault/capability/email/extension/iOS/migration/extraction, automation, calendar, work, visibility, Hercules, document scan, and Evidence UI; the dedicated disabled-queue and Worker CORS assertions also passed separately.
- Full repository: 1018 passed / 2 skipped / 2 failed. The two failures are baseline-only: Windows `spawnSync bash ENOENT` in `test/api.test.ts` and the unchanged Companion Office source-shape assertion. Neither failure is caused by D-158/D-159.
- `pnpm exec tsc --noEmit`: passed.
- `pnpm ai:verify`: passed.
- `pnpm build`: passed.
- `wrangler deploy --dry-run --assets=./dist`: passed with the exact Development D1/R2/Queue bindings and all activation flags false.
- `git diff --check 4a7ea7e...`: passed.
- The Evidence migration executes in `node:sqlite`, including the exact canonical-shift observation query and separate schema-drift table.
- Native iOS XCTest/device signing remains a macOS/TestFlight gate; Windows tests prove source contract and required upload headers only.

## Infrastructure gate

Approved inert Development resources:

- D1 `hearth-evidence-development` as `EVIDENCE_DB`
- private R2 `hearth-evidence-raw-development` as `EVIDENCE_RAW`
- Queue `hearth-evidence-derive-development` as `EVIDENCE_DERIVE`
- DLQ `hearth-evidence-derive-dlq-development`
- Worker secret `EVIDENCE_KEK_V1`
- migration `migrations/evidence/0001_evidence_mesh.sql`

Provisioning must not be represented as complete until Wrangler authentication succeeds and each created resource, migration, secret, and deployed version is recorded here. The deployed flags must remain exactly:

- `EVIDENCE_ENABLED=false`
- `EVIDENCE_ALLOW_PRODUCTION=false`
- `EVIDENCE_EMAIL_ENABLED=false`
- `SEVENSHIFTS_ENABLED=false`
- `SEVENSHIFTS_ALLOW_PRODUCTION=false`

**Current result:** Complete for the inert Development gate. Wrangler authentication succeeded. D1 `hearth-evidence-development` (`ed0134e4-c0fe-46b0-a22b-af7c5fe20de5`), private R2 `hearth-evidence-raw-development`, Queue `hearth-evidence-derive-development`, and DLQ `hearth-evidence-derive-dlq-development` exist. Migrations `0001` and `0002` are applied. `EVIDENCE_KEK_V1` exists as a Worker secret. Deployed version `043d8324-998e-46f3-9a6d-16d2f2aee0d7` contains the runtime artifact reconciled through `origin/main@9cc1f67`, is 100%, and inert. D1/R2 counters are zero, the bucket has no public URL or custom domain, and every flag above remains false.

## PR body

### Household outcome

Members can deliberately retain authorized 7shifts files, calendars, reports, messages, and independently extracted screenshots in an encrypted personal evidence vault, inspect normalized facts and unknown fields, and—only after a separate exact job opt-in—route eligible, unconflicted evidence through Hearth's ordinary books and correction machinery.

### Safety boundaries

Raw bytes and source metadata stay outside household snapshots, PGlite, command events, Hercules, and generic model payloads. Calendar/email/schedule/model facts never establish worked money. Missing values remain absent. Automation and Production are hard-off by default. No password, cookie, session-token, broad-tab, mailbox, or coworker-roster scraping is introduced.

### Release gates still open

Complete synthetic Development vault smoke with automation off; separately approve extension/email/iPhone distribution, real evidence, one-job automation, and every Production step.
