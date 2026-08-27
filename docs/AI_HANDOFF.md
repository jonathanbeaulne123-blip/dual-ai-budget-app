# AI Task and Handoff Standard

## Invite owner first create (D-149 / D-123) (2026-08-27)

**Status:** Branch `cursor/invite-owner-first-create-5958`, draft [PR #209](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/209). Head `03cb3f5`. Baseline `main@ef3274a`. Risk: **High** (Auth/RLS/membership path; money meaning unchanged). Not merged. No schema apply.

**Household outcome:** The person who starts a household can send a Google invite. Command-log must not skip `hearth_create_household` on the first cloud write.

**Budget delta (5):** `+2` — partner invite is the door to shared books.

**Engagement delta (3):** `+2` — Invite waits for share instead of a false “only the owner” warning.

**What changed:** `shouldUseCommandLogFlush` returns false when `expectedRevision === 0`, so the first write uses `pushSupabaseHousehold` → `hearth_create_household` (owner membership). Invite Issue stays disabled while sharing (`syncState === "syncing"` or `sharing.mode === "pending-transport"`). Compacted later writes keep `expectedRevision === 0` and still create.

**Verification:** Focused `pnpm exec vitest run test/continuity-command-outbox.test.ts test/auth-invite-chrome.test.ts` → 26 pass. Full `pnpm check` on `f5c6649` → `pnpm ai:verify` green; **868 passed / 2 skipped**; `pnpm build` green. Independent reviews: privacy **PASS WITH NOTES** (P3 proof gaps; compact-0 test added after); trust **PASS WITH NOTES** (P1 handoff filled here; P2 pending-transport gate added); books **PASS WITH NOTES** (assert 012 on first-create); UX **PASS WITH NOTES** (live region always in DOM).

**Data/environment:** Development client/docs only. No hosted SQL, secrets, Production rows, or deploy. Fictional Development fixtures in tests.

**Next owner:** Jonathan — review/merge PR #209; hard-refresh the kitchen; Retry now if a leftover household is still sharing, then Issue.

## Start from scratch — Development household reset (D-151) (2026-08-27)

**Status:** Merged via #201 onto `main` (`ef3274a`). Risk: **High** (hosted Development delete/leave; Production blocked). Migration **016 applied** 2026-08-27. RPC **not** invoked during apply.

**Household outcome:** One Confirm deletes every disposable Development household this Google account owns, leaves member-only seats, clears this phone’s Development copies, and opens Create household while Google stays signed in.

**Budget delta (5):** `+2` — leftover test ledgers cannot be mistaken for September books.

**Engagement delta (3):** `+2` — one Confirm instead of tapping Delete on every household.

**What changed:** `hearth_reset_development_households` (016) is live; **Start from scratch** is on the Development welcome home and the first card in More.

**Verification:** 016 metadata apply (Production 0→0, Development 7→7, anon EXECUTE false). Kitchen bundle includes Start from scratch after merge/deploy.

**Data/environment:** Hosted Development schema (016). No household wipe, secrets, or Production rows during apply.

**Next owner:** Jonathan — hard-refresh live kitchen → Development pill → **Start from scratch** (welcome or More) when wiping leftover test households.

## T3-S4 scale envelope (2026-08-27)

**Status:** Branch `cursor/t3-s4-scale-envelope-403c` (draft PR). Risk: **Medium** (policy + scheduling honesty; no money meaning change).

**Household outcome:** Named 2–9 / 10–49 / 50–100 poll bands with Realtime primary; D-121 chat limits untouched; explicit refusal to claim 100-person Production on poll alone.

**Budget delta (5):** `+1` — calmer REST under larger N when Realtime is down.

**Engagement delta (3):** `0` — honesty/docs; no new interactable.

**What changed:** `continuityLivePull.ts` (`SCALE_PULL_BANDS`, `scaleEnvelopeClaim`, `activeMemberCountHint`); App recomputes band each poll tick; `SYNC_ARCHITECTURE` scale table + load-test notes; live-pull tests.

**Verification:** `pnpm exec vitest run test/live-pull-dual-use.test.ts test/continuity-resume.test.ts` → 22 pass; full `pnpm check` → 857 pass.

**Data/environment:** Development client/docs only. No schema, secrets, Production, or D-121 retune.

**Next owner:** Jonathan — review/merge; no 100-person load harness in this slice.

## T3-S3 background sync polish (2026-08-27)

**Status:** Merged via #204 onto `main`; kitchen deploy Version `1fa56e20-4d07-4cbf-95e4-6e9774db3017` verified (Offline badge strings live). Risk: **Low**.

**Household outcome:** Returning to the kitchen resumes share without double focus+visibility churn; Realtime flaps back off the REST poll instead of heartbeat-spamming; Offline badge says when share will resume.

**Budget delta (5):** `+1` — calmer reconnect preserves outbox/poll honesty without changing command posting.

**Engagement delta (3):** `+1` — less sync noise when flipping apps; clearer Offline chrome.

**What changed:** `src/continuityResume.ts` (coalesce + reconnect poll backoff); App continuity loop uses resume gate; offline freshness copy; soft-presence comment (no focus heartbeat); tests.

**Verification:** `pnpm check` green on PR; live bundle contains `Offline · will sync when you're back`.

**Data/environment:** Development client only. No schema, secrets, Production.

**Next owner:** Optional tab-hide/show + airplane-mode smoke.

## T3-S2 soft presence (2026-08-27)

**Status:** Merged via #202 onto `main` and kitchen deploy verified. Risk: **Low–Medium** (privacy UX).

**Household outcome:** Calm “Bianca is in the kitchen” chrome for signed-in partners. Optional Realtime presence when Development Realtime is on; D-100 devices remain the durable fallback. Opt-out: “Hide that I'm in the kitchen.”

**Budget delta (5):** `0` — presence never posts money or carries personal ledger rows.

**Engagement delta (3):** `+2` — soft shared kitchen presence without surveillance ranking.

**What changed:** `softPresence.ts`, `softPresenceRealtime.ts`, `SoftPresenceStatus.tsx`; App stamp/share/track wiring (signed-in + throttle + opt-out); Pairing opt-out + member names; conflict merge uses `mergeDevices`; tests.

**Verification:** `pnpm exec vitest run test/soft-presence.test.ts test/soft-presence-realtime.test.ts`; privacy-auditor **PASS WITH NOTES** (Dev presence topics not membership-private — accepted until private channels; opt-out now flushes inactive device row).

**Data/environment:** Development client only. Presence payload is memberId/deviceId/seenAt. No schema, secrets, Production, or deploy.

**Next owner:** Optional two-phone smoke with Realtime on; confirm opt-out hides self.

## T3-S1 optimistic command chrome (2026-08-27)

**Status:** Merged via #200 onto `main`. Risk: **Medium** (UX only; CommandOutcome unchanged).

**Household outcome:** Linked Development confirms feel instant: Saving → This phone → Cloud → Household progress rail; success toast still waits for PGlite accept; background flush upgrades chip to Up to date.

**Budget delta (5):** `+1` — honest progressive sync chrome reduces false “posted to cloud” belief.

**Engagement delta (3):** `+2` — confirm path feels responsive without celebrating before books accept.

**What changed:** `commandProgress.ts`, `CommandProgressStatus.tsx`, `App.tsx` commit/flush wiring, styles, `test/command-progress.test.ts`.

**Verification:** `pnpm exec vitest run test/command-progress.test.ts test/command-surface.test.ts` → 12 pass; `pnpm check` green.

**Data/environment:** Development client only. No schema, secrets, Production, or deploy.

**Next owner:** Done on main — optional manual confirm smoke.

## G6 Tier 1 proof gaps — Migration 012 harness (2026-08-27)

**Status:** Merged via #197 onto `main`. Risk: **High** (hosted continuity transport proof; no money meaning change).

**Household outcome:** T1-S5 two-client harness exercises the same Auth + Migration 012 atomic publish path production uses, and inbound Realtime pulls accept through `acceptHouseholdWrite` like `App.tsx`.

**Budget delta (5):** `+2` — proof that shared CAS and personal envelope commit atomically in tests before T2 planning continues.

**Engagement delta (3):** `+1` — partner visibility harness now matches live transport semantics.

**What changed:** `src/ledger/continuityCasHarness.ts` (in-memory 012 CAS + fetch stub); `continuityTwoClientHarness.ts` Auth config, 012 stub, `acceptHouseholdWrite` on pull; `test/continuity-cas-harness.test.ts`; `scripts/smoke-continuity-cas.mjs` + `pnpm books:smoke:012`; G6 worksession doc update. Includes cherry-picked T6 build fix (`setShowConflictSheet` removal fallout from #194).

**Verification:** `pnpm exec vitest run test/continuity-cas-harness.test.ts test/continuity-two-browser-proof.test.ts` → 13 pass; full `pnpm check` green. P1-4 confirmed live Jonathan SQL Editor 2026-08-27.

**Data/environment:** In-memory Vitest + optional live Development smoke (JWT required). No schema apply, secrets, Production, or deploy.

**Next owner:** Optional `SUPABASE_ACCESS_TOKEN=… pnpm books:smoke:012` on Development.

## Auto-resolve sync conflicts — no blocking modal (2026-08-27)

**Status:** Branch `cursor/auto-sync-conflict-resolve-12ce`, draft PR. Risk: **Medium** (sync UX + conflict resolution policy).

**Household outcome:** Sync divergences resolve behind the scenes. The “Two versions need review” sheet is gone; when share hiccups, users see **Retry now** / background sharing chrome only (T1-S6 freshness UI continues separately).

**Budget delta (5):** `+2` — automatic conflict resolution preserves local books, absorbs disjoint shared money, and never silent-LWW on command-log replay.

**Engagement delta (3):** `+2` — removes blocking conflict modal; sync feels continuous.

**What changed:** `autoResolveSharedConflict` in `src/core/conflict.ts`; wired through `api.ts`, `commandRuntime.ts`, `App.tsx` replay loop; `ConflictResolution` modal removed; `commandSurface` maps conflicts to Retry; command-log materialization defers same-id conflicts without overwrite.

**Verification:** `pnpm test` 822 pass; `pnpm check` green.

**Data/environment:** Development client only. No schema, secrets, Production, or deploy.

**Next owner:** Jonathan — review/merge PR; optional two-phone smoke on Development kitchen.

After a long thread, [WORKING_MEMORY.md](WORKING_MEMORY.md) recaps *this chat*. GitHub remains the full project context (D-095): [DECISIONS.md](DECISIONS.md), merged PRs, living specs, [nostalgia/](nostalgia/), [reference/](reference/). Do not treat unfinished chat as `main`. Do not skip GitHub history.

Cloud-continuity canon is [CLOUD_CONTINUITY.md](CLOUD_CONTINUITY.md): Google sign-in must reveal personal and household ledgers from any device, no peer device is the host, data through 2026-09-30 is disposable/open Development data, and the security cutover is mandatory before meaningful October data.

## Hercules Pro shift cloud sync after Reload (2026-08-27)

**Status:** Branch `cursor/hercules-pro-shift-cloud-sync-403c` (draft PR). Risk: **Medium** (continuity flush path + Pro diagnostics; no money meaning change).

**Household outcome:** Development Reload force-flushes harbour tip shifts into the hosted shared snapshot so Hercules Pro can read the same shift counts as Work report / free Hercules. Empty Pro answers include an explicit cloud snapshot check.

**Budget delta (5):** `+1` — Pro shift facts depend on the same posted shared ledger the books already show.

**Engagement delta (3):** `+1` — Pro stop saying “0 shifts” when the phone Work report is full after Reload.

**What changed:** `commitHousehold` / `persist` gain `forceFlush`; stress Reload awaits outbox flush and surfaces pending/conflict; `shift_summary` default period `this_month`; Pro Worker appends cloud shift counts on empty diagnostics; regression that shared projection keeps harbour shifts and matches Work report.

**Verification:** `pnpm exec vitest run test/stress-seed.test.ts test/hercules-pro.test.ts` → 17 pass. Demo script: shared cloud shifts == local; `shift_summary` matches `workReportFacts` this-month count.

**Data/environment:** Development client + Worker text only. No schema, secrets, Production, or deploy.

**Next owner:** Jonathan — merge, deploy Worker + app, Reload Development → wait until sync quiet / Retry now if pending → ask Pro “how many shifts this month.”

## Hercules rig engine — Worker route, MCP dispatch, furniture macros (2026-08-26)

**Status:** Branch `cursor/hercules-rig-engine-90cc`, PR #167. Risk: **Low** (presentation-only; no money, no ledger reads).

**Household outcome:** Remote agents and Hercules Pro can puppeteer the live kitchen cat part-by-part (head, tail, each leg). Desk instruments trigger layered rig macros when expanded on Home. Fly auto-deposit (PR #163) remains separate.

**Budget delta (5):** `0` — rig never posts money or reads books.

**Engagement delta (3):** `+2` — AI-controllable animation + furniture-reactive cat.

**What changed:** `src/herculesRig/` engine (parts, clips, validate, transport, macros); `HerculesFigure` inline transforms; Worker `POST /hercules/rig` + `GET /hercules/rig/poll` with KV/memory queue; MCP `hercules_rig_dispatch`; client poller in `HerculesRigProvider`; `HerculesOfficeRigBridge` on widget expand; [HERCULES_RIG.md](HERCULES_RIG.md).

**Verification:** `test/hercules-rig.test.ts` (10), `test/hercules-rig-validate.test.ts` (3), `test/hercules-rig-worker.test.ts` (2), `test/hercules-pro.test.ts` rig tool count (68 tools, 67 read-only) — all green. Full `pnpm test`: 675 pass; 2 pre-existing `batch-import-ui` SubtleCrypto failures unchanged on `main`.

**Data/environment:** Development client + Worker routes. No schema, secrets, Production, or deploy.

**Next owner:** Jonathan — review/merge PR #167; optional live deploy smoke of `/hercules/rig` + `hearthRig().sessionId()` + MCP dispatch.

**PR:** https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/167

## Phase 0 secure Flinks Connect inbox (D-148, 2026-08-26)

**Status:** Merged via #161 onto `main@efac0d2`. Risk: **High** (hosted Worker + bank evidence boundary).

**Household outcome:** Flinks supplies read-only bank evidence to the import inbox on Development. Connect uses Supabase bearer + membership scope, encrypted D1 state, iframe origin validation, HMAC-redacted inbox payloads, and DeleteCard disconnect. PR #160 `/flinks/sync` and browser LoginId storage are retired. Account-scoped category autofill from PR #160 remains in `prepareImportRows`. Final Confirm still posts money.

**Budget delta (5):** `+2` — secure bank evidence path without weakening Confirm or posting authority.

**Engagement delta (3):** `+2` — Import from Flinks returns on Batch Import with Connect + one-tap import after link.

**What changed:** `workers/flinks.js` (`/bank/flinks/*`), D1 migration, `FlinksConnectPanel`, `flinksClient`, `parseFlinksInbox`, Batch Import wiring, vite proxy, wrangler D1 binding. Minor fix: `documentScanner` SubtleCrypto digest for jsdom receipt tests.

**Verification:** Corrected Flinks + import triage + Batch Import UI 51/51. Full serial suite reached 686 pass / 2 skipped with one unrelated 30-second stress-fixture timeout; that complete stress file passed 7/7 with a 90-second allowance. TypeScript + production build, Wrangler dry run/startup profile, and non-traffic Cloudflare version `1d296d03-7776-4d72-add1-217dc718e377` are green. Live combined `main@10f466a` reports `sandbox-configured`; unauthenticated member access returns JSON `401`; legacy `/flinks/sync` returns `410`; the live bundle contains the Connect/fetch controls.

**Privacy review:** PASS WITH NOTES — Development scaffold only. Exact member scope, ownership-bound encrypted state, iframe origin/window and callback state, selected CAD accounts, bounded responses, provider-delete retry state, stable HMAC identifiers, and Final Confirm were rechecked. Server-side loginId attestation remains a Production follow-up.

**Data/environment:** Development only; Production activation is refused. No Supabase schema apply or secret values committed. D1 `hearth-flinks-development` is bound and migrated; five legacy PR #160 demo rows were preserved in a renamed legacy table. All five required Flinks values are secret bindings on the live Worker.

**Worksession:** [`worksessions/2026-08-26-flinks-connect-sandbox.md`](worksessions/2026-08-26-flinks-connect-sandbox.md), [`worksessions/2026-08-26-flinks-development-scaffold.md`](worksessions/2026-08-26-flinks-development-scaffold.md)

**Next owner:** Jonathan — live Flinks Connect smoke on deployed Development after merge.


## Phase 0 optional-publish demotion + hosted honesty (D-147, 2026-08-26)

**Status:** Implementation merged via #157 onto `main@2ee381e` (`ca70ce1`). Follow-up draft PR #158 realigns continuity tests that still assumed legacy GET-compare-POST. Risk: **High** (product) / **Medium** (follow-up tests).

**Household outcome:** Ordinary use never needs **Publish to the cloud**. Auth-off legacy publish is Advanced recovery only. Automatic continuity refuses a racy legacy upsert when CAS is missing, and Personal-scope failure after Shared CAS stays pending in the outbox.

**Budget delta (5):** `+3` — remove false Publish authority; fail closed on partial hosted writes.

**Engagement delta (3):** `+1` — Invite chrome matches the Google door.

**What changed:** `commandRuntime` transports only on `transportRequested`; Pairing demotes Publish; `supabase` Personal-fail honesty + refuse-legacy; `continuity` flush treats `pushed.error` as pending; Hercules concurrent rate tests + [HERCULES_KV_BINDING.md](HERCULES_KV_BINDING.md); [GITHUB_BRANCH_PROTECTION.md](GITHUB_BRANCH_PROTECTION.md); [WORKING_MEMORY.md](WORKING_MEMORY.md) reconciled.

**Verification:** Full `pnpm check` on the implementation branch → 658 pass / 2 pre-existing `batch-import-ui` SubtleCrypto fails. Follow-up #158: continuity/proof/live-pull/production/auth-membership 43/43 green after rebase onto post-#157 `main`. Privacy/books/UX auditors: PASS WITH NOTES.

**Data/environment:** Development client + Worker guard + docs. No schema migrate, secrets, Production, Cloudflare KV create, or GitHub ruleset apply (Jonathan).

**Worksession:** [`worksessions/2026-08-26-phase0-remaining.md`](worksessions/2026-08-26-phase0-remaining.md)

**PRs:** https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/157 (merged) · https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/158 (follow-up tests)

**Next owner:** Jonathan — merge #158 so main CI matches refuse-legacy; create `HERCULES_RATE` KV + deploy; apply branch ruleset; Create/invite smoke and two-browser E2E remain separate.

## Phase 0 evidence + membership tuple + hash acceptance (D-146, 2026-08-26)

**Status:** Merged via #156 onto `main@391e3af`. Risk: **High**.

**Household outcome:** Sheets-era issues/PRs have retained evidence; automatic continuity boundaries validate environment + Google membership; pulled/merged money cannot become active books on entry-count alone — PGlite and `financialAuditHash` must agree.

**Budget delta (5):** `+3` — fail-closed identity and books acceptance on discovery/pull/persist/outbox/switch.

**Engagement delta (3):** `0` — safety and tracker hygiene.

**Verification:** Focused `environment-isolation` + `hosted-transport` + `command-runtime` green; `tsc --noEmit` green; full `pnpm test` on branch.

**Worksession:** [`worksessions/2026-08-26-phase0-evidence-isolation-hash.md`](worksessions/2026-08-26-phase0-evidence-isolation-hash.md)

**Next owner:** Jonathan — review PR; remaining Phase 0: optional-publish removal, full atomic hosted stack, Hercules KV, branch protection, WORKING_MEMORY canon drift.

## Scheme A naming clarity (D-144, 2026-08-26)

**Status:** Merged via #154 onto `main`. Risk: **Medium**.

**Household outcome:** All chrome the household sees uses plain Scheme A labels (Groceries, Goals, Health, Sit-down, Shifts, Goals savings, Mark purchased). Only Hercules AI talk and Hercules Pro may use cat/kitchen metaphors, and those lines gloss the human money meaning.

**Budget delta (5):** `+2` — money controls stop sharing colliding metaphors.

**Engagement delta (3):** `+1` — Hercules keeps personality in AI/Pro only.

**Verification:** Focused naming/hercules/office tests green; `tsc` green; `pnpm build` green; `pnpm check` blocked only by pre-existing `batch-import-ui` SubtleCrypto failures on `main`. Phone CDP proof: seals Post/Due/Health; story Goals; Pad chips Groceries/Coffee; account Goals savings.

**Data/environment:** Development demo only; no schema/secrets/Production/deploy.

**Next owner:** Jonathan — naming is on `main`; no further action unless chrome regressions appear.

## Slim continuity outbox + gzip payloads (D-145, 2026-08-26)

**Status:** Merged via #155 onto `main`. Risk: **High**.

**Household outcome:** Large Development books can share without blowing browser `localStorage` quota. The durable outbox stores a slim tip pointer; flush publishes the live accepted household. Personal cloud envelopes may gzip; shared CAS snapshots stay plain JSON for live 006 SQL guards; legacy plain JSON still pulls.

**Budget delta (5):** `+3` — continuity transport reliability; prevents share stalls that diverge two phones’ books.

**Engagement delta (3):** `+1` — Retry/share stays honest under stress fixtures.

**What changed:** `src/ledger/snapshotPayload.ts` codec; shared CAS payloads stay plain JSON (006 SQL guards); personal envelopes may gzip; `continuity.ts` IDB-first slim durable outbox + tipRevision-aware live resolve; D-145 in decisions + continuity canon.

**Verification:** Focused vitest green; size demo fat outbox ~93KB → slim ~427B; personal gzip ~10.6% wire; books/privacy auditors passed on the PR.

**Data/environment:** Development client transport encoding only; no schema migrate, secrets, Production, or real household data.

**Worksession:** [`worksessions/2026-08-26-outbox-compress.md`](worksessions/2026-08-26-outbox-compress.md)

**PR:** https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/155

**Next owner:** Jonathan — after deploy, on the quota desktop tap **Retry now**; confirm banner clears and Bianca’s entry count / Assets converge.

## Auth membership continuity authority (D-143, 2026-08-26)

**Status:** Merged via #152 onto `main`. Live Create/invite smoke still open. Risk: **High**.

**Household outcome:** Automatic cloud share requires a Google continuity identity that matches an active household member. `linked` alone no longer publishes. Phrase remains Advanced recovery routing. Live anon REST stays denied; migration 010 bind RPC is live.

**Budget delta (5):** `+3` — membership is the only automatic write authority.

**Engagement delta (3):** `+1` — Continue with Google / Auth invites stay the normal door.

**Verification:** Focused vitest + `VITE_SUPABASE_LIVE=1` anon denial matrix. Signed-in Create/invite redeem still needs Jonathan.

**Worksession:** [`worksessions/2026-08-26-auth-membership-authority.md`](worksessions/2026-08-26-auth-membership-authority.md)

**Next owner:** Jonathan — Continue with Google Create/open, issue QR invite, redeem on a second session; Cursor continues S5 canon after smoke.

## Continuity outbox quota + Retry now (2026-08-26)

**Status:** Branch `cursor/fix-outbox-quota-retry-129b`; PR pending. Not merged, not deployed. Risk: **Medium**.

**Household outcome:** When the phone's browser storage is full, Hearth still keeps the share queue in memory (and IndexedDB when possible), shows a clear message instead of a raw `setItem` quota error, and **Retry now** can push the live books to the cloud — including when the durable outbox was emptied by quota.

**Budget delta (5):** `+2` — share path must work so Pro and other devices see posted shifts/journals; books stay local-first and Confirm remains the write boundary.

**Engagement delta (3):** `+1` — Retry now is honest and usable; no cryptic Storage exception in the banner.

**What changed:** `continuity.ts` memory+IDB outbox resilience, `humanizeContinuityError`, flush seeds `liveHousehold` on forced Retry; banner action is Retry now; `App.retryShareNow` no longer marks synced when nothing flushed.

**Verification:** `pnpm exec vitest run test/continuity.test.ts test/command-surface.test.ts` (+ related share tests).

**Data/environment:** Development code only; no schema/secrets/Production.

**Next owner:** Jonathan — on the phone showing the quota banner, tap **Retry now** after Google sign-in; confirm chip clears and Pro can read shifts after sync.

## Hercules read-only reconnect fallback (D-137 follow-up, 2026-08-26)

**Status:** Branch `codex/hercules-readonly-reconnect`; focused tests and TypeScript green, deployment/live proof pending. Risk: **Medium**.

**Household outcome:** A broad ChatGPT reconnect no longer blocks Hercules when writing is off. OAuth narrows `hearth.read hearth.write` to `hearth.read`; it does not change either member-owned write opt-in.

**Verification:** Rebased over #147; `test/hercules-pro.test.ts` + `test/continuity.test.ts` 19/19 and `tsc --noEmit` green. The branch corrects #147's stale `WorkPaySchedule` test fixture without changing runtime continuity. PR/main CI, Worker deploy, reconnect, and resumed PiP smoke remain.

**Worksession:** [`worksessions/2026-08-26-hercules-readonly-reconnect.md`](worksessions/2026-08-26-hercules-readonly-reconnect.md)

## Hercules Pro shift read repair (2026-08-26)

**Status:** Branch `cursor/fix-pro-shift-read-129b`; PR pending. Not merged, not deployed. Risk: **Medium**.

**Household outcome:** Hercules Pro can read the connected member's posted shift history from hosted snapshots the same way in-app Hercules can, including personal-envelope shifts and legacy household-stamped own shifts when ChatGPT uses the default Personal ledger.

**Budget delta (5):** `+1` — shared cloud overlay now matches the phone; shift/oracle read tools include the worker's own posted rows in Personal view without crossing partner-personal boundaries.

**Engagement delta (3):** `+1` — Pro tip/shift tools (`shift_summary`, Shift Oracle, sim/review packs) return facts instead of empty answers when cloud continuity has synced shifts.

**What changed:** `overlayPersonalReplica` / `personalEnvelopeFromPayload` moved to `sync.ts` and wired through `supabase.ts` + `herculesPro.js`; `householdForShiftReadTools` scopes shift reads; tests in `visibility.test.ts` and `hercules-pro.test.ts`.

**Verification:** `pnpm exec vitest run test/visibility.test.ts test/hercules-pro.test.ts test/hercules-tools.test.ts` green (29 tests). Full `pnpm test`: 624/626 green; 2× pre-existing `batch-import-ui` SubtleCrypto failures on `main`.

**Uncertainty:** Live ChatGPT smoke against a signed-in Development household with synced personal shifts not run in this VM. Jonathan's 2026-08-26 check showed `shift_summary` 0 on both Personal and Household — that matches **empty hosted snapshots**, not a period-filter bug. In-app Hercules reads local PGlite; Pro reads cloud only until sync completes.

**Data/environment:** Development code only; synthetic fixtures; no schema, secrets, Production, or deploy.

**Next owner:** Jonathan — on the phone with shifts: confirm Google sign-in, wait for sync (no pending/error chip), optionally More → Reload random data (keep identity) to seed stress shifts, then re-ask Pro. After merge+deploy, `cloudBooks.memberShiftCount` in shift tool responses shows hosted shift totals explicitly. Review PR.

## Hercules PiP auto-load (D-139 follow-up, 2026-08-26)

**Status:** Branch `codex/hercules-pip-autoload`; locally verified, deployment and connected-ChatGPT proof pending. Risk: **Medium**.

**Household outcome:** On the first user turn of a new Hercules Pro conversation, `summon_hercules` is the required first tool. Resource v3 requests picture-in-picture as soon as the optional ChatGPT bridge appears, while the animated inline card remains the fallback when the host declines or lacks PiP.

**Boundaries:** A blank chat cannot invoke an MCP tool before the person sends a message, and ChatGPT retains final display control. No accounting calculation, OAuth scope, write authority, schema, secret, Production data, or household row changed.

**Verification:** Rebased over the merged Pro synced-shift repair (`e768a6d`); focused 3 files / 22 tests, full 89 files / 627 tests, TypeScript, production build, Wrangler dry run, and diff check are green. Connector v3 and new-chat first-turn behavior remain to be verified after merge/deploy.

**Worksession:** [`worksessions/2026-08-26-hercules-pip-autoload.md`](worksessions/2026-08-26-hercules-pip-autoload.md)

## Hercules companion load repair (D-139, 2026-08-26)

**Status:** **Complete.** [PR #143](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/143) merged as `cb77cad`; main Worker deployment succeeded; connector refreshed to resource v2; live ChatGPT rendered the 3D model and reported `Hercules is listening`. Risk: **Medium**.

**Household outcome:** ChatGPT can fetch the animated companion across its sandbox boundary. A missing module, WebGL failure, or stuck GLB now resolves to the static Hercules mark instead of permanent `Waking Hercules…`.

**Boundaries:** Exact public JS/GLB/SVG assets only; URI v2 is the ChatGPT cache boundary. No ledger facts, OAuth, command authority, schema, secret, Production data, or household row changes.

**Verification:** 89 test files / 622 tests, TypeScript, production build, Wrangler dry run, PR/main CI, connector template v2, and live inline 3D card all green. Picture-in-picture is host-controlled; verified inline remains the fallback surface.

**Worksession:** [`worksessions/2026-08-26-hercules-companion-load-fix.md`](worksessions/2026-08-26-hercules-companion-load-fix.md)

## Stress reload weighted shifts (D-138, 2026-08-25)

**Status:** Follow-up branch `cursor/pro-legible-reload-85bf` (continuity preserve on Reload for Hercules Pro). Stress trends merged via PR #136; this packet keeps Google identity so Pro can read Reload fixtures. Not merged, not deployed. Risk: **Medium**.

**Household outcome:** More → Reload random data fills twelve months of complete Harbour Dining Room shifts with weather notes, Toronto GPS stamps, and weekday/season/weather-weighted tips so Hercules Pro can analyze realistic trends.

**Budget delta (5):** `+1` — same `postWorkShift` / settlement commands; every sales, tip, break, clock, and destination field filled; optional location/`occurredAt` stamps on work-shift rows.

**Engagement delta (3):** `+2` — reload fixture carries analyzable tip weather/location/weekday trends for Hercules Pro testing.

**Worksession:** [`worksessions/2026-08-25-stress-shift-trends.md`](worksessions/2026-08-25-stress-shift-trends.md)

**Verification:**
- `pnpm exec vitest run test/stress-seed.test.ts test/work-jobs.test.ts test/timezone-location.test.ts` → focused green (includes continuity-preserve Reload proof)
- `pnpm ai:verify` + `tsc --noEmit` + `vite build` green (re-run after continuity fix)
- Trend proof (seed `424242`): Fri/Sat tip/hr 1552¢ > Mon–Wed 1177¢; clearish 1557¢ > rainy 1020¢; 177 job-based shifts with Harbourfront stamps
- Full `pnpm check` fails 2× `batch-import-ui` SubtleCrypto digests on **this branch and `main`** (pre-existing; unrelated)
- Books auditor: PASS
- After merge with `main`: Pro `tools/list` expects companion + catalog + write (**64**)
- Continuity: Reload with `preserveFrom` keeps householdId / linked / Google links; tip shifts follow signed-in `tipMemberId`

**Pro fixture path:** Development → Google Create → Reload random data (keeps identity) → sync → Connect Hercules Pro → tip_oracle / shift_year_simulation. See `docs/HERCULES_PRO.md`.

**Data/environment:** Synthetic Development fixtures; no hosted schema, secrets, Production mutation, or peer-device requirement. Reload UI itself remains available when the env pill is Production (pre-existing).

**Next owner:** Jonathan: Development Google Create → Reload → sync → Connect Pro; smoke tip_oracle / year sim. Review this follow-up PR. Do not merge/deploy without approval.

## Shift year simulation + sandbox gate (D-140, 2026-08-25)

**Status:** **Merged** to `main` as [`6baf033`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/6baf033) via [PR #138](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/138). Not deployed/live-verified. Risk: **Medium**.

**Household outcome:** Hercules (free + Pro) can build a reproducible next-year tips+wages simulation from posted shifts and teach how it works. Python sandbox is designed as a later High-risk gate, not built.

**Budget delta (5):** `+2` — deterministic year Monte Carlo of tips and wages; never posts.

**Engagement delta (3):** `+2` — teachable year simulation for Pro and free Hercules.

**Worksession:** [`worksessions/2026-08-25-shift-year-simulation.md`](worksessions/2026-08-25-shift-year-simulation.md)

**What changed:** `runShiftYearSimulation` / `explainShiftYearSimulation` in `tipScience.ts`; tools `shift_year_simulation` + `explain_shift_simulation` on free Hercules (Worker planner + on-device) and Pro MCP; D-140 + sandbox gate in `HERCULES_PRO.md`; Pro `tools/list` = companion + catalog + write (64).

**Verification:** focused tip-science / hercules-tools / hercules-pro green on the packet; CI green before merge.

**Data/environment:** Development code only; fictional demo/stress data in tests; no schema, secrets, Production, or deploy.

**Next owner:** ChatGPT Pro smoke when convenient; Worker deploy remains separately gated.

## Environment isolation Phase 0 (2026-08-25)

**Status:** Merged to `main`. Follow-up branch `cursor/legacy-pull-env-bind-f375` closes the leftover legacy `readRemoteSnapshot` environment query filter and adds two-client clock-skew / partial-failure proofs.

**Budget delta (5):** `+2` (original) / follow-up `+1` — legacy pull scoped to env+household; fault harness covers clock skew + mid-publish failure recovery.

**Engagement delta (3):** `0`

**Verification:** focused vitest on `supabase` + `hosted-cas-two-client`; then `pnpm check`.

**Next owner:** Review follow-up PR; two-phone Auth smoke still needs devices.

## App Store sync UX P0+P1 (2026-08-25)

**Status:** **Merged** to `main` as [`3dcb12f`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/3dcb12f) via [PR #114](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/114). Not deployed/live-verified yet. Risk: **High**.

**What was examined:** Conflict sheet, Undo persistence, Sign out wipe, Pairing Invite/Advanced, command Retry, Restore tip host/privacy, personal live-pull.

**Verified findings:** Shared-only conflict impact; Undo scoped env+household+member (last 20); Sign out clears Auth/Google/session/undo/outbox/sync-anchor/pending invite + local household; restore tips strip Personal; Retry force-flushes outbox.

**Changes:** See PR #114 diff (`ConflictResolution`, `undoHistory`, `Pairing`, `App`, `restorePoints`, `continuity`, `supabase` personal pull).

**Budget delta (5):** `+3` — conflict impact honesty; durable Undo on this phone; Restore blast-radius + tip host + Personal strip; Retry flush; personal live-pull; complete Sign out local wipe.

**Engagement delta (3):** `+2` — Pairing Invite/Advanced; clearer sync chrome; Sign out clarity.

**Worksession:** [`worksessions/2026-08-25-appstore-sync-ux.md`](worksessions/2026-08-25-appstore-sync-ux.md)

**Verification:** focused vitest + `pnpm check` passed on packet. UI smoke on local Vite demo (Invite/Advanced, Recent copy, Sign out confirm). Two-phone Auth smoke still needs Jonathan/Bianca devices.

**Remaining uncertainty / decision needed:** Confirm worksession defaults if any are wrong. Two-phone Auth smoke on live Dev.

**Data/environment:** Development client only; disposable Dev data; no hosted schema/secrets/Production mutation; no peer device required online for Sign out.

**Next owner:** Two-phone smoke on live Dev; verify Workers deploy from `main` CI green.

## Combined undo + restore engine (2026-08-25)

**Status:** Branch `cursor/undo-restore-engine-f375` (not merged). Confirmation-scoped LIFO **Undo** (partner stays, auto CAS) + owner **Restore points** (D-124 shape in household payload). Dev last-sync whole-snapshot Undo retired.

**Budget delta (5):** `+3` — safe dual-use Undo; owner Restore; refuse while conflicted.

**Engagement delta (3):** `+1` — Undo vs Restore labels; Recent LIFO of my ledger writes.

**Worksession:** [`worksessions/2026-08-25-undo-restore-engine.md`](worksessions/2026-08-25-undo-restore-engine.md)

**Next owner:** Review PR; smoke Undo with partner post present; smoke owner Restore after sync.

## Live pull dual-use (2026-08-25)

**Status:** Merged via PR #109.

## Risk routing

| Risk | Examples | Default routing |
|---|---|---|
| Low | Copy, styling, docs | One implementer |
| Medium | Dialog, pure calculation, cosmetics that cannot post | Implementer plus a targeted review |
| High | Financial math, migrations, splits, account kinds, statement figures | Implementer plus independent review |
| Release | Switching daily use, hosted schema, auth/RLS | All reviewers, Jonathan approves |

## Hercules living teacher (D-132)

**Status:** implemented on `codex/hercules-living-teacher`; independent privacy/numeric review required before merge. No deploy, schema, hosted row, secret, or Production mutation.

**History finding:** `38af6ef`/`1055d56` are the compact floating-bubble lineage. `6e8e40d` added strong per-message widget snippets while ordinary chat stayed as plain transcript rows. D-132 adapts that per-message visual language without reverting grounded chat, request identity, or model safeguards.

**Budget delta (5): +2** — typed clickable book-source records; explicit Household versus Personal question projection; partner-personal refusal before aggregation/model transport; grounded food/spend/income/shift answers.

**Engagement delta (3): +3** — restored turn bubbles, legitimacy cards, teacher copy, and desktop fly/litter play. Fly piles are session-only and disappear on reload; mobile/reduced motion renders no fly.

**Next owner:** independent review of provenance routing, shared-member aggregation, personal-ledger refusals, and desktop/mobile visual behavior. Do not deploy from this branch.

## Hercules Sim + Review packs (D-142)

**Status:** Draft PR [#140](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/140) on `cursor/hercules-sim-review-packs-129b` (rebased onto `main` after D-138–D-141 landed). Not merged; not deployed; no schema/secrets/Production mutation.

**Baseline:** rebased onto current `main`. Worksession: [`worksessions/2026-08-26-hercules-sim-review-packs.md`](worksessions/2026-08-26-hercules-sim-review-packs.md). Decision renumbered **D-142** because `main` already used D-138–D-141.

**What landed:** `simReview.ts` with Cash Cinema, What-If Desk, Year-in-Review; three shared read tools; Pro MCP `usedTool` + answer prefix; full inventory [`HERCULES_PRO_CAPABILITIES.md`](HERCULES_PRO_CAPABILITIES.md); teacher skill names the tool. Pro `tools/list` is now **67** (companion + 63 reads + 3 write-path).

**Budget delta (5):** `+3`

**Engagement delta (3):** `+2`

**Verification:** focused `sim-review` + `hercules-pro` after conflict resolution; CI pending on merge commit.

**Next owner:** Independent trust review of forecast math + announcement contract; Jonathan merge decision. Do not deploy from this branch.

## Hercules Shift Oracle (D-137)

**Status:** Core Oracle **merged** to `main` via [#133](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/133). Schedule-weighting **merged** via [#137](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/137). Not deployed; no schema/secrets/Production mutation.

**Baseline:** Strategy 3 implementation from `main@6e2baea` lineage. Worksession: [`worksessions/2026-08-25-hercules-shift-oracle.md`](worksessions/2026-08-25-hercules-shift-oracle.md).

**What landed on main (#133):** deterministic `tipScience.ts` with seeded Monte Carlo tip floors, weather/season-adjusted outlook, cadence schedule sim, educational tax-milk/buffer; four shared read tools for free Hercules + Pro (`tip_oracle`, `shift_outlook`, `tip_schedule_sim`, `tax_milk_plan`); Bernoulli day cadence from today; order-stable observations.

**Follow-up (#137):** probability-weight `tip_schedule_sim` totals by weekday frequency; Pro `tools/list` count was 61 before D-138.

**Budget delta (5):** `+3` (merged) / follow-up `+1`

**Engagement delta (3):** `+2` (merged) / follow-up `0`

**Verification:** tip-science + hercules-pro focused suites green on follow-up; full check on this agent VM also hits 2 unrelated `batch-import-ui` SubtleCrypto failures.

**Next owner:** Development smoke in ChatGPT Pro + in-app Ask after D-138; do not deploy without approval.

## Hercules Brain v2 typed reads + free depth (D-133/D-135)

**Status:** implemented on `codex/hercules-brain-v2-tools`; no deploy, schema, hosted row, secret, or Production mutation. Built on the D-132 living-teacher branch so the result cards use its typed provenance UI.

**Shape:** `/hercules/plan` may select at most four of sixteen fixed read-only tools. Provider output is sanitized on the Worker and phone. The phone executes against `householdForHerculesContext`; Personal never widens to a partner and Household never exposes personal-only rows. There is no SQL, code, mutation, or Confirm capability. Planner failure preserves the existing chat/local fallback.

**Spend posture:** Workers AI is first for planning, grounded voice, and selected-image scanning. Gemma 4 is tried before Llama 3.1. OpenAI/Anthropic are inert unless `HERCULES_ALLOW_PAID_PROVIDERS=true`; checked-in Development configuration is `false`, including when provider secrets happen to exist. No Worker was deployed in this slice.

**Budget delta (5): +3** — grounded balances, searches, summaries, bills, shifts, goals, obligations, cash position, budget variance, categories, cards, net worth, audit health, and duplicate review compose without granting model write authority.

**Engagement delta (3): +3** — Hercules can answer broader natural-language financial questions, then gives the deterministic result a short grounded cat-voice pass while every shown amount remains a tappable legitimacy card.

**Next owner:** review catalog arithmetic/scope, provider plan parsing, and source routing; then smoke the four prompts in `docs/HERCULES.md`. Do not deploy from this branch.

Dual Course (D-048): if Course A (books, weight 5) and Course B (engagement, weight 3) disagree, the books win. A companion change that can touch CAD meaning is High, not Medium.

## Required handoff

Status, what was examined, verified findings, changes, verification, remaining uncertainty, decision needed. For continuity work also state the Google identity and ledger scopes, whether any peer device must remain online, offline/outbox behavior, hosted mutations, environment, schema, and whether data was disposable Development data.

Also name:

- **Budget delta (5)** — which posting, rec, sit-down, account-literacy, split-honesty, Health, or statement primitive moved.
- **Engagement delta (3)** — which Hercules line, unlock, chalkboard, wallet tile, ceremony, or Ask chip moved.

If either delta is “none,” say why Dual Course still holds (for example GitHub 2FA is Course A with no mascot on purpose).

Read [nostalgia/](nostalgia/) and [reference/](reference/) to understand past decisions. Do not cite them as the next build plan.

Sheets-era handoff notes (museum): [reference/sheets-era/AI_HANDOFF.md](reference/sheets-era/AI_HANDOFF.md).

## Development continuity slices (D-114 and D-117, PRs #72–#75)

**Status:** exact Google-subject Development discovery, PGlite acceptance, a durable compacting local outbox, launch/focus/reconnect replay, multi-household device replicas, an explicit ledger switcher, and member-only personal device replicas are implemented. Migration 003 is applied: D-117 server-filtered membership discovery and hosted member-personal payloads are live in Development; missing tables retain the D-114 fallback. Inherited broad grants were removed and verified as exactly `SELECT`/`INSERT`/`UPDATE` for `anon` and `authenticated`. No hosted rows, deployment, Production data, or secrets were changed.

**Still required:** two-browser end-to-end proof, Supabase Auth-bound membership, and the late-September deny-by-default RLS cutover. Migration 002 is live in Development; its forward concurrency repair is unapplied migration 005.

**Budget delta (5):** `+4` — accepted offline commands survive reconnection, pulled snapshots pass PGlite, stale remote revisions retain both sides, and locally switching households no longer overwrites a different ledger.

**Engagement delta (3):** `0` — account continuity is trust infrastructure; Hercules and office chrome were intentionally unchanged.

## Command states Slice A+B (D-119, PR #76 merged)

**Status:** Merged to `main` as [PR #76](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/76). Claude authored the UX/copy spec; Cursor Cloud Agent (GPT) implemented parallel Slice A (Add/Confirm a11y) and Slice B (command chrome, sync anchor, conflict choose) plus `App.tsx` integration. Jonathan resolved eight product defaults on 2026-08-24. Worksessions: [`2026-08-24-command-states-slice-ab.md`](worksessions/2026-08-24-command-states-slice-ab.md).

**Budget delta (5):** `+2` — command UI derives from `CommandOutcome`; Development undo/reverse restores last sync anchor; in-app conflict choose without silent LWW.

**Engagement delta (3):** `+1` — accessible Add sheet, honest chip/banner/toast copy; Hercules preset prompt unchanged.

**Still required:** two-device conflict choose proof; Production reversal semantics stay on D-085 until Jonathan approves D-124 build (or an interim Production D-119 approval).

## More → Recent changes copy (D-119 tighten) + D-124 accepted

**Status:** Copy tighten on `cursor/recent-changes-copy-4ffb`. Development empty state and header pill match last-sync undo; older rows say **synced**; Production empty state stays honest LIFO until D-124 ships. Button label remains **Undo**. Pure helpers in `src/recentChangesCopy.ts`.

**Budget delta (5):** `0` — wording only; restore semantics unchanged this pass.

**Engagement delta (3):** `+1` — More card no longer contradicts the toast / D-119 behavior.

**D-124 accepted (not built):** dated hosted restore points, last 30 days, visible to everyone, restore owner-only, Dev+Production together. Next build is a separate PR after Auth/RLS sequencing Jonathan chooses.

## Office chalkboard / Home themes / Hercules snippets (D-120, PR #80)

**Status:** Merged via [PR #80](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/80) and follow-up [PR #82](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/82). Desk tool button is **Home theme** (was Look).

**Budget delta (5):** `0` — chalk Save/delete never posts; bought removed from Office and legacy `DailyHearth` chalk UI.

**Engagement delta (3):** `+2` — weather chip on chalkboard band; Home theme paper stocks (pink/gold/slate; cream unchanged); Hercules widget-anchored snippet stack with placeholder prompts.

**Still required after merge:** Jonathan visual pass at 390/720+; replace Hercules placeholder copy when ready.

## Member-scoped AI disclosure (D-115)

**Status:** Merged to `main` via [PR #83](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/83). `householdForAiDisclosure` strips partner personal txs/shifts/goals/memories; `composeHerculesChatRequest` rebuilds briefing, notices, ledger, and memories from that slice. Canaries in `test/ai-disclosure.test.ts`.

**Budget delta (5):** `+1` — partner personal money cannot leak into model aggregates (Course A privacy of the books).

**Engagement delta (3):** `+1` — Hercules model-first chat can keep growing without partner-personal disclosure.

**D-116 complete in code:** each in-flight model reply is bound to its request id, environment, household id, and member id. A context switch clears the old busy state and reloads the active ledger's chat; the delayed answer is neither displayed nor recorded. Newer requests also supersede older responses. Proof: `test/hercules-reply-context.test.ts`. The phone remains the only payload composer.

## Hosted snapshot CAS + outbox ack (D-122)

**Status:** Applied to Development on 2026-08-25 (Jonathan SQL-editor paste of fixed `002_snapshot_cas.sql`). Live smoke `pnpm books:smoke:cas` **4/4**: first publish, duplicate ack, stale conflict, advance 1→2. Disposable smoke household `HH-cas-smoke-mt7xsikl`. Client + outbox work already on `main` via [PR #84](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/84) / [#86](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/86). Production schema **not** applied.

**Budget delta (5):** `+3` — live atomic hosted CAS is on for Development.

**Engagement delta (3):** `0`.

**Still required:** two-browser E2E on real devices; Auth/RLS cutover before October; Production apply is a separate approval.

**Risk:** High residual until Auth/RLS; open Development RLS unchanged through 2026-09-30.

## Auth + membership RLS cutover (D-123)

**Status:** Migration **006 applied** on live shared project (Jonathan paste). Anon REST denial verified. Kitchen Auth door reaches Google OAuth. Docs record of apply: open PR #104. Invite chrome: branch `cursor/auth-invite-chrome-f375`.

**Budget delta (5):** `+4` — deny-by-default membership door is live for Development data on the shared project.

**Engagement delta (3):** `+1` (invite chrome in flight)

**Next owner:** Jonathan — signed-in Create/open/`HH-591c6905afd19707` sync smoke; then email/QR issue+redeem. Rollback only via explicit order and `docs/sql/009_rollback_006.sql`.

**Risk:** Release residual until signed-in smoke and invite redeem. Do not enable `VITE_PRODUCTION_CONTINUITY` casually.

**Environment / data disclosure:** Live applies: 002/004/005/007/008/006. Disposable Development data. No Production continuity client flag.

## Trust-foundation worksession (2026-08-24, local branch)

**Status:** Merged through [PR #71](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/71). Independent books/privacy/verifier review ran before merge. Auth/RLS remains a do-not-apply packet with synthetic tests. Conflict bundles export both sides without merging. `pnpm check` and `pnpm ai:verify` exist. No hosted schema was applied by that PR.

**Budget delta (5):** Money Confirm now goes through `acceptHouseholdWrite`: validate → balanced journal → PGlite ingest → persist → optional linked transport. Failures restore the previous household. If persist fails and books restore also fails, the outcome is `recovery-available` with both posting flags false. Linked writes compare revision; stale writes keep both sides. Claims and sit-down money block auto-merge. Hearth Pass overlay refuses a different shared journal. Unlinked/demo/empty/Pass households make zero household REST calls. WelcomeJoin applies a Pass without probing hosted books.

**Engagement delta (3):** none by design. Claude gets `src/claude/commandContract.ts` adapters/fixtures; OfficePhone/Hercules chrome were not edited.

**Still required:** atomic hosted CAS/journal authority and an explicit Jonathan migration decision. Do not apply `002_snapshot_cas.sql` or Auth/RLS, deploy, contact the household project, or delete hosted rows without that approval.
