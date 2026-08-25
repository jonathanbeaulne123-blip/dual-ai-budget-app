import { useRef, useState } from "react";
import {
  formatInvitePhrase,
  isValidInviteToken,
  joinUrlFor,
  makeHearthPass,
  passFilename,
  spokenInviteHint,
  describeDeviceLabel,
  localDeviceId,
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
import {
  inviteReasonMessage,
  issueHouseholdInvite,
  type InviteKind,
  type IssueInviteResult,
} from "./ledger/householdInvites.ts";
import { readSupabaseConfig } from "./ledger/supabase.ts";
import { AuthJoinQr } from "./AuthJoinQr.tsx";

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
  onBack: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [cloud, setCloud] = useState<boolean | null>(null);
  const authToken = authInviteTokenFromText(inviteInput) || (isAuthInviteToken(inviteInput.trim()) ? inviteInput.trim().toLowerCase() : "");

  async function join() {
    onBusy(true);
    onError("");
    try {
      const raw = inviteInput.trim();
      if (raw.startsWith("{")) {
        await onJoined(joinFromPastedSecret(raw, null, undefined, environment));
        return;
      }
      const token = authInviteTokenFromText(raw);
      if (token) {
        if (!onRedeemAuthInvite) {
          throw new Error("Continue with Google, then open this invite link again.");
        }
        await onRedeemAuthInvite(token);
        return;
      }
      const live = cloud ?? await cloudBooksLive();
      setCloud(live);
      if (isValidInviteToken(raw)) {
        await onJoined(await joinSharedHousehold(raw, undefined, environment));
        return;
      }
      throw new Error("Paste the Auth join link, the three-word phrase, or a Hearth Pass.");
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      onBusy(false);
    }
  }

  return (
    <>
      <label>Join link, phrase, or Hearth Pass</label>
      <input
        value={inviteInput}
        onChange={(event) => onInviteInput(event.target.value)}
        placeholder={supabaseAuthEnabled() ? "Auth link or cedar lantern kite" : "cedar lantern kite"}
        autoCapitalize="none"
        autoCorrect="off"
      />
      {supabaseAuthEnabled() && (
        <p className="muted">
          Email and QR invites need Continue with Google. You do not need a household first —
          scan or open the invite, then sign in. A three-word phrase is not Auth.
        </p>
      )}
      <p className="muted">{hostingHint(Boolean(cloud))}</p>
      {error && <p className="danger">{error}</p>}
      <button className="primary" disabled={busy} onClick={() => void join()}>
        {authToken ? "Redeem invite" : "Join household"}
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
              await onJoined(applyHearthPass(null, parseHearthPass(text), undefined, environment));
            } catch (caught) {
              onError(caught instanceof Error ? caught.message : String(caught));
            } finally {
              onBusy(false);
            }
          });
        }}
      />
      <button className="ghost" style={{ width: "100%", marginTop: 8 }} onClick={onBack}>Back</button>
    </>
  );
}

function AuthInviteChrome({
  household,
  memberId,
  busy,
  onError,
  onBusy,
}: {
  household: Household;
  memberId: string;
  busy: boolean;
  onError: (value: string) => void;
  onBusy: (value: boolean) => void;
}) {
  const invitees = household.members.filter((member) => member.active && member.id !== memberId);
  const [targetMemberId, setTargetMemberId] = useState(invitees[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [issued, setIssued] = useState<IssueInviteResult & { ok: true } | null>(null);

  async function issue(kind: InviteKind) {
    onBusy(true);
    onError("");
    setIssued(null);
    try {
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
  if (invitees.length === 0) {
    return (
      <div className="auth-invite">
        <h3>Auth invite</h3>
        <p className="muted">Add another person to the household roster before issuing an email or QR invite.</p>
      </div>
    );
  }

  const absoluteJoin = issued
    ? joinUrlFromInviteToken(window.location.origin, issued.inviteToken, household.environment)
    : "";

  return (
    <div className="auth-invite">
      <h3>Auth invite (email / QR)</h3>
      <p className="muted">
        One-time Google join. Phrase and Hearth Pass stay legacy aids — they are not Auth.
      </p>
      <label htmlFor="auth-invite-member">Invite seat</label>
      <select
        id="auth-invite-member"
        value={targetMemberId}
        onChange={(event) => setTargetMemberId(event.target.value)}
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
      />
      <button className="ghost" style={{ width: "100%", marginTop: 8 }} disabled={busy} onClick={() => void issue("email")}>
        Issue email invite
      </button>
      <button className="ghost" style={{ width: "100%", marginTop: 8 }} disabled={busy} onClick={() => void issue("qr")}>
        Issue QR / link invite
      </button>
      {issued && (
        <div className="auth-invite-issued">
          <p>
            {issued.kind === "email" ? "Email" : "QR"} invite ready. Partner opens the camera,
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

export function PairingCard({
  household,
  memberId,
  error,
  busy,
  syncState,
  inviteInput,
  onInviteInput,
  onHousehold,
  onError,
  onBusy,
  onSyncState,
  onBeforeSensitive,
}: {
  household: Household;
  memberId: string;
  error: string;
  busy: boolean;
  syncState: "idle" | "syncing" | "synced" | "error";
  inviteInput: string;
  onInviteInput: (value: string) => void;
  onHousehold: (household: Household) => Promise<void>;
  onError: (value: string) => void;
  onBusy: (value: boolean) => void;
  onSyncState: (value: "idle" | "syncing" | "synced" | "error") => void;
  onBeforeSensitive?: () => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [cloudLive, setCloudLive] = useState(false);
  const phrase = formatInvitePhrase(household.inviteCode);
  const url = typeof window !== "undefined" ? joinUrlFor(household.inviteCode, window.location.origin) : "";

  async function publish() {
    onBusy(true);
    onError("");
    try {
      await onBeforeSensitive?.();
      const next = household.linked ? household : markLinked(household);
      await onHousehold(next);
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
        <h2>Invite the other person</h2>
        <span className={`pill ${household.linked ? "good" : ""}`}>{household.linked ? "Cloud live" : "Pass / phrase"}</span>
      </header>
      <p>
        Do not type a six-character code. Say the phrase across the table, send the join link,
        or hand over a Hearth Pass. The pass is the shared ledger without anyone’s personal rows.
      </p>
      <div className="invite-code" aria-label="Household phrase">{phrase}</div>
      <p className="muted">{spokenInviteHint(household.inviteCode)}</p>
      {url && <p className="join-url">{url}</p>}
      <p className="muted">{hostingHint(cloudLive || household.linked)}</p>
      <AuthInviteChrome
        household={household}
        memberId={memberId}
        busy={busy}
        onError={onError}
        onBusy={onBusy}
      />
      {syncState === "syncing" && <p className="muted">Syncing the shared household…</p>}
      {syncState === "synced" && <p className="muted">Shared household is up to date.</p>}
      <div className="device-list">
        <h3>Devices on this household</h3>
        <p className="muted">Soft presence from phones that touched the shared snapshot. Not Auth. This device: {describeDeviceLabel()} · {localDeviceId()}</p>
        {(household.devices ?? []).length === 0 ? (
          <p className="muted">No devices recorded yet. Sync or open the kitchen and one will appear.</p>
        ) : (
          <ul>
            {(household.devices ?? []).map((device) => (
              <li key={device.id}>
                <strong>{device.label}</strong>
                <span className="muted"> · {device.environment} · seen {device.seenAt.slice(0, 16).replace("T", " ")}</span>
                {device.id === localDeviceId() ? <span className="pill good">this phone</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && <p className="danger">{error}</p>}
      <button className="primary" onClick={() => void shareInvite(household)}>Share phrase and link</button>
      <button className="ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => downloadPass(household)}>Download Hearth Pass</button>
      {!supabaseAuthEnabled() && (
        <button className="ghost" style={{ width: "100%", marginTop: 8 }} disabled={busy} onClick={() => void publish()}>
          {household.linked ? "Sync to the cloud" : "Publish to the cloud"}
        </button>
      )}
      {supabaseAuthEnabled() && (
        <p className="muted" style={{ marginTop: 8 }}>
          Signed-in phones share in the background. Partner posts appear while this kitchen stays open.
        </p>
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
      {household.linked && (
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
    </section>
  );
}
