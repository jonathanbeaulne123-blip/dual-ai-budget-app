# Hearth worksession — PR #66 AI configuration salvage

- **Status:** CLOSED
- **Opened:** 2026-08-24 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/pr66-ai-config-salvage`
- **Baseline SHA:** `f51fa717b5fb2f0f59ad1252a450eb9764dcec07`
- **Head SHA:** `afccf3770636031d097a201bd21b443604bda16a` (audited implementation commit)
- **PR or issue:** stale PR #66; clean replacement PR #88
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** none

## Household outcome

Codex, Cursor, and Claude receive focused repository roles, repeatable review skills, and local guardrails without importing PR #66's obsolete roadmap ancestry or overwriting current cloud-continuity canon.

## Budget delta (5)

`+1` — repeatable books, privacy, implementation, and release reviews make trust-boundary work harder to misroute. No posting or ledger behavior changes.

## Engagement delta (3)

`+1` — Claude receives a focused UX/Hercules/accessibility lane and visual proof contract. No runtime companion behavior changes.

## Verified baseline

- PR #66 targets `codex/hearth-roadmap-2026-08-23`, not current `main`, and changes 55 files.
- Current `main` already contains the shared constitution, AI operating model, current roadmap, cloud-continuity canon, and merged work through PR #85.
- The repository MCP files still name the live household Supabase project even though `AGENTS.md` requires committed AI MCP configuration to be documentation-only.
- Current official Codex documentation supports repository `.agents/skills`, `.codex/agents`, project `.codex/config.toml`, and trusted `.codex/hooks.json`.
- Current official Cursor documentation supports project rules, agents, `permissions.json`, `sandbox.json`, and fail-closed project hooks.

## Scope

### In scope

- Salvage the three AI role adapters, reusable skills, read-only auditors, and local safety hooks.
- Replace committed live-project Supabase MCP entries with documentation-only access.
- Add a focused AI-surface verifier and make `pnpm check` the complete local proof gate.
- Improve the PR template, CI branch coverage, setup instructions, and worksession template.
- Update only current roadmap topology needed to close and supersede PR #66.

### Out of scope

- Product runtime, books, hosted rows, schema, secrets, Cloudflare, deployment, merge, or Production.
- PR #66's stale copies of living product canon.
- PR #84's atomic CAS implementation.

## Acceptance evidence

- [x] Replacement diff is based on current `main` and contains no PR #66 product-canon rollback.
- [x] JSON, TOML, Node hook, MCP, role, and tracked-secret-name checks pass.
- [x] Hook deny/ask behavior is exercised with synthetic inputs.
- [x] `pnpm check` passes in GitHub CI from a frozen pnpm 10 install.
- [x] PR #88 targets current `main`; PR #66 is closed with a replacement link.

## Plan

- [x] Audit PR #66 against current `main` and official configuration documentation.
- [x] Rebuild the useful configuration layer on a clean current-main branch.
- [x] Verify locally and review the complete diff.
- [x] Publish replacement PR #88, refresh roadmap topology, and close PR #66.

## Evidence log

- Initial audit baseline: `e2f24ba80bd9140954dd91387f3eaf583f24e0d0`; rebased replacement baseline after PR #86 merged: `f51fa717b5fb2f0f59ad1252a450eb9764dcec07`.
- GitHub CI run #324 and the Cloudflare PR workflow passed on the audited implementation commit.
- No hosted project, rows, schema, secrets, deploy, household data, or Production data were contacted.

## Decisions

- Keep the supported configuration mechanics; discard the stale stacked ancestry and outdated setup/roadmap text.
- Keep committed MCP access documentation-only even during the disposable Development window. Runtime Development continuity remains unchanged.
- Do not copy PR #66 versions of `ARCHITECTURE.md`, `HERCULES.md`, `OFFICE.md`, `AI_HANDOFF.md`, or `AI_OPERATING_MODEL.md` over newer canon.

## Remaining uncertainty

- Claude is offline for a week, so its local activation remains a later manual check.
- Cursor and Claude settings are convenience guardrails, not substitutes for product invariants or independent review.

## Handoff

PR #66 is closed and superseded by mergeable PR #88. Jonathan owns review/merge and later tool activation; PR #87 remains a separate do-not-apply Auth/RLS decision packet.
