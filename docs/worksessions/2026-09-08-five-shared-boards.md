# Five shared boards and clearer mobile navigation

Status: implementation in progress. Jonathan approved the complete plan in this task on 2026-09-08.

Base: origin/main 5778a8d32389e3db194cdb4d602025581f953539, verified against remote. Integration branch codex/hearth-five-boards; isolated worktrees each have one writer. Calendar, Books, entry, media and shared-board UI are bounded delegated patches; coordinator owns board commands, continuity integration, Office placement and final verification.

Risk: High. Budget (5): clearer entry, account navigation and protected accepted-book projections. Engagement (3): five useful shared boards authored for Classic Hearth, Taylor's Scrapbook and Newfoundland. Decision owner: Jonathan.

Scope: four mobile Add modes with existing shift order; traditional calendar default alongside Month; Categories below plan summary; household overview/navigation; Notes/Photos/To-do/Goals/Shift Ask looping boards. Shared media uses a dedicated authenticated object service; bytes stay outside snapshots. New commands use scoped identity, stable ids, reviewed item versions and existing continuity. Savings stays derived from accepted goals.

Acceptance: entry cancellation/More/confirm/retry/scope guards; calendar routing and integration placement; all Books tools reachable; board gesture ownership, draft retention and scope resets; photo failure/replace, concurrent tasks/milestones, deletion/reconnect; three themes at 320/390/719/1100/1440, zoom/focus/reduced motion. Focused High quick gate and independent money/continuity plus UX reviews. Browser simulation and synthetic client proof are distinguished from physical devices and authenticated hosted proof.

Release boundary: local implementation and verification only. No deploy, storage provisioning, hosted schema, Production, or household cleanup. Record exact commands/results and remaining deployment dependencies before handoff.
