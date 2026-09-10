# Hercules conversational app — continuation packet

Status: OPEN implementation, not a completion or release certificate.
Decision owner: Jonathan. Target contributor: Codex or another repository-aware implementer, with independent money/privacy and UX reviewers. Risk: High. One writer per checkout.

## Outcome and authority

Complete Hearth workflows through conversation: collect details, show an editable exact review, obtain Final Confirm, execute the existing command and report the accepted receipt. Cover the entire app, retaining independent member approvals, source review and provider consent. Budget (5): accepted accounting and safe recovery. Engagement (3): understandable guidance, useful skills and continuous typing.

Jonathan explicitly requested implementation of the full plan on 2026-09-10. Local code and synthetic Development verification are authorized. Deployment, hosted schema, secrets/provider changes and Production activation remain separate. No outbound real-household/model/provider tests are authorized by this packet. Do not relabel real data synthetic.

## Exact checkout

Repository: `jonathanbeaulne123-blip/dual-ai-budget-app`.
Branch: `codex/hercules-conversational-app`.
Base and HEAD before implementation: `2db3da9fd3bff0c23beb78ceaf73295b19f2e34e`.
Worktree: `.codex-work/hercules-conversational-app` beneath the project workspace. Implementation was committed for the explicitly authorized Development release; inspect the current diff and worktree before continuing. Do not replace it with an older audit checkout. See the worksession for current PR/deployment evidence.

## Current implementation

The workflow catalogue contains 80 entries. `herculesActions.ts`, `herculesAppointmentActions.ts` and `herculesCompanionActions.ts` reuse existing commands; `HerculesActionPanel.tsx` owns collection/review and exact human confirmation; `herculesExecution.ts` binds the private claim and consumes it with accepted command output. `herculesCommandService.ts` keeps uncertain receipts distinct from rejection. Model proposals are field suggestions only and are rejected if manual edits changed the draft after request dispatch.

Private workflow resources use revisions, generation, scope, tombstones and immutable pending submissions. Explicit sequential requests have separate checklist entries. When another device advances a queue while an earlier receipt is uncertain, recovery waits for/adopts canonical current state; it must never reconstruct the old next task. Cancellation races on the same claim and never removes accepted money.

Native events have a separate versioned shape, privacy split, civil timezone handling, recurrence, occurrence moves/cancellations and tombstones. Bill payment recording permits actual dates/amounts and matching existing evidence while preserving template values. Funds, card transfers, shift earned/received semantics and planned expenses retain their existing domain commands.

The desktop shell is 440px with expansion and fixed composer; mobile uses visible viewport height. The composer is editable while model work runs, submissions are latched, and autofocus must not steal later keyboard/review focus. Classic, Taylor and Newfoundland have authored card/header treatments.

## Unfinished scope — do not advertise as implemented

Use [the complete inventory](../HERCULES_CAPABILITY_COVERAGE.md), not command count, to close coverage. A broad command can have only partial chat options. Remaining work includes full job/attendance/correction and evidence flows, remaining partial/private claim and visit evidence controls, full Fund options, category/account/goal setup options, imports and account-history approvals, allocation workflows, onboarding/membership/authentication administration, arbitrary fitting/file controls, and external Google event CRUD/recovery. Reuse specialized controls where they preserve file/authentication/review requirements. Do not create a generic arbitrary command-name executor to make the table appear complete.

For Google, use a separate authority-owned operation journal with exact scope/provider subject/calendar/event IDs, payload hash, ETag and original submission identity. Keep OAuth tokens transient and out of drafts/logs/receipts. Create with deterministic event IDs; conditional updates/deletes must preserve provider restrictions. Recover uncertain provider results before cancellation or a new attempt. Native and Google writes remain separately confirmed and receipted. Existing reminder publishing is not a general event writer.

Known remaining acceptance gaps: authenticated two-device resumption and receipt recovery, actual live-model dialogue quality, physical keyboards/Safari/VoiceOver, 200% zoom, long-conversation and all specialized editor paths. Arbitrary-timezone ICS interoperability and full event editing options are not certified. Ordinary drafts now use the existing 30-day private-history window with tombstones; pending identities remain retained for recovery.

## Verification and local setup

See [worksession evidence](../worksessions/2026-09-10-hercules-conversational-app.md). Do not copy interim passes into a final certificate. The focused High gate log and browser results are under ignored `.artifacts/hercules-conversational/`.

Use the bundled Node bin directory at the start of PATH. Existing dependencies are symlinked from the living-companion audit worktree. For pnpm, preserve them with `--config.manage-package-manager-versions=false --config.verify-deps-before-run=never`. Run `pnpm test -- --risk=high` with explicit focused tests and a concrete focus reason; do not run exhaustive gates without a separate request.

The local browser config permits only the exact dependency path needed for PGlite WASM and disables all remote proxies. Keep provider tests mocked and synthetic. Do not commit runtime data, screenshots containing household data, exports, credentials or `.env` files.

## Return evidence

Return exact code changes, matrix gaps closed, focused tests and fingerprint, theme/viewport/focus/recovery evidence and outstanding limits. Separate local, branch/PR, authenticated, live-model and deployed facts. Preserve accepted data and all recovery receipts when pausing the new execution flag. Full-plan completion requires the remaining scope and acceptance work, not only a green subset.

## Latest checkpoint additions

The 80 named adapters include appointment schedule/create/edit/move/archive, recorded visits with linked claims, claim submitted/full-received/shortfall, saved wardrobe wear/save/remove, gallery publish/rename/remove, remembering/forget and conversation clear. Full command-option coverage remains open. See the worksession for exact passing tests and failed/superseded gate evidence. Original receipt recovery now stores a resolved identity/revision floor through reloads. Review series exception retention/reset explicitly. Maintain the static companion action-effect classifier and existing wardrobe version/single-operation guards.
