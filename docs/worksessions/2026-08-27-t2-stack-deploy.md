# Hearth worksession — Tier 2 command-log land + deploy

- **Status:** OPEN — code merged + kitchen deployed; **blocked on Migration 013 apply**
- **Opened:** 2026-08-27 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor (this agent)
- **Repository:** dual-ai-budget-app
- **Branch:** `main` (`ad5a1f5`)
- **Baseline SHA:** `f647ccc`
- **Head SHA:** `ad5a1f5`
- **PR or issue:** #186 merged; follow-up merge-fix on main
- **Risk:** High
- **Decision owner:** Jonathan (explicit: get T2 done and deployed today)
- **Environment impact:** Development (Migration 013 apply + kitchen flag)

## Household outcome

When Bianca and Jonathan both Confirm, phones exchange **small command receipts** instead of whole notebooks, still within 100–500 ms Realtime, with confirmation-scoped undo that never clobbers partner rows.

## Budget delta (5)

+4 — command-log primary + atomic append RPC + undo integrity

## Engagement delta (3)

+2 — true interleaving feel; smaller transport; faster partner merge

## Verified baseline

- Tier 1 G1–G5 green; G6 CONDITIONAL PASS with P0 fixed (#183)
- Draft T2-S1…S6 branches existed; cherry-picked onto current main
- G6 plain personal envelope fix also applied to `appendContinuityCommand`

## Scope

### In scope

- T2-S1…T2-S6 code + tests on one PR
- `VITE_CONTINUITY_COMMAND_LOG=1` on kitchen deploy
- Migration **013** apply on Development (Jonathan paste)
- Merge + Cloudflare deploy

### Out of scope

- Production apply / Production Continuity flag
- T1-S6 freshness UI (other chat)
- Tier 3/4

## Acceptance evidence

- [x] Focused T2 tests 54/54
- [ ] `pnpm test` green
- [ ] Migration 013 applied Development
- [ ] Kitchen deploy with command-log flag
- [ ] Trust/books auditors on stack (or documented CONDITIONAL)

## Plan

- [x] Cherry-pick T2-S1…S6 onto main
- [x] Preserve G6 Production Realtime guard + plain personal envelope
- [ ] Full test + PR
- [ ] Jonathan applies 013
- [ ] Merge + deploy

## Evidence log

- Cherry-pick conflicts resolved in SYNC_ARCHITECTURE, package.json, apply script, App.tsx, continuityRealtime, 014, DECISIONS
- Focused T2 vitest: 54 passed

## Remaining uncertainty

- Hosted 013 not applied until Jonathan pastes SQL
- Without 013, command-log flush fail-closes (outbox pending) — do not treat kitchen as command-log live until apply confirmed

## Next owner

Jonathan — paste `supabase/migrations/013_continuity_command_events.sql` into Development Supabase SQL Editor, then confirm so merge/deploy can complete with `VITE_CONTINUITY_COMMAND_LOG=1`.
