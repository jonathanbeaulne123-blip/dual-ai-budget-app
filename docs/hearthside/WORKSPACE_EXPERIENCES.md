# Hearthside intentions in Hercules Workspace

Local package based on `ba10aa18d54ca33b6b40a84e5cdc4fa973efcde2`. No model, provider, service, calendar or financial activation is part of this package.

The selected intention now has a useful private worktable in both compact and full Workspace. Three authored Hercules activities produce editable notes, possibilities including a free version, and recollections. Local drafts survive browser restart under an exact signed-in identity/environment/household/member/experience key. Saving creates one private artifact identity, later saves append versions, and retrying an accepted identical save does not make another artifact. Opening the worktable only renders local content.

## Component integration

`HerculesWorkspaceRoom` accepts an optional `hearthside: HearthsideWorkspaceBinding`:

```ts
{
  scope: {identity, environment, householdId, memberId},
  experience: workspaceExperienceContext(acceptedExperience),
  onReturn: () => returnToHearthside(originatingRouteAndFocus),
  onPublication?: (review, exactDigest) => Promise<ArtifactPublicationReceipt>,
  onWithdrawal?: publicationId => Promise<ArtifactPublicationReceipt>
}
```

The callbacks are optional because the Workspace component defaults to the new authenticated Workspace routes. A caller wrapping them must use the same exact scoped authority; it must not synthesize a receipt or use a generic `experience.save` to link an arbitrary string. The standalone `ExperienceWorktable` needs only `hearthside` to remain useful when Workspace service or execution is unavailable. It accepts optional private-save/context-review handlers when hosted storage exists. Root should render it inside the selected Hearthside experience when Workspace is not activated.

Root App wiring:

1. Add an explicit **Work on this with Hercules** action to the selected experience. Save its stable Hearthside route and focus before `openHearthsideTool('hercules', ...)` or opening compact Workspace.
2. Keep one `selectedWorkspaceExperienceId` scoped by `ledgerRenderScopeKey`, resolve it from the current accepted `h.hearthside.experiences` on every render, and pass the minimum projection above. Never persist a whole household or private sources inside this binding.
3. Preserve the binding when expanding, minimizing or hiding. `onReturn` and Close should restore the original intention/object route, household query and focus. Clear the binding on account/household/member change or when leaving for an unrelated private Workspace project.
4. Retain `householdForHerculesContext` stripping of Hearthside. The selected lane is explicit and is not an expansion of the general private/household prompt.
5. Supply `onExperienceOpened(experienceId)` on Workspace: when an experience-bound project is reopened from the ordinary private-project list, resolve its current accepted experience and restore the same binding. This also makes revision refresh possible after returning through a generic Workspace entrance.
6. Route an accepted experience `artifact` reference to this experience Workspace and its shared-copy shelf, not to Plan.

`ExperienceWorktable` uses real theme scene tokens and an authored paper/ribbon/coastal treatment across Classic, Taylor and Newfoundland. It is fully usable as HTML with keyboard, reduced motion and small screens. The deterministic resident receives only selected state/horizon/title and does not infer partner feelings, participation, spending or reciprocity.

## Strict context and provider boundary

`WorkspaceExperienceContext` is exactly version/id/revision/title/intention/state/horizon. Strict decoders reject extra fields, getters, symbols and unknown versions. `workspaceExperienceContext` is an explicit allowlisted projection of an already validated accepted experience.

`createExperienceWorkspaceProject` requires the deterministic project ID derived from environment/household/member/experience, exact reviewed context digest, and independently loaded accepted LedgerRoom context. The dedicated private namespace never silently adopts an existing unrelated project. `refresh-experience` preserves files and private conversation, supersedes active runs, and resets the exact provider disclosure approval. A changed accepted intention pauses further provider steps until it is reviewed again.

Provider execution additionally requires `approve-experience-disclosure` for the exact digest, existing service execution activation, and a separate user message/follow-up. Opening or saving local/hosted work does not request a run. The UI displays the exact selected JSON and names Gemini, deliberately placed files/instructions, research review and external-action boundaries before approval.

The worker patch denies `hearth_read` for experience projects even if an older run grant lists broad read tools; discovery lists no broad reads. `project_read` can retrieve only that private project and its explicit `experience` context. Shared-copy browsing pages four immutable copies at a time (at most about 2 MB), and adoption fetches one copy by ID rather than loading the entire household archive. An active shared copy can enter the project only through `adopt-experience-copy`, with exact copy digest, selected experience identity, explicit visible content review and current source-state verification. Existing action proposals remain drafts that enter their existing exact review/Final Confirm paths.

## Shared publication authority integration

`workspace-workers-integration.patch` contains all worker/service/tool/route changes against the package base. Apply after adding the LedgerRoom methods below. The temporary `as unknown as WorkspaceHearthsideAuthority` at `hearthsideAuthority` is solely an isolated-base integration seam; remove it when LedgerRoom implements the typed methods.

The root-owned LedgerRoom must implement `WorkspaceHearthsideAuthority` from `workspaceAuthority.ts`:

- `workspaceExperience(scope, experienceId)` authenticates current scope/membership/ACL and reads one accepted experience. Return only the strict minimum projection.
- `workspaceAcceptArtifact(scope, publication)` authenticates actor and capability, resolves `preparedExperienceFor(scope,id)` in the separately bound `HERCULES_SHARED_WORKSPACES` namespace, and compares its exact `artifactPublication(copy)` to the submitted metadata. Never accept browser metadata without this trusted prepared-copy check. If an exact receipt already exists, return it before checking the now-newer experience revision. Otherwise require the reviewed experience revision, atomically add the typed artifact publication and one experience reference, and record the accepted receipt/sequence. Artifact content, source project IDs and source version IDs must never enter Household snapshots.
- `workspaceWithdrawArtifact(scope, publication)` verifies the shared copy is already `withdrawn`, validates original publisher and the same immutable identity/digest, records a monotonic withdrawn metadata/receipt state, and removes or marks unavailable the experience reference. This operation cannot restore a source or revive access. It must also handle a prepared copy revoked before the original acceptance completed.

Proposed shared state field: `artifactPublications: ArtifactPublication[]`, decoded with `decodeArtifactPublication`, defaulting to an empty list for compatible old snapshots. Generic `SharedReference.kind='artifact'` remains refused; only dedicated authority acceptance creates a reference. Put these metadata/receipts in shared-life backup/recovery. Financial restore must preserve them. Restoring old shared-life data cannot revive revoked copies.

`ArtifactPublication` contains version, id, revision=1, experience identity/reviewed revision, reviewed title, format, content digest, publisher and accepted/active/withdrawn state. No bytes or private provenance. `ArtifactPublicationReceipt` has version/id/publication/acceptedSequence; clients verify every field, including actor and immutable content digest.

`publishExperienceArtifact` claims the exact private review digest, prepares an immutable approved copy, accepts the reference, then activates access. Retries keep the same identity; a lost activation acknowledgement does not republish. Private source validation requires owner/project/bound experience and the latest source version before first preparation. Once a reviewed immutable copy is prepared, subsequent source deletion does not erase that copy or block recovery. Withdrawal revokes access first, then records its receipt. The client persists pending publication and withdrawal identity before transport, including across browser restart.

Cloudflare adds `Symbol.dispose` to plain RPC return objects. `consumeWorkspaceRpc` is used only at trusted server RPC boundaries, copies plain data without invoking getters, rejects unexpected functions/symbols/cycles/oversized values and disposes the transport result. Ordinary document decoders remain strict. This behavior is verified by real Workerd calls and the [Cloudflare RPC lifecycle documentation](https://developers.cloudflare.com/workers/runtime-apis/rpc/lifecycle/).

## Source deletion and recovery

`delete-artifact` removes the current private artifact plus its prior versions, retains IDs as tombstones, and supersedes active runs/proposals. The worker deletes the corresponding SQLite artifact rows (a simple upsert cannot accomplish deletion). Original uploaded bytes are placed in a durable cleanup queue inside the same transaction as the accepted deletion, then removed from R2. A retry resumes cleanup. Shared copied bytes/metadata live in another namespace and are untouched.

This removes Workspace source versions and original upload objects. It does not promise erasure of already disclosed provider content or unrelated historical private conversation mentioning the source. Shared-copy withdrawal is separately labelled and independently recoverable.

## Evidence and remaining root gates

- Dedicated contract/tool/receipt suite covers explicit projection, scope identity, owner and source checks, provider disclosure, revision refresh, denied broad reads, preparation/acceptance/activation ordering, lost acknowledgements, source deletion versus copy withdrawal, exact reviewed copy adoption, and strict transport DTOs.
- Real separate SQLite Agent + R2 suite covers private-owner namespace denial, concurrent publication retry, receipt validation, persisted artifact-row deletion, original upload cleanup and shared access revocation. The LedgerRoom in this package's test is an explicit synthetic authority, so root must additionally run its real LedgerRoom acceptance/ACL/replay/backup tests.
- Actual React browser proof covers compact/full/hidden return, persistent scoped drafts, exact provider approval, refreshed context, repeated saves retaining identity, interrupted publication, source deletion/withdrawal, seven widths and three themes, keyboard and dark/enlarged text. Synthetic network fixtures do not substitute for authenticated cross-device proof.
- Existing Workspace UI, contracts and trust regressions are included. No hosted deployment, provider request, live calendar action, financial write or native distribution was performed.

Register `test/hearthside-workspace.test.ts`, `test/hearthside-workspace-runtime.test.ts`, and `test/hearthside-workspace-browser.test.ts` in the high-risk focus map; retain Workspace contract/trust/UI, App startup, Chapters, Hearthside contracts/journeys, grants/action authority and restore regressions.

Measured local result: 51 tests across 9 focused files passed in 11.40 seconds before the final source-rebase/withdrawal refinements. The final six browser tests then passed in 7.56 seconds. The final post-refinement six-browser-test plus real-runtime run passed 7 tests in 5.83 seconds. Narrow TypeScript checks passed; the last focused compile also passed. The final real-runtime rerun, including concurrent exact project creation, passed in 1.23 seconds.
