import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

const SESSION_PREFIX = "hearth:session:v1:";
const SUPABASE_AUTH_PREFIX = "hearth:v1:supabase-auth:";
const GOOGLE_TOKEN_RE = /^hearth:v1:[^:]+:(google|gcal):/;

/** Clears Google / Auth keys on this phone. Never touches household replicas or PGlite books. */
export function clearKitchenGoogleSessions(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith(SUPABASE_AUTH_PREFIX) || GOOGLE_TOKEN_RE.test(key)) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    // Private mode can throw.
  }
}

/** Drops the remembered member so the next load is welcome, not a kitchen remount. Replicas stay. */
export function clearKitchenMemberSession(): void {
  try {
    localStorage.removeItem(`${SESSION_PREFIX}development`);
    localStorage.removeItem(`${SESSION_PREFIX}production`);
  } catch {
    // Private mode can throw.
  }
}

/**
 * App-level recovery for kitchen throws. Welcome has no ErrorBoundary need;
 * household open is where Office, shift preview, and Google continuity run.
 * Recovery never posts money.
 */
export class KitchenErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Hearth kitchen could not open", error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="welcome" data-kitchen-recovery="1">
        <div className="welcome-card">
          <p className="kicker">On this device</p>
          <h1>The kitchen could not open</h1>
          <p>
            Welcome still works. Opening this household hit a bug. Nothing was posted. Reload, sign out of Google on this phone, or go back to welcome.
          </p>
          <button className="primary" type="button" onClick={() => window.location.reload()}>
            Reload
          </button>
          <button
            className="ghost"
            type="button"
            style={{ width: "100%", marginTop: 8 }}
            onClick={() => {
              clearKitchenGoogleSessions();
              window.location.reload();
            }}
          >
            Sign out of Google and reload
          </button>
          <button
            className="ghost"
            type="button"
            style={{ width: "100%", marginTop: 8 }}
            onClick={() => {
              clearKitchenMemberSession();
              window.location.reload();
            }}
          >
            Open welcome
          </button>
        </div>
      </div>
    );
  }
}
