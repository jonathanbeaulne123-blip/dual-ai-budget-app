# Hearth worksession — Realtime Auth session lease

- **Status:** OPEN — LOCAL RELEASE REVIEW PASSED; PR CI AND LIVE WITNESS PENDING
- **Opened:** 2026-09-05 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/realtime-session-lease`
- **Baseline SHA:** `58e90df5f40dfdba1399f6a8f35c8efe8fb62c15`
- **Head SHA:** pending
- **PR or issue:** pending
- **Risk:** Medium-High
- **Decision owner:** Jonathan
- **Environment impact:** Development only

## Household outcome

An open Development kitchen keeps its authenticated Realtime subscription current when the Hearth Supabase session renews. A changed JWT is admitted only after the original Google identity and current household membership are revalidated. A successful renewal schedules command-log catch-up; failure marks Realtime unhealthy so the existing reconnect and poll-recovery path takes over.

## Budget delta (5)

`+5` — removes the observed multi-minute gap where a durable Shared phone post did not reach the Mac while its stale socket still appeared subscribed.

## Engagement delta (0)

`0` — transport reliability only; no engagement surface or new prompt is added.

## Verified baseline

Facts:

- Development served exact merge `58e90df5f40dfdba1399f6a8f35c8efe8fb62c15`; Production continuity remained off.
- A phone Shared `postEntry` committed as hosted revision 27 at `2026-09-05T13:11:12.280807Z`.
- The visible Mac stayed behind until manual Google sync caused a Realtime reconnect and eventual snapshot adoption at `2026-09-05T13:16:01.008Z`.
- Hosted-write-to-Mac-apply latency was approximately `288727 ms`, so the required one-phone-write/other-device-read under one second failed.
- The Realtime-only Supabase client disabled persisted Auth and automatic refresh, set one access token at attachment, and exposed no ongoing Hearth session renewal to the socket.
- The installed Supabase Realtime client supports an async access-token callback and applies a changed token to joined channels from its heartbeat path.

Inference:

- The Mac socket could remain nominally subscribed after the JWT supplied at initial attachment was no longer a usable live authorization lease. Manual authentication activity recreated the channel, after which ordinary cloud recovery found the durable revision.

## Scope

### In scope

- Supply the existing Realtime client with the current Hearth Auth access token.
- Revalidate the original Google identity and active household membership before accepting a changed token.
- Schedule bounded command-log catch-up when the token changes.
- Mark renewal failure unhealthy and activate the existing reconnect/poll fallback.
- Add deterministic lifecycle, identity, membership, renewal, catch-up, and disposal regressions.

### Out of scope

- Financial command meaning, Final Confirm, accepted-books formulas, schema, migrations, RLS changes, hosted-row cleanup, secrets, provider settings, and Production continuity.
- A second socket, periodic sub-second REST polling, or merging websocket payloads directly.
- Claiming sub-one-second sync before a fresh deployed Mac-and-phone witness.
- The separate D-210 100-sample daily-use certification.

## Acceptance evidence

- [x] Focused token-provider and Realtime lifecycle tests pass.
- [x] TypeScript passes.
- [x] Medium-High quick gate passes.
- [x] Production build passes.
- [ ] PR CI passes.
- [ ] Jonathan separately authorizes merge and Development deployment.
- [ ] Fresh phone-to-Mac Shared write is accepted and painted in under one second.

## Plan

- [x] Capture the hosted revision, Mac adoption time, and Realtime reconnect evidence.
- [x] Isolate session-lease renewal as the failing boundary.
- [x] Implement identity- and membership-bound socket token renewal with command catch-up.
- [x] Add focused regression coverage.
- [x] Complete local verification and diff review.
- [ ] Open a PR and request the bounded release decision.
- [ ] If authorized, deploy only to Development and repeat the witnessed latency run.

## Evidence log

- `git diff --check` — pass.
- Focused Realtime/Auth/reconnect tests — 29/29 pass, including separate Supabase-user and Google-identity refusal cases.
- TypeScript — pass.
- Settled-diff Medium-High quick gate — pass in 64.6 s: 12 selected files, 79/79 fast and 44/44 serial assertions; diff hygiene, AI-surface verification, TypeScript, test discovery, local authorization matrix, and accepted-books proof all passed.
- Production build — pass: TypeScript, 478 Vite modules, Hercules Pro UI, and redirect guard; existing PGlite browser-external/eval and large-chunk warnings remain non-failing.
- Installed `@supabase/realtime-js` 2.112.4 source confirms callback-based token refresh runs on heartbeat and pushes changed access tokens into joined channels.

## Decisions

- Reuse the installed Supabase client's access-token provider contract so the active channel can update in place.
- Use Hearth's existing single-flight session refresh rather than a second token store or socket.
- Revalidate membership only when the JWT actually changes; initial attachment already requires a successful membership read.
- Catch up the command log after a token change because renewal itself cannot prove that no database event was missed.
- Preserve command-log materialization and snapshot recovery as the only receiver adoption paths.

## Remaining uncertainty

- Deterministic tests can prove renewal policy and callback lifecycle but cannot prove the hosted Supabase socket behavior or under-one-second paint. That requires the separately authorized Development deployment and physical Mac/phone witness.
- The exhaustive gate is not authorized for this exact SHA.

## Handoff

Codex owns implementation, focused verification, PR preparation, and the live retest after a separately authorized Development release. Jonathan owns the merge/deploy authorization. Production stays off.
