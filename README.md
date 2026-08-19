# Household Budget App

This private GitHub repository is the canonical editable home for the household budgeting project's code, tests, documentation, and release preparation. Google Sheets and Apps Script remain the current runtime.

## Current baseline

- Development Apps Script source: `v0.0.29` (approved seven-file push at 7:59:52 PM, isolated post-push pull matches commit `4a4c01d`; live Sheet verification pending)
- Current code candidate: `v0.0.29` on draft PR #13 (`issue-6-transaction-atomicity`); Gemini approved the runtime implementation with non-blocking notes and the accepted row-drift test is included
- Merged code baseline: `v0.0.28`; authoritative Transaction Input validation is merged through PR #12, Issue #7 is closed, and development verification is complete
- GitHub import baseline: `61a396e` (private `main`, verified by a clean clone with no local-only artifacts)
- Development workbook snapshot: `Budget_App__v 0.23  -dev- Copy.ods`
- Production workbook snapshot: `Budget_App__v 0.23.ods`
- Last stable recovery workbook: `Budget_App__v 0.21.ods`
- Time zone: `America/Toronto`
- Primary users: Jonathan and Bianca
- Canonical remote: `https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app`

The two `v0.23` ODS files were byte-identical when this repository was established. On 2026-08-18, the development Apps Script project was authenticated and reconciled with Git. The guarded `v0.0.24` migration was then pushed to development, previewed, and applied: 13 exact cells were corrected, the spreadsheet timezone changed to `America/Toronto`, and the budget summary refreshed. The expanded health check surfaced a separate set of 14 legacy Add Shift rows still using the invalid top-level ID `CAT-INCOME`; the narrow `v0.0.25` follow-up corrected those 14 direct links, preserved and recalculated all 14 derived formulas, refreshed the budget summary, and finished with no Data Health Check findings.

## Product direction

The immediate goal is a reliable tri-AI development ecosystem and a code-focused reliability review. The first functional release targets are:

1. Transaction Input
2. Tip Tracking
3. Dashboard

A functional Sheets test build is targeted for September 1, 2026. Non-code long-range product and interface work is deferred; current architecture effort prioritizes scalability, security, reliability, and portability.

## Start here

- [Project charter](docs/PROJECT_CHARTER.md)
- [Current baseline](docs/BASELINE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Decisions](docs/DECISIONS.md)
- [Roadmap](docs/ROADMAP.md)
- [Environments](docs/ENVIRONMENTS.md)
- [AI handoff format](docs/AI_HANDOFF.md)
- [Agent prompt pack](docs/AI_AGENT_PROMPTS.md)
- [Clasp setup](docs/CLASP_SETUP.md)
- [Live verification findings](docs/LIVE_VERIFICATION_2026-08-18.md)
- [v0.0.25 legacy income-ID release](docs/V0.0.25_LEGACY_INCOME_RELEASE.md)
- [v0.0.26 duplicate-scaling release candidate](docs/V0.0.26_DUPLICATE_SCALING_RELEASE.md)
- [v0.0.27 duplicate-recalculation concurrency candidate](docs/V0.0.27_DUPLICATE_CONCURRENCY_RELEASE.md)
- [v0.0.28 Transaction Input validation candidate](docs/V0.0.28_TRANSACTION_VALIDATION_RELEASE.md)
- [v0.0.29 Transaction Input atomicity candidate](docs/V0.0.29_TRANSACTION_ATOMICITY_RELEASE.md)
- [GitHub workflow and beginner guide](docs/GITHUB_WORKFLOW.md)
- [Active September 1 milestone](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/milestone/1)

Workbook exports and `Project Context.txt` are retained locally only and intentionally excluded from GitHub. They are recovery/reference artifacts, not current project instructions or hosted source files.

## Local checks

After dependencies are installed:

```text
pnpm test
```

The checks parse every `.gs` file, detect duplicate top-level function declarations, confirm the source/package/release-history versions agree, parse the JavaScript embedded in all four dialogs, and simulate both guarded migrations. They exercise the duplicate-review engine beyond row 5,000 and at 12,000 rows, prove its document-lock lifecycle, verify that malformed/stale Transaction Input requests reach zero write-capable helpers, and simulate deterministic ID planning plus rollback before and after every atomic transaction write boundary.
