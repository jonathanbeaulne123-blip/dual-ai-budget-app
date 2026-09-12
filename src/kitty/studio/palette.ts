/**
 * The studio's fixed glaze palette. Twenty-four named dips; the five legacy
 * KITTY_GLAZES are included and marked so the shelf and seals keep reading
 * them by name. This is the only studio file that may contain hex literals.
 */
import { KITTY_GLAZES } from "../../core/goalEnvelopes.ts";
import type { KittyGlaze } from "../../core/types.ts";

export type StudioGlaze = {
  id: string;
  name: string;
  hex: string;
  /** Present when the dip is one of the five legacy named glazes. */
  legacy?: KittyGlaze;
};

export const STUDIO_PALETTE: readonly StudioGlaze[] = [
  { id: "cream", name: "Cream", hex: KITTY_GLAZES.cream, legacy: "cream" },
  { id: "sea-glass", name: "Sea glass", hex: KITTY_GLAZES["sea-glass"], legacy: "sea-glass" },
  { id: "terracotta", name: "Terracotta", hex: KITTY_GLAZES.terracotta, legacy: "terracotta" },
  { id: "midnight", name: "Midnight", hex: KITTY_GLAZES.midnight, legacy: "midnight" },
  { id: "rose", name: "Rose", hex: KITTY_GLAZES.rose, legacy: "rose" },
  { id: "harbour-fog", name: "Harbour fog", hex: "#b9c3c6" },
  { id: "marigold", name: "Marigold", hex: "#e3a534" },
  { id: "blackberry", name: "Blackberry", hex: "#4a2e4d" },
  { id: "butter", name: "Butter", hex: "#f3e08a" },
  { id: "moss", name: "Moss", hex: "#6f8a5a" },
  { id: "dory-blue", name: "Dory blue", hex: "#3f6fa3" },
  { id: "partridgeberry", name: "Partridgeberry", hex: "#a3283d" },
  { id: "peach-melba", name: "Peach melba", hex: "#f2b58f" },
  { id: "kelp", name: "Kelp", hex: "#33574a" },
  { id: "soot", name: "Soot", hex: "#2b2926" },
  { id: "porcelain", name: "Porcelain", hex: "#f6f1e7" },
  { id: "lavender-milk", name: "Lavender milk", hex: "#c9b8dd" },
  { id: "tangerine", name: "Tangerine", hex: "#e8742d" },
  { id: "pistachio", name: "Pistachio", hex: "#b7cf8f" },
  { id: "cinnamon", name: "Cinnamon", hex: "#8a4b2c" },
  { id: "storm", name: "Storm", hex: "#5b6672" },
  { id: "bubblegum", name: "Bubblegum", hex: "#ef8fb8" },
  { id: "honey", name: "Honey", hex: "#d19a3e" },
  { id: "iceberg", name: "Iceberg", hex: "#d6ecf1" },
];

/** Legacy glaze name → hex; hex passes through. */
export function studioHex(base: string): string {
  return (KITTY_GLAZES as Record<string, string>)[base] ?? base;
}
export function isStudioHex(value: string): boolean {
  return /^#[0-9a-f]{6}$/.test(value);
}

/** Fixed art tones for the flat cat (ink stays currentColor so themes tint it). */
export const FLAT_TONES = {
  white: "#ffffff",
  blush: "#d38c8c",
  tongue: "#e39a9a",
  brass: "#bda375",
  shadow: "#6b4c33",
  doorOpen: "#5a4431",
  doorTrim: "#a88451",
  paper: "#fff0d0",
  flap: "#b89665",
} as const;

/** Fixed studio inks used by stamp and add-on artwork (kept here with the other colour data). */
export const STAMP_INK = "#2b2926";
export const STAMP_WHITE = "#fff8ee";
export const STAMP_FALLBACK = "#2b2926";
