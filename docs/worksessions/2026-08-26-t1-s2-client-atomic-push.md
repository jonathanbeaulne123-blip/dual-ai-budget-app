# T1-S2 handoff — Client atomic push

- **Branch:** `cursor/sync-architecture-c04e`
- **Depends on:** Migration 012 applied Development (Jonathan SQL Editor ✓)
- **Risk:** High (money transport)

## Household outcome

Auth-signed-in continuity pushes Shared CAS + Personal envelope in **one** `publish_continuity_snapshot` RPC. The “Shared succeeded, Personal failed” split window is gone for Auth sessions.

## Dual Course

- **Budget (5):** +2 — atomic client transport matches atomic SQL
- **Engagement (3):** +1 — prerequisite for reliable Realtime Tier 1

## Transport diagram

**Before (Auth-off two-trip bridge, unchanged):**
```text
publish_household_snapshot → POST continuity_personal_snapshots
                              (partial failure possible — D-147)
```

**After (Auth session + continuity member):**
```text
publish_continuity_snapshot (Shared + Personal + membership touch in one SQL TX)
```

**Create (Auth, revision 0):**
```text
hearth_create_household → publish_continuity_snapshot (duplicate heal Personal)
```

## Code changes

| File | Change |
|---|---|
| `src/ledger/supabase.ts` | `publishContinuitySnapshotAtomic`, `isMissingContinuityRpc`, Auth path routing |
| `test/auth-membership-authority.test.ts` | Atomic RPC tests |

## Gates

- Auth session required for atomic RPC (`authUserId` or `accessToken`) — matches SQL `auth.uid()` guard
- Missing `publish_continuity_snapshot` → fail closed (no two-trip fallback on Auth path)
- Auth-off automatic continuity keeps two-trip `publish_household_snapshot` + Personal POST until full Auth cutover
- Legacy Advanced recovery (`legacyLinkedPublish`, Auth-off) unchanged

## Verification

```text
pnpm exec vitest run test/auth-membership-authority.test.ts test/continuity.test.ts test/supabase.test.ts test/hosted-cas-two-client.test.ts → 42 passed
pnpm test → 666 passed (2 pre-existing batch-import-ui SubtleCrypto fails)
```

## Next owner

**Cursor — T1-S3:** Supabase Realtime subscribe; demote 4 s poll to fallback.
