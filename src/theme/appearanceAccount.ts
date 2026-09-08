import { bearerHeaders, ensureSupabaseSession, loadSupabaseSession, readHearthAuthConfig } from "../auth/supabaseSession.ts";
import { parseAppearance, type Appearance, type AppearanceScope } from "./scenes.ts";

export interface AppearanceAccount {
  read(scope: AppearanceScope, signal: AbortSignal): Promise<Appearance>;
  write(scope: AppearanceScope, value: Partial<Appearance>, signal: AbortSignal): Promise<Appearance>;
}
export const appearanceMetadataKey = (scope: AppearanceScope): string => `hearth_appearance_v1_${scope.environment}`;

/** Cosmetic metadata only. Never pass this data to identity or ledger authority. */
export const appearanceAccount: AppearanceAccount = {
  read: (scope, signal) => userRequest(scope, signal),
  write: async (scope, value, signal) => {
    // Merge only the user’s changed fields into a freshly read account preference.
    // A provisional cache must never overwrite an untouched field during sign-in.
    const sessionId = loadSupabaseSession(scope.environment)?.sessionId;
    const current = await userRequest(scope, signal);
    if (loadSupabaseSession(scope.environment)?.sessionId !== sessionId) throw new Error("The signed-in session changed.");
    return userRequest(scope, signal, parseAppearance({ ...current, ...value }));
  },
};

async function userRequest(scope: AppearanceScope, signal: AbortSignal, value?: Appearance): Promise<Appearance> {
  const config = readHearthAuthConfig();
  if (!config || !scope.userId) throw new Error("Sign in to save your appearance across devices.");
  const sessionId = loadSupabaseSession(scope.environment)?.sessionId;
  const session = await ensureSupabaseSession(scope.environment, config);
  if (signal.aborted || !session || session.userId !== scope.userId
    || session.sessionId !== sessionId
    || loadSupabaseSession(scope.environment)?.userId !== scope.userId) {
    throw new Error("The signed-in account changed. Choose your theme again.");
  }
  const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
    method: value ? "PUT" : "GET", headers: bearerHeaders(session, config.publishableKey), signal,
    ...(value ? { body: JSON.stringify({ data: { [appearanceMetadataKey(scope)]: parseAppearance(value) } }) } : {}),
  });
  if (!response.ok) throw new Error("Your appearance is saved on this device. Account saving needs another try.");
  const user = await response.json() as { id?: unknown; user_metadata?: Record<string, unknown> };
  if (signal.aborted || user.id !== scope.userId || loadSupabaseSession(scope.environment)?.sessionId !== sessionId
    || loadSupabaseSession(scope.environment)?.userId !== scope.userId) {
    throw new Error("The signed-in account changed while appearance was loading.");
  }
  return parseAppearance(user.user_metadata?.[appearanceMetadataKey(scope)]);
}
