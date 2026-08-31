# Auth invite smoke — Development kitchen

> **Purpose:** Repeatable manual proof for Auth Google → QR/email invite → redeem → discovery → PGlite acceptance on disposable Development data.
>
> **Not Production.** Paste hosted SQL only with Jonathan’s explicit approval. Credentials and secrets are never disposable.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Kitchen URL | https://hearth-books.jonathan-beaulne123.workers.dev |
| Environment pill | **Development** on both devices |
| Auth build | `VITE_SUPABASE_AUTH_ENABLED=1` on deployed kitchen |
| Hosted migrations | **006** (RLS), **010** (bind Google memberships), **012** (atomic continuity push, Auth path), **015** (delete/leave), **016** (Start from scratch bulk reset — **applied** 2026-08-27) |
| Two Google accounts | Owner + joiner (different `auth.users` / Google subjects) |
| Two browsers or phones | Normal incognito/private split is fine |

Apply missing SQL from `supabase/migrations/` in the [Supabase SQL Editor](https://supabase.com/dashboard/project/tykhocwacaxwquhynkok/sql/new). Success shows `Success. No rows returned`.

---

## Cleanup before a fresh run

When prior test households clutter the Google household chooser:

1. Hard-refresh the kitchen.
2. **Continue with Google** (owner or joiner).
3. **Live `main` kitchen:** tap **Start from scratch** (Development welcome or More) and confirm **Delete all Development households**, or tap **Delete** on each owned household (migration **015**).
4. Owner bulk delete (016) removes the cloud rows you own; member-only seats are left. This phone’s Development copies are cleared. Google stays signed in and **Create household** opens.

Migration **016** (`hearth_reset_development_households`) is applied. **Start from scratch** is on the live kitchen after #201. Production cannot be deleted here.

---

## Two-device QR invite smoke (D-150)

**Household outcome:** Partner scans a QR invite, signs in with Google, and opens the invited household in one pass — without “Invite accepted, but this device could not open the household yet” and without a Continue-with-Google loop on a stuck pending invite.

### Device A — owner

1. Open kitchen → **Development** pill.
2. **Continue with Google**, then **Create household** (or open an existing empty Development household you own).
3. **More → Invite** → choose partner roster member → **QR invite**.
4. Show QR (or copy join URL: `/join?invite=<64-hex>&env=development`).

### Device B — joiner (partner)

1. Open kitchen → **Development** pill.
2. Open the invitation link or choose **Join household → Scan invitation QR code**.
3. **Continue with Google** with the **invited** Google account (not the owner’s).
4. Confirm redeem succeeds, the authorized household chooser returns, and the invited household is highlighted as ready to open — not the discovery error and not an infinite pending-invite loop.

### Pass criteria

- [ ] Partner snapshot on cloud had **no** `google.links` row for the invited member before redeem (normal owner-publish lag).
- [ ] `hearth_redeem_invite` binds `continuity_memberships` for the joiner.
- [ ] Immediate discovery returns the **exact** household and member seat.
- [ ] Duplicate redeem / retry is **idempotent** (no error loop).
- [ ] Pending invite clears after success (re-opening kitchen does not force redeem again).
- [ ] The joined household opens only after the person chooses it, then passes **PGlite acceptance** (balances sane; no hash rejection toast).
- [ ] Wrong Google account, wrong environment, or wrong member seat are **rejected** (spot-check one negative if time allows).

### Optional second leg (continuity)

- [ ] Owner posts a balanced Confirm on Device A.
- [ ] Joiner sees the update on Device B within poll interval (or **100–500 ms** if D-149 Tier 1 Realtime is enabled — see [`SYNC_ARCHITECTURE.md`](SYNC_ARCHITECTURE.md)).

---

## Recorded pass — Jonathan, 2026-08-26

| Step | Result |
|---|---|
| Migration **015** pasted | `Success. No rows returned` |
| Test household cleanup | Delete buttons used before smoke |
| Two-device QR invite smoke | **Passed** — redeem, discovery, open, no pending-invite loop |
| Client fixes | **D-150** merged #180; delete/leave **#181** + migration **015** |

**Evidence type:** live Development kitchen, real Google accounts, disposable hosted rows. No Production mutation.

---

## Recorded apply — migration 016, 2026-08-27

| Step | Result |
|---|---|
| Jonathan order | “paste 016” |
| Apply | Supabase MCP `apply_migration` name `reset_development_households` on project `tykhocwacaxwquhynkok` |
| `public.schema_migrations` | id **16** present |
| MCP migrations list | apply-time version `20260827072847`; **retagged 2026-08-27 to `016`** so GitHub Preview matches `016_reset_development_households.sql` |
| Function | `public.hearth_reset_development_households()` exists; `SECURITY DEFINER`; `search_path=""` |
| Grants | `authenticated` EXECUTE **true**; `anon` EXECUTE **false**; ACL has no PUBLIC/anon |
| Household counts | Production **0→0**; Development **7→7** (reset RPC **not** called) |
| PostgREST | `NOTIFY pgrst, 'reload schema'` |

Kitchen Start-from-scratch chrome remains draft PR #201 (not the live `main` Worker).

**Still open on the broader Auth checklist** ([`HEARTH_ROADMAP.md`](HEARTH_ROADMAP.md) Phase 3): email-invite mismatch path, owner revoke UI, automated anon-denial matrix, wrong-household denial spot-checks as a formal suite.

---

## Related decisions

| ID | Topic |
|---|---|
| **D-151** | Start from scratch — Development-only bulk reset (016 applied 2026-08-27; kitchen UI PR #201) |
| **D-150** | QR redeem → membership-authoritative discovery (snapshot `google.links` may lag) |
| **D-149** | Tiered sync plan (Realtime + atomic SQL) — **separate** from invite discovery; see below |
| **D-123** | Auth + RLS cutover (006) |
| **D-143** | Membership is automatic continuity authority |

---

## What D-149 is (and is not)

**D-149** is the **sync speed and architecture** plan — how fast partner phones see each other’s confirmed books after Auth membership already works.

| Tier | Target |
|---|---|
| **Tier 1** (in progress) | **100–500 ms** partner visibility via Supabase Realtime push + Migration **012** atomic Shared+Personal SQL; 4 s poll becomes fallback |
| **Tier 2** | Command-log primary; confirmation-scoped undo; true interleaving |
| **Tier 3** | Optimistic UX + soft presence |
| **Tier 4** | Normalized hosted journal (research) |

Canon: [`SYNC_ARCHITECTURE.md`](SYNC_ARCHITECTURE.md). Slice prompts: [`briefs/sync/README.md`](briefs/sync/README.md).

**D-150 fixed the invite front door.** **D-149** is the highway after you’re inside — faster, safer two-device sync without bypassing PGlite or silent last-writer-wins.
