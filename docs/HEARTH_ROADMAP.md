# Hearth living roadmap

> **Product:** Hearth — Jonathan and Bianca's household budget and family office  
> **Roadmap baseline:** `main@75574e4cad7a7346fdda8e97616fcf0efe09541b`, audited 2026-08-23 (Toronto)  
> **Canonical order:** latest explicit instruction → `docs/DECISIONS.md` → `docs/STRATEGY.md` → `docs/ARCHITECTURE.md` → this roadmap  
> **Purpose:** one maintained view of what shipped, what is true now, what comes next, what remains gated, and how every major choice serves the Dual Course.

This is a living planning document, not an authority to deploy, mutate production data, relax a financial invariant, or bypass a gate. Code and UI are untrusted until deterministic books and tests prove them.

---

# 1. Phases + to-do list

## 1.1 Non-negotiable product law

- **Course A — useful household finance and family office — has weight 5.**
- **Course B — shared engagement, Hercules, learning, delight, and interactables — has weight 3.**
- Course A wins any conflict. Engagement earns its place by making correct financial habits easier; it never edits, hides, or posts money.
- Commands are the money boundary. UI state, AI output, OCR, bank feeds, calendar data, widgets, weather, and Hercules are proposals or displays only.
- Only a visible user **Confirm** may post a command. Reversal/repost corrects mistakes; financial history is not silently rewritten.
- CAD is stored as integer cents. Toronto is the household time zone. Posted activity must remain double-entry and auditable.
- Development is not production. Production writes, deployments, migrations, and record cleanup require Jonathan's explicit approval.
- Bank feeds, Interac, card issuing, and other money rails remain on the roadmap but cannot cross their implementation gate before Auth + RLS and their own legal/security gates.
- The phone-first stack remains React + TypeScript, PGlite for the local books engine, Supabase as snapshot transport, and a Cloudflare Worker for the model boundary.
- Do not revive Google Sheets or clasp. Existing Google integrations may supply read-only context or draft proposals; Sheets is neither runtime, ledger, canon, nor sync transport.

## 1.2 Status language

| Status | Meaning |
|---|---|
| **STOP-SHIP** | A current behavior can violate privacy, money truth, environment isolation, or deploy safety. Contain and prove first. |
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
| Local books | PGlite exists and commands are the intended boundary, but app JSON/UI persistence can happen before PGlite ingest; ingest can return `ok:false` without failing the commit. | **STOP-SHIP:** make books validation fail closed before further money features. | A rejected ingest leaves UI, JSON, local storage, hosted snapshot, and audit state unchanged; property and integration tests prove atomicity. |
| Optional cloud link | `syncHouseholdBooks()` currently forces `linked: true`; boot and post-commit paths can upload a local/demo household to the bundled Supabase endpoint. | **STOP-SHIP:** separate local ingest from hosted transport; zero network for demo/unlinked. | Fetch-spy tests cover boot, demo, unlinked commands, relaunch, and failures; an approved inventory plan identifies any orphan/demo rows without deleting them. |
| Supabase boundary | The current migration grants broad `anon` access with permissive policies; the publishable key can reach every snapshot. Auth-ready SQL references a membership field not present in the current schema. | **STOP-SHIP:** do not describe Supabase snapshots as private. Contain transport, then implement Auth + membership-bound RLS locally. | pgTAP proves cross-household and cross-environment denial for select/insert/update/delete; anonymous access cannot enumerate or mutate snapshots. |
| Environment isolation | Join/pass payloads and pulled snapshot payloads are not consistently verified against the selected environment, household, or invite context. | **STOP-SHIP:** bind every import/pull/persist path to an asserted environment and identity tuple. | Adversarial tests reject mismatched environment/household/invite payloads without persistence or network side effects. |
| AI disclosure | The recent-row filter excludes partner-personal rows, but monthly aggregates/briefing/notices can still be derived from the full household. | **STOP-SHIP for broader AI rollout:** create one member-scoped disclosure projection. | Canary fixtures prove every outbound field excludes other-member personal amounts and identifiers; Worker receives only the projection. |
| Two phones | Pull-merge followed by unconditional two-table upsert has no compare-and-swap or authoritative RPC; simultaneous devices can still overwrite a merged snapshot. | Treat “no lost update” as unproven. | Deterministic interleaving/fault tests on two clients, monotonic revision/CAS, retryable outbox, and post-reconcile equality. |
| Rate limiting | Worker KV is not bound on live; current fallback permits requests. PR #63 adds an alias and limiter, but an isolate-memory/KV get+put counter is not a durable hard cap. | Keep #63 active; correct the claim/implementation before merge. | Bound production namespace plus a limiter with explicit failure semantics, concurrent-request tests, telemetry, and documented rollback. |
| Delivery controls | `main` is unprotected, required checks are off, and direct commits can reach the deploy workflow. | Add branch/ruleset and production-environment approvals before higher-risk merges. | Required build/test/security checks block merge; deploy requires reviewed `main` state and environment approval. |
| First-number utility | Mobile/Office, Accounts, Audit, appointments, sitdown/vault, Hercules, and budget foundations have shipped, but first-use budget/bill/shift editing and mistake correction remain incomplete on `main`. | After stop-ship containment, finish the smallest complete Bianca-ready monthly loop. | Phone E2E: start → enter opening truth → budget → add bill/expense → confirm → correct → reconcile → both members see the same result. |
| Active PR topology | [#63](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/63) targets `main`; draft [#61](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/61) targets a stale feature branch and includes merged [#62](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/62). #61 and #63 both allocate D-107. | Rebase/restack deliberately and reconcile the decision ledger before merging either chain. | Each PR has one current base, unique decision IDs, truthful test count, a reviewable diff, and no hidden loss of #62 work. |
| Tracker hygiene | Seven older PRs and the five open issues are legacy/stale; the issues are Sheets-era. | Archive or rewrite after inspecting unique code/history; do not let them drive priority. | Every closure links to its replacement, retained commit, or explicit “superseded” reason. |

## 1.4 Recent sessions

Only the currently open or just-closed worksession belongs here. Durable history moves into Updates.

| Worksession | State | Scope | Output |
|---|---|---|---|
| [2026-08-23/24 roadmap mastermind](worksessions/2026-08-23-roadmap.md) | **CLOSED; [PR #64](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/64) open for review** | Read-only canon/live/PR audit; living roadmap; Claude visual replacement brief; Cursor execution packets | `codex/hearth-roadmap-2026-08-23`; docs-only, no production mutation |

## 1.5 Updates — major shipped chapters

Major updates keep a durable blurb: what shipped, why it mattered, Dual Course effect, evidence, and a kill/rollback criterion. These are capability chapters, not a chronological commit dump.

### U-01 — Hearth rebuild and command-shaped mobile core — SHIPPED

- **What shipped:** the Hearth rebuild, mobile-first shell, and explicit command-oriented money interactions.
- **Why:** replace a spreadsheet-shaped workflow with a household product whose interaction boundary can be tested.
- **Dual Course:** Course A `+2`; Course B `+1`. The home metaphor earns engagement only around correct money work.
- **Evidence:** [Hearth rebuild](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/ece849016fa61cd1923cd3f3ad4536a962289933), [command/mobile follow-through](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/c64ee992cb2cff29cbf908932277aae029b30057).
- **Kill/rollback:** remove any shortcut that mutates money outside a typed command or hides the final posting summary.

### U-02 — Two-person household, PGlite books, and snapshot transport — SHIPPED, trust work ACTIVE

- **What shipped:** household phrase/join, two-person state, undo foundations, PGlite/Postgres books, and optional Supabase snapshot transport.
- **Why:** establish household identity, portable local truth, and a path to two phones.
- **Dual Course:** Course A `+2`; Course B `+1` because shared presence becomes real only when both people see the same books.
- **Evidence:** [household foundation](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/47b52f427231abad692fb6461796645e7abcaa94), [join/phrase](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/0818f83ab627d3aa0df07c3f35702712ac629452), [undo](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/1b8337c6ead80fb418c51ccbb9d1079cd671f054), [PGlite](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/458d5285e0fbb77f6532441e4e6b7822afbab194), [snapshot transport](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/63489a73e2e06a06926b5f3516593701f0fe2d9f).
- **Kill/rollback:** hosted sync is disabled or reduced to explicit export until zero-network local mode, fail-closed ingest, identity binding, RLS, and no-lost-update proofs hold.

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

## 1.6 Updates — compact shipped work

Small updates remain compact and link to evidence; promote one to a major blurb only if it changes household behavior, financial semantics, or a gate.

| Update | Why it matters | Evidence |
|---|---|---|
| Cloudflare deploy hardening | Keeps the model edge reproducible and narrows accidental deploy drift. | `edc7844`, `a00db22`, `ccf1185` in repository history |
| TypeScript/build repair | Keeps static checks available as a merge gate. | `0644621` |
| Cloud agent environment | Makes remote implementation more reproducible without granting production authority. | `2d2c46d` |
| Canon/doc maintenance | Records decisions and handoffs; current drift still needs Phase 0 reconciliation. | `6555c11`, `c7a523e` |

## 1.7 Phased roadmap

Phases are dependency-ordered, not date-boxed. A later phase can be researched or prototyped with synthetic data, but it cannot ship through an unmet earlier gate.

### Phase 0 — Contain trust leaks and reconcile the delivery surface — STOP-SHIP / ACTIVE

**Exit condition:** opening an unlinked/demo household creates no network traffic; rejected books never persist; external payloads cannot cross environment or member boundaries; risky code cannot deploy without checks.

- [ ] Split local PGlite ingest from hosted snapshot transport. Preserve `linked: false`; eliminate implicit boot/demo upload and duplicate linked pushes.
- [ ] Make command application atomic and fail closed across PGlite, JSON/UI state, IndexedDB/local storage, hosted snapshot, and audit trail.
- [ ] Validate environment + household + invite/member tuple on every join/pass/pull/persist boundary.
- [ ] Centralize a member-scoped AI disclosure projection; canary-test every outbound field, aggregate, notice, and memory.
- [ ] Inventory possible demo/orphan hosted rows. **Do not delete or modify them without Jonathan's explicit approval and a recovery record.**
- [ ] Rework #63's rate-limit claim and implementation; bind the intended live KV/stronger authority and define fail-open/fail-closed behavior.
- [ ] Rebase/restack #61/#62 deliberately, resolve the D-107 collision, and preserve unique work without merging hidden branch ancestry.
- [ ] Enable GitHub branch/ruleset protection, required checks, and production environment approval.
- [ ] Turn on GitHub 2FA for the owner account (open decision D-020).
- [ ] Archive or supersede stale Sheets-era issues and PRs only after recording retained evidence.
- [ ] Reconcile current canon drift: model-first vs stale on-device language, 18-row context, shipped Office/mobile work, snapshot-transport wording, and current working memory.

**Risk/gate:** privacy, money truth, environment isolation, deploy safety.  
**Proof:** fetch-spy zero-network suite; atomic failure tests; payload-fuzz suite; outbound disclosure canaries; protected-branch check; reviewed PR topology.  
**Kill criterion:** if the containment patch cannot prove zero unintended upload quickly, disable hosted transport in the client until the proof exists.

### Phase 1 — Complete the Bianca-ready local monthly loop — NEXT after Phase 0

**Exit condition:** Bianca can create the first useful month, understand it, make an error, correct it, and see a trustworthy result on a phone without developer help.

- [ ] Build current-month budget editing through a typed books command, retaining/reworking the useful budget editor from #62 rather than blindly merging its stack.
- [ ] Add a first-class bill/recurrence form for genuinely new entries; calendar/email/OCR may only prefill a draft.
- [ ] Add shift/income settings with explicit effective date and preview.
- [ ] Add opening-balance/setup guidance without fabricating history.
- [ ] Ship due-on-open preview only after its branch/decision ancestry is repaired.
- [ ] Make correction reversal/repost a first-class phone flow; never silently rewrite the original journal.
- [ ] Make undo durable across relaunch and sync, or label its exact local/session scope truthfully.
- [ ] Keep validation and duplicate warnings beside the field/action that created them; never hide a blocked post in a toast alone.
- [ ] Verify keyboard, focus, touch targets, reduced motion, screen-reader names, empty states, and low-light use.
- [ ] Add the minimum “Today” surface: bills due, safe next action, and unresolved reconciliation—not a second task manager.

**Risk/gate:** command boundary, integer cents, Toronto effective dates, double entry.  
**Proof:** phone E2E and fresh-profile usability pass; reversal journal inspection; property tests for cents/dates/balancing; Jonathan/Bianca acceptance.  
**Kill criterion:** cut decorative or secondary surfaces before weakening correction, clarity, or books proofs.

### Phase 2 — Make two phones boring and lossless — NEXT after local loop

**Exit condition:** two devices can work offline/online, interleave edits, relaunch, and converge without losing a valid command or leaking personal rows.

- [ ] Replace unconditional snapshot upsert with monotonic revision/CAS or an authoritative merge RPC.
- [ ] Define per-member/per-device identity, clocks, and actor attribution; `openShift` is not one global mutable slot.
- [ ] Add an idempotent outbox, acknowledgement, retry/backoff, and explicit “not yet shared” state.
- [ ] Pull on launch/focus/reconnect without erasing a safe local result when pull fails.
- [ ] Define tombstone/reversal retention and bounded compaction without destroying audit evidence.
- [ ] Make join semantics additive and recoverable; a second phone never replaces an existing household silently.
- [ ] Test every meaningful interleaving with two fresh clients, including clock skew, duplicate delivery, stale write, partial failure, and long offline periods.
- [ ] Show actor, source, freshness, and sync state in Audit without exposing another member's personal detail.

**Risk/gate:** lost updates, duplicate posts, privacy, false “synced” status.  
**Proof:** deterministic fault harness plus Playwright/WebKit two-context scenarios; post-reconcile journal equality and stable hashes.  
**Kill criterion:** fall back to explicit one-writer/export mode if convergence cannot be proved.

### Phase 3 — Auth + RLS and explicit cloud consent — GATED security foundation

**Exit condition:** an authenticated member can reach only the intended household/environment records, an outsider cannot enumerate them, and cloud sharing is an explicit reversible choice.

- [ ] Design Supabase Auth identity mapping and a real `members.auth_user_id`/membership relationship before writing policies around it.
- [ ] Replace permissive anon policies with membership- and environment-bound RLS for select/insert/update/delete.
- [ ] Rotate, expire, scope, and rate-limit join invitations; record issuer, acceptor, environment, and audit evidence.
- [ ] Add device/session revoke and household leave/recovery semantics.
- [ ] Make “Publish/share this household” an explicit Confirm with destination, data scope, and rollback/export explanation.
- [ ] Build and test migrations locally; backfill/production cutover is a separate Jonathan-approved plan.
- [ ] Add pgTAP negative tests and a permission matrix to required CI.
- [ ] Complete concurrency/outbox work before claiming authenticated two-phone safety.

**Risk/gate:** Phase 0/2 proofs; privacy review; recovery design; production migration approval.  
**Proof:** local Supabase tests for every role/action/environment; red-team attempt with publishable key; reviewed cutover and rollback rehearsal.  
**Kill criterion:** keep cloud sharing disabled if any cross-household read/write/delete path exists.

### Phase 4 — Reconciliation and safe intake — GATED by Auth + RLS for hosted sources

**Exit condition:** external data becomes a traceable inbox of proposals that a person can match, reject, or Confirm; it never bypasses the books.

- [ ] Add versioned JSON export/import and CSV transaction intake through typed commands, preview, row-level errors, provenance, and idempotency.
- [ ] If old Sheets data must be recovered, treat it as a one-time read-only document import. No clasp, formulas-as-runtime, or bidirectional sync.
- [ ] Add Gmail/Drive/receipt OCR only as approved-source draft evidence with retention/redaction controls.
- [ ] Build reconciliation lanes: unmatched, suggested match, duplicate, resolved; show source/freshness and why a match is proposed.
- [ ] Add category/rule preview, diff, replay, bounded scope, and audit; no retroactive invisible mutation.
- [ ] Add statement-level completeness controls and opening/closing balance checks.
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
- [ ] Add cooperative household quests tied to safe actions such as reconcile/review, never spending or partner comparison.
- [ ] Use rolling/graceful progress; no punitive streak reset, hearts, scarcity, shame, or pet harm.
- [ ] Let Hercules explain deterministic results and ask one useful question at a time; retain explicit consent and memory controls.
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

| Rank | Packet | Outcome | Required before |
|---:|---|---|---|
| 0 | Branch/canon reconciliation | Repair #63/#61/#62 topology, unique decision IDs, truthful baselines, and required checks without losing work. | Any feature merge |
| 1 | Zero-network local/demo + explicit transport | No boot/demo/unlinked upload, no forced `linked:true`, no duplicate push; approval-only orphan inventory. | Any hosted-data work |
| 2 | Atomic fail-closed books | A failed PGlite command cannot leave JSON/UI/storage/transport ahead of the journal. | New money commands |
| 3 | Environment and AI disclosure boundary | Reject mismatched passes/snapshots and emit only member-scoped model context. | More join/sync/AI rollout |
| 4 | Delivery and rate-limit guardrails | Protected `main`, required checks, production approval, truthful/bound limiter. | High-risk deploys |
| 5 | First Numbers | Complete budget, bill, shift, due-preview, opening truth, and phone accessibility loop. | Broader office/companion work |
| 6 | Corrections that survive | Reversal/repost, durable undo semantics, local validation placement, duplicate explanation. | Trusting daily use |
| 7 | Two-phone no-loss protocol | CAS/revision, actor/device clocks, outbox, interleaving/fault tests, truthful sync UI. | Authenticated sharing claim |
| 8 | Auth + RLS | Membership schema, negative RLS tests, invite/session recovery, explicit publish consent. | Bank/Interac/cards/hosted intake |
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
| Zero-network local/demo + explicit transport | `+2 × 5 = +10` | `+1 × 3 = +3` | **+13** | First. Restores honest local use and consent; enables safe delight later. | Fetch spy; no forced link; approval-only row inventory. |
| Atomic fail-closed PGlite books | `+2 × 5 = +10` | `0 × 3 = 0` | **+10** | First. UI convenience loses to journal truth. | Rejected command leaves every store unchanged. |
| Environment + AI disclosure boundary | `+2 × 5 = +10` | `+1 × 3 = +3` | **+13** | First. Personalized Hercules is retained only behind member-scoped disclosure. | Adversarial payload tests; outbound canaries. |
| Protected main, required checks, deploy approval | `+2 × 5 = +10` | `0 × 3 = 0` | **+10** | First. Slower direct publishing is an acceptable trade for household safety. | Ruleset and blocked-failure demonstration. |
| First Numbers monthly loop | `+2 × 5 = +10` | `+1 × 3 = +3` | **+13** | Highest product slice after containment. Calm phone interaction supports the books. | Fresh-profile Bianca-ready E2E. |
| Reversal/repost + durable undo | `+2 × 5 = +10` | `+1 × 3 = +3` | **+13** | Trust and willingness to use Hearth reinforce each other. | Original journal remains; relaunch/sync recovery. |
| Two-phone CAS/outbox/convergence | `+2 × 5 = +10` | `+2 × 3 = +6` | **+16** | Strongest shared-product multiplier, but cannot outrank stop-ship containment. | Two-client interleaving/fault suite. |
| Auth + membership RLS | `+2 × 5 = +10` | `+1 × 3 = +3` | **+13** | Security foundation; do not hide it behind engagement work. | Cross-household/environment negative pgTAP. |
| Reconciliation + JSON/CSV inbox | `+2 × 5 = +10` | `+1 × 3 = +3` | **+13** | Major utility. Proposals remain visibly separate until Confirm. | Provenance, idempotency, closing balance. |
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
