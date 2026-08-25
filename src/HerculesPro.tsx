import { useState } from "react";
import type { Environment, Household } from "./core/types.ts";
import type { Session } from "./session.ts";
import {
  loadSupabaseSession,
  ensureSupabaseSession,
  startSupabaseGoogleSignIn,
} from "./auth/supabaseSession.ts";
import { ConfirmSheet } from "./Confirm.tsx";

export function herculesProAuthorizationRequest(url = window.location.href): string | null {
  try {
    return new URL(url).searchParams.get("herculesProAuthorize");
  } catch {
    return null;
  }
}

export function herculesProLaunchUrl(): string {
  return String(import.meta.env.VITE_HERCULES_PRO_URL || "https://chatgpt.com/").trim();
}

export function launchHerculesPro(): void {
  window.open(herculesProLaunchUrl(), "_blank", "noopener,noreferrer");
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
        title="Let Hercules Pro read this ledger?"
        body={ready
          ? `Connect ${memberName} in ${household?.name}. ChatGPT may ask Hearth's read-only tools about this member's personal ledger and the shared household ledger.`
          : cloudSession
            ? "First enter the household you want to use in ChatGPT. Nothing is connected yet."
            : "Continue with Google first. Hearth will then ask which open household and member ChatGPT may read."}
        extra={`${error ? `${error} ` : ""}This never replaces free Hercules. It cannot add, edit, delete, post, pay, or move money. You can close ChatGPT and keep using every in-app Hercules tool.`}
        confirmLabel={cloudSession ? "Connect read-only books" : "Continue with Google"}
        busy={busy}
        onCancel={() => { void deny(); }}
        onConfirm={() => { void connect(); }}
      />
    </>
  );
}
