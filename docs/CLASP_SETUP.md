# Clasp Setup

`clasp` will synchronize this repository with the bound Apps Script project attached to the development Google Sheet. It does not provide general Google Sheet cell access by itself.

## Safety rule

The repository root must link only to development. Production must never be connected here casually.

`.clasp.json` and authentication credentials are ignored by Git. `.clasp.example.json` is the safe template.

## Current state

- The checked-out feature source and linked development Apps Script source both report `v0.0.31`. The approved development-only push completed at 10:31:13 PM on 2026-08-18, and a fresh isolated pull matched commit `0f18df3` across all eight tracked files after line-ending normalization.
- Development workbook exists.
- Development Apps Script ID is stored locally in ignored `.clasp.json`.
- Google authorization completed successfully on 2026-08-18.
- Before the v0.0.29 push, an isolated pull reported v0.0.28 and matched `main` across all seven files. After the approved v0.0.29 development-only push, a second isolated pull matched commit `4a4c01d` exactly after line-ending normalization.
- The remote `appsscript.json` manifest is tracked in Git.
- The latest development source push completed at 10:31:13 PM on 2026-08-18. It changed source only; no v0.0.31 live-Sheet control or Add Shift setup action has run yet. Production was not linked, targeted, or changed.

## Reconnecting on a new computer

1. In the Apps Script editor attached to the development Sheet, open **Project Settings**.
2. Copy the **Script ID**.
3. Enable the Apps Script API at `https://script.google.com/home/usersettings` if it is disabled.
4. Run `pnpm run clasp:login` locally and complete Google's browser authorization.
5. Copy `.clasp.example.json` to `.clasp.json` and replace the placeholder with the development Script ID.

## Reconciliation result

The first remote copy was downloaded into a disposable comparison folder and checked against:

- `Code.gs`
- `AddTransactionDialog.html`
- `AddCategoryDialog.html`
- `AddShiftDialog.html`
- `CategorySpendingDialog.html`
- the remote `appsscript.json` manifest

All files matched. The development project and repository source are synchronized as of 2026-08-18.

`clasp` 3.3 defaults to writing remote server files with a `.js` extension. This repository intentionally uses `Code.gs`; `.clasp.json` therefore sets `scriptExtensions` to `[".gs", ".js"]` so a future pull preserves the established filename.

Before any future pull, commit or stash local work and confirm `.clasp.json` still points to development. Before any push, run local checks and verify the development environment marker.

## Production release

A production release workflow will be added after the development link is verified. It must require:

- Passing local checks
- Passing development-Sheet diagnostics and health checks
- Recorded release version
- Review proportional to risk
- Jonathan's explicit approval
