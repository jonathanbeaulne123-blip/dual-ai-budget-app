/**
 * Macro soft priors for tip outlook / oracle / year-sim (Worker-cached).
 * Never treated as posted income. Fail soft when unavailable.
 */

export type MacroRegionKey = "CA-ON" | "CA";

export type MacroPrior = {
  regionKey: MacroRegionKey;
  monthKey: string;
  /** Multiplier clamped to [0.9, 1.1] for tip projections. */
  factor: number;
  foodserviceSalesYoY: number | null;
  unemploymentRate: number | null;
  consumerConfidence: number | null;
  source: "worker-cache" | "static-fallback" | "unavailable";
  assumptions: string[];
};

export const MACRO_FACTOR_MIN = 0.9;
export const MACRO_FACTOR_MAX = 1.1;

export function clampMacroFactor(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.round(Math.min(MACRO_FACTOR_MAX, Math.max(MACRO_FACTOR_MIN, value)) * 1000) / 1000;
}

/** Derive a soft tip factor from public-style indicators (disclosed; not GDP typing). */
export function macroFactorFromIndicators(input: {
  foodserviceSalesYoY?: number | null;
  unemploymentRate?: number | null;
  consumerConfidence?: number | null;
}): number {
  let factor = 1;
  const yoy = input.foodserviceSalesYoY;
  if (typeof yoy === "number" && Number.isFinite(yoy)) {
    // ±5% YoY → roughly ±3% tip prior.
    factor *= 1 + Math.max(-0.05, Math.min(0.05, yoy)) * 0.6;
  }
  const unemployment = input.unemploymentRate;
  if (typeof unemployment === "number" && Number.isFinite(unemployment)) {
    // Around 6% baseline; each point above softens tips slightly.
    factor *= 1 - Math.max(-0.03, Math.min(0.04, (unemployment - 6) * 0.008));
  }
  const confidence = input.consumerConfidence;
  if (typeof confidence === "number" && Number.isFinite(confidence)) {
    // Index ~100 baseline.
    factor *= 1 + Math.max(-0.03, Math.min(0.03, (confidence - 100) / 1000));
  }
  return clampMacroFactor(factor);
}

/** Static Ontario/Canada soft prior when Worker fetch is unavailable (tests / offline). */
export function staticMacroPrior(monthKey: string, regionKey: MacroRegionKey = "CA-ON"): MacroPrior {
  const month = Number(monthKey.slice(5, 7));
  // Soft seasonal foodservice prior — disclosed as static fallback, not live StatsCan.
  const seasonalYoY = month >= 6 && month <= 8 ? 0.03 : month === 12 || month === 1 ? 0.01 : 0;
  const unemployment = month >= 11 || month <= 2 ? 6.4 : 5.9;
  const factor = macroFactorFromIndicators({
    foodserviceSalesYoY: seasonalYoY,
    unemploymentRate: unemployment,
    consumerConfidence: 98,
  });
  return {
    regionKey,
    monthKey,
    factor,
    foodserviceSalesYoY: seasonalYoY,
    unemploymentRate: unemployment,
    consumerConfidence: 98,
    source: "static-fallback",
    assumptions: [
      `Macro prior from static ${regionKey} fallback for ${monthKey} (factor ${factor.toFixed(3)}); not live StatsCan.`,
      "Macro soft priors are never posted income.",
    ],
  };
}

export function unavailableMacroPrior(monthKey: string, regionKey: MacroRegionKey = "CA-ON"): MacroPrior {
  return {
    regionKey,
    monthKey,
    factor: 1,
    foodserviceSalesYoY: null,
    unemploymentRate: null,
    consumerConfidence: null,
    source: "unavailable",
    assumptions: ["Macro prior unavailable — tip tools run without a macro multiplier."],
  };
}

export function shapeMacroPrior(raw: unknown, monthKey: string, regionKey: MacroRegionKey = "CA-ON"): MacroPrior {
  if (!raw || typeof raw !== "object") return unavailableMacroPrior(monthKey, regionKey);
  const row = raw as Record<string, unknown>;
  const foodserviceSalesYoY = typeof row.foodserviceSalesYoY === "number" ? row.foodserviceSalesYoY : null;
  const unemploymentRate = typeof row.unemploymentRate === "number" ? row.unemploymentRate : null;
  const consumerConfidence = typeof row.consumerConfidence === "number" ? row.consumerConfidence : null;
  const factor = clampMacroFactor(
    typeof row.factor === "number"
      ? row.factor
      : macroFactorFromIndicators({ foodserviceSalesYoY, unemploymentRate, consumerConfidence }),
  );
  const source = row.source === "worker-cache" || row.source === "static-fallback" || row.source === "unavailable"
    ? row.source
    : "worker-cache";
  const assumptions = Array.isArray(row.assumptions)
    ? row.assumptions.map(String).slice(0, 6)
    : [
      `Macro prior from ${source} for ${regionKey} ${monthKey} (factor ${factor.toFixed(3)}).`,
      "Macro soft priors are never posted income.",
    ];
  return {
    regionKey,
    monthKey: typeof row.monthKey === "string" ? row.monthKey : monthKey,
    factor,
    foodserviceSalesYoY,
    unemploymentRate,
    consumerConfidence,
    source,
    assumptions,
  };
}
