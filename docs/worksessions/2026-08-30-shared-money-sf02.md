# Hearth worksession — Shared Money SF-02 identity and household access

- **Status:** CLOSED — Development authority verified; merge/deploy gate in progress
- **Opened:** 2026-08-30 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** Hearth / Budget App
- **Branch:** `codex/shared-money-program`
- **Baseline SHA:** `eceb5ebaeb3db8d8494c0870579cc463859e8619`
- **Head SHA:** local closeout commit reported in the handoff (self-referential SHA is not embedded)
- **PR or issue:** none
- **Risk:** Release
- **Decision owner:** Jonathan
- **Environment impact:** migration 017 applied to disposable Development; hosted smoke rolled back; 0 Production households at apply

## Household outcome

Jonathan and Bianca can use independent Google identities as equal co-owners, see which authenticated devices can reach the household, revoke a device, leave safely, and understand recovery without exposing either person's private books.

## Budget delta (5)

`+2`: membership, session, and revocation authority become explicit prerequisites for dependable shared books. No new money movement or posting authority is added.

## Engagement delta (3)

`+1`: a calm access panel replaces invisible household access state and makes recovery comprehensible.

## Verified baseline

- Exact local baseline is SF-01 commit `eceb5ebaeb3db8d8494c0870579cc463859e8619`.
- Existing hosted membership is exact Google subject/email plus `continuity_memberships`; role is owner/member.
- Existing revoke and leave paths do not provide co-owner lifecycle, authenticated device inventory, or immediate per-device server denial.
- Existing `HouseholdDevice` rows are soft presence and are not Auth authority.
- Supabase access tokens can remain usable until their encoded expiry after sign-out; the JWT `session_id` maps to `auth.sessions.id`, so SF-02 must validate and gate that session server-side.
- Supabase CLI is unavailable in this checkout. Migration 017 was therefore applied through the authenticated Supabase SQL editor only after Jonathan's explicit authorization.

## Scope

### In scope

- Co-owner invite role and deterministic owner/member transitions.
- Session-backed device registration, sanitized inventory, immediate server-side device revocation, and metadata-only identity audit.
- Member revoke, voluntary leave, last-owner protection, rejoin/recovery copy, and former-member outbox denial.
- Lock the local member identity to the signed-in Google member whenever Supabase Auth is enabled.
- Unit/integration/source-contract tests plus canonical documentation.

### Out of scope

- Production data, secrets, provider activation, bank feeds, cards, or money movement.
- Remote erasure of data already cached on an offline device.
- Supabase dashboard configuration or global Auth session termination.

## Acceptance evidence

- [x] Independent authenticated co-owner invite and acceptance are represented end to end in the local client/SQL contract.
- [x] Anonymous, wrong-household, former-member, and revoked-device reads/writes fail closed in the SQL contract.
- [x] A current owner can inspect sanitized access and revoke an authenticated device without seeing tokens, email, Google subject, or partner-private financial data.
- [x] A last owner cannot leave; an owner with another active owner can leave; rejoin requires a fresh identity-matched invite.
- [x] Auth-enabled UI cannot switch the signed-in phone into the partner's member identity.
- [x] Focused tests, TypeScript, production build equivalents, and repository checks are recorded honestly.

## Plan

- [x] Add migration 017 and pure transition policy.
- [x] Add session/device client APIs and JWT session identity.
- [x] Wire registration, access management, leave, and identity lock into the app.
- [x] Add focused tests and canonical D-176 evidence.
- [x] Run verification and a release-risk review without external mutation.

## Evidence log

- 2026-08-30: `supabase --version` and `pnpm exec supabase --version` are unavailable; no migration was generated or applied through the CLI.
- 2026-08-30: official Supabase Auth/RLS documentation refreshed before design; `session_id` is the server-verifiable session handle, while sign-out alone does not retroactively invalidate an already-issued access token.
- 2026-08-30: final focused gate passed 6 files / 59 tests: Shared Money membership, access UI, invite chrome/discovery, Auth session, and Supabase connection contracts.
- 2026-08-30: `pnpm exec tsc --noEmit`, Vite production build (359 modules), Hercules Pro UI build, no-`dist/_redirects`, and `git diff --check` passed.
- 2026-08-30: semantic access-panel coverage passed at 320/390/720/1100 px in jsdom. This proves control/copy presence and focusability, not rendered visual or assistive-technology behavior.
- 2026-08-30: fresh release `pnpm check` reached 1,222 passed / 2 skipped / 1 failed. The sole failure is the unchanged API sanitizer harness because Git Bash cannot execute a working `python3` on this Windows host. No SF-02 focused failure remained.
- 2026-08-30: two independent read-only reviews closed eight stop-ship findings during implementation: last-owner concurrency, client-chosen device-ID collision, current-device local cleanup, Personal-snapshot reassignment, stale-invite role escalation, private audit execution, legacy six-argument invite compatibility, and reset-session bypass.
- 2026-08-30: final privacy verdict PASS with no P0–P2 findings. Final books/authority review found no P0–P2 code findings; its migration/hosted conditions were subsequently satisfied by the authorized apply and authority smoke.
- 2026-08-30: Jonathan explicitly authorized migration 017 apply to disposable Development, hosted smoke, and merge/deploy if green.
- 2026-08-30: preflight found migration history through 016, 2 Development households, 0 Production households, and no 017 tables. The exact committed migration (33,216 bytes; 718 lines; SHA-256 `6fd14ecde4755e346d8c46f510ea787d2f99a3a49bd98101f1ab66ce5b8839c1`) applied successfully.
- 2026-08-30: postflight proved migration 017 recorded, RLS enabled, anon/direct-table access denied, public authenticated RPC execution present, and authenticated private `identity_audit` execution denied.
- 2026-08-30: a transactional hosted smoke using two distinct existing Google principals returned `SF02_HOSTED_SMOKE_PASS`. It covered device registration, wrong-household/RLS isolation, co-owner QR accept/replay, sanitized access inventory, co-owner protection, stale-invite replacement, Personal-seat reuse denial, wrong-email denial, device/member revoke, revoked-session denial, last-owner block, safe leave, former-owner denial, audit redaction, and anonymous/private-schema denial.
- 2026-08-30: the smoke ended with `ROLLBACK`. Cleanup proof: 2 Development households, 0 Production households, 0 synthetic households, 0 registered sessions, and 0 audit events. Security Advisor refreshed with 0 errors and 18 expected guarded `SECURITY DEFINER` warnings.

## Decisions

- The new device registry is authorization state, separate from existing snapshot presence.
- Device revocation gates cloud reads/writes immediately but cannot claim to erase offline cached data.
- Equal co-owners may manage devices and ordinary members; one co-owner cannot silently remove another co-owner. A co-owner may leave only when another active owner remains.
- Client-visible access inventory is sanitized and metadata-only.

## Remaining uncertainty

- Supabase project Auth session settings and access-token lifetime remain external configuration to inspect at release time.
- The hosted authority matrix used two distinct live principals/sessions, but it was transactional SQL rather than a rendered two-browser client journey.
- Rendered 390/720/1100 visual, keyboard, screen-reader, and full two-device recovery behavior remain runtime evidence; semantic 320/390/720/1100 focus/control/copy coverage passed.

## Handoff

Codex completed the implementation, migration apply, hosted authority proof, cleanup proof, and release-candidate branch push. Jonathan authorized merge/deploy after the green smoke. The remaining action is fast-forward merge, deploy, and live-origin verification; SF-03 follows that gate.
