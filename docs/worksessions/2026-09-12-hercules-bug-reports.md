# Hearth worksession — Hercules bug reports

- Status: OPEN — implementation and focused verification
- Opened: 2026-09-12 (America/Toronto)
- Owner / decision owner: Jonathan
- Assignee: Codex; bounded read-only integration and trust reviewer
- Repository: dual-ai-budget-app
- Branch: codex/hercules-bug-reports
- Baseline / initial HEAD: a0d76e99b9a0d1e31aafc618608fe4dcdb7ef100 (verified origin/main)
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
- Column-name mapping and validation checks precede append. Explicit literal cell values, Not started / Done=false, triage and scores blank. H-UUID report IDs avoid the sheet's pre-existing F-number namespace.
- App context is a strict key/value whitelist. No household object, balances, names of accounts, raw errors, URL, token, screenshot or whole conversation is automatically sent. Report text and included context are reviewed disclosures to spreadsheet collaborators.
- Atomic Sheets append + unique developer metadata, plus durable pre-dispatch identity. Unknown outcomes only check the receipt; never blindly append again. Receipt recovery survives disabled new execution and changed conversation.
- Dedicated service account may access only this shared spreadsheet. Secret and connector activation are separate setup steps, not inherited from earlier Gemini key authorization.

## Acceptance evidence

- [ ] Partial intake and natural corrections retain answers.
- [ ] Manual edits become current model context; concurrent changes are fenced.
- [ ] Private context whitelist and formula-safe cell mapping.
- [ ] Authenticated submit, duplicate delivery, uncertain receipt and revocation behavior.
- [ ] Phone and desktop in all three themes; actual App entry wiring.
- [ ] Focused quick gate and build/Worker checks.
- [ ] Live sheet append and authenticated continuity (requires connection setup and release).

## Evidence log

Pending. All tests use fictional reports and mocked providers unless explicitly identified otherwise.

## Remaining uncertainty / handoff

Service account has not been created, shared onto the sheet, or installed as a Worker secret. No live report has been submitted. Browser and live Gemini intake quality evidence are separate from code and mocked connector proof. No push, merge or deployment authorized for this new feature yet.
