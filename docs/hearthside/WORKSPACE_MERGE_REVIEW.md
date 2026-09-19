# Selected-intention Workspace review and repairs

This bounded review inspected the current-main reconciliation at `2db4891c82eaf825eceeafefa1a9426457e4c20a`, plus the integration owner's current Workspace client cancellation/deadline correction. It covered selected-experience discovery, action options, tool dispatch and recovered execution; private source deletion versus shared-copy withdrawal; account cancellation; and the selected-intention route into the merged bug-report workflow.

Two P2 continuity findings were reproduced in the actual Workspace component:

1. **StrictMode opening stayed disconnected.** The first effect started `refresh()`. Cleanup cancelled the request but retained `refreshFlight`. The replayed effect reused that cancelled promise; no snapshot loaded, and the interval required an existing snapshot before polling. Without a focus/reconnect event, the private save button never appeared. The repair fences refresh completion by effect generation and releases the cancelled flight during cleanup. It preserves all existing client deadline, token, fetch and decode cancellation checks.
2. **A bug-report message went into the selected intention.** `newReport()` created a generic private project and changed `selected`, while the actual `project` was still forced to `experienceProjectId`. The report was saved but not shown, and the next message went into the experience project. The baseline browser proof wrote a report-only canary into that wrong project while the new report remained empty. The repair routes an explicit report request through App, clearing the selected-intention binding before opening the same report identity.

## Exact integration

Apply or narrowly adapt `workspace-merge-repair.patch`. It changes only `src/workspace/Workspace.tsx` and the small report helper/wiring in `src/App.tsx`. Do not copy this review checkout's entire App or client over the integrated source. No authority, provider, command, storage, capability or activation changes are required.

The added prop is:

```ts
onPrivateReportRequested?: (request: {
  id: string;
  context: FeedbackContext;
  text?: string;
}) => void;
```

App clears `workspaceExperienceSelection` and `workspaceProjectId`, then preserves the supplied request ID and app-feedback context in its identity-scoped bug request. The explicit report request ID also takes precedence over a remembered private project selection. Automatic experience reopening is suspended while that report request is pending. The standard private-report flow creates the project. The selected view explains that reports open separately. The intention's source drafts and exact provider approval remain in their original scope; neither is copied into the report. Opening the report does not send a model message. The user sends a new instruction under the ordinary private Workspace's existing activation/disclosure behavior. A later intentional return restores the selected-intention draft.

When the callback is absent, the selected view cannot create an unreachable generic report. The existing generic Workspace report path is unchanged.

Patch source hashes:

| File | Captured root base SHA-256 | Tested patched SHA-256 |
| --- | --- | --- |
| `src/workspace/Workspace.tsx` | `002a6c72cded1d1ba37ed0b2d89e7cf00c633c97002247b8efd8f61aea4bec09` | `b05fedf7a899ad14f17cb6f0a3c445d89a68b532551d6610b0d0e426897c7fef` |
| `src/App.tsx` | `20f76d46c73ba8a013b3c3731430b0b29270a22704a9102df4065685f0f16ebe` | `b8adcd0cbdc1266877d192100a0f1d832d890756b571890f2c4a7047db061da7` |

## Authority review result

No additional concrete private-ledger admission defect was found in the reviewed paths. The dispatcher's disclosure check still precedes tool selection. Experience discovery returns static proposal identifiers without invoking accepted-ledger queries; action options are denied. The execution service independently denies an experience project's read callback even if a recovered grant lists broader reads. A proposal tool only creates an unconfirmed draft; arbitrary execution tool names remain unavailable. Financial acceptance still belongs to the existing explicit action review and Final Confirm path.

The new local runtime proof persists actual Agent SQLite execution state, restarts Miniflare, and invokes the real `advance()` dispatcher with a legacy broad grant. Its deliberately minimal canonical-authority fixture counts every attempted query. Reads/options/execution attempts produce no private query; static discovery remains usable; `prepare_action` produces a draft without a receipt. A changed canonical intention pauses recovered work before tools. No model or external provider is called.

The existing actual private/shared Agent test also verifies that source deletion removes the private versions and uploaded original, preserves a deliberately published copy, and that only the publisher can withdraw the shared copy. Withdrawal remains denied on replay as a new publication. That is separate from local draft deletion and from finance restoration.

## Verification and limits

- Baseline diagnostic browser proof reproduced both findings in 1.96 seconds. It explicitly reconnected after the blocked first opening, then demonstrated the report-only message on the wrong project. Log: `/tmp/workspace-merge-review-browser.log`.
- Root independent review identified a saved-selection race in the first repair. With the real `onExperienceOpened` callback and private scope previously pointing at the experience, the report failed to open (6.94-second targeted regression). Prioritizing the explicit report request and preventing automatic rebind closes that case; all three final theme cases include it. Log: `/tmp/workspace-report-rebind-baseline.log`.
- Final targeted run: **49 tests / 8 files passed in 10.11 seconds**. Log: `/tmp/workspace-merge-repair-final.log`.
- Browser regressions prove first StrictMode opening without focus/reconnect, separate report identity, no copied experience approval, correct message destination, keyboard activation, and restoration of an unsaved intention draft in Classic, Taylor and Newfoundland at 390px.
- Client regressions prove a cancelled token cannot dispatch a late write, and a cancelled response body cannot replace the current cache, even when the new effect generation is already active.
- The actual Workspace browser proof uses a synthetic transport implementing the same App callback contract. It does not claim a full-App authenticated browser journey. App's narrow helper/wiring still needs the integration owner's merged compiler and whole-App gate.
- The initial mixed review run passed 43 tests and exposed the first-open browser failure. The post-fix 47-test run passed before the explicit action-dispatch and cache regressions were added. No failing product regression is concealed by the final selected run.
- No full compiler, build, High/Release gate, hosted service, native distribution or external disclosure ran in this checkout. The integration owner owns final patch review, focus-map registration and the merged-source gate.

```sh
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never exec vitest run test/workspace-merge-review-browser.test.ts test/workspace-merge-review-runtime.test.ts test/workspace-merge-review-client.test.ts test/hearthside-workspace.test.ts test/hearthside-workspace-runtime.test.ts test/workspace-ui.test.ts test/workspace-action-options.test.ts test/workspace-action-options-authority.test.ts
```
