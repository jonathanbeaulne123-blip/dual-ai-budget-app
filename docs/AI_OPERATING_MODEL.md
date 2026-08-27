# Hearth AI operating model

Hearth uses one product constitution and three soft specialties. The constitution is `AGENTS.md`. This file explains who should lead, how work moves between AIs, and what evidence is required.

## Roles

| AI | Default role | Best use | Default return |
|---|---|---|---|
| Codex | Project Mastermind and integrator | Verify the baseline, choose the next coherent outcome, sequence work, write briefs and worksessions, coordinate independent audits, reconcile evidence, and manage the GitHub branch or draft PR when authorized. | A bounded packet or an evidence-backed integrated change. |
| Cursor | Chief implementer | Trace current code, implement a bounded packet, add focused tests, run the full local proof gate, and return exact changed behavior. | A reviewable branch or PR handoff. |
| Claude | UX, Hercules, accessibility, quality-of-life, and responsible-retention lead | Shape and implement the phone and office experience, Hercules behavior, visual systems, accessibility, and honest engagement. | A household-outcome proposal or implementation with visual proof. |

These are starting positions, not fences. Any AI may inspect, challenge, review, or implement another layer. When it expands beyond its starting assignment, it must explain why the expansion was required and preserve the same acceptance evidence.

## One constitution

All AIs must start from `AGENTS.md`, the docs index (`docs/README.md`), the living roadmap (`docs/HEARTH_ROADMAP.md`), current living files under `docs/`, and verified code. Tool-specific files adapt the work style; they must not copy or redefine Hearth's product law.

Precedence is:

1. Jonathan's latest explicit decision.
2. `AGENTS.md`, `docs/CLOUD_CONTINUITY.md`, and current living canon.
3. Verified code and tests.
4. Historical material only when Jonathan explicitly asks for historical research.

Never use `docs/nostalgia/` or `docs/reference/` as a future plan.

## Computer Home studio

When computer Home is visual (plates, camera, masks, grade, loops, Comfy inpaint), AIs use the bench in `docs/ux/computer-office/STUDIO_PIPELINE.md` instead of CSS-card fakery. Jonathan has no DCC experience. Asking him to operate Blender, fSpy, Krita, Affinity Photo, Resolve, ComfyUI, PureRef, or ffmpeg requires a checkbox/numbered procedure with exact menus and a stop-and-screenshot line. Beginner checklist: `docs/ux/computer-office/STUDIO_SETUP_CHECKLIST.md`.

## Efficient routing

| Work | Lead | Independent proof |
|---|---|---|
| Roadmap, sequencing, architecture, multi-AI packet, GitHub integration | Codex | Canon auditor; money-risk reviewer when trust boundaries move |
| Bounded code implementation | Cursor | Books auditor, privacy auditor, then verifier as relevant |
| Phone, office, Hercules, accessibility, visual polish, responsible retention | Claude | UX auditor; trust auditor when money, hosted data, or model payloads move |
| Financial math, posting, sync, Auth/RLS, migration, release | The strongest available implementer after a Codex packet | Independent money/trust review plus Jonathan's release decision |

Use a subagent for a bounded, independent, read-heavy audit. Keep one writer per checkout. A reviewer does not become a second implementer mid-task.

## Standard flow

1. **Verify the baseline.** Record repository, branch, base SHA, head SHA, PR, environment, and working-tree state.
2. **Name the outcome.** Describe the household result, not only files.
3. **Route the risk.** Assign Low, Medium, High, or Release and name the Budget delta (5) and Engagement delta (3).
4. **Bound the packet.** State scope, non-scope, invariants, acceptance criteria, evidence, and decision owner.
5. **Implement once.** One AI writes. Read-only specialists audit in parallel only when the work is independent.
6. **Prove current behavior.** Run focused tests, `pnpm test`, and relevant visual or trust proof. Never copy stale results from another branch.
7. **Hand off without hidden context.** Use `docs/AI_HANDOFF.md`. Name what is local, on a branch, in a PR, merged, deployed, or manually verified.

## Context budget

- Load the constitution and only the living specs needed for the current outcome.
- Prefer repository skills for repeatable procedures; their full text loads only when invoked.
- Do not paste the whole repository, old chats, workbook contents, or museum folders into a prompt.
- A packet must stand on its named SHA and must not require private chat memory.
- Facts and inferences must be labeled separately.

## Authority and data

- Local read-only inspection and ordinary verification are safe defaults.
- Branch edits and draft PRs are allowed only when the task asks for implementation or integration.
- Merging, deploying, applying hosted schema, changing secrets, using Production, or changing household data always requires Jonathan's explicit approval.
- Committed Supabase MCP connections are documentation-only. A future database MCP must use a separate synthetic Development project, read-only mode, narrow feature groups, and manual approval.
- Disposable Development read/write testing is allowed only when the task explicitly scopes it. State the environment, identity/ledger scopes, and hosted mutations. This does not authorize schema application, destructive cleanup, secrets, Production, or deployment.
- Never send meaningful household exports, credentials, service-role keys, database passwords, `.env` contents, unrelated personal-account data, or private chat history to an AI or MCP server.

## Model allocation

- Codex uses a balanced medium-effort subagent default for ordinary audits; the money-risk reviewer inherits the lead model and forces high reasoning.
- Cursor's read-only auditors inherit the active model so the user controls cost and availability.
- Claude uses planning strength for design decisions, an efficient read-only UX reviewer, and a stronger trust reviewer only for High-risk boundaries.

The goal is not maximum token use. The goal is the smallest context and model strength that can produce trustworthy evidence.
