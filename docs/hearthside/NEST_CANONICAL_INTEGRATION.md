# Canonical Nest pottery integration

Base: `2db4891` (merged current main). This isolated package contains new modules/tests and an exact shared-source patch. Apply the commit's new files, then `git apply --3way docs/hearthside/nest-canonical-integration.patch` to the integration checkout. The patch does not edit App, routes or existing Nest tests.

## Authority and source identity

- `KittyDesignDocument.nest` is optional, immutable `{version:1,view,designKey,appearance}`. Its appearance is version 1 with tier/category/theme from the reviewed initial source. UI theme changes cannot rewrite it. `snapshotKittyDesignRevision` includes that exact appearance.
- The authenticated design create request accepts `nestSource` only with `bankId:null`. Nest identity uses view + personal principal/null + stable designKey. Goal IDs and occurrence IDs are never substituted.
- `visibleNestSource` requires an active current member, current source visibility, and an existing metadata row. `migrateNestDesign` preserves the legacy studio including original piece IDs, paint, fired state, and unknown authorship. Two device requests for the same source resolve the same accepted document and original appearance.
- `creative_source` has a unique source and document index, committed in the existing same SQL transaction as creative history/reference/receipt. R2 checkpoints preserve the source and recipe; restoration rebuilds the source index. No whole studio or operation journal is placed in household metadata.
- `applyNestDesignReference` advances metadata revision while preserving name/category/archive/setup. Before each advance it preserves any receipt-referenced look. `designHasFired` is authority evidence from legacy firing or accepted firing history, retained across reopening.
- `saveKittyNestDesign` retains metadata behavior but rejects studio/fire writes after migration. Ordinary transitions cannot replace canonical references, fabricate them on a newly created row, or rewrite fired evidence. Validated cloud hydration can read canonical metadata; legacy import/parity must resolve the existing durable design or require archive recovery.
- `nestDesignVersion:1` is an explicit command/server/client capability after any Nest migration. This is separate from legacy `kittyNestVersion:1` and existing creative operations capability.
- Read and snapshot routes check the current Nest source each time. Personal Nest designs remain absent from shared projection and cannot use the household preview lane. Removing the source prevents direct reads/snapshots even when the document ID is known.
- Financial restore continues using parent's `currentSharedLifeRecords`, including `kittyNestDesigns`. Money command resources remain unchanged.

## Connected UI and safe copies

- Shared King full making uses `NestCanonicalStudio` → existing `CollaborativeStudio` when collaborative writes are enabled. Initial preparation writes only metadata; joining migrates and uses canonical `create-piece` (preserving the tall King starting shape). Painting/individual undo/firing remain existing durable operations. Name/setup actions remain cosmetic commands; no financial Goal is created.
- Migrated readers remain canonical even when writes are disabled. Parent retains existing category/bill lightweight controls until those sources are deliberately migrated; canonical metadata survives subsequent saves.
- `NestCanonicalArtwork` resolves the exact saved reference revision, including when a newer document is cached. Old paid pots retain legacy inline looks; later paid pots retain exact canonical references. A paid canonical detail offers no editing controls.
- Source/native/export/widget selections carry optional immutable `appearance`. Authored capture includes the sculpt plus its real ornament geometry, excluding turntable, paint hit shells, shards, backing and animation. Production selection/manifest/source JSON include the recipe. Native capture remains fixed 160 mm; backing is separate presentation only.
- Memory artwork, saved room pieces, firing previews and projector PNGs retain the exact ornament. Projector changes pass/paint the saved appearance and add the required SVG namespace; the real Chrome raster test reproduced a decode failure without that namespace.
- Guest publication converts the canonical appearance into `{version:1,motif}` only. It never copies view, designKey, source tier/category, household, financial data, or the canonical document. Guest display locally renders the reviewed motif at fixed size. This payload is independently decoded and included in the guest approval digest.

## Parent route seams

`CollaborativeStudioProps` gains:

```ts
onSelection?: (designId: string, pieceId: string) => void;
returnPath?: string;
```

The callback only reports an accepted loaded document that contains the selected current piece. The component key stays stable for household/member/source. Echoing its selection into parent route props does not remount it or reset opted-in participation. A changed route piece (including browser Back) finishes pending brush work, leaves live participation, and selects the requested piece; an unavailable explicit ID does not silently select another. `returnPath` supplies the native return route; the existing standalone piece route remains a fallback. Parent owns the `studioSelection` route and App wiring.

## Evidence and remaining release gates

New suites:

- `test/hearthside-nest-design.test.ts`: exact legacy migration/unknown authorship, paired painting/individual undo, canonical firing/setup evidence, financial hash, metadata authority/capability/old-write rejection, exact legacy/canonical paid looks, private source validation, safe guest ornament decoding.
- `test/hearthside-nest-design-runtime.test.ts`: actual LedgerRoom + SQLite/R2 and HTTP authentication, two-person migration/painting/undo, personal denial, no Goal creation, unchanged money hash, stable source recovery/retry. Removes a planned source through the actual authenticated command WebSocket, then proves HTTP read/snapshot denial.
- `test/hearthside-nest-design-ui.test.ts`: actual KittyBankRoom→King→canonical Studio→keyboard paint→undo/redo→firing→setup; route echo and same-design Back without remount; missing-piece denial; lost migration receipt recovery; read-only paid detail. The expensive 3D stage is substituted here; browser capture below tests real geometry.
- `test/hearthside-nest-export.test.ts`: actual Chrome Canvas/Three capture of the King crown and all 12 category/theme props, fixed requested dimensions, stable physical/native geometry independent of backing/UI theme, exact production package and painted projector output.

Measured runs before handoff: new four-file suite 9/9 passed in 7.93 s; affected existing Nest/core/UI + collaboration/design client/runtime regression set 56/56 passed in 6.09 s; guest/export surface/projector authority compatibility set 26/26 passed in 1.68 s. Existing jsdom Nest UI emits its baseline missing Canvas diagnostic while its illustrated fallback tests pass. Final narrow TypeScript includes production worker platform declarations and new test files. See handoff for final measured times after last source refinements.

Focus-map integration: add all four new test paths, matching new `nest*`/`Nest*` modules, and retain affected `kitty-nest.test.ts`, `kitty-nest-ui.test.ts`, Hearthside collaboration/design client/runtime/export/native surface/guest/projector tests plus existing Play/Kitty/Plan/Chapter/App-startup regressions. Parent owns the combined High gate and build.

No hosted activation, native SDK build/signing/distribution, physical device validation, or production readiness is claimed. The earlier unsigned native CI package remains separate; final frozen-root asset-copy/sync digest proof is still pending the parent's root build.
