# Hearth worksession — QR auto membership entry

- **Status:** OPEN
- **Opened:** 2026-08-31 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/qr-auto-match`
- **Baseline SHA:** `201a449cb99251c8a66eb3b282d950305752d1f1`
- **Head SHA:** local branch commit (not pushed)
- **PR or issue:** none
- **Risk:** Release (Google Auth household-entry boundary plus a forward Auth RPC migration)
- **Decision owner:** Jonathan
- **Environment impact:** client code plus shared Auth RPC schema if separately approved; Production continuity remains disabled

## Household outcome

Scanning a valid household QR opens the Google account chooser. The chosen Google identity claims the invite's exact available Jonathan/Bianca seat and, after membership-backed discovery plus PGlite acceptance, enters that household automatically. If the seat has already been claimed, Hearth shows a clear full-house confirmation and returns to the main Google entry screen without deleting the local replica.

## Budget delta (5)

`+3` — removes a broken household-access path while retaining exact membership, environment, household/member, and PGlite acceptance gates. No financial writer or CAD calculation changes.

## Engagement delta (3)

`+2` — one-pass QR onboarding and a calm, explicit full-house exit replace a confusing membership warning.

## Verified baseline

- Exact baseline is clean `origin/main@201a449cb99251c8a66eb3b282d950305752d1f1` after rebasing over the P0-03 evidence-foundation merge.
- QR invitations already carry a one-time token for an exact household member seat.
- `hearth_redeem_invite` already requires a live Google/Supabase session and refuses an occupied target with `target-unavailable`.
- The current client preserves a pending token across OAuth, but QR entry does not force Google login when a local household is already open.
- Successful redemption currently highlights a chooser card and waits for a second Open action.
- Full-seat refusal currently falls through to generic invite error chrome.

## Scope

### In scope

- Force the Google account chooser for QR links and camera-scanned Auth QR tokens.
- Preserve the invite token and environment across OAuth.
- Auto-open only the exact household/member returned by successful invite redemption.
- Retain membership discovery, identity overlay, environment binding, and PGlite acceptance before adoption.
- Present a full-house confirmation only when the server confirms both household seats are assigned.
- On confirmation, clear only entry/session pointers and return to the main Google screen while preserving named local replicas.
- Focused regressions, full check, decision why-note, and independent review.

### Out of scope

- Ordinary Google sign-in auto-open; it remains chooser-first.
- New membership tables or RLS policies; applying the forward migration to hosted Supabase remains separately gated.
- Email-invite redesign.
- Production continuity, household-row mutation, secrets, push, merge, or deployment.
- Removing or resetting any local or hosted ledger.

## Acceptance evidence

- [x] A QR link starts Google OAuth with account selection even when a cached household is open.
- [x] A camera-scanned Auth QR follows the same Google-first path.
- [x] A successful redeem opens only the returned household/member and crosses PGlite acceptance first.
- [x] Ordinary Google sign-in still shows the household chooser.
- [x] A server-confirmed two-seat household shows “This house is full”; a single occupied target is not mislabeled full.
- [x] Confirming the full-house notice returns to the main Google entry screen and preserves named replicas.
- [x] Wrong environment, wrong seat, missing/expired token, non-Google identity, and server refusal remain fail-closed.
- [x] Focused tests, the full test suite, TypeScript, and the production build pass on the rebased candidate.

## Plan

- [x] Trace URL/scanner → OAuth → redeem → discovery → PGlite open.
- [x] Implement QR-specific Google chooser and exact auto-entry.
- [x] Implement full-house confirmation and non-destructive return.
- [x] Add focused regressions and run the first Auth/storage/entry proof (59 passed plus TypeScript).
- [x] Run the broader focused set and the full check components.
- [x] Complete trust and verification reviews.

## Evidence log

- 2026-08-31: Supabase current Auth documentation confirms provider OAuth and additional provider query parameters; no relevant Google-login breaking change was found in the current changelog.
- 2026-08-31: Read-only source trace found the existing server seat authority in migration 017 and the client gaps in `App.tsx`.
- 2026-08-31: Rebased over clean `origin/main@201a449`; focused QR/Auth/replica proof passed 74/74 plus TypeScript.
- 2026-08-31: Full Vitest proof passed 210 files / 1,409 tests with 2 files / 3 tests skipped by their existing gates; `ai:verify` and the production build also passed. On Windows, the build needed Git Bash plus a temporary untracked pnpm shim for the repository's POSIX script; the shim was removed and the candidate returned clean.
- 2026-08-31: Independent Auth/privacy, client UX, and release reviewers reported no remaining P0–P3 findings after exact household+member matching and identity-free full-house copy were enforced.

## Decisions

- QR invitation entry is a narrow exception to D-182 chooser-first behavior. Ordinary sign-in remains chooser-first.
- The QR never trusts a typed/display email as authority. The live Google identity plus server invite redemption remain authoritative.
- “Full” derives from the server's locked count of two active Google-bound seats, not client-side household guessing. An occupied target with another open seat remains a distinct invite error because QR authority stays exact-seat.
- Migration 018 replaces only the existing redeem RPC so a consumed invitation can return the bounded `house-full` reason without exposing either member's identity. It is source-only until Jonathan separately approves hosted application.
- Returning to Google entry deactivates only the device's current selection; the named local replica remains stored.

## Remaining uncertainty

- A real two-account Google redirect cannot be completed in local automated tests. Release remains blocked on Jonathan-authorized deployment plus a live Development canary.

## Handoff

Codex owns local implementation and proof. Jonathan remains the decision owner for push, merge, deployment, hosted changes, and live-account acceptance.
