# Hearth worksession — The Journey of Life and the Our Story habitat

- **Status:** OPEN — local branch and patch; not pushed, not a PR, not merged, not deployed, not live verified
- **Opened:** 2026-09-16 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Claude (orchestrator) with three Opus sub-agents (renderer, page, habitat)
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `claude/journey-of-life` (squashed; built as `claude/our-story-habitat`)
- **Baseline SHA:** `6160fb03` (#495; built on `c8d92b1a` #494)
- **Head SHA:** see the branch / `journey-of-life.patch`
- **PR or issue:** none — deliverable is a patch + bundle
- **Risk:** High (a new synced row kind and capability flag; a performance change in `duplicate.ts`)
- **Decision owner:** Jonathan (D-268)
- **Environment impact:** Development only (the habitat is created on the device and, signed in, as a dedicated synthetic cloud household like the other habitats)

## Household outcome

One journey of life per household, cut into eras that float as islands around the current one. Plan future eras in as much or as little detail as wanted; they sit in fog until focused. Finishing the current era (e.g. "Get through our first year of moving in without going broke") lights every lantern on the gate; crossing needs both partners, builds the bridge and upgrades the home. A third Development habitat, **Habitat · our story**, shows it all: two fictional years, a stable salary and seasonal tips, fifteen Kitty Banks tied to the eras, nineteen bills, all six foundation Chapters, a storm, three trips, stones, a footpath, a plan bridge and waiting suggestions.

## Budget delta (5)

+1. The finish line is read from accepted books (the Fund and shared cash accounts at month end; Kitty Bank steps) and shown only as lanterns and words. No money meaning changed. `refreshDuplicateFlags` compares only rows within `SIMILARITY_WINDOW_DAYS` of each other — the same output (existing equivalence oracle), needed because twenty-five months of identical monthly bills made every commit quadratic.

## Engagement delta (3)

+3. The island becomes a journey with a past, a present and a foggy future the couple can plan together.

## Plan decisions taken (recommendations from the plan page, Jonathan to confirm)

1. "Without going broke" = the Fund and every shared chequing/savings account ended the month at or above zero.
2. Fresh ground each era: the main island grows from the current era's months; past eras keep theirs on their own islands.
3. A crossed era keeps its months, home and finish rule; its words and plans can change (both agree).
4. The household upgrade is the home at the island's centre (flat → furnished → house → porch), not the app theme.
5. Big future banks keep the loft's 1.5 size cap (no "someday shelf" yet).

## Scope

- Core: `src/core/pathWorld.ts` (era rows, `assertEraProposalFits`, `hasPathEraData`, `PATH_ERA_COMMAND_KINDS`), `src/core/pathEras.ts` (read-model, finish rules, commands), `src/core/pathSignals.ts` (era month window up to 120), `src/ledgerSync/{protocol,authority,client,registry}.ts`, `workers/ledgerRoom.ts` (`pathEraVersion`).
- Renderer: `src/path/world/pathWorld3d.ts` (era islands, fog, bridges, gate, home, Sky frame, safe area).
- Page: `src/path/OurPathWorld.tsx`, `src/path/eras.ts`, `src/path/EraPlanner.tsx`, `src/path/PathMiniMap.tsx`, CSS for three themes.
- Habitat: `src/core/habitatStory.ts`, `src/core/stressSeed.ts` (`months`, `tipSeasons`, `fixedBills`, `sampleGoals`; defaults unchanged), `src/core/demoSuite.ts`, `src/core/habitat.ts`, `src/core/types.ts`, `src/core/syntheticRuntime.ts` (`atSyntheticClock`), `src/core/duplicate.ts`, `src/App.tsx` (third habitat button; generation and verification in `src/demoSuite.worker.ts` via `src/demoSuiteOffThread.ts`).
- Proof: `scripts/serve-our-path-world-proof.mjs` (`?eras=demo`, `?story=story`), `scripts/capture-journey-of-life-page.mjs`, `scripts/capture-our-story.mjs`, `scripts/serve-queen-world-page-proof.mjs` (`?habitat=story`).
- Tests: `test/path-eras.test.ts`, `test/path-eras-ui.test.ts`, `test/path-era-islands.test.ts`, `test/habitat-story.test.ts`, one case appended to `test/our-path-world-ui.test.ts`.

## Known gaps

- Generating Our Story takes about 2.5 minutes in a browser worker (plus a replay to verify); the page stays responsive.
- Bank studio designs, board photos and older Sitdown records are not seeded (no command decorates a goal; photos need uploaded media; `saveSitDownSession` reads the real clock).
- Inviting Bianca into a generated habitat's existing seat has not been tried live.
- Past islands always use summer colours; plan silhouettes carry no text (names come from the page's buttons).

## Evidence log

See the handoff entry in `docs/AI_HANDOFF.md` for exact commands and results. Screenshots: `docs/evidence/journey-of-life/{islands,page,story}/`.
