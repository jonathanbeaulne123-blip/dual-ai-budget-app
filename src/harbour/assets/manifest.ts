/**
 * Little Harbour · the Court's assets (BUILD_PLAN §3–4, #26).
 *
 * Every GLB the Court draws is listed here with the exact bytes it must be
 * (`test/harbour-assets.test.ts` hashes the files in `public/` against these
 * rows, like `test/queen-model.test.ts` does for the Queen's own model), the
 * gzip transfer twin the loader prefers, and the quality tier it belongs to.
 * The pieces are Jonathan's "Form" chess kittens as supplied — never altered;
 * the court Queen is a gltf-transform weld + simplify(0.3) + quantize of the
 * Living Presence master, verified by eye before it was shipped (petals,
 * leaves, face and crown intact at 219 k tris; see `hearth/shots/assets/`).
 *
 * No money is read here. Nothing in `src/harbour/**` reaches the books.
 */

/** Which renderer tier an asset is meant for: `full` keeps the master, `lite` takes the lighter twin, `any` serves both. */
export type AssetTier = "full" | "lite" | "any";

export type GlbAsset = {
  /** Path under `public/`, as the browser fetches it. */
  url: string;
  /** The gzip transfer twin next to it, or `null` when the file ships raw only. */
  gz: string | null;
  /** SHA-256 of the raw `.glb` (and of the inflated `.gz`). */
  sha256: string;
  /** Raw byte length of the `.glb`. */
  bytes: number;
  tier: AssetTier;
};

export type CourtPieceId = "knight" | "bishop" | "rook";
export type QueenAssetId = "presence" | "court" | "master";

/** A piece may not weigh more than this raw; the fence test enforces it. */
export const PIECE_MAX_BYTES = 1_700_000;
/** The decimated court Queen's raw ceiling (the master is exempt: it is the full tier's file). */
export const COURT_QUEEN_MAX_BYTES = 5_000_000;

/** The three pieces: Protect (knight), Prepare (bishop), Build (rook). */
export const COURT_ASSETS: Readonly<Record<CourtPieceId, GlbAsset>> = Object.freeze({
  knight: { url: "/models/court/knight.v1.glb", gz: "/models/court/knight.v1.glb.gz", sha256: "6a77537df5a3340237532943753571f1292c62077763dc3bfe92e6fda9b686ef", bytes: 1_583_196, tier: "any" },
  bishop: { url: "/models/court/bishop.v1.glb", gz: "/models/court/bishop.v1.glb.gz", sha256: "304cdc5bcf95d94edd8e233e7c0ce366cfc9a0d8b895cd618f3269baacddcc55", bytes: 1_653_136, tier: "any" },
  rook: { url: "/models/court/rook.v1.glb", gz: "/models/court/rook.v1.glb.gz", sha256: "ca1f23ca9c9c954b96ab40a364ad251e697ce1bab71d37a0701b6d7d1ec6918b", bytes: 1_591_372, tier: "any" },
});

/**
 * The Queen herself.
 *
 * - `presence` is what the full tier draws and what `bloom.ts` loads: the
 *   Living Presence sculpt run through `scripts/optimize-models.mjs`
 *   (dedup → prune → weld → 16-bit quantise → `EXT_meshopt_compression`).
 *   Same 71 meshes, same 656 380 triangles, same 26 materials, same node
 *   names; the scene bounds move by 2.35e-6 units, which is 5e-6 units at
 *   her shipped height of 2.05. Verified by eye against the master at three
 *   cameras — `docs/evidence/model-fidelity/`.
 * - `court` is the decimated copy the lite tier draws.
 * - `master` is Jonathan's file as he supplied it. Nothing fetches it today;
 *   it is kept for rollback and so the sculpt's own SHA-256 stays fenced.
 *   Remove it once the optimised presence has been accepted visually.
 *
 * All three carry the same node names, so the region map is shared.
 */
export const QUEEN_ASSETS: Readonly<Record<QueenAssetId, GlbAsset>> = Object.freeze({
  presence: { url: "/models/queen/mandevilla-living-presence.v2.glb", gz: "/models/queen/mandevilla-living-presence.v2.glb.gz", sha256: "d6b3e1549a6d111ca331412b13f39d07641300f101bf9a2a7074c79b3e4ec598", bytes: 3_132_636, tier: "full" },
  court: { url: "/models/mandevilla-living-presence.court.glb", gz: "/models/mandevilla-living-presence.court.glb.gz", sha256: "bb6337beadb5b47329f5ec238ff303e45be87755f387f63c90d4de7bc33321a4", bytes: 3_488_792, tier: "lite" },
  master: { url: "/models/mandevilla-living-presence.glb", gz: "/models/mandevilla-living-presence.glb.gz", sha256: "ddde35ae3ce025563ab546b13dc54f6f4376a1cddffe947c14dca082e05c2561", bytes: 12_922_440, tier: "full" },
});

/** The Queen stands 2.05 units tall in the Court (`bloom.ts` normalisation); the pieces are sized against her. */
export const QUEEN_COURT_HEIGHT = 2.05;

/** Each piece's height as a fraction of the Queen's, so the three read as her court and never her equals. */
export const suggestedScaleBesideQueen: Readonly<Record<CourtPieceId, number>> = Object.freeze({ knight: 0.79, bishop: 0.91, rook: 0.82 });

/** A piece's target height in world units. */
export const pieceHeight = (id: CourtPieceId): number => QUEEN_COURT_HEIGHT * suggestedScaleBesideQueen[id];

/** Which Queen file a renderer tier draws. `flat` has no Queen at all; callers on that tier never ask. */
export const queenAssetForTier = (tier: "full" | "lite"): GlbAsset => (tier === "full" ? QUEEN_ASSETS.presence : QUEEN_ASSETS.court);

/** Every asset row, for the fence test and for preloading. */
export const ALL_COURT_ASSETS: readonly GlbAsset[] = Object.freeze([...Object.values(COURT_ASSETS), ...Object.values(QUEEN_ASSETS)]);
