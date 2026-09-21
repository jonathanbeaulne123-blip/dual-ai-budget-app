/**
 * Whether a world writes its per-frame numbers onto its host element.
 *
 * `data-render-ms`, `data-draw-calls`, `data-geometries`, `data-textures` and
 * `data-house-camera` are what the evidence captures read and what anyone
 * watching a scene in development reads. Each one is a number formatted into a
 * string and written to the DOM on every painted frame, which is work a
 * shipped page does for nobody, so a built page does not do it.
 *
 * It stays on where it is read:
 * - development (the review server `scripts/serve-whole-house-review.mjs`
 *   runs Vite in dev, so `scripts/capture-little-harbour-evidence.py` keeps
 *   its diagnostics) and tests;
 * - a built page asked for it with `?diagnostics=1`;
 * - a built page asked for it with `localStorage["hearth:diagnostics"] = "1"`.
 *
 * Read once and kept: this is consulted on the hot path.
 */
let answer: boolean | null = null;

export function worldDiagnostics(): boolean {
  if (answer === null) answer = read();
  return answer;
}

/** Tests and captures may say so directly; `null` puts the question back to the page. */
export function setWorldDiagnostics(on: boolean | null): void {
  answer = on;
}

function read(): boolean {
  try { if (import.meta.env?.DEV) return true; } catch { /* no bundler env */ }
  if (typeof window === "undefined") return false;
  try { if (new URLSearchParams(window.location.search).get("diagnostics") === "1") return true; } catch { /* an opaque location */ }
  try { if (window.localStorage.getItem("hearth:diagnostics") === "1") return true; } catch { /* storage refused */ }
  return false;
}
