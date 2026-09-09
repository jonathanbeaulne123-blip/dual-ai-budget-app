# Hearth worksession — Hercules, Home and contribution sources

- **Status:** OPEN — locally implemented and verified; final acceptance incomplete, integration draft PR
- **Opened:** 2026-09-08 (`America/Toronto`)
- **Owner / decision owner:** Jonathan
- **Assignee:** Codex, with actual Claude visual packets and read-only auditors
- **Repository:** dual-ai-budget-app
- **Branch:** codex/hercules-home-fund-repair
- **Baseline SHA:** 76e486a142987ed5d6fbc065367fadf4c896de26
- **Risk:** High
- **Environment impact:** Development; no hosted schema or Production activation

## Household outcome

Onboarding lives inside deliberately opened Hercules, without dashboard space or unsolicited prompts. Restore the original entry feel across Add, modernize compact customization, repair confirmed widget gaps, and require declared Fund sources and explicit custody receipts.

## Budget delta (5)

Prevent missing-source and duplicate recorded-source contributions; preserve integer CAD, existing custody accounting and Personal isolation.

## Engagement delta (3)

Quiet immediate Hercules, cancellable/resumable lessons, compact Home and familiar focused entry.

## Scope and decisions

The user-approved implementation plan in this task is authority. Entries Not Posted/staging redesign is explicitly excluded. All three themes and desktop/mobile are required. Existing confirmed Fund contributions are grandfathered; each actor proposes only their own; custodian separately confirms receipt even for their own contribution. Manual declarations are not bank verification. Actual Claude produces CSS packets before ChatGPT entry implementation and reviews rendered results afterward.

## Acceptance evidence

- [x] Fund declarations, stale/concurrent receipt approval, linked allocations, legacy and privacy regressions (scoped local evidence; physical/hosted limits below)
- [x] Mounted Development-v2 onboarding start/close/resume/wait/correction/Ready, zero closed-Hercules layout footprint (scoped local evidence; physical/hosted limits below)
- [x] Quiet trigger and measured immediate-open/idle/request checks (scoped local evidence; physical/hosted limits below)
- [ ] Actual Claude source/screenshot input, CSS provenance and rendered comparison
- [x] All entry modes retain drafts, explicit account intent and Confirm (scoped local evidence; physical/hosted limits below)
- [x] Complete widget inventory and confirmed gap regressions; retained drawer routes (scoped local evidence; physical/hosted limits below)
- [ ] All three themes at390/1440, boundaries320/719/1100, keyboard/focus/large text/reduced motion/mobile keyboard/rotation
- [x] Focused High gate, TypeScript/build, startup and Bianca rehearsal (local;701tests passed)
- [x] Integration draft PR with review evidence: [#411](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/411)

## Evidence log

- Initial checkout clean; fetched main remains76e486a. Previous onboarding branch has identical tree to main; new integration branch starts directly from main.
- Actual Claude Opus5High produced the original CSS packet, independently reviewed162 integrated renders, and produced an exact257-line correction packet. Hashes and handoff records: `docs/entry-restoration/PROVENANCE.md`. Final wrapper-specific comparison is blocked by Claude usage quota; the already-authored extension was recovered with explicit provenance.
- Fund authority/source/retry regressions:18 passed across contribution-sources/admission; entry receipt identity and recovery helpers:10 passed in the first helper run, with further storage-corruption coverage added afterward. Office readings:9 passed. The combined focused run recorded37 passed before the two newest storage tests.
- PGlite schema9:5 passed, including Shared declaration persistence, owner-only source lineage, peer projection isolation, nullable unchecked reconciliation and upgrades from older schemas. Log: `artifacts/fund-source-pglite.log`.
- Hercules/Fund layout:15 theme/width cases,45screenshots, zero closed setup footprint, no unsolicited commands or requests; explicit setup/Fund keyboard containment and focus return passed. The stale one-hour sentence and initially low Start button were reproduced and repaired; Start is fully visible at320/390.
- Paired synthetic component opening measurements (10samples per version/width): phone median14.50→14.35ms, desktop296.45→10.45ms. Baseline desktop intentionally delayed taps280ms. Cold samples and host-load limitations are retained in the report. Zero conversational requests in each10second idle sample. A separate virtual-clock timer probe is not a real60second throughput measurement.
- Office/Hercules/Fund:114 broad axe scans and27 post-fix scans, zero reported violations/errors/overflow. Mobile drawer access, Classic resize collisions, visible cross-breakpoint focus return and reduced-motion sleeping animation were reproduced and repaired. Source manifests and limits are in `artifacts/office-a11y-verification/`.
- First full startup/current onboarding run:83passed/4failed. Draft-editing while books validate was accidentally disabled; separated editing busy from financial posting readiness. Healthy storage removal now stays removed instead of resurrecting module memory. A partial stage mock was also missing engine lifecycle stubs. After repair, the complete startup file passed80/80, including Bianca, entry recovery and Development-v2 setup.
- Focused High gate attempt crossed its300second soft time target during TypeScript. This timing breach must remain visible even if its checks pass. No exhaustive gate was requested or run.

## Remaining uncertainty

Final actual-Claude comparison and physical/device acceptance remain open. Local automated gates below are measured passes; they are not a release claim. Physical device and actual assistive-technology checks must remain separately identified from browser emulation.


## Rollback and compatibility

Retain accepted Fund source declarations, private allocation lineage and source-aware receipt events. Do not downgrade persisted schema9 into an older projection or strip new fields from accepted snapshots. A rollback should disable the affected mutation entry points while retaining source-aware command validation and readers. Legacy transport refuses linked-source Fund mutations it cannot preserve; older unresolved proposals cannot be confirmed without a declaration. Presentation CSS can be reverted independently of accepted records. No hosted schema was applied by this patch.

Entry confirmation IDs are bound to the exact captured command and scoped review. Recovery checks the existing receipt first; a missing receipt may retry only the same identity with unchanged membership/settings/Fund basis. Changed basis requires review. A corrupt or unsavable confirmation record blocks a new post; draft storage failure is disclosed and latest values remain in the open tab.

## Physical and hosted limits

Chromium viewport, reduced-height keyboard simulation, text-size emulation, axe scans and synthetic principal callbacks do not prove physical iOS/Android keyboards, real rotation/browser chrome, VoiceOver/NVDA, authenticated desk Save/Pull or a real two-device rehearsal. These must not be converted into a readiness or release claim. Production activation and hosted schema application remain outside this patch.

## Subsequent validation

- Complete mounted startup:80/80,48.09seconds; log `artifacts/browser-evidence/entry-audit/startup-complete-stage-full.log`.
- Financial fixture repair:12/12 held/continuity/golden tests and40/40 month-spread tests. Acceptance helpers now supply the actual acting member. Eight hash expectations reflect only new declaration/reconciliation evidence; numeric balances, journal totals and receipt identities remain unchanged. Removing only that new provenance from diagnostic synthetic clones recovered all four old weekly hashes.
- The first High gate failed:584pass/9fail plus a worker RPC timeout. Its TypeScript phase passed in392.244seconds, breaching the300second soft target. Failures included old one-click receipt expectations, omitted actor identity, two source-text shape assertions and a loaded-host month-spread timeout. These were repaired with actual receipt review and mounted role/routing coverage; the gate is rerun below.
- Local screenshots are synthetic component evidence. The earlier114-image Claude packet’s “recovery” images prove reopened drafts, not pending-receipt notice rendering. Final local notice checks mount the exact App notice JSX with synthetic state; full-App behavior is covered separately by startup tests.

- Repaired mounted UI checks:67/67 across Ask/Settle/motion/Till/mobile entry, including explicit one-account intent. The following High rerun stopped at TypeScript on a missing `onPost` callback in that new test fixture; fixed the fixture rather than weakening its type. This rerun also breached the soft budget (322.231seconds overall; TypeScript305.982seconds).
- Final entry matrix:60/60flows,711screenshots, no runtime errors/overflow/undersized targets, with all60pending-receipt actions and Close checks passing. Eighteen busy-only screenshots taken before React committed busy state are excluded from that claim. Separate current-source explicit-wait opacity/large-text delta:21/21cases,57screenshots, zero axe violations; amounts remain full opacity. Source manifests and reports are committed in `docs/entry-restoration/evidence`.
- Additional read-only authority review found Fund identity is fixed and immutable, so accepted old-Fund source allocations cannot escape the current Fund reservation reading. No speculative change was made.

- Final Fund storage review reproduced unavailable-store and corrupt-record identity replacement across reload. Replaced the memory fallback with a durable pre-send requirement, including rechecking the exact ID at Confirm received. All three Fund surfaces announce refusal without sending. Seven mounted Fund storage tests plus15mobile entry tests pass (22total,5.96seconds). Diagnostic logs live under `artifacts/browser-evidence/entry-audit/fund-storage-*`.

## Final local gate

Focused High gate **passed701tests across62files**:603fast +98serial, including full startup/Bianca, PGlite, privacy and current Fund recovery tests. TypeScript, AI surface and diff checks passed. Total208.845seconds, **no time-budget breach on this final run**. Earlier failed/breached runs remain disclosed above. Exact executed command, selected files and dirty-tree source fingerprint are committed in `docs/entry-restoration/evidence/high-gate.json` and `high-gate-command.txt`. Later packaging changes are evidence/docs and trailing-whitespace cleanup only; runtime behavior is unchanged. No exhaustive lane was run.

Final Fund storage-error browser follow-up:18/18cases (proposal, receipt, legacy replacement ×three themes ×390/1440), zero command calls, zero axe violations or overflow, all targets≥44px on both axes; Enter retains focus and the error is announced with role=alert. Synthetic components only.

Build passed with exit0: TypeScript, Vite (34.97seconds bundling), Hercules Pro UI, and no forbidden `_redirects`. Existing dependency eval/browser-external and large-chunk warnings remain visible in the local build log; they were not suppressed. No hosted schema, main merge or deployment was performed.

Final delivery is a draft integration PR. This patch must remain unready until actual Claude compares the final source/render packet and the required physical/device/assistive-technology rehearsal is completed.

Published [draft PR411](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/411). Implementation commit: `2f7ad3807d345541bfb1552309d97427ebbaa5c0`; the delivery-link follow-up is documentation only. Remote branch is pushed; no merge/deployment. Acceptance remains incomplete for the named Claude and physical/device gates.

## Authorized Development release —2026-09-08

Jonathan explicitly instructed “ok push merge and deploy” after the remaining Claude, physical-device, screen-reader and two-device limitations were explained. This authorizes Development release with those limitations retained; it supersedes the earlier draft-only hold. It does not assert full acceptance or authorize Production activation, hosted schema application or destructive data changes.

Release review: **CONDITIONAL**. Candidate06626c7 has successful hosted CI34307704371 and Cloudflare build34307704369. Local High701-test gate, build, Fund privacy/accounting/retry evidence and all authored-theme checks remain as recorded above. Main is still76e486a; working tree was clean. Runtime source is unchanged since the tested implementation apart from whitespace cleanup. Exhaustive verification and the named physical/Claude checks remain absent.

Budget(5): conserve allocations and accepted receipts; Engagement(3): quiet cancellable setup, compact Home and focused entry. Deployment uses the established main-triggered Cloudflare workflow, with Production continuity explicitlyOFF. Final merge/deployment identifiers and live smoke evidence will be recorded in PR411. Preserve source-aware readers and schema9 lineage on rollback; do not downgrade accepted receipts.
