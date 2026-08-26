# GitHub branch protection and production approval (D-147)

Phase 0 requires: protected `main`, required checks, and production-environment approval before higher-risk deploys. This Cloud Agent token **cannot** create rulesets (API 403). Jonathan must apply these steps once in the GitHub UI or with an owner-scoped PAT.

## Current verified state (2026-08-26)

- Repository rulesets: **none** (`GET /repos/.../rulesets` → `[]`)
- GitHub Environments: **none**
- CI workflow: `.github/workflows/ci.yml` runs `pnpm check` on `push`/`pull_request` for `main` and agent branches
- Deploy: Cloudflare Worker from `main` via Actions / `wrangler deploy` (D-041)

## Jonathan apply checklist

### 1. Required status check

1. Open **Settings → Rules → Rulesets → New branch ruleset**.
2. Name: `main protected`.
3. Enforcement: **Active**.
4. Target branches: include `main` by name.
5. Rules:
   - Restrict deletions
   - Block force pushes
   - Require a pull request before merging (1 approval optional for solo owner; recommended once Bianca or a second reviewer joins)
   - Require status checks to pass: add **`test`** (job name from `ci.yml`)
   - Require branches to be up to date before merging (recommended)
6. Save.

### 2. Production environment approval (deploy)

1. **Settings → Environments → New environment** named `production` (or `kitchen` if that matches the Worker deploy workflow).
2. Enable **Required reviewers** → Jonathan.
3. Point the deploy workflow’s `environment:` key at that environment so `wrangler deploy` / Cloudflare publish cannot run from an unreviewed branch.

If the current deploy job has no `environment:` key yet, add one in a follow-up PR after this ruleset exists so required reviewers actually gate the job.

### 3. Verify

```bash
gh api repos/jonathanbeaulne123-blip/dual-ai-budget-app/rulesets
# expect at least one ruleset targeting main

gh api repos/jonathanbeaulne123-blip/dual-ai-budget-app/environments
# expect production (or kitchen) with protection rules
```

Open a throwaway draft PR that fails `pnpm check` and confirm merge is blocked. Open a green PR and confirm merge is allowed only after checks (and reviewer, if configured).

## Agent / PR policy

- Agents create draft PRs; they do not merge.
- Direct pushes to `main` should be impossible after the ruleset is active.
- This document alone does **not** enable protection — Jonathan must click Apply.

## Rollback

Disable or delete the ruleset in GitHub Settings. Prefer editing rules over deleting so history remains.
