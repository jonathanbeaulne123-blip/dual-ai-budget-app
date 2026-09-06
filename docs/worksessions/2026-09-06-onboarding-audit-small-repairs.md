# Hearth worksession — onboarding audit small repairs

- **Status:** PR #360 RELEASE CANDIDATE — checks pending
- **Opened:** 2026-09-06 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `codex/onboarding-audit-small-repairs`
- **Baseline SHA:** `954c484d5f804d3e69436093df0277fb244baec7`
- **Risk:** Medium
- **Environment impact:** Application code plus an authorized Development deployment after merge; no hosted household row or Production state

## Household outcome

Guided setup has one honest live entry through the existing standalone invitation and two-person handshake. New households retain Hearth's named category starter set, while Chapter 9 now asks each member to curate that set instead of implying it is blank or personally authored. A stale session whose member was removed no longer crashes Hercules's onboarding presentation. The Development gallery names every chapter for assistive technology and keeps even its disabled sample action visually touch-sized.

## Budget delta (5)

`+1`: retains strict member-scoped core selectors while preventing stale presentation state from taking down the household view. No financial fact, category row, plan formula, or write boundary changes.

## Engagement delta (3)

`+2`: clarifies where setup really starts, makes the starter-set decision honest, and makes the preview easier to scan and understand.

## Verified baseline

- Fresh branch from `origin/main@954c484d5f804d3e69436093df0277fb244baec7`.
- `git show d0c72e1` confirms that the disputed commit shipped two distinct surfaces: the read-only gallery and a standalone App-mounted `OnboardingChat` invitation. D-228 later widened the offer effect to households with existing books. The gallery is not an entry; the invitation's `Start together` action is.
- Before implementation, a throwaway mounted `HerculesPresence` test with the selected member deactivated passed only when it expected `Choose an active household member.` to throw. The throwaway was removed and replaced by permanent unknown/deactivated render regressions.
- `nextChapterFor` accepted `today`, immediately discarded it, and had no date-sensitive chapter rule.
- Jonathan chose to keep the named starter categories and reframe Chapter 9 as curation. No category row is removed or rewritten.

## Scope and decisions

- Do not add a second desktop onboarding surface. The visible standalone invitation is sufficient after D-228; the existing Hercules shell owns the active chapters after the handshake.
- Correct the commit trail through D-233: `d0c72e1`'s preview is useful copy-review tooling, not the reason setup is reachable.
- Keep `memberProgress` strict. App and Hercules verify the selected seat is still active before asking member-owned onboarding selectors to render.
- Remove the unused date parameter from `nextChapterFor`, `shouldShowOnboardingShell`, navigation/return wrappers, and every call site.
- Preserve the category catalogue and describe the actual Chapter 9 behavior: keep fitting starter choices, suggest missing categories, privately submit, then review the union.
- Put existing `ready.chapter.*` titles directly in each preview chapter button and remove the ineffective disabled-control description binding.
- The user's final line named Findings 13 and 18, but supplied Findings 13–17 only. Responsive evidence therefore covers the live entry in Finding 13 and the preview accessibility work in Finding 17.

## Browser evidence

An uncommitted Vite harness rendered the real `OnboardingChat` invitation and `GuidedSetupPreview`, then was removed. Headless Chromium used reduced motion and a light scheme.

| Width | Overflow | Minimum visible control | Entry | Chapter names | Errors | Axe A/AA |
| ---: | --- | ---: | --- | --- | --- | --- |
| 320 px | none (`320 = 320`) | 44 px high | one `Start together` | 12; named controls found | 0 | 0 |
| 390 px | none (`390 = 390`) | 44 px high | one `Start together` | 12; named controls found | 0 | 0 |
| 720 px | none (`720 = 720`) | 44 px high | one `Start together` | 12; named controls found | 0 | 0 |
| 1100 px | none (`1100 = 1100`) | 44 px high | one `Start together` | 12; named controls found | 0 | 0 |

At every width, `prefers-reduced-motion: reduce` matched, `Meet Hercules` and `Plan categories` were discoverable button names, the disabled sample action had no `aria-describedby`, and console/page error arrays were empty. The first pass found the sample action at 20 px; its preview-only CSS now gives it a 44 px minimum.

## Verification

- [x] Focused preflight: 96/96 across copy, categories, entry integration, progression, conductor, return, and unknown/inactive member rendering.
- [x] Actual-component Chromium at 320/390/720/1100 px, reduced motion, geometry, axe, console, and page errors.
- [x] Medium quick gate focused on entry/startup and onboarding presentation tests: 162 fast + 33 serial assertions, 14 files, 184.647 seconds, fingerprint `e9f7227171b23681df82af3b73e4419e98649793fba13f86b41ecc35154035e6`.
- [x] `test/month-rehearsal-mainline.test.ts`: 1/1.
- [x] `pnpm exec tsc --noEmit`; the requested `npx` spelling is unavailable on this bundled host.
- [x] `pnpm build`: 483 Vite modules plus Hercules Pro UI. Existing PGlite externalization/eval and chunk-size messages remain non-failing warnings.
- [x] `pnpm ai:verify`: 48 required files, two Clerk fences, docs-only MCP, bounded roles, guards, and proof gate.

## Deliberately left out

- No second Start button, desktop conductor, or chapter surface: the existing invitation and Hercules shell already form the live path.
- No category removal, rename, activation change, or plan mutation: Jonathan chose copy-level starter-set curation.
- No change to strict `memberProgress` behavior for invalid actors; only render callers degrade.
- No money writer, journal/budget formula, migration/schema, hosted row, Auth/RLS, provider/model call, secret, Production setting/data, or Worker implementation.

## Remaining uncertainty

- Browser proof is local synthetic component evidence, not authenticated two-device or hosted-live proof.
- The invitation and gallery were inspected together as actual components; the full app's existing local PGlite state was not mutated for this visual pass.
- Quick-gate evidence is not exhaustive or release evidence.

## Handoff

[PR #360](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/360) contains all five supplied repairs/decisions in one branch. Implementation commit `79907a6206698d8a2eaae7c21a42993f5d282795` is locally verified; this evidence/status closure follows on the same PR. Jonathan authorized merge and Development deployment on 2026-09-06. Codex's next action is to wait for the exact PR head's required checks, merge only if they pass without unresolved review blockers, and verify the resulting no-store Development bundle. Production remains untouched.

Claude's independent-review map and paste-ready prompt are in [`CLAUDE_ONBOARDING_AUDIT_SMALL_REPAIRS_REVIEW.md`](../CLAUDE_ONBOARDING_AUDIT_SMALL_REPAIRS_REVIEW.md).
