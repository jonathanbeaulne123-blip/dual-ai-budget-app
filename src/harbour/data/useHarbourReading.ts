/**
 * The Court's reading, frozen the way `QueenHome` freezes hers (BUILD_PLAN §5):
 * while the shared books are current the live reading is shown and captured;
 * when the sync layer says stale/offline/connecting, the last supported
 * reading for this identity is shown with a "Supported as of…" line instead
 * of newer numbers nobody has verified. Without a capture the reading falls
 * back to the one computed under the real freshness, which says "Checking".
 *
 * The capture lives in memory for the tab only. It holds no Household payload
 * and grants no command authority.
 */
import { useEffect, useMemo } from "react";
import type { DateKey } from "../../core/calendar.ts";
import type { FundPulseFreshness } from "../../core/fundPulse.ts";
import type { Household } from "../../core/types.ts";
import { interpretationIdentity, resolveSupportedInterpretation, supportedAtFor, type InterpretationGate, type SupportedSection } from "../../house/supportedInterpretation.ts";
import { buildHarbourReading, type HarbourReading } from "./reading.ts";

export type UseHarbourReadingInput = {
  household: Household;
  memberId: string;
  today: DateKey;
  freshness: FundPulseFreshness;
  interpretationGate?: InterpretationGate;
};

export type HarbourReadingResult = { reading: HarbourReading; statusLine: string | null };

/** Same words `QueenHome` uses when the app gives no gate of its own. */
export function harbourGateFor(freshness: FundPulseFreshness): InterpretationGate {
  return {
    current: freshness === "current",
    freshness,
    detail: freshness === "offline" ? "Offline" : freshness === "stale" ? "Shared evidence needs attention" : "Current shared books",
  };
}

const captures = new Map<string, SupportedSection<HarbourReading>>();

/** Test seam: forget every in-memory capture. */
export function resetHarbourReadingCaptures(): void { captures.clear(); }

export function useHarbourReading({ household, memberId, today, freshness, interpretationGate }: UseHarbourReadingInput): HarbourReadingResult {
  const gate = interpretationGate ?? harbourGateFor(freshness);
  const identity = interpretationIdentity({ environment: household.environment, householdId: household.householdId, memberId, scope: "household" });
  const current = useMemo(() => buildHarbourReading(household, memberId, today, "current"), [household, memberId, today]);
  const fallbackFreshness=gate.current?freshness:freshness==="current"?"stale":freshness;
  const fallback = useMemo(() => fallbackFreshness === "current" ? current : buildHarbourReading(household, memberId, today, fallbackFreshness), [household, memberId, today, fallbackFreshness, current]);
  const supportedAt = supportedAtFor(household, today);
  const resolved = useMemo(
    () => resolveSupportedInterpretation({ gate, current, fallback, cached: captures.get(identity), sourceRevision: household.revision, supportedAt }),
    [gate.current, gate.detail, current, fallback, identity, household.revision, supportedAt], // eslint-disable-line react-hooks/exhaustive-deps
  );
  useEffect(() => { if (resolved.capture) captures.set(identity, resolved.capture); }, [identity, resolved.capture]);
  return { reading: {...resolved.result.value,basin:resolved.result.value.basin?{...resolved.result.value.basin,motion:gate.current}:undefined}, statusLine: resolved.result.statusLine };
}
