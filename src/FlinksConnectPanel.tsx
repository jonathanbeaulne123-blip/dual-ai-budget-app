import { useEffect, useRef, useState } from "react";
import { parseFlinksInbox, type Environment, type ParsedFlinksBatch } from "./core/index.ts";
import { KitchenNotice } from "./KitchenNotice.tsx";
import {
  clearLegacyFlinksLoginStorage,
  completeFlinksConnect,
  listFlinksConnections,
  pollFlinksPull,
  readFlinksStatus,
  revokeFlinksConnection,
  startFlinksConnect,
  type FlinksConnectSession,
  type FlinksPullResult,
  type FlinksScope,
} from "./imports/flinksClient.ts";

type State = "idle" | "starting" | "connecting" | "retrieving" | "ready" | "revoking" | "error";

export function FlinksConnectPanel({
  environment,
  householdId,
  memberId,
  scopeKey,
  generation,
  disabled,
  onStage,
  onGoMore,
}: {
  environment: Environment;
  householdId: string;
  memberId: string;
  scopeKey: string;
  generation: number;
  disabled: boolean;
  onStage: (batch: ParsedFlinksBatch, expectedScopeKey: string, expectedGeneration: number, connectionId: string) => void;
  onGoMore?: () => void;
}) {
  const scope: FlinksScope = { environment, householdId, memberId };
  const [state, setState] = useState<State>("idle");
  const [notice, setNotice] = useState("");
  const [session, setSession] = useState<FlinksConnectSession | null>(null);
  const [connectedId, setConnectedId] = useState<string | null>(null);
  const [connectedState, setConnectedState] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const completingRef = useRef(false);
  const mountedScopeRef = useRef(`${scopeKey}|${generation}`);
  mountedScopeRef.current = `${scopeKey}|${generation}`;

  useEffect(() => clearLegacyFlinksLoginStorage(), []);
  useEffect(() => () => controllerRef.current?.abort(), []);
  useEffect(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    completingRef.current = false;
    setSession(null);
    setConnectedId(null);
    setConnectedState(null);
    setState("idle");
    setNotice("");
  }, [scopeKey, generation]);

  function stillCurrent(expected: string) {
    return mountedScopeRef.current === expected;
  }

  async function start() {
    if (state !== "idle" && state !== "error") return;
    const expected = `${scopeKey}|${generation}`;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState("starting");
    setNotice("");
    try {
      const status = await readFlinksStatus();
      if (!stillCurrent(expected)) return;
      if (!status.available) {
        setState("error");
        setNotice(status.detail);
        return;
      }
      const existing = await listFlinksConnections(scope, controller.signal);
      if (!stillCurrent(expected)) return;
      const existingConnection = existing[0];
      if (existingConnection) {
        setConnectedId(existingConnection.connectionId);
        setConnectedState(existingConnection.state);
        setState("ready");
        setNotice(["ready", "polling"].includes(existingConnection.state)
          ? "This member already has a Flinks connection. Fetch posted transactions or disconnect it."
          : "This member has an unfinished Flinks connection. Disconnect it before starting another.");
        return;
      }
      const next = await startFlinksConnect(scope, controller.signal);
      if (!stillCurrent(expected)) return;
      setSession(next);
      setState("connecting");
      setNotice("Flinks is open. Sign in to the Development demo institution; nothing enters the books yet.");
    } catch (caught) {
      if (!controller.signal.aborted && stillCurrent(expected)) {
        setState("error");
        setNotice(caught instanceof Error ? caught.message : String(caught));
      }
    }
  }

  async function handleReady(result: FlinksPullResult, expected: string, signal: AbortSignal) {
    let current = result;
    for (let attempt = 0; current.status === "pending" && attempt < 180; attempt += 1) {
      const retryAfterMs = current.retryAfterMs;
      await new Promise<void>((resolve, reject) => {
        const onAbort = () => { window.clearTimeout(timeout); reject(new DOMException("Aborted", "AbortError")); };
        const timeout = window.setTimeout(() => {
          signal.removeEventListener("abort", onAbort);
          resolve();
        }, Math.max(10_000, retryAfterMs));
        signal.addEventListener("abort", onAbort, { once: true });
      });
      if (!stillCurrent(expected)) return;
      current = await pollFlinksPull(scope, current.connectionId, signal);
    }
    if (current.status !== "ready") throw new Error("Flinks is still processing after 30 minutes. Try again.");
    if (!stillCurrent(expected)) return;
    const batch = parseFlinksInbox(current.payload);
    onStage(batch, scopeKey, generation, current.connectionId);
    setConnectedId(current.connectionId);
    setConnectedState("ready");
    setState("ready");
    setNotice(`${batch.rows.length} posted bank transaction${batch.rows.length === 1 ? " is" : "s are"} staged for review. Flinks did not post money.`);
    setSession(null);
  }

  useEffect(() => {
    if (!session || state !== "connecting") return;
    const expected = `${scopeKey}|${generation}`;
    const listener = (event: MessageEvent) => {
      if (event.origin !== session.messageOrigin || event.source !== iframeRef.current?.contentWindow || completingRef.current) return;
      const data = event.data;
      if (!data || typeof data !== "object" || data.step !== "REDIRECT" || typeof data.url !== "string") return;
      completingRef.current = true;
      setState("retrieving");
      setNotice("Flinks connected. Retrieving posted CAD evidence for the inbox…");
      const controller = controllerRef.current ?? new AbortController();
      controllerRef.current = controller;
      void completeFlinksConnect(scope, session.connectionId, data.url, controller.signal)
        .then((result) => handleReady(result, expected, controller.signal))
        .catch((caught) => {
          if (!controller.signal.aborted && stillCurrent(expected)) {
            setState("error");
            setNotice(caught instanceof Error ? caught.message : String(caught));
          }
        })
        .finally(() => { completingRef.current = false; });
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [generation, scopeKey, session, state]);

  async function refresh() {
    if (!connectedId || !["ready", "polling"].includes(connectedState ?? "") || state === "retrieving") return;
    const expected = `${scopeKey}|${generation}`;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState("retrieving");
    setNotice("Retrieving posted CAD evidence for the inbox…");
    try {
      await handleReady(await pollFlinksPull(scope, connectedId, controller.signal), expected, controller.signal);
    } catch (caught) {
      if (!controller.signal.aborted && stillCurrent(expected)) {
        setState("error");
        setNotice(caught instanceof Error ? caught.message : String(caught));
      }
    }
  }

  async function disconnect() {
    const connectionId = session?.connectionId ?? connectedId;
    if (!connectionId || state === "revoking") return;
    const expected = `${scopeKey}|${generation}`;
    setState("revoking");
    try {
      await revokeFlinksConnection(scope, connectionId);
      if (!stillCurrent(expected)) return;
      setSession(null);
      setConnectedId(null);
      setConnectedState(null);
      setState("idle");
      setNotice("Flinks access was disconnected. Accepted Hearth journal history was not changed.");
    } catch (caught) {
      if (stillCurrent(expected)) {
        setState("error");
        setNotice(caught instanceof Error ? caught.message : String(caught));
      }
    }
  }

  return (
    <>
      <button type="button" className="chip" disabled={disabled || Boolean(connectedId) || state === "starting" || state === "retrieving" || state === "revoking"} onClick={() => void start()}>
        {state === "starting" ? "Checking Flinks…" : state === "retrieving" ? "Retrieving bank evidence…" : connectedId ? "Flinks connected" : "Connect bank with Flinks"}
      </button>
      {connectedId && ["ready", "polling"].includes(connectedState ?? "") && <button type="button" className="chip" disabled={disabled || state === "retrieving" || state === "revoking"} onClick={() => void refresh()}>{state === "retrieving" ? "Retrieving bank evidence…" : "Fetch posted transactions"}</button>}
      {connectedId && !session && <button type="button" className="ghost" disabled={state === "revoking"} onClick={() => void disconnect()}>{state === "revoking" ? "Disconnecting Flinks…" : "Disconnect Flinks"}</button>}
      {state === "error"
        ? <KitchenNotice message={notice} onGoMore={onGoMore} onDismiss={() => setNotice("")} />
        : notice ? <p className="muted flinks-status" role="status">{notice}</p> : null}
      {session && (
        <div className="sheet flinks-connect" role="dialog" aria-modal="true" aria-labelledby="flinks-connect-title">
          <div className="sheet-inner">
            <div className="topbar">
              <div><p className="kicker">Development Bank Inbox</p><h1 id="flinks-connect-title">Connect with Flinks</h1></div>
              <button type="button" className="ghost" disabled={state === "retrieving" || state === "revoking"} onClick={() => void disconnect()}>Disconnect</button>
            </div>
            <p>Flinks supplies evidence only. You will still review every posted CAD row and use Hearth's final Confirm.</p>
            <iframe ref={iframeRef} title="Flinks secure bank connection" src={session.iframeUrl} referrerPolicy="no-referrer" sandbox="allow-forms allow-scripts allow-same-origin allow-popups" />
          </div>
        </div>
      )}
    </>
  );
}
