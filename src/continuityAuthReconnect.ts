import type { Environment } from "./core/types.ts";
import {
  readHearthAuthConfig,
  startSupabaseGoogleSignIn,
} from "./auth/supabaseSession.ts";

export function continuityAuthReconnectRequired(input: {
  environment: Environment;
  authEnabled: boolean;
  hostedAllowed: boolean;
  continuityActive: boolean;
  hasHousehold: boolean;
  hasMember: boolean;
  authSessionPresent: boolean;
}): boolean {
  return input.continuityActive
    && input.hasHousehold
    && input.hasMember
    && !input.authSessionPresent
    && input.environment === "development"
    && input.authEnabled
    && input.hostedAllowed;
}

type StartGoogleSignIn = typeof startSupabaseGoogleSignIn;

/** Explicit recovery only: never call this from a timer, focus, or reconnect loop. */
export function beginContinuityAuthReconnect(
  environment: Environment,
  returnUrl: string,
  startGoogleSignIn: StartGoogleSignIn = startSupabaseGoogleSignIn,
): boolean {
  return startGoogleSignIn(
    environment,
    returnUrl,
    readHearthAuthConfig(),
    (url) => window.location.assign(url),
    { selectAccount: true },
  );
}
