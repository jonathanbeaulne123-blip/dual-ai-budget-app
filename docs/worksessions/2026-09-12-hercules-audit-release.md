# Hercules audit expansion — authorized Development release

- Status: IN PROGRESS
- Owner and release decision: Jonathan. Integrator: Codex.
- Authorization: Jonathan explicitly requested “Push merge and deploy” after the implementation and remaining live/physical limits were reported.
- Risk: Release. Budget (5): current scoped evidence and retained Final Confirm. Engagement (3): useful job/task workflows, durable questions and one visible conversation.
- Branch: `codex/hercules-audit-expansion`.
- Reviewed local candidate: `42e18ac`; tested implementation `5fe8f1558f29945bcdfe84828271b85f8bcf45aa`.
- Current-main integration: `49dbaf727d7715b50cad4ad5c7a54978851d9bc0` (Nesting Eggs #466). Preserve its compatible nest writers/readers and optional King setup.

## Scope and release path

Push one PR, run GitHub CI and document-container verification, merge the verified head, then confirm the main Cloudflare Workers workflow and deployed version. This serves the existing `hearth-books` Development pilot with Production continuity disabled. No schema, credentials, quota/billing settings, Production activation, household writes or Google writes are part of this release.

The prior local-only boundary in the [implementation worksession](2026-09-12-hercules-audit-expansion.md) is superseded only for this explicitly authorized release. Its 472-test gate, 13 local runtime cases and 96 browser cases remain pre-integration evidence. Recheck affected App, nest, onboarding, accounting, privacy and recovery paths after integrating main. No exhaustive suite is authorized.

## Integration and verification

The merge preserves both handoff entries. In Hercules it preserves main's King room and this branch's hidden-conversation protection on the setup surface. Source-level independent review and the focused High gate will be recorded with exact SHAs and timing. Public live checks must not mutate books or private projects.

## Compatibility and limits

New workspace reads require a fresh immutable grant; an older run pauses and Resume renews permission. Existing receipt identities and financial validators are retained. Do not roll back to a version predating the already-released nest capability. If rollback is required, use the verified preceding main deployment or disable new workspace execution while preserving records and receipt recovery; never restore older financial state.

Live Gemini dialogue quality/cost comparison, authenticated two-device continuity, the older invited-member-label finding, physical phone/keyboard/VoiceOver and October Production readiness remain separate acceptance evidence. Jonathan authorized the scoped Development release with these limits already reported.

## Release receipts

Pending PR, exact-head CI, merge SHA, deployment version and live public smoke.
