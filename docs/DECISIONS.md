# Decision Log

This file records current product and architecture decisions. Historical conversation does not override an accepted entry unless Jonathan changes it explicitly.

| ID | Status | Decision | Reason |
|---|---|---|---|
| D-001 | Accepted | Git is the canonical source for code, tests, architecture, prompts, and release preparation. | Prevent full-file drift and duplicate work. |
| D-002 | Accepted | Maintain separate development and production Sheets/Apps Script projects. | Reversible testing without risking household data. |
| D-003 | Accepted | Codex is the default integrator, Claude the independent design/review specialist, and Gemini the live-Sheet specialist. Roles are flexible defaults. | Use each interface's strengths without limiting better solutions. |
| D-004 | Accepted | Review depth is risk-based. | Conserve model usage while protecting financial correctness. |
| D-005 | Accepted | Jonathan is product owner, production approver, and tie-breaker. | Product tradeoffs belong to the user, not an AI vote. |
| D-006 | Accepted | Continue in Sheets until the feature set is stress-tested and useful. | Avoid premature platform migration. |
| D-007 | Accepted | Use calendar months and the `America/Toronto` time zone. | Match the household planning model and handle daylight saving time. |
| D-008 | Accepted | Transfers are neither income nor expense. | Prevent double counting. |
| D-009 | Accepted | Ownership must be explicit and support variable percentages or amounts. | Fixed owner columns will not scale. |
| D-010 | Accepted | Forecasting supports multiple horizons and multiple scenarios using configurable assumptions. | Preserve user flexibility without backend rewrites. |
| D-011 | Accepted | Defer bank integrations while preserving import-ready architecture. | Avoid slowing core reliability work. |
| D-012 | Accepted | Remain on a personal Google account for the current prototype. | Current scale does not justify Workspace administration or cost. |
| D-013 | Accepted | Real project data may be used by all three models. | Jonathan approved access; minimize copying to relevant scope. |
| D-014 | Accepted | Approximately 500 transactions per month is the current design load. | Sets realistic stress-test fixtures. |
| D-015 | Open | Decide whether personal goals require genuine privacy or only dashboard filtering. | Hidden Sheet content is visible to editors. |
| D-016 | Open | Define the exact semantics of the proposed zero-sum activity. | Transfers, refunds, reimbursements, and card payments behave differently. |
| D-017 | Accepted | Use the private GitHub repository `jonathanbeaulne123-blip/dual-ai-budget-app` as the canonical editable remote for code, tests, documentation, issues, and release preparation. | Gives Jonathan and Codex a shared, versioned collaboration surface and supports future automation. |
| D-018 | Accepted | Exclude live Sheets, ODS exports, `Project Context.txt`, credentials, and other household data from hosted Git history. | Git history is persistent, workbook binaries do not review well, and data exposure adds risk without improving code management. |
| D-019 | Accepted | Retain the pre-GitHub repository history in a local-only archive and publish a clean hosted baseline from verified v0.0.25. | Preserves recovery evidence without uploading historical workbook contents. |
| D-020 | Open | Enable two-factor authentication on Jonathan's GitHub account. | Jonathan deferred 2FA during initial setup; the account now controls the canonical project remote, so recovery and takeover risk remain higher until it is enabled. |
| D-021 | Accepted | CAD is the authoritative currency for all current household accounts and transactions. | Jonathan confirmed that values currently labeled `USD` are actually CAD; the code and development data require a guarded label/configuration correction without converting amounts. |
| D-022 | Accepted | Keep the manual account selector hidden while only one account is active, but make the transaction backend account-explicit and require a selector before multiple accounts can be active. | Avoid unnecessary current UI while preventing first-active-account behavior from becoming a hidden scalability defect. |
| D-023 | Accepted | Defer non-code long-range product and interface work. Current architecture work should prioritize scalability, security, reliability, and portability while Sheets remains the working interface. | Keeps effort on a dependable core without allowing today's Sheets implementation to block later technical evolution. |
| D-024 | Accepted | Guard a derived-state read/compute/write adapter when overlapping executions could stale-overwrite the same output; apply this now to duplicate flags while tracking complete multi-sheet transaction atomicity separately. | Prevents the verified recalculation race without pretending a narrow lock solves every writer or blocks human Sheet edits. |
| D-025 | Accepted | Treat Transaction Input browser validation as a usability aid and enforce the authoritative request contract in a pure server-side validator before any write-capable helper runs. | Stale or altered dialogs must not bypass financial-record validation, and the same plain-data contract can move to a future backend. |

## Change format

When adding or changing a decision, record:

- Date
- Decision owner
- What changed
- Why
- Affected code, data, or user behavior
- Whether migration is required
