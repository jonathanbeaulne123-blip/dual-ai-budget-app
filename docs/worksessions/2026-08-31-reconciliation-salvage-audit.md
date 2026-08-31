# Hearth worksession — Reconciliation salvage audit

- **Status:** CLOSED
- **Opened:** 2026-08-31 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/reconciliation-salvage-audit`
- **Baseline SHA:** `e19acf09c35c26bda1dba9d01e4806a315e223ab`
- **Head SHA:** `7fcb9bba4f12c760393709d6d9c6d92a6d5c689b` (pre-cleanup evidence; final cleanup record follows)
- **PR or issue:** none
- **Risk:** High
- **Decision owner:** Jonathan for removal of any feature or user-facing behavior; Codex for duplicate/generated/stale implementation classification
- **Environment impact:** none

## Household outcome

Jonathan and Bianca keep every current, trustworthy import and reconciliation capability while the 379-commit-stale dirty checkout stops being an ambiguous second source of product behavior.

## Budget delta (5)

`+1` — reconciliation and intake trust improve because unique work is identified against current money law, while shipped or unsafe duplicates are prevented from re-entering the command boundary.

## Engagement delta (3)

`0` — this is repository hygiene and financial-trust work. No visible interaction should change unless a genuinely missing, reviewed feature is deliberately salvaged.

## Verified baseline

- `origin/main` and the isolated branch start at `e19acf09c35c26bda1dba9d01e4806a315e223ab`.
- The source checkout `codex/import-reconciliation-engine` is at `f9e8170876b2faa233c4be0d838801b156f15645`, 379 commits behind current `origin/main`, with 77 dirty files represented by 76 porcelain-status entries.
- Current canon already contains D-130 selected intake and D-141 exact statement/receipt reconciliation.
- At audit time no source file had been removed; after Jonathan's explicit confirmation, the complete dirty checkout and its exact worktree metadata were moved to Trash.

## Scope

### In scope

- Classify all 77 dirty files represented by 76 porcelain-status entries against current `origin/main`.
- Distinguish shipped/superseded copies, generated artifacts, documentation history, tests, and genuinely unique behavior.
- Salvage only valuable unique behavior into this current-main worktree.
- Ask Jonathan before removing any feature or user-facing behavior.

### Out of scope

- Production, deployment, hosted schema/data, secrets, provider activation, or household data.
- Wholesale merge, rebase, or commit of the stale checkout.
- Deleting the stale worktree before classification and any required user confirmation.

## Acceptance evidence

- [x] Every dirty file has a recorded classification and evidence.
- [x] Unique import/reconciliation behavior is either preserved on current main or presented for an explicit decision.
- [x] Current D-130/D-141 command, privacy, environment, and Confirm boundaries remain green.
- [x] No feature or user-facing behavior is removed without Jonathan's confirmation.
- [x] Source checkout status remained recoverable until approved cleanup and is now recoverable from Trash.

## Plan

- [x] Inventory paths and semantic feature clusters.
- [x] Compare each cluster with current code, decisions, tests, and shipped history.
- [x] Port the smallest valuable unique slices, if any.
- [x] Run focused and repository verification.
- [x] Present removal decisions, receive Jonathan's confirmation, and close the stale checkout.

## Evidence log

- 2026-08-31: created clean worktree from `origin/main@e19acf0`; dirty source left untouched.
- 2026-08-31: current history proves D-137 reconciliation was merged as PR #134, secure Development Flinks as D-148, wide office as D-156, and current kitchen notes as D-164. The dirty checkout is several later Aug 25-26 slices layered on the already-merged reconciliation branch, not one unfinished reconciliation feature.
- 2026-08-31: selectively ported the still-missing Google prompt/session containment onto current `main`, preserving the later Supabase `session_id` device-revocation contract. Focused Google/Auth proof passes 64 tests across 8 files; TypeScript passes.
- 2026-08-31: focused import/reconciliation/privacy proof passes 39 tests across 6 files. Production build passes with the repository's existing PGlite externalization/eval and large-chunk warnings.
- 2026-08-31: full repository run reached 1,264 passed, 3 failed, and 3 skipped tests across 192 files. Two failures are environment-only writes to the hard-coded unwritable `/opt/cursor/artifacts`; the third was the existing 15-second whole-suite timeout in the large stress projection. Its isolated rerun passed in 11.46 seconds. No salvaged Google/Auth/import test failed. Vitest also reported one worker RPC timeout after the long run.
- 2026-08-31: Jonathan explicitly confirmed removal after receiving the exhaustive disposition and the list of user-facing superseded surfaces.
- 2026-08-31: moved the dirty checkout to `/Users/jonathanbeaulne/.Trash/dual-ai-budget-app-reconciliation-2026-08-31`, moved only its worktree metadata to `/Users/jonathanbeaulne/.Trash/git-worktree-metadata-dual-ai-budget-app-reconciliation-2026-08-31`, and deleted the already-merged local branch `codex/import-reconciliation-engine` at `f9e8170`. The salvage worktree remains registered, clean, and on `codex/reconciliation-salvage-audit`.

## Exhaustive dirty-file disposition

The lists below account for all 77 dirty files. Files in the first group were selectively ported; only the named containment behavior was retained from multi-purpose files. The superseded source checkout was moved to Trash only after explicit confirmation.

### Keep — selectively ported onto current main (24)

Google and Supabase prompt/session containment remains valid: background work cannot launch account UI; direct-suite tokens are environment/household/member scoped; identical prompts and refreshes share one flight; conflicting prompts are refused; GIS and full prompts time out; failed GIS scripts retry; sign-out cannot be undone by a late callback; and delayed UI work is rejected after A to B, A to B to A, or unmount.

`docs/GOOGLE.md`, `docs/worksessions/2026-08-26-google-auth-popup-loop.md`, `src/App.tsx`, `src/BatchImport.tsx`, `src/Calendar.tsx`, `src/GoogleBridge.tsx`, `src/Office.tsx`, `src/SitDownGuide.tsx`, `src/asyncScope.ts`, `src/auth/supabaseSession.ts`, `src/calendar/google.ts`, `src/google/desk.ts`, `src/google/drive.ts`, `src/google/engine.ts`, `src/google/index.ts`, `src/google/stepUp.ts`, `src/google/tokens.ts`, `test/almost-there.test.ts`, `test/drive-receipts.test.ts`, `test/google-bridge-scope.test.ts`, `test/google-gis.test.ts`, `test/google.test.ts`, `test/sitdown.test.ts`, `test/supabase-auth-session.test.ts`.

The old worksession's evidence was absorbed here rather than copied with a misleading stale baseline. The remainder of each mixed file is covered by the superseded groups below.

### Go — living-canon and generated roadmap copies superseded (12)

Current `AGENTS.md`, decisions, architecture, handoff, roadmap, strategy, and the shipped public roadmap museum are newer and authoritative. The untracked HTML is a generated historical snapshot, not source authority.

`AGENTS.md`, `docs/AI_HANDOFF.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/HEARTH_ROADMAP.md`, `docs/README.md`, `docs/SEPTEMBER_UPDATE.md`, `docs/STRATEGY.md`, `docs/artifacts/README.md`, `docs/artifacts/hearth-roadmap.html`, `docs/briefs/CLAUDE_HEARTH_ROADMAP_ARTIFACT.md`, `docs/worksessions/2026-08-25-september-update-roadmap.md`.

### Go — Flinks/import and Worker configuration already shipped in stronger form (21)

Current main contains the reviewed D-130/D-141 import path, D-148 secure Development Flinks flow, account-scoped identity, active-member/JWT checks, current Worker routing, and later 7shifts import extensions. Two stale files are byte-identical to current main; the rest are older or conflict with later free-first provider and deployment policy.

`docs/BATCH_IMPORTS.md`, `docs/briefs/CURSOR_FLINKS_CONNECT_RECOVERY.md`, `docs/worksessions/2026-08-26-flinks-connect-sandbox.md`, `docs/worksessions/2026-08-26-flinks-development-scaffold.md`, `migrations/flinks/0001_connections.sql`, `src/FlinksConnectPanel.tsx`, `src/core/importInbox/flinks.ts`, `src/core/importInbox/index.ts`, `src/core/importInbox/types.ts`, `src/imports/flinksClient.ts`, `test/batch-import-ui.test.ts`, `test/document-scan-worker.test.ts`, `test/flinks-active-worker.test.ts`, `test/flinks-client.test.ts`, `test/flinks-connect-ui.test.ts`, `test/flinks-worker.test.ts`, `test/import-flinks.test.ts`, `vite.config.ts`, `workers/flinks.js`, `workers/site.js`, `wrangler.jsonc`.

### Go — Hercules/office concept superseded by current product (20)

Current main has the later D-156 wide paper office, D-164 kitchen notes and charts, D-165 ledger floors, and adaptive Hercules rig. The stale full-screen room and cat-mom image are an older alternate UI. The stale provider-order test requires paid OpenAI before free Workers AI, which contradicts current free-first policy and must not be revived.

`docs/HERCULES.md`, `docs/HERCULES_AI.md`, `docs/HERCULES_PRO.md`, `docs/worksessions/2026-08-26-hercules-desktop-office-room.md`, `docs/worksessions/2026-08-26-hercules-full-screen-conversation.md`, `docs/worksessions/2026-08-26-hercules-mobile-functionality.md`, `docs/worksessions/2026-08-26-hercules-openai-first.md`, `public/hercules-office-cat-mom.jpg`, `src/Hercules.tsx`, `src/HerculesOfficeRoom.tsx`, `src/HerculesPro.tsx`, `src/core/herculesChat.ts`, `src/core/herculesPlanner.ts`, `src/core/officeFacts.ts`, `src/styles.css`, `test/hercules-living-teacher.test.ts`, `test/hercules-pro.test.ts`, `test/hercules-provider-order.test.ts`, `test/hercules-tools.test.ts`, `test/office-widgets.test.ts`.

## Decisions

- Do not cherry-pick or merge the stale branch wholesale.
- Absence from current `main` is not enough to justify salvage; behavior must still match current D-130/D-141/D-173/D-174 law.
- Preserve current free-first Hercules provider policy; do not revive the stale OpenAI-first experiment.
- Preserve current office, Flinks, 7shifts, accepted-books import, `session_id`, and device-revocation behavior while porting only the missing containment slice.

## Removal confirmation

Jonathan confirmed removal after reviewing the older Hercules full-screen office and image, OpenAI-first provider order, Flinks scaffold, and older Google/Calendar/desk surfaces. The checkout and its exact metadata are in Trash for recoverability; the stale local branch is deleted.

## Handoff

The audit, salvage, and confirmed local cleanup are complete. No push, merge, deployment, schema, hosted data, secrets, or Production state changed. Jonathan still owns any later push, PR, merge, or deployment decision for `codex/reconciliation-salvage-audit`.
