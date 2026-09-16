/**
 * Cellar v3 (D-278–D-280, gated in D-281): pay in glass, contribution banks,
 * missing and smaller subscriptions and their roll-over. Opt-in with
 * `VITE_CELLAR_V3=1` (or `true`). `VITE_QUEENS_NEST` alone (on in Pages)
 * keeps the cellar exactly as it was: no extra jars, no cards, no writes.
 */
export function cellarV3Enabled(value: unknown = import.meta.env.VITE_CELLAR_V3): boolean {
  return value === "1" || value === "true";
}
