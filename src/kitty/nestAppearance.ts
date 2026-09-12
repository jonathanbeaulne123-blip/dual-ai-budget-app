import { newKittyPiece } from "../core/kittyStudio.ts";
import type { NestBank } from "../core/kittyNest.ts";
import type { NestCategory } from "../core/kittyNestDesigns.ts";
export type NestOrnament = { tier: NestBank["tier"]; category: NestCategory | null; theme: string };
export const nestOrnament = (bank: NestBank, theme: string): NestOrnament => ({ tier: bank.tier, category: bank.category, theme });
export function nestDefaultPiece(bank: Pick<NestBank, "id" | "tier" | "category">) {
  const piece = newKittyPiece(`nest-${bank.tier}`, "2026-09-12T00:00:00.000Z", bank.category === "protect" ? "midnight" : bank.category === "prepare" ? "terracotta" : bank.category === "build" ? "sea-glass" : "cream");
  if (bank.tier === "king") { piece.sculpt.body = "tall"; piece.sculpt.head = "chubby"; piece.sculpt.ears = "tufted"; piece.sculpt.features = { head: 1.15, ears: 1.1 }; }
  if (bank.tier === "plan") { piece.sculpt.body = bank.category === "protect" ? "loaf" : bank.category === "everyday" ? "round" : bank.category === "build" ? "pear" : "bean"; piece.sculpt.tail = "wrap"; }
  if (bank.tier === "bill") { piece.sculpt.body = "bean"; piece.sculpt.ears = "round"; piece.sculpt.tail = "none"; piece.sculpt.features = { head: 0.75 }; }
  return piece;
}
/** One motif name drives both the sculpted prop and its 2D twin. */
export function nestMotif(ornament: NestOrnament): string {
  if (ornament.tier === "king") return "crown";
  if (ornament.tier !== "plan") return "none";
  const motifs = ornament.theme === "newfoundland"
    ? { protect: "lighthouse", everyday: "rowhouse", build: "sailboat", prepare: "lifering" }
    : ornament.theme === "taylor"
      ? { protect: "star", everyday: "flower", build: "guitar", prepare: "sun" }
      : { protect: "shield", everyday: "cup", build: "sprout", prepare: "clock" };
  return motifs[ornament.category ?? "everyday"];
}
