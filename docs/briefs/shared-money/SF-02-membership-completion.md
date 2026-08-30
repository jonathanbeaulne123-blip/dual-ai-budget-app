# SF-02 — Membership completion

**Target AI:** identity/continuity implementer
**Baseline:** accepted SF-01 head
**Risk:** Release
**Deltas:** budget `+2`; engagement `+1`

## Outcome

Two independently authenticated co-owners can join, see their correct scopes, revoke access, leave safely, recover, and inspect active devices/sessions without exposing partner-personal data.

## Tasks

1. Map owner/member/invite/session state transitions and deny all unrepresented transitions.
2. Complete email invite, revoke, anon denial, and wrong-household Development smoke harnesses.
3. Add member-initiated leave with an explicit consequence preview and recovery path.
4. Add device/session inventory and revoke. Revoked credentials must fail immediately or within a documented bounded interval.
5. Make last-owner and two-owner edge cases explicit; never silently orphan a household.
6. Add audit events that contain identity/action metadata, not financial or partner-personal payloads.

## Invariants

No shared login; no hidden admin; no UI-only privacy; exact Google subject/member binding; no phrase-only access to hosted personal data; revocation blocks reads and writes; private scope never enters Shared projections, exports, AI, alerts, or logs.

## Acceptance scenarios

- Jonathan invites Bianca; Bianca accepts with her own identity on a fresh device.
- Wrong Google subject, expired/replayed invite, anon request, and wrong household all make zero authorized data reads/writes.
- Either co-owner can revoke a device; former member cannot replay an outbox.
- Leave/rejoin/recovery and last-owner cases are deterministic and audited.
- Offline/reconnect behavior fails closed.

## Verification

Focused unit/integration tests, two-browser Development smoke with synthetic data, RLS/REST denial proof, accessibility at 390/720/1100 px, then `pnpm check`. No Production or real household mutation.

## Stop conditions

Any partner-personal leak, stale authorization after revoke, orphaned household, cross-environment call, or unreviewed remote migration is stop-ship.

## Local implementation result — 2026-08-30

**Status:** implemented and focused-tested locally on `codex/shared-money-program`; migration 017 is **unapplied**. Not pushed, merged, deployed, hosted, or live.

- Co-owner is the default invite role; ordinary member is explicit.
- Co-owners manage devices and ordinary members, cannot silently remove another co-owner, and cannot leave as the last owner.
- JWT `session_id` plus `auth.sessions` and the RPC-only device registry gate hosted membership; a revoked registry tombstone cannot be revived by the same session.
- Access inventory and audit expose structured identity/action metadata only—no email, Google subject, Auth UUID, token, balances, transactions, or Personal payload.
- Voluntary leave is separate from Development deletion. Server confirmation precedes local household/outbox removal; rejoin requires a fresh invite.
- Auth-enabled phones are locked to the Google-bound member. Existing household device rows remain visibly labelled soft presence, not Auth.
- Offline limitation is explicit: server revoke blocks cloud reads/writes and replay, but Hearth cannot erase a replica already cached while the phone is offline.

**Local proof:** final focused proof passed 6 files / 54 tests across membership, access UI, invite/discovery, Auth session, and Supabase connection contracts. TypeScript, production-build equivalents, diff check, and independent privacy/books reviews passed within their recorded local scope. The full Windows aggregate retains unrelated sanitizer-runner and nondeterministic generated-ID failures; exact evidence and isolated rerun results are in the SF-02 worksession.

**Open Release proof:** separately approved migration 017 Development apply; email, expired/replayed, anonymous, wrong-household, revoke/reconnect, former-member outbox, two-browser, RLS/REST, and 390/720/1100 visual/accessibility smoke. These open items prevent a runtime-complete or shipped claim.
