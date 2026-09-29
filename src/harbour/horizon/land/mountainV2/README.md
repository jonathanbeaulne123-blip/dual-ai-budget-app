# land/mountainV2

Pass 5 (T1 Land): the Horizon bake's view of Mountain v2 (D-M1 … D-M6). Horizon space = v2 native + `MOUNTAIN_V2_OFFSET`
(`regions/mountainV2/placement.ts`, {x:1308, y:54, z:764}).

- `ground.ts`: v2's ground in Horizon space and the D-M2 rule (`mountainV2Rule`, `mountainV2Height`). The v2 terrain asset
  (`public/mountain/terrain/hearth-mountain-geo-2.bin`) is decoded only in Node (the bake and tests); the browser build gets
  `null` and never needs it (the baked Horizon field already holds the result).
- `beds.ts`: Horizon beds that ride v2's geometry (`mountainV2.road`, the promenade walk, S1's upper course, v2-road footways)
  and `regionCarry`, which marks a stretch as drawn by the region (no Horizon cut, deck, kerb or wall there).
- `v2-data.json`: v2's authored geometry (road samples, course, gates, gondola, funicular, dam, river, sites) in Horizon space.
  Generated, never edited by hand:

  ```sh
  node scripts/horizon/dump-mountain-v2.mjs          # rewrite after any change under src/harbour/mountain/**
  node scripts/horizon/dump-mountain-v2.mjs --check  # fails when the file is stale
  ```

  Re-run `pnpm horizon:bake` after regenerating it.
