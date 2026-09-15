/**
 * The size of the banks on the cellar's rail (2026-09-15).
 *
 * Jonathan: "we need to scale the kitty banks up a little … or users should be
 * able to zoom in and out to toggle scale themselves." Both: the rail stands
 * its cats larger by default, and the person can pinch, ctrl-scroll, press
 * the +/− pane or the +/− keys to set their own scale. The scale is one
 * number the rail turns into a CSS custom property (`--cellar-zoom`): the day
 * cell, the five size bands and the seats all follow it, and the sculpture
 * behind each drawn seat follows the seat. It is remembered per device, never
 * synced, never money.
 */
export const CELLAR_ZOOM = { min: 0.75, max: 2.25, step: 0.25, default: 1.4 } as const;
export const CELLAR_ZOOM_KEY = "hearth.queen.cellar.zoom";

/** Clamp to the rail's range and to a quarter step, so two presses land where one pinch would. */
export function clampCellarZoom(value: number): number {
  if (!Number.isFinite(value)) return CELLAR_ZOOM.default;
  const stepped = Math.round(value / 0.05) * 0.05;
  return Math.min(CELLAR_ZOOM.max, Math.max(CELLAR_ZOOM.min, Number(stepped.toFixed(2))));
}

/** To the next quarter mark in that direction: from 1.4, larger is 1.5 and smaller is 1.25. */
export function stepCellarZoom(current: number, direction: 1 | -1): number {
  const marks = current / CELLAR_ZOOM.step;
  const next = direction > 0 ? Math.floor(marks + 1e-6) + 1 : Math.ceil(marks - 1e-6) - 1;
  return clampCellarZoom(next * CELLAR_ZOOM.step);
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

/** The remembered scale, or the default. Storage may be absent or throw (a private window); the rail still stands. */
export function readCellarZoom(storage?: StorageLike | null): number {
  try {
    const raw = storage?.getItem(CELLAR_ZOOM_KEY);
    if (raw === null || raw === undefined) return CELLAR_ZOOM.default;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? clampCellarZoom(parsed) : CELLAR_ZOOM.default;
  } catch {
    return CELLAR_ZOOM.default;
  }
}

export function storeCellarZoom(value: number, storage?: StorageLike | null): void {
  try {
    storage?.setItem(CELLAR_ZOOM_KEY, String(clampCellarZoom(value)));
  } catch {
    /* a private window forgets; the rail keeps its scale for the session */
  }
}

/** One cell of the rail — one day — in CSS pixels at this scale. The drag step and the track offset use it. */
export const CELLAR_CELL_PX = 44;
export function cellarCellPx(zoom: number): number {
  return Math.round(CELLAR_CELL_PX * zoom);
}
