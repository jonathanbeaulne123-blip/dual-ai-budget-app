# Claude review packet — onboarding audit small repairs

## Review target

- Repository: `jonathanbeaulne123-blip/dual-ai-budget-app`
- Pull request: [#360](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/360)
- Branch: `codex/onboarding-audit-small-repairs`
- Audited base: `origin/main@954c484d5f804d3e69436093df0277fb244baec7`
- Verified implementation commit: `79907a6206698d8a2eaae7c21a42993f5d282795`
- Risk: Medium
- Dual Course: Budget `+1` / Engagement `+2`

Treat this packet as a map, not authority. Read `AGENTS.md` and the canonical docs first, inspect the current PR diff, and verify claims from code.

## What Codex changed

1. **Finding 13 — honest guided-setup entry.** Codex did not add a second desktop surface. Source inspection showed that `d0c72e1` added both the read-only `GuidedSetupPreview` gallery and a separate App-mounted `OnboardingChat` invitation. After D-228 widened the onboarding offer, the invitation's enabled `Start together` action is the discoverable live entry; Hercules owns active chapters after the handshake. D-233 corrects the historical claim that the gallery itself made setup reachable.
2. **Finding 14 — named starter set.** Jonathan explicitly chose to retain the seven catalog category groups. Chapter 9 copy now describes curation: review the named starter set, keep fitting items, add missing categories, submit privately, then review the household union. No category row or plan data changed.
3. **Finding 15 — stale-seat render resilience.** `memberProgress` remains strict and continues to throw for unknown or inactive members at command/core boundaries. App and Hercules presentation paths now verify that the selected member is still active before calling member-owned onboarding selectors. Hercules also clears a stale Personal offer when its actor stops being active. A mounted regression covers both unknown and deactivated selected-member cases.
4. **Finding 16 — truthful API.** The unused `today` parameter was removed from `nextChapterFor` and the wrappers/call sites that merely forwarded it. No chapter ordering behavior changed.
5. **Finding 17 — preview accessibility.** Preview chapter buttons now include the chapter title in their accessible name. The permanently disabled sample action no longer points `aria-describedby` at help text that cannot be reached, and preview controls have a 44 px minimum height.

## Decisions to challenge deliberately

- Is the existing standalone invitation sufficiently discoverable at desktop widths, or is there concrete code/browser evidence that it can be hidden while onboarding is offered? Do not propose a second surface merely because the preview is inert.
- Do all render-time calls that can receive a stale selected member now degrade without weakening strict identity validation for commands?
- Does dropping `today` reveal any genuinely time-sensitive behavior or public contract that the patch missed?
- Does the Chapter 9 copy accurately match the current category union/confirmation implementation without promising writes that do not occur?
- Are preview accessible names useful and non-duplicative, and are all visible controls at least 44 px at the tested widths?

## Evidence already collected

- Pre-fix throwaway mounted reproduction: deactivating the selected Hercules member threw `Choose an active household member.` during render.
- Focused preflight: 96/96 assertions.
- Medium quick gate: 195/195 assertions across 14 files, 184.647 seconds, fingerprint `e9f7227171b23681df82af3b73e4419e98649793fba13f86b41ecc35154035e6`.
- D-183 startup lane was included: all 26 `test/app-startup-p1.test.ts` assertions passed.
- `test/month-rehearsal-mainline.test.ts`: 1/1.
- `pnpm exec tsc --noEmit`, `pnpm build`, and `pnpm ai:verify`: passed. The host has no `npx`, so the equivalent repository-resolved TypeScript command was used.
- Actual-component headless Chromium at 320, 390, 720, and 1100 px with reduced motion: no horizontal overflow, minimum visible control height 44 px, one `Start together`, 12 titled chapter buttons, no sample `aria-describedby`, zero scoped axe WCAG A/AA violations, and zero console/page errors.
- Existing PGlite browser-externalization/eval and large-chunk build messages remained non-failing warnings.

Detailed evidence is in [`worksessions/2026-09-06-onboarding-audit-small-repairs.md`](worksessions/2026-09-06-onboarding-audit-small-repairs.md). The governing decision is D-233 in [`DECISIONS.md`](DECISIONS.md), and the release handoff is at the top of [`AI_HANDOFF.md`](AI_HANDOFF.md).

## Boundaries and deliberate exclusions

- No money writer, journal or budget formula, account, transaction, category row, active plan, migration/schema, hosted row, Auth/RLS rule, provider/model call, secret, or Production setting/data changed.
- No new desktop onboarding surface was added.
- No starter categories were removed or renamed.
- No weakening of `memberProgress` or command identity checks was intended.
- Browser evidence is local synthetic component evidence, not authenticated two-device or household-data proof.
- Merge and Development deployment are authorized only after the exact PR head passes required checks. Production remains untouched.

## Paste-ready Claude prompt

```text
You are independently reviewing PR #360 in jonathanbeaulne123-blip/dual-ai-budget-app (Hearth):
https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/360

Read AGENTS.md first and treat it as law. Then read docs/README.md, docs/AI_HANDOFF.md, docs/DECISIONS.md, docs/ARCHITECTURE.md, docs/CLOUD_CONTINUITY.md, and docs/CLAUDE_ONBOARDING_AUDIT_SMALL_REPAIRS_REVIEW.md. Treat the review packet as a map rather than authority. Inspect the exact current PR head and current origin/main; do not trust summaries, including Codex's.

This is a review-only assignment. Do not edit code, push, merge, deploy, mutate household data, or touch Development/Production Workers. Review the complete PR diff for correctness, regressions, accessibility, test authority, and adherence to Hearth's financial/identity boundaries. Reproduce any concern before reporting it.

Concentrate on five decisions:
1. Whether the existing App-mounted Start together invitation is a genuinely discoverable guided-setup entry after D-228, without adding a duplicate desktop surface.
2. Whether Chapter 9's rewritten copy accurately frames curation of the retained named starter category set.
3. Whether unknown/deactivated selected members can still crash any render path, and whether the guards preserve strict command/core identity validation.
4. Whether removing the unused today parameter from nextChapterFor and its wrappers missed any date-sensitive contract or caller.
5. Whether GuidedSetupPreview chapter names, description semantics, minimum target size, responsive behavior, and reduced-motion behavior are correct.

Verify the claimed tests and inspect whether they can fail for the repaired behavior. Check for untested call sites and stale-member state transitions. Assign each actionable finding P0-P3, cite exact file and line, explain the failure path and smallest safe fix, and distinguish new regressions from pre-existing issues. If there are no actionable findings, say that plainly and list residual uncertainty. End with a release recommendation for the exact reviewed head: APPROVE, CONDITIONAL, or BLOCK, plus the reason. State the Medium risk and both Dual Course deltas (Budget +1, Engagement +2). Do not treat quick-gate evidence as exhaustive or release proof.
```
