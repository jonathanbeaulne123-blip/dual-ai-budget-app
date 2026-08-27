# Hearth worksession — Invite owner first create

- **Status:** OPEN
- **Opened:** 2026-08-27 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor Cloud Agent
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `cursor/invite-owner-first-create-5958`
- **Baseline SHA:** `ef3274a2fac3256092cc5ec13d28dc9793b45478` (`main`)
- **Head SHA:** (see latest commit on branch)
- **PR or issue:** (draft PR after first commit)
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
- Invite chrome waits until share finishes instead of showing a false owner refusal
- Tests for first-create flush vs later append
- D-149 why-note

### Out of scope

- Hosted schema / migration apply
- Calling reset RPCs or mutating live household rows
- Production continuity
- Changing who is allowed to invite after the owner row exists

## Acceptance evidence

- [ ] Command-ref + `expectedRevision === 0` calls `hearth_create_household`, not `append_continuity_command`
- [ ] Command-ref + `expectedRevision > 0` still appends
- [ ] Invite Issue buttons disabled while `syncState === "syncing"`
- [ ] Focused tests + `pnpm check`
- [ ] Independent privacy audit (membership/RPC path)

## Plan

- [x] Trace not-owner to first-create skipping `hearth_create_household`
- [ ] Implement flush gate + Invite wait copy
- [ ] Tests and canon
- [ ] Privacy auditor + verifier

## Evidence log

Record exact commands, results, and current SHAs. Do not copy evidence from another branch.

## Decisions

First hosted write stays on `hearth_create_household` even when command-log is on (D-149 why-note). Invite RPCs keep the existing owner check.

## Remaining uncertainty

Already-created Development households that never got an owner row will invite successfully only after this client deploys and a retry/flush with `expectedRevision === 0` runs `hearth_create_household`. Live kitchen is not this PR until merge/deploy.

## Handoff

Next owner: Jonathan. Review/merge this PR, then hard-refresh the kitchen. If Invite still says not-owner, tap Retry now (or wait for the next share), then Issue.
