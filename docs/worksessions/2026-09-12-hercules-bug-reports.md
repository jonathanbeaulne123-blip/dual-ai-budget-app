# Hearth worksession — Hercules bug reports

- Status: LOCAL IMPLEMENTATION VERIFIED — Google connection and Development release await approval
- Opened: 2026-09-12 (America/Toronto)
- Owner / decision owner: Jonathan
- Assignee: Codex; bounded read-only integration and trust reviewer
- Repository: dual-ai-budget-app
- Branch: codex/hercules-bug-reports
- Baseline / initial HEAD: a0d76e99b9a0d1e31aafc618608fe4dcdb7ef100 (verified origin/main)
- Current base: 5837bbdf253c8e253bcd53b0029fcfbe8bc796a0 (origin/main, #464)
- Verified implementation HEAD: b085202309c36828f55ca8852c4e79cd78fbe9be; the final evidence update is documentation only
- Local branch only; no PR, push, merge or deployment for this feature
- Risk: High (external disclosure, new durable receipt table and connector credentials)
- Environment impact: local Development implementation. No hosted schema, secrets, deployment or spreadsheet write.

## Household outcome

Report a bug from Help or Hercules, explain it naturally, correct the draft, review the exact report and its app context, then send it to the existing Hearth Feedback tab with a recoverable receipt.

## Budget delta (5)

Improves diagnosis of broken financial workflows while preserving financial commands, ledger reads and Final Confirm. No accounting figure or posting primitive changes.

## Engagement delta (3)

Hercules handles the report intake and missing questions in the persistent conversation. Classic, Taylor and Newfoundland use repair-note treatments on the current study material.

## Verified baseline

Google Sheets metadata and bounded cell reads verified spreadsheet 1RHV0NvgkOJvcLe-NMCx6804ba6n-An7tpSNMgRgfmtw / FeedBack Sheet gid 1277317515. Headers A:R and dropdown choices read on 2026-09-12. Existing Apps Script intake is not in this working tree. Existing Google export connector uses each person's transient OAuth token; this shared feedback inbox requires a dedicated server identity instead.

## Scope and decisions

- Fixed-target Sheets adapter; model only prepares private feedback proposals. Human submission is a separate authenticated route.
- Existing workspace Agent owns private drafts and v1 receipt records. New SQL table initializes alongside existing tables; no Supabase migration or new Cloudflare class.
- Column-name mapping and validation checks precede append. Separate A1:Z1 header-value and A2:Z2 format/validation field masks exclude existing report text from the template read. Explicit literal cell values, Not started / Done=false, triage and scores blank. H-UUID report IDs avoid the sheet's pre-existing F-number namespace.
- App context is a strict key/value whitelist. No household object, balances, names of accounts, raw errors, URL, token, screenshot or whole conversation is automatically sent. Report text and included context are reviewed disclosures to spreadsheet collaborators.
- Atomic Sheets append + unique developer metadata, plus durable pre-dispatch identity. Unknown outcomes only check the receipt; never blindly append again. Receipt recovery survives disabled new execution and changed conversation.
- Dedicated service account may access only this shared spreadsheet. Secret and connector activation are separate setup steps, not inherited from earlier Gemini key authorization.

## Acceptance evidence

- [x] Partial intake and corrections retain answers in tool/contract tests. Live Gemini interview quality remains separate.
- [x] Manual edits become current model context; concurrent changes are fenced. React tests include dirty edits, model updates, background revision changes and remotely pending reviews.
- [x] Private context whitelist, separate schema field masks and formula-safe cell mapping.
- [x] Submission identity, duplicate delivery, uncertain receipt, expiry and cross-owner refusal in service tests using real in-memory SQLite and synthetic identities. Hosted authentication remains unverified.
- [x] Phone and desktop report component in all three themes; actual App entry/pause-Add/secondary-Back wiring independently reviewed. Full authenticated App journey remains open.
- [x] Focused quick gate and build/Worker checks.
- [ ] Live sheet append and authenticated continuity (requires connection setup and release).

## Evidence log

All tests use fictional reports and mocked providers unless explicitly identified otherwise.

| Evidence | Result | Scope and retained output |
| --- | --- | --- |
| Final change-focused quick gate, clean b085202 over 5837bbd | PASS: 314 tests / 31 files; TypeScript, AI surface and diff checks; 72.786 seconds, no five-minute breach | `/tmp/hearth-feedback-quick-gate4.log`; fingerprint `78ded541aa2485c5842ec2965c9401c3b71296375882ebf27e456944fdc89829` |
| Final production asset build and separate Workspace Worker TypeScript lane | PASS | `/tmp/hearth-feedback-build2.log`; existing large-chunk advisory only |
| Final actual workspace/theme browser matrix | PASS: 36 cases, no overflow, page errors or scoped axe violations | `/tmp/hearth-feedback-browser-final/report.json`; Classic/Taylor/Newfoundland × Personal/Household × 320/390/720/1100/1440/1920 px. Editing, save, uncertain receipt, original receipt recovery and compact-to-room draft continuity exercised. Synthetic transport, desktop Chrome viewport emulation. |
| Local Cloudflare Agent/Workflow/SQLite/R2 runtime | PASS: 13 cases | `/tmp/hearth-feedback-runtime/results.json`; private isolation, restart, steering, grant expiry, action review invalidation and durable recovery. All eight recorded runtime source hashes still match b085202; no live Google/provider calls. |
| New feedback unit, React and SQLite service tests | PASS in final gate | `test/workspace-feedback.test.ts`, `test/workspace-feedback-ui.test.ts`, `test/workspace-feedback-service.test.ts`; exact reviewed submission, literal cells, template read minimization, duplicate/uncertain delivery, late model publication, edits, disabled connector and receipt retention. |
| Independent UI/integration review | CLEAR on b085202 | `bug_report_integration`; final rebase review confirms invoking context capture before Add pause, stable draft identity, secondary Back origin and scoped theme styles. |
| Independent authority/connector review | CLEAR on b085202 | `feedback_authority_review`; final read-mask review clear. Earlier findings about finite metadata storage and definitive Google rejection recovery were fixed and re-reviewed. |

Earlier evidence is retained rather than silently replaced: the first gate exposed an incomplete local `node:sqlite` type declaration, now corrected. The next gate passed all 314 tests but took 446.013 seconds and breached the five-minute target. Its unchanged rerun was intentionally stopped during TypeScript after main advanced to #464; this was an interrupted run, not a new diagnosed test failure. The branch was rebased, both independent reviews refreshed, and the final clean-head gate above passed within budget. The sole rebase conflict was the focus map; both mappings were preserved.

Reproduce with the bundled Node runtime on PATH:

```sh
export PATH='/Users/jonathanbeaulne/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin':$PATH
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never test -- --risk=high --focus=test/workspace-feedback.test.ts --focus=test/workspace-feedback-service.test.ts --focus=test/workspace-feedback-ui.test.ts --focus-reason='Hercules report intake, privacy-safe context, reviewed fixed-sheet submission and duplicate/uncertain receipt recovery'
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never build
HEARTH_ARTIFACTS_DIR=/tmp/hearth-feedback-browser-final node scripts/verify-workspace-feedback-browser.mjs
node scripts/verify-workspace-runtime.mjs "$PWD" /tmp/hearth-feedback-runtime
```

## Release review

**CONDITIONAL — local implementation complete; live activation is not certified.** The feature has focused App, command, privacy, workspace and recovery regressions, independent reviews, browser component proof and build/runtime evidence. The exhaustive suite was not requested or run; quick evidence is identified as quick evidence. No accounting projector, ledger command or financial Confirm behavior changed. Generated test credentials are ephemeral RSA fixtures; no real credential, workbook export, household data or private conversation was committed.

The report and receipt use the current member's private Development workspace; no peer device is a host. The submitted report is disclosed only after its editable review, to the fixed spreadsheet's existing collaborators. New submission defaults off. Disable that flag to roll back new execution while keeping the additive receipt table and credential for receipt recovery.

## Remaining uncertainty / handoff

Service account has not been created, shared onto the sheet, or installed as a Worker secret. No live report has been submitted. Live Gemini questions, Google dropdown acceptance, full signed-in App reporting, cross-device recovery, membership revocation against hosted identity, physical devices and physical keyboard/screen-reader behavior remain unverified.

Next decision owner: Jonathan. Approval is needed to create the dedicated Google service identity, share only the target sheet to it, store its credential in the Worker, push/merge/deploy this feature to Development, and submit a labelled synthetic acceptance report. Follow `docs/HERCULES_FEEDBACK.md` for exact setup and recovery proof. This approval is separate from the earlier Gemini API key activation. No Supabase migration, new Durable Object class, Production access or financial data mutation is needed.
