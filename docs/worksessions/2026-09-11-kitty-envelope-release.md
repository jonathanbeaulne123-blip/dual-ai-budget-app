# Kitty Banks — authorized Development release

- Decision owner: Jonathan. Explicit instruction: “push merge and deploy”, 2026-09-11, after the implementation and its limits were reported.
- Risk: Release. Budget (5): conserved backing, exact partial-use receipts and scoped confirmation recovery. Engagement (3): interactive bank rooms integrated with guided Plan, Calendar meanings and readable Hercules.
- Original implementation: `34da731b7540701843f4c8f741b35b811a310ff7`.
- Refreshed main: `c060fe72cb4223ac9f7f7ccaf0e5075031763a1a` (#438–441).
- Integrated source candidate: `128c649be549d4b663011bfed6e42c4e25b285ab` on `codex/kitty-envelope-app-20260911`.
- Scope: push, PR, merge and existing `hearth-books` Development Worker+assets deployment, followed by live evidence. No Production activation, schema, secret, provider-setting or real-household mutation.
- The explicit release instruction supersedes the review skill's generic review-only stop and the implementation receipt's earlier local-only boundary. It does not request the guarded exhaustive gate.

## Integration and compatibility

Merged current main's guided Hercules Plan (#439/#440), Quick sample story (#438) and category splitting (#441). PlanStudio retains the quieter overview, private guide, exact proposal/accepted-version review and settings disclosures, alongside the independent bank portal and original Plan state on return. The fictional proof runner retains guided-chat scope/receipts and the Calendar route. Independent read-only integration and compatibility reviews found no blockers at `128c649`; neither substitutes for tests.

No new hosted schema or Durable Object migration. New clients require `goalEnvelopeVersion:1` from the authority before envelope writes; compatible authority rejects old writers when the operation or accepted data requires it. Worker and assets ship together in the existing workflow. Cached clients should reload.

**Compatible rollback is mandatory:** after a new command is queued or accepted, retain the reader, receipt and command validators. A pre-Kitty Worker can reinterpret `keepOpen` and must not be used as rollback. Revert presentation only while preserving compatible authority. Prior deployed Worker `42770c75-1752-4287-8a99-f1f44e3b0fa3` is a pre-release reference, not an approved rollback for new data.

## Evidence and retained limits

[Implementation evidence](2026-09-11-kitty-envelope-implementation.md) includes the build, 81 startup checks, focused serial recovery, six theme/scope rooms, 42 geometry cases, keyboard/recovery, Calendar semantics and Hercules contrast. Its original concurrent quick-gate failure remains historical evidence.

Release validation is running against the integrated source candidate. A direct runner invocation was refused because the gate must run through pnpm; reran through bundled pnpm. High-risk focus includes envelopes, goal funding, Plan projection, guided Plan and Month rehearsal. Logs are in the parent workspace's `.codex-artifacts/kitty-room/release-quick-gate-pnpm.log`. Diff, AI surface and TypeScript passed; tests continue. GitHub PR/main checks and deployment receipts are required before claiming live success.

No complete YNAB replacement or exhaustive certification is claimed. General account-independent assignment, arbitrary reallocation, credit-card envelopes, automatic refill execution, authored memories and bank-specific Hercules return drafts remain outside the implemented authority. Physical-device/VoiceOver, authenticated two-device, live provider and comparative product acceptance remain open.

## Release receipt

Pending: PR number, final merge SHA, checks, Worker deployment/version, exact live asset verification and final release classification. These will be recorded with the PR and task delivery once observed. Next owner: Codex to finish the authorized release; Jonathan retains product acceptance.
