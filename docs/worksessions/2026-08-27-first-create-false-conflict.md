# Hearth worksession — First-create false another-phone conflict

- **Status:** CLOSED; merged #210; kitchen Worker `cc694eee-3462-4fff-8f71-8675e8ad2ecf` live
- **Opened:** 2026-08-27 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor Cloud Agent
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `main` (`48b1716`)
- **Baseline SHA:** `4009b6cf80ee95f3226a01c52d4cba61d4053603` (`main`, invite-owner merge)
- **Head SHA:** `48b1716aa22555235e57e42f0febc6ae518818e8`
- **PR or issue:** merged PR #210
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
- Real conflict only when hosted revision is numerically newer
- Unreadable or non-positive hosted revision → pending `missing-snapshot`, never CAS from 0
- Tests for retry CAS, same-rev duplicate, genuine newer-remote, unread snapshot, omitted revision
- D-149 why-note

### Out of scope

- Schema / SQL change to return remote payload on already-exists
- Ancestry / `canAbsorbDisjointSharedMoney` before local-ahead CAS (named October risk)
- Mapping every unrecognized CAS reason away from the “Another phone” default
- Production continuity
- Changing who is owner
- Merge / deploy

## Acceptance evidence

- [x] already-exists + local ahead → 012 `p_expected_revision` is hosted revision, not 0
- [x] already-exists + same revision → duplicate CAS from hosted revision, not another phone
- [x] already-exists + hosted newer → conflict
- [x] already-exists + unread / omitted revision → pending missing-snapshot, not another phone
- [x] Focused tests: 27 passed (`auth-membership-authority` 11, `continuity-command-outbox` 8, `publish-continuity-snapshot` 8)
- [x] `pnpm test` **875 passed / 2 skipped**; `pnpm ai:verify` green; `pnpm build` green after `hostedRevision` narrowing

## Remaining uncertainty

- The stuck household still needs a hard-refresh plus Retry now (or the next background flush) so the new client can CAS from the hosted revision.
- A hosted row without owner (pre-#209 leftover) still needs Start from scratch — already-exists does not mint owner; symptom may change to not-member.
- **October:** local-ahead CAS uses revision numbers only, not shared-money ancestry.
- Unrecognized 012 reasons (including `unauthenticated`) still default to the “Another phone” copy.

## Next owner

Jonathan — hard-refresh the kitchen, open More, tap Retry now on the waiting-to-share household.
