# Hearth worksession — Auth/RLS 006 path B

- **Status:** OPEN — Jonathan executing delete → Google Auth → apply 008; 006 postponed
- **Opened:** 2026-08-25 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor Cloud Agent
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `cursor/auth-rls-006-path-b-f375`
- **Baseline SHA:** `220908e` (`main`)
- **Risk:** Release
- **Decision owner:** Jonathan
- **Environment impact:** shared project `tykhocwacaxwquhynkok`; agent cannot apply SQL (no DB password); Jonathan pastes

## Jonathan decisions (2026-08-25 after preflight)

1. **Delete** empty Production household `HH-9465baf2ec6c9d9d` — no useful data; skip export
2. **Google Auth** — follow `docs/SUPABASE_GOOGLE_AUTH_SETUP.md`
3. **Apply 008** — approved
4. **Postpone** 006 Production-abort NOTICE / apply until 1–3 finish

## Preflight scorecard (live)

| # | Result | Verdict |
|---|---|---|
| 1 | migrations `2,4,5,7` | Pass |
| 2 | 1 Production household | Pass (then delete) |
| 3 | 0 memberships | Fail for 006 |
| 4 | unbound 0 | Pass (vacuous) |
| 5 | owner_count 0 | Fail for 006 |
| 6 | Personal 0/0/0 | Pass |
| 7 | auth.users empty | Fail for Auth proof |

## Paste packets

- Delete: `docs/sql/delete_empty_production_household.sql`
- 008: `docs/sql/apply_008_production_continuity_select.sql`
- Auth: `docs/SUPABASE_GOOGLE_AUTH_SETUP.md`

## Handoff

Jonathan runs 1→2→3 in SQL Editor / dashboards. Agent brings back 006 NOTICE revision after confirmation that delete + 008 + Google identities are done.
