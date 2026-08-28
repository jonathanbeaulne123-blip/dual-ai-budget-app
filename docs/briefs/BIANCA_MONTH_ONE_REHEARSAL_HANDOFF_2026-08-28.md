# Bianca Month-One Rehearsal — implementation handoff

## Decision and boundary

- Decision: D-168.
- Risk: High.
- Dual Course: Budget `+5`; Engagement `+3`.
- Branch: `codex/bianca-month-one` in the isolated `Budget App - Bianca Month One` worktree.
- Baseline: `c85ed0ca6e6b4f3235a1711381ea323b7927e666`; rebase once after Cursor PR #244 lands.
- No push, merge, deploy, hosted migration, provider, Production, scaling, shift-intake, product launch, or real household values without Jonathan's separate approval.

## Implemented behavior

`postOpeningBalances` creates one Development-only Toronto-date batch for existing assets and debts against Opening equity. It changes balance sheet/equity only, refuses stacking or late opening after ordinary money, is idempotent for one Confirm, and allows a corrected batch only after complete reversal of a pure opening history.

Versioned `MonthRehearsal` Shared metadata holds two named participants, four Toronto weeks, real receipt links/honest skips, friction attempts, exact checkpoints, own-phone acknowledgements, and final signatures. Non-money rehearsal commands return `postedIds: []`. Rehearsal facts are excluded from journal data, financial identity/audit facts, Hercules/model disclosure, analytics, and Worker requests.

Every real financial action links evidence that passes task-specific validation: command kind, week, transaction type/category/account relationship, Fund event kind, accepted receipt, reconciliation tie, or month close. The correction lesson runs the real post/reversal/journal compiler in a fictional discarded household and stores only an exact versioned proof. Equivalent simultaneous starts converge; differing active versions block action/approval but either participant can archive a conflicting version.

The prepared Development UI supplies explicit participant selection, participant-only reports, Start/Resume/Manage/Replay, read-only future weeks, deterministic Hercules copy, evidence preview and alternate choice, Continue versus Stopped on return, the short Bianca ordinary-playtest card, friction outcomes, `Tied`/`Needs attention` first, `See why` proof, exact approval language, and export disclosure. It is not mounted until #244's App/Home ownership boundary lands.

## Golden September 2026

- Opening: Chequing `$3,000`; Bianca Savings `$5,000`; Visa owed `$400`; Opening equity `$7,600`.
- Week 1: Chequing `$5,000`; Savings `$5,000`; Visa `$600`; net income `$1,800`; Fund operating `$1,000`, due `$100`, free `$900`.
- Week 2: Chequing `$3,400`; Savings `$5,000`; Visa `$200`; net income `$600`; Fund operating `$940`, due `$40`, free `$900`.
- Week 3: Visa `$180`; net income `$620`; Fund operating `$940`, due `$20`, free `$920`; correction practice discarded.
- Week 4: assets `$8,400`; liabilities `$180`; Opening equity `$7,600`; net income `$620`; Fund operating/free `$920`; due `$0`; September closed.

The golden test freezes balances, journal counts, trial totals, equation, Fund projections, receipt identities, checkpoint hashes, and scoped financial audit hashes after every week.

## Verification so far

- Focused opening/rehearsal/Fund suites: **39/39 passed**.
- TypeScript: passed.
- Independent books/trust review: approved after repeat-opening, receipt, conflict, and non-fixture practice fixes.
- Independent UX/retention review: component-level approved after explicit participants/read gate, visible evidence choice, return choice, playtest card, and export disclosure.
- Full repository run after the review fixes: **1,095 passed / 2 skipped**; the three unrelated failures were a missing `python3` Git-Bash alias in one API shell test, one nondeterministic rig timing sample, and one loaded stress timeout. Rig and stress passed in immediate isolated rerun. AI verification, TypeScript, and the Windows-native production build passed.
- Independent verifier: conditional pass for the isolated D-168 core; only #244 integration/browser/Gemini gates remain.

## Remaining ordered gates

1. Wait for #244 to merge; fetch and rebase this branch once onto the new `main`.
2. Mount `MonthRehearsalPanel` on Home (`surface="home"`) and More (`surface="manage"`) with existing persistence/Confirm routing and no new bottom navigation item.
3. Run focused suites, full `pnpm check`, TypeScript, production build, and AI-surface verification.
4. Prove two authenticated Development sessions at phone widths: invitation, resume, Hercules steps, evidence disclosure, friction, independent acknowledgement, and joint sign-off.
5. Send this exact packet plus final diff/test evidence to Gemini; disposition every finding.
6. Request Jonathan's explicit approval before any push. Approval of Month One inside the app still does not authorize launch or Production.
