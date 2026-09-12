# Hearth worksession — Hercules audit and capability expansion

- **Status:** OPEN
- **Opened:** 2026-09-12 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex, integrating Claude's supplied journey audit and repairs
- **Branch:** `codex/hercules-audit-expansion`
- **Baseline SHA:** `1686ccc4a569c99b5a2d92ae8b311b83873e211d`
- **Risk:** High
- **Environment impact:** none; local implementation and verification

## Household outcome

Hercules can retain an intention while answering questions, explain current work facts, discover the actions actually available in the current books, and complete reviewed job and task workflows.

## Budget delta (5)

Keep unknown take-home distinct from accepted earnings. Resolve scoped action inputs from current authoritative facts and retain separate reviews, confirmation identities and receipts.

## Engagement delta (3)

Remove swallowed questions, lost pause state and overlapping conversations. Make useful actions discoverable and support follow-through beyond their creation.

## Verified baseline

Claude supplied a patch and three audit documents against `a0d76e99`. His bundle ends at `2c7601e`; current main is `1686ccc4`. The source patch applies cleanly, but historical live observations and test results are not current validation. Raw interview documents remain local-only. Computer control cannot click the open Claude app, so no new interview message was delivered.

## Scope

Integrate and correct Claude's Kitty Bank, take-home and navigation repairs. Repair private conversation lifecycle, scoped action discovery, job setup, modern task lifecycle and current shift answers. Preserve existing adapters, grants, free-provider quotas and Final Confirm. No hosted data, schema, secret or deployment changes are included.

## Acceptance evidence

- [ ] Questions and pause survive an active guided draft and reload without losing work.
- [ ] Workspace and compact conversation have one visible owner; failed authentication terminates loading.
- [ ] Dynamic action inputs and choices agree with execution scope and exclude private records of other members.
- [ ] Job setup and shift posting remain separate reviewed actions; unknown take-home is explicit.
- [ ] Modern to-dos can be edited, completed, reopened and removed while legacy drafts remain compatible.
- [ ] Kitty Banks retain optional dates and create no money or backing.
- [ ] Focused High gate, build and relevant theme/width checks recorded here; live evidence reported separately.

## Evidence log

At start, `git status` was clean at the baseline before applying the nine source/test files from Claude's patch. Audit claim reproduction identified routing fallthrough, absent pause persistence, action catalogue divergence, missing job adapter and modern/legacy task mismatch. Parallel agents use separate worktrees for conversation and tool-contract changes.

## Remaining uncertainty

Claude's older activation failure is not evidence that current flags are disabled. Live model, signed-in continuity, physical devices and October Production readiness require distinct evidence. No new release is implied by this worksession.
