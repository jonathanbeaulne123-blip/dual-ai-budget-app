# Migration 013 apply — Development (T2-S1)

> **One paste to unlock Tier 2.** Development disposable data only. Do not apply to Production.

## Why

`append_continuity_command` + `continuity_command_events` let kitchens share **confirmed command receipts** instead of whole snapshots. The kitchen build will ship with `VITE_CONTINUITY_COMMAND_LOG=1` after this apply.

## Steps

1. Open Supabase → **SQL Editor** (Development project `tykhocwacaxwquhynkok`).
2. Paste the full contents of [`supabase/migrations/013_continuity_command_events.sql`](../supabase/migrations/013_continuity_command_events.sql).
3. Run. Expect **Success. No rows returned** (or similar).
4. Verify:

```sql
SELECT to_regclass('public.continuity_command_events') AS table_ok;
SELECT proname FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname = 'append_continuity_command';
SELECT tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename = 'continuity_command_events';
SELECT id FROM public.schema_migrations WHERE id = 13;
```

Expect: table present, function present, publication row present, schema id `13`.

## After apply

Reply **“013 applied”** — agent merges PR, kitchen deploys with command-log on.

## Rollback (Development only)

See comments at top of `013_continuity_command_events.sql`.
