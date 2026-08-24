# Auth + membership RLS cutover (draft packet)

> **Status:** design + unapplied readiness. Do **not** apply to the household project.  
> **Branch:** `cursor/auth-rls-packet-4ffb`  
> **Decision id (proposed):** D-123 once Jonathan accepts the product choices below.  
> GPT owns live migration `002` apply/smoke. This packet stays off that runway.

## Goal

Before meaningful October data: a Google-authenticated person can reach only their personal ledger and intended household/environment rows. Anonymous and unaffiliated authenticated callers are denied. Phrases remain invitation aids, not PostgREST passwords.

## Already locked by living canon (not asking again)

These are accepted; the packet will implement them unless Jonathan explicitly changes course:

| Invariant | Source |
|---|---|
| Google identity is account entry; cloud is durable continuity; PGlite is offline replica | D-114, CLOUD_CONTINUITY |
| Hosted membership already lives in `continuity_memberships` / `continuity_personal_snapshots` (D-117); do not invent a parallel fictional `members.auth_user_id` table that ignores current schema | D-117, migration 003 |
| Development vs Production never cross | D-002, D-114 |
| Phrase / Pass / `linked` are invitation or legacy aids, not the Auth door | D-114 |
| No DELETE from authenticated PostgREST for household/snapshot rows | existing `rls_auth_ready.sql` sketch |
| No `service_role` / DB password in `VITE_` or Cloudflare Vite-baked env | AGENTS.md, D-034 |
| Personal scope is member-only; partner personal payloads must not be readable via REST | D-015 spirit + D-117 personal table |
| Packet is unapplied until Jonathan explicitly approves apply | Phase 3, D-052 |

## Proposed technical spine (pending product answers)

1. **Extend** `continuity_memberships` with `auth_user_id UUID` (nullable during backfill) + optional `role` / revoke timestamp once roles are decided.
2. **Map** Supabase `auth.uid()` ↔ Google subject used today (`google_subject` on membership rows).
3. **Replace** open `USING (true)` policies on `households`, `household_snapshots`, continuity tables, and any other exposed books tables that the SPA actually touches.
4. **REVOKE** all table rights from `anon` for those tables after cutover.
5. **Keep** `publish_household_snapshot` executable only for authenticated members of that household (CAS stays D-122).
6. **Client:** after Google sign-in, establish a Supabase Auth session so PostgREST carries a real JWT — not a browser-supplied subject filter.

Migration file (when product answers land): `supabase/migrations/004_auth_rls_cutover.sql` — DO NOT APPLY.  
Legacy sketch remains at `docs/sql/rls_auth_ready.sql` and will be superseded by 004.

## Open product decisions (Jonathan)

Please answer these before policies and client session code are locked:

### Q1 — How does Google become `auth.uid()`?

Today the kitchen uses Google Identity Services for access tokens and stores subject/email on the household + local session. PostgREST still sees the publishable/`anon` key.

Pick one:

- **A. Supabase Auth Google provider** — “Continue with Google” becomes (or also establishes) a Supabase session; `auth.uid()` is the Supabase user id; we store Google subject in `auth.users` / identity links.
- **B. Token exchange** — keep current GIS UX; a Worker or Edge Function verifies the Google ID token and mints a Supabase session (custom / signInWithIdToken style).
- **C. Other** — say what you want.

**Recommendation:** **A** if we can keep one Google client and a short cutover; **B** if you want the existing GIS flow unchanged on day one.

### Q2 — Are Jonathan and Bianca equal members, or is there an owner?

- **Equal co-editors:** both can invite, revoke, and write; no `owner` role.
- **Owner + member:** one (or both marked owner) can invite/revoke; members write books but cannot manage membership.
- **Something else.**

Today the product treats both as full household editors. Owner/member is a product change.

### Q3 — How does a new person join a household after Auth?

- **Phrase redeem only while signed in** (authenticated RPC: present phrase → membership row).
- **Email invite** (pending invite row → accept when that Google account signs in).
- **Both.**
- **Neither / other.**

Canon allows phrase as invitation aid. Need the post-Auth rule.

### Q4 — After cutover, does `anon` retain any household REST access?

- **No** (recommended): publishable key alone cannot read/write any household/continuity row.
- **Yes, narrowly:** e.g. invite lookup by phrase only — higher risk; say why.

### Q5 — Development rehearsal timing

Disposable Development window ends 2026-09-30. After this packet is reviewed:

- Apply **004 to Development only** for red-team rehearsal as soon as you approve?
- Or keep 004 unapplied until a named cutover week, with only local synthetic tests until then?

(Production apply remains a separate approval either way.)

## Non-scope for this packet

- Applying SQL to the household project
- Production schema or data
- Bank / Interac / cards
- Binding Hercules KV (separate)
- Changing money command semantics
- Deleting hosted disposable rows

## Acceptance matrix (to encode in tests)

| Actor | households / snapshots | continuity_memberships | continuity_personal_snapshots | DELETE |
|---|---|---|---|---|
| anon | deny | deny | deny | deny |
| authenticated, no membership | deny | deny (except controlled join RPC if Q3 needs it) | deny | deny |
| member, matching environment | allow own household | allow own rows | allow **own** member_id only | deny |
| member, other environment | deny | deny | deny | deny |
| revoked / inactive membership | deny | deny | deny | deny |
| outsider household id | deny | deny | deny | deny |

## Next after answers

1. Write `004_auth_rls_cutover.sql` to match Q1–Q5.
2. Expand synthetic policy-matrix tests beyond string checks.
3. Sketch client session wiring (no secrets; no apply).
4. Record **D-123** and open/update the draft PR.
