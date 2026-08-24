# 2026-08-24 — Continuity slice 4: hosted membership and Personal scope

**Status:** Implemented and pushed to PR #72. Migration `003_continuity_membership.sql` is created and tested but not applied. No hosted rows, Production deployment, credentials, or secrets were changed.

## Delivered

- New Development membership rows keyed by environment + household + member, with exact Google subject and legacy email fields.
- New member-personal hosted snapshots keyed by the same household-local identity.
- Discovery uses server-side membership filtering when migration 003 exists, fetches only matching household snapshots, and overlays the signed-in member's hosted Personal envelope.
- A populated Google subject remains authoritative. Email fallback accepts only rows with an empty or identical subject.
- Signed-in transport upserts the current membership and only that member's personal transactions/shifts before advancing the household snapshot.
- A missing migration 003 is detected through PostgREST's missing-table response and retains the existing D-113 open-snapshot fallback.
- Production discovery still makes zero requests.

## Proof

- Server-filtered discovery does not invoke the open-snapshot scan.
- Hosted Personal overlay reaches the discovered household.
- Personal transport excludes the partner's private rows and precedes the household snapshot write.
- Missing-table fallback, different-subject denial, Production zero-request, outbox replay, and stale-conflict proofs remain green.
- The SQL packet proves household-local composite keys, foreign-key scope, Development-only temporary policies, and no `GRANT ALL`.
- Full serial suite: `47` files, `352` tests passed. TypeScript `--noEmit` and the production Vite bundle passed with the existing PGlite/chunk warnings.

## Honest boundary

Migration 003 is not applied. Until Jonathan approves it, runtime behavior remains D-113. Even after application, the client-supplied Google subject is a Development selector rather than authentication. Atomic hosted CAS/journal authority, acknowledgement/backoff, Supabase Auth, deny-by-default RLS, and two-browser end-to-end proof remain.

## Dual Course

- Budget delta (5): `+1` — a member's personal hosted facts gain an explicit transport/read boundary without changing posting math.
- Engagement delta (3): `0` — this is continuity infrastructure; Hercules and Office behavior are unchanged.
