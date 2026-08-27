# Worksession — T1 Realtime enablement (Migration 014 + flag)

- **Status:** CLOSED — 014 applied; two-phone smoke passed 2026-08-27 ([`SYNC_REALTIME_SMOKE.md`](../SYNC_REALTIME_SMOKE.md))

**Date:** 2026-08-26  
**Branch:** `cursor/t1-realtime-enable-7270`  
**Risk:** Medium — hosted Realtime on Development only; RLS still gates websocket delivery.

## Household outcome

Partner snapshot writes ring the open kitchen via Supabase Realtime within the Tier 1 **100–500 ms** target path instead of waiting on the 4 s REST poll fallback.

## What changed

| File | Change |
|---|---|
| `supabase/migrations/014_realtime_publication.sql` | Production-ready migration (idempotent ADD TABLE + `schema_migrations` 14) |
| `package.json` | `books:apply:014` |
| `scripts/apply-supabase-migration.mjs` | Post-apply verification via `pg_publication_tables` |
| `.github/workflows/pages.yml` | `VITE_CONTINUITY_REALTIME: "1"` at build time |
| `.env.example` | Documents flag + Migration 014 dependency |

## Hosted apply status

Migration **014 applied on Development** (2026-08-26, Jonathan). Two-phone Realtime smoke passed 2026-08-27.

Verify (optional):

```sql
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('household_snapshots', 'continuity_personal_snapshots');
```

## Verification (post-merge + post-014)

1. Hard refresh kitchen on two signed-in Development browsers (same household, different members if possible).
2. Device A: Confirm a shared post.
3. Device B: revision/ledger visible **before** the 4 s poll would fire (target ≤ 500 ms p95 — formal harness is T1-S5).
4. DevTools: Realtime channel `SUBSCRIBED` when flag is on and Auth session present.

## Dual Course deltas

- **Budget (5):** `+1` — faster partner visibility without weakening PGlite accept or CAS.
- **Engagement (3):** `+2` — live kitchen feel; poll demoted to fallback.

## Uncertainty

- Publication alone may suffice; replica identity not added unless events are missing after 014.
- Production Realtime remains blocked until 008 personal RLS OR-policy is reviewed (privacy-auditor note on T1-S3).

## Next owner

T1-S5 / two-phone Realtime smoke already passed. G6 in-memory 012 proof is PR #197. Do not re-apply Migration 014.
