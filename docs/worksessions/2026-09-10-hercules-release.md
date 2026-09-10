# Hercules companion — authorized Development release

Status: release verification in progress. Owner: Jonathan; integrator: Codex; risk: High. Jonathan explicitly requested “push merge and deply” after the slice-6 limitations were reported. This authorizes this Development release, including its presentation switches; it does not authorize Production activation, schema application, secrets changes or household mutations.

## Candidate and household outcome

Repository `jonathanbeaulne123-blip/dual-ai-budget-app`, branch `codex/hercules-integration-acceptance`. All six companion slices were local at candidate `181ecdd75e20decb9f54aaea470ce5d30343dbcc`. Current main `3870c102c789b3d7b3cf3b15685c095a7752d9a7` (Books #418 and potential Calendar expenses #419) merged cleanly as `064432c40911157816213e8637f3a0665e725b26` before release repairs.

Budget (5): preserve exact Confirm, CAD integer cents, private member scope, compatible envelopes and acknowledged saves. Engagement (3): useful discovery, continuous personality/preferences and the complete personal dressing room in Classic, Taylor and Newfoundland.

## Release repairs and independent review

- Explicitly enable chat, discovery and dressing room in the Development workflow. The prior workflow would have silently omitted the complete room and personal worn appearance.
- Add independent chat/discovery presentation switches; retain all profile/gallery schema shaping, actor validation, command capability checks and old-writer rejection when any switch is off.
- Chat-off hides composers, conversational reply chips and the Continue conversation action, and guards both provider entry and conversation enqueue. Memory controls remain available for deliberate review/forget. Discovery and dressing remain independent. Disabled-surface regression also exercises Play and asserts zero automatic network/private writes.
- Reconcile Calendar source navigation with main's potential-expense Move editor. Explicit Move clears old source focus. Source effects defer to a current editor and only a new source triggers navigation; cancelling does not replay a stale bill source.
- Independent Books/privacy and integration reviewers inspected the cumulative six-slice diff and merged main paths. No new schema requirement was found; existing Personal JSON storage accepts the fields. Existing provider activation/classification remains unchanged under D-184. No real household or provider request is used for release testing.

## Compatible deployment and rollback

The existing Cloudflare Workers workflow builds and deploys Worker plus assets together to `hearth-books`, the Development kitchen at `https://hearth-books.jonathan-beaulne123.workers.dev`. New clients require companion capability advertisement before writing; old clients against populated profiles receive a refresh-required rejection rather than dropping fields. Retain the new compatible Worker/DO, private shaping and command validators for every presentation rollback.

Three public build settings are independently selectable as `0` or `1`: `VITE_HERCULES_CHAT`, `VITE_HERCULES_DISCOVERY`, `VITE_HERCULES_DRESSING_ROOM`. Push/PR builds default all three to `1`; configured repository variables can override. Manual workflow dispatch provides `hercules_chat`, `hercules_discovery`, `hercules_wardrobe` choices. To disable a surface, dispatch the same compatible release ref with that choice `0`, keeping the others `1`. This is a new compatible build, never a pre-companion server rollback. An immediate UI failure, private disclosure or false acknowledged save warrants disabling the affected surface and investigating; no data cleanup accompanies rollback. Wardrobe-off keeps its compatible saved state while using the pre-room presentation. Production continuity remains `0`.

## Verification and acceptance

Exact command for the current cumulative High quick gate, from this worktree with the configured Node runtime:

```sh
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never check:quick -- --base=3870c102c789b3d7b3cf3b15685c095a7752d9a7 --risk=high --focus=test/potential-expenses.test.ts --focus=test/hercules-calendar-integration.test.ts --focus=test/hercules-private-chat-ui.test.ts --focus=test/hercules-companion-continuity.test.ts --focus=test/hercules-wardrobe-continuity.test.ts --focus=test/ledger-import-parity.test.ts --focus=test/month-rehearsal-mainline.test.ts --focus-reason="Cumulative companion release, main Calendar integration, compatible private writes and independent presentation rollback"
```

The source, test, asset and documentation diff contains no tracked local household export, private chat, credential or environment-secret file. Generated browser/test reports remain in ignored `.artifacts/`. GitHub receives source and synthetic test fixtures; live smoke uses a fresh synthetic demo and blocks model/household mutation endpoints. Full/exhaustive verification is not requested or claimed.

Previous slice-6 evidence remains in its worksession: 327 selected tests passed serial recovery, 72 browser cases and the build passed; the concurrent local gate failed on host timeouts. This release must obtain fresh gate/CI evidence on the reconciled candidate and verify the deployed build. Do not rewrite prior failures as passes.

Bianca's six actual trials, live Gemini scoring, owner likeness/full compatible garment-pose review, physical phone/Safari/VoiceOver and authenticated two-device acceptance remain open. Jonathan's Development release authorization does not supply those results. [Trial packet](../briefs/HERCULES_BIANCA_ACCEPTANCE.md).
