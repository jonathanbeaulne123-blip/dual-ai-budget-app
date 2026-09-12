# Hercules Workspace — local implementation and Release handoff

Jonathan or Bianca can bring Hercules a substantial intention, develop research and artifacts, revise direction, and connect reviewed results to Hearth. Life projects retain their purpose and working files; monthly Plans, Kitty Banks and Books retain their existing financial responsibilities.

- **Decision owner:** Jonathan. **Implementation/review target:** Codex, with one writer and bounded independent trust and UX reviewers.
- **Repository:** `https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app`.
- **Branch:** `codex/hercules-workspace`; baseline `origin/main@02a5539dfc4dfadf6c7cae67b98f17db278c9eaa`. Resolve the local branch tip before continuation; no PR, merge or deployment is claimed by this packet.
- **Worktree:** `.codex-work/hercules-workspace` beneath Jonathan's budget-app workspace. Keep the shared deployment checkout untouched.
- **Risk:** High implementation; subsequent infrastructure, schema and activation work is Release risk.
- **Budget delta (5):** connect intentions to fresh Personal/Household evidence and existing reviewed commands without duplicate resources or financial writers.
- **Engagement delta (3):** persistent conversation, private projects, editable artifacts, broad assistance and three authored study rooms.
- **Why now:** the approved rows 12–14 redesign replaces fixed intake and mounted-chat execution with a durable Flash workspace.

## What is implemented

The room and compact surface share a persistent controller. Private projects hold original messages, decisions, tasks, preferences, source evidence, versioned artifacts, proposals and stable links. Edits and steering fence late results. The client retains per-project drafts, precise pending-command identities and uncertain external reviews.

SQLite Agents own private state, Workflows own background runs, R2 holds files, and a matching stable Sandbox package/image processes isolated artifacts. Flash-only iterative tools use full input counting, adaptive effort, explicit context retrieval, resumable grants and execution budgets. Authenticated cursor polling reconnects to private progress. Opt-in scheduled runs can be cancelled even after a renewed-grant continuation.

Hearth reads reuse a pure scoped LedgerRoom query. Action proposals return to the existing review, private claim and Final Confirm boundary. Server admission rejects stale proposals and compound claim/execution bypasses. Google changes bind one exact submission identity across devices, with separate confirmation and receipts. Sharing stores only the explicitly reviewed copy in a separate shared Agent.

The architecture, contracts, policy and compatibility details are in [HERCULES_WORKSPACE.md](../HERCULES_WORKSPACE.md). Measured evidence and acceptance classification are in [the worksession](../worksessions/2026-09-12-hercules-workspace.md).

## Invariants for the next contributor

1. Preserve the current scoped money writer, Final Confirm, independent shared Plan approvals, receipt recovery, financial hashes and Plan digests. Workspace metadata cannot become an accepted balance.
2. Only the requesting member's Personal scope and authorized Household scope enter a private run. Shared artifacts never grant access to private source graphs or history.
3. Model output never authorizes a command, public query, disclosure or Google write. Credentials stay in Worker-controlled handlers; sandbox network access stays disabled.
4. Steering or editing invalidates earlier proposals. Ambiguous delivery retains its original immutable submission identity; receipt absence alone cannot reauthorize an uncertain Drive creation.
5. Revocation, expiry and budget exhaustion preserve progress and stop access-dependent execution. No generic Agent broadcast may carry private context.
6. Rollback preserves private files, conversations, grants, claims and receipts. Keep compatible readers for new optional workspace claim fields until pending recovery is resolved.

## Reproduce local checks

Use the documented project runtime. On this host, prepend the bundled Node directory to `PATH`; pnpm may require the two configuration overrides below to avoid automatic dependency reinstallation. Run memory-intensive checks sequentially.

```sh
export PATH='/Users/jonathanbeaulne/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin':$PATH
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never test -- --risk=high --focus=test/workspace-provider.test.ts --focus=test/workspace-command-authority.test.ts --focus=test/app-startup-p1.test.ts --focus=test/month-rehearsal-mainline.test.ts --focus=test/hercules-chat-providers.test.ts --focus-reason="Workspace authority, provider budgets, private recovery and full App continuity"
node --max-old-space-size=6144 node_modules/typescript/bin/tsc -p workers/workspace/tsconfig.json --pretty false
node scripts/verify-workspace-runtime.mjs
node scripts/verify-workspace-browser.mjs
python3 scripts/verify-workspace-exports.py
node scripts/evaluate-workspace.mjs
node node_modules/vite/bin/vite.js build
node node_modules/wrangler/bin/wrangler.js deploy --dry-run --containers-rollout=none --outdir /tmp/hearth-workspace-worker-review
```

The browser proof uses actual components and themes with synthetic transport. Runtime proof uses actual local platform primitives with a mocked provider and blocked network. Python export proof reopens files locally; it does not certify the Docker image. `evaluate-workspace.mjs` without `--live` makes no provider calls. Do not turn the focused gate into an exhaustive suite without Jonathan's exact-SHA authorization.

## Release work still requiring authorization and proof

First compare the branch with current main and revalidate any integration changes. Use `hearth-release-review` before release consideration. Do not infer deployment or hosted mutation permission from the implementation request.

1. Provision the configured R2 bucket, SQLite Agent/Sandbox bindings, Workflow and container; apply migration 022 only to the separately approved environment. Verify Worker account limits against the measured bundle size and container availability.
   The 2026-09-12 account preflight denied Containers without Workers Paid. The normal code deployment excludes container application creation and keeps execution off. After the billing/container Release decision, run `node scripts/prepare-workspace-container-deploy.mjs` and use `.wrangler/workspace-deploy.json` for the container dry run/deployment. The generated config retains current main's bindings and absolute asset/image paths.
2. Build the matching Sandbox image with Docker and prove real document import, Python execution, export, no outbound network and cleanup. Docker was unavailable during this local implementation.
3. Deploy compatible readers with service and execution disabled; preserve legacy chat/action recovery. Configure secrets through Worker secret management only.
4. Run live **synthetic** comparison against the pinned Flash model. Both runners use the same model/tools; human scoring must supply accepted results, correction effort and evidence quality, and dated pricing must supply cost. The candidate model pin has not been live-certified here.
5. Verify authenticated Jonathan/Bianca continuity and revocation across actual devices, stale facts, duplicate delivery, concurrent edits, private-to-shared disclosure and uncertain external receipts. Separately verify physical keyboards, VoiceOver, real zoom and complete App scenes in all three themes.
6. Obtain the distinct meaningful-context disclosure/activation decision. State that Gemini may receive project conversation, selected files and sources, decisions and authorized tool results. Public search receives only reviewed queries; Google receives only the separately confirmed change. Keep Production rejected and all activation flags off until the relevant decision is recorded.

Expected return handoff: exact base/head and environment, independent findings and fixes, commands with measured results, local versus live versus physical evidence, disclosed data categories, applied infrastructure/schema if authorized, remaining uncertainties, rollback readiness and a concrete go/no-go recommendation. Do not report local tests as Release acceptance.
