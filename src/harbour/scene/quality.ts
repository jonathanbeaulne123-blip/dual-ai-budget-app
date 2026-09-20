/**
 * Pure quality tiering (BUILD_PLAN §2 #9).
 * full: the Living Presence master, soft shadows, DPR ≤ 1.5.
 * lite: the v1 Queen, no shadows, DPR ≤ 1.0.
 * flat: the reading edition — no WebGL, Save-Data, or `motion: flat` chosen.
 */
export type QualityTier = "full" | "lite" | "flat";
export type RenderTier = Exclude<QualityTier, "flat">;

export type QualityInput = {
  dpr: number;
  /** `navigator.hardwareConcurrency`; unknown reads as 4. */
  cores: number;
  /** The stage's width in CSS pixels. */
  width: number;
  reducedMotion: boolean;
  saveData: boolean;
  webgl: boolean;
  /** `localStorage["hearth:motion"]`; "flat" asks for the reading edition. */
  motion?: string | null;
};

export const DPR_CAP: Readonly<Record<RenderTier, number>> = Object.freeze({ full: 1.5, lite: 1 });

export function qualityTier(input: QualityInput): QualityTier {
  if (!input.webgl || input.saveData || input.motion === "flat") return "flat";
  // Phones carry the 3 MB Queen, not the 13 MB master; so do small machines.
  if (input.width < 720 || input.cores <= 4) return "lite";
  return "full";
}

export function dprCap(tier: RenderTier): number {
  return DPR_CAP[tier];
}

/** Effective device pixel ratio for a tier. */
export function effectiveDpr(tier: RenderTier, dpr: number): number {
  return Math.min(Math.max(1, dpr || 1), dprCap(tier));
}

type NavigatorLike = { hardwareConcurrency?: number; connection?: { saveData?: boolean } };

/** Reads the browser once. Every read is guarded; a missing API reads as the conservative value. */
export function readQualityInput(win: Window, width: number): QualityInput {
  const nav = win.navigator as Navigator & NavigatorLike;
  let motion: string | null = null;
  try { motion = win.localStorage.getItem("hearth:motion"); } catch { motion = null; }
  let webgl = false;
  try {
    const canvas = win.document.createElement("canvas");
    webgl = Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch { webgl = false; }
  return {
    dpr: win.devicePixelRatio || 1,
    cores: typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency > 0 ? nav.hardwareConcurrency : 4,
    width,
    reducedMotion: typeof win.matchMedia === "function" ? win.matchMedia("(prefers-reduced-motion: reduce)").matches : false,
    saveData: Boolean(nav.connection?.saveData),
    webgl,
    motion,
  };
}
