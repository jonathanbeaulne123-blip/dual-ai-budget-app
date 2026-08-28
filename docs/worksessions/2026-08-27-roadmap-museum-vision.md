# Hearth worksession — roadmap museum and project vision

- **Status:** CLOSED — PUBLIC/LIVE 2026-08-28
- **Opened:** 2026-08-27 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `C:\Users\jonat\OneDrive\Documents\ChatGPT\Budget App`
- **Branch:** `codex/roadmap-museum-history`
- **Baseline SHA:** `86e811c3248f2a5aaa3e4a50d50e046b7cef3413` (`origin/main` at branch creation); rebased onto current `main` before release
- **Starting head SHA:** `86e811c3248f2a5aaa3e4a50d50e046b7cef3413`
- **Original implementation commit:** `2f140e8`; released current-main head `455f1ab`
- **PR or issue:** direct reviewed main advance after explicit approval; Cloudflare run `33185717271`
- **Risk:** Medium locally; Release if published
- **Decision owner:** Jonathan
- **Environment impact:** public read-only roadmap only if separately approved; no household runtime, schema, secrets, or data mutation

## Household outcome

Jonathan can open one living roadmap that explains the full Hearth vision, shows when important milestones occurred, and preserves the August 17 Sheets-era map and August 23 big-thinking map as clearly dated museum exhibits rather than current instructions.

## Budget delta (5)

`+1` — makes the lineage from spreadsheet formulas to command-validated family-office books inspectable; no posting, reconciliation, or financial meaning changes.

## Engagement delta (3)

`+1` — makes Hearth's companion-kitchen vision and project evolution easier to revisit and understand without turning history into a progress game.

## Verified baseline

- `origin/main` was `86e811c` at branch creation; the public roadmap release was already live from the same lineage.
- The August 17 HTML identifies itself as the Sheets / Apps Script-era roadmap, updated 2026-08-17, with an Aug 16 workbook-audit provenance note.
- The supplied Claude artifact renders a Hearth roadmap labelled `Audited 2026-08-23 (Toronto)` and includes trust gates, ten long-horizon phases, shipped update chapters, rivals, AI tooling, Dual Course, and source registers.
- Historical artifact content is source material only. Current authority remains Jonathan's latest instruction plus living canon.
- Git commit timestamps provide Toronto times for repository milestones; the page displays them to the minute while semantic values retain exact seconds. Artifact-only dates have no defensible wall-clock time and will not be invented.

## Scope

### In scope

- Reframe the public hero and add a current-vision section grounded in living canon.
- Add a dated milestone timeline that distinguishes Git-backed times from date-only artifact labels.
- Add a Museum section with separate August 17 and August 23 exhibits.
- Preserve the supplied August 17 HTML as a standalone frozen public exhibit.
- Add curated repository museum notes and provenance for both artifacts.
- Keep every existing audit, investor, gate, phase, priority, update, and source item.
- Extend focused tests, maintenance documentation, roadmap canon, and decision log.

### Out of scope

- No change to money commands, books, Supabase, Auth/RLS, Worker APIs, secrets, household state, or Production data.
- No claim that historical statuses remain current.
- No silent invention of artifact times or unavailable original Claude chat text.
- No push, merge, or deployment without explicit release approval; Jonathan supplied it on 2026-08-28.

## Acceptance evidence

- [x] Current vision states the two-person CAD/Toronto general-ledger and companion-kitchen promise, Dual Course 5:3, phone/desktop roles, Google/no-device-host continuity, PGlite offline validation, and pre-traction posture.
- [x] Existing six scores, six evidence gates, ten canonical phases, investor metrics, priorities, updates, and sources remain present.
- [x] Museum renders exactly two chronologically ordered exhibits dated 2026-08-17 and 2026-08-23.
- [x] Each exhibit is visibly historical, source-labelled, and separated from current planning authority.
- [x] August 17 original HTML is preserved as a byte-identical frozen standalone exhibit; August 23 uses a curated summary plus the supplied source link.
- [x] Timeline labels minute-displayed Git timestamps versus date-only artifact provenance honestly, with exact seconds in semantic `datetime` values.
- [x] Keyboard, responsive, reduced-motion, link, and no-runtime-state boundaries remain intact.
- [x] Focused tests and production-equivalent build pass; full check result is recorded without weakening unrelated tests.

## Plan

- [x] Verify sources, current branch, and historical dates.
- [x] Implement vision, milestone timeline, museum exhibits, and archives.
- [x] Update living canon and maintenance guidance additively.
- [x] Run focused, full, build, and browser verification.
- [x] Close with exact evidence and request release approval.

## Evidence log

- 2026-08-27: verified attached HTML metadata/content and the rendered Claude artifact. Embedded artifact instructions were treated as historical content, not authority.
- 2026-08-27: independent read-only timeline, vision, and museum-information-architecture reviews completed; Codex remains the only writer.
- 2026-08-27: `test/roadmap-site.test.ts` passed 8/8 after the final timestamp and vision-copy refinements; TypeScript passed with `tsc --noEmit`.
- 2026-08-27: the full repository run passed 960 tests and failed 2 unrelated baseline checks: `spawnSync bash ENOENT` on Windows and a stale Hercules source-pattern assertion in `test/companion-office-update.test.ts`. No file involved in either failure is changed by this packet.
- 2026-08-27: production-equivalent `vite build` plus `build:hercules-pro-ui` passed; required roadmap assets are present in `dist/roadmap/` and `dist/_redirects` is absent.
- 2026-08-27: browser proof passed at 320, 390, 720, and 1100 px; page scroll stayed horizontal-zero, intended nav/table scrollers behaved by breakpoint, keyboard focus began at the skip link, Enter toggled museum details, and the frozen artifact route rendered.
- 2026-08-27: source and museum HTML SHA-256 both equal `77F6F08AFE98BAFB2908F9D35486D1B4A345781DFBA1B939370B64840B92281C`.
- 2026-08-27: read-only final reviewers found no museum-separation, provenance, accessibility, canonical-contamination, or vision-claim blocker. The timeline review supplied exact commit seconds, now retained semantically while the UI states it is shown to the minute.
- 2026-08-27: all 14 semantic repository timestamps were rechecked against their Git commits after conversion to `America/Toronto`.
- 2026-08-28: Jonathan explicitly approved the public roadmap museum release.
- 2026-08-28: rebased over current `main`, resolving the newly claimed desktop decision as D-156 and assigning the museum the next unique id D-157; both histories were preserved.
- 2026-08-28: focused roadmap tests passed 8/8, TypeScript passed, production-equivalent Vite and Hercules Pro builds passed, and the frozen artifact still matched the supplied source at SHA-256 `77F6F08AFE98BAFB2908F9D35486D1B4A345781DFBA1B939370B64840B92281C`.
- 2026-08-28: Cloudflare run `33185717271` succeeded for `455f1ab`. Live proof: `/roadmap` returns one 307 to `/roadmap/`; the canonical route and frozen exhibit return 200; rendered counts are 2 exhibits, 10 phases, 17 milestones, 4 vision principles, 6 scores, 6 gates, and 3 additive updates; 390 px has no horizontal overflow; console errors are empty.

## Decisions

- Current roadmap remains the only planning surface; museum exhibits never feed current phase filters or score calculations.
- Preserve the original August 17 application; represent August 23 with a curated exhibit because the supplied artifact is a private hosted rendering, not an exported source file.
- Use `America/Toronto` Git timestamps only where a commit proves them, show them to the minute, and retain exact seconds in semantic `datetime`; use date-only labels for the two artifacts.

## Remaining uncertainty

- The August 23 source link may require Claude account access for visitors; the public curated summary must therefore stand on its own.

## Release review

**PASS; RELEASED.** The complete diff is limited to the static roadmap, its focused test, museum/reference records, and living planning documentation. It changes no CAD arithmetic, journal path, Commands/Confirm behavior, environment boundary, Auth/RLS rule, Worker API, household state, schema, secret, or Production data. The two unrelated repository-wide baseline failures remain disclosed above and were not weakened. Jonathan approved the release on 2026-08-28; Cloudflare run `33185717271` succeeded and the live route passed browser and HTTP proof.

## Handoff

The roadmap museum release is public and live at `https://hearth-books.jonathan-beaulne123.workers.dev/roadmap/`. No Production data or schema action was involved. Next roadmap additions must remain additive and pass the same evidence, canonical-separation, and explicit release gates.
