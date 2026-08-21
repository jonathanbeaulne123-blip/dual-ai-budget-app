> **Reference only — not a bible.** Snapshot of the Google Sheets / Apps Script era (`v0.0.31`, git `f2db836`, tag `sheets-v0.0.31`).
>
> Jonathan’s latest instruction, the live files in `docs/` (outside this folder), and the TypeScript app are current. Read this to see how the project moved, not as today’s product law.
>
> Apps Script source is not in the working tree. Recover it with `git show sheets-v0.0.31:Code.gs`.

# AI Task and Handoff Standard

## Risk routing

| Risk | Examples | Default routing |
|---|---|---|
| Low | Documentation, copy, isolated styling, harmless cleanup | Codex only |
| Medium — code | Dialog, pure calculation, contained refactor | Codex plus targeted Claude review when useful |
| Medium — Sheet | Dashboard, formulas, validation, user flow | Gemini evidence, Codex integration |
| High | Financial math, migrations, permissions, splits, deployment | Codex plus targeted Claude and Gemini review |
| Release candidate | September 1 or October 1 build | All three, each reviewing its specialty |

## Task packet

```text
Task ID:
Goal:
Why it matters:
Risk level:
Default lead:
Canonical Git commit/code version:
Target environment:
Relevant files, functions, sheets, or ranges:
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
Files, functions, sheets, or ranges affected:
Verification performed:
Risks and remaining uncertainty:
Better alternative, if any:
Decision needed:
Recommended next agent or action:
```

## Disagreements

Codex should summarize disagreements for Jonathan as:

1. Exact disputed question
2. Factual disagreement versus product preference
3. Evidence for each option
4. Cost, risk, and reversibility
5. Recommended choice
6. Smallest decision Jonathan needs to make

Do not resolve disagreements by AI majority vote.

