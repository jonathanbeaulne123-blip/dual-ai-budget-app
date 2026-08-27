# Hearth worksession — Invite owner first create

- **Status:** IMPLEMENTED; DRAFT PR #209; NOT SHIPPED
- **Opened:** 2026-08-27 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor Cloud Agent
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `cursor/invite-owner-first-create-5958`
- **Baseline SHA:** `ef3274a2fac3256092cc5ec13d28dc9793b45478` (`main`)
- **Head SHA:** (latest on branch after audit follow-up)
- **PR or issue:** [PR #209](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/209) draft
- **Risk:** High (Auth/RLS/membership path; money meaning unchanged)
- **Decision owner:** Jonathan
- **Environment impact:** Development client only. No schema apply, no RPC wipe, no Production.

## Household outcome

The person who starts a household can send a Google invite. “Only the household owner can send an invite.” must not appear while their first cloud write is still creating the owner membership.

## Budget delta (5)

`+2` — partner invite is the door to shared books; a false not-owner block strands the household on one phone.

## Engagement delta (3)

`+2` — Invite stops looking like a broken kitchen while share is still catching up.

## Verified baseline

- Live kitchen has `VITE_CONTINUITY_COMMAND_LOG=1`. Command-ref outbox flush called `append_continuity_command` even when `expectedRevision === 0`.
- `hearth_create_household` is the only RPC that inserts `continuity_memberships` with `role='owner'`.
- `hearth_issue_invite` requires `is_household_owner` (`role='owner'` + `auth.uid()`).
- Screenshot: Invite seat Bianca, `partner@gmail.com`, “Syncing the shared household…”, then not-owner. Local Google bridge showed 1 linked.

## Scope

### In scope

- Command-log flush uses `pushSupabaseHousehold` → `hearth_create_household` when `expectedRevision === 0`
- Invite chrome waits until share finishes (`syncing` or `pending-transport`) instead of showing a false owner refusal
- Tests for first-create flush vs later append, plus compacted `0` then `1` still creates
- D-149 why-note

### Out of scope

- Hosted schema / migration apply
- Calling reset RPCs or mutating live household rows
- Production continuity
- Changing who is allowed to invite after the owner row exists
- Repairing a pre-006 hosted `households` row that exists without an owner (that path is `household-already-exists` → `not-member`; Start from scratch)

## Acceptance evidence

- [x] Command-ref + `expectedRevision === 0` calls `hearth_create_household`, not `append_continuity_command`
- [x] Command-ref + `expectedRevision > 0` still appends
- [x] Invite Issue disabled while `syncState === "syncing"` or `sharing.mode === "pending-transport"`
- [x] Focused tests 26 pass; `pnpm check` on `f5c6649` → 868 pass / 2 skipped + build
- [x] Independent privacy **PASS WITH NOTES**; trust **PASS WITH NOTES**; books **PASS WITH NOTES**; UX **PASS WITH NOTES**

## Plan

- [x] Trace not-owner to first-create skipping `hearth_create_household`
- [x] Implement flush gate + Invite wait copy
- [x] Tests and canon
- [x] Privacy / trust / books / UX auditors
- [ ] Verifier after audit follow-up commit

## Evidence log

- Focused: `pnpm exec vitest run test/continuity-command-outbox.test.ts test/auth-invite-chrome.test.ts` → 26 pass (after compact + pending-transport tests).
- Full `pnpm check` at `f5c6649`: `pnpm ai:verify` green; **868 passed / 2 skipped**; `pnpm build` green (`tsc --noEmit` + vite).
- Privacy: first write still create; invite RPC still owner-only; compact keeps `expectedRevision` 0.
- Trust P2 addressed: gate also keys off `pending-transport` so Retry-online error does not re-enable Issue while share is still pending.
- Books P2 addressed: first-create test asserts `publish_continuity_snapshot`; compact `0` then `1` still creates.
- UX Medium addressed: `#auth-invite-wait` stays in the DOM with `role="status"` / `aria-atomic`.

## Decisions

First hosted write stays on `hearth_create_household` even when command-log is on (D-149 why-note). Invite RPCs keep the existing owner check. Chrome wait is not Auth.

## Remaining uncertainty

The reported bug (household never reached the cloud; outbox still at `expectedRevision === 0`) is what this client fixes after merge/deploy + Retry. If a hosted `households` row already exists **without** an owner (pre-006 leftover), `hearth_create_household` returns `household-already-exists` and does not mint owner — use Start from scratch, not Retry. Live kitchen is not this PR until merge/deploy.

## Handoff

Next owner: Jonathan. Review/merge [PR #209](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/209), then hard-refresh the kitchen. If Invite still says not-owner, tap Retry now (or wait for the next share), then Issue.
