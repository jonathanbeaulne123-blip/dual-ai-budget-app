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

The merge preserves both handoff entries. In Hercules it preserves main's King room and this branch's hidden-conversation protection on the setup surface. Independent review found no integration blockers: direct task authority replay passed in both scopes with existing nest designs, private names stayed outside Shared, and the nest capability is supplied correctly.

The clean integrated gate at `cfb497ff6b755ff232b50a7e231c71b8e23ae383` failed in 118.642 seconds (no budget breach): all assertions passed, but an App post-success timer fired after unmount. Both post-success feedback timers now belong to effects that cancel on unmount. A focused real App acceptance/unmount regression passes. The corrected exact head must pass the complete selected gate before merge. Public live checks must not mutate books or private projects.

The corrected `0907f546efa9c55ee077f076b1b0af16aeb0b2dc` passed the focused High gate: 499 tests across 45 files, clean tree, 89.839 seconds, no budget breach. All 24 actual App handoff cases passed across three themes, both scopes and 320/390/720/1440 widths. Independent review also passed the timer correction.

PR review identified an additional P2: the side-question heuristic rejected valid text answers such as “Do laundry” and “Will Smith tickets.” It now requires question punctuation or a clear question phrase. All 20 action UI tests pass, including four bare-title cases and side questions without punctuation. This review correction also requires a fresh exact-head gate and CI before merge.

## Compatibility and limits

New workspace reads require a fresh immutable grant; an older run pauses and Resume renews permission. Existing receipt identities and financial validators are retained. Do not roll back to a version predating the already-released nest capability. If rollback is required, use the verified preceding main deployment or disable new workspace execution while preserving records and receipt recovery; never restore older financial state.

Live Gemini dialogue quality/cost comparison, authenticated two-device continuity, the older invited-member-label finding, physical phone/keyboard/VoiceOver and October Production readiness remain separate acceptance evidence. Jonathan authorized the scoped Development release with these limits already reported.

## Release receipts

[PR #467](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/467) is pushed. The initial integrated head passed GitHub's confirmed-action and Cloudflare document-container/build jobs. GitHub automatic security review was unavailable due to its usage limit; independent local authority/privacy reviews are recorded in the implementation evidence. Corrected exact-head gates, browser checks and final merge/deployment receipts are recorded in the PR release evidence.
