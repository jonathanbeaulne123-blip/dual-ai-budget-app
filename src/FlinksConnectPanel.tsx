import { useCallback, useEffect, useMemo, useState } from "react";
import type { Environment } from "./core/types.ts";
import type { ParsedOfxBatch } from "./core/index.ts";
import { ensureSupabaseSession } from "./auth/supabaseSession.ts";
import {
  clearLegacyFlinksLoginStorage,
  completeFlinksConnect,
  disconnectFlinks,
  fetchFlinksStatus,
  importFlinksInbox,
  isFlinksRedirectMessage,
  startFlinksConnect,
  type FlinksConnectionStatus,
  type FlinksConnectStart,
} from "./imports/flinksClient.ts";

export function FlinksConnectPanel({
  environment,
  householdId,
  memberId,
  disabled = false,
  onImported,
  onError,
}: {
  environment: Environment;
  householdId: string;
  memberId: string;
  disabled?: boolean;
  onImported: (batch: ParsedOfxBatch) => void;
  onError: (message: string) => void;
}) {
  const [status, setStatus] = useState<FlinksConnectionStatus | null>(null);
  const [connectSession, setConnectSession] = useState<FlinksConnectStart | null>(null);
  const [busy, setBusy] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);

  const scope = useMemo(() => ({ environment, householdId, memberId }), [environment, householdId, memberId]);

  const refreshStatus = useCallback(async () => {
    const session = await ensureSupabaseSession(environment);
    if (!session) {
      setStatus({
        ok: true,
        configured: false,
        connected: false,
        institution: null,
        accountLabel: null,
        accountLast4: null,
        currency: "CAD",
      });
      return;
    }
    const next = await fetchFlinksStatus({ ...scope, session });
    setStatus(next);
  }, [environment, scope]);

  useEffect(() => {
    clearLegacyFlinksLoginStorage();
    void refreshStatus().catch(() => {
      setStatus({
        ok: true,
        configured: false,
        connected: false,
        institution: null,
        accountLabel: null,
        accountLast4: null,
        currency: "CAD",
      });
    });
  }, [refreshStatus]);

  useEffect(() => {
    if (!connectOpen || !connectSession) return;
    const expectedOrigin = connectSession.iframeOrigin;
    const onMessage = (event: MessageEvent) => {
      if (!isFlinksRedirectMessage(event.data, expectedOrigin, event.origin)) return;
      void (async () => {
        setBusy(true);
        try {
          const session = await ensureSupabaseSession(environment);
          if (!session) throw new Error("Continue with Google in Hearth before using Flinks.");
          const next = await completeFlinksConnect({
            ...scope,
            session,
            sessionId: connectSession.sessionId,
            stateNonce: connectSession.stateNonce,
            iframeOrigin: expectedOrigin,
            message: event.data,
          });
          setStatus(next);
          setConnectOpen(false);
          setConnectSession(null);
        } catch (caught) {
          onError(caught instanceof Error ? caught.message : String(caught));
        } finally {
          setBusy(false);
        }
      })();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [connectOpen, connectSession, environment, onError, scope]);

  async function beginConnect() {
    setBusy(true);
    onError("");
    try {
      const session = await ensureSupabaseSession(environment);
      if (!session) throw new Error("Continue with Google in Hearth before using Flinks.");
      const next = await startFlinksConnect({ ...scope, session });
      setConnectSession(next);
      setConnectOpen(true);
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    setBusy(true);
    onError("");
    try {
      const session = await ensureSupabaseSession(environment);
      if (!session) throw new Error("Continue with Google in Hearth before using Flinks.");
      const { batch } = await importFlinksInbox({ ...scope, session });
      onImported(batch);
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function runDisconnect() {
    setBusy(true);
    onError("");
    try {
      const session = await ensureSupabaseSession(environment);
      if (!session) throw new Error("Continue with Google in Hearth before using Flinks.");
      const next = await disconnectFlinks({ ...scope, session });
      setStatus(next);
      setConnectOpen(false);
      setConnectSession(null);
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  const connected = Boolean(status?.connected);
  const configured = Boolean(status?.configured);

  return (
    <section className="flinks-status" aria-labelledby="flinks-connect-title">
      <header>
        <div>
          <p className="kicker">Development only</p>
          <h3 id="flinks-connect-title">Import from Flinks</h3>
        </div>
      </header>
      <p className="muted">
        Flinks supplies read-only bank evidence to the import inbox. Hearth never posts money from Flinks, and provider identifiers stay on the Worker.
      </p>
      {status && (
        <p className="muted" role="status">
          {connected
            ? `Connected to ${status.institution || "your bank"} · ${status.accountLabel || "linked account"}${status.accountLast4 ? ` · •••• ${status.accountLast4}` : ""}.`
            : configured
              ? "Not connected yet."
              : "Flinks is not configured on the Worker yet."}
        </p>
      )}
      <div className="import-actions">
        {!connected && (
          <button type="button" className="primary" disabled={disabled || busy || !configured} onClick={() => void beginConnect()}>
            Connect Flinks
          </button>
        )}
        {connected && (
          <>
            <button type="button" className="primary" disabled={disabled || busy} onClick={() => void runImport()}>
              Import from Flinks
            </button>
            <button type="button" className="chip" disabled={disabled || busy} onClick={() => void runDisconnect()}>
              Disconnect
            </button>
          </>
        )}
      </div>
      {connectOpen && connectSession?.iframeUrl && (
        <iframe
          className="flinks-connect"
          title="Flinks Connect"
          src={connectSession.iframeUrl}
          height={760}
        />
      )}
    </section>
  );
}
