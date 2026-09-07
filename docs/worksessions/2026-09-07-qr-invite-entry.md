# QR invitation entry repair

- Status: local candidate, hosted migration and deployment not performed.
- Owner: Jonathan. Assignee: Codex.
- Branch: `codex/qr-invite-entry`; base `origin/main@fc786359cddcae62e83c0334db0e0844f4e95104`.
- Risk: High, changes invitation issuance and membership discovery.
- Budget delta (5): +1, preserves identity-bound access and books while removing a circular prerequisite.
- Engagement delta (3): +2, an owner can invite someone new and the recipient chooses their name at acceptance.

## Verified cause

`AuthInviteChrome` returned early unless another active roster person existed. Migration 017's `hearth_issue_invite` independently rejected a target absent from the snapshot roster. Removing only the UI gate would still fail on the server. Following successful redemption, legacy discovery also required that same roster row, including for frozen v2 metadata.

## Implementation

The owner chooses Someone new (default), issues QR/link or email, and sends the one-time invitation. An inactive, unbound, server-generated membership id reserves the place; it grants no access. The recipient signs in with Google, enters their name and explicitly accepts. Only redemption binds their identity and activates membership. Existing named seats and identity-bound rejoin rules remain available.

Migration 021 replaces the existing issue/redeem RPCs. It keeps owner/live-session checks, household locking, token hashing, expiration, email matching, role guards, idempotent redemption and two-person capacity. Reissuing for the unbound vacancy reuses its id, revoking the old pending token even when changing from co-owner QR to ordinary-member email. Third-member acceptance is refused under the same household lock. Nothing writes a household snapshot or bypasses the v2 fence. The six-argument compatibility RPC still delegates to the existing seven-argument function.

Current authenticated own-membership evidence can fill a missing local roster projection before existing discovery/Personal checks. This requires exact Auth user, household, environment and Google identity plus a supplied display name. Existing inactive roster entries are never reactivated. This does not invent authorization from a QR, name, snapshot or Google email alone. V2's existing authoritative roster reconciliation remains the server projection path.

Name acceptance uses the existing cancellable account-flow gate. A cancelled or superseded request cannot open its household or overwrite invite state afterward.

## Evidence

- Initial six-file focused set: 56/56 passed in 12.66 s (invitation, discovery, membership authority, v2 money authority, rehearsal mainline).
- Executable PostgreSQL/PGlite test runs actual 021 functions against a synthetic Auth/schema fixture. It proves inactive issuance without a second roster member, owner-only creation, recipient name, replacement-token revocation/role downgrade, repeat redemption and full-house/anonymous refusal. Helpers model Auth/session checks; hosted RLS and real Google OAuth are not proven by that fixture.
- Static React tests verify a one-person household can reach QR issuance and the recipient name step refuses an empty name.
- Discovery integration verifies a redeemed absent-roster member is visible while the input snapshot remains unchanged.
- Independent read-only review found replacement-token and asynchronous account-flow issues; both fixed before final gates.
- Final focused invitation/discovery/account-flow set: 12/12 passed, 8.92 seconds.
- High quick gate: 89/89 (63 fast + 26 serial), 79.569 seconds, no five-minute breach. Fingerprint `258f9f1251daec0011106178731997ac7c516b15c2b2a44092ec3c04f8c00118`; subsequent changes are evidence docs only.
- `pnpm exec tsc --noEmit`, `pnpm build`, `pnpm ai:verify`, and diff hygiene passed. `npx` is unavailable; pnpm exec runs the local TypeScript binary. Existing externalization/eval/mixed-import/large-chunk warnings remain non-failing.
- Required mounted App/startup regression: 27/27 passed, 30.52 seconds; rehearsal mainline passed in the six-file set.
- Independent re-review found both issues resolved and no remaining blocker in its bounded review.

## Boundaries / next action

No meaningful household data, credentials, provider calls, financial postings, hosted schema application, deployment or Production changes. No exhaustive lanes. This is not live two-account camera/OAuth proof. No claim that the deployed QR system is fixed yet.

The net addition includes the forward migration and its executable SQL tests; existing applied migrations are unchanged. Jonathan's explicit authorization is required to apply migration 021 and release the Development build. Apply the reviewed migration before deploying the nullable-target UI. After that, verify owner-only household → QR → fresh Google member → chosen name → shared household, plus old QR rejection and Personal isolation, on the actual deployed origin.
