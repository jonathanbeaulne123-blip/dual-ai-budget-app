> **Reference only — not a bible.** Snapshot of the Google Sheets / Apps Script era (`v0.0.31`, git `f2db836`, tag `sheets-v0.0.31`).
>
> Jonathan’s latest instruction, the live files in `docs/` (outside this folder), and the TypeScript app are current. Read this to see how the project moved, not as today’s product law.
>
> Apps Script source is not in the working tree. Recover it with `git show sheets-v0.0.31:Code.gs`.

# GitHub Workflow and Beginner Guide

## What GitHub does for this project

Git tracks the project's code history. GitHub stores the shared private copy of that history and adds collaboration tools such as issues, pull requests, releases, and automated checks.

- **Working files:** the editable files on this computer.
- **Commit:** a named recovery point containing a coherent change.
- **Branch:** a safe parallel line of work.
- **Push:** upload local commits to GitHub.
- **Pull/fetch:** retrieve newer GitHub commits.
- **Pull request (PR):** a reviewable proposal to merge one branch into another.
- **Tag/release:** a permanent label for an important tested version.

The private repository is `https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app`. Its canonical branch is `main`.

## Hosted-data boundary

GitHub contains:

- Apps Script source and dialogs
- Tests and test tooling
- Current architecture, decisions, task packets, and release records
- Issues, pull requests, and future automation definitions

GitHub must never contain:

- Development or production Sheet exports
- `.ods` workbooks or bank-import files with household data
- `Project Context.txt` or raw chat exports
- `.clasp.json`, Google credentials, tokens, passwords, or recovery bundles
- Any local-only archive branch or pre-GitHub Git bundle

Private visibility reduces exposure but does not replace data minimization. Git history is persistent, and anyone granted access can retain a local clone.

## Normal workflow

1. Start from an up-to-date `main` branch.
2. Create a short-lived branch for medium/high-risk work, such as `fix/category-health-check`.
3. Make one coherent change and run `pnpm test` plus task-specific checks.
4. Review the diff for unintended files and sensitive content.
5. Commit with a short outcome-based message.
6. Push the branch and use a pull request when review or a decision record adds value.
7. Merge only after required verification passes.
8. Deploy to the development Apps Script project from the verified commit.
9. Record live results before considering production.

Low-risk documentation corrections may commit directly to `main` while Jonathan and Codex are the only active maintainers. Financial logic, migrations, permissions, and release candidates should use a branch and explicit review gate.

## Version and release rules

- Every Apps Script release increments `APP_VERSION` and adds one `RELEASE_HISTORY_` entry.
- Git commits are the complete code history; manual copies are not version control.
- Use Git tags/releases for important tested versions.
- Workbook recovery copies are event-driven: create one before a data migration, production deployment, or major Sheet/schema redesign.
- Apps Script and Google Sheet data remain separate from GitHub; deployment still uses the development-only `clasp` configuration.

## Account and access security

- Repository visibility must remain private unless Jonathan explicitly approves a public release after a data/security review.
- Jonathan owns the GitHub account and repository.
- Codex works through the authenticated local Git remote; a GitHub plugin can later add direct issue/PR access.
- Two-factor authentication is currently deferred and recorded as an open risk in `docs/DECISIONS.md`.
- Never paste a GitHub password or access token into project files or chat. Authentication should use GitHub's browser/device flow or the operating system credential manager.

## Local pre-GitHub archive

The repository migration retains a local-only Git bundle and archive branch containing the original history. They exist only for recovery/audit and must never be pushed. The hosted `main` branch starts from the verified v0.0.25 project state without workbook binaries or the historical context export.

Migration completed on 2026-08-18:

- Local-only archive branch: `local/full-history-pre-github`
- Verified local bundle: `local-backups/dual-ai-budget-app-full-history-pre-github-2026-08-18.bundle`
- Clean GitHub root commit: `61a396e`
- Remote verification: only `origin/main`; fresh clone matched the local commit and contained 31 allowed files with no forbidden artifacts
