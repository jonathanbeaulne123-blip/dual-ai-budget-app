import { qualityTier, type RenderTier } from "../../harbour/scene/quality.ts";

/**
 * The render tier for a surface that is already holding a WebGL context.
 *
 * `scene/quality.ts`'s own `readQualityInput` probes for WebGL by making a
 * canvas and asking it for a context — the right thing to do before deciding
 * whether to draw at all, and the wrong thing to do on a surface that has a
 * renderer in its hand, where the probe is one more context the page has to
 * carry. Everything else is read the same way, so a phone or a small machine
 * lands on `lite` here exactly as it does in the harbour.
 *
 * `flat` cannot be the answer: the caller is already drawing. A machine that
 * would have read `flat` reads `lite`, the lightest thing there is to draw.
 */
export function renderTierFor(width: number, win: Window = window): RenderTier {
  const nav = win.navigator as Navigator & { hardwareConcurrency?: number; connection?: { saveData?: boolean } };
  let motion: string | null = null;
  try { motion = win.localStorage.getItem("hearth:motion"); } catch { motion = null; }
  const tier = qualityTier({
    dpr: win.devicePixelRatio || 1,
    cores: typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency > 0 ? nav.hardwareConcurrency : 4,
    width,
    reducedMotion: typeof win.matchMedia === "function" ? win.matchMedia("(prefers-reduced-motion: reduce)").matches : false,
    saveData: Boolean(nav.connection?.saveData),
    webgl: true,
    motion,
  });
  return tier === "full" ? "full" : "lite";
}
