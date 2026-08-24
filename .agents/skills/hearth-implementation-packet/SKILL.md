---
name: hearth-implementation-packet
description: Create an evidence-backed implementation or review packet when handing Hearth work to Cursor, Claude, Codex, or another contributor. Do not trigger for ordinary explanations without a handoff.
---

# Hearth implementation packet

1. Read `AGENTS.md`, `docs/AI_OPERATING_MODEL.md`, `docs/AI_HANDOFF.md`, and relevant living canon.
2. Verify the exact repository, base branch, base SHA, relevant PRs, and current implementation.
3. Describe the household outcome before implementation detail.
4. Assign risk and required independent reviewers.
5. State the Budget delta (5) and Engagement delta (3).
6. Include the target AI, branch/PR strategy, why now, scope/non-scope, verified behavior, invariant laws, acceptance criteria, exact commands, relevant visual/accessibility/offline/error proof, network/data/secret disclosure, decision owner, and expected return handoff.
7. Prescribe implementation only where canon, safety, interoperability, or a prior decision requires it.
8. Never include credentials, real household exports, workbook contents, partner-personal rows, or full private chat history.
9. Persist under `docs/briefs/` only when a durable handoff is needed.

The packet must let a fresh AI begin from the named SHA without hidden chat context.
