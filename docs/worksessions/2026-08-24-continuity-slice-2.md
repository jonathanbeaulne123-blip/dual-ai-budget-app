# 2026-08-24 — Google continuity slice 2

**Status:** Implemented and pushed to PR #72 on `codex/cloud-continuity-correctness`; not merged, promoted to the Production kitchen, or applied to hosted schema. Cloudflare may automatically build the branch preview after a push.

## Baseline and authority

- Parent commit: `2e1d7902879955583969ffa825d3f7f57e997548`.
- Environment in scope: disposable Development data only.
- No Supabase schema, manual/Production Cloudflare deployment, Production data, credentials, or hosted rows were changed from this worksession. The connected Cloudflare bot automatically created a branch preview for the earlier PR commit.
- D-112 is the product target. D-113 records this temporary migration-free Development bridge.

## Delivered

- A fresh device with no local household can choose **Continue with Google**.
- Development scans the deliberately open snapshot table and returns every exact Google membership.
- A populated Google subject is authoritative. Email fallback is allowed only when the stored legacy link has no subject; a different subject cannot claim the same email.
- Production discovery makes zero requests until Auth/RLS exists.
- Discovered and reconciled snapshots pass PGlite/accounting acceptance before persistence or display.
- Signed-in accepted writes enqueue a durable local snapshot before cloud transport.
- Repeated offline writes compact to one latest snapshot per household while retaining the earliest expected remote revision and every confirmation id.
- Launch, window focus, and browser reconnection replay the outbox, then check for a newer matching cloud snapshot.
- Successful replay removes the outbox item exactly once.
- A stale remote revision blocks replay, keeps the queued local snapshot, retains the remote snapshot, and surfaces a visible conflict.
- Demo, empty, Pass, and households without a matching signed-in Google member retain the zero-continuity-network guarantee.

## Verification

- Focused continuity/command/transport proof: `3` files, `29` tests passed.
- Full serial suite: `45` files, `335` tests passed.
- TypeScript `--noEmit`: clean.
- Production Vite bundle: succeeded.
- The build retains existing PGlite browser-external, eval, and chunk-size warnings.

## Honest limitations

- Hosted authority is still a full snapshot rather than an append-only journal or command log.
- Development discovery downloads open snapshots before client-side membership filtering. This is intentionally not the security architecture.
- The local app stores one active household snapshot per environment. Discovery can list multiple memberships, but multi-household offline storage/switching remains.
- **Personal** remains a member-filtered view of a household snapshot, not a dedicated hosted personal ledger.
- CAS is GET-then-compare-then-POST and retains the known race until a reviewed atomic server boundary is wired.
- The localStorage outbox is durable across relaunch but has browser quota limits and does not yet implement exponential backoff or explicit server acknowledgements.
- A blocked conflict requires a future explicit conflict-resolution workflow before its queued snapshot can replay.
- Browser-level two-device end-to-end proof remains; current proofs are deterministic unit/integration tests.

## Dual Course

- Budget delta (5): `+3` — offline acceptance is recoverable, pulled books are validated, and stale replay retains both sides.
- Engagement delta (3): `0` — continuity is trust infrastructure; Hercules and office chrome were intentionally unchanged.

## Next slice

1. Store multiple household replicas locally and add an explicit ledger switcher.
2. Add a dedicated durable personal-ledger scope.
3. Add hosted identity/membership rows and server-side discovery.
4. Replace snapshot GET/POST CAS with atomic acknowledged command or journal transport.
5. Add backoff, acknowledgement, conflict resolution, and deterministic two-browser offline/reconnect tests.
6. Prepare the reviewed late-September Auth/RLS migration and rollback; do not apply it as an ordinary code task.
