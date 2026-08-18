# Household Budget App

This private GitHub repository is the canonical editable home for the household budgeting project's code, tests, documentation, and release preparation. Google Sheets and Apps Script remain the current runtime.

## Current baseline

- Development Apps Script: `v0.0.25` (commit `77fab39`, deployed, source-verified, and migration-verified with a clean Data Health Check)
- Development workbook snapshot: `Budget_App__v 0.23  -dev- Copy.ods`
- Production workbook snapshot: `Budget_App__v 0.23.ods`
- Last stable recovery workbook: `Budget_App__v 0.21.ods`
- Time zone: `America/Toronto`
- Primary users: Jonathan and Bianca
- Canonical remote: `https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app`

The two `v0.23` ODS files were byte-identical when this repository was established. On 2026-08-18, the development Apps Script project was authenticated and reconciled with Git. The guarded `v0.0.24` migration was then pushed to development, previewed, and applied: 13 exact cells were corrected, the spreadsheet timezone changed to `America/Toronto`, and the budget summary refreshed. The expanded health check surfaced a separate set of 14 legacy Add Shift rows still using the invalid top-level ID `CAT-INCOME`; the narrow `v0.0.25` follow-up corrected those 14 direct links, preserved and recalculated all 14 derived formulas, refreshed the budget summary, and finished with no Data Health Check findings.

## Product direction

The immediate goal is a reliable tri-AI development ecosystem and a complete functionality/visual review. The first user-facing release targets are:

1. Transaction Input
2. Tip Tracking
3. Dashboard

A functional Sheets test build is targeted for September 1, 2026, and a Bianca-ready Sheets release for October 1, 2026. A mobile-friendly application remains the longer-term destination.

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
- [GitHub workflow and beginner guide](docs/GITHUB_WORKFLOW.md)

Workbook exports and `Project Context.txt` are retained locally only and intentionally excluded from GitHub. They are recovery/reference artifacts, not current project instructions or hosted source files.

## Local checks

After dependencies are installed:

```text
pnpm test
```

The checks parse every `.gs` file, detect duplicate top-level function declarations, confirm the source/package/release-history versions agree, parse the JavaScript embedded in all four dialogs, and simulate both guarded migrations. The v0.0.25 tests prove the exact 14-cell target set, formula preservation/recalculation, repeat-safe no-op behavior, rollback, and fail-fast aborts.
