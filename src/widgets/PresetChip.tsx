import { presetChipLabel, presetIcon, type Category } from "../core/index.ts";

export function PresetChip({
  note,
  subcategoryId,
  categories,
  selected,
  onClick,
}: {
  note: string;
  subcategoryId: string;
  categories: Category[];
  selected?: boolean;
  onClick: () => void;
}) {
  const icon = presetIcon(subcategoryId, categories);
  const label = presetChipLabel(note);
  return (
    <button
      type="button"
      className={`chip preset-chip ${selected ? "selected" : ""}`}
      onClick={onClick}
      title={`${label} · ${icon.label}`}
    >
      <PresetGlyph glyph={icon.glyph} />
      <span>{label}</span>
    </button>
  );
}

function PresetGlyph({ glyph }: { glyph: ReturnType<typeof presetIcon>["glyph"] }) {
  const common = { width: 14, height: 14, viewBox: "0 0 16 16", "aria-hidden": true as const };
  if (glyph === "cup") {
    return <svg {...common}><path d="M3 4h8v5a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V4zm8 1h1.5a2 2 0 0 1 0 4H11" fill="none" stroke="currentColor" strokeWidth="1.4"/><path d="M5 2c.4 1 .4 2 0 3M7.5 2c.4 1 .4 2 0 3" fill="none" stroke="currentColor"/></svg>;
  }
  if (glyph === "cart") {
    return <svg {...common}><path d="M1 2h2l2 8h7l2-6H5" fill="none" stroke="currentColor" strokeWidth="1.4"/><circle cx="7" cy="13" r="1"/><circle cx="12" cy="13" r="1"/></svg>;
  }
  if (glyph === "fork") {
    return <svg {...common}><path d="M5 1v6M7 1v6M9 1v6M7 7v8" fill="none" stroke="currentColor" strokeWidth="1.4"/></svg>;
  }
  if (glyph === "bus") {
    return <svg {...common}><rect x="2" y="4" width="12" height="7" rx="1.5" fill="none" stroke="currentColor"/><circle cx="5" cy="12" r="1"/><circle cx="11" cy="12" r="1"/></svg>;
  }
  if (glyph === "bolt") {
    return <svg {...common}><path d="M9 1 4 9h4l-1 6 5-8H8z" fill="currentColor"/></svg>;
  }
  if (glyph === "house") {
    return <svg {...common}><path d="M2 8 8 2l6 6v6H2z" fill="none" stroke="currentColor"/></svg>;
  }
  if (glyph === "plus") {
    return <svg {...common}><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6"/></svg>;
  }
  if (glyph === "phone") {
    return <svg {...common}><rect x="4" y="1.5" width="8" height="13" rx="1.5" fill="none" stroke="currentColor"/></svg>;
  }
  if (glyph === "star") {
    return <svg {...common}><path d="M8 1.5 9.8 6h4.2L11 9.2 12.5 14 8 11.2 3.5 14 5 9.2 2 6h4.2z" fill="currentColor"/></svg>;
  }
  return <svg {...common}><circle cx="8" cy="8" r="5" fill="none" stroke="currentColor"/><circle cx="8" cy="8" r="1.6" fill="currentColor"/></svg>;
}