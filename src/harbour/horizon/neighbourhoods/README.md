The Water's Way (docs/horizon/STORY.md): one dressing module per neighbourhood. Pass 0 reserved this folder; the
dressing engine (PR 1 "common ground") lives here.

- `types.ts` — the contract: `NeighbourhoodModule { id, build(ctx) }` returns `NeighbourhoodDressing` records (buildings,
  plants, props, ground paint, pools, life, light anchors, landmarks, lookouts). Plain JSON; no scene imports.
- `index.ts` — the registry `NEIGHBOURHOOD_MODULES` (empty until PR 3/4). Each module lives in `neighbourhoods/<id>/index.ts`
  (`<id>` a `NeighbourhoodId`: harbour, hollow, scholars, flats, landing, lakeside, crown) and is listed here.
- `bake.ts` — `createDressingContext` (the bake-time world a module reads) and `bakeDressings` (validate, split per
  district, collision as `dressing.<neighbourhood>.<recordId>.<part>` solids, lights, landmarks, lookouts, Journey shapes).
  The rules are documented at the top of the file. Wired in `scripts/horizon/bake-entry.ts`; the world carries the result as
  `WorldDefinition.dressing` (absent when no module dresses anything, so an empty registry bakes byte-identically).
- `paint.ts` — the ground-paint palette per dressing.

The runtime draws the baked records in `runtime/dressingLayer.ts` (per resident district, lazily, released 20 s after a
district leaves); `runtime/cards.ts` never draws `dressing` collision solids nor the greybox walls/roof of a re-dressed host.
