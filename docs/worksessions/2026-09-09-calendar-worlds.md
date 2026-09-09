# Calendar: the days ahead in three worlds

Jonathan resumed Calendar after approving Home and merging the execution instructions in #414. Other page work remains paused. Current base: origin/main `1b6b8ee4fab533a51e316c1b95aa1a506deab71c`; branch `codex/worlds-calendar`. Deliver one Calendar PR, not a merge/deployment.

Risk: Medium-High (presentation around calendar instruments and financial review entry points). Budget delta (5): retain date selection, heat, scheduled/posted distinctions and readable day detail. Engagement delta (3): scene identity throughout the scroll, separately composed for phones and desktop.

## Composition and user decisions

Jonathan answered the design questions before implementation: one consistent illustration per scene; the approved simplified couple clip art belongs in the Cape Spear title; integrate Appointments and Bills as themed objects. His supplied collages, photos and subsequent less-detailed clip-art correction override the preliminary scene notes.

- Classic: a calendar hanging on the kitchen wall; Month is a planner on a table. Warm ivory sheets, rings, plants and a coffee/coaster detail; restrained linen margins.
- Red Shared: cream paper, red guitar and lipstick, heart glasses, bold condensed black/red shirt-style lettering. These original motifs follow the supplied fan collage and consulted official Red packaging; no copied photographs or lyrics.
- Midnights Personal: lighter moonstone blue, silver, lavender and ivory with warm amber accents, a marbled record, disco ball and small clock. Reading surfaces stay light.
- Rainy St. John's Shared: hotel shipping-yard reference, blue cranes, cute blue/rust/yellow corrugated containers, raincoat yellow, soft fog and puddles. Playful daylight rather than a dark harbour.
- Cape Spear Personal: pale fog, sun, sea, rocks, coastal plants and lighthouse; approved flat clip-art couple in the title card. Outfits and affectionate leaning pose follow the private reference. No originals published.

Desktop has individually observed scenery panels through the scroll and wider margins. Phone retains compact scenery and section ornaments with roomier dates. Named bracelets and scene light remain in the desktop title.

## Scope and invariants

Calendar, Month, Appointments, Bills, selected-day details, upcoming list, month tools, repeating/appointment forms, Google integration and invoking review sheets. Existing routes and scope keys remain unchanged. No new financial writer, preference/schema, hosted write or private asset publication. Do not reset selected month/day or drafts on theme changes. Preserve native hidden states and financial heat meaning.

## Validation plan

Actual App synthetic local books; normal/empty/long at 320,390,719,720,1100,1440,1920. Full-page and nested-state evidence, phone/desktop accessibility, enlarged text, long amounts, date keyboard navigation, month range, forms and cancellation. Delay/reject local lazy chunk for loading/error proof. Focused Calendar tests plus required gate/build. Bounded independent read-only surface/reference/review audit; one writer. Browser coverage is separate from physical devices and authenticated cross-device proof.

## Final verification and corrections

Implemented all four Calendar panes and their presentation: wall calendar, Month planner, appointment cards/forms and pinned bills/repeating forms. All five scene illustrations (Classic in both scopes) use original clip-art motifs. Midnights reading surfaces are lighter; the approved generated couple uses a white sticker backing to preserve its colours. The artwork asset is 21 KB WebP. No private reference photograph or video is tracked.

Iteration corrected: opaque outer Calendar surface hiding scenery; insufficient Midnights muted-text contrast; missing appointment cadence label associations; tall/narrow artwork distortion at tablet widths; couple/pause overlap; narrow title copy caused by a percentage inside a grid lane; shared all-button minimum height overriding taller dates. Independent read-only source review found no financial blockers; the final screenshot review found no remaining concrete visual blockers.

Final actual-App Chrome evidence uses synthetic completed-books data with all hosted requests blocked:

- Normal, empty and long states: 3 themes × 2 scopes × 7 widths (320,390,719,720,1100,1440,1920) = 126 viewport cases. No horizontal overflow or axe violations in the desktop/mobile checks. 200% CSS zoom checks passed.
- Minimum date width at 320px: 44.28125px. Date heights: 88px below720,112px at720+. Day and Month keyboard selection passed.
- Expanded day/upcoming, Month/day list, Appointments, add-visit draft, medical log, Bills and repeating draft checked in all six theme/scope combinations. Drafts were edited and exited without saving/posting. Long labels and amounts were exercised. Appointments leave Add via Upcoming; repeating drafts use Cancel. Empty/long runs also checked all four main panes. Normal nested captures preceded the last title/grid sizing polish; final normal/empty/long geometry and normal full-scroll captures include that polish.
- Calendar chunk delayed/rejected locally: loading/error and Reload recovery passed in all six combinations at390/1440. Expected injected module errors are labelled in the evidence JSON.
- Browser-tested persistent atmosphere pause across reload, reduced motion, focused-entry quieting and an independently suspended offscreen scenery panel. Charm hit testing, keyboard activation and visible focus passed. Decorative separation also reviewed in source.
- Focused quick gate: **173 tests passed** (86 fast,87 serial), TypeScript, AI-surface and diff checks;103.689s, no final time-budget breach. Includes actual bill draft node/value/focus and selected Calendar date preservation through every theme preview, with zero financial callbacks; required App startup and month-rehearsal contracts passed.
- Production build passed: TypeScript,636 transformed modules, Vite (5.86s), Hercules Pro UI. Existing large-chunk warning remains; no exhaustive test lane was invoked.

The initial concurrent gate/build/browser run exceeded the soft budget and hit App hook timeouts under resource load. It was stopped, then the complete final quick gate and build were run separately and passed. The initial run is not counted as passing evidence.

### Exact commands

Runtime prefix for these commands: `PATH=/Users/jonathanbeaulne/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH`. Workdir is the named Calendar worktree.

```sh
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never test -- --risk=medium-high --focus=test/calendar-weight-ui.test.ts --focus=test/calendar-weight.test.ts --focus=test/calendar.test.ts --focus=test/calendar-boards.test.ts --focus=test/appointments.test.ts --focus=test/page-worlds.test.ts --focus=test/app-startup-p1.test.ts --focus=test/month-rehearsal-mainline.test.ts --focus-reason='Calendar themes preserve actual focused drafts, dates, projections, appointment flow and App continuity'
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never build
HEARTH_WORLD_PAGE=calendar node scripts/check-page-worlds.mjs
HEARTH_WORLD_PAGE=calendar HEARTH_WORLD_STATE=empty node scripts/check-page-worlds.mjs
HEARTH_WORLD_PAGE=calendar HEARTH_WORLD_STATE=long node scripts/check-page-worlds.mjs
node scripts/check-calendar-loading.mjs
```

Final sizing recaptures used `HEARTH_SKIP_NESTED=1` and `HEARTH_ARTIFACTS_DIR=.artifacts/page-worlds/calendar-final-{normal,empty,long}`. Final full-scroll presentation capture used `HEARTH_WIDTHS=390,1440` and output folder `calendar-presentation`. `scripts/page-world-contact-sheet.mjs` accepts the same artifact-directory override and `--desktop` / `--full-mobile`.

### Review evidence

[Combined machine-readable receipts](../ux/page-worlds/calendar-evidence.json) · [Desktop](../ux/page-worlds/calendar-desktop.png) · [Full mobile scroll](../ux/page-worlds/calendar-mobile-full.png) · [Empty](../ux/page-worlds/calendar-empty-desktop.png) · [Long content](../ux/page-worlds/calendar-long-desktop.png) · [Month](../ux/page-worlds/calendar-month.webp) · [Appointment drafts](../ux/page-worlds/calendar-appointment-draft.webp) · [Repeating drafts](../ux/page-worlds/calendar-bill-draft.webp) · [Loading error](../ux/page-worlds/calendar-error.webp).

Fixed navigation can appear midway through a browser full-page screenshot; live viewport and control checks were performed separately. Contact sheets summarize actual App captures, not specimens.

### Remaining acceptance limits

Physical phones/tablets, Safari/VoiceOver, native text enlargement, real Google Calendar OAuth/sync and authenticated two-device flows were not exercised. No live financial write, schema, merge or deployment was performed. Full video motion was not reviewed; shipping-yard stills informed original illustrations. Home preservation is supported by scoped source review and the existing App/theme tests, not a new pixel comparison. Asset choice is complete for this Calendar PR; private originals remain unpublished.

Jonathan owns review and release authorization. See [durable handoff](../briefs/CALENDAR_THEME_HANDOFF.md). PR and implementation commit are recorded below after publication.
