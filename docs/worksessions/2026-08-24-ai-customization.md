# Hearth worksession — tri-AI role customization

- **Status:** OPEN
- **Opened:** 2026-08-24 (`America/Toronto`)
- **Goal:** install a repository-managed operating system for Codex, Cursor, and Claude that makes each AI efficient in its soft role while preserving shared Hearth product law.
- **Repository:** [`jonathanbeaulne123-blip/dual-ai-budget-app`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app)
- **Base:** stacked on [PR #64](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/64) at `03c4f5f0e54baabf78702f9f73822ec2e038b225`.
- **Work branch:** `codex/hearth-ai-roles-2026-08-24`
- **Environment impact:** repository configuration and documentation only. No household data, hosted rows, schema, secrets, Production deploy, or Production ledger mutation.

## AI assignments

| AI | Assignment | Write authority in this session |
|---|---|---|
| Codex | Own audit, design, integration, verification, worksession, and PR. | This branch's AI configuration/docs only. |
| Codex subagents | Independently audit official Codex, Cursor, and Claude configuration surfaces. | Read-only findings. |
| Cursor | Future default implementer; receive scoped rules, skills, auditors, and proof gates. | None in this session. |
| Claude | Future UX/Hercules lead; receive a shared-law import, scoped rules, skills, and reviewers. | None in this session. |

## Success criteria

- [ ] One shared constitution and operating model; no three drifting copies of Hearth law.
- [ ] Codex gets mastermind/worksession/packet/release-review workflows and read-only specialist agents.
- [ ] Cursor gets scoped implementation rules, reusable workflows, read-only auditors, Bugbot guidance, safe environment defaults, and deterministic guardrails.
- [ ] Claude gets `CLAUDE.md`, scoped UX/Hercules/money rules, design/visual/handoff workflows, and read-only reviewers.
- [ ] Supabase MCP is Development-only in policy and read-only/project-scoped in committed configuration.
- [ ] A deterministic verifier catches secrets, unsafe MCP configuration, missing surfaces, and stale role contracts.
- [ ] CI runs tests, typecheck, build, and the AI-surface verifier.
- [ ] The close-out records exact evidence, residual manual setup, and Dual Course deltas.

## Product-law checklist

- Books weight **5**; Hercules/interactables weight **3**; books win conflicts.
- Commands plus visible Confirm remain the only money-posting boundary.
- CAD integer cents; `America/Toronto`; double-entry; Development is not Production.
- Auth + membership RLS remain hard gates for private hosted data and money rails.
- No museum folder is used for planning.
- Sheets, clasp, and Apps Script remain obsolete as the product path.
