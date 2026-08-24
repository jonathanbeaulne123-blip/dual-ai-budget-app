# AI task and handoff standard

GitHub living canon is Hearth's shared memory. A chat, local artifact, preview, active branch, or unmerged pull request is not `main` and is not shipped. `docs/WORKING_MEMORY.md` may recap a thread; it does not outrank current repository evidence.

Do not load `docs/nostalgia/` or `docs/reference/` unless Jonathan explicitly asks for historical research. Museum material is never the next build plan.

## State words

Use these literally:

- **local** — exists only in one working tree;
- **branch** — committed outside `main`;
- **PR** — proposed for review and not merged;
- **merged** — present on `main`;
- **deployed** — a deployment completed;
- **live verified** — the deployed household behavior was checked directly.

Never shorten those into “done” or “shipped” when the later states are not proven.

## Risk routing

| Risk | Examples | Required routing |
|---|---|---|
| Low | Copy, styling, living docs, isolated configuration | One implementer; ordinary proof |
| Medium | Dialog, pure calculation, cosmetics that cannot post, bounded local workflow | Implementer plus targeted independent review |
| High | Financial meaning, Commands, splits, statements, sync, Hercules payload, hosted access, Auth/RLS, migrations | Implementer plus independent books or trust review and focused tests |
| Release | Merge/deploy decision, daily-use switch, hosted schema application, Production, secret or account-policy change | All relevant reviewers; Jonathan decides and explicitly approves the external action |

Dual Course: books weigh 5 and engagement weighs 3. When they conflict, books win. A companion change that can change CAD meaning or posting authority is High, not Medium.

## Start packet

Every durable packet or multi-step worksession records:

- owner and target AI;
- repository, branch, base SHA, head SHA, PR or issue;
- household outcome and why now;
- verified current behavior, with facts separated from inferences;
- risk and decision owner;
- Budget delta (5) and Engagement delta (3);
- in scope and explicitly out of scope;
- invariants that cannot change;
- acceptance criteria and exact evidence expected;
- focused and full verification commands;
- phone, desktop, keyboard, focus, reduced-motion, loading, empty, error, and offline proof when relevant;
- Development/Production, network, hosted-data, privacy, secret, and model-disclosure impact;
- expected return handoff.

Prescribe implementation detail only where canon, safety, interoperability, or an accepted decision requires it. Let the specialist improve the solution inside the product laws.

## Return handoff

Use this structure:

### Status

Local | branch | PR | merged | deployed | live verified. Include exact SHAs and links.

### Outcome

Describe what changed for Jonathan and Bianca.

### Baseline examined

Repository, base/head, working-tree or PR state, relevant canon and execution paths.

### Changes

Files and behavior, including any justified scope expansion.

### Evidence

Exact commands and results; acceptance-criterion mapping; visual or manual evidence; independent reviewer verdicts.

### Dual Course

- **Budget delta (5):** which posting, rec, sit-down, account-literacy, split-honesty, Health, or statement primitive moved.
- **Engagement delta (3):** which Hercules line, unlock, chalkboard, wallet tile, ceremony, or Ask chip moved.

If either is none, explain why the change is still correct.

### Data and environment disclosure

State Development/Production impact, network calls, data sent, MCP use, hosted mutations, schema, secrets, and deployments. Write “none” explicitly when none occurred.

### Uncertainty and risk

Unsupported claims, regressions considered, manual proof still needed, rollback, and residual risk.

### Decision and next owner

What Jonathan must decide, who acts next, and the smallest recommended next action.

## Never include

Credentials, `.env` contents, database passwords, service-role keys, real household exports, workbook contents, partner-personal rows, or full private chat history.

Sheets-era handoff notes are museum material: [reference/sheets-era/AI_HANDOFF.md](reference/sheets-era/AI_HANDOFF.md).
