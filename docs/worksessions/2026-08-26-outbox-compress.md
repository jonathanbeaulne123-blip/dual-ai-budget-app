# Hearth worksession — Slim continuity outbox + gzip cloud payloads

- **Status:** READY FOR REVIEW (draft PR)
- **Opened:** 2026-08-26 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor Cloud Agent
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `cursor/outbox-compress-e279`
- **Baseline SHA:** `0029ee07201a403b7be6a3950795cf17af13e581` (`main`)
- **Head SHA:** evolving on `cursor/outbox-compress-e279`
- **PR or issue:** https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/155
- **Risk:** High (continuity transport / money sync path)
- **Decision owner:** Jonathan
- **Environment impact:** Development client transport encoding; no schema migrate; personal TEXT may gzip; shared CAS payloads stay plain for 006 SQL guards

## Household outcome

Jonathan’s desktop can share large Development books without blowing `localStorage` quota. The outbox stores a slim tip pointer and loads the live accepted household on flush. Personal cloud envelopes may gzip; shared household snapshots stay plain JSON. Bianca’s phone can receive the tip without Jonathan’s browser storage failing mid-share.

## Budget delta (5)

`+3` — continuity transport reliability; prevents silent share stalls that diverge two phones’ books.

## Engagement delta (3)

`+1` — Retry/share stays honest; less “Waiting to share” from quota on stress fixtures.

## Verified baseline

- Outbox key `hearth:continuity-outbox:v1:development` stored **full** household JSON in `localStorage` (~5MB cap).
- #150 kept memory+IDB fallback after quota; did not shrink the durable blob.
- Cloud `household_snapshots.payload` / personal payloads are plain `JSON.stringify`.
- Shared cloud already Personal-strips via `householdCloudProjection`.

## Scope

### In scope

- D-144 gzip envelope codec (`snapshotPayload.ts`) for **personal** hosted payloads; shared CAS payloads stay plain
- Slim durable outbox (no full snapshot in LS/IDB); tipRevision + ids; resolve live household on flush
- IDB-first durable outbox write; LS only for slim metadata
- Legacy plain JSON pull still works
- Tests: compression ratio, round-trip, slim durable size, flush resolves live books, pull decode

### Out of scope

- Delta/event sync protocol
- Hosted normalized journal tables
- Stripping kitchen chatter from shared envelope (follow-up)
- Production schema changes
- Auth invite smoke (separate)

## Acceptance evidence

- [x] Compress round-trip preserves household JSON (personal envelopes)
- [x] Large personal fixture wire size ≪ plain JSON
- [x] Shared snapshots stay plain for live CAS SQL guards
- [x] Durable outbox JSON has no `transactions` array
- [x] Flush after reload loads from live tip when snapshot omitted
- [x] Flush fails closed when live tip is older than tipRevision
- [x] Legacy plain payload pull still works
- [x] Focused + `tsc` green; full suite 645 pass / 2 pre-existing batch-import SubtleCrypto fails on main

## Plan

- [x] Branch from `main`
- [x] Codec + supabase wire
- [x] Slim IDB-first outbox
- [x] Auditor-driven shared-plain / tipRevision guards
- [x] Tests + auditors closeout
- [x] PR + handoff

## Remaining uncertainty

PostgREST/SQL editor will show envelope JSON for compressed rows (not raw household). Pull clients before this deploy must not read new compressed rows — kitchen deploy order: client first is safe because encode is client-side; old clients writing plain still work; new clients reading old plain work. Old clients reading new gzip envelopes would break — **deploy client that decodes before any client that encodes**, or ship decode+encode together (this PR does both).

## Handoff

Next owner: Jonathan — Retry now on the quota desktop after merge+deploy; confirm banner clears and Bianca’s entry count / Assets converge.
