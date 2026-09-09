# Calendar refinement handoff

Calendar now uses a roomy wall calendar and table planner, with original clip-art scenery throughout the scroll. Classic, Red/Midnights, and rainy St. John's/Cape Spear cover Shared and Personal scopes together. Jonathan approved the simplified couple illustration before integration.

Base: `origin/main` at `1b6b8ee4fab533a51e316c1b95aa1a506deab71c`; branch `codex/worlds-calendar`. Delivery is one Calendar PR. Home remains the accepted reference; other page implementation, merge and deployment are outside this handoff.

Risk Medium-High. Budget delta (5): roomier date targets and clearer scheduled/posted reading, with existing financial paths preserved. Engagement delta (3): recognizable scene motifs, full-scroll desktop margins, scene-coloured bracelets and an approved personal clip-art detail.

The scene map, scope key, date/month selection, callbacks, money heat, due review, appointment and repeating entry semantics are unchanged. CalendarBinding and CalendarArtwork are decorative; one implementation of each financial component remains. Shared appointment cadence labels now bind to their existing controls following actual-page accessibility findings. No preference schema, API or migration was added.

Implementation is in `src/theme/CalendarArtwork.tsx`, `src/theme/page-calendar.css`, the existing Calendar/heading mounts and Midnights palette. The new image is `public/theme-art/calendar-cape-couple.webp`. Private reference photographs/videos are not included. Reference provenance and user decisions are recorded in `docs/PAGE_WORLD_REFINEMENT.md` and the Calendar worksession.

Verification commands and results, corrections, exact evidence, known acceptance gaps and the final PR link are recorded in [the worksession](../worksessions/2026-09-09-calendar-worlds.md). Independent reviewers are the read-only page-surface and visual-reference agents; Codex remains the sole writer. Local browser evidence uses synthetic completed-books fixtures and blocks hosted requests. Physical devices, Safari, real Google Calendar OAuth and authenticated cross-device financial flows remain separate acceptance work.

Next owner: Jonathan for review of the published PR. Follow the page-theme execution standard for requested revisions. Release requires a separate explicit instruction.
