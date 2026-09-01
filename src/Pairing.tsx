import { useEffect, useRef, useState } from "react";
import {
  formatInvitePhrase,
  isValidInviteToken,
  joinUrlFor,
  makeHearthPass,
  passFilename,
  spokenInviteHint,
  describeDeviceLabel,
  localDeviceId,
  pairingStatusLabel,
  type Household,
} from "./core/index.ts";
import { authInviteTokenFromText, isAuthInviteToken } from "./core/authInvite.ts";
import { applyHearthPass, parseHearthPass } from "./core/pass.ts";
import { markLinked, unlinkHousehold } from "./core/sharing.ts";
import {
  cloudBooksLive,
  hostingHint,
  joinFromPastedSecret,
  joinSharedHousehold,
  reconcileHousehold,
} from "./api.ts";
import {
  authenticatedSupabaseConfig,
  ensureSupabaseSession,
  joinUrlFromInviteToken,
  supabaseAuthEnabled,
} from "./auth/supabaseSession.ts";
import { KitchenNotice } from "./KitchenNotice.tsx";
import {
  authInviteIssueGate,
  inviteReasonMessage,
  issueHouseholdInvite,
  listHouseholdAccess,
  registerCurrentHouseholdDevice,
  revokeHouseholdDevice,
  revokeHouseholdMember,
  type HouseholdAccess,
  type ContinuitySyncUiState,
  type InviteKind,
  type IssueInviteResult,
  type MembershipRole,
} from "./ledger/householdInvites.ts";
import { pushSupabaseHousehold, readSupabaseConfig } from "./ledger/supabase.ts";
import { hostedContinuityAllowed } from "./ledger/continuityPolicy.ts";
import { AuthJoinQr } from "./AuthJoinQr.tsx";
import { inviteFlowMessage, type InviteFlowState } from "./HouseholdEntryCard.tsx";

function downloadPass(household: Household) {
  const pass = makeHearthPass(household);
  const blob = new Blob([JSON.stringify(pass, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = passFilename(household);
  link.click();
  URL.revokeObjectURL(url);
}

async function shareInvite(household: Household) {
  const phrase = formatInvitePhrase(household.inviteCode);
  const url = joinUrlFor(household.inviteCode, window.location.origin);
  const text = `Join our Hearth household. The phrase is ${phrase}.`;
  if (navigator.share) {
    try {
      await navigator.share({ title: "Join our Hearth", text, url });
      return;
    } catch {
      // Fall through to clipboard.
    }
  }
  await navigator.clipboard?.writeText(`${text}\n${url}`);
}

/**
 * Keep older phrase/recovery QR codes usable after Google invitations became
 * the primary join path. Auth invitations stay in the Google field; only
 * recognized legacy values are handed to Advanced recovery.
 */
export function legacyRecoveryInputFromInvite(value: string): string {
  const raw = value.trim();
  if (!raw || authInviteTokenFromText(raw)) return "";
  return raw.startsWith("{") || isValidInviteToken(raw) ? raw : "";
}

export function WelcomeJoin({
  error,
  busy,
  environment,
  inviteInput,
  onInviteInput,
  onError,
  onBusy,
  onJoined,
  onRedeemAuthInvite,
  inviteFlowState = "idle",
  onScanQr,
  onUseAnotherGoogle,
  onBack,
}: {
  error: string;
  busy: boolean;
  environment: "development" | "production";
  inviteInput: string;
  onInviteInput: (value: string) => void;
  onError: (value: string) => void;
  onBusy: (value: boolean) => void;
  onJoined: (household: Household) => Promise<void>;
  /** Auth/RLS one-time invite (email/QR). Phrase path stays separate. */
  onRedeemAuthInvite?: (token: string) => Promise<void>;
  inviteFlowState?: InviteFlowState;
  onScanQr?: () => void;
  onUseAnotherGoogle?: () => void;
  onBack: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [cloud, setCloud] = useState<boolean | null>(null);
  const [recoveryInput, setRecoveryInput] = useState("");
  const authToken = authInviteTokenFromText(inviteInput) || (isAuthInviteToken(inviteInput.trim()) ? inviteInput.trim().toLowerCase() : "");

  useEffect(() => {
    setRecoveryInput(legacyRecoveryInputFromInvite(inviteInput));
  }, [inviteInput]);

  async function redeemGoogleInvite() {
    onBusy(true);
    onError("");
    try {
      const raw = inviteInput.trim();
      const token = authInviteTokenFromText(raw);
      if (token) {
        if (!onRedeemAuthInvite) {
          throw new Error("Continue with Google to accept this invitation.");
        }
        await onRedeemAuthInvite(token);
        return;
      }
      throw new Error("Paste the Google invitation link you received, or scan its QR code.");
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      onBusy(false);
    }
  }

  async function recoverLegacyHousehold() {
    onBusy(true);
    onError("");
    try {
      const raw = recoveryInput.trim();
      if (raw.startsWith("{")) {
        await onJoined(joinFromPastedSecret(raw, null, undefined, environment));
        return;
      }
      const live = cloud ?? await cloudBooksLive();
      setCloud(live);
      if (isValidInviteToken(raw)) {
        await onJoined(await joinSharedHousehold(raw, undefined, environment));
        return;
      }
      throw new Error("Enter the three-word recovery code, paste a recovery secret, or import a Hearth Pass.");
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      onBusy(false);
    }
  }

  return (
    <section className="welcome-join" aria-labelledby="welcome-join-title">
      <p className="kicker">Google invitation</p>
      <h2 id="welcome-join-title">Join a household</h2>
      <p className="muted">Open the invitation link you received. Hearth will keep it safe while Google confirms who you are.</p>
      <label htmlFor="welcome-google-invite">Invitation link</label>
      <input
        id="welcome-google-invite"
        value={inviteInput}
        onChange={(event) => onInviteInput(event.target.value)}
        placeholder="https://…/join?invite=…"
        autoCapitalize="none"
        autoCorrect="off"
      />
      <p className="welcome-join__status" role="status" aria-live="polite" aria-busy={inviteFlowState === "redeeming" || inviteFlowState === "refreshing"}>
        {inviteFlowMessage(inviteFlowState)}
      </p>
      <KitchenNotice message={error} />
      <button className="primary welcome-join__primary" disabled={busy || !authToken} onClick={() => void redeemGoogleInvite()}>
        {inviteFlowState === "awaiting-google" ? "Continue with Google" : inviteFlowState === "redeeming" ? "Accepting invitation…" : inviteFlowState === "refreshing" ? "Refreshing households…" : inviteFlowState === "error" ? "Try invitation again" : "Accept invitation"}
      </button>
      {onScanQr && <button className="ghost welcome-join__secondary" type="button" disabled={busy} onClick={onScanQr}>Scan invitation QR code</button>}
      {inviteFlowState === "error" && onUseAnotherGoogle && (
        <button className="ghost welcome-join__secondary" type="button" onClick={onUseAnotherGoogle}>
          Sign out and try another Google account
        </button>
      )}

      <details className="welcome-recovery">
        <summary>Advanced recovery</summary>
        <p className="muted">Three-word codes and Hearth Pass files are older recovery tools. Google invitations are the normal way to join.</p>
        <label htmlFor="welcome-recovery-code">Three-word code or recovery secret</label>
        <input
          id="welcome-recovery-code"
          value={recoveryInput}
          onChange={(event) => setRecoveryInput(event.target.value)}
          placeholder="cedar lantern kite"
          autoCapitalize="none"
          autoCorrect="off"
        />
        <p className="muted">{hostingHint(Boolean(cloud))}</p>
        <button className="ghost welcome-join__secondary" type="button" disabled={busy || !recoveryInput.trim()} onClick={() => void recoverLegacyHousehold()}>
          Use recovery code
        </button>
        <button className="ghost welcome-join__secondary" type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
          Import Hearth Pass
        </button>
      </details>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          void file.text().then(async (text) => {
            onBusy(true);
            onError("");
            try {
              await onJoined(applyHearthPass(null, parseHearthPass(text), undefined, environment));
            } catch (caught) {
              onError(caught instanceof Error ? caught.message : String(caught));
            } finally {
              onBusy(false);
            }
          });
        }}
      />
      <button className="ghost welcome-join__secondary" type="button" disabled={busy} onClick={onBack}>Back to households</button>
    </section>
  );
}

function AuthInviteChrome({
  household,
  memberId,
  busy,
  syncState,
  onError,
  onBusy,
}: {
  household: Household;
  memberId: string;
  busy: boolean;
  syncState: ContinuitySyncUiState;
  onError: (value: string) => void;
  onBusy: (value: boolean) => void;
}) {
  const invitees = household.members.filter((member) => member.active && member.id !== memberId);
  const [targetMemberId, setTargetMemberId] = useState(invitees[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MembershipRole>("owner");
  const [issued, setIssued] = useState<IssueInviteResult & { ok: true } | null>(null);
  const issueGate = authInviteIssueGate({
    syncState,
    sharingMode: household.sharing?.mode,
  });
  const issueBlocked = busy || !issueGate.ready;

  async function issue(kind: InviteKind) {
    onBusy(true);
    onError("");
    setIssued(null);
    try {
      if (!hostedContinuityAllowed(household.environment)) throw new Error(inviteReasonMessage("continuity-disabled"));
      if (!issueGate.ready) throw new Error(issueGate.message ?? "Wait until this household finishes sharing.");
      if (!targetMemberId) throw new Error("Choose who this invite is for.");
      const session = await ensureSupabaseSession(household.environment);
      const config = authenticatedSupabaseConfig(readSupabaseConfig(), session);
      if (!session || !config?.accessToken) {
        throw new Error("Continue with Google before sending an Auth invite.");
      }
      const result = await issueHouseholdInvite({
        environment: household.environment,
        householdId: household.householdId,
        targetMemberId,
        kind,
        invitedEmail: kind === "email" ? email : null,
        role,
        config,
      });
      if (!result.ok) throw new Error(inviteReasonMessage(result.reason));
      setIssued(result);
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      onBusy(false);
    }
  }

  async function copyJoinLink() {
    if (!issued) return;
    const absolute = joinUrlFromInviteToken(window.location.origin, issued.inviteToken, household.environment);
    await navigator.clipboard?.writeText(absolute);
  }

  if (!supabaseAuthEnabled()) return null;
  if (!hostedContinuityAllowed(household.environment)) {
    return (
      <div className="auth-invite">
        <h3>Invite with Google</h3>
        <p className="muted">Production cloud continuity is unavailable in this Development pilot.</p>
      </div>
    );
  }
  if (invitees.length === 0) {
    return (
      <div className="auth-invite">
        <h3>Invite with Google</h3>
        <p className="muted">Add another person to the household roster before issuing an email or QR invite.</p>
      </div>
    );
  }

  const absoluteJoin = issued
    ? joinUrlFromInviteToken(window.location.origin, issued.inviteToken, household.environment)
    : "";

  return (
    <div className="auth-invite">
      <h3>Invite with Google</h3>
      <p className="muted">
        One-time Google join. Phrase and Hearth Pass stay under Advanced — they are not Auth.
      </p>
      <label htmlFor="auth-invite-member">Invite seat</label>
      <select
        id="auth-invite-member"
        value={targetMemberId}
        onChange={(event) => setTargetMemberId(event.target.value)}
        disabled={issueBlocked}
        aria-describedby="auth-invite-wait"
      >
        {invitees.map((member) => (
          <option key={member.id} value={member.id}>{member.name}</option>
        ))}
      </select>
      <label htmlFor="auth-invite-email">Their Google email (email invite)</label>
      <input
        id="auth-invite-email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="partner@gmail.com"
        autoCapitalize="none"
        autoCorrect="off"
        disabled={issueBlocked}
      />
      <label htmlFor="auth-invite-role">Household access</label>
      <select
        id="auth-invite-role"
        value={role}
        onChange={(event) => setRole(event.target.value === "member" ? "member" : "owner")}
        disabled={issueBlocked}
      >
        <option value="owner">Co-owner — equal routine authority</option>
        <option value="member">Member — owner-managed access</option>
      </select>
      <p className="muted">
        Co-owners can manage devices and ordinary members. One co-owner cannot silently remove another.
      </p>
      <p className="muted" id="auth-invite-wait" role="status" aria-atomic="true">
        {issueGate.message ?? ""}
      </p>
      <button
        className="ghost"
        style={{ width: "100%", marginTop: 8 }}
        disabled={issueBlocked}
        aria-describedby="auth-invite-wait"
        onClick={() => void issue("email")}
      >
        Issue email invite
      </button>
      <button
        className="ghost"
        style={{ width: "100%", marginTop: 8 }}
        disabled={issueBlocked}
        aria-describedby="auth-invite-wait"
        onClick={() => void issue("qr")}
      >
        Issue QR / link invite
      </button>
      {issued && (
        <div className="auth-invite-issued">
          <p>
            {issued.kind === "email" ? "Email" : "QR"} {issued.role === "owner" ? "co-owner" : "member"} invite ready. Partner opens the camera,
            scans this code, Continues with Google — no household required beforehand.
          </p>
          <AuthJoinQr joinUrl={absoluteJoin} />
          <p className="join-url" aria-label="Auth join link">{absoluteJoin}</p>
          <p className="muted">Expires {issued.expiresAt.slice(0, 16).replace("T", " ")} UTC</p>
          <button className="primary" type="button" onClick={() => void copyJoinLink()}>Copy Auth join link</button>
        </div>
      )}
    </div>
  );
}

function HouseholdAccessPanel({
  household,
  busy,
  onBusy,
  onError,
  onLeaveHousehold,
  onCurrentDeviceRevoked,
}: {
  household: Household;
  busy: boolean;
  onBusy: (value: boolean) => void;
  onError: (value: string) => void;
  onLeaveHousehold?: () => Promise<void>;
  onCurrentDeviceRevoked?: () => void;
}) {
  const [access, setAccess] = useState<HouseholdAccess | null>(null);

  async function refresh() {
    if (!supabaseAuthEnabled() || !hostedContinuityAllowed(household.environment)) return;
    const session = await ensureSupabaseSession(household.environment);
    const config = authenticatedSupabaseConfig(readSupabaseConfig(), session);
    if (!session || !config?.accessToken) return;
    const registered = await registerCurrentHouseholdDevice({
      environment: household.environment,
      deviceId: localDeviceId(),
      deviceLabel: describeDeviceLabel(),
      config,
    });
    if (!registered.ok) {
      onError(inviteReasonMessage(registered.reason));
      return;
    }
    const result = await listHouseholdAccess({
      environment: household.environment,
      householdId: household.householdId,
      config,
    });
    if (!result.ok) {
      onError(inviteReasonMessage(result.reason));
      return;
    }
    setAccess(result.access);
  }

  useEffect(() => {
    void refresh();
    // household revision changes do not alter Auth access; identity is the key.
  }, [household.environment, household.householdId]);

  async function revokeDevice(accessId: string, current: boolean) {
    const warning = current
      ? "Remove this signed-in device now? Cloud access will stop immediately after the server confirms."
      : "Remove this device? Its cloud reads and queued writes will be denied on reconnect.";
    if (!window.confirm(warning)) return;
    onBusy(true);
    onError("");
    try {
      const session = await ensureSupabaseSession(household.environment);
      const config = authenticatedSupabaseConfig(readSupabaseConfig(), session);
      const result = await revokeHouseholdDevice({
        environment: household.environment,
        householdId: household.householdId,
        accessId,
        config,
      });
      if (!result.ok) throw new Error(inviteReasonMessage(result.reason));
      if (current) {
        onCurrentDeviceRevoked?.();
        onError("This device no longer has cloud access. Sign out and Continue with Google for a fresh session.");
        return;
      }
      await refresh();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      onBusy(false);
    }
  }

  async function revokeMember(memberId: string) {
    if (!window.confirm("Remove this member? Their cloud access and queued writes will stop. Rejoining needs a fresh invite.")) return;
    onBusy(true);
    onError("");
    try {
      const session = await ensureSupabaseSession(household.environment);
      const config = authenticatedSupabaseConfig(readSupabaseConfig(), session);
      const result = await revokeHouseholdMember({
        environment: household.environment,
        householdId: household.householdId,
        memberId,
        config,
      });
      if (!result.ok) throw new Error(inviteReasonMessage(result.reason));
      await refresh();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      onBusy(false);
    }
  }

  if (!supabaseAuthEnabled() || !hostedContinuityAllowed(household.environment)) return null;
  const ownerCount = access?.members.filter((member) => member.role === "owner").length ?? 0;
  const mayLeave = access?.currentRole !== "owner" || ownerCount > 1;

  return (
    <section className="household-access" aria-labelledby="household-access-heading">
      <header>
        <h3 id="household-access-heading">Household access</h3>
        <button className="chip" type="button" disabled={busy} onClick={() => void refresh()}>Refresh</button>
      </header>
      <p className="muted">
        Authenticated access only. No balances, transactions, Google subjects, emails, or tokens appear here.
      </p>
      {!access ? <p className="muted">Loading authenticated devices…</p> : (
        <>
          <ul className="access-members">
            {access.members.map((member) => (
              <li key={member.memberId}>
                <strong>{member.displayName}</strong> · {member.role === "owner" ? "co-owner" : "member"}
                {member.memberId === access.currentMemberId ? <span className="pill good">you</span> : null}
                {access.currentRole === "owner" && member.role === "member" && member.memberId !== access.currentMemberId ? (
                  <button type="button" className="chip" disabled={busy} onClick={() => void revokeMember(member.memberId)}>Remove member</button>
                ) : null}
              </li>
            ))}
          </ul>
          <h4>Signed-in devices</h4>
          {access.devices.length === 0 ? <p className="muted">No registered Auth devices yet.</p> : (
            <ul className="access-devices">
              {access.devices.map((device) => {
                const owner = access.members.find((member) => member.memberId === device.memberId);
                const canRevoke = access.currentRole === "owner" || device.memberId === access.currentMemberId;
                return (
                  <li key={device.accessId}>
                    <strong>{device.deviceLabel}</strong> · {owner?.displayName ?? "Household member"}
                    {device.current ? <span className="pill good">this session</span> : null}
                    <span className="muted"> · seen {device.lastSeenAt.slice(0, 16).replace("T", " ")} UTC</span>
                    {canRevoke ? (
                      <button type="button" className="chip" disabled={busy} onClick={() => void revokeDevice(device.accessId, device.current)}>
                        Remove device
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="muted">
            Removing access blocks Hearth cloud reads and writes. It cannot erase books already cached while a device is offline.
          </p>
          {access.audit.length > 0 ? (
            <details>
              <summary>Recent access activity</summary>
              <ul className="access-audit">
                {access.audit.slice(0, 8).map((event, index) => (
                  <li key={`${event.occurredAt}:${event.action}:${index}`}>
                    {event.action.replaceAll("-", " ")}
                    <span className="muted"> · {event.occurredAt.slice(0, 16).replace("T", " ")} UTC</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          {onLeaveHousehold ? (
            <button
              type="button"
              className="ghost"
              disabled={busy || !mayLeave}
              title={mayLeave ? undefined : "Add another co-owner before the last owner leaves."}
              onClick={() => {
                if (!window.confirm("Leave this household? Cloud access ends, queued changes will not replay, this phone's local copy will be cleared, and rejoining needs a fresh invite.")) return;
                void onLeaveHousehold();
              }}
            >
              Leave household
            </button>
          ) : null}
          {!mayLeave ? <p className="muted">Add another co-owner before the last owner leaves.</p> : null}
        </>
      )}
    </section>
  );
}

export function PairingCard({
  household,
  memberId,
  error,
  busy,
  syncState,
  syncFreshnessLine,
  inviteInput,
  onInviteInput,
  onHousehold,
  onError,
  onBusy,
  onSyncState,
  onBeforeSensitive,
  softPresenceOptedOut = false,
  onSoftPresenceOptOut,
  onLeaveHousehold,
  onCurrentDeviceRevoked,
  onCopySyncDiagnostic,
}: {
  household: Household;
  memberId: string;
  error: string;
  busy: boolean;
  syncState: "idle" | "syncing" | "synced" | "error";
  syncFreshnessLine?: string | null;
  inviteInput: string;
  softPresenceOptedOut?: boolean;
  onSoftPresenceOptOut?: (optedOut: boolean) => void;
  onLeaveHousehold?: () => Promise<void>;
  onCurrentDeviceRevoked?: () => void;
  onCopySyncDiagnostic?: () => Promise<string>;
  onInviteInput: (value: string) => void;
  onHousehold: (household: Household) => Promise<void>;
  onError: (value: string) => void;
  onBusy: (value: boolean) => void;
  onSyncState: (value: "idle" | "syncing" | "synced" | "error") => void;
  onBeforeSensitive?: () => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [cloudLive, setCloudLive] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [diagnosticStatus, setDiagnosticStatus] = useState("");
  const phrase = formatInvitePhrase(household.inviteCode);
  const url = typeof window !== "undefined" ? joinUrlFor(household.inviteCode, window.location.origin) : "";
  const status = pairingStatusLabel(household, { authEnabled: supabaseAuthEnabled() });
  const inviteGate = authInviteIssueGate({
    syncState,
    sharingMode: household.sharing?.mode,
  });
  const hideOwnerErrorWhileSharing = !inviteGate.ready
    && error === inviteReasonMessage("not-owner");

  async function publish() {
    onBusy(true);
    onError("");
    try {
      await onBeforeSensitive?.();
      const next = household.linked ? household : markLinked(household);
      await onHousehold(next);
      // D-143: Auth-off recovery only — automatic commits never use linked alone.
      const pushed = await pushSupabaseHousehold(next, readSupabaseConfig(), {
        expectedRevision: next.baseRevision ?? 0,
        legacyLinkedPublish: true,
      });
      if (pushed.skipped) {
        onError(pushed.error || "Cloud publish was skipped. Continue with Google for automatic sharing.");
        onSyncState("error");
        return;
      }
      if (pushed.conflict) {
        onError(pushed.error || "Another phone posted a newer household snapshot. Nothing was overwritten.");
        onSyncState("error");
        return;
      }
      if (!pushed.schema) {
        onError(pushed.error || "Could not reach the shared household.");
        onSyncState("error");
        return;
      }
      onSyncState("synced");
    } catch (caught) {
      downloadPass(household);
      onError(caught instanceof Error ? caught.message : String(caught));
      onSyncState("error");
    } finally {
      onBusy(false);
    }
  }

  return (
    <section className="card">
      <header>
        <h2>Invite</h2>
        <span className={`pill ${status.good ? "good" : ""}`}>{status.label}</span>
      </header>
      <p>
        {supabaseAuthEnabled()
          ? "Send a Google invite so your partner opens the same household on their phone. Sharing continues in the background while this kitchen stays open."
          : "Say the phrase across the table, send the join link, or hand over a Hearth Pass. The pass is the shared ledger without anyone’s personal rows."}
      </p>
      <AuthInviteChrome
        household={household}
        memberId={memberId}
        busy={busy}
        syncState={syncState}
        onError={onError}
        onBusy={onBusy}
      />
      <HouseholdAccessPanel
        household={household}
        busy={busy}
        onBusy={onBusy}
        onError={onError}
        onLeaveHousehold={onLeaveHousehold}
        onCurrentDeviceRevoked={onCurrentDeviceRevoked}
      />
      {!supabaseAuthEnabled() && (
        <>
          <div className="invite-code" aria-label="Household phrase">{phrase}</div>
          <p className="muted">{spokenInviteHint(household.inviteCode)}</p>
          {url && <p className="join-url">{url}</p>}
          <button className="primary" onClick={() => void shareInvite(household)}>Share phrase and link</button>
          <button className="ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => downloadPass(household)}>Download Hearth Pass</button>
        </>
      )}
      {supabaseAuthEnabled() && (
        <button className="ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => void shareInvite(household)}>
          Share legacy phrase and link
        </button>
      )}
      <p className="muted">{hostingHint(cloudLive || household.linked || supabaseAuthEnabled())}</p>
      {syncFreshnessLine && <p className="sync-freshness-pairing muted">{syncFreshnessLine}</p>}
      {!syncFreshnessLine && syncState === "syncing" && <p className="muted">Syncing the shared household…</p>}
      {!syncFreshnessLine && syncState === "synced" && household.linked && (
        <p className="muted">Shared household is up to date.</p>
      )}
      <KitchenNotice message={hideOwnerErrorWhileSharing ? "" : error} />
      <details
        className="pairing-advanced"
        open={advancedOpen}
        onToggle={(event) => setAdvancedOpen((event.target as HTMLDetailsElement).open)}
      >
        <summary>Advanced recovery</summary>
        {!supabaseAuthEnabled() && (
          <button className="ghost" style={{ width: "100%", marginTop: 8 }} disabled={busy} onClick={() => void publish()}>
            {household.linked ? "Sync to the cloud (legacy)" : "Publish to the cloud (legacy)"}
          </button>
        )}
        <p className="muted">
          Prefer Continue with Google. Legacy publish is Auth-off Development recovery only and does not replace membership continuity.
        </p>
        {onCopySyncDiagnostic && (
          <>
            <button
              type="button"
              className="ghost"
              style={{ width: "100%", marginTop: 8 }}
              disabled={busy}
              onClick={() => {
                setDiagnosticStatus("");
                void onCopySyncDiagnostic()
                  .then(setDiagnosticStatus)
                  .catch((caught) => setDiagnosticStatus(caught instanceof Error ? caught.message : String(caught)));
              }}
            >
              Copy sync diagnostic
            </button>
            <p className="muted" role="status" aria-live="polite">
              {diagnosticStatus || "Development only. Copies hashed identifiers, revisions, queue state, and timing — never ledger facts or credentials."}
            </p>
          </>
        )}
        <div className="device-list">
          <h3>Devices on this household</h3>
          <p className="muted">
            Soft presence from phones that touched the shared snapshot. Not Auth. This device: {describeDeviceLabel()} · {localDeviceId()}
          </p>
          {onSoftPresenceOptOut && (
            <label className="soft-presence-opt-out">
              <input
                type="checkbox"
                checked={softPresenceOptedOut}
                disabled={busy}
                onChange={(event) => onSoftPresenceOptOut(event.target.checked)}
              />
              <span>Hide that I&apos;m in the kitchen</span>
            </label>
          )}
          {(household.devices ?? []).filter((device) => device.active).length === 0 ? (
            <p className="muted">No devices recorded yet. Sync or open the kitchen and one will appear.</p>
          ) : (
            <ul>
              {(household.devices ?? []).filter((device) => device.active).map((device) => {
                const who = device.memberId
                  ? household.members.find((member) => member.id === device.memberId && member.active)?.name
                  : null;
                return (
                  <li key={device.id}>
                    <strong>{who || device.label}</strong>
                    <span className="muted">
                      {" · "}
                      {who ? `${device.label} · ` : ""}
                      {device.environment}
                      {" · seen "}
                      {device.seenAt.slice(0, 16).replace("T", " ")}
                    </span>
                    {device.id === localDeviceId() ? <span className="pill good">this phone</span> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {supabaseAuthEnabled() && (
          <>
            <div className="invite-code" aria-label="Household phrase">{phrase}</div>
            <p className="muted">{spokenInviteHint(household.inviteCode)}</p>
            {url && <p className="join-url">{url}</p>}
            <button className="ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => downloadPass(household)}>
              Download Hearth Pass
            </button>
          </>
        )}
        {household.linked && (
          <button
            className="ghost"
            style={{ width: "100%", marginTop: 8 }}
            disabled={busy}
            onClick={() => {
              void onHousehold(unlinkHousehold(household));
              onSyncState("idle");
            }}
          >
            Stop sharing from this phone
          </button>
        )}
        <label>Join a different household</label>
        <input
          value={inviteInput}
          onChange={(event) => onInviteInput(event.target.value)}
          placeholder="cedar lantern kite"
          autoCapitalize="none"
        />
        <button
          className="ghost"
          style={{ width: "100%", marginTop: 8 }}
          disabled={busy}
          onClick={() => {
            void (async () => {
              onBusy(true);
              onError("");
              try {
                await onBeforeSensitive?.();
                const raw = inviteInput.trim();
                if (raw.startsWith("{")) {
                  await onHousehold(joinFromPastedSecret(raw, household, memberId, household.environment));
                  return;
                }
                const live = await cloudBooksLive();
                setCloudLive(live);
                await onHousehold(await joinSharedHousehold(raw, memberId, household.environment));
                onSyncState("synced");
              } catch (caught) {
                onError(caught instanceof Error ? caught.message : String(caught));
              } finally {
                onBusy(false);
              }
            })();
          }}
        >
          Join with phrase or link
        </button>
        <button className="ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => fileRef.current?.click()}>
          Import Hearth Pass
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            void file.text().then(async (text) => {
              onBusy(true);
              onError("");
              try {
                await onBeforeSensitive?.();
                await onHousehold(applyHearthPass(household, parseHearthPass(text), memberId, household.environment));
              } catch (caught) {
                onError(caught instanceof Error ? caught.message : String(caught));
              } finally {
                onBusy(false);
              }
            });
          }}
        />
        {household.linked && !supabaseAuthEnabled() && (
          <button
            className="ghost"
            style={{ width: "100%", marginTop: 8 }}
            disabled={busy}
            onClick={() => {
              void (async () => {
                onBusy(true);
                onError("");
                try {
                  await onBeforeSensitive?.();
                  const merged = await reconcileHousehold(household, memberId);
                  await onHousehold(merged);
                } catch (caught) {
                  onError(caught instanceof Error ? caught.message : String(caught));
                  onSyncState("error");
                } finally {
                  onBusy(false);
                }
              })();
            }}
          >
            Pull latest from the cloud
          </button>
        )}
      </details>
    </section>
  );
}
