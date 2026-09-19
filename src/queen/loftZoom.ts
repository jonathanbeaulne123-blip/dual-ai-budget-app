/**
 * The size of the loft's banks (2026-09-15). Jonathan: "you should also be able
 * to zoom in the loft like you can in the cellar." One number, as in the
 * cellar: a pinch on the rack, ctrl-scroll, the +/− pane or the +/− keys set
 * it; the rack scrolls inside itself when the banks outgrow the wall. It is
 * remembered on this device, never synced, never money.
 */
export const LOFT_ZOOM = { min: 0.5, max: 3, step: 0.25, default: 1 } as const;
export const LOFT_ZOOM_KEY = "hearth.queen.loft.zoom";
type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function clampLoftZoom(value: number): number {
  if (!Number.isFinite(value)) return LOFT_ZOOM.default;
  return Math.min(LOFT_ZOOM.max, Math.max(LOFT_ZOOM.min, Number((Math.round(value / 0.05) * 0.05).toFixed(2))));
}
export function stepLoftZoom(current: number, direction: 1 | -1): number {
  const marks = current / LOFT_ZOOM.step;
  const next = direction > 0 ? Math.floor(marks + 1e-6) + 1 : Math.ceil(marks - 1e-6) - 1;
  return clampLoftZoom(next * LOFT_ZOOM.step);
}
export function readLoftZoom(storage?: StorageLike | null): number {
  try {
    const raw = storage?.getItem(LOFT_ZOOM_KEY);
    if (raw === null || raw === undefined) return LOFT_ZOOM.default;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? clampLoftZoom(parsed) : LOFT_ZOOM.default;
  } catch {
    return LOFT_ZOOM.default;
  }
}
export function storeLoftZoom(value: number, storage?: StorageLike | null): void {
  try { storage?.setItem(LOFT_ZOOM_KEY, String(clampLoftZoom(value))); } catch { /* a private window forgets */ }
}
