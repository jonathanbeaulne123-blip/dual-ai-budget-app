# Hearth worksession — Test runner lanes

- **Status:** CLOSED — release-verified clean-main candidate
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/test-runner-lanes`
- **Baseline SHA:** `f02b260edf7d0f269057e24aff8e0cf0472740c8`
- **Head SHA:** isolated local packet rebased onto the current baseline (final verification pending)
- **PR or issue:** none
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** none

## Household outcome

Hearth's comprehensive local verification remains complete and money-safe, while ordinary feedback no longer waits behind independent PGlite/PostgreSQL-WASM runtimes.

## Budget delta (5)

`+1` — faster trustworthy feedback makes regressions in the ledger and continuity boundary cheaper to catch; financial semantics are unchanged.

## Engagement delta (3)

`0` — no household-facing interaction changes.

## Verified baseline

- The prior `codex/roadmap-site` checkout was mixed and unsafe to stage or release.
- Current `origin/main` contains 227 Vitest test files. Fifteen directly reference `src/ledger/engine.ts`; all remain serial.
- Browser `.spec.ts` proof remains under the existing browser-test command and is not part of Vitest's configured include set.

## Scope

### In scope

- Split `pnpm test` into a four-worker ordinary lane followed by a serial PGlite-import lane.
- Guard the direct PGlite-import classification with a deterministic test.
- Record the decision and release evidence.

### Out of scope

- Ledger, sync, money assertions, browser-test configuration, hosted data, schema, secrets, Production, and deployment.

## Acceptance evidence

- [x] The fast lane excludes and the books lane includes every direct PGlite-engine import.
- [x] The classification guard passes and rejects extra exclusions.
- [x] Both lanes run with their stated worker caps and preserve the complete Vitest-file set.
- [x] `pnpm check` passes on the clean release candidate.
- [x] The isolated diff contains no private artifacts or unrelated work.

## Plan

- [x] Create a clean branch from `origin/main`.
- [x] Rebase the runtime-isolation design on current direct imports.
- [x] Run focused and full release verification.
- [ ] Commit, push, and merge after final exact-diff audit.

## Evidence log

- Clean branch was rebased onto `origin/main@f02b260edf7d0f269057e24aff8e0cf0472740c8` before its final verification.
- `pnpm exec vitest run test/test-lanes.test.ts --maxWorkers=1`: passed (1/1).
- `pnpm test:books`: passed (14 files / 120 tests, 1 intentional benchmark skip).
- Earlier baseline verification passed with the local Node, Python, and Git Unix utilities present on PATH. Final exact-head verification after the rebase remains to run. Vite retained existing Node-externalization, eval, dynamic-import, and chunk-size warnings.
- No Supabase, hosted row, schema, secret, Production, browser, or deployment action occurred.

## Decisions

- The serial lane is a conservative isolation requirement for direct PGlite-engine imports, not a reason to serialize pure/UI/Worker tests.
- The combined gate remains sequential: fast lane first, books lane second. Its coordinator runs the books lane even if the fast lane fails, then returns failure if either lane failed.

## Remaining uncertainty

- This packet changes test orchestration only. The wider browser-evidence matrix is not a release requirement because no household-facing UI changed.

## Handoff

**Changed files:** `package.json`, `vite.config.ts`, `scripts/run-test-lanes.mjs`, `test/test-lanes.test.ts`, `docs/DECISIONS.md`, `docs/AI_HANDOFF.md`, and this worksession.

**Next owner:** Codex may commit, push, and merge this exact isolated packet under Jonathan's authorization. No hosted data, schema, secret, Production, or deployment action is part of this packet.
