# Hearth worksession — Hercules finalized implementation plan

- **Status:** Planning complete; implementation not started
- **Opened:** 2026-09-10 (`America/Toronto`)
- **Owner / decision owner:** Jonathan
- **Assignee:** Codex; one independent read-only Codex trust reviewer
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/hercules-living-companion-plan`
- **Baseline / HEAD:** `2e113f69d03872eddc22ac461378a0f3e33f6c55`
- **PR:** none; baseline includes #417
- **Risk:** Low documentation; future implementation High
- **Environment impact:** none; local documentation only

## Household outcome

Finalize the agreed affectionate-diva Hercules, quietly useful guidance, automatic helpful preferences, and full 3D closet based on the existing in-app character. Personal looks travel across devices within a household; sharing publishes an explicit copy. Cover Classic, Taylor and Newfoundland.

## Dual Course

- **Budget (5):** grounded capability discovery and clearer completion of existing financial tasks, with unchanged Final Confirm authority.
- **Engagement (3):** character continuity, expressive dress-up, 36 new pieces across six collections, twelve reactions and a shared look gallery.

## Scope and result

Created [the final implementation packet](../briefs/HERCULES_LIVING_COMPANION_PLAN.md), covering defaults, technical seams, migration/ownership, first catalogue, delivery sequence, test commands, product trials and release boundaries. No app code, dependencies, hosted data, provider settings, schema, secrets, deployment or memory files changed.

## Verified baseline and evidence

- `git -C dual-ai-budget-app-main-deploy ls-remote origin refs/heads/main` returned `2e113f69d03872eddc22ac461378a0f3e33f6c55`.
- GitHub `compare_commits` from `e0dfadc20ba640d9a2bf9e200f7a4296e4c6de4d` to that SHA showed two commits, mainly the More page refinement. Earlier Hercules code findings remain applicable; current More must be preserved.
- `git -C dual-ai-budget-app-main-deploy fetch origin main` updated the local remote reference. Created a separate worktree at the exact SHA; original checkout had unrelated dirty changes and was not edited.
- Read current AGENTS, AI operating model/risk routing, cloud continuity, relevant canon excerpts, page-theme standard, local skill instructions, and relevant chat/help/wardrobe/projection source.
- Python parsed GLB JSON chunks at the verified baseline. Source: 7,464,180 bytes; Pro: 2,797,232 bytes. Each has 788 meshes, 4,458 nodes, no skins and no animations. Both match the previously inspected local copies byte-for-byte.
- Source SHA-256: `4d669d8c3d9255ded4f52644f078fb6ee7f5a0c9649d2d2a5dae89039c62fde4`; Pro SHA-256: `ce467ef9956c842808bb126650d844e3e9ecdb11bbaccbd047c94306340d3887`.
- Consulted official Google generation and Three.js animation/loader documentation; links are included in the packet. No model/data calls were made to Gemini.
- Independent read-only reviewer identified shared kitchen persistence, missing actor binding in legacy chat operations, PersonalEnvelope extension/allowlist requirements, household-scoped continuity, and truthful cloud acknowledgements. Incorporated these into the packet before completion.
- A second bounded review of the written packet requested five material clarifications: authenticated actor binding, the retained read-only legacy archive, offline chat/memory receipts, resource-level revisions, and server-before-client compatibility. All five were incorporated. There is no unresolved privacy architecture choice for the household-scoped plan.
- Claude was not invoked. The packet limits future Claude use to one optional character/scene review and one correction follow-up if necessary.
- Documentation validation passed: Python checked UTF-8 reading, final newlines, trailing whitespace and balanced code fences for both files; `git diff --check` passed. `git status --short` listed only the two new documentation files. Application tests and builds were intentionally not run for this documentation-only task.

## Acceptance and limits

This is a reviewed plan, not implemented or released functionality. No test suite/build was run because application code did not change. Documentation validation and final independent review are recorded below. User-reported onboarding success is acknowledged but is not a replacement for unrelated outstanding device or end-to-end certification.

The biggest implementation work is asset production and fitted animation, plus private companion persistence. Existing GLBs do not prove dress-up readiness. Real-user provider gates, authenticated cross-device behaviour, Safari/physical-phone performance and product trials require implementation and separately authorized release/test execution.

## Next owner

Codex implements the packet when requested, starting with member-owned contracts and ownership proof. Keep one writer per checkout; use bounded independent reviews. Recheck fresh main before implementation. This branch has local documentation only; nothing pushed, merged or deployed.
