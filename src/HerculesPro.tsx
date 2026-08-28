import { useEffect, useState } from "react";
import type { Environment, HerculesProPermissions, Household } from "./core/types.ts";
import type { Session } from "./session.ts";
import {
  loadSupabaseSession,
  ensureSupabaseSession,
  startSupabaseGoogleSignIn,
} from "./auth/supabaseSession.ts";
import { ConfirmSheet } from "./Confirm.tsx";
import { KitchenNotice } from "./KitchenNotice.tsx";

export function herculesProAuthorizationRequest(url = window.location.href): string | null {
  try {
    return new URL(url).searchParams.get("herculesProAuthorize");
  } catch {
    return null;
  }
}

export function herculesProLaunchUrl(): string {
  return String(
    import.meta.env.VITE_HERCULES_PRO_URL
      || "https://chatgpt.com/plugins/plugin_asdk_app_6a8e199c18908191b5005692b56f69d6",
  ).trim();
}

export function launchHerculesPro(): void {
  window.open(herculesProLaunchUrl(), "_blank", "noopener,noreferrer");
}

const DISABLED_PERMISSIONS: HerculesProPermissions = {
  personalWrite: false,
  householdWrite: false,
  updatedAt: null,
};

function permissionsPath(environment: Environment, householdId: string, memberId: string): string {
  const query = new URLSearchParams({ environment, householdId, memberId });
  return `/hercules-pro/permissions?${query}`;
}

async function requestPermissions(input: {
  environment: Environment;
  householdId: string;
  memberId: string;
  next?: Pick<HerculesProPermissions, "personalWrite" | "householdWrite">;
}): Promise<HerculesProPermissions> {
  const cloud = await ensureSupabaseSession(input.environment);
  if (!cloud) throw new Error("Continue with Google before changing Hercules Pro permissions.");
  const response = await fetch(permissionsPath(input.environment, input.householdId, input.memberId), {
    method: input.next ? "PUT" : "GET",
    headers: {
      Authorization: `Bearer ${cloud.accessToken}`,
      ...(input.next ? { "Content-Type": "application/json" } : {}),
    },
    ...(input.next ? { body: JSON.stringify(input.next) } : {}),
  });
  const body = await response.json() as { ok?: boolean; permissions?: HerculesProPermissions; error?: string };
  if (!response.ok || !body.ok || !body.permissions) throw new Error(body.error || "Hercules Pro permissions could not be saved.");
  return body.permissions;
}

export function HerculesProPermissionsCard({
  environment,
  household,
  session,
  onChanged,
}: {
  environment: Environment;
  household: Household;
  session: Session;
  onChanged?: (permissions: HerculesProPermissions) => void;
}) {
  const [permissions, setPermissions] = useState<HerculesProPermissions>(
    household.herculesProPermissions ?? DISABLED_PERMISSIONS,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pendingEnable, setPendingEnable] = useState<"personal" | "household" | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    void requestPermissions({
      environment,
      householdId: household.householdId,
      memberId: session.memberId,
    }).then((next) => {
      if (!live) return;
      setPermissions(next);
      onChanged?.(next);
    }).catch((caught) => {
      if (live) setError(caught instanceof Error ? caught.message : String(caught));
    }).finally(() => {
      if (live) setLoading(false);
    });
    return () => { live = false; };
  }, [environment, household.householdId, session.memberId]);

  async function save(next: Pick<HerculesProPermissions, "personalWrite" | "householdWrite">): Promise<void> {
    setSaving(true);
    setError("");
    try {
      const saved = await requestPermissions({
        environment,
        householdId: household.householdId,
        memberId: session.memberId,
        next,
      });
      setPermissions(saved);
      onChanged?.(saved);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSaving(false);
      setPendingEnable(null);
    }
  }

  function choose(view: "personal" | "household", checked: boolean): void {
    if (checked) {
      setPendingEnable(view);
      return;
    }
    void save({
      personalWrite: view === "personal" ? false : permissions.personalWrite,
      householdWrite: view === "household" ? false : permissions.householdWrite,
    });
  }

  const memberName = household.members.find((member) => member.id === session.memberId)?.name || "This member";
  return (
    <>
      <section className="card">
        <header><h2>Hercules Pro permissions</h2><span className={`pill ${permissions.personalWrite || permissions.householdWrite ? "warn" : "good"}`}>{permissions.personalWrite || permissions.householdWrite ? "writes on" : "read-only"}</span></header>
        <p className="muted">
          Free Hercules is unchanged. ChatGPT reads stay available. Writing is member-owned, off by default, and can only add a prepared transaction after you confirm the exact preview in ChatGPT.
        </p>
        <label style={{ marginTop: 10 }}>
          <input
            type="checkbox"
            checked={permissions.personalWrite}
            disabled={loading || saving || environment === "production"}
            onChange={(event) => choose("personal", event.target.checked)}
          />
          {" "}Allow {memberName} to post to their Personal ledger from ChatGPT
        </label>
        <label style={{ marginTop: 10 }}>
          <input
            type="checkbox"
            checked={permissions.householdWrite}
            disabled={loading || saving || environment === "production"}
            onChange={(event) => choose("household", event.target.checked)}
          />
          {" "}Allow {memberName} to post to the shared Household ledger from ChatGPT
        </label>
        <p className="muted" style={{ marginTop: 10 }}>
          No delete, bill payment, card payment, transfer to a bank, settings change, or silent write tool is enabled. Turn either switch off to block new and already-prepared confirmations for that ledger.
        </p>
        {environment === "production" ? <p className="muted">Production stays read-only until the September security cutover.</p> : null}
        <KitchenNotice message={error ?? ""} />
        <button className="ghost" style={{ width: "100%", marginTop: 8 }} type="button" onClick={launchHerculesPro}>
          Open / reconnect Hercules Pro ↗
        </button>
        {(permissions.personalWrite || permissions.householdWrite) ? (
          <p className="muted" style={{ marginTop: 8 }}>Reconnect the ChatGPT app after enabling writing so OAuth can add the separate <code>hearth.write</code> permission.</p>
        ) : null}
      </section>
      {pendingEnable ? (
        <ConfirmSheet
          title={`Allow ${pendingEnable === "personal" ? "Personal" : "Household"} writes from ChatGPT?`}
          body={`Hercules Pro may prepare a transaction for the ${pendingEnable} ledger. ChatGPT must show the amount, date, account, category, note, and duplicate warning, then ask you to confirm before Hearth posts it.`}
          extra="This Development permission is optional and reversible. It does not allow deletes, bank payments, settings changes, or writes without a fresh confirmation preview."
          confirmLabel="Allow confirmed writes"
          busy={saving}
          onCancel={() => setPendingEnable(null)}
          onConfirm={() => { void save({
            personalWrite: pendingEnable === "personal" ? true : permissions.personalWrite,
            householdWrite: pendingEnable === "household" ? true : permissions.householdWrite,
          }); }}
        />
      ) : null}
    </>
  );
}

async function finishAuthorization(input: {
  authorizationRequest: string;
  environment?: Environment;
  householdId?: string;
  memberId?: string;
  supabaseAccessToken?: string;
  supabaseRefreshToken?: string;
  deny?: boolean;
}): Promise<string> {
  const response = await fetch("/oauth/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await response.json() as { ok?: boolean; redirect?: string; error?: string };
  if (!response.ok || !body.ok || !body.redirect) throw new Error(body.error || "Hercules Pro could not connect.");
  return body.redirect;
}

export function HerculesProApproval({
  authorizationRequest,
  environment,
  household,
  session,
}: {
  authorizationRequest: string | null;
  environment: Environment;
  household: Household | null;
  session: Session | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!authorizationRequest) return null;

  const cloudSession = loadSupabaseSession(environment);
  // After Google returns, leave the ordinary household/member chooser usable.
  // The consent sheet reappears as soon as that scope is selected.
  if (cloudSession && (!household || !session)) return null;
  const ready = Boolean(cloudSession && household && session);
  const memberName = household?.members.find((member) => member.id === session?.memberId)?.name || "this member";

  async function deny(): Promise<void> {
    setBusy(true);
    setError("");
    try {
      window.location.assign(await finishAuthorization({ authorizationRequest: authorizationRequest!, deny: true }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setBusy(false);
    }
  }

  async function connect(): Promise<void> {
    if (!cloudSession) {
      startSupabaseGoogleSignIn(environment, window.location.href);
      return;
    }
    if (!household || !session) {
      setError("Enter the household you want Hercules Pro to read, then try again.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const freshCloudSession = await ensureSupabaseSession(environment);
      if (!freshCloudSession) throw new Error("Continue with Google in Hearth before connecting Hercules Pro.");
      window.location.assign(await finishAuthorization({
        authorizationRequest: authorizationRequest!,
        environment,
        householdId: household.householdId,
        memberId: session.memberId,
        supabaseAccessToken: freshCloudSession.accessToken,
        supabaseRefreshToken: freshCloudSession.refreshToken,
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setBusy(false);
    }
  }

  return (
    <>
      <ConfirmSheet
        title="Connect Hercules Pro to this ledger?"
        body={ready
          ? `Connect ${memberName} in ${household?.name}. ChatGPT may read this member's Personal ledger and the shared Household ledger. If this member enabled writing in More and ChatGPT requested that separate scope, every post still requires an exact preview and confirmation.`
          : cloudSession
            ? "First enter the household you want to use in ChatGPT. Nothing is connected yet."
            : "Continue with Google first. Hearth will then ask which open household and member ChatGPT may read."}
        extra={`${error ? `${error} ` : ""}This never replaces free Hercules. Read-only is the default. Confirmed write access cannot delete, pay a bank, change settings, or bypass the member's opt-in. You can close ChatGPT and keep using every in-app Hercules tool.`}
        confirmLabel={cloudSession ? "Connect Hercules Pro" : "Continue with Google"}
        busy={busy}
        onCancel={() => { void deny(); }}
        onConfirm={() => { void connect(); }}
      />
    </>
  );
}
