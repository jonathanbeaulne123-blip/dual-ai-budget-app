/**
 * The camera's dead zones around the glass (brief §4.1, A8): a drag, pinch or
 * wheel that *starts* within an element's margin never moves the map. A check
 * on the `pointerdown` origin — never a capture, never `preventDefault`.
 *
 * Every bubble wrapper carries `data-camera-deadzone="44"`; the dock and the
 * open dial can carry `data-camera-deadzone="0"` (their own box) or a margin.
 * The orbit controller asks `inCameraDeadzone(x, y)` before it starts a gesture.
 */
export type Rect = { left: number; top: number; right: number; bottom: number };

/** Pure: is (x, y) inside `rect` grown by `margin` on every side? */
export function withinMargin(x: number, y: number, rect: Rect, margin: number): boolean {
  return x >= rect.left - margin && x <= rect.right + margin && y >= rect.top - margin && y <= rect.bottom + margin;
}

/** Does a gesture starting at (x, y) belong to the glass rather than the camera? */
export function inCameraDeadzone(x: number, y: number, root: ParentNode | null = typeof document === "undefined" ? null : document): boolean {
  if (!root) return false;
  for (const node of root.querySelectorAll<HTMLElement>("[data-camera-deadzone]")) {
    const margin = Number.parseFloat(node.dataset.cameraDeadzone ?? "0") || 0;
    const rect = node.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    if (withinMargin(x, y, rect, margin)) return true;
  }
  return false;
}
