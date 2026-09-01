# Hearth living roadmap

> **Product:** Hearth — Jonathan and Bianca's household budget and family office  
> **Roadmap baseline:** `origin/main@9376c30ba5db55c920d15ce3feacb65dedae5733`, reconciled by SF-01 on 2026-08-30 (Toronto)
> **Canonical order:** latest explicit instruction → `docs/CLOUD_CONTINUITY.md` → `docs/DECISIONS.md` → `docs/STRATEGY.md` → `docs/ARCHITECTURE.md` → this roadmap  
> **Purpose:** one maintained view of what shipped, what is true now, what comes next, what remains gated, and how every major choice serves the Dual Course.

This is a living planning document, not an authority to deploy, mutate production data, relax a financial invariant, or bypass a gate. Code and UI are untrusted until deterministic books and tests prove them.

---

# 1. Phases + to-do list

## 1.1 Non-negotiable product law

- **Course A — useful household finance and family office — has weight 5.**
- **Course B — shared engagement, Hercules, learning, delight, and interactables — has weight 3.**
- Course A wins any conflict. Engagement earns its place by making correct financial habits easier; it never edits, hides, or posts money.
- Commands are the money boundary. UI state, AI output, OCR, bank feeds, calendar data, widgets, weather, and Hercules are proposals or displays only, except D-137's narrowly typed ChatGPT path: the model may prepare one command, but only a member opt-in plus a separately confirmed sealed preview can invoke the atomic write boundary.
- Only a visible user **Confirm** may currently post a financial command. D-172 disables D-159 automatic posting: 7shifts, Gmail, OCR, AI, schedules, and background jobs may collect and prefill, but cannot write money. D-174 describes a future gated rail where an exact settled event may match a confirmed action or dual-approved standing rule; it creates no current exception. Reversal/repost corrects mistakes; financial history is not silently rewritten.
- CAD is stored as integer cents. Toronto is the household time zone. Posted activity must remain double-entry and auditable.
- Development is not production. Production writes, deployments, migrations, and record cleanup require Jonathan's explicit approval.
- Google sign-in is the seamless entry and recovery identity. A signed-in person must be able to open their personal ledger and every household ledger they belong to from any device without another device remaining online.
- The cloud is the durable cross-device continuity layer. PGlite is each device's accounting engine and offline replica/cache; it cannot be the only copy required for a different device to operate.
- Through 2026-09-30, hosted Development data is disposable fixtures while Auth smoke and Production hardening finish. Deny-by-default RLS **006 is applied** (anon household REST revoked). Security must be October-ready before meaningful household data, not a reason to postpone cloud continuity.
- Bank feeds, Interac, card issuing, and other money rails remain on the roadmap and still require the late-September Auth/RLS foundation plus their own legal/security gates.
- Do not revive Google Sheets or clasp. Existing Google integrations may supply read-only context or draft proposals; Sheets is neither runtime, ledger, canon, nor sync transport.

## 1.2 Status language

| Status | Meaning |
|---|---|
| **STOP-SHIP** | A current behavior can violate money truth, environment isolation, device-independent continuity, or deploy safety. During the disposable-data window, disclosed weak privacy alone is scheduled security work rather than a continuity blocker. |
| **SHIPPED** | Present on audited `main`; still subject to monitoring and kill criteria. |
| **ACTIVE** | In an open branch/PR or the current worksession; not shipped. |
| **NEXT** | Ready to brief after higher gates are satisfied. |
| **GATED** | Desired, but a named technical, privacy, product, or legal prerequisite is not yet proven. |
| **SPECULATIVE** | Keep visible and researchable; do not schedule as if its assumptions are settled. |
| **IMPOSSIBLE TODAY** | Valuable possible future, but Hearth cannot responsibly deliver it with the current permissions, partners, or operating maturity. |
| **REFUSED** | Conflicts with product law or creates a second source of truth. |

Checkboxes show work state, not product value: `[x]` is shipped on the named baseline, `[ ]` is not.

## 1.3 What is true now

| Area | Audited truth | Decision now | Proof needed to change status |
|---|---|---|---|
| Priority-one Shared Money program | D-174 locks the direction: partner-backed Canadian joint account, Jonathan and Bianca first, shared bills/goals plus private accounts, equal co-owner routine authority with guardrails. No banking capability ships from the decision. | **ACTIVE — SF-02 DEVELOPMENT-VERIFIED, DEPLOY-GATED:** migration 017 is applied; the two-principal hosted authority matrix and semantic 320/390/720/1100 access UI passed with smoke state rolled back. Production had 0 households at apply and remains unproved. D-172, D-161, and D-162 remain unchanged. | Merge/deploy, verify live Google sign-in/access panel, retain rendered a11y follow-through, then SF-03–SF-05. |
| Environment isolation | Env + household + invite binding shipped (#121/#126/#127). Google subject + member match are required on automatic discovery/pull/persist/outbox when a continuity identity is present (D-146). Phrase/Pass remain recovery without Google. | **SHIPPED for Phase 0 tuple:** adversarial tests reject wrong Google subject and identity-mismatched outbox flush with zero fetch. | Keep canaries green; Create/invite smoke still open separately. |
| Local books | Confirm writes pass `acceptHouseholdWrite`: validate → PGlite → verify canonical hash → persist → transport. Pulled Development candidates reconcile record by record, then pass PGlite acceptance before becoming active. D-189 rebuilds an interrupted local projection only from an exact self-consistent accepted-books receipt; missing/altered receipts and real mismatches remain blocked. Restore failure after successful ingest remains honestly `recovery-available`, not proven rollback. | **ACTIVE:** keep the local command boundary closed while hosted authority and two-device interleavings are built. | Failure, interrupted-recovery, and same-count/different-facts tests stay green; recovery never celebrates an uncertain write. |
| Google-account cloud continuity | Development has exact-subject discovery, automatic accepted-command transport, a durable compacting outbox, multi-household switching, member-personal replicas, atomic 012, Realtime 014, command log 013, and session/device authority 017. Two-phone Realtime met **≤500 ms p95** historically; 4 s poll is fallback. | **D-191 LOCAL LATENCY REPAIR:** receiver-side command and snapshot work now share one PGlite lane; snapshot echoes coalesce behind a 300 ms command grace and then check the committed command log before full recovery. Failed/gap/unknown paths retain recovery. D-186 automatic reconciliation and Production-off boundaries remain. | Finish exact-tree review/release, then rerun the live matrix with 100 new samples plus the fourteen-day Development rehearsal; Production remains separate. |
| Temporary hosted openness | Deny-by-default Auth/RLS **006 is applied**; anon household REST revoked. Development data through 2026-09-30 remains disposable fixtures. Create / invite / anon-denial smoke and Production hardening are still open. | Treat openness language as historical. Finish smoke before meaningful October data. | Live Create/invite/revoke/anon denial green; October-ready Production path reviewed. |
| AI disclosure | Merged PR #83 introduced the member projection; independent review then reproduced and closed a full-household grounded P&L/FIGURES leak. D-132 tightens the UI boundary again: household talk uses shared/both rows, Personal talk uses only the requesting member's personal/both rows, and partner-personal questions are refused before model transport. | **SHIPPED baseline; D-132 implementation in review.** Keep aggregate, view-scope, provenance, and delayed-response canaries green. | Outbound canaries exclude other-member personal notes, direct amounts, and derived aggregates; household context excludes even the viewer's personal rows; stale responses cannot display or persist after a context switch. |
| In-app Hercules provider resilience | D-184 routes ordinary synthetic-test chat through configured Gemini → Groq → opted-in OpenAI → Workers AI behind an explicit external-provider plus `synthetic` classification deployment gate, preserving one member-scoped redacted prompt and the current on-device fallback. Planner, scan, deterministic reads, sanitizers, and Confirm authority are unchanged. | **MAIN MERGED; GITHUB DEPLOYED:** reviewed runtime `d131571`; GitHub CI and Cloudflare deploy passed; live synthetic chat returned through Groq after Gemini fallthrough. | Full local gate `1,344` passed / `3` skipped / `0` failed; independent exact-head PASS. |
| Hercules full synthetic brain | D-188 makes Gemini-first planning and voice the conversational brain for authorized synthetic Development. Every voice tier receives the credential-free full synthetic snapshot; typed read tools calculate complex answers and keep figures/source cards authoritative. The exact plural `bills` failure now has a deterministic read-plan fallback. | **RELEASE REVIEW PASS; DEPLOY AUTHORIZED:** exact runtime `b5bc7ea` over `origin/main@97dcba2` passed 1,446 tests, TypeScript, AI-surface, production builds, diff hygiene, and independent High-risk review. | Seal the evidence commit, fast-forward `main`, and verify GitHub/Cloudflare plus a synthetic live chat. Production and write authority remain closed. |
| Two phones | Live pull (Realtime primary, 4 s REST poll fallback) + Shared CAS + slim outbox + disjoint shared absorb ship on Development; Auth uses Migration 012 atomic Shared+Personal; Migration 014 + `VITE_CONTINUITY_REALTIME=1` and two-phone smoke passed 2026-08-27. T2 command log is enabled through 013. G6 and T1-S6 freshness proof are complete. | **ACTIVE — DEVELOPMENT PILOT ONLY:** the local pilot workflow bakes Production continuity off. Command-log-specific live proof, recovery edges, and the fourteen-day rehearsal remain unproved. | [`SYNC_PILOT.md`](SYNC_PILOT.md) live matrix and exit criteria; a separately approved Production identity/restore/write Release packet. |
| Rate limiting | PR #79 salvaged the exact Git-main host and a per-IP meter under D-121. Missing KV no longer bypasses the limit, but isolate memory is not a durable or globally consistent hard cap; live KV remains unbound. | Code containment is merged; do not call it a reliable production cap until KV/concurrency proof exists. | Bound production namespace plus concurrent-request tests, telemetry, explicit failure semantics, and documented rollback. |
| Delivery controls | `main` is unprotected, required checks are off, and direct commits can reach the deploy workflow. | Add branch/ruleset and production-environment approvals before higher-risk merges. | Required build/test/security checks block merge; deploy requires reviewed `main` state and environment approval. |
| Onboarding / first-number utility | Mobile/Office, Accounts, Audit, appointments, sitdown/vault, Hercules, budget foundations, and D-127 work flow have shipped, but there is no Google-member-scoped guided setup or opening-truth command. Current first-run lessons are device-local and flat. | **PARTS 1–2 PLANNED:** D-128 isolates Practice; D-129 locks Pokémon-rhythm Hercules routes, camera focus, interaction locking, progress, and finale. Cursor foundation prompt is ready without migration overlap. | Automatic/Skip first Google-member entry; D-128 isolation; exact target/route/dialogue proofs; balanced opening truth; replayable member-scoped progress; both members see accepted results from independent devices. D-129's deliberate reduced-motion exception remains named accessibility debt. |
| Batch intake | D-130 selected QFX/OFX and image intake is merged; no bank credentials or feed are involved. D-141 exact statement/receipt reconciliation and optional private Drive evidence are on current main; the current served bundle was not verified by SF-01. | Verify the served bundle and run the synthetic combined QFX+receipt UI smoke. | Current-bundle proof; PDF, persistent drafts, and feeds remain separate. |
| Hearth Household Fund | D-161 is **RELEASE APPROVED in PR #237**, reconciled from exact `efbe5ed` onto current `main`: append-only Fund events, clearing/refunds/deficits, private savings scope, PGlite projection, command-log replay, Home glance, and Fund books pane are complete. September remains manual practice at $0 opening; no real money or provider action. | Run September as a controlled weekly rehearsal. D-148 Development Flinks evidence exists; D-162 Fund-specific connected use remains read-only and Release-gated. | Exact financial scenarios, private-envelope/AI/export denial, two-device replay, institution/account support, full checks, accessibility/responsive smoke, reviewed exact SHA, and a separate October Release approval. |
| Shared vs Personal ledger experience | D-164/D-173: Shared is one pool plus Kitty Banks as sub-accounts; Personal Books is the household-visible + own-room floor; Home seals are posted in/out/leftover spend. Sit-down leftover stays separate. | **SHIPPED ON MAIN via #252 (D-173).** Add slideshow + FAB from #244 land as **D-181** on this integration branch. | Live kitchen after Jonathan's 2026-08-31 merge/push/deploy order; leftover-spend ≠ leftoverProjection; slideshow never `postEntry`. |
| Active PR topology | #61 was replaced by merged #81; #63 was salvaged through merged #79; #83 is merged and independently reviewed; #86 cleanly renumbered CAS to D-122. #66 is superseded by clean current-main PR #88. #62's budget editor is salvaged onto `main` as D-109; reviewed #87/#89 artifacts are being repaired on a current-main integration branch. | Review the combined repair as code plus staged Development migrations. Do not revive #66. | Every open PR targets current `main`, has unique decision IDs, truthful tests, and one reviewable purpose. |
| Tracker hygiene | Sheets-era issues #1–#10/#14 are closed; superseded PRs recorded in [`SHEETS_ERA_TRACKER_ARCHIVE.md`](SHEETS_ERA_TRACKER_ARCHIVE.md). | **SHIPPED archive record.** Do not reopen Sheets trackers as the plan. | New closures must cite retained commit/PR/reason. |

## 1.4 Recent sessions

Only the currently open or just-closed worksession belongs here. Durable history moves into Updates.

| Worksession | State | Scope | Output |
|---|---|---|---|
| [2026-09-01 Charter integrity repair](worksessions/2026-09-01-charter-integrity-repair.md) | **CLOSED; MERGED #274; KITCHEN PUBLISHED** | Reciprocal Fund custody; no-loss Charter subrecord convergence; atomic typed ceiling changes | `main@450be34`; CI `33478168942`; Cloudflare `33478168914`; Worker `ae1df573`; live no-store bundle verified; no UI slice, hosted data/schema, secret, or Production continuity change |
| [2026-08-31 PGlite interrupted recovery](worksessions/2026-08-31-pglite-interrupted-recovery.md) | **LOCAL HIGH-RISK FIX VERIFIED; RELEASE PENDING** | Receipt-gated full rebuild for interrupted local PGlite; truthful reset state | D-189; 1,453 tests plus AI/build/diff gates green; two independent reviews found no P0/P1 blocker; no hosted, schema, secret, push, merge, or deploy |
| [2026-09-01 Charter page](worksessions/2026-09-01-charter-page.md) | **OPEN; DRAFT PR** | Charter document + empty signature line | branch `cursor/charter-page-021f`; stacked on #271; not merged, not live |
| [2026-09-01 Charter founding conversation](worksessions/2026-09-01-charter-founding-flow.md) | **OPEN; DRAFT PR** | Empty-house founding questions through existing Charter commands | branch `cursor/charter-founding-flow-021f`; not merged, not live |
| [2026-08-31 Glance plates and seal lists](worksessions/2026-08-31-desk-glance-seals.md) | **CLOSED; MERGED #265; KITCHEN PUBLISHED** | Glance/expand left plates; Money in/out this-month posted lists; scrolling month sheet | merge `main@7d01b62`; Cloudflare `33460617226`; Worker `0a9ceae5`; live `Office-BC-mxQLw.js` |
| [2026-08-31 Desk plates](worksessions/2026-08-31-desk-plates.md) | **CLOSED; MERGED #260; KITCHEN PUBLISHED** | Twelve Home mosaic plates (six Shared, six Personal) over existing selectors; Spread stays the Shared default stage | merge `main@c75d72e`; Cloudflare `33447063786`; Worker `e57b4a67`; live `Office-C6krQOJZ.js` |
| [2026-08-31 Last-entry-wins sync](worksessions/2026-08-31-last-entry-wins-sync.md) | **REOPENED; RELEASE AUTHORIZED** | Remove whole-snapshot chooser; automatic record-level convergence with immutable reversals/Fund facts | D-186; pre-rebase `pnpm check` 1,385 passed / 3 skipped; independent PASS; current-main verification and Development publication in progress; no schema, hosted data, secrets, or Production change |
| [2026-08-31 Month Spread](worksessions/2026-08-31-month-spread.md) | **CLOSED; MERGED #259; KITCHEN PUBLISHED** | Shared Home centre instrument (Standing / Course / Docket) plus member contribution bars; F-2/F-3 Fund projection corrections | merge `main@d648258`; canon `main@ed852a8`; Cloudflare `33432832963`; Worker `2488cac3`; live `Office-BBr3Ic0W.js` |
| [2026-08-31 Bianca Month mainline catch-up](worksessions/2026-08-31-bianca-month-mainline.md) | **DEVELOPMENT CODE RELEASED; REHEARSAL OPEN** | D-183 current App/books/command-sync trial contract | `main@4af0413`; no hosted mutation or Production; two-phone/four-week proof pending |
| [2026-08-31 Hercules provider fallback release](worksessions/2026-08-31-hercules-provider-fallback-release.md) | **CLOSED; MERGED TO MAIN; GITHUB DEPLOYED** | Ordinary synthetic chat Gemini → Groq → OpenAI → Workers AI; Worker-only Gemini/Groq secrets | D-184; runtime `d131571`; OpenAI paid gate off |
| [2026-08-31 Hercules full brain](worksessions/2026-08-31-hercules-full-brain.md) | **RELEASE REVIEW PASS; DEPLOY AUTHORIZED** | Full credential-free synthetic Development context; Gemini-first planning/voice; deterministic calculator/source tools | D-188; exact runtime `b5bc7ea` passed the complete Windows-native gate; no schema or Production change |
| [2026-08-31 Merge FAB + Add slideshow and deploy](worksessions/2026-08-31-merge-deploy-add-slideshow.md) | **OPEN; RELEASE** | Integrate #244 FAB/Add slideshow onto current `main` as D-181, then merge/push/deploy | Jonathan explicit 2026-08-31: merge push deploy |
| [2026-08-31 Add slideshow](worksessions/2026-08-31-add-slideshow.md) | **OPEN; INTEGRATING** | Unique cashpad prompt slideshows per Add mode | Confirm still posts; numbered D-181 |
| [2026-08-31 FAB add speed dial](worksessions/2026-08-31-fab-speed-dial.md) | **OPEN; INTEGRATING** | Vertical linear `+` menu → Add shift/income/expense/transfer | Dial never posts |
| [2026-08-31 Shared Home month instrument](worksessions/2026-08-31-shared-home-month-instrument.md) | **OPEN; CLAUDE PROMPT READY** | Grander swipable Fund-month tracker in the selling Home stage | no UI until Jonathan confirms |
| [2026-08-31 Google-first household entry](worksessions/2026-08-31-google-first-household-entry.md) | **DEVELOPMENT DEPLOYED; LIVE CANARY OPEN** | D-182 Google-first chooser, invitation recovery, household freshness, and active identity header | `main@244bc67c`; Cloudflare `33421668573`; no schema, hosted-data mutation, secret, or Production-continuity change |
| [2026-08-31 Household-card opening repair](worksessions/2026-08-31-household-card-open-fix.md) | **DEVELOPMENT DEPLOYED; LIVE CANARY OPEN** | Exact household/member card targets, stale-target refusal, and serialized PGlite opening | `main@0f034970`; CI `33428186193`; Cloudflare `33428186207`; live bundle markers verified; no hosted, schema, secret, or Production action |
| [2026-08-29 Shared Money program](worksessions/2026-08-29-shared-money-program.md) | **OPEN; SF-01 IMPLEMENTED** | D-174 program canon, machine/human capability baseline, and exact Phase 0 trust packets | [`SHARED_MONEY_BASELINE.md`](SHARED_MONEY_BASELINE.md); [`briefs/shared-money/`](briefs/shared-money/README.md); no provider, schema, Production, push, merge, or deploy |
| [2026-08-28 Coworker attendance review](worksessions/2026-08-28-coworker-attendance-review.md) | **REVIEW FIXES VERIFIED; RE-REVIEW REQUIRED** | D-168 Personal schedule windows, OCR/shift attendance review, absence toggles, surprise helpers | Reconciled to current `main`; 97 focused tests; full suite 1099 passed / 2 skipped / 1 unchanged Windows `bash` failure; builds green; no push or deploy |
| [2026-08-28 Shared Ledger story handoff](worksessions/2026-08-28-shared-ledger-story-handoff.md) | **CLOSED; CURSOR PACKET READY** | D-164 Shared-vs-Personal experience audit; desktop+iPad story system; iPhone fence | [`briefs/CURSOR_SHARED_LEDGER_STORY_HANDOFF_2026-08-28.md`](briefs/CURSOR_SHARED_LEDGER_STORY_HANDOFF_2026-08-28.md); no UI code, push, or deploy |
| [2026-08-29 Kitchen desk, Personal books floor, Kitty Banks](worksessions/2026-08-29-kitchen-desk-banks.md) | **INTEGRATED LOCALLY; PR #244 STILL OPEN** | D-173: one Shared pool, Personal account floor, leftover spend seals, fat banks | Brought into `codex/kitchen-desk-integration`; no schema, provider, secret, push, merge, or deploy |
| [2026-08-28 Shared Ledger story implementation](worksessions/2026-08-28-shared-ledger-story-implementation.md) | **OPEN; DRAFT PR #244** | Mode-safe projectors, Shared Story / Personal Folio at `>=720px`, route contracts, phone banner only | `ee74045`; no schema, provider, secret, merge, or deploy |
| [2026-08-28 Shared Ledger story handoff](worksessions/2026-08-28-shared-ledger-story-handoff.md) | **CLOSED; CURSOR PACKET CONSUMED** | D-164 Shared-vs-Personal experience audit; desktop+iPad story system; iPhone fence | [`briefs/CURSOR_SHARED_LEDGER_STORY_HANDOFF_2026-08-28.md`](briefs/CURSOR_SHARED_LEDGER_STORY_HANDOFF_2026-08-28.md); implementation moved to the worksession above |
| [2026-08-28 Household Fund](worksessions/2026-08-28-household-fund.md) | **PR #237; RELEASE APPROVED** | September zero-balance practice Fund plus disabled October read-only evidence boundary (D-161/D-162) | Reconciled onto current `main`; no hosted schema, provider connection, secret, remote migration, or bank action |
| [2026-08-28 Wide paper office](worksessions/2026-08-28-wide-paper-office.md) | **MERGED #228; kitchen blocked 11001** | Live chalkboard + screenshot fat nav on composed paper office (D-156) | `main@d067e56`; deploy `33184620358` failed; queue-handler fix in flight |
| [2026-08-28 Merge and deploy what is safe](worksessions/2026-08-28-merge-safe.md) | **CLOSED; merged #229; kitchen live** | Merge only kitchen-safe work; hold 7shifts enablement and conflicting High drafts | Worker run `33146400613`; D-155 stays inert (`7403` D1 token) |
| [2026-08-28 7shifts Evidence Mesh and automation](worksessions/2026-08-28-seven-shifts-evidence-mesh.md) | **MERGED #231; INERT KITCHEN LIVE** | Encrypted member capture mesh, deterministic extraction, Shift Evidence Center, opted-in work posting, and payroll-week correction | `main@e342ae9`; Worker `9a1606cd`; private R2 + D1 + Queue/DLQ live/empty; all five activation flags off |
| [2026-08-28 Evidence synthetic vault smoke](worksessions/2026-08-28-evidence-synthetic-smoke.md) | **ACTIVE; LOCAL SYNTHETIC ONLY** | Exercise the real Worker bundle with local D1/R2/Queue before any capture activation | First end-to-end encrypted upload/derive/isolation/tamper/delete proof green; duplicate/out-of-order and hard-limit runtime cases next |
| [2026-08-28 Evidence full release](worksessions/2026-08-28-evidence-full-release.md) | **ACTIVE; RELEASE PREFLIGHT** | Separate Development/Production Evidence, official adapter, selected real capture, and opted-in deterministic reconciliation | Production D1/R2/Queue/DLQ provisioned; migrations applied; secrets attached to an inactive Worker version; email domain and provider token remain external prerequisites |
| [2026-08-28 Gmail 7shifts review](worksessions/2026-08-28-gmail-shift-review.md) | **D-163 MERGED #239; LIVE** | Direct Gmail read-only import, reduced Hercules review, and sealed explicit shift confirmation | `main@d85ba80`; migrations current in both Evidence environments; Worker `f30b0c54`; no Cloudflare mail dependency; Gmail consent remains |
| [2026-08-28 7shifts coworker roster](worksessions/2026-08-28-seven-shifts-coworker-roster.md) | **D-166 LOCAL IMPLEMENTATION** | Credential-safe employee-visible roster capture, private coworker IDs, scoped name matching, and roster review | Clean `main@c85ed0c`; no push, deploy, activation, migration, secret, or real capture |
| [2026-08-28 Approved 7shifts punch Shift draft](worksessions/2026-08-28-approved-punch-shift-draft.md) | **D-171 RELEASED; LIVE** | Approved worked evidence prefills date/time/hours while breaks and money preserve missingness | Application `021b61e`; Worker `3407ba4c`; visible Confirm remains the writer; no hosted-data mutation |
| [2026-08-29 Autonomous Shift envelope](worksessions/2026-08-29-autonomous-shift-envelope.md) | **D-172 LOCAL RELEASE PACKET** | Automatic-while-Chrome-runs schedule/timesheet/Gmail collection, Shift mail, visible Confirm, permanent Bible, historical weather, seven-day evidence purge | Local on `98acd9e`; all new Worker activation flags off; migrations unapplied; no OAuth publication or hosted mutation |
| [2026-08-27 Native 7shifts Timesheet inbox](worksessions/2026-08-27-seven-shifts-inbox.md) | **RELEASE BLOCKED on D1 token** | Development-only provider inbox integrated with Shift → Jobs and Timesheet review | Inert on kitchen; setup run failed Cloudflare `7403`; Production refused |
| [2026-08-27 Roadmap museum and vision](worksessions/2026-08-27-roadmap-museum-vision.md) | **CLOSED; PUBLIC/LIVE** | Current product vision, Git-timestamped project journey, Aug 17 Sheets exhibit, Aug 23 big-thinking exhibit | D-157; `455f1ab`; Worker run `33185717271` |
| [2026-08-27 Shift tab camera](worksessions/2026-08-27-shift-tab-camera.md) | **CLOSED; merged #217** | Tip-sheet camera on Shift Today | D-152 OCR on D-153 tab; live Worker `c942e55b`; Confirm still posts |
| [2026-08-27 Durable roadmap site](worksessions/2026-08-27-roadmap-site.md) | **CLOSED; PUBLIC/NO-GUARD; LIVE** | Public read-only `/roadmap/`, additive evidence data, responsive and keyboard proof | D-154; live proof `e50fb75`; [`ROADMAP_SITE.md`](ROADMAP_SITE.md) |
| [2026-08-27 Shift tab](worksessions/2026-08-27-shift-tab.md) | **CLOSED; merged #213** | First-class Shift tab matching locked 390px mocks | D-153; live Worker `5b2b2b47`; hard-refresh kitchen |
| [2026-08-27 Supabase Preview 016 history](worksessions/2026-08-27-supabase-preview-016-history.md) | **ACTIVE** | GitHub Preview must match local 016 filename | History row retagged; no schema re-apply |
| [2026-08-27 First-create false conflict](worksessions/2026-08-27-first-create-false-conflict.md) | **CLOSED; merged #210** | Retry after create must not say another phone | Live Worker `cc694eee`; Retry now on stuck household |
| [2026-08-27 Invite owner first create](worksessions/2026-08-27-invite-owner-first-create.md) | **CLOSED; merged #209** | First cloud write creates the owner so Google invite works | D-149; live Worker `10b7de13`; follow-up false-conflict branch |
| [2026-08-27 Start from scratch](worksessions/2026-08-27-reset-development-households.md) | **CLOSED; merged #201** | One Confirm deletes owned Development households and returns to Create | D-151; migration **016 applied**; kitchen Start from scratch on `main` |
| [2026-08-26 Sync architecture reframe](worksessions/2026-08-26-sync-architecture-reframe.md) | **CLOSED; docs PR** | D-149 tiered sync plan, 100–500 ms target, 20 slice prompts | [`SYNC_ARCHITECTURE.md`](SYNC_ARCHITECTURE.md), Phase 2 rewrite |
| [2026-08-25 Import reconciliation engine](worksessions/2026-08-25-import-reconciliation-engine.md) | **REVIEWED; PR HANDOFF; NOT DEPLOYED** | Exact statement/receipt arithmetic, exact payment matching, optional private Drive evidence | D-137; 85 test files / 595 tests green after rebase; no remaining P0/P1/P2 review finding |
| [2026-08-25 Hercules living teacher](worksessions/2026-08-25-hercules-living-teacher.md) | **IMPLEMENTED; REVIEW REQUIRED** | Typed number provenance, shared/Personal talk scopes, teacher questions, per-turn bubbles, desktop fly/litter | D-132; no deploy/schema; high-risk privacy review pending |
| [2026-08-25 Onboarding Update](worksessions/2026-08-25-onboarding-update.md) | **ACTIVE; Parts 1–2 planned** | Control/feature review plus exact phone/desktop motion and interaction storyboard | D-128/D-129; Cursor foundation prompt ready; no migration overlap; reduced-motion exception explicit |
| [2026-08-25 Batch imports](worksessions/2026-08-25-batch-imports.md) | **PR #108 OPEN; WORKER DEPLOYED** | Multi-file QFX/OFX, selected document vision, duplicate triage, one Confirm | D-130; 71 files / 477 tests; Actions/CI green; no migration or Supabase mutation |
| [2026-08-25 Shift workflow rebuild](worksessions/2026-08-25-shift-workflow.md) | **PLAYTEST-READY; PR #100** | Job rules, Timesheet, Confirm/history, Calendar settlement/reporting | Codex; D-127; CI + preview green; batch small polish after playtesting |
| [2026-08-25 Opening truth](worksessions/2026-08-25-opening-truth.md) | **READY; Onboarding Slice B** | Guided truthful opening balances and debts | D-129 locks automatic entry, existing-account editor reuse, and current-member shared + Personal scope |
| [2026-08-24 Command states Slice A+B](worksessions/2026-08-24-command-states-slice-ab.md) | **CLOSED; PR #76 merged** | Command chrome, sync anchor, conflict choose, Add a11y (Development) | Claude UX spec; Cursor Cloud Agent (GPT) implementation; 51 files / 373 tests on merged `main` |
| [2026-08-24 Ledger naming](worksessions/2026-08-24-ledger-naming.md) | **CLOSED; PR #77 merged** | Name household, shared, and Personal ledgers at setup | Codex; D-118 |
| [2026-08-24 Continuity slice 4](worksessions/2026-08-24-continuity-slice-4.md) | **CLOSED; PR #74–#75 merged** | Hosted membership + Personal scope; migration 003 applied | Codex; D-117 |

## 1.5 Updates — major shipped chapters

Major updates keep a durable blurb: what shipped, why it mattered, Dual Course effect, evidence, and a kill/rollback criterion. These are capability chapters, not a chronological commit dump.

### U-01 — Hearth rebuild and command-shaped mobile core — SHIPPED

- **What shipped:** the Hearth rebuild, mobile-first shell, and explicit command-oriented money interactions.
- **Why:** replace a spreadsheet-shaped workflow with a household product whose interaction boundary can be tested.
- **Dual Course:** Course A `+2`; Course B `+1`. The home metaphor earns engagement only around correct money work.
- **Evidence:** [Hearth rebuild](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/ece849016fa61cd1923cd3f3ad4536a962289933), [command/mobile follow-through](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/c64ee992cb2cff29cbf908932277aae029b30057).
- **Kill/rollback:** remove any shortcut that mutates money outside a typed command or hides the final posting summary.

### U-02 — Two-person household, PGlite books, and snapshot transport — SHIPPED, continuity replacement ACTIVE

- **What shipped:** household phrase/join, two-person state, undo foundations, PGlite/Postgres books, and Supabase snapshot transport.
- **Why:** establish household identity and a first path to two devices. The optional-publish model is now superseded by Google-account cloud continuity.
- **Dual Course:** Course A `+2`; Course B `+1` because shared presence becomes real only when both people see the same books.
- **Evidence:** [household foundation](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/47b52f427231abad692fb6461796645e7abcaa94), [join/phrase](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/0818f83ab627d3aa0df07c3f35702712ac629452), [undo](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/1b8337c6ead80fb418c51ccbb9d1079cd671f054), [PGlite](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/458d5285e0fbb77f6532441e4e6b7822afbab194), [snapshot transport](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/63489a73e2e06a06926b5f3516593701f0fe2d9f).
- **Kill/rollback:** never make another device depend on this phone. If synchronization is unhealthy, preserve local/offline work in an outbox and show recovery state; do not silently fall back to device-hosted truth.

### U-03 — Calendar, appointments, Accounts, Audit, and tax surfaces — SHIPPED

- **What shipped:** calendar/Google bridges, appointments and receivables, Accounts, Audit, and METC/science work.
- **Why:** move from transaction logging toward an actual household operating picture.
- **Dual Course:** Course A `+2`; Course B `0`. Context must stay subordinate to books.
- **Evidence:** [calendar](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/dddab40583ed4851d172033db4c074ffa27f04cc), [Google bridge](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/7f2ed345b9e48b9f4505820ad6979e71ea3cb04a), [Accounts/Audit chapter](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/6f60d41ec45f3672827841402cc65830845cfd87), [appointments](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/a067eeb5cf8d02ad6b5479e20d11ca3890a53113), [receivables](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/8897ea0446cfef37cdff49e324a00f2c982e4afd).
- **Kill/rollback:** revoke any integration that becomes a second ledger, posts automatically, leaks another member's personal rows, or requires a Sheets/clasp runtime.

### U-04 — Dual Course and Hercules foundation — SHIPPED

- **What shipped:** the explicit Course A/Course B strategy, Hercules companion foundation, and early interactive surfaces.
- **Why:** make household finance emotionally sustainable without turning correctness into a game mechanic.
- **Dual Course:** Course A `+1`; Course B `+2`; the 5:3 weighting governs every extension.
- **Evidence:** [Hercules foundation](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/b8a9b0e8089acb88ac30c7fcac98b1f85a040f80), [Dual Course](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/c014c04526d1045485021b67e76b8e290bcf9ce2), [follow-through](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/5ec54a49c6c3a5fdcc2886643573a2e48d3acaa6).
- **Kill/rollback:** disable any mechanic that shames, creates partner competition, rewards spending, resets progress punitively, or makes Hercules an authority over money.

### U-05 — Office/mobile split — SHIPPED

- **What shipped:** separate Office and mobile modes, navigation and layout refinements, and mode-specific interaction paths.
- **Why:** phone capture and desktop review are different jobs; neither should inherit the other's density blindly.
- **Dual Course:** Course A `+2`; Course B `+1` through calmer, context-fit interaction.
- **Evidence:** [Office split](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/1ed36965a89504b55713dc27bf074908b828ca0f), [mobile iteration](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/f5ddad575e5495bef8d95c6f30dd549bac50e58c), [layout convergence](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/ab7dc62b80a9ecc1b38a8e41360adc7a45e3d074).
- **Kill/rollback:** collapse a mode-specific surface if it creates divergent financial semantics, hides required Confirm detail, or doubles maintenance without a distinct household job.

### U-06 — Sitdown and vault — SHIPPED

- **What shipped:** shared sitdown and vault concepts with an Office companion view.
- **Why:** give the household a deliberate review ritual and a place for durable financial context.
- **Dual Course:** Course A `+2`; Course B `+1` through a cooperative ritual rather than a streak.
- **Evidence:** [sitdown/vault](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/53597991a8101713cd4af8d5abe9c4b856088964), [vault follow-through](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/1055d56a83a974d584fce8075528e95bc865c8ea), [companion Office](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/dbf55a1b27c4efd9411f825316073f38ca36790f).
- **Kill/rollback:** remove storage or ritual prompts that expose personal rows, duplicate source documents, or pressure either partner.

### U-07 — Sync integrity and household-operating extensions — SHIPPED, proof incomplete

- **What shipped:** stronger merge behavior and integrity tests alongside broader household-operating features.
- **Why:** a shared household product cannot trade convenience for silent loss.
- **Dual Course:** Course A `+2`; Course B `+1` because reliable shared state is an engagement prerequisite.
- **Evidence:** [sync integrity](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/231a70c4bd2b2d3607bb9056d7e86c9114967cee).
- **Kill/rollback:** if adversarial two-client tests find overwrite loss, halt hosted sharing and keep local/export recovery available until CAS/outbox repair ships.

### U-08 — Hercules AI Phase 1, model-first intent, and typed memory — SHIPPED, disclosure gate ACTIVE

- **What shipped:** Cloudflare model boundary, Hercules AI phases 1a–1d, model-first intent, an 18-row context excerpt, and typed household memory.
- **Why:** let the companion understand and explain while deterministic code remains responsible for calculations and commands.
- **Dual Course:** Course A `+1`; Course B `+2`.
- **Evidence:** [AI Phase 1a–d](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/28ecd7472af8017cd658fb407613f674bbf95e26), [current model-first/memory baseline](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/75574e4cad7a7346fdda8e97616fcf0efe09541b).
- **Kill/rollback:** use deterministic fallback or disable outbound model calls if consent, origin, rate, redaction, environment, or member-scoped disclosure proofs fail. Model output never posts.

### U-09 — Google-account cloud continuity direction — ACCEPTED, implementation ACTIVE

- **What changed:** optional hosted publishing is no longer the target product. Google sign-in must reveal the person's personal ledger and household memberships on any device; the cloud supplies durable continuity and PGlite remains each device's validated accounting/offline replica.
- **Why:** Jonathan and Bianca must never depend on one phone staying online to read or write the household.
- **Development window:** data through 2026-09-30 is disposable and may remain openly readable/writable to accelerate this work. Security remains a mandatory late-September cutover before meaningful October data.
- **Implemented in D-114/D-117/D-118/D-122/D-149/D-176/D-182, with D-186 release authorized:** exact Development Google membership discovery, PGlite acceptance, durable outbox with ack/backoff, launch/focus/reconnect replay, atomic Shared+Personal publication, command events, Realtime, session/device authority, member-keyed open shifts, automatic record-level reconciliation, and chooser-first Google entry with honest household freshness. The deployed D-180/D-182 pilot workflow bakes `VITE_PRODUCTION_CONTINUITY=0`; D-186 adds no cloud contract and is being published only after current-main verification.
- **Still open:** the complete two-account live matrix, 100 new command-event latency samples, restart/session/revoke/fallback recovery proof, and the fourteen-day disposable Development rehearsal.
- **Evidence required:** [CLOUD_CONTINUITY.md](CLOUD_CONTINUITY.md) acceptance tests, including fresh-device discovery, old-device-off read/write, offline outbox convergence, and pulled-snapshot accounting validation. In-repo: `test/hosted-cas-two-client.test.ts`.
- **Kill/rollback:** preserve accepted commands in a recoverable outbox and report the block; never retreat to a one-device host or claim open Development data is secure.

### U-10 — Command states chrome (Development) — SHIPPED

- **What shipped:** command chip/banner/toast derived from `CommandOutcome`; Development sync-on-write with `lastSyncAnchor`; in-app conflict choose; Add sheet dialog a11y; D-119 last-sync undo/reverse in Development.
- **Why:** Bianca must never see “saved” when PGlite rejected, and corrections should not leave posted + correction journal pairs during disposable Development work.
- **Dual Course:** Course A `+2`; Course B `+1`.
- **Evidence:** [PR #76](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/76), [`docs/CLAUDE_COMMAND_STATES_UX.md`](CLAUDE_COMMAND_STATES_UX.md), [`worksessions/2026-08-24-command-states-slice-ab.md`](worksessions/2026-08-24-command-states-slice-ab.md).
- **Kill/rollback:** remove any UI path that celebrates success when `postedExactlyOnce` is false or merges conflicts without an explicit human choice.

## 1.6 Updates — compact shipped work

Small updates remain compact and link to evidence; promote one to a major blurb only if it changes household behavior, financial semantics, or a gate.

| Update | Why it matters | Evidence |
|---|---|---|
| Durable public product-health and investor roadmap site (live) | Makes dated audit conclusions, E0–E5 evidence gates, real benchmark context, and the full P0–P∞ horizon revisitable without removing prior roadmap items or touching household books. | D-154; live proof `e50fb75`; [`ROADMAP_SITE.md`](ROADMAP_SITE.md); [`PRODUCT_HEALTH_AND_VIABILITY_AUDIT_2026-08-27.md`](PRODUCT_HEALTH_AND_VIABILITY_AUDIT_2026-08-27.md) |
| Living vision, project journey, and roadmap museum — **PUBLIC/LIVE** | Puts the full Dual Course household promise before the audit, records Git-backed Toronto milestone times to the minute, and preserves Aug 17/Aug 23 maps as separate frozen exhibits that never feed current status. | D-157; `455f1ab`; Worker run `33185717271`; [`worksessions/2026-08-27-roadmap-museum-vision.md`](worksessions/2026-08-27-roadmap-museum-vision.md); [`ROADMAP_SITE.md`](ROADMAP_SITE.md) |
| Command states chrome (Development) | Honest command UI on the real shell; sync anchor undo; in-app conflict choose. | [PR #76](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/76) |
| Ledger naming at setup | First-run household/shared/Personal labels without exposing member ids. | [PR #77](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/77) |
| Hosted membership + Personal scope | D-117 discovery/transport; migration 003 applied with exact grants. | [PR #74](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/74), [PR #75](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/75) |
| Cloudflare deploy hardening | Keeps the model edge reproducible and narrows accidental deploy drift. | `edc7844`, `a00db22`, `ccf1185` in repository history |
| TypeScript/build repair | Keeps static checks available as a merge gate. | `0644621` |
| Cloud agent environment | Makes remote implementation more reproducible without granting production authority. | `2d2c46d` |
| Canon/doc maintenance | Records decisions and handoffs; current drift still needs Phase 0 reconciliation. | `6555c11`, `c7a523e` |

## 1.7 Phased roadmap

Phases are dependency-ordered, not date-boxed. A later phase can be researched or prototyped with synthetic data, but it cannot ship through an unmet earlier gate.

### Phase 0 — Protect money truth and establish cloud continuity — STOP-SHIP / ACTIVE

**Exit condition:** rejected books never persist; a Google-signed-in person can discover the correct personal and household scopes; a pulled snapshot cannot bypass accounting validation; risky code cannot deploy without checks.

- [x] Replace optional-publish/`linked` transport semantics with automatic Google-account continuity for personal and household ledgers. *(D-143 membership authority + D-147: transport only when `transportRequested`; Auth-off Publish is Advanced recovery only; Auth-on has no Publish.)*
- [x] Keep local PGlite ingest and hosted transport as separate failure domains, but synchronize accepted commands automatically after sign-in rather than requiring **Publish to the cloud**. *(D-114/D-143/D-147: App requests transport for continuity members; local accept never waits on cloud.)*
- [ ] Make command application atomic and fail closed across PGlite, JSON/UI state, IndexedDB/local storage, hosted snapshot, and audit trail. *(Partial D-147: refuse legacy race when CAS missing; Personal fail after Shared CAS does not ack. **Tier 1 T1-S1/T1-S2** ([`SYNC_ARCHITECTURE.md`](SYNC_ARCHITECTURE.md)): Migration 012 atomic Shared+Personal + two-browser E2E.)*
- [x] Validate environment + Google identity + personal/household membership tuple on every discovery/join/pass/pull/persist boundary. *(D-146: Google subject/member required when continuity identity is present; phrase/Pass remain recovery without Google; #121/#126/#127 env/invite bind.)*
- [x] Validate pulled and merged financial content against PGlite/canonical hashes before persistence or display; entry-count equality is not acceptance. *(Unified `financialAuditHash` for PGlite audit + `booksAcceptedHash`; post-ingest verify; same-count mismatch tests.)*
- [x] Centralize a member-scoped AI disclosure projection; canary-test every outbound field, aggregate, notice, memory, and delayed reply identity.
- [x] Inventory possible demo/orphan hosted rows. **Do not delete or modify them without Jonathan's explicit approval and a recovery record.** *([HOSTED_ROW_INVENTORY.md](HOSTED_ROW_INVENTORY.md); approved cleanup 2026-08-24.)*
- [ ] Bind the live Hercules KV/stronger authority and prove concurrent failure semantics. PR #79's D-121 code containment is merged; the reliable production cap is not. *(D-147: concurrent failure tests + [HERCULES_KV_BINDING.md](HERCULES_KV_BINDING.md); Jonathan must create namespace, paste real ids, deploy.)*
- [x] Salvage #62 deliberately and preserve its useful work without hidden branch ancestry. #61 was rebuilt cleanly under D-108. *(Budget editor on `main` as D-109.)*
- [ ] Enable GitHub branch/ruleset protection, required checks, and production environment approval. *(D-147 runbook [GITHUB_BRANCH_PROTECTION.md](GITHUB_BRANCH_PROTECTION.md); agent token cannot apply — Jonathan owner action.)*
- [x] Turn on GitHub 2FA for the owner account (completed D-020).
- [x] Archive or supersede stale Sheets-era issues and PRs only after recording retained evidence. *([SHEETS_ERA_TRACKER_ARCHIVE.md](SHEETS_ERA_TRACKER_ARCHIVE.md).)*
- [x] Reconcile current canon drift: model-first vs stale on-device language, 18-row context, shipped Office/mobile work, snapshot-transport wording, and current working memory. *(D-147: [WORKING_MEMORY.md](WORKING_MEMORY.md) rewritten to 006-applied / model-first / continuity; no longer claims HEAD #53 or `USING (true)`.)*

**Risk/gate:** money truth, continuity, environment isolation, deploy safety. Temporary hosted openness is accepted only for disposable pre-October data.  
**Proof:** fresh-device Google sign-in, old-device-off read/write, offline/outbox recovery, atomic failure tests, payload-fuzz/hash mismatch tests, protected-branch check, and reviewed PR topology.  
**Kill criterion:** if continuity cannot prove safe accounting acceptance, keep writes recoverable in a local outbox and show the block; never make another device wait for the originating device.

**D-114/D-117/D-147/D-149 progress:** optional Publish/`linked` client semantics are demoted; automatic continuity after Google membership is the ordinary path. Identity-tuple and hash-acceptance are checked under D-146. T1-S1…T1-S6, Migration 012, Development Realtime 014, and command log 013 are merged; two-phone Realtime smoke passed. Remaining work is signed-in lifecycle/recovery proof, command-log-specific live smoke, and a separately approved Production packet.

### Phase 1 — Complete the Bianca-ready monthly loop — NEXT after Phase 0

**Exit condition:** Bianca can create the first useful month, understand it, make an error, correct it, and see a trustworthy result on a phone without developer help.

- [x] Build current-month budget editing through a typed books command, retaining/reworking the useful budget editor from #62 rather than blindly merging its stack. *(D-109: Statements → Budget variance → `setBudget`; plans only.)*
- [x] Add a first-class bill/recurrence form for genuinely new entries; calendar/email/OCR may only prefill a draft. *(D-125: Calendar → Bills → Add repeating; Confirm optional post-first.)*
- [x] Add shift/income settings with explicit effective date and preview. *(D-127: four-slice local implementation; slice-level review explicitly deferred to the comprehensive pre-September audit.)*
- [ ] Ship the four-part [Onboarding Update](ONBOARDING_UPDATE.md): comprehensive control review → [phone/desktop animation and interaction storyboards](ONBOARDING_PART2_STORYBOARD.md) → member-scoped modular engine → integrated Hercules experience. D-183 now supplies the Development-only opening-truth command and Month-One gate: one Toronto as-of batch, balanced Opening equity, complete reversal, no fabricated income/history, and no second opening after ordinary money. Broader onboarding remains additive and must not bypass this proof.
- [x] Ship due-on-open preview only after its branch/decision ancestry is repaired. Rebuilt from current `main` under D-108; reminders remain read-only until the existing Confirm path.
- [x] Make correction reversal/repost a first-class phone flow; never silently rewrite the original journal. *(D-127 covers job shifts; broader entry correction remains separate.)*
- [ ] Batch D-127’s small UX polish after real phone/desktop playtesting; collect observations first and do not churn the verified money math one tweak at a time.
- [ ] Make undo durable across relaunch and sync, or label its exact local/session scope truthfully.
- [ ] Keep validation and duplicate warnings beside the field/action that created them; never hide a blocked post in a toast alone.
- [ ] Verify keyboard, focus, touch targets, reduced motion, screen-reader names, empty states, and low-light use.
- [ ] Add the minimum “Today” surface: bills due, safe next action, and unresolved reconciliation—not a second task manager.
- [ ] Implement D-164 ledger-purpose architecture before expanding the Fund rehearsal UI: Shared tells the cooperative now/change/attention/next/trust story; Personal is a private folio; every route consumes a mode-safe projector. Desktop and iPad share the system at `>=720px`; iPhone OfficePhone stays structurally unchanged. Packet: [`briefs/CURSOR_SHARED_LEDGER_STORY_HANDOFF_2026-08-28.md`](briefs/CURSOR_SHARED_LEDGER_STORY_HANDOFF_2026-08-28.md).
- [ ] Complete the D-183 four-week Month-One rehearsal with Bianca: truthful opening, actual-or-honestly-skipped income/groceries/bills/card/refund, Fund setup/contribution/shared purchase/settlement, isolated correction practice, tied reconciliations, four current green checkpoints, close, Bianca's exact approval, and Jonathan's countersignature. The rehearsal stays on the ordinary current App, command, books, and continuity paths so later app edits cannot leave it behind. Product launch and scaling wait for her approval. Friction is participant-visible follow-up evidence, never model input or silent Fund-rule change.
- [ ] After the rehearsal and October security gates, run D-162 as a separate Release packet: verify Flinks savings support, exact/competing/near/grouped/unmatched evidence, revoke/privacy denial, and carry-forward history. If live support fails, stop for provider approval; statement import is test evidence only.

**Risk/gate:** command boundary, integer cents, Toronto effective dates, double entry.  
**Proof:** phone E2E and fresh-profile usability pass; reversal journal inspection; property tests for cents/dates/balancing; Jonathan/Bianca acceptance.  
**Kill criterion:** cut decorative or secondary surfaces before weakening correction, clarity, or books proofs.

### Phase 2 — Push-native sync and lossless multi-device — NEXT after the monthly loop

**Canonical plan:** [`docs/SYNC_ARCHITECTURE.md`](SYNC_ARCHITECTURE.md) (D-149). **Target feel:** partner sees confirmed shared money in **100–500 ms** (Tier 1 Realtime + atomic SQL), not 4 s poll. Command-log primary (Tier 2) follows Tier 1 proof.

**Exit condition:** any signed-in device works online or offline, interleaves edits, relaunch, and converges without losing a valid command; no peer device must remain online; sync UI is honest.

#### Tier 1 — Push-native continuity (100–500 ms) — ACTIVE

- [x] Shared snapshot CAS via `publish_household_snapshot` (Migration 002, Development). *(D-122.)*
- [x] Idempotent outbox, ack/backoff, conflict block, slim local tip (D-145/D-147).
- [x] Live pull disjoint shared absorb; 4 s poll when tab visible *(fallback until Realtime primary)*.
- [x] **T1-S1** Migration **012** — atomic Shared CAS + Personal in one SQL TX. *(Applied Development 2026-08-26.)*
- [x] **T1-S2** Client single-trip atomic push (Auth session → `publish_continuity_snapshot`). *([`T1-S2`](briefs/sync/T1-S2-client-atomic-push.md).)*
- [x] **T1-S3** Supabase Realtime subscribe; demote poll to fallback. *([`T1-S3`](briefs/sync/T1-S3-realtime-subscribe.md).)*
- [x] **T1-S4** Push/pull race coordinator. *([`T1-S4`](briefs/sync/T1-S4-push-pull-coordinator.md). #177.)*
- [x] **T1-S5** Two-browser E2E + fault harness (p95 ≤ 500 ms). *([`T1-S5`](briefs/sync/T1-S5-two-browser-proof.md). Manual two-phone Realtime smoke passed 2026-08-27 — [`SYNC_REALTIME_SMOKE.md`](SYNC_REALTIME_SMOKE.md); harness #179.)*
- [x] **T1-S6** Sync freshness UI (actor, revision, Realtime honest). *([`T1-S6`](briefs/sync/T1-S6-sync-freshness-ui.md); current `test/sync-freshness.test.ts` and G6 evidence.)*

#### Tier 2 — Command-log primary — ACTIVE (Jonathan approved same-day land)

- [x] **T2-S1** Migration **013** command event append log. *([`T2-S1`](briefs/sync/T2-S1-command-event-schema.md). **Applied** Development 2026-08-27; kitchen `VITE_CONTINUITY_COMMAND_LOG=1`.)*
- [x] **T2-S2** Outbox stores command refs, not full journal. *([`T2-S2`](briefs/sync/T2-S2-slim-command-outbox.md).)*
- [x] **T2-S3** Materialized snapshot from events. *([`T2-S3`](briefs/sync/T2-S3-materialized-snapshot.md).)*
- [x] **T2-S4** Realtime on command INSERT. *([`T2-S4`](briefs/sync/T2-S4-realtime-command-events.md).)*
- [x] **T2-S5** Interleaving/convergence harness. *([`T2-S5`](briefs/sync/T2-S5-interleaving-harness.md).)*
- [x] **T2-S6** Confirmation-scoped undo (dual-use safe). *([`T2-S6`](briefs/sync/T2-S6-confirmation-scoped-undo.md); handoff `docs/worksessions/2026-08-26-t2-s6-confirmation-scoped-undo.md`.)*

#### Tier 2+ cross-cutting

- [x] Command/member attribution and member-keyed `openShifts`; Jonathan and Bianca may each keep an independent punch. *(Migration 013; `test/shift-clock.test.ts`.)*
- [x] **D-180 pilot retention:** no financial command-event, receipt, reversal, or tombstone compaction/deletion during the rehearsal.
- [ ] Long-term bounded event/tombstone compaction policy after the pilot.
- [x] Join semantics are additive; household catalogs retain independent replicas and the active pointer changes only explicitly. *(`test/storage-replicas.test.ts`; `test/auth-invite-discovery.test.ts`.)*
- [x] Discovery pull runs on launch/focus/reconnect; a failed fetch or failed persistence leaves the last accepted local replica intact. *(`test/continuity-resume.test.ts`; `test/storage-replicas.test.ts`.)*

#### Tier 3 — Optimistic UX + presence — GATED on Tier 1 Realtime

- [x] **T3-S1** Optimistic command chrome. *([`T3-S1`](briefs/sync/T3-S1-optimistic-command-chrome.md).)*
- [x] **T3-S2** Soft presence (extends D-100). *([`T3-S2`](briefs/sync/T3-S2-soft-presence.md).)*
- [x] **T3-S3** Background sync polish. *([`T3-S3`](briefs/sync/T3-S3-background-sync-polish.md).)*
- [x] **T3-S4** Scale envelope (10–100 members). *([`T3-S4`](briefs/sync/T3-S4-scale-envelope.md).)*

#### Tier 4 — Normalized hosted journal — SPECULATIVE / research

- [ ] **T4-S1–S4** Tenant journal design through Production cutover runbook. *([`briefs/sync/`](briefs/sync/README.md).)*

**Risk/gate:** lost updates, duplicate posts, wrong scope, false “synced,” Realtime bypassing PGlite accept.  
**Proof:** SYNC_ARCHITECTURE §8 test matrix; Tier 1 gates G1–G6; trust + books auditors on money transport.  
**Kill criterion:** halt hosted sharing; preserve outbox; never one-device host.

**Progress:** T1-S1…T1-S6 and T2 command-log are merged, and the D-180 pilot plus D-182 Google-first entry repair are deployed to Development but not daily-use proven. **Next continuity work:** the complete two-account matrix with 100 new latency samples and the fourteen-day rehearsal. Production remains a separately approved packet.

### Phase 3 — Late-September Google Auth + membership RLS cutover — DATE-GATED security foundation

**Deadline and exit condition:** before 2026-10-01 and before meaningful household data, an authenticated Google identity can reach only its personal ledger and intended household/environment records, and an outsider cannot enumerate them.

**D-123 packet progress:** Q1–Q5 locked. Path B. **006 applied** 2026-08-25 (deny-by-default RLS live; `hearth_households_select` proved). 004/005/007/008/010/012/013/014/015/016 are also recorded applied. Google Auth and QR two-device smoke passed; empty Production was removed. Email/revoke and the complete create/anon/wrong-household lifecycle smoke remain open.

- [x] Design Google-to-hosted-auth identity mapping and durable personal-ledger/household membership relationships before writing policies around them. (D-123: Supabase Auth Google → `auth.uid()`; door = `continuity_memberships` + `household_invitations`)
- [x] Author deny-by-default RLS + REVOKE anon household REST packet (unapplied until review).
- [x] Define email and QR invitation channels with owner-only issue/revoke RPCs; lifecycle Migration 015 is applied and QR two-device smoke passed. Email/revoke smoke remains open.
- [x] Apply reviewed `004` and `005` preparation/hardening with Development approval; remove approved legacy Development rows and verify Production data is untouched.
- [x] Explicit shared-project cutover permission in principle (path B, 2026-08-25); Production continuity client behind build flag.
- [x] Apply SELECT bridge `008`; configure Google provider; revise 006 Production abort to NOTICE; apply **006**.
- [ ] Smoke Create / email / QR / revoke / anon denial / wrong-household denial on Auth-enabled kitchen; invite chrome. *(QR two-device smoke **passed** 2026-08-26 — [`AUTH_INVITE_SMOKE.md`](AUTH_INVITE_SMOKE.md); email/revoke/anon suite still open.)*
- [ ] Add device/session inventory/revoke and last-owner transfer/recovery semantics. *(Member leave exists through `hearth_leave_household`; owner delete/reset refuse Production.)*
- [x] Replace phrase-as-authority and `linked` publishing with automatic authenticated discovery/synchronization; invitations only establish membership. *(D-143 client: automatic transport requires continuity membership; live anon phrase REST denied under 006; 010 bind live; QR redeem smoke passed. Email/revoke lifecycle remains open.)*
- [ ] Build and test migrations on a disposable rehearsal project; Production cutover is a separate Jonathan-approved plan.
- [ ] Add pgTAP negative tests and a permission matrix to required CI.
- [ ] Complete concurrency/outbox work (002 live + member-guard in CAS) before claiming authenticated two-phone safety.

**Risk/gate:** temporary open development access must not survive the September cutover; Phase 0/2 proofs, recovery design, and production migration approval.  
**Proof:** local Supabase tests for every role/action/environment; red-team attempt with publishable key; reviewed cutover and rollback rehearsal.  
**Kill criterion:** do not enter meaningful October data or call Hearth secure if any cross-personal/cross-household read/write/delete path exists.

### Phase 4 — Reconciliation and safe intake — SELECTED DEVELOPMENT INTAKE ACTIVE; connected sources gated

**Exit condition:** external data becomes a traceable inbox of proposals that a person can match, reject, or Confirm; it never bypasses the books.

- [ ] Add versioned JSON export/import and CSV transaction intake through typed commands, preview, row-level errors, provenance, and idempotency.
- [x] Merge D-130 selected intake: multi-file QFX/OFX plus explicitly selected receipt/bill/statement images, exact confidence lanes, side-by-side choice, and final Confirm.
- [ ] If old Sheets data must be recovered, treat it as a one-time read-only document import. No clasp, formulas-as-runtime, or bidirectional sync.
- [ ] Extend Gmail/Drive intake only as approved-source draft evidence. D-130 selected images retain no raw image in Hearth; archive/redaction and PDFs remain unbuilt.
- [x] Merge D-141 exact reconciliation: available statement opening + transaction net = closing; receipt numeric components; unique exact one/multi-payment matching; total-only receipt clearance; private Drive retry/delete evidence. *(Present on current main; current served bundle unverified.)*
- [ ] Extend D-137's totals panel into persistent unmatched/suggested/resolved lanes only if household-scale use needs saved drafts.
- [ ] Add category/rule preview, diff, replay, bounded scope, and audit; no retroactive invisible mutation.
- [x] Add selected-source statement opening/closing balance checks; missing opening balance is explicitly skipped by product decision.
- [ ] Research Canadian account connectivity/Flinks/Open Banking only after Auth + RLS; imported rows remain an inbox until Confirm.

**Risk/gate:** Auth + RLS, provider terms, PII retention, command boundary, deterministic duplicate handling.  
**Proof:** golden import fixtures, replay invariance, malformed-file tests, provenance inspection, zero direct journal inserts.  
**Kill criterion:** remove any connector whose data cannot be isolated, explained, exported, and deleted safely.

### Phase 5 — Family-office-grade controls — GATED by a complete household loop

**Exit condition:** Hearth can support decisions and review across the household without pretending to be a regulated institution or replacing professional advice.

- [ ] Opening balances and account reconciliation with immutable provenance.
- [ ] Deterministic safe-to-spend/cash runway, with formula and freshness visible.
- [ ] Tax/benefit lockboxes and receivable evidence; professional review remains explicit.
- [ ] Hash-chained audit export and signed review package.
- [ ] Maker-checker approval for high-impact household changes; both actors remain visible.
- [ ] Multi-entity envelopes only after household books semantics are stable.
- [ ] Auditor/accountant read-only export/pass, not a hidden privileged mutation path.
- [ ] Privacy-safe observability and Sentry only after redaction and a complete phone-to-books slice.

**Risk/gate:** accounting semantics, legal claims, privacy retention, recovery/export.  
**Proof:** accountant-style scenario pack; deterministic rebuild from journal; access and export tests; documented non-advice boundaries.  
**Kill criterion:** label or remove any “office-grade” feature that implies guarantees Hearth cannot prove.

### Phase 6 — Learning, Hercules, and ambient household rhythm — GATED by money truth

**Exit condition:** delight increases completion and shared understanding without creating pressure, distraction, or financial side effects.

- [ ] Unlock short, human-reviewed lessons after real workflow wins; lessons simulate but never post.
- [ ] **Future financial-education academy (not implemented):** design a Fabulous/Duolingo-style interactive quest path that can begin with age-five concepts such as “what is money?” and “what is a bank account?”, then grow through household budgeting, credit, investing, bookkeeping, and CPA-level topics such as efficient tax filing. Keep difficulty, language, and pacing adaptable to the learner; label jurisdiction, tax year, sources, and professional-advice boundaries. Quests may teach and simulate, but never post money, file a return, or imply a credential.
- [ ] Add cooperative household quests tied to safe actions such as reconcile/review, never spending or partner comparison.
- [ ] Use rolling/graceful progress; no punitive streak reset, hearts, scarcity, shame, or pet harm.
- [x] Let Hercules explain deterministic results and ask one useful question at a time; retain explicit consent and memory controls. *(D-132: typed source cards plus scoped food/spend/income/shift questions; broader lesson curriculum remains.)*
- [x] Give Hercules a bounded Brain v2 read layer: model-selectable, phone-executed balances/search/spending/income/comparison/bills/shifts/goals/owed/cash-position tools with member/view scope and typed provenance. *(D-133 Slice 1; implementation branch, review required.)*
- [ ] Deploy D-137 Hercules Pro confirmed transactions after review and explicit Development Migration 011 approval. Pro remains read-only by default; Personal/Household switches, separate OAuth scope, sealed preview, current opt-in recheck, exact-once receipt, atomic Personal+Shared CAS, and negative unsupported-tool proofs are required. Production remains off.
- [x] Deploy D-139 Hercules Pro living companion. PR #143 added the v2 MCP cache boundary, exact public-asset CORS, and bounded static fallback; main deployment and connector refresh completed 2026-08-26. Live ChatGPT rendered the 3D model with Pause and `Hercules is listening`; the payload remains mood/headline/short line/ledger label only, with no credentials or raw rows. The follow-up `codex/hercules-pip-autoload` makes summon the mandatory first tool on the first user turn and moves the host-controlled PiP request to widget boot; v3 deployment/live proof remains pending and inline stays the fallback. No schema migration.
- [ ] Add opt-in what-if simulators with a visible “not posted” state and a Convert-to-draft path that still requires Confirm.
- [ ] Add widgets/watch/weather only after safe-to-spend/freshness semantics are proven; ambient surfaces are display-only.
- [ ] Research voice/camera assistance only for draft capture with clear recording, retention, and review controls.

**Risk/gate:** Course A conflict, mental load, privacy, model hallucination.  
**Proof:** completion/usability evidence plus command/network spies showing zero money mutation; member-scoped disclosure tests.  
**Kill criterion:** remove any mechanic that reduces reconciliation quality, creates comparison/shame, or becomes required to access the books.

### Phase 7 — Settlement and external money coordination — SPECULATIVE / GATED

**Exit condition:** Hearth can represent obligations and prepare an external action without claiming the external movement occurred until reconciled evidence returns.

- [ ] Model due-to/due-from and shared settlement as double-entry obligations with actor/provenance.
- [ ] Add Interac handoff/deep-link preparation only after Auth + RLS, recipient confirmation, and explicit external-app boundary.
- [ ] Evaluate Canadian Open Banking/Flinks providers for read-only reconciliation first.
- [ ] Add privacy-safe notifications with amount redaction and per-member controls.
- [ ] Reconcile provider evidence back into Hearth through an inbox; never auto-post based on a callback alone.

**Risk/gate:** Auth + RLS, provider/legal review, fraud/error recovery, notification privacy.  
**Proof:** sandbox partner flow, wrong-recipient recovery, duplicate callback idempotency, external-vs-books reconciliation.  
**Kill criterion:** keep Hearth at obligation tracking/export if safe movement or evidence cannot be proved.

### Phase 8 — Cards, allowances, and regulated rails — IMPOSSIBLE TODAY

**Why visible:** household cards/allowances could eventually unite family-office controls and engagement, but they require capabilities Hearth does not possess today.

- [ ] Research issuer/BIN sponsor or BaaS partner, KYC/KYB/AML, sanctions, fraud, disputes, chargebacks, PCI scope, safeguarding, and Canadian regulatory obligations.
- [ ] Design child/family permissions and guardian controls without surveillance or coercion.
- [ ] Separate authorization controls from Hearth's internal budget; a declined/approved card event is external evidence, not ledger truth by itself.
- [ ] Require security program, incident response, support coverage, legal counsel, insurance, and audited recovery before any live-money pilot.

**Gate:** qualified partners + counsel + mature Auth/RLS + operational security + dispute/fraud operations + explicit household consent.  
**Proof:** partner sandbox, threat model, external audit, recovery drills, and a separately approved launch charter.  
**Kill criterion:** remain a planning/reconciliation product if the household cannot be protected to institutional standards.

### Phase ∞ — Other households and platform shape — SPECULATIVE

- [ ] Generalize beyond Jonathan and Bianca only after their end-to-end loop is calm, recoverable, and measurable.
- [ ] Add household templates as configuration, never forks of financial semantics.
- [ ] Define export/delete/account recovery before invitations beyond the founding household.
- [ ] Research paid product, support, accessibility, localization, and compliance separately from feature enthusiasm.

**Gate:** repeated founding-household value; no unresolved stop-ship risk; support and data-deletion capacity.  
**Proof:** opt-in design partners with synthetic or isolated data, documented support load, and retention/deletion drills.

## 1.8 Immediate highest-leverage Cursor packets

These are ranked starting points, not limits on Cursor's inspection or solution design. Cursor may split, reframe, or expand a packet when evidence warrants it, but it must keep the product law and hand back every scope change explicitly. The paste-ready briefs and acceptance contracts are in [`docs/briefs/CURSOR_NEXT_PACKETS.md`](briefs/CURSOR_NEXT_PACKETS.md).

**Latest approved UX packet (2026-08-29):** Codex integrates draft PR [#244](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/244) kitchen desk onto current `main`. Use [`briefs/CODEX_D165_UX_MAIN_INTEGRATION_HANDOFF_2026-08-29.md`](briefs/CODEX_D165_UX_MAIN_INTEGRATION_HANDOFF_2026-08-29.md). Suggest placement; do not restyle. Do not infer merge, deploy, iPhone redesign, D-159 auto-post, or a second theme from this roadmap entry.

| Rank | Packet | Outcome | Required before |
|---:|---|---|---|
| 0 | Branch/canon reconciliation | Repair #63/#61/#62 topology, unique decision IDs, truthful baselines, and required checks without losing work. | Any feature merge |
| 1 | Google-account cloud continuity | New-device discovery of personal/household ledgers, automatic sync, offline outbox, no peer-device dependency. | Daily multi-device use |
| 2 | Atomic fail-closed books | A failed PGlite command cannot leave JSON/UI/storage/transport ahead of the journal. | New money commands |
| 3 | Environment and AI disclosure boundary | Reject mismatched passes/snapshots and emit only member-scoped model context. | More join/sync/AI rollout |
| 4 | Delivery and rate-limit guardrails | Protected `main`, required checks, production approval, truthful/bound limiter. | High-risk deploys |
| 5 | First Numbers | Complete budget, bill, shift, due-preview, opening truth, and phone accessibility loop. | Broader office/companion work |
| 6 | Corrections that survive | Reversal/repost, durable undo semantics, local validation placement, duplicate explanation. | Trusting daily use |
| 7 | Push-native sync (D-149) | Tier 1: atomic 012 + Realtime **100–500 ms**; Tier 2: command-log; slice prompts in [`briefs/sync/`](briefs/sync/README.md). | Seamless continuity claim |
| 8 | Late-September Auth + RLS | Google identity, personal/household membership schema, negative RLS tests, invite/session recovery. | Meaningful October data; bank/Interac/cards/hosted intake |
| 9 | Reconciliation/import inbox | JSON/CSV and later approved sources as provenance-rich proposals; no Sheets runtime. | External-data expansion |

---

# 2. Rival features — steal / reshape / refuse matrix

“Steal” means adopt the useful product job, not the rival's code, copy, trademark, or financial semantics. “Reshape” binds the idea to Hearth's commands, privacy, and Dual Course. “Refuse” names the tempting failure mode. Sources are product signals, not implementation authorities.

| Inspiration | Steal | Reshape for Hearth | Refuse | Gate / proof |
|---|---|---|---|---|
| [SoFi Relay](https://support.sofi.com/hc/en-us/articles/360040143191-What-are-the-benefits-of-SoFi-Relay) | One household cockpit across accounts. | Every number links to reconciled GL facts with source and freshness. | Scraped-looking aggregate balances presented as books truth. | Reconciliation completeness and stale-source states. |
| [Monzo Salary Sorter](https://monzo.com/help/budgeting-overdrafts-savings/web-salary-sorter) | Preview allocation when income arrives. | Generate an allocation proposal; post typed commands only after Confirm. | Automatic movement or budget mutation from detection alone. | Balanced preview, cents conservation, reversal. |
| [Ally Buckets](https://www.ally.com/stories/save/what-are-ally-banks-savings-buckets-and-boosters/) | Legible goals/buckets over one pool. | Projections/envelopes backed by accounts and journal, never shadow balances. | Cosmetic bucket totals that diverge from books. | Rebuild totals from journal; reconciliation invariant. |
| [Monarch](https://help.monarchmoney.com/hc/en-us/articles/360048393272-Getting-Started-Guide) | A genuinely shared household plan. | Membership/RLS roles, actor attribution, personal/shared visibility, explicit invitations. | “Household” as one shared secret or client-only filter. | Auth + RLS negative tests; revoke/recovery. |
| [Copilot category rules](https://help.copilot.money/en/articles/13978302-bank-category-rules) | Explainable rules that reduce repeat work. | Preview scope/diff, replay fixture, audit, Confirm, and reversal. | Irreversible or invisible retroactive category mutation. | Replay invariance and affected-row preview. |
| [YNAB Four Rules](https://www.ynab.com/the-four-rules/) | Give money clear jobs and adapt the plan. | Jobs remain overlays derived from actual double-entry books. | Treating envelopes as independent cash or moral scores. | Cents conservation; account/envelope reconciliation. |
| [QuickBooks audit log](https://quickbooks.intuit.com/learn-support/en-us/help-article/audit-log/use-audit-log-quickbooks-online/L2WoVnW6I_US_en_US) | Non-disableable actor/action history. | Immutable command/reversal trail with device/source/environment. | Admin erasure, silent edits, or AI-authored financial history. | Deterministic rebuild and tamper-evident export. |
| [Xero reconciliation](https://www.xero.com/us/accounting-software/reconcile-bank-transactions/) | Clear reconcile lanes, matches, and remembered patterns. | Show proposed match, reason, confidence, provenance, freshness, and final Confirm. | Auto-posting a prediction or hiding unmatched exceptions. | Golden match fixtures, duplicates, closing-balance proof. |
| [Wave receipts](https://support.waveapps.com/hc/en-us/articles/360059848112-Scan-and-upload-your-receipts) | Quick receipt capture/OCR. | Store approved evidence and prefill a draft command. | OCR posting, indefinite raw-image retention, or cross-member exposure. | Consent, retention/delete, OCR error set, Confirm spy. |
| [Cleo 3.0](https://web.meetcleo.com/blog/Introducing-cleo-3-0) | Conversational explanation and momentum. | Deterministic code calculates; model recognizes intent/explains; typed preview + Confirm remains final. | Model arithmetic, shame, fabricated insight, or autonomous posting. | Disclosure canaries, deterministic fallback, command boundary. |
| [Claude Artifacts](https://support.anthropic.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them) | Interactive what-if exploration. | Clearly isolated simulation with “not posted” status and optional draft conversion. | Simulations that look like actual balances or mutate state. | Resettable sandbox; no command/network side effects. |
| [Gemini Live](https://blog.google/products-and-platforms/products/gemini/gemini-live-camera-how-to/) | Opt-in camera/screen assistance. | Capture only a reviewed draft/evidence item with visible recording/retention state. | Ambient surveillance, hidden upload, or camera-to-journal. | Explicit session consent, delete, redaction, Confirm. |
| [Finch](https://help.finchcare.com/hc/en-us/articles/42149821015693-New-User-Guide) | Gentle companion feedback for safe actions. | Energize Hercules after reconcile/review/learning wins. | Pet health tied to money outcomes or missed days. | Zero financial mutation; no shame test. |
| [Lovegotchi](https://lovegotchi.com/) | Asynchronous shared companion presence. | Attribute each partner's safe contribution without ranking them. | Partner surveillance, coercive nudges, or competitive affection. | Personal/shared privacy matrix and opt-out. |
| [Habitica](https://habitica.com/static/faq) | Shared quests and visible progress. | Cooperative household quests around bounded safe tasks. | Damage, punishment, party liability, or financial reward loops. | Graceful failure and independent access to books. |
| [Streaks](https://streaksapp.com/) | Small, legible routine feedback. | Rolling cadence, grace days, and “resume here.” | Reset-to-zero loss aversion and daily pressure. | Long-gap recovery usability test. |
| [Duolingo](https://blog.duolingo.com/duolingo-101-how-to-learn-a-language-on-duolingo/) | Short lessons and cooperative quests. | Unlock contextual, human-reviewed money simulations after a relevant win. | Hearts, scarcity, shame, manipulative notifications, leaderboards. | Accuracy review and no-paywall/no-pressure rule. |
| [Habi](https://habi.app/) | A tiny, calm Today rhythm. | One next financial action plus household context. | A general productivity app or duplicate task database. | Today stays derived from ledger/calendar state. |
| [Linear Cycles](https://linear.app/docs/use-cycles) | Explicit lifecycle, ownership, freshness, and rollover. | Apply to roadmap/work packets and sync work states, not household worth. | Date theater or automatic rollover hiding unfinished risk. | Owner/state/gate/handoff fields required. |
| [Notion database buttons](https://www.notion.com/help/database-buttons) | Visible, named actions with previews. | Typed app commands and deliberate handoff buttons. | A generic database/button layer becoming the ledger or canon. | Repository remains canonical; commands remain coded/tested. |
| [TickTick](https://ticktick.com/home) | Clear Today and deferred items. | Show only time-sensitive household actions with source and dismissal semantics. | Second task system, noisy badges, or financial anxiety engine. | Bounded item types and notification controls. |
| [Typeform](https://help.typeform.com/hc/en-us/articles/38099463383188-How-to-add-multiple-questions-to-a-form-page) | Progressive one-question capture. | Short phone flow ending in a complete command summary and Confirm. | Hiding fees, account, date, actor, or balancing impact across steps. | Back/edit, summary completeness, keyboard/screen-reader pass. |
| [Brilliant](https://brilliant.org/help/features/) | Learn by manipulating a concrete model. | Contextual no-post simulations using deterministic household formulas. | Generic gamified curriculum or model-generated financial claims. | Human-reviewed scenarios and isolated state. |
| [Chunks](https://chunks.app/) | Finite, narrative, five-minute learning. | Small reviewed lessons tied to the current household task. | Infinite AI content or mandatory education before core actions. | Accuracy/version/source fields and skip access. |
| [Cash App Families](https://cash.app/families) | Family permissions, allowances, limits, and card visibility. | Long-horizon model for roles/limits only with issuer/legal/fraud/Auth/RLS foundations. | Pretending Hearth can issue/control money rails today. | Phase 8 launch charter and qualified partners. |
| [Splitwise](https://kb.splitwise.com/getting-started/how-do-i-use-splitwise) | Clear due-to/due-from and settlement provenance. | Represent household obligations as double-entry, then reconcile external settlement. | Treating an IOU UI number as cash movement or books truth. | Balanced obligation journal; duplicate settlement recovery. |
| [Apple Fitness+](https://www.apple.com/apple-fitness-plus/) | Gentle multidimensional progress and shared activity. | Celebrate consistency, clarity, and cooperation without comparing spend/net worth. | Rings, competition, or health/worth metaphors attached to money. | Opt-out, reduced-motion, no comparison/shame tests. |

Cross-rival rule: the useful pattern survives only if it improves the books or safely improves follow-through. If it creates a second balance, bypasses Confirm, pressures a partner, or weakens privacy, refuse it even when it is delightful.

---

# 3. AI tooling for ChatGPT / Codex, Cursor, and Claude

## 3.1 One operating system, three soft specialties

Roles are defaults, not fences. Any AI may implement, research, review, or challenge the plan when the packet and evidence support it. GitHub remains the shared source of truth.

| AI | Default responsibility | Best-fit tools | Hard boundary | Handoff expectation |
|---|---|---|---|---|
| **ChatGPT / Codex** | Project mastermind: canon reconciliation, roadmap, cross-PR audit, packet design, risk review; can implement bounded work. | Repository `AGENTS.md`; GitHub connector; in-app browser; official-doc research; skills; parallel subagents; read-only project tracker if one becomes active. See [Codex plugins](https://learn.chatgpt.com/docs/plugins), [AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents), and [MCP](https://learn.chatgpt.com/docs/extend/mcp). | No production credentials or mutation by default; no merge/deploy/data cleanup inferred from a planning request. | Close each worksession with baseline, outputs, evidence, Dual Course delta, open gates, and next owner. |
| **Cursor** | Chief implementer for repo-native code, refactors, tests, and PR repair; may reframe a packet with evidence. | Root `AGENTS.md`; path-scoped `.cursor/rules/*.mdc`; local PGlite/Supabase/Workers; Playwright; Vitest; GitHub PRs; hooks; Bugbot; optional non-production read-only MCP. See [rules](https://prod.cursor.com/docs/rules), [cloud agents](https://cursor.com/docs/cloud-agent), [MCP](https://docs.cursor.com/context/model-context-protocol), [hooks](https://prod.cursor.com/docs/hooks), and [Bugbot](https://prod.cursor.com/docs/bugbot). | Money/privacy work runs foreground or isolated with synthetic data; no production MCP, direct deploy, broad secret, or silent scope change. | PR description uses the common handoff fields and includes exact commands/results plus residual risk. |
| **Claude** | UX systems, visual artifact, interaction critique, bounded implementation/review; may challenge information architecture. | `CLAUDE.md` importing `@AGENTS.md`; `.claude/rules/`; skills; hooks; subagents; browser/Playwright with synthetic data; optional read-only tracker/design context. See [features](https://code.claude.com/docs/en/features-overview), [subagents](https://code.claude.com/docs/en/sub-agents), [hooks](https://code.claude.com/docs/en/hooks), and [skills](https://code.claude.com/docs/en/skills). | Artifact/design output cannot invent shipped status, touch production, post money, or become a second roadmap canon. | Return artifact/code, tested viewport/a11y notes, decisions, unresolved questions, and the exact source baseline. |

## 3.2 Shared instruction topology

Keep common law short and imported rather than copied:

```text
AGENTS.md                       shared product law, commands boundary, canon order, checks
├── CLAUDE.md                   @AGENTS.md + Claude-specific artifact/review guidance
├── .cursor/rules/*.mdc         path-scoped implementation rules
└── .claude/rules/*             path-scoped design/review rules
```

- Never put changing backlog status into agent-rule files; link this roadmap instead.
- Path-scoped rules may add requirements but cannot weaken root product law.
- Use synthetic/dev fixtures for AI/browser tests. Never paste production household snapshots into a model or cloud agent.
- Put deterministic tests beside the boundary: PGlite fresh isolated DBs, Supabase local + pgTAP, Workers Vitest, Playwright Chromium/WebKit phone viewports.
- Background/cloud agents are for low-risk isolated work; money, migration, auth, and privacy changes need a foreground owner and a second review.

## 3.3 Recommended plugins, MCP servers, extensions, and process

The smallest useful set wins. An integration must remove a real handoff cost without creating another canon, credential surface, or place where household data can leak.

| Capability | Recommendation | Where | Guardrail |
|---|---|---|---|
| GitHub connector/plugin | **KEEP / PRIMARY.** Already installed and the best cross-AI handoff surface. | Codex now; GitHub-native review for Cursor/Claude. | Repository canon; reviewed writes; no auto-merge/deploy. |
| Browser + Playwright | **USE NOW.** Browser for inspected UX/reference state; Playwright for deterministic app proof. | All three, local/dev. | Synthetic data; phone Chromium + WebKit; screenshots never substitute for books assertions. |
| Supabase CLI + MCP | **USE LOCALLY; MCP READ-ONLY NON-PROD ONLY.** | Cursor primary, Codex/Claude for review. | No production mutation; pgTAP required; local migration rehearsal; secrets never in prompts. |
| Cloudflare Workers Vitest | **USE NOW.** | Cursor implementation, Codex/Claude review. | Test actual bindings and concurrency; deployment is separately approved. See [Workers testing](https://developers.cloudflare.com/workers/testing/) and [Vitest integration](https://developers.cloudflare.com/workers/testing/vitest-integration/test-apis/). |
| GitHub rulesets + environments | **ADD NOW.** | Repository/process. | Required checks and protected production environment; owner approval for release. |
| Cursor rules/hooks/Bugbot | **ADD INCREMENTALLY.** | Cursor. | Hooks enforce tests/redaction/forbidden prod targets; rules stay path-scoped; Bugbot is review support, not approval. |
| Claude rules/hooks/skills | **ADD FOR ARTIFACT + A11Y + REVIEW.** | Claude. | `CLAUDE.md` imports common law; hooks block secrets/prod hosts; artifact reads roadmap as input. |
| Linear MCP | **CONDITIONAL.** Add read-only only if Linear becomes the active tracker. | All three. | GitHub/roadmap remain canon; no duplicate status unless a named sync owner exists. |
| Figma plugin/MCP | **CONDITIONAL, likely useful later.** Install only when Figma files become approved implementation references. | Claude/Cursor design handoff; Codex audit. | Design reference, not financial semantics or shipped-status source; minimum read scope. |
| Google Drive plugin | **CONDITIONAL.** Use only for approved non-ledger source documents or export review. | Codex/Claude research/review. | Drive is not canon; never revive Sheets/clasp or treat document values as posted truth. |
| Notion plugin/MCP | **DEFER.** | None today. | Duplicates roadmap/canon without a proven workflow; database buttons never become commands. |
| Slack/Teams/email/calendar project plugins | **DEFER.** | None today. | No current handoff gap justifies extra permissions or fragmented decisions. Product calendar/email bridges are separate, draft-only features. |
| Sentry | **LATER, after the first complete phone-to-books slice.** | Runtime observability. | Aggressive PII redaction, no household payloads, sampled non-financial metadata, reviewed retention. |
| Actual Budget | **REFERENCE/COMPARATOR, not dependency.** | Research and test ideas. | Learn from offline sync/reconciliation/rules; do not import runtime or semantics without a decision. |

Plugin installation is not part of this worksession. Before enabling any optional connector: inspect requested scopes/dependencies, choose the minimum permission level, write an owner and removal path, and record whether any household data can leave the repository/dev fixture boundary.

## 3.4 Work packet and handoff contract

Every cross-AI task carries these fields:

```text
Goal
Canon refs
Base branch / PR / commit
Allowed scope (and explicitly forbidden production actions)
Acceptance checks
Risk tags
Required gate
Decisions made
Open questions
Current status
Next owner
```

Use consistent tags: `ai:codex|cursor|claude`, `state:briefed|implementing|review|blocked|done`, `risk:money|privacy|retention|sync|deploy`, and `gate:auth-rls|confirm|prod-approval|second-review`.

Review rule: the implementing AI does not declare a high-risk money/privacy packet safe on its own. A second AI or human reviews the invariant, tests, diff, and residual risk; Jonathan retains production approval.

---

# 4. Dual Course deltas for major roadmap items

## 4.1 Scoring rule

For roadmap comparison, each item gets a raw delta from `-2` (material harm) to `+2` (material gain). Course A is multiplied by **5** and Course B by **3**. The weighted total helps order good options; it can never legalize a red-line violation. A privacy, double-entry, Confirm, environment, or production-safety failure is a veto regardless of score.

| Major item | Course A raw ×5 | Course B raw ×3 | Weighted signal | Roadmap decision / conflict resolution | Kill or gate proof |
|---|---:|---:|---:|---|---|
| Google-account cloud continuity | `+2 × 5 = +10` | `+2 × 3 = +6` | **+16** | First. Personal and household books follow the signed-in person; no device is the host. | Fresh-device and old-device-off read/write; offline/outbox convergence. |
| Atomic fail-closed PGlite books | `+2 × 5 = +10` | `0 × 3 = 0` | **+10** | First. UI convenience loses to journal truth. | Rejected command leaves every store unchanged. |
| Environment + AI disclosure boundary | `+2 × 5 = +10` | `+1 × 3 = +3` | **+13** | First. Personalized Hercules is retained only behind member-scoped disclosure. | Adversarial payload tests; outbound canaries. |
| Protected main, required checks, deploy approval | `+2 × 5 = +10` | `0 × 3 = 0` | **+10** | First. Slower direct publishing is an acceptable trade for household safety. | Ruleset and blocked-failure demonstration. |
| First Numbers monthly loop | `+2 × 5 = +10` | `+1 × 3 = +3` | **+13** | Highest product slice after containment. Calm phone interaction supports the books. | Fresh-profile Bianca-ready E2E. |
| Reversal/repost + durable undo | `+2 × 5 = +10` | `+1 × 3 = +3` | **+13** | Trust and willingness to use Hearth reinforce each other. | Original journal remains; relaunch/sync recovery. |
| Multi-device push-native sync + command-log | `+2 × 5 = +10` | `+2 × 3 = +6` | **+16** | Tier 1 Realtime **100–500 ms** then Tier 2 command-log ([`SYNC_ARCHITECTURE.md`](SYNC_ARCHITECTURE.md) D-149). | Tier 1 two-browser p95 ≤ 500 ms; Tier 2 interleaving harness. |
| Late-September Auth + membership RLS | `+2 × 5 = +10` | `+1 × 3 = +3` | **+13** | Mandatory before meaningful October data; temporary openness may accelerate Development but cannot slip past the date. | Cross-personal/household/environment negative pgTAP. |
| Reconciliation + JSON/CSV inbox | `+2 × 5 = +10` | `+1 × 3 = +3` | **+13** | Major utility. Proposals remain visibly separate until Confirm. | Provenance, idempotency, closing balance. |
| Hearth Household Fund | `+1 × 5 = +5` | `+0.67 × 3 ≈ +2` | **+7** | D-161 creates a truthful shared clearing and reconciliation routine without pretending Hearth holds money. October evidence remains a separate Release gate. | Exact Fund projector examples; custodian authority; Personal denial; rollover conservation; provider unique-match proof. |
| Family-office controls | `+2 × 5 = +10` | `+1 × 3 = +3` | **+13** | Grow after the household loop, not instead of it. | Deterministic rebuild and reviewer scenario pack. |
| Contextual learning simulations | `+1 × 5 = +5` | `+2 × 3 = +6` | **+11** | Worth doing after real workflow wins; simulations stay isolated. | Human review and zero-post/network mutation. |
| Hercules cooperative progress | `0 × 5 = 0` | `+2 × 3 = +6` | **+6** | Allowed only when it does not distract from unresolved books work. | No shame/comparison; no financial mutation. |
| Widget/watch/weather ambience | `0 × 5 = 0` | `+1 × 3 = +3` | **+3** | Low priority; safe-to-spend/freshness must be proven first. | Display-only spies and stale-state UI. |
| Due-to/from + settlement preparation | `+1 × 5 = +5` | `+1 × 3 = +3` | **+8** | Keep visible but gated; obligations first, external movement later. | Balanced obligations; recipient and duplicate recovery. |
| Bank/Open Banking intake | `+2 × 5 = +10` | `+1 × 3 = +3` | **+13** | High future value, hard-gated by Auth/RLS and read-only inbox semantics. | Provider sandbox, consent, provenance, revoke. |
| Interac handoff | `+1 × 5 = +5` | `+1 × 3 = +3` | **+8** | External action boundary must remain explicit; no claim of completion before evidence. | Wrong-recipient/duplicate recovery and reconciliation. |
| Cards/allowances/regulated rails | `+1 × 5 = +5` | `+2 × 3 = +6` | **+11** | Score does not override impossibility today; research only. | Qualified partner, counsel, security/fraud/dispute operations. |
| Multi-household product | `+1 × 5 = +5` | `+1 × 3 = +3` | **+8** | Founding household value and operations come first. | Repeatable opt-in value; deletion/support maturity. |

## 4.2 Tie-breakers

1. Remove veto risks first: unintended upload, invalid books persistence, cross-environment/member disclosure, lost updates, uncontrolled deploys.
2. Among safe items, prefer the smallest end-to-end household loop over isolated infrastructure or decorative breadth.
3. When weighted scores tie, prefer the item with a clearer falsifiable proof and easier rollback.
4. Course B can pull a Course A item earlier by improving completion or shared understanding; it cannot push a Course A safeguard later.

---

# 5. Length and format maintainability notes

## 5.1 Stable document shape

Keep the five top-level sections in this exact order:

1. Phases + to-do list
2. Rival features matrix
3. AI tooling
4. Dual Course deltas
5. Maintainability notes

Do not create a second active roadmap. `docs/ROADMAP.md` and `docs/PRODUCT_ROADMAP.md` should remain short pointers to this file. Canon decisions still belong in `docs/DECISIONS.md`; architectural invariants still belong in `docs/ARCHITECTURE.md`; this file links and schedules them.

## 5.2 Size budget

- Keep the decision-bearing core readable in one sitting: target **450–900 lines**, with tables and compact evidence links rather than pasted diffs.
- Length is a maintainability signal, not a hard product horizon. Never delete a future merely to hit a line count; compact it behind a clear gate/proof/kill statement.
- Keep 8–12 major Update chapters visible. When a chapter becomes purely historical, compress its evidence into one durable paragraph and retain commit links.
- Roll small updates into quarterly/era rows once there are more than 12; do not promote every commit.
- Keep Recent sessions to the one open or just-closed worksession. On the next worksession, move any durable outcome into the appropriate Update and replace the row.
- Rival rows remain one line of product reasoning each. Add a rival only when it changes steal/reshape/refuse guidance; remove dead links or replace them with an official source.

## 5.3 Update protocol

At the opening of a worksession:

1. Record date/time zone, baseline commit, active PR topology, allowed mutations, and owner in `docs/worksessions/`.
2. Re-read latest explicit instruction and current canonical files; do not use nostalgia/reference folders as next-work authority.
3. Update “What is true now” only from verified code, live behavior, tests, or reviewed PR evidence.

At the close of a worksession:

1. Mark the worksession CLOSED with commits/PRs, exact verification, Dual Course delta, open questions, and next owner.
2. Move durable product changes into a major or compact Update.
3. Change a roadmap status only when its named proof exists; an open PR is ACTIVE, never SHIPPED.
4. Re-score only major scope changes. Preserve the prior rationale in the Update or decision ledger.
5. Check every future item still has a gate, risk, proof, and kill/rollback note.

## 5.4 Formatting rules

- Use status words exactly as defined in §1.2; avoid vague “done-ish,” “almost,” or unsupported percentages.
- Separate **main/live**, **open PR**, **research**, and **idea** in every claim.
- Link evidence close to the claim. Prefer canonical file, commit, PR, test, official provider doc, or measured live behavior.
- Use checkboxes only for executable to-dos; use tables for comparisons and truth snapshots; use prose blurbs for major Updates.
- Never paste secrets, household payloads, personal transaction rows, or production identifiers into this roadmap or an AI packet.
- Avoid dates as promises. Dates may record history or a real external deadline; dependency gates determine sequence.
- Keep Cursor/Claude paste-ready packets in `docs/briefs/` and link them here so agent-specific detail does not overwhelm the living roadmap.

## 5.5 Ownership and review

- **Owner:** Jonathan decides production, regulated-rail, credential, retention, and destructive-data actions.
- **Mastermind:** Codex maintains cross-session roadmap coherence and audits drift.
- **Implementer:** Cursor is the default owner of the next approved code packet.
- **Experience reviewer:** Claude is the default owner of the visual roadmap artifact and interaction critique.
- **High-risk review:** money, privacy, auth, sync, and deployment packets require a second reviewer plus proof from deterministic tests.

This role split is intentionally soft. The laws, gates, evidence, and handoff contract are hard.
