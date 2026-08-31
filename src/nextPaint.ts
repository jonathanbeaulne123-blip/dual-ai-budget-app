/** Yield once for Saving chrome, but never strand a hidden-tab command on rAF. */
export function afterNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const fallback = setTimeout(finish, 50);
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        clearTimeout(fallback);
        finish();
      });
    } else {
      clearTimeout(fallback);
      setTimeout(finish, 0);
    }
  });
}
