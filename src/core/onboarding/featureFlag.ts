import { ONBOARDING_FOUNDATION_FLAG } from "./types.ts";

/** Build-time gate for incomplete foundation shell / Replay. */
export function isOnboardingFoundationEnabled(
  env: { VITE_ONBOARDING_FOUNDATION?: string } = typeof import.meta !== "undefined"
    ? (import.meta as ImportMeta & { env: { VITE_ONBOARDING_FOUNDATION?: string } }).env
    : {},
): boolean {
  return String(env?.VITE_ONBOARDING_FOUNDATION || "") === "1";
}

export { ONBOARDING_FOUNDATION_FLAG };
