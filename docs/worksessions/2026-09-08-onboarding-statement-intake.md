# Statement setup intake for onboarding v2

- Status: locally implemented; integration owned by root onboarding-v2 task.
- Owner/decision owner: Jonathan. Assignee: Codex intake subtask.
- Branch: codex/onboarding-v2-intake. Baseline: a1215b2d49331c311ddd39402cfba0237d909cbd.
- Risk: High. Budget(5): +3, explicit statement checkpoints, provenance and scoped review. Engagement(3): +2, reusable local drafts reduce retyping.
- Authorization: Jonathan approved the onboarding v2 plan including statement upload, historical posting/rebase, PDF, deterministic suggestions, and all three themes. This branch owns intake only; the account-history domain and integrated review/Confirm are separate coordinated changes.

## Outcome and boundaries

`StatementSetup` stages normalized PDF/OFX/QFX/image evidence in an IndexedDB draft keyed by environment, household, member, Google Auth user and view. Raw source files remain transient. Restored source preview requires SHA-256 verified reattachment. Scope is acknowledged before choosing/scanning. PDF uses bundled PDF.js worker, a 20 MB/50-page refusal boundary, sequential selected-page raster/scan, explicit omitted/failed pages, and unlocked-copy instructions for encrypted documents. Images retain the existing scanner's 10 MB bound. OFX/QFX parse locally. No source is uploaded in verification; PDF page responses are mocked.

Statement OCR schema includes signed opening/closing balances, checkpoint dates, per-account coverage dates, completeness and known omitted rows. It rejects output above the 250-row per-page envelope rather than truncating; exactly-at-limit and dropped rows are incomplete. Every extracted row remains reviewable. No default category is invented for unknown merchants. Resolved page/source reviews, explicit row exclusions, account/category/transfer mapping and exact checkpoints precede the callback. Paired transfer statement legs require explicit matching and preserve both source identities. Source periods/checkpoints remain account-specific.

`onReviewHistory(input, draftId)` passes the structurally compatible account-history input to the integrator; it never writes money. The account-history domain owns exact checkpoint reconciliation, duplicate detection, rebase, approvals and Final Confirm. After successful acceptance the parent may call `discardStatementDraft(scope)`; opening a review must not discard it.

Suggestions reuse `suggestedRhythms` on visible accepted, non-reversed history. Estimates use net accepted expense/refund/reversal projections, only the three calendar months immediately before today, and require contiguous accepted coverage for every active scoped non-investment account. One account's coverage does not establish whole-scope coverage. Missing history leaves estimates absent. Category suggestions reflect reviewed/matched mappings. User-selected suggestions save to an independent owner-scoped handoff via `save/load/clearStatementSuggestionHandoff`; Calendar retains its existing Adopt action. No new financial or recurrence writer.

## Interface

- `src/StatementSetup.tsx`: required props `household` (visible projection), `memberId`, `authUserId`, `view`, `onReviewHistory(input,draftId)`; optional `onUseSuggestions`, `acceptedCoverage` and `onDone`.
- `acceptedCoverage`: `{accountId,from,through,sourceIds}[]`, supplied only from accepted account-history checkpoints/coverage records, never from an unaccepted source.
- `src/imports/statementSetup/types.ts`: normalized source/draft and structural history input contracts.
- History inputs group multiple sources by account, preserve intermediate checkpoints and explicit coverage intervals, and use signed economic balances (+asset/-debt). Opening is end-of-day before movements.

## Evidence

- First focused existing parser/client run: 11/11 passed (OFX, vision, document scanner client). The unrelated document Worker suite could not import `cloudflare:workers` through LedgerRoom in ordinary Vitest. New Worker statement tests stub only LedgerRoom/ledgerSync infrastructure and exercise the actual `/documents/scan` handler.
- Focused new tests: PDF locked/corrupt/limits, selected pages, sequential scan, interruptions/incomplete extraction, source hashing/reattachment, owner scope, category fallback refusal, complete-month estimates, Worker signed balances and oversized output. 19/19 passed in 6.69 seconds after final guards, paired-transfer provenance, account-specific coverage and separate-file stable FITID assertions.
- Actual Chromium: bundled PDF.js rendered a generated two-page PDF; both pages reached a mocked existing scanner sequentially. Later-page closing checkpoint hydrated. IndexedDB reload retained normalized draft. Another Auth owner saw no prior draft. Wrong-file reattachment was refused.
- Authored Classic/Taylor/Newfoundland at 320,390,719,1100,1440: 15 geometry cases passed; two rows retained, no horizontal overflow, controls at least44px. Screenshots reviewed from artifacts/onboarding-intake, local only.
- Initial tsc identified two new errors (broad import type and removed PDF.js option); corrected. Root will run integrated TypeScript/build to avoid concurrent host swapping. No exhaustive lane.
- Dependency installation first unlinked only the worktree node_modules symlink, then installed into this checkout. Shared node_modules was not modified. package/lock adds pdfjs-dist6.3.289.

## Remaining integration proof

Root must wire reviewed suggestion handoffs to category/estimate chapters and Calendar navigation; mount statement intake with current visible scope and authenticated owner; connect account-history domain review/approvals/Confirm; clear the normalized draft only after accepted completion. Integrated type/build, stale-scope callback, three-theme full-App journey and exact monetary acceptance are root gates. Physical Safari/mobile camera, hosted scanner and real Google two-device acceptance are not established here. No push, deploy, schema, hosted ledger mutation or Production action.
