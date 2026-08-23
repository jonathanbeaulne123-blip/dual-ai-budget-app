# Reference material

These files are **history**, not current product law. Keep them on GitHub (D-095) so other AIs can see how the kitchen started. **Do not use them to plan future work.**

Hearth is Dual Course ([../STRATEGY.md](../STRATEGY.md)). The TypeScript app, the living files in `docs/` (this folder and [../nostalgia/](../nostalgia/) excluded), and Jonathan’s latest instruction are what to follow.

This folder is the **Sheets-era** museum. Cursor-era Chapter / Ring maps live in [../nostalgia/](../nostalgia/). Do not treat a dated README, a Phase 2 calendar, or a clasp setup guide as a command.

## What lives here

| Path | What it is |
|---|---|
| [sheets-era/](sheets-era/) | Snapshot of the Google Sheets / Apps Script project at `v0.0.31` (git tag `sheets-v0.0.31`). README, AGENTS, charter, architecture, decisions, roadmap, release notes, reviews. |
| [rebuild-vs-sheets.md](rebuild-vs-sheets.md) | How the TypeScript rebuild mapped onto the Sheets review findings. |

## What does not live here

Apps Script source (`Code.gs`, dialog HTML, clasp config, `.gs` tests) was removed from the working tree on purpose. Recover it from git:

```text
git show sheets-v0.0.31:Code.gs
git checkout sheets-v0.0.31 -- Code.gs
```

Workbook exports, chats, and credentials were never in GitHub. They stay local-only.
