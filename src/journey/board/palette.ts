/**
 * The board's palette access (Horizon Clock, L3) over L2's canonical clay palettes (`land/clayPalette.ts`): the
 * approved prototype's three themes and the shared prop colours. The board never keeps its own copy.
 */
import type { JourneyClayPalette, JourneyPropPalette, ThemeId } from "../contracts.ts";
import { CLAPBOARD, clayPalette, JOURNEY_PROP_PALETTE } from "../land/clayPalette.ts";

/** Newfoundland's painted clapboard boards (the prototype's `clapTex` colours), left to right. */
export const CLAPBOARD_BOARDS = CLAPBOARD.colours;

export function boardPalette(theme: ThemeId): JourneyClayPalette {
  return clayPalette(theme);
}

export type PaletteKey = keyof JourneyClayPalette | keyof JourneyPropPalette;
/** A colour by key from the theme palette, falling back to the shared prop palette (the prototype's `P[theme][k] || PROPC[k]`). */
export function colourOf(theme: ThemeId, key: PaletteKey): string {
  const p = boardPalette(theme) as Record<string, string>;
  const v = p[key];
  if (typeof v === "string" && v.startsWith("#")) return v;
  return (JOURNEY_PROP_PALETTE as Record<string, string>)[key] ?? "#ff00ff";
}
