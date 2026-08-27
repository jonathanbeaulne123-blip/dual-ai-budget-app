# Migration 013 apply — Development (T2-S1)

> **Applied on Development 2026-08-27** (arity fix + trust P0 RPC body). Kitchen ships with `VITE_CONTINUITY_COMMAND_LOG=1`.

## Why

`append_continuity_command` + `continuity_command_events` let kitchens share **confirmed command receipts** instead of whole snapshots.

## Verify

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

## Apply (reference)

1. Open [Development SQL Editor](https://supabase.com/dashboard/project/tykhocwacaxwquhynkok/sql/new).
2. Paste [`supabase/migrations/013_continuity_command_events.sql`](../supabase/migrations/013_continuity_command_events.sql) from `main`.
3. Run. Expect **Success**.

Do **not** apply to Production.

## Rollback (Development only)

See comments at top of `013_continuity_command_events.sql`.
