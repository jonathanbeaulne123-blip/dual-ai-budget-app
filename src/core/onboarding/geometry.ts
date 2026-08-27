/**
 * Pure safe-rectangle and dialogue-placement geometry for onboarding focus.
 * No DOM access — callers supply measured rectangles.
 */

export type Rect = { x: number; y: number; width: number; height: number };

export type ViewportInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  /** Extra exclusion for sticky header height. */
  header: number;
  /** Extra exclusion for bottom nav height. */
  nav: number;
  /** Software keyboard height when open. */
  keyboard: number;
  /** Reserved band for Hercules sprite. */
  hercules: number;
};

export type DialogueZone = "top" | "bottom" | "desktop-tl" | "desktop-tr" | "desktop-bl" | "desktop-br";

export type GeometryResult = {
  safeTarget: Rect;
  dialogueZone: DialogueZone;
  reason: string;
  ok: boolean;
};

const DIALOGUE_HEIGHT = 120;
const FOCUS_PADDING = 12;

export function defaultInsets(partial?: Partial<ViewportInsets>): ViewportInsets {
  return {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    header: 48,
    nav: 64,
    keyboard: 0,
    hercules: 80,
    ...partial,
  };
}

/** Inner content rectangle after chrome exclusions. */
export function contentBounds(viewport: Rect, insets: ViewportInsets): Rect {
  const x = viewport.x + insets.left;
  const y = viewport.y + insets.top + insets.header;
  const width = Math.max(0, viewport.width - insets.left - insets.right);
  const height = Math.max(
    0,
    viewport.height - insets.top - insets.bottom - insets.header - insets.nav - insets.keyboard,
  );
  return { x, y, width, height };
}

export function inflate(rect: Rect, pad: number): Rect {
  return {
    x: rect.x - pad,
    y: rect.y - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
}

export function clampRectToBounds(rect: Rect, bounds: Rect): Rect {
  const width = Math.min(rect.width, bounds.width);
  const height = Math.min(rect.height, bounds.height);
  const x = Math.min(Math.max(rect.x, bounds.x), bounds.x + bounds.width - width);
  const y = Math.min(Math.max(rect.y, bounds.y), bounds.y + bounds.height - height);
  return { x, y, width, height };
}

function centerY(rect: Rect): number {
  return rect.y + rect.height / 2;
}

function centerX(rect: Rect): number {
  return rect.x + rect.width / 2;
}

function zoneOverlaps(zone: Rect, target: Rect): boolean {
  return !(
    zone.x + zone.width <= target.x ||
    target.x + target.width <= zone.x ||
    zone.y + zone.height <= target.y ||
    target.y + target.height <= zone.y
  );
}

/**
 * Choose dialogue placement opposite the focused target (phone top/bottom)
 * or least-obstructed desktop quadrant.
 */
export function chooseDialogueZone(input: {
  viewport: Rect;
  target: Rect;
  insets: ViewportInsets;
  shell: "phone" | "desktop";
}): { zone: DialogueZone; reason: string } {
  const bounds = contentBounds(input.viewport, input.insets);
  const midY = bounds.y + bounds.height / 2;
  const targetMid = centerY(input.target);

  if (input.shell === "phone") {
    if (targetMid >= midY) {
      return { zone: "top", reason: "target-lower-half" };
    }
    return { zone: "bottom", reason: "target-upper-half" };
  }

  const candidates: { zone: DialogueZone; rect: Rect }[] = [
    {
      zone: "desktop-tl",
      rect: { x: bounds.x, y: bounds.y, width: bounds.width / 2, height: DIALOGUE_HEIGHT },
    },
    {
      zone: "desktop-tr",
      rect: {
        x: bounds.x + bounds.width / 2,
        y: bounds.y,
        width: bounds.width / 2,
        height: DIALOGUE_HEIGHT,
      },
    },
    {
      zone: "desktop-bl",
      rect: {
        x: bounds.x,
        y: bounds.y + bounds.height - DIALOGUE_HEIGHT,
        width: bounds.width / 2,
        height: DIALOGUE_HEIGHT,
      },
    },
    {
      zone: "desktop-br",
      rect: {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height - DIALOGUE_HEIGHT,
        width: bounds.width / 2,
        height: DIALOGUE_HEIGHT,
      },
    },
  ];

  const free = candidates.filter((c) => !zoneOverlaps(c.rect, inflate(input.target, FOCUS_PADDING)));
  if (free.length) {
    // Prefer the quadrant farthest from target center.
    const tx = centerX(input.target);
    const ty = centerY(input.target);
    free.sort((a, b) => {
      const da = Math.hypot(centerX(a.rect) - tx, centerY(a.rect) - ty);
      const db = Math.hypot(centerX(b.rect) - tx, centerY(b.rect) - ty);
      return db - da;
    });
    return { zone: free[0]!.zone, reason: "least-obstructed-quadrant" };
  }

  return {
    zone: targetMid >= midY ? "desktop-tl" : "desktop-bl",
    reason: "fallback-opposite-vertical",
  };
}

export function computeFocusGeometry(input: {
  viewport: Rect;
  target: Rect;
  insets?: Partial<ViewportInsets>;
  shell: "phone" | "desktop";
}): GeometryResult {
  const insets = defaultInsets(input.insets);
  const bounds = contentBounds(input.viewport, insets);

  if (input.target.width <= 0 || input.target.height <= 0) {
    return {
      safeTarget: bounds,
      dialogueZone: "bottom",
      reason: "invalid-target",
      ok: false,
    };
  }

  const padded = inflate(input.target, FOCUS_PADDING);
  const safeTarget = clampRectToBounds(padded, bounds);
  const { zone, reason } = chooseDialogueZone({
    viewport: input.viewport,
    target: safeTarget,
    insets,
    shell: input.shell,
  });

  const fits =
    safeTarget.width > 0 &&
    safeTarget.height > 0 &&
    safeTarget.x >= bounds.x - 0.5 &&
    safeTarget.y >= bounds.y - 0.5;

  return {
    safeTarget,
    dialogueZone: zone,
    reason: fits ? reason : "clamped-outside",
    ok: fits,
  };
}

/** Scroll delta needed to bring target into the safe content band. */
export function scrollDeltaToReveal(target: Rect, bounds: Rect): { dx: number; dy: number } {
  let dy = 0;
  let dx = 0;
  if (target.y < bounds.y) dy = target.y - bounds.y;
  else if (target.y + target.height > bounds.y + bounds.height) {
    dy = target.y + target.height - (bounds.y + bounds.height);
  }
  if (target.x < bounds.x) dx = target.x - bounds.x;
  else if (target.x + target.width > bounds.x + bounds.width) {
    dx = target.x + target.width - (bounds.x + bounds.width);
  }
  return { dx, dy };
}
