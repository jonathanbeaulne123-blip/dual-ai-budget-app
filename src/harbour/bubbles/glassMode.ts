import { useEffect, useState } from "react";
import { LABEL_HIDE_AFTER } from "./usage.ts";

/**
 * When the glass turns solid, and when a bubble wears its word (brief §4.2, §4.3).
 * Pure rules plus one hook that reads the browser; the CSS repeats every media
 * query, so a browser the hook cannot read still gets the solid fallback.
 */
export type GlassEnvironment = {
  reducedTransparency: boolean;
  reducedMotion: boolean;
  contrastMore: boolean;
  forcedColors: boolean;
  saveData: boolean;
  /** Root text at ≥ 125 % of 16 px. */
  largeText: boolean;
};

export const QUIET_ENVIRONMENT: GlassEnvironment = Object.freeze({
  reducedTransparency: false, reducedMotion: false, contrastMore: false, forcedColors: false, saveData: false, largeText: false,
});

export type GlassSwitches = {
  /** The Quiet / calm Comfort setting. */
  calm?: boolean;
  /** The lite quality tier (`scene/quality.ts`). */
  lite?: boolean;
  /** The three.js frame budget was missed for a second (the integrator flips this). */
  frameOverBudget?: boolean;
};

/** Pure: solid (no blur, opaque, a 1 px line) or glass. */
export function glassMode(env: GlassEnvironment, switches: GlassSwitches = {}): "solid" | "glass" {
  return env.reducedTransparency || env.reducedMotion || env.contrastMore || env.forcedColors || env.saveData
    || switches.calm || switches.lite || switches.frameOverBudget ? "solid" : "glass";
}

/**
 * Pure: does the bubble show its label pill at rest? Until this person has
 * used it five times, yes; after that the word returns on long-press, focus
 * and hover. Never hidden under more contrast, large text, calm view or
 * "Always show labels".
 */
export function labelAtRest(input: { usedCount: number; alwaysShowLabels?: boolean; calm?: boolean; env?: Pick<GlassEnvironment, "contrastMore" | "largeText"> }): boolean {
  if (input.alwaysShowLabels || input.calm || input.env?.contrastMore || input.env?.largeText) return true;
  return input.usedCount < LABEL_HIDE_AFTER;
}

const QUERIES = {
  reducedTransparency: "(prefers-reduced-transparency: reduce)",
  reducedMotion: "(prefers-reduced-motion: reduce)",
  contrastMore: "(prefers-contrast: more)",
  forcedColors: "(forced-colors: active)",
} as const;

function read(): GlassEnvironment {
  if (typeof window === "undefined") return QUIET_ENVIRONMENT;
  const media = (query: string) => { try { return typeof window.matchMedia === "function" && window.matchMedia(query).matches; } catch { return false; } };
  let saveData = false;
  try { saveData = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData); } catch { saveData = false; }
  let largeText = false;
  try { largeText = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) >= 20; } catch { largeText = false; }
  return {
    reducedTransparency: media(QUERIES.reducedTransparency),
    reducedMotion: media(QUERIES.reducedMotion),
    contrastMore: media(QUERIES.contrastMore),
    forcedColors: media(QUERIES.forcedColors),
    saveData,
    largeText,
  };
}

const same = (a: GlassEnvironment, b: GlassEnvironment) => (Object.keys(a) as (keyof GlassEnvironment)[]).every((key) => a[key] === b[key]);

/** The browser's side of the rule, kept current as the person changes a setting. */
export function useGlassEnvironment(): GlassEnvironment {
  const [env, setEnv] = useState<GlassEnvironment>(read);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const update = () => setEnv((current) => { const next = read(); return same(current, next) ? current : next; });
    const lists = Object.values(QUERIES).map((query) => { try { return window.matchMedia(query); } catch { return null; } }).filter((list): list is MediaQueryList => Boolean(list));
    for (const list of lists) list.addEventListener?.("change", update);
    window.addEventListener("resize", update);
    return () => { for (const list of lists) list.removeEventListener?.("change", update); window.removeEventListener("resize", update); };
  }, []);
  return env;
}
