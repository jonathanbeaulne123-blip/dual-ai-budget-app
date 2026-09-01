# Hearth worksession — Offline sign-out and session revalidation

- **Status:** CLOSED — verified and approved for merge/deploy
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/signout-offline-recovery`
- **Baseline SHA:** `4c5b94320bd2d55c6b80411924abb2f0db2296a7`
- **Head SHA:** pending release commit from this verified packet
- **PR or issue:** none
- **Risk:** High — Auth continuity and this-phone access clearing
- **Decision owner:** Jonathan
- **Environment impact:** Development client only; no hosted mutation

## Household outcome

A person can always sign this phone out, even while background continuity or Google work is busy or offline. Hearth clears this device immediately and only returns to Google when Supabase has positively rejected the refresh credential, not because the network is unavailable.

## Budget delta (5)

`+2` — a stuck Auth refresh cannot strand a person in an old account or block account recovery; local books remain accepted but inaccessible after sign-out until the account is opened again.

## Engagement delta (3)

`0` — this is account-recovery infrastructure; no companion behavior changes.

## Verified baseline

- Account and welcome sign-out buttons use the broad `busy`/Google working state, which can be held by background network work.
- The clear-this-phone path is intended to be local-only, but its UI waits on the shared busy state.
- A rejected Supabase refresh currently clears the token and reports that Google must be used again; it does not automatically return to the Google OAuth entry.
- Supabase documents local session sign-out as browser-local and recommends explicit local scope for current-session behavior; Hearth’s token store is already this-phone/local-only.

## Scope

### In scope

- Keep all sign-out entry points available during background busy/offline states.
- Clear this-phone Auth/UI authority before any slower local cleanup can finish.
- Automatically begin Google OAuth only after an explicit refresh-credential rejection, with cancellation-safe protection against an intentional sign-out racing a refresh.
- Add focused unit coverage and document the behavior.

### Out of scope

- Hosted token revocation, schema, RLS, Google scopes, household/cloud deletion, Production, deployment, or changes to Confirm/money behavior.

## Acceptance evidence

- [x] Sign-out is not disabled by generic connection activity.
- [x] Intentional sign-out cannot trigger a late automatic OAuth redirect from an in-flight refresh.
- [x] 400/401 refresh rejection clears this phone’s token and starts one Google revalidation redirect when configured in a browser.
- [x] Network/5xx refresh failures preserve the local session and do not redirect.
- [ ] Re-run the remote safety gate after placing the third heavyweight synthetic fixture in the serial lane; every test remains required.

## Plan

- [x] Inspect the current sign-out and Auth-refresh routes.
- [x] Implement bounded local-clear and revalidation behavior.
- [x] Run focused verification, TypeScript, production build, independent review, and the full check.

## Evidence log

- Baseline inspected from `origin/main@4c5b94320bd2d55c6b80411924abb2f0db2296a7`.
- Focused Auth/entry verification: 5 files, 37 tests passed (`auth-account-flow`, `supabase-auth-session`, `first-entry`, `storage-replicas`, `test-lanes`); TypeScript passed.
- Local `pnpm check` passed with two contended synthetic fixtures in the serial lane: fast lane 211 files / 1,434 tests passed (2 skipped); serial lane 16 files / 131 tests passed (1 skipped); TypeScript, Vite production build, and Hercules Pro UI build passed. The remote four-worker runner then timed out `demo-suite` at its fixed 60-second test limit, so it joins that guarded serial lane for the follow-up release.
- Independent Auth review identified and then verified the cancellation race closure; no remaining Auth/session safety finding after the follow-up.

## Decisions

- “Absolutely necessary” means the refresh endpoint rejected the credential (400/401), not that an offline or server-error attempt failed.
- Sign-out stays this-phone-only and does not wait for, call, or mutate the cloud.
- A sign-out advances the account-flow generation. Any older discovery/open operation stops before it adopts UI or persistent account state; local cleanup completes, but cannot activate another old replica.

## Remaining uncertainty

- Live Google OAuth return still needs Jonathan’s Development-device smoke after a later authorized deployment.

## Handoff

Jonathan authorized the reviewed packet for merge and deployment. The post-deploy Google OAuth return remains a Development-device smoke.
