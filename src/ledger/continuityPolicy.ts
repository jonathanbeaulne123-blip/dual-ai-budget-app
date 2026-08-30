import type { Environment } from "../core/types.ts";

/**
 * Production hosted continuity is a build-time gate. The current Pages workflow
 * bakes it on, which exposes only the authenticated, membership-scoped REST path;
 * that is not Production-readiness proof. Production Realtime remains refused by
 * continuityRealtimePolicy. Development remains the proven continuity environment.
 */
export function productionContinuityEnabled(): boolean {
  return String(import.meta.env.VITE_PRODUCTION_CONTINUITY || "") === "1";
}

/** Named policy both App and transport layers must call — not a UI ternary alone. */
export function hostedContinuityAllowed(environment: Environment): boolean {
  if (environment === "development") return true;
  if (environment === "production") return productionContinuityEnabled();
  return false;
}

/**
 * Explicit legacy `linked` publish (Pairing recovery when Auth is off) stays
 * Development-only. Automatic commits never use this path (D-143): Auth JWT +
 * continuity membership is the sole automatic continuity authority.
 * Production may only use Google-matched projected continuity when the flag is on.
 */
export function unprojectedHostedTransportAllowed(environment: Environment): boolean {
  return environment === "development";
}

/** True when a caller explicitly opts into legacy linked publish (not automatic commit). */
export function legacyLinkedPublishAllowed(environment: Environment): boolean {
  return unprojectedHostedTransportAllowed(environment);
}
