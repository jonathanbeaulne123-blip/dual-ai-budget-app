import type { OnboardingCoordinatorState, OnboardingDiagnostic } from "./types.ts";

/**
 * Diagnostics record only ids, states, and geometry reason codes.
 * Never amounts, notes, names, or journal content.
 */
export function makeDiagnostic(input: {
  code: string;
  state: OnboardingCoordinatorState;
  sceneId?: string;
  targetId?: string;
  geometryReason?: string;
  nowIso?: string;
}): OnboardingDiagnostic {
  return {
    atIso: input.nowIso ?? new Date().toISOString(),
    code: input.code,
    stateKind: input.state.kind,
    sceneId: input.sceneId,
    targetId: input.targetId,
    geometryReason: input.geometryReason,
  };
}

export function assertDiagnosticSafe(diag: OnboardingDiagnostic): void {
  const blob = JSON.stringify(diag);
  // Soft guard for accidental money-ish payloads in codes.
  if (/\$\d|cents|journal|note:|visa|password/i.test(blob)) {
    throw new Error("Onboarding diagnostic must not include household content");
  }
}
