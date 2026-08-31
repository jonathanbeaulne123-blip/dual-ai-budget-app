# Bianca Month-One Rehearsal — implementation handoff

## Decision and boundary

- Decision: D-183 (renumbered after current `main` assigned D-168 to coworker attendance and D-182 to Google-first household entry).
- Risk: High.
- Dual Course: Budget `+5`; Engagement `+3`.
- Branch: `codex/bianca-month-one` in the isolated `Budget App - Bianca Month One` worktree.
- Current mainline baseline: `da7fe2e2b079d88a8d88e934f0641be932654b86`; prior release heads are retained on named recovery refs.
- Current implementation: rebased commit `bb6fb0c` on `codex/bianca-month-one`, with full-App and D-180 command-event regressions plus receiver hardening; release-review documentation follows on the branch.
- No push, merge, deploy, hosted migration, provider, Production, scaling, shift-intake, product launch, or real household values without Jonathan's separate approval.

## Implemented behavior

`postOpeningBalances` creates one Development-only Toronto-date batch for existing assets and debts against Opening equity. It changes balance sheet/equity only, refuses stacking or late opening after ordinary money, is idempotent for one Confirm, and allows a corrected batch only after complete reversal of a pure opening history.

Versioned `MonthRehearsal` Shared metadata holds two named participants, four Toronto weeks, real receipt links/honest skips, friction attempts, exact checkpoints, own-phone acknowledgements, and final signatures. Non-money rehearsal commands return `postedIds: []`. Rehearsal facts are excluded from journal data, financial identity/audit facts, Hercules/model disclosure, analytics, and Worker requests.

Every real financial action links evidence that passes task-specific validation: command kind, week, transaction type/category/account relationship, Fund event kind, accepted receipt, reconciliation tie, or month close. Account reconciliation and month close each emit a stable artifact ID and command kind; every relevant row must have its own accepted Confirm receipt before the rehearsal counts it. The correction lesson runs the real post/reversal/journal compiler in a fictional discarded household and stores only an exact versioned proof. Equivalent simultaneous starts converge; differing active versions block action/approval but either participant can archive a conflicting version.

The Development UI is mounted on Household Home and More only, with no new navigation item. It supplies explicit participant selection, participant-only reports and conflict controls, Start/Resume/Manage/Replay, read-only future weeks, deterministic Hercules copy, evidence preview and alternate choice, Continue versus Stopped on return, the short Bianca ordinary-playtest card, friction outcomes, `Tied`/`Needs attention` first, `See why` proof, exact approval language, and export disclosure. Tasks open ordinary guarded Add/Card/Books surfaces; the rehearsal never confirms money. This is a mainline projection, not a parallel trial app: the permanent App integration regression opens the current Add slideshow from an active rehearsal, and non-money rehearsal updates materialize through D-180 command events for the other device.

Command replay accepts rehearsal facts only in Development Shared scope when the direct or compacted command declares `updateMonthRehearsal`, the actor is a selected participant, participant identities did not change, and the SHA-256 materialization proof matches. Personal scope strips them. This detects accidental or in-transit payload changes; it is not a server signature, so a deliberately compromised authenticated-participant client remains outside the proof until separate server-authority work is approved.

## Golden September 2026

- Opening: Chequing `$3,000`; Bianca Savings `$5,000`; Visa owed `$400`; Opening equity `$7,600`.
- Week 1: Chequing `$5,000`; Savings `$5,000`; Visa `$600`; net income `$1,800`; Fund operating `$1,000`, due `$100`, free `$900`.
- Week 2: Chequing `$3,400`; Savings `$5,000`; Visa `$200`; net income `$600`; Fund operating `$940`, due `$40`, free `$900`.
- Week 3: Visa `$180`; net income `$620`; Fund operating `$940`, due `$20`, free `$920`; correction practice discarded.
- Week 4: assets `$8,400`; liabilities `$180`; Opening equity `$7,600`; net income `$620`; Fund operating/free `$920`; due `$0`; September closed.

The golden test freezes balances, journal counts, trial totals, equation, Fund projections, receipt identities, checkpoint hashes, and scoped financial audit hashes after every week.

## Verification

- Current-main focused App/opening/rehearsal/Fund/continuity/materialization suites: **83/83 passed across 14 files**.
- Post-hardening current-main verification: **1,319/1,319** outside the environment-sensitive deployment file, then **8/8** in `test/api.test.ts` with bundled Git/Python paths — **1,327 passed / 3 skipped / 0 failed** combined.
- Current-main TypeScript, AI-surface verification, Windows-native Vite production build, Hercules Pro UI build, and absence of `dist/_redirects`: passed.
- Current-main local browser proof: active fictional Development rehearsal at 320/390/720/1100 px, no horizontal overflow, ordinary Hearth navigation present, future week preview-only, visible keyboard focus, and no browser warnings/errors.
- Coordinator's final selected opening/rehearsal/Fund/continuity suites: **37/37 passed across seven files**. Independent verification additionally passed **42/42** focused and **49/49** command/continuity/visibility checks.
- TypeScript: passed.
- Independent books/trust review: PASS after opening, receipt, conflict, non-fixture practice, and accepted reconciliation/month-close receipt fixes.
- Independent UX/retention review: PASS after explicit participants/read gate, visible evidence choice, return choice, playtest card, export disclosure, and conflict privacy.
- Full repository run: **1,276 passed / 3 skipped** with one environment-only `test/api.test.ts` failure because native Windows lacked `bash`. AI verification, TypeScript, and the Windows-native production build passed.
- Local in-app visual proof: fictional Bianca/Jonathan Development sessions at 320/390/720/1100 px; Home invitation/resume, More management, four-week disclosure, participant-only state, no overflow, and no console errors. The harness is intentionally synthetic and does not prove Google Auth or hosted continuity.

## Remaining ordered gates

1. Decide whether to authorize a separate server-side rehearsal transition validator/signing packet before authenticated-phone proof; no hosted change was made here.
2. Obtain Jonathan's explicit action-time approval to send this exact packet, implementation diff, and test evidence to Gemini; then disposition every finding.
3. When authorized Development identities and an endpoint are available, prove two authenticated phones: invitation, resume, Hercules steps, evidence disclosure, friction, independent acknowledgement, hosted continuity, and joint sign-off.
4. Request Jonathan's separate explicit approval before any push. Approval of Month One inside the app still does not authorize launch or Production.
