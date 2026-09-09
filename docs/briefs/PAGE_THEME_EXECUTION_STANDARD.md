# Hearth page-theme execution standard

## Authority and approved reference

Jonathan approved the finished Home on 2026-09-09 and asked for instructions that reproduce this level of finish for every remaining page PR. This document is an instruction to Codex and any collaborating implementation agent. Follow it with AGENTS.md and Jonathan's latest direction.

The accepted reference is Home after PRs [#412](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/412) and [#413](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/413), merged at `02237de42bc91ee002411cc7f8303729741fc8ab`. Mobile was accepted before #413; #413 brought desktop to the same level of finish. Its Development deployment was verified. This is a quality reference, not permission to revert newer code to that commit.

Inspect the actual accepted Home and [desktop evidence](../ux/page-worlds/home-desktop.png), [mobile evidence](../ux/page-worlds/home.png) and [implementation contract](../PAGE_WORLD_REFINEMENT.md). Reproduce its care, composition and interaction quality. Give each page its own appropriate artwork and materials. Do not copy Home's feathers, houses or clouds into unrelated scenes.

Writing these instructions does not restart paused page implementation. When page work is resumed, apply this standard to every page PR. A merge/deployment instruction for one PR does not automatically release future PRs.

## Outcome and boundaries

Make every page feel like a complete, inhabited place from its title to its last functional section. It must remain a dependable household ledger.

- Budget delta (weight 5): keep money, availability, urgency, goals and actions legible and truthful; preserve the existing financial workflows.
- Engagement delta (weight 3): make each theme recognizable throughout the page through authored scenery, materials, personal details and gentle motion.
- Cover Classic, Taylor and Newfoundland together, including both applicable ledger scopes and the nested interactions opened by that page.
- Keep one implementation of financial components. Presentation must not introduce financial APIs, preference schemas, database migrations or alternate posting paths.
- Preserve identity, selected ledger, routes, navigation, drafts, focus, confirmations, available-money distinctions, offline/error handling and Final Confirm.
- Use original decorative assets. Supplied personal photos are references, not permission to publish them. Label illustrative placeholders. Bianca chooses real scrapbook photos later. No fictional ticket or revived ticket requirement.

## Page scope and scene map

One coherent PR per page; shared foundations are introduced by the earliest page needing them. Start from verified current origin/main, or an explicitly named predecessor branch if it remains unmerged. Keep stacked diffs limited to the current page.

| Page | Classic | Taylor Shared / Personal | Newfoundland Shared / Personal |
|---|---|---|---|
| Home — accepted reference | Kitchen table | Lover / Showgirl | Jellybean Row / Quidi Vidi |
| Plan | Planning pinboard, tabs, botanicals | Fearless / Debut | Coastal Signal Hill approach / windswept summit |
| Calendar | Household wall calendar, seasonal paper | Red / Midnights | Rainy St. John's / Cape Spear morning |
| Books | Bound ledger, ruled paper, brass | reputation / TTPD | Working harbour / Battery hillside |
| Till | Ceramic, wood, counter paper | 1989 / Showgirl | Water Street / Quidi Vidi |
| Shift | Workday notebook, kitchen clock | Speak Now / Speak Now | George Street after dusk / same |
| More | Shelves, labelled drawers, collected objects | evermore / folklore | JAG lobby / music corner |
| Entry and onboarding | Welcoming kitchen table | Existing Lover / Showgirl mapping | Existing Jellybean Row / Quidi Vidi mapping |

Retain existing route/scene assignments, scope availability and contextual entry points. Do not make hidden destinations permanent navigation items merely to expose their artwork.

## Before writing code

1. Verify checkout, clean/dirty scope, current base/head and PR state. Preserve unrelated work. A historical checkout is reference only.
2. Read the target page's components, theme rules and opened dialogs. Inventory normal, loading, empty, error, long-content and expanded states. Identify sticky/fixed controls and urgent notices.
3. Capture the actual current page in all applicable themes/scopes, on phone and desktop. Inspect the full scroll, not only the first viewport or a theme specimen.
4. For each Taylor scene, verify official album artwork and rollout graphics before implementing it. Record the source links and distinguish observed references from original interpretation. No generic concert aesthetic or unrequested music-video setting.
5. Write a short composition note per scene: palette, reading material, distinguishing motifs, title treatment, upper/middle/lower scenery, motion and desktop/phone differences. Use project judgment for routine design choices; do not reopen already settled preferences.
6. Record risk, deltas, acceptance evidence and scope in a worksession. Use bounded independent read-only review with one writer per checkout.

## Composition rules learned from Home

### Phone is its own composition

Use the approved Home phone density as the benchmark: enough material and detail to feel personal, with a clear reading order and comfortable controls. Keep illustrations out of narrow reading lanes. Give section transitions intentional detail. Do not squeeze the desktop illustration down to fit a phone header.

When phone has been accepted, freeze its visual behavior while improving desktop. Isolate new desktop layers and layout rules at the appropriate breakpoint. Verify both sides of that breakpoint. Do not claim unchanged pixels without a pixel comparison; report the regression checks actually performed.

### Desktop must use its space deliberately

Design title, margins, gaps between sections, lower-page surfaces and the closing edge together. Give wide screens scenery at an appropriate scale. Extend the title's character through the entire scroll. Useful quiet space is welcome; broad stretches of anonymous flat background are not a finished composition.

Inspect every layer between art and the user. Home initially failed because opaque desk backgrounds hid the scenery, while tiny edge motifs could not carry the larger canvas. Clear only presentation surfaces that should reveal art; retain solid, readable financial cards and deliberate backing behind headings.

Use scenery, depth, natural light and restrained movement to connect sections. Avoid repeated hard-edged illustration strips, visible cutoffs, motifs behind unbacked text, or arbitrary decoration filling every gap. Check the result at full size, not only as a contact sheet.

Reduce oversized secondary bands when they crowd out the main purpose of the page. Preserve their functions and existing entry points. Home's rehearsal remains in More and its accepted phone placement; do not reintroduce the desktop Home block or blindly relocate other tools without assessing their function.

### Theme identity must survive below the title

- Classic: retain warmth and restraint through paper, wood, linen, plants, coffee and small household objects. Match the quieter approved office; more ornament is not inherently better.
- Taylor: use the current era's actual visual vocabulary throughout the page. Lover's cloud gradients and Showgirl's orange/mint, feathers and lights are examples of specific identity, not universal Taylor decorations.
- Newfoundland: preserve a sense of place through architecture, landscape, water, daylight and planted details. Carry the scene into margins and section transitions rather than repeating a single header illustration.
- Where a page has the shared scene title card, retain the approved desktop named-bracelet cluster and scene-coloured light across all themes; preserve the approved phone placement. Keep Jonathan and Bianca's bracelets distinct. Taylor's light follows the current era with a gentle transition and steady glow.
- Home's scrapbook remains at the bottom after Notes and functional content, with manual navigation. Do not duplicate it across pages unless their scope calls for one.

## Motion and interaction

Use localized cloud drift, water movement, feather/leaf motion, steam or a similarly scene-appropriate detail. Motion must feel gentle and purposeful, without flashing, auto-scrolling or autoplay galleries.

All new atmosphere must respect persistent pause, reduced motion, focused-entry quieting and individual offscreen suspension. Avoid animation-driven financial rerenders. Large decorative containers need individually observed animated panels, not only one observer for the entire page.

Decorative layers are hidden from assistive technology and cannot intercept pointer or keyboard controls. Intentional charms are separate native controls with accessible names, visible focus and at least 44px targets. They have no financial side effects.

Dialogs, drawers, forms, expanded cards, date pickers and other contextual surfaces inherit the invoking scene. Maintain contrast and focus through every state. Fix common presentation/accessibility defects in the earliest page that encounters them, without broadening the financial feature scope.

## Required iteration and evidence

Do not declare a page finished after one screenshot pass. Implement, inspect actual pages, identify concrete visual/interaction defects, correct them and recapture affected evidence. Once checks pass, repeat only for changed behavior or an unresolved concern.

For every applicable theme and scope:

1. Review at 320, 390, 720, 1100 and 1440px. Add 1920px for desktop composition and both sides of any changed breakpoint (Home used 719/720).
2. Capture top, middle, bottom and full-page evidence. Review sparse/empty and long/populated content, not just attractive fixtures. Include loading/error/expanded states and nested flows; explicitly identify any state not exercised.
3. Verify contrast, 44px interaction targets, keyboard navigation, visible/restored focus, enlarged text, large amounts, long labels, overflow and unobstructed controls. Check desktop accessibility as well as mobile; Home's phone-only axe pass missed desktop Fund tab ownership.
4. Exercise the actual primary task and each changed control, including open, edit, cancel/back, close and return-focus behavior. Theme/scope changes must preserve the appropriate draft and open-flow state. Do not perform real financial writes to prove decoration.
5. Verify pause, reduced motion, focused-entry quieting and offscreen behavior. Record which were browser-tested versus source-reviewed.
6. Use focused tests that prove affected behavior and repository-required checks. Respect the existing exhaustive-gate policy. Run production build checks. Record actual results, exact commands and timing breaches separately; a passing slow gate is not an under-budget pass.
7. Obtain an independent bounded review of the diff and real screenshots. Resolve concrete findings before publication. Keep one writer.
8. Store synthetic-data screenshots, evidence and asset provenance with the page PR. Do not publish private books or reference photos. Browser evidence is not physical-device, Safari or authenticated cross-device acceptance.

## Publication check

Before publishing, answer these questions with evidence:

- Can I recognize each scene from the middle or bottom without seeing its title?
- Does desktop intentionally use its larger canvas, while phone remains comfortable?
- Are funds, goals, amounts and the page's main task easier to read than the decoration?
- Does every opened surface belong to the same scene?
- Are sparse, long and expanded states as deliberate as the normal state?
- Are all three themes and both applicable scopes finished to the approved Home standard?
- Have I separated observed results from unverified coverage?

A recoloured page, polished title above a generic body, theme-specimen-only screenshot, successful build without visual review, or passing phone checks without desktop checks does not satisfy this standard. Correct identified shortcomings autonomously within the authorized scope; surface genuine missing inputs with a concrete explanation.

The PR leads with the user-visible result, includes screenshots and concise validation, and names remaining asset/acceptance limits. Record the actual base/head, dependency and PR link. If its predecessor merges, rebase against the updated base and verify the resulting diff. If the target PR merges while a revision is underway, use a clean follow-up PR instead of pushing changes to a closed review.

Publication is the default delivery target for the page program. When Jonathan separately authorizes merge and deployment, verify exact-head CI and mergeability, merge only the scoped work, confirm the deployment workflow, and inspect live served assets and a fresh browser. Keep Development deployment distinct from Production activation. Record that release result without implying all physical or authenticated flows were certified.
