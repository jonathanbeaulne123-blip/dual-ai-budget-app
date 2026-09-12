# Hercules audit repairs and capability expansion

## Outcome and ownership

Jonathan and Bianca can ask a question without losing their current planning task, discover actions Hercules can actually perform, set up an hourly job before recording a shift, and manage the same to-do through its lifecycle. Financial actions retain editable review, Final Confirm and their original receipts.

Target: Codex integration/release review, with Claude for a bounded hands-on product recheck. Jonathan owns release decisions. High risk. Budget (5): distinguish unknown earnings and resolve current scoped facts. Engagement (3): usable conversation, discoverable actions and preserved work.

Repository: `jonathanbeaulne123-blip/dual-ai-budget-app`. Branch: `codex/hercules-audit-expansion`. Base: `1686ccc4a569c99b5a2d92ae8b311b83873e211d`, reverified against `origin/main` on 2026-09-12. No PR, push or deployment is included. The worksession records exact candidate and measured verification once gates finish.

## Claude evidence and current disposition

Claude's supplied bundle ends at `2c7601e252ff3752c0fbe096e1716693383d3c35`, based on older `a0d76e99b9a0d1e31aafc618608fe4dcdb7ef100`. The three downloaded audit documents and nine-file source patch were read and checked against current source. His old live results are historical. Native computer control could read Claude but could not click; no new interview was delivered. Raw transcripts remain local-only.

| Finding | Current implementation / remaining evidence |
| --- | --- |
| J0 unexpected invited-member label | Not reproduced in current source. Retest signed-in identity separately; do not rename a real member to hide the symptom. |
| J1/J2 gross presented as take-home and unknown net | Effective-date gross, supplied/calculated/unknown take-home are distinct. Unknown role earnings block posting even when tips are positive. Supplied custom paid breaks remain valid. The claimed 1.00 default did not reproduce. |
| J3 retired receipt route | Copy points to Recent changes on this phone. |
| J4/J5/J6 swallowed questions, lost pause and shift answer | Side questions bypass field parsing; pause survives private workflow persistence; current posted-shift queries have deterministic fallback. |
| J7 Kitty Bank denial / draft blocks another task | Aliases match existing saving tools; new actions preserve the prior draft and queued confirmation identities. Target dates remain optional; creating a bank creates no backing. |
| J8 capability disagreement | Executable registry drives scoped catalogue and current field/choice reads. Searchable action library remains available with an open task. New hourly-job adapter and modern task lifecycle close demonstrated gaps. |
| J9/J10 reconnect and endless Opening | Token, fetch and body share a deadline; polling does not overlap; errors retain drafts and expose earlier conversations. Old disabled-activation diagnosis is stale; hosted authentication remains separate proof. |
| J11 overlapping conversations | One presentation owner, distinct Workspace React key, explicit handoff and retained unsent composer. Paused Add remains resumable. |
| J12 Easy Read inaccessible after scrolling | Full-width sticky control inside its actual conversation scroll owner; composer remains available. |

## Implementation boundaries

`src/workspace/actionQueries.ts` runs inside authenticated `LedgerRoom.workspaceQuery`. It reuses action parsers and scope filters, validates dependent choices, pages bounded responses and records accepted sequence/time. Caller-owned private Household Plan preparation is restored deliberately; other private records are excluded. Quiet source text is scrubbed; identifiers containing it are omitted and cannot be recovered through label parsing.

`hearth_action_options` resolves the current fields before `prepare_action`. Discovery no longer advertises an unscoped static capability list. New grants include these two read names. An older immutable grant pauses and resumes with fresh authorization instead of silently widening. No schema change is required.

`herculesWorkActions.ts` builds a bounded hourly job with explicitly reviewed pay/tip choices. It creates settings and owed accounts, not earnings. On its accepted receipt, a queued shift can select the uniquely created job/role while retaining its hours, date and separate confirmation. Complex pay rules stay editable in Work.

`herculesTaskActions.ts` edits/completes/reopens/removes modern planner tasks in their original scope. Financial completion uses matching accepted evidence, excluding reversals and wrong-scope payments. Legacy board drafts remain usable until adopted; adoption requires current identity and a fresh review. Recurrence/history and financial links are retained.

No provider/model/quota setting, secret, external connector credential, hosted schema or accepted financial authority changes. Local browser fixtures deny external requests; model and authority tests use synthetic data. Review consulted current [Cloudflare Workers practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/) and published type references; package versions and bindings remain pinned to Hearth's existing installation.

## Verification and return handoff

See [the worksession](../worksessions/2026-09-12-hercules-audit-expansion.md) for candidate SHA, exact focused commands, time budget, browser counts, failures corrected and limits. Required local evidence: focused High gate including App startup and month rehearsal; production build and Workspace Worker types; actual App room handoff with Add/composer preservation; Easy Read and artifact matrices across all themes and scopes.

The next reviewer should verify those recorded results, then run a bounded live Flash dialogue and authenticated reconnection test only in an authorized environment. Physical phone/keyboard and cross-device evidence, real model quality/latency/cost comparison, live identity label, and hosted free-quota state are not established by synthetic tests. No exhaustive gate is claimed.

A future release should deploy compatible authority before clients. Rollback disables new execution while preserving private work, old grant recovery and accepted receipts; do not delete work or roll back financial state. Return exact SHAs, measured results, remaining user-visible failures and an explicit release decision.
