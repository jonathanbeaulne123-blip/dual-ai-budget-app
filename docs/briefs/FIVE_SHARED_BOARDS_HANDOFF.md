# Five shared boards and daily money navigation

Owner: Jonathan. Target: a fresh Codex/Claude reviewer and the eventual release operator. Risk: High. Local integration branch: `codex/hearth-five-boards`, based on verified `origin/main` `5778a8d32389e3db194cdb4d602025581f953539`. Release is separate; this packet is not deployment authorization.

## Household outcome

Mobile Add uses the Till-style pad, relevant choices and More for the four existing modes. Shift retains its existing order and calculations. Ambiguous accounts require a deliberate choice, including through More and resizing. Explicit Close pauses a mobile draft; internal navigation and acceptance cannot resurrect a submitted entry.

Calendar opens the traditional seven-column grid, followed by Coming up and Google integration. Month retains the other calendar presentation. Shared Plan reads plan vs actual, Categories, guided planning, then savings. Household table opens Overview, with Fund, Accounts, Activity, and Tools & audit; registers retain filtered context.

Home contains five looping boards: Notes, Photos, To-do, Goals and Shift Ask. Notes uses the same drawing surface on desktop and mobile plus a typing alternative. Photos provides three private slots, preview/crop/caption, replacement, removal and enlargement. Tasks and milestones have per-item versions and shared continuity. Savings uses existing accepted goal records. Ask remains scoped to its viewer, with existing phone Reach controls; an ineligible viewer sees an explanation on board five.

Classic Hearth, Taylor's Scrapbook and Newfoundland are all implemented. This is now an ongoing UX rule in `AGENTS.md`.

Budget (5): clearer entry and shared-money navigation, with explicit account intent and unchanged financial authority. Engagement (3): useful shared spaces with distinct theme treatments.

## Contracts and release dependencies

- All money continues through existing commands and Final Confirm/`acceptHouseholdWrite`. Board milestones never post money. Pending entries remain separate from accepted balances.
- Board commands bind the authenticated actor and compare the individual item version/resource. Deletions preserve tombstones; clearing a photo retains its slot version. Legacy snapshot recovery must preserve unrelated board rows. Rejected drafts remain visible for review instead of becoming financial entry forms.
- Photo bytes live outside household snapshots and public theme assets. The dedicated local IndexedDB queue stores prepared images plus allowlisted scope and intent, with no credentials. The private Worker verifies membership on upload/read. A prepared image is at most 1600 pixels and 2 MiB; JPEG/PNG/WebP inputs are accepted, HEIC requires conversion.
- **Provisioning remains undone:** bind a dedicated Development `BOARD_MEDIA` R2 bucket during a separately authorized release. Without it, uploads remain queued and the UI offers retry. Ship the matching client and command registry/Worker together.
- **Removal clears the accepted board reference; it does not erase remote bytes.** Independent review found that uncoordinated physical deletion could destroy a concurrently attached photo. Physical DELETE is therefore disabled. Prior immutable files remain private and accessible to authorized household members. Coordinated garbage collection must first retire the media ID under ledger authority, then perform durable idempotent cleanup. Retention/physical cleanup is a separate storage release dependency.
- No hosted schema, bucket provisioning, deployment, Production activation, household cleanup, or external messages were performed. Test data and screenshots are fictional, local and untracked. Tests use loopback Chromium/SQLite/IndexedDB/workerd/R2, not live Google membership.

## Verification and remaining proof

The [worksession](../worksessions/2026-09-08-five-shared-boards.md) is the measured receipt for exact commits, commands, independent review closures and final gates. Reproducible browser scripts live in `test/five-boards-layout.mjs` and the entry proof script recorded there. Screenshots and JSON reports stay in ignored `.artifacts/`.

Local transport proof is separate from physical iOS/Android/Safari, real Google connection return, and authenticated hosted two-device acceptance. No existing sync latency certification is closed by this work.

## Next operator

Review the exact candidate SHA and worksession evidence. Preserve any subsequent main changes when integrating. Keep the release separate until storage binding/retention and hosted/device proof are ready. Before deployment, rollback is simply retaining main and this isolated candidate. After household board data exists, do not revert shared schema/command support as a visual rollback; preserve data compatibility and use a forward repair.
