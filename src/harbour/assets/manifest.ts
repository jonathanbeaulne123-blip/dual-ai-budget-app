/**
 * Court asset manifest (writer C owns the full version; this minimal copy keeps
 * `COURT_ASSETS.{knight,bishop,rook}.url` stable for the court builders).
 * Form Core GLBs live at public/models/court/ with .gz twins.
 */
export type CourtAsset = { url: string; sha256: string; bytes: number; tier: "full" | "lite" | "both" };

export const PIECE_MAX_BYTES = 1_700_000;

export const COURT_ASSETS = {
  knight: { url: "/models/court/knight.v1.glb", sha256: "6a77537df5a3340237532943753571f1292c62077763dc3bfe92e6fda9b686ef", bytes: 1_583_196, tier: "both" },
  bishop: { url: "/models/court/bishop.v1.glb", sha256: "304cdc5bcf95d94edd8e233e7c0ce366cfc9a0d8b895cd618f3269baacddcc55", bytes: 1_653_136, tier: "both" },
  rook: { url: "/models/court/rook.v1.glb", sha256: "ca1f23ca9c9c954b96ab40a364ad251e697ce1bab71d37a0701b6d7d1ec6918b", bytes: 1_591_372, tier: "both" },
} as const satisfies Record<"knight" | "bishop" | "rook", CourtAsset>;
