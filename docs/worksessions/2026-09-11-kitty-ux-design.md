# Hearth worksession — Kitty Banks and readable themed UX

- **Status:** COMPLETE — revised design and PR integration handoff; app implementation remains separate
- **Opened:** 2026-09-11 (`America/Toronto`)
- **Owner / decision owner:** Jonathan
- **Assignees:** Codex, with Claude as design lead and an independent read-only code auditor
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/kitty-ux-design-20260911`
- **Baseline / HEAD:** `71ccc242bd44bed60ccc5eb8c8865ecd852f76c6`
- **PR:** none
- **Risk:** Medium design work; future money/lifecycle implementation is High
- **Environment impact:** none

## Household outcome

Make Calendar meanings readable, make Hercules comfortable to read in every scene, and redesign Kitty Banks around meaningful goals, funding evidence, timing and shared decisions. Deliver a concrete design and dependency-ordered build brief informed by the Future Vision document and actual current code.

## Budget delta (5)

Distinguish plan intent, promises, pool earmarks, backed contributions and spending. Preserve source references, accepted history, scope and Final Confirm. Identify structural gaps before creating a new presentation.

## Engagement delta (3)

Give goals a clear purpose and next step; preserve three authored visual worlds and distinct Personal/Household, phone/desktop experiences; make text and colour understandable without strain.

## Verified baseline

- Workspace root is a container, not a Git checkout. The historical main-deploy checkout is dirty and at `ca2ba53`; it was not edited.
- `git fetch origin main` resolved `origin/main` to `71ccc242bd44bed60ccc5eb8c8865ecd852f76c6`. Created this isolated worktree from it.
- Read current AGENTS, AI operating model, worksession/implementation-packet skills, page-theme execution standard, relevant canon and source.
- Connected Drive read succeeded for the supplied document and selected Hercules tab. Indexed all tabs, then read relevant Shared Future, Plan rebuild, ownership and decisions sections. Document text is design evidence, not execution authority; provisional ideas remain proposals.
- Independent audit found KittyBanks only mounted in the legacy Plan branch, unlinked PlanStudio goal lines, incomplete goal lifecycle, separate pool earmarks and cash contributions, and immutable references that prevent naive deletion.
- Current Plan V2 implementation exists. Its recorded release acceptance limits were read, not independently recertified.

## Scope

### In scope

- Current-code audit and competitor baseline from official YNAB pages.
- One compact Claude design consultation covering all three issues.
- Integrated design, source-linked implementation sequence, and a fictional interactive concept.

### Out of scope for this design deliverable

- App runtime changes, a replacement Plan engine, or changes to household records.
- Merge, deployment, schema application, credentials, Production or external messages to people.
- Claiming a concept is shipped or superior to YNAB without comparative task evidence.

## Acceptance evidence

- [x] Fresh named baseline and isolated worktree.
- [x] User image read and relevant vision text retrieved through Drive.
- [x] Current foundation independently inspected with source references.
- [x] Claude brief visibly submitted to the intended conversation.
- [x] Both Claude responses assessed against actual money semantics; unsupported accounting formulas and lifecycle suggestions rejected.
- [x] Integrated brief and fictional interactive concept completed.
- [x] File references and diff hygiene checked; no app test or visual certificate implied.

## Evidence log

- `git fetch origin main` — passed; baseline above.
- `git worktree add -b codex/kitty-ux-design-20260911 .../kitty-ux-design origin/main` — passed.
- Claude native app clipboard interaction failed and did not submit. A browser fallback succeeded; no duplicate conversation was submitted.
- Claude consultation: https://claude.ai/chat/06725790-8210-473f-9cdf-4b5ad3b62ec5 — two completed responses visibly read, configured Sonnet 5 Medium left unchanged. One design request and one bounded correction; no further model calls.
- Read-only auditor ran no tests and made no edits.
- Independent final brief review found that archive could free vault backing because current calculations reserve only openGoals. Added explicit preservation of archived reservations and prohibition on recreating released reservations during restore.
- `git diff --check` — passed. Documentation only in the worktree; no tests/build run because runtime behavior is unchanged.

## Decisions

- Preserve the Kitty Banks product name during design. Avoid treating a goal as a bank account or inventing custody.
- Keep Plan V2; reconnect goals to it. A future shell recommendation does not authorize rewriting current navigation globally.
- An X is a discoverable entrance to lifecycle review, not a command to erase history or move cash.

## Remaining uncertainty

Actual-page contrast has not been measured in this session. Source inspection identifies conflicting paint rules but cannot certify pixels. New goal lifecycle, per-goal earmark releases and linked actual progress require implementation and independent verification. Physical device, screen-reader and authenticated continuity proof remain open.

## Handoff

Local design work only. [Integrated design/build brief](../briefs/KITTY_BANKS_THEME_UX_REDESIGN_2026-09-11.md) records source evidence, Claude provenance, rejected suggestions, twelve-experience treatments and dependency-ordered implementation packets. Interactive fictional concept is in the task's visualization output directory, not shipped app code. Codex owns contract/integration work; Claude leads the authored UX within each bounded slice. Jonathan retains product and release decisions. No PR, merge, deployment, schema or household mutation occurred.

## Continuation — cinematic envelopes and the two Plan PRs

Jonathan clarified that #433 and #437 are separate complementary overhauls, that future-facing Plan types should use Kitty Banks as YNAB-style envelopes, and that Kitty Banks needs to feel like an entire interactive scene, with the quality of the Hercules dressing room.

- Fresh fetch: `origin/main` remains `71ccc242bd44bed60ccc5eb8c8865ecd852f76c6`; fetched review refs for PR #433 and #437.
- GitHub connector: #433 merged (head `d00e51f7afcfba317fdc7e4d79da7da89977e8ca`); #437 open (head `6d4afd464f6884c3ebbe823a02eac1efb451fb11`). No release was performed or newly authorized by a PR description.
- Read the candidate's Plan workbench, projection, source references, navigation and implementation notes. Independent read-only auditor confirmed #437 already fixes goal entry, goal linkage, goal actuals and shared projection; the initial missing-link/projection findings are superseded on its candidate.
- Read the dressing-room component and associated scene/interaction direction as a quality benchmark: selectable physical objects, immediate previews, accessible controls, mobile composition, fallback, reduced motion and focus restoration.
- One additional design-only Claude pass completed in the same conversation. Preserved the existing model setting and sent only a bounded product summary with synthetic examples. The revised brief records adopted ideas and rejected suggestions; no financial formula was delegated to Claude.
- Rechecked official YNAB account/category separation and targets. The revised foundation explicitly requires useful envelope assignment, carry-forward, partial use, refill and reallocation; it does not claim these already exist in the inspected Hearth candidate.
- Produced [Kitty Banks — a complete envelope app inside Hearth](../briefs/KITTY_BANKS_CINEMATIC_ENVELOPE_APP_2026-09-11.md), covering all seven Plan line kinds, six settings and phone/desktop composition, the room and its four internal destinations, six-moment journey, missing contracts, recovery and ordered integration packets.
- One built-in image-generation call produced a Classic Household scene study at `/Users/jonathanbeaulne/.codex/generated_images/01a091a6-95a5-7ac3-ba42-59f4e1aad65c/exec-5858d977-7012-401b-8545-6144a42a7941.png`. It is preview-only, not an app screenshot or an interactive prototype. Other world/device treatments are specified, not visually certified.
- Independent review of the revised brief found no blockers. Documentation only; no tests/build, app edits, schema, household writes, PR, merge or deployment.

The revised cinematic brief is the current handoff. The original concept remains an initial exploration and no longer defines the main Kitty Banks composition. Calendar semantic colours and Hercules readability remain in scope through the companion brief.
