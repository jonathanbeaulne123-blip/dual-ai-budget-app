# Hercules feedback connection

Users report a bug from Help and transparency or Hercules. The persistent workspace supplies the conversation, questions and private report draft. `prepare_bug_report` uses safe page context and the person's answers; it cannot submit. Users can edit the report, remove context, save their corrections for Hercules, and explicitly choose **Submit this report**.

Destination: [Hearth Feedback — FeedBack Sheet](https://docs.google.com/spreadsheets/d/1RHV0NvgkOJvcLe-NMCx6804ba6n-An7tpSNMgRgfmtw/edit#gid=1277317515). The ID and gid are fixed in the shared contract; neither browser nor model can choose another destination. The Worker re-reads the target title by gid, then bounded header/validation/format cells before writing. It maps by unique column names and stops if columns or strict choices no longer match. Header rearrangement during the gap between that read and append is not transactionally fenced by Sheets; spreadsheet editors should avoid structural edits while reports are submitting.

## Report content and authority

Main page, feature, issue, expected result, reproduction steps, reporter and urgency are required for submission. “Unknown” or “Cannot reproduce” are valid honest answers; the assistant must not invent missing steps. Examples and suggested fixes are optional. Expected result, steps and selected app context fit in the existing Example column. Rows receive H-UUID IDs, Not started status, Done=false, and Source tab=Hearth app. Priority, implementation history, resolution ratings, next action and cleanup notes are left blank. The adapter copies only the template cell format and validation rules, never another report's text, formulas or notes.

Context accepts only bounded page/scope/theme/scene, viewport dimensions, coarse browser family, build, environment, time and online state. URLs, tokens, account names, balances, raw errors, screenshots, files and conversation history are excluded from automatic collection. The reporter reviews all text before it is disclosed to collaborators on the spreadsheet. Their private project and receipt stay in their authenticated member workspace. No financial query or command is required to file a report.

## Authorized connection setup

1. In the Hearth Google Cloud project, enable Google Sheets API. Jonathan created the dedicated identity `hearth-feedback-sheets-975@hearth-506304.iam.gserviceaccount.com` (Hearth Feedback Sheets). It needs no Google Cloud project-wide role and no domain-wide delegation.
2. Share only the target spreadsheet with that service account's email as Editor. Existing users and permissions stay unchanged; do not publish the sheet or enable link-wide editing.
3. Create its JSON credential and store it directly as the Cloudflare `HERCULES_FEEDBACK_SERVICE_ACCOUNT` secret. Never put it in source, a VITE variable, chat, a project artifact or an app snapshot. The Worker uses its private key to obtain short-lived Sheets-only tokens from Google's fixed token endpoint.
4. Set `HERCULES_FEEDBACK_ENABLED=true` for the approved Development release. This flag is separate from arbitrary Google document/calendar writes, which remain controlled by their existing flag.
5. Run one labelled synthetic in-app report after deployment. Verify its columns and receipt in the supplied sheet; retry its exact receipt and verify one row. Exercise another signed-in member, expired/revoked membership, a reconnect and another device. Record the results before claiming live acceptance.

Jonathan approved this connection and its Development release on 2026-09-12. The release sets feedback submission on; the credential and Sheets API must also be available. The normal workspace and drafts remain usable without the connector. Users do not need spreadsheet access, a Google Sheets consent screen or an API key. Live acceptance is recorded separately in the worksession.

## Recovery and lifecycle

The authenticated Worker route rechecks Hearth membership before dispatching to the private Agent. The `workspace_feedback_v1` SQLite table is additive and retains the reviewed text, submission identity and permanent receipt. No new Durable Object class, R2 bucket or Supabase migration is required. Model tools cannot reach the submission operation or credentials.

A synchronous receipt claim happens before the network write. The Sheets batch atomically creates a unique temporary metadata marker and appends literal ExtendedValue cells. Formula-looking report text remains text. After interruption, the same identity checks its marker; absence never authorizes an uncertain append. Known atomic rejections return to an editable prepared state. A changed instruction or proposal blocks fresh dispatch; accepted and uncertain receipts remain recoverable even after steering. Another unresolved version blocks a second submission in that project. Twenty prepared reports per member workspace per UTC day bounds new submission attempts; model conversation also retains the existing Gemini quota admission.

Temporary markers are retired only after the permanent Agent receipt records acceptance, so Google's metadata storage limit does not grow with successful reports. Retirement targets the exact marker ID/key/digest and never deletes report rows. Failed retirement retries on receipt checks and subsequent submissions. Unresolved markers remain for recovery. Operators must preserve permanent Agent receipts on rollback; deleting that storage invalidates this guarantee.

Rollback sets `HERCULES_FEEDBACK_ENABLED=false`, preserving the workspace class, additive receipt table and connector credential for read-only receipt recovery. Returning an already accepted Agent receipt does not depend on Google availability. Revoked users cannot access that recovery route.

## Reference contracts

- [Google atomic batch updates](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/batchUpdate)
- [Unique developer metadata and storage limits](https://developers.google.com/workspace/sheets/api/guides/metadata)
- [Exact metadata filtering](https://developers.google.com/workspace/sheets/api/reference/rest/v4/DataFilter)
- [Service account OAuth](https://developers.google.com/identity/protocols/oauth2/service-account)
- [Cloudflare SQLite transactions](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)

See [implementation and measured evidence](worksessions/2026-09-12-hercules-bug-reports.md). Local tests and synthetic browser transport do not certify live Gemini interview quality, authenticated continuity, physical devices or Google writes.
