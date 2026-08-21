# AI task and handoff

Living standard. The Sheets-era version is [reference/sheets-era/AI_HANDOFF.md](reference/sheets-era/AI_HANDOFF.md) — history, not a bible.

## Risk routing

| Risk | Examples | Default routing |
|---|---|---|
| Low | Copy, styling, living docs | One implementer |
| Medium | Screen, pure calculation, contained refactor | Implementer plus a targeted review |
| High | Financial math, splits, shifts, undo/tombstones, books schema | Implementer plus independent review |
| Release | Daily-use switch, hosted schema, Auth/RLS, Production snapshot | All reviewers; Jonathan approves |

## Task packet

```text
Task ID:
Goal (household outcome):
Why it matters:
Risk level:
Default lead (Codex / Claude / Gemini):
Git commit or branch:
App/website to use:
Tab/page to use:
Target snapshot (Development / Production):
Verified facts:
Constraints:
Allowed changes:
Acceptance tests:
Explicitly out of scope:
Decision needed from Jonathan:
```

## Required handoff

```text
Status:
What I examined:
Verified findings:
Assumptions:
Changes proposed or completed:
App/website, tab/page, and files affected:
Verification performed (pnpm test and/or AI_QA.md screens):
Risks and remaining uncertainty:
Better alternative, if any:
Decision needed:
Recommended next agent or action:
```

For every bug or QA finding, name:

1. App/website (Hearth kitchen site, local Vite, GitHub, Cloudflare, Supabase — not “the dashboard”)
2. Tab/page (Home, Plan, +, Books → Register, More → Invite, …)
3. Steps, expected, actual
4. Development or Production
5. Whether money was written and how to undo

## Disagreements

Summarize for Jonathan as:

1. Exact disputed question
2. Factual disagreement versus product preference
3. Evidence for each option
4. Cost, risk, and reversibility
5. Recommended choice
6. Smallest decision Jonathan needs to make

Do not resolve disagreements by AI majority vote.
