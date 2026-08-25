# Hearth worksession — App Store sync UX (P0+P1)

- **Status:** MERGED ([PR #114](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/114) → `main` @ `3dcb12f`)
- **Opened:** 2026-08-25 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor Cloud Agent
- **Branch:** `cursor/appstore-sync-ux-f375`
- **Baseline SHA:** `83a1974` (`main`)
- **Head SHA:** branch tip (see PR #114)
- **PR:** https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/114
- **Risk:** High (sync recovery UX + auth session chrome; money conflict presentation)
- **Decision owner:** Jonathan
- **Environment impact:** Development client; no hosted schema apply

## Defaults (ask if wrong)

| # | Decision | Default used |
|---|---|---|
| P0-3 | Undo durability | Persist last 20 ledger Undo tokens per env+household+member in localStorage |
| P0-4 | Auth tokens | Web keeps localStorage; Sign out clears Auth+Google tokens; native Keychain = later Release note |
| P0-5 | Account deletion | Sign out + clear this phone; honest copy that cloud household remains; no full cloud wipe RPC |
| P1-6 | Pairing | Invite card + collapsed Advanced details |
| P1-7 | Sync model | Derive Pairing/header from sharing + outbox + Auth session |
| P1-10 | Personal pull | Pull personal snapshot during live replay for current member |
| P1-11 | Restore tip host | After append, bump+enqueue tip publish (or mark pending until hosted) |
| P1-12 | Restore privacy | Strip Personal from restore point shared payload |

## Scope

P0 then P1 from App Store sync deep dive. Attempt new tests; assume unrelated waiting tests pass.

## Verification

- Focused: `test/appstore-sync-ux.test.ts`, `test/undo-history.test.ts`, undo-restore, command-surface, conflict-cas
- `pnpm check` — 526 tests + build passed
- Two-phone live Auth smoke still outstanding (needs real devices)
