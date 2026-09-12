# Hercules Workspace — D-249

Hercules helps turn a substantial intention into useful work: conversation, research, documents, lessons, decisions and tasks, connected to the appropriate parts of Hearth. A life project owns its purpose and working material; monthly Plans own monthly commitments; Kitty Banks and Books retain their existing financial authority.

Implementation baseline: `origin/main` at `02a5539dfc4dfadf6c7cae67b98f17db278c9eaa`. Branch: `codex/hercules-workspace`. Risk: **High**. Jonathan approved the implementation plan on 2026-09-12. Hosted infrastructure, migration application, provider disclosure and activation are separate Release decisions.

## Product and authority

The Hercules room and compact conversation mount one private workspace controller. Navigation, expansion and project selection preserve drafts. Three authored study treatments use the existing Plan scene materials: Classic Hearth, Taylor's Scrapbook and Newfoundland, in Personal and Household views. Existing cat dress-up, private conversations, guided actions, claims and receipts remain accessible.

The workspace's owner is the authenticated member within an environment and household. Its private projects may read that member's Personal books and authorized Household books as distinct scopes. Another person's Personal replica is never assembled into a workspace read. The pure `LedgerRoom.workspaceQuery` reuses the deterministic read registry and never activates a due Plan, imports state or executes a command.

Model-generated output is private working material. Hearth changes still use `HerculesActionPanel`, its canonical private claim and `executeHerculesAction`. Each workspace proposal has one deterministic confirmation identity; review changes invalidate eligibility while retaining the receipt identity. The existing ledger receipt path verifies actor and command kind. Final server command admission checks the workspace proposal again. Financial posting retains Final Confirm, and shared Plan agreement retains its member approvals. The workspace cannot dispatch generic command names.

A shared artifact is a deliberately reviewed copy stored in a different Durable Object namespace. It contains title, format, reviewed content, sharing member and receipt time. It contains no private source references, ancestry, linked records or conversation. Reviewed content can itself contain sensitive information; the disclosure review shows the exact complete text for the member to edit before sharing.

Google Docs, Sheets, Slides and Calendar changes have a separate exact-content review, Google identity check and receipt. Google tokens are ephemeral Worker inputs, never model context or project state. A proposal binds one server-stored submission identity across devices. Definitively unsent failures allow revision; uncertain delivery keeps the exact review and checks receipts. An absent eventually consistent Drive search result never authorizes a second creation. Calendar uses an explicit client-generated event identity.

## Runtime and data

`HerculesWorkspace` uses the Agents SDK and SQLite-backed Durable Objects for private projects, immutable artifact versions, evidence, commands, run checkpoints, pending tools and receipts. `HerculesRunWorkflow` owns durable work independently of a mounted browser. R2 stores originals and artifact versions. The shared copy store has no private project graph.

The initial coordinator is Flash only, pinned to `gemini-3.8-flash`. It uses native function calling, preserves full model content including thought signatures, inspects results and continues within bounded work. Adaptive low/medium/high effort follows task complexity and the person's detail preference. There is no provider fallback in this runtime. The pin is a candidate awaiting live evaluation; configuration alone is not a tested-model claim.

Inputs up to 32,000 characters are accepted whole; larger material belongs in attachments. Original messages remain available through paginated retrieval. Context packets contain bounded decisions, constraints, task/source/artifact manifests and explicit omitted-message information. `project_read` retrieves complete context, sources, artifact manifests and original content. Financial facts must be refreshed, rather than remembered as current balances.

A run permits at most 24 checkpoints, 120,000 tokens and 30 minutes. Provider calls count the complete input and reserve its tokens plus the maximum output before dispatch; unknown usage does not refund the reservation. Tools have schema, permission, approval and size limits. A run records instruction revision, execution generation and attempt identity; late results cannot publish over steering or manual edits. Tool effects and stable tool receipts commit together. An interrupted dispatch pauses for explicit resume after bounded Workflow retries. Resume retains existing budgets and checkpoints while their grant is valid; an expired grant/time window starts an explicitly linked continuation under the requesting member's fresh authorization.

Progress is exposed as authenticated cursor events over polling. Every reconnect rechecks session and membership, and sends only a changed private snapshot. Compact and full surfaces use the same sequence and conversation. No generic Agent synchronization or broadcast carries private context.

Background grants are server-managed opaque capabilities, scoped to one member, household, project, run, expiry, read allowlist and budget. A lease lasts at most 60 seconds. The migration checks live Supabase session, member-session revocation, current membership and household deletion. Browser refresh tokens and administrative credentials never enter durable run state. Revocation pauses access-dependent work before publication. Opt-in scheduled follow-up records a future run; cancellation fences it even if the sleeping Workflow later wakes. Work scheduled beyond a grant's lifetime pauses for renewed authorization.

Research uses a separate public-search connector and controlled credentialless page reads. Exact outbound search terms are reviewed before first use, preventing private source instructions from becoming search queries. Page destinations must be observed public search sources. Redirects and destinations are revalidated; page text is treated as evidence, not instruction. Prices and external claims retain source and observation date.

Creation tools support Markdown documents, CSV workbooks, HTML interactive explanations, Python analysis and JSON artifacts. The stable Sandbox package and container image are pinned together to `0.12.9`; network access is disabled. Worker-side controlled handlers own connectors. The pinned image includes document/PDF libraries. Exports are DOCX, XLSX, PPTX and PDF; XLSX cells are written as text to prevent formula execution. Import reads text and Office/PDF text; scanned PDFs without extractable text return an explicit error. HTML previews use an isolated iframe and a restrictive CSP. Artifact validation reports structural/source-freshness checks; it does not claim factual certification or proof that an Office application rendered the file.

## Integration contracts

- `src/workspace/contracts.ts`: project, run, evidence, artifact, proposal and stable project-link contracts, version 1.
- `src/workspace/links.ts`: current Plan projection and available scoped record references. No project-owned money totals.
- `workers/workspace/`: authenticated service, Flash adapter, registry, grants, research, files, Google receipts, shared disclosure and Workflow.
- `supabase/migrations/022_hercules_run_grants.sql`: prepared grant schema/RPC migration. Not applied.
- `workers/entry.js`: platform exports; `workers/site.js` keeps the existing Worker HTTP surface independently testable.

Metadata remains outside accepted Plan digests and accounting hashes. Existing version-1 conversations and workflows remain readable. New workspace-derived private action drafts add an optional `workspaceConfirmationId`; deploy compatible clients before enabling workspace actions on meaningful data. Older strict decoders are not certified to open those new drafts. Unknown workspace versions fail closed with an upgrade message.

## Local proof and comparative evaluation

Run from the worktree with installed dependencies:

```sh
pnpm test -- --risk=high --focus=test/workspace-contracts.test.ts --focus=test/workspace-ui.test.ts --focus=test/workspace-trust.test.ts --focus=test/workspace-grants.test.ts --focus=test/workspace-links.test.ts --focus=test/workspace-action-bridge-ui.test.ts --focus=test/app-startup-p1.test.ts --focus=test/month-rehearsal-mainline.test.ts --focus-reason="Workspace authority, recovery, scoped planning and App continuity"
node scripts/verify-workspace-runtime.mjs
node scripts/verify-workspace-browser.mjs
python3 scripts/verify-workspace-exports.py
node scripts/evaluate-workspace.mjs
pnpm typecheck:workspace
pnpm build
```

The runtime proof uses actual local Agent SQLite, R2, LedgerRoom and Workflows with only Flash mocked and all outbound network blocked. Restart proof disposes/recreates Miniflare with persistent storage, restores artifact content and explicitly resumes a paused run. It does not establish hosted durability or a physical device handoff. The UI proof mounts actual workspace/theme components with synthetic transport, covers 36 theme/scope/width combinations and checks Axe, overflow, edits, offline recovery and compact expansion. It is distinct from full-App or physical keyboard proof.

The evaluation runner compares a basic two-call chat runner and an iterative workspace runner using the same Flash pin, tool declarations and synthetic source fixtures. `--live` and a local `GEMINI_API_KEY` are required to call the model. It records completion, latency, tokens, tool/model calls, artifacts and transcripts. Human review supplies acceptance, correction effort and evidence quality; supplied dated contracted prices supply cost per accepted result. Missing judgment or pricing remains null. A dry run lists the cases and makes no provider calls. No quality or cost advantage is claimed before live comparison.

## Release and rollback

The checked-in default is disabled: `VITE_HERCULES_WORKSPACE=0`, workspace service/execution off, disclosure disabled, Google writes off. Production is rejected. Existing action flags remain independent. Secrets are Worker secrets only (`GEMINI_API_KEY`, optionally `BRAVE_SEARCH_API_KEY`); never Vite variables. Meaningful context requires the distinct `workspace-gemini-v1` disclosure policy: project conversation, selected sources/working files, decisions and authorized tool results may be sent to Gemini. Public search sees only approved queries. Google sees the reviewed change after separate confirmation.

The ordinary Development deployment provisions the workspace's empty storage/Workflow bindings while retaining all off switches. Cloudflare's account preflight on 2026-09-12 denied Containers access because Workers Paid is required; no billing change is authorized. The container application is therefore an explicit later deployment: its reviewed fragment is `workers/workspace/container-config.json`. Run `node scripts/prepare-workspace-container-deploy.mjs` to prepare `.wrangler/workspace-deploy.json` from the current main configuration; it does not deploy, change billing or activate execution. Once those Release requirements are authorized, use that generated config for the Docker/container build and deployment. Existing bindings and financial authority are inherited from the current release config.

A separately authorized release must provision the configured R2 bucket, Agent/Sandbox Durable Objects, Workflow and container; apply migration 022; deploy compatible clients; configure authenticated membership/session control; perform live synthetic Flash evaluation and container/export proof; then obtain the meaningful-data disclosure/activation decision. Run authenticated Jonathan/Bianca continuity and revocation checks on actual devices before treating the feature as accepted for household use.

Rollback first disables new execution and external writes. Preserve SQLite, R2, grant/receipt tables and existing ledger receipt recovery. Leave read/review recovery available as needed; do not delete workspace storage or revert compatible decoders while pending workspace-derived claims exist. No flag causes financial replay, automatic migration rollback or source disclosure.

Current local evidence and unresolved Release gates are recorded in the [worksession](worksessions/2026-09-12-hercules-workspace.md).
