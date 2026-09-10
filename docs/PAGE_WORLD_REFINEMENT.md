# Living pages: implementation contract

Execution instructions: [Page-theme execution standard](briefs/PAGE_THEME_EXECUTION_STANDARD.md). Jonathan approved the finished Home after #413 and requires the same level of finish for subsequent page PRs.

The original program proposed eight page-specific PRs on 2026-09-09: Home → Plan → Calendar → Books → Till → Shift → More → Entry. Every PR includes Classic, Taylor and Newfoundland plus applicable Shared/Personal scenes. No merge, deployment, schema or hosted household mutation is authorized.

Jonathan subsequently paused the remaining seven pages to revise desktop Home after PR #412. Mobile Home is the accepted baseline. Jonathan subsequently resumed Calendar after #414 and approved its clip-art direction. Calendar was merged and deployed in #415. Jonathan subsequently resumed Plan, approved the two-column desktop workshop and cannon clip-art direction, and authorized PR publication. Plan was merged and deployed in #416. Jonathan then resumed More, approved its theme-only scope and sauna-chair illustration, and authorized PR publication. More was merged and deployed in #417. Jonathan then resumed Books, clarified Shared and Personal Books only (not a separate Fund redesign), approved Merchant Tavern/scallops instead of Personal Battery and the reputation/TTPD references, and authorized publication. Till, Shift and Entry remain paused.

## Desktop Home revision

At 720px and wider, large original scenery panels continue the title character through the scroll: orange feather boas and steady theatre lights, pink/lilac/blue cloud banks, clapboard street margins and harbour cottages with water. Reading instruments retain solid surfaces; desktop gutters make room for the illustrations. Classic retains its restrained paper office. Each visible scenery panel observes its own viewport presence, with persistent pause, reduced motion and focused-entry quieting.

Desktop titles show the named bracelets with a scene-coloured light bracelet in all themes. Phone bracelet placement stays unchanged. The Home rehearsal entry is hidden only on desktop; the existing More entry and its financial handlers remain intact. The desktop weather surface is shorter, readable and still cycles through forecast/minimized/restored states, with a 44px minimized control.

## Whole-page composition

Funds and goals receive visual emphasis without changing available-money meanings, urgent facts, mobile Fold selection or financial controls. Scenery continues through margins and materials. Small native-button charms have keyboard access; all atmosphere obeys pause, focused entry, reduced motion and individual offscreen observation. Decorative geometry never maps to money/progress.

Home's only scrapbook mount follows the entire Office including Notes. Three manually browsable spreads have buttons and live page announcements. Bianca chooses photographs later. Current art is visibly labelled illustration; no uploader, real photos or fabricated ticket. The rose-pink sequin swatch is an original material interpretation of the supplied dress. The distinct concert LED bracelet follows each era, independently of the named friendship bracelets.

## Reference provenance

Exact UI shades and artwork are original interpretations, not official brand specifications. Official references are consulted, not redistributed:

| Era | Reference | Interpretation |
|---|---|---|
| Lover | https://tserasarchive.taylorswift.com/lover | Pink/blue sky, lilac, glitter hearts, flowing lettering |
| Showgirl | https://store.taylorswift.com/products/the-life-of-a-showgirl-sweat-and-vanilla-perfume-portofino-orange-glitter-vinyl and https://store.taylorswift.com/products/the-life-of-a-showgirl-mint-t-shirt | Saturated orange/gold glitter and mint; crystal/feather/light details are authored interpretations |
| Fearless | https://tserasarchive.taylorswift.com/fearlesstv | Honey, sepia, gold and flowing lines |
| Debut | https://tserasarchive.taylorswift.com/selftitled | Blue-green botanical curls and butterflies |
| Red | https://tserasarchive.taylorswift.com/redtv | Deep red, camel, ivory and warm autumn paper |
| Midnights | https://store.taylorswift.com/products/midnights-cd | Moonstone/marbled blue, navy and restrained amber light |
| reputation | https://tserasarchive.taylorswift.com/reputation | Black/ivory print collage and serpent detail |
| TTPD | https://tserasarchive.taylorswift.com/ttpd | Bone, warm gray, manuscript and archival materials |
| 1989 | https://store.taylorswift.com/products/1989-taylors-version-vinyl | Crystal-sky blue, gulls and airy photo framing |
| Speak Now | https://tserasarchive.taylorswift.com/speaknowtv | Orchid/plum, flowing fabric and marbling |
| evermore | https://tserasarchive.taylorswift.com/evermore | Ochre/rust, woodland and wool checks |
| folklore | https://tserasarchive.taylorswift.com/folklore | Fog gray, parchment and fine woodland silhouettes |

Jellybean Row uses Jonathan's four supplied photographs as private reference: raspberry, navy, yellow and turquoise clapboard houses; white trim, narrow doors, planters, mailboxes and receding street. Originals and recognizable people are not published. Quidi Vidi retains its cottage/harbour setting. Classic extends the existing coffee/plant motif.

## Verification and delivery

Each page's worksession records exact gates and browser receipts. Local actual-App screenshots use synthetic completed-books data, not private ledgers. Chrome, Safari and physical-device evidence remain separately identified. Theme previews must preserve draft nodes, scope and authoritative financial values. Stacked PR bases isolate each page's diff; inherited foundation changes are named rather than re-counted as that page's implementation.

## Calendar refinement

Calendar is a wall-calendar composition; Month is a table planner. Appointments use rounded appointment cards and Bills pinned paper. The date grid is taller, with scene-specific binding ornaments and persistent date selection. Desktop outer containers reveal the full-scroll art while reading cards remain solid. The title retains the named bracelets and scene light; Cape Spear adds the user-approved couple clip art.

Additional Calendar reference provenance:

- Red: [official Red archive](https://tserasarchive.taylorswift.com/redtv), [official red vinyl packaging](https://store.taylorswift.com/products/red-taylors-version-red-vinyl), supplied Red collage, and [Pinterest fan collage](https://www.pinterest.com/pin/red-taylorswift-in-2025--792141021994209477/). Guitar, lipstick, heart glasses and condensed statement-shirt lettering are original interpretations; no copied lyrics or fan artwork.
- Midnights: [official CD packaging](https://store.taylorswift.com/products/midnights-cd), supplied collage, and [Pinterest mood board](https://www.pinterest.com/pin/taylorswift-midnight-aesthetic-music-taylor-taylorswiftalbum--683139837242811709/). Lighter blue/lavender/silver, vinyl, clock and disco-ball shapes are authored interpretations. Pinterest image results were visible; direct board access was limited.
- Newfoundland: private Cape Spear photographs and shipping-yard video stills inform the illustrations. Full video motion was not reviewed. Originals remain outside the repository.
- `public/theme-art/calendar-cape-couple.webp`: generated with OpenAI image generation from the supplied couple reference, then redrawn with simple faces, chunky outlines and minimal detail. Jonathan explicitly approved the simplified result before integration. Optimized to WebP for a small title illustration; the original photograph is not distributed. The other Calendar artwork is original SVG in `src/theme/CalendarArtwork.tsx`.

Exact implementation and validation: [Calendar worksession](worksessions/2026-09-09-calendar-worlds.md).

## Plan refinement

Desktop (1100px+) uses a wider Categories column and a right column with Kitty Banks above Sit-down. Below1100px the existing single-column order remains Categories → Sit-down → Kitty Banks. CSS changes placement without remounting the financial components; keyboard traversal retains that semantic order. Budgeted net is labelled accurately, visible Actual / Budget labels clarify the pairs, budget edit/remove targets are44px, and closing the editor returns focus.

Classic uses pinned cream sheets, coffee and trailing plants; Fearless uses gold concert-scrapbook fringe/lights, silver guitar, boots and restrained storybook paper; Debut uses blue-green/denim water washes, guitar, daisies and butterflies. Newfoundland follows the supplied Signal Hill sunny coast/summit references with one harbour opening and lower water, rock, plant and gull details. The original generated cannon sticker belongs to the summit title only. Individual panels observe visibility; global pause, reduced motion and focused-entry quieting apply.

[Worksession and provenance](worksessions/2026-09-09-plan-worlds.md) · [Plan handoff](briefs/PLAN_THEME_HANDOFF.md). Private reference photographs, vision-board collages and original video are not shipped. No financial APIs, migrations, routing, identity or Confirm authority changed.

## More — theme composition (2026-09-09)

More keeps its existing section order, navigation, drafts and handlers. Jonathan deferred information architecture to a later implementation. Classic uses household shelves, coffee, books and trailing plants. Shared Taylor uses evermore plaid, warm parchment, cameras and autumn leaves; Personal uses folklore woodland, cream/moss and small lilac cabinet/envelope accents. Shared JAG uses crimson/silver stripes; Personal JAG uses cobalt/gold geometry and framed musical keepsakes. Both use the approved tall red-chair couple in sauna robes, with generic faces and long curly hair.

Desktop has continuing wall/material backgrounds and six individually observed scenery panels; phone has quieter materials and section edges. The existing named title bracelets and light are retained. All added art is noninteractive except the separately named 44px keepsake charm. Original scene SVGs contain no financial state. Shared dialogs inherit scene tokens.

[More worksession and provenance](worksessions/2026-09-09-more-worlds.md). Private photos and reference boards are not published. The generated chair is an ivory-backed illustrated print; the generator did not provide usable alpha, so no false transparency claim is made.

## Books — 2026-09-10

Shared and Personal Books retain their existing layout, navigation and financial flows. Classic gains bound paper, coffee and plants; Shared Taylor has newspaper margins, blackletter, gold and red snakes; Personal Taylor uses the supplied warm monochrome swatch with manuscript, pressed flower, moth, coffee and candle details. Newfoundland retains the working harbour for Shared and replaces Personal Battery with Merchant Tavern: framed coastal art, walnut/linen materials, blue glass and scallops.

The scene heading has independently composed phone art and desktop bracelets. A continuous illustrated desktop setting stays beside the reading sheet as it scrolls; individually observed light, steam and water details remain localized. A small embossed divider closes the current pane. Solid reading sheets protect disclosures and amounts. Existing nested Fund/account/audit/import surfaces inherit the invoking palette. Account labels are associated with their inputs after an actual expanded-form accessibility finding; command handlers are unchanged.

The first simple-vector Books treatment was rejected by Jonathan. Jonathan then approved the immersive atmosphere but requested consistency with Home’s cartoon feel. Approved Merchant and reputation previews establish the final rendering, with more metallic snakes as the specific exception. The final replacement uses five detailed original cartoon environments in `public/art/books/`, with responsive presentation and small SVG/CSS atmosphere details in `src/theme/BooksArtwork.tsx`. See [asset provenance and prompts](briefs/BOOKS_ART_PROVENANCE.md). No supplied reference images or photos are published. UnifrakturMaguntia is bundled unmodified from Google Fonts under the included SIL OFL, used only for decorative newspaper/title lettering. Official references and test evidence: [Books worksession](worksessions/2026-09-10-books-worlds.md).
