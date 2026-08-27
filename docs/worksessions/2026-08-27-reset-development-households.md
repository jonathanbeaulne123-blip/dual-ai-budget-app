# Hearth worksession — Start from scratch (Development household reset)

- **Status:** IMPLEMENTED; DRAFT PR #201; NOT SHIPPED
- **Opened:** 2026-08-27 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor Cloud Agent
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `cursor/reset-development-households-5958`
- **Baseline SHA:** `713e586a37099be658b1bc59f9aa01cb50b801d8` (`main`)
- **Head SHA:** (see latest commit on branch)
- **PR or issue:** [PR #201](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/201) draft
- **Risk:** High (hosted Development delete/leave; Production blocked)
- **Decision owner:** Jonathan
- **Environment impact:** Development (kitchen chrome + migration 016 SQL file; **not applied**)

## Household outcome

Jonathan can wipe every disposable Development household this Google account owns (and leave any he only joined), clear this phone’s Development copies, and land on Create household — without tapping Delete one household at a time.

## Budget delta (5)

`+2` — honest Development reset so leftover test ledgers cannot be mistaken for September books.

## Engagement delta (3)

`+2` — one Confirm instead of a picker full of Delete buttons.

## Verified baseline

- `main@713e586` already has per-household Development delete/leave (migration **015**, #181).
- Welcome picker and More → Where the books live delete one household each.
- Production delete remains blocked in 015 (`production-blocked`).

## Scope

### In scope

- One Confirm: **Start from scratch** on the Google household picker and in More
- Bulk RPC `hearth_reset_development_households` (migration **016**, paste later)
- Fallback loop of existing 015 delete/leave if 016 is not live yet
- Local Development replica, outbox, undo, sync-anchor, and PGlite wipe
- Keep Google/Auth signed in and open Create household
- JWT required before any local wipe; ConfirmSheet focus trap + Escape

### Out of scope

- Applying 016 to the live project (Jonathan paste)
- Production households
- Project-wide delete of Development rows the caller does not own
- Changing money commands or Confirm posting

## Acceptance evidence

- [x] Focused tests: `pnpm exec vitest run test/auth-invite-chrome.test.ts test/storage-replicas.test.ts test/reset-development-local.test.ts test/claude-ux-dialog.test.ts` → 35 pass
- [x] `pnpm test` 840 pass; one unrelated `sync-freshness` preview timeout then 17/17 on re-run; `pnpm build` green
- [x] Confirm copy names Development only and Production blocked (manual More path at 320/390/720/1100)
- [x] Without Google, Confirm fail-closes with “Continue with Google before starting from scratch.”
- [ ] Live signed-in wipe after Jonathan pastes 016 (or 015 fallback)

## Evidence log

- Privacy audit: P1 missing-JWT wipe — **fixed** (require Continue with Google; union discovered memberships into `known`).
- UX audit: ConfirmSheet now uses `useDialog` (focus in, Tab trap, Escape).
- Manual: demo kitchen More → Start from scratch Confirm; Cancel/Escape; Confirm without Google shows danger alert.

## Remaining uncertainty

016 is not live until Jonathan pastes it. Until then the kitchen uses the 015 loop over listed + discovered memberships.

## Handoff

Next owner: Jonathan. Branch/PR only — not merged, not deployed, 016 not applied. Paste 016, then Login with Google → **Start from scratch** on the Development picker.
