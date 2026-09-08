# Three complete visual worlds

Authority: Jonathan’s approved implementation plan, 2026-09-08. This supersedes earlier single-theme, fixed-palette and no-dark-surface restrictions. It does not supersede identity, privacy, financial meanings, navigation behavior, or Final Confirm. The 2026-09-08 mobile integration instruction explicitly defers real memorabilia and authorises fictional placeholders. Full original-asset completion remains a later follow-up; it does not block the mobile integration.

## Scene direction

Classic Hearth remains a consistent, warmer kitchen-table design: cream paper, brown ink, pine, terracotta, selective berry and honey, Figtree and Fraunces. Plan has pinboard details, Books ledger details, Calendar family-calendar details. Paper layers, pressed controls, readable amounts and welcoming empty states belong throughout.

Taylor’s Scrapbook shares mounted keepsakes, stitching, handwritten accents, paper edges and beads. Every destination has its own era and composition. Newfoundland uses original place-inspired illustrations, tactile surfaces and individually authored atmospheres. The executable scene map and exact palettes live in `src/theme/scenes.ts`.

| Scope | Destination | Taylor | Newfoundland |
|---|---|---|---|
| Shared | Home | Lover | Jellybean Row |
| Shared | Calendar | Red | Rainy downtown St. John’s |
| Shared | Plan | Fearless | Two-plus-hour coastal approach to Signal Hill |
| Shared | Books | reputation | St. John’s harbour |
| Shared | More | evermore | JAG lobby |
| Shared | Till | 1989 | Water Street shop counter |
| Personal | Home | The Life of a Showgirl | Quidi Vidi coastal kitchen |
| Personal | Calendar | Midnights | Cape Spear |
| Personal | Shift | Speak Now | George Street after dusk |
| Personal | Books | The Tortured Poets Department | The Battery |
| Personal | Plan | Debut | Signal Hill summit |
| Personal | More | folklore | JAG music corner |

Nested surfaces inherit their current destination. Fund remains within Home’s scene throughout. Shared Shift uses Speak Now/George Street if reached through an existing action. Books and Till remain behind their existing entry points. No artificial navigation destinations. Authored lighting is part of each scene; there is no separate light/dark preference.

## Components and assets

One implementation of each financial widget serves every theme. Scene wrappers and artwork compose around existing components. Theme changes update context and root attributes; they do not key/remount App, forms, imports or dialogs. Root provider also covers loading, entry and error fallback surfaces. Financial status colours and chart series remain separate from decoration; solid posted/dashed projected treatments remain unchanged.

Both Taylor Home compositions require separate JONATHAN and BIANCA bracelets. Actual bracelet photos determine bead colours, lettering, spacing and charms. Bianca’s dress supplies fabric/sparkle references; her ticket retains real commemorative details after identifiers/barcodes are removed. Additional concert photographs have authored placements. `src/theme/memorabilia.ts` tracks these required files. Missing photographs cannot be called complete. Originals stay outside the committed set; public derivatives have no sensitive metadata. No photo-management feature is introduced.

Newfoundland art is original and inspired by places. Only the coastal approach and JAG are explicitly described as personal experiences. Decorative trails do not claim an exact GPS route or financial progress. References: [official JAG interiors](https://jaghotel.ca/image-gallery/), [Newfoundland tourism](https://www.newfoundlandlabrador.com/trip-ideas/travel-stories/picture-perfect-on-the-avalon), and [official Showgirl merchandise](https://store.taylorswift.com/products/the-life-of-a-showgirl-mint-t-shirt). Reference photography is not licensed for redistribution by this plan.

Atmosphere includes moving ocean, rain, fog, light, sparkle and ribbon. Pause is persistent; reduced motion supplies a complete still composition. Hidden/offscreen layers idle, and focused entry/confirmation quiets decoration. Motion never intercepts input or changes financial values/status timing. Hercules keeps his Maine Coon figure and behavior; explicit wardrobe equipment overrides automatic accessories.

## Account preference

More → Appearance contains three preview cards and an explicit Use theme action. Leaving an uncommitted preview restores the saved choice. Classic is the default and invalid-preference fallback.

`AppearanceStore` scopes caches/pending intent to environment and authenticated user. `appearanceAccount` uses the existing session handler and Auth endpoint; it adds no Auth client, ledger command or database migration. Allowlisted metadata is stored under `hearth_appearance_v1_<environment>`. Field-level intent merges with fresh account metadata so a loading/cached default cannot overwrite an untouched preference. Unrelated metadata is omitted from updates. Rapid changes serialize; account/environment/session changes abort stale requests. Offline choices apply locally and retry for the same account. Last server-accepted selection is adopted on the next focus/reconnect/sign-in refresh.

Classic’s old board-only Home theme is now Desk finish. Its saved stock values, dimensions, positions and density remain intact. Authored Taylor/Newfoundland surfaces override stock visually.

## Required coverage and evidence

The [component coverage matrix](THREE_WORLDS_COVERAGE.md) tracks source treatment separately from fixtures, rendering, contrast and interaction proof.

- Entry, sign-in framing, memberships, invitations/QR, onboarding, Charter, rehearsal.
- Navigation, switches, FAB, notices; loading, empty, offline, error and recovery states.
- All Fund stages, drawers, account views, register, statements, reconciliation and close.
- Add, transfer, payment, Shift, camera/scan, imports, duplicate review, corrections, Undo, all Final Confirm variants.
- Calculator, wallet, mail, claims, timesheet, goals, notes, chalkboard, games, wardrobe and customization.
- Hercules figure accessories, chat, permissions, focus overlay, sources and companion chrome.
- Print and visual exports; machine-readable financial exports preserve their existing contract.
- Hearth containers around provider-owned Google/bank interfaces.

Verify every scene and representative nested states at 320, 390, 720, 1100 and 1440px. Require visible keyboard focus, 44px targets, contrast, zoom, long text, large amounts, reduced motion, no page overflow, no art over controls, and legible monochrome print. Chrome and Safari checks are separate from physical-phone evidence. Target at most 1 MB of additional phone above-the-fold art. Switching must not reload ledgers; animations must not drive financial React rerenders.

Codex’s development-only `?themeStudio` uses actual primitives and synthetic facts, with no Auth binding. Rendered reference specimens precede Claude production CSS. Claude receives an exact brief and returns scoped CSS plus coverage mapping. Codex verifies it against references and actual App structures. Reference gallery evidence alone is not complete App coverage or release proof.

Current baseline, changes, evidence, pending assets and next work are recorded in [the worksession](worksessions/2026-09-08-three-visual-worlds.md). Release requires a complete, reviewable candidate; merge and Development deployment remain a separate step.

## Standalone companion presentation

The Hercules Pro widget has its own document. On summon, its existing authorized server path reads the signed-in user's environment-namespaced cosmetic preference, allowlists the result, and sends only theme/atmosphere fields. The widget resolves its Shared or Personal Home palette locally and styles controls without recolouring Hercules or changing the rig, transparent canvas, picture-in-picture, permissions or financial tool behavior. Cosmetic read failure uses Classic. The UI resource advances to v6 to avoid stale cached styling.

The implementation follows the existing request path and the [Workers best-practices reference](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/); it adds no platform bindings or background refresh loop.

Wardrobe None takes precedence over automatic accessories. Optional account fields `hideThemeHat` and `hideThemeNeck` preserve that choice across devices. Wardrobe can restore them. These fields merge independently and never alter saved outfit items or ledger commands.


## Mobile integration amendment — 2026-09-08

Combine the finished mobile overhaul at bf33c87 with the theme candidate at14313c8 in the isolated theme branch. Main remains6fb15c7. Preserve the Fold priority order, chapter spreads, Ledge detents, Work instruments, source-aware readings and Final Confirm. Compact scene headings use a dedicated illustration pocket, full named bracelets and a44px atmosphere control. The Fold measures actual header/fixed-furniture space, admitting whole objects only. Conventional phone cards remain5px, controls3px, targets44px; texture and trim carry the visual world.

Jonathan explicitly authorised fictional placeholders pending memorabilia access. Original SVG ticket, concert illustration and dress sample are labelled and served from public/theme-art. The Home mount is below the Fold/instruments and never takes a financial priority slot. Awaiting-original manifest entries stay unresolved; no invented venue/date or claim these are actual photos. Prepared public derivatives will replace samples without a management feature. This amendment supersedes the earlier real-photos-before-any-integration restriction for the current mobile task.
