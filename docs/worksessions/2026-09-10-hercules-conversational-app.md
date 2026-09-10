# Hercules conversational app implementation

- Status: OPEN — local implementation
- Owner / decision owner: Jonathan
- Assignee: Codex; one writer, independent read-only reviewers
- Branch: codex/hercules-conversational-app
- Baseline: 2db3da9fd3bff0c23beb78ceaf73295b19f2e34e (verified remote main)
- Risk: High
- Authorization: Jonathan explicitly requested implementation of the complete conversational-app plan in this task on 2026-09-10.
- Environment: local synthetic Development verification; no release, hosted schema, secrets or Production activation.

## Outcome and deltas
Budget (5): existing command authority through reviewed, exactly-once conversational actions.
Engagement (3): useful discoverable skills, plain-language guided tasks and a persistent compact composer in all three themes.

## Accepted decisions
Complete tasks inside chat; Final Confirm button or exact standalone command; every requested saved change reviewed; existing chat/memory autosave retained. Private cross-device drafts require refreshed reviews. One action per review. Hearth calendar default, Google explicit. Compact 440px desktop panel. Current provider/data gates retained.

## Implementation sequence
1. Capability coverage, grounded model awareness, copy and chat shell.
2. Shared command service, typed private draft/review/receipt lifecycle.
3. Money, work, plans and bills.
4. Accounts, goals, Fund, boards and companion.
5. Imports, reconciliation, setup and administration.
6. Native/Google calendar operations and complete verification.

## Acceptance
Page/chat parity; no pre-confirm domain mutation; duplicate/stale/unknown receipt recovery; identity and ledger privacy; domain-specific money rules; cross-device draft recovery; Calendar recurrence/DST/partial failures; model fallback and dialogue clarity; three-theme desktop/phone keyboard and zoom proof. Focused High gate only; no exhaustive gate authorization.

## Evidence
Read-only baseline verified. Implementation and current verification receipts follow below. No completion claim until coverage and acceptance close.

### Local checkpoint — 2026-09-10

Implementation currently includes 80 catalogue entries backed by domain adapters, deterministic natural entry and corrections, a private sequential checklist, immutable pending claims, editable exact reviews, receipt recovery and a server execution pause. It also includes native event shape/recurrence/privacy projection and actual bill-payment evidence. This count is not command-option or whole-app coverage; the matrix explicitly marks partial paths.

Measured before the final focused gate:
- `test/hercules-actions.test.ts`, `hercules-action-ui.test.ts`, `hercules-execution.test.ts`, `hercules-fund-actions.test.ts`, `native-events.test.ts`: 28 tests passed in 68.28 seconds. Subsequent recovery regression cases and focus fixes require the final run below.
- Existing private UI and companion continuity run: 31 of 32 passed; the phone Tab-wrap failure exposed delayed composer autofocus. Replaced animation-frame autofocus with the dialog's explicit autofocus target plus synchronous desktop open focus. Awaiting rerun.
- TypeScript checks completed without errors at two intermediate snapshots. Do not treat those snapshots as the final gate.
- Local in-app browser reached the synthetic demo, opened the compact panel, focused the composer, started an expense draft and restored composer focus after Send. It exposed the existing no-cloud private-save restriction and a missing immediate dialogue display; the latter was repaired. This is UI evidence only, not an accepted authenticated write.
- Early automated browser attempts produced no viewport results (dependency-symlink WASM denied by Vite, then slow startup/timeouts). Local-only Vite config now allows the exact dependency worktree and disables all remote proxies. No failed attempt counts as a pass. Hot reload is disabled for stable geometry verification.

High-risk gate and three-theme browser script are running. Logs/artifacts remain local in `.artifacts/hercules-conversational/`. Required authenticated-device, live-model, external Google, physical keyboard/Safari and full-app coverage gates remain open. No deployment or activation occurred.

### Expanded implementation and verification checkpoint

- Added nine appointment/claim adapters and nine private companion/gallery adapters. Recurrence bounds match domain limits (including Last weekday); quiet labels use the Hercules privacy surface. Full reimbursement uses the existing strict claim graph review. Other partial/overpaid and private claim paths remain open.
- Named wardrobe actions use a static server-owned effect classifier. Client/authority still require wardrobe version 1 and one command; unknown actions cannot claim wardrobe permissions. Each wrapped operation consumes the exact private workflow claim.
- Receipt recovery retains a resolved identity and minimum release revision in local storage through repeated reloads, waiting for the canonical successor. It never rebuilds the old queue. Ordinary workflows expire after the existing 30-day private-history window with revisioned deletion; pending identities survive. Clearing chat also invalidates queued ordinary work.
- Conversation rendering retains up to the existing 300-turn history cap; the model still receives the existing bounded context. Current workflow field keys are supplied to the model without confirmation authority. First-account preparation can precede an expense in the private checklist.
- Browser matrix passed 12/12 synthetic cases across Classic, Taylor and Newfoundland at 390x700, 320x568, 1440x900 and 1100x600. Composer visible/enabled/focused, desktop width 440px, no shell overflow or detected action-region axe violations. Report: `.artifacts/hercules-conversational/report.json`. This predates the additional adapters and is not authenticated write, physical keyboard or 200% browser zoom proof.
- First High gate: diff and AI surface passed, TypeScript passed in 1,439.967 seconds, 145/146 fast tests passed; one assertion expected lowercase `waiting` rather than rendered `Waiting`. Gate failed and breached the five-minute target; retained log `high-gate.log`. Fixed assertion and expanded repeated-reload regression.
- Focused recovery/native/private UI rerun: 30/30 passed in 23.03 seconds. Appointment scenarios: 4/4 passed. Companion authority scenarios: 5/5 passed in 38.93 seconds. Existing wardrobe continuity: 6/6 passed. Intermediate TypeScript passed. Final expanded High gate is pending; prior evidence does not certify the final tree.

Whole-app completion remains OPEN: complete jobs/attendance controls, imports/account-history, remaining planning/Fund/administration paths, arbitrary outfit fitting and specialized file/auth controls, full native event instance edits, and Google event management/recovery remain unfinished. No deployment, schema application, provider activation or Production release occurred.

### Final local observations so far

- Additional 6/6 synthetic short-viewport cases passed across all themes at 720x450 and 390x350: composer visible/enabled/focused; desktop 440px; no overflow or action-region axe violations. These simulate constrained layout, not actual browser zoom or physical keyboard proof.
- Final focused chat/recovery rerun: 30/30 passed in 175.36 seconds, including intermediate claim projection and another reload while awaiting the canonical release revision.
- Final adapter/provider rerun: 25/25 passed in 145.00 seconds (general actions, appointments/claims, companion authority, Worker contracts).
- Remaining conflicting never-posts text and jargon were removed from page helpers, statement description, SitDownGuide and primary Hercules documentation. Repeating-item choices now require accounts available in the current view.
- Expanded High gate began at fingerprint `58ef2252559febec34d2a93c736116a4cf5a40fe9c09f9bcc8ba1ecc5860d6d2`, before the final copy and intermediate-projection fixes. It must not be represented as a final-tree certificate. It has again exceeded five minutes in TypeScript; see `high-gate-expanded.log` for eventual outcome. Diff hygiene currently passes.

### Checkpoint disposition

Implementation remains OPEN and is not release-ready. The expanded gate was stopped after more than 35 minutes in TypeScript, on an already superseded source fingerprint; do not mark it passed. The prior intermediate typechecks and focused test results remain scoped evidence only. The local preview server was stopped after browser verification. No push, merge, deployment, schema application or activation occurred. Preserve the worktree and continue from the implementation packet; do not discard pending identities, accepted events or the current private draft schema during rollback.


## Authorized Development release — 2026-09-10

Jonathan explicitly instructed: "enable chat writes then push merge and deploy" after the incomplete scope and verification limits were disclosed. This authorizes releasing the implemented subset to Development. It does not certify whole-app completion, authorize Google event writing, apply hosted schema, change provider/data gates or activate Production.

Client build defaults `VITE_HERCULES_ACTIONS=1`; server `HERCULES_ACTIONS_ENABLED=true`. Both restrict execution to Development. `HERCULES_EXTERNAL_CALENDAR_WRITES=false`; Production continuity remains off. Rolling back uses either presentation flag 0 or server execution flag false, retaining compatible fields, accepted receipts and pending cancellation/recovery.

Integrated current main `caf625a` (mobile clearance and sync status changes); preserved both appended decisions. Risk High. Budget (5): user-reviewed existing command outcomes; engagement (3): enabled guided actions and persistent composer. Focused High gate, build, PR CI and live asset proof must be recorded below; full-suite/authenticated-device/live-model acceptance remains separate.

Release review repaired one P1 before merge: every posted effect now discloses Personal, Household or both ledgers, its account and amount, plus inherited Fund share/destination and projection. Tip-out payments require the job's ledger view. Regression scenarios passed for work component defaults and Fund-funded bill payments. The Cloudflare declaration reference was restored ahead of imports after the initial release typecheck failed.

Refreshed integrated browser proof: 12/12 synthetic cases across all three themes at 390x700, 320x568, 1440x900 and 1100x600 passed with visible, enabled, focused composer, 440px desktop panel, no overflow and no action-region axe violations. Evidence: `.artifacts/hercules-conversational/report.json`. This is local synthetic UI evidence, not authenticated writing or physical-device proof. Final gate/build/merge/deployment evidence is attached to PR #425 so it names the exact released commit without changing that commit after verification.

Final-commit PR CI passed 211 tests and the build with actions=1. An intermediate local High gate passed 320 tests in 159 seconds. The repeated final local gate was stopped after TypeScript exceeded five minutes under severe machine contention; it is not a passing final certificate. Added a path-scoped Hercules High-risk CI workflow with the same explicit focus list so the final release and future changes receive that expanded proof on a clean runner. Release waits for its result.
