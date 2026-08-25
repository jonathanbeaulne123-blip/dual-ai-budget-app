import type { Environment } from "../core/types.ts";

/**
 * Production hosted continuity stays off until Jonathan enables it after export,
 * privileged membership seed, and Personal destination decisions (D-123 path B).
 * Development remains open for the disposable-data window.
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
 * Phrase/`linked` unprojected transport remains Development-only.
 * Production may only use Google-matched projected continuity when the flag is on.
 */
export function unprojectedHostedTransportAllowed(environment: Environment): boolean {
  return environment === "development";
}
