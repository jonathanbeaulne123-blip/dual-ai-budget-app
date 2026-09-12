# Hercules Play implementation and acceptance

## Local implementation

Branch `codex/hercules-play`, based on fetched `origin/main` at `02a5539dfc4dfadf6c7cae67b98f17db278c9eaa`. This branch implements Play presentation and continuity contracts. It does not deploy a worker, apply hosted schema, or activate Production.

Play adds a desktop entrance, Together entrance, and a prominent Status Centre entry on mobile. Current main uses Status Centre rather than the older More menu, so existing financial navigation is preserved. Existing fitting events open the dedicated dressing area. `VITE_HERCULES_PLAY=0` hides the new presentation; resources, decoders and capability protections remain in place.

The renderer reuses the existing Hercules rig, garment loading and animation contracts. It owns GPU objects and emits selection intents; it does not receive command dispatch or write money. The room shell has six authored cameras and theme-specific original procedural geometry. Semantic display positions retain their identity across three compositions and themes. The shared selection persists independently of the current member's chosen appearance.

Private fitting uses existing local draft, undo/redo, slot locks, colour browsing and outfit commands. Portrait settings are finite data on existing `LookV1`; gallery publication preserves its existing creator identity and snapshot semantics. PNG and contact-sheet exports contain the portrait only. Nested SVG clothing is preserved, portrait CSS is scoped, and each inline lighting gradient has a distinct ID.

The catalogue adds eighteen pieces to the original six collections, preserving the newer night, garden and snow collections. Three regenerated ordinary collections unrelated to this addition were restored to their original bytes. Original procedural materials and geometry are used; no household events, personal photographs or memorabilia are fabricated. Scrapbook's paper theatre follows the user's explicit direction. Its reference context includes the official evermore album store artwork; no album art is copied into assets.

## Authority and privacy

`commitCompanionPlay` is a typed, single-operation command. Room slots and decoration use explicit revisions; stale same-slot edits reject and retain the local preview. Disjoint slots do not use a whole-room overwrite. Removal is a revisioned null value. Gallery deletion leaves an honest unavailable display reference that can be replaced, without retaining an image snapshot in the room resource.

Private settings, discoveries and creative awards remain in the member envelope. Sharing a personal toy is explicit. Shared records contain semantic identifiers, accepted milestone references and room choices, excluding private looks and private financial facts. Explicit device clearing erases scoped portrait drafts and pending Play requests as well as the replica.

Clients and authority negotiate `companionPlayVersion: 1`. New writes require support. Older clients cannot issue commands that would discard Play data. Existing reset/restore paths preserve the collection. Receipt retries preserve command identity; a lost acknowledgement does not authorize a new award or financial operation.

Banks use existing Plan evidence to distinguish current validated reserves from historical contributions and future scheduled contributions. Unbacked legacy goal progress does not qualify for the Lantern. Projector eligibility uses effective accepted purchase evidence, including corrections. Cosmetic buttons never fund a goal. Bank actions open the existing shared Plan and its review, Final Confirm and recovery boundaries.

## Local proof

- `scripts/play/serve.mjs`: localhost-only synthetic fixture using real page components, member envelopes and `prepareCommand`. `?theme=classic|taylor|newfoundland`, `?toys`, and `?empty` select fictional acceptance states. Toys in this fixture are explicitly seeded and do not claim real milestone eligibility.
- `scripts/play/proof.mjs`: three theme journeys, six requested widths, fitting, private save, explicit sharing, placement, export, six toy panels, discoveries and illustrated fallback. The second run recorded 47 cases with no axe WCAG A/AA violations, horizontal overflow or page errors. Screenshots are in `docs/evidence/hercules-play`.
- Final High-risk gate: 498 tests across 39 files passed in 110.048 seconds, including TypeScript and full App startup. Production Vite and Hercules Pro UI builds passed.
- Focused tests exercise authority, disjoint/same-slot concurrency, scope isolation, capability rejection, milestone identity, snapshots, reset/restore preservation, unbacked goals and device clearing. Existing planning and wardrobe continuity regressions also run.
- Independent source and screenshot reviews found and drove corrections to authority entry points, financial eligibility, draft clearing, paper-plane occlusion, mobile fitting layout, portrait serialization and projector cycling.

## Outstanding full-plan acceptance

The update must not be described as release-ready on local proof alone. Remaining evidence includes two authenticated physical devices with the updated hosted authority; disconnect/reconnect and lost-acknowledgement journeys across them; actual bank review/cancel/confirm/recovery from Play; every new garment across all supported poses; representative physical phone/desktop sustained frame rates; screen-reader and physical touch trials; all themes' enlarged-text, dark, loading and failure states; and participant product-value trials.

The current 3D environment is authored procedural geometry with existing rig animations. Its material/art polish and several reward performances require a product art-direction review against the requested premium quality. Six toy activities function through accessible panels and room cues; this does not itself establish the independently valuable paid-product proposition.

No deployment, hosted schema application, real ledger mutation, public sharing or willingness-to-pay result is claimed.
