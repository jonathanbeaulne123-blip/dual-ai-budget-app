# Five shared boards — authorized Development release

Jonathan explicitly instructed “push merge and deploy” after the local implementation handoff. This authorizes the Development release and its dedicated private photo-storage dependency. Production activation, schema application and destructive cleanup are outside this release.

Risk: High / Release. Budget (5): faster entry with explicit account intent and clearer accepted household balances. Engagement (3): five useful shared boards with authored Classic Hearth, Taylor's Scrapbook and Newfoundland treatments.

Candidate before release preparation: `e868652e826b6c075ba88bd78a8adaeb4b20d870`, clean, on `codex/hearth-five-boards`. Remote main rechecked at `5778a8d32389e3db194cdb4d602025581f953539`; subsequent main changes must be preserved. Product acceptance and independent review evidence are in [the implementation receipt](2026-09-08-five-shared-boards.md).

## Storage and rollout

Created dedicated R2 bucket `hearth-board-media-development` in the configured Hearth account, then verified public r2.dev access is disabled and no custom domains are attached. The only deployment configuration addition binds this bucket as `BOARD_MEDIA`. Existing secrets, Production bindings, flags, databases, schedules and Durable Object migrations are unchanged. Client and Worker ship together through the existing main-branch Cloudflare Workers workflow.

Photo reads and uploads require the existing authenticated household authorization. Removal clears the accepted slot reference; physical deletion remains disabled to protect concurrent attachments. Prior bytes remain private until a separate authority-aware retention implementation. No household data or test photos were written during provisioning.

Pre-release active Worker version: `684d8d27-26b9-4fbd-9513-d364bd6fe9fa` (100%), created 2026-09-08T19:07:41.518Z. Before new board data is accepted this is the rollback reference; after board commands are accepted, preserve command/data compatibility and prefer a forward repair. Never delete the bucket to roll back presentation.

Release checks: generated binding types, Worker dry run, focused High quick gate for media authorization/R2 and startup/rehearsal; PR CI and build before merge; main CI and Cloudflare deployment after merge; fresh live asset and unauthenticated media-boundary checks. Results and exact PR/merge/deployment identifiers are recorded with the release handoff. Hosted authenticated two-device, physical iOS/Android/Safari and real Google-return proof remain distinct from local browser evidence.
