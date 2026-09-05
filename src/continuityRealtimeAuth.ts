import {
  supabaseSessionMatchesGoogleIdentity,
  type HearthSupabaseSession,
} from "./auth/supabaseSession.ts";
import type { ContinuityIdentity } from "./continuity.ts";

export type ContinuityRealtimeAccessTokenProviderInput = {
  initialSession: HearthSupabaseSession;
  identity: ContinuityIdentity;
  ensureSession: () => Promise<HearthSupabaseSession | null>;
  validateMembership: (session: HearthSupabaseSession) => Promise<boolean>;
};

/**
 * Supplies the Realtime client with a current Hearth Auth JWT.
 * The already-proved session may be reused. Any changed session must still
 * represent the original Google identity and active household membership.
 */
export function createContinuityRealtimeAccessTokenProvider(
  input: ContinuityRealtimeAccessTokenProviderInput,
): () => Promise<string> {
  let currentAccessToken = input.initialSession.accessToken;

  return async () => {
    const session = await input.ensureSession();
    if (!session) {
      throw new Error("Realtime needs Google confirmation again.");
    }
    if (
      session.userId !== input.initialSession.userId
      || !supabaseSessionMatchesGoogleIdentity(session, input.identity)
    ) {
      throw new Error("The Google account changed while Realtime was refreshing.");
    }
    if (session.accessToken !== currentAccessToken) {
      if (!await input.validateMembership(session)) {
        throw new Error("Realtime membership changed while the session was refreshing.");
      }
      currentAccessToken = session.accessToken;
    }
    return currentAccessToken;
  };
}
