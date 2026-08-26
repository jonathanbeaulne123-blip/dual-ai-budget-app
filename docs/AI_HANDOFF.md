# AI Task and Handoff Standard

After a long thread, [WORKING_MEMORY.md](WORKING_MEMORY.md) recaps *this chat*. GitHub remains the full project context (D-095): [DECISIONS.md](DECISIONS.md), merged PRs, living specs, [nostalgia/](nostalgia/), [reference/](reference/). Do not treat unfinished chat as `main`. Do not skip GitHub history.

Cloud-continuity canon is [CLOUD_CONTINUITY.md](CLOUD_CONTINUITY.md): Google sign-in must reveal personal and household ledgers from any device, no peer device is the host, data through 2026-09-30 is disposable/open Development data, and the security cutover is mandatory before meaningful October data.

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
