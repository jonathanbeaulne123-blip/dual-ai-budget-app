# Hearth worksession — Hercules Workspace

- **Status:** Local implementation and verification complete. Release/activation acceptance remains open and is not authorized by this implementation session.
- **Opened:** 2026-09-12 (America/Toronto)
- **Owner / decision owner:** Jonathan
- **Assignee:** Codex, one writer; independent read-only runtime and interface auditors
- **Repository:** dual-ai-budget-app
- **Branch:** codex/hercules-workspace
- **Baseline / initial HEAD:** 02a5539dfc4dfadf6c7cae67b98f17db278c9eaa (verified origin/main)
- **Risk:** High
- **Environment impact:** local implementation; hosted schema, infrastructure creation, provider disclosure activation and deployment require separate Release authorization.

## Household outcome

Implement Jonathan's accepted Hercules Workspace plan: a broad Gemini Flash collaborator for household life, work, research, creation and learning. Persistent private life projects contain conversation, working artifacts, decisions, sources and tasks; the dedicated room and compact conversation share durable progress. Monthly Plans retain financial commitments, Kitty Banks retain backing, and Books retain accepted activity.

## Budget delta (5)

Connect intentions to fresh, scoped authoritative facts and reviewed existing commands without duplicating resources, financial digests or money writers. Private and shared evidence remain distinguishable.

## Engagement delta (3)

Natural steering, enduring work, useful artifacts and resumable background runs replace the rigid primary questionnaire. All three visual worlds and phone/desktop compositions remain in scope.

## Implementation order

1. Versioned contracts, private workspace authority, pure ledger queries, provider policy and revocable background grants.
2. Flash-only iterative tools, budgets, durable execution, instruction revisions, recovery and context retrieval.
3. Dedicated room, compact continuity, projects, attachments, editing and artifact versions.
4. Stable links to monthly Plans, Kitty Banks, Calendar and boards; exact existing action reviews and receipts.
5. Research, analysis, document/learning workflows, sandbox exports, reviewed Google operations and opt-in follow-up.
6. Focused accounting/privacy/recovery/App gates; themed browser evidence; comparative runner. Live provider, authenticated continuity and physical-device proof remain separately classified.

## Implemented behavior and acceptance classification

| Accepted outcome | Local evidence | Remaining acceptance |
|---|---|---|
| Natural pivot, correction and evolving project | Versioned intent/decision/artifact contracts; steering supersedes older runs; optional existing guide; editable project and artifact surfaces | Live Flash dialogue quality, including the complete date-with-Bianca scenario |
| Research, documents and learning | Tool registry, reviewed public queries, sandbox adapters, synthetic comparative runner; DOCX/XLSX/PPTX/PDF renderers produce files that reopen successfully | Live research/learning completion, real container execution and Office application rendering |
| Personal and Household implications | Actual LedgerRoom pure query compares ten durable tables before/after; scoped deterministic Plan projections and deduplicated linked records; member isolation tests | Hosted authenticated two-person scope proof |
| Close/reopen, concurrent edits and recovery | Actual local Agent/Workflow/R2 restart restores history and file bodies; interruption retry/resume, generation fencing and per-project edit recovery | Hosted continuity and physical-device handoff |
| Revocation, expiry, duplicate and uncertain delivery | Actual grant migration applied only in local PGlite; session/membership/RLS checks; bounded leases; new-grant continuation; immutable Google/action identities | Hosted session revocation and live Google receipt behavior |
| Deliberate sharing | Separate shared-copy Agent, exact reviewed content and digest, no private graph; cross-member private isolation | Authenticated two-member disclosure UX |
| Compatible conversations, claims and receipts | Existing private-chat/action/App regressions; optional version-1 workspace confirmation field; receipt recovery before mutation | Old strict clients cannot be certified for new workspace-derived drafts; compatible readers must remain during rollback |
| Three themes and phone/desktop | Actual themed component browser matrix, manual edits, offline retention, compact expansion and keyboard focus | Physical keyboard, VoiceOver, real browser zoom and full-App scene acceptance |

The implementation is feature-gated. Local evidence does not close the Release acceptance column.

## Evidence log

Baseline was clean. The isolated worktree was created from the verified origin/main SHA above; the shared detached deployment checkout was left untouched. No hosted changes were made.

- **Final High focused gate: passed**, 493 tests across 45 files, root TypeScript, AI-surface and diff checks, **102.143 seconds**, no five-minute breach. Source fingerprint: `79426513a19e5793885de9373bb7e7cff5781605a071c89f33504712385feaf4`; baseline/head during verification was `02a5539d`, with the implementation uncommitted. Only final evidence documentation changed after that run. Log: `/tmp/hercules-handoff-gate.txt`. The preceding 93.891-second run also passed; the final run includes the SDK binding corrections and build-script change.
- **Actual local runtime: 12/12 passed** using Agent SQLite, LedgerRoom, R2 and Workflows, with only Flash mocked and outbound network blocked. Includes pure reads, durable artifacts, duplicate commands, member isolation, late result fencing, stale review rejection, restart, scheduled cancellation, interrupted dispatch recovery and renewed-grant continuations. Timestamped source hashes and results: `/tmp/hearth-workspace-proof-ylcCnh/results.json`.
- **New authority/provider regressions: 4/4 passed**, then included in the final High gate. Complete provider input counting must reserve the budget before generation; a compound command cannot create a workspace claim and execute it while bypassing proposal authorization.
- **Exports: all four formats passed** using the exact shipped Python renderer scripts. DOCX, XLSX and PPTX reopen and accept a further edit; PDF text extracts successfully. These run against local Python libraries, not the unavailable Docker container.
- **Final browser matrix: 36/36 passed**, Classic/Taylor/Newfoundland × Personal/Household × 320/390/720/1100/1440/1920 px, with no page errors, horizontal overflow or scoped Axe violations. Manual artifact edit/reopen, offline composer retention, compact expansion and keyboard focus checks passed. The last 320 px tab overflow was repaired before this run. Representative phone and desktop screenshots were visually inspected. Log: `/tmp/hercules-browser-complete.txt`; report and screenshots: `/tmp/hearth-workspace-browser/`.
- **Comparative evaluation dry run: passed**, listing synthetic cases without any provider call. Completion, correction effort, evidence quality, latency and cost superiority remain unmeasured until live comparison and human scoring.
- An earlier High gate passed 489 tests but took **543.7 seconds**, exceeding the five-minute target; TypeScript took 448.6 seconds under concurrent machine load. The final sequential run above replaces its source evidence and meets the target.
- **Standalone Worker TypeScript: passed** after resolving imported-versus-ambient Cloudflare RPC namespace incompatibility. Binding types now come directly from the Agents/Sandbox helper signatures; no runtime behavior or permission changed. The first check exhausted Node's default 2 GiB heap, and the larger-heap attempt exposed the incompatible types. The corrected compiler run exits zero; log: `/tmp/hercules-worker-types-sdk-final.txt`. `pnpm typecheck:workspace` now runs as part of `pnpm build`, so future builds check this separate Worker compilation target.
- **Production build: passed**, including root TypeScript, the separate Worker compiler, Vite and Hercules Pro UI, with the existing large-chunk warning. Vite completed in 9.35 seconds; log: `/tmp/hercules-build-complete.txt`.
- **Worker bundling dry run: passed** with `--containers-rollout=none`, **6,590.85 KiB raw / 1,257.51 KiB gzip**; log: `/tmp/hercules-worker-bundle-complete.txt`. Verify account bundle limits during Release. This creates no hosted resources. The full container dry run remains blocked because the Docker CLI is unavailable; no Sandbox image build or real container execution is claimed.

## Independent review

Two bounded read-only auditors reviewed runtime/authority and UI/privacy/recovery while Codex remained the sole writer. Findings repaired and covered by regression evidence include compound-command admission, cancelled scheduled continuations, late project-switch updates, repeated Plan launches, immutable cross-device Google submissions, stale external reviews and validation failures that previously froze a review. No hosted or real-provider claims were inferred from their synthetic proofs.

## Decisions

Separate storage and execution gates allow compatible deployment before activation. Model output can create private material and proposals; it cannot authorize commands, disclosure or external writes. Source-based baseline findings were verified against current code. No fallback provider is introduced into the workspace.

## Remaining uncertainty

Live Flash model evaluation, authenticated cross-device and physical phone proof require their actual environments. A local test or a configured binding is not activation evidence.

## Handoff

Implementation and reproducible commands are in [the workspace architecture](../HERCULES_WORKSPACE.md). The next contributor should use [the Release handoff](../briefs/HERCULES_WORKSPACE_HANDOFF.md), verify this branch against any newer main, and retain all private-work and receipt recovery readers. Jonathan owns any subsequent Release authorization.
