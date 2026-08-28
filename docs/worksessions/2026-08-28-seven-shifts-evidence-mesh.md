# Hearth worksession — 7shifts evidence mesh and automation

- **Status:** INERT DEVELOPMENT VAULT DEPLOYED; ALL ACTIVATION FLAGS OFF
- **Opened:** 2026-08-28 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `dual-ai-budget-app`
- **Branch:** `codex/7shifts-evidence-mesh`
- **Baseline SHA:** `9cc1f67` (current `origin/main` after live roadmap museum reconciliation)
- **Head SHA:** `9cc1f67` plus the local dirty packet
- **PR or issue:** none
- **Risk:** Release
- **Decision owner:** Jonathan
- **Environment impact:** Development code and inert infrastructure definitions only

## Household outcome

Hearth can retain and reconcile the 7shifts evidence an employee can deliberately capture from their own authorized account, while keeping each fact attributable and routing any enabled automatic posting through Hearth's ordinary work calculations, double-entry acceptance, and hosted command identity.

## Budget delta (5)

`+5` — provider evidence becomes a provenance-complete input to work accruals, replay-safe corrections, payroll-week overtime recalculation, and exact balanced reversals.

## Engagement delta (3)

`+3` — browser, phone, file, calendar, email, and OCR capture converge in a visible Evidence Center with source health, conflicts, automation state, and receipts.

## Verified baseline

- The branch opened at `f02fd4b`; while implementation was in progress, `origin/main` advanced through `820f164` to `158e2b9` with Toast OCR commits. The branch was safely fast-forwarded twice; Evidence and Toast OCR overlap was reconciled and jointly retested.
- D-155 already supplies a Development-only native 7shifts connector and Timesheet inbox.
- The stale draft D-156/D-157 worktree is based on `891cc5d` and will not be merged or cherry-picked wholesale. Current-main reconciliation assigns D-156 to Wide Home and D-157 to the roadmap museum, so this packet is now D-158/D-159.
- Supabase Migration 013 supplies the authenticated, membership-bound, advisory-locked, idempotent command append/CAS boundary. This worksession will not apply or change hosted Supabase schema.
- Jonathan approved dedicated Development D1/R2/Queue/DLQ provisioning, one Evidence encryption key, the Evidence D1 migration, and an inert deploy with all activation flags off. Production, email routing activation, extension distribution, TestFlight, and real household data remain outside this packet.

## Scope

### In scope

- Unified evidence contracts, validation, command identity, and replay facts.
- Legacy dual-evidence rejection; Hercules read scoping; cancellable private calendar reads.
- An inert Development Evidence Worker contract using dedicated D1/R2/Queue bindings and local schema/tests.
- Browser extension and iPhone companion source scaffolds with explicit authorized capture boundaries.
- Evidence Center UI, automation policy/job state, deterministic command keys, and correction primitives.
- Living decisions, architecture, roadmap, and complete local verification.

### Out of scope

- Push, PR creation, merge, email-domain activation, store/TestFlight publication, Production, or meaningful household data.
- Password, cookie, bearer-token, or unauthorized-account capture.
- Model or Hercules command authority.

## Acceptance evidence

- [x] Exact legacy dual-evidence payloads fail at `postWorkShift`.
- [x] Multi-source bundles validate one exact member/job/shift and enter all material facts into command/PGlite identity.
- [x] Hercules cannot read partner Personal shift or evidence facts.
- [x] Calendar requests abort on member, household, environment, URL, and unmount changes.
- [x] Evidence Worker routes are disabled by default and enforce exact authenticated membership in local tests.
- [x] Raw-object encryption metadata binds the complete scope tuple; Queue messages contain opaque IDs only.
- [x] Deterministic Queue extraction handles official JSON/CSV, ICS outlook, timesheet/tip report text, bounded MIME/attachments, independent local/cloud screen facts, and schema drift without granting money authority.
- [x] Enabled deterministic automation remains fail-closed on conflict and uses ordinary work calculation/acceptance.
- [x] Corrections preserve exact reversals and payroll-week overtime meaning.
- [x] Focused tests, TypeScript, AI verification, production build, Worker dry run, and diff check pass. The final full suite is 1015 passed / 2 skipped / 2 unchanged-baseline failures, so the aggregate `pnpm check` is not represented as green.
- [x] Development D1, Queue, DLQ, and both Evidence migrations are live and empty.
- [x] R2 safety guard is proven at 1 GiB stored / 10k puts / 100k gets monthly.
- [x] R2 subscription and private bucket, encryption secret, and inert deployment completed; live status proves every activation flag remains off.

## Plan

- [x] Reconcile current-main command, work, visibility, Worker, and UI seams.
- [x] Implement contracts and critical review fixes.
- [x] Implement inert Evidence Worker and client.
- [x] Implement deterministic extraction and the owner-only extracted-facts review route/UI.
- [x] Implement capture companion scaffolds and Evidence Center.
- [x] Implement automation and correction primitives.
- [x] Update living canon and complete independent verification.

## Evidence log

- 2026-08-28: `git fetch origin main --prune` succeeded; `origin/main=f02fd4b560d56d29d7863e4e39e9176b76de56f6`.
- 2026-08-28: clean worktree created at `Budget App - 7shifts Evidence` on `codex/7shifts-evidence-mesh`.
- 2026-08-28: Supabase changelog reviewed. No relevant breaking change alters the existing authenticated command-RPC plan; new Data API tables would require explicit exposure, but no hosted Supabase table is being added in this packet.
- 2026-08-28: `origin/main` advanced to `820f164`; the branch fast-forwarded and the complete local packet reapplied without conflict. Toast OCR plus Evidence focused suites passed together.
- 2026-08-28: `origin/main` advanced through `158e2b9`, `eb7a773`, `fd7fff5`, `d067e56`, `455f1ab`, and finally `9cc1f67`; the branch was preserved and fast-forwarded each time. The final replay preserved main's Wide Office, live roadmap museum, and disabled-queue acknowledgement behavior while renumbering this packet to D-158/D-159.
- 2026-08-28: deterministic extraction added official-shape JSON/CSV, ICS, employee report text, bounded MIME/attachments, independent local/cloud screen comparison, separate schema-drift retention, and an owner-only normalized review route/UI. Raw PDF/images remain encrypted until an independently selected OCR/vision result is supplied; the Queue does not call a model.
- 2026-08-28: D1 schema executed successfully in `node:sqlite`, including canonical-shift-scoped derivative/observation queries.
- 2026-08-28: fault injection proved hosted r1 command receipt recovery after lost Worker acknowledgement, followed by correct r2 payroll-week reclassification.
- 2026-08-28: the initial feature-focused verification passed 25 files / 136 tests, including D-155, the draft D-156/D-157 packet, OCR, calendar, Hercules, work, migration, and Evidence Worker coverage.
- 2026-08-28: the final current-main full repository suite completed at 1015 passed / 2 skipped / 2 failed. `test/api.test.ts` is the unchanged Windows child-Python launcher failure and `test/companion-office-update.test.ts` is the unchanged source-shape assertion; neither failing test nor `src/Hercules.tsx` differs from the packet baseline.
- 2026-08-28: after the final runtime replay, `pnpm exec tsc --noEmit`, `pnpm ai:verify`, `pnpm build`, the 17-file / 97-test roadmap + Toast OCR + Evidence/accounting/Hercules focus, the dedicated disabled-queue regression, Wrangler dry run, and `git diff --check 9cc1f67` passed. The final `9cc1f67` advance changed release-record docs only.
- 2026-08-28: `wrangler whoami` reported no authenticated account. The normal OAuth login flow was opened and timed out waiting for authorization. No resource, binding, secret, migration, or deployment mutation occurred; a signed-in rerun is required.
- 2026-08-28: Wrangler OAuth later succeeded for account `7dfdfbba3053d8b857cbc359e0761c00`. Created Development D1 `hearth-evidence-development` (`ed0134e4-c0fe-46b0-a22b-af7c5fe20de5`), Queue `hearth-evidence-derive-development`, and DLQ `hearth-evidence-derive-dlq-development`.
- 2026-08-28: applied `0001_evidence_mesh.sql` and `0002_r2_budget_guard.sql` remotely. D1 verified 16 Evidence domain tables plus zero captures/bundles/jobs, zero stored bytes/objects, and no monthly R2 operations; Wrangler reports no migrations pending.
- 2026-08-28: Jonathan completed Cloudflare's owner-only R2 checkout. Created private R2 `hearth-evidence-raw-development` in ENAM/Standard; it has zero objects/bytes, no public development URL, and no custom domain.
- 2026-08-28: generated a random 64-byte `EVIDENCE_KEK_V1` directly into Wrangler without printing or writing it to the repository. `wrangler secret list` confirms only its name/type.
- 2026-08-28: deployed the inert Worker, attached the key, reconciled the packet to the latest main, rebuilt, and deployed the exact reconciled artifact. Current version `043d8324-998e-46f3-9a6d-16d2f2aee0d7` is 100%. Live Evidence and 7shifts status routes both report unavailable/disabled, Development-only, and Production refused; all five activation flags remain false.
- 2026-08-28: three independent books, privacy, and Worker/UI reviews reported no open P0, P1, or P2 findings after provenance, revision-race, settlement, migration, calendar, iOS-header, and acknowledgement-recovery fixes.

## Decisions

- D-158 and D-159 are rebuilt on current main. Useful behavior was manually reimplemented from the stale draft D-156/D-157 worktree, but its diff is not authoritative.
- Maximum capture means complete authorized raw evidence in a dedicated encrypted vault; normalized books/model surfaces remain bounded and attributable.
- Automatic posting is opt-in per member/job, deterministic, and never model-triggered.

## Remaining uncertainty

- Native iPhone compilation and physical-device proof require macOS/Xcode and Apple signing; this Windows packet can provide source, project definition, fixtures, and CI configuration but cannot claim device proof.
- Email routing, real Development evidence, automation activation, macOS/iPhone proof, push, merge, and Production still require their separate gates.

## Handoff

Local implementation, proof, and the approved inert Development infrastructure gate are complete. The exact packet is staged but uncommitted on `codex/7shifts-evidence-mesh`. Nothing was pushed, merged, activated for capture/automation, or applied to Production. Jonathan remains the decision owner for each later release gate.
