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
