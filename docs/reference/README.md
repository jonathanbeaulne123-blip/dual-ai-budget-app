# Reference material

These files are **history**, not current product law.

Hearth is the household budget. The TypeScript app in this repository, the living files in `docs/` (this folder excluded), and Jonathan’s latest explicit instruction are what to follow.

Use this folder to see **where the project has been** — the Sheets prototype, the early rebuild-versus-Sheets comparison, old roadmaps, decision logs, and release notes. Do not treat a dated README, a Phase 2 calendar, or a clasp setup guide as a command.

## What lives here

| Path | What it is |
|---|---|
| [sheets-era/](sheets-era/) | Snapshot of the Google Sheets / Apps Script project at `v0.0.31` (git tag `sheets-v0.0.31`). README, AGENTS, charter, architecture, decisions, roadmap, release notes, reviews, **old AI prompts**. |
| [rebuild-vs-sheets.md](rebuild-vs-sheets.md) | How the TypeScript rebuild mapped onto the Sheets review findings. |

Living AI documents (send these, not the folder above): [AI_SESSION.md](../AI_SESSION.md), [AI_AGENT_PROMPTS.md](../AI_AGENT_PROMPTS.md), [AI_QA.md](../AI_QA.md), [AI_HANDOFF.md](../AI_HANDOFF.md).

## What does not live here

Apps Script source (`Code.gs`, dialog HTML, clasp config, `.gs` tests) was removed from the working tree on purpose. Recover it from git:

```text
git show sheets-v0.0.31:Code.gs
git checkout sheets-v0.0.31 -- Code.gs
```

Workbook exports, chats, and credentials were never in GitHub. They stay local-only.
