# Hearth worksession — Start from scratch (Development household reset)

- **Status:** OPEN
- **Opened:** 2026-08-27 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor Cloud Agent
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `cursor/reset-development-households-5958`
- **Baseline SHA:** `713e586a37099be658b1bc59f9aa01cb50b801d8` (`main`)
- **Head SHA:** (in progress)
- **PR or issue:** (draft after push)
- **Risk:** High (hosted Development delete/leave; Production blocked)
- **Decision owner:** Jonathan
- **Environment impact:** Development (kitchen chrome + migration 016 SQL file; **do not apply** until Jonathan pastes it)

## Household outcome

Jonathan can wipe every disposable Development household this Google account owns (and leave any he only joined), clear this phone’s Development copies, and land on Create household — without tapping Delete one household at a time.

## Budget delta (5)

`+2` — honest Development reset so leftover test ledgers cannot be mistaken for September books.

## Engagement delta (3)

`+2` — one Confirm instead of a picker full of Delete buttons.

## Verified baseline

- `main@713e586` already has per-household Development delete/leave (migration **015**, #181).
- Welcome picker and More → Where the books live delete one household each.
- Sign out copy still says there is no full kitchen wipe.
- Production delete remains blocked in 015 (`production-blocked`).

## Scope

### In scope

- One Confirm: **Start from scratch** on the Google household picker and in More
- Bulk RPC `hearth_reset_development_households` (migration **016**, paste later)
- Fallback loop of existing 015 delete/leave if 016 is not live yet
- Local Development replica, outbox, undo, sync-anchor, and PGlite wipe
- Keep Google/Auth signed in and open Create household

### Out of scope

- Applying 016 to the live project (Jonathan paste)
- Production households
- Project-wide delete of Development rows the caller does not own
- Changing money commands or Confirm posting

## Acceptance evidence

- [ ] Focused tests for bulk RPC client, 015 fallback, Production refusal, and local catalog wipe
- [ ] `pnpm check` green
- [ ] Confirm copy names Development only and Production blocked
- [ ] After Confirm, welcome Create household is ready while Google stays signed in

## Plan

- [x] Open branch from `main@713e586`
- [ ] Migration 016 + client + local wipe + kitchen chrome
- [ ] Tests and living docs (D-151)
- [ ] Independent privacy / UX / verifier review
- [ ] Draft PR; do not apply hosted SQL

## Evidence log

Record exact commands, results, visual widths, links, and current SHAs. Do not copy evidence from another branch.

## Decisions

## Remaining uncertainty

016 is not live until Jonathan pastes it. Until then the kitchen uses the 015 loop over discovered memberships.

## Handoff

Name the next owner and distinguish local, branch, PR, merged, deployed, and manually verified state.
