# Hercules: personality, useful guidance, and the dressing room

Final implementation plan · 2026-09-10 · Decision owner: Jonathan

## Outcome and agreed direction

Bianca should know what Hercules can help with, enjoy talking to him, and want to dress him. Hercules is an affectionate little diva: warm, observant, quietly proactive, occasionally theatrical, and consistently patient. His appearance remains based on the Hercules already in Hearth.

Jonathan selected automatic memory for helpful preferences; personal looks synchronized across devices; an explicitly shared household look gallery; a generous wardrobe available immediately; and a full 3D dressing room first, with matching lightweight looks elsewhere in the app. This plan covers all three experiences as a complete feature, with staged implementation rather than reduced final scope.

- **Budget delta (5):** make financial capabilities discoverable, explain grounded results, and help people finish existing workflows without changing money authority.
- **Engagement delta (3):** create a recognizable companion with conversational continuity, personal style, expressive reactions, and a substantial dress-up experience.
- **Risk:** planning is Low; implementation is High because private continuity, model context, and shared/personal projection boundaries change. Cosmetic rendering alone is Medium.
- **Implementation lead:** Codex, one writer per checkout. Use independent Codex trust and UX reviews. Reserve Claude for one focused review of character examples and the first finished closet scene; one targeted follow-up only if that review finds material defects. Claude is optional, not a dependency for every slice.
- **Release boundary:** this document authorizes no implementation by itself, hosted mutation, schema application, external test-data transmission, secret/provider activation, merge, or deployment. Implement when Jonathan requests it; release remains a separate instruction.

## Verified starting point

Repository: `jonathanbeaulne123-blip/dual-ai-budget-app`. Main verified at `2e113f69d03872eddc22ac461378a0f3e33f6c55` (PR #417). Planning checkout: `codex/hercules-living-companion-plan`, same HEAD. Existing dirty checkouts are not implementation baselines. Before implementing, verify fresh main and reconcile only intervening relevant changes.

At this baseline:

- Ordinary chat has Gemini routing, read tools, provider provenance, numeric guards, and local fallback. Its request does not carry conversation history. The Worker prompt contains contradictory length guidance, and the ordinary client response passes through a 360-character sanitizer. These are verified constraints, not a controlled diagnosis of Bianca's live session.
- Help already builds contextual commands from bills, leftover, notices, goals, and the current surface. It uses fixed insertion order and labels such as “Leftover?” and “What now?”; the usefulness score can require an initial begging interaction before opening help.
- The wardrobe has 16 items, four slots, immediate household equipment changes, and financial/activity unlock rules. Spectacles occupy the hat slot. Memories and chat maintenance are mixed into the wardrobe.
- The normal cat is an animated SVG. Both inspected GLBs have 788 meshes, 4,458 nodes, zero skins and zero animation clips. The source is 7,464,180 bytes; the Pro version is 2,797,232 bytes. Binary equality with the named main baseline was verified. Existing geometry is reference/reusable source, not a finished garment-ready rig.
- Current cloud-backed Development writes require online authenticated cloud acknowledgement. Offline books remain readable. New companion persistence must follow that rule rather than resurrecting older offline-write assumptions.
- Gemini/Groq routing is currently gated to authorized synthetic Development. Do not label Bianca's real input synthetic. Preserve provider/data gates and disclose any future expansion as a separate reviewed change.

Primary seams are `src/Hercules.tsx`, the `src/core/hercules*` and help/companion modules, `workers/site.js`, the wardrobe/figure/dress components, personal/shared shaping and transport, and the theme system. Preserve current More composition from #417.

## 1. Character, conversation, and memory

### Character contract

Write one versioned character brief shared by model adapters and local fallback examples. Resolve conflicting instructions instead of appending another persona paragraph. Hercules loves attention, clothing, comfortable places, and being helpful. He can be playfully self-important about himself; he never mocks the person's intelligence, spending, income, debt, partner, or absence.

| Situation | Intended voice sample | Behaviour |
|---|---|---|
| Lost after onboarding | “Come sit with me. Let's find one useful thing to do first.” | Offer three concrete starting points. |
| Needs an explanation | “Of course. Let's start with what this number includes.” | Plain explanation with a tappable source. |
| Financial stress | “We can take this one step at a time. Let's look at what's due first.” | Calm, direct; no theatrical interruption. |
| Opens closet | “Finally. An appointment that respects my talents.” | Welcome pose; occasional line, not every visit. |
| Excessive outfit | “Subtle. Practically invisible.” | Mirror inspection; humour directed at himself. |
| Missing data | “I don't have the dates I need yet. I can help you add them.” | Identify the missing input and offer its actual flow. |
| Returns after time away | “There you are. Where shall we start?” | No guilt, decaying affection, or missed-day punishment. |

These are training/evaluation examples, not mandatory catchphrases. No forced purr prefix, compulsory money metaphor, or automatic redirection of every casual exchange back to budgeting. Serious questions receive a serious answer first. Remove the link between bad financial results and withdrawing/hiding affection; show useful concern without making pet wellbeing depend on the books.

### Conversation behaviour

- Keep one conversation per person, environment, household, and ledger view. View changes open the corresponding conversation, never combine Personal facts into Shared history. Add conversation/view generation to stale-response checks, including delayed animations and memory writes.
- Supply a bounded, disclosure-filtered recent conversational context: up to six user/reply pairs with an 8,000-character total ceiling, oldest first removed when necessary. Keep stable entity/source references separately so “that card” and “next week” resolve without guessing. Refresh financial results for every new answer; an old reply is not financial authority.
- Exclude ephemeral workplace turns and unowned legacy household transcripts from outbound history. Redact secrets and unnecessary sensitive detail; retain the current data classification and provider disclosure rules. No bulk transcript upload or vendor-managed persistent memory store.
- Replace the global 360-character cutoff with presentation modes: a short invitation, a concise answer, or a step-by-step explanation. Full answers remain readable in chat; compact surfaces show a summary and “Read more.” Request at most three short paragraphs by default; allow longer explanations when explicitly requested. Preserve paragraph breaks and use a 6,000-character defensive maximum without cutting a financial statement mid-sentence.
- Extend the existing chat endpoint with an additive versioned response containing validated text, referenced fact/action IDs, one approved expression, one approved gesture, and optional allowlisted preference candidates. Existing string replies remain readable during rollout. Unknown cues are ignored; malformed structured output falls back to validated text or the local answer.
- Gemini selects wording and approved presentation cues. Existing deterministic tools supply numbers; existing routed actions open a surface or prepare a reviewable draft. The model receives no generic execution, arbitrary URL, SQL, or financial-posting capability.
- Respect the existing provider fallback order and limits. Remove unconditional expensive reasoning for casual chat where the configured model supports a lower setting; retain reasoning for grounded multistep questions. Measure rather than promise latency. No model request for ambient motion, every keystroke, or ordinary try-on.
- Local fallback follows the same character brief, says when current information is unavailable, and exposes working deterministic actions. Provider failures do not erase conversation or restart onboarding.

### Helpful memory

- Automatically remember only preferences clearly expressed by the current person: answer length, explanation style, humour intensity, favourite outfit IDs/colours, and preferred app activities. Use typed values or bounded selections; do not infer personality, emotional state, health, relationship dynamics, debt, income, or partner preferences.
- Defaults: remembering on, gentle humour, concise answers with optional expansion. Show a small “Remembered” receipt with Undo only after a new preference is acknowledged; pending/offline candidates remain explicitly unsaved. Avoid repetitive acknowledgements for unchanged values.
- Add “Hercules remembers” to companion settings reachable from chat and the closet. Show, edit, forget, turn automatic remembering off, and clear conversation separately from preferences. Stopping automatic memory leaves existing preferences visible until removed.
- Keep at most 60 preference records per person/household/environment. Keep new conversation history for 30 days with a maximum of 300 turns per view; prune through the normal acknowledged write path. Provider payloads use only relevant preferences, capped at 12. Explicit forget/delete wins over stale updates and late model responses.
- Store authored text and useful source references, never chain-of-thought, raw exports, tokens, or full tool dumps. On logout/scope changes, clear active context immediately. Existing approved sensitive ephemeral flows remain ephemeral.
- Offline conversation uses local fallback and remains a labelled device-local session draft. No automatic preference is durably saved offline. On acknowledgement failure preserve the unsaved conversation/preference candidate for explicit retry; never claim cloud persistence. Bound local drafts by the same retention limits and clear them on logout.

## 2. Useful discovery and quiet suggestions

### Entry and layout

One tap on Hercules always opens his companion/help surface. Keep “How can I help?” visible and consistently placed on phone and desktop. Play remains an explicit control inside that surface; usefulness no longer changes the number of taps required to get help.

The surface contains three sections: **For you now**, **Things we can do**, and **Continue with me**. Include a normal chat composer. For an empty/new household, show three useful choices: explain this page, walk through one entry, or explore Hercules's wardrobe. Never announce that he is useless because the household lacks data.

### Capability catalogue

Use one typed catalogue for discovery, suggestion eligibility, navigation, and the model's available actions. Each entry contains a stable ID, plain-language outcome, eligible scope, required data, deterministic evidence builder, destination/draft handler, and completion condition. Hide unavailable capabilities; never show an aspirational card that leads to an unsupported answer.

The initial catalogue covers these 12 outcomes, using existing calculations and flows:

1. Explain the current page and its primary action.
2. Walk through adding an expense, income, or transfer using the existing entry/review flow.
3. Explain a selected account balance and open its source.
4. Show bills due before the selected next payday; ask for a date if it is not known.
5. Explain recorded spending by category or period.
6. Compare recorded periods with explicit coverage limitations.
7. Review current plan/leftover using the existing projection, without calling it guaranteed safe-to-spend money.
8. Review a goal and open the existing next action.
9. Explain a Health finding or possible duplicate and open the review.
10. Resume the current person's unfinished shift workflow without posting it.
11. Explain the Household Fund contribution/claim currently in view.
12. Open dress-up and help combine available clothing.

### Selection policy

- Generate candidates locally from current visible-scope state. Exclude inaccessible, incomplete, unsupported, already resolved, or dismissed candidates before ranking.
- Order: blocked or unfinished user work; time-sensitive items; current-page relevance; useful exploration. Within a tier use nearest due date, then least recently shown, then stable ID. Show at most three and avoid multiple cards about the same underlying item.
- Each card names the outcome, a short “why now,” the source or missing input, and a concrete action. The model may paraphrase a selected card after interaction but cannot invent its eligibility, date, amount, action ID, or priority.
- “Not now” suppresses that issue for 24 hours; “Don't suggest this” disables its capability for that person until re-enabled. Recompute on the next relevant acknowledged change, page change, or Toronto date boundary. A materially new occurrence gets a new issue identity.
- The ambient invitation is a quiet badge/line, never auto-open chat, audio, a modal, or an announcement on every rerender. No more than one new unsolicited invitation per session and none while entering, confirming, or resolving an error. The help surface can still show all eligible recommendations when opened.
- Continue with me stores only a scoped bookmark into an existing task/conversation. It revalidates current state before resuming and never resurrects a completed task or a stale financial draft.

## 3. Full 3D dressing room

### Room and controls

Entrance remains **More on this desk → Hercules outfits**. Open a substantial dressing-room surface, with a fitting platform, mirror, visible rail, hat stands, accessory trays, and saved-look storage. Memory controls live in a secondary settings destination rather than among clothes.

Desktop uses a wide room: clothing storage on one side, Hercules and mirror in the centre, selected-item controls and saved looks on the other. Phone uses an independently composed full-height room: large preview above a reachable category drawer and sticky Try/Wear/Save controls. Room props and ordinary accessible controls operate the same catalogue; drag is optional, never the only interaction.

- Rotate and zoom Hercules, reset the camera, select a fitting pose, inspect the back of an outfit, and toggle the mirror. Constrain the camera to keep him visible. Default to a flattering three-quarter view matching his current character.
- Clicking a piece previews it immediately without saving. Support Remove, undo/redo in the fitting session, Reset to worn, favourites, category filtering, colour/material swatches, “Surprise me,” and lock-selected-pieces for shuffling.
- “Wear this” saves the complete look atomically after cloud acknowledgement. “Save look” names a reusable preset and does not silently equip it. Keep preview drafts scoped and recoverable on that device; closing saves only the local preview draft, not a new worn outfit. A draft is labelled when it differs from the worn look.
- Offline, cached assets support browsing and preview; clearly retain a local draft and disable cloud-backed Wear/Save/Share until connection returns. Reconnect offers retry, not an automatic mutation. Asset errors preserve the last valid preview and provide retry plus the accessible catalogue.
- Sharing requires “Share to household.” It publishes only a look name, item/variant IDs, creator identity already visible to the household, and a derived thumbnail. No chat, memory, financial activity, or private background image accompanies it. Household members can preview and copy it into their personal looks; updates to the original never alter their copies.
- Default limits: 50 personal saved looks and 100 household gallery looks. At capacity, offer replace/delete; never silently evict somebody's look. Creators can rename/remove their shared look; retain existing membership and moderation authority.

### Character and asset production

The current in-app Hercules is the visual authority: preserve recognizable silhouette, face, eyes, white coat markings, mane, proportions, and expressions. Do not substitute a generic realistic Maine Coon, plush mascot, or unrelated generated cat. Use current app views as the likeness sheet. Existing GLB geometry may be rebuilt/retopologized as needed; do not ship its thousands of nodes directly as the dress-up rig.

Use a lazy-loaded Three.js scene with GLTFLoader, one skeleton, skinned body garments, bone-attached rigid accessories, authored material variants, and AnimationMixer clips. Use preauthored deformation for capes and soft fabric in v1; full cloth simulation, per-strand fur, and arbitrary user-uploaded clothing are outside this release. Preserve rich fur/fabric appearance through authored geometry and textures.

Deliver a rigged canonical asset, attachment anchors, body occlusion masks, garment compatibility metadata, clips, catalogue thumbnails, pose-matched lightweight SVG dress layers for the existing app cat, and reproducible source/export files. A saved look uses the same IDs and colour tokens in 3D and the normal app. No silent default-cat substitution when leaving the closet.

Slots: **head, eyewear, neckwear, body, outerwear, charm**. Each item declares occupied/excluded slots and hidden body regions. Glasses combine with a hat. Only compatible combinations can be saved; previews explain replacements before applying them. A cape and coat share outerwear. Theme accessory defaults apply only before the first personal customization; explicit None stays None across theme changes. Room scenery is separate from clothing. Legacy spectacles map to eyewear; other real hats to head; chains to the neck-anchored charm slot; bell/yarn to neckwear; fish/clip/tooth/ink to charms; houses to Keepsakes. If an old chain and a charm compete, preserve the full source configuration and ask for one selection in the first preview rather than silently losing either item.

The first production gate is one complete three-piece look (hat, body garment, eyewear), all fitting poses, 3D/2D identity parity, and mobile performance. If the rig cannot support it cleanly, repair the asset pipeline before multiplying garments. The gate is an implementation quality check; do not replace the promised 3D room with a flat catalogue.

### Launch wardrobe: 36 new pieces plus legacy compatibility

Every new piece is available immediately. Colours do not count as extra pieces. All existing cosmetics remain selectable; remove financial unlock requirements. Keep legacy house items in a Keepsakes shelf as room props, and treat the old no-op winter ruff as his natural mane rather than drawing duplicate fur.

| Collection | Six authored pieces |
|---|---|
| Cozy at home | cable-knit sweater; cardigan; pom-pom toque; soft scarf; round reading glasses; teacup charm |
| Tiny office manager | waistcoat; pinstripe jacket; green visor; rectangular glasses; silk tie; pocket-watch charm |
| Newfoundland rain | yellow raincoat; sou'wester; fisherman's sweater; knitted watch cap; nautical neckerchief; puffin charm |
| Dressing for applause | velvet cape; sequin jacket; miniature crown; star glasses; satin bow; star pendant |
| Kitchen royalty | chef tunic; apron; tall chef hat; baker's cap; gingham neckerchief; whisk charm |
| Sunday best | tailored coat; embroidered vest; beret; oval glasses; ribbon collar; cameo charm |

Each collection has an authored recommended look. Fabric items have four curated swatches; metal items have silver, brass, and rose-gold variants. Palette choices preserve contrast with his coat and avoid changing his natural fur. Use original garment artwork and geometry with recorded provenance.

### Room identity and reactions

- **Classic:** warm wood cabinetry, brass hardware, linen drawers, soft daylight and a framed mirror.
- **Taylor:** the current More scene's evermore/folklore character, with tactile keepsakes, woodland/cottage materials and intimate dressing details; verify era references before asset production. Glamorous clothes remain available in every room, without turning the whole room into a generic concert set.
- **Newfoundland:** JAG-inspired dressing lounge/music corner with collected coastal details, a rainwear rail and warm reflective materials. Keep the current Shared/Personal scene mapping.

Twelve authored reactions: breathe/blink, head tilt, ear perk, slow blink, pleased posture, small strut, look over shoulder, inspect mirror, adjust glasses, check sleeve, admire cape, saved-look pose. Only play garment-dependent clips when that garment is worn. Respect pause/reduced motion, avoid repeated reactions while rapidly browsing, and never imply that Hercules dislikes the person for choosing a look.

Optional dialogue on entering, asking for styling help, or saving a look uses the same character. Try-on and ambient reactions are local. Existing sound preference remains off by default; new voice synthesis is outside this release.

### Performance and graceful failure

Targets to verify on the actual closet: zero 3D module/asset requests before opening; initial selected room/cat/default look at most 8 MB transferred; load remaining collections on demand; first usable 3D preview within 4 seconds at a documented 20 Mbps/50 ms profile; cached try-on visible within 150 ms; sustained at least 30 fps on a representative midrange phone during a 30-second rotation/pose sequence. Record device/browser and use measurements, not desktop emulation alone.

Cap device pixel ratio and reduce shadows/reflections before reducing outfit fidelity. Stop frame work when closed/hidden and dispose GPU resources on exit. Reduced motion uses a still pose and user-operated camera. WebGL failure keeps an honest labelled 2D outfit preview and all catalogue/save controls. Accessibility or performance fallback does not count as proof that the normal 3D acceptance gate passed.

## 4. Persistence, interfaces, and compatibility

Extend current versioned continuity envelopes and typed nonfinancial commands; do not create a second sync service or generic model writer. The implementation must carry new fields through shaping, hydration, projection, merge/CAS, command replay, export/import, and mixed-version reads. No new hosted tables are planned.

Private member-owned companion data contains conversation partitions, approved preferences, suggestion dismissals/resume bookmarks, worn look, and personal saved looks. Shared companion data contains only the explicit household gallery and existing genuinely shared legacy fields. A UI filter is not a privacy boundary: private records must be absent from the shared payload, activity summaries, tombstones, exports for another member, and shared command logs. The present `splitForSync` copies the whole kitchen into Shared; change that boundary before enabling new memory or private wardrobe writes.

Minimum interfaces:

- `CompanionProfileV1`: owner identity, conversation partitions and retention metadata, typed preferences, suggestion state, worn look, and saved looks.
- `LookV1`: stable ID, name, catalogue version, item/variant selections, and revision. `GalleryLookV1` is an explicit shared copy with creator attribution.
- `CapabilityDefinition` / `SuggestionCandidate`: scope, eligibility/evidence, outcome, reason, deterministic destination and completion key.
- Chat request/response v2: bounded scope-filtered context, current facts/action IDs, validated presentation cues, and preference proposals. Retain legacy response compatibility while upgrading clients.
- `CosmeticDefinitionV2`: slot occupancy, variants, rig attachments, occlusion/compatibility, 3D asset, catalogue thumbnail and 2D pose layers.

Use an optional `companionProfile` in the existing authenticated `PersonalEnvelope` for private state, including when the person is viewing Shared. Ownership is the authenticated member, not the currently displayed ledger. Continuity is across devices within the same household/environment; wardrobe transfer between unrelated households is outside v1. Introduce explicit typed preference/look/history operations with no posted money IDs. Bind create/update/delete and gallery creator attribution to the authenticated actor on client and server; reject spoofed authors and foreign-record deletion. Replace or disable legacy record/wipe/forget handlers for new conversations: the existing talk author check only establishes household membership, not acting identity.

Use resource revisions within the existing command/CAS machinery: append-only turns have stable IDs and idempotent receipts; each preference key, worn look and saved look has its own revision. Deletions retain a version/tombstone that wins over late candidates. An unrelated new chat turn must not reject an otherwise valid wardrobe edit. Preserve a conflicting preview/edit locally and show retry/review instead of overwriting the accepted resource. No background model response may jump ahead of a user edit/delete. Update `workers/ledgerSyncAuth.ts`'s personal-field allowlist and owner validation alongside the new envelope; data must round-trip through the current server before the feature is enabled.

Compatibility defaults: missing new fields mean empty profile; legacy shared equipped cosmetics seed the person's first preview without modifying the household. Persist that personal copy only on their first successful save. Never assign shared legacy chat/memories to an arbitrary first member or send them as someone's personal history. Keep them as a read-only labelled legacy shared archive, outside new model context; it remains previously shared data and is not retroactively described as private. Users can deliberately re-enter a preference. New clear-history/forget controls affect only the personal profile; archive cleanup is separately authorized. Preserve unknown legacy cosmetic IDs in storage while displaying a clear unavailable-item state. Do not discard them on unrelated edits.

Implementation must update personal shaping/overlay/split, runtime ownership validation, ledgerSync command registration, import normalization/parity and export preservation together. Deliver compatible server validators before enabling new client writes. Test old-client writes against populated new profiles; reject incompatible companion writers with a refresh message instead of losing new fields. No new table is required by this design. Any hosted JSON/SQL guard that rejects the new shape needs a prepared, reviewed migration before separately authorized application; do not route around validation. Financial commands, money calculations, PGlite checks, Final Confirm, and exact cloud-acknowledgement semantics remain authoritative.

## 5. Delivery sequence and acceptance

Use six coherent slices, each based on fresh main or its named reviewed predecessor. Keep the wardrobe hidden until its complete vertical slice is ready. Personality and guidance can be independently reviewed earlier; that does not mark the complete feature done.

| Slice | Deliverable | Required exit proof |
|---|---|---|
| 1. Shared contracts and evaluation | Character brief, capability catalogue, conversation/profile/look types, pure validators, fixtures, legacy preview mapping and unregistered nonfinancial intent contract | Independent privacy/continuity review; synthetic exact payload/projection/compatibility tests. No production envelope or writer activation. |
| 2. Conversation and helpful memory | Complete private envelope shape/split/overlay, actor/resource/import-parity/server-compatibility unit; Gemini/local personality parity, bounded context, readable answers, preference controls, view/scope cancellation | Actual authority and old-client round-trip tests before enabling new writes; conversation evaluation and negative disclosure tests; saved vs local state truthful. |
| 3. Discovery and suggestions | One-tap help, twelve working capabilities, ranked cards, quiet invitations, dismiss/resume | Each visible card completes its promised route; deterministic ranking and stale-result tests. |
| 4. 3D vertical slice | Rigged recognizable Hercules, one fitted look, room shell, all twelve reactions, matching app layers | Likeness review, clipping/pose checks and measured phone performance. Optional single Claude visual/voice review here. |
| 5. Complete wardrobe | All 36 new pieces plus legacy compatibility, personal Wear/Save, shared gallery, all three rooms | Entire launch catalogue fitted and rendered; personal/shared and cross-device proof. |
| 6. Integration and product acceptance | All surfaces, memory lifecycle, fallback, accessibility, onboarding/regression checks, documentation | No open critical trust/interaction defects; Bianca completes the product trials below. |

Update the living Hercules docs, relevant decisions/roadmap and AI handoff when behaviour is implemented. Specifically supersede old earned-only wardrobe, forced-budget-only conversation, shared-history assumptions, financial mood punishment, and score-dependent help entry. Do not rewrite historical evidence as if the new feature had already shipped.

### Meaningful tests

- **Dialogue:** 24 scripted situations covering onboarding completion, confusion, two-turn references, correction, stressed tone, casual chat, outfit chat, missing data, stale numbers, and provider failure. Score warmth, distinctiveness, clarity and continuity from 1–5; target average at least 4 with no shaming, invented financial fact, or false completed action. Automated checks enforce invariants; human review judges voice rather than brittle exact-string snapshots.
- **Discovery:** new/empty household, multiple urgent tasks, unresolved shift, absent payday, Personal/Shared switching, snooze, resolved issue, unsupported action, interrupted navigation, and changing state between display and tap. No fixed random prompt rotation.
- **Memory/privacy:** explicit preference, ambiguous preference, sensitive content, partner mention, ephemeral workplace turn, edit/forget, spoofed authors, foreign-record mutation, late response, logout, member switch, view switch, retention, and stale-device replay. No private canary appears in a shared envelope, gallery, or unauthorized outbound payload.
- **Wardrobe:** every piece across all compatible fitting poses; glasses-plus-hat and outerwear exclusions; swatches; undo/redo; preview versus Wear/Save; None across themes; old IDs; capacity; shared copy independence; failure to acknowledge; offline draft/retry; concurrent devices; WebGL loss; slow/missing assets.
- **App integration:** existing grocery entry through exact Confirm, onboarding reopening/resume, Fund semantics, source-card navigation, existing 2D animation and Pro compatibility, theme/scope changes and keyboard focus. Dressing and model replies produce no financial journal entry.
- **Visual/accessibility:** actual phone and desktop surfaces in all three themes, relevant Shared/Personal contexts, widths 320/390/720/1100/1440/1920 and changed breakpoint edges; keyboard, screen reader, 200% text, 44 px targets, long labels, full-scroll and nested error/loading states, reduced motion, pause, offscreen suspension and unobstructed financial controls.
- **Cross-device:** with two authorized test identities, persist a personal look/preference on A, close A, recover on B; partner sees only an explicitly shared gallery look; private preferences/chat remain absent. Validate late writes, membership removal and retries. Record physical/Safari and authenticated proof separately from fixtures and browser emulation.

Bianca's product trials: after onboarding, identify three things Hercules can help with without Jonathan explaining; complete one useful task from a suggestion; sustain a three-turn conversation with a correct follow-up; correct/forget one remembered preference; assemble/name/wear a mixed outfit and recover it on another device; share a look that Jonathan can copy without changing hers. Record any hesitation and verify the fix. No fake “all done” if only synthetic tests ran.

### Commands and evidence

Implementation introduces focused suites named `test/hercules-companion-profile.test.ts`, `test/hercules-personality-v2.test.ts`, `test/hercules-discovery-v2.test.ts`, and `test/hercules-wardrobe-v2.test.ts`. Run the suite appropriate to each changed slice through the repository quick gate; run protected integration canaries in the final slice. From the implementation checkout, using the configured runtime:

```sh
pnpm test -- --risk=high --focus=test/hercules-companion-profile.test.ts --focus-reason="Private companion continuity, legacy migration and no financial writes"
pnpm test -- --risk=medium-high --focus=test/hercules-personality-v2.test.ts --focus-reason="Grounded multi-turn personality and memory control"
pnpm test -- --risk=medium-high --focus=test/hercules-discovery-v2.test.ts --focus-reason="Eligible suggestions and working contextual destinations"
pnpm test -- --risk=high --focus=test/hercules-wardrobe-v2.test.ts --focus-reason="Personal wardrobe, shared copies and compatibility"
pnpm test -- --risk=high --focus=test/app-startup-p1.test.ts --focus=test/month-rehearsal-mainline.test.ts --focus-reason="Hercules integration preserves ordinary App and command authority"
pnpm build
git diff --check
```

These are future implementation commands, not checks passed by this planning task. Record duration and any five-minute overrun honestly. Do not invoke exhaustive test/check lanes without the separately recorded exact-SHA authorization. Add a reproducible browser/asset acceptance runner as part of implementation, not a list of unchecked screenshot promises.

Return each slice with base/head, changed behaviour, asset provenance, measured results, independent findings and fixes, remaining proof gaps, and precise local/PR/deployed status. No new content telemetry by default: use fixture evaluations and local debug counters for prompt IDs, latency and suggestion outcomes without storing chat content in analytics.

For a later authorized Development release, separate chat/discovery/wardrobe feature switches permit presentation rollback while preserving new profile data. Deployment rollback must use a compatible build, not an old writer that drops new envelope fields. Schema, provider consent/classification changes and Production remain separate release decisions.

## Sources and planning limits

This plan follows current `AGENTS.md`, `docs/CLOUD_CONTINUITY.md`, `docs/AI_OPERATING_MODEL.md`, the current page-theme execution standard, and Jonathan's explicit choices in this task. User-reported onboarding success is accepted as feedback, not represented as an independent full onboarding certification.

- Gemini supports explicit system instructions and multi-turn request contents: [Generating content](https://ai.google.dev/api/generate-content). Structured model fields still require semantic validation by Hearth.
- Three.js provides the selected rendering primitives: [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html), [animation system](https://threejs.org/manual/en/animation-system.html), and [SkinnedMesh](https://threejs.org/docs/pages/SkinnedMesh.html).

No generated concept art, production-ready character rig, garment library, live Gemini quality test, or physical-device performance proof exists as a result of writing this plan. They are explicitly scheduled deliverables, not hidden assumptions about existing assets.
