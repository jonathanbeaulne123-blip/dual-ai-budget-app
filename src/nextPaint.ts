/**
 * Wait until the browser has had a paint opportunity between two animation
 * callbacks. Hidden tabs use a bounded fallback, which is intentionally not a
 * paint witness and must not enter painted latency evidence.
 */
export type NextPaintWitness = {
  painted: boolean;
  status: "painted" | "hidden-fallback" | "visible-timeout" | "unavailable";
};

export function afterNextPaint(options?: { evidence?: boolean }): Promise<NextPaintWitness> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (witness: NextPaintWitness) => {
      if (settled) return;
      settled = true;
      resolve(witness);
    };
    const hidden = typeof document === "undefined" || document.visibilityState === "hidden";
    const fallback = setTimeout(() => finish({
      painted: false,
      status: hidden ? "hidden-fallback" : "visible-timeout",
    }), hidden || options?.evidence !== true ? 50 : 2_000);
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          clearTimeout(fallback);
          finish({ painted: true, status: "painted" });
        });
      });
    } else {
      clearTimeout(fallback);
      setTimeout(() => finish({ painted: false, status: "unavailable" }), 0);
    }
  });
}
