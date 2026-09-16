/**
 * Our Path words (review fix, D-264): people's own text reaches the island as
 * words only. Pure: collapses whitespace, removes anything that reads like an
 * amount or a number (`$1,450`, `7.25`, `100$`) and any stray `$`, trims, and
 * caps at `max` characters on a word boundary with "…". Empty → `fallback`.
 *
 * Deliberately blunt: every digit run goes, so "Trip 2027" reads "Trip". A year
 * or a count is a small loss; an amount on a shared screen is not.
 */

const AMOUNTISH = /\$?\s?\d[\d,]*(\.\d+)?\s?\$?/g;

export function pathWords(text: string | null | undefined, max: number, fallback: string): string {
  const words = String(text ?? "")
    .replace(/\s+/g, " ")
    .replace(AMOUNTISH, " ")
    .replace(/\$/g, " ")
    .replace(/\(\s*\)/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+([,.;:!?)])/g, "$1")
    .trim();
  if (!words) return fallback;
  if (!Number.isFinite(max) || words.length <= max) return words;
  const limit = Math.max(1, Math.floor(max));
  const cut = words.slice(0, limit - 1);
  const space = cut.lastIndexOf(" ");
  const kept = (space > limit / 3 ? cut.slice(0, space) : cut).replace(/[\s.,;:!?-]+$/, "");
  return kept ? `${kept}…` : fallback;
}
