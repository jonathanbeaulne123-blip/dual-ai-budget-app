import type { Category } from "./types.ts";

export type PresetGlyph = "cart" | "cup" | "fork" | "bus" | "bolt" | "house" | "plus" | "star" | "phone" | "coin";

export type PresetIcon = {
  glyph: PresetGlyph;
  label: string;
};

function haystack(subcategoryId: string, categories: Category[]): string {
  const row = categories.find((item) => item.id === subcategoryId);
  const group = row ? categories.find((item) => item.id === row.parentId) : undefined;
  return `${subcategoryId} ${row?.name ?? ""} ${group?.name ?? ""}`.toLowerCase();
}

/** Small glyph for a preset chip. The visible name is still the note, never the category. */
export function presetIcon(subcategoryId: string, categories: Category[] = []): PresetIcon {
  const hay = haystack(subcategoryId, categories);
  if (/\b(coffee|latte|tim|cafe|café)\b/.test(hay)) return { glyph: "cup", label: "Coffee" };
  if (/\b(groc|food|milk|chili|kitchen)\b/.test(hay)) return { glyph: "cart", label: "Groceries" };
  if (/\b(dine|restaurant|lunch|fun)\b/.test(hay)) return { glyph: "fork", label: "Dining" };
  if (/\b(fuel|transit|transport|bus|uber|gas)\b/.test(hay)) return { glyph: "bus", label: "Transport" };
  if (/\b(electric|hydro|utility|heat|water|internet)\b/.test(hay)) return { glyph: "bolt", label: "Utilities" };
  if (/\b(rent|housing|mortgage)\b/.test(hay)) return { glyph: "house", label: "Housing" };
  if (/\b(health|dental|therapy|vet|doctor|physio)\b/.test(hay)) return { glyph: "plus", label: "Health" };
  if (/\b(phone|mobile)\b/.test(hay)) return { glyph: "phone", label: "Phone" };
  if (/\b(fun|game|play)\b/.test(hay)) return { glyph: "star", label: "Fun" };
  return { glyph: "coin", label: "Preset" };
}

export function presetChipLabel(note: string | null | undefined): string {
  const trimmed = (note ?? "").trim();
  return trimmed || "Preset";
}
