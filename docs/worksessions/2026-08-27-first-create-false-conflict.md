# Hearth worksession — First-create false another-phone conflict

- **Status:** OPEN
- **Opened:** 2026-08-27 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor Cloud Agent
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `cursor/first-create-false-conflict-5958`
- **Baseline SHA:** `4009b6cf80ee95f3226a01c52d4cba61d4053603` (`main`, invite-owner merge)
- **Head SHA:** (see latest commit on branch)
- **PR or issue:** (draft after first commit)
- **Risk:** High (hosted CAS / first-create retry; money meaning unchanged)
- **Decision owner:** Jonathan
- **Environment impact:** Development client only. No schema apply, no Production.

## Household outcome

The person who starts a Development household does not see “Another phone posted a newer household snapshot” while they are the only member. Share retries from the hosted revision after `hearth_create_household` returns `household-already-exists`.

## Budget delta (5)

`+2` — false conflict blocks the only copy of the books from reaching the cloud.

## Engagement delta (3)

`+2` — Health and More stop accusing a partner who is not in the household.

## Verified baseline

- #209 made first command-log flush call `hearth_create_household`.
- After create, a compacted outbox still has `expectedRevision === 0`. Retry hits `household-already-exists`, then `publish_continuity_snapshot` with expected 0. Migration 012 treats current_rev ≠ 0 as `stale-revision`, whose default copy is “Another phone…”.
- Screenshot: Jonathan-only Development household, Waiting to share rev 7, Health finding repeats the same line.

## Scope

### In scope

- On `household-already-exists`, read hosted snapshot and CAS from that revision when local is same or ahead
- Real conflict only when hosted revision is newer
- Tests for retry CAS and genuine newer-remote
- D-149 why-note

### Out of scope

- Schema / SQL change to return remote payload on already-exists
- Production continuity
- Changing who is owner

## Acceptance evidence

- [ ] already-exists + local ahead → 012 `p_expected_revision` is hosted revision, not 0
- [ ] already-exists + hosted newer → conflict
- [ ] Focused tests + `pnpm check`

## Remaining uncertainty

Stuck kitchens with this error need the new client plus Retry now (or the next background flush). Live kitchen still has the bug until merge/deploy.
