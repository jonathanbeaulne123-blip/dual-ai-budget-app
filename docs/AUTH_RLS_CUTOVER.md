# Auth + membership RLS cutover (draft packet)

> **Status:** design + unapplied readiness. Do **not** apply to the household project until Jonathan reviews and approves.  
> **Branch:** `cursor/auth-rls-packet-4ffb`  
> **Decision id (proposed):** D-123 once remaining product choices land.  
> GPT owns live migration `002` apply/smoke. This packet stays off that runway.

## Goal

Before meaningful October data: a Google-authenticated person can reach only their personal ledger and intended household/environment rows. Anonymous and unaffiliated authenticated callers are denied. Phrases remain invitation aids, not PostgREST passwords.

## Already locked by living canon (not asking again)

| Invariant | Source |
|---|---|
| Google identity is account entry; cloud is durable continuity; PGlite is offline replica | D-114, CLOUD_CONTINUITY |
| Hosted membership already lives in `continuity_memberships` / `continuity_personal_snapshots` (D-117) | D-117, migration 003 |
| Development vs Production never cross | D-002, D-114 |
| Phrase / Pass / `linked` are invitation or legacy aids, not the Auth door | D-114 |
| No DELETE from authenticated PostgREST for household/snapshot rows | `rls_auth_ready.sql` sketch |
| No `service_role` / DB password in `VITE_` or Cloudflare Vite-baked env | AGENTS.md, D-034 |
| Personal scope is member-only via REST | D-015 / D-117 |
| Packet unapplied until Jonathan approves apply | Phase 3 |

## Jonathan decisions recorded

| Q | Decision | Notes |
|---|---|---|
| **Q2 Roles** | **Owner / member** | Owners alone may invite and revoke. First-run **Create** vs **Join** establishes owner vs member. Both roles write books once admitted. |
| **Q5 Apply timing** | **Apply once reviewed** | After this packet is reviewed, apply **004 to Development** for rehearsal. Production remains a separate approval. |
| Q1 Auth mapping | **Open — explain before build** | See below. |
| Q3 Join path | **Open — explain before build** | See below. |
| Q4 Anon after cutover | **Open — explain before build** | See below. |

## Proposed technical spine (after Q1/Q3/Q4)

1. Extend `continuity_memberships` with `auth_user_id`, `role` (`owner` \| `member`), and revoke/inactive semantics.
2. Map Supabase `auth.uid()` ↔ Google subject (method = Q1).
3. Replace open policies; membership- and environment-scoped RLS.
4. Anon table access per Q4.
5. Authenticated join/invite path per Q3; only owners invite/revoke (Q2).
6. Restrict `publish_household_snapshot` to authenticated household members (D-122).

Files: `supabase/migrations/004_auth_rls_cutover.sql` (DO NOT APPLY stub today), `docs/sql/rls_auth_ready.sql` (legacy sketch).

---

## Q1 — How does Google become `auth.uid()`? (pros / cons)

Today: GIS access tokens + subject/email on the device and in membership rows. PostgREST still uses the publishable key as `anon`/`authenticated` without a user JWT.

### A — Supabase Auth Google provider

“Continue with Google” (or a dedicated step) signs into **Supabase Auth** with Google. The SPA holds a Supabase session; PostgREST gets `Authorization: Bearer <user JWT>`; RLS uses `auth.uid()`.

| Pros | Cons |
|---|---|
| Standard Supabase path; docs, dashboards, session refresh, MFA later all fit | Changes the current GIS-only “Continue with Google” wiring |
| One identity system for DB policies — no custom minting code | Needs Google OAuth client configured in **Supabase** (redirect URLs, possibly a second Google client or shared client setup) |
| Least custom crypto / least Worker surface for login | Calendar/Drive GIS scopes may still need the existing GIS token client for suite APIs — two Google touches unless carefully unified |
| Easier for future Edge Functions that trust `auth.uid()` | Cutover must link existing `google_subject` rows to new `auth.users` ids |

**Best when:** you want the boring, supported Auth door and accept a visible sign-in cutover.

### B — Keep GIS UX + token exchange

Phone keeps today’s Google button/flow. A Worker (or Edge Function) verifies Google’s ID token, then creates/returns a **Supabase session** (`signInWithIdToken` or equivalent). SPA then uses that session for PostgREST.

| Pros | Cons |
|---|---|
| Kitchen UX can stay close to today | Custom security surface: Worker must verify Google tokens correctly; bugs become Auth bugs |
| Can keep one Google client for identity + suite if designed carefully | Secrets (`SUPABASE_SERVICE_ROLE` or careful JWT minting) live on the Worker — never `VITE_` |
| Clear separation: GIS = Google APIs; Supabase JWT = books API | Harder to operate/debug than native Supabase Google provider |
| | Must rate-limit and lock origins (same class of risk as Hercules chat proxy) |

**Best when:** you refuse to change the Google button experience and accept owning a mint path.

### C — Other (examples)

| Idea | Tradeoff |
|---|---|
| Pass Google subject as a PostgREST header forever | **Not Auth** — today’s open selector; rejects the cutover goal |
| Only Auth for Production; leave Development open | Splits doors; easy to ship October data on the wrong pill |
| Magic link / password Auth without Google | Breaks D-114 “Google is account entry” |

**Recommendation after Q2:** lean **A** unless preserving exact GIS Continue UX is mandatory — then **B**.

---

## Q3 — How does someone join after Auth? (pros / cons)

Q2 locks: owners invite/revoke; Create → owner, Join → member.

### Phrase redeem while signed in

Owner shares the three-word phrase (or join URL carrying it). Joiner is already Google-signed-in (Supabase session). An authenticated RPC checks phrase + environment and inserts `continuity_memberships` with `role = member`.

| Pros | Cons |
|---|---|
| Matches today’s kitchen phrase / join link mental model | Phrase entropy is weak vs a one-time token — mitigate with expiry, single-use, rate limits, owner revoke |
| Works offline-adjacent: say the words in the room | Anyone who learns the phrase before revoke could try redeem while signed in |
| No email dependency | Need careful RPC (not “anon can SELECT by phrase”) |

**Best when:** you want Create/Join to stay the product face.

### Email invite

Owner enters Bianca’s email. Row in `household_invitations`. When that Google account signs in, accept attaches membership.

| Pros | Cons |
|---|---|
| Stronger targeting; audit trail (issuer, email, times) | Extra UI and state machine (pending / accepted / revoked / expired) |
| Fits “owner invites” language cleanly | Email typos; Google account email must match |
| Easier to expire/revoke a specific invite | Worse for “say three words across the table” |

**Best when:** you want formal invites and don’t mind more chrome.

### Both

| Pros | Cons |
|---|---|
| Kitchen phrase for couples + email for future/formal | Two code paths to secure and test |
| Owner chooses channel | Product complexity; easy to under-test one path |

### Neither / other

e.g. only QR with signed one-time token, or only owner-device pairing. Possible later; more invention than Create/Join.

**Recommendation with your Create/Join owner rule:** **phrase redeem while signed in** as the primary Join path (aligned with current UI), optionally add email later. If you want both on day one, say so.

---

## Q4 — Does `anon` keep any household REST access? (explain)

`anon` = what the bundled publishable key can do **without** a user JWT.

### No household REST for anon (recommended)

After cutover: `REVOKE` table rights from `anon` on `households`, `household_snapshots`, continuity tables, etc. Unauthenticated callers get nothing useful from PostgREST.

| Pros | Cons |
|---|---|
| Matches “lock the hosted door”; publishable key alone cannot enumerate or overwrite books | Join/Create must happen **after** sign-in (session first, then RPC) — fine with Q3 signed-in redeem |
| Stops today’s “anyone with the key reads Development rows” class of accident | Preview/debug with raw curl needs a signed-in JWT |
| Clear threat model for October | |

### Narrow anon exception (e.g. phrase lookup)

Allow `anon` to call one RPC or read one invite table by phrase.

| Pros | Cons |
|---|---|
| Could support “open link before sign-in” marketing flows | Phrase becomes a network secret again; scrapers can probe |
| | Easy to accidentally widen the exception |
| | Undermines deny-by-default story |

**Recommendation:** **No anon household REST.** Sign in first; then Create (owner) or Join (phrase/email as Q3).

---

## Acceptance matrix (books tables)

| Actor | households / snapshots | continuity_memberships | continuity_personal_snapshots | invite/revoke | DELETE |
|---|---|---|---|---|---|
| anon | deny* | deny* | deny* | deny | deny |
| authenticated, no membership | deny | deny (except join RPC if Q3) | deny | deny | deny |
| owner, matching env | allow household | allow household membership rows | own personal only | allow | deny |
| member, matching env | allow household | read household membership; no invite/revoke | own personal only | deny | deny |
| wrong environment | deny | deny | deny | deny | deny |
| revoked / inactive | deny | deny | deny | deny | deny |

\*If Q4 = no anon access.

## Non-scope

- Applying SQL before review approval  
- Production schema/data  
- Bank / Interac / cards  
- Hercules KV bind  
- Money command semantics  
- Hosted row deletion  

## Next

1. Jonathan picks **Q1**, **Q3**, **Q4** (after reading the pros/cons above).  
2. Implement executable `004` + matrix tests + client session sketch.  
3. Record **D-123**.  
4. Jonathan reviews → apply **004 to Development only** (Q5). Production separate.
